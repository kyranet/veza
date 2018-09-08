// This example must be run before interactive/world, since this serves the
// IPC server the other sockets connect to.
const { Node } = require('../src/index');

// eslint-disable-next-line no-unused-vars
const node = new Node('hello')
	.on('client.identify', (client) => console.log(`[IPC] Client Connected: ${client.name}`))
	.on('client.disconnect', (client) => console.log(`[IPC] Client Disconnected: ${client.name}`))
	.on('client.destroy', (client) => console.log(`[IPC] Client Destroyed: ${client.name}`))
	.on('server.ready', (server) => console.log(`[IPC] Client Ready: Named ${server.name}`))
	.on('message', (message) => {
		// console.log(`Received data:`, message.data);
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
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}`, error));

node.serve(8001)
	.catch((error) => console.error('[IPC] Disconnected!', error));
