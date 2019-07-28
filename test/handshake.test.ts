import { Server, Client, NodeClientOptions, ServerClientStatus, ClientSocketStatus } from '../dist/index';
import * as test from 'tape';
import { create } from '../dist/lib/Util/Header';
import { get, createServer } from 'http';
import { serialize } from 'binarytf';
import { URL } from 'url';
import { readFileSync } from 'fs';

let port = 8000;

test('Basic Server', { timeout: 5000 }, async t => {
	t.plan(5);

	const nodeServer = new Server('Server');

	try {
		await nodeServer.open(++port);
	} catch (error) {
		t.error(error, 'Server should not crash.');
	}

	// Connected
	t.equal(nodeServer.clients.size, 0, 'The server should not have a connected client.');
	t.equal(nodeServer.name, 'Server', 'The server should be named after the node.');

	try {
		await nodeServer.open(++port);
		t.fail('This call should definitely crash.');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Listen method has been called more than once without closing.', 'The error message should match.');
	}

	// Disconnected
	t.true(await nodeServer.close(), 'The disconnection should be successful.');
});

test('Basic Socket', { timeout: 5000 }, async t => {
	t.plan(16);

	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket');

	// Open server
	try {
		await nodeServer.open(++port);
	} catch (error) {
		t.error(error, 'Server should not crash.');
	}

	try {
		await nodeSocket.connectTo(port);
		t.equal(nodeSocket.servers.size, 1);

		const myServer = nodeSocket.servers.get('Server')!;
		t.notEqual(myServer, undefined, 'The node should exist.');
		t.notEqual(myServer.socket, null, 'The socket should not be null.');
		t.equal(myServer.name, 'Server', 'The name of the node must be the name of the server.');
		t.equal(myServer.status, ClientSocketStatus.Ready, 'The socket should have a status of ready.');
		t.equal(nodeSocket.get('Server'), myServer, 'Node#get should return the same instance.');
		t.equal(nodeSocket.get(myServer), myServer, 'When passing a NodeSocket, Node#get should return it.');

		await new Promise(resolve => {
			nodeServer.once('connect', resolve);
		});

		const mySocket = nodeServer.clients.get('Socket')!;
		t.notEqual(mySocket, undefined, 'The node should exist.');
		t.notEqual(mySocket.socket, null, 'The socket should not be null.');
		t.equal(mySocket.name, 'Socket', 'The name of the node must be the name of the socket that connected to this server.');
		t.equal(mySocket.status, ServerClientStatus.Connected, 'The socket should have a status of ready.');
		t.equal(nodeServer.get('Socket'), mySocket, 'Node#get should return the same instance.');
		t.equal(nodeServer.get(mySocket), mySocket, 'When passing a NodeSocket, Node#get should return it.');
	} catch (error) {
		t.error(error, 'Connection should not error.');
	}

	t.equal(nodeServer.get('Unknown'), null, 'Node#get should return null on unknown nodes.');
	t.equal(nodeSocket.get('Unknown'), null, 'Node#get should return null on unknown nodes.');

	try {
		await nodeServer.close();
		t.true(nodeSocket.disconnectFrom('Server'), 'Successful disconnections should return true.');
	} catch (error) {
		t.error(error, 'Disconnection should not error.');
	}
});

test('Socket Unknown Server Disconnection (Invalid)', { timeout: 5000 }, async t => {
	t.plan(1);

	const nodeSocket = new Client('Socket');
	try {
		nodeSocket.disconnectFrom('Unknown');
	} catch (error) {
		t.equal(error.message, 'The socket Unknown is not connected to this one.',
			'Disconnecting from unconnected sockets should always throw an error.');
	}
});

test('Socket Events', { timeout: 5000 }, async t => {
	t.plan(11);

	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket', { maximumRetries: 0 });
	await nodeServer.open(++port);

	// socket.connect and socket.ready are called when connecting
	nodeSocket.on('connect', client => {
		t.equal(client.name, null, 'Connect is done before the identify step, it is not available until ready.');
		t.equal(client.status, ClientSocketStatus.Connected, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during connection.');
		t.notEqual(client.socket, null, 'The socket must not be null during connection.');
	});
	nodeSocket.on('ready', client => {
		t.equal(client.name, 'Server', 'Ready is emitted after the identify step, the name should be available.');
		t.equal(client.status, ClientSocketStatus.Ready, 'When this event fires, the status should be "Ready".');
		t.equal(client.queue.size, 0, 'The queue must be empty after connection.');
		t.notEqual(client.socket, null, 'The socket must not be null after connection.');
	});

	await nodeSocket.connectTo(port);
	await new Promise(resolve => {
		nodeServer.once('connect', resolve);
	});

	// Test a server outage
	nodeSocket.on('disconnect', client => {
		t.equal(client.name, 'Server', 'The name should always be available, even after being disconnected.');
		t.equal(client.status, ClientSocketStatus.Disconnected, 'When this event fires, the status should be "Disconnected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during a disconnection.');
	});
	await nodeServer.close();
});

test('Client Events', { timeout: 5000 }, async t => {
	t.plan(6);

	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket');
	await nodeServer.open(++port);

	// client.connect is called when connecting
	nodeServer.on('connect', client => {
		t.equal(client.name, 'Socket', 'Connect is done after the identify step, the name should be available.');
		t.equal(client.status, ServerClientStatus.Connected, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during connection.');
	});

	// Connect the socket to the server
	await nodeSocket.connectTo(port);
	nodeServer.on('disconnect', async client => {
		t.equal(client.name, 'Socket', 'The name should always be available, even after being disconnected.');
		t.equal(client.status, ServerClientStatus.Disconnected, 'When this event fires, the status should be "Disconnected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during a disconnection.');
		await nodeServer.close();
	});

	nodeSocket.disconnectFrom('Server');
});

test('Server Events', { timeout: 5000 }, async t => {
	t.plan(4);
	const nodeServer = new Server('Server');
	nodeServer.on('open', () => {
		t.equal(nodeServer.clients.size, 0, 'The amount of clients at start-up should be 0.');
		t.equal(nodeServer.name, 'Server', 'The name of the server should be the same as the Node itself.');
	});
	await nodeServer.open(++port);

	nodeServer.on('close', () => {
		t.equal(nodeServer.clients.size, 0, 'The amount of clients at start-up should be 0.');
		t.equal(nodeServer.name, 'Server', 'The name of the server should be the same as the Node itself.');
	});

	await nodeServer.close();
});

test('Socket Double Disconnection', { timeout: 5000 }, async t => {
	t.plan(2);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeSocket.get('Server')!;

	try {
		t.true(server.disconnect(), 'Successful disconnections should return true.');
		t.false(server.disconnect(), 'A repeated disconnection should return false.');
	} catch (error) {
		t.error(error, 'Disconnections from NodeSocket should never throw an error.');
	}

	await nodeServer.close();
});

test('Server Double Disconnection', { timeout: 5000 }, async t => {
	t.plan(2);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeServer;

	try {
		t.true(await server.close(), 'Successful disconnections should return true.');
		t.false(await server.close(), 'A repeated disconnection should return false.');
	} catch (error) {
		t.error(error, 'Disconnections from NodeSocket should never throw an error.');
	}

	try {
		nodeSocket.disconnectFrom('Server');
	} catch (error) {
		t.error(error, 'Disconnection should not error.');
	}
});

test('Socket Connection Retries', { timeout: 7500 }, async t => {
	t.plan(4);
	const [nodeServer, nodeSocket] = await setup(t, ++port, { maximumRetries: 3, retryTime: 0 });
	await nodeServer.close();

	let attempts = nodeSocket.maximumRetries;
	nodeSocket.on('connecting', () => {
		t.true(--attempts >= 0, 'This should reconnect exactly 3 times.');
	});
	nodeSocket.on('disconnect', () => {
		t.pass('The client successfully disconnected.');
	});
});

test('Socket Connection No Retries', { timeout: 5000 }, async t => {
	t.plan(1);
	const [nodeServer, nodeSocket] = await setup(t, ++port, { maximumRetries: 0 });
	await nodeServer.close();

	nodeSocket.on('connecting', () => {
		t.fail('The socket should not try to connect.');
	});
	nodeSocket.on('disconnect', () => {
		t.pass('The client successfully disconnected.');
	});
});

test('Socket Connection Retries (Successful Reconnect)', { timeout: 7500 }, async t => {
	t.plan(4);
	const [nodeServer, nodeSocket] = await setup(t, ++port, { maximumRetries: 3, retryTime: 200 });
	await nodeServer.close();

	nodeSocket.once('connecting', () => {
		t.pass('Reconnecting event fired.');
		next();
	});

	async function next() {
		nodeSocket
			.once('connect', () => t.pass('Socket fired connect'))
			.once('ready', () => t.pass('Socket fired Ready'));
		await nodeServer.open(port);
		await new Promise(resolve => {
			nodeServer.once('connect', resolve);
		});
		t.pass('Successfully reconnected the server.');

		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
	}
});

test('Socket Connection Retries (Successful Reconnect | Different Name)', { timeout: 7500 }, async t => {
	t.plan(8);
	const [nodeServerFirst, nodeSocket] = await setup(t, ++port, { maximumRetries: 3, retryTime: 200 });

	const socketServer = nodeSocket.get('Server')!;
	t.equal(socketServer.name, 'Server', 'The Server should be "Server".');

	// Disconnect and set up a second server with a different name
	await nodeServerFirst.close();
	const nodeServerSecond = new Server('NewServer');

	nodeSocket.once('connecting', async () => {
		t.pass('Reconnecting event fired.');
		nodeSocket
			.once('connect', () => t.pass('Socket fired connect'))
			.once('ready', () => t.pass('Socket fired Ready'));
		await nodeServerSecond.open(port);
		await new Promise(resolve => {
			nodeServerSecond.once('connect', resolve);
		});
		t.pass('Successfully reconnected the server.');

		t.equal(nodeSocket.get('Server'), null, 'Since the name of the server has changed, the key "Server" should be null.');
		t.equal(nodeSocket.get('NewServer'), socketServer, 'The socket should be available under the key "NewServer".');
		t.equal(socketServer.name, 'NewServer', 'The name for the socket should be changed to "NewServer".');

		await nodeServerSecond.close();
		nodeSocket.disconnectFrom('NewServer');
	});
});

test('Socket Connection Retries (Abrupt Close)', { timeout: 7500 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port, { maximumRetries: -1, retryTime: 200 });
	await nodeServer.close();

	let firedConnecting = false;
	nodeSocket.on('connecting', () => {
		t.false(firedConnecting, 'This should fire only once.');
		firedConnecting = true;
		t.true(nodeSocket.disconnectFrom('Server'), 'Disconnection should be successful.');
	});

	let firedDestroy = false;
	nodeSocket.on('disconnect', () => {
		t.false(firedDestroy, 'The socket has been disconnected.');
		firedDestroy = true;
	});
});

test('Server Connection Close', { timeout: 5000 }, async t => {
	t.plan(1);
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined);

	nodeServer.on('disconnect', async socket => {
		t.equal(socket.name, 'Socket', 'The name of the disconnected socket should be "Socket".');
		await nodeServer.close();
	});
	nodeSocket.disconnectFrom('Server');
});

test('HTTP Socket', { timeout: 5000 }, async t => {
	t.plan(1);
	const nodeServer = new Server('Server');
	await nodeServer.open(++port);

	try {
		await new Promise((resolve, reject) => {
			get(new URL(`http://localhost:${port}`), resolve)
				.on('close', resolve)
				.on('error', reject);
		});
		t.fail('This should not be called.');
	} catch (error) {
		t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
	}

	await nodeServer.close();
});

test('HTTP Server', { timeout: 5000 }, async t => {
	t.plan(5);
	const nodeSocket = new Client('Socket', { handshakeTimeout: 250 });
	const server = createServer(() => {
		t.fail('This should not be called - in Veza, the server sends the message, and the socket replies.');
	});
	server
		.on('connection', () => t.pass('A connection should be able to be made.'))
		.on('close', () => t.pass('A connection should be closed.'));

	await new Promise(resolve => server.listen(++port, resolve));

	try {
		await nodeSocket.connectTo(port);
		t.fail('The connection should not be successful.');
	} catch (error) {
		t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
		t.equal(error.message, 'Connection Timed Out.',
			'Servers like HTTP ones do not send a message upon connection, so a server that does not send anything is expected to time out.');
	}

	server.close(error => {
		t.equal(error, undefined, 'There should not be an error with closing the server.');
	});
});

test('HTTP Server (Incorrect Handshake)', { timeout: 5000 }, async t => {
	t.plan(5);
	const nodeSocket = new Client('Socket', { handshakeTimeout: -1 });
	const server = createServer(() => {
		t.fail('This should not be called - in Veza, the server sends the message, and the socket replies.');
	});
	server
		.on('close', () => t.pass('A connection should be closed.'))
		.on('connection', socket => {
			t.pass('A connection should be able to be made.');
			socket.write(Buffer.from('Hello World!'));
		});

	await new Promise(resolve => server.listen(++port, resolve));

	try {
		await nodeSocket.connectTo(port);
		t.fail('The connection should not be successful.');
	} catch (error) {
		t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
		t.equal(error.message, 'Unexpected response from the server.',
			'The message sent by the HTTP server is not binaryTF, therefore this should fail.');
	}

	server.close(error => {
		t.equal(error, undefined, 'There should not be an error with closing the server.');
	});
});

test('HTTP Server (Malicious Forged Handshake)', { timeout: 5000 }, async t => {
	t.plan(5);
	const nodeSocket = new Client('Socket', { handshakeTimeout: -1 });
	const server = createServer(() => {
		t.fail('This should not be called - in Veza, the server sends the message, and the socket replies.');
	});
	server
		.on('close', () => t.pass('A connection should be closed.'))
		.on('connection', socket => {
			t.pass('A connection should be able to be made.');
			const serialized = serialize(420);
			const message = new Uint8Array(11 + serialized.byteLength);
			message[6] = 1;
			message.set(serialized, 11);
			socket.write(message);
		});

	await new Promise(resolve => server.listen(++port, resolve));

	try {
		await nodeSocket.connectTo(port);
		t.fail('The connection should not be successful.');
	} catch (error) {
		t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
		t.equal(error.message, 'Unexpected response from the server.',
			'The message sent by the HTTP server is not binaryTF, therefore this should fail.');
	}

	server.close(error => {
		t.equal(error, undefined, 'There should not be an error with closing the server.');
	});
});

test('NodeServer Socket Retrieval', { timeout: 5000 }, async t => {
	t.plan(6);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const socket = nodeServer.get('Socket')!;

	t.equal(nodeServer.get('Socket'), socket, 'The socket is called "Socket", and got found.');
	t.equal(nodeServer.get(socket), socket, 'Retrieving the NodeServerClient instance itself should return it.');

	t.true(nodeServer.has('Socket'), 'The socket "Socket" is connected to this server.');
	t.false(nodeServer.has('Foo'), 'The socket "Foo" is not connected to this server.');

	try {
		// TypeScript ignoring since this is an assertion for JavaScript users
		// @ts-ignore
		nodeServer.get(0);
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof TypeError, 'The error should be an instance of TypeError.');
		t.equal(error.message, 'Expected a string or a ServerClient instance.',
			'An invalid NodeServer#get throws a TypeError explaining what was wrong.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Socket Message', { timeout: 5000 }, async t => {
	t.plan(14);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	// Test receptive (default) message delivery
	{
		nodeServer.once('message', message => {
			t.true(message.receptive, 'The message was sent as receptive.');
			t.equal(message.data, 'Hello');
			message.reply('World');

			const json = message.toJSON();
			t.equal(json.id, message.id, 'The values from NodeMessage#toJSON and the ones from NodeMessage must be the same.');
			t.equal(json.data, message.data, 'The values from NodeMessage#toJSON and the ones from NodeMessage must be the same.');
			t.equal(json.receptive, message.receptive, 'The values from NodeMessage#toJSON and the ones from NodeMessage must be the same.');

			t.equal(message.toString(), `NodeMessage<${message.id}>`);
		});

		const response = await nodeSocket.sendTo('Server', 'Hello') as string;
		t.equal(response, 'World');
	}

	// Test non-receptive message delivery
	{
		nodeServer.once('message', message => {
			t.false(message.receptive, 'The message was sent as not receptive.');
			t.equal(message.data, 'Foo');
			message.reply('Bar');

			// Finish the tests
			finish();
		});

		const response = await nodeSocket.sendTo('Server', 'Foo', { receptive: false }) as undefined;
		t.equal(response, undefined);
	}

	async function finish() {
		const server = nodeSocket.get('Server')!;
		const socket = nodeServer.get('Socket')!;
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');

		try {
			await server.send('Foo', { receptive: false });
			t.fail('Messages to a disconnected socket should fail.');
		} catch (error) {
			t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
			t.equal(error.message, 'Cannot send a message to a missing socket.');
		}

		try {
			await socket.send('Foo', { receptive: false });
			t.fail('Messages to a disconnected socket should fail.');
		} catch (error) {
			t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
			t.equal(error.message, 'Cannot send a message to a missing socket.');
		}
	}
});

test('Socket Unknown Server Message Sending (Invalid)', { timeout: 5000 }, async t => {
	t.plan(1);

	const nodeSocket = new Client('Socket');

	try {
		await nodeSocket.sendTo('Unknown', 'Foo');
	} catch (error) {
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this client.',
			'Sending messages to unconnected sockets should always throw an error.');
	}
});

test('Server Messages', { timeout: 5000 }, async t => {
	t.plan(5);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	nodeSocket.on('message', message => {
		t.equal(message.receptive, true, 'The message was sent as receptive.');
		t.equal(message.data, 'Foo', 'The message should match with the value.');
		message.reply('Bar');
	});

	try {
		const response = await nodeServer.sendTo('Socket', 'Foo', { timeout: 250 });
		t.equal(response, 'Bar');
	} catch (error) {
		t.error(error, 'This should not fail.');
	}

	try {
		await nodeServer.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this server.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Server Message (Large Buffer)', { timeout: 5000 }, async t => {
	t.plan(5);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const buffer = readFileSync('./static/logo.png');

	nodeSocket.on('message', message => {
		t.equal(message.receptive, true, 'The message was sent as receptive.');
		t.same(message.data, buffer, 'The message should match with the value.');
		message.reply(message.data.byteLength);
	});

	try {
		const response = await nodeServer.sendTo('Socket', buffer, { timeout: 250 });
		t.equal(response, buffer.byteLength);
	} catch (error) {
		t.error(error, 'This should not fail.');
	}

	try {
		await nodeServer.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this server.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Server Message (Multiple Large Buffer)', { timeout: 5000 }, async t => {
	t.plan(8);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const bufferLogo = readFileSync('./static/logo.png');
	const bufferTest = readFileSync('./test/test.png');

	let receivedFirst = false;
	nodeSocket.on('message', message => {
		t.equal(message.receptive, true, 'The message was sent as receptive.');
		if (receivedFirst) {
			t.same(message.data, bufferTest, 'The message should match with the value.');
		} else {
			t.same(message.data, bufferLogo, 'The message should match with the value.');
			receivedFirst = true;
		}
		message.reply(message.data.byteLength);
	});

	try {
		const [responseLogo, responseTest] = await Promise.all([
			nodeServer.sendTo('Socket', bufferLogo, { timeout: 250 }),
			nodeServer.sendTo('Socket', bufferTest, { timeout: 250 })
		]);
		t.equal(responseLogo, bufferLogo.byteLength);
		t.equal(responseTest, bufferTest.byteLength);
	} catch (error) {
		t.error(error, 'This should not fail.');
	}

	try {
		await nodeServer.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this server.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Socket Faulty Message', { timeout: 5000 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	nodeServer.on('error', async (error, socket) => {
		t.equal(socket!.name, 'Socket');
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to parse message: Unknown type received: 255 [UnknownType]',
			'Faulty messages after having connected fire the error event, but does not disconnect.');
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
	});

	// Send faulty message
	nodeSocket.get('Server')!.socket!.write(create(false, new Uint8Array([0xFF, 0xFF])));
});

test('Server Faulty Message', { timeout: 5000 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	nodeSocket.on('error', async (error, socket) => {
		t.equal(socket!.name, 'Server');
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to parse message: Unknown type received: 255 [UnknownType]',
			'Faulty messages after having connected fire the error event, but does not disconnect.');
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
	});

	// Send faulty message
	nodeServer.get('Socket')!.socket!.write(create(false, new Uint8Array([0xFF, 0xFF])));
});

test('Socket Concurrent Messages', { timeout: 5000 }, async t => {
	t.plan(6);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	const messages = ['Hello', 'High'];
	const replies = ['World', 'Five!'];
	nodeServer.on('message', message => {
		t.equal(message.receptive, true, 'The message was sent as receptive.');
		t.equal(message.data, messages.shift(), 'The message should match with the value.');
		message.reply(replies.shift());
	});

	const [first, second] = await Promise.all([
		nodeSocket.sendTo('Server', messages[0]),
		nodeSocket.sendTo('Server', messages[1])
	]);
	t.equal(first, 'World');
	t.equal(second, 'Five!');

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Message Broadcast', { timeout: 5000 }, async t => {
	t.plan(9);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	nodeSocket.once('message', message => {
		t.equal(message.data, 'Foo', 'Message is exactly the one sent');
		t.equal(message.receptive, true, 'Message keeps its receptive value');
		message.reply('Bar');
	});

	try {
		const response = await nodeServer.broadcast('Foo');
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 1, 'There is only one connected socket, therefore it should be an array with one value.');
		t.equal(response[0], 'Bar', 'The socket responded with "Bar", therefore the first entry should be the same.');
	} catch (error) {
		t.error(error, 'Message broadcast failed');
	}

	try {
		const response = await nodeServer.broadcast('Foo', { filter: /NothingMatches/ });
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 0, 'There is only one connected socket, but the filter does not match any one.');
	} catch (error) {
		t.error(error, 'Message broadcast failed');
	}

	try {
		// TypeScript ignoring since this is an assertion for JavaScript users
		// @ts-ignore
		await nodeServer.broadcast('Foo', { filter: 'HelloWorld' });
	} catch (error) {
		t.true(error instanceof TypeError, 'The error should be an instance of TypeError.');
		t.equal(error.message, 'filter must be a RegExp instance.',
			'An invalid Node#broadcast filter option throws a TypeError explaining what was wrong.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Message Broadcast (From Server)', { timeout: 5000 }, async t => {
	t.plan(9);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	nodeSocket.once('message', message => {
		t.equal(message.data, 'Foo', 'Message is exactly the one sent');
		t.equal(message.receptive, true, 'Message keeps its receptive value');
		message.reply('Bar');
	});

	try {
		const response = await nodeServer.broadcast('Foo');
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 1, 'There is only one connected socket, therefore it should be an array with one value.');
		t.equal(response[0], 'Bar', 'The socket responded with "Bar", therefore the first entry should be the same.');
	} catch (error) {
		t.error(error, 'Message broadcast failed');
	}

	try {
		const response = await nodeServer.broadcast('Foo', { filter: /NothingMatches/ });
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 0, 'There is only one connected socket, but the filter does not match any one.');
	} catch (error) {
		t.error(error, 'Message broadcast failed');
	}

	try {
		// TypeScript ignoring since this is an assertion for JavaScript users
		// @ts-ignore
		await nodeServer.broadcast('Foo', { filter: 'HelloWorld' });
	} catch (error) {
		t.true(error instanceof TypeError, 'The error should be an instance of TypeError.');
		t.equal(error.message, 'filter must be a RegExp instance.',
			'An invalid Node#broadcast filter option throws a TypeError explaining what was wrong.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Message Timeout', { timeout: 5000 }, async t => {
	t.plan(4);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	try {
		await nodeSocket.sendTo('Server', 'Foo', { timeout: 250 });
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Timed out.', 'The server does not reply this one on purpose.');
	}

	nodeServer.on('message', message => {
		message.reply('Bar');
	});

	try {
		const response = await nodeSocket.sendTo('Server', 'Foo', { timeout: 250 });
		t.equal(response, 'Bar', 'The server replied with "Bar", so this should be "Bar".');
	} catch (error) {
		t.error(error, 'The socket should not error.');
	}

	try {
		// Timeout -1 means no timeout
		const response = await nodeSocket.sendTo('Server', 'Foo', { timeout: -1 });
		t.equal(response, 'Bar', 'The server replied with "Bar", so this should be "Bar".');
	} catch (error) {
		t.error(error, 'The socket should not error.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Abrupt Disconnection (Disconnected Without Clearing Messages)', { timeout: 5000 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	nodeServer.on('message', message => {
		message.reply('Bar');
	});

	try {
		const promise = nodeSocket.sendTo('Server', 'Foo');
		t.true(nodeSocket.disconnectFrom('Server'), 'Successful disconnections should return true.');
		await promise;
		t.fail('The message should fail due to the server connection being cut.');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Socket has been disconnected.', 'The error message is thrown from NodeSocket.');
	}

	await nodeServer.close();
});

test('Duplicated Socket', { timeout: 5000 }, async t => {
	t.plan(1);
	const [nodeServer, nodeSocketFirst] = await setup(t, ++port, undefined);
	const nodeSocketSecond = new Client('Socket');

	nodeSocketFirst.once('disconnect', async () => {
		t.pass('The socket has been disconnected.');
		await nodeServer.close();
		nodeSocketSecond.disconnectFrom('Server');
	});

	await nodeSocketSecond.connectTo(port);
});

async function setup(t: test.Test, port: number, socketNodeOptions?: NodeClientOptions): Promise<[Server, Client]> {
	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket', socketNodeOptions);

	try {
		// Open server
		await nodeServer.open(port);
		await nodeSocket.connectTo(port);

		await new Promise(resolve => {
			nodeServer.once('connect', resolve);
		});
	} catch {
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
		t.end('Unable to test: TCP Connection Failed.');
	}

	return [nodeServer, nodeSocket];
}
