// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".
import { Node } from '../src/index';

const node = new Node('world')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('client.disconnect', client => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('client.destroy', client => console.error(`[IPC] Client Destroyed: ${client.name}`))
	.on('client.ready', async client => {
		console.log(`[IPC] Connected to: ${client.name}`);
		try {
			const result = await client.send('Hello', { timeout: 5000 });
			console.log(`[TEST] Hello ${result}`);
		} catch (error) {
			console.error(`[TEST] Client send errored: ${error}`);
		}
	});

node.connectTo('hello', 8001)
	.catch(error => console.error('[IPC] Disconnected!', error));
