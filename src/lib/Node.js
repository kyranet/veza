const { EventEmitter } = require('events');
const net = require('net');

const kSeparatorHeader = '|'.charCodeAt(0);
const kPing = Symbol('IPC-Ping');
const kIdentify = Symbol('IPC-Identify');

class Node extends EventEmitter {

	constructor({ maxRetries = 5, retryTime = 200 } = {}) {
		super();
		this.maxRetries = maxRetries;
		this.retryTime = retryTime;

		Object.defineProperties(this, {
			server: { value: null, writable: true },
			sockets: { value: new Map() },
			_queue: { value: new Map() },
			_serverNodes: { value: new Map() }
		});
	}

	serve(name, ...options) {
		if (this.server) throw new Error('There is already a server.');
		this.server = new net.Server()
			.on('connection', (socket) => {
				socket.on('data', (data) => this._onDataMessage(name, socket, data));
				this.sendTo(socket, kIdentify)
					.then(sName => {
						this.sockets.set(sName, socket);
						return sName;
					})
					.then(this.emit.bind(this, 'connection', socket));
			})
			.on('close', () => {
				this.server.removeAllListeners();
				this.server = null;

				const rejectError = new Error('Server has been disconnected.');
				for (const element of this._queue.values()) element.reject(rejectError);
			})
			.on('error', this.emit.bind(this, 'error'))
			.on('listening', this.emit.bind(this, 'listening'));
		this.server.listen(...options);
	}

	sendTo(name, data) {
		const socket = name instanceof net.Socket ? name : this.sockets.get(name);
		if (!socket) return Promise.reject(new Error('Failed to send to the socket.'));
		if (!socket.writable) return Promise.reject(new Error('The Socket is not writable.'));

		return new Promise(async (resolve, reject) => {
			try {
				const id = Node.createID();
				const message = Node.packMessage(id, data, true);
				console.log(id, message);
				socket.write(message);

				const send = (fn, response) => {
					this._queue.delete(id);
					return fn(response);
				};
				return this._queue.set(id, { resolve: send.bind(null, resolve), reject: send.bind(null, reject) });
			} catch (error) {
				return reject(error);
			}
		});
	}

	pingTo(name) {
		const now = Date.now();
		return this.sendTo(name, kPing).then(future => future - now);
	}

	/**
	 * Connect to a socket
	 * @param {string} name The label name for the socket
	 * @param {...*} options The options to pass to connect
	 * @returns {Promise<net.Socket>}
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
			node.socket = new net.Socket()
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
							node.socket.destroy();
							node.socket.removeAllListeners();
							this.sockets.delete(name);
							this.emit('destroy', name, node.socket);
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

	_onDataMessage(name, socket, buffer) {
		const [id, receptive, data] = Node.unPackMessage(buffer);
		if (this._queue.has(id)) {
			this._queue.get(id).resolve(data);
			return;
		}
		if (data === kPing) {
			socket.write(Node.packMessage(id, Date.now(), false));
			return;
		}
		if (data === kIdentify) {
			socket.write(Node.packMessage(id, name, false));
			return;
		}
		const message = Object.defineProperties({}, {
			id: { value: id },
			data: { value: data, enumerable: true },
			from: { value: name, enumerable: true },
			receptive: { value: receptive !== '0', enumerable: true },
			reply: { value: (content) => receptive ? socket.write(Node.packMessage(id, content, false)) : false }
		});
		this.emit('message', message);
	}

	static unPackMessage(buffer) {
		const kIndex = buffer.indexOf(kSeparatorHeader);
		const [id, type, _receptive] = buffer.toString('utf8', 0, kIndex - 1).split(' ');
		const receptive = _receptive !== '0';
		if (type === '5') return [id, receptive, kPing];
		if (type === '6') return [id, receptive, kIdentify];
		if (type === '3') return [id, receptive, buffer.slice(kIndex + 2)];
		if (type === '0') return [id, receptive, null];

		const kString = buffer.toString('utf8', kIndex + 2);
		if (type === '1') return [id, receptive, kString];
		if (type === '2') return [id, receptive, Number(kString)];
		if (type === '4') return [id, receptive, JSON.parse(kString)];
		throw new Error(`Failed to unpack message. Got type ${type}, expected an integer between 0 and 6.`);
	}

	static packMessage(id, message, receptive = true) {
		receptive = Number(receptive);
		if (message === kPing) return Buffer.from(`${id} 5 0 | ${Date.now()}`);
		if (message === kIdentify) return Buffer.from(`${id} 6 0 | null`);
		let type;
		const tMessage = typeof message;
		if (tMessage === 'string')
			return Buffer.from(`${id} 1 ${receptive} | ${message}`);

		if (tMessage === 'number')
			return Buffer.from(`${id} 2 ${receptive} | ${message}`);

		if (tMessage === 'object') {
			if (message === null)
				return Buffer.from(`${id} 0 ${receptive} | null`);

			if (Buffer.isBuffer(message))
				return Buffer.concat(Buffer.from(`${id} 3 ${receptive} | `), message);

			return Buffer.from(`${id} 4 ${receptive} | ${JSON.stringify(message)}`);
		}

		return Buffer.from(`${id} 1 ${receptive} | ${type}`);
	}

	static createID() {
		return Date.now().toString(36) + String.fromCharCode(((i++ < 26 || (i = 0)) % 26) + 97);
	}

}

let i = 0;

module.exports = Node;
