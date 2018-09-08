const { Server, Socket } = require('net');
const NodeServerClient = require('./NodeServerClient');
const NodeSocket = require('./NodeSocket');

class NodeServer {

	/**
	 * @typedef {Object} SendOptions
	 * @property {boolean} [receptive = false] Whether this broadcast should wait for responses or not
	 * @property {number} [timeout = Infinity] The timeout, Infinity or -1 for no timeout
	 */

	/**
	 * @typedef {SendOptions} BroadcastOptions
	 * @property {RegExp} [filter] The filter for the broadcast
	 */

	constructor(node) {
		Object.defineProperties(this, {
			node: { value: null, writable: true },
			server: { value: null, writable: true },
			clients: { value: null, writable: true }
		});

		/**
		 * The Node instance that manages this
		 * @type {Node}
		 */
		this.node = node;
		this.server = null;
		this.clients = new Map();
	}

	/**
	 * The name of this node
	 * @type {string}
	 */
	get name() {
		return this.node.name;
	}

	/**
	 * Get a NodeSocket by its name or Socket
	 * @param {string|Socket|NodeServerClient|NodeSocket} name The NodeSocket to get
	 * @returns {NodeServerClient|NodeSocket}
	 */
	get(name) {
		if (typeof name === 'string') return this.clients.get(name) || null;
		if (name instanceof NodeServerClient || name instanceof NodeSocket) return name;
		if (name instanceof Socket) {
			for (const client of this.clients.values()) if (client.socket === name) return client;
			return null;
		}

		throw new TypeError(`Expected a string or an instance of Socket`);
	}

	/**
	 * Check if a NodeSocket exists by its name of Socket
	 * @param {string|Socket|NodeServerClient|NodeSocket} name The NodeSocket to get
	 * @returns {boolean}
	 */
	has(name) {
		return Boolean(this.get(name));
	}

	/**
	 * Broadcast a message to all connected sockets from this server
	 * @param {*} data The data to send to other sockets
	 * @param {BroadcastOptions} [options={}] The options for this broadcast
	 * @returns {Promise<Array<*>>}
	 */
	broadcast(data, { receptive, timeout, filter } = {}) {
		if (filter && !(filter instanceof RegExp)) throw new TypeError(`filter must be a RegExp instance.`);

		const test = filter ? (name) => filter.test(name) : () => true;
		const promises = [];
		for (const [name, client] of this.clients.entries()) if (test(name)) promises.push(client.send(data, { receptive, timeout }));
		return Promise.all(promises);
	}

	/**
	 * Send a message to a connected socket
	 * @param {string|Socket|NodeSocket} name The label name of the socket to send the message to
	 * @param {*} data The data to send to the socket
	 * @param {SendOptions} [options={}] The options for this message
	 * @returns {Promise<*>}
	 */
	sendTo(name, data, options) {
		const nodeSocket = this.get(name);
		if (!nodeSocket) return Promise.reject(new Error('Failed to send to the socket: It is not connected to this Node.'));
		return nodeSocket.send(data, options);
	}

	/**
	 * Create a server for this Node instance.
	 * @param {...*} options The options to pass to net.Server#listen
	 * @returns {Promise<void>}
	 */
	async connect(...options) {
		if (this.server) throw new Error('There is already a server.');

		this.server = new Server();
		await new Promise((resolve, reject) => {
			const onListening = () => resolve(cleanup(this));
			const onClose = () => reject(cleanup(this));
			const onError = (error) => reject(cleanup(error));
			const cleanup = (value) => {
				this.server.off('listening', onListening);
				this.server.off('close', onClose);
				this.server.off('error', onError);
				return value;
			};
			this.server
				.on('listening', onListening)
				.on('close', onClose)
				.on('error', onError);

			this.server.listen(...options);
		});

		this.node.emit('server.ready', this);
		this.server
			.on('connection', this._onConnection.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));
	}

	/**
	 * Disconnect the server and rejects all current messages
	 * @returns {boolean}
	 */
	disconnect() {
		if (!this.server) return false;

		this.server.close();
		this.server = null;
		this.node.server = null;
		this.node.emit('server.destroy', this);

		const rejectError = new Error('Server has been disconnected.');
		for (const socket of this.clients.values())
			for (const element of socket.queue.values()) element.reject(rejectError);

		return true;
	}

	_onConnection(socket) {
		new NodeServerClient(this.node, this, socket).setup();
	}

	_onError(error) {
		this.node.emit('error', error, this);
	}

	_onClose() {
		this.disconnect();
	}

}

module.exports = NodeServer;
