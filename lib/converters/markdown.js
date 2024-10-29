import { parse } from '../meta-attr.js';
import { marked } from 'marked';

export default {
  extensions: [ 'md', 'markdown' ],

  convert: (data, settings) => {
    const pdata = parse(data);
    let content = pdata.content;

    // Footnotes!
    // Temporary hack until Marked supports extensions or footnotes or extras
    const footnotes = [];
    if (/\[\^/.test(content)) {
      // step 1 --- pull all footnotes defs to a dict
      content = content
        .replace(
          /(?:\n|^)\[\^([^\]]+?)\]:(?=\s*\S{1,})([^\n]+)/g,
          (a, ref, fn) => {
            footnotes.push({
              id: ref,
              content: marked(fn.trim())
                .trim()
                .replace(/^<p>|<\/p>$/g, '')
            });
            return '';
          }
        )
        .replace(
          /\[\^(.+?)\]/g,
          (a, ref) => {
            // TODO: can error log refs without defs here
            return `<sup id="fnref:${ref}"><a href="#fn:${ref}" rel="footnote">${ref}</a></sup>`;
          }
        );
    }

    let html = marked(content.trim());

    if (settings.META_FOOTNOTES) {
      pdata.meta.footnotes = footnotes;
    }
    else if (footnotes.length) {
      const fnStr = footnotes.map(fn => {
        const back = `<a href="#fnref:${fn.id}" rev="footnote">↩</a>`;
        return `<li id="fn:${fn.id}">${fn.content + back}\n</li>`;
      }).join('\n');
      html += `<div class="footnotes">\n<hr>\n<ol>\n${fnStr}\n</ol>\n</div>\n`;
    }

    return {
      content: html,
      meta: pdata.meta
    };
  }
};
