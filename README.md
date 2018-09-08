# Veza

<div align="center">
  <p>
    <a href="https://www.npmjs.com/kyranet/veza"><img src="https://img.shields.io/npm/v/veza.svg?maxAge=3600" alt="NPM version" /></a>
    <a href="https://www.npmjs.com/kyranet/veza"><img src="https://img.shields.io/npm/dt/veza.svg?maxAge=3600" alt="NPM downloads" /></a>
    <a href="https://travis-ci.org/kyranet/veza"><img src="https://travis-ci.org/kyranet/veza.svg" alt="Build status" /></a>
    <a href="https://www.patreon.com/kyranet"><img src="https://img.shields.io/badge/donate-patreon-F96854.svg" alt="Patreon" /></a>
  </p>
  <p>
    <a href="https://nodei.co/npm/veza/"><img src="https://nodei.co/npm/veza.png?downloads=true&stars=true" alt="npm installnfo" /></a>
  </p>
</div>

## About

**Veza** is a lower level version of [IPC-Link](https://github.com/kyranet/ipc-link)
that is lightning fast and operates with raw buffers as opposed to sending buffered
stringified JSON objects. This library has no dependencies and uses built-in modules
(`net`, `events`...) to operate.

In Veza, you have "nodes", which can either create a server (and receive messages)
or connect to other servers, even both at the same time. Additionally, you have
`client.send(data);` which will wait for the socket to reply back.

> One of Veza's special features is the ability to glue truncated messages and split
concatenated messages, for which it uses a 13-bit "header" (encoded in base-256 to
take avantage of the byte range `0x00`-`0xFF`) at the start of every message containing
the id, the datatype, the receptive flag, and the length of the message (4.2gb
maximum size).

## Usage

Check the examples [here](https://github.com/kyranet/veza/tree/master/test) for
working micro **Veza** applications.

`hello.js`

```javascript
const { Node } = require('veza');

const node = new Node('hello')
	.on('client.identify', (client) => console.log(`[IPC] Client Connected: ${client.name}`))
	.on('client.disconnect', (client) => console.log(`[IPC] Client Disconnected: ${client.name}`))
	.on('client.destroy', (client) => console.log(`[IPC] Client Destroyed: ${client.name}`))
	.on('server.ready', (server) => console.log(`[IPC] Client Ready: Named ${server.name}`))
	.on('message', (message) => {
		console.log(`Received data:`, message.data);
		message.reply(message.data);
	})
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}`, error));

node.serve(8001)
	.catch((error) => console.error('[IPC] Disconnected!', error));
```

`world.js`

```javascript
const { Node } = require('veza');

const node = new Node('world')
	.on('error', (error, client) => console.error(`[IPC] Error from ${client.name}:`, error))
	.on('client.disconnect', (client) => console.error(`[IPC] Disconnected from ${client.name}`))
	.on('client.ready', (client) => {
		console.log(`[IPC] Connected to: ${client.name}`);
		client.send('Hello', { timeout: 5000 })
			.then((result) => console.log(`[TEST] Hello ${result}`))
			.catch((error) => console.error(`[TEST] Client send errored: ${error}`));
	});

node.connectTo('hello', 8001)
	.catch((error) => console.error('[IPC] Disconnected!', error));
```

> If you run `hello.js` (aka server), and in another window, `world.js`, world will
connect to hello, once ready, it will send hello "Hello", for which the server will
 reply with "world!", logging from the latter "Hello world!" in the terminal.

---

The differences with IPC-Link are:

- **Veza** does not rely on **node-ipc**, but rather uses `net.Socket`, `net.Server`
and `events.EventEmitter`.
- **Veza** does not use JSON objects: it uses buffers with headers.
- **Veza** does not abstract `net.Socket#connect` nor `net.Server#listen`, as opposed
to what **node-ipc** does.
- **Veza** does not send a message to a socket if it's not connected, you must connect
first (in node-ipc, it attempts to connect using the name, which breaks in many
cases and leads to unexpected behaviour).
- **Veza** supports recurrency as opposed to blocking message queues.

> Originally, **Veza** was called **ipc-link-core**.
