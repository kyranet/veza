const { Node } = require('../src/index');

const node = new Node()
	.on('connection', (_, name) => console.log(`Connected to ${name}`))
	.on('listening', console.log.bind(null, 'Listening'))
	.on('message', console.log.bind(null, 'Message'))
	.on('error', console.error.bind(null, 'Error'));
node.serve('hello', 8001);
