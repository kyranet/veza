import { EventEmitter } from 'events';
import { NodeSocket } from './Structures/NodeSocket';
import { NodeServer } from './Structures/NodeServer';
import { NodeServerClient } from './Structures/NodeServerClient';
import { NodeMessage } from './Structures/NodeMessage';
import { ListenOptions, SocketConnectOpts } from 'net';

export class Node extends EventEmitter {

	/**
	 * The name for this Node
	 */
	public name: string;

	/**
	 * The amount of retries this Node will do when reconnecting
	 */
	public maxRetries: number;

	/**
	 * The server for this Node, if serving
	 */
	public server!: NodeServer | null;

	/**
	 * The servers this Node is connected to
	 */
	public readonly servers!: Map<string, NodeSocket>;

	/**
	 * The time between connection retries
	 */
	public retryTime: number;

	/**
	 * @param name The name for this Node
	 * @param options The options for this Node instance
	 */
	public constructor(name: string, { maxRetries = Infinity, retryTime = 200 }: NodeOptions = {}) {
		super();
		this.name = name;
		this.maxRetries = maxRetries;
		this.retryTime = retryTime;
		Object.defineProperties(this, {
			server: { value: null, writable: true },
			servers: { value: new Map() }
		});
	}

	/**
	 * Send a message to a connected socket
	 * @param name The label name of the socket to send the message to
	 * @param data The data to send to the socket
	 * @param options The options for this message
	 */
	public sendTo(name: string, data: any, options: SendOptions = {}): Promise<any> {
		const socket = this.get(name);
		if (!socket) {
			return Promise.reject(
				new Error(
					`The socket ${name} is not available or not connected to this Node.`
				)
			);
		}
		return socket.send(data, options);
	}

	/**
	 * Connect to a socket
	 * @param name The label name for the socket
	 * @param options The options to pass to connect
	 */
	public connectTo(name: string, options: SocketConnectOpts, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(name: string, port: number, host: string, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(name: string, port: number, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(name: string, path: string, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(name: string, ...options: any[]): Promise<NodeSocket> {
		if (this.servers.has(name)) {
			return Promise.reject(
				new Error(`There is already a socket called ${name}`)
			);
		}
		const client = new NodeSocket(this, name);
		this.servers.set(name, client);

		// @ts-ignore
		return client.connect(...options);
	}

	/**
	 * Disconnect from a socket, this will also reject all messages
	 * @param name The label name of the socket to disconnect
	 */
	public disconnectFrom(name: string): Promise<boolean> {
		const client = this.get(name);
		if (!client) {
			return Promise.reject(
				new Error(`The socket ${name} is not connected to this one.`)
			);
		}
		return Promise.resolve(client.disconnect());
	}

	/**
	 * Broadcast a message to all connected sockets from this server
	 * @param data The data to send to other sockets
	 * @param options The options for this broadcast
	 */
	public broadcast(data: any, options: BroadcastOptions = {}): Promise<Array<any>> {
		return this.server
			? this.server.broadcast(data, options)
			: Promise.resolve([]);
	}

	/**
	 * Create a server for this Node instance.
	 * @param options The options to pass to net.Server#listen
	 */
	public async serve(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async serve(port?: number, hostname?: string, listeningListener?: () => void): Promise<this>;
	public async serve(port?: number, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async serve(port?: number, listeningListener?: () => void): Promise<this>;
	public async serve(path: string, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async serve(path: string, listeningListener?: () => void): Promise<this>;
	public async serve(options: ListenOptions, listeningListener?: () => void): Promise<this>;
	public async serve(handle: any, backlog?: number, listeningListener?: () => void): Promise<this>;
	public async serve(handle: any, listeningListener?: () => void): Promise<this>;
	public async serve(...options: any[]): Promise<this> {
		if (this.server) throw new Error('There is already a server running.');

		this.server = new NodeServer(this);
		await this.server.connect(...options);
		return this;
	}

	/**
	 * Get a socket by its name
	 * @param name The name of the socket
	 */
	public get(name: string | NodeSocket): NodeServerClient | NodeSocket | null {
		if (name instanceof NodeSocket) return name;
		return (this.server && this.server.get(name)) || this.servers.get(name) || null;
	}

}

export interface Node {
	on(event: 'client.connect', listener: (client: NodeSocket | NodeServerClient) => void): this;
	on(event: 'client.destroy', listener: (client: NodeSocket | NodeServerClient) => void): this;
	on(event: 'client.disconnect', listener: (client: NodeSocket | NodeServerClient) => void): this;
	on(event: 'client.identify', listener: (client: NodeServerClient) => void): this;
	on(event: 'client.ready', listener: (client: NodeSocket) => void): this;
	on(event: 'error', listener: (error: Error, node: NodeServer | NodeServerClient | NodeSocket) => void): this;
	on(event: 'message', listener: (message: NodeMessage) => void): this;
	on(event: 'raw', listener: (node: NodeServerClient | NodeSocket, buffer: Buffer) => void): this;
	on(event: 'server.destroy', listener: (server: NodeServer) => void): this;
	on(event: 'server.ready', listener: (server: NodeServer) => void): this;
	on(event: string, listener: Function): this;
	once(event: 'client.connect', listener: (client: NodeSocket | NodeServerClient) => void): this;
	once(event: 'client.destroy', listener: (client: NodeSocket | NodeServerClient) => void): this;
	once(event: 'client.disconnect', listener: (client: NodeSocket | NodeServerClient) => void): this;
	once(event: 'client.identify', listener: (client: NodeServerClient) => void): this;
	once(event: 'client.ready', listener: (client: NodeSocket) => void): this;
	once(event: 'error', listener: (error: Error, node: NodeServer | NodeServerClient | NodeSocket) => void): this;
	once(event: 'message', listener: (message: NodeMessage) => void): this;
	once(event: 'raw', listener: (node: NodeServerClient | NodeSocket, buffer: Buffer) => void): this;
	once(event: 'server.destroy', listener: (server: NodeServer) => void): this;
	once(event: 'server.ready', listener: (server: NodeServer) => void): this;
	once(event: string, listener: Function): this;
	off(event: 'client.connect', listener: (client: NodeSocket | NodeServerClient) => void): this;
	off(event: 'client.destroy', listener: (client: NodeSocket | NodeServerClient) => void): this;
	off(event: 'client.disconnect', listener: (client: NodeSocket | NodeServerClient) => void): this;
	off(event: 'client.identify', listener: (client: NodeServerClient) => void): this;
	off(event: 'client.ready', listener: (client: NodeSocket) => void): this;
	off(event: 'error', listener: (error: Error, node: NodeServer | NodeServerClient | NodeSocket) => void): this;
	off(event: 'message', listener: (message: NodeMessage) => void): this;
	off(event: 'raw', listener: (node: NodeServerClient | NodeSocket, buffer: Buffer) => void): this;
	off(event: 'server.destroy', listener: (server: NodeServer) => void): this;
	off(event: 'server.ready', listener: (server: NodeServer) => void): this;
	off(event: string, listener: Function): this;
}

export interface NodeOptions {
	maxRetries?: number;
	retryTime?: number;
}

export interface SendOptions {
	receptive?: boolean;
	timeout?: number;
}

export interface BroadcastOptions extends SendOptions {
	filter?: RegExp;
}

/**
 * Emitted on a successful connection to a Socket
 * @event Node#client.connect
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted on a a Socket destroy
 * @event Node#client.destroy
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted on a successful disconnection from a Socket
 * @event Node#client.disconnect
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted on a successful identification from a Socket
 * @event Node#client.identify
 * @param {NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted when a Socket is ready for usage
 * @event Node#client.ready
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 */
/**
 * Emitted when a node emits an error
 * @event Node#error
 * @param {Error} error The omitted error
 * @param {NodeServer | NodeServerClient | NodeSocket} node The client that manages the socket
 */
/**
 * Emitted when a node receives a message
 * @event Node#message
 * @param {NodeMessage} message The message received
 */
/**
 * Emitted when a node receives a message
 * @event Node#raw
 * @param {NodeSocket | NodeServerClient} client The client that manages the socket
 * @param {Buffer} buffer The raw data received from the socket
 */
/**
 * Emitted when a server destroys
 * @event Node#server.destroy
 * @param {ServerNode} server The client that manages the socket
 */
/**
 * Emitted when a server is ready
 * @event Node#server.ready
 * @param {ServerNode} server The client that manages the socket
 */
