import { Server as NetServer, Socket, ListenOptions } from 'net';
import { ServerSocket } from './ServerSocket';
import { BroadcastOptions, SendOptions, NetworkError } from './Util/Shared';
import { EventEmitter } from 'events';
import { NodeMessage } from './Structures/NodeMessage';

enum ServerStatus {
	Opening,
	Opened,
	Closing,
	Closed
}

export class Server extends EventEmitter {

	public server: NetServer;
	public readonly name: string;
	public readonly clients: Map<string, ServerSocket> = new Map();
	public status = ServerStatus.Closed;

	public constructor(name: string, connectionListener?: (socket: Socket) => void);
	public constructor(name: string, options?: { allowHalfOpen?: boolean; pauseOnConnect?: boolean }, connectionListener?: (socket: Socket) => void);
	public constructor(name: string, ...args: any[]) {
		super();
		this.name = name;
		this.server = new NetServer(...args);
	}

	/**
	 * Get a NodeSocket by its name or Socket
	 * @param name The NodeSocket to get
	 */
	public get(name: string | ServerSocket) {
		if (typeof name === 'string') return this.clients.get(name) || null;
		if (name instanceof ServerSocket) return name;
		throw new TypeError('Expected a string or a ServerClient instance.');
	}

	/**
	 * Check if a NodeSocket exists by its name of Socket
	 * @param name The NodeSocket to get
	 */
	public has(name: string | ServerSocket) {
		return Boolean(this.get(name));
	}

	/**
	 * Send a message to a connected socket
	 * @param name The label name of the socket to send the message to
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 */
	public sendTo(name: string | ServerSocket, data: any, options?: SendOptions): Promise<any> {
		const nodeSocket = this.get(name);
		return nodeSocket
			? nodeSocket.send(data, options)
			: Promise.reject(new Error('Failed to send to the socket: It is not connected to this server.'));
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
	 * Create a server for this Node instance.
	 * @param options The options to pass to net.Server#listen
	 */
	public async listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async listen(port?: number, hostname?: string, listeningListener?: () => void): Promise<this>;
	public async listen(port?: number, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async listen(port?: number, listeningListener?: () => void): Promise<this>;
	public async listen(path: string, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async listen(path: string, listeningListener?: () => void): Promise<this>;
	public async listen(options: ListenOptions, listeningListener?: () => void): Promise<this>;
	public async listen(handle: any, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async listen(handle: any, listeningListener?: () => void): Promise<this>;
	public async listen(...options: any[]): Promise<this> {
		this.status = ServerStatus.Opening;
		await new Promise((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onListening = () => resolve(cleanup(this, ServerStatus.Opened));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onClose = () => reject(cleanup(this, ServerStatus.Closed));
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const onError = (error: any) => reject(cleanup(error, ServerStatus.Closed));

			const cleanup = (value: any, status: ServerStatus) => {
				this.server.off('listening', onListening);
				this.server.off('close', onClose);
				this.server.off('error', onError);
				this.status = status;
				return value;
			};
			this.server
				.on('listening', onListening)
				.on('close', onClose)
				.on('error', onError);

			this.server.listen(...options);
		});

		this.emit('open');
		this.server
			.on('connection', this._onConnection.bind(this))
			.on('error', this._onError.bind(this))
			.on('close', this._onClose.bind(this));

		return this;
	}

	/**
	 * Disconnect the server and rejects all current messages
	 */
	public async close(closeSockets?: boolean) {
		// If it's closing or closed, do nothing
		if (this.status === ServerStatus.Closing || this.status === ServerStatus.Closed) return false;
		this.status = ServerStatus.Closing;

		// Disconnect all sockets
		for (const socket of this.clients.values()) {
			socket.disconnect(closeSockets);
		}
		await new Promise((resolve, reject) => {
			this.server.close(error => {
				/* istanbul ignore next: Hard to reproduce, it is a safe guard. */
				if (error) {
					reject(error);
				} else {
					this.status = ServerStatus.Closed;
					resolve();
				}
			});
		});
		this.emit('close');
		return true;
	}

	private _onConnection(socket: Socket) {
		new ServerSocket(this, socket).setup();
	}

	private _onError(error: Error) {
		/* istanbul ignore next: Hard to reproduce in Azure. */
		this.emit('error', error, null);
	}

	private _onClose() {
		this.close();
	}

}

export interface Server {
	/**
	 * Emitted when the server receives data.
	 */
	on(event: 'raw', listener: (data: Uint8Array, client: ServerSocket) => void): this;
	/**
	 * Emitted when the server opens.
	 */
	on(event: 'open', listener: () => void): this;
	/**
	 * Emitted when the server closes.
	 */
	on(event: 'close', listener: () => void): this;
	/**
	 * Emitted when an error occurs.
	 */
	on(event: 'error', listener: (error: Error | NetworkError, client: ServerSocket | null) => void): this;
	/**
	 * Emitted when a new connection is made and set up.
	 */
	on(event: 'connect', listener: (client: ServerSocket) => void): this;
	/**
	 * Emitted when a client disconnects from the server.
	 */
	on(event: 'disconnect', listener: (client: ServerSocket) => void): this;
	/**
	 * Emitted when the server receives and parsed a message.
	 */
	on(event: 'message', listener: (message: NodeMessage, client: ServerSocket) => void): this;

	/**
	 * Emitted when the server receives data.
	 */
	once(event: 'raw', listener: (data: Uint8Array, client: ServerSocket) => void): this;
	/**
	 * Emitted when the server opens.
	 */
	once(event: 'open', listener: () => void): this;
	/**
	 * Emitted when the server closes.
	 */
	once(event: 'close', listener: () => void): this;
	/**
	 * Emitted when an error occurs.
	 */
	once(event: 'error', listener: (error: Error | NetworkError, client: ServerSocket | null) => void): this;
	/**
	 * Emitted when a new connection is made and set up.
	 */
	once(event: 'connect', listener: (client: ServerSocket) => void): this;
	/**
	 * Emitted when a client disconnects from the server.
	 */
	once(event: 'disconnect', listener: (client: ServerSocket) => void): this;
	/**
	 * Emitted once when a server is ready.
	 */
	once(event: 'ready', listener: () => void): this;
	/**
	 * Emitted when the server receives and parsed a message.
	 */
	once(event: 'message', listener: (message: NodeMessage, client: ServerSocket) => void): this;

	/**
	 * Emitted when the server receives data.
	 */
	off(event: 'raw', listener: (data: Uint8Array, client: ServerSocket) => void): this;
	/**
	 * Emitted when the server opens.
	 */
	off(event: 'open', listener: () => void): this;
	/**
	 * Emitted when the server closes.
	 */
	off(event: 'close', listener: () => void): this;
	/**
	 * Emitted when an error occurs.
	 */
	off(event: 'error', listener: (error: Error | NetworkError, client: ServerSocket | null) => void): this;
	/**
	 * Emitted when a new connection is made and set up.
	 */
	off(event: 'connect', listener: (client: ServerSocket) => void): this;
	/**
	 * Emitted when a client disconnects from the server.
	 */
	off(event: 'disconnect', listener: (client: ServerSocket) => void): this;
	/**
	 * Emitted when the server receives and parsed a message.
	 */
	off(event: 'message', listener: (message: NodeMessage, client: ServerSocket) => void): this;

	/**
	 * Emits raw data received from the underlying socket.
	 */
	emit(event: 'raw', data: Uint8Array, client: ServerSocket): boolean;
	/**
	 * Emits a server open event.
	 */
	emit(event: 'open'): boolean;
	/**
	 * Emits a server close event.
	 */
	emit(event: 'close'): boolean;
	/**
	 * Emits a server error event.
	 */
	emit(event: 'error', error: Error | NetworkError, client: ServerSocket | null): boolean;
	/**
	 * Emits a connection made and set up to the server.
	 */
	emit(event: 'connect', client: ServerSocket): boolean;
	/**
	 * Emits a disconnection of a client from the server.
	 */
	emit(event: 'disconnect', client: ServerSocket): boolean;
	/**
	 * Emits a parsed NodeMessage instance ready for usage.
	 */
	emit(event: 'message', message: NodeMessage, client: ServerSocket): boolean;
}
