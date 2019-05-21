import { Server, Socket } from 'net';
import { NodeServerClient } from './NodeServerClient';
import { NodeSocket } from './NodeSocket';
import { Node, BroadcastOptions, SendOptions } from '../Node';

export class NodeServer {

	/**
	 * The Node instance that manages this
	 */
	public readonly node!: Node;
	public readonly clients!: Map<string, NodeServerClient | NodeSocket>;
	public server!: Server | null;

	public constructor(node: Node) {
		Object.defineProperties(this, {
			node: { value: node },
			server: { value: null, writable: true },
			clients: { value: new Map(), enumerable: true }
		});
	}

	/**
	 * The name of this node
	 */
	public get name(): string {
		return this.node.name;
	}

	/**
	 * Get a NodeSocket by its name or Socket
	 * @param name The NodeSocket to get
	 */
	public get(name: string | Socket | NodeServerClient | NodeSocket): NodeServerClient | NodeSocket | null {
		if (typeof name === 'string') return this.clients.get(name) || null;
		if (name instanceof NodeServerClient || name instanceof NodeSocket) {
			return name;
		}
		if (name instanceof Socket) {
			for (const client of this.clients.values()) {
				if (client.socket === name) return client;
			}
			return null;
		}

		throw new TypeError(`Expected a string or an instance of Socket`);
	}

	/**
	 * Check if a NodeSocket exists by its name of Socket
	 * @param name The NodeSocket to get
	 */
	public has(name: string | Socket | NodeServerClient | NodeSocket): boolean {
		return Boolean(this.get(name));
	}

	/**
	 * Broadcast a message to all connected sockets from this server
	 * @param data The data to send to other sockets
	 * @param options The options for this broadcast
	 */
	public broadcast(data: any, { receptive, timeout, filter }: BroadcastOptions = {}): Promise<Array<any>> {
		if (filter && !(filter instanceof RegExp)) {
			throw new TypeError(`filter must be a RegExp instance.`);
		}

		const test = filter ? (name: string) => filter.test(name) : () => true;
		const promises = [];
		for (const [name, client] of this.clients.entries()) {
			if (test(name)) promises.push(client.send(data, { receptive, timeout }));
		}
		return Promise.all(promises);
	}

	/**
	 * Send a message to a connected socket
	 * @param name The label name of the socket to send the message to
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 */
	public sendTo(name: string | Socket | NodeSocket, data: any, options: SendOptions): Promise<any> {
		const nodeSocket = this.get(name);
		if (!nodeSocket) {
			return Promise.reject(
				new Error(
					'Failed to send to the socket: It is not connected to this Node.'
				)
			);
		}
		return nodeSocket.send(data, options);
	}

	/**
	 * Create a server for this Node instance.
	 * @param options The options to pass to net.Server#listen
	 */
	public async connect(...options: any[]): Promise<void> {
		if (this.server) throw new Error('There is already a server.');

		this.server = new Server();
		await new Promise((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onListening = () => resolve(cleanup(this));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onClose = () => reject(cleanup(this));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onError = (error: any) => reject(cleanup(error));

			const cleanup = (value: any) => {
				this.server!.off('listening', onListening);
				this.server!.off('close', onClose);
				this.server!.off('error', onError);
				return value;
			};
			this.server!
				.on('listening', onListening)
				.on('close', onClose)
				.on('error', onError);

			this.server!.listen(...options);
		});

		this.node.emit('server.ready', this);
		this.server
			.on('connection', this._onConnection.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));
	}

	/**
	 * Disconnect the server and rejects all current messages
	 * @returns {boolean}
	 */
	public disconnect(): boolean {
		if (!this.server) return false;

		this.server.close();
		this.server = null;
		this.node.server = null;
		this.node.emit('server.destroy', this);

		const rejectError = new Error('Server has been disconnected.');
		for (const socket of this.clients.values()) {
			for (const element of socket.queue.values()) element.reject(rejectError);
		}

		return true;
	}

	private _onConnection(socket: Socket) {
		new NodeServerClient(this.node, this, socket).setup();
	}

	private _onError(error: Error) {
		this.node.emit('error', error, this);
	}

	private _onClose() {
		this.disconnect();
	}

}
