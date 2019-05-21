// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".

// This example tests concurrency with parallel messages in IPC.
import { Node } from '../src/index';
import { promisify } from 'util';

const sleep = promisify(setTimeout);
const TIMES = 10000;

const node = new Node('concurrent')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('client.disconnect', client => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('client.ready', async client => {
		console.log(`[IPC] Connected to: ${client.name}`);
		console.log(`[IPC] Attempting to send and receive ${TIMES} messages...`);
		let failed = 0;
		let resolved = 0;
		let logged = false;
		const before = Date.now();
		for (let i = 0; i < TIMES; i++) {
			// Let Node.js "breathe"
			if (i % 1000 === 0) await sleep(1);

			// eslint-disable-next-line promise/catch-or-return
			client.send(`Test ${i}`)
				// eslint-disable-next-line promise/prefer-await-to-then
				.then(() => resolved++)
				.catch(() => failed++)
				.finally(() => {
					if (logged || failed + resolved !== TIMES) return;
					// Show how long it took
					console.log('[TEST]', Date.now() - before, 'milliseconds');
					console.log('[TEST] Resolved:', resolved, 'Failed:', failed);

					logged = true;
				});
		}
	});

// Connect to hello
node.connectTo('hello', 8001)
	.catch(error => console.error('[IPC] Disconnected!', error));
