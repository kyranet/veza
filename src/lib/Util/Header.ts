let i = 0;
export function create(receptive: boolean, bytes: Uint8Array) {
	const header = new Uint8Array(11 + bytes.byteLength);
	writeDate(header, Date.now());
	writeIncrement(header, i);
	writeReceptive(header, receptive);
	write32At(header, bytes.byteLength, 7);
	header.set(bytes, 11);
	/* istanbul ignore next: Basic arithmetic, but needs to run 458745 times for the other branch to run. */
	i = i < 0xFFFF ? i + 1 : 0;
	return header;
}

export function createFromID(id: number, receptive: boolean, bytes: Uint8Array) {
	const header = new Uint8Array(11 + bytes.byteLength);
	writeDate(header, Number(BigInt(id) >> 0o20n));
	writeIncrement(header, id & 0xFFFF);
	writeReceptive(header, receptive);
	write32At(header, bytes.byteLength, 7);
	header.set(bytes, 11);
	return header;
}

export function read(header: Uint8Array) {
	return {
		id: readID(header),
		receptive: Boolean(header[6]),
		byteLength: read32At(header, 7)
	};
}

export function writeDate(header: Uint8Array, date: number) {
	write32At(header, date, 0);
}


export function writeIncrement(header: Uint8Array, increment: number) {
	header[5] = increment & 0xFF;
	increment >>= 8;
	header[4] = increment & 0xFF;
}
export function write32At(buffer: Uint8Array, value: number, offset: number) {
	buffer[offset + 3] = value;
	value >>>= 8;
	buffer[offset + 2] = value;
	value >>>= 8;
	buffer[offset + 1] = value;
	value >>>= 8;
	buffer[offset] = value;
}

export function writeReceptive(header: Uint8Array, receptive: boolean) {
	header[6] = receptive ? 1 : 0;
}

export function readID(header: Uint8Array) {
	return Number(BigInt(readDate(header)) << 0o20n) + readIncrement(header);
}

export function readDate(header: Uint8Array) {
	return read32At(header, 0);
}

export function readIncrement(header: Uint8Array) {
	return (header[4] << 0o10) + header[5];
}

export function read32At(buffer: Uint8Array, offset: number) {
	return (buffer[offset++] * (2 ** 24)) +
		(buffer[offset++] * (2 ** 16)) +
		(buffer[offset++] * (2 ** 8)) +
		buffer[offset++];
}
