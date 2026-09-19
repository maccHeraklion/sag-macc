/* T-LRRTEST-01 — ΠΕΙΡΑΜΑ ΣΕ ΜΙΑ ΣΥΣΚΕΥΗ, milesight_am107_1895 («ΚΕΚ Γραφείο»).

   ΤΟ ΕΡΩΤΗΜΑ: μπορεί parser ΕΠΙΠΕΔΟΥ ΣΥΣΚΕΥΗΣ να ξαναφέρει τα πεδία LRR
   (lrrid/lrrlat/lrrlon) που λείπουν, ή τα έκοψε ο connector ΠΡΙΝ φτάσουν εδώ;

   Ο parser της συσκευής δέχεται το `payload` ΗΔΗ αποκωδικοποιημένο. Ό,τι είναι
   μέσα του αποθηκεύεται. Άρα: αν το `lrrid` ΔΕΝ είναι στο payload εδώ, τότε
   ΚΑΝΕΝΑΣ parser συσκευής δεν μπορεί να το σώσει — η λύση περνά από τον
   connector, που αφορά ΟΛΕΣ τις συσκευές του τύπου, όχι μία.

   ΔΕΝ μαντεύω την απάντηση· τη μετράω. Το μπλοκ παρακάτω προσθέτει ΜΙΑ
   μεταβλητή `lrr_probe` ανά uplink, με τα ΟΝΟΜΑΤΑ όσων φτάνουν πραγματικά.

   ΑΣΦΑΛΕΙΑ:
   - Ο αρχικός κώδικας μένει ΑΥΤΟΥΣΙΟΣ από πάνω· η θέση ΚΕΚ δεν πειράζεται.
   - Όλο το πείραμα είναι σε try/catch: αν σκάσει, η συσκευή συνεχίζει κανονικά.
   - `typeof` σε αδήλωτο όνομα ΔΕΝ ρίχνει σφάλμα — γι' αυτό ελέγχω έτσι.
   - ΠΡΟΣΩΡΙΝΟ. Επαναφορά από το ..._ORIGINAL_2026-09-19.js. */

/* This is a default example for payload parser.
** The ignore_vars variable in this code should be used to ignore variables
** from the device that you don't want.
**
** Testing:
** You can do manual tests to this parse by using the Device Emulator. Copy and Paste the following code:
** [{ "variable": "payload", "value": "0109611395" }]
**
*/
// Location of device
var lat = 35.33993817470316;
var lng = 25.162531468774297;

const co2 = payload.find(item => item.variable === 'co2');
const temperature = payload.find(item => item.variable === 'temperature');
const humidity = payload.find(item => item.variable === 'humidity');

if (co2)
  co2.location = {lat,lng};

if (temperature)
  temperature.location = {lat,lng};

if (humidity)
  humidity.location = {lat,lng};


//payload = payload.concat(data).map(x => ({ ...x}));

// ── T-LRRTEST-01 · Η ΜΕΤΡΗΣΗ ────────────────────────────────────────────────
try {
  var _names = payload
    .map(function (p) { return p && p.variable; })
    .filter(function (n) { return !!n; });

  var _net = _names.filter(function (n) {
    return /lrr|ism|spfact|subband|channel|devlrr|deveui|fcnt/i.test(n);
  });

  payload.push({
    variable: 'lrr_probe',
    value: _names.indexOf('lrrid') >= 0 ? 'ΕΧΕΙ lrrid' : 'ΔΕΝ ΕΧΕΙ lrrid',
    metadata: {
      ola: _names.join(','),
      diktyo: _net.length ? _net.join(',') : 'ΚΑΝΕΝΑ',
      plithos: String(_names.length),
      /* Υπάρχει κάπου αλλού το ωμό πακέτο; typeof σε αδήλωτο δεν ρίχνει. */
      globals: [
        'metadata=' + (typeof metadata),
        'device=' + (typeof device),
        'raw_payload=' + (typeof raw_payload),
        'body=' + (typeof body),
        'request=' + (typeof request),
        'serie=' + (typeof serie)
      ].join(' ')
    }
  });
} catch (_e) {
  try {
    payload.push({
      variable: 'lrr_probe',
      value: 'ΣΦΑΛΜΑ',
      metadata: { err: String(_e && _e.message).slice(0, 200) }
    });
  } catch (_e2) { /* ποτέ να μη σπάσει η λήψη της συσκευής */ }
}
