// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".
// And uses readline to send messages to the other process.
import { createInterface } from 'readline';
import { Client } from '../src/index';

const node = new Client('interactive')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('disconnect', (client) => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('ready', (client) => console.log(`[IPC] Connected to: ${client.name}`))
	.on('message', (message) => {
		console.log(`Received data from ${message.client.name}:`, message);
		if (message.data === 'Hello') {
			message.reply('Interactive World Working!');
			process.stdout.write('> ');
		}
	});

// Connect to hello
node.connectTo(8001).catch(() => console.log('Disconnected!'));

const rl = createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.on('line', async (line) => {
	if (line) {
		await node.sendTo('hello', line, { receptive: false });
	}

	process.stdout.write('> ');
});
