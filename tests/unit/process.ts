import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { Pointer } from './../../src/state/Pointer';
import { OperationType, PatchOperation } from './../../src/state/Patch';
import {
	CommandRequest,
	createCallbackDecorator,
	createProcess,
	createProcessFactoryWith,
	ProcessCallback,
	ProcessError,
	ProcessResult
} from './../../src/process';
import { Store } from './../../src/Store';

let store: Store;
let promises: Promise<any>[] = [];
let promiseResolvers: Function[] = [];

function promiseResolver() {
	for (let i = 0; i < promiseResolvers.length; i++) {
		promiseResolvers[i]();
	}
}

const testCommandFactory = (value: string) => {
	return ({ payload }: CommandRequest): PatchOperation[] => {
		return [
			{ op: OperationType.ADD, path: new Pointer(`/${value}`), value: payload[0] || value }
		];
	};
};

const testAsyncCommandFactory = (value: string) => {
	return ({ payload }: CommandRequest): Promise<PatchOperation[]> => {
		const promise = new Promise<any>((resolve) => {
			promiseResolvers.push(() => {
				resolve([ { op: OperationType.ADD, path: new Pointer(`/${value}`), value: payload[0] || value } ]);
			});
		});
		promises.push(promise);
		return promise;
	};
};

const testErrorCommand = ({ payload }: CommandRequest): any => {
	new Error('Command Failed');
};

registerSuite({
	name: 'process',
	beforeEach() {
		store = new Store();
		promises = [];
		promiseResolvers = [];
	},
	'with synchronous commands running in order'() {
		const process = createProcess([ testCommandFactory('foo'), testCommandFactory('foo/bar') ]);
		const processExecutor = process(store);
		processExecutor();
		const foo = store.get('/foo');
		const foobar = store.get('/foo/bar');
		assert.deepEqual(foo, { bar: 'foo/bar' });
		assert.strictEqual(foobar, 'foo/bar');
	},
	'processes wait for asynchronous commands to complete before continuing'() {
		const process = createProcess([ testCommandFactory('foo'), testAsyncCommandFactory('bar'), testCommandFactory('foo/bar') ]);
		const processExecutor = process(store);
		const promise = processExecutor();
		const foo = store.get('/foo');
		const bar = store.get('/bar');
		assert.strictEqual(foo, 'foo');
		assert.isUndefined(bar);
		promiseResolver();
		return promise.then(() => {
			const foo = store.get('/foo');
			const bar = store.get('/bar');
			const foobar = store.get('/foo/bar');
			assert.deepEqual(foo, { bar: 'foo/bar' });
			assert.strictEqual(bar, 'bar');
			assert.strictEqual(foobar, 'foo/bar');
		});
	},
	'support concurrent commands executed synchronously'() {
		const process = createProcess([
			testCommandFactory('foo'),
			[
				testAsyncCommandFactory('bar'),
				testAsyncCommandFactory('baz')
			],
			testCommandFactory('foo/bar')
		]);
		const processExecutor = process(store);
		const promise = processExecutor();
		promiseResolvers[0]();
		return promises[0].then(() => {
			const bar = store.get('/bar');
			const baz = store.get('/baz');
			assert.isUndefined(bar);
			assert.isUndefined(baz);
			promiseResolver();
			return promise.then(() => {
				const bar = store.get('/bar');
				const baz = store.get('/baz');
				assert.strictEqual(bar, 'bar');
				assert.strictEqual(baz, 'baz');
			});
		});
	},
	'passes the payload to each command'() {
		const process = createProcess([
			testCommandFactory('foo'),
			testCommandFactory('bar'),
			testCommandFactory('baz')
		]);
		const processExecutor = process(store);
		processExecutor('payload');
		const foo = store.get('/foo');
		const bar = store.get('/bar');
		const baz = store.get('/baz');
		assert.strictEqual(foo, 'payload');
		assert.strictEqual(bar, 'payload');
		assert.strictEqual(baz, 'payload');
	},
	'can use a transformer for the arguments passed to the process executor'() {
		const process = createProcess([
			testCommandFactory('foo'),
			testCommandFactory('bar'),
			testCommandFactory('baz')
		]);
		const processExecutor = process(store, () => 'changed');
		processExecutor('payload');
		const foo = store.get('/foo');
		const bar = store.get('/bar');
		const baz = store.get('/baz');
		assert.strictEqual(foo, 'changed');
		assert.strictEqual(bar, 'changed');
		assert.strictEqual(baz, 'changed');
	},
	'can provide a callback that gets called on process completion'() {
		let callbackCalled = false;
		const process = createProcess([ testCommandFactory('foo') ], () => {
			callbackCalled = true;
		});
		const processExecutor = process(store);
		processExecutor();
		assert.isTrue(callbackCalled);
	},
	'when a command errors, the error and command is returned in the error argument of the callback'() {
		const process = createProcess([ testCommandFactory('foo'), testErrorCommand ], (error) => {
			assert.isNotNull(error);
			assert.strictEqual(error && error.command, testErrorCommand);
		});
		const processExecutor = process(store);
		processExecutor();
	},
	'executor can be used to programmatically run additional processes'() {
		const extraProcess = createProcess([ testCommandFactory('bar') ]);
		const process = createProcess([ testCommandFactory('foo') ], (error, result) => {
			assert.isNull(error);
			let bar = store.get('/bar');
			assert.isUndefined(bar);
			result.executor(extraProcess);
			bar = store.get('/bar');
			assert.strictEqual(bar, 'bar');
		});
		const processExecutor = process(store);
		processExecutor();
	},
	'process can be undone using the undo function provided via the callback'() {
		const process = createProcess([ testCommandFactory('foo') ], (error, result) => {
			let foo = store.get('/foo');
			assert.strictEqual(foo, 'foo');
			result.undo();
			foo = store.get('/foo');
			assert.isUndefined(foo);
		});
		const processExecutor = process(store);
		processExecutor();
	},
	createProcessWith: {
		'Creating a process returned automatically decorates all process callbacks'() {
			let results: string[] = [];

			const callbackDecorator = (callback?: ProcessCallback) => {
				return (error: ProcessError, result: ProcessResult): void => {
					results.push('callback one');
					callback && callback(error, result);
				};
			};

			const callbackTwo = (error: ProcessError, result: ProcessResult): void => {
				results.push('callback two');
			};

			const logPointerCallback = (error: ProcessError, result: ProcessResult): void => {
				const paths = result.operations.map(operation => operation.path.path);
				const logs = result.get<string[][]>('/logs') || [];

				result.apply([
					{ op: OperationType.ADD, path: new Pointer(`/logs/${logs.length}`), value: paths }
				]);
			};

			const createProcess = createProcessFactoryWith([
				callbackDecorator,
				createCallbackDecorator(callbackTwo),
				createCallbackDecorator(logPointerCallback)
			]);

			const process = createProcess([ testCommandFactory('foo'), testCommandFactory('bar') ]);
			const executor = process(store);
			executor();
			assert.lengthOf(results, 2);
			assert.strictEqual(results[0], 'callback two');
			assert.strictEqual(results[1], 'callback one');
			assert.deepEqual(store.get('/logs'), [ [ '/foo', '/bar' ] ]);
			executor();
			assert.lengthOf(results, 4);
			assert.strictEqual(results[0], 'callback two');
			assert.strictEqual(results[1], 'callback one');
			assert.strictEqual(results[2], 'callback two');
			assert.strictEqual(results[3], 'callback one');
			assert.deepEqual(store.get('/logs'), [ [ '/foo', '/bar' ], [ '/foo', '/bar' ] ]);
		}
	}
});
