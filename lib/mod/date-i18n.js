import dateutil from 'dateutil';

const enMonths = 'January February March April May June July August September October November December'.split(' ');
const enDays = 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' ');

dateutil.lang.is = {};

const isMonths = 'janúar febrúar mars apríl maí júní júlí ágúst september október nóvember desember'.split(' ');
const isDays = 'sunnudagur mánudagur þriðjudagur miðvikudagur fimmtudagur föstudagur laugardagur'.split(' ');

enMonths.forEach((d, i) => {
  dateutil.lang.is[d] = isMonths[i];
  dateutil.lang.is[d.slice(0, 3)] = isMonths[i].slice(0, 3);
});

enDays.forEach((d, i) => {
  dateutil.lang.is[d] = isDays[i];
  dateutil.lang.is[d.slice(0, 3)] = isDays[i].slice(0, 3);
});
