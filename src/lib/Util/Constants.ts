/**
 * The invalid message unique symbol
 * @private
 */
export const kInvalidMessage = Symbol('QUEUE-Invalid');

export enum SocketStatus {
	Ready,
	Connected,
	Connecting,
	Disconnected
}
