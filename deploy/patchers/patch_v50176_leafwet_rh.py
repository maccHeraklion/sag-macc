# -*- coding: utf-8 -*-
"""T-LEAFWET-RH-01 (4/11/2026, απόφαση Michalis «νομίζω το 2 είναι καλή ιδέα να προχωρήσεις»).
ΕΥΡΗΜΑ (audit_downy_replay/audit_downy_fleet 2026-11-04, ΕΠΙΒΕΒΑΙΩΜΕΝΟ): ο μετρητής ωρών μόλυνσης ζητούσε
T ΚΑΙ RH ≥ όριο ΚΑΙ υγρό φύλλο. Τα em320 σταματούν στο 89,5–95 %, άρα περονόσπορος Κουτσάκη (όριο 95) και
Γρινιαράκη (όριο 90) είχαν 0 ώρες σε 50 ημέρες με 443/591 ώρες μετρημένα υγρό φύλλο. Οι παραγωγοί ψεκάζουν
προληπτικά και βλέπουν βρεγμένα φύλλα το πρωί.
ΑΛΛΑΓΕΣ (όρια, FIR, PEI αμετάβλητα):
  Μ1 μετρητής: όταν ο αισθητήρας φύλλου ΜΕΤΡΑ νερό (πηγή «sensor» ή «dew_leaf»), το όριο RH δεν μπλοκάρει
     τα παθογόνα που απαιτούν υγρό φύλλο. Εκτίμηση δρόσου/RH, βροχή, ωίδια: όπως πριν.
  Μ2 μήνυμα: οι 5 περονόσποροι + βοτρύτης μπαίνουν στη λογική επιθεώρησης του T-MILDEW-INSPECT-01:
     FIR ≥ 0,4 → «Υψηλός κίνδυνος» πορτοκαλί με «επιθεωρήστε». Ο περονόσπορος αμπελιού παίρνει το
     ημερολόγιο του ωιδίου αμπελιού (κρίσιμη 1/4–30/6 → όπως πριν «Σοβαρός», σιωπή 1/12–15/2).
count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-MILDEW-INSPECT-01" in s and "T-LEAFWET-RH-01" not in s
N = "\r\n"
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.175 · 2026-11-04';   // T-MILDEW-INSPECT-01",
   "const SAG_KERNEL_VERSION = 'v50.176 · 2026-11-04';   // T-LEAFWET-RH-01 (μετρημένο υγρό φύλλο υπερισχύει του ορίου RH· περονόσποροι/βοτρύτης: επιθεώρηση) · T-MILDEW-INSPECT-01", "έκδοση"),
  ("      const humidityOk = RH >= Number(_oh.min);" + N + N
   + "      // B6 FIX: Leaf wetness only if pathogen requires it (erysiphe: false)" + N
   + "      const needsWet = (pathogen.requiresLeafWetness !== false);" + N,
   N + "      // B6 FIX: Leaf wetness only if pathogen requires it (erysiphe: false)" + N
   + "      const needsWet = (pathogen.requiresLeafWetness !== false);" + N
   + "      // T-LEAFWET-RH-01 (v50.176): το όριο RH είναι υποκατάστατο του νερού στο φύλλο. Όταν ο αισθητήρας" + N
   + "      // φύλλου ΜΕΤΡΑ νερό, δεν μπλοκάρει· τα em320 σταματούν στο 89,5–95 % και ο περονόσπορος είχε 0 ώρες." + N
   + "      // Εκτίμηση (δρόσος αέρα, RH) και ωίδια (δεν θέλουν υγρό φύλλο): όπως πριν." + N
   + "      const humidityOk = RH >= Number(_oh.min) || (needsWet && _lwsMeasuredWet);" + N, "Μ1 μετρητής"),
  ("  const leafIsWet = _lws.wet;" + N,
   "  const leafIsWet = _lws.wet;" + N
   + "  const _lwsMeasuredWet = leafIsWet && (_lws.source === 'sensor' || _lws.source === 'dew_leaf');   // T-LEAFWET-RH-01" + N, "Μ1β σημαία"),
  ("const _SAG_MILDEW_INSPECT = ['erysiphe_necator', 'podosphaera_xanthii', 'leveillula_taurica'];" + N
   + "function _sagMildewPhase(key, md) {" + N
   + "  if (_SAG_MILDEW_INSPECT.indexOf(key) < 0) return 'off';" + N
   + "  if (key !== 'erysiphe_necator') return 'normal';" + N,
   "const _SAG_MILDEW_INSPECT = ['erysiphe_necator', 'podosphaera_xanthii', 'leveillula_taurica'];" + N
   + "// T-LEAFWET-RH-01: ίδια λογική επιθεώρησης για τους περονόσπορους και τον βοτρύτη (οι παραγωγοί ψεκάζουν προληπτικά)." + N
   + "const _SAG_WET_INSPECT = ['plasmopara_viticola', 'phytophthora_infestans', 'pseudoperonospora_cubensis', 'peronospora_destructor', 'brassica_downy_mildew', 'botrytis_cinerea'];" + N
   + "const _sagInspectName = (key) => _SAG_MILDEW_INSPECT.indexOf(key) >= 0 ? 'ωίδιο' : key === 'botrytis_cinerea' ? 'βοτρύτη' : 'περονόσπορο';" + N
   + "function _sagMildewPhase(key, md) {" + N
   + "  if (_SAG_MILDEW_INSPECT.indexOf(key) < 0 && _SAG_WET_INSPECT.indexOf(key) < 0) return 'off';" + N
   + "  if (key !== 'erysiphe_necator' && key !== 'plasmopara_viticola') return 'normal';" + N, "Μ2 περίοδος"),
  ("value: 'Χαμηλός κίνδυνος', metadata: { color: 'green', text: 'Εκτός περιόδου για το ωίδιο του αμπελιού.' } }];",
   "value: 'Χαμηλός κίνδυνος', metadata: { color: 'green', text: 'Εκτός περιόδου για ' + (pathogenKey === 'plasmopara_viticola' ? 'τον περονόσπορο' : 'το ωίδιο') + ' του αμπελιού.' } }];", "Μ2β σιωπή"),
  ("        : 'Ευνοϊκές συνθήκες για ωίδιο — επιθεωρήστε το φύλλωμα. Αν δείτε συμπτώματα, ψεκάστε.' } }];",
   "        : 'Ευνοϊκές συνθήκες για ' + _sagInspectName(pathogenKey) + (_SAG_WET_INSPECT.indexOf(pathogenKey) >= 0 && _whyFor(pathogenKey, pathogen) ? ' (' + _whyFor(pathogenKey, pathogen) + ')' : '') + ' — επιθεωρήστε το φύλλωμα. Αν δείτε συμπτώματα, ψεκάστε.' } }];", "Μ2γ κείμενο με αιτία (π.χ. «6ω υγρά φύλλα») για περονόσπορους/βοτρύτη"),
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
