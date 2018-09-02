module.exports = {
	// Symbols
	kPing: Symbol('IPC-Ping'),
	kIdentify: Symbol('IPC-Identify'),

	// Constants
	HEADER_SEPARATOR: '|'.charCodeAt(0),
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
	BUFFER_EOL: Buffer.from(require('os').EOL),

	// Helpers
	// @ts-ignore
	toBigInt: typeof BigInt === 'function' ? BigInt : Number,

	/**
	 * Create an ID for a message
	 * @returns {string}
	 * @private
	 */
	createID() {
		i = i < 46656 ? i + 1 : 0;
		return Date.now().toString(36) + i.toString(36);
	}
};

// @ts-ignore
module.exports.R_MESSAGE_TYPES = Object.assign({}, ...Object.entries(module.exports.S_MESSAGE_TYPES)
	.map(([key, value]) => ({ [value]: key }))
);

let i = 0;
