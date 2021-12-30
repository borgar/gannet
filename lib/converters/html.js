import { parse } from '../meta-attr.js';

export default {
  extensions: [ 'html', 'htm' ],

  convert: data => {
    return parse(data);
  }
};
