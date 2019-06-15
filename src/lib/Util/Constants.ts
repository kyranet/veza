// Symbols
export const kInvalidMessage = Symbol('QUEUE-Invalid');

export enum SocketStatus {
	Idle,
	Ready,
	Connected,
	Connecting,
	Disconnected
}
