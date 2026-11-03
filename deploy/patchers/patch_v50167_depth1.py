# -*- coding: utf-8 -*-
"""T-DEPTH1-01 · πυρήνας v50.167 (3/11/2026, Michalis: «θα πρέπει το σύστημα να μπορεί να αναγνωρίζει ότι στην καλλιέργεια
μπορεί να υπάρχει ένας μόνο αισθητήρας βάθους … αυτό θα έπρεπε να επιλέγεται στην παραμετροποίηση … κάνε όλες τις
απαραίτητες παραμετροποιήσεις και αλλαγές ώστε να μην υπάρξουν λάθη και προβλήματα»).

Νέο κλειδί ρύθμισης αγρού `soil_depth_count` (1 | 2· ΑΠΟΝ = 2 = ΑΚΡΙΒΩΣ η σημερινή συμπεριφορά για κάθε υπάρχοντα αγρό).
Με 1 ο αγρός έχει ΕΝΑ βάθος αισθητήρα εδάφους:
  Μ  μάσκα ΑΝΑ ΣΥΣΚΕΥΗ στο _sagScreenDevice (πριν από πύλη, συγχώνευση, ηλικίες, βλάβες, σόνδα απόφασης): συσκευή που
     δίνει κανάλι 1 (ή γυμνά ονόματα) χάνει τα κανάλια 2 (υγρασία/θερμοκρασία/αγωγιμότητα, *_avg). Συσκευή που δίνει ΜΟΝΟ
     κανάλι 2 (π.χ. lse01_deep) ΚΡΑΤΑ τα δεδομένα της — αλλιώς ο αγρός θα έμενε χωρίς έδαφος.
  Β  βλάβες: οι αναμενόμενες «υγρασία/θερμοκρασία βαθέος» βγαίνουν από se0x/lse02 (όχι ψευδές «Λείπει μέτρηση»)· τα
     στατιστικά ημέρας του καναλιού 2 δεν ελέγχονται· η πρόταση «ΔΕΥΤΕΡΟ ΒΑΘΟΣ» δεν εμφανίζεται (δηλώθηκε σκόπιμα).
  Α  αναγνώσεις: ο μέσος 24ώρου και η ημερήσια διάγνωση του καναλιού 2 δεν διαβάζονται (−2..4 κλήσεις/συσκευή).
  Ρ  ριζόστρωμα: ένα βάθος (το βάθος της φόρμας για ΟΠΟΙΑΔΗΠΟΤΕ θέση), κείμενο «δηλωμένο ένα βάθος», ταφόπλακα στη
     σύγκριση βαθών (κλειδί καλλιέργειας — δεν καθαρίζεται με purge).
  Κ  βαθμονόμηση: το soilcal_state.d μηδενίζεται όσο μαθαίνει το ρηχό (αλλιώς έμενε για πάντα η παλιά βαθιά βαθμονόμηση)·
     η computeSoilMoistureLimits αγνοεί το d όταν μαθαίνει το ρηχό.
  Ε  αγωγιμότητα: ένα κανάλι με ετικέτα «έδαφος»· η αναφορά ημέρας δεν ξαναβγάζει soil_ec_ref2 από παλιά κατάσταση·
     purge soil_ece2 / soil_ec_pore2 / soil_ec_raw2 / soil_ec_ref2 (αλλιώς μεταφέρονται 50 ω και γράφονται σε σειρές).
Καμία αγρονομική σταθερά δεν αλλάζει. count==1 (εκτός όπου δηλώνεται), CRLF, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-01" not in s, "ήδη εφαρμοσμένο"

HELPERS = r"""
// ── T-DEPTH1-01 (v50.167 · 3/11/2026) · ΕΝΑ ΒΑΘΟΣ ΑΙΣΘΗΤΗΡΑ ΕΔΑΦΟΥΣ, ΜΕ ΔΗΛΩΣΗ ΣΤΗ ΦΟΡΜΑ ──
// Michalis 3/11: «στην καλλιέργεια μπορεί να υπάρχει ένας μόνο αισθητήρας βάθους … αυτό θα έπρεπε να επιλέγεται
// στην παραμετροποίηση». fieldConfig.soil_depth_count = 1 → ο αγρός έχει ΕΝΑ βάθος· ΑΠΟΝ ή 2 → όπως πάντα.
// Συσκευή δύο καναλιών με μία σόνδα στέλνει στο κανάλι 2 κενό ή σκουπίδια: εδώ το κανάλι 2 ΔΕΝ υπάρχει για τον αγρό.
let _SAG_DEPTH1_ACTIVE = false;
const _SAG_D1_CH1_RE = /^(soil_moisture|soil_humidity|water_soil)1?(_avg)?$/;
const _SAG_D1_CH2_RE = /^(soil_moisture|soil_humidity|water_soil|soil_temperature|temp_soil|conduct_soil)2(_avg|_max|_min|_sum)?$/;
function _sagDepth1Of(cfg) { return Number(cfg && cfg.soil_depth_count) === 1; }
// Μάσκα ΑΝΑ ΣΥΣΚΕΥΗ: μόνο όταν η ίδια συσκευή δίνει και κανάλι 1 / γυμνά ονόματα (lse01_deep μένει ανέγγιχτο).
function _sagDepth1Mask(deviceData) {
  if (!_SAG_DEPTH1_ACTIVE || !deviceData || typeof deviceData !== 'object') return 0;
  const ks = Object.keys(deviceData);
  if (!ks.some(k => _SAG_D1_CH1_RE.test(k))) return 0;
  let n = 0;
  for (const k of ks) if (_SAG_D1_CH2_RE.test(k)) { delete deviceData[k]; n++; }
  return n;
}
// Το κανάλι 2 κόπηκε σε αυτόν τον αγρό; (ναι = υπάρχει ρηχό/γυμνό και η δήλωση είναι «ένα βάθος»)
function _sagD1Masked(measurements) {
  return _SAG_DEPTH1_ACTIVE && !!_sagNumFrom(measurements, _SAG_SOIL_M_SHALLOW);
}
// Αναμενόμενα κανάλια οργάνου: σε se0x/lse02 με ένα βάθος, χωρίς «βαθέος».
function _sagDevExpect(t) {
  const e = _SAG_DEV_EXPECT[t];
  if (!e || !_SAG_DEPTH1_ACTIVE || (t !== 'se0x' && t !== 'lse02')) return e;
  return e.filter(ch => !ch.a.every(k => /2(_avg)?$/.test(k)));
}
function _sagDevStatsD1(dev) {
  const st = (dev && dev.stats) || {};
  if (!_SAG_DEPTH1_ACTIVE || !dev || (dev.t !== 'se0x' && dev.t !== 'lse02')) return st;
  const o = {};
  for (const k of Object.keys(st)) if (!/2(_avg)?$/.test(k)) o[k] = st[k];
  return o;
}
// Κανάλια αγωγιμότητας: με ένα βάθος, μόνο το 1 και με ετικέτα «έδαφος».
function _sagEcChansD1(measurements) {
  if (!_sagD1Masked(measurements)) return _SAG_EC_CHANNELS;
  return [Object.assign({}, _SAG_EC_CHANNELS[0], { el: 'έδαφος' })];
}
// ── End T-DEPTH1-01 helpers ───────────────────────────────────────────────
"""

SUBS = [
    ("const SAG_KERNEL_VERSION = 'v50.166 · 2026-10-31';",
     "const SAG_KERNEL_VERSION = 'v50.167 · 2026-11-03';   // T-DEPTH1-01 (ένα βάθος αισθητήρα με δήλωση) ·", "Ε έκδοση", 1),
    ("let _SAG_SUBSTRATE_ACTIVE = null;", "let _SAG_SUBSTRATE_ACTIVE = null;" + HELPERS, "Η βοηθοί + σημαία", 1),
    ("      _SAG_SUBSTRATE_ACTIVE = null;   // T-SUBSTRATE-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n",
     "      _SAG_SUBSTRATE_ACTIVE = null;   // T-SUBSTRATE-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n"
     "      _SAG_DEPTH1_ACTIVE = false;     // T-DEPTH1-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n", "Σ1 μηδενισμός ανά αγρό", 1),
    ("        _SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);   // T-SUBSTRATE-01\n",
     "        _SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);   // T-SUBSTRATE-01\n"
     "        _SAG_DEPTH1_ACTIVE = _sagDepth1Of(fieldConfig);          // T-DEPTH1-01\n", "Σ2 σημαία από τη ρύθμιση", 1),
    ("function _sagScreenDevice(deviceData, deviceName, fieldName) {\n  try {\n",
     "function _sagScreenDevice(deviceData, deviceName, fieldName) {\n  try {\n"
     "    // T-DEPTH1-01: ΠΡΩΤΑ η μάσκα — πύλη, συγχώνευση, ηλικίες, βλάβες δεν βλέπουν ποτέ το κανάλι 2.\n"
     "    _sagDepth1Mask(deviceData);\n", "Μ μάσκα ανά συσκευή", 1),
    ("  const exp = _SAG_DEV_EXPECT[t];\n  const missing = [], present = [], missingCh = [];",
     "  const exp = _sagDevExpect(t);   // T-DEPTH1-01\n  const missing = [], present = [], missingCh = [];", "Β1 αναμενόμενα (βλάβες)", 1),
    ("      for (const ch of (_SAG_DEV_EXPECT[d.t] || [])) {",
     "      for (const ch of (_sagDevExpect(d.t) || [])) {   // T-DEPTH1-01", "Β2 αναμενόμενα (ηλικίες)", 1),
    ("  const st = dev.stats || {};\n  const stuck = [];",
     "  const st = _sagDevStatsD1(dev);   // T-DEPTH1-01\n  const stuck = [];", "Β3 στατιστικά ημέρας", 1),
    ("  if (soil && !soil2) {\n    out.push('ΔΕΥΤΕΡΟ ΒΑΘΟΣ",
     "  if (soil && !soil2 && !_SAG_DEPTH1_ACTIVE) {   // T-DEPTH1-01: δηλώθηκε σκόπιμα ένα βάθος\n    out.push('ΔΕΥΤΕΡΟ ΒΑΘΟΣ", "Β4 χωρίς πρόταση δεύτερου βάθους", 1),
    ("    const _diagVars = typeName ? _SAG_DIAG_VARS[typeName] : null;\n",
     "    const _diagVars = typeName ? ((_SAG_DEPTH1_ACTIVE && (typeName === 'se0x' || typeName === 'lse02'))   // T-DEPTH1-01\n"
     "      ? _SAG_DIAG_VARS[typeName].filter(v => !/2$/.test(v)) : _SAG_DIAG_VARS[typeName]) : null;\n", "Α1 ημερήσια διάγνωση", 1),
    ("      const _SOIL_AVG_CH = ['soil_moisture1', 'soil_temperature1',\n                            'soil_moisture2', 'soil_temperature2'];",
     "      const _SOIL_AVG_CH = _SAG_DEPTH1_ACTIVE ? ['soil_moisture1', 'soil_temperature1']   // T-DEPTH1-01\n"
     "        : ['soil_moisture1', 'soil_temperature1', 'soil_moisture2', 'soil_temperature2'];", "Α2 μέσοι 24ώρου", 1),
    ("  for (const k of keys) {\n    const n = Number(parameters?.[k]);\n    if (Number.isFinite(n) && n > 0 && n <= 300) return n;\n  }\n  return which === 2 ? 50 : 20;",
     "  // T-DEPTH1-01: με ένα βάθος, το βάθος της φόρμας ισχύει για ΟΠΟΙΑΔΗΠΟΤΕ θέση (και για σόνδα στο κανάλι 2).\n"
     "  if (_sagDepth1Of(parameters) && which === 2) return _sagSensorDepthCm(parameters, 1);\n"
     "  for (const k of keys) {\n    const n = Number(parameters?.[k]);\n    if (Number.isFinite(n) && n > 0 && n <= 300) return n;\n  }\n  return which === 2 ? 50 : 20;", "Ρ1 βάθος", 1),
    ("  const s = _sagNumFrom(measurements, _SAG_SOIL_M_SHALLOW);\n  const d = _sagNumFrom(measurements, _SAG_SOIL_M_DEEP);\n  if (!s && !d) return { ok: false };",
     "  const s = _sagNumFrom(measurements, _SAG_SOIL_M_SHALLOW);\n"
     "  // T-DEPTH1-01: με δηλωμένο ένα βάθος, το κανάλι 2 δεν μετέχει όταν υπάρχει ρηχό (δεύτερη άμυνα μετά τη μάσκα).\n"
     "  const d = (_sagDepth1Of(parameters) && s) ? null : _sagNumFrom(measurements, _SAG_SOIL_M_DEEP);\n"
     "  if (!s && !d) return { ok: false };", "Ρ2 ριζόστρωμα", 1),
    ("    { variable: 'soil_depth_basis', value: rz.basis,\n      metadata: { color: (rz.m1 !== null && rz.m2 !== null) ? 'green' : 'blue',\n"
     "        text: (rz.m1 !== null && rz.m2 !== null)\n          ? 'Χρησιμοποιούνται και τα δύο βάθη.'\n"
     "          : 'Ένα μόνο βάθος. Δεύτερος αισθητήρας βαθύτερα θα ακρίβαινε τη δόση.' } },\n  ];",
     "    { variable: 'soil_depth_basis', value: rz.basis,\n      metadata: { color: ((rz.m1 !== null && rz.m2 !== null) || _SAG_DEPTH1_ACTIVE) ? 'green' : 'blue',\n"
     "        text: (rz.m1 !== null && rz.m2 !== null)\n          ? 'Χρησιμοποιούνται και τα δύο βάθη.'\n"
     "          : (_SAG_DEPTH1_ACTIVE   // T-DEPTH1-01\n"
     "            ? 'Ο αγρός έχει δηλωμένο ένα βάθος αισθητήρα εδάφους· η δόση βγαίνει από αυτό.'\n"
     "            : 'Ένα μόνο βάθος. Δεύτερος αισθητήρας βαθύτερα θα ακρίβαινε τη δόση.') } },\n  ];\n"
     "  // T-DEPTH1-01: η σύγκριση βαθών είναι κλειδί ΚΑΛΛΙΕΡΓΕΙΑΣ (μεταφέρεται 50 ω) — ταφόπλακα, όχι σιωπή.\n"
     "  if (_SAG_DEPTH1_ACTIVE && rz.divergence === null) {\n"
     "    out.push({ variable: 'soil_depth_divergence', value: null,\n"
     "      metadata: { color: 'grey', text: 'Ένα βάθος αισθητήρα — δεν υπάρχει σύγκριση ρηχού-βαθέος.' } });\n  }",
     "Ρ3 κείμενο βάθους + ταφόπλακα", 1),
    ("      const _sOK = _calOk(_cs.s), _dOK = _calOk(_cs.d);",
     "      // T-DEPTH1-01: με ένα βάθος η βαθιά βαθμονόμηση (παλιά, από τις ημέρες των δύο βαθών) αγνοείται όσο μαθαίνει το ρηχό.\n"
     "      const _sOK = _calOk(_cs.s), _dOK = _calOk(_cs.d)\n"
     "        && !(_sagDepth1Of(parameters) && _cs.s && (Number(_cs.s.n) || 0) > 0);", "Κ1 όρια υγρασίας", 1),
    ("            const _scD = _scUpd(_scPrev.d, _scNum(_SAG_SOIL_M_DEEP), _scRange(_SAG_SOIL_M_DEEP));",
     "            // T-DEPTH1-01: με ένα βάθος και ρηχή μέτρηση, το d ΔΕΝ κρατιέται (το _scUpd χωρίς μέτρηση το κρατούσε για πάντα).\n"
     "            const _scD = (_SAG_DEPTH1_ACTIVE && Number.isFinite(_scNum(_SAG_SOIL_M_SHALLOW))) ? {}\n"
     "              : _scUpd(_scPrev.d, _scNum(_SAG_SOIL_M_DEEP), _scRange(_SAG_SOIL_M_DEEP));", "Κ2 βαθμονόμηση", 1),
    ("          if (_SAG_SUBSTRATE_ACTIVE || !_sagDivergenceIndicators(measurements?.data).length) _purgeShared.push('sensor_divergence');\n",
     "          if (_SAG_SUBSTRATE_ACTIVE || !_sagDivergenceIndicators(measurements?.data).length) _purgeShared.push('sensor_divergence');\n"
     "          // T-DEPTH1-01: κάρτες καναλιού 2 δεν μεταφέρονται (50 ω) ούτε γράφονται σε σειρές όταν ο αγρός έχει ένα βάθος.\n"
     "          if (_sagD1Masked(measurements)) _purgeShared.push('soil_ece2', 'soil_ec_pore2', 'soil_ec_raw2', 'soil_ec_ref2');\n",
     "Ε1 purge καναλιού 2", 1),
    ("    for (const k of ['sensorShallow_depth_cm', 'sensor_deep_depth_cm',",
     "    for (const k of ['soil_depth_count', 'sensorShallow_depth_cm', 'sensor_deep_depth_cm',", "Δ διάγνωση φόρμας", 1),
]
for old, new, label, cnt in SUBS:
    c = s.count(old); assert c == cnt, f"{label}: βρέθηκε {c} φορές (αναμενόταν {cnt})"
    s = s.replace(old, new); print("  OK", label)
# Ε2: τα δύο σημεία καναλιών αγωγιμότητας (αναφορά ημέρας + δείκτες) — ίδια συμβολοσειρά, ακριβώς 2.
old = "    const chans = _numbered ? _SAG_EC_CHANNELS\n"
c = s.count(old); assert c == 2, f"Ε2: βρέθηκε {c} φορές (αναμενόταν 2)"
s = s.replace(old, "    const chans = _numbered ? _sagEcChansD1(measurements)   // T-DEPTH1-01\n"); print("  OK Ε2 κανάλια EC ×2")

fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
