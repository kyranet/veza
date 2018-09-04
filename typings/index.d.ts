declare module 'veza' {

	import { EventEmitter } from 'events';
	import { Server, Socket, ListenOptions, SocketConnectOpts } from 'net';

	export class Node extends EventEmitter {
		public constructor(name: string, options?: NodeOptions);
		public name: string;
		public maxRetries: number;
		public retryTime: number;
		private server: NodeServer | null;
		private servers: Map<string, NodeSocket>;

		public on(event: 'client.connect', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public on(event: 'client.destroy', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public on(event: 'client.disconnect', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public on(event: 'client.identify', listener: (node: NodeServerClient) => void): this;
		public on(event: 'client.ready', listener: (node: NodeSocket) => void): this;
		public on(event: 'error', listener: (error: Error, node: NodeServer | NodeServerClient | NodeSocket) => void): this;
		public on(event: 'message', listener: (node: NodeServerClient | NodeSocket) => void): this;
		public on(event: 'raw', listener: (node: NodeServerClient | NodeSocket) => void): this;
		public on(event: 'server.destroy', listener: (node: ServerNode) => void): this;
		public on(event: 'server.ready', listener: (node: ServerNode) => void): this;
		public on(event: string, listener: Function): this;

		public once(event: 'client.connect', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public once(event: 'client.destroy', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public once(event: 'client.disconnect', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public once(event: 'client.identify', listener: (node: NodeServerClient) => void): this;
		public once(event: 'client.ready', listener: (node: NodeSocket) => void): this;
		public once(event: 'error', listener: (error: Error, node: NodeServer | NodeServerClient | NodeSocket) => void): this;
		public once(event: 'message', listener: (node: NodeServerClient | NodeSocket) => void): this;
		public once(event: 'raw', listener: (node: NodeServerClient | NodeSocket) => void): this;
		public once(event: 'server.destroy', listener: (node: ServerNode) => void): this;
		public once(event: 'server.ready', listener: (node: ServerNode) => void): this;
		public once(event: string, listener: Function): this;

		public off(event: 'client.connect', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public off(event: 'client.destroy', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public off(event: 'client.disconnect', listener: (node: NodeSocket | NodeServerClient) => void): this;
		public off(event: 'client.identify', listener: (node: NodeServerClient) => void): this;
		public off(event: 'client.ready', listener: (node: NodeSocket) => void): this;
		public off(event: 'error', listener: (error: Error, node: NodeServer | NodeServerClient | NodeSocket) => void): this;
		public off(event: 'message', listener: (node: NodeServerClient | NodeSocket) => void): this;
		public off(event: 'raw', listener: (node: NodeServerClient | NodeSocket) => void): this;
		public off(event: 'server.destroy', listener: (node: ServerNode) => void): this;
		public off(event: 'server.ready', listener: (node: ServerNode) => void): this;
		public off(event: string, listener: Function): this;

		public broadcast<T = any>(data: any, options: BroadcastOptions): Promise<Array<T>>;
		public connectTo(name: string, options: SocketConnectOpts, connectionListener?: Function): Promise<NodeSocket>;
		public connectTo(name: string, path: string, connectionListener?: Function): Promise<NodeSocket>;
		public connectTo(name: string, port: number, connectionListener?: Function): Promise<NodeSocket>;
		public connectTo(name: string, port: number, host: string, connectionListener?: Function): Promise<NodeSocket>;
		public disconnectFrom(name: string): Promise<boolean>;
		public sendTo<T = any>(name: string | Socket, data: any, receptive?: boolean): Promise<T>;
		public serve(handle: any, backlog?: number, listeningListener?: Function): this;
		public serve(handle: any, listeningListener?: Function): this;
		public serve(options: ListenOptions, listeningListener?: Function): this;
		public serve(path: string, backlog?: number, listeningListener?: Function): this;
		public serve(path: string, listeningListener?: Function): this;
		public serve(port?: number, backlog?: number, listeningListener?: Function): this;
		public serve(port?: number, hostname?: string, backlog?: number, listeningListener?: Function): this;
		public serve(port?: number, hostname?: string, listeningListener?: Function): this;
		public serve(port?: number, listeningListener?: Function): this;
	}

	class Base {
		constructor(node: Node, name?: string);
		public node: Node;
		public name: string | null;
	}

	class SocketHandler extends Base {
		private socket: Socket;
		private queue: Queue;
		public send<T = any>(data: any, receptive?: boolean): Promise<T>;
		public disconnect(): boolean;
		public ping(): Promise<number>;

		public on(event: 'close', listener: (had_error: boolean) => void): this;
		public on(event: 'connect', listener: () => void): this;
		public on(event: 'data', listener: (data: Buffer) => void): this;
		public on(event: 'drain', listener: () => void): this;
		public on(event: 'end', listener: () => void): this;
		public on(event: 'error', listener: (err: Error) => void): this;
		public on(event: 'lookup', listener: (err: Error, address: string, family: string | number, host: string) => void): this;
		public on(event: 'timeout', listener: () => void): this;
		public on(event: string, listener: (...args: any[]) => void): this;

		public once(event: 'close', listener: (had_error: boolean) => void): this;
		public once(event: 'connect', listener: () => void): this;
		public once(event: 'data', listener: (data: Buffer) => void): this;
		public once(event: 'drain', listener: () => void): this;
		public once(event: 'end', listener: () => void): this;
		public once(event: 'error', listener: (err: Error) => void): this;
		public once(event: 'lookup', listener: (err: Error, address: string, family: string | number, host: string) => void): this;
		public once(event: 'timeout', listener: () => void): this;
		public once(event: string, listener: (...args: any[]) => void): this;

		public off(event: 'close', listener: (had_error: boolean) => void): this;
		public off(event: 'connect', listener: () => void): this;
		public off(event: 'data', listener: (data: Buffer) => void): this;
		public off(event: 'drain', listener: () => void): this;
		public off(event: 'end', listener: () => void): this;
		public off(event: 'error', listener: (err: Error) => void): this;
		public off(event: 'lookup', listener: (err: Error, address: string, family: string | number, host: string) => void): this;
		public off(event: 'timeout', listener: () => void): this;
		public off(event: string, listener: (...args: any[]) => void): this;

		private _handleMessage(data: { id: string, receptive: boolean, data: any }): NodeMessage | null;
	}

	class NodeServer {
		constructor(node: Node);
		public node: Node;
		private server: Server;
		private clients: Map<string, NodeServerClient>;
		public get(name: NodeResolvable): NodeServer | NodeServerClient;
		public has(name: NodeResolvable): boolean;
		public broadcast(data: any, options: { receptive: false, filter?: RegExp }): Promise<Array<void>>;
		public broadcast<T = any>(data: any, options?: BroadcastOptions): Promise<Array<T>>;
		public sendTo(name: NodeResolvable, data: any, receptive: false): Promise<void>;
		public sendTo<T = any>(name: NodeResolvable, data: any, receptive?: boolean): Promise<T>;
		public connect(handle: any, backlog?: number, listeningListener?: Function): Promise<void>;
		public connect(handle: any, listeningListener?: Function): Promise<void>;
		public connect(options: ListenOptions, listeningListener?: Function): Promise<void>;
		public connect(path: string, backlog?: number, listeningListener?: Function): Promise<void>;
		public connect(path: string, listeningListener?: Function): Promise<void>;
		public connect(port?: number, backlog?: number, listeningListener?: Function): Promise<void>;
		public connect(port?: number, hostname?: string, backlog?: number, listeningListener?: Function): Promise<void>;
		public connect(port?: number, hostname?: string, listeningListener?: Function): Promise<void>;
		public connect(port?: number, listeningListener?: Function): Promise<void>;
		public disconnect(): boolean;

		private _onConnection(socket: Socket): void;
		private _onError(error: Error): void;
		private _onClose(): void;
	}

	class NodeServerClient extends SocketHandler {
		constructor(node: Node, server: NodeServer, socket: Socket);
		public server: NodeServer;
		public status: number;
		public setup(): void;
		public disconnect(): boolean;

		private _onData(data: Buffer): void;
		private _onError(error: Error): void;
		private _onClose(): void;
	}

	class NodeSocket extends SocketHandler {
		constructor(node: Node, name: string, socket: Socket);
		public retriesRemaining: number;
		private _reconnectionTimeout: NodeJS.Timer | null;

		public connect(options: SocketConnectOpts, connectionListener?: Function): Promise<this>;
		public connect(path: string, connectionListener?: Function): Promise<this>;
		public connect(port: number, connectionListener?: Function): Promise<this>;
		public connect(port: number, host: string, connectionListener?: Function): Promise<this>;
		public disconnect(): boolean;

		private _onData(data: Buffer): void;
		private _onConnect(): void;
		private _onClose(...options: any[]): void;
		private _onError(error: Error): void;
	}

	class Queue extends Map<string, QueueEntry> {
		constructor(nodeSocket: NodeSocket | NodeServerClient);
		public nodeSocket: NodeSocket | NodeServerClient;
		private _rest: Buffer | null;
		public readonly node: Node;
		public readonly name: string;
		private readonly socket: Socket;
		public process(buffer: Buffer): Iterator<{ id: string, receptive: boolean, data: any }>;
		public flush(): void;

		private _readMessage(body: Buffer, type: string): any;
	}

	type BroadcastOptions = {
		receptive?: boolean;
		filter?: RegExp;
	};

	type NodeResolvable = string | NodeSocket | NodeServerClient | Socket;

	type NodeOptions = {
		maxRetries?: number;
		retryTime?: number;
	}

	type NodeMessage = Readonly<{
		id: string;
		data: any;
		from: string;
		receptive: boolean;
		reply(content: any): void;
	}>;

	interface QueueEntry {
		socket: Socket;
		resolve: (data: any) => void;
		reject: (data: any) => void;
	}

}
