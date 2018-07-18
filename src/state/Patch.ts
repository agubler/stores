import { Pointer, walk, PointerTarget } from './Pointer';

export type OperationType = 'add' | 'remove' | 'replace' | 'test';

export interface BaseOperation<T = any, U = any> {
	op: OperationType;
	path: Pointer<T, U>;
}

export interface AddPatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'add';
	value: U;
}

export interface RemovePatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'remove';
}

export interface ReplacePatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'replace';
	value: U;
}

export interface TestPatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'test';
	value: U;
}

export type PatchOperation<T = any, U = any> =
	| AddPatchOperation<T, U>
	| RemovePatchOperation<T, U>
	| ReplacePatchOperation<T, U>
	| TestPatchOperation<T, U>;

export interface PatchResult<T = any, U = any> {
	object: T;
	undoOperations: PatchOperation<T, U>[];
}

function add(pointerTarget: PointerTarget, value: any): any {
	if (Array.isArray(pointerTarget.target)) {
		pointerTarget.target.splice(parseInt(pointerTarget.segment, 10), 0, value);
	} else {
		pointerTarget.target[pointerTarget.segment] = value;
	}
	return pointerTarget.object;
}

function replace(pointerTarget: PointerTarget, value: any): any {
	if (Array.isArray(pointerTarget.target)) {
		pointerTarget.target.splice(parseInt(pointerTarget.segment, 10), 1, value);
	} else {
		pointerTarget.target[pointerTarget.segment] = value;
	}
	return pointerTarget.object;
}

function remove(pointerTarget: PointerTarget): any {
	if (Array.isArray(pointerTarget.target)) {
		pointerTarget.target.splice(parseInt(pointerTarget.segment, 10), 1);
	} else {
		delete pointerTarget.target[pointerTarget.segment];
	}
	return pointerTarget.object;
}

function test(pointerTarget: PointerTarget, value: any) {
	return isEqual(pointerTarget.target[pointerTarget.segment], value);
}

export function isObject(value: any): value is Object {
	return Object.prototype.toString.call(value) === '[object Object]';
}

export function isEqual(a: any, b: any): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((element: any, i: number) => isEqual(element, b[i]));
	} else if (isObject(a) && isObject(b)) {
		const keysForA = Object.keys(a).sort();
		const keysForB = Object.keys(b).sort();
		return isEqual(keysForA, keysForB) && keysForA.every((key) => isEqual(a[key], b[key]));
	} else {
		return a === b;
	}
}

function inverse(operation: PatchOperation, state: any): PatchOperation[] {
	if (operation.op === 'add') {
		const op: RemovePatchOperation = {
			op: 'remove',
			path: operation.path
		};
		const test: TestPatchOperation = {
			op: 'test',
			path: operation.path,
			value: operation.value
		};
		return [test, op];
	} else if (operation.op === 'replace') {
		const value = operation.path.get(state);
		let op: RemovePatchOperation | ReplacePatchOperation;
		if (value === undefined) {
			op = {
				op: 'remove',
				path: operation.path
			};
		} else {
			op = {
				op: 'replace',
				path: operation.path,
				value: operation.path.get(state)
			};
		}
		const test: TestPatchOperation = {
			op: 'test',
			path: operation.path,
			value: operation.value
		};
		return [test, op];
	} else {
		return [
			{
				op: 'add',
				path: operation.path,
				value: operation.path.get(state)
			}
		];
	}
}

export class Patch<T = any> {
	private _operations: PatchOperation<T>[];

	constructor(operations: PatchOperation<T> | PatchOperation<T>[]) {
		this._operations = Array.isArray(operations) ? operations : [operations];
	}

	public apply(object: any): PatchResult<T> {
		let undoOperations: PatchOperation<T>[] = [];
		const patchedObject = this._operations.reduce((patchedObject, next) => {
			let object;
			const pointerTarget = walk(next.path.segments, patchedObject);
			switch (next.op) {
				case 'add':
					object = add(pointerTarget, next.value);
					break;
				case 'replace':
					object = replace(pointerTarget, next.value);
					break;
				case 'remove':
					object = remove(pointerTarget);
					break;
				case 'test':
					const result = test(pointerTarget, next.value);
					if (!result) {
						throw new Error('Test operation failure. Unable to apply any operations.');
					}
					return patchedObject;
				default:
					throw new Error('Unknown operation');
			}
			undoOperations = [...inverse(next, patchedObject), ...undoOperations];
			return object;
		}, object);
		return { object: patchedObject, undoOperations };
	}
}
