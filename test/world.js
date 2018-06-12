const { Node } = require('../src/index');

new Node()
	.on('message', (message) => {
		console.log(`Received data from ${message.from}:`, message);
		if (message.data === 'Hello')
			message.reply('world!');
	})
	.on('error', console.error)
	.on('connect', () => console.log('Connected!'))
	.connectTo('hello', 8001)
	.catch(() => console.log('Disconnected!'));
