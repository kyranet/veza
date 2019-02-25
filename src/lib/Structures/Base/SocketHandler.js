const { kPing, kIdentify, kInvalidMessage, STATUS } = require('../../Util/Constants');
const { _packMessage } = require('../../Util/Transform');
const { createID } = require('../../Util/Header');
const NodeMessage = require('../NodeMessage');
const Queue = require('../Queue');
const Base = require('./Base');

class SocketHandler extends Base {

	constructor(node, name, socket = null) {
		super(node, name);
		Object.defineProperties(this, {
			socket: { value: null, writable: true },
			queue: { value: null, writable: true }
		});

		this.socket = socket;
		this.queue = new Queue(this);

		/**
		 * The status of this client
		 * @type {number}
		 */
		this.status = STATUS.CONNECTING;
	}

	/**
	 * Send a message to a connected socket
	 * @param {*} data The data to send to the socket
	 * @param {SendOptions} [options={}] The options for this message
	 * @returns {Promise<*>}
	 */
	send(data, { receptive = true, timeout = Infinity } = {}) {
		if (!this.socket) return Promise.reject(new Error('This NodeSocket is not connected to a socket.'));

		return new Promise((resolve, reject) => {
			const id = createID();
			try {
				const message = _packMessage(id, data, receptive);
				this.socket.write(message);

				if (!receptive) {
					resolve(undefined);
					return;
				}

				const timer = timeout !== Infinity && timeout !== -1
					? setTimeout(() => send(reject, true, new Error('TIMEOUT_ERROR')), timeout)
					: null;
				const send = (fn, fromTimer, response) => {
					if (timer && !fromTimer) clearTimeout(timer);
					this.queue.delete(id);
					return fn(response);
				};
				this.queue.set(id, {
					resolve: send.bind(null, resolve, false),
					reject: send.bind(null, reject, false)
				});
			} catch (error) {
				const entry = this.queue.get(id);
				if (entry) entry.reject(error);
				else reject(error);
			}
		});
	}

	/**
	 * Disconnect from the socket, this will also reject all messages
	 * @returns {boolean}
	 */
	disconnect() {
		if (!this.socket) return false;

		this.socket.destroy();
		this.socket.removeAllListeners();

		if (this.queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.queue.values()) element.reject(rejectError);
		}

		this.status = STATUS.DISCONNECTED;

		return true;
	}

	/**
	 * Measure the latency between the server and this client
	 * @returns {Promise<number>}
	 */
	ping() {
		const now = Date.now();
		return this.send(kPing).then((future) => future - now);
	}

	/**
	 * Add a new event listener on this client's socket
	 * @param {string} event The event name
	 * @param {Function} cb The callback to register
	 * @returns {this}
	 * @chainable
	 */
	on(event, cb) {
		if (this.socket) this.socket.on(event, cb);
		return this;
	}

	/**
	 * Add a new event listener on this client's socket
	 * @param {string} event The event name
	 * @param {Function} cb The callback to register
	 * @returns {this}
	 * @chainable
	 */
	once(event, cb) {
		if (this.socket) this.socket.once(event, cb);
		return this;
	}

	/**
	 * Remove an event listener on this client's socket
	 * @param {string} event The event name
	 * @param {Function} cb The callback to unregister
	 * @returns {this}
	 * @chainable
	 */
	off(event, cb) {
		if (this.socket) this.socket.off(event, cb);
		return this;
	}

	_onData(data) {
		this.node.emit('raw', this, data);
		for (const processed of this.queue.process(data)) {
			if (processed === kInvalidMessage) {
				this.node.emit('error', new Error('Failed to process message, destroying Socket.'), this);
				this.disconnect();
				break;
			}
			const message = this._handleMessage(processed);
			if (message === null) continue;
			this.node.emit('message', message);
		}
	}

	_handleMessage({ id, receptive, data }) {
		if (this.queue.has(id)) {
			this.queue.get(id).resolve(data);
			return null;
		}
		if (data === kPing) {
			this.socket.write(_packMessage(id, Date.now(), false));
			return null;
		}
		if (data === kIdentify) {
			this.socket.write(_packMessage(id, this.node.name, false));
			return null;
		}
		return new NodeMessage(this, id, receptive, data).freeze();
	}

}

module.exports = SocketHandler;
