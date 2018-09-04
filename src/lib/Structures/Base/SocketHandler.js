const { kPing, kIdentify, createID } = require('../../Util/Constants');
const { _packMessage } = require('../../Util/Transform');
const Queue = require('../Queue');
const Base = require('./Base');
const noop = () => { }; // eslint-disable-line no-empty-function

class SocketHandler extends Base {

	constructor(node, name, socket = null) {
		super(node, name);
		this.socket = socket;
		this.queue = new Queue(this);
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

		this.socket.destroy();
		this.socket.removeAllListeners();

		if (this.queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.queue.values()) element.reject(rejectError);
		}

		return true;
	}

	ping() {
		const now = Date.now();
		return this.send(kPing).then(future => future - now);
	}

	on(event, cb) {
		if (this.socket) this.socket.on(event, cb);
		return this;
	}

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
