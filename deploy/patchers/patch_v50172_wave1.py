# -*- coding: utf-8 -*-
"""T-WAVE1-01 (3/11/2026, Michalis: «πάμε να εκτελέσουμε τα 4 κύματα», Κύμα 1 του ενημερωτικού ICT).
Μόνο κείμενα και χρώμα. Καμία αλλαγή σε λίτρα, όρια ή συμβουλή.
  Σ1 «Σόνδα εκτός εδάφους»: το κείμενο έλεγε ≤12 °C, ο κανόνας ελέγχει >18 °C. Το όριο γίνεται μία σταθερά (τιμή ΑΜΕΤΑΒΛΗΤΗ, 18)
     που χρησιμοποιούν και ο έλεγχος και το κείμενο.
  Σ2 Αναστολή λόγω βροχής: το irrigation_message έβγαινε χωρίς metadata (χωρίς χρώμα και επεξήγηση). Παίρνει το πράσινο που έχει
     κάθε άλλο «δεν χρειάζεται άρδευση». Η απόφαση και οι τιμές μένουν ίδιες.
count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-WAVE1-01" not in s
N = "\r\n"
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.171 · 2026-11-03';   // T-ZONES-01b",
   "const SAG_KERNEL_VERSION = 'v50.172 · 2026-11-03';   // T-WAVE1-01 (κείμενο σόνδας, χρώμα αναστολής βροχής) · T-ZONES-01b", "έκδοση"),
  ("const _SAG_SOIL_TYPES = ['lse01', 'lse01_shallow', 'lse01_deep', 'lse02', 'se0x'];" + N,
   "const _SAG_SOIL_TYPES = ['lse01', 'lse01_shallow', 'lse01_deep', 'lse02', 'se0x'];" + N
   + "const _SAG_SOIL_RANGE_MAX = 18;   // T-WAVE1-01: όριο ημερήσιου εύρους (°C) για «σόνδα εκτός εδάφους»· το ίδιο στον έλεγχο και στο κείμενο" + N, "Σ1α σταθερά"),
  ("Εύρος >12 °C" + N + "  // σημαίνει ότι η σόνδα ΔΕΝ βρίσκεται μέσα στο χώμα.",
   "Εύρος πάνω από" + N + "  // το _SAG_SOIL_RANGE_MAX σημαίνει ότι η σόνδα ΔΕΝ βρίσκεται μέσα στο χώμα.", "Σ1β σχόλιο"),
  ("if (s.range > 18 && (worst === null", "if (s.range > _SAG_SOIL_RANGE_MAX && (worst === null", "Σ1γ έλεγχος"),
  ("')· θαμμένος αισθητήρας: ≤12 °C.'", "')· όριο για θαμμένο αισθητήρα: ' + _SAG_SOIL_RANGE_MAX + ' °C.'", "Σ1δ κείμενο"),
  ("{ variable: 'irrigation_message', value: `Δεν απαιτείται πότισμα — βροχή ${rainfall_24h_irr.toFixed(1)}mm (ωφέλιμη: ${effectiveRainfall_mm.toFixed(1)}mm)` }",
   "{ variable: 'irrigation_message', value: `Δεν απαιτείται πότισμα — βροχή ${rainfall_24h_irr.toFixed(1)}mm (ωφέλιμη: ${effectiveRainfall_mm.toFixed(1)}mm)`," + N
   + "      metadata: { color: 'green', text: 'Η βροχή καλύπτει την ανάγκη σε νερό. Η ανάγκη ξανακρίνεται στον επόμενο υπολογισμό.' } }", "Σ2 αναστολή βροχής"),
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
