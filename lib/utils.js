const path = require('path');
const fs = require('fs');
const unicode = require('./mod/unicode');


// todo: is there a better way to copy files?
const noop = () => {};
exports.copy = function (src, dst, cb = noop) {
  mkdirs(path.dirname(dst));
  fs.readFile(src, (err, data) => {
    if (err) throw err;
    fs.writeFile(dst, data, cb);
  });
};



exports.slugify = function (txt) {
  return unicode.decompose(txt).trim().toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-');
};



const stringFn = {
  valueOf: function () {
    return this.value;
  },
  toString: function () {
    return this.value;
  }
};

exports.encapsulate = function (str, obj = {}) {
  return { value: str, ...stringFn, ...obj };
};


function rollup (list, accessor) {
  const keyFn = (typeof accessor === 'function') ? accessor : d => d[accessor];
  const collection = {};
  const grouped = [];
  list.forEach(item => {
    const key = keyFn(item);
    if (!(key in collection)) {
      collection[key] = [];
      collection[key].id = key;
      grouped.push(collection[key]);
    }
    collection[key].push(item);
  });
  return grouped;
};
exports.rollup = rollup;


function join_posts (content_list) {
  const index = [];

  // translations affect the index
  rollup(content_list, d => d.slug + '-' + d.part).forEach(group => {
    // this is a group of one, the most common case
    if (group.length === 1) {
      index.push(group[0]);
      return;
    }

    let deflang_items = group.filter(a => a.in_default_lang);
    if (deflang_items.length > 1) {
      // there are more than one competing default language entries
      const slug = deflang_items[0].slug;
      console.warn(`There are ${deflang_items.length} variants of "${slug}"`);
      deflang_items.forEach(a => console.warn(`    ${a.filename}`));
      // use the first one
      deflang_items = deflang_items.slice(0, 1); // FIXME: pick latest one
    }

    // the index either includes the default language item
    // or if there are only, non-def lang ones, the first one
    index.push(deflang_items[0] || group[0]);

    // articles are all translations of each other
    group.forEach(item => {
      item.translations = group.filter(a => a !== item);
    });
  });

  // multipart items are considered to be independent posts
  rollup(content_list, d => d.slug + '-' + d.lang).forEach(group => {
    const parts = [];
    let partCount = group.length;
    for (let part = 1; part <= group.length; part++) {
      if (part.partCount > partCount) {
        // respect set partcount because later parts may not be in yet
        partCount = Math.max(part, part.partCount);
      }
      const item = group.filter(d => d.part === part || part === 1 && !d.part);
      if (item.length === 1) {
        parts.push(item[0]);
      }
      else if (item.length > 1) {
        parts.push(item[0]);
        console.warn(`Part #${part} is repeated of "${group[0].slug}"`);
      }
      else {
        console.warn(`Missing part #${part} of "${group[0].slug}"`);
      }
    }
    if (partCount > 1) {
      // link up all the parts
      parts.forEach(d => {
        d.parts = parts;
        // set a new partCount
        d.partCount = partCount;
      });
    }
  });

  return index;
};
exports.join_posts = join_posts;



function mkdirs (dirs, mode) {
  if (typeof dirs === 'string') {
    dirs = [ dirs ];
  }
  const _path_cache = {};
  dirs.forEach(dir => {
    dir = path.resolve(dir);
    if (dir in _path_cache) { return; }
    // climb up this path and create directories
    const bits = dir.split(/[\\/]/g);
    let do_test = true;
    let currpath;
    for (let i = 1; i < bits.length; i++) {
      currpath = bits.slice(0, i + 1).join('/');
      if (currpath in _path_cache) {
        // path is known to exist
      }
      else if (do_test && fs.existsSync(currpath)) {
        // this exists -- remember that
        _path_cache[currpath] = 1;
      }
      else {
        do_test = false; // no need to ask any deeper
        fs.mkdirSync(currpath, mode || 493); // 493 = 0755
        _path_cache[currpath] = 1;
      }
    }
  });
};
exports.mkdirs = mkdirs;


function read_files (dir, exclude = [], _recurse) {
  const files = _recurse || [];
  let flist;
  try {
    flist = fs.readdirSync(dir);
  }
  catch (e) {
    return files;
  }
  flist.forEach(filename => {
    const fullpath = path.join(dir, filename);
    const f = fs.statSync(fullpath);
    f.fullpath = fullpath.normalize();
    f.filename = filename.normalize();
    if (/^(\.(?!=htaccess)|_|#)/.test(filename) ||
         exclude.indexOf(filename) !== -1) {
      return;
    }
    else if (f.isFile()) {
      files.push(f);
    }
    else if (f.isDirectory()) {
      read_files(fullpath, exclude, files);
    }
  });
  return files;
};
exports.read_files = read_files;


function make_feed (posts, site, type) {
  const settings = site.settings;
  const router = require('./router')(settings);
  const Feed = (type === 'atom')
    ? require('./mod/feed').Atom1Feed
    : require('./mod/feed').Rss201rev2Feed;
  const feed = new Feed({
    title: settings.SITE_TITLE,
    link: router('site'),
    feed_url: router(type + '_feed'),
    description: settings.SITE_SUBTITLE || ''
  });
  posts.slice(0, settings.FEED_MAX_ITEMS || posts.length)
    .forEach(function (post) {
      feed.add_item({
        title: post.title,
        link: router('post', post),  // feed should take care of resolution
        description: post.content,     // TODO: add option for summaries
        categories: post.tags || [],
        // author_name: getattr(item, 'author', null),  // FIXME: item can have multiple authors
        pubdate: post.date
      });
    });
  return feed.toString();
}
exports.make_feed = make_feed;


// FIXME: ignore content of object, canvas, and iframe tags?
// FIXME: don't add ellipsis at the end of tags: "some</p>..."
const html_tag_singles = { br: 1, hr: 1, meta: 1, link: 1, img: 1, input: 1, base: 1, area: 1, param: 1, isindex: 1, option: 1 };
const re_punkt         = /[^.,\-+*="'#$%&/()_!?<>|\s]/g;
const re_html_splitter = /(<!--[\S\s]*?-->|<(?:!?[\w:]+(?:"[^"]*"|'[^']*'|[^>]+)?|\/[\w:]+)>)/g;
const re_html_tagname  = /^[<!/]+([a-z0-9:]+).*$/ig;

exports.summarize = function (html, word_limit = 20, tail_postfix = '…') {
  const stack = [];
  const bits = html.split(re_html_splitter).filter(Boolean);
  let pos = 0;
  let tagname;
  let token;
  let curr;
  let words;
  let w;
  let i = 0;
  for (; i < bits.length; i++) {
    token = bits[i];
    if (token[0] === '<' && token.substr(-1) === '>') {
      if (token.substr(0, 4) === '<!--') {
        continue; // never mind comments
      }
      tagname = token.replace(re_html_tagname, '$1');
      if (token[1] === '/') { // closing tag
        do {
          curr = stack.shift();
        }
        while (stack.length && curr !== tagname);
      }
      else if (token.substr(-2, 1) !== '/' && !(tagname in html_tag_singles)) {
        stack.unshift(tagname); // open tag
      }
    }
    else {
      w = 0;
      words = token.match(/(\s+|\S+)/g);
      for (; w < words.length; w++) {
        if (words[w] && re_punkt.test(words[w]) &&
             pos++ >= word_limit) {
          return bits.slice(0, i)
            .concat(words.slice(0, w + 1))
            .concat([ ' ', tail_postfix ]).join('') +
                      (stack.length ? '</' + stack.join('></') + '>' : '');
        }
      }
    }
  }
  return html;
};



exports.time = id => {
  exports.time[id] = Date.now();
};
exports.time.end = id => {
  console.log(id, ((Date.now() - exports.time[id]) / 1000) + 's');
};
exports.time.it = function (id, ctx, fn) {
  exports.time(id);
  fn.call(ctx);
  exports.time.end(id);
};


