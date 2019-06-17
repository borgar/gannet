const { slugify } = require('./utils');
const path = require('path');

function unprefix (path, prefix) {
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }
  return path;
}

module.exports = function (settings) {
  const sitePath = settings.SITE_URL
    .replace(/[?#](.*?)$/g, '')
    .replace(/^([a-z]*:)?\/\/[^/]+/g, '');

  const router = function (type, obj, with_file) {
    let url_tmpl = '';
    const opt = type.toUpperCase() + '_URL';
    if (!(opt in settings)) {
      throw new Error(`No known URL routing for content type "${type}"`);
    }
    else {
      url_tmpl = settings[opt];
      obj = obj || {};
    }

    if (typeof obj === 'string' || obj instanceof String) {
      // convert strings to objects usable by the below
      const s_obj = slugify(obj);
      obj = { slug: s_obj, title: s_obj };
    }

    let result = obj.url;
    if (!result) {
      result = url_tmpl.replace(/:(\w+)/g, (a, bit) => (bit in obj ? obj[bit] : '_MISSING_'));
      result = path.join(sitePath, result);
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
      if (with_file === true) { with_file = 'index.html'; }
      result = unprefix(path.join(result, with_file), sitePath);
    }

    return result;
  };

  router.sitePath = sitePath;

  return router;
};
