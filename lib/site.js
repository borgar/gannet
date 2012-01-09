var path   = require('path'),
    fs     = require('fs');

var extend  = require('./utils').extend;
var time    = require('./utils').time;
var rollup_with_values = require('./utils').rollup_with_values;

var Static = require('./static').Static,
    Post   = require('./post').Post;

exports.Site = Site;


function Site ( settings ) {
  this.settings = settings;
  this.source      = this.resolve_path_setting( 'SOURCE_PATH', true );
  this.destination = this.resolve_path_setting( 'OUTPUT_PATH' );
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
    // ;;;console.log('reset');
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
  

  read_files: function read_files ( dir, exclude, _recurse ) {
    var files   = _recurse || [],
        exclude = exclude  || [],
        self    = this;
    fs.readdirSync( dir )
      .forEach(function (filename) {
        var fullpath = path.join(dir, filename),
            f = fs.statSync( fullpath );
        if ( /^(\.(?!=htaccess)|_|#)/.test( filename ) ||
             exclude.indexOf( filename ) !== -1 ) {
          return;
        }
        else if ( f.isFile() ) {
          files.push( fullpath );
        }
        else if ( f.isDirectory() ) {
          read_files.call( self, fullpath, exclude, files );
        }
      });
    return files;
  },

  read: function () {
    // TODO: preload all templates in theme dir here
    
    // read_files
    var files = this.read_files( this.source ),
        all_posts = [],
        all_pages = [],
        languages = {};
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
        if ( content.is_valid && content.is_published ) {
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
    this.read_files( stat ).forEach(function ( source ) {
      this.files.push( new Static( source, source.slice( stat.length ) ) );
    },this);
    // static theme files
    var stat = path.join( this.resolve_path_setting( 'THEME_PATH' ), 'static' );
    this.read_files( stat ).forEach(function ( source ) {
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
        if ( post.lang === lang ) {
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
      rollup_with_values( this.authors, content.authors, content );
      rollup_with_values( this.tags, content.tags, content );
    },this);

    return this;
  },
  
  generate: function () {
    // run every generator
    return this;
  },
  
  render: function () {

    var context = Object.create( this.settings );
    context.posts      = this.posts.sort(function (a,b) { return b.date - a.date; });
    context.pages      = this.pages;
    context.tags       = this.tags;
    context.authors    = this.authors;
    context.categories = this.categories;

    var theme_path = path.join( this.settings.THEME_PATH, 'templates' );
    var template = require( './mod/template' );
    var write_feed = require('./write').write_feed;
    var write_dict = require('./write').write_dict;

    var router = require( './settings' ).get_url_router( this.settings );

    // make sure templates have a way to resolve urls for objects
    template.tags['url'] = function ( s ) {
      this.single = true;
      var bits = template.statement_splitter( s );
      if ( bits.length !== 2 ) { throw new Error( 'URL takes 2 arguments (type, object): "' + s + '"' ); }
      this.type = template.unstring(bits[0]); // name
      this.prop = template.unstring(bits[1]); // propname
      this.toString = function ( ctx ) {
        var obj = this.prop ? template.resolve_variable( this.prop, ctx ) : {},
            opt = this.type;
        if ( !obj ) {
          ;;;console.log( 'Resolving url for falsy object:', s, obj );
          process.exit(1);
        }
        // get url tmpl for this.type
        return router( this.type, obj );
      };
    };
    
    var to_write = this.to_write = {};
    
    // render indexes (main, tags, authors, categories, archive)
    ['index','archives','tags','categories','authors'].forEach(function (key) {
      try {
        var tmpl = template.load( key + '.html', theme_path );
        this.to_write[ router( key, '', 'index.html' ) ] = tmpl.render( context );
      }
      catch ( e ) {
        // FIXME: eliminate this by preloading / testing all templates at setup time
      }
    }, this);

    // render each post
    var tmpl = template.load( 'post.html', theme_path );
    this.posts.concat( this.posts_translations ).forEach(function ( post ) {
      context.post = post;
      this.to_write[ router( 'post', post, 'index.html' ) ] = tmpl.render( context );
    }, this);
    delete context.post;
    
    // render each pages
    var tmpl = template.load( 'page.html', theme_path );
    this.pages.concat( this.pages_translations ).forEach(function ( page ) {
      context.page = page;
      to_write[ router( 'page', page, 'index.html' ) ] = tmpl.render( context );
    });
    delete context.page;

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
    try {
      time('process');
      return this.reset()
                 .read()
                 .generate()
                 .render()
                 .cleanup()
                 .write()
                 .reset()
                 ;
    }
    finally {
      time.end('process');
    }
  },

}
