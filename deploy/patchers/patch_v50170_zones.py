# -*- coding: utf-8 -*-
"""T-ZONES-01 · πυρήνας v50.170 (3/11/2026, Michalis: «ένας αγρός … σε κάθε καλλιέργεια μπορούμε να έχουμε διαφορετικές
ζώνες και διαφορετικές εντολές άρδευσης» → «ναι ξεκίνησε· ναι μπορεί να ποτίζει περισσότερες από μία καλλιέργειες»).

ΦΑΣΗ 1 — ζώνες άρδευσης στο επίπεδο του ΑΓΡΟΥ, καθεμία με όνομα, αισθητήρες εδάφους και καλλιέργειες (m² ανά καλλιέργεια
μέσα στη ζώνη). ΚΑΜΙΑ βάνα (φάση 2 = Κώστας). Η σύσταση του αγρού/κάθε καλλιέργειας ΔΕΝ αλλάζει.
  Ζ1 ανάγνωση: ξεχωριστό tag «irrigation_zones» (γράφει το sync v18· δικό του όριο μεγέθους, δεν τρώει το configuration).
  Ζ2 οι τιμές εδάφους ΚΑΘΕ συσκευής (μετά πύλη/μάσκα/σημεία) κρατιούνται για τον αγρό (_SAG_SOIL_DEV_LAST).
  Ζ3 για κάθε καλλιέργεια × ζώνη: ΤΟ ΙΔΙΟ calculate_IrrigationVolume με (α) υγρασία = μέσος όρος των αισθητήρων ΤΗΣ ζώνης
     (χωρίς αισθητήρα ή χωρίς μέτρηση → ο μέσος του αγρού, και λέγεται), (β) m² της καλλιέργειας ΜΕΣΑ στη ζώνη (αν δεν
     δηλώθηκαν και η καλλιέργεια είναι σε ΜΙΑ ζώνη → τα m² της καλλιέργειας· αλλιώς ΔΕΝ βγαίνουν λίτρα: «δηλώστε m²»),
     (γ) φυτά μόνο όταν η ζώνη έχει ΟΛΗ την καλλιέργεια. Όρια εδάφους/βαθμονόμηση και IPSI: του αγρού (δηλώνεται).
  Ζ4 αποτέλεσμα: shared.irrigation_zones μέσω field_bundle_2 (το widget το συγχωνεύει ήδη· ΔΕΝ πιέζει το γεμάτο bundle),
     κάθε ωριαίο κύκλο, μαζί με την κάρτα μεθόδου· και στην ημερήσια εγγραφή.
  Ζ5 η λίστα σονδών soil_sensors περιέχει ΟΛΕΣ τις σόνδες του αγρού (c:1 = στο ίδιο βάθος με άλλη → αισθητήρας απόφασης).
Χωρίς ζώνες: ΤΑΥΤΟΣΗΜΑ αποτελέσματα (μόνο η λίστα soil_sensors γράφεται πληρέστερη). Καμία αγρονομική σταθερά.
count==1, CRLF, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-03" in s and "T-ZONES-01" not in s

HELPERS = r"""// ── End T-DEPTH1-01 helpers ───────────────────────────────────────────────

// ── T-ZONES-01 (v50.170 · 3/11/2026) · ΖΩΝΕΣ ΑΡΔΕΥΣΗΣ ΜΕΣΑ ΣΤΟΝ ΑΓΡΟ (ΦΑΣΗ 1, ΧΩΡΙΣ ΒΑΝΕΣ) ──
// Michalis 3/11: «ένας αγρός … σε κάθε καλλιέργεια μπορούμε να έχουμε διαφορετικές ζώνες» · «μια ζώνη μπορεί να ποτίζει
// περισσότερες από μία καλλιέργειες». Ζώνη = όνομα + αισθητήρες εδάφους + καλλιέργειες με τα m² τους μέσα στη ζώνη.
// Η σύσταση του αγρού/της καλλιέργειας ΔΕΝ αλλάζει· για κάθε ζώνη ξανατρέχει ΤΟ ΙΔΙΟ calculate_IrrigationVolume.
let _SAG_SOIL_DEV_LAST = null;   // τιμές εδάφους ανά συσκευή του τρέχοντος αγρού (από _sagApplySoilRef)
let _SAG_ZONES_ACC = null;       // αποτελέσματα ζωνών του τρέχοντος αγρού
const _SAG_ZONE_SOIL_RE = /^(soil_moisture|soil_humidity|water_soil|soil_temperature|temp_soil|conduct_soil)\d?(_avg|_max|_min|_sum)?$/;
function _sagZonesParse(raw) {
  let a;
  try { a = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return []; }
  if (!Array.isArray(a)) return [];
  const out = [];
  for (const z of a.slice(0, 20)) {
    if (!z || typeof z !== 'object') continue;
    const n = String(z.n == null ? '' : z.n).trim().slice(0, 40);
    if (!n) continue;
    const sn = (Array.isArray(z.s) ? z.s : []).map(String).filter(x => /^[0-9a-f]{24}(:2)?$/.test(x)).slice(0, 10);
    const c = (Array.isArray(z.c) ? z.c : [])
      .map(x => Array.isArray(x) ? { id: String(x[0] == null ? '' : x[0]), a: Number(x[1]) } : null)
      .filter(x => x && x.id).slice(0, 20);
    if (!c.length) continue;
    out.push({ n, s: sn, c });
  }
  return out;
}
// Οι μετρήσεις της καλλιέργειας με το έδαφος ΤΩΝ αισθητήρων της ζώνης (μέσος όρος ανά κλειδί). Χωρίς έγκυρη υγρασία
// στη ζώνη → οι μετρήσεις του αγρού αυτούσιες (own=false).
function _sagZoneMeas(mfc, zone) {
  const devs = _SAG_SOIL_DEV_LAST || {};
  const names = Object.keys(devs).filter(nm => devs[nm] && zone.s.indexOf(String(devs[nm]._id)) >= 0);
  const agg = {};
  for (const nm of names) for (const k of Object.keys(devs[nm])) {
    if (!_SAG_ZONE_SOIL_RE.test(k)) continue;
    const a = devs[nm][k];
    const v = (Array.isArray(a) && a[0] && typeof a[0] === 'object') ? Number(a[0].value) : NaN;
    if (!Number.isFinite(v)) continue;
    if (!agg[k]) agg[k] = { s: 0, c: 0, tpl: a };
    agg[k].s += v; agg[k].c++;
  }
  if (!Object.keys(agg).some(k => /^(soil_moisture|soil_humidity|water_soil)\d?$/.test(k))) return { meas: mfc, own: false, n: names.length };
  const data = Object.assign({}, (mfc && mfc.data) || {});
  for (const k of Object.keys(data)) if (_SAG_ZONE_SOIL_RE.test(k)) delete data[k];
  for (const k of Object.keys(agg)) data[k] = _sagWithValue(agg[k].tpl, agg[k].s / agg[k].c);
  return { meas: Object.assign({}, mfc, { data }), own: true, n: names.length };
}
// Μία καλλιέργεια, όλες οι ζώνες της. Μόνο στον ωριαίο κύκλο (όπως η άρδευση).
function _sagZonesForCrop(fieldConfig, crop, cropParams, mfc, ipsi, hourTich) {
  const zs = (fieldConfig && fieldConfig.irrigation_zones) || [];
  if (!zs.length || !hourTich || !crop) return;
  if (!_SAG_ZONES_ACC) _SAG_ZONES_ACC = zs.map(z => ({ n: z.n, s: z.s.length, own: null, sn: 0, m: null, b: null, cr: [] }));
  const cid = String(crop.id == null ? '' : crop.id);
  const inZones = zs.filter(z => z.c.some(x => x.id === cid)).length;
  zs.forEach((z, zi) => {
    const zc = z.c.find(x => x.id === cid);
    if (!zc) return;
    const acc = _SAG_ZONES_ACC[zi];
    const zm = _sagZoneMeas(mfc, z);
    const rz = _sagRootZoneMoisture(zm.meas, cropParams);
    const m = rz && rz.ok ? Math.round(rz.value * 10) / 10 : null;
    if (acc.own === null) { acc.own = zm.own; acc.sn = zm.n; acc.m = m; acc.b = rz && rz.ok ? rz.basis : null; }
    const area = (Number.isFinite(zc.a) && zc.a > 0) ? zc.a : (inZones === 1 ? Number(cropParams.area) : NaN);
    const row = { id: cid, a: (Number.isFinite(area) && area > 0) ? area : null, m, L: null, h: null, t: null, col: 'grey' };
    if (!row.a) {
      row.t = 'Δηλώστε τα m² της καλλιέργειας μέσα σε αυτή τη ζώνη.';
      acc.cr.push(row);
      return;
    }
    const p = Object.assign({}, cropParams, { area: row.a, area_source: 'zone' });
    if (row.a !== Number(cropParams.area)) delete p.plants;   // φυτά μόνο όταν η ζώνη έχει ΟΛΗ την καλλιέργεια
    const out = calculate_IrrigationVolume(hourTich, zm.meas, ipsi, p) || [];
    const g = (k) => out.find(x => x && x.variable === k);
    const gl = g('grossIrrigationLiters'), gh = g('irrigationDurationHours');
    const L = gl ? Number(gl.value) : NaN, H = gh ? Number(gh.value) : NaN;
    const msg = g('irrigation_message') || g('irrigation_config_error');
    row.L = (gl && gl.value !== null && Number.isFinite(L)) ? Math.round(L) : null;
    row.h = (gh && gh.value !== null && Number.isFinite(H)) ? Math.round(H * 100) / 100 : null;
    row.t = msg ? String(msg.value == null ? '' : msg.value).slice(0, 90) : null;
    row.col = (msg && msg.metadata && msg.metadata.color) || 'grey';
    acc.cr.push(row);
  });
}
// shared.irrigation_zones για το field_bundle_2 (null = ο αγρός δεν έχει ζώνες ή δεν έτρεξε ωριαίος κύκλος).
function _sagZonesShared(fieldConfig, nowIso) {
  const zs = (fieldConfig && fieldConfig.irrigation_zones) || [];
  if (!zs.length || !_SAG_ZONES_ACC) return null;
  const z = _SAG_ZONES_ACC.map(a => {
    const Ls = a.cr.map(r => r.L);
    const tot = (a.cr.length && Ls.every(v => Number.isFinite(v))) ? Ls.reduce((x, y) => x + y, 0) : null;
    return { n: a.n, m: a.m, b: a.b, own: !!a.own, sn: a.sn || 0, s: a.s, L: tot, cr: a.cr };
  });
  return { irrigation_zones: { value: z.length, metadata: { color: 'blue', t: nowIso, z,
    text: 'Ζώνες άρδευσης: για κάθε ζώνη ο ίδιος υπολογισμός άρδευσης με την υγρασία των αισθητήρων της ζώνης και τα m² '
      + 'κάθε καλλιέργειας μέσα της. Ζώνη χωρίς δικό της αισθητήρα παίρνει τον μέσο όρο του αγρού. Τα όρια του εδάφους '
      + 'είναι του αγρού. Οι βάνες δεν έχουν συνδεθεί ακόμη με τις ζώνες.' } } };
}
async function _sagZonesSend(dev, fieldConfig, fieldName, dailyTich) {
  const sh = _sagZonesShared(fieldConfig, new Date().toISOString());
  if (!sh) return false;
  if (dailyTich && _SAG_METHOD_CARD && _SAG_METHOD_CARD.t) return false;   // η ημερήσια εγγραφή τις περιλαμβάνει
  if (_SAG_METHOD_CARD && _SAG_METHOD_CARD.t) {
    sh.field_method_card = { value: _SAG_METHOD_CARD.n, metadata: { color: 'grey', text: String(_SAG_METHOD_CARD.t).slice(0, 2000) } };
  }
  if (JSON.stringify(sh).length > 9000) delete sh.field_method_card;
  while (JSON.stringify(sh).length > 9000 && sh.irrigation_zones.metadata.z.length > 1) sh.irrigation_zones.metadata.z.pop();
  await dev.sendData([{ variable: 'field_bundle_2', value: sh.irrigation_zones.value,
    metadata: { schema: { name: 'field_bundle_2', version: 1, source: 'T-ZONES-01' }, shared: sh } }]);
  console.log('[' + (fieldName || '—') + '] T-ZONES-01: ' + sh.irrigation_zones.metadata.z.map(x => x.n + ' '
    + (x.m === null ? '—' : x.m + '%') + ' / ' + (x.L === null ? '—' : x.L + ' λ')).join(' · '));
  return true;
}
"""

SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.169 · 2026-11-03';   // T-DEPTH1-03 (δύο σημεία στο ίδιο βάθος) ·",
   "const SAG_KERNEL_VERSION = 'v50.170 · 2026-11-03';   // T-ZONES-01 (ζώνες άρδευσης, φάση 1) · T-DEPTH1-03 (δύο σημεία στο ίδιο βάθος) ·",
   "Ε έκδοση"),
  ("// ── End T-DEPTH1-01 helpers ───────────────────────────────────────────────\n", HELPERS, "Ζ βοηθοί"),
  ("  configuration.irrigation_notification = irrigation_notification;\n",
   "  configuration.irrigation_notification = irrigation_notification;\n"
   "  // T-ZONES-01 (v50.170): ζώνες άρδευσης — ξεχωριστό tag «irrigation_zones» (sync v18· δικό του όριο μεγέθους).\n"
   "  configuration.irrigation_zones = _sagZonesParse((field.tags.filter(item => item.key === 'irrigation_zones')[0] || {}).value);\n",
   "Ζ1 ανάγνωση"),
  ("    const devs = data._sagSoilDev || {};\n    delete data._sagSoilDev;\n",
   "    const devs = data._sagSoilDev || {};\n    delete data._sagSoilDev;\n"
   "    _SAG_SOIL_DEV_LAST = devs;   // T-ZONES-01: οι τιμές ΚΑΘΕ συσκευής για τις ζώνες και τη λίστα της φόρμας\n",
   "Ζ2 τιμές ανά συσκευή"),
  ("          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(irrigationVolume ?? [])];\n",
   "          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(irrigationVolume ?? [])];\n"
   "          // T-ZONES-01: η ίδια άρδευση ανά ζώνη (η σύσταση της καλλιέργειας παραπάνω ΔΕΝ αλλάζει).\n"
   "          try { _sagZonesForCrop(fieldConfig, crop, cropParams, measurementsForCrop, ipsi, hourTich); }\n"
   "          catch (_eZ) { console.log('[' + fieldName + '] T-ZONES-01: ' + ((_eZ && _eZ.message) || _eZ)); }\n",
   "Ζ3 ζώνες ανά καλλιέργεια"),
  ("        try { await _sagSyncSoilSensors(dev_to_send_meas, measurements?.data, fieldName, dailyTich); } catch (_eSS) {}\n",
   "        try { await _sagSyncSoilSensors(dev_to_send_meas, measurements?.data, fieldName, dailyTich); } catch (_eSS) {}\n"
   "        // T-ZONES-01: αποτελέσματα ζωνών (field_bundle_2) — ποτέ δεν ρίχνει τον αγρό.\n"
   "        if (hourTich) { try { await _sagZonesSend(dev_to_send_meas, fieldConfig, fieldName, dailyTich); }\n"
   "          catch (_eZs) { console.log('[' + fieldName + '] T-ZONES-01: η εγγραφή ζωνών απέτυχε (' + ((_eZs && _eZs.message) || _eZs) + ')'); } }\n",
   "Ζ4α εγγραφή"),
  ("                shared: { field_method_card: { value: _SAG_METHOD_CARD.n, metadata: { color: 'grey', text: String(_SAG_METHOD_CARD.t).slice(0, 2000) } } } } });\n",
   "                shared: Object.assign({ field_method_card: { value: _SAG_METHOD_CARD.n, metadata: { color: 'grey', text: String(_SAG_METHOD_CARD.t).slice(0, 2000) } } },\n"
   "                  _sagZonesShared(fieldConfig, new Date().toISOString()) || {}) } });   // T-ZONES-01: και οι ζώνες\n",
   "Ζ4β ημερήσια εγγραφή"),
  ("      _SAG_DEPTH1_PORT = 1; _SAG_D1_HINTS = [];   // T-DEPTH1-02\n",
   "      _SAG_DEPTH1_PORT = 1; _SAG_D1_HINTS = [];   // T-DEPTH1-02\n"
   "      _SAG_SOIL_DEV_LAST = null; _SAG_ZONES_ACC = null;   // T-ZONES-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n",
   "Σ μηδενισμός"),
  # Ζ5 λίστα σονδών για τη φόρμα
  ("  const cand = (data && Array.isArray(data._sagSoilCand)) ? data._sagSoilCand : [];\n"
   "  if (!cand.length && !dailyTich) return false;          // χωρίς ανταγωνισμό: έλεγχος μία φορά την ημέρα\n"
   "  const keyOf = (l) => (Array.isArray(l) ? l : []).map(c => String(c && c.i) + ':' + String(c && c.n)).join('|');\n",
   "  const cand0 = (data && Array.isArray(data._sagSoilCand)) ? data._sagSoilCand : [];\n"
   "  // T-ZONES-01: ΟΛΕΣ οι σόνδες του αγρού (για τις ζώνες της φόρμας)· c:1 = μετρά στο ίδιο βάθος με άλλη (αισθητήρας απόφασης).\n"
   "  const _cn = new Set(cand0.map(c => String(c && c.n)));\n"
   "  const _D = _SAG_SOIL_DEV_LAST || {};\n"
   "  const _all = Object.keys(_D).filter(n => _D[n] && Object.keys(_D[n]).some(k => /^(soil_moisture|soil_humidity|water_soil)\\d?$/.test(k)))\n"
   "    .sort().map(n => ({ i: String(_D[n]._id), n, c: _cn.has(n) ? 1 : 0 }));\n"
   "  const cand = _all.length ? _all : cand0.map(c => ({ i: c.i, n: c.n, c: 1 }));\n"
   "  if (!cand.length && !dailyTich) return false;          // χωρίς σόνδες: έλεγχος μία φορά την ημέρα\n"
   "  const keyOf = (l) => (Array.isArray(l) ? l : []).map(c => String(c && c.i) + ':' + String(c && c.n) + ':' + (c && c.c ? 1 : 0)).join('|');\n",
   "Ζ5 λίστα σονδών"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new); print("  OK", label)

fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
