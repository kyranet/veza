declare module 'ipc-link-core' {
	
	import { EventEmitter } from 'events';
	import { Server, Socket, ListenOptions, SocketConnectOpts } from 'net';
	import { resolve } from 'dns';

	export class Node extends EventEmitter {
		public constructor(name: string, options?: NodeOptions);
		public maxRetries: number;
		public retryTime: number;
		public server: Server | null;
		public readonly name: string;
		public readonly sockets: Map<string, NodeSocket>;
		private readonly _queue: Map<string, QueueEntry>;
		private readonly _serverNodes: Map<string, Socket>;

		// Socket events
		public on(event: 'connect', listener: (name: string, socket: Socket) => void): this;
		public on(event: 'disconnect', listener: (name: string, socket: Socket) => void): this;
		public on(event: 'destroy', listener: (name: string, socket: Socket) => void): this;
		public on(event: 'message', listener: (message: NodeMessage) => void): this;

		// Server events
		public on(event: 'connection', listener: (socket: Socket) => void): this;
		public on(event: 'close', listener: () => void): this;
		public on(event: 'socketClose', listener: (name: string) => void): this;
		public on(event: 'listening', listener: () => void): this;

		// Generic events
		public on(event: 'error', listener: (error: Error) => void): this;
		public on(event: 'raw', listener: (name: string, socket: Socket, buffer: Buffer) => void): this;
		public on(event: string, listener: Function): this;

		// Socket events
		public once(event: 'connect', listener: (name: string, socket: Socket) => void): this;
		public once(event: 'disconnect', listener: (name: string, socket: Socket) => void): this;
		public once(event: 'destroy', listener: (name: string, socket: Socket) => void): this;
		public once(event: 'message', listener: (message: NodeMessage) => void): this;

		// Server events
		public once(event: 'connection', listener: (name: string, socket: Socket) => void): this;
		public once(event: 'close', listener: () => void): this;
		public once(event: 'socketClose', listener: (name: string) => void): this;
		public once(event: 'listening', listener: () => void): this;

		// Generic events
		public once(event: 'error', listener: (error: Error) => void): this;
		public once(event: 'raw', listener: (name: string, socket: Socket, buffer: Buffer) => void): this;
		public once(event: string, listener: Function): this;

		public serve(name: string, port?: number, hostname?: string, backlog?: number, listeningListener?: Function): this;
		public serve(name: string, port?: number, hostname?: string, listeningListener?: Function): this;
		public serve(name: string, port?: number, backlog?: number, listeningListener?: Function): this;
		public serve(name: string, port?: number, listeningListener?: Function): this;
		public serve(name: string, path: string, backlog?: number, listeningListener?: Function): this;
		public serve(name: string, path: string, listeningListener?: Function): this;
		public serve(name: string, options: ListenOptions, listeningListener?: Function): this;
		public serve(name: string, handle: any, backlog?: number, listeningListener?: Function): this;
		public serve(name: string, handle: any, listeningListener?: Function): this;
		public broadcast<T = any>(data: any): Promise<Array<T>>;
		public sendTo<T = any>(name: string, data: any, receptive?: boolean): Promise<T>;
		public pingTo(name: string): Promise<number>;
		public connectTo(name: string, options: SocketConnectOpts, connectionListener?: Function): Promise<Socket>;
		public connectTo(name: string, port: number, host: string, connectionListener?: Function): Promise<Socket>;
		public connectTo(name: string, port: number, connectionListener?: Function): Promise<Socket>;
		public connectTo(name: string, path: string, connectionListener?: Function): Promise<Socket>;
		public disconnectFrom(name: string): void;

		private _destroySocket(socketName: string, socket: Socket, server: boolean): void;
		private _onDataMessage(name: string, socket: Socket, buffer: Buffer): void;
		private static unPackMessage(buffer: Buffer): [string, boolean, any];
		private static packMessage(id: string, message: any, receptive?: boolean): Buffer;
		private static createID(): string;
	}

	export interface NodeOptions {
		public maxRetries?: number;
		public retryTime?: number;
	}

	export interface NodeSocket {
		public readonly name: string;
		public socket: Socket | null;
		public retriesRemaining: number;
		private _reconnectionTimeout: NodeJS.Timer;
	}

	export interface NodeMessage {
		private readonly id: string;
		public readonly data: any;
		public readonly from: string;
		public readonly receptive: boolean;
		public reply(content: any): boolean;
	}

	interface QueueEntry {
		public resolve(data: any): void;
		public reject(data: any): void;
	}

}
