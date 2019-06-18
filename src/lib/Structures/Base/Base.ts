import { Node } from '../../Node';

export class Base {

	/**
	 * The Node instance that manages this
	 */
	public node: Node;

	/**
	 * The name of this client
	 */
	public name: string | null;

	public constructor(node: Node, name: string | null) {
		Object.defineProperty(this, 'node', { value: null, writable: true });
		this.node = node;
		this.name = name;
	}

}
