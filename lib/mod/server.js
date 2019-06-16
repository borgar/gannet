const http = require('http');
const fs   = require('fs');

function flush (res, mime, code, out) {
  // FIXME: this
  res.writeHead(code, {
    'Content-Type': mime,
    'Content-Length': typeof out === 'string' ? Buffer.byteLength(out) : out.length
  });
  res.end(out);
}

function html (/* code, */ out) {
  const code = (arguments.length === 2) ? arguments[0] : 200;
  out = (arguments.length === 2) ? arguments[1] : out;
  flush(this, 'text/html', code, out);
}

function text (/* code, */ out) {
  const code = (arguments.length === 2) ? arguments[0] : 200;
  out = (arguments.length === 2) ? arguments[1] : out;
  flush(this, 'text/plain', code, out);
}

function json (/* code, */ out) {
  const code = (arguments.length === 2) ? arguments[0] : 200;
  out = (arguments.length === 2) ? arguments[1] : out;
  flush(this, 'text/json', code, new Buffer(JSON.stringify(out)));
}

function file (filename, mimetype) {
  const res = this;
  fs.readFile(filename, (err, data) => {
    const mime = mimetype ||
               mimetypes[filename.replace(/^.*?\.(\w+)$/, '$1').toLowerCase()] ||
               'application/octet-stream';
    if (err) {
      flush(res, 'text/plain', 404, 'Error loading ' + filename);
    }
    else {
      flush(res, mime, 200, data);
    }
  });
}

exports.start = function (ip) {
  ip = ip.replace(/^http:\/\/|\/$/g, '');

  const port = /^:?\d+$/.test(ip)
    ? parseInt(ip.replace(/^.*?(\d+)$/, '$1'), 10)
    : 80;

  const addr = /^(\d+\.\d+\.\d+\.\d+)(:|$)/.test(ip)
    ? ip.replace(/:.*$/, '') || '127.0.0.1'
    : '127.0.0.1';

  const views = [];

  const s = http.createServer(function (req, res) {
    let rt;
    let matched = false;
    res.html = html;
    res.text = text;
    res.json = json;
    res.file = file;
    const path = req.path = req.url.split('?')[0];
    req.query = require('url').parse(req.url, true).query || {};
    for (let m, i = 0, l = views.length; i < l; i++) {
      const r = views[i];
      if (req.method === r[0] && (m = r[1].exec(path))) {
        // ;;;console.log( req.method, 200, req.url );
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
      // ;;;console.log( r[0], 404, req.url );
      flush(res, 'text/plain', 404, '404: End of the line.');
    }
  });
  s.get = function (rx, cb) { views.push([ 'GET', rx, cb ]); };
  s.put = function (rx, cb) { views.push([ 'PUT', rx, cb ]); };
  s.post = function (rx, cb) { views.push([ 'POST', rx, cb ]); };
  s.head = function (rx, cb) { views.push([ 'HEAD', rx, cb ]); };
  s.del = function (rx, cb) { views.push([ 'DELETE', rx, cb ]); };
  s.opt = function (rx, cb) { views.push([ 'OPTIONS', rx, cb ]); };

  s.listen(port, addr);
  // eslint-disable-next-line
  console.log('Server running at http://' + addr + ':' + port + '/');

  return s;
};


/*
 * Common MIME types
 *
 */
const mimetypes = exports.mimetype = {
  '3gp': 'video/3gpp',
  'a': 'application/octet-stream',
  'ai': 'application/postscript',
  'aif': 'audio/x-aiff',
  'aiff': 'audio/x-aiff',
  'asc': 'application/pgp-signature',
  'asf': 'video/x-ms-asf',
  'asm': 'text/x-asm',
  'asx': 'video/x-ms-asf',
  'atom': 'application/atom+xml',
  'au': 'audio/basic',
  'avi': 'video/x-msvideo',
  'bat': 'application/x-msdownload',
  'bin': 'application/octet-stream',
  'bmp': 'image/bmp',
  'bz2': 'application/x-bzip2',
  'c': 'text/x-c',
  'cab': 'application/vnd.ms-cab-compressed',
  'cc': 'text/x-c',
  'chm': 'application/vnd.ms-htmlhelp',
  'class': 'application/octet-stream',
  'com': 'application/x-msdownload',
  'conf': 'text/plain',
  'cpp': 'text/x-c',
  'crt': 'application/x-x509-ca-cert',
  'css': 'text/css',
  'csv': 'text/csv',
  'cxx': 'text/x-c',
  'deb': 'application/x-debian-package',
  'der': 'application/x-x509-ca-cert',
  'diff': 'text/x-diff',
  'djv': 'image/vnd.djvu',
  'djvu': 'image/vnd.djvu',
  'dll': 'application/x-msdownload',
  'dmg': 'application/octet-stream',
  'doc': 'application/msword',
  'dot': 'application/msword',
  'dtd': 'application/xml-dtd',
  'dvi': 'application/x-dvi',
  'ear': 'application/java-archive',
  'eml': 'message/rfc822',
  'eps': 'application/postscript',
  'exe': 'application/x-msdownload',
  'f': 'text/x-fortran',
  'f77': 'text/x-fortran',
  'f90': 'text/x-fortran',
  'flv': 'video/x-flv',
  'for': 'text/x-fortran',
  'gem': 'application/octet-stream',
  'gemspec': 'text/x-script.ruby',
  'gif': 'image/gif',
  'gz': 'application/x-gzip',
  'h': 'text/x-c',
  'hh': 'text/x-c',
  'htm': 'text/html',
  'html': 'text/html',
  'ico': 'image/vnd.microsoft.icon',
  'ics': 'text/calendar',
  'ifb': 'text/calendar',
  'iso': 'application/octet-stream',
  'jar': 'application/java-archive',
  'java': 'text/x-java-source',
  'jnlp': 'application/x-java-jnlp-file',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'application/javascript',
  'json': 'application/json',
  'log': 'text/plain',
  'm3u': 'audio/x-mpegurl',
  'm4v': 'video/mp4',
  'man': 'text/troff',
  'mathml': 'application/mathml+xml',
  'mbox': 'application/mbox',
  'mdoc': 'text/troff',
  'me': 'text/troff',
  'mid': 'audio/midi',
  'midi': 'audio/midi',
  'mime': 'message/rfc822',
  'mml': 'application/mathml+xml',
  'mng': 'video/x-mng',
  'mov': 'video/quicktime',
  'mp3': 'audio/mpeg',
  'mp4': 'video/mp4',
  'mp4v': 'video/mp4',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  'ms': 'text/troff',
  'msi': 'application/x-msdownload',
  'odp': 'application/vnd.oasis.opendocument.presentation',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'odt': 'application/vnd.oasis.opendocument.text',
  'ogg': 'application/ogg',
  'p': 'text/x-pascal',
  'pas': 'text/x-pascal',
  'pbm': 'image/x-portable-bitmap',
  'pdf': 'application/pdf',
  'pem': 'application/x-x509-ca-cert',
  'pgm': 'image/x-portable-graymap',
  'pgp': 'application/pgp-encrypted',
  'pkg': 'application/octet-stream',
  'pl': 'text/x-script.perl',
  'pm': 'text/x-script.perl-module',
  'png': 'image/png',
  'pnm': 'image/x-portable-anymap',
  'ppm': 'image/x-portable-pixmap',
  'pps': 'application/vnd.ms-powerpoint',
  'ppt': 'application/vnd.ms-powerpoint',
  'ps': 'application/postscript',
  'psd': 'image/vnd.adobe.photoshop',
  'py': 'text/x-script.python',
  'qt': 'video/quicktime',
  'ra': 'audio/x-pn-realaudio',
  'rake': 'text/x-script.ruby',
  'ram': 'audio/x-pn-realaudio',
  'rar': 'application/x-rar-compressed',
  'rb': 'text/x-script.ruby',
  'rdf': 'application/rdf+xml',
  'roff': 'text/troff',
  'rpm': 'application/x-redhat-package-manager',
  'rss': 'application/rss+xml',
  'rtf': 'application/rtf',
  'ru': 'text/x-script.ruby',
  's': 'text/x-asm',
  'sgm': 'text/sgml',
  'sgml': 'text/sgml',
  'sh': 'application/x-sh',
  'sig': 'application/pgp-signature',
  'snd': 'audio/basic',
  'so': 'application/octet-stream',
  'svg': 'image/svg+xml',
  'svgz': 'image/svg+xml',
  'swf': 'application/x-shockwave-flash',
  't': 'text/troff',
  'tar': 'application/x-tar',
  'tbz': 'application/x-bzip-compressed-tar',
  'tcl': 'application/x-tcl',
  'tex': 'application/x-tex',
  'texi': 'application/x-texinfo',
  'texinfo': 'application/x-texinfo',
  'text': 'text/plain',
  'tif': 'image/tiff',
  'tiff': 'image/tiff',
  'torrent': 'application/x-bittorrent',
  'tr': 'text/troff',
  'txt': 'text/plain',
  'vcf': 'text/x-vcard',
  'vcs': 'text/x-vcalendar',
  'vrml': 'model/vrml',
  'war': 'application/java-archive',
  'wav': 'audio/x-wav',
  'wma': 'audio/x-ms-wma',
  'wmv': 'video/x-ms-wmv',
  'wmx': 'video/x-ms-wmx',
  'wrl': 'model/vrml',
  'wsdl': 'application/wsdl+xml',
  'xbm': 'image/x-xbitmap',
  'xhtml': 'application/xhtml+xml',
  'xls': 'application/vnd.ms-excel',
  'xml': 'application/xml',
  'xpm': 'image/x-xpixmap',
  'xsl': 'application/xml',
  'xslt': 'application/xslt+xml',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  'zip': 'application/zip'
};


