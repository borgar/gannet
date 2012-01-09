var path = require('path');
var template = require( './mod/template' );

exports.write_feed = write_feed;
exports.write_dict = write_dict;


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

  var theme_path = path.join( site.settings.THEME_PATH, 'templates' );
  var tmpl = template.load( name_id + '.html', theme_path );
  Object.keys( dict ).forEach(function ( itm ) {
    context.posts = dict[ itm ];
    context[ name_id ] = itm;
    site.to_write[ router( name_id, itm, 'index.html' ) ] = tmpl.render( context );
  }, this);
  delete context[ name_id ];

  // TODO: create a feed for this group if we have [name_id]_RSS_URL 

}
