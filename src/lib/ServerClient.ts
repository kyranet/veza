import { SocketHandler } from './Structures/Base/SocketHandler';
import { SocketStatus } from './Util/Constants';
import { Socket } from 'net';
import { Server } from './Server';

export class ServerClient extends SocketHandler {

	public readonly server: Server;

	public constructor(server: Server, socket: Socket) {
		super(null, socket);
		this.server = server;
	}

	public async setup() {
		this.status = SocketStatus.Connected;
		this.socket!
			.on('data', this._onData.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));

		try {
			const sName = await this.send(this.server.name);
			this.status = SocketStatus.Ready;
			this.name = sName;

			// Disconnect if a previous socket existed.
			const existing = this.server.clients.get(sName);
			if (existing) {
				existing.disconnect();
			}

			// Add this socket to the clients.
			this.server.clients.set(sName, this);
			this.server.emit('connect', this);
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
		}

		return true;
	}

	private _onError(error: any) {
		/* istanbul ignore next: Hard to reproduce in Azure. */
		this.server.emit('error', error);
	}

	private _onClose() {
		this.status = SocketStatus.Disconnected;
		this.server.emit('disconnect', this);
		this.disconnect();
	}

}
