# -*- coding: utf-8 -*-
"""T-RH-CAP-90-01 (4/11/2026, απόφαση Michalis «ναι προχώρα με τα όρια στο 90»).
Για τα παθογόνα που ΑΠΑΙΤΟΥΝ υγρό φύλλο, το όριο σχετικής υγρασίας του μετρητή ωρών γίνεται το πολύ 90 %
(δηλωμένη σταθερά _SAG_WET_RH_CAP). Αιτιολογία: η εκτίμηση διαβροχής χωρίς όργανο θεωρεί το φύλλο υγρό από
RH ≥ 90, άρα όριο 92/95 αντέφασκε με την ίδια την εκτίμηση και δεν πιάνεται από τα em320 (μέγ. 89,5–95 %).
Παθογόνα χωρίς απαίτηση υγρού φύλλου (ωίδια, φυτόφθορα εσπεριδοειδών, περονόσπορος ηλίανθου): αμετάβλητα.
Τα προφίλ ΔΕΝ ξαναγράφονται· η οροφή εφαρμόζεται σε ένα σημείο. count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-LEAFWET-RH-01" in s and "T-RH-CAP-90-01" not in s
N = "\r\n"
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.176 · 2026-11-04';   // T-LEAFWET-RH-01",
   "const SAG_KERNEL_VERSION = 'v50.177 · 2026-11-04';   // T-RH-CAP-90-01 (όριο RH ≤ 90 για ασθένειες υγρού φύλλου) · T-LEAFWET-RH-01", "έκδοση"),
  ("const _SAG_LWS_RAIN_MM    = 0.2;  // mm/h που ήδη βρέχουν το φύλλωμα" + N,
   "const _SAG_LWS_RAIN_MM    = 0.2;  // mm/h που ήδη βρέχουν το φύλλωμα" + N
   + "// T-RH-CAP-90-01 (v50.177, απόφαση Michalis 4/11): οροφή του ορίου RH για παθογόνα που απαιτούν υγρό φύλλο." + N
   + "// Η εκτίμηση διαβροχής χωρίς όργανο ξεκινά από RH 90· όριο 92/95 αντέφασκε μαζί της και τα em320 δεν το φτάνουν." + N
   + "const _SAG_WET_RH_CAP     = 90;   // % — ισχύει ΜΟΝΟ όταν requiresLeafWetness !== false" + N, "σταθερά"),
  ("      const humidityOk = RH >= Number(_oh.min) || (needsWet && _lwsMeasuredWet);" + N,
   "      const _rhMin = needsWet ? Math.min(Number(_oh.min), _SAG_WET_RH_CAP) : Number(_oh.min);   // T-RH-CAP-90-01" + N
   + "      const humidityOk = RH >= _rhMin || (needsWet && _lwsMeasuredWet);" + N, "Μ1 οροφή"),
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
