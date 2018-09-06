// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".
const { Node } = require('../src/index');

const node = new Node('world')
	.on('message', message => {
		console.log(`Received data from ${message.from}:`, message);
		if (message.data === 'Hello') message.reply('world!');
	})
	.on('error', console.error)
	.on('connect', () => console.log('Connected!'));

node.connectTo('hello', 8001)
	.catch(() => console.log('Disconnected!'));
