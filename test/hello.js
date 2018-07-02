// This example must be run before interactive/world, since this serves the
// IPC server the other sockets connect to.
const { Node } = require('../src/index');

// eslint-disable-next-line no-unused-vars
const node = new Node('hello')
	.on('connection', (name) => {
		console.log(`Connected to ${name}`);
	})
	.on('listening', console.log.bind(null, 'Listening'))
	.on('message', message => {
		console.log(`Received data:`, message);
		// For World.js test
		if (message.data === 'Hello') {
			message.reply('world!');
		} else {
			setTimeout(
				() => message.reply(`Reply!: ${message.data}`),
				Math.min(9000, Math.floor(Math.random() * 1000))
			);
		}
	})
	.on('error', console.error.bind(null, 'Error'))
	.on('socketClose', console.log.bind(null, 'Closed Socket:'))
	.serve('hello', 8002);
