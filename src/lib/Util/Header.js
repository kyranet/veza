function getBytes(number) {
	const result = [];
	while (number >= 1) {
		result.unshift(Math.floor(number) % 0xFF);
		number /= 0xFF;
	}

	return result;
}

function parseBytes(bytes) {
	let number = 0;
	let n = 1;
	for (let i = bytes.length - 1; i >= 0; i--) {
		number += bytes[i] * n;
		n *= 0xFF;
	}
	return number;
}

function fill(bytes, length) {
	if (bytes.length < length) for (let i = length - bytes.length; i > 0; i--) bytes.unshift(0);
	return bytes;
}

function createHeader(id, type, receptive, length) {
	return Buffer.concat([
		Buffer.from(id, 'base64'),
		Buffer.from([type, receptive ? 1 : 0, ...fill(getBytes(length), 4)])
	]);
}

function readHeader(header) {
	return { id: header.toString('base64', 0, 7), type: header[7], receptive: Boolean(header[8]), length: parseBytes(header.slice(9, 13)) };
}

let a = 0;
function createID() {
	a = a < 0xFFFF ? a + 1 : 0;
	return Buffer.from(getBytes(Date.now()).concat(a)).toString('base64');
}

module.exports = Object.freeze({ createHeader, readHeader, createID });
