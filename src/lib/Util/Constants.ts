// Symbols
export const kPing = Symbol('IPC-Ping');
export const kIdentify = Symbol('IPC-Identify');
export const kInvalidMessage = Symbol('QUEUE-Invalid');

// Constants
export const S_MESSAGE_TYPES = Object.freeze({
	BIGINT: 0,
	BOOLEAN: 1,
	BUFFER: 2,
	BYTE: 3,
	FLOAT32_ARRAY: 4,
	FLOAT64_ARRAY: 5,
	INT16_ARRAY: 6,
	INT32_ARRAY: 7,
	INT8_ARRAY: 8,
	MAP: 9,
	NULL: 10,
	NUMBER: 11,
	OBJECT: 12,
	SET: 13,
	SMALL_INTEGER: 14,
	STRING: 15,
	SYMBOL: 16,
	UINT16_ARRAY: 17,
	UINT32_ARRAY: 18,
	UINT8_ARRAY: 19,
	UINT8_CLAMPEDARRAY: 20,
	UNDEFINED: 21,
	PING: 22,
	IDENTIFY: 23
});

//   export const R_MESSAGE_TYPES= null;
export const BUFFER_NULL = Buffer.from('\0');
export const BUFFER_NL = Buffer.from('\n');
export enum SocketStatus {
	Idle,
	Ready,
	Connecting,
	Disconnected
}

// Helpers
export const toBigInt = typeof BigInt === 'function' ? BigInt : Number;

export const decompressSmallInteger = (integers: Buffer) => {
	let number = 0;
	let position = 0;
	const byte = integers[0];
	for (let i = integers.length - 1; i >= 1; i--) {
		number += integers[i] << (position++ * 8);
	}

	return byte ? -number : number;
};

export const R_MESSAGE_TYPES = Object.keys(S_MESSAGE_TYPES);
