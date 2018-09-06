// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".

// This example tests concurrency with parallel messages in IPC.
const { Node } = require('../src/index');
const TIMES = 2500;

const node = new Node('concurrent')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('client.disconnect', (client) => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('client.ready', (client) => {
		console.log(`[IPC] Connected to: ${client.name}`);
		console.log(`[IPC] Attempting to send and receive ${TIMES} messages...`);
		let failed = 0, resolved = 0;
		let logged = false;
		const before = Date.now();
		for (let i = 0; i < TIMES; i++) {
			const timeout = setTimeout(() => console.log(`Timeout reply from: ${i}`), 20000);
			client.send(`Test ${i}`)
				.then((reply) => {
					clearTimeout(timeout);
					log(`[TEST] Success: ${i} | ${reply}`);
					resolved++;
				})
				.catch((error) => {
					clearTimeout(timeout);
					log(`[TEST] Failed: ${i} | ${error}`);
					failed++;
				})
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
	.catch((error) => console.error('[IPC] Disconnected!', error));

// eslint-disable-next-line no-process-env
const log = process.env.LOGS ? console.log : (arg) => arg;
