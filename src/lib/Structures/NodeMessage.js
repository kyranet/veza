const { _packMessage } = require('../Util/Transform');

class NodeMessage {

	constructor(client, id, receptive, data) {
		Object.defineProperties(this, {
			client: { value: client },
			id: { value: id }
		});

		/**
		 * The client that received this message
		 * @type {SocketHandler}
		 * @name NodeMessage#client
		 * @property
		 */

		/**
		 * The id of this message
		 * @type {string}
		 * @name NodeMessage#id
		 * @property
		 */

		/**
		 * The data received from the socket
		 * @type {*}
		 */
		this.data = data;

		/**
		 * Whether the message is receptive or not
		 * @type {boolean}
		 */
		this.receptive = receptive;
	}

	/**
	 * The Node instance that manages this process' veza node
	 * @type {Node}
	 */
	get node() {
		return this.client.node;
	}

	/**
	 * Reply to the socket
	 * @param {*} content The content to send
	 */
	reply(content) {
		if (this.receptive) this.client.socket.write(_packMessage(this.id, content, false));
	}

	toJSON() {
		return {
			id: this.id,
			data: this.data,
			receptive: this.receptive
		};
	}

	toString() {
		return `NodeMessage<${this.id}>`;
	}

	/**
	 * Freeze the object
	 * @returns {Readonly<this>}
	 * @private
	 */
	freeze() {
		return Object.freeze(this);
	}

}

module.exports = NodeMessage;
