import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { createStore, Store } from './../../src/store';
import { CommandResponseType, CommandResponse, CommandRequest } from './../../src/command';
import { OperationType } from './../../src/state/Patch';
import { Pointer } from './../../src/state/Pointer';

let promise: any;
let store: Store;

function testCommand(): CommandResponse {
	return {
		type: CommandResponseType.SUCCESS,
		operations: [
			{ op: OperationType.ADD, path: new Pointer('/test'), value: 'test'}
		]
	};
};

function testCommandNoUndo(): CommandResponse {
	return {
		type: CommandResponseType.SUCCESS,
		operations: [
			{ op: OperationType.ADD, path: new Pointer('/test1'), value: 'test'}
		],
		options: {
			revert: false,
			undoable: false
		}
	};
};

function testAsyncCommand(): CommandResponse {
	return promise;
}

function testFailureCommand (): CommandResponse {
	return {
		type: CommandResponseType.FAILURE,
		options: {
			revert: true,
			undoable: false
		}
	};
};

function testFailureCommandWithOperations(): CommandResponse {
	return {
		type: CommandResponseType.FAILURE,
		operations: [
			{ op: OperationType.ADD, path: new Pointer('/failed'), value: true}
		],
		options: {
			revert: true,
			undoable: false
		}
	};
};

function testCommandUsingArgs({ payload }: CommandRequest): CommandResponse {
	return {
		type: CommandResponseType.SUCCESS,
		operations: [
			{ op: OperationType.ADD, path: new Pointer('/test'), value: payload}
		]
	};
}

const testProcess = [ testCommand ];
const testProcessWithAsync = [ testAsyncCommand ];
const testProcessWithFailure = [ testCommand, testFailureCommand ];
const testProcessWithAsyncFailure = [ testCommand, testAsyncCommand ];
const testProcessWithFailureAndOperations = [ testCommand, testFailureCommandWithOperations ];
const testProcessWithAsyncFailureAndOperations = [ testCommand, testAsyncCommand ];
const testProcessWithNoUndo = [ testCommand, testCommandNoUndo ];

registerSuite({
	name: 'store',
	beforeEach() {
		store = createStore();
		promise = undefined;
	},
	createStore() {
		assert.isOk(store);
	},
	'create store with initial process'() {
		const store = createStore([ testCommand ]);
		assert.strictEqual(store.get('/test'), 'test');
	},
	createExecutor() {
		const executor = store.createExecutor(testProcess);
		executor();
		assert.strictEqual(store.get('/test'), 'test');
	},
	'create Executor with transformer'() {
		const executor = store.createExecutor([testCommandUsingArgs], (...args: any[]) => args[0] * 2);
		executor(3);
		assert.strictEqual(store.get('/test'), 6);
	},
	'success command': {
		'synchronous success command'() {
			store.execute(testProcess);
			assert.strictEqual(store.get('/test'), 'test');
		},
		'asynchronous success command'() {
			promise = Promise.resolve<CommandResponse>({
				type: CommandResponseType.SUCCESS,
				operations: [
					{ op: OperationType.ADD, path: new Pointer('/test'), value: 'test'}
				]
			});
			store.execute(testProcessWithAsync);
			return promise.then(() => {
				assert.strictEqual(store.get('/test'), 'test');
			});
		}
	},
	'failure command': {
		'synchronous failure command'() {
			store.execute(testProcessWithFailure);
			assert.isUndefined(store.get('/test'));
		},
		'synchronous failure command with operations'() {
			store.execute(testProcessWithFailureAndOperations);
			assert.isUndefined(store.get('/test'));
			assert.strictEqual(store.get('/failed'), true);
		},
		'asynchronous failure command'() {
			promise = Promise.resolve<CommandResponse>({
				type: CommandResponseType.FAILURE,
				options: {
					revert: true,
					undoable: false
				}
			});
			store.execute(testProcessWithAsyncFailure);
			return promise.then(() => {
				assert.isUndefined(store.get('/test'));
			});
		},
		'asynchronous failure command with operations'() {
			promise = Promise.resolve<CommandResponse>({
				type: CommandResponseType.FAILURE,
				operations: [
					{ op: OperationType.ADD, path: new Pointer('/failed'), value: true}
				],
				options: {
					revert: true,
					undoable: false
				}
			});
			store.execute(testProcessWithAsyncFailureAndOperations);
			return promise.then(() => {
				assert.isUndefined(store.get('/test'));
				assert.strictEqual(store.get('/failed'), true);
			});
		}
	},
	'undo': {
		hasUndoOperations() {
			assert.isFalse(store.hasUndoOperations);
			store.undo();
			store.execute(testProcess);
			assert.isTrue(store.hasUndoOperations);
			store.undo(testProcess);
			assert.isFalse(store.hasUndoOperations);
		},
		'execute undo for process that has run'() {
			assert.isFalse(store.hasUndoOperations);
			store.execute(testProcess);
			assert.isTrue(store.hasUndoOperations);
			assert.strictEqual(store.get('/test'), 'test');
			store.undo(testProcess);
			assert.strictEqual(store.get('/test'), undefined);
		},
		'execute undo for process that has not been run'() {
			assert.isFalse(store.hasUndoOperations);
			store.execute(testProcess);
			assert.isTrue(store.hasUndoOperations);
			assert.strictEqual(store.get('/test'), 'test');
			store.undo([ testCommand ]);
			assert.strictEqual(store.get('/test'), 'test');
		},
		'will not undo a command that return undoable as false'() {
			store.execute(testProcessWithNoUndo);
			assert.strictEqual(store.get('/test'), 'test');
			assert.strictEqual(store.get('/test1'), 'test');
			store.undo(testProcessWithNoUndo);
			assert.strictEqual(store.get('/test1'), 'test');
			assert.isUndefined(store.get('/test'));
		}
	}
});
