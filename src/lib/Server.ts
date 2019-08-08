import { Server as NetServer, Socket as NetSocket, ListenOptions } from 'net';
import { ServerSocket } from './ServerSocket';
import { BroadcastOptions, SendOptions, NetworkError } from './Util/Shared';
import { EventEmitter } from 'events';
import { NodeMessage } from './Structures/NodeMessage';

/**
 * The connection status of this server.
 * @since 0.7.0
 */
export enum ServerStatus {
	/**
	 * The server is opening, this is set immediately after calling listen.
	 * @since 0.7.0
	 */
	Opening,
	/**
	 * The server is connected and ready to get connections.
	 * @since 0.7.0
	 */
	Opened,
	/**
	 * The server is closing, this is set immediately after calling close.
	 * @since 0.7.0
	 */
	Closing,
	/**
	 * The server is closed and free to listen to a port.
	 * @since 0.7.0
	 */
	Closed
}

/**
 * The server that receives connections.
 */
export class Server extends EventEmitter {

	/**
	 * The internal net.Server that powers this instance.
	 * @since 0.7.0
	 */
	public server: NetServer;

	/**
	 * The name of this server. This is set as the first argument of the Server's constructor.
	 * @since 0.7.0
	 */
	public readonly name: string;

	/**
	 * The sockets map for this server. Each value is a ServerSocket instance that identifies as an incoming connection
	 * to the server.
	 * @since 0.7.0
	 */
	public readonly sockets: Map<string, ServerSocket> = new Map();

	/**
	 * The status of this server.
	 * @since 0.7.0
	 */
	public status = ServerStatus.Closed;

	/**
	 * Construct the server.
	 * @since 0.7.0
	 * @param name The name for this server.
	 * @param connectionListener Automatically set as a listener for the 'connection' event.
	 * @see https://nodejs.org/dist/latest/docs/api/net.html#net_net_createserver_options_connectionlistener
	 */
	public constructor(name: string, connectionListener?: (socket: NetSocket) => void);
	/**
	 * Construct the server.
	 * @since 0.7.0
	 * @param name The name for this server.
	 * @param options The options for the internal server.
	 * @param options.allowHalfOpen Indicates whether half-opened TCP connections are allowed. Default: false.
	 * @param options.pauseOnConnect Indicates whether the socket should be paused on incoming connections. Default: false.
	 * @param connectionListener Automatically set as a listener for the 'connection' event.
	 * @see https://nodejs.org/dist/latest/docs/api/net.html#net_net_createserver_options_connectionlistener
	 */
	public constructor(name: string, options?: { allowHalfOpen?: boolean; pauseOnConnect?: boolean }, connectionListener?: (socket: NetSocket) => void);
	public constructor(name: string, ...args: any[]) {
		super();
		this.name = name;
		this.server = new NetServer(...args);
	}

	/**
	 * Get a NodeSocket by its name or Socket.
	 * @since 0.7.0
	 * @param name The NodeSocket to get.
	 */
	public get(name: string | ServerSocket) {
		if (typeof name === 'string') return this.sockets.get(name) || null;
		if (name instanceof ServerSocket) return name;
		throw new TypeError('Expected a string or a ServerClient instance.');
	}

	/**
	 * Check if a NodeSocket exists by its name of Socket.
	 * @since 0.7.0
	 * @param name The NodeSocket to get.
	 */
	public has(name: string | ServerSocket) {
		return Boolean(this.get(name));
	}

	/**
	 * Send a message to a connected socket.
	 * @since 0.7.0
	 * @param name The label name of the socket to send the message to.
	 * @param data The data to send to the socket.
	 * @param options The options for this message.
	 */
	public sendTo(name: string | ServerSocket, data: any, options?: SendOptions): Promise<any> {
		const nodeSocket = this.get(name);
		return nodeSocket
			? nodeSocket.send(data, options)
			: Promise.reject(new Error('Failed to send to the socket: It is not connected to this server.'));
	}

	/**
	 * Broadcast a message to all connected sockets from this server.
	 * @since 0.7.0
	 * @param data The data to send to other sockets.
	 * @param options The options for this broadcast.
	 */
	public broadcast(data: any, { receptive, timeout, filter }: BroadcastOptions = {}): Promise<Array<any>> {
		if (filter && !(filter instanceof RegExp)) {
			throw new TypeError(`filter must be a RegExp instance.`);
		}

		const test = filter ? (name: string) => filter.test(name) : () => true;
		const promises = [];
		for (const [name, client] of this.sockets.entries()) {
			if (test(name)) promises.push(client.send(data, { receptive, timeout }));
		}
		return Promise.all(promises);
	}

	/**
	 * Create a server for this Node instance.
	 * @since 0.7.0
	 * @param options The options to pass to net.Server#listen.
	 * @see https://nodejs.org/dist/latest-v12.x/docs/api/net.html#net_server_listen
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
			/* eslint-disable: @typescript-eslint/no-use-before-define */
			const onListening = () => resolve(cleanup(this, ServerStatus.Opened));
			const onClose = () => reject(cleanup(this, ServerStatus.Closed));
			const onError = (error: any) => reject(cleanup(error, ServerStatus.Closed));
			/* eslint-enable: @typescript-eslint/no-use-before-define */

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
	 * Disconnect the server and rejects all current messages.
	 * @since 0.7.0
	 */
	public async close(closeSockets?: boolean) {
		// If it's closing or closed, do nothing
		if (this.status === ServerStatus.Closing || this.status === ServerStatus.Closed) return false;
		this.status = ServerStatus.Closing;

		// Disconnect all sockets
		for (const socket of this.sockets.values()) {
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

	/**
	 * Connection listener.
	 * @since 0.7.0
	 * @param socket The received socket
	 */
	private _onConnection(socket: NetSocket) {
		new ServerSocket(this, socket).setup();
	}

	/**
	 * Error listener.
	 * @since 0.7.0
	 * @param error The error received.
	 */
	private _onError(error: Error) {
		/* istanbul ignore next: Hard to reproduce in Azure. */
		this.emit('error', error, null);
	}

	/**
	 * The close listener.
	 * @since 0.7.0
	 */
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
