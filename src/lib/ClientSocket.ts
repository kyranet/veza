import { deserialize, serialize } from 'binarytf';
import { Socket as NetSocket, SocketConnectOpts } from 'net';
import type { Client } from './Client';
import { SocketHandler } from './Structures/Base/SocketHandler';
import { makeError } from './Structures/MessageError';
import { createFromID, readID } from './Util/Header';
import { receivedVClose } from './Util/Shared';

/**
 * The connection status of this socket.
 * @since 0.7.0
 */
export enum ClientSocketStatus {
	/**
	 * The ready status, the socket has successfully connected and identified with the server.
	 * @since 0.7.0
	 */
	Ready,
	/**
	 * The connected status, the socket has successfully connected, but has not identified yet.
	 * @since 0.7.0
	 */
	Connected,
	/**
	 * The connecting status, the socket is not ready to operate but is attempting to connect.
	 * @since 0.7.0
	 */
	Connecting,
	/**
	 * The disconnected status, the socket is idle and not ready to operate.
	 * @since 0.7.0
	 */
	Disconnected
}

export class ClientSocket extends SocketHandler {
	/**
	 * The socket's client
	 * @since 0.7.0
	 */
	public readonly client: Client;
	/**
	 * The socket's status
	 * @since 0.7.0
	 */
	public status = ClientSocketStatus.Disconnected;
	/**
	 * How many reconnection attempts this socket has remaining.
	 * @since 0.7.0
	 */
	public retriesRemaining: number;
	private _expectClosing = false;
	private _reconnectionTimeout!: NodeJS.Timer | null;

	public constructor(client: Client) {
		super(null, new NetSocket());
		this.client = client;
		this.retriesRemaining = client.maximumRetries === -1 ? Infinity : client.maximumRetries;

		Object.defineProperties(this, {
			_reconnectionTimeout: { value: null, writable: true }
		});
	}

	private get canReconnect() {
		return this.client.retryTime !== -1 && this.retriesRemaining > 0 && this.status !== ClientSocketStatus.Disconnected;
	}

	/**
	 * Connect to the socket.
	 * @since 0.0.1
	 * @param options The options to pass to connect.
	 * @see https://nodejs.org/dist/latest/docs/api/net.html#net_socket_connect
	 */
	public async connect(options: SocketConnectOpts, connectionListener?: () => void): Promise<this>;
	public async connect(port: number, host: string, connectionListener?: () => void): Promise<this>;
	public async connect(port: number, connectionListener?: () => void): Promise<this>;
	public async connect(path: string, connectionListener?: () => void): Promise<this>;
	public async connect(...options: [any, any?, any?]): Promise<this> {
		await this._connect(...options);
		await this._handshake();

		this.client.servers.set(this.name!, this);
		this.status = ClientSocketStatus.Ready;
		this.client.emit('ready', this);
		this.socket!.on('data', this._onData.bind(this))
			.on('connect', this._onConnect.bind(this))
			.on('close', () => this._onClose(...options))
			.on('error', this._onError.bind(this));

		return this;
	}

	/**
	 * Disconnect from the socket, this will also reject all messages.
	 * @since 0.0.1
	 */
	public disconnect() {
		if (this.status === ClientSocketStatus.Disconnected) return false;

		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}

		this.status = ClientSocketStatus.Disconnected;
		this.client.servers.delete(this.name!);
		this.socket.destroy();

		if (this.queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.queue.values()) element.reject(rejectError);
		}

		this.client.emit('disconnect', this);
		return true;
	}

	protected _onData(data: Uint8Array) {
		this.client.emit('raw', data, this);
		for (const processed of this.queue.process(data)) {
			if (processed.id === null) {
				this.client.emit('error', makeError('Failed to parse message', processed.data), this);
			} else if (receivedVClose(processed)) {
				this._expectClosing = true;
			} else {
				this._expectClosing = false;
				const message = this._handleMessage(processed);
				if (message) this.client.emit('message', message, this);
			}
		}
	}

	private _onConnect() {
		this.retriesRemaining = this.client.maximumRetries;
		/* istanbul ignore else: Safe guard for race-conditions or unexpected behaviour. */
		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}
		this.status = ClientSocketStatus.Connected;
		this.client.emit('connect', this);
		this.client.emit('ready', this);
	}

	private _onClose(...options: [any, any?, any?]) {
		/* istanbul ignore else: Safe guard for race-conditions or unexpected behaviour. */
		if (!this._expectClosing && this.canReconnect) {
			this._reconnect(...options);
		} else if (this.status !== ClientSocketStatus.Disconnected) {
			if (this.name) this.client.servers.delete(this.name);
			this.status = ClientSocketStatus.Disconnected;
			this.client.emit('disconnect', this);
		}
	}

	private _reconnect(...options: [any, any?, any?]) {
		if (this._reconnectionTimeout) clearTimeout(this._reconnectionTimeout);
		this._reconnectionTimeout = setTimeout(async () => {
			/* istanbul ignore else: Safe guard for race-conditions or unexpected behaviour. */
			if (this.status !== ClientSocketStatus.Disconnected) {
				--this.retriesRemaining;
				try {
					await this._connect(...options);
					await this._handshake();

					this.client.servers.set(this.name!, this);
					this.status = ClientSocketStatus.Ready;
					this.client.emit('ready', this);
				} catch {
					this._onClose(...options);
				}
			}
		}, this.client.retryTime);
	}

	private _onError(error: any) {
		const { code } = error;
		/* istanbul ignore next: This is mostly guard code, it's very hard for all cases to be covered. Open to a fix. */
		if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
			if (this.status !== ClientSocketStatus.Disconnected) return;
			this.status = ClientSocketStatus.Disconnected;
			this.client.emit('disconnect', this);
		} else if (this.status !== ClientSocketStatus.Disconnected) {
			this.client.emit('error', error, this);
		}
	}

	private async _connect(...options: [any, any?, any?]) {
		await new Promise((resolve, reject) => {
			const onConnect = () => {
				this._emitConnect();
				resolve(cleanup(this.socket!, this));
			};
			const onClose = () => reject(cleanup(this.socket!, this));
			const onError = (error: any) => reject(cleanup(this.socket!, error));
			function cleanup(socket: NetSocket, value: any) {
				socket.off('connect', onConnect);
				socket.off('close', onClose);
				socket.off('error', onError);
				return value;
			}

			this.socket!.on('connect', onConnect).on('close', onClose).on('error', onError);

			this._attemptConnection(...options);
		});
	}

	private async _handshake() {
		await new Promise((resolve, reject) => {
			let timeout: NodeJS.Timeout;
			if (this.client.handshakeTimeout !== -1) {
				timeout = setTimeout(() => {
					// eslint-disable-next-line @typescript-eslint/no-use-before-define
					onError(new Error('Connection Timed Out.'));
					this.socket!.destroy();
				}, this.client.handshakeTimeout);
			}

			const onData = (message: Uint8Array) => {
				try {
					const name = deserialize(message, 11);
					if (typeof name === 'string') {
						const previous = this.name;
						this.name = name;
						if (previous && previous !== name) this.client.servers.delete(previous);

						// Reply with the name of the node, using the header id and concatenating with the
						// serialized name afterwards.
						this.socket!.write(createFromID(readID(message), false, serialize(this.client.name)));
						// eslint-disable-next-line @typescript-eslint/no-use-before-define
						return resolve(cleanup());
					}
				} catch {}
				// eslint-disable-next-line @typescript-eslint/no-use-before-define
				onError(new Error('Unexpected response from the server.'));
				this.socket!.destroy();
			};
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onClose = () => reject(cleanup(this));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onError = (error: any) => reject(cleanup(error));
			const cleanup = <T = unknown>(value?: T) => {
				this.socket!.off('data', onData);
				this.socket!.off('close', onClose);
				this.socket!.off('error', onError);
				if (timeout) clearTimeout(timeout);
				return value;
			};

			this.socket!.on('data', onData).on('close', onClose).on('error', onError);
		});
	}

	private _attemptConnection(...options: [any, any?, any?]) {
		this.status = ClientSocketStatus.Connecting;
		this.socket!.connect(...options);
		this.client.emit('connecting', this);
	}

	private _emitConnect() {
		if (this.status !== ClientSocketStatus.Connected) {
			this.status = ClientSocketStatus.Connected;
			this.client.emit('connect', this);
		}
	}
}
