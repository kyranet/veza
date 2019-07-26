import * as test from 'tape';
import {
	create,
	createFromID,
	read,
	readDate,
	readIncrement,
	writeDate,
	writeIncrement,
	writeReceptive,
	read32At
} from '../dist/lib/Util/Header';

test('Create Basic Header', t => {
	t.plan(6);

	// Receptive header
	{
		const header = create(true, new Uint8Array(0));
		t.equal(header.byteLength, 11, 'Headers must always be made of 7 bytes.');
		t.equal(header[6], 1, 'The last byte must be 1 for a receptive message.');
		t.equal(read32At(header, 7), 0, 'The byte length header must be 0.');
	}

	// Non-receptive header
	{
		const header = create(false, new Uint8Array(0));
		t.equal(header.byteLength, 11, 'Headers must always be made of 7 bytes.');
		t.equal(header[6], 0, 'The last byte must be 1 for a receptive message.');
		t.equal(read32At(header, 7), 0, 'The byte length header must be 0.');
	}
});

test('Write and Read Date', t => {
	t.plan(8);

	const now = Date.now();
	const header = new Uint8Array(11);

	writeDate(header, now);
	t.equal(readDate(header), now & 0xFFFFFFFF, 'The date bytes must match.');
	t.equal(header[4], 0x00, 'The fifth byte should be zero, as it is unwritten.');
	t.equal(header[5], 0x00, 'The sixth byte should be zero, as it is unwritten.');
	t.equal(header[6], 0x00, 'The seventh byte should be zero, as it is unwritten.');
	t.equal(header[7], 0x00, 'The eighth byte should be zero, as it is unwritten.');
	t.equal(header[8], 0x00, 'The ninth byte should be zero, as it is unwritten.');
	t.equal(header[9], 0x00, 'The tenth byte should be zero, as it is unwritten.');
	t.equal(header[10], 0x00, 'The eleventh byte should be zero, as it is unwritten.');
});

test('Write and Read Increment', t => {
	t.plan(10);

	const increment = 0x1234;
	const header = new Uint8Array(11);

	writeIncrement(header, increment);
	t.equal(readIncrement(header), increment, 'The date bytes must match.');
	t.equal(header[0], 0x00, 'The first byte should be zero, as it is unwritten.');
	t.equal(header[1], 0x00, 'The second byte should be zero, as it is unwritten.');
	t.equal(header[2], 0x00, 'The third byte should be zero, as it is unwritten.');
	t.equal(header[3], 0x00, 'The fourth byte should be zero, as it is unwritten.');
	t.equal(header[6], 0x00, 'The seventh byte should be zero, as it is unwritten.');
	t.equal(header[7], 0x00, 'The eighth byte should be zero, as it is unwritten.');
	t.equal(header[8], 0x00, 'The ninth byte should be zero, as it is unwritten.');
	t.equal(header[9], 0x00, 'The tenth byte should be zero, as it is unwritten.');
	t.equal(header[10], 0x00, 'The eleventh byte should be zero, as it is unwritten.');
});

test('Write and Read Increment', t => {
	t.plan(12);

	const header = new Uint8Array(11);

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
	t.equal(header[7], 0x00, 'The eighth byte should be zero, as it is unwritten.');
	t.equal(header[8], 0x00, 'The ninth byte should be zero, as it is unwritten.');
	t.equal(header[9], 0x00, 'The tenth byte should be zero, as it is unwritten.');
	t.equal(header[10], 0x00, 'The eleventh byte should be zero, as it is unwritten.');
});

test('Create Header From ID', t => {
	t.plan(15);

	const header = create(true, new Uint8Array(0));
	const { id, receptive } = read(header);
	t.equal(typeof id, 'number', 'The IDs are always numbers.');
	t.equal(receptive, true, 'The header should have receptive as true.');

	const cloned = createFromID(id, false, new Uint8Array(0));
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
	t.equal(header[7], header[7], 'Eighth byte should be the same.');
	t.equal(header[8], header[8], 'Ninth byte should be the same.');
	t.equal(header[9], header[9], 'Tenth byte should be the same.');
	t.equal(header[10], header[10], 'Eleventh byte should be the same.');
});
