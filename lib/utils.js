var path    = require('path')
  , fs      = require('fs')
  , unicode = require('./mod/unicode')
  ;


exports.link = function ( a, b ) {
  b.__proto__ = a;
  return b;
};


// todo: is there a better way to copy files?
exports.copy = function ( src, dst, cb ) {
  exports.mkdirs( path.dirname( dst ) );
  fs.readFile( src, function ( err, data ) {
    if (err) throw err;
    fs.writeFile( dst, data, cb );
  });
};



exports.slugify = function ( txt ) {
  var r = unicode.decompose( txt ).trim().toLowerCase()
          .replace( /[^\w\s-]/g, '' )
          .replace( /[\-\s]+/g, '-' );
  return r;
};




function Coocon ( str ) {
  this.value = str;
}
Coocon.prototype = new String;
Coocon.prototype.valueOf = function () {
  return this.value;
};
Coocon.prototype.toString = Coocon.prototype.valueOf;
exports.encapsulate = function ( str ) {
  return new Coocon( str );
};


exports.rollup = function ( list, property ) {
  var collection = {}
    , grouped_list = []
    , group
    ;
  list.forEach(function ( item ) {
    var key = item[ property ];
    if ( key in collection ) {
      collection[ key ].push( item );
    }
    else {
      group = {
        'items': [ item ]
      , 'id': key
      };
      group[ property ] = key;
      grouped_list.push( group );
      collection[ key ] = group.items;
    }
  });
  return grouped_list;
}


exports.sort_translations = function ( content_list ) {
  var grouped = exports.rollup( content_list, 'slug' )
    , index = []
    ;
  grouped.forEach(function ( group ) {
    var items = group.items
      , deflang_items = items.filter(function ( a ) {
                                return a.in_default_lang;
                              })
      ;
    if ( deflang_items.length > 1 ) { // more than one competing default language entries
      console.warn( 'there are ' + deflang_items.length + ' variants of "' + slug + '"' );
      deflang_items.forEach(function ( a ) {
        console.warn('    ' + a.filename);
      });
      // FIXME: pick latest one
      deflang_items = deflang_items.slice( 0, 1 ); // use the first one
    }
    // else if ( !deflang_items.length ) { // no default language entries
    //   // TODO: add a setting that forces single non-default language entries to default
    //   default_lang_items = items.slice( 0, 1 ); 
    // }
    index.push( deflang_items[0] || items[0] );
    // articles are all translations of each other
    items.forEach(function ( item ) {
      item.translations = items.filter(function ( a ) { return a !== item; });
    });
  })
  return index;
};


exports.mkdirs = function ( dirs, mode ) {
  if ( typeof dirs === 'string' ) {
    dirs = [ dirs ];
  }
  var _path_cache = {};
  dirs.forEach(function ( dir ) {
    dir = path.resolve( dir );
    if ( dir in _path_cache ) { return; }
    // climb up this path and create directories
    var bits = dir.split( /[\\\/]/g )
      , do_test = true
      , currpath
      ;
    for (var i=1; i<bits.length; i++) {
      currpath = bits.slice(0, i+1).join('/');
      if ( currpath in _path_cache ) {
        // path is known to exist
      }
      else if ( do_test && fs.existsSync(currpath) ) {
        // this exists -- remember that
        _path_cache[ currpath ] = 1;
      }
      else {
        do_test = false; // no need to ask any deeper
        fs.mkdirSync( currpath, mode || 493 ); // 493 = 0755
        _path_cache[ currpath ] = 1;
      }
    }
  });
};


exports.read_files = function read_files ( dir, exclude, _recurse ) {
  var files   = _recurse || []
    , exclude = exclude  || []
    , _valueof = function () { return this.fullpath; }
    , flist
    ;
  try {
    flist = fs.readdirSync( dir );
  }
  catch ( e ) {
    return files;
  }
  flist.forEach(function ( filename ) {
    var fullpath = path.join( dir, filename )
      , f = fs.statSync( fullpath )
      ;
    f.fullpath = fullpath;
    f.filename = filename;
    if ( /^(\.(?!=htaccess)|_|#)/.test( filename ) ||
         exclude.indexOf( filename ) !== -1 ) {
      return;
    }
    else if ( f.isFile() ) {
      files.push( f );
    }
    else if ( f.isDirectory() ) {
      read_files( fullpath, exclude, files );
    }
  });
  return files;
};


exports.make_feed = make_feed;
function make_feed ( posts, site, type ) {
  var settings = site.settings
    , router = require( './settings' ).get_url_router( settings )
    , Feed = ( type === 'atom' ) 
           ? require( './mod/feed' ).Atom1Feed
           : require( './mod/feed' ).Rss201rev2Feed
           ;
  var feed = new Feed({
    'title': settings.SITE_TITLE,
    'link': router( 'site' ),
    'feed_url': router( type + '_feed' ),
    'description': settings.SITE_SUBTITLE || '',
  });
  posts.slice( 0, settings.FEED_MAX_ITEMS || posts.length )
    .forEach(function ( post ) {
      feed.add_item({
        'title': post.title,
        'link': router( 'post', post ),  // feed should take care of resolution
        'description': post.content,     // TODO: add option for summaries
        'categories': post.tags || [],
        // author_name: getattr(item, 'author', null),  // FIXME: item can have multiple authors
        'pubdate': post.date,
      });
    });
  return feed.toString();
}





// FIXME: ignore content of object, canvas, and iframe tags?
// FIXME: don't add ellipsis at the end of tags: "some</p>..."
var html_tag_singles = { "br": 1, "hr": 1, "meta": 1, "link": 1, "img": 1, "input": 1, "base": 1, "area": 1, "param": 1, "isindex": 1, "option": 1 }
  , re_punkt         = /[^\.,\-+*="'#$%&\/\(\)_!?<>|\s]/g
  , re_html_splitter = /(<!--[\S\s]*?-->|<(?:\!?[\w:]+(?:"[^"]*"|'[^']*'|[^>]+)?|\/[\w:]+)>)/g
  , re_html_tagname  = /^[<!\/]+([a-z0-9:]+).*$/ig
  ;
exports.summarize = function ( html, word_limit, tail_postfix ) {
  word_limit = word_limit || 20;
  tail_postfix = tail_postfix || '...';
  var stack = []
    , bits = html.split( re_html_splitter ).filter( Boolean )
    , pos = 0
    , tagname
    , token
    , curr
    , nice
    , words
    , w
    , i = 0
    ;
  for ( ; i<bits.length; i++ ) {
    token = bits[i];
    if ( token[0] === '<' && token.substr(-1) === '>' ) {
      if ( token.substr( 0, 4 ) === '<!--' ) {
        continue; // never mind comments
      }
      tagname = token.replace( re_html_tagname, '$1' );
      if ( token[1] === '/' ) { // closing tag
        do {
          curr = stack.shift();
        }
        while ( stack.length && curr !== tagname );
      }
      else if ( token.substr( -2, 1 ) !== '/' &&
                !( tagname in html_tag_singles ) ) {
        stack.unshift( tagname ); // open tag
      }
    }
    else {
      w = 0;
      words = token.match( /(\s+|\S+)/g );
      for ( ; w<words.length; w++ ) {
        if ( words[w] && re_punkt.test( words[w] ) &&
             pos++ >= word_limit ) {
          return bits.slice( 0, i )
                      .concat( words.slice( 0, w+1 ) )
                      .concat([ ' ', tail_postfix ]).join( '' )
                      + ( stack.length ? '</' + stack.join( '></' ) + '>' : '' );
        }
      }
    }
  }
  return html;
};



exports.time = function time ( id ) {
  exports.time[ id ] = Date.now();
}
exports.time.end = function ( id ) {
  console.log( id, ( ( Date.now() - exports.time[ id ] ) / 1000 ) + 's' );
};
exports.time.it = function ( id, ctx, fn ) {
  exports.time( id );
  fn.call( ctx );
  exports.time.end( id );
};


