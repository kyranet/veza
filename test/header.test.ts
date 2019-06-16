import * as test from 'tape';
import {
	create,
	createFromID,
	read,
	readDate,
	readIncrement,
	writeDate,
	writeIncrement,
	writeReceptive
} from '../dist/lib/Util/Header';

test('Create Basic Header', t => {
	t.plan(4);

	// Receptive header
	{
		const header = create(true);
		t.equal(header.byteLength, 7, 'Headers must always be made of 7 bytes.');
		t.equal(header[6], 1, 'The last byte must be 1 for a receptive message.');
	}

	// Non-receptive header
	{
		const header = create(false);
		t.equal(header.byteLength, 7, 'Headers must always be made of 7 bytes.');
		t.equal(header[6], 0, 'The last byte must be 1 for a receptive message.');
	}
});

test('Write and Read Date', t => {
	t.plan(4);

	const now = Date.now();
	const header = new Uint8Array(7);

	writeDate(header, now);
	t.equal(readDate(header), now & 0xFFFFFFFF, 'The date bytes must match.');
	t.equal(header[4], 0x00, 'The fifth byte should be zero, as it is unwritten.');
	t.equal(header[5], 0x00, 'The sixth byte should be zero, as it is unwritten.');
	t.equal(header[6], 0x00, 'The seventh byte should be zero, as it is unwritten.');
});

test('Write and Read Increment', t => {
	t.plan(6);

	const increment = 0x1234;
	const header = new Uint8Array(7);

	writeIncrement(header, increment);
	t.equal(readIncrement(header), increment, 'The date bytes must match.');
	t.equal(header[0], 0x00, 'The first byte should be zero, as it is unwritten.');
	t.equal(header[1], 0x00, 'The second byte should be zero, as it is unwritten.');
	t.equal(header[2], 0x00, 'The third byte should be zero, as it is unwritten.');
	t.equal(header[3], 0x00, 'The fourth byte should be zero, as it is unwritten.');
	t.equal(header[6], 0x00, 'The seventh byte should be zero, as it is unwritten.');
});

test('Write and Read Increment', t => {
	t.plan(8);

	const header = new Uint8Array(7);

	writeReceptive(header, false);
	t.equal(header[6], 0x00, 'The seventh byte should be zero, as it is marked as not receptive.');

	writeReceptive(header, true);
	t.equal(header[6], 0x01, 'The seventh byte should be one, as it is marked as receptive.');

	t.equal(header[0], 0x00, 'The first byte should be zero, as it is unwritten.');
	t.equal(header[1], 0x00, 'The second byte should be zero, as it is unwritten.');
	t.equal(header[2], 0x00, 'The third byte should be zero, as it is unwritten.');
	t.equal(header[3], 0x00, 'The fourth byte should be zero, as it is unwritten.');
	t.equal(header[4], 0x00, 'The seventh byte should be zero, as it is unwritten.');
	t.equal(header[5], 0x00, 'The seventh byte should be zero, as it is unwritten.');
});

test('Create Header From ID', t => {
	t.plan(11);

	const header = create(true);
	const { id, receptive } = read(header);
	t.equal(typeof id, 'number', 'The IDs are always numbers.');
	t.equal(receptive, true, 'The header should have receptive as true.');

	const cloned = createFromID(id, false);
	const { id: clonedID, receptive: clonedReceptive } = read(cloned);
	t.equal(typeof clonedID, 'number', 'The IDs are always numbers.');
	t.equal(clonedReceptive, false, 'The cloned header should have receptive as false.');

	t.equal(clonedID, id, 'They must have the same ID.');

	t.equal(cloned[0], header[0], 'First byte should be the same.');
	t.equal(cloned[1], header[1], 'Second byte should be the same.');
	t.equal(cloned[2], header[2], 'Third byte should be the same.');
	t.equal(cloned[3], header[3], 'Fourth byte should be the same.');
	t.equal(cloned[4], header[4], 'Fifth byte should be the same.');
	t.equal(cloned[5], header[5], 'Sixth byte should be the same.');
});
