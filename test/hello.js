// This example must be run before interactive/world, since this serves the
// IPC server the other sockets connect to.
const { Node } = require('../src/index');

const node = new Node('hello')
	.on('connection', (name, socket) => {
		console.log(`Connected to ${name}`);
		node.sendTo(socket, 'Hello')
			.then(reply => console.log(`Hello ${reply}`));
	})
	.on('listening', console.log.bind(null, 'Listening'))
	.on('message', console.log.bind(null, 'Message'))
	.on('error', console.error.bind(null, 'Error'))
	.on('socketClose', console.log.bind(null, 'Closed Socket:'))
	.serve('hello', 8001);
