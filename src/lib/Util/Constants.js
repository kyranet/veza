module.exports = {
	// Symbols
	kPing: Symbol('IPC-Ping'),
	kIdentify: Symbol('IPC-Identify'),

	// Constants
	S_MESSAGE_TYPES: Object.freeze({
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
	}),
	R_MESSAGE_TYPES: null,
	BUFFER_NULL: Buffer.from('\0'),
	BUFFER_NL: Buffer.from('\n'),
	STATUS: Object.freeze({
		READY: 0,
		CONNECTING: 1,
		DISCONNECTED: 2
	}),

	// Helpers
	// @ts-ignore
	toBigInt: typeof BigInt === 'function' ? BigInt : Number,

	decompressSmallInteger(integers) {
		let number = 0;
		let position = 0;
		const byte = integers[0];
		for (let i = integers.length - 1; i >= 1; i--)
			// eslint-disable-next-line no-bitwise
			number += integers[i] << position++ * 8;

		return byte ? -number : number;
	}
};

// @ts-ignore
module.exports.R_MESSAGE_TYPES = Object.keys(module.exports.S_MESSAGE_TYPES);
