const SocketHandler = require('./Base/SocketHandler');
const { kIdentify } = require('../Util/Constants');

class NodeServerClient extends SocketHandler {

	constructor(node, server, socket) {
		super(node, null, socket);
		this.server = server;
		this.status = STATUS.CONNECTING;
	}

	setup() {
		this.socket
			.on('data', this._onData.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));

		this.send(kIdentify).then((sName) => {
			this.status = STATUS.READY;
			this.name = sName;
			this.server.clients.set(this.name, this);
			this.node.emit('client.identify', this);
		}).catch(this.disconnect.bind(this));
	}

	disconnect() {
		if (!super.disconnect()) return false;
		if (this.name) {
			this.server.clients.delete(this.name);
			this.node.emit('client.destroy', this);
		}
		this.status = STATUS.DISCONNECTED;

		return true;
	}

	_onData(data) {
		this.node.emit('raw', this, data);
		for (const processed of this.queue.process(data)) {
			const message = this._handleMessage(processed);
			if (message === null) continue;
			this.node.emit('message', message);
		}
	}

	_onError(error) {
		const { code } = error;
		if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
			if (this.status !== STATUS.DISCONNECTED) return;
			this.status = STATUS.DISCONNECTED;
			this.node.emit('client.disconnect', this);
		} else {
			this.node.emit('error', error, this);
		}
	}

	_onClose() {
		this.disconnect();
	}

}

const STATUS = Object.freeze({
	READY: 0,
	CONNECTING: 1,
	DISCONNECTED: 2
});

module.exports = NodeServerClient;
