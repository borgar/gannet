var path   = require('path')
  , fs     = require('fs')
  , sys    = require('sys')

  , utils = require( './utils' )
  , time        = utils.time
  , mkdirs      = utils.mkdirs
  , link        = utils.link
  , copy        = utils.copy
  , copy        = utils.copy
  , read_files  = utils.read_files
  , encapsulate = utils.encapsulate
  , make_feed   = utils.make_feed
  , sort_translations = utils.sort_translations

  , isolang = require( './mod/iso639-1' ).language
  , get_url_router = require( './settings' ).get_url_router

  , Post   = require( './post' ).Post
  , Collection = require( './collection' ).Collection

  , template = require( 'swig' )
  ;


var DRY_RUN = false;


exports.Site = Site;

function Site ( settings ) {
  this.settings = settings;
  this.source = this.resolve_path_setting( 'SOURCE_PATH', true );
  this.destination = this.resolve_path_setting( 'OUTPUT_PATH' );
  this.router = get_url_router( settings );
  this.reset();
  this.setup();
}
Site.prototype = {
  
  resolve_path_setting: function ( setting, must_exist ) {
    if ( !this.settings[setting] ) {
      throw new Error( 'Missing a ' + setting + ' setting' );
    }
    var r = path.resolve( this.settings[setting] );
    if ( must_exist && !fs.existsSync( r ) ) {
      throw new Error( setting + ' setting "' + r + '" does not exist' );
    }
    return r;
  },
  
  reset: function () {
    this.posts = [];
    this.posts_translations = [];
    this.pages = [];
    this.pages_translations = [];

    this.existing_files  = {};
    this.generated_files = {};

    this.authors    = new Collection( 'authors', this );      // joint->content
    this.tags       = new Collection( 'tags', this );         // joint->content
    this.categories = new Collection( 'categories', this );   // joint->content
    this.index      = new Collection( 'index', this, 'slug' );//  ... ->content
    this.archives   = new Collection( 'archives', this, 'slug' );// . ->content
    this._templates = {};

    return this;
  },


  setup: function () {
    // prep template engine
    template.init({
      allowErrors: true,
      autoescape: true,
      encoding: 'utf8',
      root: path.join( this.settings.THEME_PATH, 'templates' ),
    });

    // prep readers
    this.converters = {};
    var mods = fs.readdirSync( path.join( path.dirname(module.filename), 'converters' ) );
    mods.forEach(function ( fn ) { if ( /\.js$/.test( fn ) ) {
      var mod = require( './converters/'+ fn.slice(0,-3) );
      if ( mod.convert && mod.extensions ) {
        for (var i=0; i<mod.extensions.length; i++) {
          this.converters[ mod.extensions[i] ] = mod.convert;
        }
      }
    }}, this);

    return this;
  },
  

  load_template: function ( name, required ) {
    name = name.replace( /\.html$/, '' );
    var fname = name + '.html'
      , theme_path = path.join( this.settings.THEME_PATH, 'templates' )
      , filename = path.join( theme_path || '.', fname )
      ;
    if ( !fs.existsSync( filename ) ) {
      var err = 'Missing template: ' + fname;
      if ( required === true ) {
        throw new Error( err );
      }
      else {
        console.warn( err );
        return;
      }
    }
    try {

      // load & compile the template
      var t = this._templates[ name ] = template.compileFile( fname );

      // find the template last mod time (taking "extends" into account)
      var mtime = fs.statSync( filename ).mtime;
      while ( t.parent ) {
        t = t.parent;
        var pname = path.join( theme_path || '.', t.id )
          , pmtime = fs.statSync( pname ).mtime
          ;
        if ( pmtime > mtime ) {
          mtime = pmtime;
        }
      }
      this._templates[ name ].filename = fname;
      this._templates[ name ].mtime = mtime;

    }
    catch ( err ) {
      console.error( 'Error in template', fname );
      throw err;
    }
  },


  read: function () {
  
    // preload all templates in theme dir
    var theme_path = path.join( this.settings.THEME_PATH, 'templates' );
    fs.readdirSync( theme_path ).forEach( this.load_template, this );

    // build a lookup of existing files
    read_files( this.destination ).forEach(function ( f ) {
      this.existing_files[ f.fullpath.slice(this.destination.length) ] = f;
    }, this);

    // read_files
    var files = read_files( this.source )
      , all_posts = []
      , all_pages = []
      , languages = {}
      ;
    
    // TODO: At this point we can detect if we have any update
    // and exit immediatly if there isn't a changed file.

    for (var i=0; i<files.length; i++) {
      // known type?
      var filename = files[i].fullpath
        , ext = path.extname( filename ).slice( 1 )
        ;

      // known format
      if ( ext in this.converters ) {
        var data = fs.readFileSync( filename, 'utf8' )
          , file = this.converters[ ext ]( data )
          , in_dir = path.basename( path.dirname( filename ) )
          // detect file type -- need to add support for more things
          , collection = ( in_dir === 'pages' ) ? all_pages : all_posts
          , content = new Post( file.content, file.meta, this.settings, filename )
          ;
        content._file = files[i];

        // encapsulate all tags and add URL's to them
        content.tags = content.tags.filter(Boolean).map(function (a) {
          var a = encapsulate( a );
          a.url = this.router( 'tag', a );
          a.items = [];
          return a;
        }, this);

        // encapsulate all authors and add URL's to them
        content.authors = content.authors.filter(Boolean).map(function (a) {
          var a = encapsulate( a );
          a.url = this.router( 'author', a );
          a.items = [];
          return a;
        }, this);
        
        // encapsulate all categories and add URL's to them
        content.categories = content.categories.filter(Boolean).map(function (a) {
          var a = encapsulate( a );
          a.url = this.router( 'category', a );
          a.items = [];
          return a;
        }, this);
        
        // encapsulate language and add a "full" name for the language
        content.lang = encapsulate( content.lang );
        content.lang.title = isolang[ content.lang ].title;

        // TODO: add support for author pages
        if ( content.is_valid && content.is_published ) {
          content.url = this.router( ( in_dir === 'pages' ? 'page' : 'post' ), content );
          collection.push( content );
          // TODO: add languages collections (like tags/authors/cats)?
          languages[ content.lang ] = content.lang;
        }
        else {
          // TODO: collect drafts
        }
      }
      else {
        console.log( 'unknown file', files[i] );
      }
    }
    
    // static files
    var stat = this.resolve_path_setting( 'STATIC_PATH' );
    read_files( stat ).forEach(function ( source ) {
      var dst = source.fullpath.slice( stat.length );
      if ( dst in this.existing_files &&
           this.existing_files[ dst ].mtime >= source.mtime ) {
        return; // skip this file - we already have a fresh copy
      }
      !DRY_RUN && copy( source.fullpath, path.join( this.destination, dst ) );
    },this);

    // static theme files
    var stat = path.join( this.resolve_path_setting( 'THEME_PATH' ), 'static' );
    read_files( stat ).forEach(function ( source ) {
      var _pep = path.join( 'theme', source.fullpath.slice( stat.length ) );
      if ( _pep in this.existing_files &&
           this.existing_files[ _pep ].mtime >= source.mtime ) {
        return; // skip this - we have a fresh copy
      }
      !DRY_RUN && copy( source.fullpath, path.join( this.destination, _pep ) );
    },this);
    
    // deal with translations
    // FIXME: we can omit this if all articles/posts are the same lang: Object.keys(languages).length === 1
    this.posts = sort_translations( all_posts );
    this.posts_translations = all_posts.filter(function ( a ) { return this.posts.indexOf( a ) === -1 }, this);
    this.pages = sort_translations( all_pages );
    this.pages_translations = all_pages.filter(function ( a ) { return this.pages.indexOf( a ) === -1 }, this);

    // create chains of next & prev articles
    this.posts = this.posts.sort(function ( a, b ) { return b.date - a.date; });
    this.posts.reduce(function ( last_post, post, i, arr ) {
      // hook next and prev
      if ( last_post ) {
        post.next = last_post;
        last_post.prev = post;
      }
      return post;
    });
    // chain same language posts togeather
    Object.keys( languages ).forEach(function ( lang ) {
      all_posts.reduce(function ( last_post, post, i, arr ) {
        if ( post.lang == lang ) {
          if ( last_post ) {
            post.prev_in_lang = last_post;
            last_post.next_in_lang = post;
          }
          return post;
        }
        return last_post;
      });
    });

    all_pages.concat( all_posts ).forEach(function ( content ) {
      // calculate mtime based on related posts
      var transdate = -Infinity
      if ( content.translations ) {
        content.translations.forEach(function ( p ) {
          if ( p._file.mtime > transdate ) {
            transdate = p._file.mtime;
          }
        });
      }
      content.mtime = Math.max(
        content._file.mtime || -Infinity,
        content.next ? content.next._file.mtime || content.next._file.mtime : -Infinity,
        content.prev ? content.prev._file.mtime || content.prev._file.mtime : -Infinity,
        transdate
      );
      if ( !isFinite( content.mtime ) ) {
        content.mtime = Infinity; // if in doubt set to: gets written
      }
    });

    // register categories, tags, and authors (for posts in "main index")
    this.posts.forEach(function (content) {
      // add post to all relevant collections
      this.categories.add( content.categories, content );
      this.authors.add( content.authors, content );
      this.tags.add( content.tags, content );
    },this);

    this.categories.sort();
    this.authors.sort();
    this.tags.sort();
    this.archives.items = this.posts;
    var idx_max = this.settings.INDEX_MAX_ITEMS;
    this.index.items = this.posts.slice( 0, idx_max || 10 );

    return this;
  },
  
  
  render: function () {

    var context = link( this.settings, {
      pages      : this.pages
    , tags       : this.tags
    , authors    : this.authors
    , categories : this.categories
    , index      : this.index
    , archives   : this.archives
    // FIXME: add routes for feeds too
    });

    function most_recent ( items ) {
      return items.reduce(function ( last, curr, i, arr ) {
        return ( !last && curr.mtime > last ) ? curr.mtime : last;
      }, null );
    }

    function render_collection ( key, tmpl_context, arr, newcheck ) {
      var _template = this._templates[ key ];
      arr.forEach(function ( item ) {
        var ctx = Object.create( tmpl_context )
          , outfn = this.router( key, item, 'index.html' )
          , out
          ;

        if ( !item || !item.toString() ) { return; }

        if ( outfn in this.existing_files ) {
          // have file... let's check if we need to refresh it
          var lastdt = this.existing_files[ outfn ].mtime
            , ndate = Math.max( item.mtime || item.date, _template.mtime )
            ;
          if ( lastdt && ndate && ndate <= lastdt ) {
            return; // skip this item
          }
        }

        ctx[ key ] = item;
        item.is_current = true;
        out = _template.render( ctx );
        this.write( outfn, out );
        item.is_current = false;

      }, this);
    }

    // render indexes (main, tags, authors, categories, archive)
    'index archives tags categories authors'.split(' ')
      .filter(function ( key ) {
        // don't render if user hasn't supplied a template
        return key in this._templates;
      }, this)
      .forEach(function ( key ) {
        var _template = this._templates[ key ]
          , outfn  = this.router( key, '', 'index.html' )
          , lastdt = this.existing_files[ outfn ] && this.existing_files[ outfn ].mtime
          , rdate  = Math.max( most_recent( context[ key ].items ), _template.mtime )
          ;
        if ( lastdt && rdate && rdate <= lastdt ) {
          return; // skip this item
        }

        context[ key ].is_current = true;
        this.write( outfn, _template.render( context ) );
        context[ key ].is_current = false;

      }, this)
      ;

    // render each post
    // render if post.date < template? | next/prev | translations
    render_collection.call( this, 'post', context,
          this.posts.concat( this.posts_translations ) );

    // render each pages
    render_collection.call( this, 'page', context,
          this.pages.concat( this.pages_translations ) );

    // render each category category
    render_collection.call( this, 'category', context,
          this.categories.items );

    // render each author page
    render_collection.call( this, 'author', context,
          this.authors.items );

    // render each tag page
    render_collection.call( this, 'tag', context,
          this.tags.items );

    // render posts feed (ATOM & RSS flavors)
    [ 'rss', 'atom' ].forEach(function ( feed_type ) {
      var feed_file = this.router( feed_type + '_feed', null, 'index.xml' )
        , feed_date = this.existing_files[ feed_file ] && this.existing_files[ feed_file ].mtime
        ;
      if ( !feed_date || most_recent( this.posts ) > feed_date ) {
        this.write( feed_file, make_feed( this.posts, this, feed_type ) );
      }
    }, this);

    // Sitemap
    //this.write( this.router( 'sitemap', null, '' ), 
    //           make_feed( this.posts, this, 'atom' ) );

    return this;
  },

  
  cleanup: function () {
    // oldfiles <= seek all files in output dir already
    // newfiles <= tally files to write (posts, pages, static)
    // any oldfiles not in newfiles should be killed
    return this;
  },


  write: function ( filename, output, cb ) {
    // ;;;console.log( 'write', filename );
    if ( !DRY_RUN ) {
      var absfile = path.join( this.destination, filename );
      mkdirs( path.dirname( absfile ) );
      fs.writeFile( absfile, output, cb || function ( err ) {
        if ( err ) { throw err; }
        // ;;;console.log( 'wrote', absfile );
      });
    }
  },


  process: function () {
    time('process');
    try {
      this.reset();
      time('read'); this.read(); time.end('read');
      time('render'); this.render(); time.end('render');
      this.cleanup();
      //time('write'); this.write(); time.end('write');
      this.reset();
      return this;
    }
    finally {
      time.end('process');
    }
  },

}
