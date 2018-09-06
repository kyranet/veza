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

	_readMessage(body, type) {
		if (type === 'PING') return kPing;
		if (type === 'IDENTIFY') return kIdentify;
		if (type === 'NULL') return null;
		if (type === 'UNDEFINED') return undefined;
		if (type === 'BUFFER') return body;

		const bodyString = body.toString('utf8');
		if (type === 'STRING') return bodyString;
		if (type === 'BOOLEAN') return bodyString === '1';
		if (type === 'SYMBOL') return Symbol.for(bodyString);
		if (type === 'NUMBER') return Number(bodyString);
		if (type === 'OBJECT') return JSON.parse(bodyString);
		if (type === 'SET') return new Set(JSON.parse(bodyString));
		if (type === 'MAP') return new Map(JSON.parse(bodyString));
		if (type === 'BIGINT') return toBigInt(bodyString);

		return body;
	}

}

module.exports = Queue;
