// http://docs.python.org/library/argparse.html

function noop () {}


function Option () {
  this._flags = {}; 
}
Option.prototype = {
  'action': noop,
  'help': null,
  'default': null,
  'type': null,
  'nargs': 0,

  test: function ( arg, value ) {
    if ( arg in this._flags ) {
      this.action.call( this.context || this, value || true );
      return true;
    }
    return false;
  },
  
  print_help: function () {
    var f = Object.keys( this._flags );
    var p = f.join(', ');
    if ( p.length < 15 ) {
      p += Array( 15 - p.length ).join(' ');
    }
    ;;;console.log( ' ' + p + '  ' + this.help );
  },

};


function ArgumentParser ( desc, epilog ) {
  this._desc = desc || "";
  this._epilog = epilog || "";

  this._flags = {};
  this._options = []; 
  this.add_argument( '-h', '--help', {
    'help': 'show this help message and exit',
    'context': this,
    'action': function () {
      this.print_help();
      process.exit(0);
    },
  });
  
}
ArgumentParser.prototype = {
  
  add_argument: function () {
    var op = new Option();
    this._options.push( op );
    for (var a,i=0; i<arguments.length; i++) {
      a = arguments[i];
      // strings => "--help" / "-h"
      if ( typeof a === 'string' ) {
        this._flags[a] = op;
        op._flags[a] = true;
      }
      else if ( typeof a === 'object' ) {
        for ( key in a ) { op[key] = a[key]; }
      }
    }
  },
  
  parse_args: function ( args ) {
    var offset = 0;
    var argv = args || process.argv;
    
    if ( argv[0] === 'node' ) { argv = argv.slice(1); }
    
    argv = argv.slice(1);

    var rest = [];
    for (var i=0; i<argv.length; i++) {
      var item = argv[i],
          s = item.split('='),
          matched = false;
      for (var a=0; a<this._options.length; a++) {
        var option = this._options[a];
        matched = option.test( item, true, this ) || option.test( s[0], s[1], this );
      }
      if ( !matched ) {
        rest.push( item );
      }
    }
    return rest;
  },
  
  print_help: function () {
    var prog = ( process.argv[0] === 'node' ) ? 'node ' + process.argv[1] : process.argv[0];
    
    ;;;console.log( 'usage: ' + prog + ' [-h]\n' );
    if ( this._desc ) {
      ;;;console.log( this._desc + '\n' ); // FIXME: auto-linebreak this
    }
    ;;;console.log('optional arguments:');
    for (var i=0; i<this._options.length; i++) {
      this._options[i].print_help();
    }
  },
  
};


exports.ArgumentParser = ArgumentParser;