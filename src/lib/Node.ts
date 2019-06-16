import { EventEmitter } from 'events';
import { NodeSocket } from './Structures/NodeSocket';
import { NodeServer } from './Structures/NodeServer';
import { NodeServerClient } from './Structures/NodeServerClient';
import { NodeMessage } from './Structures/NodeMessage';
import { ListenOptions, SocketConnectOpts } from 'net';
import { SocketHandler } from './Structures/Base/SocketHandler';

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
	public connectTo(options: SocketConnectOpts, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(port: number, host: string, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(port: number, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(path: string, connectionListener?: () => void): Promise<NodeSocket>;
	public connectTo(...options: any[]): Promise<NodeSocket> {
		// @ts-ignore
		return new NodeSocket(this, null).connect(...options);
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
	 * Broadcast a message to all connected sockets from this server
	 * @param data The data to send to other sockets
	 * @param options The options for this broadcast
	 */
	public broadcast(data: any, options: BroadcastOptions = {}) {
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
	/**
	 * Emitted on a successful connection to a Socket.
	 */
	on(event: 'client.connect', listener: ClientConnectEvent): this;
	/**
	 * Emitted on a a Socket destroy.
	 */
	on(event: 'client.destroy', listener: ClientDestroyEvent): this;
	/**
	 * Emitted on a successful disconnection from a Socket.
	 */
	on(event: 'client.disconnect', listener: ClientDisconnectEvent): this;
	/**
	 * Emitted on a successful identification from a Socket.
	 */
	on(event: 'client.identify', listener: ClientIdentifyEvent): this;
	/**
	 * Emitted when a Socket is ready for usage.
	 */
	on(event: 'client.ready', listener: ClientReadyEvent): this;
	/**
	 * Emitted when a node emits an error.
	 */
	on(event: 'error', listener: ErrorEvent): this;
	/**
	 * Emitted when a node receives a message.
	 */
	on(event: 'message', listener: EventMessage): this;
	/**
	 * Emitted when a Node receives a message.
	 */
	on(event: 'raw', listener: RawEvent): this;
	/**
	 * Emitted when a server destroys.
	 */
	on(event: 'server.destroy', listener: ServerDestroyEvent): this;
	/**
	 * Emitted when a server is ready.
	 */
	on(event: 'server.ready', listener: ServerReadyEvent): this;

	/**
	 * Emitted on a successful connection to a Socket.
	 */
	once(event: 'client.connect', listener: ClientConnectEvent): this;
	/**
	 * Emitted on a a Socket destroy.
	 */
	once(event: 'client.destroy', listener: ClientDestroyEvent): this;
	/**
	 * Emitted on a successful disconnection from a Socket.
	 */
	once(event: 'client.disconnect', listener: ClientDisconnectEvent): this;
	/**
	 * Emitted on a successful identification from a Socket.
	 */
	once(event: 'client.identify', listener: ClientIdentifyEvent): this;
	/**
	 * Emitted when a Socket is ready for usage.
	 */
	once(event: 'client.ready', listener: ClientReadyEvent): this;
	/**
	 * Emitted when a node emits an error.
	 */
	once(event: 'error', listener: ErrorEvent): this;
	/**
	 * Emitted when a node receives a message.
	 */
	once(event: 'message', listener: EventMessage): this;
	/**
	 * Emitted when a Node receives a message.
	 */
	once(event: 'raw', listener: RawEvent): this;
	/**
	 * Emitted when a server destroys.
	 */
	once(event: 'server.destroy', listener: ServerDestroyEvent): this;
	/**
	 * Emitted when a server is ready.
	 */
	once(event: 'server.ready', listener: ServerReadyEvent): this;

	/**
	 * Emitted on a successful connection to a Socket.
	 */
	off(event: 'client.connect', listener: ClientConnectEvent): this;
	/**
	 * Emitted on a a Socket destroy.
	 */
	off(event: 'client.destroy', listener: ClientDestroyEvent): this;
	/**
	 * Emitted on a successful disconnection from a Socket.
	 */
	off(event: 'client.disconnect', listener: ClientDisconnectEvent): this;
	/**
	 * Emitted on a successful identification from a Socket.
	 */
	off(event: 'client.identify', listener: ClientIdentifyEvent): this;
	/**
	 * Emitted when a Socket is ready for usage.
	 */
	off(event: 'client.ready', listener: ClientReadyEvent): this;
	/**
	 * Emitted when a node emits an error.
	 */
	off(event: 'error', listener: ErrorEvent): this;
	/**
	 * Emitted when a node receives a message.
	 */
	off(event: 'message', listener: EventMessage): this;
	/**
	 * Emitted when a Node receives a message.
	 */
	off(event: 'raw', listener: RawEvent): this;
	/**
	 * Emitted when a server destroys.
	 */
	off(event: 'server.destroy', listener: ServerDestroyEvent): this;
	/**
	 * Emitted when a server is ready.
	 */
	off(event: 'server.ready', listener: ServerReadyEvent): this;

	/**
	 * Emitted on a successful connection to a Socket.
	 */
	emit(event: 'client.connect', ...args: Parameters<ClientConnectEvent>): boolean;
	/**
	 * Emitted on a a Socket destroy.
	 */
	emit(event: 'client.destroy', ...args: Parameters<ClientDestroyEvent>): boolean;
	/**
	 * Emitted on a successful disconnection from a Socket.
	 */
	emit(event: 'client.disconnect', ...args: Parameters<ClientDisconnectEvent>): boolean;
	/**
	 * Emitted on a successful identification from a Socket.
	 */
	emit(event: 'client.identify', ...args: Parameters<ClientIdentifyEvent>): boolean;
	/**
	 * Emitted when a Socket is ready for usage.
	 */
	emit(event: 'client.ready', ...args: Parameters<ClientReadyEvent>): boolean;
	/**
	 * Emitted when a node emits an error.
	 */
	emit(event: 'error', ...args: Parameters<ErrorEvent>): boolean;
	/**
	 * Emitted when a node receives a message.
	 */
	emit(event: 'message', ...args: Parameters<EventMessage>): boolean;
	/**
	 * Emitted when a Node receives a message.
	 */
	emit(event: 'raw', ...args: Parameters<RawEvent>): boolean;
	/**
	 * Emitted when a server destroys.
	 */
	emit(event: 'server.destroy', ...args: Parameters<ServerDestroyEvent>): boolean;
	/**
	 * Emitted when a server is ready.
	 */
	emit(event: 'server.ready', ...args: Parameters<ServerReadyEvent>): boolean;
}

interface ClientConnectEvent {
	/**
	 * @param client The client that has connected
	 */
	(client: NodeSocket | NodeServerClient): unknown;
}
interface ClientDestroyEvent {
	/**
	 * @param client The client that was destroyed
	 */
	(client: NodeSocket | NodeServerClient): unknown;
}
interface ClientDisconnectEvent {
	/**
	 * @param client The client that was disconnected
	 */
	(client: NodeSocket | NodeServerClient): unknown;
}
interface ClientIdentifyEvent {
	/**
	 * @param client The identified client
	 */
	(client: NodeServerClient): unknown;
}
interface ClientReadyEvent {
	/**
	 * @param client The client that has turned ready
	 */
	(client: NodeSocket): unknown;
}
interface ErrorEvent {
	/**
	 * @param error The error emitted
	 * @param node The client or server that emitted the error
	 */
	(error: Error, node: SocketHandler | NodeServer): unknown;
}
interface EventMessage {
	/**
	 * @param message The message received
	 */
	(message: NodeMessage): unknown;
}
interface RawEvent {
	/**
	 * @param client The client that received the message
	 * @param buffer The raw data received from the socket
	 */
	(node: SocketHandler, buffer: Uint8Array): unknown;
}
interface ServerDestroyEvent {
	/**
	 * @param server The server that was destroyed
	 */
	(server: NodeServer): unknown;
}
interface ServerReadyEvent {
	/**
	 * @param server The server that has turned ready
	 */
	(server: NodeServer): unknown;
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
