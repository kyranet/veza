import { SocketConnectOpts } from 'net';
import { EventEmitter } from 'events';
import { ClientSocket } from './ClientSocket';
import { SendOptions, NetworkError } from './Util/Shared';
import { NodeMessage } from './Structures/NodeMessage';

export interface NodeClientOptions {
	/**
	 * The maximum amount of attempts a client will perform to connect to a server.
	 * @since 0.7.0
	 */
	maximumRetries?: number;
	/**
	 * How many milliseconds will a client wait to retry a connection.
	 * @since 0.7.0
	 */
	retryTime?: number;
	/**
	 * How many milliseconds the client will wait for the server to initiate a handshake.
	 * @since 0.7.0
	 */
	handshakeTimeout?: number;
}

export class Client extends EventEmitter {

	/**
	 * The client's name
	 * @since 0.7.0
	 */
	public readonly name: string;
	/**
	 * How many milliseconds will a client wait to retry a connection.
	 * @since 0.7.0
	 */
	public retryTime: number;
	/**
	 * The maximum amount of attempts a client will perform to connect to a server.
	 * @since 0.7.0
	 */
	public maximumRetries: number;
	/**
	 * How many milliseconds the client will wait for the server to initiate a handshake.
	 * @since 0.7.0
	 */
	public handshakeTimeout: number;
	/**
	 * A map of servers this client is connected to.
	 * @since 0.7.0
	 */
	public servers = new Map<string, ClientSocket>();

	public constructor(name: string, { maximumRetries = Infinity, retryTime = 1000, handshakeTimeout = 10000 }: NodeClientOptions = {}) {
		super();
		this.name = name;
		this.retryTime = retryTime;
		this.maximumRetries = maximumRetries;
		this.handshakeTimeout = handshakeTimeout;
	}

	/**
	 * Connect to a socket.
	 * @param name The label name for the socket
	 * @param options The options to pass to connect
	 * @since 0.7.0
	 */
	public connectTo(options: SocketConnectOpts, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(port: number, host: string, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(port: number, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(path: string, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(...options: any[]) {
		// @ts-ignore
		return new ClientSocket(this).connect(...options);
	}

	/**
	 * Disconnect from a socket, this will also reject all messages.
	 * @param name The label name of the socket to disconnect
	 * @since 0.7.0
	 */
	public disconnectFrom(name: string) {
		const client = this.get(name);
		if (client) return client.disconnect();
		throw new Error(`The socket ${name} is not connected to this one.`);
	}

	/**
	 * Get a NodeSocket by its name or Socket.
	 * @param name The NodeSocket to get
	 * @since 0.7.0
	 */
	public get(name: string | ClientSocket) {
		if (typeof name === 'string') return this.servers.get(name) || null;
		if (name instanceof ClientSocket) return name;
		throw new TypeError('Expected a string or a ClientSocket instance.');
	}

	/**
	 * Check if a NodeSocket exists by its name of Socket.
	 * @param name The NodeSocket to get
	 * @since 0.7.0
	 */
	public has(name: string | ClientSocket) {
		return Boolean(this.get(name));
	}

	/**
	 * Send a message to a connected socket.
	 * @param name The label name of the socket to send the message to
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 * @since 0.7.0
	 */
	public sendTo(name: string | ClientSocket, data: any, options?: SendOptions): Promise<any> {
		const nodeSocket = this.get(name);
		return nodeSocket
			? nodeSocket.send(data, options)
			: Promise.reject(new Error('Failed to send to the socket: It is not connected to this client.'));
	}

}

export interface Client {
	/**
	 * Emitted when the client receives data from any of the connected servers.
	 * @since 0.7.0
	 */
	on(event: 'raw', listener: (data: Uint8Array, client: ClientSocket) => void): this;
	/**
	 * Emitted when an error occurs.
	 * @since 0.7.0
	 */
	on(event: 'error', listener: (error: Error | NetworkError, client: ClientSocket) => void): this;
	/**
	 * Emitted a connection to a server is in progress.
	 * @since 0.7.0
	 */
	on(event: 'connecting', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is made and set up.
	 * @since 0.7.0
	 */
	on(event: 'connect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 * @since 0.7.0
	 */
	on(event: 'ready', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is closed.
	 * @since 0.7.0
	 */
	on(event: 'disconnect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when the client receives a message from any of the connected servers.
	 * @since 0.7.0
	 */
	on(event: 'message', listener: (message: NodeMessage, client: ClientSocket) => void): this;

	/**
	 * Emitted when the client receives data from any of the connected servers.
	 * @since 0.7.0
	 */
	once(event: 'raw', listener: (data: Uint8Array, client: ClientSocket) => void): this;
	/**
	 * Emitted when an error occurs.
	 * @since 0.7.0
	 */
	once(event: 'error', listener: (error: Error | NetworkError, client: ClientSocket) => void): this;
	/**
	 * Emitted a connection to a server is in progress.
	 * @since 0.7.0
	 */
	once(event: 'connecting', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is made and set up.
	 * @since 0.7.0
	 */
	once(event: 'connect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 * @since 0.7.0
	 */
	once(event: 'ready', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is closed.
	 * @since 0.7.0
	 */
	once(event: 'disconnect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when the client receives a message from any of the connected servers.
	 * @since 0.7.0
	 */
	once(event: 'message', listener: (message: NodeMessage, client: ClientSocket) => void): this;

	/**
	 * Emitted when the client receives data from any of the connected servers.
	 * @since 0.7.0
	 */
	off(event: 'raw', listener: (data: Uint8Array, client: ClientSocket) => void): this;
	/**
	 * Emitted when an error occurs.
	 * @since 0.7.0
	 */
	off(event: 'error', listener: (error: Error | NetworkError, client: ClientSocket) => void): this;
	/**
	 * Emitted a connection to a server is in progress.
	 * @since 0.7.0
	 */
	off(event: 'connecting', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is made and set up.
	 * @since 0.7.0
	 */
	off(event: 'connect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 * @since 0.7.0
	 */
	off(event: 'ready', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is closed.
	 * @since 0.7.0
	 */
	off(event: 'disconnect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when the client receives a message from any of the connected servers.
	 * @since 0.7.0
	 */
	off(event: 'message', listener: (message: NodeMessage, client: ClientSocket) => void): this;

	/**
	 * Emits raw data received from the underlying socket.
	 * @since 0.7.0
	 */
	emit(event: 'raw', data: Uint8Array, client: ClientSocket): boolean;
	/**
	 * Emitted when an error occurs.
	 * @since 0.7.0
	 */
	emit(event: 'error', error: Error | NetworkError, client: ClientSocket): boolean;
	/**
	 * Emits a connecting event.
	 * @since 0.7.0
	 */
	emit(event: 'connecting', client: ClientSocket): boolean;
	/**
	 * Emits a client error event.
	 * @since 0.7.0
	 */
	emit(event: 'connect', client: ClientSocket): boolean;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 * @since 0.7.0
	 */
	emit(event: 'ready', client: ClientSocket): boolean;
	/**
	 * Emits a disconnection from a server.
	 * @since 0.7.0
	 */
	emit(event: 'disconnect', client: ClientSocket): boolean;
	/**
	 * Emits a parsed NodeMessage instance ready for usage.
	 * @since 0.7.0
	 */
	emit(event: 'message', message: NodeMessage, client: ClientSocket): boolean;
}
