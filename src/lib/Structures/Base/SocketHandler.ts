import { kInvalidMessage, SocketStatus } from '../../Util/Constants';
import { NodeMessage } from '../NodeMessage';
import { Queue } from '../Queue';
import { Base } from './Base';
import { Node, SendOptions } from '../../Node';
import { Socket } from 'net';
import { create, read } from '../../Util/Header';
import { serialize } from 'binarytf';

export class SocketHandler extends Base {

	/**
	 * The socket that connects Veza to the network
	 */
	public socket: Socket | null;

	/**
	 * The status of this client
	 */
	public status: SocketStatus = SocketStatus.Connecting;

	/**
	 * The incoming message queue for this handler
	 */
	public queue: Queue = new Queue(this);

	public constructor(node: Node, name: string | null, socket: Socket | null) {
		super(node, name);
		this.socket = socket;
	}

	/**
	 * Send a message to a connected socket
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 */
	public send(data: any, { receptive = true, timeout = -1 }: SendOptions = {}): Promise<any> {
		if (!this.socket) {
			return Promise.reject(
				new Error('This NodeSocket is not connected to a socket.')
			);
		}

		return new Promise((resolve, reject) => {
			let id: number;
			try {
				const serialized = serialize(data);
				const message = create(receptive, serialized);
				id = read(message).id;
				this.socket!.write(message);

				if (!receptive) {
					resolve(undefined);
					return;
				}

				const timer = timeout === -1
					? null
					// eslint-disable-next-line @typescript-eslint/no-use-before-define
					: setTimeout(() => send(reject, true, new Error('Timed out.')), timeout);
				const send = (fn: Function, fromTimer: boolean, response: any) => {
					if (timer && !fromTimer) clearTimeout(timer);
					this.queue.delete(id);
					return fn(response);
				};

				this.queue.set(id, {
					resolve: send.bind(null, resolve, false),
					reject: send.bind(null, reject, false)
				});
			} catch (error) {
				/* istanbul ignore next: Hard to reproduce, this is a safe-guard. */
				const entry = this.queue.get(id!);
				/* istanbul ignore next: Hard to reproduce, this is a safe-guard. */
				if (entry) entry.reject(error);
				/* istanbul ignore next: Hard to reproduce, this is a safe-guard. */
				else reject(error);
			}
		});
	}

	/**
	 * Disconnect from the socket, this will also reject all messages
	 */
	public disconnect() {
		if (!this.socket) return false;

		this.socket.destroy();
		this.socket.removeAllListeners();
		this.socket = null;

		if (this.queue.size) {
			const rejectError = new Error('Socket has been disconnected.');
			for (const element of this.queue.values()) element.reject(rejectError);
		}

		this.status = SocketStatus.Destroyed;

		return true;
	}

	protected _onData(data: Uint8Array) {
		this.node.emit('raw', this, data);
		for (const processed of this.queue.process(data)) {
			if (processed === kInvalidMessage) {
				/* istanbul ignore else: Hard to reproduce, this is a safe-guard. */
				if (this.status === SocketStatus.Ready) {
					this.node.emit('error', new Error('Failed to process message.'), this);
				} else {
					this.node.emit('error', new Error('Failed to process message during connection, calling disconnect.'), this);
					this.disconnect();
				}
			} else {
				const message = this._handleMessage(processed);
				if (message) this.node.emit('message', message);
			}
		}
	}

	protected _handleMessage({ id, receptive, data }: RawMessage) {
		// Response message
		const queueData = this.queue.get(id);
		if (queueData) {
			queueData.resolve(data);
			return null;
		}

		return new NodeMessage(this, id, receptive, data).freeze();
	}

}

interface RawMessage {
	id: number;
	receptive: boolean;
	data: any;
}
