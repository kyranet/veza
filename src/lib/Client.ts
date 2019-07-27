import { SocketConnectOpts } from 'net';
import { EventEmitter } from 'events';
import { ClientSocket } from './ClientSocket';
import { SendOptions } from './Util/Shared';
import { NodeMessage } from './Structures/NodeMessage';

export interface NodeClientOptions {
	maximumRetries?: number;
	retryTime?: number;
	handshakeTimeout?: number;
}

class NodeClient extends EventEmitter {

	public readonly name: string;
	public retryTime: number;
	public maximumRetries: number;
	public handshakeTimeout: number;
	public servers = new Map<string, ClientSocket>();

	public constructor(name: string, { maximumRetries = Infinity, retryTime = 1000, handshakeTimeout = 10000 }: NodeClientOptions = {}) {
		super();
		this.name = name;
		this.retryTime = retryTime;
		this.maximumRetries = maximumRetries;
		this.handshakeTimeout = handshakeTimeout;
	}

	/**
	 * Connect to a socket
	 * @param name The label name for the socket
	 * @param options The options to pass to connect
	 */
	public connectTo(options: SocketConnectOpts, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(port: number, host: string, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(port: number, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(path: string, connectionListener?: () => void): Promise<ClientSocket>;
	public connectTo(...options: any[]) {
		// @ts-ignore
		return new ClientSocket(this, null).connect(...options);
	}

	/**
	 * Disconnect from a socket, this will also reject all messages
	 * @param name The label name of the socket to disconnect
	 */
	public disconnectFrom(name: string) {
		const client = this.get(name);
		if (client) return client.disconnect();
		throw new Error(`The socket ${name} is not connected to this one.`);
	}

	/**
	 * Get a NodeSocket by its name or Socket
	 * @param name The NodeSocket to get
	 */
	public get(name: string | ClientSocket) {
		if (typeof name === 'string') return this.servers.get(name) || null;
		if (name instanceof ClientSocket) return name;
		throw new TypeError('Expected a string or a ClientSocket instance.');
	}

	/**
	 * Check if a NodeSocket exists by its name of Socket
	 * @param name The NodeSocket to get
	 */
	public has(name: string | ClientSocket) {
		return Boolean(this.get(name));
	}

	/**
	 * Send a message to a connected socket
	 * @param name The label name of the socket to send the message to
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 */
	public sendTo(name: string | ClientSocket, data: any, options?: SendOptions): Promise<any> {
		const nodeSocket = this.get(name);
		return nodeSocket
			? nodeSocket.send(data, options)
			: Promise.reject(new Error('Failed to send to the socket: It is not connected to this client.'));
	}

}

interface NodeClient {
	/**
	 * Emitted when the client receives data from any of the connected servers.
	 */
	on(event: 'raw', listener: (data: Uint8Array, client: ClientSocket) => void): this;
	/**
	 * Emitted when an error occurs.
	 */
	on(event: 'error', listener: (error: Error, client: ClientSocket | null) => void): this;
	/**
	 * Emitted a connection to a server is in progress.
	 */
	on(event: 'connecting', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is made and set up.
	 */
	on(event: 'connect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 */
	on(event: 'ready', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is closed.
	 */
	on(event: 'disconnect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when the client receives a message from any of the connected servers.
	 */
	on(event: 'message', listener: (message: NodeMessage, client: ClientSocket) => void): this;

	/**
	 * Emitted when the client receives data from any of the connected servers.
	 */
	once(event: 'raw', listener: (data: Uint8Array, client: ClientSocket) => void): this;
	/**
	 * Emitted when an error occurs.
	 */
	once(event: 'error', listener: (error: Error, client: ClientSocket | null) => void): this;
	/**
	 * Emitted a connection to a server is in progress.
	 */
	once(event: 'connecting', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is made and set up.
	 */
	once(event: 'connect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 */
	once(event: 'ready', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is closed.
	 */
	once(event: 'disconnect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when the client receives a message from any of the connected servers.
	 */
	once(event: 'message', listener: (message: NodeMessage, client: ClientSocket) => void): this;

	/**
	 * Emitted when the client receives data from any of the connected servers.
	 */
	off(event: 'raw', listener: (data: Uint8Array, client: ClientSocket) => void): this;
	/**
	 * Emitted when an error occurs.
	 */
	off(event: 'error', listener: (error: Error, client: ClientSocket | null) => void): this;
	/**
	 * Emitted a connection to a server is in progress.
	 */
	off(event: 'connecting', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is made and set up.
	 */
	off(event: 'connect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 */
	off(event: 'ready', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when a connection to a server is closed.
	 */
	off(event: 'disconnect', listener: (client: ClientSocket) => void): this;
	/**
	 * Emitted when the client receives a message from any of the connected servers.
	 */
	off(event: 'message', listener: (message: NodeMessage, client: ClientSocket) => void): this;

	/**
	 * Emits raw data received from the underlying socket.
	 */
	emit(event: 'raw', data: Uint8Array, client: ClientSocket): boolean;
	/**
	 * Emitted when an error occurs.
	 */
	emit(event: 'error', error: Error, client: ClientSocket): boolean;
	/**
	 * Emits a connecting event.
	 */
	emit(event: 'connecting', client: ClientSocket): boolean;
	/**
	 * Emits a client error event.
	 */
	emit(event: 'connect', client: ClientSocket): boolean;
	/**
	 * Emitted when a connection to a server is ready to be used.
	 */
	emit(event: 'ready', client: ClientSocket): boolean;
	/**
	 * Emits a disconnection from a server.
	 */
	emit(event: 'disconnect', client: ClientSocket): boolean;
	/**
	 * Emits a parsed NodeMessage instance ready for usage.
	 */
	emit(event: 'message', message: NodeMessage, client: ClientSocket): boolean;
}

export { NodeClient as Client };
