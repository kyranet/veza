class Base {

	constructor(node) {
		Object.defineProperty(this, 'node', { value: null });
		this.node = node;
	}

}

module.exports = Base;
