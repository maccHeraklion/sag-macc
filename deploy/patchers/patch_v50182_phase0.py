# -*- coding: utf-8 -*-
"""T-PHASE0-01 (v50.182, 6/11/2026, απόφαση Michalis «ναι προχώρα με τη Φάση 0»).
Πηγή: analysis/ΕΛΕΓΧΟΣ/ΕΠΑΛΗΘΕΥΣΗ_ΕΛΕΓΧΩΝ_ΑΣΘΕΝΕΙΩΝ_2026-11-06.md, ευρήματα Ν3, Ν4, Ν5, Ν9 και η διπλή μέτρηση.
Πέντε διορθώσεις σφαλμάτων, ΚΑΜΙΑ αλλαγή σε όρια παθογόνων (θερμοκρασία, υγρασία, ώρες):
 (Ν3) ώρα με ΒΡΟΧΗ δεν κόβεται πια από το όριο RH — η βροχή είναι μετρημένη διαβροχή, όπως ο αισθητήρας φύλλου.
      Το wetLeafInhibits (ωίδιο αμπελιού) ΔΕΝ αλλάζει: έχει ήδη δικό του κανόνα βροχής.
 (Ν4) η κρίση «σκιασμένος αισθητήρας» κοιτά ΚΑΙ τη χθεσινή ημέρα, ώστε να μην αλλάζει στα μεσάνυχτα στη μέση ενός επεισοδίου.
 (Ν5) αισθητήρας φύλλου πάνω από 3 °C ψυχρότερος από τον αέρα (μηδενικά, ή όργανο σε άλλο χώρο): η θερμοκρασία του δεν
      χρησιμοποιείται ούτε για δρόσο ούτε για «σκιασμένος», και η κάρτα τοποθέτησης το λέει.
      Αναδρομικά 14 ημέρες: Innodays 227 ώρες, ΚΥΔΩΝ 46, Β5 21· σωστά τοποθετημένοι 0–9.
 (Ν9) το κείμενο της κάρτας κρατά τις ώρες του επεισοδίου και αφού στεγνώσει το φύλλο.
 (Δ)  η κατάσταση μετρά τους μύκητες μία φορά (δεν πιάνει τους μετρητές _max_).
count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile, re
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-BOTRYTIS-HOSTS-01" in s and "T-PHASE0-01" not in s
N = "\r\n"
def J(*lines): return N.join(lines) + N
def sub(old, new, label):
    global s
    n = s.count(old)
    assert n == 1, (label, n)
    s = s.replace(old, new); print("OK", label)

s, n = re.subn(r"^const SAG_KERNEL_VERSION = 'v50\.181 · 2026-11-06';   // T-BOTRYTIS-HOSTS-01",
               "const SAG_KERNEL_VERSION = 'v50.182 · 2026-11-06';   // T-PHASE0-01 (σφάλματα: ώρα βροχής και όριο RH, κρίση σκιάς στα μεσάνυχτα, αισθητήρας φύλλου εκτός χώρου ή με μηδενικά, ώρες στο κείμενο, διπλή μέτρηση μυκήτων) · T-BOTRYTIS-HOSTS-01",
               s, count=1, flags=re.M)
assert n == 1, "έκδοση"; print("OK έκδοση")

# σταθερά
sub(J("const _SAG_LWS_RAIN_MM    = 0.2;  // mm/h που ήδη βρέχουν το φύλλωμα"),
    J("const _SAG_LWS_RAIN_MM    = 0.2;  // mm/h που ήδη βρέχουν το φύλλωμα",
      "// T-PHASE0-01 (v50.182): έλεγχος ευλογοφάνειας ΟΡΓΑΝΟΥ, όχι αγρονομικό όριο. Αισθητήρας φύλλου πάνω από 3 °C ψυχρότερος από",
      "// τον αέρα δεν είναι στον ίδιο χώρο με τον σταθμό ή έχει βλάβη (π.χ. στέλνει 0). Μετρημένο 23/10–6/11: σωστά τοποθετημένοι",
      "// 0–9 ώρες σε 14 ημέρες· Innodays 227, ΚΥΔΩΝ 46, Β5 21 (κοινόχρηστοι αισθητήρες σε άλλο χώρο).",
      "const _SAG_LWS_COLD_DT    = 3;    // °C"),
    "σταθερά _SAG_LWS_COLD_DT")

# Ν4 + Ν5: κρίση σκιάς και κάρτα τοποθέτησης
OLD = J(
  '  if (!_lwsStaleLeaf && Number.isFinite(leafTemp) && leafTemp > -20 && leafTemp < 80) {',
  '    const dTnow = leafTemp - Number(T_air);',
  '    const sameDayLws = _lwsSameDay;',
  '    const prevMaxLws = sameDayLws ? Number(getVal(measurements, "leaf_sensor_dt_max_today", -99)) : -99;',
  '    const dTmax = Math.max(Number.isFinite(prevMaxLws) ? prevMaxLws : -99, dTnow);',
  '    _lwsDtMax = dTmax;',
  '    indicators.push({ variable: "leaf_sensor_dt_max_today", value: parseFloat(dTmax.toFixed(1)) });',
  '    indicators.push(dTmax > 5',
  '      ? { variable: "leaf_sensor_placement", value: "Απαιτείται επανατοποθέτηση", metadata: { color: "red",')
NEW = J(
  '  // T-PHASE0-01 (v50.182) · Ν4: το μέγιστο της ΧΘΕΣΙΝΗΣ ημέρας κρατιέται δίπλα στο σημερινό. Πριν, η σημαία «είδε ήλιο»',
  '  // μηδενιζόταν στα μεσάνυχτα: ώς τις 23:59 μετρούσε η εκτίμηση, από τις 00:00 το «στεγνό» του αισθητήρα μηδένιζε τον',
  '  // μετρητή στη μέση του ίδιου επεισοδίου. Τώρα ο αισθητήρας θεωρείται επαληθευμένα σκιασμένος μόνο αν δεν είδε ήλιο',
  '  // ούτε χθες ούτε σήμερα. Η κάρτα τοποθέτησης συνεχίζει να κρίνει μόνο τη σημερινή ημέρα.',
  '  const _lwsYdayRaw = Number(getVal(measurements, _lwsSameDay ? "leaf_sensor_dt_max_yday" : "leaf_sensor_dt_max_today", NaN));',
  '  const _lwsDtYday = Number.isFinite(_lwsYdayRaw) ? _lwsYdayRaw : NaN;',
  '  if (Number.isFinite(_lwsDtYday)) indicators.push({ variable: "leaf_sensor_dt_max_yday", value: parseFloat(_lwsDtYday.toFixed(1)), metadata: { internal: true } });',
  '  let _lwsColdOff = false;   // Ν5: αισθητήρας πολύ ψυχρότερος από τον αέρα — εκτός χώρου ή βλάβη',
  '  if (!_lwsStaleLeaf && Number.isFinite(leafTemp) && leafTemp > -20 && leafTemp < 80) {',
  '    const dTnow = leafTemp - Number(T_air);',
  '    _lwsColdOff = dTnow < -_SAG_LWS_COLD_DT;',
  '    const sameDayLws = _lwsSameDay;',
  '    const prevMaxLws = sameDayLws ? Number(getVal(measurements, "leaf_sensor_dt_max_today", -99)) : -99;',
  '    const dTmax = Math.max(Number.isFinite(prevMaxLws) ? prevMaxLws : -99, dTnow);',
  '    _lwsDtMax = _lwsColdOff ? NaN : Math.max(dTmax, Number.isFinite(_lwsDtYday) ? _lwsDtYday : -99);',
  '    indicators.push({ variable: "leaf_sensor_dt_max_today", value: parseFloat(dTmax.toFixed(1)) });',
  '    indicators.push(_lwsColdOff',
  '      ? { variable: "leaf_sensor_placement", value: "Εκτός χώρου ή βλάβη", metadata: { color: "orange",',
  '          text: "Ο αισθητήρας φύλλου δείχνει θερμοκρασία " + Math.abs(dTnow).toFixed(1).replace(".", ",") + " °C χαμηλότερη από τον αέρα του αγρού. Ή δεν βρίσκεται στον ίδιο χώρο με τον σταθμό ή έχει βλάβη. Μέχρι να διορθωθεί, η δρόσος δεν υπολογίζεται από τη θερμοκρασία του." } }',
  '      : dTmax > 5',
  '      ? { variable: "leaf_sensor_placement", value: "Απαιτείται επανατοποθέτηση", metadata: { color: "red",')
sub(OLD, NEW, "Ν4+Ν5 κρίση σκιάς και κάρτα τοποθέτησης")

# Ν3: η βροχή είναι μετρημένη διαβροχή για το όριο RH
sub(J("  const _lwsMeasuredWet = leafIsWet && (_lws.source === 'sensor' || _lws.source === 'dew_leaf');   // T-LEAFWET-RH-01"),
    J("  const _lwsMeasuredWet = leafIsWet && (_lws.source === 'sensor' || _lws.source === 'dew_leaf');   // T-LEAFWET-RH-01",
      "  // T-PHASE0-01 (v50.182) · Ν3: η ΒΡΟΧΗ είναι η πιο βέβαιη διαβροχή, αλλά δεν μετρούσε ως «μετρημένο υγρό φύλλο»· ώρα με",
      "  // βροχή και RH κάτω από το όριο μηδένιζε τον μετρητή. Χωριστή σημαία, ώστε το wetLeafInhibits (ωίδιο αμπελιού) να μην",
      "  // αλλάξει — εκείνο έχει ήδη δικό του κανόνα βροχής (rainInhibitsInfection).",
      "  const _lwsRainWet = leafIsWet && _lws.source === 'rain';"),
    "Ν3 σημαία βροχής")
sub(J("      const humidityOk = RH >= _rhMin || (needsWet && _lwsMeasuredWet);"),
    J("      const humidityOk = RH >= _rhMin || (needsWet && (_lwsMeasuredWet || _lwsRainWet));   // T-PHASE0-01: και η βροχή"),
    "Ν3 όριο RH")

# Δ: διπλή μέτρηση μυκήτων
sub("  if (!_ihFrozen) { const _c = indicators.filter(x => x && typeof x.variable === 'string' && x.variable.indexOf(INFECTION_HOURS_COUNTER_PREFIX) === 0);",
    "  if (!_ihFrozen) { const _c = indicators.filter(x => x && typeof x.variable === 'string' && x.variable.indexOf(INFECTION_HOURS_COUNTER_PREFIX) === 0\r\n      && x.variable.indexOf(INFECTION_HOURS_COUNTER_PREFIX + 'max_') !== 0);   // T-PHASE0-01: οι μετρητές _max_ δεν είναι δεύτερος μύκητας",
    "Δ διπλή μέτρηση")

# Ν9: ώρες στο κείμενο και αφού στεγνώσει το φύλλο
sub(J("    const hrs = Math.max(_fGet('infection_hours_counter_' + key) || 0,",
      "                         _fGet('infection_hours_counter_max_' + key) || 0);"),
    J("    // T-PHASE0-01 (v50.182) · Ν9: στους ωριαίους κύκλους το μέγιστο του επεισοδίου ζει στις μετρήσεις, όχι στον πίνακα fir·",
      "    // χωρίς αυτό, μόλις στέγνωνε το φύλλο η κάρτα έγραφε «Ψεκάστε» χωρίς να λέει γιατί (ή «1ω» ενώ το επεισόδιο ήταν 31ω).",
      "    const hrs = Math.max(_fGet('infection_hours_counter_' + key) || 0,",
      "                         _fGet('infection_hours_counter_max_' + key) || 0,",
      "                         measurements ? (Number(getVal(measurements, 'infection_hours_counter_max_' + key, 0)) || 0) : 0);"),
    "Ν9 ώρες στο κείμενο")

assert s.count("\n") == s.count("\r\n")
out = s.encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.close(fd)
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8")
os.unlink(tmp)
assert r.returncode == 0, r.stderr[:600]
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
