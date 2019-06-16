const slugify = require('./utils').slugify;

module.exports = function (settings) {
  return function (type, obj, with_file) {

    const opt = type.toUpperCase() + '_URL';
    obj = obj || {};

    if (opt in settings) {
      const url_tmpl = settings[opt];

      if (typeof obj === 'string' || obj instanceof String) {
        // convert strings to objects usable by the below
        const s_obj = slugify(obj);
        obj = {
          slug: s_obj,
          title: s_obj
        };
      }

      let result = obj.url;
      if (!result) {
        result = url_tmpl.replace(/:(\w+)/g, (a, bit) => (bit in obj ? obj[bit] : '_MISSING_'));
      }

      result = result
        .replace(/-{2,}/, '-')               // collapse dashes
        .replace(/[\\/-]+(?=\/)/g, '')       // trim any \/- before a slash
        .replace(/\/[\\/-]+/g, '/')          // trim any \/- after a slash
        .replace(/-+(\.[a-z0-9_]+)?$/, '$1') // remove file extensions
        .replace(/^-/, '');                  // don't end with a dash

      // cache the generated url
      if (obj && !obj.url) {
        obj.url = result;
      }

      if (with_file) {
        if (with_file === true) {
          with_file = 'index.html';
        }
        result = result.replace(/\/?$/, '/' + with_file);
      }

      return result;
    }
    else {
      throw new Error(`No known URL routing for content type "${type}"`);
    }
  };
};
