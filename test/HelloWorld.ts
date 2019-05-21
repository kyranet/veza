import { Node } from '../dist/index';
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

test('Basic Empty Server (Connect and Disconnect)', async t => {
	t.plan(16);

	const node = new Node('Server');
	node.once('server.ready', server => {
		t.equal(server.clients.size, 0, 'The server should not have a connected client.');
		t.equal(server.name, 'Server', 'The server should be named after the node.');
		t.equal(server.node, node, 'The Servers node should be its parent.');
		t.notEqual(server.server, null, 'The internal server should not be null.');
	});
	node.once('server.destroy', server => {
		t.equal(server.clients.size, 0, 'The server should not have a connected client.');
		t.equal(server.name, 'Server', 'The server should be named after the node.');
		t.equal(server.node, node, 'The Servers node should be its parent.');
		t.equal(server.server, null, 'The internal server should be null.');
	});

	try {
		t.equal(node.server, null, 'The server should be null as this is not serving.');

		// Connect
		await node.serve(8001);
		t.notEqual(node.server, null, 'The server should now not be null as this is now serving.');
		t.equal(node.server!.clients.size, 0, 'The server should not have a connected client.');
		t.equal(node.server!.name, 'Server', 'The server should be named after the node.');
		t.equal(node.server!.node, node, 'The Servers node should be its parent.');
		t.notEqual(node.server!.server, null, 'The internal server should not be null.');

		// Disconnect
		t.true(node.server!.disconnect(), 'The disconnection should be successful.');
		t.equal(node.server, null, 'The server should be null as it has disconnected.');
	} catch {
		t.fail('Server should not crash.');
	}
});
