var path = require('path');
var fs   = require('fs');
var unicode = require('./mod/unicode');


exports.extend = function ( a ) {
  for (var i=1; i<arguments.length; i++) {
    if ( typeof arguments[i] == 'object' ) {
      for ( var key in arguments[i] ) {
        a[key] = arguments[i][key];
      }
    }
  }
  return a;
};



exports.slugify = function ( txt ) {
  var r = unicode.decompose( txt ).trim().toLowerCase()
          .replace( /[^\w\s-]/g, '' )
          .replace( /[\-\s]+/g, '-' );
  return r;
};


exports.format_url = function ( url_tmpl, props, as_file ) {
  var url = url_tmpl
    // replace any keywords found, else leave them be (for settings debugging)
    .replace( /:([a-z]+)/g, function ( a, b ) {
      return (b in props) ? props[b] : a;
    })
    // remove any sequences of url separators and trailing dashes
    .replace( /([\\\/-])[\\\/-]+/g, '$1' )
    .replace( /\-+(\.[a-z0-9_]+)?$/, '$1' )
    .replace( /^\-/, '' )
    ;
    // add a file extension (or file) if requested
  if ( as_file && url.substr(-5) !== ".html" ) {
    url += (url.substr(-1) === '/') ? 'index.html' : '.html';
  }
  return url
}


exports.rollup_with_values = function ( collection, list, object ) {
  list.forEach(function(item){
    if ( item in collection ) {
      collection[ item ].push( object||item );
    }
    else {
      collection[ item ] = [ object||item ];
    }
  }, this);
  return collection;
},


exports.rollup = function ( list, property ) {
  var collection = {};
  for (var i=0,l=list.length; i<l; i++) {
    var item = list[i],
        key  = item[property];
    if ( key in collection ) {
      collection[ key ].push( item );
    }
    else {
      collection[ key ] = [ item ];
    }
  }
  return collection;
}


exports.sort_translations = function ( content_list ) {
  var grouped = exports.rollup( content_list, 'slug' ),
      index = [];
  for ( var slug in grouped ) {
    var items = grouped[slug];
    var deflang_items = items.filter(function(a){ return a.in_default_lang; });
    if ( deflang_items.length > 1 ) { // more than one competing default language entries
      console.warn( 'there are ' + deflang_items.length + ' variants of "' + slug + '"' );
      deflang_items.forEach(function(a){ console.warn('    ' + a.filename); });
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
      item.translations = items.filter(function(a){ return a !== item; });
    });
  }
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
    var bits = dir.split( /[\\\/]/g ),
        do_test = true;
    for (var i=1; i<bits.length; i++) {
      var currpath = bits.slice(0, i+1).join('/');
      if ( currpath in _path_cache ) {
        // path is known to exist
      }
      else if ( do_test && path.existsSync(currpath) ) {
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


// FIXME: ignore content of object, canvas, and iframe tags?
// FIXME: don't add ellipsis at the end of tags: "some</p>..."
var html_tag_singles = {"br":1,"hr":1,"meta":1,"link":1,"img":1,"input":1,"base":1,"area":1,"param":1,"isindex":1,"option":1};
var re_punkt         = /[^\.,\-+*="'#$%&\/\(\)_!?<>|\s]/g;
var re_html_splitter = /(<!--[\S\s]*?-->|<(?:\!?[\w:]+(?:"[^"]*"|'[^']*'|[^>]+)?|\/[\w:]+)>)/g;
var re_html_tagname  = /^[<!\/]+([a-z0-9:]+).*$/ig;
exports.summarize = function ( html, word_limit, tail_postfix ) {
  word_limit = word_limit || 20;
  tail_postfix = tail_postfix || '...';
  var stack = [], pos = 0, tagname, token, curr, nice,
      bits = html.split( re_html_splitter ).filter( Boolean );
  for ( var i=0; i<bits.length; i++) {
    token = bits[i];
    if ( token[0] === '<' && token.substr(-1) === '>' ) {
      if ( token.substr( 0, 4 ) === '<!--' ) { continue; } // never mind comments
      tagname = token.replace( re_html_tagname, '$1' );
      if ( token[1] === '/' ) { // closing tag
        do { curr = stack.shift(); } while ( stack.length && curr !== tagname );
      }
      else if ( token.substr( -2, 1 ) !== '/' && !( tagname in html_tag_singles ) ) {
        stack.unshift( tagname ); // open tag
      }
    }
    else {
      for ( var w=0, words=token.match( /(\s+|\S+)/g ); w<words.length; w++ ) {
        if ( words[w] && re_punkt.test( words[w] ) && pos++ >= word_limit ) {
          return bits.slice( 0, i ).concat( words.slice( 0, w+1 ) ).concat([ ' ', tail_postfix ]).join('')
                  + (stack.length ? '</' + stack.join( '></' ) + '>' : '');
        }
      }
    }
  }
  return html;
};


exports.time = function time ( id ) { exports.time[ id ] = Date.now(); }
exports.time.end = function ( id ) { ;;;console.log(id, ((Date.now() - exports.time[id])/1000)+'s'); };
exports.time.it = function ( id, ctx, fn ) {
  exports.time( id );
  fn.call( ctx );
  exports.time.end( id );
};


