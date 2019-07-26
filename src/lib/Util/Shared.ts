export interface SendOptions {
	receptive?: boolean;
	timeout?: number;
}

export interface BroadcastOptions extends SendOptions {
	filter?: RegExp;
}
