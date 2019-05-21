function getBytes(number: number) {
	const result = [];
	while (number >= 1) {
		result.unshift(Math.floor(number) % 0xff);
		number /= 0xff;
	}

	return result;
}

function parseBytes(bytes: number[]) {
	let number = 0;
	let n = 1;
	for (let i = bytes.length - 1; i >= 0; i--) {
		number += bytes[i] * n;
		n *= 0xff;
	}
	return number;
}

function fill(bytes: number[], length: number) {
	if (bytes.length < length) { for (let i = length - bytes.length; i > 0; i--) bytes.unshift(0); }
	return bytes;
}

export function createHeader(id: string, type: number, receptive: any, length: number) {
	return Buffer.concat([
		Buffer.from(id, 'base64'),
		Buffer.from([type, receptive ? 1 : 0, ...fill(getBytes(length), 4)])
	]);
}

export function readHeader(header: any) {
	return {
		id: header.toString('base64', 0, 7),
		type: header[7],
		receptive: Boolean(header[8]),
		length: parseBytes(header.slice(9, 13))
	};
}

let a = 0;
export function createID() {
	a = a < 0xffff ? a + 1 : 0;
	return Buffer.from(getBytes(Date.now()).concat(a)).toString('base64');
}
