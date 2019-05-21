import { SocketHandler } from './Base/SocketHandler';
import { _packMessage } from '../Util/Transform';
import { Node } from '../Node';

export class NodeMessage {

	/**
	 * The client that received this message
	 */
	public readonly client!: SocketHandler;

	/**
	 * The id of this message
	 */
	public readonly id!: string;

	/**
	 * The data received from the socket
	 */
	public data: any;

	/**
	 * Whether the message is receptive or not
	 */
	public receptive: boolean;

	public constructor(client: SocketHandler, id: string, receptive: boolean, data: any) {
		Object.defineProperties(this, {
			client: { value: client },
			id: { value: id }
		});

		this.data = data;
		this.receptive = receptive;
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
	public reply(content: any): void {
		if (this.receptive) {
			this.client.socket!.write(_packMessage(this.id, content, false));
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
