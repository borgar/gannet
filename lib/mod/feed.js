/*
"""
Syndication feed generation library -- used for generating RSS, etc.

Sample usage:

>>> import feedgenerator
>>> feed = feedgenerator.Rss201rev2Feed(
...     title=u"Poynter E-Media Tidbits",
...     link=u"http://www.poynter.org/column.asp?id=31",
...     feed_url=u"http://test.org/rss",
...     description=u"A group weblog by the sharpest minds in online media/journalism/publishing.",
...     language=u"en",
... )
>>> feed.add_item(
...     title="Hello",
...     link=u"http://www.holovaty.com/test/",
...     description="Testing."
... )
>>> fp = open('test.rss', 'w')
>>> feed.write(fp, 'utf-8')
>>> fp.close()

For definitions of the different versions of RSS, see:
http://diveintomark.org/archives/2004/02/04/incompatible-rss
"""
*/
var url = require('url');

function extend ( a, b ) {
  for ( var key in b ) { a[key] = b[key]; }
  return a;
}

// FIXME
function iri_to_uri ( iri ) {
  return iri;
}

function get_tag_uri ( iurl, date ) {
  // See: http://diveintomark.org/archives/2004/05/28/howto-atom-id
  var u = url.parse( iurl );
  var d = date ? ','+ date.toISOString().split('T')[0] : '';
  return 'tag:' + u.hostname + d + ':' + u.pathname + (u.hash||'').replace('#','/');
}


function xmlesc ( str ) {
  return str.replace( /["'<>&]/g, function (a) {
    return { '<':'&lt;', '>':'&gt;', '"':'&quot;', '&':'&amp;', "'":"&apos;" }[a];
  });
}

function enforce ( obj ) {
  for (var i=1; i<arguments.length; i++) {
    var propname = arguments[i];
    if ( obj[propname] == null ) {
      throw new Error( 'Item must have a '+propname+' attribute.' )
    }
  }
}

function XMLNode ( type, v, a ) {
  this.$type = type;
  this.$children = [];
  this.$parent = null;
  if ( typeof v === 'object' ) { a = v; v = null; }
  this.$value = v;
  if ( typeof a === 'object' ) {
    // attributes
    for ( var key in a ) {
      this[ key ] = a[ key ];
    }
  }
}
XMLNode.prototype = {

  appendChild: function ( node ) {
    node.$parent = this;
    this.$children.push( node );
  },

  toString: function ( indent ) {
    indent = indent || 0;
    var r, attr = '', a = [], ws = Array(indent+1).join('  ');
    for ( var prop in this ) {
      if ( this.hasOwnProperty(prop) && prop[0] !== '$' ) {
        a.push( prop + '="' + xmlesc(this[prop]) + '"' );
      }
    }
    if ( a.length ) { attr = ' ' + a.join(' '); }
    r = ws + '<' + this.$type +attr;
    if ( !this.$children.length && this.$value == null ) {
      return r +' />';
    }
    else {
      r += '>';
      if ( this.$children.length ) {
        r += '\n';
        for (var i=0,l=this.$children.length; i<l; i++) {
          r += this.$children[i].toString( indent + 1 ) + '\n';
        }
        r += ws;
      }
      else {
        r += xmlesc( this.$value );
      }
      r += '</' + this.$type + '>';
    }
    return r;
  },

};


function Feed () {}
Feed.prototype = {
  
  _version: "",
  
  init: function ( title, link, description, language, author_email,
          author_name, author_link, subtitle, categories,
          feed_url, feed_copyright, feed_guid, ttl ) {
    this.feed = ( typeof title === 'object' ) ? title : {
        'title': title,
        'link': iri_to_uri(link),
        'description': description,
        'language': language,
        'author_email': author_email,
        'author_name': author_name,
        'author_link': iri_to_uri(author_link),
        'subtitle': subtitle,
        'categories': categories,
        'feed_url': iri_to_uri(feed_url),
        'feed_copyright': feed_copyright,
        'id': feed_guid || link,
        'ttl': ttl,
    };
    this.feed.categories = this.feed.categories || [];
    enforce( this.feed, 'title', 'link', 'description' );
    this.items = [];
    return this;
  },
  
  add_item: function ( title, link, description, author_email,
      author_name, author_link, pubdate, comments,
      unique_id, enclosure, categories, item_copyright,
      ttl ) {
    var item = ( typeof title === 'object' ) ? title : {
      'title': title,
      'link': iri_to_uri(link),
      'description': description,
      'author_email': author_email,
      'author_name': author_name,
      'author_link': iri_to_uri(author_link),
      'pubdate': pubdate,
      'comments': comments,
      'unique_id': unique_id,
      'enclosure': enclosure,
      'categories': categories,
      'item_copyright': item_copyright,
      'ttl': ttl,
    };
    item.categories = item.categories || [];
    enforce( item, 'title', 'link', 'description' );
    this.items.push( item );
    return this;
  },
  
  get length () {
    return this.items.length;
  },
  
  toString: function () {
    var document = new XMLNode( 'rss', this.rss_attributes() ),
        channel = new XMLNode( 'channel', this.root_attributes() );
    document.appendChild( channel );
    this.add_root_elements( channel );
    this.write_items( channel );
    return '<?xml version="1.0" encoding="utf-8"?>\n' + document.toString();
  },

  root_attributes: function () { return {}; },

  rss_attributes: function () {
    return { "version": this._version,
             "xmlns:atom": "http://www.w3.org/2005/Atom" };
  },

  write_items: function ( parentNode ) {
    this.items.forEach(function ( item ) {
      var itemnode = new XMLNode( 'item', this.item_attributes(item) );
      this.add_item_elements( itemnode, item );
      parentNode.appendChild( itemnode );
    }, this);
  },

  add_item_elements: function ( parentNode, container ) {},

  // Return extra attributes to place on each item (i.e. item/entry) element.
  item_attributes: function ( item ) { return {}; },

  add_root_elements: function ( parentNode ) {
    parentNode.appendChild( new XMLNode( "title", this.feed.title ) );
    parentNode.appendChild( new XMLNode( "link", this.feed.link ) );
    parentNode.appendChild( new XMLNode( "description", this.feed.description ) );

    // handler.addQuickElement( "atom:link", None, {u"rel": u"self", u"href": self.feed['feed_url']})
    if ( this.feed.language ) {
      parentNode.appendChild( new XMLNode( "language", this.feed.language ) );
    }
    this.feed.categories.forEach(function ( cat ) {
      parentNode.appendChild( new XMLNode( "category", cat ) );
    });
    if ( this.feed.feed_copyright ) {
      parentNode.appendChild( new XMLNode( "language", this.feed.feed_copyright ) );
    }
    parentNode.appendChild( new XMLNode( "lastBuildDate", this.latest_post_date().toUTCString() ) );
    if ( this.feed.ttl || this.feed.ttl === 0 ) {
      parentNode.appendChild( new XMLNode( "ttl", this.feed.ttl ) );
    }
  },
  
  // Returns the latest item's pubdate. If none of them have a pubdate, this returns the current date/time.
  latest_post_date: function () {
    var latest = -Infinity;
    this.items.forEach(function (itm) {
      if ( itm.pubdate && ( itm.pubdate * 1 > latest ) ) { latest = itm.pubdate; }
    });
    return latest || new Date();
  },

};



exports.RssUserland091Feed = RssUserland091Feed;
function RssUserland091Feed () { this.init.apply( this, arguments ); }
RssUserland091Feed.prototype = extend(new Feed, {

  _version: "0.91",

  add_item_elements: function ( parentNode, container ) {
    parentNode.appendChild( new XMLNode( "title", container.title ) );
    parentNode.appendChild( new XMLNode( "link", container.link ) );
    if ( container.description != null ) {
      parentNode.appendChild( new XMLNode( "description", container.description ) );
    }
  }

});



exports.Rss201rev2Feed = Rss201rev2Feed;
function Rss201rev2Feed () { this.init.apply( this, arguments ); }
Rss201rev2Feed.prototype = extend(new Feed, {
  // Spec: http://blogs.law.harvard.edu/tech/rss
  _version: "2.0",
  
  add_item_elements: function ( parentNode, container ) {
    parentNode.appendChild( new XMLNode( "title", container.title ) );
    parentNode.appendChild( new XMLNode( "link", container.link ) );
    if ( container.description != null ) {
      parentNode.appendChild( new XMLNode( "description", container.description ) );
    }
    // Author information.
    if ( container.author_name && container.author_email ) {
      var auth = container.author_email + ' (' + container.author_name + ')';
      parentNode.appendChild( new XMLNode( "author", auth ) );
    }
    else if ( container.author_email ) {
      parentNode.appendChild( new XMLNode( "author", container.author_email ) );
    }
    else if ( container.author_name ) {
      parentNode.appendChild( new XMLNode( "dc:creator", container.author_name, { "xmlns:dc":"http://purl.org/dc/elements/1.1/" } ) );
    }
    if ( container.pubdate != null ) {
      parentNode.appendChild( new XMLNode( "pubDate", container.pubdate.toUTCString() ) );
    }
    if ( container.comments != null ) {
      parentNode.appendChild( new XMLNode( "comments", container.comments ) );
    }
    if ( container.unique_id != null ) {
      parentNode.appendChild( new XMLNode( "guid", container.unique_id ) );
    }
    if ( container.ttl != null ) {
      parentNode.appendChild( new XMLNode( "ttl", container.ttl ) );
    }
    // Enclosure.
    if ( container.enclosure != null ) {
      parentNode.appendChild( new XMLNode( "enclosure", "", {
        "url": container.enclosure.url,
        "length": container.enclosure.length,
        "type": container.enclosure.mime_type,
      }));
    }
    // Categories
    container.categories.forEach(function ( cat ) {
      parentNode.appendChild( new XMLNode( "category", cat ) );
    });
  },

});




exports.Atom1Feed = Atom1Feed;
function Atom1Feed () { this.init.apply( this, arguments ); }
Atom1Feed.prototype = extend(new Feed, {
  // Spec: http://atompub.org/2005/07/11/draft-ietf-atompub-format-10.html
  ns: "http://www.w3.org/2005/Atom",

  toString: function () {
    var document = new XMLNode( 'feed', this.root_attributes() );
    this.add_root_elements( document );
    this.write_items( document );
    return '<?xml version="1.0" encoding="utf-8"?>\n' + document.toString();
  },

  root_attributes: function () {
    return ( this.feed.language != null ) 
        ? { "xmlns": this.ns, "xml:lang": this.feed['language'] }
        : { "xmlns": this.ns };
  },
  
  add_root_elements: function ( parentNode ) {
    var f = this.feed, p = parentNode;
    p.appendChild( new XMLNode( "title", f.title ) );
    p.appendChild( new XMLNode( "link", { "rel":"alternate", "href":f.link } ) );
    if ( f.feed_url != null ) {
      parentNode.appendChild( new XMLNode( "link", { "rel":"self", "href":f.feed_url } ) );
    }
    p.appendChild( new XMLNode( "id", f.id ) );
    p.appendChild( new XMLNode( "updated", this.latest_post_date().toISOString() ) );
    if ( f.author_name ) {
      var auth = parentNode.appendChild( new XMLNode('author') );
      auth.appendChild( new XMLNode( "name", f.author_name ) );
      if ( f.author_email ) {
        auth.appendChild( new XMLNode( "email", f.author_email ) );
      }
      if ( f.author_link  ) {
        auth.appendChild( new XMLNode( "uri", f.author_link ) );
      }
    }
    if ( f.subtitle != null ) {
      parentNode.appendChild( new XMLNode( "subtitle", f.subtitle ) );
    }
    f.categories.forEach(function ( cat ) {
      parentNode.appendChild( new XMLNode( "category", "", { "term": cat } ) );
    });
    if ( f.feed_copyright != null ) {
      parentNode.appendChild( new XMLNode( "rights", f.feed_copyright ) );
    }
  },

  write_items: function ( parentNode ) {
    this.items.forEach(function ( item ) {
      var itemnode = new XMLNode( 'entry', this.item_attributes(item) );
      this.add_item_elements( itemnode, item );
      parentNode.appendChild( itemnode );
    }, this);
  },

  add_item_elements: function ( parentNode, container ) {
    var p = parentNode, c = container;
    p.appendChild( new XMLNode( "title", c.title ) );
    p.appendChild( new XMLNode( "link", '', { "href":c.link, "rel":"alternate" } ) );
    if ( c.pubdate ) {
      p.appendChild( new XMLNode( "updated", c.pubdate.toISOString() ) );
    }
    // Author information.
    if ( c.author_name ) {
      var auth = parentNode.appendChild( new XMLNode('author') );
      auth.appendChild( new XMLNode( "name", c.author_name ) );
      if ( c.author_email ) {
        auth.appendChild( new XMLNode( "email", c.author_email ) );
      }
      if ( c.author_link  ) {
        auth.appendChild( new XMLNode( "uri", c.author_link ) );
      }
    }
    // Unique ID.
    var unique_id = c.unique_id || get_tag_uri(c.link, c.pubdate);
    p.appendChild( new XMLNode( "id", unique_id ) );
    // Summary.
    if ( c.description != '' ) {
      p.appendChild( new XMLNode( "summary", c.description, {'type':'html'} ) );
    }
    // Enclosure.
    if ( c.enclosure != null ) {
      p.appendChild( new XMLNode( "link", "", {
        "rel": "enclosure",
        "href": container.enclosure.url,
        "length": container.enclosure.length,
        "type": container.enclosure.mime_type,
      }));
    }
    // Categories.
    c.categories.forEach(function ( cat ) {
      p.appendChild( new XMLNode( "category", "", { "term": cat } ) );
    });
    // Rights.
    if ( c.item_copyright != null ) {
      parentNode.appendChild( new XMLNode( "rights", c.item_copyright ) );
    }
  },
  
});

// This isolates the decision of what the system default is, so calling code can
// do "feedgenerator.DefaultFeed" instead of "feedgenerator.Rss201rev2Feed".
exports.DefaultFeed = Rss201rev2Feed
