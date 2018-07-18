const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import * as operations from './../../../src/state/operations';
import { Pointer } from './../../../src/state/Pointer';

describe('state/operations', () => {
	it('add()', () => {
		const result = operations.add({ path: '/test', state: null, value: null }, 'test');
		assert.deepEqual(result, {
			op: 'add',
			path: new Pointer('/test'),
			value: 'test'
		});
	});

	it('remove()', () => {
		const result = operations.remove({ path: '/test', state: null, value: null });
		assert.deepEqual(result, {
			op: 'remove',
			path: new Pointer('/test')
		});
	});

	it('replace()', () => {
		const result = operations.replace({ path: '/test', state: null, value: null }, 'test');
		assert.deepEqual(result, {
			op: 'replace',
			path: new Pointer('/test'),
			value: 'test'
		});
	});

	it('test()', () => {
		const result = operations.test({ path: '/test', state: null, value: null }, 'test');
		assert.deepEqual(result, {
			op: 'test',
			path: new Pointer('/test'),
			value: 'test'
		});
	});
});
