var dateutil = require('../mod/dateutil');

var showdown = require('../mod/showdown');
var converter = new showdown.converter();
var marked = require('../mod/marked');
var converter = { makeHtml:marked };

var META_PROCESSORS = {
  'tags': function ( val, settings ) {
    return val ? val.trim().split(/\s*,\s*/) : [];
  },
  'date': function ( val, settings ) {
    return dateutil.parse( val );
  },
};

exports.convert = function ( data ) {

  var meta = {},
      m;

  // get metadata
  while ( m = data.match( /^([A-Z][a-z0-9_-]+):[ \t]*([^\n]+?)?\n/ ) ) {
    var metakey = m[1].trim().toLowerCase(),
        metaval = (m[2]||'').trim();
    if ( metakey in META_PROCESSORS ) {
      metaval = META_PROCESSORS[ metakey ]( metaval );
    }
    meta[ metakey ] = metaval;
    data = data.substr( m[0].length );
  }

  return {
    content: converter.makeHtml( data.trim() ),
    meta: meta,
  }

}
exports.extensions = ['md','markdown'];


