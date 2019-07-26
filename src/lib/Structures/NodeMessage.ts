import { SocketHandler } from './Base/SocketHandler';
import { Node } from '../Node';
import { createFromID } from '../Util/Header';
import { serialize } from 'binarytf';

export class NodeMessage {

	/**
	 * The client that received this message
	 */
	public readonly client!: SocketHandler;

	/**
	 * The id of this message
	 */
	public readonly id!: number;

	/**
	 * The data received from the socket
	 */
	public data: any;

	/**
	 * Whether the message is receptive or not
	 */
	public readonly receptive!: boolean;

	public constructor(client: SocketHandler, id: number, receptive: boolean, data: any) {
		Object.defineProperties(this, {
			client: { value: client },
			id: { value: id, enumerable: true },
			receptive: { value: receptive, enumerable: true }
		});

		this.data = data;
	}

	/**
	 * The Node instance that manages this process' veza node
	 */
	public get node(): Node {
		return this.client.node;
	}

	/**
	 * Reply to the socket
	 * @param content The content to send
	 */
	public reply(content: unknown): void {
		if (this.receptive) {
			this.client.socket!.write(createFromID(this.id, false, serialize(content)));
		}
	}

	/**
	 * Freeze the object
	 */
	public freeze(): Readonly<this> {
		return Object.freeze(this);
	}

	public toJSON() {
		return {
			id: this.id,
			data: this.data,
			receptive: this.receptive
		};
	}

	public toString() {
		return `NodeMessage<${this.id}>`;
	}

}
