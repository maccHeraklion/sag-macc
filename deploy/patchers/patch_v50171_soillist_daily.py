# -*- coding: utf-8 -*-
"""T-ZONES-01b · πυρήνας v50.171 (3/11/2026): η πλήρης λίστα σονδών (soil_sensors) διαβάζεται/ενημερώνεται ΜΙΑ φορά την
ημέρα· κάθε ώρα ΜΟΝΟ όπου υπάρχουν σόνδες στο ίδιο βάθος (όπως ως τον v50.169). ΜΕΤΡΗΜΕΝΟ: με ωριαία ανάγνωση σε κάθε αγρό
ο κύκλος ανέβηκε 38,9 → 44,3 s (15:22) και 42,3 s (16:22)· η πλήρης λίστα γράφτηκε ήδη μία φορά σε όλους τους αγρούς.
count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-ZONES-01" in s and "T-ZONES-01b" not in s
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.170 · 2026-11-03';   // T-ZONES-01 (ζώνες άρδευσης, φάση 1) ·",
   "const SAG_KERNEL_VERSION = 'v50.171 · 2026-11-03';   // T-ZONES-01b (λίστα σονδών ημερήσια) · T-ZONES-01 (ζώνες άρδευσης, φάση 1) ·", "Ε έκδοση"),
  ("  if (!cand.length && !dailyTich) return false;          // χωρίς σόνδες: έλεγχος μία φορά την ημέρα\n",
   "  // T-ZONES-01b (v50.171): η πλήρης λίστα μία φορά την ημέρα· κάθε ώρα μόνο όπου υπάρχουν σόνδες στο ίδιο βάθος (+3–5 s/κύκλο αλλιώς).\n"
   "  if (!cand0.length && !dailyTich) return false;\n", "Λ ημερήσια"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: {c}"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
