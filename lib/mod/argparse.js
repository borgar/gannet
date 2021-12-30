/* eslint-disable no-console */
// http://docs.python.org/library/argparse.html

const noop = () => {};

class Option {
  constructor () {
    this._flags = {};
    this.action = noop;
    this.help = null;
    this.default = null;
    this.type = null;
    this.nargs = 0;
  }

  test (arg, value) {
    if (arg in this._flags) {
      this.action.call(this.context || this, value || true);
      return true;
    }
    return false;
  }

  print_help () {
    const f = Object.keys(this._flags);
    let p = f.join(', ');
    if (p.length < 15) {
      p += Array(15 - p.length).join(' ');
    }
    console.log(' ' + p + '  ' + this.help);
  }
}

export class ArgumentParser {
  constructor (desc, epilog) {
    this._desc = desc || '';
    this._epilog = epilog || '';

    this._flags = {};
    this._options = [];
    this.add_argument('-h', '--help', {
      help: 'show this help message and exit',
      context: this,
      action: function () {
        this.print_help();
        process.exit(0);
      }
    });
  }

  add_argument (...args) {
    const op = new Option();
    this._options.push(op);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      // strings => "--help" / "-h"
      if (typeof a === 'string') {
        this._flags[a] = op;
        op._flags[a] = true;
      }
      else if (typeof a === 'object') {
        for (const key in a) {
          op[key] = a[key];
        }
      }
    }
  }

  parse_args (args) {
    let argv = args || process.argv;

    if (argv[0] === 'node') {
      argv = argv.slice(1);
    }
    argv = argv.slice(1);

    const rest = [];
    for (let i = 0; i < argv.length; i++) {
      const item = argv[i];
      const s = item.split('=');
      let matched = false;
      for (let a = 0; a < this._options.length; a++) {
        const option = this._options[a];
        matched = option.test(item, true, this) || option.test(s[0], s[1], this);
      }
      if (!matched) {
        rest.push(item);
      }
    }
    return rest;
  }

  print_help () {
    const prog = (process.argv[0] === 'node')
      ? 'node ' + process.argv[1]
      : process.argv[0];

    console.log('usage: ' + prog + ' [-h]\n');
    if (this._desc) {
      console.log(this._desc + '\n'); // FIXME: auto-linebreak this
    }
    console.log('optional arguments:');
    for (let i = 0; i < this._options.length; i++) {
      this._options[i].print_help();
    }
  }
}
