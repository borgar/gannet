const path = require('path');
const fs = require('fs');
const nunjucks = require('nunjucks');


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

exports.Templates = class Templates {

  constructor (settings) {
    this.rootDir = path.join(settings.THEME_PATH, 'templates');
    this.cache = {};

    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.rootDir),
      { autoescape: true }
    );
    this.setGlobals(settings, d => d === d.toUpperCase());

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
      console.log(err.message);
      process.exit(1);
    }
    // console.log('/RENDER');
    return r;
  }

  get (name) {
    console.log('GET', name);
    // store non-exists in the map and return nulls on gets!
    // template should have an mtime
    // return this.cache[key] || this.load(key);
    const key = name.replace(/\.html$/, '');
    if (!this.cache[key]) {
      this.load(key + '.html');
    }
    const t = this.cache[key];
    if (!t.exists) {
      return null;
    }

    return {
      mtime: t.mtime,
      render: ctx => {
        // console.log('RENDER', name);
        return 'TEST';
      }
    };
  }

  stat (key) {
    const s = this.resolve(key);
    const t = this.cache[s.name];
    if (!t || !t.exists) { return null; }

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

};
