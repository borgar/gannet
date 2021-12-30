import Feed from './Feed.js';
import { Node } from './xml.js';

// Spec: http://blogs.law.harvard.edu/tech/rss
export default class Rss201rev2 extends Feed {
  constructor (...args) {
    super(...args);
    this._version = '2.0';
  }

  itemElements (parentNode, item) {
    parentNode.append(
      new Node('title', item.title),
      new Node('link', item.link),
      item.description && new Node('description', item.description),
      item.pubdate && new Node('pubDate', item.pubdate.toUTCString()),
      item.unique_id && new Node('guid', item.unique_id),
      item.ttl != null && new Node('ttl', item.ttl),
      item.enclosure && (
        new Node('enclosure', '', {
          rel: 'enclosure',
          url: item.enclosure.url,
          length: item.enclosure.length,
          type: item.enclosure.mime_type
        })
      ),
      ...item.categories.map(cat => new Node('category', String(cat)))
    );
    // Author
    if (item.author_name && item.author_email) {
      const auth = item.author_email + ' (' + item.author_name + ')';
      parentNode.append(new Node('author', auth));
    }
    else if (item.author_email) {
      parentNode.append(new Node('author', item.author_email));
    }
    else if (item.author_name) {
      parentNode.append(new Node('dc:creator', item.author_name, { 'xmlns:dc': 'http://purl.org/dc/elements/1.1/' }));
    }
  }
}
