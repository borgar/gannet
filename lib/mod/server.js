import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import url from 'url';
import { mimetypes } from './mimetypes.js';

function getMimeType (filename, mimetype) {
  return (
    mimetype ||
    mimetypes[filename.replace(/^.*?\.(\w+)$/, '$1').toLowerCase()] ||
    'application/octet-stream'
  );
}

function flush (res, mime, code, out) {
  res.writeHead(code, {
    'Content-Type': mime,
    'Content-Length': typeof out === 'string' ? Buffer.byteLength(out) : out.length
  });
  res.end(out);
}

function _args (args) {
  const code = (args.length === 2) ? args[0] : 200;
  const out = (args.length === 2) ? args[1] : args[0];
  return { out, code };
}

function html (...args) {
  const { code, out } = _args(args);
  flush(this, 'text/html', code, out);
}

function text (...args) {
  const { code, out } = _args(args);
  flush(this, 'text/plain', code, out);
}

function json (...args) {
  const { code, out } = _args(args);
  flush(this, 'text/json', code, new Buffer(JSON.stringify(out)));
}

function file (filename, mimetype, preprocess) {
  const res = this;
  const ftype = /\.(s?css|html?|[tj]sx?)$/i.test(filename) ? 'utf8' : null;
  fs.readFile(filename, ftype, (err, data) => {
    if (err) {
      flush(res, 'text/plain', 404, 'Error loading ' + filename);
    }
    else {
      if (preprocess) {
        data = preprocess(data);
      }
      const mime = getMimeType(filename, mimetype);
      flush(res, mime, 200, data);
    }
  });
}

export function startServer (ip) {
  ip = ip.replace(/^http:\/\/|\/$/g, '');

  const port = /^:?\d+$/.test(ip)
    ? parseInt(ip.replace(/^.*?(\d+)$/, '$1'), 10)
    : 80;

  const addr = /^(\d+\.\d+\.\d+\.\d+)(:|$)/.test(ip)
    ? ip.replace(/:.*$/, '') || '127.0.0.1'
    : '127.0.0.1';

  const views = [];

  const s = http.createServer((req, res) => {
    let rt;
    let matched = false;
    res.html = html;
    res.text = text;
    res.json = json;
    res.file = file;
    const path = req.url.split('?')[0];
    req.path = path;
    req.query = url.parse(req.url, true).query || {};
    for (let m, i = 0, l = views.length; i < l; i++) {
      const r = views[i];
      if (req.method === r[0] && (m = r[1].exec(path))) {
        matched = true;
        const a = [ req, res ];
        for (let mi = 1, ml = m.length; mi < ml; mi++) {
          a.push(m[mi]);
        }
        rt = r[2].apply(null, a);
        break;
      }
    }
    if (matched && typeof rt === 'string') {
      res.html(rt);
    }
    else if (!matched) {
      flush(res, 'text/plain', 404, '404: End of the line.');
    }
  });
  s.get = function (rx, cb) { views.push([ 'GET', rx, cb ]); };
  s.put = function (rx, cb) { views.push([ 'PUT', rx, cb ]); };
  s.post = function (rx, cb) { views.push([ 'POST', rx, cb ]); };
  s.head = function (rx, cb) { views.push([ 'HEAD', rx, cb ]); };
  s.del = function (rx, cb) { views.push([ 'DELETE', rx, cb ]); };
  s.opt = function (rx, cb) { views.push([ 'OPTIONS', rx, cb ]); };

  // create a websocket port
  s.ws = new WebSocketServer({ server: s });

  s.listen(port, addr);
  // eslint-disable-next-line
  console.log('Server running at http://' + addr + ':' + port + '/');

  return s;
}
