const {
	// Symbols
	kPing, kIdentify,

	// Constants
	S_MESSAGE_TYPES, BUFFER_NULL, BUFFER_NL
} = require('./Constants');

const { createHeader } = require('./Header');

/**
 * Pack a message into a buffer for usage in other sockets
 * @param {string} id The id of the message to pack
 * @param {*} message The message to send
 * @param {boolean} receptive Whether this message requires a response or not
 * @returns {Buffer}
 * @private
 */
function _packMessage(id, message, receptive = true) {
	if (message === kPing || message === kIdentify) receptive = false;
	const [type, buffer] = _getMessageDetails(message);
	// @ts-ignore
	return Buffer.concat([createHeader(id, type, receptive, buffer.byteLength), buffer, BUFFER_NL]);
}

// eslint-disable-next-line no-bitwise
const MIN_32 = -~(2 ** 31), MAX_32 = 2 ** 31;
// Checks if it is a (signed) 32-bit integer
function _isSmallInteger(integer) {
	return integer >= MIN_32 && integer <= MAX_32;
}
// Checks if it is a 8-bit integer
function _isByteInteger(integer) {
	return integer >= 0 && integer <= 0xFF;
}
// Extracts a (signed) 32-bit integer
function _compressSmallInteger(integer) {
	const output = [];
	const sign = integer < 0 ? 1 : 0;
	// If negative, convert to positive
	if (sign) integer = -integer;
	while (integer) {
		// eslint-disable-next-line no-bitwise
		output.unshift(integer & 0xFF);
		// eslint-disable-next-line no-bitwise
		integer >>= 8;
	}

	output.unshift(sign);
	return output;
}

/**
 * Get the message details
 * @param {*} message The message to convert
 * @returns {Array<number | Buffer>}
 */
function _getMessageDetails(message) { // eslint-disable-line complexity
	if (message === kPing) return [S_MESSAGE_TYPES.PING, Buffer.from(Date.now().toString())];
	if (message === kIdentify) return [S_MESSAGE_TYPES.IDENTIFY, BUFFER_NULL];

	switch (typeof message) {
		// @ts-ignore
		case 'bigint': return [S_MESSAGE_TYPES.BIGINT, Buffer.from(message.toString())];
		case 'undefined': return [S_MESSAGE_TYPES.UNDEFINED, BUFFER_NULL];
		case 'string': return [S_MESSAGE_TYPES.STRING, Buffer.from(message)];
		case 'number':
			if (Number.isInteger(message)) {
				if (_isByteInteger(message)) return [S_MESSAGE_TYPES.BYTE, Buffer.from(message)];
				if (_isSmallInteger(message)) return [S_MESSAGE_TYPES.SMALL_INTEGER, Buffer.from(_compressSmallInteger(message))];
			}
			return [S_MESSAGE_TYPES.NUMBER, Buffer.from(message.toString())];
		case 'boolean': return [S_MESSAGE_TYPES.BOOLEAN, Buffer.from(message ? '1' : '0')];
		case 'symbol': return [S_MESSAGE_TYPES.SYMBOL, Buffer.from(message.toString().slice(7, -1))];
		case 'object': {
			if (message === null) return [S_MESSAGE_TYPES.NULL, BUFFER_NULL];
			if (message.constructor === Object) return [S_MESSAGE_TYPES.OBJECT, Buffer.from(JSON.stringify(message))];
			if (message instanceof Set) return [S_MESSAGE_TYPES.SET, Buffer.from(JSON.stringify([...message]))];
			if (message instanceof Map) return [S_MESSAGE_TYPES.MAP, Buffer.from(JSON.stringify([...message]))];
			if (Buffer.isBuffer(message)) return [S_MESSAGE_TYPES.BUFFER, message];
			if ('buffer' in message && message.buffer instanceof ArrayBuffer) return [_getArrayType(message), Buffer.from(JSON.stringify([...message]))];
			return [S_MESSAGE_TYPES.OBJECT, Buffer.from(JSON.stringify(message))];
		}
		default:
			return [S_MESSAGE_TYPES.STRING, Buffer.from(String(message))];
	}
}

function _getArrayType(array) {
	switch (array.constructor) {
		case Int8Array: return S_MESSAGE_TYPES.INT8_ARRAY;
		case Int16Array: return S_MESSAGE_TYPES.INT16_ARRAY;
		case Int32Array: return S_MESSAGE_TYPES.INT32_ARRAY;
		case Uint8Array: return S_MESSAGE_TYPES.UINT8_ARRAY;
		case Uint8ClampedArray: return S_MESSAGE_TYPES.UINT8_CLAMPEDARRAY;
		case Uint16Array: return S_MESSAGE_TYPES.UINT16_ARRAY;
		case Uint32Array: return S_MESSAGE_TYPES.UINT32_ARRAY;
		case Float32Array: return S_MESSAGE_TYPES.FLOAT32_ARRAY;
		case Float64Array: return S_MESSAGE_TYPES.FLOAT64_ARRAY;
		default: return S_MESSAGE_TYPES.OBJECT;
	}
}

module.exports = Object.freeze({ _packMessage, _getMessageDetails });
