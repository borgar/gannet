function getKeyFn (key) {
  if (key && typeof key === 'string') {
    return itm => itm[key];
  }
  else if (key && typeof key === 'function') {
    return key;
  }
  return String;
}

export class Collection {
  constructor (name, site, unique_key) {
    this.keyFn = getKeyFn(unique_key);
    this.url = site.router.route(name);
    this.is_current = false;
    this.id = name;
    this.items = [];
    this.$seen = {};
    this.mtime = -Infinity;
  }

  count () {
    return this.items.length;
  }

  [Symbol.iterator] () {
    const items = this.items;
    let i = 0;
    return {
      next: () => {
        if (i <= items.length) {
          return { value: items[i++], done: false };
        }
        else {
          return { done: true };
        }
      }
    };
  }

  pruneUnique () {
    const prunedItems = [];
    this.items.forEach(d => {
      if (d.items.length === 1) {
        this.remove(d);
        prunedItems.push(d);
      }
    });
    return prunedItems;
  }

  remove (item) {
    const uniq = this.keyFn;
    const id = uniq(item);
    delete this.$seen[id];
    this.items = this.items.filter(d => {
      return uniq(d) !== id;
    });
  }

  add (items, content_item) {
    const uniq = this.keyFn;
    const seen = this.$seen;
    const mtime = content_item.mtime;
    if (mtime && this.mtime < mtime) {
      this.mtime = mtime; // maintain collection's most-recent-mtime
    }
    if (!Array.isArray(items)) { items = [ items ]; }
    items.forEach(item => {
      const id = uniq(item);
      if (mtime && ((item.mtime && item.mtime < mtime) || !item.mtime)) {
        item.mtime = mtime; // maintain collection's most-recent-mtime
      }

      if (id in seen) {
        const idx = seen[id].indexOf(content_item);
        if (idx === -1) {
          seen[id].push(content_item);
        }
      }
      else {
        item.items = [ content_item ];
        seen[id] = item.items;
        this.items.push(item);
      }
    });
  }

  sort (fn) {
    const uniq = this.keyFn;
    this.items = this.items.sort(fn || ((a, b) => {
      a = uniq(a);
      b = uniq(b);
      if (a < b) {
        return -1;
      }
      else if (a > b) {
        return 1;
      }
      return 0;
    }));
  }
}

