import { parse } from '../meta-attr.js';
import textile from 'textile-js';

export default {
  extensions: [ 'textile' ],

  convert: data => {
    const { content, meta } = parse(data);
    return {
      content: textile(content),
      meta: meta
    };
  }
};
