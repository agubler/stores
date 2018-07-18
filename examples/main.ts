import { ProjectorMixin } from '@dojo/widget-core/mixins/Projector';
import WidgetBase from '@dojo/widget-core/WidgetBase';
import { v, w } from '@dojo/widget-core/d';
import { Store } from './../src/Store';
import { WorkerAdapter } from '../src/WorkerAdapter';
import { replace } from './../src/state/operations';
import { createCommandFactory, createProcess } from './../src/process';
import { HistoryManager } from './../src/middleware/HistoryManager';
import { WeakMap } from '@dojo/shim/WeakMap';
const a = require('./../../src/storeWorker');
console.log(a);

interface Increment {
	counter: number;
	anotherCounter: number;
}

const createCommand = createCommandFactory<Increment>();

const incrementCounter = createCommand(async ({ get, path }) => {
	let counter = (await get(path('counter'))) || 0;
	return [replace(path('counter'), ++counter)];
});

const incrementAnotherCounter = createCommand(async ({ get, path }) => {
	let anotherCounter = (await get(path('anotherCounter'))) || 0;
	return [replace(path('anotherCounter'), anotherCounter + 10)];
});

const commands: any[] = [];
for (let i = 0; i < 500; i++) {
	commands.push(incrementCounter);
	commands.push(incrementAnotherCounter);
}

const historyManager = new HistoryManager();

const incrementProcess = createProcess(
	'increment',
	[incrementCounter, incrementAnotherCounter],
	historyManager.collector()
);

const incrementLoadsProcess = createProcess('increment', commands, historyManager.collector());

const initialProcess = createProcess('initial', [incrementCounter, incrementAnotherCounter]);

class Example extends WidgetBase<{ isWorker?: true }> {
	private _textArea = '';

	private _stores: Store[] = [];
	private _storeState = new WeakMap();

	private async _createStore() {
		const store = this.properties.isWorker ? new Store(WorkerAdapter) : new Store();
		await initialProcess(store)({});
		try {
			await historyManager.deserialize(store, JSON.parse(this._textArea));
		} catch (e) {}
		this._stores.push(store);
		this._storeState.set(store, {
			counter: await store.get(store.path('counter')),
			anotherCounter: await store.get(store.path('anotherCounter'))
		});
		this.invalidate();
	}

	private async _increment(store: Store) {
		await incrementProcess(store)({});
		this._storeState.set(store, {
			counter: await store.get(store.path('counter')),
			anotherCounter: await store.get(store.path('anotherCounter'))
		});
		this.invalidate();
	}

	private async _incrementLoads(store: Store) {
		await incrementLoadsProcess(store)({});
		this._storeState.set(store, {
			counter: await store.get(store.path('counter')),
			anotherCounter: await store.get(store.path('anotherCounter'))
		});
		this.invalidate();
	}

	private async _undo(store: Store) {
		await historyManager.undo(store);
		this._storeState.set(store, {
			counter: await store.get(store.path('counter')),
			anotherCounter: await store.get(store.path('anotherCounter'))
		});
		this.invalidate();
	}

	private _renderStore(store: Store<Increment>, key: number) {
		const { counter, anotherCounter } = this._storeState.get(store);
		return v('div', { key, classes: ['container'] }, [
			v(
				'div',
				{
					classes: ['mdl-card', 'mdl-shadow--2dp']
				},
				[
					v(
						'div',
						{
							classes: [
								'mdl-color--accent mdl-color-text--accent-contrast mdl-card__title mdl-card--expand'
							]
						},
						[
							v('h2', { classes: ['mdl-card__title-text'] }, [
								v('div', [
									v('div', [`counter: ${counter}`]),
									v('div', [`anotherCounter: ${anotherCounter}`])
								])
							])
						]
					),
					v('div', { classes: ['mdl-card__supporting-text'] }, [
						v(
							'div',
							{
								classes: ['mdl-textfield', 'mdl-js-textfield', 'mdl-textfield--floating-labe']
							},
							[
								v('textarea', { readonly: 'readonly', rows: '5', classes: ['mdl-textfield__input'] }, [
									JSON.stringify(historyManager.serialize(store), null, '\t')
								])
							]
						)
					]),
					v('div', { classes: ['mdl-card__actions', 'mdl-card--border'] }, [
						v(
							'button',
							{
								key: 'increment',
								classes: ['mdl-button', 'mdl-js-button', 'mdl-js-ripple-effect'],
								onclick: () => {
									this._increment(store);
								}
							},
							['increment']
						),
						v(
							'button',
							{
								key: 'increment-loads',
								classes: ['mdl-button', 'mdl-js-button', 'mdl-js-ripple-effect'],
								onclick: () => {
									this._incrementLoads(store);
								}
							},
							['increment loads']
						),
						v(
							'button',
							{
								key: 'undo',
								classes: ['mdl-button', 'mdl-js-button', 'mdl-js-ripple-effect'],
								disabled: !historyManager.canUndo(store),
								onclick: () => {
									this._undo(store);
								}
							},
							['undo']
						)
					])
				]
			)
		]);
	}

	private _renderStores() {
		return this._stores.map((store, i) => this._renderStore(store, i));
	}

	render() {
		return v('div', {}, [
			v('h3', [this.properties.isWorker ? 'History Management (Worker)' : 'History Management']),
			v('div', [
				v('div', { classes: ['container'] }, [
					v(
						'div',
						{
							classes: ['mdl-card', 'mdl-shadow--2dp']
						},
						[
							v(
								'div',
								{
									classes: [
										'mdl-color--primary mdl-color-text--primary-contrast mdl-card__title mdl-card--expand'
									]
								},
								[v('h2', { classes: ['mdl-card__title-text'] }, ['create store'])]
							),

							v('div', { classes: ['mdl-card__supporting-text'] }, [
								v(
									'div',
									{
										classes: ['mdl-textfield', 'mdl-js-textfield', 'mdl-textfield--floating-labe']
									},
									[
										v('textarea', {
											id: 'foo',
											rows: '5',
											classes: ['mdl-textfield__input'],
											onchange: (e: any) => {
												this._textArea = e.target.value;
											}
										}),
										v('label', { for: 'foo', classes: ['mdl-textfield__label'] }, [
											'store history:'
										])
									]
								)
							]),
							v(
								'div',
								{
									classes: ['mdl-card__actions', 'mdl-card--border']
								},
								[
									v(
										'button',
										{
											classes: ['mdl-button', 'mdl-js-button', 'mdl-js-ripple-effect'],
											onclick: () => {
												this._createStore();
											}
										},
										['create']
									)
								]
							)
						]
					)
				]),
				...this._renderStores()
			])
		]);
	}
}

class App extends WidgetBase {
	render() {
		return v('div', { styles: { display: 'flex', flexDirection: 'column' } }, [
			w(Example, {}),
			w(Example, { isWorker: true })
		]);
	}
}

const Projector = ProjectorMixin(App);
const projector = new Projector();
projector.append();
