import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import { successResponse, failureResponse, CommandResponseType} from './../../src/command';
import { OperationType } from './../../src/state/Patch';
import { Pointer } from './../../src/state/Pointer';

registerSuite({
	name: 'commands',
	successResponse: {
		'success response with a single operation'() {
			const response = successResponse({ op: OperationType.REMOVE, path: new Pointer('root') });
			assert.deepEqual(response, {
				type: CommandResponseType.SUCCESS,
				operations: [ { op: OperationType.REMOVE, path: new Pointer('root') } ],
				options: undefined
			});
		},
		'success response with multiple operations'() {
			const response = successResponse([
				{ op: OperationType.REMOVE, path: new Pointer('root1') },
				{ op: OperationType.REMOVE, path: new Pointer('root2') }
			]);
			assert.deepEqual(response, {
				type: CommandResponseType.SUCCESS,
				operations: [
					{ op: OperationType.REMOVE, path: new Pointer('root1') },
					{ op: OperationType.REMOVE, path: new Pointer('root2') }
				],
				options: undefined
			});
		},
		'success response with with options'() {
			const response = successResponse({ op: OperationType.REMOVE, path: new Pointer('root') }, { undoable: true });
			assert.deepEqual(response, {
				type: CommandResponseType.SUCCESS,
				operations: [ { op: OperationType.REMOVE, path: new Pointer('root') } ],
				options: { undoable: true }
			});
		}
	},
	failureResponse: {
		'failure response with a single operation'() {
			const response = failureResponse({ op: OperationType.REMOVE, path: new Pointer('root') });
			assert.deepEqual(response, {
				type: CommandResponseType.FAILURE,
				operations: [ { op: OperationType.REMOVE, path: new Pointer('root') } ],
				options: { undoable: false, revert: true }
			});
		},
		'failure response with multiple operations'() {
			const response = failureResponse([
				{ op: OperationType.REMOVE, path: new Pointer('root1') },
				{ op: OperationType.REMOVE, path: new Pointer('root2') }
			]);
			assert.deepEqual(response, {
				type: CommandResponseType.FAILURE,
				operations: [
					{ op: OperationType.REMOVE, path: new Pointer('root1') },
					{ op: OperationType.REMOVE, path: new Pointer('root2') }
				],
				options: { undoable: false, revert: true }
			});
		}
	}
});
