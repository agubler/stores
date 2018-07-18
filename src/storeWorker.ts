type OperationType = 'add' | 'remove' | 'replace' | 'test';

interface BaseOperation<T = any, U = any> {
	op: OperationType;
	path: Pointer<T, U>;
}

interface AddPatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'add';
	value: U;
}

interface RemovePatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'remove';
}

interface ReplacePatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'replace';
	value: U;
}

interface TestPatchOperation<T = any, U = any> extends BaseOperation<T, U> {
	op: 'test';
	value: U;
}

type PatchOperation<T = any, U = any> =
	| AddPatchOperation<T, U>
	| RemovePatchOperation<T, U>
	| ReplacePatchOperation<T, U>
	| TestPatchOperation<T, U>;

interface PatchResult<T = any, U = any> {
	object: T;
	undoOperations: PatchOperation<T, U>[];
}

interface PointerTarget {
	object: any;
	target: any;
	segment: string;
}

let state = {};

function apply(operations: PatchOperation[]): PatchOperation[] {
	const patch = new Patch(operations);
	const patchResult = patch.apply(state);
	state = patchResult.object;
	return patchResult.undoOperations;
}

function get(path: string) {
	const pointer = new Pointer(path);
	return pointer.get(state);
}

onmessage = (event) => {
	const [type, id, payload] = event.data;
	if (type === 'get') {
		(postMessage as any)([id, get(payload)]);
	} else {
		const operations = payload.map((operation: any) => {
			operation.path = new Pointer(String(operation.path));
			return operation;
		});
		const undos = apply(operations);
		(postMessage as any)([id, undos]);
	}
};

function decode(segment: string) {
	return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function encode(segment: string) {
	return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function walk(segments: string[], object: any, clone = true, continueOnUndefined = true): PointerTarget {
	if (clone) {
		object = { ...object };
	}
	const pointerTarget: PointerTarget = {
		object,
		target: object,
		segment: ''
	};

	return segments.reduce((pointerTarget, segment, index) => {
		if (pointerTarget.target === undefined) {
			return pointerTarget;
		}
		if (Array.isArray(pointerTarget.target) && segment === '-') {
			segment = String(pointerTarget.target.length - 1);
		}
		if (index + 1 < segments.length) {
			const nextSegment = segments[index + 1];
			let target = pointerTarget.target[segment];

			if (target === undefined && !continueOnUndefined) {
				pointerTarget.target = undefined;
				return pointerTarget;
			}

			if (clone || target === undefined) {
				if (Array.isArray(target)) {
					target = [...target];
				} else if (typeof target === 'object') {
					target = { ...target };
				} else if (isNaN(parseInt(nextSegment, 0))) {
					target = {};
				} else {
					target = [];
				}
				pointerTarget.target[segment] = target;
				pointerTarget.target = target;
			} else {
				pointerTarget.target = target;
			}
		} else {
			pointerTarget.segment = segment;
		}
		return pointerTarget;
	}, pointerTarget);
}

class Pointer<T = any, U = any> {
	private readonly _segments: string[];

	constructor(segments: string | string[]) {
		if (Array.isArray(segments)) {
			this._segments = segments;
		} else {
			this._segments = (segments[0] === '/' ? segments : `/${segments}`).split('/');
			this._segments.shift();
		}
		if (segments.length === 0 || ((segments.length === 1 && segments[0] === '/') || segments[0] === '')) {
			throw new Error('Access to the root is not supported.');
		}
		this._segments = this._segments.map(decode);
	}

	public get segments(): string[] {
		return this._segments;
	}

	public get path(): string {
		return `/${this._segments.map(encode).join('/')}`;
	}

	get(object: T): U {
		const pointerTarget: PointerTarget = walk(this.segments, object, false, false);
		if (pointerTarget.target === undefined) {
			return undefined as any;
		}
		return pointerTarget.target[pointerTarget.segment];
	}

	toJSON(): string {
		return this.toString();
	}

	toString(): string {
		return this.path;
	}
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

function isObject(value: any): value is Object {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function isEqual(a: any, b: any): boolean {
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

function inverse(operation: any, state: any): PatchOperation[] {
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

class Patch<T = any> {
	private _operations: any[];

	constructor(operations: PatchOperation<T> | PatchOperation<T>[]) {
		this._operations = Array.isArray(operations) ? operations : [operations];
	}

	public apply(object: any): PatchResult<T> {
		let undoOperations: any[] = [];
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
