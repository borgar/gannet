import path from 'path';
import fs from 'fs';
import nunjucks from 'nunjucks';
import dateutil from 'dateutil';

function matchAll (regexp, str) {
  regexp.lastIndex = -1;
  let m;
  const all = [];
  while ((m = regexp.exec(str)) !== null) {
    all.push(m);
  }
  return all;
}

const nofilter = () => true;

export class Templates {
  constructor (settings, cacheTemplates = true) {
    this.rootDir = path.join(settings.THEME_PATH, 'templates');
    this.cache = {};

    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.rootDir, { noCache: !cacheTemplates }),
      { autoescape: true, noCache: !cacheTemplates }
    );
    this.setGlobals(settings, d => d === d.toUpperCase());

    // format dates
    this.env.addFilter('date', function (item, format) {
      const fmt = format || settings.DEFAULT_DATE_FORMAT;
      // if format in globals then read it
      if (!(item instanceof Date)) {
        item = dateutil.parse(item);
      }
      return dateutil.format(item, fmt);
    });
    // fix runts
    this.env.addFilter('derunt', function (text) {
      if (typeof text === 'string') {
        const bits = text.split(/(\s+)/);
        if (bits.length > 2) {
          bits[bits.length - 2] = '\u00a0';
          return bits.join('');
        }
      }
      return text;
    });

    this.update();
  }

  update () {
    // preload all templates in theme dir
    fs.readdirSync(this.rootDir)
      .forEach(d => {
        const t = this.resolve(d);
        t.exists = fs.existsSync(t.filename);
        t.mtime = -1;
        t.deps = [];
        if (t.exists) {
          t.mtime = fs.statSync(t.filename).mtime * 1;
          t.source = fs.readFileSync(t.filename, 'utf8');
          // {% import "foo.html" as bar %} | {% extends "foo.html" %}
          // FIXME: {% extends name + ".html" %}
          matchAll(/\{%\s+(import|extends)\s+(".+?"|'.+?').*?%\}/gi, t.source)
            .forEach(m => {
              t.deps.push(m[2].replace(/^(?:"(.+?)"|'(.+?)')$/, '$1$2'));
            });
        }
        this.cache[t.name] = t;
      });
  }

  setGlobals (dict, filter = nofilter) {
    for (const key in dict) {
      if (filter(key, dict[key])) {
        this.env.addGlobal(key, dict[key]);
      }
    }
    return this;
  }

  render (key, context) {
    const s = this.resolve(key);
    let r = '';
    this.setGlobals(context);
    try {
      r = this.env.render(s.name, {});
    }
    catch (err) {
      // eslint-disable-next-line
      console.log(err.message);
      process.exit(1);
    }
    return r;
  }

  stat (key) {
    const s = this.resolve(key);
    const t = this.cache[s.name];
    if (!t || !t.exists) {
      return null;
    }
    // if the template does not exist, return null
    return {
      // return the last-mod time for this template
      // if a parent or import has a different time
      mtime: t.mtime
    };
  }

  resolve (name) {
    const key = name.replace(/\.html$/, '');
    const filename = path.resolve(this.rootDir, key + '.html');
    return {
      key: key,
      name: key + '.html',
      filename: filename
    };
  }
}
