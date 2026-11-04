# -*- coding: utf-8 -*-
"""T-NONFOLIAR-01 (4/11/2026, απόφαση Michalis «ναι προχώρα με το 1»).
ΕΥΡΗΜΑ (ΕΛΕΓΧΟΣ_ΜΟΝΤΕΛΩΝ_ΠΑΘΟΓΟΝΩΝ_2026-11-04): 7 ασθένειες ριζών/λαιμού/φλοιού/σπορόφυτου έτρεχαν στη μηχανή
υγρού φύλλου (Infection_Triangle) και έβγαζαν «Σοβαρός κίνδυνος — Ψεκάστε» σε 11 καστανοχώραφα και στον Ρηγάκη.
ΑΛΛΑΓΕΣ: (Σ1) δηλωμένη λίστα αναστολής + κείμενα· (Σ2) χωρίς μετρητές ωρών· (Σ3) στη FIR κάρτα γκρι «Μη διαθέσιμο»
με αιτία και καλλιεργητικά μέτρα, χωρίς fir_· (Σ4) εκτός κύκλου υπόθεσης → οι ανοιχτές ειδοποιήσεις κλείνουν
αυτόματα («auto»)· (Σ5) εκτός προειδοποίησης πρόγνωσης. Όλα τα άλλα παθογόνα αμετάβλητα. count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-RH-CAP-90-01" in s and "T-NONFOLIAR-01" not in s
N = "\r\n"
CONST = (
  "// T-NONFOLIAR-01 (v50.178, απόφαση Michalis 4/11): ασθένειες ριζών, λαιμού, φλοιού ή σπορόφυτου που είχαν μπει" + N
  + "// στη μηχανή υγρού φύλλου (σημειώσεις προφίλ: «MODELING_APPROXIMATION», «skeleton», «proxy»). Δεν μολύνουν από" + N
  + "// το φύλλο· ο μετρητής ωρών και το «ψεκάστε» δεν τους αφορούν. Αναστέλλονται μέχρι να μπουν σε σωστό μοντέλο" + N
  + "// (εδαφογενές ή πληγών). Τα προφίλ ΔΕΝ αλλάζουν, ώστε να ξαναμπούν χωρίς απώλεια." + N
  + "const _SAG_NONFOLIAR_SUSPENDED = ['phytophthora_xcambivora', 'cryphonectria_parasitica', 'phytophthora_citrophthora'," + N
  + "  'phytophthora_niederhauserii', 'phytophthora_pythium_root_rot_herbs', 'fusarium_spp_corm_rot', 'plasmopara_halstedii'];" + N
  + "const _SAG_NONFOLIAR_TEXT = {" + N
  + "  phytophthora_xcambivora: ['ριζών και λαιμού από το έδαφος (μελάνωση καστανιάς)', 'Βελτιώστε τη στράγγιση, αποφύγετε κορεσμό και τραύματα στον λαιμό· δέντρα με εξίδρωση ή αραίωμα κόμης να τα δει γεωπόνος.']," + N
  + "  cryphonectria_parasitica: ['φλοιού από πληγές (έλκος καστανιάς)', 'Δεν υπάρχει χημική αντιμετώπιση. Κλαδεύετε σε ξηρό καιρό, απολυμαίνετε τα εργαλεία, αφαιρείτε τα έλκη· ρωτήστε για υποπαθογόνα στελέχη.']," + N
  + "  phytophthora_citrophthora: ['ριζών και κορμού από το έδαφος (γομμώσεις εσπεριδοειδών)', 'Κρατήστε τον λαιμό στεγνό, μην βρέχετε τον κορμό στο πότισμα, βελτιώστε τη στράγγιση.']," + N
  + "  phytophthora_niederhauserii: ['ριζών από το έδαφος (μαστιχόδεντρο)', 'Στράγγιση και αποφυγή κορεσμού του εδάφους.']," + N
  + "  phytophthora_pythium_root_rot_herbs: ['ριζών από το έδαφος (αρωματικά)', 'Στράγγιση, αποφυγή υπερβολικού ποτίσματος, υγιή φυτώρια.']," + N
  + "  fusarium_spp_corm_rot: ['κόρμου από το έδαφος (κρόκος)', 'Υγιές πολλαπλασιαστικό υλικό, αμειψισπορά, στράγγιση.']," + N
  + "  plasmopara_halstedii: ['συστημική από το έδαφος στο σπορόφυτο (ηλίανθος)', 'Επενδυμένος σπόρος, ανθεκτικά υβρίδια, αμειψισπορά.']," + N
  + "};" + N)
CARD = (
  "      // T-NONFOLIAR-01: ασθένεια ριζών/φλοιού — καμία εκτίμηση από τη μηχανή φύλλου, μόνο τίμια κάρτα." + N
  + "      if (_SAG_NONFOLIAR_SUSPENDED.indexOf(pathogenKey) >= 0) {" + N
  + "        const _nfT = _SAG_NONFOLIAR_TEXT[pathogenKey] || ['ριζών ή φλοιού', ''];" + N
  + "        indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο'," + N
  + "          metadata: { color: 'grey', text: 'Ασθένεια ' + _nfT[0] + ': το μοντέλο υγρού φύλλου δεν ισχύει για αυτήν και αποσύρθηκε μέχρι να μπει σωστό μοντέλο. ' + _nfT[1] } }];" + N
  + "        continue;" + N
  + "      }" + N)
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.177 · 2026-11-04';   // T-RH-CAP-90-01",
   "const SAG_KERNEL_VERSION = 'v50.178 · 2026-11-04';   // T-NONFOLIAR-01 (7 ασθένειες ριζών/φλοιού εκτός μηχανής φύλλου) · T-RH-CAP-90-01", "έκδοση"),
  ("const _SAG_NO_CASE_TYPES = new Set(['GDD_Pest', 'Soilborne_Disease_Model', 'Soil_Phenology_DD']);" + N,
   CONST + "const _SAG_NO_CASE_TYPES = new Set(['GDD_Pest', 'Soilborne_Disease_Model', 'Soil_Phenology_DD']);" + N, "Σ1 λίστα"),
  ("        if (cat[pk] && _SAG_NO_CASE_TYPES.has(cat[pk].type)) s.add(pk);" + N + "      }" + N + "    }" + N,
   "        if (cat[pk] && _SAG_NO_CASE_TYPES.has(cat[pk].type)) s.add(pk);" + N + "      }" + N + "    }" + N
   + "    for (const _nf of _SAG_NONFOLIAR_SUSPENDED) s.add(_nf);   // T-NONFOLIAR-01: οι ανοιχτές υποθέσεις τους κλείνουν (auto)" + N, "Σ4 χωρίς υπόθεση"),
  ("      if (pathogen?.type !== \"Infection_Triangle\") continue;" + N,
   "      if (pathogen?.type !== \"Infection_Triangle\") continue;" + N
   + "      if (_SAG_NONFOLIAR_SUSPENDED.indexOf(pathogenKey) >= 0) continue;   // T-NONFOLIAR-01: χωρίς μετρητή ωρών" + N, "Σ2 μετρητής"),
  ("      const erCalculationType = pathogen.type;" + N + "      let er = 0;" + N,
   CARD + "      const erCalculationType = pathogen.type;" + N + "      let er = 0;" + N, "Σ3 κάρτα"),
  ("        if (!ph || ph.type !== 'Infection_Triangle') continue;" + N,
   "        if (!ph || ph.type !== 'Infection_Triangle') continue;" + N
   + "        if (_SAG_NONFOLIAR_SUSPENDED.indexOf(key) >= 0) continue;   // T-NONFOLIAR-01" + N, "Σ5 πρόγνωση"),
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
