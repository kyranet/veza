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

	sendTo(name, data, receptive) {
		const socket = this.servers.get(name);
		if (!socket) throw new Error(`The socket ${name} is not available or not connected to this Node.`);
		return socket.send(data, receptive);
	}

	/**
	 * Connect to a socket
	 * @param {string} name The label name for the socket
	 * @param {...*} options The options to pass to connect
	 * @returns {Promise<NodeSocket>}
	 */
	connectTo(name, ...options) {
		if (this.servers.has(name)) return Promise.reject(new Error('There is already a socket.'));
		const client = new NodeSocket(this, name);
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

	serve(...options) {
		this.server = new NodeServer(this);
		return this.server.connect(...options)
			.then(() => this);
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
