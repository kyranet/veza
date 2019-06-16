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
