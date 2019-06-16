import { SocketHandler } from './Base/SocketHandler';
import { SocketStatus } from '../Util/Constants';
import { Socket, SocketConnectOpts } from 'net';
import { Node } from '../Node';
import { deserialize, serialize } from 'binarytf';

export class NodeSocket extends SocketHandler {

	private retriesRemaining: number;
	private _reconnectionTimeout!: NodeJS.Timer | null;

	public constructor(node: Node, name: string | null, socket = null) {
		super(node, name, socket);
		this.retriesRemaining = node.maxRetries;

		Object.defineProperties(this, {
			_reconnectionTimeout: { value: null, writable: true }
		});
	}

	/**
	 * Connect to the socket
	 * @param options The options to pass to connect
	 */
	public async connect(options: SocketConnectOpts, connectionListener?: () => void): Promise<this>;
	public async connect(port: number, host: string, connectionListener?: () => void): Promise<this>;
	public async connect(port: number, connectionListener?: () => void): Promise<this>;
	public async connect(path: string, connectionListener?: () => void): Promise<this>;
	public async connect(...options: any[]): Promise<this> {
		await this._connect(...options);
		await this._handshake();

		this.node.servers.set(this.name!, this);
		this.status = SocketStatus.Ready;
		this.node.emit('socket.ready', this);
		this.socket!
			.on('data', this._onData.bind(this))
			.on('connect', this._onConnect.bind(this))
			.on('close', this._onClose.bind(this, ...options))
			.on('error', this._onError.bind(this));

		return this;
	}

	/**
	 * Disconnect from the socket, this will also reject all messages
	 */
	public disconnect() {
		if (!super.disconnect()) return false;

		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}

		this.socket = null;
		this.node.servers.delete(this.name!);
		this.node.emit('socket.destroy', this);
		return true;
	}

	private _onConnect() {
		this.retriesRemaining = this.node.maxRetries;
		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}
		this.node.emit('socket.connect', this);
	}

	private _onClose(...options: any[]) {
		this.node.emit('socket.disconnect', this);
		this._reconnectionTimeout = setTimeout(() => {
			if (this.retriesRemaining === 0) {
				this.disconnect();
			} else {
				this.retriesRemaining--;
				// @ts-ignore
				this.socket.connect(...options);
			}
		}, this.node.retryTime);
	}

	private _onError(error: any) {
		const { code } = error;
		if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
			if (this.status !== SocketStatus.Disconnected) return;
			this.status = SocketStatus.Disconnected;
			this.node.emit('socket.disconnect', this);
		} else {
			this.node.emit('error', error, this);
		}
	}

	private async _connect(...options: any[]) {
		this.status = SocketStatus.Connecting;
		if (!this.socket) this.socket = new Socket();
		await new Promise((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onConnect = () => resolve(cleanup(this));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onClose = () => reject(cleanup(this));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onError = (error: any) => reject(cleanup(error));
			const cleanup = (value: any) => {
				this.socket!.off('connect', onConnect);
				this.socket!.off('close', onClose);
				this.socket!.off('error', onError);
				return value;
			};

			this.socket!
				.on('connect', onConnect)
				.on('close', onClose)
				.on('error', onError);

			// @ts-ignore
			this.socket!.connect(...options);
		});
	}

	private async _handshake() {
		this.status = SocketStatus.Connected;
		this.node.emit('socket.connect', this);
		await new Promise((resolve, reject) => {
			const onData = (message: Uint8Array) => {
				try {
					const name = deserialize(message, 7);
					if (typeof name === 'string') {
						this.name = name;

						// Reply with the name of the node, using the header id and concatenating with the
						// serialized name afterwards.
						this.socket!.write(Buffer.concat([
							message.subarray(0, 6),
							new Uint8Array([0]),
							serialize(this.node.name)
						]));
						// eslint-disable-next-line @typescript-eslint/no-use-before-define
						return resolve(cleanup());
					}
				} catch { }
				reject(new Error('Unexpected response from the server.'));
			};
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onClose = () => reject(cleanup(this));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onError = (error: any) => reject(cleanup(error));
			const cleanup = <T = unknown>(value?: T) => {
				this.socket!.off('data', onData);
				this.socket!.off('close', onClose);
				this.socket!.off('error', onError);
				return value;
			};

			this.socket!
				.on('data', onData)
				.on('close', onClose)
				.on('error', onError);
		});
	}

}
