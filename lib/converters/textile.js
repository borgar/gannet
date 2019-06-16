const { parse } = require('../meta-attr');
const textile  = require('textile-js');

exports.convert = function (data) {
  const { content, meta } = parse(data);
  return {
    content: textile(content),
    meta: meta
  };
};

exports.extensions = [ 'textile' ];


