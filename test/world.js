const { Node } = require('../src/index');

const node = new Node()
	.on('message', console.log)
	.on('error', console.error);
node.connectTo('hello', 8001)
	.then(() => console.log('Connected!'))
	.catch(() => console.log('Disconnected!'));
