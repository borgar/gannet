var dateutil  = require('dateutil');
var summarize = require('./utils').summarize;
var slugify   = require('./utils').slugify;

exports.Post = Post;
function Post ( content, meta, settings, filename ) {

  this.content = content;
  this.status = settings.DEFAULT_STATUS || 'published';
  this.filename = filename;

  // TODO: set default authors
  this.authors = [];

  this.tags = [];
  this.categories = [];
  this.translations = [];
  
  for ( var key in meta ) { this[key] = meta[key]; }

  // manage languages
  if ( settings.DEFAULT_LANG ) {
    var default_lang = settings.DEFAULT_LANG.toLowerCase();
    if ( !this.lang ) { this.lang = default_lang; }
    this.in_default_lang = (this.lang == default_lang);
  }
  
  // create the slug from title if needed
  if ( !this.slug && this.title ) {
    this.slug = slugify( this.title );
  }
  
  // set date format
  if ( !this.date_format ) {
    if ( this.lang && this.lang in settings.DATE_FORMATS ) {
      this.date_format = settings.DATE_FORMATS[ this.lang ];
    }
    else {
      this.date_format = settings.DEFAULT_DATE_FORMAT;
    }
  }
  
  // pull some date settings for use in url formatting
  if ( this.date ) {
    this.year  = this.date.getUTCFullYear() + '';
    this.month = (this.date.getUTCMonth() < 9  ? '0': '') + (this.date.getUTCMonth() + 1);
    this.day   = (this.date.getUTCDate()  < 10 ? '0': '') + this.date.getUTCDate();
  }

}
Post.prototype = {
  
  set summary ( summary ) {
    this._summary = summary;
  },
  get summary () {
    if ( !this._summary ) { this._summary = summarize( this.content ); }
    return this._summary;
  },
  
  get is_published () {
    return (this.status !== 'draft') &&
           (this.date ? this.date <= Date.now() : true);
  },
  
  get is_valid () {
    return !!this.title;
  },

  get is_hidden () {
    return !!this.hidden;
  },
  
  get locale_date () {
    if ( this.date ) {
      return dateutil.format( this.date, this.date_format, this.lang );
    }
    return '';
  },
  
  get altlang () {
    return this.in_default_lang ? '' : this.lang;
  },
  
};
