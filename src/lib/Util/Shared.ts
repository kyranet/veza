import { createFromID } from './Header';
import { serialize } from 'binarytf';

export interface SendOptions {
	receptive?: boolean;
	timeout?: number;
}

export interface BroadcastOptions extends SendOptions {
	filter?: RegExp;
}

/**
 * Node.js generates system errors when exceptions occur within its runtime environment. These usually occur when an
 * application violates an operating system constraint. For example, a system error will occur if an application
 * attempts to read a file that does not exist.
 */
export interface NetworkError extends Error {
	/**
	 * If present, the address to which a network connection failed
	 */
	address?: string;
	/**
	 * The string error code
	 */
	code: string;
	/**
	 * If present, the file path destination when reporting a file system error
	 */
	dest?: string;
	/**
	 * The system - provided error number
	 */
	errno: number | string;
	/**
	 * If present, extra details about the error condition
	 */
	info?: Record<string, unknown>;
	/**
	 * A system - provided human - readable description of the error
	 */
	message: string;
	/**
	 * If present, the file path when reporting a file system error
	 */
	path?: string;
	/**
	 * If present, the network connection port that is not available
	 */
	port?: number;
	/**
	 * The name of the system call that triggered the error
	 */
	syscall: string;
}

export const VCLOSE_SIGNAL = 'VCLOSE';
export const VCLOSE = createFromID(0, false, serialize(VCLOSE_SIGNAL));

export function receivedVClose(processed: { id: number; receptive: boolean; data: unknown }) {
	return processed.id === 0 && processed.receptive === false && processed.data === VCLOSE_SIGNAL;
}
