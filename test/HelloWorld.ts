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
	t.plan(16);

	const node = new Node('Server');
	node.once('server.ready', server => {
		t.comment('Node | server.ready called.');
		t.equal(server.clients.size, 0, 'The server should not have a connected client.');
		t.equal(server.name, 'Server', 'The server should be named after the node.');
		t.equal(server.node, node, 'The Servers node should be its parent.');
		t.notEqual(server.server, null, 'The internal server should not be null.');
	});
	node.once('server.destroy', server => {
		t.comment('Node | server.destroy called.');
		t.equal(server.clients.size, 0, 'The server should not have a connected client.');
		t.equal(server.name, 'Server', 'The server should be named after the node.');
		t.equal(server.node, node, 'The Servers node should be its parent.');
		t.equal(server.server, null, 'The internal server should be null.');
	});

	t.equal(node.server, null, 'The server should be null as this is not serving.');
	try {
		await node.serve(8001);
	} catch {
		t.fail('Server should not crash.');
	}

	// Connected
	t.notEqual(node.server, null, 'The server should now not be null as this is now serving.');
	t.equal(node.server!.clients.size, 0, 'The server should not have a connected client.');
	t.equal(node.server!.name, 'Server', 'The server should be named after the node.');
	t.equal(node.server!.node, node, 'The Servers node should be its parent.');
	t.notEqual(node.server!.server, null, 'The internal server should not be null.');

	// Disconnected
	t.true(node.server!.disconnect(), 'The disconnection should be successful.');
	t.equal(node.server, null, 'The server should be null as it has disconnected.');
});

test('Basic Socket', { timeout: 5000 }, async t => {
	t.plan(25);

	const nodeServer = new Node('Server');
	const nodeSocket = new Node('Socket');

	nodeServer.once('client.identify', async client => {
		t.comment('Server Node | client.identify called.');
		t.equal(client.name, 'Socket');
		t.equal(client.queue.size, 0);
		t.equal(client.status, SocketStatus.Ready);
		t.notEqual(client.socket, null);

		try {
			t.comment('Disconnecting Socket Node from Server');
			t.true(await nodeSocket.disconnectFrom('MyServer'));
		} catch {
			t.fail('This disconnection should not fail.');
		}
	});
	nodeServer.once('client.destroy', client => {
		t.comment('Server Node | client.destroy called');
		t.equal(client.name, 'Socket');
		t.equal(client.queue.size, 0);
		t.equal(client.status, SocketStatus.Disconnected);
		t.equal(client.socket, null);

		try {
			t.true(nodeServer.server!.disconnect(), 'Disconnection should never fail when opened.');
		} catch {
			t.fail('This disconnection should not fail.');
		}
	});

	// Open server
	try {
		t.comment('Connecting Server Node.');
		await nodeServer.serve(8002);
	} catch {
		t.fail('Server should not crash.');
	}

	nodeSocket.once('client.ready', async client => {
		t.comment('Socket Node | client.ready called');
		t.equal(client.name, 'MyServer');
		t.equal(client.queue.size, 0);
		t.equal(client.status, SocketStatus.Ready);
		t.notEqual(client.socket, null);
	});
	nodeSocket.once('client.destroy', client => {
		t.comment('Socket Node | client.destroy called.');
		t.equal(client.name, 'MyServer');
		t.equal(client.queue.size, 0);
		t.equal(client.status, SocketStatus.Disconnected);
		t.equal(client.socket, null);
	});

	try {
		t.comment('Connecting Socket Node to Server.');
		await nodeSocket.connectTo('MyServer', 8002);
	} catch {
		t.fail('This port should always exist.');
	}
	t.equal(nodeSocket.servers.size, 1);

	const myServer = nodeSocket.servers.get('MyServer')!;
	t.notEqual(myServer, undefined);
	t.equal(myServer.name, 'MyServer');
	t.equal(myServer.node, nodeSocket);
	t.equal(myServer.queue.size, 0);
	t.equal(myServer.status, SocketStatus.Ready);
	t.notEqual(myServer.socket, null);
});
