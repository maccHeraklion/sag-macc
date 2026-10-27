# -*- coding: utf-8 -*-
"""Πυρήνας v50.162 · T-SUBSTRATE-01 Στάδια 0-1 (έγκριση Μιχάλη 27/10: «εγκρίνω Ε1–Ε6 όπως προτείνεις, προχώρα»).
Σχέδιο: reports/ΣΧΕΔΙΟ_T-SUBSTRATE-01_ΣΤΑΔΙΑ_0-1_2026-10-27.md · αριθμοί/πηγές: reports/ΥΠΟΣΤΡΩΜΑ_ΚΟΚΟΦΟΙΝΙΚΑ_ΑΡΙΘΜΟΙ_ΓΙΑ_ΕΓΚΡΙΣΗ_2026-10-27.md

Υπόστρωμα κοκοφοίνικα (soil_type / soil_texture_class === 'coir'). ΚΑΜΙΑ αλλαγή για αγρούς χωρίς 'coir':
κάθε νέος κλάδος είναι πίσω από τη σημαία _SAG_SUBSTRATE_ACTIVE, που μηδενίζεται σε ΚΑΘΕ αγρό του βρόχου.
  Κ1 SUBSTRATE_PROFILE + _sagSubstrateOf (ακριβής σύγκριση) + βοηθοί κειμένων/μάθησης — ΟΧΙ στο SOIL_PROFILE.
  Κ2 σημαία αγρού (μηδενισμός στην αρχή του βρόχου, ορισμός δίπλα στο T-COVERED-01, πριν το getMeasurements).
  Κ3 πύλη ευλογοφάνειας: υγρασία υποστρώματος ώς 100 (εύρος οργάνου) — όπως τα 65 °C του θερμοκηπίου.
  Κ4 μάσκα υγρασίας/αγωγιμότητας ΜΟΝΟ στο αντίγραφο της καλλιέργειας (measurementsForCrop).
  Κ5 παράλειψη: αναφορά EC (T-ECREF), κρίση αλατότητας/ECe (T-ECPH), _sagEcIndicators, απόκλιση βαθών, όρια υγρασίας.
  Κ6 μάθηση (T-SOILCAL-01): όριο 100, δείγματα πλατό (fs), ημερήσιο εύρος (r, rd), ιστορικό αγωγιμότητας (eh).
  Κ7 κείμενα: irrigation_message, soil_ec_status, ipsiError (→ plant_stress/bpi_message).
  Κ8 υπόστρωμα σε ακάλυπτο αγρό → σημείωση στη λίστα κενών ρύθμισης του στόλου.
  Κ9 έκδοση v50.162.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"
raw = io.open(C, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
assert "\r\n" in s and s.count("\n") == s.count("\r\n"), "ο πυρήνας πρέπει να είναι καθαρό CRLF"
print("ΠΡΙΝ πυρήνας", hashlib.sha256(raw).hexdigest(), len(raw))
assert "T-SUBSTRATE-01" not in s, "ήδη εφαρμοσμένο"
s = s.replace("\r\n", "\n")
def sub(old, new, label):
    global s; n = s.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; s = s.replace(old, new); print("  OK", label)

# Κ9 έκδοση
sub("const SAG_KERNEL_VERSION = 'v50.161 · 2026-10-14';", "const SAG_KERNEL_VERSION = 'v50.162 · 2026-10-27';", "Κ9 έκδοση")

# Κ1 ταυτότητα υποστρώματος + βοηθοί
K1 = r"""    if (typeof _k === 'string' && _k && SOIL_PROFILE[_k]) return _k;
  }
  return null;
}

// ═══ T-SUBSTRATE-01 (v50.162 · 27/10/2026, έγκριση Μιχάλη Ε1–Ε6) ════════════════
// Υπόστρωμα κοκοφοίνικα (slabs/σακιά θερμοκηπίου). ΔΕΝ είναι έδαφος και ΔΕΝ μπαίνει στο
// SOIL_PROFILE: κάθε καταναλωτής του πίνακα εδαφών παίρνει «άγνωστο» και πάει στην
// τεκμηριωμένη εφεδρεία του, και η αναζήτηση πλησιέστερης κλάσης (T-SOILCAL-02) δεν βλέπει
// ποτέ κοκοφοίνικα. ΣΤΑΔΙΟ 1: καμία υδραυλική σταθερά (οι αριθμοί Α1 έρχονται στο Στάδιο 2).
// ΓΙΑΤΙ: ο Dragino LSE01 σε κοκοφοίνικα δείχνει ~25 % εκεί που η αναφορά δείχνει 50 %, και
// EC όγκου 261 µS/cm σε διάλυμα 2,5 dS/m (Dragino 2023, «Calibrate LSE01 to use other soil»).
// Οι τύποι χώματος (Topp, Hilhorst ε0=4,1, ECe/Maas-Hoffman, FAO-56) εδώ δίνουν ψέματα.
// Σχέδιο: reports/ΣΧΕΔΙΟ_T-SUBSTRATE-01_ΣΤΑΔΙΑ_0-1_2026-10-27.md
const SUBSTRATE_PROFILE = {
  coir: { name: 'Υπόστρωμα κοκοφοίνικα', kind: 'substrate' }
};
// ΑΚΡΙΒΗΣ σύγκριση συμβολοσειράς: 'constructor', '__proto__' κ.λπ. δεν περνούν ποτέ.
function _sagSubstrateOf(cfg) {
  const _c = [cfg?.soil_texture_class, cfg?.soil_type];
  for (const _k of _c) if (_k === 'coir') return 'coir';
  return null;
}
// Ε1: «μαθημένο» slab = ≥10 ημέρες με δείγμα στραγγισμένου πλατό ΚΑΙ διασπορά των
// τελευταίων 5 δειγμάτων ≤3 μονάδες (στην κλίμακα του οργάνου).
const _SAG_SUB_LEARN_N = 10;
const _SAG_SUB_LEARN_SPREAD = 3;
// Ε2: αγωγιμότητα «ανεβαίνει/πέφτει» όταν το σημερινό 24ωρο απέχει >10 % από τον μέσο των
// 7 προηγούμενων ημερών· αλλιώς «σταθερή». Προτεινόμενη τιμή — αναθεωρείται με τον πιλότο.
const _SAG_SUB_EC_DAYS = 7;
const _SAG_SUB_EC_TREND = 0.10;
const _SAG_SUB_TXT_IPSI = 'Σε υπόστρωμα κοκοφοίνικα ο δείκτης δεν υπολογίζεται ακόμη: '
  + 'ο αισθητήρας δεν είναι βαθμονομημένος στο υπόστρωμα.';
// Υγρασία/αγωγιμότητα slab: ΚΡΥΒΟΝΤΑΙ από τα μοντέλα της καλλιέργειας (ένα σημείο, όπως η
// βροχή στο T-COVERED-01). Υγεία οργάνων και μάθηση βλέπουν τις ωμές τιμές.
const _SAG_SUB_MASK_RE = /^(soil_moisture|soil_humidity|water_soil|conduct_soil)[0-9]*(_avg|_max|_min|_sum)?$/;
function _sagSubstrateMask(data) {
  if (!data || typeof data !== 'object') return data;
  for (const _k of Object.keys(data)) if (_SAG_SUB_MASK_RE.test(_k)) delete data[_k];
  return data;
}
// Κατάσταση μάθησης από το soilcal_state (ρηχό, αλλιώς βαθύ — το slab έχει συνήθως μία σόνδα).
function _sagSubstrateLearnState(measurements) {
  let _j = null;
  try {
    const _raw = getVal(measurements, 'soilcal_state', null);
    _j = (typeof _raw === 'string' && _raw) ? JSON.parse(_raw)
      : ((_raw && typeof _raw === 'object') ? _raw : null);
  } catch (_e) { _j = null; }
  const _has = (st) => !!(st && typeof st === 'object'
    && ((Number(st.n) || 0) > 0 || Number.isFinite(Number(st.r))));
  const st = _has(_j?.s) ? _j.s : (_has(_j?.d) ? _j.d : null);
  const n = st ? Math.max(0, Math.floor(Number(st.n) || 0)) : 0;
  const fs = (st && Array.isArray(st.fs)) ? st.fs.map(Number).filter(Number.isFinite) : [];
  const spread = fs.length >= 5 ? (Math.max.apply(null, fs) - Math.min.apply(null, fs)) : null;
  const learned = n >= _SAG_SUB_LEARN_N && spread !== null && spread <= _SAG_SUB_LEARN_SPREAD;
  return { n, learned, spread,
    rd: st && st.rd != null ? Number(st.rd) : NaN, r: st && st.r != null ? Number(st.r) : NaN };
}
const _sagSubFmt = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
// Κ7 · κάρτα άρδευσης σε υπόστρωμα: ΠΟΤΕ δόση, ΠΟΤΕ κόκκινο. Γκρι όσο μαθαίνει, μπλε μετά.
function _sagSubstrateIrrigationMsg(measurements) {
  const L = _sagSubstrateLearnState(measurements);
  if (!L.learned) {
    const _x = Math.min(L.n, _SAG_SUB_LEARN_N);
    return { variable: 'irrigation_message',
      value: 'Υπόστρωμα: μαθαίνει (' + _x + '/' + _SAG_SUB_LEARN_N + ')',
      metadata: { color: 'grey',
        text: 'Υπόστρωμα κοκοφοίνικα: το σύστημα μαθαίνει το slab (' + _x + ' από '
          + _SAG_SUB_LEARN_N + ' ημέρες ποτίσματος'
          + (L.n >= _SAG_SUB_LEARN_N ? ' — η συμπεριφορά του δεν έχει σταθεροποιηθεί ακόμη' : '')
          + '). Σε υπόστρωμα δεν βγαίνει δόση — ποτίστε με βάση την απορροή.' } };
  }
  const _today = (Number.isFinite(L.rd) && Number.isFinite(L.r))
    ? ('Slab: σήμερα η υγρασία κινήθηκε ' + _sagSubFmt(L.rd) + ' μονάδες, συνήθως ' + _sagSubFmt(L.r) + '. ')
    : 'Slab: η συμπεριφορά του έχει μαθευτεί. ';
  return { variable: 'irrigation_message', value: 'Υπόστρωμα κοκοφοίνικα',
    metadata: { color: 'blue',
      text: _today + 'Ένδειξη οργάνου, όχι πραγματική υγρασία. Δόση δεν βγαίνει σε υπόστρωμα.' } };
}
// Ιστορικό αγωγιμότητας slab: ΜΙΑ τιμή την ημέρα (μέσος 24ώρου, αλλιώς η τελευταία),
// αναγμένη στους 25 °C με 2 %/°C (ίδιος κανόνας με _sagEcChain). Παράθυρο 8 ημερών
// (σήμερα + 7 προηγούμενες), βήμα 1 ημέρα. Κενό >3 ημερών: η εβδομάδα ξεκινά από την αρχή.
function _sagSubstrateEcHist(prev, measurements, dayNum) {
  const p = (prev && typeof prev === 'object' && Array.isArray(prev.v))
    ? { k: prev.k, v: prev.v.slice(-(_SAG_SUB_EC_DAYS + 1)) } : { k: null, v: [] };
  if (p.k === dayNum) return p;
  const _first = (keys) => {
    for (const k of keys) { const v = Number(getVal(measurements, k, NaN)); if (Number.isFinite(v)) return v; }
    return NaN;
  };
  const ec = _first(['conduct_soil1_avg', 'conduct_soil_avg', 'conduct_soil1', 'conduct_soil']);
  if (!Number.isFinite(ec) || ec < _SAG_EC_DEAD_US) return p;   // νεκρό όργανο: δεν μαθαίνουμε σκουπίδια
  const t = _first(['soil_temperature1_avg', 'temp_soil_avg', 'soil_temperature_avg',
    'soil_temperature1', 'temp_soil', 'soil_temperature']);
  const _tf = Number.isFinite(t) ? 1 + 0.02 * (t - 25) : 1;
  const ec25 = _tf > 0.2 ? ec / _tf : ec;
  const v = (Number.isFinite(p.k) && dayNum - p.k > 3) ? [] : p.v;
  return { k: dayNum, v: v.concat([Math.round(ec25)]).slice(-(_SAG_SUB_EC_DAYS + 1)) };
}
// Κ7 · κάρτα αγωγιμότητας σε υπόστρωμα: ΤΑΣΗ, όχι αλατότητα. Καμία ECe, κανένα όριο καλλιέργειας.
function _sagSubstrateEcStatus(eh) {
  const v = (eh && Array.isArray(eh.v)) ? eh.v.map(Number).filter(Number.isFinite) : [];
  const _tail = ' Δεν είναι EC διαλύματος — μετρήστε με σύριγγα και απορροή.';
  if (v.length < _SAG_SUB_EC_DAYS + 1) {
    const _x = Math.max(0, v.length - 1);
    return { variable: 'soil_ec_status',
      value: 'Υπόστρωμα: μαθαίνει (' + _x + '/' + _SAG_SUB_EC_DAYS + ')',
      metadata: { color: 'grey', text: 'Αγωγιμότητα slab: μαθαίνει τη βάση (' + _x + ' από '
        + _SAG_SUB_EC_DAYS + ' ημέρες).' + _tail } };
  }
  const base = v.slice(0, _SAG_SUB_EC_DAYS).reduce((a, b) => a + b, 0) / _SAG_SUB_EC_DAYS;
  const now = v[v.length - 1];
  const rel = base > 0 ? (now - base) / base : 0;
  const w = rel > _SAG_SUB_EC_TREND ? 'ανεβαίνει' : (rel < -_SAG_SUB_EC_TREND ? 'πέφτει' : 'σταθερή');
  return { variable: 'soil_ec_status', value: 'Αγωγιμότητα slab: ' + w,
    metadata: { color: 'blue', text: 'Αγωγιμότητα slab: ' + w
      + ' σε σχέση με την προηγούμενη εβδομάδα (ένδειξη οργάνου στους 25 °C).' + _tail } };
}
"""
sub("    if (typeof _k === 'string' && _k && SOIL_PROFILE[_k]) return _k;\n  }\n  return null;\n}\n", K1, "Κ1 ταυτότητα υποστρώματος")

# Κ2 σημαία αγρού: δήλωση + όρια
sub("let _SAG_COVERED_ACTIVE = false;\n",
    "let _SAG_COVERED_ACTIVE = false;\n"
    "// T-SUBSTRATE-01: 'coir' ή null για τον αγρό που επεξεργάζεται ΤΩΡΑ (μηδενίζεται σε κάθε αγρό).\n"
    "let _SAG_SUBSTRATE_ACTIVE = null;\n"
    "// Υγρασία υποστρώματος ώς το εύρος του οργάνου (Dragino LSE01: 0–100 %). Ο κοκοφοίνικας\n"
    "// κρατά νόμιμα πολύ περισσότερο νερό από το χώμα· το 60 θα έκοβε υγιείς μετρήσεις ως «βλάβη».\n"
    "const _SAG_SUBSTRATE_MOIST_HI = 100;\n"
    "const _SAG_SUBSTRATE_MOIST_RE = /^(soil_moisture|soil_humidity|water_soil)$/;\n",
    "Κ2 δήλωση σημαίας")
sub("    for (let i = 0; i < fields.length; i=i+1)\n    {\n",
    "    for (let i = 0; i < fields.length; i=i+1)\n    {\n"
    "      _SAG_SUBSTRATE_ACTIVE = null;   // T-SUBSTRATE-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n",
    "Κ2 μηδενισμός σε κάθε αγρό")
sub("        _SAG_COVERED_ACTIVE = !!fieldConfig.covered_cultivation;\n",
    "        _SAG_COVERED_ACTIVE = !!fieldConfig.covered_cultivation;\n"
    "        _SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);   // T-SUBSTRATE-01\n",
    "Κ2 ορισμός σημαίας")

# Κ3 πύλη ευλογοφάνειας
sub("        ? Math.max(range[1], _SAG_COVERED_TEMP_HI) : range[1];\n",
    "        ? Math.max(range[1], _SAG_COVERED_TEMP_HI)\n"
    "        : (_SAG_SUBSTRATE_ACTIVE && _SAG_SUBSTRATE_MOIST_RE.test(_kBase))   // T-SUBSTRATE-01\n"
    "          ? Math.max(range[1], _SAG_SUBSTRATE_MOIST_HI) : range[1];\n",
    "Κ3 πύλη ευλογοφάνειας")

# Κ5 αναφορά EC και κρίση αλατότητας
sub("const _ecRefIndicators = _sagEcRefIndicators(",
    "const _ecRefIndicators = _SAG_SUBSTRATE_ACTIVE ? [] : _sagEcRefIndicators(", "Κ5 αναφορά EC")
sub("            if (_ecDiv) {\n",
    "            if (_SAG_SUBSTRATE_ACTIVE) {\n"
    "              // T-SUBSTRATE-01: η κάρτα αγωγιμότητας υποστρώματος βγαίνει από τη μάθηση\n"
    "              // (T-SOILCAL-01 παρακάτω). Καμία κρίση ECe / Maas-Hoffman σε slab.\n"
    "            } else if (_ecDiv) {\n", "Κ5 κρίση αλατότητας")

# Κ6 μάθηση
sub("const _scPlaus = (v) => Number.isFinite(v) && v >= 0.5 && v <= 60;",
    "const _scPlaus = (v) => Number.isFinite(v) && v >= 0.5\n"
    "              && v <= (_SAG_SUBSTRATE_ACTIVE ? _SAG_SUBSTRATE_MOIST_HI : 60);   // T-SUBSTRATE-01",
    "Κ6 όριο μάθησης")
sub("                st.n = (st.n || 0) + 1;\n",
    "                st.n = (st.n || 0) + 1;\n"
    "                // T-SUBSTRATE-01 (Ε1): τα 5 τελευταία δείγματα πλατό, για τη διασπορά.\n"
    "                if (_SAG_SUBSTRATE_ACTIVE) st.fs = (Array.isArray(st.fs) ? st.fs : []).concat([_scR2(cur)]).slice(-5);\n",
    "Κ6 δείγματα πλατό")
sub("              st.e = _wet ? 1 : 0;\n",
    "              // T-SUBSTRATE-01: ημερήσιο εύρος υγρασίας (max−min 24ώρου) — σχετικό μέγεθος,\n"
    "              // αξιόπιστο και χωρίς βαθμονόμηση. Παράθυρο 24 ω, βήμα 1 ημέρα.\n"
    "              if (_SAG_SUBSTRATE_ACTIVE && rng) {\n"
    "                const _rd = _scR2(rng.mx - rng.mn);\n"
    "                st.r = _scR2(Number.isFinite(st.r) ? 0.75 * st.r + 0.25 * _rd : _rd);\n"
    "                st.rd = _rd;\n"
    "              }\n"
    "              st.e = _wet ? 1 : 0;\n", "Κ6 ημερήσιο εύρος")
sub("            const _scD = _scUpd(_scPrev.d, _scNum(_SAG_SOIL_M_DEEP), _scRange(_SAG_SOIL_M_DEEP));\n",
    "            const _scD = _scUpd(_scPrev.d, _scNum(_SAG_SOIL_M_DEEP), _scRange(_SAG_SOIL_M_DEEP));\n"
    "            const _scEh = _SAG_SUBSTRATE_ACTIVE   // T-SUBSTRATE-01: ιστορικό αγωγιμότητας slab\n"
    "              ? _sagSubstrateEcHist(_scPrev.eh, measurements, _scDayNum) : null;\n",
    "Κ6 ιστορικό αγωγιμότητας")
sub("value: JSON.stringify({ s: _scS, d: _scD, u: _scDay }),",
    "value: JSON.stringify(_SAG_SUBSTRATE_ACTIVE\n"
    "                ? { s: _scS, d: _scD, eh: _scEh, u: _scDay } : { s: _scS, d: _scD, u: _scDay }),",
    "Κ6 κατάσταση")
sub("              metadata: { internal: true } });\n          }\n        } catch (_eSC) {",
    "              metadata: { internal: true } });\n"
    "            if (_SAG_SUBSTRATE_ACTIVE) _soilcalIndicators.push(_sagSubstrateEcStatus(_scEh));   // T-SUBSTRATE-01\n"
    "          }\n        } catch (_eSC) {", "Κ7 κάρτα αγωγιμότητας")

# Κ4 μάσκα στο αντίγραφο της καλλιέργειας
sub("injectPrevIndicators(measurementsForCrop, prevBundle?.shared, prevCropIndicators);\n",
    "injectPrevIndicators(measurementsForCrop, prevBundle?.shared, prevCropIndicators);\n"
    "          // T-SUBSTRATE-01: σε υπόστρωμα τα μοντέλα της καλλιέργειας ΔΕΝ βλέπουν υγρασία/αγωγιμότητα\n"
    "          // slab (μη βαθμονομημένες) — περνούν από τη δοκιμασμένη διαδρομή «χωρίς σόνδα εδάφους».\n"
    "          // ΜΟΝΟ στο αντίγραφο της καλλιέργειας: υγεία οργάνων και μάθηση βλέπουν τις ωμές τιμές.\n"
    "          if (_SAG_SUBSTRATE_ACTIVE) _sagSubstrateMask(measurementsForCrop.data);\n",
    "Κ4 μάσκα")

# Κ7 κείμενα IPSI και άρδευσης
sub("if (!Number.isFinite(M_soil)) { return { ipsi: undefined, ipsiError: \"",
    "if (!Number.isFinite(M_soil)) { return { ipsi: undefined, ipsiError: _SAG_SUBSTRATE_ACTIVE ? _SAG_SUB_TXT_IPSI : \"",
    "Κ7 κείμενο IPSI")
sub("  const _rzIrr = _sagRootZoneMoisture(measurements, parameters);\n",
    "  // T-SUBSTRATE-01: σε υπόστρωμα δεν βγαίνει δόση FAO-56 (το slab ποτίζεται με παλμούς βάσει\n"
    "  // απορροής). Το μήνυμα λέει τι μαθαίνει το σύστημα· τα υπόλοιπα κλειδιά άρδευσης σβήνουν ρητά.\n"
    "  if (_SAG_SUBSTRATE_ACTIVE) return emitIrrigationState([_sagSubstrateIrrigationMsg(measurements)]);\n"
    "  const _rzIrr = _sagRootZoneMoisture(measurements, parameters);\n",
    "Κ7 κάρτα άρδευσης")

# Κ5 όρια υγρασίας, αγωγιμότητα αγρού, απόκλιση βαθών
sub("const limIndicators = buildSoilMoistureLimitIndicators(lim);",
    "const limIndicators = _SAG_SUBSTRATE_ACTIVE ? [] : buildSoilMoistureLimitIndicators(lim);   // T-SUBSTRATE-01",
    "Κ5 όρια υγρασίας")
sub("            ..._sagEcIndicators(measurements, fieldConfig,\n              _sagEcFieldTol(fieldConfig)),\n"
    "            ..._sagDivergenceIndicators(measurements?.data),   // T-DIVERGENCE-01\n",
    "            ...(_SAG_SUBSTRATE_ACTIVE ? [] : _sagEcIndicators(measurements, fieldConfig,\n"
    "              _sagEcFieldTol(fieldConfig))),   // T-SUBSTRATE-01\n"
    "            ...(_SAG_SUBSTRATE_ACTIVE ? [] : _sagDivergenceIndicators(measurements?.data)),   // T-DIVERGENCE-01 · T-SUBSTRATE-01\n",
    "Κ5 αγωγιμότητα αγρού + απόκλιση βαθών")

# Κ8 υπόστρωμα σε ακάλυπτο αγρό
sub("_gapF.push('τύπος εδάφους');\n",
    "_gapF.push('τύπος εδάφους');\n"
    "              if (_SAG_SUBSTRATE_ACTIVE && !fieldConfig?.covered_cultivation) _gapF.push('υπόστρωμα σε ακάλυπτο αγρό');   // T-SUBSTRATE-01 (Ε5)\n",
    "Κ8 ακάλυπτος αγρός")

out = s.replace("\n", "\r\n").encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(C, "wb").write(out)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(out).hexdigest(), len(out))
