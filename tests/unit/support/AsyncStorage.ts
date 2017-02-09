import InMemoryStorage from '../../../src/storage/InMemoryStorage';
import Map from '@dojo/shim/Map';
import Promise from '@dojo/shim/Promise';
import WeakMap from '@dojo/shim/WeakMap';
import { delay } from '@dojo/core/async/timing';
import compose from '@dojo/compose/compose';

const instanceStateMap = new WeakMap<{}, any>();

function getRandomInt(max = 100) {
	return Math.floor(Math.random() * max);
}

function delayOperation(operation: Function, operationName: string) {
	return function(this: any, ...args: any[]) {
		const state = instanceStateMap.get(this);
		const milliseconds = state[operationName] || getRandomInt();
		return delay(milliseconds)(operation.bind(this, ...args));
	};
}

const createAsyncStorage = compose(InMemoryStorage).mixin({
	initialize(instance: any, options: any = {}) {
		instance.data = [];
		instance.index = new Map<string, number>();
		instance.idProperty = options.idProperty;
		instance.idFunction = options.idFunction;
		instance.returnsPromise = Promise.resolve();
	}
}).mixin({
	initialize(instance, asyncOptions = {}) {
		instanceStateMap.set(instance, asyncOptions);
	},
	aspectAdvice: {
		around: {
			createId(createId: Function) {
				return delayOperation(createId, 'createId');
			},
			fetch(fetch: Function) {
				const delayed =  delayOperation(fetch, 'fetch');
				return function(this: any, ...args: any[]) {
					let resolveTotalLength: (totalLength: number) => void;
					let rejectTotalLength: (error: any) => void;
					const totalLength = new Promise((resolve, reject) => {
						resolveTotalLength = resolve;
						rejectTotalLength = reject;
					});
					const returnPromise = delayed.bind(this, ...args)();
					returnPromise.totalLength = returnPromise.dataLength = totalLength;
					delayed.bind(this)().then(
						(fullResults: any) => {
							resolveTotalLength(fullResults.length);
						},
						(error: any) => {
							rejectTotalLength(error);
						}
					);
					return returnPromise;
				};
			},
			get(get: Function) {
				return delayOperation(get, 'get');
			},
			add(add: Function) {
				return delayOperation(add, 'put');
			},
			put(put: Function) {
				return delayOperation(put, 'put');
			},
			delete(_delete: Function) {
				return delayOperation(_delete, 'delete');
			},
			patch(patch: Function) {
				return delayOperation(patch, 'patch');
			}
		}

	}
});
export default createAsyncStorage;
