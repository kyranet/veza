const { Node } = require('../src/index');

const node = new Node()
	.on('connection', (name, socket) => {
		console.log(`Connected to ${name}`);
		node.sendTo(socket, 'Hello')
			.then(reply => console.log(`Hello ${reply}`));
	})
	.on('listening', console.log.bind(null, 'Listening'))
	.on('message', console.log.bind(null, 'Message'))
	.on('error', console.error.bind(null, 'Error'));
node.serve('hello', 8001);
