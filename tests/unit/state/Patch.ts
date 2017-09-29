import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { Pointer } from './../../../src/state/Pointer';
import { Patch } from './../../../src/state/Patch';
import * as ops from './../../../src/state/operations';

registerSuite({
	name: 'state/Patch',
	add: {
		'value to new path'() {
			const patch = new Patch(ops.add('/test', 'test'));
			const obj = {};
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: 'test' });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/test'), value: 'test'},
				{op: 'remove', path: new Pointer('/test') }
			]);
		},
		'value to new nested path'() {
			const patch = new Patch(ops.add('/foo/bar/qux', 'test'));
			const obj = {};
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { foo: { bar: { qux: 'test' } } });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/foo/bar/qux'), value: 'test'},
				{op: 'remove', path: new Pointer('/foo/bar/qux') }
			]);
		},
		'value to existing path'() {
			const patch = new Patch(ops.add('/test', 'test'));
			const obj = { test: true };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: 'test' });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/test'), value: 'test'},
				{op: 'remove', path: new Pointer('/test') }
			]);
		},
		'value to array index path'() {
			const patch = new Patch(ops.add('/test/0', 'test'));
			const obj = { test: [] };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: ['test'] });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/test/0'), value: 'test'},
				{op: 'remove', path: new Pointer('/test/0') }
			]);
		}
	},
	replace: {
		'new path'() {
			const patch = new Patch(ops.replace('/test', 'test'));
			const obj = {};
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: 'test' });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/test'), value: 'test'},
				{op: 'replace', path: new Pointer('/test'), value: undefined }
			]);
		},
		'value to new nested path'() {
			const patch = new Patch(ops.replace('/foo/bar/qux', 'test'));
			const obj = {};
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { foo: { bar: { qux: 'test' } } });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/foo/bar/qux'), value: 'test'},
				{op: 'replace', path: new Pointer('/foo/bar/qux'), value: undefined }
			]);
		},
		'existing path'() {
			const patch = new Patch(ops.replace('/test', 'test'));
			const obj = { test: true };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: 'test' });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/test'), value: 'test'},
				{op: 'replace', path: new Pointer('/test'), value: true }
			]);
		},
		'array index path'() {
			const patch = new Patch(ops.replace('/test/1', 'test'));
			const obj = { test: [ 'test', 'foo' ] };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: [ 'test', 'test' ] });
			assert.deepEqual(result.undoOperations, [
				{op: 'test', path: new Pointer('/test/1'), value: 'test'},
				{op: 'replace', path: new Pointer('/test/1'), value: 'foo' }
			]);
		}
	},
	remove: {
		'new path'() {
			const patch = new Patch(ops.remove('/test'));
			const obj = { other: true };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { other: true });
			assert.deepEqual(result.undoOperations, [
				{op: 'add', path: new Pointer('/test'), value: undefined }
			]);
		},
		'existing path'() {
			const patch = new Patch(ops.remove('/test'));
			const obj = { test: true };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { });
			assert.deepEqual(result.undoOperations, [
				{op: 'add', path: new Pointer('/test'), value: true }
			]);
		},
		'array index path'() {
			const patch = new Patch(ops.remove('/test/1'));
			const obj = { test: [ 'test', 'foo' ] };
			const result = patch.apply(obj);
			assert.notStrictEqual(result.object, obj);
			assert.deepEqual(result.object, { test: [ 'test' ] });
			assert.deepEqual(result.undoOperations, [
				{op: 'add', path: new Pointer('/test/1'), value: 'foo' }
			]);
		}
	},
	test: {
		'success'() {
			const patch = new Patch(ops.test('/test', 'test'));
			const obj = { test: 'test' };
			const result = patch.apply(obj);
			assert.strictEqual(result.object, obj);
		},
		'failure'() {
			const patch = new Patch(ops.test('/test', true));
			const obj = { test: 'test' };
			assert.throws(() => {
				patch.apply(obj);
			}, Error, 'Test operation failure. Unable to apply any operations.');
		},
		'nested path'() {
			const patch = new Patch(ops.test('/foo/0/bar/baz/0/qux', true));
			const obj = {
				foo: [ {
					bar: {
						baz: [{
							qux: true
						}]
					}
				}]
			};
			const result = patch.apply(obj);
			assert.strictEqual(result.object, obj);
		},
		'complex value'() {
			const patch = new Patch(ops.test('/foo', [ {
				bar: {
					baz: [{
						qux: true
					}]
				}
			}]));
			const obj = {
				foo: [ {
					bar: {
						baz: [{
							qux: true
						}]
					}
				}]
			};
			const result = patch.apply(obj);
			assert.strictEqual(result.object, obj);
		},
		'no value'() {
			const patch = new Patch(ops.test('/test', 'test'));
			const obj = { test: 'test' };
			const result = patch.apply(obj);
			assert.strictEqual(result.object, obj);
		}
	},
	unknown() {
		const patch = new Patch({
			op: 'unknown',
			path: new Pointer('/test')
		} as any);
		assert.throws(() => {
			patch.apply({});
		}, Error, 'Unknown operation');
	}
});
