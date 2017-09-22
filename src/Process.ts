import { isThenable } from '@dojo/shim/Promise';
import { EventErrorObject } from '@dojo/interfaces/core';
import { Evented } from '@dojo/core/Evented';
import { Store } from './store';

export interface Executor {
	(...args: any[]): void;
}

export class Process extends Evented {
	private _commands: any[] = [];

	constructor(commands: any[]) {
		super();
		this._commands = commands;
	}

	get commands(): any[] {
		return [ ...this._commands ];
	}

	async _execute(store: Store, payload: any, transformer?: any) {
		payload = transformer ? transformer(payload) : payload;

		const commands = this.commands;
		let command = commands.shift();
		const undoOperations: any[] = [];
		const undoer = () => {
			store.apply(undoOperations);
			store.flush();
		};
		let result;
		try {
			while (command) {
				result = command({ get: store.get, payload});
				if (isThenable(result)) {
					store.flush();
					result = await result;
				}
				undoOperations.push(store.apply(result));
				command = commands.shift();
			}
		}
		catch (error) {
			error.undoer = undoer;
			throw error;
		}
		store.flush();
		return undoer;
	}

	createExecutor(store: Store, transformer?: any): Executor {
		return (...args: any[]): void => {
			this.execute(store, args, transformer).then(() => {
				console.log('i am groot');
			}).catch((error) => {
				console.log('i am error');
			});
		};
	}

	async execute(store: Store, payload: any, transformer?: any) {
		const result = this._execute(store, payload, transformer);
		result
			.then((undoer) => {
				undoer();
				this.emit<any>({ type: 'success', target: this });
			})
			.catch((error) => {
				this.emit<EventErrorObject<this>>({ type: 'error', error, target: this });
			});
		return result;
	}
}
