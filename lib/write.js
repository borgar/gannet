var path = require('path');
var dust = require('dust');
var fs = require('fs');
var mkdirs = require( './utils' ).mkdirs;

exports.write_feed = write_feed;
exports.write_dict = write_dict;
exports.write_file = write_file;


function write_feed ( posts, site, type ) {
  var router = require( './settings' ).get_url_router( site.settings )
    , settings = site.settings
    , Feed = ( type === 'atom' ) 
           ? require('./mod/feed').Atom1Feed
           : require('./mod/feed').Rss201rev2Feed
           ;
  var feed = new Feed({
    title: settings.SITE_TITLE,
    link: router( 'site' ),
    feed_url: router( type + '_feed' ),
    description: settings.SITE_SUBTITLE || '',
  });
  posts.slice( 0, settings.FEED_MAX_ITEMS || posts.length )
    .forEach(function ( post ) {
      feed.add_item({
        title: post.title,
        link: router( 'post', post ),  // feed should take care of resolution
        description: post.content,     // TODO: add option for summaries
        categories: post.tags || [],
        // author_name: getattr(item, 'author', null),  // FIXME: item can have multiple authors
        pubdate: post.date,
      });
    });
  site.to_write[ router( type + '_feed', null, 'index.xml' ) ] = feed.toString();
}



function write_dict ( dict, site, context, name_id ) {
  var router = require( './settings' ).get_url_router( site.settings )

  Object.keys( dict )
    .forEach(function ( item ) {
      var obj = { 'posts': dict[ item ] };
      obj[ name_id ] = item;
      var head = context.push( obj );
      dust.render( name_id, head, function(err, out) {
        if ( err ) { throw err; }
        write_file( site, router( name_id, item, 'index.html' ), out );
      });
    });

  // TODO: create a feed for this group if we have [name_id]_RSS_URL 

}

function write_file ( site, file, output ) {
  var absfile = path.join( site.destination, file );
  mkdirs( path.dirname( absfile ) );
  fs.writeFile( absfile, output, function ( err ) {
    if ( err ) { throw err; }
    // ;;;console.log( 'wrote', absfile );
  });
}



