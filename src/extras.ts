import { ProcessError, ProcessResult, ProcessCallback, Undo } from './process';

/**
 * Undo manager interface
 */
export interface UndoManager {
	collector: (callback?: ProcessCallback) => ProcessCallback;
	undoer: () => void;
}

/**
 * Factory function that returns an undoer function that will undo the last executed process and a
 * higher order collector function that can be used as the process callback.
 *
 * ```ts
 * const { undoer, collector } = createGlobalUndoManager();
 *
 * const myProcess = createProcess([ myCommand ], collector());
 * ```
 */
export function createUndoManager(): UndoManager {
	const undoStack: Undo[] = [];

	return {
		collector: (callback?: any): ProcessCallback => {
			return (error: ProcessError, result: ProcessResult): void => {
				const { undo } = result;
				undoStack.push(undo);

				result.undo = (): void => {
					const index = undoStack.indexOf(undo);
					if (index !== -1) {
						undoStack.splice(index, 1);
					}
					undo();
				};
				callback && callback(error, result);
			};
		},
		undoer: (): void => {
			const undo = undoStack.pop();
			if (undo !== undefined) {
				undo();
			}
		}
	};
}
