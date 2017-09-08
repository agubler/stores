# @dojo/stores

[![Build Status](https://travis-ci.org/dojo/stores.svg?branch=master)](https://travis-ci.org/dojo/stores)
[![codecov.io](https://codecov.io/gh/dojo/stores/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/stores/branch/master)
[![npm version](https://badge.fury.io/js/%40dojo%2Fstores.svg)](https://badge.fury.io/js/%40dojo%2Fstores)

This library provides an application store designed to complement @dojo/widgets and @dojo/widget-core or any other reactive application.

**WARNING** This is *alpha* software. It is not yet production ready, so you should use at your own risk.

## Usage

To use `@dojo/stores`, install the package along with its required peer dependencies:

```bash
npm install @dojo/stores

# peer dependencies
npm install @dojo/core
npm install @dojo/has
npm install @dojo/shim
```

## Features

 * Application state store designed to work with a reactive component architecture
 * Out of the box support for asynchronous operations
 * All modifications can be configured as undoable
 * Supports the optimistic pattern with automatic rollback on a failure
 * Fully serializable operations and state

## Overview

Dojo 2 stores is a predictable, consistent state container for Javascript applications with inspiration from Redux and Flux architectures. However Dojo 2 stores aims to provide more built in support for common patterns such as asynchronous behaviors, undo support and **more**!

Managing state can become difficult to coordinate when an application becomes complicated with multiple views, widgets, components and models. With each of these attempting to update attributes of state at varying points within the application lifecycle things can get **confusing**. When state changes are hard to understand and/or non-deterministic it becomes increasingly difficult to identify and reproduce bug or add new features.

Dojo 2 stores provides a centralized store is designed to be the **single source of truth** for an application and operates using uni-directional data flow. This means all application data follows the same lifecycle, ensuring the application logic is predictable and easy to understand.

## Basics

To work with the Dojo 2 store there are three core but simple concepts - Operations, Commands and Processes.

 * `Operation`
   * Granular instructions to manipulate state based on JSON Patch
 * `Command`
   * Simple functions that ultimately return operations needed to perform the required state change
 * `Process`
   * A group of commands which normally represent a complete application behavior

### Operations

Operations are the raw instructions the store uses to make modifications to the state. The operations are based on the JSON Patch and JSON Pointer specifications that have been customized specifically for Dojo 2 stores, primarily to prevent access to the state's root.

Each operation is a simple object which contains instructions with the `OperationType`, `path` and optionally the `value` (depending on operation).

```ts
const operations = [
	{ op: OperationType.ADD, path: new JsonPointer('/foo'), value: 'foo' },
	{ op: OperationType.REPLACE, path: new JsonPointer('/bar'), value: 'bar' },
	{ op: OperationType.REMOVE, path: new JsonPointer('/qux') },
];
```

Dojo 2 stores provides a helper package that can generate `PatchOperation` objects from `@dojo/stores/state/operations`:

* `add`     - Returns a `PatchOperation` of type `OperationType.ADD` for the `path` and `value`
* `remove`  - Returns a `PatchOperation` of type `OperationType.REMOVE` for the `path`
* `replace` - Returns a `PatchOperation` of type `OperationType.REPLACE` for the `path` and `value`

### Commands

Commands are simply functions which are called internally by the store when executing a `Process` and return a `CommandResponse` that tells the store what needs to be done. Each command is passed a `CommandRequest` which provides a `get` function for access to the stores state and a `payload` object which contains the arguments which the process executor was called with.

The `get` function returns back state for a given "path" or "selector", for example `get('/my/deep/state')` or `get('/my/array/item/9')`.

```ts
function addTodoCommand({ get, payload }: CommandRequest) {
	const todos = get('/todos');
	const operations = [
		{ op: OperationType.REPLACE, path: `/todos/${todos.length}`, value: payload }
	];

	return {
		type: CommandResponseType.SUCCESS,
		operations
	};
}

function calculateCountsCommand({ get }: CommandRequest) {
	const todos = get('/todos');
	const completedTodos = todos.filter((todo: any) => todo.completed);
	const operations = [
		{ op: OperationType.REPLACE, path: '/activeCount', value: todos.length - completedTodos.length },
		{ op: OperationType.REPLACE, path: '/completedCount', value: completedTodos.length }
	];
	return {
		type: CommandResponseType.SUCCESS,
		operations
	};
}
```

There are two types of CommandResponse, `SUCCESS` and `FAILURE` both of which can return `operations` to manipulate the stores state as well as options.

Options:
 * `undoable`: Indicates if the command is undoable; `true` by default for `SUCCESS` and `false` for `FAILURE`
 * `revert`: Indicates if the command requires all previous process modifications to be reverted. Only valid with `FAILURE` responses.

 *Important:* Access to state root is not permitted and will throw an error, for example `get('/')`. This applies for `Operations` also, it is not possible to create an operation that will update the state root.

 #### Helper Command Responses

 Helper functions create successful (`successResponse`) and failure (`failureResponse`) `CommandResponses` are provided from `@dojo/stores/commands` that accept `Operation || Operation[]` and optional options.

```ts
const commandResponse = successResponse({ op: OperationType.REPLACE, path: '/path', value: 'value' });
```

```ts
const commandResponse = failureResponse({ op: OperationType.REPLACE, path: '/path', value: 'value' });
```

 ##### Asynchronous Commands

Commands support asynchronous behavior out of the box simply by returning a `Promise<CommandResponse>`.

```ts
async function postTodoCommand({ get, payload }: CommandRequest): Promise<CommandResponse> {
	const response = await fetch('/todos');
	if (!response.ok) {
		// failure
		return failureResponse({
			op: OperationType.ADD,
			path: '/failed',
			value: true
		});
	}
	const json = await response.json();
	const todos =  get('/todos');
	const index = findIndex(todos, byId(payload.id));
	// success
	return successResponse(replace(`/todos/${index}`, {
		...todos[index],
		loading: false,
		id: data.uuid
	}));
}
```

### Processes

Processes are the construct passed to the store by the user in order to make changes to the application state. Processes are a simple array of Commands that get executed in sequence by the store until the last Command is completed or a Command returns a `FAILURE` state, these processes often represent an application behavior. For example adding a todo in a simple todo application which will be made up with multiple discreet commands.

```ts
const addTodoProcess = [ addTodoCommand, calculateCountCommand ];
```

Processes can be immediately executed against against the store, using `store.execute(process)` or can be wrapped so that they are deferred until they wrapping function is called. The arguments passed to the `executor` are passed to each of the Process's commands in a `payload` argument

```ts
const executor = store.createExecutor(process);

executor('arguments', 'get', 'passed', 'here');
```

### Initial State

Initial state can be defined on store creation by passing processes to the constructor.

```ts
// Command that creates the basic initial state
function initialStateCommand() {
	return successResponse([
		add('/todos', []),
		add('/currentTodo', ''),
		add('/activeCount', 0),
		add('/completedCount', 0)
	], { undoable: false });
}

// initializes the state and runs the `getTodosProcess`
const store = createStore([ initialStateCommand ], getTodosProcess);
```

## Advanced

### Subscribing to store changes

In order to be notified when changes occur within the store's state, simply register to the stores `.on()` for a type of `invalidate` passing the function to be called.

```ts
store.on('invalidate', () => {
	// do something when the store's state has been updated.
});
```

### Undo Processes

The store records undo operations for every `Command` that returns `undoable: true`, grouped by it's `Process`. The `store` exposes two functions to leverage the undo capabilities manually, `store.hasUndoOperations(...processes: Process[])` and `store.undo(...processes: Process[])`.

`hasUndoOperations` returns a `boolean` that indicates if there are any records in the undo history for the specified `processes`.

```ts
// will return true if there are any `addTodoProcess` process records in the undo stack.
const hasAddTodoProcessUndoOperations = store.hasUndoOperations(addTodoProcess);
```

`undo` will perform the first undo record for the the `processes` arguments passed.

```ts
// will execute the undo operations for the first (most recent) `addTodoProcess` process record in the undo stack.
store.undo(addTodoProcess);
```

**Note:** Each undo operation has an associated `test` operation to ensure that the store is in the expected state to successfully run the undo operation, if the test fails then an error is thrown and no changes are performed.

### Transforming Executor Arguments

An optional `transformer` can be passed to the `createExecutor` function that will be used to parse the arguments passed to the executor.

```ts
function transformer(value: string): any {
	return { id: uuid(), value };
}

const executor = store.createExecutor(process, transformer);

executor('id');
```

Each `Command` will be passed the result of the transformer as the `payload` for example: `{ id: 'UUID-VALUE', value }`

### Typing with `store.get`

All access to the internal store state is restricted through `store.get`, the function that is passed to each `Command` when they are executed. It is possible to specify the expected type of the data by passing a generic to `get`.

```ts
interface Todo {
	id: string;
	label: string;
	completed: boolean;
}

// Will return an array typed as Todo items
const todos = store.get<Todo[]>('/todos');
```

### Optimistic Update Pattern

Dojo 2 stores support the pattern of optimistic state updates with no special effort required. Consider the requirements of adding a new todo in a simple todo application:

* Want to add this to the state store immediately before persisting the new todo to a remote service
* Run any complimentary commands such as calculating active & completed counts
* Make the request to persist the new todo to the remote service
  * On Success
    * Simply update the id of the todo item with the id provided by the remote service
  * On Failure
    * Remove the todo item from the list and set a flag to indicate the failure

Sounds complicated? This an extremely common pattern within modern web applications so shouldn't be difficult or complicated to implement. With Dojo 2 stores this can achieved simply by creating a process with the commands demonstrated earlier.

```ts
const addTodoProcess = [ addTodoCommand, calculateCountsCommand, postTodoCommand, calculateCountsCommand];
```

* `addTodoCommand`: Adds the new todo into the application state
* `calculateCountsCommand`: Recalculates the count of completed and active todo items
* `postTodoCommand`: posts the todo item to a remote service
  * on failure: the previous two commands are automatically reverted and the `failed` flag set to `true`
  * on success: updates the todo item `id`
* `calculateCountsCommand`: Runs again after the success of `postTodoCommand`

To support "pessimistic" updates to the application state, i.e. wait until a remote service call has been completed before changing the application state simply put the async command before the application store update. This can be useful when performing a deletion of resource, when it can be surprising if item is removed from the UI "optimistically" only for it to reappear back if the remote service call fails.

```ts
function deleteTodoCommand({ get, payload: [ id ] }: CommandRequest) {
	const todo = find(get('/todos'), byId(id))
	const fetchOptions = {
		method: 'DELETE',
		headers: { 'Content-Type': 'text/plain' }
	};
	return fetch(`/todo/${todo.id}`, fetchOptions)
		.then(throwIfNotOk)
		.then(() => {
			const index = findIndex(get('/todos'), byId(id));
			return successResponse(remove(`/todos/${index}`));
		}, () => {
			return failureResponse(add('/failed', true));
		});
}

const deleteTodoProcess = [ deleteTodoCommand, calculateCountsCommand];
```

*Note:* The process requires the counts to be recalculated after successfully deleting a todo, the process above shows how easily commands can be shared and reused.

## How do I contribute?

We appreciate your interest!  Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the
Contributing Guidelines and Style Guide.

### Installation

To start working with this package, clone the repository and run `npm install`.

In order to build the project run `grunt dev` or `grunt dist`.

### Testing

Test cases MUST be written using [Intern](https://theintern.github.io) using the Object test interface and Assert assertion interface.

90% branch coverage MUST be provided for all code submitted to this repository, as reported by istanbul’s combined coverage results for all supported platforms.

To test locally in node run:

`grunt test`

To test against browsers with a local selenium server run:

`grunt test:local`

To test against BrowserStack or Sauce Labs run:

`grunt test:browserstack`

or

`grunt test:saucelabs`

## Licensing information

TODO: If third-party code was used to write this library, make a list of project names and licenses here

* [Third-party lib one](https//github.com/foo/bar) ([New BSD](http://opensource.org/licenses/BSD-3-Clause))

© 2017 [JS Foundation](https://js.foundation/). [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
