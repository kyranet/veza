// This example depends on hello.js to be running in another process.
// This Node is a socket that replies to hello.js with "world!" when it receives "Hello".
// And uses readline to send messages to the other process.
const { Node } = require('../src/index');
const readline = require('readline');

const node = new Node('interactive')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('client.disconnect', client => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('client.ready', client => console.log(`[IPC] Connected to: ${client.name}`))
	.on('message', message => {
		console.log(`Received data from ${message.from}:`, message);
		if (message.data === 'Hello') {
			message.reply('Interactive World Working!');
			process.stdout.write('> ');
		}
	});

// Connect to hello
node.connectTo('hello', 8001)
	.catch(() => console.log('Disconnected!'));

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.on('line', line => {
	if (line) node.sendTo('hello', line, false);
	process.stdout.write('> ');
});
