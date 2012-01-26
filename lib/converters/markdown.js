var dateutil = require('dateutil')
  , marked   = require('marked')
  ;

var META_PROCESSORS = {
  'tags': function ( val, settings ) {
    return val ? val.trim().split(/\s*,\s*/) : [];
  },
  'date': function ( val, settings ) {
    return dateutil.parse( val );
  },
};

exports.convert = function ( data ) {

  var meta = {}
    , re_meta = /^([A-Z][a-z0-9_-]+):[ \t]*([^\n]+?)?\n/
    , m
    ;

  // get metadata
  while ( m = data.match( re_meta ) ) {
    var metakey = m[1].trim().toLowerCase()
      , metaval = ( m[2] || '' ).trim()
      ;
    if ( metakey in META_PROCESSORS ) {
      metaval = META_PROCESSORS[ metakey ]( metaval );
    }
    meta[ metakey ] = metaval;
    data = data.substr( m[0].length );
  }

  // Footnotes!
  // Temporary hack until Marked supports extensions or footnotes or extras
  if ( /\[\^/.test( data ) ) {
    data = data.replace( /(\n\[\^.+?\]:[\s\S]*?(?:\n(?!\[\^.+?\]:)|$))/, function (a,b) {
      return [
        '\n<div class="footnotes">\n<hr>\n<ol>\n',
        a.replace(
          /\n\[\^(.+?)\]:([^\n]+)/g,
          '\n<li id="fn:$1"><p>$2\n<a href="#fnref:$1" ',
          'rev="footnote">&#8617;</a></p></li>'
        ),
        '\n</ol>\n</div>\n'
      ].join('');
      console.log( a )
    })
    .replace( /\[\^(.+?)\]/g, '<sup id="fnref:$1"><a href="#fn:$1" '+
                              'rel="footnote">$1</a></sup>' )
    ;
  }

  return {
    content: marked( data.trim() )
  , meta: meta
  };

};

exports.extensions = [ 'md', 'markdown' ];


