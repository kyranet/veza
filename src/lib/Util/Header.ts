let i = 0;
export function create(receptive: boolean) {
	const header = new Uint8Array(7);
	writeDate(header, Date.now());
	writeIncrement(header, i);
	writeReceptive(header, receptive);
	i = i < 0xFFFF ? i + 1 : 0;
	return header;
}

export function createFromID(id: number, receptive: boolean) {
	const header = new Uint8Array(7);
	writeDate(header, Number(BigInt(id) >> 0o20n));
	writeIncrement(header, id & 0xFFFF);
	writeReceptive(header, receptive);
	return header;
}

export function read(header: Uint8Array) {
	return {
		id: Number(BigInt(readDate(header)) << 0o20n) + readIncrement(header),
		receptive: Boolean(header[6])
	};
}

export function writeDate(header: Uint8Array, date: number) {
	header[3] = date & 0xFF;
	date >>= 8;
	header[2] = date & 0xFF;
	date >>= 8;
	header[1] = date & 0xFF;
	date >>= 8;
	header[0] = date & 0xFF;
}

export function writeIncrement(header: Uint8Array, increment: number) {
	header[5] = increment & 0xFF;
	increment >>= 8;
	header[4] = increment & 0xFF;
}

export function writeReceptive(header: Uint8Array, receptive: boolean) {
	header[6] = receptive ? 1 : 0;
}

export function readDate(header: Uint8Array) {
	return (header[0] << 0o30) + (header[1] << 0o20) + (header[2] << 0o10) + header[3];
}

export function readIncrement(header: Uint8Array) {
	return (header[4] << 0o10) + header[5];
}
