const {
	// Symbols
	kPing, kIdentify,

	// Constants
	HEADER_SEPARATOR, R_MESSAGE_TYPES,

	// Helpers
	toBigInt
} = require('../Util/Constants');

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
			const headerSeparatorIndex = buffer.indexOf(HEADER_SEPARATOR);
			// If the header separator was not found, it may be due to an impartial message
			if (headerSeparatorIndex === -1) {
				this._remainingBuffer = buffer;
				break;
			}

			const [id, type, _receptive, bodyLength] = buffer.toString('utf8', 0, headerSeparatorIndex - 1).split(' ').map(value => value.trim());
			if (!(type in R_MESSAGE_TYPES))
				throw new Error(`Failed to unpack message. Got type ${type}, expected an integer between 0 and 7.`);

			const startBodyIndex = headerSeparatorIndex + 2;
			const endBodyIndex = startBodyIndex + parseInt(bodyLength, 36);
			// If the body's length is not enough long, the Socket may have cut the message in half
			if (endBodyIndex > buffer.length) {
				this._remainingBuffer = buffer;
				break;
			}
			const body = buffer.slice(startBodyIndex, endBodyIndex);

			const pType = R_MESSAGE_TYPES[type];
			const receptive = _receptive === '1';
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
