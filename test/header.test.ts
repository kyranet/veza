import { create, createFromID, read, read32At, readDate, readIncrement, writeDate, writeIncrement, writeReceptive } from '../src/lib/Util/Header';

test('Create Basic Header', () => {
	expect.assertions(6);

	// Receptive header
	{
		const header = create(true, new Uint8Array(0));
		expect(header.byteLength).toBe(11);
		expect(header[6]).toBe(1);
		expect(read32At(header, 7)).toBe(0);
	}

	// Non-receptive header
	{
		const header = create(false, new Uint8Array(0));
		expect(header.byteLength).toBe(11);
		expect(header[6]).toBe(0);
		expect(read32At(header, 7)).toBe(0);
	}
});

test('Write and Read Date', () => {
	expect.assertions(8);

	const now = Date.now();
	const header = new Uint8Array(11);

	writeDate(header, now);
	expect(readDate(header)).toBe(now % 0xffffffff);
	expect(header[4]).toBe(0x00);
	expect(header[5]).toBe(0x00);
	expect(header[6]).toBe(0x00);
	expect(header[7]).toBe(0x00);
	expect(header[8]).toBe(0x00);
	expect(header[9]).toBe(0x00);
	expect(header[10]).toBe(0x00);
});

test('Write and Read Increment', () => {
	expect.assertions(10);

	const increment = 0x1234;
	const header = new Uint8Array(11);

	writeIncrement(header, increment);
	expect(readIncrement(header)).toBe(increment);
	expect(header[0]).toBe(0x00);
	expect(header[1]).toBe(0x00);
	expect(header[2]).toBe(0x00);
	expect(header[3]).toBe(0x00);
	expect(header[6]).toBe(0x00);
	expect(header[7]).toBe(0x00);
	expect(header[8]).toBe(0x00);
	expect(header[9]).toBe(0x00);
	expect(header[10]).toBe(0x00);
});

test('Write and Read Increment', () => {
	expect.assertions(12);

	const header = new Uint8Array(11);

	writeReceptive(header, false);
	expect(header[6]).toBe(0x00);

	writeReceptive(header, true);
	expect(header[6]).toBe(0x01);

	expect(header[0]).toBe(0x00);
	expect(header[1]).toBe(0x00);
	expect(header[2]).toBe(0x00);
	expect(header[3]).toBe(0x00);
	expect(header[4]).toBe(0x00);
	expect(header[5]).toBe(0x00);
	expect(header[7]).toBe(0x00);
	expect(header[8]).toBe(0x00);
	expect(header[9]).toBe(0x00);
	expect(header[10]).toBe(0x00);
});

test('Create Header From ID', () => {
	expect.assertions(15);

	const header = create(true, new Uint8Array(0));
	const { id, receptive } = read(header);
	expect(typeof id).toBe('number');
	expect(receptive).toBe(true);

	const cloned = createFromID(id, false, new Uint8Array(0));
	const { id: clonedID, receptive: clonedReceptive } = read(cloned);
	expect(typeof clonedID).toBe('number');
	expect(clonedReceptive).toBe(false);

	expect(clonedID).toBe(id);

	expect(cloned[0]).toBe(header[0]);
	expect(cloned[1]).toBe(header[1]);
	expect(cloned[2]).toBe(header[2]);
	expect(cloned[3]).toBe(header[3]);
	expect(cloned[4]).toBe(header[4]);
	expect(cloned[5]).toBe(header[5]);
	expect(header[7]).toBe(header[7]);
	expect(header[8]).toBe(header[8]);
	expect(header[9]).toBe(header[9]);
	expect(header[10]).toBe(header[10]);
});
