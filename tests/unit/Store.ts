import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { Store } from './../../src/store';
import { OperationType, PatchOperation } from './../../src/state/Patch';
import { Pointer } from './../../src/state/Pointer';

let store: Store = new Store();

const testPatchOperations: PatchOperation[] = [
	{ op: OperationType.ADD, path: new Pointer('/test'), value: 'test'}
];

registerSuite({
	name: 'store',
	beforeEach() {
		store = new Store();
	},
	createStore() {
		assert.isOk(store);
	},
	'apply/get'() {
		const undo = store.apply(testPatchOperations);

		assert.strictEqual(store.get('/test'), 'test');
		assert.deepEqual(undo, [
			{ op: OperationType.TEST, path: new Pointer('/test'), value: 'test' },
			{ op: OperationType.REMOVE, path: new Pointer('/test') }
		]);
	},
	'invalidate'() {
		let invalidateEmitted = false;
		store.on('invalidate', () => {
			invalidateEmitted = true;
		});
		store.invalidate();
		assert.isTrue(invalidateEmitted);
	}
});
