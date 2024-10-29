import { Document, Node } from './xml.js';
import { strict as assert } from 'assert';

export default class Feed {
  constructor ({
    title, link, description, language, author_email,
    author_name, author_link, subtitle,
    feed_url, feed_copyright, feed_guid, ttl
  }) {
    this._version = '';
    this.items = [];
    this.baseurl = link;
    assert.ok(!!title, 'Feed must have a title.');
    assert.ok(!!link, 'Feed must have a link.');
    assert.ok(description != null, 'Feed description must not be null.');
    this.feed = {
      title: title,
      link: link,
      description: description,
      language: language,
      author_email: author_email,
      author_name: author_name,
      author_link: this.absoluteURL(author_link),
      subtitle: subtitle,
      feed_url: this.absoluteURL(feed_url),
      feed_copyright: feed_copyright,
      id: feed_guid || link,
      ttl: ttl
    };
  }

  absoluteURL (link) {
    if (!link || /^([a-z]+:)?\/\//i.test(link)) {
      // URL is nul or already absolute
      return link;
    }
    const u = new URL(this.baseurl);
    u.search = '';
    u.hash = '';
    u.pathname = link;
    return String(u);
  }

  add_item ({
    title, link, description, author_email,
    author_name, author_link, pubdate, comments,
    unique_id, enclosure, categories, item_copyright,
    ttl
  }) {
    assert.ok(!!title, 'Feed items must have a title.');
    assert.ok(!!link, 'Feed items must have a link.');
    assert.ok(!!description, 'Feed items must have a description.');
    const item = {
      title: title,
      link: this.absoluteURL(link),
      description: description,
      author_email: author_email,
      author_name: author_name,
      author_link: this.absoluteURL(author_link),
      pubdate: pubdate,
      comments: comments,
      unique_id: unique_id,
      enclosure: enclosure,
      categories: categories || [],
      item_copyright: item_copyright,
      ttl: ttl
    };
    this.items.push(item);
    return this;
  }

  get url () {
    return new URL(this.feed.feed_url).pathname;
  }

  get length () {
    return this.items.length;
  }

  setupFeed (document) {
    const rss = new Node('rss', {
      'version': this._version,
      'xmlns:atom': 'http://www.w3.org/2005/Atom'
    });
    document.appendChild(rss);
    const channel = new Node('channel');
    rss.appendChild(channel);
    return channel;
  }

  toString () {
    const document = new Document();
    const feed = this.setupFeed(document);
    this.rootElements(feed);
    this.items.forEach(item => {
      const itemnode = feed.appendChild(this.itemNode());
      this.itemElements(itemnode, item);
    });
    return document.toString();
  }

  itemNode () {
    return new Node('item');
  }

  itemElements (/* parentNode, container */) {
  }

  rootElements (parentNode) {
    const { title, link, description, language, feed_copyright, ttl } = this.feed;
    parentNode.append(
      new Node('title', title),
      new Node('link', link),
      new Node('description', description),
      language && new Node('language', language),
      feed_copyright && new Node('language', feed_copyright),
      new Node('lastBuildDate', this.latestPostDate().toUTCString()),
      (ttl || ttl === 0) && new Node('ttl', ttl)
    );
  }

  get categories () {
    const cats = Object.create(null);
    this.items.forEach(item => {
      item.categories.forEach(cat => {
        cats[cat] = cat;
      });
    });
    return Object.values(cats).sort();
  }

  /**
   * Returns the latest item's pubdate. If none of them have a pubdate,
   * this returns the current date/time.
   */
  latestPostDate () {
    // FIXME: Math.max(...this.items.map(d => d.pubdate).filter(Boolean));
    let latest = -Infinity;
    this.items.forEach(itm => {
      if (itm.pubdate && (itm.pubdate * 1 > latest)) {
        latest = itm.pubdate;
      }
    });
    return isFinite(latest) ? latest : new Date();
  }
}
