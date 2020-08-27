import { Server, Client, NodeClientOptions, ServerSocketStatus, ClientSocketStatus } from '../src/index';
import { create } from '../src/lib/Util/Header';
import { get, createServer } from 'http';
import { serialize } from 'binarytf';
import { URL } from 'url';
import { readFileSync } from 'fs';

let port = 8000;

beforeEach;
test('Basic Server', async (done) => {
	expect.assertions(5);

	const nodeServer = new Server('Server');

	try {
		await nodeServer.listen(++port);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	// Connected
	expect(nodeServer.sockets.size).toBe(0);
	expect(nodeServer.name).toBe('Server');

	try {
		await nodeServer.listen(++port);
		done.fail('This call should definitely crash.');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Listen method has been called more than once without closing.');
	}

	// Disconnected
	expect(await nodeServer.close()).toBeTruthy();
});

test('Basic Socket', async () => {
	// expect.assertions(16);

	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket');

	// Open server
	try {
		await nodeServer.listen(++port);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		await nodeSocket.connectTo(port);
		expect(nodeSocket.servers.size).toBe(1);

		const myServer = nodeSocket.servers.get('Server')!;
		expect(myServer).not.toBe(undefined);
		expect(myServer.socket).not.toBe(null);
		expect(myServer.name).toBe('Server');
		expect(myServer.status).toBe(ClientSocketStatus.Ready);
		expect(nodeSocket.get('Server')).toBe(myServer);
		expect(nodeSocket.get(myServer)).toBe(myServer);

		await new Promise((resolve) => {
			nodeServer.once('connect', resolve);
		});

		const mySocket = nodeServer.sockets.get('Socket')!;
		expect(mySocket).not.toBe(undefined);
		expect(mySocket.socket).not.toBe(null);
		expect(mySocket.name).toBe('Socket');
		expect(mySocket.status).toBe(ServerSocketStatus.Connected);
		expect(nodeServer.get('Socket')).toBe(mySocket);
		expect(nodeServer.get(mySocket)).toBe(mySocket);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	expect(nodeServer.get('Unknown')).toBe(null);
	expect(nodeSocket.get('Unknown')).toBe(null);

	try {
		await nodeServer.close();
		expect(nodeSocket.disconnectFrom('Server')).toBeTruthy();
	} catch (error) {
		expect(error).toBeFalsy();
	}
});

test('Socket Unknown Server Disconnection (Invalid)', () => {
	expect.assertions(1);

	const nodeSocket = new Client('Socket');
	try {
		nodeSocket.disconnectFrom('Unknown');
	} catch (error) {
		expect(error.message).toBe('The socket Unknown is not connected to this one.');
	}
});

test('Socket Events', async () => {
	// expect.assertions(11);

	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket', { maximumRetries: 0 });
	await nodeServer.listen(++port);

	// socket.connect and socket.ready are called when connecting
	nodeSocket.on('connect', (client) => {
		expect(client.name).toBe(null);
		expect(client.status).toBe(ClientSocketStatus.Connected);
		expect(client.queue.size).toBe(0);
		expect(client.socket).not.toBe(null);
	});
	nodeSocket.on('ready', (client) => {
		expect(client.name).toBe('Server');
		expect(client.status).toBe(ClientSocketStatus.Ready);
		expect(client.queue.size).toBe(0);
		expect(client.socket).not.toBe(null);
	});

	await nodeSocket.connectTo(port);
	await new Promise((resolve) => {
		nodeServer.once('connect', resolve);
	});

	// Test a server outage
	nodeSocket.on('disconnect', (client) => {
		expect(client.name).toBe('Server');
		expect(client.status).toBe(ClientSocketStatus.Disconnected);
		expect(client.queue.size).toBe(0);
	});
	await nodeServer.close();
});

test('Client Events', async () => {
	// expect.assertions(6);

	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket');
	await nodeServer.listen(++port);

	// client.connect is called when connecting
	nodeServer.on('connect', (client) => {
		expect(client.name).toBe('Socket');
		expect(client.status).toBe(ServerSocketStatus.Connected);
		expect(client.queue.size).toBe(0);
	});

	// Connect the socket to the server
	await nodeSocket.connectTo(port);
	nodeServer.on('disconnect', async (client) => {
		expect(client.name).toBe('Socket');
		expect(client.status).toBe(ServerSocketStatus.Disconnected);
		expect(client.queue.size).toBe(0);
		await nodeServer.close();
	});

	nodeSocket.disconnectFrom('Server');
});

test('Server Events', async () => {
	// expect.assertions(4);
	const nodeServer = new Server('Server');
	nodeServer.on('open', () => {
		expect(nodeServer.sockets.size).toBe(0);
		expect(nodeServer.name).toBe('Server');
	});
	await nodeServer.listen(++port);

	nodeServer.on('close', () => {
		expect(nodeServer.sockets.size).toBe(0);
		expect(nodeServer.name).toBe('Server');
	});

	await nodeServer.close();
});

test('Socket Double Disconnection', async (done) => {
	expect.assertions(2);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	const server = nodeSocket.get('Server')!;

	try {
		expect(server.disconnect()).toBeTruthy();
		expect(server.disconnect()).toBeFalsy();
	} catch (error) {
		expect(error).toBeFalsy();
	}

	await nodeServer.close();
});

test('Server Double Disconnection', async (done) => {
	// expect.assertions(2);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	const server = nodeServer;

	try {
		expect(await server.close()).toBeTruthy();
		expect(await server.close()).toBeFalsy();
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		nodeSocket.disconnectFrom('Server');
	} catch (error) {
		expect(error).toBeFalsy();
	}
});

test('Socket Connection Retries', async (done) => {
	// expect.assertions(4);
	const [nodeServer, nodeSocket] = await setup(done, ++port, { maximumRetries: 3, retryTime: 0 });
	await nodeServer.close();

	let attempts = nodeSocket.maximumRetries;
	nodeSocket.on('connecting', () => {
		expect(--attempts >= 0).toBeTruthy();
	});
	nodeSocket.on('disconnect', () => undefined);
});

test('Socket Connection No Retries', async (done) => {
	// expect.assertions(1);
	const [nodeServer, nodeSocket] = await setup(done, ++port, { maximumRetries: 0 });
	await nodeServer.close();

	nodeSocket.on('connecting', () => {
		done.fail('The socket should not try to connect.');
	});
	nodeSocket.on('disconnect', () => undefined);
});

test('Socket Connection Retries (Successful Reconnect)', async (done) => {
	// expect.assertions(4);
	const [nodeServer, nodeSocket] = await setup(done, ++port, { maximumRetries: 3, retryTime: 200 });
	await nodeServer.close();

	nodeSocket.once('connecting', () => {
		void next();
	});

	async function next() {
		nodeSocket.once('connect', () => undefined).once('ready', () => undefined);
		await nodeServer.listen(port);
		await new Promise((resolve) => {
			nodeServer.once('connect', resolve);
		});

		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
	}
});

test('Socket Connection Retries (Successful Reconnect | Different Name)', async (done) => {
	// expect.assertions(8);
	const [nodeServerFirst, nodeSocket] = await setup(done, ++port, { maximumRetries: 3, retryTime: 200 });

	const socketServer = nodeSocket.get('Server')!;
	expect(socketServer.name).toBe('Server');

	// Disconnect and set up a second server with a different name
	await nodeServerFirst.close();
	const nodeServerSecond = new Server('NewServer');

	nodeSocket.once('connecting', async () => {
		nodeSocket.once('connect', () => undefined).once('ready', () => undefined);
		await nodeServerSecond.listen(port);
		await new Promise((resolve) => {
			nodeServerSecond.once('connect', resolve);
		});

		expect(nodeSocket.get('Server')).toBe(null);
		expect(nodeSocket.get('NewServer')).toBe(socketServer);
		expect(socketServer.name).toBe('NewServer');

		await nodeServerSecond.close();
		nodeSocket.disconnectFrom('NewServer');
	});
});

test('Socket Connection Retries (Abrupt Close)', async (done) => {
	// expect.assertions(3);
	const [nodeServer, nodeSocket] = await setup(done, ++port, { maximumRetries: -1, retryTime: 200 });
	await nodeServer.close();

	let firedConnecting = false;
	nodeSocket.on('connecting', () => {
		expect(firedConnecting).toBeFalsy();
		firedConnecting = true;
		expect(nodeSocket.disconnectFrom('Server')).toBeTruthy();
	});

	let firedDestroy = false;
	nodeSocket.on('disconnect', () => {
		expect(firedDestroy).toBeFalsy();
		firedDestroy = true;
	});
});

test('Server Connection Close', async (done) => {
	// expect.assertions(1);
	const [nodeServer, nodeSocket] = await setup(done, ++port, undefined);

	nodeServer.on('disconnect', async (socket) => {
		expect(socket.name).toBe('Socket');
		await nodeServer.close();
	});
	nodeSocket.disconnectFrom('Server');
});

test('HTTP Socket', async (done) => {
	// expect.assertions(1);
	const nodeServer = new Server('Server');
	await nodeServer.listen(++port);

	try {
		await new Promise((resolve, reject) => {
			get(new URL(`http://localhost:${port}`), resolve)
				.on('close', resolve)
				.on('error', reject);
		});
		done.fail('This should not be called.');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
	}

	await nodeServer.close();
});

test('HTTP Server', async (done) => {
	// expect.assertions(5);
	const nodeSocket = new Client('Socket', { handshakeTimeout: 250 });
	const server = createServer(() => {
		done.fail('This should not be called - in Veza, the server sends the message, and the socket replies.');
	});
	server.on('connection', () => undefined).on('close', () => undefined);

	await new Promise((resolve) => server.listen(++port, resolve));

	try {
		await nodeSocket.connectTo(port);
		done.fail('The connection should not be successful.');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Connection Timed Out.');
	}

	server.close((error) => {
		expect(error).toBe(undefined);
	});
});

test('HTTP Server (Incorrect Handshake)', async (done) => {
	// expect.assertions(5);
	const nodeSocket = new Client('Socket', { handshakeTimeout: -1 });
	const server = createServer(() => {
		done.fail('This should not be called - in Veza, the server sends the message, and the socket replies.');
	});
	server
		.on('close', () => undefined)
		.on('connection', (socket) => {
			socket.write(Buffer.from('Hello World!'));
		});

	await new Promise((resolve) => server.listen(++port, resolve));

	try {
		await nodeSocket.connectTo(port);
		done.fail('The connection should not be successful.');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Unexpected response from the server.');
	}

	server.close((error) => {
		expect(error).toBe(undefined);
	});
});

test('HTTP Server (Malicious Forged Handshake)', async (done) => {
	// expect.assertions(5);
	const nodeSocket = new Client('Socket', { handshakeTimeout: -1 });
	const server = createServer(() => {
		done.fail('This should not be called - in Veza, the server sends the message, and the socket replies.');
	});
	server
		.on('close', () => undefined)
		.on('connection', (socket) => {
			const serialized = serialize(420);
			const message = new Uint8Array(11 + serialized.byteLength);
			message[6] = 1;
			message.set(serialized, 11);
			socket.write(message);
		});

	await new Promise((resolve) => server.listen(++port, resolve));

	try {
		await nodeSocket.connectTo(port);
		done.fail('The connection should not be successful.');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Unexpected response from the server.');
	}

	server.close((error) => {
		expect(error).toBe(undefined);
	});
});

test('ClientSocket Socket Retrieval', async (done) => {
	// expect.assertions(6);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	const server = nodeSocket.get('Server')!;

	expect(nodeSocket.get('Server')).toBe(server);
	expect(nodeSocket.get(server)).toBe(server);

	expect(nodeSocket.has('Server')).toBeTruthy();
	expect(nodeSocket.has('Foo')).toBeFalsy();

	try {
		// @ts-ignore TypeScript ignoring since this is an assertion for JavaScript users
		nodeSocket.get(0);
		done.fail('This should not run, as the previous statement throws');
	} catch (error) {
		expect(error instanceof TypeError).toBeTruthy();
		expect(error.message).toBe('Expected a string or a ClientSocket instance.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('NodeServer Socket Retrieval', async (done) => {
	// expect.assertions(6);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	const socket = nodeServer.get('Socket')!;

	expect(nodeServer.get('Socket')).toBe(socket);
	expect(nodeServer.get(socket)).toBe(socket);

	expect(nodeServer.has('Socket')).toBeTruthy();
	expect(nodeServer.has('Foo')).toBeFalsy();

	try {
		// @ts-ignore TypeScript ignoring since this is an assertion for JavaScript users
		nodeServer.get(0);
		done.fail('This should not run, as the previous statement throws');
	} catch (error) {
		expect(error instanceof TypeError).toBeTruthy();
		expect(error.message).toBe('Expected a string or a ServerClient instance.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Socket Message', async (done) => {
	// expect.assertions(14);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	// Test receptive (default) message delivery
	{
		nodeServer.once('message', (message) => {
			expect(message.receptive).toBeTruthy();
			expect(message.data).toBe('Hello');
			message.reply('World');

			const json = message.toJSON();
			expect(json.id).toBe(message.id);
			expect(json.data).toBe(message.data);
			expect(json.receptive).toBe(message.receptive);

			expect(message.toString()).toBe(`NodeMessage<${message.id}>`);
		});

		const response = (await nodeSocket.sendTo('Server', 'Hello')) as string;
		expect(response).toBe('World');
	}

	// Test non-receptive message delivery
	{
		nodeServer.once('message', (message) => {
			expect(message.receptive).toBeFalsy();
			expect(message.data).toBe('Foo');
			message.reply('Bar');

			// Finish the tests
			void finish();
		});

		const response = (await nodeSocket.sendTo('Server', 'Foo', { receptive: false })) as undefined;
		expect(response).toBe(undefined);
	}

	async function finish() {
		const server = nodeSocket.get('Server')!;
		const socket = nodeServer.get('Socket')!;
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');

		try {
			await server.send('Foo', { receptive: false });
			done.fail('Messages to a disconnected socket should fail.');
		} catch (error) {
			expect(error instanceof Error).toBeTruthy();
			expect(error.message).toBe('Cannot send a message to a missing socket.');
		}

		try {
			await socket.send('Foo', { receptive: false });
			done.fail('Messages to a disconnected socket should fail.');
		} catch (error) {
			expect(error instanceof Error).toBeTruthy();
			expect(error.message).toBe('Cannot send a message to a missing socket.');
		}
	}
});

test('Socket Unknown Server Message Sending (Invalid)', async () => {
	// expect.assertions(1);

	const nodeSocket = new Client('Socket');

	try {
		await nodeSocket.sendTo('Unknown', 'Foo');
	} catch (error) {
		expect(error.message).toBe('Failed to send to the socket: It is not connected to this client.');
	}
});

test('Server Messages', async (done) => {
	// expect.assertions(5);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	nodeSocket.on('message', (message) => {
		expect(message.receptive).toBe(true);
		expect(message.data).toBe('Foo');
		message.reply('Bar');
	});

	try {
		const response = await nodeServer.sendTo('Socket', 'Foo', { timeout: 250 });
		expect(response).toBe('Bar');
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		await nodeServer.sendTo('Unknown', 'Hello');
		done.fail('This should not run, as the previous statement throws');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Failed to send to the socket: It is not connected to this server.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Server Message (Large Buffer)', async (done) => {
	// expect.assertions(5);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	const buffer = readFileSync('./static/logo.png');

	nodeSocket.on('message', (message) => {
		expect(message.receptive).toBe(true);
		expect(message.data).toEqual(buffer);
		message.reply(message.data.byteLength);
	});

	try {
		const response = await nodeServer.sendTo('Socket', buffer, { timeout: 250 });
		expect(response).toBe(buffer.byteLength);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		await nodeServer.sendTo('Unknown', 'Hello');
		done.fail('This should not run, as the previous statement throws');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Failed to send to the socket: It is not connected to this server.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Server Message (Multiple Large Buffer)', async (done) => {
	// expect.assertions(8);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	const bufferLogo = readFileSync('./static/logo.png');
	const bufferTest = readFileSync('./test/test.png');

	let receivedFirst = false;
	nodeSocket.on('message', (message) => {
		expect(message.receptive).toBe(true);
		if (receivedFirst) {
			expect(message.data).toEqual(bufferTest);
		} else {
			expect(message.data).toEqual(bufferLogo);
			receivedFirst = true;
		}
		message.reply(message.data.byteLength);
	});

	try {
		const [responseLogo, responseTest] = await Promise.all([
			nodeServer.sendTo('Socket', bufferLogo, { timeout: 250 }),
			nodeServer.sendTo('Socket', bufferTest, { timeout: 250 })
		]);
		expect(responseLogo).toBe(bufferLogo.byteLength);
		expect(responseTest).toBe(bufferTest.byteLength);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		await nodeServer.sendTo('Unknown', 'Hello');
		done.fail('This should not run, as the previous statement throws');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Failed to send to the socket: It is not connected to this server.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Server Message (Spam)', async (done) => {
	// expect.assertions(1);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	const AMOUNT_OF_MESSAGES = 10000;
	let pendingMessages = AMOUNT_OF_MESSAGES;
	nodeSocket.on('message', (message) => {
		--pendingMessages;
		message.reply(message.data);
		if (pendingMessages < 0) done.fail('Received too many messages');
	});

	try {
		const numbers = new Array(AMOUNT_OF_MESSAGES);
		for (let i = 0; i < numbers.length; ++i) numbers[i] = i;

		const socket = nodeServer.get('Socket')!;
		await Promise.all(
			numbers.map((n) =>
				socket.send(n, { timeout: 10000 }).then((r) => {
					if (n !== r) done.fail(`Mismatching response. Expected ${n} but received ${r}`);
				})
			)
		);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	expect(pendingMessages).toBe(0);

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Socket Faulty Message', async (done) => {
	// expect.assertions(3);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	nodeServer.on('error', async (error, socket) => {
		expect(socket!.name).toBe('Socket');
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Failed to parse message: Unknown type received: 255 [UnknownType]');
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
	});

	// Send faulty message
	nodeSocket.get('Server')!.socket!.write(create(false, new Uint8Array([0xff, 0xff])));
});

test('Server Faulty Message', async (done) => {
	// expect.assertions(3);
	const [nodeServer, nodeSocket] = await setup(done, ++port);
	nodeSocket.on('error', async (error, socket) => {
		expect(socket!.name).toBe('Server');
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Failed to parse message: Unknown type received: 255 [UnknownType]');
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
	});

	// Send faulty message
	nodeServer.get('Socket')!.socket!.write(create(false, new Uint8Array([0xff, 0xff])));
});

test('Socket Concurrent Messages', async (done) => {
	// expect.assertions(6);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	const messages = ['Hello', 'High'];
	const replies = ['World', 'Five!'];
	nodeServer.on('message', (message) => {
		expect(message.receptive).toBe(true);
		expect(message.data).toBe(messages.shift());
		message.reply(replies.shift());
	});

	const [first, second] = await Promise.all([nodeSocket.sendTo('Server', messages[0]), nodeSocket.sendTo('Server', messages[1])]);
	expect(first).toBe('World');
	expect(second).toBe('Five!');

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Message Broadcast', async (done) => {
	// expect.assertions(9);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	nodeSocket.once('message', (message) => {
		expect(message.data).toBe('Foo');
		expect(message.receptive).toBe(true);
		message.reply('Bar');
	});

	try {
		const response = await nodeServer.broadcast('Foo');
		expect(Array.isArray(response)).toBeTruthy();
		expect(response.length).toBe(1);
		expect(response[0]).toBe('Bar');
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		const response = await nodeServer.broadcast('Foo', { filter: /NothingMatches/ });
		expect(Array.isArray(response)).toBeTruthy();
		expect(response.length).toBe(0);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		// @ts-ignore TypeScript ignoring since this is an assertion for JavaScript users
		await nodeServer.broadcast('Foo', { filter: 'HelloWorld' });
	} catch (error) {
		expect(error instanceof TypeError).toBeTruthy();
		expect(error.message).toBe('filter must be a RegExp instance.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Message Broadcast (From Server)', async (done) => {
	// expect.assertions(9);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	nodeSocket.once('message', (message) => {
		expect(message.data).toBe('Foo');
		expect(message.receptive).toBe(true);
		message.reply('Bar');
	});

	try {
		const response = await nodeServer.broadcast('Foo');
		expect(Array.isArray(response)).toBeTruthy();
		expect(response.length).toBe(1);
		expect(response[0]).toBe('Bar');
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		const response = await nodeServer.broadcast('Foo', { filter: /NothingMatches/ });
		expect(Array.isArray(response)).toBeTruthy();
		expect(response.length).toBe(0);
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		// @ts-ignore TypeScript ignoring since this is an assertion for JavaScript users
		await nodeServer.broadcast('Foo', { filter: 'HelloWorld' });
	} catch (error) {
		expect(error instanceof TypeError).toBeTruthy();
		expect(error.message).toBe('filter must be a RegExp instance.');
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Message Timeout', async (done) => {
	// expect.assertions(4);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	try {
		await nodeSocket.sendTo('Server', 'Foo', { timeout: 250 });
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Timed out.');
	}

	nodeServer.on('message', (message) => {
		message.reply('Bar');
	});

	try {
		const response = await nodeSocket.sendTo('Server', 'Foo', { timeout: 250 });
		expect(response).toBe('Bar');
	} catch (error) {
		expect(error).toBeFalsy();
	}

	try {
		// Timeout -1 means no timeout
		const response = await nodeSocket.sendTo('Server', 'Foo', { timeout: -1 });
		expect(response).toBe('Bar');
	} catch (error) {
		expect(error).toBeFalsy();
	}

	await nodeServer.close();
	nodeSocket.disconnectFrom('Server');
});

test('Abrupt Disconnection (Disconnected Without Clearing Messages)', async (done) => {
	// expect.assertions(3);
	const [nodeServer, nodeSocket] = await setup(done, ++port);

	nodeServer.on('message', (message) => {
		message.reply('Bar');
	});

	try {
		const promise = nodeSocket.sendTo('Server', 'Foo');
		expect(nodeSocket.disconnectFrom('Server')).toBeTruthy();
		await promise;
		done.fail('The message should fail due to the server connection being cut.');
	} catch (error) {
		expect(error instanceof Error).toBeTruthy();
		expect(error.message).toBe('Socket has been disconnected.');
	}

	await nodeServer.close();
});

test('Duplicated Socket', async (done) => {
	// expect.assertions(1);
	const [nodeServer, nodeSocketFirst] = await setup(done, ++port, undefined);
	const nodeSocketSecond = new Client('Socket');

	nodeSocketFirst.once('disconnect', async () => {
		await nodeServer.close();
		nodeSocketSecond.disconnectFrom('Server');
	});

	await nodeSocketSecond.connectTo(port);
});

async function setup(t: jest.DoneCallback, port: number, socketNodeOptions?: NodeClientOptions): Promise<[Server, Client]> {
	const nodeServer = new Server('Server');
	const nodeSocket = new Client('Socket', socketNodeOptions);

	try {
		// Open server
		await nodeServer.listen(port);
		await nodeSocket.connectTo(port);

		await new Promise((resolve) => {
			nodeServer.once('connect', resolve);
		});
	} catch {
		await nodeServer.close();
		nodeSocket.disconnectFrom('Server');
		t.fail('Unable to test: TCP Connection Failed.');
	}

	return [nodeServer, nodeSocket];
}
