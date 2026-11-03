# -*- coding: utf-8 -*-
"""T-DEPTH1-02 · πυρήνας v50.168 (3/11/2026, Michalis: «πώς όμως θα αντιστοιχίζεται ο σωστός αισθητήρας … γενικότερα
πώς γίνεται η σωστή αντιστοίχιση του ρηχού αισθητήρα και του βαθιού … με την αντίστοιχη δήλωση των EUI κάθε αισθητήρα»).

ΕΥΡΗΜΑ (probe audit_soil_depth_map_2026-11-03, ΕΠΙΒΕΒΑΙΩΜΕΝΟ): σε συσκευή ΔΥΟ θυρών (Dragino SE0X/LSE02) ο ρόλος ρηχό/βαθύ
ορίζεται ΑΠΟ ΤΗ ΘΥΡΑ (κανάλι 1 = ρηχό, 2 = βαθύ), όχι από το EUI. Με «Ένα βάθος» ο v50.167 κρατούσε ΠΑΝΤΑ τη θύρα 1·
αν η σόνδα που μετρά είναι στη θύρα 2 (ή η 1 είναι εκτός εδάφους), ο αγρός θα διάβαζε τη λάθος σόνδα. Ο Κοκοφοίνικας
έχει ήδη «Ένα βάθος» και ο SE0X του στέλνει ΚΑΙ τις δύο θύρες (17,5 / 22,05 %).

Νέο κλειδί `soil_depth_port` (1 | 2· ΑΠΟΝ = 1 = v50.167). Μόνο όταν soil_depth_count = 1.
  Θ1 μάσκα ανά συσκευή: θύρα 2 → συσκευή που δίνει κανάλι 2 χάνει το κανάλι 1 (και γυμνά ονόματα)· θύρα 1 όπως πριν.
  Θ2 φρουρός λάθους θύρας: αν η κρατημένη θύρα δεν δίνει έγκυρη υγρασία ενώ η κομμένη δίνει → προειδοποίηση (πορτοκαλί)
     στο soil_depth_basis με το όνομα της συσκευής. Η δήλωση ΔΕΝ αντιστρέφεται αυτόματα.
  Θ3 βλάβες / στατιστικά / ημερήσια διάγνωση / μέσοι 24ώρου: ελέγχεται η ΚΡΑΤΗΜΕΝΗ θύρα, όχι η κομμένη.
  Θ4 ριζόστρωμα: ένα βάθος από την κρατημένη θύρα, χωρίς «(βαθύς)».
  Θ5 βάθος σε cm με ένα βάθος: το πεδίο «Βάθος αισθητήρα» (ρηχό)· αν είναι κενό, το βάθος του βαθιού (28 αγροί LSE01 έχουν
     δηλώσει το βάθος ΜΟΝΟ στο «βαθύ» — με ένα βάθος έδειχναν την προεπιλογή 20 cm).
  Θ6 βαθμονόμηση: μαθαίνει/χρησιμοποιεί την κρατημένη θύρα· η άλλη δεν κρατιέται.
  Θ7 αγωγιμότητα: κανάλι της κρατημένης θύρας με ετικέτα «έδαφος»· purge των κλειδιών της κομμένης.
Χωρίς δήλωση «Ένα βάθος»: ΤΑΥΤΟΣΗΜΑ με v50.167/v50.166. Καμία αγρονομική σταθερά δεν αλλάζει.
count==1 (εκτός όπου δηλώνεται), CRLF, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-01" in s and "T-DEPTH1-02" not in s

SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.167 · 2026-11-03';   // T-DEPTH1-01 (ένα βάθος αισθητήρα με δήλωση) ·",
   "const SAG_KERNEL_VERSION = 'v50.168 · 2026-11-03';   // T-DEPTH1-02 (θύρα σόνδας με ένα βάθος) · T-DEPTH1-01 (ένα βάθος αισθητήρα με δήλωση) ·",
   "Ε έκδοση"),
  # ── βοηθοί ──
  ("let _SAG_DEPTH1_ACTIVE = false;\n",
   "let _SAG_DEPTH1_ACTIVE = false;\n"
   "// T-DEPTH1-02 (v50.168): σε συσκευή δύο θυρών ο ρόλος ορίζεται από τη ΘΥΡΑ (1 = ρηχό, 2 = βαθύ), όχι από το EUI.\n"
   "// Με ένα βάθος η φόρμα δηλώνει ποια θύρα είναι στο έδαφος (soil_depth_port 1 | 2· απόν = 1).\n"
   "let _SAG_DEPTH1_PORT = 1;\n"
   "let _SAG_D1_HINTS = [];   // συσκευές όπου η δηλωμένη θύρα δεν μετρά ενώ η άλλη μετρά\n"
   "const _SAG_D1_M2_RE = /^(soil_moisture|soil_humidity|water_soil)2(_avg)?$/;\n"
   "const _SAG_D1_CH1ALL_RE = /^(soil_moisture|soil_humidity|water_soil|soil_temperature|conduct_soil)1(_avg|_max|_min|_sum)?$|^(soil_moisture|soil_humidity|water_soil|temp_soil|conduct_soil)(_avg|_max|_min|_sum)?$/;\n"
   "function _sagDepth1PortOf(cfg) { return Number(cfg && cfg.soil_depth_port) === 2 ? 2 : 1; }\n",
   "Θ βοηθοί"),
  ("function _sagDepth1Mask(deviceData) {\n"
   "  if (!_SAG_DEPTH1_ACTIVE || !deviceData || typeof deviceData !== 'object') return 0;\n"
   "  const ks = Object.keys(deviceData);\n"
   "  if (!ks.some(k => _SAG_D1_CH1_RE.test(k))) return 0;\n"
   "  let n = 0;\n"
   "  for (const k of ks) if (_SAG_D1_CH2_RE.test(k)) { delete deviceData[k]; n++; }\n"
   "  return n;\n"
   "}\n",
   "function _sagDepth1Mask(deviceData, deviceName) {\n"
   "  if (!_SAG_DEPTH1_ACTIVE || !deviceData || typeof deviceData !== 'object') return 0;\n"
   "  const ks = Object.keys(deviceData);\n"
   "  const p2 = _SAG_DEPTH1_PORT === 2;   // T-DEPTH1-02\n"
   "  const keepRe = p2 ? _SAG_D1_M2_RE : _SAG_D1_CH1_RE, dropRe = p2 ? _SAG_D1_CH1ALL_RE : _SAG_D1_CH2_RE;\n"
   "  if (!ks.some(k => keepRe.test(k))) return 0;\n"
   "  // T-DEPTH1-02 φρουρός: η δηλωμένη θύρα χωρίς έγκυρη υγρασία ενώ η άλλη έχει → προειδοποίηση (όχι αυτόματη αλλαγή).\n"
   "  const _v = (k) => { const a = deviceData[k]; const x = Array.isArray(a) && a[0] && typeof a[0] === 'object' ? Number(a[0].value) : NaN; return x; };\n"
   "  const _ok = (re) => ks.some(k => re.test(k) && !/_avg$/.test(k) && Number.isFinite(_v(k)) && _v(k) > 0);\n"
   "  if (!_ok(keepRe) && _ok(p2 ? _SAG_D1_CH1_RE : _SAG_D1_M2_RE)) {\n"
   "    const nm = String(deviceName || '—');\n"
   "    if (_SAG_D1_HINTS.indexOf(nm) < 0) _SAG_D1_HINTS.push(nm);\n"
   "  }\n"
   "  let n = 0;\n"
   "  for (const k of ks) if (dropRe.test(k)) { delete deviceData[k]; n++; }\n"
   "  return n;\n"
   "}\n",
   "Θ1 μάσκα ανά θύρα"),
  ("function _sagD1Masked(measurements) {\n"
   "  return _SAG_DEPTH1_ACTIVE && !!_sagNumFrom(measurements, _SAG_SOIL_M_SHALLOW);\n",
   "function _sagD1Masked(measurements) {\n"
   "  return _SAG_DEPTH1_ACTIVE && !!_sagNumFrom(measurements, _SAG_DEPTH1_PORT === 2 ? _SAG_SOIL_M_DEEP : _SAG_SOIL_M_SHALLOW);\n",
   "Θ1β κόπηκε η άλλη θύρα;"),
  ("  return e.filter(ch => !ch.a.every(k => /2(_avg)?$/.test(k)));\n",
   "  const re = _SAG_DEPTH1_PORT === 2 ? /1(_avg)?$/ : /2(_avg)?$/;   // T-DEPTH1-02: αναμένεται η ΚΡΑΤΗΜΕΝΗ θύρα\n"
   "  return e.filter(ch => !ch.a.every(k => re.test(k)));\n",
   "Θ3α αναμενόμενα"),
  ("  for (const k of Object.keys(st)) if (!/2(_avg)?$/.test(k)) o[k] = st[k];\n",
   "  const re = _SAG_DEPTH1_PORT === 2 ? /1(_avg)?$/ : /2(_avg)?$/;   // T-DEPTH1-02\n"
   "  for (const k of Object.keys(st)) if (!re.test(k)) o[k] = st[k];\n",
   "Θ3β στατιστικά"),
  ("  return [Object.assign({}, _SAG_EC_CHANNELS[0], { el: 'έδαφος' })];\n",
   "  return [Object.assign({}, _SAG_EC_CHANNELS[_SAG_DEPTH1_PORT === 2 ? 1 : 0], { el: 'έδαφος' })];   // T-DEPTH1-02\n",
   "Θ7α κανάλι EC"),
  # ── κλήση μάσκας ──
  ("    _sagDepth1Mask(deviceData);\n    const r = _sagPlausibilityGate(",
   "    _sagDepth1Mask(deviceData, deviceName);\n    const r = _sagPlausibilityGate(", "Θ1γ κλήση με όνομα"),
  # ── ημερήσια διάγνωση / μέσοι 24ώρου ──
  ("      ? _SAG_DIAG_VARS[typeName].filter(v => !/2$/.test(v)) : _SAG_DIAG_VARS[typeName]) : null;\n",
   "      ? _SAG_DIAG_VARS[typeName].filter(v => !(_SAG_DEPTH1_PORT === 2 ? /1$/ : /2$/).test(v)) : _SAG_DIAG_VARS[typeName]) : null;   // T-DEPTH1-02\n",
   "Θ3γ διάγνωση"),
  ("      const _SOIL_AVG_CH = _SAG_DEPTH1_ACTIVE ? ['soil_moisture1', 'soil_temperature1']   // T-DEPTH1-01\n",
   "      const _SOIL_AVG_CH = _SAG_DEPTH1_ACTIVE ? (_SAG_DEPTH1_PORT === 2 ? ['soil_moisture2', 'soil_temperature2'] : ['soil_moisture1', 'soil_temperature1'])   // T-DEPTH1-01/02\n",
   "Θ3δ μέσοι 24ώρου"),
  # ── βάθος σε cm ──
  ("  if (_sagDepth1Of(parameters) && which === 2) return _sagSensorDepthCm(parameters, 1);\n",
   "  // T-DEPTH1-02: με ένα βάθος ισχύει το πεδίο «Βάθος αισθητήρα» (ρηχό)· αν είναι κενό, το βάθος που γράφτηκε στο «βαθύ».\n"
   "  if (_sagDepth1Of(parameters)) {\n"
   "    for (const k of ['sensorShallow_depth_cm', 'soil_sensor_depth_1_cm', 'sensor_depth_1_cm', 'soil_depth_1_cm',\n"
   "      'sensor_deep_depth_cm', 'soil_sensor_depth_2_cm', 'sensor_depth_2_cm', 'soil_depth_2_cm']) {\n"
   "      const n = Number(parameters?.[k]);\n"
   "      if (Number.isFinite(n) && n > 0 && n <= 300) return n;\n"
   "    }\n"
   "    return 20;\n"
   "  }\n",
   "Θ5 βάθος cm"),
  # ── ριζόστρωμα ──
  ("  const s = _sagNumFrom(measurements, _SAG_SOIL_M_SHALLOW);\n"
   "  // T-DEPTH1-01: με δηλωμένο ένα βάθος, το κανάλι 2 δεν μετέχει όταν υπάρχει ρηχό (δεύτερη άμυνα μετά τη μάσκα).\n"
   "  const d = (_sagDepth1Of(parameters) && s) ? null : _sagNumFrom(measurements, _SAG_SOIL_M_DEEP);\n",
   "  // T-DEPTH1-01/02: με δηλωμένο ένα βάθος μετέχει ΜΟΝΟ η δηλωμένη θύρα όταν μετρά (δεύτερη άμυνα μετά τη μάσκα).\n"
   "  const _d1p = _sagDepth1Of(parameters) ? _sagDepth1PortOf(parameters) : 0;\n"
   "  const _s0 = _sagNumFrom(measurements, _SAG_SOIL_M_SHALLOW), _dd0 = _sagNumFrom(measurements, _SAG_SOIL_M_DEEP);\n"
   "  const s = (_d1p === 2 && _dd0) ? null : _s0;\n"
   "  const d = (_d1p === 1 && _s0) ? null : _dd0;\n",
   "Θ4α ριζόστρωμα"),
  ("    : (s ? ('Ένα βάθος: ' + d1 + ' cm') : ('Ένα βάθος: ' + d2 + ' cm (βαθύς)'));\n",
   "    : (s ? ('Ένα βάθος: ' + d1 + ' cm') : ('Ένα βάθος: ' + d2 + ' cm' + (_d1p ? '' : ' (βαθύς)')));   // T-DEPTH1-02\n",
   "Θ4β κείμενο βάσης"),
  # ── ενδείξεις ──
  ("      metadata: { color: ((rz.m1 !== null && rz.m2 !== null) || _SAG_DEPTH1_ACTIVE) ? 'green' : 'blue',\n",
   "      metadata: { color: (_SAG_DEPTH1_ACTIVE && _SAG_D1_HINTS.length) ? 'orange'   // T-DEPTH1-02\n"
   "        : (((rz.m1 !== null && rz.m2 !== null) || _SAG_DEPTH1_ACTIVE) ? 'green' : 'blue'),\n",
   "Θ2α χρώμα"),
  ("            ? 'Ο αγρός έχει δηλωμένο ένα βάθος αισθητήρα εδάφους· η δόση βγαίνει από αυτό.'\n",
   "            ? ('Ο αγρός έχει δηλωμένο ένα βάθος αισθητήρα εδάφους' + (_SAG_DEPTH1_PORT === 2 ? ' (θύρα 2 του αισθητήρα)' : '')\n"
   "              + '· η δόση βγαίνει από αυτό.' + (_SAG_D1_HINTS.length   // T-DEPTH1-02\n"
   "              ? ' ΠΡΟΣΟΧΗ: στο «' + _SAG_D1_HINTS.join('», «') + '» η δηλωμένη θύρα δεν δίνει μέτρηση ενώ η άλλη δίνει — '\n"
   "                + 'ελέγξτε στη φόρμα ποια θύρα είναι στο έδαφος.' : ''))\n",
   "Θ2β κείμενο"),
  # ── βαθμονόμηση ──
  ("      const _sOK = _calOk(_cs.s), _dOK = _calOk(_cs.d)\n"
   "        && !(_sagDepth1Of(parameters) && _cs.s && (Number(_cs.s.n) || 0) > 0);\n",
   "      // T-DEPTH1-02: με θύρα 2 αγνοείται η παλιά ρηχή βαθμονόμηση όσο μαθαίνει η θύρα 2.\n"
   "      const _p2c = _sagDepth1Of(parameters) && _sagDepth1PortOf(parameters) === 2;\n"
   "      const _sOK = _calOk(_cs.s) && !(_p2c && _cs.d && (Number(_cs.d.n) || 0) > 0), _dOK = _calOk(_cs.d)\n"
   "        && !(_sagDepth1Of(parameters) && !_p2c && _cs.s && (Number(_cs.s.n) || 0) > 0);\n",
   "Θ6α όρια"),
  ("            const _scS = _scUpd(_scPrev.s, _scNum(_SAG_SOIL_M_SHALLOW), _scRange(_SAG_SOIL_M_SHALLOW));\n",
   "            // T-DEPTH1-02: με θύρα 2 μαθαίνει μόνο το d· το s δεν κρατιέται.\n"
   "            const _scS = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT === 2 && Number.isFinite(_scNum(_SAG_SOIL_M_DEEP))) ? {}\n"
   "              : _scUpd(_scPrev.s, _scNum(_SAG_SOIL_M_SHALLOW), _scRange(_SAG_SOIL_M_SHALLOW));\n",
   "Θ6β βαθμονόμηση s"),
  ("            const _scD = (_SAG_DEPTH1_ACTIVE && Number.isFinite(_scNum(_SAG_SOIL_M_SHALLOW))) ? {}\n",
   "            const _scD = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 2 && Number.isFinite(_scNum(_SAG_SOIL_M_SHALLOW))) ? {}\n",
   "Θ6γ βαθμονόμηση d"),
  # ── purge ──
  ("          if (_sagD1Masked(measurements)) _purgeShared.push('soil_ece2', 'soil_ec_pore2', 'soil_ec_raw2', 'soil_ec_ref2');\n",
   "          if (_sagD1Masked(measurements)) _purgeShared.push(...(_SAG_DEPTH1_PORT === 2   // T-DEPTH1-02\n"
   "            ? ['soil_ece1', 'soil_ec_pore1', 'soil_ec_raw1', 'soil_ec_ref1'] : ['soil_ece2', 'soil_ec_pore2', 'soil_ec_raw2', 'soil_ec_ref2']));\n",
   "Θ7β purge"),
  # ── σημαίες ανά αγρό ──
  ("      _SAG_DEPTH1_ACTIVE = false;     // T-DEPTH1-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n",
   "      _SAG_DEPTH1_ACTIVE = false;     // T-DEPTH1-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n"
   "      _SAG_DEPTH1_PORT = 1; _SAG_D1_HINTS = [];   // T-DEPTH1-02\n",
   "Σ μηδενισμός"),
  ("        _SAG_DEPTH1_ACTIVE = _sagDepth1Of(fieldConfig);          // T-DEPTH1-01\n",
   "        _SAG_DEPTH1_ACTIVE = _sagDepth1Of(fieldConfig);          // T-DEPTH1-01\n"
   "        _SAG_DEPTH1_PORT = _sagDepth1PortOf(fieldConfig);        // T-DEPTH1-02\n",
   "Σ σημαία"),
  ("    for (const k of ['soil_depth_count', 'sensorShallow_depth_cm', 'sensor_deep_depth_cm',",
   "    for (const k of ['soil_depth_count', 'soil_depth_port', 'sensorShallow_depth_cm', 'sensor_deep_depth_cm',",
   "Δ διάγνωση φόρμας"),
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
