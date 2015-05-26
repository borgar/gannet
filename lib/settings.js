var fs = require('fs');
var slugify = require('./utils').slugify;

function Settings ( filename ) {
  if ( filename ) {
    var self = this;
    self.filename = filename;
    fs.readFileSync( filename, 'utf8' )
      .trim()
      .replace( /(?:^|\n)(\/\/|#)[^\n]+/g, '' )
      .split( '\n' )
      .forEach(function (line) {
        var m = line.trim().match( /^\s*([a-z0-9_]+)\s*=\s*((?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^"']+?)*?)\s*((?:\/\/|#).+)?\s*$/i );
        if ( m ) {
          if ( m[1] === m[1].toUpperCase() ) {
            var value = m[2];
            if ( /^(".*"|'.*')$/.test( value ) ) {
              value = value.slice( 1, -1 );
            }
            if ( value === 'true' || value === 'false' ) {
              value = value === 'true';
            }
            if ( /^-?(\d*\.)?\d+$/.test( value ) ) {
              value = Number(value);
            }
            self[ m[1] ] = value;
          }
          else {
            ;;;console.log( 'Ignoring setting: ', m[1] );
          }
        }
        else if ( line.trim() ) {
          //;;;console.log( 'Broken config line: ', line );
        }
      });

    // resolve paths relative to settings file if they're read from it
    if ( this.filename ) {
      var path = require('path'),
          base = path.dirname( path.resolve(this.filename) );
      'SOURCE_PATH OUTPUT_PATH STATIC_PATH THEME_PATH'.split(' ')
        .forEach(function(p){
          this[p] = path.resolve( base, this[p] );
        }, this)
        ;
    }

  }
}
Settings.prototype = {
  
  meet_requirements: function () {
    // run though settings and throw an error if we don't have what it takes to run
    for ( var opt in this ) {
      if ( opt.toUpperCase() === opt ) {
        // all paths must be valid
        // SITE_URL is required
        if ( !this.SITE_URL || !/\S/.test( this.SITE_URL ) ) {
          throw new Error( 'Required setting "SITE_URL" is missing a value.' );
        }
        // SOURCE_PATH is required
        if ( !this.SOURCE_PATH || !/\S/.test( this.SOURCE_PATH ) ) {
          throw new Error( 'Required setting "SOURCE_PATH" is missing a value.' );
        }
        // make sure ATOM_FEED_URL and RSS_FEED_URL lead with a slash
        if ( this.ATOM_FEED_URL && !/^\//.test( this.ATOM_FEED_URL ) ) {
          this.ATOM_FEED_URL = '/' + this.ATOM_FEED_URL;
        }
        if ( this.RSS_FEED_URL && !/^\//.test( this.RSS_FEED_URL ) ) {
          this.RSS_FEED_URL = '/' + this.RSS_FEED_URL;
        }
        // make sure DATE_FORMATS is a dict
        // make sure PAGINATION_PAGES is a list
      }
    }
  },

  'SITE_TITLE': 'A Gannet Blog',
  'SITE_URL':  'http://example.com/',
  'SITE_SUBTITLE': '',

  // 'SOURCE_PATH': 'content/',
  'OUTPUT_PATH': 'site/',
  'STATIC_PATH': '_static/',
  'THEME_PATH': 'theme/',

  'DEFAULT_STATUS': 'published',
  'DEFAULT_LANG': 'en',
  'DEFAULT_DATE_FORMAT': 'd. M Y',
  'DATE_FORMATS': {},

  'ATOM_FEED_URL': 'feed/atom/feed.xml',
  'RSS_FEED_URL': 'feed/feed.xml',
  'FEED_MAX_ITEMS': 20,
  'FEED_FULL_TEXT': true,

  'INDEX_MAX_ITEMS' : 10,

  // use pagination
  'PAGINATION': false,
  // how many items per paginated page
  'PAGINATION_ITEMS': 5,
  // allowed number of orphans in pagination
  'PAGINATION_ORPHANS': 0,
  // what templates to paginate
  'PAGINATION_PAGES': ['index'],
  
  // front page
  'INDEX_URL':      '/',
  // single blog
  'POST_URL':       '/:year/:month/:slug/:altlang/',
  // single page
  'PAGE_URL':       '/:slug/:altlang/',
  // archive page for an author
  'AUTHOR_URL':     '/author/:slug/',
  // overview page for authors
  'AUTHORS_URL':    '/author/',
  // archive page for all posts
  'ARCHIVES_URL':   '/archives/',
  // archive page for all posts tagged with a tag
  'TAG_URL':        '/tagged/:title/',
  // overview page for tags
  'TAGS_URL':       '/tagged/',
  // archive page for all posts in a category
  'CATEGORY_URL':   '/category/:title/',
  // overview page for all categories
  'CATEGORIES_URL': '/category/',
  // format for appending paginagtion bits to url
  'PAGINATION_URL': ':url/page/:page/',
  // format for appending paginagtion bits to url
  'SITEMAP_URL':    '/sitemap.xml',

};


exports.Settings = Settings;

exports.get_url_router = function ( settings ) {
  return function ( type, obj, with_file ) {
    var opt = type.toUpperCase() + '_URL';
    obj = obj || {};
    if ( opt in settings ) {
      var url_tmpl = settings[ opt ];
      if ( typeof obj === 'string' || obj instanceof String ) {
        s_obj = slugify( obj );
        obj = { 'slug': s_obj, 'title': s_obj, };
      }
      var r = ( obj.url ) ? obj.url : url_tmpl.replace( /:(\w+)/g, function ( a, bit ) {
        return ( bit in obj ) ? obj[ bit ] : '_MISSING_';
      });
      r = r.replace( /([\\\/-])[\\\/-]+/g, '$1' )
           .replace( /\-+(\.[a-z0-9_]+)?$/, '$1' )
           .replace( /^\-/, '' )
           ;
      if ( obj && !obj.url ) { obj.url = r; };
      if ( with_file ) {
        if ( with_file === true ) { with_file = 'index.html'; }
        return r.replace( /\/$/, '/' + with_file );
      }
      return r;
    }
    else {
      throw new Error( 'No known URL routing for ' + type );
    }
  };
};



