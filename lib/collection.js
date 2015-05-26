exports.Collection = Collection;


function Collection ( name, site, unique_key ) {
  if ( unique_key && typeof unique_key === 'string' ) {
    this.$uniq = function ( itm ) { return itm[ unique_key ]; }
  }
  else if ( unique_key && typeof unique_key === 'function' ) {
    this.$uniq = unique_key
  }
  this.url = site.router( name );
  this.is_current = false;
  this.id = name;
  this.items = [];
  this.$seen = {};
  this.mtime = -Infinity;
}

Collection.prototype.add = function ( items, content_item ) {
  var uniq = ( this.$uniq || String )
    , seen = this.$seen
    , mtime = content_item.mtime
    ;
  if ( mtime && this.mtime < mtime ) {
    this.mtime = mtime; // maintain collection's most-recent-mtime
  }
  if ( !items.length ) { items = [ items ]; }
  items.forEach(function ( item ) {
    var id = uniq( item );
    // if ( !id ) { return; }
    if ( mtime && ((item.mtime && item.mtime < mtime) || !item.mtime) ) {
      item.mtime = mtime; // maintain collection's most-recent-mtime
    }
    if ( id in seen ) {
      var idx = seen[ id ].indexOf( content_item );
      // ;;;console.log( id, idx, content_item.slug );
      if ( idx === -1 ) {
        seen[ id ].push( content_item );
      }
    }
    else {
      item.items = seen[ id ] = [ content_item ];
      this.items.push( item );
    }
  },this);
};

Collection.prototype.sort = function ( fn ) {
  var uniq = ( this.$uniq || String );
  this.items = this.items.sort( fn || function ( a, b ) {
    a = uniq( a ); b = uniq( b );
    if ( a < b ) {
      return -1;
    }
    else if ( a > b ) {
      return 1;
    }
    return 0;  
  });
};
