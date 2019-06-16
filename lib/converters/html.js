const { parse } = require('../meta-attr');

exports.convert = function (data) {
  return parse(data);
};

exports.extensions = [ 'html', 'htm' ];


