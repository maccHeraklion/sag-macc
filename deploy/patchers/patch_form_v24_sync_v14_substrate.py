# -*- coding: utf-8 -*-
"""Φόρμα v24 + sync v14 · T-SUBSTRATE-01 (Στάδια 0-1, έγκριση Μιχάλη 27/10, Ε5 και Α8).
Φόρμα (configuration.html, καθαρό LF):
  Φ1 «Υπόστρωμα κοκοφοίνικα» στον τύπο εδάφους → soil_type='coir', soil_texture_class='coir'.
  Φ2 η επιλογή είναι ενεργή ΜΟΝΟ σε καλυμμένη καλλιέργεια (syncCoverGates).
  Φ3 φραγμός αποθήκευσης: κοκοφοίνικας σε ακάλυπτο αγρό δεν αποθηκεύεται, με μήνυμα.
Sync (setFieldParametersFromDeviceData.js, CRLF στο repo):
  Σ1 'coir' στο λεξιλόγιο εδάφους — αλλιώς το soil_type γύριζε στο προηγούμενο με προειδοποίηση
     «δεν αναγνωρίζεται» (ο πυρήνας θα το έβρισκε πάλι από το soil_texture_class, αλλά ο παραγωγός
     θα έβλεπε ψευδή προειδοποίηση).
count==1, όλα-ή-τίποτα (πρώτα ελέγχονται ΟΛΕΣ οι αντικαταστάσεις, μετά γράφονται τα αρχεία)."""
import io, sys, hashlib, subprocess, tempfile, os, re
sys.stdout.reconfigure(encoding="utf-8")

def load(p, crlf):
    raw = io.open(p, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\x00" not in raw
    s = raw.decode("utf-8")
    if crlf: assert s.count("\n") == s.count("\r\n"), p + ": όχι καθαρό CRLF"
    else: assert "\r" not in s, p + ": όχι καθαρό LF"
    print("ΠΡΙΝ", p, hashlib.sha256(raw).hexdigest()[:16], len(raw))
    return s.replace("\r\n", "\n")

def sub(s, old, new, label):
    n = s.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; print("  OK", label); return s.replace(old, new)

FORM = "custom_html_files/configuration.html"
SYNC = "analysis/setFieldParametersFromDeviceData.js"
f = load(FORM, False); y = load(SYNC, True)
assert "T-SUBSTRATE-01" not in f and "T-SUBSTRATE-01" not in y, "ήδη εφαρμοσμένο"

# Φ1 λίστα + ομάδα + ετικέτα ομάδας
f = sub(f, "  calcareous_clay:  { el:'Ασβεστούχο Αργιλώδες',         group:'calcareous_clay', hint:'Υψηλό pH — κίνδυνος χλώρωσης σιδήρου' }\n};",
        "  calcareous_clay:  { el:'Ασβεστούχο Αργιλώδες',         group:'calcareous_clay', hint:'Υψηλό pH — κίνδυνος χλώρωσης σιδήρου' },\n"
        "  /* v24 · T-SUBSTRATE-01: ΥΠΟΣΤΡΩΜΑ, όχι έδαφος — ο πυρήνας (v50.162) δεν του εφαρμόζει υπολογισμούς χώματος. */\n"
        "  coir:             { el:'Υπόστρωμα κοκοφοίνικα',        group:'coir',            hint:'Slabs/σακιά — μόνο σε θερμοκήπιο' }\n};",
        "Φ1 επιλογή κοκοφοίνικα")
f = sub(f, "const SOIL_GROUP_DEFAULT = { sandy:'sandy_loam', loamy:'loam', clay_loamy:'clay_loam', calcareous_clay:'calcareous_clay' };",
        "const SOIL_GROUP_DEFAULT = { sandy:'sandy_loam', loamy:'loam', clay_loamy:'clay_loam', calcareous_clay:'calcareous_clay', coir:'coir' };   /* v24 · T-SUBSTRATE-01 */",
        "Φ1 ομάδα κοκοφοίνικα")
f = sub(f, "  calcareous_clay:'Ασβεστούχο Άργιλο'\n};",
        "  calcareous_clay:'Ασβεστούχο Άργιλο',\n  coir:'Υπόστρωμα (όχι έδαφος)'   /* v24 · T-SUBSTRATE-01 */\n};",
        "Φ1 ετικέτα ομάδας")
f = sub(f, "    /* Το soil_type μένει ΠΑΝΤΑ ένας από τους 4 που ξέρει ο πυρήνας.\n",
        "    /* Το soil_type μένει ΠΑΝΤΑ ένας από τους 4 που ξέρει ο πυρήνας — ή 'coir' (v24 · T-SUBSTRATE-01).\n",
        "Φ1 σχόλιο αποθήκευσης")

# Φ2 μόνο σε καλυμμένη
f = sub(f, "    const covered = String(sel.value) === 'true';\n    COVER_GATES.forEach(function(g){\n",
        "    const covered = String(sel.value) === 'true';\n"
        "    /* v24 · T-SUBSTRATE-01: ο κοκοφοίνικας είναι υπόστρωμα θερμοκηπίου — επιλέγεται μόνο σε καλυμμένη.\n"
        "       Αν είναι ήδη επιλεγμένος, μένει ορατός· την αποθήκευση τη φράζει το btnSave. */\n"
        "    const _coir = document.querySelector('#soil_type option[value=\"coir\"]');\n"
        "    if (_coir) _coir.disabled = !covered;\n"
        "    COVER_GATES.forEach(function(g){\n",
        "Φ2 μόνο σε καλυμμένη")

# Φ3 φραγμός αποθήκευσης
f = sub(f, "  /* ── Προειδοποιήσεις, ΟΧΙ φραγμός ──\n",
        "  /* v24 · T-SUBSTRATE-01: υπόστρωμα κοκοφοίνικα ΜΟΝΟ σε καλυμμένη καλλιέργεια — ΦΡΑΓΜΟΣ, όχι προειδοποίηση. */\n"
        "  if ($('soil_type').value === 'coir' && $('covered_cultivation').value !== 'true'){\n"
        "    showBanner('Το υπόστρωμα κοκοφοίνικα επιλέγεται μόνο σε καλυμμένη καλλιέργεια (θερμοκήπιο). '\n"
        "      + 'Ορίστε «Καλυμμένη καλλιέργεια: Ναι» ή επιλέξτε τύπο εδάφους. Τίποτα δεν αποθηκεύτηκε.', 'warn');\n"
        "    return;\n"
        "  }\n"
        "  /* ── Προειδοποιήσεις, ΟΧΙ φραγμός ──\n",
        "Φ3 φραγμός αποθήκευσης")

# Σ1 sync
y = sub(y, "/* Το λεξιλόγιο εδάφους του πυρήνα (SOIL_PROFILE). */\nconst KERNEL_SOIL_TYPES = [\"sandy\", \"loamy\", \"clay_loamy\", \"calcareous_clay\"];",
        "/* Το λεξιλόγιο εδάφους του πυρήνα (SOIL_PROFILE) + το υπόστρωμα 'coir' (v14 · T-SUBSTRATE-01,\n"
        "   πυρήνας v50.162: SUBSTRATE_PROFILE — όχι έδαφος, χωρίς υπολογισμούς χώματος). */\n"
        "const KERNEL_SOIL_TYPES = [\"sandy\", \"loamy\", \"clay_loamy\", \"calcareous_clay\", \"coir\"];",
        "Σ1 λεξιλόγιο εδάφους")
y = sub(y, " ** v13 · 19/9/2026 — T-CROPKEYS-03 (έλεγχος 18/9, Κ13): η ανά καλλιέργεια\n",
        " ** v14 · 27/10/2026 — T-SUBSTRATE-01: 'coir' (υπόστρωμα κοκοφοίνικα) δεκτό στο soil_type. Τίποτα\n"
        " ** άλλο δεν αλλάζει· το soil_texture_class περνούσε ήδη αυτούσιο.\n"
        " ** v13 · 19/9/2026 — T-CROPKEYS-03 (έλεγχος 18/9, Κ13): η ανά καλλιέργεια\n",
        "Σ1 κεφαλίδα v14")

# έλεγχος σύνταξης: το script της φόρμας και το sync
scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", f, flags=re.S)
for i, sc in enumerate(scripts):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"φόρμα script #{i}: " + r.stderr[:300]
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, y.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "sync: " + r.stderr[:300]

fo = f.encode("utf-8"); yo = y.replace("\n", "\r\n").encode("utf-8")
io.open(FORM, "wb").write(fo); io.open(SYNC, "wb").write(yo)
print("ΜΕΤΑ", FORM, hashlib.sha256(fo).hexdigest(), len(fo))
print("ΜΕΤΑ", SYNC, "CRLF", hashlib.sha256(yo).hexdigest()[:16], "· LF (ανεβαίνει)", hashlib.sha256(y.encode("utf-8")).hexdigest())
