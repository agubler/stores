import { isThenable } from '@dojo/shim/Promise';
import { PatchOperation } from './state/Patch';
import { State, Store } from './Store';

/**
 * The arguments passed to a `Command`
 */
export interface CommandRequest<T = any, P extends object = object> extends State<T> {
	payload: P;
}

/**
 * A command factory interface. Returns the passed command. This provides a way to automatically infer and/or
 * verify the type of multiple commands without explicitly specifying the generic for each command
 */
export interface CommandFactory<T = any, P extends object = object> {
	(command: Command<T, P>): Command<T, P>;
}

/**
 * Command that returns patch operations based on the command request
 */
export interface Command<T = any, P extends object = object> {
	(request: CommandRequest<T, P>): Promise<PatchOperation<T>[]> | PatchOperation<T>[];
}

/**
 * Transformer function
 */
export interface Transformer {
	(payload: object): object;
}

/**
 * A process that returns an executor using a Store and Transformer
 */
export interface Process<T = any, P extends object = object> {
	(store: Store<T>, transformer?: Transformer): ProcessExecutor<T, P>;
}

/**
 * Represents an error from a ProcessExecutor
 */
export interface ProcessError<T = any> {
	error: Error | null;
	command?: Command<T, any>[] | Command<T, any>;
}

/**
 * Represents a successful result from a ProcessExecutor
 */
export interface ProcessResult<T = any> extends State<T> {
	executor: <P extends object = object>(
		process: Process<T, P>,
		payload: P,
		payloadTransformer?: Transformer
	) => Promise<ProcessResult<T> | ProcessError<T>>;
	undo: Undo;
	operations: PatchOperation<T>[];
	apply: (operations: PatchOperation<T>[], invalidate?: boolean) => PatchOperation<T>[];
	payload: any;
}

/**
 * Runs a process for the given arguments.
 */
export interface ProcessExecutor<T = any, P extends object = object> {
	(payload: P): Promise<ProcessResult<T> | ProcessError<T>>;
}

/**
 * Callback for a process, returns an error as the first argument
 */
export interface ProcessCallback<T = any> {
	(error: ProcessError<T> | null, result: ProcessResult<T>): void;
}

/**
 * Function for undoing operations
 */
export interface Undo {
	(): void;
}

/**
 * ProcessCallbackDecorator callback
 */
export interface ProcessCallbackDecorator {
	(callback?: ProcessCallback): ProcessCallback;
}

/**
 * CreateProcess factory interface
 */
export interface CreateProcess<T = any, P extends object = object> {
	(commands: (Command<T, P>[] | Command<T, P>)[], callback?: ProcessCallback<T>): Process<T, P>;
}

/**
 * Creates a command factory with the specified type
 */
export function createCommandFactory<T, P extends object = object>(): CommandFactory<T, P> {
	return (command: Command<T, P>) => command;
}

/**
 * Commands that can be passed to a process
 */
export type Commands<T = any, P extends object = object> = (Command<T, P>[] | Command<T, P>)[];

/**
 * Factories a process using the provided commands and an optional callback. Returns an executor used to run the process.
 *
 * @param commands The commands for the process
 * @param callback Callback called after the process is completed
 */
export function createProcess<T = any, P extends object = object>(
	commands: Commands<T, P>,
	callback?: ProcessCallback
): Process<T, P> {
	return (store: Store<T>, transformer?: Transformer): ProcessExecutor<T, P> => {
		const { apply, get, path, at } = store;
		function executor<P extends object = object>(
			process: Process<T, P>,
			payload: P,
			payloadTransformer?: Transformer
		): Promise<ProcessResult | ProcessError> {
			return process(store, payloadTransformer)(payload);
		}

		return async (payload: P): Promise<ProcessResult | ProcessError<T>> => {
			const undoOperations: PatchOperation[] = [];
			const operations: PatchOperation[] = [];
			const commandsCopy = [...commands];
			const undo = () => {
				store.apply(undoOperations, true);
			};

			let command = commandsCopy.shift();
			let error: ProcessError | null = null;
			payload = (transformer ? transformer(payload) : payload) as P;
			try {
				while (command) {
					let results = [];
					if (Array.isArray(command)) {
						results = command.map((commandFunction) => commandFunction({ at, get, path, payload }));
						results = await Promise.all(results);
					} else {
						let result = command({ at, get, path, payload });
						if (isThenable(result)) {
							result = await result;
						}
						results = [result];
					}

					for (let i = 0; i < results.length; i++) {
						operations.push(...results[i]);
						undoOperations.push(...apply(results[i]));
					}

					store.invalidate();
					command = commandsCopy.shift();
				}
			} catch (e) {
				error = { error: e, command };
			}

			callback && callback(error, { operations, undo, apply, at, get, path, executor, payload });
			return Promise.resolve({ error, operations, undo, apply, at, get, path, executor, payload });
		};
	};
}

/**
 * Creates a process factory that will create processes with the specified callback decorators applied.
 * @param callbackDecorators array of process callback decorators to be used by the return factory.
 */
export function createProcessFactoryWith(callbackDecorators: ProcessCallbackDecorator[]): CreateProcess {
	return (commands: (Command[] | Command)[], callback?: ProcessCallback): Process => {
		const decoratedCallback = callbackDecorators.reduce((callback, callbackDecorator) => {
			return callbackDecorator(callback);
		}, callback);
		return createProcess(commands, decoratedCallback);
	};
}

/**
 * Creates a `ProcessCallbackDecorator` from a `ProcessCallback`.
 * @param processCallback the process callback to convert to a decorator.
 */
export function createCallbackDecorator(processCallback: ProcessCallback): ProcessCallbackDecorator {
	return (previousCallback?: ProcessCallback): ProcessCallback => {
		return (error: ProcessError | null, result: ProcessResult): void => {
			processCallback(error, result);
			previousCallback && previousCallback(error, result);
		};
	};
}
