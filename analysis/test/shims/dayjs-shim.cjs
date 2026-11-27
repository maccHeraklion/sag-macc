/* Υποκατάστατο του dayjs (+ πρόσθετα utc / timezone) ΜΟΝΟ για τα tests, πάνω στο moment-timezone που υπάρχει ήδη
   στο analysis/node_modules. Καλύπτει όσα χρησιμοποιεί το analysis/fieldExportData.js: dayjs(), dayjs(x), .tz(zone),
   .utc(), .format(fmt με [κείμενο]), .toISOString(), .subtract(n, unit), dayjs.tz(str, zone), dayjs.extend().
   Το TagoIO τρέχει το πραγματικό dayjs· οι μορφές YYYY MM DD HH mm ss Z και οι αγκύλες είναι ίδιες στα δύο. */
const path = require("node:path");
const moment = require(path.join(__dirname, "..", "..", "node_modules", "moment-timezone"));
function wrap(m) {
  return {
    _m: m,
    tz(zone) { return wrap(m.clone().tz(zone)); },
    utc() { return wrap(m.clone().utc()); },
    format(f) { return m.format(f); },
    toISOString() { return m.toISOString(); },
    subtract(n, u) { return wrap(m.clone().subtract(n, u)); },
    add(n, u) { return wrap(m.clone().add(n, u)); },
    valueOf() { return m.valueOf(); },
    isValid() { return m.isValid(); },
  };
}
function dayjs(x) { return wrap(x === undefined ? moment.utc() : moment.utc(x && x._m ? x._m : x)); }
dayjs.extend = () => dayjs;
dayjs.tz = (s, zone) => wrap(moment.tz(s, zone));
dayjs.utc = (x) => dayjs(x);
module.exports = dayjs;
module.exports.default = dayjs;
