# -*- coding: utf-8 -*-
"""T-MILDEW-INSPECT-01 (4/11/2026, απόφαση Michalis «ναι»): το ωίδιο δεν διατάζει πια ψεκασμό κάθε μέρα.
Η FIR, τα όρια και οι μετρητές ΔΕΝ αλλάζουν. Αλλάζει μόνο το μήνυμα των erysiphe_necator, podosphaera_xanthii, leveillula_taurica:
  · κανονική περίοδος, FIR ≥ 0,4: «Υψηλός κίνδυνος» πορτοκαλί, «Ευνοϊκές συνθήκες για ωίδιο — επιθεωρήστε το φύλλωμα. Αν δείτε συμπτώματα, ψεκάστε.»
  · αμπέλι, κρίσιμη περίοδος 1/4–30/6: όπως πριν, με «Σοβαρός» και «Ψεκάστε».
  · αμπέλι, σιωπή 1/12–15/2: «Χαμηλός κίνδυνος», χωρίς υπόθεση.
Οι ημερομηνίες είναι εκτίμηση χωρίς πηγή, εγκεκριμένη από τον γεωπόνο· δεν υπάρχει φαινολογία στον πυρήνα (τα στάδια είναι FAO-56 νερού).
Η τιμή μένει σε γνωστή ετικέτα, ώστε υποθέσεις, push και widget να δουλεύουν χωρίς αλλαγή. count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-MILDEW-INSPECT-01" not in s
N = "\r\n"
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.174 · 2026-11-04';   // T-ECE-NOFALLBACK-01",
   "const SAG_KERNEL_VERSION = 'v50.175 · 2026-11-04';   // T-MILDEW-INSPECT-01 (ωίδιο: επιθεώρηση αντί εντολής ψεκασμού) · T-ECE-NOFALLBACK-01", "έκδοση"),
  ("function getPathogenMessages(fir, measurements) {" + N,
   "// T-MILDEW-INSPECT-01: περίοδος ωιδίου από ημερολόγιο, γιατί ο πυρήνας δεν έχει φαινολογία (τα στάδια είναι FAO-56 νερού)." + N
   + "// Ημερομηνίες αμπελιού: εκτίμηση χωρίς πηγή, εγκεκριμένη από τον γεωπόνο 4/11/2026. Τα λαχανικά δεν έχουν ούτε σιωπή ούτε κρίσιμη περίοδο." + N
   + "const _SAG_MILDEW_INSPECT = ['erysiphe_necator', 'podosphaera_xanthii', 'leveillula_taurica'];" + N
   + "function _sagMildewPhase(key, md) {" + N
   + "  if (_SAG_MILDEW_INSPECT.indexOf(key) < 0) return 'off';" + N
   + "  if (key !== 'erysiphe_necator') return 'normal';" + N
   + "  if (md >= 1201 || md <= 215) return 'silent';" + N
   + "  if (md >= 401 && md <= 630) return 'critical';" + N
   + "  return 'normal';" + N
   + "}" + N + N
   + "function getPathogenMessages(fir, measurements) {" + N, "Σ1 περίοδος"),
  ("    if (firValue < 0.2) {" + N + "      // ΤΑΥΤΟΣΗΜΟ σε όλες τις ασθένειες",
   "    const _mdNow = moment().tz(measurements?.timezone || 'Europe/Athens');" + N
   + "    const _mildew = _sagMildewPhase(pathogenKey, (_mdNow.month() + 1) * 100 + _mdNow.date());" + N
   + "    if (_mildew === 'silent') {" + N
   + "      messages = [...messages, { variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός κίνδυνος', metadata: { color: 'green', text: 'Εκτός περιόδου για το ωίδιο του αμπελιού.' } }];" + N
   + "      continue;" + N
   + "    }" + N
   + "    if (_mildew === 'normal' && firValue >= 0.4) {" + N
   + "      const _pdM = _protFor(pathogenKey);" + N
   + "      messages = [...messages, { variable: `fir_message_${pathogenKey}`, value: 'Υψηλός κίνδυνος', metadata: { color: 'orange', text: _pdM" + N
   + "        ? 'Προστασία έως ' + _pdM + ' — μην ψεκάσετε ξανά. Αν δείτε συμπτώματα, δηλώστε επιθεώρηση.'" + N
   + "        : 'Ευνοϊκές συνθήκες για ωίδιο — επιθεωρήστε το φύλλωμα. Αν δείτε συμπτώματα, ψεκάστε.' } }];" + N
   + "      continue;" + N
   + "    }" + N
   + "    if (firValue < 0.2) {" + N + "      // ΤΑΥΤΟΣΗΜΟ σε όλες τις ασθένειες", "Σ2 μήνυμα"),
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
