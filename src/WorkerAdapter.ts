import Map from '@dojo/shim/Map';
import uuid from '@dojo/core/uuid';
import { Path } from './Store';
import { PatchOperation } from './state/Patch';

export class WorkerAdapter {
	private _worker: Worker;
	private _messages = new Map();

	constructor() {
		this._worker = new Worker('./../../_build/src/storeWorker.js');

		this._worker.onmessage = (event) => {
			const [id, payload] = event.data;
			const resolve = this._messages.get(id);
			resolve(payload);
		};
	}

	async apply(operations: PatchOperation[]) {
		const id = uuid();
		operations = operations.map((operation: any) => {
			operation.path = operation.path.toString();
			return operation;
		});
		this._worker.postMessage(['apply', id, operations]);
		const promise = new Promise((resolve) => {
			this._messages.set(id, resolve);
		});
		return promise;
	}

	async get(path: Path<any, any>) {
		const id = uuid();
		this._worker.postMessage(['get', id, path.path]);
		const promise = new Promise((resolve) => {
			this._messages.set(id, resolve);
		});
		return promise;
	}
}
