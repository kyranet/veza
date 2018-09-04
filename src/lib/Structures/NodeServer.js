const { Server, Socket } = require('net');
const NodeServerClient = require('./NodeServerClient');
const NodeSocket = require('./NodeSocket');

class NodeServer {

	constructor(node) {
		this.node = node;
		this.server = null;
		this.clients = new Map();
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

	has(name) {
		return Boolean(this.get(name));
	}

	/**
	 * Broadcast a message to all connected sockets from this server
	 * @param {*} data The data to send to other sockets
	 * @param {Object} [options={}] The options for this broadcast
	 * @param {boolean} [options.receptive] Whether this broadcast should wait for responses or not
	 * @param {RegExp} [options.filter] The filter for the broadcast
	 * @returns {Promise<Array<*>>}
	 */
	broadcast(data, { receptive, filter } = {}) {
		if (!filter) return Promise.all([...this.clients.values()].map(socket => this.sendTo(socket, data, receptive)));
		if (!(filter instanceof RegExp)) throw new TypeError(`filter must be a RegExp instance.`);

		const promises = [];
		for (const [name, client] of this.clients) if (filter.test(name)) promises.push(client.send(data, receptive));
		return Promise.all(promises);
	}

	/**
	 * Send a message to a connected socket
	 * @param {string|Socket|NodeSocket} name The label name of the socket to send the message to
	 * @param {*} data The data to send to the socket
	 * @param {boolean} receptive Whether this message should wait for a response or not
	 * @returns {Promise<*>}
	 */
	sendTo(name, data, receptive = true) {
		const nodeSocket = this.get(name);
		if (!nodeSocket) return Promise.reject(new Error('Failed to send to the socket: It is not connected to this Node.'));
		return nodeSocket.send(data, receptive);
	}

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
