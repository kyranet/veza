import { kInvalidMessage } from '../Util/Constants';
import { NodeSocket } from './NodeSocket';
import { Node } from '../Node';
import { Socket } from 'net';
import { read } from '../Util/Header';
import { deserializeWithMetadata } from 'binarytf';

export class Queue extends Map<number, QueueEntry> {

	private offset: number = 0;
	private nodeSocket!: NodeSocket;
	private _rest!: Buffer | null;

	public constructor(nodeSocket: any) {
		super();
		Object.defineProperties(this, {
			nodeSocket: { value: nodeSocket },
			_rest: { value: null, writable: true }
		});
	}

	/**
	 * The Node that manages this instance
	 */
	public get node(): Node {
		return this.nodeSocket.node;
	}

	/**
	 * The name of the client that manages this instance
	 */
	public get name(): string {
		return this.nodeSocket.name!;
	}

	/**
	 * The socket contained in the client that manages this instance
	 */
	public get socket(): Socket {
		return this.nodeSocket.socket!;
	}

	/**
	 * Returns a new Iterator object that parses each value for this queue.
	 */
	public *process(buffer: Buffer | null) {
		if (this._rest) {
			buffer = Buffer.concat([this._rest, buffer!]);
			this._rest = null;
		}

		while (buffer) {
			// If the header separator was not found, it may be due to an impartial message
			if (buffer.length + this.offset <= 7) {
				this._rest = buffer;
				break;
			}

			const { id, receptive } = read(buffer);
			try {
				const { value, offset } = deserializeWithMetadata(buffer, this.offset + 7);
				if (offset === -1) {
					this.offset = 0;
					buffer = null;
				} else {
					this.offset = offset;
				}
				yield { id, receptive, data: value };
			} catch {
				this.offset = 0;
				yield kInvalidMessage;
				break;
			}
		}
	}

}

interface QueueEntry {
	resolve: (value: any) => void;
	reject: (error: Error) => void;
}
