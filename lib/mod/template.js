/*
 * Node Templating
 * Copyright 2011, Borgar Þorsteinsson
 * Licensed under the GPL-v2 software license.
 *
 *
 */


/*

ADD: 

  raw tag -> move something through unparsed
  http://jinja.pocoo.org/docs/templates/#escaping
  
  reconsider inheritance implementation
  http://jinja.pocoo.org/docs/tricks/#null-master-fallback
  
  add "super" support
  http://jinja.pocoo.org/docs/templates/#super-blocks
  
  stop "autoparsing" and this.single bullshit
  related -> http://jinja.pocoo.org/docs/templates/#named-block-end-tags

  OMG macros: http://jinja.pocoo.org/docs/templates/#macros
              http://jinja.pocoo.org/docs/templates/#import

  "ignore missing" for includes
  http://jinja.pocoo.org/docs/templates/#include


*/

var path     = require('path');
var fs       = require('fs');
var tokenize = require('./tokenizer').tokenize;

var tag_tokens = {
  'comment':  /({#\-?)\s*("(?:\\"|[^"])*?"|'(?:\\'|[^'])*?'|[\S\s]*?)\s*(\-?#})/,
  'variable': /({{\-?)\s*("(?:\\"|[^"])*?"|'(?:\\'|[^'])*?'|[\S\s]*?)\s*(\-?}})/,
  'block':    /({%\-?)\s*([a-z_]+)\s+("(?:\\"|[^"])*?"|'(?:\\'|[^'])*?'|[\S\s]*?)\s*(\-?%})/i,
};

var rx_oper  = /((<<|>?>>|[&\*\+-\/\^\|])?=|\+\+|--|\{|\}|\[)/;
var rx_keywd = /\b(?:break|case|else|continue|delete|while|(?:ca|swi)tch|with|default|do|finally|try|for|var|function|return|if|new|throw|void)\b/;

function extend ( a ) {
  for (var i=1; i<arguments.length; i++) {
    if ( typeof arguments[i] == 'object' ) {
      for ( var key in arguments[i] ) {
        a[key] = arguments[i][key];
      }
    }
  }
  return a;
}

function type ( o ) {
  var s = Object.prototype.toString.call( o );
  return s.substring( 8, s.length -1 ).toLowerCase();
}

function unstring ( s, force ) {
  var c = s.charAt(0);
  if ( (c === '"' || c === "'") && c === s[s.length-1] ) {
    return s.slice( 1, -1 );
  }
  return s;
}
exports.unstring = unstring;


function time ( id ) { time[ id ] = Date.now(); }
time.end = function ( id ) { ;;;console.log(id, ((Date.now() - time[id])/1000)+'s'); };


// statement chuncker
function splitter ( s, whitespace ) {
  //if ( !(s in seen) ) { ;;;console.log( s, bits ); }
  if ( whitespace ) {
    return s.match( /("(?:\"|[^"])*?"|'(?:\'|[^'])*?'|\s+|[^"'\s]+)/g );
  }
  else {
    return s.match( /("(?:\"|[^"])*?"|'(?:\'|[^'])*?'|[^"'\s]+)/g );
  }
}
exports.statement_splitter = splitter;

var tmpl_cache = {};
var template_loader = function ( name, basepath, cb ) {
  if ( name in tmpl_cache ) { return tmpl_cache[ name ]; }
  var fn = path.join( basepath || '.', name ),
      data = fs.readFileSync( fn, 'utf8' );
  tmpl_cache[ name ] = new Template( data, fn );
  return tmpl_cache[ name ];
};
exports.load = template_loader;



exports.render = function ( name, data ) {
  var tmpl;
  // Use a pre-defined template, if available
  if ( template_cache[ name ] ) {
    tmpl = template_cache[ name ];
  }
  tmpl = tmpl || new Template( name );
  return tmpl.render( data );
};



var replacers = {
  'not':'!',
  'and':'&&',
  'or':'||',
  'none':'null',
};
var fn_cache = {};
function resolve ( statement, context, force_bool ) {
  // shortcut resolution
  if ( statement in context ) { return context[ statement ]; }
  // evaluate statement
  try {
    var res, fn;
    // shortcut compilation
    if ( statement in fn_cache ) { 
      fn = fn_cache[ statement ];
    }
    else {
      var code = statement.replace(/\b(not|none|and|or)\b/g, function(a,b){ return replacers[a]||a; });
      fn = fn_cache[ statement ] = new Function( 'c', 'with(this){return (' + code + ');}' );
    }
    res = fn.call( context, context );
  }
  catch ( err ) {
    if ( err.name === 'ReferenceError' || err.name === 'TypeError' ) {
       res = undefined;
    }
    else {
      throw new SyntaxError( 'Illegal template statement:', statement );
    }
  }
  if ( force_bool ) {
    if ( type(res) === 'array' ) { res = res.length; }
    res = !!res;
  }
  return res;
}
exports.resolve_variable = resolve;


var node_prototype = {
  toString: function ( context ) {
    return '[TEMPLATE:'+this.tagname.toUpperCase()+']';
  }
};

function VarNode ( s ) {
  this.v = s;
  this.toString = function ( context ) {
    return resolve( this.v, context ) || '';
  };
}
VarNode.prototype = node_prototype;




var tag_handlers = {

  /*
   *
   */
  'extends': function ( s, template ) {
    this.single = true;
    if ( template.parent ) {
      throw new Error('Only 1 "extends" tag per template ('+template.filename+').')
    }
    // fetch and parse it now
    template.parent = template_loader(
      unstring( splitter( s )[0] ),
      path.dirname( template.filename )
    );
  },

  /*
   *
   */
  'include': function ( s, template ) {
    this.single = true;
    this.template = template_loader(
      unstring( splitter( s )[0] ),
      path.dirname( template.filename )
    );
    this.toString = function ( c ) {
      return this.template.render( c );
    };
    // fetch and parse it now
  },

  /*
   *
   *
   */
  'block': function ( s, template ) {
    template.blocks = template.blocks || {};
    template.blocks[ (this.name = s) ] = this; // register block
    this.toString = function ( ctx ) {
      var nodes = template.blocks[ this.name ].children;
      return template.render_list( nodes, Object.create( ctx ) );
    };
  },

  /*
   * for user in users if not user.hidden
   * for user in users
   * TODO: for item in sitemap recursive
   *
   */
  'for': function ( s, template ) {
    var m = /^([a-zA-Z0-9_]+)\s+in\s+(.+?)(?:if\s+(.+?))?$/.exec( s );
    this.item = m[1];
    this.list = m[2];
    this.cond = m[3];
    
    this.parse = function ( tokens, template ) {
      var until = { 'else':1, 'endfor':1 };
      this.loop = template.parse( tokens, until );
      var tok = tokens.shift();
      if ( tok.matches[1] === 'else' ) {
        this.empty = template.parse( tokens, { 'endfor':1 } );
        tokens.shift();
      }
    },
    
    this.toString = function ( context ) {
      var ctx = Object.create( context ),
          iter = resolve( this.list, context ),
          cond = this.cond,
          loop = this.loop
          ;
      if ( iter && cond ) {
        iter = iter.filter(function ( item ) {
          ctx[ this.item ] = item;
          return resolve( cond, ctx );
        })
      }
      if ( iter && type(iter) === 'object' ) {
        iter = Object.keys( iter );
      }
      else if ( iter && type(iter) !== 'array' ) {
        ;;;console.log('iter', type(iter), typeof iter, !!iter );
        throw new TypeError('for tag only accepts arrays');
      }
      if ( iter && iter.length ) {
        var l = iter.length,
            prop = this.item;
        return iter.map(function( item, i ){
          ctx[ prop ] = item;
          ctx.loop = {
            index:  i+1,
            index0: i,
            revindex: l-i+1,
            revindex0: l-i,
            first: i===0,
            last: i===l-1,
            length: l,
            cycle: function () { return arguments[ arguments.length % this.index ]; },
          };
          return template.render_list( loop, ctx );
        }).join('');
      }
      else if ( this.empty ) {
        return template.render_list( loop, ctx );
      }
      else {
        return '';
      }
    };
  },

  /*
   *
   */
  'if': function ( s, template ) {
    this['if'] = null;
    this['elif'] = [];
    this['else'] = null;
    this.parse = function ( tokens, template ) {
      var until = { 'else':1, 'elif':1, 'endif':1 },
          last = 'if';
      do {
        var block = template.parse( tokens, until ),
            tok = tokens.shift(),
            tagname = tok.matches[1];
        var d = {
          'cond': (last === 'if') ? s : tok.matches[2],
          'block': block,
        };
        if ( last === 'elif' ) {
          this['elif'].push( d );
        }
        else {
          this[ last ] = d;
        }
        if ( tagname === 'else' ) {
          until = { 'endif':1 };
        }
        last = tagname;
      }
      while ( tagname !== 'endif' );
    };
    this.toString = function ( ctx ) {
      if ( resolve( this['if'].cond, ctx, true ) ) {
        return template.render_list( this['if'].block, ctx );
      }
      for (var i=0; i<this['elif'].length; i++) {
        if ( resolve( this['elif'][i].cond, ctx, true ) ) {
          return template.render_list( this['elif'][i].block, ctx );
        }
      }
      return this['else']
          ? template.render_list( this['else'].block, ctx )
          : '';
    }
  },

  'set': function ( s, template ) {
    this.single = true;
    var m = /^(\w+)\s+=\s+(.+?)$/.exec( s );
    this.name = m[1];
    this.code = m[2];
    this.toString = function ( ctx ) {
      ctx[ this.name ] = resolve( this.code, ctx );
      return '';
    };
  },

};
exports.tags = tag_handlers;





function Template ( data, filename ) {
  this.filename = filename || '';
  var tokens = tokenize( data, tag_tokens, 'html' );
  this.nodes = this.parse( tokens );
}
Template.prototype = {

  parse: function ( tokens, pending ) {
    var nodes = [];
    pending = pending || {}
    while ( tokens.length ) {
      var token = tokens.shift();
      switch ( token.type ) {
        case 'comment':
          break;
        case 'block':
          var tagname = token.matches[1];
          if ( tagname in pending ) {
            tokens.unshift( token );
            return nodes;
          }
          else if ( /^end/.test( tagname ) ) {
            throw new Error( 'Unexpected end tag '+tagname+' ('+this.filename+')' );
          }
          if ( tagname in tag_handlers ) {
            var handler = tag_handlers[ tagname ];
            handler.prototype = node_prototype;
            // TODO: try cache this so tags can signal failures easier
            var node = new handler( token.matches[2], this );
            node.tagname = tagname;
            node._source = token.token;
            nodes.push( node );
            if ( node.parse ) {
              node.parse( tokens, this );
            }
            else if ( !node.single ) {
              var term = {}; term[ 'end' + tagname ] = 1;
              node.children = this.parse( tokens, term );
              tokens.shift();
            }
          }
          else {
            throw new Error( 'Unknown block tag '+tagname+' ('+this.filename+')' );
          }
          break;
        case 'variable':
          var node = new VarNode( token.matches[1], this );
          node._source = token.token;
          nodes.push( node );
          break;
        default:
          nodes.push( token.token );
          ;
      }
    }
    return nodes;
  },

  render: function ( context, _overrides, caller ) {
    var overrides = extend( {}, this.blocks, _overrides );
    if ( this.parent ) {
      return this.parent.render( context, overrides, this );
    }
    else {
      var old_blocks = this.blocks,
          result = '';
      this.blocks = overrides;
      try {
        return this.render_list( this.nodes, context );
      }
      finally {
        this.blocks = old_blocks;
      }
    }
  },

  render_list: function ( nodelist, context ) {
    var r = nodelist.map(function(node){
      try {
        return node.toString( context ) || '';
      }
      catch ( err ) {
        // TODO: more template error suppression code
        if ( err.name === 'SyntaxError' ) {
          ;;;console.log( node );
          throw new SyntaxError( 'Template syntax error: ' + (node && node._source || node) );
        }
        ;;;console.log( node );
        throw err;
      }
    }).join('');
    return r;
  },

};
