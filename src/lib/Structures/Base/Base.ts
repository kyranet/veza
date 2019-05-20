class Base {

	node: Node;
	name: string | null;

	constructor(node: Node, name = null) {
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

export default Base;
