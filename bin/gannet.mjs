import fs from 'fs';
import { Settings, Server, Site } from '../lib/gannet.js';
import { ArgumentParser } from '../lib/mod/argparse.js';

let settings = new Settings();
const parser = new ArgumentParser();
const debugging = true;

let site;
let use_server = false;
let verbose = false;
let force_write = false;

parser.add_argument('--settings', {
  help: 'settings file to use',
  action: value => {
    // read a settings file
    settings = new Settings(value);
  }
});
parser.add_argument('--server', {
  help: 'start a test server',
  action: () => {
    use_server = true;
  }
});
parser.add_argument('--force', {
  help: "don't check file dates, just write everything out",
  action: () => {
    force_write = true;
  }
});
parser.add_argument('--verbose', {
  help: 'report what is happening to console',
  action: () => {
    verbose = true;
  }
});
parser.parse_args();

if (debugging) {
  settings.meet_requirements();
  site = new Site(settings, verbose, false, !use_server);
  site.process();
}
else {
  try {
    settings.meet_requirements();
    site = new Site(settings, verbose, !force_write, !use_server);
    site.process();
  }
  catch (err) {
    console.error('Error:', err.message);
    use_server = false;
  }
}

// if requested, start a server
if (use_server) {
  const server = new Server(site, ':8888');

  const sw = site.smart_writes;

  const postDir = site.resolve_path_setting('SOURCE_PATH', true);
  fs.watch(postDir, { recursive: true }, (eventType, filename) => {
    if (eventType === 'change') {
      site.process();
      server.notify({ type: 'source', file: filename });
    }
    else {
      console.log(eventType, filename);
    }
  });

  const themeDir = site.resolve_path_setting('THEME_PATH', true);
  fs.watch(themeDir, { recursive: true }, (eventType, filename) => {
    if (eventType === 'change') {
      site.smart_writes = false;
      site.process();
      site.smart_writes = sw;
      server.notify({ type: 'theme', file: filename });
    }
    else {
      console.log(eventType, filename);
    }
  });
}
