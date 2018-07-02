// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".

// This example tests concurrency with parallel messages in IPC.
const { Node } = require('../src/index');

const node = new Node('concurrent')
	.on('message', (message) => {
		console.log(`Received data from ${message.from}:`, message);
		if (message.data === 'Hello')
			message.reply('world!');
	})
	.on('error', console.error)
	.on('connect', () => console.log('Connected!'));

node.connectTo('hello', 8001)
	.then(socket => Promise.all(Array.from({ length: 50 }, () => node.sendTo(socket, 'Test', 1))))
	.then(console.log)
	.catch(() => console.log('Disconnected!'));
