const { EventEmitter } = require('events');
const { Socket, Server } = require('net');

const kSeparatorHeader = '|'.charCodeAt(0);
const kPing = Symbol('IPC-Ping');
const kIdentify = Symbol('IPC-Identify');

const bufferNull = Buffer.from('null');
const bufferEOL = Buffer.from(require('os').EOL);
const noop = () => { }; // eslint-disable-line no-empty-function

class Node extends EventEmitter {

	/**
	 * @typedef {Object} NodeOptions
	 * @property {number} [maxRetries = Infinity]
	 * @property {number} [retryTime = 200]
	 */

	/**
	 * @typedef {Object} NodeSocket
	 * @property {string} name The label name for the socket
	 * @property {Socket} [socket] The socket itself
	 * @property {number} retriesRemaining The remaining reconnection retries
	 */

	/**
	 * @typedef {Object} QueueEntry
	 * @property {Socket} socket The socket the message is being sent to
	 * @property {Function} resolve The resolve function
	 * @property {Function} reject The reject function
	 * @private
	 */

	/**
	 * @param {string} name The name for this Node
	 * @param {NodeOptions} [options={}] The options for this Node instance
	 */
	constructor(name, { maxRetries = Infinity, retryTime = 200 } = {}) {
		super();

		if (typeof name !== 'string') throw new Error('A Node name must be specified and must be a string.');

		/**
		 * The name for this Node
		 * @type {string}
		 */
		this.name = name;

		/**
		 * The amount of retries this Node will do when reconnecting
		 * @type {number}
		 */
		this.maxRetries = maxRetries;

		/**
		 * The time between connection retries
		 * @type {number}
		 */
		this.retryTime = retryTime;

		Object.defineProperties(this, {
			server: { value: null, writable: true },
			sockets: { value: null, writable: true },
			_queue: { value: null, writable: true },
			_serverNodes: { value: null, writable: true },
			_remainingBuffer: { value: null, writable: true }
		});

		/**
		 * @type {?Server}
		 * @private
		 */
		this.server = null;

		/**
		 * @type {Map<string, NodeSocket>}
		 * @private
		 */
		this.sockets = new Map();

		/**
		 * @type {Map<string, QueueEntry>}
		 * @private
		 */
		this._queue = new Map();

		/**
		 * @type {Map<string, Socket>}
		 * @private
		 */
		this._serverNodes = new Map();

		/**
		 * @type {?Buffer}
		 * @private
		 */
		this._remainingBuffer = null;
	}

	/**
	 * Create a server for this Node instance.
	 * @param {string} name The label name for this server
	 * @param {...*} options The options to pass to net.Server#listen
	 * @returns {this}
	 */
	serve(name, ...options) {
		if (this.server) throw new Error('There is already a server.');
		this.server = new Server()
			.on('connection', (socket) => {
				let socketName = null;
				socket
					.on('error', (error) => {
						// If the socket disconnected, the error is an ECONNRESET, perform cleanup
						// @ts-ignore
						if (error.code === 'ECONNRESET')
							this._destroySocket(socketName, socket, true);
						else
							this.emit('error', error);
					})
					.on('data', (data) => this._onDataMessage(socketName, socket, data))
					.on('close', () => {
						// Cleanup
						this._destroySocket(socketName, socket, true);
					});
				this.sendTo(socket, kIdentify).then(sName => {
					socketName = sName;
					this._serverNodes.set(socketName, socket);
					this.emit('connection', socketName, socket);
				});
			})
			.on('close', () => {
				this.server.removeAllListeners();
				this.server = null;

				for (const socket of this._serverNodes.values()) socket.destroy();
				this.emit('close');

				if (this._queue.size) {
					const rejectError = new Error('Server has been disconnected.');
					for (const element of this._queue.values()) element.reject(rejectError);
				}
			})
			.on('error', this.emit.bind(this, 'error'))
			.on('listening', this.emit.bind(this, 'listening'));
		this.server.listen(...options);
		return this;
	}

	/**
	 * Broadcast a message to all connected sockets from this server
	 * @param {*} data The data to send to other sockets
	 * @param {boolean} [receptive] Whether this broadcast should wait for responses or not
	 * @returns {Promise<Array<*>>}
	 */
	broadcast(data, receptive) {
		return Promise.all([...this._serverNodes.values()].map(socket => this.sendTo(socket, data, receptive)));
	}

	/**
	 * Send a message to a connected socket
	 * @param {string|Socket} name The label name of the socket to send the message to
	 * @param {*} data The data to send to the socket
	 * @param {boolean} receptive Whether this message should wait for a response or not
	 * @returns {Promise<*>}
	 */
	sendTo(name, data, receptive = true) {
		const socket = this._getSocket(name);
		if (!socket) return Promise.reject(new Error('Failed to send to the socket.'));
		if (!socket.writable) return Promise.reject(new Error('The Socket is not writable.'));

		return new Promise(async (resolve, reject) => {
			try {
				const id = Node.createID();
				const message = Node._packMessage(id, data, receptive);
				socket.write(message);

				if (!receptive) return resolve(undefined);

				const send = (fn, response) => {
					this._queue.delete(id);
					return fn(response);
				};
				return this._queue.set(id, { socket, resolve: send.bind(null, resolve), reject: send.bind(null, reject) });
			} catch (error) {
				return reject(error);
			}
		});
	}

	/**
	 * Measure the latency with other websockets
	 * @param {string} name The label name of the socket to measure latency with
	 * @returns {Promise<number>}
	 */
	pingTo(name) {
		const now = Date.now();
		return this.sendTo(name, kPing).then(future => future - now);
	}

	/**
	 * Connect to a socket
	 * @param {string} name The label name for the socket
	 * @param {...*} options The options to pass to connect
	 * @returns {Promise<Socket>}
	 */
	connectTo(name, ...options) {
		if (this.sockets.has(name)) return Promise.reject(new Error('There is already a socket.'));
		const node = Object.defineProperties({}, {
			name: { value: name, enumerable: true },
			socket: { value: null, writable: true, enumerable: true },
			retriesRemaining: { value: this.maxRetries, writable: true, enumerable: true },
			_reconnectionTimeout: { value: null, writable: true }
		});

		return new Promise((resolve, reject) => {
			node.socket = new Socket()
				.on('connect', () => {
					node.retriesRemaining = this.maxRetries;
					if (node._reconnectionTimeout) clearTimeout(node._reconnectionTimeout);
					this.emit('connect', name, node.socket);
					resolve(node.socket);
				})
				.on('close', () => {
					this.emit('disconnect', name, node.socket);
					node._reconnectionTimeout = setTimeout(() => {
						if (--node.retriesRemaining <= 0) {
							this._destroySocket(name, node.socket, false);
							reject(node.socket);
						} else {
							node.socket.connect(...options);
						}
					}, this.retryTime);
				})
				.on('error', this.emit.bind(this, 'error'))
				.on('data', data => this._onDataMessage(name, node.socket, data));

			this.sockets.set(name, node);

			// Set enconding and connect
			node.socket.connect(...options);
		});
	}

	/**
	 * Disconnect from a socket, this will also reject all messages
	 * @param {string} name The label name of the socket to disconnect
	 */
	disconnectFrom(name) {
		const nodeSocket = this.sockets.get(name);
		if (!nodeSocket) throw new Error(`The socket ${name} is not connected to this one.`);
		this._destroySocket(name, nodeSocket.socket, false);
	}

	/**
	 * Resolves a socket
	 * @param {string|Socket} name Resolves a socket
	 * @returns {Socket}
	 */
	_getSocket(name) {
		if (name instanceof Socket) return name;
		return (sk => sk ? sk.socket : null)(this.sockets.get(name)) || this._serverNodes.get(name) || null;
	}

	/**
	 * Destroy a socket and perform all cleanup
	 * @param {string} socketName The label name of the socket to destroy
	 * @param {Socket} socket The Socket to destroy
	 * @param {boolean} server Whether the destroy belongs to the Node's server or not
	 * @private
	 */
	_destroySocket(socketName, socket, server) {
		socket.destroy();
		socket.removeAllListeners();

		if (this._queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this._queue.values()) if (element.socket === socket) element.reject(rejectError);
		}

		if (server) {
			this._serverNodes.delete(socketName);
			this.emit('socketClose', socketName);
		} else {
			this.sockets.delete(socketName);
			this.emit('destroy', socketName, socket);
		}
	}

	/**
	 * Parse the message
	 * @param {string} name The label name of the socket
	 * @param {Socket} socket The Socket that sent this message
	 * @param {Buffer} buffer The buffer received
	 * @private
	 */
	_onDataMessage(name, socket, buffer) {
		this.emit('raw', name, socket, buffer);
		this._unPackMessage(name, socket, buffer);
	}

	/**
	 * Handle a parsed message
	 * @param {string} name The label name of the socket
	 * @param {Socket} socket The Socket that sent this message
	 * @param {Object<string, *>} parsedData The parsed message data
	 */
	_handleMessage(name, socket, { id, receptive, data }) {
		if (this._queue.has(id)) {
			this._queue.get(id).resolve(data);
			return;
		}
		if (data === kPing) {
			socket.write(Node._packMessage(id, Date.now(), false));
			return;
		}
		if (data === kIdentify) {
			socket.write(Node._packMessage(id, this.name, false));
			return;
		}
		const message = Object.freeze(Object.defineProperties({
			data,
			from: name,
			receptive,
			reply: receptive ? (content) => {
				socket.write(Node._packMessage(id, content, false));
			} : noop
		}, { id: { value: id } }));
		this.emit('message', message);
	}

	/**
	 * Unpack a buffer message for usage
	 * @param {string} name The label name of the socket
	 * @param {Socket} socket The Socket that sent this message
	 * @param {Buffer} buffer The buffer to unpack
	 * @private
	 */
	_unPackMessage(name, socket, buffer) {
		if (this._remainingBuffer) {
			buffer = Buffer.concat([this._remainingBuffer, buffer]);
			this._remainingBuffer = null;
		}

		while (buffer.length) {
			const headerSeparatorIndex = buffer.indexOf(kSeparatorHeader);
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
			if (pType === 'PING') {
				this._handleMessage(name, socket, { id, receptive, data: kPing });
			} else if (pType === 'IDENTIFY') {
				this._handleMessage(name, socket, { id, receptive, data: kIdentify });
			} else if (pType === 'NULL') {
				this._handleMessage(name, socket, { id, receptive, data: null });
			} else if (pType === 'BUFFER') {
				this._handleMessage(name, socket, { id, receptive, data: body });
			} else {
				const bodyString = body.toString('utf8');
				if (pType === 'STRING')
					this._handleMessage(name, socket, { id, receptive, data: bodyString });
				else if (pType === 'NUMBER')
					this._handleMessage(name, socket, { id, receptive, data: Number(bodyString) });
				else if (pType === 'OBJECT')
					this._handleMessage(name, socket, { id, receptive, data: JSON.parse(bodyString) });
				else if (pType === 'SET')
					this._handleMessage(name, socket, { id, receptive, data: new Set(JSON.parse(bodyString)) });
				else if (pType === 'MAP')
					this._handleMessage(name, socket, { id, receptive, data: new Map(JSON.parse(bodyString)) });
			}

			buffer = buffer.slice(endBodyIndex + 1);
		}
	}

	/**
	 * Pack a message into a buffer for usage in other sockets
	 * @param {string} id The id of the message to pack
	 * @param {*} message The message to send
	 * @param {boolean} receptive Whether this message requires a response or not
	 * @returns {Buffer}
	 * @private
	 */
	static _packMessage(id, message, receptive = true) {
		const recflag = message === kPing || message === kIdentify ? 0 : Number(receptive);
		const [type, buffer] = Node._getMessageDetails(message);
		return Buffer.concat([Buffer.from(`${id} ${type} ${recflag} ${buffer.length.toString(36)} | `), buffer, bufferEOL]);
	}

	/**
	 * Get the message details
	 * @param {*} message The message to convert
	 * @returns {Array<number | Buffer>}
	 */
	static _getMessageDetails(message) {
		if (message === kPing) return [S_MESSAGE_TYPES.PING, Buffer.from(Date.now().toString())];
		if (message === kIdentify) return [S_MESSAGE_TYPES.IDENTIFY, bufferNull];
		if (message === null) return [S_MESSAGE_TYPES.NULL, bufferNull];

		switch (typeof message) {
			case 'string': return [S_MESSAGE_TYPES.STRING, Buffer.from(message)];
			case 'number': return [S_MESSAGE_TYPES.NUMBER, Buffer.from(message.toString())];
			case 'object': {
				if (message instanceof Set) return [S_MESSAGE_TYPES.SET, Buffer.from(JSON.stringify([...message]))];
				if (message instanceof Map) return [S_MESSAGE_TYPES.MAP, Buffer.from(JSON.stringify([...message]))];
				if (Buffer.isBuffer(message)) return [S_MESSAGE_TYPES.BUFFER, message];
				return [S_MESSAGE_TYPES.OBJECT, Buffer.from(JSON.stringify(message))];
			}
			default:
				return [S_MESSAGE_TYPES.STRING, Buffer.from(String(message))];
		}
	}

	/**
	 * Create an ID for a message
	 * @returns {string}
	 * @private
	 */
	static createID() {
		i = i < 46656 ? i + 1 : 0;
		return Date.now().toString(36) + i.toString(36);
	}

}

const S_MESSAGE_TYPES = Object.freeze({
	NULL: 0,
	STRING: 1,
	NUMBER: 2,
	SET: 3,
	MAP: 4,
	BUFFER: 5,
	OBJECT: 6,
	PING: 7,
	IDENTIFY: 8
});

const R_MESSAGE_TYPES = Object.freeze({
	0: 'NULL',
	1: 'STRING',
	2: 'NUMBER',
	3: 'SET',
	4: 'MAP',
	5: 'BUFFER',
	6: 'OBJECT',
	7: 'PING',
	8: 'IDENTIFY'
});

let i = 0;

module.exports = Node;

/**
 * @typedef {Object} NodeMessage
 * @property {string} id The id of this message
 * @property {*} data The received data from the socket
 * @property {string} from The label name of the socket that sent this message
 * @property {boolean} receptive Whether this message can accept responses or not
 */

/**
 * Emitted on a successful connection to a Socket.
 * @event Node#connect
 * @param {string} name The label name of the socket
 * @param {net.Socket} socket The connected socket
 */
/**
 * Emitted on a disconnection with a Socket.
 * @event Node#disconnect
 * @param {string} name The label name of the socket
 * @param {net.Socket} socket The disconnected socket
 */
/**
 * Emitted when the connection to a Socket has been destroyed.
 * @event Node#destroy
 * @param {string} name The label name of the socket
 * @param {net.Socket} socket The destroyed socket
 */
/**
 * Emitted when a socket connects to the Node's server.
 * @event Node#connection
 * @param {string} socket The label name of the socket
 * @param {net.Socket} socket The socket that connected to the server
 */
/**
 * Emitted when the Node's server closes.
 * @event Node#close
 */
/**
 * Emitted when a socket connected to the server closes.
 * @event Node#socketClose
 * @param {string} name The label name of the socket that closed
 */
/**
 * Emitted when the Node's server is ready.
 * @event Node#listening
 */
/**
 * Emitted when any of the connected sockets error.
 * @event Node#error
 * @param {Error} error The emitted error
 */
/**
 * Emitted when a Socket has sent a message to this Node.
 * @event Node#message
 * @param {NodeMessage} message The received message
 */
