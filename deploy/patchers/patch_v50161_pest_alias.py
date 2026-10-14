# -*- coding: utf-8 -*-
"""Πυρήνας v50.161 · T-PEST-ALIAS-01 (εντολή Μιχάλη 14/10: «συμφωνώ όπως προτείνεις» — βήμα 2 μετά τον έλεγχο των
ημερολογίων αγρών). ΜΕΤΡΗΜΕΝΟ 14/10 πάνω στον πραγματικό κώδικα: η _sagFindPesticideByRef ΔΕΝ αναγνώριζε ονόματα που
δήλωσαν πραγματικοί αγρότες — «karate» (Σταυρακάκης, KEK), «Neemazal» / «Azadiraktinh» / «Azadiraktini» (Γρινιαράκης),
«Heliosoufre», «Χαλκός», «βάκιλος». Άγνωστο σκεύασμα → 7 ημέρες βάση, γενική έκπλυση 0,05, χωρίς UV, χωρίς PHI καταλόγου.

Τώρα: πίνακας ΣΥΝΩΝΥΜΩΝ που οδηγεί ΜΟΝΟ σε σκευάσματα που ΗΔΗ υπάρχουν στον κατάλογο (καμία νέα σταθερά, καμία νέα
δραστική). Ο «Χαλκός» (σκέτος) → copperHydroxide, που έχει ΠΑΝΟΜΟΙΟΤΥΠΕΣ παραμέτρους με τον οξυχλωριούχο (10 ημ, 0,06,
0,01, PHI 7) — άρα καμία αγρονομική υπόθεση. Ακριβής αντιστοίχιση μετά από κανονικοποίηση (πεζά, χωρίς τόνους, κενά) —
όχι ασαφής αναζήτηση. Ισχύει και στην _sagPesticideKeyByRef (έλεγχος έγκρισης T-PEST-REG-01). Οι μέρες προστασίας και
το PHI που δηλώνει ο αγρότης εξακολουθούν να υπερισχύουν. CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"
raw = io.open(C, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
assert "\r\n" in s and s.count("\n") == s.count("\r\n"), "ο πυρήνας πρέπει να είναι καθαρό CRLF"
print("ΠΡΙΝ πυρήνας", hashlib.sha256(raw).hexdigest()[:16], len(raw))
assert "T-PEST-ALIAS-01" not in s, "ήδη εφαρμοσμένο"
s = s.replace("\r\n", "\n")
def sub(old, new, label):
    global s; n = s.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.160 · 2026-10-05';", "const SAG_KERNEL_VERSION = 'v50.161 · 2026-10-14';", "1 έκδοση")

sub("function _sagFindPesticideByRef(ref) {\n",
    "// ── T-PEST-ALIAS-01 (v50.161 · 14/10/2026) · συνώνυμα εμπορικών/γραμμένων ονομάτων ─────────────\n"
    "// ΜΟΝΟ προς σκευάσματα που ΗΔΗ υπάρχουν στον κατάλογο — καμία νέα σταθερά. Κλειδί = όνομα μετά από\n"
    "// _peiStrip (πεζά, χωρίς τόνους) με τα μη αλφαριθμητικά ως ένα κενό. Πηγή: ημερολόγια αγρών 14/10.\n"
    "const _SAG_PEST_REF_ALIAS = {\n"
    "  'karate': 'lambda_cyhalothrin', 'karate zeon': 'lambda_cyhalothrin', 'λαμδα σαιχαλοθριν': 'lambda_cyhalothrin',\n"
    "  'neemazal': 'azadirachtin', 'neemazal t s': 'azadirachtin', 'azadiraktinh': 'azadirachtin', 'azadiraktini': 'azadirachtin',\n"
    "  'azadirachtine': 'azadirachtin', 'αζαδιραχτινη': 'azadirachtin', 'αζαδιρακτινη': 'azadirachtin',\n"
    "  'heliosoufre': 'sulfur', 'θειο': 'sulfur', 'θειαφι': 'sulfur', 'θειαφη': 'sulfur',\n"
    "  'χαλκος': 'copperHydroxide', 'χαλκοσ': 'copperHydroxide', 'copper': 'copperHydroxide',\n"
    "  'βακιλος': 'bt', 'βακιλλος': 'bt', 'bacillus': 'bt', 'bacillus thuringiensis': 'bt',\n"
    "  'δελταμεθρινη': 'deltamethrin', 'decis': 'deltamethrin', 'σπινοσαντ': 'spinosad',\n"
    "};\n"
    "function _sagPestAliasKey(ref) {\n"
    "  try {\n"
    "    const k = _SAG_PEST_REF_ALIAS[_peiStrip(ref).replace(/[^a-z0-9\\u03b1-\\u03c9\\u03c2]+/g, ' ').trim()];\n"
    "    if (!k) return null;\n"
    "    for (const catObj of Object.values(PESTICIDE_PROFILE || {})) {\n"
    "      if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[k]) return k;\n"
    "    }\n"
    "  } catch (_e) {}\n"
    "  return null;\n"
    "}\n"
    "function _sagFindPesticideByRef(ref) {\n", "2 πίνακας συνωνύμων")

sub("    if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[key]) return catObj[key];\n  }\n  const norm = _peiStrip(key);\n",
    "    if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[key]) return catObj[key];\n  }\n"
    "  const _ak = _sagPestAliasKey(key);   // T-PEST-ALIAS-01\n"
    "  if (_ak) { for (const catObj of Object.values(PESTICIDE_PROFILE || {})) { if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[_ak]) return catObj[_ak]; } }\n"
    "  const norm = _peiStrip(key);\n", "3 αναζήτηση σκευάσματος")

sub("    if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[key]) return key;\n  }\n  const norm = _peiStrip(key);\n",
    "    if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[key]) return key;\n  }\n"
    "  const _ak = _sagPestAliasKey(key);   // T-PEST-ALIAS-01\n"
    "  if (_ak) return _ak;\n"
    "  const norm = _peiStrip(key);\n", "4 αναζήτηση κλειδιού")

out = s.replace("\n", "\r\n").encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(C, "wb").write(out)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(out).hexdigest(), len(out))
