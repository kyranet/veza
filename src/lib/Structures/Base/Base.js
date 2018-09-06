class Base {

	constructor(node, name = null) {
		Object.defineProperty(this, 'node', { value: null, writable: true });
		/**
		 * The Node instance that manages this
		 * @type {Node}
		 */
		this.node = node;

		/**
		 * The name of this client
		 * @type {string}
		 */
		this.name = name;
	}

}

module.exports = Base;
