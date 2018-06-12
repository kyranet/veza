const { Node } = require('../src/index');

new Node()
	.on('message', (message) => {
		console.log(`Received data from ${message.from}:`, message);
		if (message.data === 'Hello')
			message.reply('world!');
	})
	.on('error', console.error)
	.connectTo('hello', 8001)
	.then(() => console.log('Connected!'))
	.catch(() => console.log('Disconnected!'));
