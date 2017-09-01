import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { Pointer } from './../../../src/state/Pointer';

registerSuite({
	name: 'state/Pointer',
	'create pointer with string path'() {
		const pointer = new Pointer('/foo/bar');
		assert.strictEqual(pointer.path, '/foo/bar');
		assert.deepEqual(pointer.segments, [ 'foo', 'bar' ]);
	},
	'create pointer with array path'() {
		const pointer = new Pointer([ 'foo', 'bar' ]);
		assert.strictEqual(pointer.path, '/foo/bar');
		assert.deepEqual(pointer.segments, [ 'foo', 'bar' ]);
	},
	'create with special characters'() {
		const pointer = new Pointer('/foo/bar~0~1');
		assert.strictEqual(pointer.path, '/foo/bar~0~1');
		assert.deepEqual(pointer.segments, [ 'foo', 'bar~/' ]);

	},
	'create pointer for root should error'() {
		assert.throws(() => {
			new Pointer('');
		}, Error, 'Access to the root is not supported.');
		assert.throws(() => {
			new Pointer(['']);
		}, Error, 'Access to the root is not supported.');
		assert.throws(() => {
			new Pointer('/');
		}, Error, 'Access to the root is not supported.');
		assert.throws(() => {
			new Pointer(['/']);
		}, Error, 'Access to the root is not supported.');
	},
	'get'() {
		const pointer = new Pointer('/foo/bar/3');
		const obj = { foo: { bar: [ 1, 2, 3, 4, 5, 6, 7 ] } };
		assert.strictEqual(pointer.get(obj), 4);
	},
	'get last item in array'() {
		const pointer = new Pointer('/foo/bar/-');
		const obj = { foo: { bar: [ 1, 2, 3, 4, 5, 6, 7 ] } };
		assert.strictEqual(pointer.get(obj), 7);
	}
});
