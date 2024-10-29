import path from 'path';
import fs from 'fs';
import { time, mkdirs, copy, read_files, encapsulate, join_posts } from './utils.js';
import { language as isolang } from './mod/iso639-1.js';
import './mod/date-i18n.js';
import Rss201rev2Feed from './feed/Rss201rev2.js';
import Atom1Feed from './feed/Atom1.js';
import Router from './Router.js';
import { Post } from './post.js';
import { Collection } from './collection.js';
import { Templates } from './templates.js';
import converters from './converters/index.js';

const DRY_RUN = false;

const metaAlias = {
  tag: 'tags',
  tagged: 'tags',
  tags: 'tags',
  categories: 'categories',
  category: 'categories',
  author: 'authors',
  authors: 'authors'
};

export class Site {
  constructor (settings, verbose, smart_writes, cacheTemplates = true) {
    this.settings = settings;
    this.verbose = !!verbose;
    this.cacheTemplates = !!cacheTemplates;
    this.smart_writes = smart_writes == null ? true : !!smart_writes;
    this.source = this.resolve_path_setting('SOURCE_PATH', true);
    this.destination = this.resolve_path_setting('OUTPUT_PATH');
    this.router = new Router(settings);
    // prefix media path with site root
    this.settings.MEDIA_URL = path.join(this.router.sitePath, this.settings.MEDIA_URL);
    this.reset();
    this.setup();
  }

  log (...args) {
    // eslint-disable-next-line no-console
    this.verbose && console.log(...args);
  }

  resolve_path_setting (setting, must_exist) {
    if (!this.settings[setting]) {
      throw new Error('Missing a ' + setting + ' setting');
    }
    const r = path.resolve(this.settings[setting]);
    if (must_exist && !fs.existsSync(r)) {
      throw new Error(setting + ' setting "' + r + '" does not exist');
    }
    return r;
  }

  reset () {
    this.posts = [];
    this.posts_translations = [];
    this.pages = [];
    this.pages_translations = [];

    this.existing_files = {};
    this.generated_files = {};

    this.authors = new Collection('authors', this);      // joint->content
    this.tags = new Collection('tags', this);         // joint->content
    this.categories = new Collection('categories', this);   // joint->content
    this.index = new Collection('index', this, 'slug');//  ... ->content
    this.archives = new Collection('archives', this, 'slug');// . ->content

    return this;
  }

  setup () {
    // prep template engine
    this.templates = new Templates(this.settings, this.cacheTemplates);

    // prep readers
    this.converters = converters.reduce((all, converter) => {
      for (let i = 0; i < converter.extensions.length; i++) {
        all[converter.extensions[i]] = converter.convert;
      }
      return all;
    }, {});

    return this;
  }

  read () {
    this.templates.update();

    // build a lookup of existing files
    read_files(this.destination)
      .forEach(f => {
        const name = f.fullpath.slice(this.destination.length);
        this.existing_files[name] = f;
      });

    // read_files
    const files = read_files(this.source);
    const all_posts = [];
    const all_pages = [];
    const languages = {};

    // TODO: At this point we can detect if we have any update
    // and exit immediatly if there isn't a changed file.

    const isPageDir = fn => {
      const in_dir = path.basename(path.dirname(fn));
      return in_dir === 'pages';
    };

    const postLocIndex = [];
    const assets = [];

    for (let i = 0; i < files.length; i++) {
      // known type?
      const filename = files[i].fullpath;
      const ext = path.extname(filename).slice(1);

      // known format
      if (ext in this.converters) {
        const data = fs.readFileSync(filename, 'utf8');
        const file = this.converters[ext](data, this.settings);
        // detect file type
        const is_page = isPageDir(filename);

        // FIXME: move to a utility
        // normalize meta keys
        if (file.meta) {
          const newMeta = {};
          for (const key in file.meta) {
            const val = file.meta[key];
            if (key in metaAlias) {
              const dest = metaAlias[key];
              if (!newMeta[dest]) {
                newMeta[dest] = [];
              }
              if (Array.isArray(val)) {
                newMeta[dest].push(...val);
              }
              else {
                newMeta[dest].push(val);
              }
            }
            else {
              newMeta[key] = val;
            }
          }
          file.meta = newMeta;
        }

        const collection = is_page ? all_pages : all_posts;
        const content = new Post(file.content, file.meta, this.settings, filename);
        content.type = is_page ? 'page' : 'post';
        content._file = files[i];

        // encapsulate all tags and add URL's to them
        content.tags = content.tags
          .filter(Boolean)
          .map(a => encapsulate(a, {
            url: this.router.route('tag', a),
            items: []
          }));

        // encapsulate all authors and add URL's to them
        content.authors = content.authors
          .filter(Boolean)
          .map(a => encapsulate(a, {
            url: this.router.route('author', a),
            items: []
          }));

        // encapsulate all categories and add URL's to them
        content.categories = content.categories
          .filter(Boolean)
          .map(a => encapsulate(a, {
            url: this.router.route('category', a),
            items: []
          }));

        // encapsulate language and add a "full" name for the language
        content.lang = encapsulate(content.lang, {
          title: isolang[content.lang].title
        });

        // TODO: add support for author pages
        if (content.is_valid && content.is_published) {
          // ensure content has URLs so it can be linked to
          content.url = this.router.route(content.type, content);
          collection.push(content);
          // TODO: add languages collections (like tags/authors/cats)?
          languages[content.lang] = content.lang;
        }
        else {
          // TODO: collect drafts
        }

        // assets (files in folder) will be copied to the same path
        postLocIndex.push([ path.dirname(filename), content ]);
      }
      else {
        assets.push(files[i]);
      }
    }

    // copy assets
    for (let i = 0; i < assets.length; i++) {
      // is this owned?
      const dir = path.dirname(assets[i].fullpath);
      const fn = assets[i].fullpath.slice(dir.length + 1);
      postLocIndex
        .filter(d => d[0] === dir)
        .forEach(d => {
          const owner = d[1];
          const ownerUrl = this.router.route(owner.type, owner);
          const outFile = this.router.route(owner.type, owner, fn);
          const outUrl = path.join(ownerUrl, fn);
          owner.assets.push(outUrl);

          // content using this asset should normalize url
          owner.content = owner.content
            .replace(
              new RegExp('(src|href|data)="(./)?' + fn + '"', 'g'),
              (a, b) => `${b}="${outUrl}"`
            );
          // copy the asset
          this.log('copy', outFile);
          !DRY_RUN && copy(assets[i].fullpath, path.join(this.destination, outFile));
        });
    }

    // static files + static theme files
    [
      this.resolve_path_setting('STATIC_PATH'),
      path.join(this.resolve_path_setting('THEME_PATH'), 'static')
    ].forEach(stat => {
      read_files(stat).forEach(source => {
        const dst = source.fullpath.slice(stat.length);
        if (this.smart_writes && (dst in this.existing_files) &&
            this.existing_files[dst].mtime >= Math.max(this.settings.mtime, source.mtime)) {
          return; // skip this file - we already have a fresh copy
        }
        this.log('copy', dst);
        !DRY_RUN && copy(source.fullpath, path.join(this.destination, dst));
      });
    });

    // deal with translations / multipart posts
    this.posts = join_posts(all_posts);
    this.posts_translations = all_posts.filter(a => this.posts.indexOf(a) === -1);

    this.pages = join_posts(all_pages);
    this.pages_translations = all_pages.filter(a => this.pages.indexOf(a) === -1);

    // create chains of next & prev articles
    this.posts = this.posts.sort((a, b) => b.date - a.date);
    if (this.posts.length) {
      this.posts.reduce((last_post, post) => {
        // hook next and prev
        if (last_post) {
          post.next = last_post;
          last_post.prev = post;
        }
        return post;
      });
    }
    // chain same language posts togeather
    Object.keys(languages).forEach(lang => {
      all_posts.reduce((last_post, post) => {
        if (post.lang === lang) {
          if (last_post) {
            post.prev_in_lang = last_post;
            last_post.next_in_lang = post;
          }
          return post;
        }
        return last_post;
      });
    });
    // chain post-parts togeather
    this.posts.forEach(post => {
      if (post.parts && !('next_part' in post)) {
        post.parts.forEach((item, i) => {
          item.next_part = post.parts[i + 1] || null;
          item.prev_part = post.parts[i - 1] || null;
        });
      }
    });

    all_pages.concat(all_posts).forEach(content => {
      // calculate mtime based on related posts
      let transdate = -Infinity;
      if (content.translations) {
        content.translations.forEach(p => {
          if (p._file.mtime > transdate) {
            transdate = p._file.mtime;
          }
        });
      }
      content.mtime = Math.max(
        content._file.mtime || -Infinity,
        content.next ? content.next._file.mtime || content.next._file.mtime : -Infinity,
        content.prev ? content.prev._file.mtime || content.prev._file.mtime : -Infinity,
        transdate
      );
      if (!isFinite(content.mtime)) {
        content.mtime = Infinity; // if in doubt set to: gets written
      }
    });

    // register categories, tags, and authors (for posts in "main index")
    this.posts.forEach(content => {
      // add post to all relevant collections
      this.categories.add(content.categories, content);
      this.authors.add(content.authors, content);
      this.tags.add(content.tags, content);
    });

    // read extra author info if it is available
    if (this.settings.AUTHOR_PATH) {
      const aPath = this.resolve_path_setting('AUTHOR_PATH', true);
      const infos = read_files(aPath);
      this.authors.items.forEach(author => {
        const name = author.value.normalize();
        const auth = infos.find(d => d.filename.startsWith(name + '.'));
        if (auth) {
          const ext = path.extname(auth.filename).slice(1);
          if (ext in this.converters) {
            const data = fs.readFileSync(auth.fullpath, 'utf8');
            const file = this.converters[ext](data, this.settings);
            author.content = file.content;
          }
        }
      });
    }

    const prunedTags = this.tags.pruneUnique();
    this.log('pruned unique tags:', prunedTags.length);
    prunedTags.forEach(tag => {
      all_posts.forEach(post => {
        post.tags = post.tags.filter(d => d !== tag);
      });
    });

    const prunedCats = this.categories.pruneUnique();
    this.log('pruned unique categories:', prunedTags.length);
    prunedCats.forEach(cat => {
      all_posts.forEach(post => {
        post.categories = post.categories.filter(d => d !== cat);
      });
    });

    this.categories.sort();
    this.authors.sort();
    this.tags.sort();

    this.archives.items = this.posts;
    const idx_max = this.settings.INDEX_MAX_ITEMS;
    this.index.items = this.posts.slice(0, idx_max || 10);

    this.setup_feeds();

    return this;
  }

  setup_feeds () {
    const { settings } = this;

    this.atom_feed = new Atom1Feed({
      title: settings.SITE_TITLE,
      link: settings.SITE_URL,
      feed_url: this.router.route('atom_feed'),
      description: settings.SITE_SUBTITLE || ''
    });

    this.rss_feed = new Rss201rev2Feed({
      title: settings.SITE_TITLE,
      link: settings.SITE_URL,
      feed_url: this.router.route('rss_feed'),
      description: settings.SITE_SUBTITLE || ''
    });

    this.posts.slice(0, settings.FEED_MAX_ITEMS || Infinity)
      .forEach(post => {
        const author = post.authors[0];
        const data = {
          title: post.title,
          // link: getLink(post), // feed should take care of resolution?
          link: this.router.route('post', post), // feed should take care of resolution?
          // FIXME: item can have multiple authors
          author_name: author && String(author),
          author_link: author && author.url,
          // FIXME: URLs in the description need to be absolute
          description: settings.FEED_USES_SUMMARY ? post.summary : post.content,
          categories: post.tags || [],
          pubdate: post.date
        };
        this.atom_feed.add_item(data);
        this.rss_feed.add_item(data);
      });
  }

  render () {
    const context = {
      // ...this..settings,
      pages: this.pages,
      tags: this.tags,
      authors: this.authors,
      categories: this.categories,
      index: this.index,
      archives: this.archives,
      rss_feed: this.rss_feed,
      atom_feed: this.atom_feed
    };

    function most_recent (items) {
      return items.reduce((last, curr) => {
        return (!last && curr.mtime > last) ? curr.mtime : last;
      }, null);
    }

    function render_collection (key, tmpl_context, arr) {
      const tmpl = this.templates.stat(key);
      arr.forEach(item => {
        const ctx = Object.create(tmpl_context);
        const outfn = this.router.route(key, item, 'index.html', key === 'post');
        if (!item || !item.toString()) { return; }

        if (outfn in this.existing_files) {
          // have file... let's check if we need to refresh it
          const lastdt = this.existing_files[outfn].mtime;
          const ndate = Math.max(item.mtime || item.date, tmpl.mtime, this.settings.mtime);
          if (this.smart_writes && lastdt && ndate && ndate <= lastdt) {
            return; // skip this item
          }
        }

        ctx[key] = item;
        item.is_current = true;
        const out = this.templates.render(key, ctx);
        this.write(outfn, out);
        item.is_current = false;
      });
    }

    // render indexes (main, tags, authors, categories, archive)
    [ 'index', 'archives', 'tags', 'categories', 'authors' ]
      .forEach(key => {
        const tmpl = this.templates.stat(key);
        // don't render if user hasn't supplied a template
        if (!tmpl) { return; }

        const outfn  = this.router.route(key, '', 'index.html');
        const lastdt = this.existing_files[outfn] && this.existing_files[outfn].mtime;
        const rdate  = Math.max(most_recent(context[key].items), tmpl.mtime, this.settings.mtime);
        if (this.smart_writes && lastdt && rdate && rdate <= lastdt) {
          return; // skip this item
        }
        context[key].is_current = true;
        this.write(outfn, this.templates.render(key, context));
        context[key].is_current = false;
      });

    // render each post
    // render if post.date < template? | next/prev | translations
    render_collection.call(this, 'post', context,
      this.posts.concat(this.posts_translations));

    // render each pages
    render_collection.call(this, 'page', context,
      this.pages.concat(this.pages_translations));

    // render each category category
    render_collection.call(this, 'category', context,
      this.categories.items);

    // render each author page
    render_collection.call(this, 'author', context,
      this.authors.items);

    // render each tag page
    render_collection.call(this, 'tag', context,
      this.tags.items);

    // render posts feed (ATOM & RSS flavors)
    [ 'rss', 'atom' ].forEach(feed_type => {
      const feed_file = this.router.route(feed_type + '_feed', null, 'index.xml');
      const feed_date = this.existing_files[feed_file] && this.existing_files[feed_file].mtime;
      const trigger_date = Math.max(most_recent(this.posts), this.settings.mtime);
      if (!this.smart_writes || !feed_date || trigger_date > feed_date) {
        this.write(feed_file, String(this[feed_type + '_feed']));
      }
    });

    // Sitemap
    // this.write( this.router( 'sitemap', null, '' ),
    //           make_feed( this.posts, this, 'atom' ) );

    return this;
  }

  // FIXME
  cleanup () {
    // oldfiles <= seek all files in output dir already
    // newfiles <= tally files to write (posts, pages, static)
    // any oldfiles not in newfiles should be killed
    return this;
  }

  write (filename, output, cb) {
    this.log('write', filename);
    if (!DRY_RUN) {
      const absfile = path.join(this.destination, filename);
      mkdirs(path.dirname(absfile));
      fs.writeFile(absfile, output, cb || (err => {
        if (err) { throw err; }
        // ;;;console.log( 'wrote', absfile );
      }));
    }
  }

  process (notime) {
    this.verbose && !notime && time('Total time:');
    try {
      this.reset();
      this.read();
      this.render();
      this.cleanup();
      this.reset();
      return this;
    }
    finally {
      this.verbose && !notime && time.end('Total time:');
    }
  }
}
