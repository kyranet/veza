// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".

// This example tests concurrency with parallel messages in IPC.
const { Node } = require('../src/index');

const node = new Node('concurrent')
	.on('error', console.error)
	.on('connect', () => console.log('Connected!'));

node
	.connectTo('hello', 8002)
	.then(socket =>
		Promise.all(
			Array.from({ length: 100 }, (_, i) => {
				// 10 seconds timeout
				const timeout = setTimeout(
					() => console.log(`Timeout reply from: ${i}`),
					10000
				);
				node.sendTo(socket, `Test ${i}`, 1).then(reply => {
					console.log(`Received reply from ${i}:`, reply);
					clearTimeout(timeout);
				});
				return i;
			})
		)
	)
	.catch(() => console.log('Disconnected!'));
