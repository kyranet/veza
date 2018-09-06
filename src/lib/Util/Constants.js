module.exports = {
	// Symbols
	kPing: Symbol('IPC-Ping'),
	kIdentify: Symbol('IPC-Identify'),

	// Constants
	S_MESSAGE_TYPES: Object.freeze({
		NULL: 0,
		STRING: 1,
		NUMBER: 2,
		SET: 3,
		MAP: 4,
		BUFFER: 5,
		OBJECT: 6,
		PING: 7,
		IDENTIFY: 8,
		BOOLEAN: 9,
		UNDEFINED: 10,
		SYMBOL: 11,
		BIGINT: 12
	}),
	R_MESSAGE_TYPES: null,
	BUFFER_NULL: Buffer.from('\0'),
	BUFFER_NL: Buffer.from('\n'),

	// Helpers
	// @ts-ignore
	toBigInt: typeof BigInt === 'function' ? BigInt : Number
};

// @ts-ignore
module.exports.R_MESSAGE_TYPES = Object.assign({}, ...Object.entries(module.exports.S_MESSAGE_TYPES)
	.map(([key, value]) => ({ [value]: key }))
);
