import { dateFromSerial, parseDate } from 'numfmt';

const re_meta = /^([A-Z][A-Za-z0-9 _-]+):[ \t]*([^\n]+?)?\n/;

const listMeta = val => (val ? val.split(/\s*,\s*/) : []);

const META_PROCESSORS = {
  tag: listMeta,
  tags: listMeta,
  tagged: listMeta,
  category: listMeta,
  categories: listMeta,
  author: listMeta,
  date: val => {
    const d = dateFromSerial(parseDate(val).v);
    return new Date(Date.UTC(
      d[0] || 1970, d[1] - 1 || 0, d[2] || 1,
      d[3] || 0, d[4] || 0, d[5] || 0
    ));
  },
  part: val => {
    // allowed formats: "1" "1/" "1/1" "1" "1:" "1:1"
    const d = val.split(/[:/]/g).map(Number);
    return d[0] ? [ d[0] || 1, d[1] || -1 ] : null;
  }
};

export function parse (data) {
  const meta = {};
  let m;

  // get metadata
  while ((m = data.match(re_meta))) {
    const metakey = m[1].trim().toLowerCase();
    let metaval = (m[2] || '').trim();
    if (metakey in META_PROCESSORS) {
      metaval = META_PROCESSORS[metakey](metaval);
    }
    meta[metakey] = metaval;
    data = data.substr(m[0].length);
  }

  return {
    content: data.trim(),
    meta: meta
  };
}
