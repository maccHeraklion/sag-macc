/* This is a default example for payload parser.
** The ignore_vars variable in this code should be used to ignore variables
** from the device that you don't want.
**
** Testing:
** You can do manual tests to this parse by using the Device Emulator. Copy and Paste the following code:
** [{ "variable": "payload", "value": "0109611395" }]
**
*/
// Add ignorable variables in this array.
const ignore_vars = ['rf_chain', 'channel', 'modulation', 'app_id', 'dev_id', 'time', 'gtw_trusted', 'port'];

// Remove unwanted variables.
payload = payload.filter(x => !ignore_vars.includes(x.variable));
console.log('payload: ', payload)
// 4/10/2026 (P4, εντολή Μιχάλη): αφαιρέθηκε η σταθερή barometric_pressure_hpa = 1017.2 που προστιθόταν
// σε ΚΑΘΕ uplink. Ο σταθμός στέλνει δική του πραγματική πίεση (π.χ. 1008.6) από τον connector.

// You can edit any variable that's being added to your device.
// For example, if you need to convert a variable from Fahrenheit to Celsius, uncomment the following code:
// const temperature = payload.find(x => x.variable === "temperature");
// if (temperature) {
//   temperature.value = (5 / 9) * (temperature.value - 32);
//   temperature.unit = "C";
// }

/* T-GWID-04 (7/11/2026, απόφαση Michalis): η πύλη που άκουσε το πακέτο. Ο connector S2120 δεν περνά το lrrid, γι' αυτό
 * διαβάζεται από το raw_payload (μήνυμα πριν από κάθε parser). ΜΙΑ εγγραφή ανά uplink, ίδιας μορφής με τις σόνδες.
 * Δοκιμή σε ΕΝΑΝ σταθμό. Ποτέ σε βάνες. Σκέτος κώδικας, ποτέ base64 (παγίδα #225). */
try {
  let _raw = (typeof raw_payload !== 'undefined') ? raw_payload : null;
  if (typeof _raw === 'string') { try { _raw = JSON.parse(_raw); } catch (e) { _raw = null; } }
  const _obj = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } } return v; };
  const _pick = (o) => (o && (o.DevEUI_uplink || (o.Lrrid ? o : null))) || null;
  let _up = Array.isArray(_raw) ? null : _pick(_raw);
  if (Array.isArray(_raw)) {
    for (const _x of _raw) {
      if (_x && _x.variable && /^lrrid$/i.test(String(_x.variable))) { _up = { Lrrid: _x.value }; break; }
      const _c = _x && (_pick(_x) || _pick(_obj(_x.value)) || _pick(_obj(_x.metadata)));
      if (_c) { _up = _c; break; }
    }
  }
  if (Array.isArray(payload) && !payload.some((x) => x && x.variable === 'lrrid')) {
    if (_up && _up.Lrrid) {
      const _ref = payload.find((x) => x && x.time);
      const _rec = { variable: 'lrrid', value: String(_up.Lrrid) };
      if (_ref) _rec.time = _ref.time;
      const _la = Number(_up.LrrLAT), _lo = Number(_up.LrrLON);
      if (Number.isFinite(_la) && Number.isFinite(_lo) && _la !== 0 && _lo !== 0) _rec.location = { lat: _la, lng: _lo };
      /* T-GWMAP-06: ΟΛΕΣ οι πύλες που άκουσαν αυτό το πακέτο, στο metadata της ίδιας εγγραφής: 0 επιπλέον εγγραφές. */
      const _lr = _up.Lrrs && _up.Lrrs.Lrr;
      const _ls = (Array.isArray(_lr) ? _lr : (_lr ? [_lr] : [])).filter((x) => x && x.Lrrid).slice(0, 12)
        .map((x) => [String(x.Lrrid), Number.isFinite(Number(x.LrrRSSI)) ? Number(x.LrrRSSI) : null, Number.isFinite(Number(x.LrrSNR)) ? Number(x.LrrSNR) : null]);
      if (_ls.length) _rec.metadata = { lrrs: _ls };
      else if (Object.keys(_up).length > 1) _rec.metadata = { lrrs_keys: Object.keys(_up).slice(0, 40).join(',').slice(0, 400) };   // προσωρινό: ονόματα κλειδιών, ποτέ τιμές
      payload.push(_rec);
    } else {
      // προσωρινό διαγνωστικό της δοκιμής: ονόματα κλειδιών μόνο, ποτέ τιμές
      const _in = (x) => { const v = x && _obj(x.value); return (v && typeof v === 'object' ? 'value{' + Object.keys(v).slice(0, 12).join(',') + '}' : 'value:' + typeof (x && x.value)) + (x && x.metadata && typeof x.metadata === 'object' ? ' metadata{' + Object.keys(x.metadata).slice(0, 12).join(',') + '}' : ''); };
      const _k = Array.isArray(_raw) ? ('array:' + _raw.slice(0, 5).map((x) => ((x && x.variable) || typeof x) + ' ' + _in(x)).join(';'))
        : (_raw && typeof _raw === 'object' ? ('object:' + Object.keys(_raw).slice(0, 30).join(',')) : typeof _raw);
      payload.push({ variable: 'lrr_probe', value: String(_k).slice(0, 240) });
    }
  }
} catch (e) { console.error('T-GWID-04', e && e.message); }
