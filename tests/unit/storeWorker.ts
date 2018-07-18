const { describe, it } = intern.getInterface('bdd');

import { Pointer } from '../../src/state/Pointer';
import { Store } from '../../src/Store';
import { WorkerAdapter } from '../../src/WorkerAdapter';

describe('store', () => {
	it('test', async () => {
		debugger;
		const store = new Store(WorkerAdapter);

		const undos = await store.apply([{ op: 'add', path: new Pointer('/test'), value: 'test' }]);
		console.log(undos);

		debugger;

		const state = await store.get(store.path('test'));
		console.log(state);

		debugger;
	});
});
