# -*- coding: utf-8 -*-
"""T-LEGACY-01 · widget + φόρμα v22 (έλεγχος πληρότητας 4/10).
 B-05 (widget): το `irrigation_warning` («Ασυμφωνία αισθητήρα και τύπου εδάφους … η δόση είναι αναξιόπιστη»,
      T-SOIL-MISMATCH-01) αποθηκευόταν στην cache αλλά ΔΕΝ εμφανιζόταν πουθενά. Μπαίνει στην κάρτα υγείας (HL).
 B-08 (φόρμα): η στήλη μS/cm της βοήθειας «ποιότητα νερού» είχε τα όρια TDS mg/L του FAO-29 (450/1.300/2.000)
      δίπλα σε όρια dS/m 0,7/2,0/3,0 → 700/2.000/3.000 μS/cm. Με το v21 το μS/cm έγινε η προβεβλημένη μονάδα.
LF, count==1, όλα-ή-τίποτα."""
import io, sys, hashlib
sys.stdout.reconfigure(encoding="utf-8")
def patch(P, subs):
    raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
    s = raw.decode("utf-8"); print(P, "ΠΡΙΝ", hashlib.sha256(raw).hexdigest()[:16], len(raw))
    for old, new, label in subs:
        c = s.count(old); assert c == 1, f"{label}: {c} φορές"; s = s.replace(old, new); print("  OK", label)
    out = s.encode("utf-8"); io.open(P, "wb").write(out)
    print("  ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
patch("_dist-sagMain/index-7cbd9a4e.js", [
    ('const HL={sensor_alert:"Αισθητήρας φύλλου",',
     'const HL={irrigation_warning:"Προειδοποίηση άρδευσης",sensor_alert:"Αισθητήρας φύλλου",',
     "B-05 irrigation_warning στην κάρτα υγείας")])
patch("custom_html_files/configuration.html", [
    ("  excellent: { ecw:'< 0,7 dS/m',      us:'< 450 μS/cm',",
     "  excellent: { ecw:'< 0,7 dS/m',      us:'< 700 μS/cm',", "B-08 excellent"),
    ("  good:      { ecw:'0,7 – 2,0 dS/m',  us:'450 – 1.300 μS/cm',",
     "  good:      { ecw:'0,7 – 2,0 dS/m',  us:'700 – 2.000 μS/cm',", "B-08 good"),
    ("  marginal:  { ecw:'2,0 – 3,0 dS/m',  us:'1.300 – 2.000 μS/cm',",
     "  marginal:  { ecw:'2,0 – 3,0 dS/m',  us:'2.000 – 3.000 μS/cm',", "B-08 marginal"),
    ("  poor:      { ecw:'> 3,0 dS/m',      us:'> 2.000 μS/cm',",
     "  poor:      { ecw:'> 3,0 dS/m',      us:'> 3.000 μS/cm',", "B-08 poor"),
])
