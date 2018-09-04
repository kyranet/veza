class Base {

	constructor(node, name = null) {
		Object.defineProperty(this, 'node', { value: null, writable: true });
		this.node = node;
		this.name = name;
	}

}

module.exports = Base;
