const { Socket } = require('net');
const Queue = require('./Queue');
const { _packMessage } = require('../Util/Transform');

const {
	// Symbols
	kPing, kIdentify,

	// Helpers
	createID
} = require('../Util/Constants');
const noop = () => { }; // eslint-disable-line no-empty-function

class NodeSocket {

	constructor(node, name) {
		this.node = node;
		this.name = name;
		this.socket = null;
		this.retriesRemaining = node.maxRetries;
		this.queue = new Queue(this);

		Object.defineProperty(this, '_reconnectionTimeout', { writable: true });
		this._reconnectionTimeout = null;
	}

	connect(...options) {
		if (!this.socket) this.socket = new Socket();

		return new Promise((resolve, reject) => {
			this.socket
				.on('connect', () => {
					this.retriesRemaining = this.node.maxRetries;
					if (this._reconnectionTimeout) {
						clearTimeout(this._reconnectionTimeout);
						this._reconnectionTimeout = null;
					}
					this.node.emit('client.connect', this);
					resolve(this);
				})
				.on('close', () => {
					this.node.emit('client.disconnect', this);
					this._reconnectionTimeout = setTimeout(() => {
						if (this.retriesRemaining === 0) {
							this.disconnect();
							reject(this.socket);
						} else {
							this.retriesRemaining--;
							// @ts-ignore
							this.socket.connect(...options);
						}
					}, this.node.retryTime);
				})
				.on('error', (error) => this.node.emit('error', error))
				.on('data', (data) => {
					this.node.emit('raw', this, data);
					for (const processed of this.queue.process(data))
						this._handleMessage(processed);
				});
		});
	}

	send(data, receptive = true) {
		if (!this.socket) return Promise.reject(new Error('This NodeSocket is not connected to a socket.'));
		if (!this.socket.writable) return Promise.reject(new Error('The Socket is not writable.'));

		return new Promise((resolve, reject) => {
			const id = createID();
			try {
				const message = _packMessage(id, data, receptive);
				this.socket.write(message);

				if (!receptive) {
					resolve(undefined);
					return;
				}

				const send = (fn, response) => {
					this.queue.delete(id);
					return fn(response);
				};
				this.queue.set(id, {
					resolve: send.bind(null, resolve),
					reject: send.bind(null, reject)
				});
			} catch (error) {
				const entry = this.queue.get(id);
				if (entry) entry.reject(error);
				else reject(error);
			}
		});
	}

	disconnect() {
		if (!this.socket) return false;

		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}

		this.socket.destroy();
		this.socket.removeAllListeners();

		if (this.queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.queue.values()) element.reject(rejectError);
		}

		this.node.clients.delete(this.name);
		this.node.emit('client.destroy', this);

		return true;
	}

	ping() {
		const now = Date.now();
		return this.send(kPing).then(future => future - now);
	}

	on(event, cb) {
		return this.socket ? this.socket.on(event, cb) : null;
	}

	off(event, cb) {
		return this.socket ? this.socket.off(event, cb) : null;
	}

	_handleMessage({ id, receptive, data }) {
		if (this.queue.has(id)) {
			this.queue.get(id).resolve(data);
			return;
		}
		if (data === kPing) {
			this.socket.write(_packMessage(id, Date.now(), false));
			return;
		}
		if (data === kIdentify) {
			this.socket.write(_packMessage(id, this.name, false));
			return;
		}
		const message = Object.freeze(Object.defineProperties({
			data,
			from: this.name,
			receptive,
			reply: receptive ? (content) => {
				this.socket.write(_packMessage(id, content, false));
			} : noop
		}, { id: { value: id } }));
		this.node.emit('message', message);
	}

}

module.exports = NodeSocket;
