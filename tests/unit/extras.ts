import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { OperationType, PatchOperation } from './../../src/state/Patch';
import { CommandRequest, createProcess } from './../../src/process';
import { Pointer } from './../../src/state/Pointer';
import { createUndoManager } from './../../src/extras';
import { Store } from './../../src/Store';

function incrementCounter({ get }: CommandRequest): PatchOperation[] {
	let counter = get<number>('/counter') || 0;
	return [
		{ op: OperationType.REPLACE, path: new Pointer('/counter'), value: ++counter }
	];
};

registerSuite({
	name: 'extras',
	'collects undo functions for all processes using collector'() {
		const { collector, undoer } = createUndoManager();
		const store = new Store();
		let localUndos: any[] = [];
		const incrementCounterProcess = createProcess([ incrementCounter ], collector((error, result) => {
			localUndos.push(result.undo);
		}));
		const executor = incrementCounterProcess(store);
		executor();
		assert.strictEqual(store.get('/counter'), 1);
		executor();
		assert.strictEqual(store.get('/counter'), 2);
		executor();
		assert.strictEqual(store.get('/counter'), 3);
		localUndos[2]();
		assert.strictEqual(store.get('/counter'), 2);
		undoer();
		assert.strictEqual(store.get('/counter'), 1);
	},
	'undo has no effect if there are no undo functions on the stack'() {
		const { undoer } = createUndoManager();
		const store = new Store();
		const incrementCounterProcess = createProcess([ incrementCounter ]);
		const executor = incrementCounterProcess(store);
		executor();
		undoer();
		assert.strictEqual(store.get('/counter'), 1);
	},
	'local undo throws an error if global undo has already been executed'() {
		const { collector, undoer } = createUndoManager();
		const store = new Store();
		let localUndos: any[] = [];
		const incrementCounterProcess = createProcess([ incrementCounter ], collector((error, result) => {
			localUndos.push(result.undo);
		}));
		const executor = incrementCounterProcess(store);
		executor();
		assert.strictEqual(store.get('/counter'), 1);
		undoer();
		assert.throws(() => {
			localUndos[0]();
		}, Error, 'Test operation failure. Unable to apply any operations.');
	}
});
