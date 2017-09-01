import { Evented } from '@dojo/core/Evented';
import { isThenable } from '@dojo/shim/Promise';
import { Patch, PatchOperation } from './state/Patch';
import { Pointer } from './state/Pointer';
import { CommandResponse, CommandResponseType, Process } from './command';

/**
 * Represents the collection of operations required to
 * undo a specific process.
 */
export interface UndoOperations {
	process: Process;
	operations: PatchOperation[];
}

export interface Executor {
	(...args: any[]): void;
}

export interface Transformer {
	(...args: any[]): any;
}

/**
 * Application state store
 */
export class Store extends Evented {

	/**
	 * The private state object
	 */
	private _state: object = {};

	/**
	 * The undo stack of the store
	 */
	private _undoStack: UndoOperations[] = [];

	/**
	 * Creates an executor for a process and optional transformer. An executor is then used to execute the process with
	 * any additional arguments passed to the executor.
	 *
	 * @param process The process to create an executor of
	 * @param transformer An optional transformer run on the arguments passed into the returned executor
	 */
	public createExecutor = this._createExecutor.bind(this);

	/**
	 * Returns the state at a specific pointer path location.
	 *
	 * @param pointer The StorePointer path to the state that is required.
	 */
	public get = this._get.bind(this);

	/**
	 * Constructor, runs any initials processes that are received immediately.
	 *
	 * @param initialProcesses An array of processes to be executed to set up initial state
	 */
	constructor(...initialProcesses: Process[]) {
		super();
		initialProcesses.forEach((process) => this.execute(process));
	}

	/**
	 * Immediately executes the `Process` with the provided arguments against the stores
	 * state.
	 *
	 * @param process The process to execute against the store
	 * @param args Any additional arguments needed by the process
	 */
	public execute(process: Process, ...args: any[]): any {
		const executor = this.createExecutor(process);
		executor(args);
	}

	/**
	 * Function that iterates through all the passed processes and find the first occurrence in
	 * the undo stack. The undo operations for the identified process are then executed.
	 *
	 * @param processes The array of processes to target for the undo.
	 */
	public undo(...processes: Process[]) {
		if (this._undoStack.length > 0) {
			let foundIndex = -1;
			this._undoStack.some((undo, index) => {
				if (processes.indexOf(undo.process) > -1) {
					foundIndex = index;
					return true;
				}
				return false;
			});

			if (foundIndex > -1) {
				const ops: UndoOperations[] = this._undoStack.splice(0, foundIndex + 1);
				this._state = ops.reduce((state, op) => {
					const patch = new Patch(op.operations.reverse());
					const patchedState = patch.apply(state);
					return patchedState.object;
				}, this._state);

				this.emit({ type: 'invalidate' });
			}
		}
	}

	/**
	 * Indicates if there are available operations to undo.
	 */
	public get hasUndoOperations(): boolean {
		return this._undoStack.length > 0;
	}

	/**
	 * Writes the undo operations to the undo stack and emits an invalidation event.
	 *
	 * @param undoOperations The undo operations to write to the stack
	 */
	private _flush(undoOperations?: UndoOperations) {
		if (undoOperations) {
			this._undoStack.unshift(undoOperations);
		}
		this.emit({ type: 'invalidate' });
	}

	/**
	 * Returns the state at a specific pointer path location.
	 *
	 * @param pointer The StorePointer path to the state that is required.
	 */
	private _get <T>(pointer: string): T {
		const statePointer = new Pointer(pointer);
		return statePointer.get(this._state);
	}

	/**
	 * Creates a `StatePatch` instance for the provided operations and commits then to
	 * the current state.
	 *
	 * @param operations The operations to be executed.
	 */
	private _commit(operations: PatchOperation[]): PatchOperation[] {
		const patch = new Patch(operations);
		const patchResult = patch.apply(this._state);
		this._state = patchResult.object;
		return patchResult.undoOperations;
	}

	/**
	 * Processes a `CommandResponse`
	 *
	 * @param undoOperations The undoOperations array to add any additional operations to
	 * @param commandResponse The command response object to process
	 */
	private _processCommandResponse(undoOperations: PatchOperation[], { type, operations, options = {} }: CommandResponse) {
		const { revert = false, undoable = true } = options;

		if (type === CommandResponseType.FAILURE && revert) {
			this._commit([ ...undoOperations.reverse() ]);
		}

		if (operations) {
			const patchedUndoOperations = this._commit(operations);
			if (undoable && !revert) {
				undoOperations.push(...patchedUndoOperations);
			}
			else if (revert) {
				this._flush();
			}
		}
	}

	/**
	 * Creates an executor for a process and optional transformer. An executor is then used to execute the process with
	 * any additional arguments passed to the executor.
	 *
	 * @param process The process to create an executor of
	 * @param transformer An optional transformer run on the arguments passed into the returned executor
	 */
	private _createExecutor(process: Process, transformer?: Transformer): Executor {
		return (...args: any[]): void => {
			const localProcess = [ ...process ];
			const payload = transformer ? transformer(...args) : args;
			let processUndoOperations: PatchOperation[] = [];

			const next = () => {
				const command = localProcess.shift();

				if (command) {
					const commandResponse = command({ get: this.get, payload });
					if (isThenable(commandResponse)) {
						commandResponse.then((resolvedCommandResponse: CommandResponse) => {
							this._processCommandResponse(processUndoOperations, resolvedCommandResponse);
							this._flush();
							next();
						});
					}
					else {
						this._processCommandResponse(processUndoOperations, commandResponse);
						next();
					}
				}
				else {
					this._flush({ process, operations: processUndoOperations });
				}
			};
			next();
		};
	}
}

/**
 * Creates and returns an instance of the store.
 *
 * @param initialProcesses Any initial processes that need to run to bootstrap the store.
 */
export function createStore(...initialProcesses: Process[]): Store {
	return new Store(...initialProcesses);
}

export default createStore;
