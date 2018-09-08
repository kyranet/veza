const { EventEmitter } = require('events');
const NodeSocket = require('./Structures/NodeSocket');
const NodeServer = require('./Structures/NodeServer');

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
			server: { value: null, writable: true },
			servers: { value: null, writable: true }
		});

		/**
		 * The server for this Node, if serving
		 * @type {?NodeServer}
		 * @private
		 */
		this.server = null;

		/**
		 * The servers this Node is connected to
		 * @type {Map<string, NodeSocket>}
		 * @private
		 */
		this.servers = new Map();
	}

	/**
	 * Send a message to a connected socket
	 * @param {string} name The label name of the socket to send the message to
	 * @param {*} data The data to send to the socket
	 * @param {SendOptions} [options={}] The options for this message
	 * @returns {Promise<*>}
	 */
	sendTo(name, data, options) {
		const socket = this.servers.get(name);
		if (!socket) return Promise.reject(new Error(`The socket ${name} is not available or not connected to this Node.`));
		return socket.send(data, options);
	}

	/**
	 * Connect to a socket
	 * @param {string} name The label name for the socket
	 * @param {...*} options The options to pass to connect
	 * @returns {Promise<NodeSocket>}
	 */
	connectTo(name, ...options) {
		if (this.servers.has(name)) return Promise.reject(new Error('There is already a socket.'));
		const client = new NodeSocket(this, this.name);
		this.servers.set(name, client);

		return client.connect(...options);
	}

	/**
	 * Disconnect from a socket, this will also reject all messages
	 * @param {string} name The label name of the socket to disconnect
	 * @returns {Promise<boolean>}
	 */
	disconnectFrom(name) {
		const client = this.servers.get(name);
		if (!client) return Promise.reject(new Error(`The socket ${name} is not connected to this one.`));
		return Promise.resolve(client.disconnect());
	}

	/**
	 * Broadcast a message to all connected sockets from this server
	 * @param {*} data The data to send to other sockets
	 * @param {BroadcastOptions} [options={}] The options for this broadcast
	 * @returns {Promise<Array<*>>}
	 */
	broadcast(data, options) {
		return this.server ? this.server.broadcast(data, options) : Promise.resolve([]);
	}

	/**
	 * Create a server for this Node instance.
	 * @param {...*} options The options to pass to net.Server#listen
	 * @returns {Promise<this>}
	 */
	serve(...options) {
		if (this.server) throw new Error('There is already a server running.');

		this.server = new NodeServer(this);
		return this.server.connect(...options)
			.then(() => this);
	}

}

module.exports = Node;

/**
 * Emitted on a successful connection to a Socket
 * @event Node#client.connect
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted on a a Socket destroy
 * @event Node#client.destroy
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted on a successful disconnection from a Socket
 * @event Node#client.disconnect
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted on a successful identification from a Socket
 * @event Node#client.identify
 * @param {NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted when a Socket is ready for usage
 * @event Node#client.ready
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted when a node emits an error
 * @event Node#error
 * @param {Error} error The omitted error
 * @param {NodeServer | NodeServerClient | NodeSocket} node The client that manages the socket
 */
/**
 * Emitted when a node receives a message
 * @event Node#message
 * @param {NodeMessage} message The message received
 */
/**
 * Emitted when a node receives a message
 * @event Node#raw
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 * @param {Buffer} buffer The raw data received from the socket
 */
/**
 * Emitted when a server destroys
 * @event Node#server.destroy
 * @param {ServerNode} server The client that manages the socket
 */
/**
 * Emitted when a server is ready
 * @event Node#server.ready
 * @param {ServerNode} server The client that manages the socket
 */
