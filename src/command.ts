import { PatchOperation } from './state/Patch';

/**
 * The arguments passed to a `Command`
 */
export interface CommandRequest<P = any> {
	get<T = any>(pointer: string): T;
	payload: P;
}

/**
 * Types of response from a `Command`
 */
export enum CommandResponseType {
	SUCCESS = 'success',
	FAILURE = 'failure'
}

export interface CommandResponseOptions {
	undoable?: boolean;
	revert?: boolean;
}

/**
 * The response of a `Command` used by the store to process changes
 */
export interface CommandResponse {
	type: CommandResponseType;
	operations?: PatchOperation[];
	options?: CommandResponseOptions;
}

/**
 * Specifies the interface for a Command that is used to create a
 * response that instructs the store to process changes.
 */
export interface Command {
	(request?: CommandRequest): CommandResponse | Promise<CommandResponse>;
}

/**
 * Creates a successful `CommandResponse`
 *
 * @param operations The patch state operations that need to be applied.
 * @param undoable indicates if the operations are undoable.
 */
export function successResponse(operations: PatchOperation | PatchOperation[], options?: CommandResponseOptions): CommandResponse {
	operations = Array.isArray(operations) ? operations : [ operations ];
	return {
		type: CommandResponseType.SUCCESS,
		operations,
		options
	};
}

/**
 * Creates a failure `CommandResponse`
 *
 * @param operations The patch state operations that need to be applied.
 */
export function failureResponse(operations: PatchOperation | PatchOperation[]): CommandResponse {
	operations = Array.isArray(operations) ? operations : [ operations ];
	return {
		type: CommandResponseType.FAILURE,
		operations,
		options: {
			undoable: false,
			revert: true
		}
	};
}

/**
 * The store accepts `Process` that is a simple array of `Command`s
 */
export type Process = Command[];
