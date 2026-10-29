# -*- coding: utf-8 -*-
"""Πυρήνας v50.163 · T-EC-LABEL-01 (Michalis 29/10: «κάνε αλλαγή της λέξης «Νερό ρίζας» στον πυρήνα»).
Αφορμή: Αμμουδάρες 29/10 — ο παραγωγός διάβαζε «νερό ρίζας» και δεν καταλάβαινε τι είναι. Το widget λέει ήδη
«EC στη ρίζα» (W-EC-ROOT-01)· τα κείμενα του πυρήνα έλεγαν ακόμα «Νερό ρίζας» / «Νερό πόρων» για την ΙΔΙΑ ποσότητα
(EC του νερού των πόρων κατά Hilhorst). ΜΟΝΟ κείμενα: καμία τιμή, κανένας υπολογισμός, κανένα κλειδί μεταβλητής.
Σε UTF-8 το «EC στη ρίζα» είναι 1 byte ΜΙΚΡΟΤΕΡΟ από το «Νερό ρίζας»/«Νερό πόρων» → το field_bundle δεν μεγαλώνει.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile, re
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"
raw = io.open(C, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
assert "\r\n" in s and s.count("\n") == s.count("\r\n"), "ο πυρήνας πρέπει να είναι καθαρό CRLF"
print("ΠΡΙΝ πυρήνας", hashlib.sha256(raw).hexdigest(), len(raw))
assert "T-EC-LABEL-01" not in s, "ήδη εφαρμοσμένο"
s = s.replace("\r\n", "\n")
def sub(old, new, label):
    global s; n = s.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.162 · 2026-10-27';",
    "const SAG_KERNEL_VERSION = 'v50.163 · 2026-10-29';   // T-EC-LABEL-01: «Νερό ρίζας/πόρων» → «EC στη ρίζα» (μόνο κείμενα)", "Λ0 έκδοση")
sub("text: 'Νερό πόρων (' + c.el + ') στο ξηρότερο δείγμα του 24ώρου: '",
    "text: 'EC στη ρίζα (' + c.el + ') στο ξηρότερο δείγμα του 24ώρου: '", "Λ1 soil_ec_ref")
sub("Ελέγξτε τις δηλώσεις EC νερού/λιπάσματος: το νερό των πόρων (' + f(refF, 2)",
    "Ελέγξτε τις δηλώσεις EC νερού/λιπάσματος: η EC στη ρίζα (' + f(refF, 2)", "Λ2 soil_ec_ratio φρουρός")
sub("χρειάζεται την προ-αρδευτική αναφορά νερού πόρων (ξηρότερο δείγμα 24ώρου)",
    "χρειάζεται την προ-αρδευτική EC στη ρίζα (ξηρότερο δείγμα 24ώρου)", "Λ3 αναμονή αναφοράς")
sub("t: 'Νερό ρίζας ' + f(refF, 2) + ' dS/m (προ-αρδευτικά) — ασύμβατο",
    "t: 'EC στη ρίζα ' + f(refF, 2) + ' dS/m (προ-αρδευτικά) — ασύμβατο", "Λ4 ασύμβατες δηλώσεις")
sub("t: 'Νερό ρίζας ' + f(refF, 2) + ' dS/m (προ-αρδευτικά). Δηλώστε",
    "t: 'EC στη ρίζα ' + f(refF, 2) + ' dS/m (προ-αρδευτικά). Δηλώστε", "Λ5 χωρίς δήλωση λίπανσης")
sub("const rt = 'Νερό ρίζας ' + f(refF, 2)",
    "const rt = 'EC στη ρίζα ' + f(refF, 2)", "Λ6 ημερήσια κρίση")
sub("+ 'Νερό ρίζας ' + _fmt(r.pore, 2) + '. Σε εκχύλισμα κορεσμού '",
    "+ 'EC στη ρίζα ' + _fmt(r.pore, 2) + '. Σε εκχύλισμα κορεσμού '", "Λ7 soil_ece1/2")
sub("ΒΑΘΜΟΝΟΜΗΣΗ: «Ένδειξη οργάνου» ↔ φορητό ΣΤΟ ΧΩΜΑ · «Νερό πόρων» '",
    "ΒΑΘΜΟΝΟΜΗΣΗ: «Ένδειξη οργάνου» ↔ φορητό ΣΤΟ ΧΩΜΑ · «EC στη ρίζα» '", "Λ8 οδηγός βαθμονόμησης")

# Καμία παλιά ετικέτα σε κείμενο (σχόλια επιτρέπονται)
code = "\n".join(l for l in s.split("\n") if not l.lstrip().startswith("//"))
left = re.findall(r"['\"`][^'\"`\n]*(?:Νερό ρίζας|Νερό πόρων|νερό των πόρων|νερού πόρων|νερό ρίζας)[^'\"`\n]*['\"`]", code)
assert not left, "έμειναν: " + repr(left[:3])

out = s.replace("\n", "\r\n").encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(C, "wb").write(out)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(out).hexdigest(), len(out))
