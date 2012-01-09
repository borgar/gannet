var stream = require('stream'),
    fs     = require('fs');

exports.Static = Static;

function Static ( source, dest ) {
  this.destination = dest;
  this.source = source;
  this._buffer = fs.readFileSync( source );
}
Static.prototype = {
  get handle () { return this._buffer; }
};