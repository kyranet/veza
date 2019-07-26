import { SocketConnectOpts } from 'net';
import { EventEmitter } from 'events';
import { ClientSocket } from './ClientSocket';
import { SendOptions } from './Util/Shared';

interface NodeClientOptions {
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

	public constructor(name: string, { maximumRetries = Infinity, retryTime = 30000, handshakeTimeout = 10000 }: NodeClientOptions = {}) {
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

interface NodeClient {}

export { NodeClient as Client };
