import Map from '@dojo/shim/Map';
import uuid from '@dojo/core/uuid';
import { PatchOperation } from './state/Patch';

export class WorkerAdapter {
	private _worker: Worker;
	private _messages = new Map();

	constructor() {
		this._worker = new Worker('./../../_build/src/storeWorker.js');

		this._worker.onmessage = (event) => {
			const [id, undos, state] = event.data;
			const resolve = this._messages.get(id);
			resolve({ undos, state });
		};
	}

	async apply(operations: PatchOperation[], state: any) {
		const id = uuid();
		operations = operations.map((operation: any) => {
			operation.path = operation.path.toString();
			return operation;
		});
		this._worker.postMessage([id, operations, state]);
		const promise = new Promise((resolve) => {
			this._messages.set(id, resolve);
		});
		return promise;
	}
}
