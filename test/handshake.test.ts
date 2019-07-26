import { Node, NodeServerClient, NodeOptions } from '../dist/index';
import { SocketStatus } from '../dist/lib/Util/Constants';
import * as test from 'tape';
import { Socket } from 'net';
import { create } from '../dist/lib/Util/Header';
import { get, createServer } from 'http';
import { serialize } from 'binarytf';
import { URL } from 'url';
import { readFileSync } from 'fs';

let port = 8000;

test('Basic Empty Node', t => {
	t.plan(5);

	const node = new Node('Test', { maxRetries: 10, retryTime: 1000 });
	t.equal(node.name, 'Test', 'Expected name to be Test, as configured.');
	t.equal(node.maxRetries, 10, 'Expected maxRetries to be 10, as configured.');
	t.equal(node.retryTime, 1000, 'Expected retryTime to be 1000, as configured.');
	t.equal(node.server, null, 'Expected server to be null, as it has not served.');
	t.equal(node.servers.size, 0, 'Expected servers to be zero, as it has not connected.');
});

test('Basic Server', { timeout: 5000 }, async t => {
	t.plan(12);

	const node = new Node('Server');

	t.equal(node.server, null, 'The server should be null as this is not serving.');
	try {
		await node.serve(++port);
	} catch (error) {
		t.error(error, 'Server should not crash.');
	}

	// Connected
	t.notEqual(node.server, null, 'The server should now not be null as this is now serving.');
	t.equal(node.server!.clients.size, 0, 'The server should not have a connected client.');
	t.equal(node.server!.name, 'Server', 'The server should be named after the node.');
	t.equal(node.server!.node, node, 'The Servers node should be its parent.');
	t.notEqual(node.server!.server, null, 'The internal server should not be null.');

	try {
		await node.serve(++port);
		t.fail('This call should definitely crash.');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'There is already a server.', 'The error message should match.');
	}

	try {
		await node.server!.connect(++port);
		t.fail('This call should definitely crash.');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'There is already a server.', 'The error message should match.');
	}

	// Disconnected
	t.true(node.server!.disconnect(), 'The disconnection should be successful.');
	t.equal(node.server, null, 'The server should be null as it has disconnected.');
});

test('Basic Socket', { timeout: 5000 }, async t => {
	t.plan(19);

	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');

	// Open server
	try {
		await nodeServer.serve(++port);
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
		t.equal(myServer.node, nodeSocket, 'The node must be the same as the node they come from.');
		t.equal(myServer.status, SocketStatus.Ready, 'The socket should have a status of ready.');
		t.equal(nodeSocket.get('Server'), myServer, 'Node#get should return the same instance.');
		t.equal(nodeSocket.get(myServer), myServer, 'When passing a NodeSocket, Node#get should return it.');

		await new Promise(resolve => {
			nodeServer.once('client.identify', resolve);
		});

		const mySocket = nodeServer.server!.clients.get('Socket')!;
		t.notEqual(mySocket, undefined, 'The node should exist.');
		t.notEqual(mySocket.socket, null, 'The socket should not be null.');
		t.equal(mySocket.name, 'Socket', 'The name of the node must be the name of the socket that connected to this server.');
		t.equal(mySocket.node, nodeServer, 'The node must be the same as the node they come from.');
		t.equal(mySocket.status, SocketStatus.Ready, 'The socket should have a status of ready.');
		t.equal(nodeServer.get('Socket'), mySocket, 'Node#get should return the same instance.');
		t.equal(nodeServer.get(mySocket), mySocket, 'When passing a NodeSocket, Node#get should return it.');
	} catch (error) {
		t.error(error, 'Connection should not error.');
	}

	t.equal(nodeServer.get('Unknown'), null, 'Node#get should return null on unknown nodes.');
	t.equal(nodeSocket.get('Unknown'), null, 'Node#get should return null on unknown nodes.');

	try {
		t.true(nodeServer.server!.disconnect(), 'Successful disconnections should return true.');
		t.true(nodeSocket.disconnectFrom('Server'), 'Successful disconnections should return true.');
	} catch (error) {
		t.error(error, 'Disconnection should not error.');
	}
});

test('Socket Unknown Server Disconnection (Invalid)', { timeout: 5000 }, async t => {
	t.plan(1);

	const nodeSocket = new Node('Socket');
	try {
		nodeSocket.disconnectFrom('Unknown');
	} catch (error) {
		t.equal(error.message, 'The socket Unknown is not connected to this one.',
			'Disconnecting from unconnected sockets should always throw an error.');
	}
});

test('Socket Events', { timeout: 5000 }, async t => {
	t.plan(24);

	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');
	await nodeServer.serve(++port);

	// socket.connect and socket.ready are called when connecting
	nodeSocket.on('socket.connect', client => {
		t.equal(client.name, null, 'Connect is done before the identify step, it is not available until ready.');
		t.equal(client.node, nodeSocket, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Connected, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during connection.');
		t.equal(client.queue.node, nodeSocket, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null during connection.');
	});
	nodeSocket.on('socket.ready', client => {
		t.equal(client.name, 'Server', 'Ready is emitted after the identify step, the name should be available.');
		t.equal(client.node, nodeSocket, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Ready, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty after connection.');
		t.equal(client.queue.node, nodeSocket, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null after connection.');
	});

	await nodeSocket.connectTo(port);
	await new Promise(resolve => {
		nodeServer.once('client.ready', resolve);
	});

	// Test a server outage
	nodeSocket.on('socket.disconnect', client => {
		t.equal(client.name, 'Server', 'The name should always be available, even after being disconnected.');
		t.equal(client.node, nodeSocket, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Disconnected, 'When this event fires, the status should be "Disconnected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during a disconnection.');
		t.equal(client.queue.node, nodeSocket, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null during a disconnection.');
		destroy();
	});
	nodeServer.server!.disconnect();

	function destroy() {
		// Test a socket disconnection
		nodeSocket.on('socket.destroy', client => {
			t.equal(client.name, 'Server', 'The name should always be available, even after being disconnected.');
			t.equal(client.node, nodeSocket, 'The client node should be the parent Node itself.');
			t.equal(client.status, SocketStatus.Destroyed, 'When this event fires, the status should be "Destroyed".');
			t.equal(client.queue.size, 0, 'The queue must be empty during connection.');
			t.equal(client.queue.node, nodeSocket, 'The client queue node should be the parent Node itself.');
			t.equal(client.socket, null, 'The socket should be destroyed and nullified.');
		});
		nodeSocket.disconnectFrom('Server');
	}
});

test('Client Events', { timeout: 5000 }, async t => {
	t.plan(30);

	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');
	await nodeServer.serve(++port);

	// client.connect is called when connecting
	nodeServer.on('client.connect', client => {
		t.equal(client.name, null, 'Connect is done before the identify step, it is not available until ready.');
		t.equal(client.node, nodeServer, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Connected, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during connection.');
		t.equal(client.queue.node, nodeServer, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null during connection.');
	});

	// client.identify and client.ready are called before and after setting to the maps
	nodeServer.on('client.identify', client => {
		t.equal(client.name, 'Socket', 'Ready is emitted after the identify step, the name should be available.');
		t.equal(client.node, nodeServer, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Ready, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty after connection.');
		t.equal(client.queue.node, nodeServer, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null after connection.');
	});
	nodeServer.on('client.ready', client => {
		t.equal(client.name, 'Socket', 'Ready is emitted after the identify step, the name should be available.');
		t.equal(client.node, nodeServer, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Ready, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty after connection.');
		t.equal(client.queue.node, nodeServer, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null after connection.');
	});

	// Connect the socket to the server
	await nodeSocket.connectTo(port);

	nodeServer.on('client.disconnect', client => {
		t.equal(client.name, 'Socket', 'The name should always be available, even after being disconnected.');
		t.equal(client.node, nodeServer, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Disconnected, 'When this event fires, the status should be "Disconnected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during a disconnection.');
		t.equal(client.queue.node, nodeServer, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.socket, null, 'The socket must not be null during a disconnection.');
	});
	nodeServer.on('client.destroy', client => {
		t.equal(client.name, 'Socket', 'The name should always be available, even after being disconnected.');
		t.equal(client.node, nodeServer, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Destroyed, 'When this event fires, the status should be "Destroyed".');
		t.equal(client.queue.size, 0, 'The queue must be empty during a disconnection.');
		t.equal(client.queue.node, nodeServer, 'The client queue node should be the parent Node itself.');
		t.equal(client.socket, null, 'The socket should be destroyed and nullified.');
		destroy();
	});

	nodeSocket.disconnectFrom('Server');

	function destroy() {
		nodeServer.server!.disconnect();
	}
});

test('Server Events', { timeout: 5000 }, async t => {
	t.plan(10);
	const nodeServer = new Node('Server');
	nodeServer.on('server.ready', server => {
		t.equal(server.clients.size, 0, 'The amount of clients at start-up should be 0.');
		t.equal(server.name, 'Server', 'The name of the server should be the same as the Node itself.');
		t.equal(server.node, nodeServer, 'The node of the server should be the node itself.');
		t.notEqual(server.server, null, 'The server should not be null.');
		t.notEqual(nodeServer.server, null, 'Node#server should not be null after ready.');
	});
	await nodeServer.serve(++port);

	nodeServer.on('server.destroy', server => {
		t.equal(server.clients.size, 0, 'The amount of clients at start-up should be 0.');
		t.equal(server.name, 'Server', 'The name of the server should be the same as the Node itself.');
		t.equal(server.node, nodeServer, 'The node of the server should be the node itself.');
		t.equal(server.server, null, 'The server should be destroyed and nullified.');
		t.equal(nodeServer.server, null, 'Node#server should be null after destroy.');
	});

	nodeServer.server!.disconnect();
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

	nodeServer.server!.disconnect();
});

test('Server Double Disconnection', { timeout: 5000 }, async t => {
	t.plan(2);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeServer.server!;

	try {
		t.true(server.disconnect(), 'Successful disconnections should return true.');
		t.false(server.disconnect(), 'A repeated disconnection should return false.');
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
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined, { maxRetries: 3, retryTime: 0 });
	nodeServer.server!.disconnect();

	let attempts = nodeSocket.maxRetries;
	nodeSocket.on('socket.connecting', () => {
		t.true(--attempts >= 0, 'This should reconnect exactly 3 times.');
	});
	nodeSocket.on('socket.disconnect', () => {
		t.pass('The client successfully disconnected.');
	});
});

test('Socket Connection No Retries', { timeout: 5000 }, async t => {
	t.plan(1);
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined, { maxRetries: 0 });
	nodeServer.server!.disconnect();

	nodeSocket.on('socket.connecting', () => {
		t.fail('The socket should not try to connect.');
	});
	nodeSocket.on('socket.disconnect', () => {
		t.pass('The client successfully disconnected.');
	});
});

test('Socket Connection Retries (Successful Reconnect)', { timeout: 7500 }, async t => {
	t.plan(4);
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined, { maxRetries: 3, retryTime: 200 });
	nodeServer.server!.disconnect();

	nodeSocket.once('socket.connecting', () => {
		t.pass('Reconnecting event fired.');
		next();
	});

	async function next() {
		nodeSocket
			.once('socket.connect', () => t.pass('Socket fired connect'))
			.once('socket.ready', () => t.pass('Socket fired Ready'));
		await nodeServer.serve(port);
		await new Promise(resolve => {
			nodeServer.once('client.ready', resolve);
		});
		t.pass('Successfully reconnected the server.');

		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	}
});

test('Socket Connection Retries (Successful Reconnect | Different Name)', { timeout: 7500 }, async t => {
	t.plan(8);
	const [nodeServerFirst, nodeSocket] = await setup(t, ++port, undefined, { maxRetries: 3, retryTime: 200 });

	const socketServer = nodeSocket.get('Server')!;
	t.equal(socketServer.name, 'Server', 'The Server should be "Server".');

	// Disconnect and set up a second server with a different name
	nodeServerFirst.server!.disconnect();
	const nodeServerSecond = new Node('NewServer');

	nodeSocket.once('socket.connecting', () => {
		t.pass('Reconnecting event fired.');
		next();
	});

	async function next() {
		nodeSocket
			.once('socket.connect', () => t.pass('Socket fired connect'))
			.once('socket.ready', () => t.pass('Socket fired Ready'));
		await nodeServerSecond.serve(port);
		await new Promise(resolve => {
			nodeServerSecond.once('client.ready', resolve);
		});
		t.pass('Successfully reconnected the server.');

		t.equal(nodeSocket.get('Server'), null, 'Since the name of the server has changed, the key "Server" should be null.');
		t.equal(nodeSocket.get('NewServer'), socketServer, 'The socket should be available under the key "NewServer".');
		t.equal(socketServer.name, 'NewServer', 'The name for the socket should be changed to "NewServer".');

		nodeServerSecond.server!.disconnect();
		nodeSocket.disconnectFrom('NewServer');
	}
});

test('Socket Connection Retries (Abrupt Close)', { timeout: 7500 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined, { maxRetries: -1, retryTime: 200 });
	nodeServer.server!.disconnect();

	let firedConnecting = false;
	nodeSocket.on('socket.connecting', () => {
		t.false(firedConnecting, 'This should fire only once.');
		firedConnecting = true;
		t.true(nodeSocket.disconnectFrom('Server'), 'Disconnection should be successful.');
	});

	let firedDestroy = false;
	nodeSocket.on('socket.destroy', () => {
		t.false(firedDestroy, 'The socket has been destroyed.');
		firedDestroy = true;
	});
});

test('Server Connection Close', { timeout: 5000 }, async t => {
	t.plan(1);
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined);

	nodeServer.on('client.disconnect', socket => {
		t.equal(socket.name, 'Socket', 'The name of the disconnected socket should be "Socket".');
		finish();
	});
	nodeSocket.disconnectFrom('Server');

	function finish() {
		nodeServer.server!.disconnect();
	}
});

test('HTTP Socket', { timeout: 5000 }, async t => {
	t.plan(1);
	const nodeServer = new Node('Server');
	await nodeServer.serve(++port);

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

	nodeServer.server!.disconnect();
});

test('HTTP Server', { timeout: 5000 }, async t => {
	t.plan(5);
	const nodeSocket = new Node('Socket', { handshakeTimeout: 250 });
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
	const nodeSocket = new Node('Socket', { handshakeTimeout: -1 });
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
	const nodeSocket = new Node('Socket', { handshakeTimeout: -1 });
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
			message.set(serialized, 7);
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
	t.plan(8);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeServer.server!;
	const socket = nodeServer.get('Socket')! as NodeServerClient;

	t.equal(server.get('Socket'), socket, 'The socket is called "Socket", and got found.');
	t.equal(server.get(socket), socket, 'Retrieving the NodeServerClient instance itself should return it.');
	t.equal(server.get(socket.socket!), socket, "Retrieving the NodeServerClient's socket should try to find the instance that manages it.");

	const forgedSocket = new Socket();
	t.equal(server.get(forgedSocket), null, 'A socket that does not belong to the NodeServer should return null.');
	forgedSocket.destroy();

	t.true(server.has('Socket'), 'The socket "Socket" is connected to this server.');
	t.false(server.has('Foo'), 'The socket "Foo" is not connected to this server.');

	try {
		// TypeScript ignoring since this is an assertion for JavaScript users
		// @ts-ignore
		server.get(0);
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof TypeError, 'The error should be an instance of TypeError.');
		t.equal(error.message, 'Expected a string, NodeServerClient, or Socket.',
			'An invalid NodeServer#get throws a TypeError explaining what was wrong.');
	}

	nodeServer.server!.disconnect();
	nodeSocket.disconnectFrom('Server');
});

test('Socket Message', { timeout: 5000 }, async t => {
	t.plan(15);
	const [nodeServer, nodeSocket] = await setup(t, ++port);

	// Test receptive (default) message delivery
	{
		nodeServer.once('message', message => {
			t.true(message.receptive, 'The message was sent as receptive.');
			t.equal(message.node, nodeServer, 'The messages node should be the server node.');
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
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');

		try {
			await server.send('Foo', { receptive: false });
			t.fail('Messages to a disconnected socket should fail.');
		} catch (error) {
			t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
			t.equal(error.message, 'This NodeSocket is not connected to a socket.');
		}

		try {
			await socket.send('Foo', { receptive: false });
			t.fail('Messages to a disconnected socket should fail.');
		} catch (error) {
			t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
			t.equal(error.message, 'This NodeSocket is not connected to a socket.');
		}
	}
});

test('Socket Unknown Server Message Sending (Invalid)', { timeout: 5000 }, async t => {
	t.plan(1);

	const nodeSocket = new Node('Socket');

	try {
		await nodeSocket.sendTo('Unknown', 'Foo');
	} catch (error) {
		t.equal(error.message, 'The socket Unknown is not available or not connected to this Node.',
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
		const response = await nodeServer.server!.sendTo('Socket', 'Foo', { timeout: 250 });
		t.equal(response, 'Bar');
	} catch (error) {
		t.error(error, 'This should not fail.');
	}

	try {
		await nodeServer.server!.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this Node.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	nodeServer.server!.disconnect();
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
		const response = await nodeServer.server!.sendTo('Socket', buffer, { timeout: 250 });
		t.equal(response, buffer.byteLength);
	} catch (error) {
		t.error(error, 'This should not fail.');
	}

	try {
		await nodeServer.server!.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this Node.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	nodeServer.server!.disconnect();
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
			nodeServer.server!.sendTo('Socket', bufferLogo, { timeout: 250 }),
			nodeServer.server!.sendTo('Socket', bufferTest, { timeout: 250 })
		]);
		t.equal(responseLogo, bufferLogo.byteLength);
		t.equal(responseTest, bufferTest.byteLength);
	} catch (error) {
		t.error(error, 'This should not fail.');
	}

	try {
		await nodeServer.server!.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this Node.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	nodeServer.server!.disconnect();
	nodeSocket.disconnectFrom('Server');
});

test('Socket Faulty Message', { timeout: 5000 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	nodeServer.on('error', (error, socket) => {
		t.equal(socket.name, 'Socket');
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to process message.',
			'Faulty messages after having connected fire the error event, but does not disconnect.');
		finish();
	});

	// Send faulty message
	nodeSocket.get('Server')!.socket!.write(create(false, new Uint8Array([0xFF, 0xFF])));

	function finish() {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	}
});

test('Server Faulty Message', { timeout: 5000 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	nodeSocket.on('error', (error, socket) => {
		t.equal(socket.name, 'Server');
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to process message.',
			'Faulty messages after having connected fire the error event, but does not disconnect.');
		finish();
	});

	// Send faulty message
	nodeServer.get('Socket')!.socket!.write(create(false, new Uint8Array([0xFF, 0xFF])));

	function finish() {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	}
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

	nodeServer.server!.disconnect();
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

	nodeServer.server!.disconnect();
	nodeSocket.disconnectFrom('Server');
});

test('Message Broadcast (From Server)', { timeout: 5000 }, async t => {
	t.plan(9);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeServer.server!;

	nodeSocket.once('message', message => {
		t.equal(message.data, 'Foo', 'Message is exactly the one sent');
		t.equal(message.receptive, true, 'Message keeps its receptive value');
		message.reply('Bar');
	});

	try {
		const response = await server.broadcast('Foo');
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 1, 'There is only one connected socket, therefore it should be an array with one value.');
		t.equal(response[0], 'Bar', 'The socket responded with "Bar", therefore the first entry should be the same.');
	} catch (error) {
		t.error(error, 'Message broadcast failed');
	}

	try {
		const response = await server.broadcast('Foo', { filter: /NothingMatches/ });
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 0, 'There is only one connected socket, but the filter does not match any one.');
	} catch (error) {
		t.error(error, 'Message broadcast failed');
	}

	try {
		// TypeScript ignoring since this is an assertion for JavaScript users
		// @ts-ignore
		await server.broadcast('Foo', { filter: 'HelloWorld' });
	} catch (error) {
		t.true(error instanceof TypeError, 'The error should be an instance of TypeError.');
		t.equal(error.message, 'filter must be a RegExp instance.',
			'An invalid Node#broadcast filter option throws a TypeError explaining what was wrong.');
	}

	nodeServer.server!.disconnect();
	nodeSocket.disconnectFrom('Server');
});

test('Message Broadcast (No Server)', { timeout: 5000 }, async t => {
	t.plan(2);
	const nodeSocket = new Node('Socket');

	const response = await nodeSocket.broadcast('Foo');
	t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
	t.equal(response.length, 0, 'There is no server, therefore this should always be an empty array.');
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

	nodeServer.server!.disconnect();
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

	nodeServer.server!.disconnect();
});

test('Duplicated Socket', { timeout: 5000 }, async t => {
	t.plan(1);
	const [nodeServer, nodeSocketFirst] = await setup(t, ++port, undefined);
	const nodeSocketSecond = new Node('Socket');

	nodeSocketFirst.once('socket.disconnect', () => {
		t.pass('The socket has been disconnected.');
		finish();
	});

	await nodeSocketSecond.connectTo(port);

	function finish() {
		nodeServer.server!.disconnect();
		nodeSocketFirst.disconnectFrom('Server');
		nodeSocketSecond.disconnectFrom('Server');
	}
});

async function setup(t: test.Test, port: number, serverNodeOptions?: NodeOptions, socketNodeOptions?: NodeOptions) {
	const nodeServer = new Node('Server', serverNodeOptions);
	const nodeSocket = new Node('Socket', socketNodeOptions);

	try {
		// Open server
		await nodeServer.serve(port);
		await nodeSocket.connectTo(port);

		await new Promise(resolve => {
			nodeServer.once('client.ready', resolve);
		});
	} catch {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
		t.end('Unable to test: TCP Connection Failed.');
	}

	return [nodeServer, nodeSocket];
}
