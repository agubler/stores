import { isThenable } from '@dojo/shim/Promise';
import { PatchOperation } from './state/Patch';
import { Store } from './store';

/**
 * The arguments passed to a `Command`
 */
export interface CommandRequest {
	get<T = any>(pointer: string): T;
	payload: any[];
}

/**
 * Command that returns patch operations based on the command request
 */
export interface Command {
	(request?: CommandRequest): Promise<PatchOperation[]> | PatchOperation[];
}

/**
 * Transformer function
 */
export interface Transformer {
	(payload: any): any;
}

/**
 * A process that returns an executor using a Store and Transformer
 */
export interface Process<T = any> {
	(store: Store, transformer?: Transformer): ProcessExecutor<T>;
}

/**
 * Represents an error from a ProcessExecutor
 */
export interface ProcessError {
	error: Error;
	command?: Command[] | Command;
}

/**
 * Represents a successful result from a ProcessExecutor
 */
export interface ProcessResult {
	undo: Undo;
	executor: (process: Process, payload?: any, payloadTransformer?: Transformer) => Promise<ProcessResult | ProcessError>;
	payload: any;
}

/**
 * Runs a process for the given arguments.
 */
export interface ProcessExecutor<T = any> {
	(payload?: T): Promise<ProcessResult | ProcessError>;
}

/**
 * Callback for a process, returns an error as the first argument
 */
export interface ProcessCallback {
	(error: ProcessError | null, result: ProcessResult): void;
}

/**
 * Function for undoing operations
 */
export interface Undo {
	(): void;
}

/**
 * Factories a process using the provided commands and an optional callback. Returns an executor used to run the process.
 *
 * @param commands The commands for the process
 * @param callback Callback called after the process is completed
 */
export function createProcess<T>(commands: (Command[] | Command)[], callback?: ProcessCallback): Process {
	return (store: Store, transformer?: Transformer): ProcessExecutor<T> => {
		function executor(process: Process, payload: any, payloadTransformer?: Transformer): Promise<ProcessResult | ProcessError> {
			return process(store, payloadTransformer)(payload);
		}

		return async (...payload: any[]) => {
			const undoOperations: PatchOperation[] = [];
			const commandsCopy = [ ...commands ];
			const undo = () => {
				store.apply(undoOperations);
				store.invalidate();
			};

			let command = commandsCopy.shift();
			let error: ProcessError | null = null;
			payload = transformer ? [ transformer(payload) ] : payload;
			try {
				while (command) {
					let results = [];
					if (Array.isArray(command)) {
						results = command.map((commandFunction) => commandFunction({ get: store.get, payload }));
						results = await Promise.all(results);
					}
					else {
						let result = command({ get: store.get, payload });
						if (isThenable(result)) {
							result = await result;
						}
						results = [ result ];
					}

					for (let i = 0; i < results.length; i++) {
						undoOperations.push(...store.apply(results[i]));
					}

					store.invalidate();
					command = commandsCopy.shift();
				}
			}
			catch (e) {
				error = { error: e, command };
			}

			callback && callback(error, { undo, executor, payload });
			return Promise.resolve({ undo, executor, payload });
		};
	};
}
