import { Evented } from '@dojo/core/Evented';
import { Patch, PatchOperation } from './state/Patch';
import { Pointer } from './state/Pointer';
import { Process } from './Process';

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

export interface CreateExecutor {
	(process: Process, transformer?: Transformer): Executor;
}

export interface Get {
	<T>(pointer: string): T;
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
	public createExecutor: CreateExecutor = this._createExecutor.bind(this);

	/**
	 * Returns the state at a specific pointer path location.
	 *
	 * @param pointer The StorePointer path to the state that is required.
	 */
	public get: Get = this._get.bind(this);

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
	 * Returns the state at a specific pointer path location.
	 *
	 * @param pointer The StorePointer path to the state that is required.
	 */
	private _get <T>(pointer: string): T {
		const statePointer = new Pointer(pointer);
		return statePointer.get(this._state);
	}

	public apply(operations: PatchOperation[]): PatchOperation[] {
		const patch = new Patch(operations);
		const patchResult = patch.apply(this._state);
		this._state = patchResult.object;
		return patchResult.undoOperations;
	}

	public flush(): any {
		this.emit({ type: 'invalidate' });
	}

	/**
	 * Creates an executor for a process and optional transformer. An executor is then used to execute the process with
	 * any additional arguments passed to the executor.
	 *
	 * @param process The process to create an executor of
	 */
	private _createExecutor(process: Process, transformer?: any): Executor {
		return (...args: any[]): void => {
			process.execute(this, args, transformer).then(() => {
				console.log('i am groot');
			}).catch((error) => {
				console.log('i am error');
			});
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
