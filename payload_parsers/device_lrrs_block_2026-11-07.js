/* T-GWMAP-07 (7/11/2026, απόφαση Michalis): ΟΛΕΣ οι πύλες που άκουσαν το πακέτο, από το raw_payload, στο metadata της εγγραφής lrrid.
 * Parser ΣΥΣΚΕΥΗΣ: μπαίνει στο ΤΕΛΟΣ του υπάρχοντος, δεν αντικαθιστά. 0 επιπλέον εγγραφές όταν η lrrid υπάρχει ήδη.
 * ΠΟΤΕ σε βάνες, μετρητές νερού ή στο ξενοδοχείο. Σκέτος κώδικας, ποτέ base64 (παγίδα #225). Δεν ρίχνει ποτέ το uplink. */
try {
  let _raw = (typeof raw_payload !== 'undefined') ? raw_payload : null;
  const _obj = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } } return v; };
  const _pick = (o) => (o && (o.DevEUI_uplink || (o.Lrrid ? o : null))) || null;
  _raw = _obj(_raw);
  let _up = Array.isArray(_raw) ? null : _pick(_raw);
  if (Array.isArray(_raw)) for (const _x of _raw) { const _c = _x && (_pick(_x) || _pick(_obj(_x.value)) || _pick(_obj(_x.metadata))); if (_c) { _up = _c; break; } }
  if (Array.isArray(payload) && _up && _up.Lrrid) {
    const _lr = _up.Lrrs && _up.Lrrs.Lrr;
    const _ls = (Array.isArray(_lr) ? _lr : (_lr ? [_lr] : [])).filter((x) => x && x.Lrrid).slice(0, 12)
      .map((x) => [String(x.Lrrid), Number.isFinite(Number(x.LrrRSSI)) ? Number(x.LrrRSSI) : null, Number.isFinite(Number(x.LrrSNR)) ? Number(x.LrrSNR) : null]);
    let _rec = payload.find((x) => x && x.variable === 'lrrid');
    if (!_rec) {
      const _ref = payload.find((x) => x && x.time);
      _rec = { variable: 'lrrid', value: String(_up.Lrrid) };
      if (_ref) _rec.time = _ref.time;
      payload.push(_rec);
    }
    if (_ls.length) _rec.metadata = Object.assign({}, _rec.metadata, { lrrs: _ls });
  }
} catch (e) { console.error('T-GWMAP-07', e && e.message); }
