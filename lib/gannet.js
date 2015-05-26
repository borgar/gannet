/*
 * Gannet - a static blog engine
 *
 */

exports.Settings = require('./settings').Settings;

exports.Site     = require('./site').Site;

exports.Server   = function Server ( site, host ) {
  var path = require( 'path' )
    , fs   = require( 'fs' )
    ;
  this.instance = require( './mod/server' ).start( host || ':8888' );
  this.instance.get( /^(.*)$/, function ( req, res, filename ) {
    if ( filename.substr(-1) === '/' ) {
      var f = [ filename + 'index.html'
              , filename + 'index.xml'
              , filename + 'feed.xml' 
              ];
      (function next () {
        var file = path.join( site.destination, f.shift() );
        fs.exists( file, function ( exists ) {
          if ( exists ) {
            res.file( file );
            return;
          }
          else if ( f.length ) { 
            next();
          }
          else {
            res.text( 404, "404 - file not found" );
          }
        });
      })();
    }
    else {
      res.file( path.join( site.destination, filename ) );
    }
  });
}
