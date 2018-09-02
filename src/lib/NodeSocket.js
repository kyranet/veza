const { Socket } = require('net');

class NodeSocket {

	constructor(node, name) {
		this.node = node;
		this.name = name;
		this.socket = null;
		this.retriesRemaining = node.maxRetries;

		Object.defineProperty(this, '_reconnectionTimeout', { writable: true });
		this._reconnectionTimeout = null;
	}

	connect(...options) {
		if (!this.socket) this.socket = new Socket();

		return new Promise((resolve, reject) => {
			this.socket
				.on('connect', () => {
					this.retriesRemaining = this.node.maxRetries;
					if (this._reconnectionTimeout) clearTimeout(this._reconnectionTimeout);
					this.node.emit('connect', this.name, this.socket);
					resolve();
				})
				.on('close', () => {
					this.node.emit('disconnect', this.name, this.socket);
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
				.on('data', (data) => this.node._onDataMessage(this.name, this.socket, data));
		});
	}

	disconnect() {
		if (!this.socket) return false;

		this.socket.destroy();
		this.socket.removeAllListeners();

		if (this.node._queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.node._queue.values()) if (element.socket === this.socket) element.reject(rejectError);
		}

		this.node.clients.delete(this.name);
		this.node.emit('client.destroy', this.name, this.socket);

		return true;
	}

}

module.exports = NodeSocket;
