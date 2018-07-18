const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import { PatchOperation } from './../../../src/state/Patch';
import { CommandRequest, createProcess } from './../../../src/process';
import { Pointer } from './../../../src/state/Pointer';
import HistoryManager from './../../../src/middleware/HistoryManager';
import { Store } from './../../../src/Store';

function incrementCounter({ get, path }: CommandRequest<{ counter: number }>): PatchOperation[] {
	let counter = get(path('counter')) || 0;
	return [{ op: 'replace', path: new Pointer('/counter'), value: ++counter }];
}

function collector(callback?: any): any {
	return (error: any, result: any): void => {
		callback && callback(error, result);
	};
}

describe('extras', () => {
	it('can serialize and deserialize history', async () => {
		const historyManager = new HistoryManager();
		const store = new Store();
		debugger;

		const incrementCounterProcess = createProcess(
			'increment',
			[incrementCounter],
			historyManager.collector(collector())
		);
		const executor = incrementCounterProcess(store);
		await executor({});
		assert.strictEqual(await store.get(store.path('counter')), 1);
		await executor({});
		assert.strictEqual(await store.get(store.path('counter')), 2);
		await executor({});
		assert.strictEqual(await store.get(store.path('counter')), 3);

		await historyManager.undo(store);
		// serialize the history
		const json = JSON.stringify(historyManager.serialize(store));
		// create a new store
		const storeCopy = new Store();
		// cannot undo nothing
		assert.isFalse(historyManager.canUndo(storeCopy));
		// cannot redo nothing
		assert.isFalse(historyManager.canRedo(storeCopy));
		// deserialize the new store with the history
		await historyManager.deserialize(storeCopy, JSON.parse(json));
		// should be re-hydrated
		assert.strictEqual(await storeCopy.get(storeCopy.path('counter')), 2);
		// storeCopy history is identical to original store history
		assert.deepEqual(historyManager.serialize(store), historyManager.serialize(storeCopy));
		// can undo on new storeCopy
		assert.isTrue(historyManager.canUndo(storeCopy));
		await historyManager.undo(storeCopy);
		assert.strictEqual(await storeCopy.get(storeCopy.path('counter')), 1);
		assert.strictEqual(historyManager.serialize(storeCopy).history.length, 1);
		// can redo on new StoreCopy
		historyManager.canRedo(storeCopy);
		await historyManager.redo(storeCopy);
		assert.strictEqual(await storeCopy.get(storeCopy.path('counter')), 2);
		// undo on original store
		await historyManager.undo(store);
		assert.strictEqual(await store.get(store.path('counter')), 1);
		// redo on original store
		await historyManager.redo(store);
		assert.strictEqual(await store.get(store.path('counter')), 2);
		// histories should now be identical
		assert.deepEqual(historyManager.serialize(store), historyManager.serialize(storeCopy));
		// adding to history nukes redo
		await executor({});
		assert.isFalse(historyManager.canRedo(store));
	});
});
