import { NodeMessage } from '../NodeMessage';
import { Queue } from '../Queue';
import { Socket as NetSocket } from 'net';
import { create, read } from '../../Util/Header';
import { serialize } from 'binarytf';
import { SendOptions } from '../../Util/Shared';

/**
 * The abstract socket handler for {@link ClientSocket} and {@link ServerSocket}.
 * @since 0.0.1
 * @private
 */
export abstract class SocketHandler {

	/**
	 * The name of this socket.
	 * @since 0.0.1
	 */
	public name: string | null;

	/**
	 * The internal socket that connects Veza to the network.
	 * @since 0.0.1
	 */
	public socket: NetSocket;

	/**
	 * The incoming message queue for this handler.
	 * @since 0.1.0
	 */
	public queue = new Queue();

	/**
	 * @since 0.0.1
	 * @param name The name for this socket handler.
	 * @param socket The socket that will manage this instance.
	 */
	public constructor(name: string | null, socket: NetSocket) {
		this.name = name;
		this.socket = socket;
	}

	/**
	 * Send a message to a connected socket
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 */
	public send(data: any, options: SendOptions = {}) {
		if (this.socket.destroyed) {
			return Promise.reject(new Error('Cannot send a message to a missing socket.'));
		}

		const { receptive = true, timeout = -1 } = options;
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

	protected _handleMessage(message: RawMessage) {
		// Response message
		const queueData = this.queue.get(message.id);
		if (queueData) {
			queueData.resolve(message.data);
			return null;
		}

		return new NodeMessage(this, message.id, message.receptive, message.data).freeze();
	}

	protected abstract _onData(data: Uint8Array): void;

}

/**
 * A raw message
 * @since 0.5.0
 */
export interface RawMessage {
	/**
	 * The message's ID
	 * @since 0.5.0
	 */
	id: number;
	/**
	 * Whether the message should have a reply sent to it
	 * @since 0.5.0
	 */
	receptive: boolean;
	/**
	 * The message's data
	 * @since 0.5.0
	 */
	data: any;
}
