import { Node } from '../dist/lib/Node';
import { SocketStatus } from '../dist/lib/Util/Constants';
import * as test from 'tape';

test('Basic Empty Node', t => {
	t.plan(5);

	const node = new Node('Test', { maxRetries: 10, retryTime: 1000 });
	t.equal(node.name, 'Test', 'Expected name to be Test, as configured.');
	t.equal(node.maxRetries, 10, 'Expected maxRetries to be 10, as configured.');
	t.equal(node.retryTime, 1000, 'Expected retryTime to be 1000, as configured.');
	t.equal(node.server, null, 'Expected server to be null, as it has not served.');
	t.equal(node.servers.size, 0, 'Expected servers to be zero, as it has not connected.');
});

test('Basic Empty Server (Connect and Disconnect)', { timeout: 5000 }, async t => {
	t.plan(8);

	const node = new Node('Server');
	const PORT = 8001;

	t.equal(node.server, null, 'The server should be null as this is not serving.');
	try {
		await node.serve(PORT);

		// Connected
		t.notEqual(node.server, null, 'The server should now not be null as this is now serving.');
		t.equal(node.server!.clients.size, 0, 'The server should not have a connected client.');
		t.equal(node.server!.name, 'Server', 'The server should be named after the node.');
		t.equal(node.server!.node, node, 'The Servers node should be its parent.');
		t.notEqual(node.server!.server, null, 'The internal server should not be null.');

		// Disconnected
		t.true(node.server!.disconnect(), 'The disconnection should be successful.');
		t.equal(node.server, null, 'The server should be null as it has disconnected.');
	} catch {
		t.fail('Server should not crash.');
	}
});

test('Basic Socket', { timeout: 5000 }, async t => {
	t.plan(11);

	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');
	const PORT = 8002;

	// Open server
	try {
		await nodeServer.serve(PORT);
	} catch {
		t.fail('Server should not crash.');
	}

	try {
		await nodeSocket.connectTo(PORT);
		t.equal(nodeSocket.servers.size, 1);

		const myServer = nodeSocket.servers.get('Server')!;
		t.notEqual(myServer, undefined);
		t.notEqual(myServer.socket, null);
		t.equal(myServer.name, 'Server');
		t.equal(myServer.node, nodeSocket);
		t.equal(myServer.status, SocketStatus.Ready);

		await new Promise(resolve => {
			nodeServer.once('client.identify', resolve);
		});

		const mySocket = nodeServer.server!.clients.get('Socket')!;
		t.notEqual(mySocket, undefined);
		t.notEqual(mySocket.socket, null);
		t.equal(mySocket.name, 'Socket');
		t.equal(mySocket.node, nodeServer);
		t.equal(mySocket.status, SocketStatus.Ready);
	} catch {
		t.fail('This port should always exist.');
	}

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
});

test('Socket Unknown Server Disconnection (Invalid)', async t => {
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
	t.plan(28);

	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');
	const PORT = 8003;
	await nodeServer.serve(PORT);

	// socket.connect and socket.ready are called when connecting
	nodeSocket.on('socket.connect', client => {
		t.equal(client.name, null, 'Connect is done before the identify step, it is not available until ready.');
		t.equal(client.node, nodeSocket, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Connected, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty during connection.');
		t.equal(client.queue.node, nodeSocket, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.queue.socket, null, 'The socket must not be null during connection.');
		t.notEqual(client.socket, null, 'The socket must not be null during connection.');
	});
	nodeSocket.on('socket.ready', client => {
		t.equal(client.name, 'Server', 'Ready is emitted after the identify step, the name should be available.');
		t.equal(client.node, nodeSocket, 'The client node should be the parent Node itself.');
		t.equal(client.status, SocketStatus.Ready, 'When this event fires, the status should be "Connected".');
		t.equal(client.queue.size, 0, 'The queue must be empty after connection.');
		t.equal(client.queue.node, nodeSocket, 'The client queue node should be the parent Node itself.');
		t.notEqual(client.queue.socket, null, 'The socket must not be null after connection.');
		t.notEqual(client.socket, null, 'The socket must not be null after connection.');
	});

	await nodeSocket.connectTo(PORT);
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
		t.notEqual(client.queue.socket, null, 'The socket must not be null during a disconnection.');
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
			t.equal(client.queue.socket, null, 'The socket is destroyed and nullified.');
			t.equal(client.socket, null, 'The socket is destroyed and nullified.');
		});
		nodeSocket.disconnectFrom('Server');
	}
});

test('Socket Basic Message', { timeout: 5000 }, async t => {
	t.plan(3);
	const [nodeServer, nodeSocket] = await setup(t, 8004);

	nodeServer.once('message', message => {
		t.true(message.receptive, 'The message was sent as receptive.');
		t.equal(message.data, 'Hello');
		message.reply('World');
	});
	const response = await nodeSocket.sendTo('Server', 'Hello') as string;
	t.equal(response, 'World');

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
});

test('Socket Unknown Server Message Sending (Invalid)', async t => {
	t.plan(1);

	const nodeSocket = new Node('Socket');

	try {
		await nodeSocket.sendTo('Unknown', 'Foo');
	} catch (error) {
		t.equal(error.message, 'The socket Unknown is not available or not connected to this Node.',
			'Sending messages to unconnected sockets should always throw an error.');
	}
});

test('Socket Concurrent Messages', { timeout: 5000 }, async t => {
	t.plan(6);
	const [nodeServer, nodeSocket] = await setup(t, 8004);

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

test('Message broadcasting', { timeout: 5000 }, async t => {
	t.plan(5);
	const [nodeServer, nodeSocket] = await setup(t, 8005);

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
	} catch (e) {
		t.fail('Message broadcast failed');
	}

	try {
		nodeServer.server!.disconnect();
		nodeSocket.disconnectFrom('Server');
	} catch {
		t.fail('Disconnection should not error.');
	}
});

async function setup(t: test.Test, port: number) {
	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');

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

		t.fail('TCP Connection Failed.');
	}

	return [nodeServer, nodeSocket];
}
