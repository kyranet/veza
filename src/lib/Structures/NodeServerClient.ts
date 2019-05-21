import { SocketHandler } from './Base/SocketHandler';
import { kIdentify, SocketStatus } from '../Util/Constants';
import { NodeServer } from './NodeServer';
import { Node } from '../Node';
import { Socket } from 'net';

export class NodeServerClient extends SocketHandler {

	public readonly server!: NodeServer;

	public constructor(node: Node, server: NodeServer, socket: Socket) {
		super(node, null, socket);
		Object.defineProperties(this, {
			server: { value: server }
		});
	}

	public async setup() {
		this.socket!
			.on('data', this._onData.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));

		try {
			const sName = await this.send(kIdentify);
			this.status = SocketStatus.Ready;
			this.name = sName;

			// Disconnect if a previous socket existed.
			const existing = this.server.clients.get(sName);
			if (existing) {
				existing.disconnect();
			}

			// Add this socket to the clients.
			this.server.clients.set(sName, this);
			this.node.emit('client.identify', this);
		} catch {
			this.disconnect();
		}
	}

	/**
	 * Disconnect from the socket, this will also reject all messages
	 */
	public disconnect(): boolean {
		if (!super.disconnect()) return false;
		if (this.name) {
			this.server.clients.delete(this.name);
			this.node.emit('client.destroy', this);
		}

		return true;
	}

	private _onError(error: any) {
		const { code } = error;
		if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
			if (this.status !== SocketStatus.Disconnected) return;
			this.status = SocketStatus.Disconnected;
			this.node.emit('client.disconnect', this);
		} else {
			this.node.emit('error', error, this);
		}
	}

	private _onClose() {
		this.disconnect();
	}

}

export default NodeServerClient;
