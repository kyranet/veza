import { SocketHandler } from './Base/SocketHandler';
import { STATUS } from '../Util/Constants';
import { Socket } from 'net';
import { Node } from '../Node';

export class NodeSocket extends SocketHandler {

	private retriesRemaining: number;
	private _reconnectionTimeout: NodeJS.Timer | null = null;

	public constructor(node: Node, name: string, socket = null) {
		super(node, name, socket);
		this.retriesRemaining = node.maxRetries;

		Object.defineProperty(this, '_reconnectionTimeout', { writable: true });
		this._reconnectionTimeout = null;
	}

	/**
	 * Connect to the socket
	 * @param options The options to pass to connect
	 */
	public async connect(...options: any[]): Promise<this> {
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

		this.status = STATUS.READY;
		this.node.emit('client.ready', this);
		this.socket
			.on('data', this._onData.bind(this))
			.on('connect', this._onConnect.bind(this))
			.on('close', this._onClose.bind(this, ...options))
			.on('error', this._onError.bind(this));

		return this;
	}

	/**
	 * Disconnect from the socket, this will also reject all messages
	 * @returns {boolean}
	 */
	public disconnect(): boolean {
		if (!super.disconnect()) return false;

		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}

		this.node.servers.delete(this.name!);
		this.node.emit('client.destroy', this);
		return true;
	}

	private _onConnect() {
		this.retriesRemaining = this.node.maxRetries;
		if (this._reconnectionTimeout) {
			clearTimeout(this._reconnectionTimeout);
			this._reconnectionTimeout = null;
		}
		this.node.emit('client.connect', this);
	}

	private _onClose(...options: any[]) {
		this.node.emit('client.disconnect', this);
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
			if (this.status !== STATUS.DISCONNECTED) return;
			this.status = STATUS.DISCONNECTED;
			this.node.emit('client.disconnect', this);
		} else {
			this.node.emit('error', error, this);
		}
	}

}
