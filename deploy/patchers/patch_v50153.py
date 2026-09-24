# -*- coding: utf-8 -*-
"""Πυρήνας v50.153 · T-AVG-COVERAGE-01 — §8.1 της απογραφής 24/9 (εντολή Μιχάλη «προχώρα με το 8.1»).
Οι 24ωροι μέσοι (avg/max/min εδάφους και αέρα) μπαίνουν στους υπολογισμούς ΜΟΝΟ όταν το 24ωρο
της διάγνωσης (`diag_stats`) είχε κάλυψη: n ≥ 6 μετρήσεις ΚΑΙ ≥ 6 ώρες. Αλλιώς ο μέσος
ΑΓΝΟΕΙΤΑΙ (οι δείκτες πέφτουν στην τελευταία στιγμιαία τιμή — υπάρχουσα διαδρομή) και το
δηλώνει ο νέος δείκτης `avg_window_status`. Χωρίς `diag_stats` (πρώτη εγκατάσταση): δεν κρίνει.
Κατώφλια ΠΥΛΗΣ (όχι αγρονομικές σταθερές): _SAG_AVG_MIN_N = 6, _SAG_AVG_MIN_SPAN_H = 6.
CRLF χωρίς BOM, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read()
assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n")
print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.152 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.153 · 2026-09-24';", "έκδοση v50.153")

# ── βοηθοί ──
sub("function _sagAgeIndicators(data) {\n",
    "// ── T-AVG-COVERAGE-01 (v50.153 · 24/9/2026, §8.1 απογραφής) · ΟΙ 24ΩΡΟΙ ΜΕΣΟΙ ΔΗΛΩΝΟΥΝ ΚΑΛΥΨΗ ──\n"
    "// Το TagoIO `query:'avg'` γυρίζει έναν αριθμό χωρίς πλήθος: 3 μετρήσεις και 70 έδιναν\n"
    "// ίδιας μορφής «μέσο 24ώρου» και τροφοδοτούσαν IPSI/ET0/BPI σιωπηλά. Η κάλυψη υπάρχει\n"
    "// ήδη στο `diag_stats` (n, spanH ανά μεταβλητή, μία φορά την ημέρα, έως 26 ω πίσω).\n"
    "// ΠΥΛΗ: ο μέσος επιτρέπεται μόνο με n ≥ 6 ΚΑΙ κάλυψη ≥ 6 ω. Άγνωστη κάλυψη -> δεν κρίνουμε.\n"
    "// Όταν ο μέσος αγνοείται, οι καταναλωτές πέφτουν στην τελευταία στιγμιαία τιμή (υπάρχουσα\n"
    "// διαδρομή: _sagSoilMoistRead, T-ET0-WHYNOT-01) και ο δείκτης `avg_window_status` το λέει.\n"
    "const _SAG_AVG_MIN_N = 6;\n"
    "const _SAG_AVG_MIN_SPAN_H = 6;\n"
    "function _sagAvgCov(stat) {\n"
    "  if (!stat || typeof stat !== 'object') return null;\n"
    "  const n = Number(stat.n), h = Number(stat.spanH);\n"
    "  if (!Number.isFinite(n) || !Number.isFinite(h)) return null;\n"
    "  return { n: n, spanH: Math.round(h * 10) / 10, ok: (n >= _SAG_AVG_MIN_N && h >= _SAG_AVG_MIN_SPAN_H) };\n"
    "}\n"
    "// true = ο 24ωρος μέσος του μεγέθους επιτρέπεται· κάθε κρίση καταγράφεται για τον δείκτη.\n"
    "function _sagAvgGate(data, inv, devName, varName) {\n"
    "  const cov = _sagAvgCov(inv && inv.stats ? inv.stats[varName] : null);\n"
    "  if (data && typeof data === 'object') {\n"
    "    data._sagAvgCov = Array.isArray(data._sagAvgCov) ? data._sagAvgCov : [];\n"
    "    data._sagAvgCov.push({ dev: String(devName || '—'), v: String(varName || '—'),\n"
    "      n: cov ? cov.n : null, h: cov ? cov.spanH : null, ok: cov ? cov.ok : null });\n"
    "  }\n"
    "  return cov ? cov.ok : true;\n"
    "}\n"
    "function _sagAvgCovIndicators(data) {\n"
    "  const rows = (data && Array.isArray(data._sagAvgCov)) ? data._sagAvgCov : [];\n"
    "  const seen = {}, known = [];\n"
    "  for (const r of rows) {\n"
    "    if (!r || r.ok === null || r.ok === undefined) continue;\n"
    "    const k = r.dev + '|' + r.v;\n"
    "    if (seen[k]) continue;   // ο σταθμός περνά δύο φορές από τη συγχώνευση (T-REMERGE-01)\n"
    "    seen[k] = 1; known.push(r);\n"
    "  }\n"
    "  if (!known.length) return [];\n"
    "  const bad = known.filter(r => !r.ok);\n"
    "  if (!bad.length) {\n"
    "    return [{ variable: 'avg_window_status', value: 'Πλήρη 24ωρα · ' + known.length + ' μεγέθη',\n"
    "      metadata: { color: 'green' } }];\n"
    "  }\n"
    "  return [{ variable: 'avg_window_status',\n"
    "    value: 'Ελλιπή 24ωρα: ' + bad.length + ' από ' + known.length + ' μεγέθη',\n"
    "    metadata: { color: 'orange',\n"
    "      text: bad.map(r => r.v + ' (' + r.dev + '): ' + r.n + ' μετρήσεις σε ' + r.h + ' ώρες').join(' · ')\n"
    "        + ' — όριο ' + _SAG_AVG_MIN_N + ' μετρήσεις σε ' + _SAG_AVG_MIN_SPAN_H + ' ώρες. Ο μέσος 24ώρου '\n"
    "        + 'αυτών των μεγεθών ΑΓΝΟΗΘΗΚΕ· οι δείκτες χρησιμοποιούν την τελευταία μέτρηση. Η κάλυψη '\n"
    "        + 'μετριέται στο τελευταίο 24ωρο της διάγνωσης οργάνων (έως 26 ώρες πίσω).' } }];\n"
    "}\n"
    "// ── End T-AVG-COVERAGE-01 ────────────────────────────────────────────────\n\n"
    "function _sagAgeIndicators(data) {\n",
    "T-AVG-COVERAGE-01 βοηθοί")

# ── πύλη em300/em320 (κόμη) ──
sub("      if (avgMap.temperature && Number.isFinite(Number(avgMap.temperature.value))) {\n"
    "        deviceData.canopy_temperature_avg = Number(avgMap.temperature.value);\n"
    "      }\n"
    "      if (maxMap.temperature && Number.isFinite(Number(maxMap.temperature.value))) {\n"
    "        deviceData.canopy_temperature_max = Number(maxMap.temperature.value);\n"
    "      }\n"
    "      if (minMap.temperature && Number.isFinite(Number(minMap.temperature.value))) {\n"
    "        deviceData.canopy_temperature_min = Number(minMap.temperature.value);\n"
    "      }\n"
    "\n"
    "      // T-ET0-DAILY-INPUTS-01: 24ωρος μέσος σχετικής υγρασίας από το em300/em320.\n"
    "      if (rhAvgMap.humidity && Number.isFinite(Number(rhAvgMap.humidity.value))) {\n"
    "        deviceData.humidity_avg = Number(rhAvgMap.humidity.value);\n"
    "      }\n",
    "      // T-AVG-COVERAGE-01: μέσος/μέγιστο/ελάχιστο ΜΟΝΟ με κάλυψη 24ώρου.\n"
    "      const _okCanT = _sagAvgGate(data, _inv, info?.name || value, 'temperature');\n"
    "      const _okCanRH = _sagAvgGate(data, _inv, info?.name || value, 'humidity');\n"
    "      if (_okCanT && avgMap.temperature && Number.isFinite(Number(avgMap.temperature.value))) {\n"
    "        deviceData.canopy_temperature_avg = Number(avgMap.temperature.value);\n"
    "      }\n"
    "      if (_okCanT && maxMap.temperature && Number.isFinite(Number(maxMap.temperature.value))) {\n"
    "        deviceData.canopy_temperature_max = Number(maxMap.temperature.value);\n"
    "      }\n"
    "      if (_okCanT && minMap.temperature && Number.isFinite(Number(minMap.temperature.value))) {\n"
    "        deviceData.canopy_temperature_min = Number(minMap.temperature.value);\n"
    "      }\n"
    "\n"
    "      // T-ET0-DAILY-INPUTS-01: 24ωρος μέσος σχετικής υγρασίας από το em300/em320.\n"
    "      if (_okCanRH && rhAvgMap.humidity && Number.isFinite(Number(rhAvgMap.humidity.value))) {\n"
    "        deviceData.humidity_avg = Number(rhAvgMap.humidity.value);\n"
    "      }\n",
    "T-AVG-COVERAGE-01 πύλη κόμης (em300/em320)")

# ── πύλη s2120 (σταθμός) ──
sub("        if (\n"
    "          (deviceData.air_temperature_avg === null ||\n"
    "            deviceData.air_temperature_avg === undefined) &&\n"
    "          Number.isFinite(_sagNum(avgAirTempArr?.[0]?.value))\n"
    "        ) {\n",
    "        // T-AVG-COVERAGE-01: ο 24ωρος μέσος/μέγιστο/ελάχιστο μπαίνει ΜΟΝΟ αν το 24ωρο είχε κάλυψη.\n"
    "        const _okAirT = _sagAvgGate(data, _inv, info?.name || value, 'air_temperature');\n"
    "        const _okAirRH = _sagAvgGate(data, _inv, info?.name || value, 'air_humidity');\n"
    "        if (\n"
    "          _okAirT &&\n"
    "          (deviceData.air_temperature_avg === null ||\n"
    "            deviceData.air_temperature_avg === undefined) &&\n"
    "          Number.isFinite(_sagNum(avgAirTempArr?.[0]?.value))\n"
    "        ) {\n",
    "T-AVG-COVERAGE-01 πύλη σταθμού avg")
sub("        if (\n"
    "          (deviceData.air_temperature_max === null ||\n",
    "        if (\n"
    "          _okAirT &&\n"
    "          (deviceData.air_temperature_max === null ||\n",
    "T-AVG-COVERAGE-01 πύλη σταθμού max")
sub("        if (\n"
    "          (deviceData.air_temperature_min === null ||\n",
    "        if (\n"
    "          _okAirT &&\n"
    "          (deviceData.air_temperature_min === null ||\n",
    "T-AVG-COVERAGE-01 πύλη σταθμού min")
sub("        if (Number.isFinite(Number(avgRhArr?.[0]?.value))) {\n"
    "          deviceData.air_humidity_avg = Number(avgRhArr[0].value);\n",
    "        if (_okAirRH && Number.isFinite(Number(avgRhArr?.[0]?.value))) {\n"
    "          deviceData.air_humidity_avg = Number(avgRhArr[0].value);\n",
    "T-AVG-COVERAGE-01 πύλη σταθμού RH")

# ── πύλη εδάφους se0x/lse02 ──
sub("      for (let _i = 0; _i < _SOIL_AVG_CH.length; _i++) {\n"
    "        const _arr = _soilAvgRes[_i];\n"
    "        if (Array.isArray(_arr) && _arr.length > 0) {\n",
    "      for (let _i = 0; _i < _SOIL_AVG_CH.length; _i++) {\n"
    "        const _arr = _soilAvgRes[_i];\n"
    "        // T-AVG-COVERAGE-01: χωρίς κάλυψη 24ώρου ο μέσος δεν γράφεται — το IPSI παίρνει τη στιγμιαία.\n"
    "        if (!_sagAvgGate(data, _inv, info?.name || value, _SOIL_AVG_CH[_i])) continue;\n"
    "        if (Array.isArray(_arr) && _arr.length > 0) {\n",
    "T-AVG-COVERAGE-01 πύλη εδάφους se0x/lse02")

# ── πύλη εδάφους lse01 ──
sub("      if (Array.isArray(soil_moisture_avg) && soil_moisture_avg.length > 0) {\n"
    "        deviceData.soil_moisture_avg = soil_moisture_avg;\n",
    "      if (Array.isArray(soil_moisture_avg) && soil_moisture_avg.length > 0\n"
    "          && _sagAvgGate(data, _inv, info?.name || value, 'soil_moisture')) {   // T-AVG-COVERAGE-01\n"
    "        deviceData.soil_moisture_avg = soil_moisture_avg;\n",
    "T-AVG-COVERAGE-01 πύλη lse01 υγρασία")
sub("      if (Array.isArray(temp_soil_avg) && temp_soil_avg.length > 0) {\n"
    "        deviceData.temp_soil_avg = temp_soil_avg;\n",
    "      if (Array.isArray(temp_soil_avg) && temp_soil_avg.length > 0\n"
    "          && _sagAvgGate(data, _inv, info?.name || value, 'temp_soil')) {   // T-AVG-COVERAGE-01\n"
    "        deviceData.temp_soil_avg = temp_soil_avg;\n",
    "T-AVG-COVERAGE-01 πύλη lse01 θερμοκρασία")

# ── δείκτης ──
sub("            ..._sagAgeIndicators(measurements?.data),\n",
    "            ..._sagAgeIndicators(measurements?.data),\n"
    "            ..._sagAvgCovIndicators(measurements?.data),   // T-AVG-COVERAGE-01\n",
    "T-AVG-COVERAGE-01 δείκτης avg_window_status")

out = s.replace("\n", "\r\n").encode("utf-8")
assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode:
    print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ — τίποτα δεν γράφτηκε")
io.open(P, "wb").write(out)
chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
