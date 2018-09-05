// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".

// This example tests concurrency with parallel messages in IPC.
const { Node } = require('../src/index');

const node = new Node('concurrent')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('client.disconnect', (client) => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('client.ready', (client) => {
		console.log(`[IPC] Connected to: ${client.name}`);

		for (let i = 0; i < 100; i++) {
			const timeout = setTimeout(() => console.log(`Timeout reply from: ${i}`), 10000);
			node.sendTo(client.name, `Test ${i}`)
				.then((reply) => { clearTimeout(timeout); console.log(`[TEST] Success: ${i} | ${reply}`); })
				.catch((error) => { clearTimeout(timeout); console.error(`[TEST] Failed: ${i} | ${error}`); });
		}
	});

// Connect to hello
node.connectTo('hello', 8001)
	.catch((error) => console.log('Disconnected!', error));
