const escMap = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '&': '&amp;',
  "'": '&apos;'
};

function xmlesc (str) {
  return String(str).replace(/["'<>&]/g, a => escMap[a]);
}

export class Node {
  constructor (type, v, a) {
    this.$type = type;
    this.$children = [];
    this.$parent = null;
    if (typeof v === 'object') {
      a = v;
      v = null;
    }
    this.$value = v;
    if (typeof a === 'object') {
      // attributes
      for (const key in a) {
        this[key] = a[key];
      }
    }
  }

  appendChild (node) {
    if (node instanceof Node) {
      node.$parent = this;
      this.$children.push(node);
      return node;
    }
    throw new Error('XML node may not contain non-nodes');
  }

  append (...nodes) {
    nodes
      .filter(Boolean)
      .forEach(this.appendChild.bind(this));
    return this;
  }

  toString (indent) {
    indent = indent || 0;
    let r;
    let attr = '';
    const a = [];
    const ws = Array(indent + 1).join('  ');
    for (const prop in this) {
      if (Object.hasOwn(this, prop) && prop[0] !== '$') {
        a.push(prop + '="' + xmlesc(this[prop]) + '"');
      }
    }
    if (a.length) { attr = ' ' + a.join(' '); }
    r = ws + '<' + this.$type + attr;
    if (!this.$children.length && this.$value == null) {
      return r + ' />';
    }
    else {
      r += '>';
      if (this.$children.length) {
        r += '\n';
        for (let i = 0, l = this.$children.length; i < l; i++) {
          r += this.$children[i].toString(indent + 1) + '\n';
        }
        r += ws;
      }
      else {
        r += xmlesc(this.$value);
      }
      r += '</' + this.$type + '>';
    }
    return r;
  }
}

export class Document {
  constructor () {
    this.root = null;
  }

  appendChild (node) {
    if (this.root) {
      throw new Error('XML document can only have one root');
    }
    if (node instanceof Node) {
      node.$parent = this;
      this.root = node;
      return node;
    }
    throw new Error('XML root node must be a node');
  }

  append (...nodes) {
    nodes
      .filter(Boolean)
      .forEach(this.appendChild.bind(this));
    return this;
  }

  toString () {
    return (
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      String(this.root || '')
    );
  }
}
