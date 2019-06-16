/*
 * Gannet - a static blog engine
 *
 */

const path = require('path');
const fs = require('fs');

exports.Settings = require('./settings').Settings;
exports.Site = require('./site').Site;

exports.Server = function Server (site, host) {
  this.instance = require('./mod/server').start(host || ':8888');
  this.instance.get(/^(.*)$/, (req, res, filename) => {
    const candFiles = [];
    if (filename.substr(-1) === '/') {
      candFiles.push(
        filename + 'index.html',
        filename + 'index.xml',
        filename + 'feed.xml'
      );
    }
    else {
      candFiles.push(
        filename,
        filename + '/index.html',
        filename + '/index.xml',
        filename + '/feed.xml'
      );
    }
    const tryNextFile = () => {
      const file = path.join(site.destination, candFiles.shift());
      fs.stat(file, (err, stats) => {
        if (!err && stats.isFile()) {
          res.file(file);
          return;
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
  });
};
