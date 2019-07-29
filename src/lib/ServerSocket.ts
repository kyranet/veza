import { SocketHandler } from './Structures/Base/SocketHandler';
import { Socket } from 'net';
import { Server } from './Server';
import { makeError } from './Structures/MessageError';
import { NetworkError, VCLOSE } from './Util/Shared';

export enum ServerClientStatus {
	Connected,
	Connecting,
	Disconnected
}

export class ServerSocket extends SocketHandler {

	public readonly server: Server;
	public status = ServerClientStatus.Disconnected;

	public constructor(server: Server, socket: Socket) {
		super(null, socket);
		this.server = server;
	}

	public async setup() {
		this.status = ServerClientStatus.Connecting;
		this.socket!
			.on('data', this._onData.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));

		try {
			const sName = await this.send(this.server.name);

			// sName must never be anything that is not a string
			/* istanbul ignore next: Will do other day. */
			if (typeof sName !== 'string') {
				return this.disconnect();
			}
			this.status = ServerClientStatus.Connected;
			this.name = sName;

			// Disconnect if a previous socket existed.
			const existing = this.server.clients.get(sName);
			if (existing) {
				existing.disconnect(true);
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
	public disconnect(close?: boolean) {
		if (this.status === ServerClientStatus.Disconnected) return false;

		if (close) this.socket.end(VCLOSE);
		this.socket.destroy();
		if (this.queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.queue.values()) element.reject(rejectError);
		}

		this.status = ServerClientStatus.Disconnected;
		if (this.name) {
			this.server.clients.delete(this.name);
		}

		this.socket.removeAllListeners();
		this.server.emit('disconnect', this);

		return true;
	}

	protected _onData(data: Uint8Array) {
		this.server.emit('raw', data, this);
		for (const processed of this.queue.process(data)) {
			if (processed.id === null) {
				/* istanbul ignore else: Hard to reproduce, this is a safe-guard. */
				if (this.status === ServerClientStatus.Connected) {
					this.server.emit('error', makeError('Failed to parse message', processed.data), this);
				} else {
					this.server.emit('error', makeError('Failed to process message during connection, calling disconnect', processed.data), this);
					this.disconnect();
				}
			} else {
				const message = this._handleMessage(processed);
				if (message) this.server.emit('message', message, this);
			}
		}
	}

	private _onError(error: NetworkError) {
		/* istanbul ignore next: Hard to reproduce in Azure. */
		this.server.emit('error', error, this);
	}

	private _onClose() {
		this.disconnect();
	}

}
