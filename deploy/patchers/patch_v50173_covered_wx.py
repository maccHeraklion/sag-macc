# -*- coding: utf-8 -*-
"""T-COVERED-WX-01 (3/11/2026, απόφαση Michalis: παγετός και καύσωνας σε θερμοκήπιο: κρατάμε τον συναγερμό από την εξωτερική
πρόγνωση με προσαρμοσμένο κείμενο). Αθέρμαντο θερμοκήπιο μπορεί να παγώσει, οπότε ο συναγερμός δεν σβήνει. Αλλάζει ΜΟΝΟ το κείμενο
σε καλυμμένη καλλιέργεια: λέει ότι η τιμή είναι έξω από το θερμοκήπιο και ζητά έλεγχο μέσα. Όρια, βαθμίδα, χρώμα ίδια. Ανοιχτός αγρός ίδιος.
count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-COVERED-WX-01" not in s
N = "\r\n"
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.172 · 2026-11-03';   // T-WAVE1-01",
   "const SAG_KERNEL_VERSION = 'v50.173 · 2026-11-03';   // T-COVERED-WX-01 (κείμενα παγετού/καύσωνα σε θερμοκήπιο) · T-WAVE1-01", "έκδοση"),
  ("        label_el: hard ? 'Παγετός' : 'Κίνδυνος παγετού'," + N + "        color: hard ? 'red' : 'orange'," + N + "        text: (hard" + N,
   "        label_el: hard ? 'Παγετός' : 'Κίνδυνος παγετού'," + N + "        color: hard ? 'red' : 'orange'," + N
   + "        // T-COVERED-WX-01: η πρόγνωση είναι του έξω αέρα· αθέρμαντο θερμοκήπιο μπορεί να παγώσει, οπότε ο συναγερμός μένει." + N
   + "        text: _SAG_COVERED_ACTIVE" + N
   + "          ? 'Η πρόγνωση δίνει ' + v1 + ' °C στις ' + when + ' ΕΞΩ από το θερμοκήπιο. Η θερμοκρασία μέσα εξαρτάται '" + N
   + "            + 'από το κάλυμμα και τη θέρμανση: δείτε τον αισθητήρα του θερμοκηπίου και ελέγξτε αν χρειάζεται προστασία.'" + N
   + "          : (hard" + N, "Π1 παγετός"),
  ("        text: 'Η πρόγνωση δίνει έως ' + v1 + ' °C στις ' + when + ' — πάνω από το '" + N,
   "        // T-COVERED-WX-01: η πρόγνωση είναι του έξω αέρα· το θερμοκήπιο ελέγχεται με αερισμό και σκίαση." + N
   + "        text: _SAG_COVERED_ACTIVE" + N
   + "          ? 'Η πρόγνωση δίνει έως ' + v1 + ' °C στις ' + when + ' ΕΞΩ από το θερμοκήπιο — πάνω από το κρίσιμο όριο '" + N
   + "            + 'της καλλιέργειας (' + c1 + ' °C), για ' + hrs + (hrs === 1 ? ' ώρα' : ' ώρες') + ' μέσα στο επόμενο 48ωρο. '" + N
   + "            + 'Μέσα μπορεί να είναι ακόμη πιο ζεστά: δείτε τον αισθητήρα του θερμοκηπίου και ελέγξτε αερισμό και σκίαση.'" + N
   + "          : 'Η πρόγνωση δίνει έως ' + v1 + ' °C στις ' + when + ' — πάνω από το '" + N, "Κ1 καύσωνας"),
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
