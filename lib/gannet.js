/*
 * Gannet - a static blog engine
 */
import path from 'path';
import fs from 'fs';
import { URL } from 'url';
import { startServer } from './mod/server.js';
export { Settings } from './settings.js';
export { Site } from './site.js';

const __dirname = new URL('.', import.meta.url).pathname;

function hotReload (filename, data) {
  // fs.readFileSync(, 'utf8');
  if (/\.html?$/i.test(filename)) {
    return data.replace(/<\/body>/, '<script src="/_hotReload.js"></script>\n</body>');
  }
  return data;
}

export class Server {
  constructor (site, host) {
    this.site = site;
    this.instance = startServer(host || ':8888');
    this.instance.get(/^(.*)$/, this.handleGet.bind(this));
    const { ws } = this.instance;
    ws.on('connection', connection => {
      this.notify = data => {
        setTimeout(() => {
          connection.send(JSON.stringify(data));
        }, 300);
      };
    });
  }

  notify () {
    // no-op but will be overwritten once we have a socket
  }

  handleGet (req, res, filename) {
    const candFiles = [];
    const rootPath = this.site.destination;
    if (filename === '/_hotReload.js') {
      candFiles.push(
        path.join(__dirname, './mod/hot-reload.js')
      );
    }
    else if (filename.substr(-1) === '/') {
      candFiles.push(
        path.join(rootPath, filename + 'index.html'),
        path.join(rootPath, filename + 'index.xml'),
        path.join(rootPath, filename + 'feed.xml')
      );
    }
    else {
      candFiles.push(
        path.join(rootPath, filename),
        path.join(rootPath, filename + '/index.html'),
        path.join(rootPath, filename + '/index.xml'),
        path.join(rootPath, filename + '/feed.xml')
      );
    }
    const tryNextFile = () => {
      const file = candFiles.shift();
      fs.stat(file, (err, stats) => {
        if (!err && stats.isFile()) {
          res.file(file, null, data => hotReload(file, data));
        }
        else if (candFiles.length) {
          tryNextFile();
        }
        else {
          res.text(404, '404 - file not found');
        }
      });
    };
    tryNextFile();
  }
}
