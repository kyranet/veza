import { SocketHandler } from "veza";

const { _packMessage } = require("../Util/Transform");

class NodeMessage {
  data: any;
  receptive: boolean;
  client: SocketHandler;
  id: string;

  constructor(
    client: SocketHandler,
    id: string,
    receptive: boolean,
    data: any
  ) {
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
  reply(content: any) {
    if (this.receptive)
      this.client.socket.write(_packMessage(this.id, content, false));
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
  freeze(): Readonly<this> {
    return Object.freeze(this);
  }
}

export default NodeMessage;
