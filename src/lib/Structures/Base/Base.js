class Base {

	constructor(node, name = null) {
		Object.defineProperty(this, 'node', { value: null });
		this.node = node;
		this.name = name;
	}

}

module.exports = Base;
