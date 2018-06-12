# IPC-Link Core

**IPC-Link Core** is a lower level version of [IPC-Link](https://github.com/kyranet/ipc-link) that is lightning fast and operates with raw buffers as opposed to sending buffered stringified JSON objects. This library has no dependencies and uses built-in modules (`net`, `events`...) to operate.

In IPC-Link Core, you have "nodes", which can either create a server (and receive messages) or connect to other servers, even both at the same time. Additionally, you have `Node#sendTo(socket, data);` which will wait for the socket to reply back.

## Usage

`hello.js`

```javascript
const { Node } = require('../src/index');

const node = new Node()
	.on('connection', (socket, name) => {
		console.log(`Connected to ${name}`);
		node.sendTo(socket, 'Hello')
			.then(reply => console.log(`Hello ${reply}`));
	})
	.on('listening', console.log.bind(null, 'Listening'))
	.on('message', console.log.bind(null, 'Message'))
	.on('error', console.error.bind(null, 'Error'));
node.serve('hello', 8001);
```

`world.js`

```javascript
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
```

---

The differences with IPC-Link are:

- **IPC-Link Core** does not rely on **node-ipc**, but rather uses `net.Socket`, `net.Server` and `events.EventEmitter`.
- **IPC-Link Core** does not use JSON objects: it uses buffers with headers.
- **IPC-Link Core** does not abstract `net.Socket#connect` nor `net.Server#listen`, as opposed to what **node-ipc** does.
- **IPC-Link Core** does not send a message to a socket if it's not connected, you must connect first (in node-ipc, it attempts to connect using the name, which breaks in many cases and leads to unexpected behaviour).
