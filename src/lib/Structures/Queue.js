const {
	// Symbols
	kPing, kIdentify,

	// Constants
	R_MESSAGE_TYPES,

	// Helpers
	toBigInt
} = require('../Util/Constants');
const { readHeader } = require('../Util/Header');
const { inspect } = require('util');

/**
 * @typedef {Object} QueueEntry
 * @property {Function} resolve The resolve function
 * @property {Function} reject The reject function
 * @private
 */

/**
 * @extends {Map<string,QueueEntry>}
 */
class Queue extends Map {

	constructor(nodeSocket) {
		super();
		this.nodeSocket = nodeSocket;
		this._rest = null;
	}

	get node() {
		return this.nodeSocket.node;
	}

	get name() {
		return this.nodeSocket.name;
	}

	get socket() {
		return this.nodeSocket.socket;
	}

	*process(buffer) {
		if (this._rest) {
			buffer = Buffer.concat([this._rest, buffer]);
			this._rest = null;
		}

		while (buffer.length) {
			// If the header separator was not found, it may be due to an impartial message
			if (buffer.length <= 13) {
				this._rest = buffer;
				break;
			}

			const { id, type, receptive, length: bodyLength } = readHeader(buffer);
			if (!(type in R_MESSAGE_TYPES))
				throw new Error(`Failed to parse type, received ${type} from ${inspect(buffer)}`);

			const endBodyIndex = 13 + bodyLength;
			// If the body's length is not enough long, the Socket may have cut the message in half
			if (endBodyIndex > buffer.length) {
				this._rest = buffer;
				break;
			}
			const body = buffer.slice(13, endBodyIndex);

			const pType = R_MESSAGE_TYPES[type];
			const data = this._readMessage(body, pType);

			buffer = buffer.slice(endBodyIndex + 1);
			yield { id, receptive, data };
		}
	}

	flush() {
		this._rest = null;
	}

	_readMessage(body, type) { // eslint-disable-line complexity
		if (type === 'PING') return kPing;
		if (type === 'IDENTIFY') return kIdentify;
		if (type === 'NULL') return null;
		if (type === 'UNDEFINED') return undefined;
		if (type === 'BUFFER') return body;
		if (type === 'BYTE') return body[0];

		const bodyString = body.toString('utf8');
		if (type === 'BOOLEAN') return bodyString === '1';
		if (type === 'STRING') return bodyString;
		if (type === 'NUMBER') return Number(bodyString);
		if (type === 'BIGINT') return toBigInt(bodyString);
		if (type === 'OBJECT') return JSON.parse(bodyString);
		if (type === 'SYMBOL') return Symbol.for(bodyString);
		if (type === 'MAP') return new Map(JSON.parse(bodyString));
		if (type === 'SET') return new Set(JSON.parse(bodyString));
		if (type === 'ARRAY_BUFFER') return new ArrayBuffer(JSON.parse(bodyString));
		if (type === 'FLOAT32_ARRAY') return new Float32Array(JSON.parse(bodyString));
		if (type === 'FLOAT64_ARRAY') return new Float64Array(JSON.parse(bodyString));
		if (type === 'INT8_ARRAY') return new Int8Array(JSON.parse(bodyString));
		if (type === 'INT16_ARRAY') return new Int16Array(JSON.parse(bodyString));
		if (type === 'INT32_ARRAY') return new Int32Array(JSON.parse(bodyString));
		if (type === 'UINT8_ARRAY') return new Uint8Array(JSON.parse(bodyString));
		if (type === 'UINT8_CLAMPEDARRAY') return new Uint8ClampedArray(JSON.parse(bodyString));
		if (type === 'UINT16_ARRAY') return new Uint16Array(JSON.parse(bodyString));
		if (type === 'UINT32_ARRAY') return new Uint32Array(JSON.parse(bodyString));

		return body;
	}

}

module.exports = Queue;
