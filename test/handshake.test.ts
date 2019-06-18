import { Node, NodeServerClient, NodeOptions } from '../dist/index';
import { SocketStatus } from '../dist/lib/Util/Constants';
import * as test from 'tape';
import { Socket } from 'net';
import { create } from '../dist/lib/Util/Header';
import { get, createServer } from 'http';
import { URL } from 'url';

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
	} catch {
		t.fail('Server should not crash.');
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
	} catch {
		t.fail('Server should not crash.');
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
	} catch {
		t.fail('This port should always exist.');
	}

	t.equal(nodeServer.get('Unknown'), null, 'Node#get should return null on unknown nodes.');
	t.equal(nodeSocket.get('Unknown'), null, 'Node#get should return null on unknown nodes.');

	try {
		t.true(nodeServer.server!.disconnect(), 'Successful disconnections should return true.');
		t.true(nodeSocket.disconnectFrom('Server'), 'Successful disconnections should return true.');
	} catch {
		t.fail('Disconnection should not error.');
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
			t.equal(client.socket, null, 'The socket is destroyed and nullified.');
		});
		nodeSocket.disconnectFrom('Server');
	}
});

// TODO(kyranet): Add `client.*` and `server.*` event tests.

test('Socket Double Disconnection', { timeout: 5000 }, async t => {
	t.plan(2);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeSocket.get('Server')!;

	try {
		t.true(server.disconnect(), 'Successful disconnections should return true.');
		t.false(server.disconnect(), 'A repeated disconnection should return false.');
	} catch {
		t.fail('Disconnections from NodeSocket should never throw an error.');
	}

	try {
		nodeServer.server!.disconnect();
	} catch {
		t.fail('Disconnection should not error.');
	}
});

test('Server Double Disconnection', { timeout: 5000 }, async t => {
	t.plan(2);
	const [nodeServer, nodeSocket] = await setup(t, ++port);
	const server = nodeServer.server!;

	try {
		t.true(server.disconnect(), 'Successful disconnections should return true.');
		t.false(server.disconnect(), 'A repeated disconnection should return false.');
	} catch {
		t.fail('Disconnections from NodeSocket should never throw an error.');
	}

	try {
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
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

		try {
			nodeServer.server!.disconnect();
			nodeSocket.disconnectFrom('Server');
		} catch {
			t.fail('Disconnection should not error.');
		}
	}
});

test('Socket Connection Retries (Abrupt Close)', { timeout: 7500 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, ++port, undefined, { maxRetries: Infinity, retryTime: 200 });
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

test('HTTP Socket', { timeout: 5000 }, async t => {
	t.plan(3);
	const nodeServer = new Node('Server');
	await nodeServer.serve(++port);

	nodeServer.on('error', error => {
		t.true(error instanceof Error, 'The error thrown should be an instance of Error.');
		t.equal(error.message, 'Failed to process message during connection, calling disconnect.',
			'Should be an automatic disconnection error.');
	});

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

	try {
		nodeServer.server!.disconnect();
	} catch {
		t.fail('Disconnection should not error.');
	}
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

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
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
		try {
			nodeServer.server!.disconnect();
			nodeSocket.disconnectFrom('Server');
		} catch {
			t.fail('Disconnection should not error.');
		}

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
	} catch {
		t.fail('This should not fail.');
	}

	try {
		await nodeServer.server!.sendTo('Unknown', 'Hello');
		t.fail('This should not run, as the previous statement throws');
	} catch (error) {
		t.true(error instanceof Error, 'The error should be an instance of Error.');
		t.equal(error.message, 'Failed to send to the socket: It is not connected to this Node.',
			'Trying to send a message to an unknown socket sends this message.');
	}

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
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
	nodeSocket.get('Server')!.socket!.write(Buffer.concat([
		create(false),
		new Uint8Array([0xFF, 0xFF])
	]));

	function finish() {
		try {
			nodeServer.server!.disconnect();
			nodeSocket.disconnectFrom('Server');
		} catch {
			t.fail('Disconnection should not error.');
		}
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
	nodeServer.get('Socket')!.socket!.write(Buffer.concat([
		create(false),
		new Uint8Array([0xFF, 0xFF])
	]));

	function finish() {
		try {
			nodeServer.server!.disconnect();
			nodeSocket.disconnectFrom('Server');
		} catch {
			t.fail('Disconnection should not error.');
		}
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

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
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
	} catch {
		t.fail('Message broadcast failed');
	}

	try {
		const response = await nodeServer.broadcast('Foo', { filter: /NothingMatches/ });
		t.true(Array.isArray(response), 'The response for a broadcast must always be an array.');
		t.equal(response.length, 0, 'There is only one connected socket, but the filter does not match any one.');
	} catch {
		t.fail('Message broadcast failed');
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

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
});

test('Message Timeout', { timeout: 5000 }, async t => {
	t.plan(5);
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
	} catch {
		t.fail('The socket should not error.');
	}

	try {
		// Timeout -1 means no timeout
		const response = await nodeSocket.sendTo('Server', 'Foo', { timeout: -1 });
		t.equal(response, 'Bar', 'The server replied with "Bar", so this should be "Bar".');
	} catch {
		t.fail('The socket should not error.');
	}

	try {
		// Timeout Infinity means no timeout
		const response = await nodeSocket.sendTo('Server', 'Foo', { timeout: Infinity });
		t.equal(response, 'Bar', 'The server replied with "Bar", so this should be "Bar".');
	} catch {
		t.fail('The socket should not error.');
	}

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
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

	try {
		nodeServer.server!.disconnect();
	} catch {
		t.fail('Disconnection should not error.');
	}
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
		try {
			nodeServer.server!.disconnect();
			nodeSocketFirst.disconnectFrom('Server');
			nodeSocketSecond.disconnectFrom('Server');
		} catch {
			t.fail('Disconnection should not error.');
		}
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
