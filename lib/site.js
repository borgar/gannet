var path   = require('path'),
    fs     = require('fs');

var extend = require('./utils').extend;
var time   = require('./utils').time;
var rollup_with_values = require('./utils').rollup_with_values;
var rollup = require('./utils').rollup;
var read_files = require('./utils').read_files;

var Static = require('./static').Static,
    Post   = require('./post').Post;

var dust   = require( 'dust' );

exports.Site = Site;

function Site ( settings ) {
  this.settings = settings;
  this.source = this.resolve_path_setting( 'SOURCE_PATH', true );
  this.destination = this.resolve_path_setting( 'OUTPUT_PATH' );
  this.router = require('./settings').get_url_router( settings );
  this.reset();
  this.setup();
}
Site.prototype = {
  
  resolve_path_setting: function ( setting, must_exist ) {
    if ( !this.settings[setting] ) {
      throw new Error( 'Missing a ' + setting + ' setting' );
    }
    var r = path.resolve( this.settings[setting] );
    if ( must_exist && !path.existsSync( r ) ) {
      throw new Error( setting + ' setting "' + r + '" does not exist' );
    }
    return r;
  },
  
  reset: function () {
    this.posts = [];
    this.posts_translations = [];
    this.pages = [];
    this.pages_translations = [];
    this.files = [];
    this.authors = {};
    this.tags = {};
    this.categories = {};
    delete this.to_write;
    return this;
  },


  setup: function () {
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
    // TODO: prep generators
    this.generators = [];
    return this;
  },
  

  load_template: function ( name, required ) {
    var fname = name.replace( /\.html$/, '' ) + '.html';
    var theme_path = path.join( this.settings.THEME_PATH, 'templates' );
    var filename = path.join( theme_path || '.', fname );
    if ( !path.existsSync( filename ) ) {
      var err = 'Missing template: ' + fname;
      if ( required === true ) {
        throw new Error( err );
      }
      else {
        ;;;console.warn( err );
        return;
      }
    }
    var tmpl = fs.readFileSync( filename, 'utf8' );
    try {
      var cmpl = dust.compile( tmpl, name );
      dust.loadSource( cmpl );
    }
    catch ( err ) {
      ;;;console.error( 'Error in template', fname );
      throw err;
    }
    return tmpl;
  },


  read: function () {
    
    /* we should set up a structure where we can do this
    templates = [{
      id: 'somekey',
      required: true|false,
      type: list|single
    } .. and so on ..
    ]
    */
    // preload all templates in theme dir here
    'archives author authors categories category index page post tag tags'.split(' ')
      .forEach( this.load_template, this )
      ;

    // read_files
    var files = read_files( this.source )
      , all_posts = []
      , all_pages = []
      , languages = {}
      ;
    for (var i=0; i<files.length; i++) {
      // known type?
      var filename = files[i],
          ext = path.extname( filename ).slice(1);

      // known format
      if ( ext in this.converters ) {
        var data = fs.readFileSync( filename, 'utf8' );
        var file = this.converters[ ext ]( data );
        var in_dir = path.basename( path.dirname( filename ) );
        // detect file type
        var collection = ( in_dir === 'pages' ) ? all_pages : all_posts;
        var content = new Post( file.content, file.meta, this.settings, filename );
        var encapsulate = require('./utils').encapsulate;

        // encapsulate all tags and add URL's to them
        content.tags = content.tags.map(function (tag) {
          var tag = encapsulate( tag );
          tag.url = this.router( 'tag', tag );
          return tag;
        }, this);
        
        // encapsulate language and add a "full" name for the language
        content.lang = encapsulate( content.lang );
        content.lang.title = require('./mod/iso639-1').language[ content.lang ].title;

        // TODO: add support for authors 
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
        ;;;console.log( 'unknown file', files[i] );
      }
    }
    
    // static files
    var stat = this.resolve_path_setting( 'STATIC_PATH' );
    read_files( stat ).forEach(function ( source ) {
      this.files.push( new Static( source, source.slice( stat.length ) ) );
    },this);

    // static theme files
    var stat = path.join( this.resolve_path_setting( 'THEME_PATH' ), 'static' );
    read_files( stat ).forEach(function ( source ) {
      var _pep = path.join( 'theme', source.slice( stat.length ) );
      this.files.push( new Static( source, _pep ) );
    },this);
    
    // deal with translations
    // FIXME: we can omit this if all articles/posts are the same lang -> tally that in prev. loop
    var sort_translations = require('./utils').sort_translations;
    this.posts = sort_translations( all_posts );
    this.posts_translations = all_posts.filter(function(a){ return this.posts.indexOf(a) === -1 }, this);
    this.pages = sort_translations( all_pages );
    this.pages_translations = all_pages.filter(function(a){ return this.pages.indexOf(a) === -1 }, this);

    // create chains of next & prev articles
    var last_post;
    this.posts.forEach(function ( post ) {
      if ( last_post ) {
        post.prev = last_post;
        last_post.next = post;
      }
      last_post = post;
    });
    // chain same language posts togeather
    Object.keys( languages ).forEach(function ( lang ) {
      last_post = null;
      all_posts.forEach(function ( post ) {
        if ( post.lang == lang ) {
          if ( last_post ) {
            post.prev_in_lang = last_post;
            last_post.next_in_lang = post;
          }
          last_post = post;
        }
      });
    });

    // register categories, tags, and authors (for posts in "main index")
    this.posts.forEach(function (content) {
      
      rollup_with_values( this.categories, content.categories, content );
      this.categories.url = this.router( 'categories' );
      
      rollup_with_values( this.authors, content.authors, content );
      this.authors.url = this.router( 'authors' );
      
      rollup_with_values( this.tags, content.tags, content );
      this.tags.url = this.router( 'tags' );

    },this);

    return this;
  },
  
  generate: function () {
    // run every generator
    return this;
  },
  
  render: function () {

    var write_feed = require('./write').write_feed;
    var write_dict = require('./write').write_dict;
    var write_file = require('./write').write_file;

    var base_context = dust.makeBase( this.settings );
    var _posts = this.posts.sort(function (a,b) { return b.date - a.date; });
    context = base_context.rebase({
      posts      : _posts
    , posts_by_year: rollup( _posts, 'year' )
    , pages      : this.pages
    , tags       : this.tags
    , authors    : this.authors
    , categories : this.categories

    , INDEX      : 'URK'
    // make sure templates have a way to resolve urls for objects
    , index      : { 'url': this.router('index'),    'is_current': false }
    //, archive    : { url: router('archive'), is_current: false }
    , archives   : { 'url': this.router('archives'), 'is_current': false }
    // TODO: add routes for feeds too
    });
    a = context.get('archives');
    ;;;console.log( a );

    var to_write = this.to_write = {}
      , site = this
      ;

    var base = dust.makeBase( context );
    dust.optimizers.format = function( ctx, node ) { return node; };
    dust.onLoad = function ( name, cb ) {
      cb( null, site.load_template( name, true ) );
    };

    // render indexes (main, tags, authors, categories, archive)
    ['index','archives','tags','categories','authors']
      .filter(function (key) {
        // don't render if user hasn't supplied a template
        return key in dust.cache;
      })
      .forEach(function (key) {

        var ctx = context;
        if ( key === 'index' ) {
          var _posts = context.get('posts')
                  .slice( 0, this.settings.INDEX_MAX_ITEMS || 10 );
          ctx = context.push({
            'posts': _posts,
            'posts_by_year': rollup( _posts, 'year' )
          });
        }

        // TODO: Shortcut
        // write_file only if template or whatever is in the asset lists or settings is more recent than existing file
        // when we finish writing everything, we should update timestamp on dest dir and use that as ref
        dust.render( key, ctx, function(err, out) {
          if ( err ) { throw err; }
          write_file( site, site.router( key, '', 'index.html' ), out );
        });
      }, this)
      ;

    // render each post
    this.posts.concat( this.posts_translations )
      .forEach(function ( item ) {
        var key = 'post';
        var head = context.push({ 'post': item });
        dust.render( key, head, function(err, out) {
          if ( err ) { throw err; }
          write_file( site, site.router( key, item, 'index.html' ), out );
        });
      }, this);

    // render each pages
    this.pages.concat( this.pages_translations )
      .forEach(function ( item ) {
        var key = 'page';
        item = Object.create( item );
        item.is_current = true;
        var head = context.push({ 'page': item });
        dust.render( key, head, function(err, out) {
          if ( err ) { throw err; }
          write_file( site, site.router( key, item, 'index.html' ), out );
        });
      });

    // render posts feed (ATOM & RSS flavors)
    write_feed( this.posts, this, 'rss' );
    write_feed( this.posts, this, 'atom' );

    // render each tag
    write_dict( this.tags, this, context, 'tag' );
    // render each category
    write_dict( this.categories, this, context, 'category' );
    // render each category
    write_dict( this.authors, this, context, 'author' );

    // queue static files
    this.files.forEach(function ( file ) {
      to_write[ file.destination ] = file.handle;
    });

    return this;
  },
  
  cleanup: function () {
    // oldfiles <= seek all files in output dir already
    // newfiles <= tally files to write (posts, pages, static)
    // any oldfiles not in newfiles should be killed
    return this;
  },


   write: function () {
    // create directories needed
    var abspaths = Object.keys( this.to_write ).map(function ( file ) {
      return path.dirname( path.join( this.destination, file ) );
    }, this);
    require( './utils' ).mkdirs( abspaths );

    // write out all content (posts, pages, static)
    var open = 0;
    var _cb = function (err) { if (err) { ;;;console.log(open); throw err; } open--; };
    for ( var filename in this.to_write ) {
      var abs = path.join( this.destination, filename );
      var out = this.to_write[filename];
      /*if ( open < 100 ) { // systems can choke on too many files at once
        open++;
        fs.writeFile( abs, out, _cb );
      }
      else {
        fs.writeFileSync( abs, out );
      }*/
      fs.writeFileSync( abs, out );
    }
    return this;
  },

  process: function () {
    time('process');
    try {
      this.reset();
      time('read'); this.read(); time.end('read');
      this.generate();
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
