const { kPing, kIdentify, STATUS } = require('../../Util/Constants');
const { _packMessage } = require('../../Util/Transform');
const { createID } = require('../../Util/Header');
const Queue = require('../Queue');
const Base = require('./Base');
const noop = () => { }; // eslint-disable-line no-empty-function

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
	 * @param {Object} [options={}] The options for this broadcast
	 * @param {boolean} [options.receptive] Whether this message should wait for a response or not
	 * @param {number} [options.timeout] The timeout, Infinity or -1 for no timeout
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
					? setTimeout(() => send(reject, new Error('TIMEOUT_ERROR'), true), timeout)
					: null;
				const send = (fn, response, fromTimer) => {
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
			this.socket.write(_packMessage(id, this.name, false));
			return null;
		}
		return Object.freeze(Object.defineProperties({
			data,
			from: this.name,
			receptive,
			reply: receptive ? (content) => {
				this.socket.write(_packMessage(id, content, false));
			} : noop
		}, { id: { value: id } }));
	}

}

module.exports = SocketHandler;
