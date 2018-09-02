const { EventEmitter } = require('events');
const { Socket, Server } = require('net');
const NodeSocket = require('./Structures/NodeSocket');

class Node extends EventEmitter {

	/**
	 * @typedef {Object} NodeOptions
	 * @property {number} [maxRetries = Infinity]
	 * @property {number} [retryTime = 200]
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
			clients: { value: null, writable: true },
			server: { value: null, writable: true },
			servers: { value: null, writable: true }
		});

		/**
		 * The server for this Node, if serving
		 * @type {?Server}
		 * @private
		 */
		this.server = null;

		/**
		 * The sockets connected to this Node
		 * @type {Map<string, NodeSocket>}
		 * @private
		 */
		this.clients = new Map();

		/**
		 * The servers this Node is connected to
		 * @type {Map<string, NodeSocket>}
		 * @private
		 */
		this.servers = new Map();
	}

	/**
	 * Get a NodeSocket by its name or Socket
	 * @param {string|Socket|NodeSocket} name The NodeSocket to get
	 * @returns {NodeSocket}
	 */
	get(name) {
		if (typeof name === 'string') return this.clients.get(name) || this.servers.get(name) || null;
		if (name instanceof NodeSocket) return name;
		if (name instanceof Socket) {
			for (const client of this.clients.values())
				if (client.socket === name) return client;
			for (const server of this.servers.values())
				if (server.socket === name) return server;
			return null;
		}

		throw new TypeError(`Expected a string or an instance of Socket`);
	}

	has(name) {
		return Boolean(this.get(name));
	}

	/**
	 * Create a server for this Node instance.
	 * @param {...*} options The options to pass to net.Server#listen
	 * @returns {this}
	 */
	serve(...options) {
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
					this.servers.set(socketName, socket);
					this.emit('connection', socketName, socket);
				});
			})
			.on('close', () => {
				this.server.removeAllListeners();
				this.server = null;

				for (const socket of this.servers.values()) socket.destroy();
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
		return Promise.all([...this.servers.values()].map(socket => this.sendTo(socket, data, receptive)));
	}

	/**
	 * Send a message to a connected socket
	 * @param {string|Socket} name The label name of the socket to send the message to
	 * @param {*} data The data to send to the socket
	 * @param {boolean} receptive Whether this message should wait for a response or not
	 * @returns {Promise<*>}
	 */
	sendTo(name, data, receptive = true) {
		const nodeSocket = this.get(name);
		if (!nodeSocket) return Promise.reject(new Error('Failed to send to the socket: It is not connected to this Node.'));
		return nodeSocket.send(data, receptive);
	}

	/**
	 * Connect to a socket
	 * @param {string} name The label name for the socket
	 * @param {...*} options The options to pass to connect
	 * @returns {Promise<NodeSocket>}
	 */
	connectTo(name, ...options) {
		if (this.clients.has(name)) return Promise.reject(new Error('There is already a socket.'));
		const client = new NodeSocket(this, name);
		this.clients.set(name, client);

		return client.connect(...options);
	}

	/**
	 * Disconnect from a socket, this will also reject all messages
	 * @param {string} name The label name of the socket to disconnect
	 * @returns {Promise<boolean>}
	 */
	disconnectFrom(name) {
		const client = this.clients.get(name);
		if (!client) return Promise.reject(new Error(`The socket ${name} is not connected to this one.`));
		return Promise.resolve(client.disconnect());
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
			this.servers.delete(socketName);
			this.emit('socketClose', socketName);
		} else {
			this.clients.delete(socketName);
			this.emit('destroy', socketName, socket);
		}
	}

}

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
