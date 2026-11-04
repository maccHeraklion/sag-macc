# -*- coding: utf-8 -*-
"""T-LITVALUES-01 (v50.179, 4/11/2026, απόφαση Michalis «ναι στις 7 γραμμές του πίνακα»).
Πηγές: analysis/ΕΛΕΓΧΟΣ/ΤΙΜΕΣ_ΒΙΒΛΙΟΓΡΑΦΙΑΣ_ΠΑΘΟΓΟΝΩΝ_2026-11-04.md + δελτία αμπελιού ΠΚΠΦΠ&ΦΕ Ηρακλείου 2024–2026.
Γραμμές 1, 5, 6, 7 του πίνακα (μόνο Infection_Triangle· οι 2, 3, 4 = νέα μοντέλα, επόμενη έκδοση):
 (Λ1) αλτερνάρια σολανωδών T {24,30}→{13,25,32}, RH 85→90, 8→6 ώρες·
 (Λ5) ωίδιο αμπελιού max 35→32 + μετρημένο νερό στο φύλλο μηδενίζει (wetLeafInhibits)· ωίδιο σολανωδών max 32→30·
 (Λ6) φώμοψη T {5,20,30}→{8,20,35}, 7→12 ώρες (ΠΚΠΦΠ 14/3/2024), παράθυρο 1/3–10/5·
 (Λ7) ανθράκνωση εσπεριδοειδών 12→8 ώρες, παράθυρο 15/3–31/5.
Μηχανισμός παραθύρου: εκτός → μετρητής 0, κάρτα «Εκτός περιόδου», εκτός πρόγνωσης, ανοιχτή υπόθεση κλείνει (auto).
count==1 ανά αντικατάσταση, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile, re
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-NONFOLIAR-01" in s and "T-LITVALUES-01" not in s
N = "\r\n"

# έκδοση: ολόκληρη η γραμμή 8 με regex (count 1)
s, n = re.subn(r"^const SAG_KERNEL_VERSION = 'v50\.178 · 2026-11-04';   // T-NONFOLIAR-01",
               "const SAG_KERNEL_VERSION = 'v50.179 · 2026-11-04';   // T-LITVALUES-01 (τιμές βιβλιογραφίας: αλτερνάρια, ωίδια, φώμοψη, ανθράκνωση + παράθυρα ΠΚΠΦΠ Ηρακλείου) · T-NONFOLIAR-01",
               s, count=1, flags=re.M)
assert n == 1, "έκδοση"
print("OK έκδοση")

WINDOWS = (
  "// T-LITVALUES-01 (v50.179, 4/11/2026): παράθυρα μόλυνσης εποχικών ασθενειών από το ημερολόγιο (ο πυρήνας δεν έχει φαινολογία)." + N
  + "// Φώμοψη: δελτία αμπελιού ΠΚΠΦΠ&ΦΕ Ηρακλείου 2024–2026 — μολύνει ΜΟΝΟ στα στάδια C–D–E (BBCH 09–13, βλάστηση 2–10 εκ.) με βροχή," + N
  + "// ελάχιστη T 8–10 °C και ≥ 12 ώρες συνεχούς διύγρανσης (14/3/2024)· πρώιμη παραλιακή ζώνη στο D από αρχές Μαρτίου, όψιμη ορεινή" + N
  + "// έως τέλη Απριλίου· «Δεν ενδείκνυνται ψεκασμοί» από το στάδιο G (28/4/2026). Ανθράκνωση εσπεριδοειδών: μόλυνση ανθέων και νεαρής" + N
  + "// βλάστησης (Gonçalves 2021), άνθηση Κρήτης Απρίλιος–Μάιος. Εκτός παραθύρου: μετρητής 0, κάρτα «Εκτός περιόδου», χωρίς προειδοποίηση" + N
  + "// πρόγνωσης, ανοιχτή υπόθεση κλείνει (auto). Ημερομηνίες μήνας*100+ημέρα, ώρα Ελλάδας, από το measurements.now του παλμού." + N
  + "const _SAG_SEASON_WINDOWS = {" + N
  + "  phomopsis_viticola: { from: 301, to: 510, what: 'τη φώμοψη', why: 'μολύνει μόνο στην έκπτυξη της βλάστησης (στάδια C–E, 2–10 εκ.) με βροχή' }," + N
  + "  colletotrichum_gloeosporioides: { from: 315, to: 531, what: 'την ανθράκνωση', why: 'μολύνει τα άνθη και τη νεαρή βλάστηση της άνοιξης' }," + N
  + "};" + N
  + "function _sagInSeasonWindow(key, md) {" + N
  + "  const w = _SAG_SEASON_WINDOWS[key];" + N
  + "  if (!w) return true;" + N
  + "  return w.from <= w.to ? (md >= w.from && md <= w.to) : (md >= w.from || md <= w.to);" + N
  + "}" + N
  + "function _sagMomentNow(measurements) {" + N
  + "  const tz = (measurements && measurements.timezone) || 'Europe/Athens';" + N
  + "  const n = measurements && measurements.now ? new Date(measurements.now) : null;" + N
  + "  return (n && !isNaN(n.getTime()) ? moment(n) : moment()).tz(tz);" + N
  + "}" + N
  + "function _sagMonthDayNow(measurements) { const m = _sagMomentNow(measurements); return (m.month() + 1) * 100 + m.date(); }" + N
  + "const _sagSilentText = (key) => _SAG_SEASON_WINDOWS[key]" + N
  + "  ? 'Εκτός περιόδου για ' + _SAG_SEASON_WINDOWS[key].what + ': ' + _SAG_SEASON_WINDOWS[key].why + '. Χωρίς κίνδυνο τώρα.'" + N
  + "  : 'Εκτός περιόδου για ' + (key === 'plasmopara_viticola' ? 'τον περονόσπορο' : 'το ωίδιο') + ' του αμπελιού.';" + N)

SUBS = [
  # Λ1 αλτερνάρια
  ('optimalTempRange: { min: 24, max: 30 },' + N + '      optimalHumidity: { min: 85, max: 100 },' + N + '      requiredDurationHrs: 8,' + N + '      notes: "Ref: Rotem 1994, Agrios 2005."',
   'optimalTempRange: { min: 13, opt: 25, max: 32 },   // T-LITVALUES-01: ήταν {24,30} και έδινε 0 ώρες παντού. TOMCAST ζώνη 13–17 °C (Meno 2020 ελάχ. 10)· Attri 2024 βλάστηση από 15, κορυφή 25–30· Thomidis 2023 (Ελλάδα) 20–30' + N
   + '      optimalHumidity: { min: 90, max: 100 },   // T-LITVALUES-01: ήταν 85. Attri 2024: RH > 90 %' + N
   + '      requiredDurationHrs: 6,   // T-LITVALUES-01: ήταν 8. Vloutoglou & Kalogerakis 2000 (Ελλάδα): 4–6 ώρες υγρού φύλλου αρκούν' + N
   + '      notes: "Ref: Rotem 1994, Agrios 2005. T-LITVALUES-01 4/11/2026: TOMCAST, Vloutoglou 2000, Attri 2024, Thomidis 2023."', "Λ1 αλτερνάρια"),
  # Λ5 ωίδιο αμπελιού
  ('optimalTempRange: { min: 15, max: 35 }, // B4 FIX: ήταν {20,25}. Ref: Gadoury 1990',
   'optimalTempRange: { min: 15, max: 32 }, // B4 FIX: ήταν {20,25}. Ref: Gadoury 1990 · T-LITVALUES-01: max 35→32, Bendek 2007 καμία βλάστηση στους 35', "Λ5 ωίδιο max"),
  ('requiresLeafWetness: false,     // B6 FIX: Ωίδιο ΔΕΝ χρειάζεται βρεγμένο φύλλο',
   'requiresLeafWetness: false,     // B6 FIX: Ωίδιο ΔΕΝ χρειάζεται βρεγμένο φύλλο' + N
   + '      wetLeafInhibits: true,          // T-LITVALUES-01: ΜΕΤΡΗΜΕΝΟ νερό στο φύλλο σκάει τα κονίδια και κόβει τη νόσο (Bendek 2007, Blaich 1989, Carroll & Wilcox 2003)', "Λ5 ωίδιο wetLeafInhibits"),
  ('description: "Ενδοφυτικό ωίδιο — ευνοείται από ξηρές συνθήκες. Ειδικό χαρακτηριστικό: δεν χρειάζεται υγρό φύλλο.",' + N + '    optimalTempRange: { min: 15, opt: 25, max: 32 },',
   'description: "Ενδοφυτικό ωίδιο — ευνοείται από ξηρές συνθήκες. Ειδικό χαρακτηριστικό: δεν χρειάζεται υγρό φύλλο.",' + N + '    optimalTempRange: { min: 15, opt: 25, max: 30 },   // T-LITVALUES-01: max 32→30, Guzmán-Plazola 2003 ≥ 30 °C δυσμενές, Elad 2007 αποικισμός 15–25', "Λ5 ωίδιο σολανωδών max"),
  # Λ6 φώμοψη
  ('optimalTempRange: { min: 5, opt: 20, max: 30 },' + N + '    optimalHumidity: { min: 95, max: 100 },' + N + '    requiredDurationHrs: 7,' + N + '    requiresLeafWetness: true,',
   'optimalTempRange: { min: 8, opt: 20, max: 35 },   // T-LITVALUES-01: ήταν {5,20,30}. ΠΚΠΦΠ Ηρακλείου 14/3/2024 ελάχ. 8–10 °C· Erincik 2003 μόλυνση έως 35,5, βέλτιστο 16–20' + N
   + '    optimalHumidity: { min: 95, max: 100 },' + N
   + '    requiredDurationHrs: 12,   // T-LITVALUES-01: ήταν 7. ΠΚΠΦΠ Ηρακλείου 14/3/2024 «τουλάχιστον 12 ώρες συνεχούς διύγρανσης»· Anco 2013 ασήμαντη σπορίωση στις 11 ώρες' + N
   + '    requiresLeafWetness: true,', "Λ6 φώμοψη"),
  # Λ7 ανθράκνωση εσπεριδοειδών
  ('description: "Ανθράκνωση εσπεριδοειδών — πτώση καρπιδίων μετά ανθοφορία, κηλιδώσεις φύλλων σε υγρές ανοιξιάτικες περιόδους.",' + N + '    optimalTempRange: { min: 10, opt: 25, max: 32 },' + N + '    optimalHumidity: { min: 90, max: 100 },' + N + '    requiredDurationHrs: 12,',
   'description: "Ανθράκνωση εσπεριδοειδών — πτώση καρπιδίων μετά ανθοφορία, κηλιδώσεις φύλλων σε υγρές ανοιξιάτικες περιόδους.",' + N + '    optimalTempRange: { min: 10, opt: 25, max: 32 },' + N + '    optimalHumidity: { min: 90, max: 100 },' + N
   + '    requiredDurationHrs: 8,   // T-LITVALUES-01: ήταν 12. Gonçalves 2021: μόλυνση ανθέων με 6–24 ώρες διαβροχής στους 18–24 °C', "Λ7 ανθράκνωση"),
  # μηχανισμός: μετρητής ωρών
  ('      const conditionsOk = tempOk && humidityOk && wetOk && !rainInhibit;' + N,
   '      // T-LITVALUES-01: (α) wetLeafInhibits — μετρημένο νερό στο φύλλο (sensor/dew_leaf) σκάει τα κονίδια του ωιδίου αμπελιού·' + N
   + '      // (β) εποχικές ασθένειες εκτός παραθύρου ημερολογίου (_SAG_SEASON_WINDOWS) δεν μετρούν ώρες.' + N
   + '      const _wetInhibit = pathogen.wetLeafInhibits === true && _lwsMeasuredWet;' + N
   + '      const _inSeason = _sagInSeasonWindow(pathogenKey, _sagMonthDayNow(measurements));' + N
   + '      const conditionsOk = tempOk && humidityOk && wetOk && !rainInhibit && !_wetInhibit && _inSeason;' + N, "Μ1 μετρητής"),
  # μηχανισμός: παράθυρα + φάση
  ("const _SAG_MILDEW_INSPECT = ['erysiphe_necator', 'podosphaera_xanthii', 'leveillula_taurica'];" + N,
   WINDOWS + "const _SAG_MILDEW_INSPECT = ['erysiphe_necator', 'podosphaera_xanthii', 'leveillula_taurica'];" + N, "Μ2 παράθυρα"),
  ("function _sagMildewPhase(key, md) {" + N + "  if (_SAG_MILDEW_INSPECT.indexOf(key) < 0 && _SAG_WET_INSPECT.indexOf(key) < 0) return 'off';" + N,
   "function _sagMildewPhase(key, md) {" + N + "  if (_SAG_SEASON_WINDOWS[key] && !_sagInSeasonWindow(key, md)) return 'silent';   // T-LITVALUES-01" + N
   + "  if (_SAG_MILDEW_INSPECT.indexOf(key) < 0 && _SAG_WET_INSPECT.indexOf(key) < 0) return 'off';" + N, "Μ3 φάση"),
  ("text: 'Εκτός περιόδου για ' + (pathogenKey === 'plasmopara_viticola' ? 'τον περονόσπορο' : 'το ωίδιο') + ' του αμπελιού.' } }];",
   "text: _sagSilentText(pathogenKey) } }];", "Μ4 κείμενο σιωπής"),
  ("    const _mdNow = moment().tz(measurements?.timezone || 'Europe/Athens');" + N,
   "    const _mdNow = _sagMomentNow(measurements);   // T-LITVALUES-01: η ώρα του παλμού, όχι το ρολόι" + N, "Μ5 ώρα μηνυμάτων"),
  # μηχανισμός: πρόγνωση
  ("        if (_SAG_NONFOLIAR_SUSPENDED.indexOf(key) >= 0) continue;   // T-NONFOLIAR-01" + N,
   "        if (_SAG_NONFOLIAR_SUSPENDED.indexOf(key) >= 0) continue;   // T-NONFOLIAR-01" + N
   + "        if (!_sagInSeasonWindow(key, _sagMonthDayNow(null))) continue;   // T-LITVALUES-01: εκτός παραθύρου, χωρίς προειδοποίηση" + N, "Μ6 πρόγνωση"),
  # μηχανισμός: υποθέσεις
  ("    const isPest = _sagNoCaseKeySet().has(k);" + N,
   "    const isPest = _sagNoCaseKeySet().has(k)" + N
   + "      || !_sagInSeasonWindow(k, _sagMonthDayNow(measurements));   // T-LITVALUES-01: εκτός παραθύρου η ανοιχτή υπόθεση κλείνει (auto)" + N, "Μ7 υποθέσεις"),
]
for a, b, n in SUBS:
    c = s.count(a); assert c == 1, (n, c); s = s.replace(a, b); print("OK", n)
assert s.count("\n") == s.count("\r\n")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.close(fd)
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8"); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
