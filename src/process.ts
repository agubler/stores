import { isThenable } from '@dojo/shim/Promise';
import { PatchOperation } from './state/Patch';
import { State, Store } from './Store';

/**
 * The arguments passed to a `Command`
 */
export interface CommandRequest<T = any, P = any> extends State<T> {
	payload?: P;
}

/**
 * A command factory interface. Returns the passed command. This provides a way to automatically infer and/or
 * verify the type of multiple commands without explicitly specifying the generic for each command
 */
export interface CommandFactory<T = any, P = any> {
	(command: Command<T, P>): Command<T, P>;
}

/**
 * Command that returns patch operations based on the command request
 */
export interface Command<T = any, P = any> {
	(request: CommandRequest<T, P>): Promise<PatchOperation<T>[]> | PatchOperation<T>[];
}

/**
 * Transformer function
 */
export interface Transformer<P = any> {
	(payload: P): any;
}

/**
 * A process that returns an executor using a Store and Transformer
 */
export interface Process<T = any, P = any> {
	(store: Store<T>, transformer?: Transformer): ProcessExecutor<T, P>;
}

/**
 * Represents an error from a ProcessExecutor
 */
export interface ProcessError<T = any> {
	error: Error;
	command?: Command<T>[] | Command<T>;
}

/**
 * Represents a successful result from a ProcessExecutor
 */
export interface ProcessResult<T = any, P = any> extends State<T> {
	executor: (process: Process<T, P>, payload?: P, payloadTransformer?: Transformer<P>) => Promise<ProcessResult<T, P> | ProcessError<T>>;
	undo: Undo;
	operations: PatchOperation<T>[];
	apply: (operations: PatchOperation<T>[], invalidate?: boolean) => PatchOperation<T>[];
	payload?: any;
}

/**
 * Runs a process for the given arguments.
 */
export interface ProcessExecutor<T = any, P = any> {
	(payload?: P): Promise<ProcessResult<T> | ProcessError<T>>;
}

/**
 * Callback for a process, returns an error as the first argument
 */
export interface ProcessCallback<T = any, P = any> {
	(error: ProcessError<T> | null, result: ProcessResult<T, P>): void;
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
export interface ProcessCallbackDecorator<P = any> {
	(callback?: ProcessCallback<any, P>): ProcessCallback<any, P>;
}

/**
 * CreateProcess factory interface
 */
export interface CreateProcess {
	<T = any, P = any>(commands: (Command<T, P>[] | Command<T, P>)[], callback?: ProcessCallback<T, P>): Process<T, P>;
}

/**
 * Creates a command factory with the specified type
 */
export function createCommandFactory<T, P = any>(): CommandFactory<T, P> {
	return (command) => command;
}

/**
 * Factories a process using the provided commands and an optional callback. Returns an executor used to run the process.
 *
 * @param commands The commands for the process
 * @param callback Callback called after the process is completed
 */
export function createProcess<P = any, T = any>(commands: (Command<T, P>[] | Command<T, P>)[], callback?: ProcessCallback<T, P>): Process<T, P> {
	return (store: Store<T>, transformer?: Transformer<P>): ProcessExecutor<T, P> => {
		const { apply, get, path, at } = store;
		function executor(process: Process, payload?: any, payloadTransformer?: Transformer<P>): Promise<ProcessResult<T, P> | ProcessError> {
			return process(store, payloadTransformer)(payload);
		}

		return async (payload?: P): Promise<ProcessResult<T, P> | ProcessError>  => {
			const undoOperations: PatchOperation[] = [];
			const operations: PatchOperation[] = [];
			const commandsCopy = [ ...commands ];
			const undo = () => {
				store.apply(undoOperations, true);
			};

			let command = commandsCopy.shift();
			let error: ProcessError | null = null;
			payload = transformer && payload ? transformer(payload) : payload;
			try {
				while (command) {
					let results = [];
					if (Array.isArray(command)) {
						results = command.map((commandFunction) => commandFunction({ at, get, path, payload }));
						results = await Promise.all(results);
					}
					else {
						let result = command({ at, get, path, payload });
						if (isThenable(result)) {
							result = await result;
						}
						results = [ result ];
					}

					for (let i = 0; i < results.length; i++) {
						operations.push(...results[i]);
						undoOperations.push(...apply(results[i]));
					}

					store.invalidate();
					command = commandsCopy.shift();
				}
			}
			catch (e) {
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
