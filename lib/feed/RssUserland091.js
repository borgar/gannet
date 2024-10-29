import Feed from './Feed.js';
import { Node } from './xml.js';

export default class RssUserland091 extends Feed {
  constructor (...args) {
    super(...args);
    this._version = '0.91';
  }

  itemElements (parentNode, item) {
    parentNode.append(
      new Node('title', item.title),
      new Node('link', item.link),
      new Node('description', item.description || '')
    );
  }
}
