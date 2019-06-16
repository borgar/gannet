const fs = require('fs');
const path = require('path');

const re_setting = /^\s*([a-z0-9_]+)\s*=\s*((?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^"']+?)*?)\s*((?:\/\/|#).+)?\s*$/i;
const re_lineComment = /(?:^|\n)(\/\/|#)[^\n]+/g;

const contentDirs = [
  'SOURCE_PATH',
  'OUTPUT_PATH',
  'AUTHOR_PATH',
  'STATIC_PATH',
  'THEME_PATH'
];

const defaults = {
  SITE_TITLE: 'A Gannet Blog',
  SITE_URL:  'http://example.com/',
  SITE_SUBTITLE: '',

  OUTPUT_PATH: 'site/',
  STATIC_PATH: '_static/',
  THEME_PATH: '_theme/',

  DEFAULT_STATUS: 'published',
  DEFAULT_LANG: 'en',
  DEFAULT_DATE_FORMAT: 'd. M Y',
  DATE_FORMATS: {},

  ATOM_FEED_URL: 'feed/atom/feed.xml',
  RSS_FEED_URL: 'feed/feed.xml',
  FEED_MAX_ITEMS: 20,
  FEED_FULL_TEXT: true,

  INDEX_MAX_ITEMS: 10,

  // use pagination
  PAGINATION: false,
  // how many items per paginated page
  PAGINATION_ITEMS: 5,
  // allowed number of orphans in pagination
  PAGINATION_ORPHANS: 0,
  // what templates to paginate
  PAGINATION_PAGES: [ 'index' ],

  // front page
  INDEX_URL:      '/',
  // single blog
  POST_URL:       '/posts/:year/:month/:slug/:altlang/',
  // single page
  PAGE_URL:       '/:slug/:altlang/',
  // archive page for an author
  AUTHOR_URL:     '/author/:slug/',
  // overview page for authors
  AUTHORS_URL:    '/author/',
  // archive page for all posts
  ARCHIVES_URL:   '/posts/',
  // archive page for all posts tagged with a tag
  TAG_URL:        '/tagged/:title/',
  // overview page for tags
  TAGS_URL:       '/tagged/',
  // archive page for all posts in a category
  CATEGORY_URL:   '/category/:title/',
  // overview page for all categories
  CATEGORIES_URL: '/category/',
  // format for appending paginagtion bits to url
  PAGINATION_URL: ':url/page/:page/',
  // format for appending paginagtion bits to url
  SITEMAP_URL:    '/sitemap.xml'
};

class Settings {

  constructor (filename) {

    for (const key in defaults) {
      this[key] = defaults[key];
    }

    if (filename) {
      this.filename = filename;
      fs.readFileSync(filename, 'utf8')
        .trim()
        .replace(re_lineComment, '')
        .split('\n')
        .forEach(line => {
          const m = line.trim().match(re_setting);
          if (m) {
            if (m[1] === m[1].toUpperCase()) {
              let value = m[2];
              if (/^(".*"|'.*')$/.test(value)) {
                value = value.slice(1, -1);
              }
              if (value === 'true' || value === 'false') {
                value = value === 'true';
              }
              if (/^-?(\d*\.)?\d+$/.test(value)) {
                value = Number(value);
              }
              this[m[1]] = value;
            }
            else {
              ;;;console.log('Ignoring setting: ', m[1]);
            }
          }
          else if (line.trim()) {
            // ;;;console.log( 'Broken config line: ', line );
          }
        });

      if (this.filename) {
        // resolve paths relative to settings file if they're read from it
        const full = path.resolve(this.filename);
        const base = path.dirname(full);
        contentDirs.forEach(p => {
          this[p] = path.resolve(base, this[p]);
        });
        // get the settings file mtime
        this.mtime = fs.statSync(full).mtime;
      }
      else {
        this.mtime = -Infinity;
      }

    }
  }

  meet_requirements () {
    // run though settings and throw an error if we don't have what it takes to run
    for (const opt in this) {
      if (opt.toUpperCase() === opt) {
        // all paths must be valid
        // SITE_URL is required
        if (!this.SITE_URL || !/\S/.test(this.SITE_URL)) {
          throw new Error('Required setting "SITE_URL" is missing a value.');
        }
        // SOURCE_PATH is required
        if (!this.SOURCE_PATH || !/\S/.test(this.SOURCE_PATH)) {
          throw new Error('Required setting "SOURCE_PATH" is missing a value.');
        }
        // make sure ATOM_FEED_URL and RSS_FEED_URL lead with a slash
        if (this.ATOM_FEED_URL && !/^\//.test(this.ATOM_FEED_URL)) {
          this.ATOM_FEED_URL = '/' + this.ATOM_FEED_URL;
        }
        if (this.RSS_FEED_URL && !/^\//.test(this.RSS_FEED_URL)) {
          this.RSS_FEED_URL = '/' + this.RSS_FEED_URL;
        }
        // make sure DATE_FORMATS is a dict
        // make sure PAGINATION_PAGES is a list
      }
    }
  }
};

exports.Settings = Settings;
