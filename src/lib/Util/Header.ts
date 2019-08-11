let i = 0;

/**
 * Create a new message.
 * @since 0.6.0
 * @param receptive Whether the message is receptive or not.
 * @param bytes The bytes to write in this message.
 * @internal
 * @private
 */
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

/**
 * Create a new message given a numeric ID.
 * @since 0.6.0
 * @param id The ID to create the header from.
 * @param receptive Whether the message is receptive or not.
 * @param bytes The bytes to write in this message.
 * @internal
 * @private
 */
export function createFromID(id: number, receptive: boolean, bytes: Uint8Array) {
	const header = new Uint8Array(11 + bytes.byteLength);
	writeDate(header, Number(BigInt(id) >> 0o20n));
	writeIncrement(header, id & 0xFFFF);
	writeReceptive(header, receptive);
	write32At(header, bytes.byteLength, 7);
	header.set(bytes, 11);
	return header;
}

/**
 * Read the header data.
 * @since 0.6.0
 * @param header The header buffer to read from.
 * @internal
 * @private
 */
export function read(header: Uint8Array) {
	return {
		id: readID(header),
		receptive: Boolean(header[6]),
		byteLength: read32At(header, 7)
	};
}

/**
 * Write the date part of the header.
 * @since 0.6.0
 * @param header The header buffer to write to.
 * @param date The date to write into the header.
 * @internal
 * @private
 */
export function writeDate(header: Uint8Array, date: number) {
	write32At(header, date % 0xFFFFFFFF, 0);
}

/**
 * Write the increment part of the header.
 * @since 0.6.0
 * @param header The header buffer to write to.
 * @param increment The increment number to write.
 * @internal
 * @private
 */
export function writeIncrement(header: Uint8Array, increment: number) {
	header[5] = increment & 0xFF;
	increment >>= 8;
	header[4] = increment & 0xFF;
}

/**
 * Write a 32-bit value into the header.
 * @since 0.6.0
 * @param buffer The buffer to read at.
 * @param value The value to be written.
 * @param offset The offset at which the data should be written.
 * @internal
 * @private
 */
export function write32At(buffer: Uint8Array, value: number, offset: number) {
	buffer[offset + 3] = value;
	value >>>= 8;
	buffer[offset + 2] = value;
	value >>>= 8;
	buffer[offset + 1] = value;
	value >>>= 8;
	buffer[offset] = value;
}

/**
 * Write the receptive part of the header.
 * @since 0.6.0
 * @param header The header buffer to write to.
 * @param receptive Whether the message should be receptive or not.
 * @internal
 * @private
 */
export function writeReceptive(header: Uint8Array, receptive: boolean) {
	header[6] = receptive ? 1 : 0;
}

/**
 * Read the numeric ID from this header.
 * @since 0.6.0
 * @param header The header buffer to read from.
 * @internal
 * @private
 */
export function readID(header: Uint8Array) {
	return Number(BigInt(readDate(header)) << 0o20n) + readIncrement(header);
}

/**
 * Read the date part of the ID from this header.
 * @since 0.6.0
 * @param header The header buffer to read from.
 * @internal
 * @private
 */
export function readDate(header: Uint8Array) {
	return read32At(header, 0);
}

/**
 * Read the increment part of the ID from this header.
 * @since 0.6.0
 * @param header The header buffer to read from.
 * @internal
 * @private
 */
export function readIncrement(header: Uint8Array) {
	return (header[4] << 0o10) + header[5];
}

/**
 * Read a 32-bit number from a buffer.
 * @since 0.6.0
 * @param buffer The buffer to read from.
 * @param offset The offset at which this should read at.
 * @internal
 * @private
 */
export function read32At(buffer: Uint8Array, offset: number) {
	return (buffer[offset++] * (2 ** 24)) +
		(buffer[offset++] * (2 ** 16)) +
		(buffer[offset++] * (2 ** 8)) +
		buffer[offset++];
}
