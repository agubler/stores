import { RemovePatchOperation, ReplacePatchOperation, AddPatchOperation, TestPatchOperation } from './Patch';
import { Pointer } from './Pointer';
import { Path } from '../Store';

export function add<T = any, U = any>(path: Path<T, U>, value: U): AddPatchOperation<T, U> {
	return {
		op: 'add',
		path: new Pointer(path.path),
		value
	};
}

export function replace<T = any, U = any>(path: Path<T, U>, value: U): ReplacePatchOperation<T, U> {
	return {
		op: 'replace',
		path: new Pointer(path.path),
		value
	};
}

export function remove<T = any, U = any>(path: Path<T, U>): RemovePatchOperation<T, U> {
	return {
		op: 'remove',
		path: new Pointer(path.path)
	};
}

export function test<T = any, U = any>(path: Path<T, U>, value: U): TestPatchOperation<T, U> {
	return {
		op: 'test',
		path: new Pointer(path.path),
		value
	};
}
