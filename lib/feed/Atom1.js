import Feed from './Feed.js';
import { Node } from './xml.js';

// See: https://web.archive.org/web/20080730094051/http://diveintomark.org/archives/2004/05/28/howto-atom-id
function get_tag_uri (iurl, date) {
  const u = new URL(iurl);
  const dt = date ? ',' + date.toISOString().split('T')[0] : '';
  const hash = (u.hash || '').replace('#', '/');
  return `tag:${u.hostname}${dt}:${u.pathname}${hash}`;
}

// https://validator.w3.org/feed/docs/atom.html
export default class Atom1 extends Feed {
  constructor (...args) {
    super(...args);
    this._version = '2.0';
    this.ns = 'http://www.w3.org/2005/Atom';
  }

  setupFeed (document) {
    const feedAttr = this.feed.language != null
      ? { 'xmlns': this.ns, 'xml:lang': this.feed.language }
      : { xmlns: this.ns };
    const feed = new Node('feed', feedAttr);
    return document.appendChild(feed);
  }

  rootElements (parentNode) {
    const f = this.feed;
    const p = parentNode;
    p.append(
      new Node('title', f.title, { type: 'text' }),
      new Node('link', { rel: 'alternate', href: f.link }),
      f.feed_url && new Node('link', { rel: 'self', href: f.feed_url }),
      new Node('id', f.id),
      new Node('updated', this.latestPostDate().toISOString())
    );
    if (f.author_name) {
      const auth = p.appendChild(new Node('author'));
      auth.append(
        new Node('name', f.author_name),
        f.author_email && new Node('email', f.author_email),
        f.author_link && new Node('uri', f.author_link)
      );
    }
    p.append(
      f.subtitle && new Node('subtitle', f.subtitle),
      ...this.categories.map(cat => new Node('category', '', { term: cat })),
      f.feed_copyright && parentNode.appendChild(new Node('rights', f.feed_copyright))
    );
  }

  itemNode () {
    return new Node('entry');
  }

  itemElements (parentNode, container) {
    const p = parentNode;
    const c = container;
    p.append(
      new Node('title', c.title),
      new Node('link', '', { href: c.link, rel: 'alternate' }),
      c.pubdate && new Node('updated', c.pubdate.toISOString()),
      new Node('id', c.unique_id || get_tag_uri(c.link, c.pubdate)),
      c.description && new Node('summary', c.description, { type: 'html' }),
      c.enclosure && (
        new Node('link', '', {
          rel: 'enclosure',
          href: container.enclosure.url,
          length: container.enclosure.length,
          type: container.enclosure.mime_type
        })
      ),
      ...c.categories.map(cat => new Node('category', '', { term: cat })),
      c.item_copyright && new Node('rights', c.item_copyright)
    );
    // Author information.
    if (c.author_name) {
      const auth = p.appendChild(new Node('author'));
      auth.append(
        new Node('name', c.author_name),
        c.author_email && new Node('email', c.author_email),
        c.author_link && new Node('uri', c.author_link)
      );
    }
  }
}
