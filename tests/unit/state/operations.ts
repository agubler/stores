import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import * as operations from './../../../src/state/operations';
import { OperationType } from './../../../src/state/Patch';
import { Pointer } from './../../../src/state/Pointer';

registerSuite({
	name: 'state/operations',
	add() {
		const result = operations.add('/test', 'test');
		assert.deepEqual(result, {
			op: OperationType.ADD,
			path: new Pointer('/test'),
			value: 'test'
		});
	},
	remove() {
		const result = operations.remove('/test');
		assert.deepEqual(result, {
			op: OperationType.REMOVE,
			path: new Pointer('/test')
		});
	},
	replace() {
		const result = operations.replace('/test', 'test');
		assert.deepEqual(result, {
			op: OperationType.REPLACE,
			path: new Pointer('/test'),
			value: 'test'
		});
	},
	test() {
		const result = operations.test('/test', 'test');
		assert.deepEqual(result, {
			op: OperationType.TEST,
			path: new Pointer('/test'),
			value: 'test'
		});
	}
});
