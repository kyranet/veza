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
		STRING: 14,
		SYMBOL: 15,
		UINT16_ARRAY: 16,
		UINT32_ARRAY: 17,
		UINT8_ARRAY: 18,
		UINT8_CLAMPEDARRAY: 19,
		UNDEFINED: 20,
		PING: 21,
		IDENTIFY: 22
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
	toBigInt: typeof BigInt === 'function' ? BigInt : Number
};

// @ts-ignore
module.exports.R_MESSAGE_TYPES = Object.keys(module.exports.S_MESSAGE_TYPES);
