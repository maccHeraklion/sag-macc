# -*- coding: utf-8 -*-
"""Πυρήνας v50.159 · T-LEGACY-01 (έλεγχος πληρότητας 4/10, εντολή Μιχάλη «να διορθώσουμε τα λάθη … κατάλοιπα»).
Πέντε κατάλοιπα, όλα ΕΠΙΒΕΒΑΙΩΜΕΝΑ με εκτέλεση του πραγματικού κώδικα (audit2/B), καμία αγρονομική σταθερά:
  B-01 · σταθμός ΜΕ μετρητή βροχής και άκυρο μετρητή (σιωπή/κενό) → η παλιά διαδρομή (`sum(rain_height)`, μεταβλητή
         που ο fw 2.x δεν στέλνει) έγραφε ψευδές «0 mm» μέτρησης. Τώρα: ΚΑΜΙΑ τιμή (άγνωστο), όχι ψευδές 0.
  B-03 · πέτρες «1 %» διαβαζόταν ως κλάσμα 1,0 → 70 % (οροφή) → δόση ×0,30. Τώρα κλάσμα μόνο για 0 < x < 1.
  B-04 · διαπερατότητα καλύμματος 20 %: η φόρμα αποθηκεύει 0,2, ο πυρήνας ζητούσε > 0,2 → σιωπηλά 0,65. Τώρα ≥ 0,2.
  B-06 · `stale_measurement_groups` γραφόταν ΜΟΝΟ όταν υπήρχε παλιά ομάδα → έμενε πορτοκαλί 50 ω μετά την ανάκαμψη.
         Τώρα κενή τιμή όταν όλες φρέσκιες (το widget την παραλείπει).
  B-07 · `irrigation_sensor_fault` το ίδιο (έμενε 12 ω δίπλα σε έγκυρη δόση). Κενή τιμή όταν η άρδευση υπολογίζεται.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label, n=1):
    global s; c = s.count(old); assert c == n, f"{label}: βρέθηκε {c} φορές (αναμενόταν {n})"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.158 · 2026-10-04';", "const SAG_KERNEL_VERSION = 'v50.159 · 2026-10-04';", "έκδοση v50.159")

# B-01 · 24ωρο
sub("        } else\n        try {\n          totalRain = await device.getData({\n            variables: [\"rain_height\"],",
    "        } else if (!_accEnd)   // T-LEGACY-01 (B-01): σταθμός ΜΕ μετρητή → καμία παλιά διαδρομή (θα έδινε ψευδές 0)\n"
    "        try {\n          totalRain = await device.getData({\n            variables: [\"rain_height\"],",
    "B-01 24ωρο: παλιά διαδρομή μόνο χωρίς μετρητή")
sub("        if (_accDay.ok) { /* T-RAIN-ACC-01: η ποσότητα ήρθε από τον μετρητή */ }\n        else if (_rainEmpty) {",
    "        if (_accDay.ok) { /* T-RAIN-ACC-01: η ποσότητα ήρθε από τον μετρητή */ }\n"
    "        else if (_accEnd) { /* T-LEGACY-01 (B-01): μετρητής άκυρος → ΑΓΝΩΣΤΟ, όχι 0 ούτε ρυθμός×24 */ }\n"
    "        else if (_rainEmpty) {",
    "B-01 24ωρο: καμία εφεδρεία ρυθμού σε σταθμό με μετρητή")
sub("        deviceData[rainKey] = totalRain;\n",
    "        if (totalRain !== undefined) deviceData[rainKey] = totalRain;   // T-LEGACY-01 (B-01): άγνωστο = κανένα κλειδί\n",
    "B-01 24ωρο: δεν γράφεται άγνωστη τιμή")
# B-01 · ωριαίο
sub("        if (deviceData.rain_height_hourly === undefined && !_accDay.ok) try {",
    "        if (deviceData.rain_height_hourly === undefined && !_accEnd) try {   // T-LEGACY-01 (B-01)",
    "B-01 ωριαίο: παλιά διαδρομή μόνο χωρίς μετρητή")
sub("        if (deviceData.rain_height_hourly === undefined && !_accDay.ok) {\n          try {\n            const _g1",
    "        if (deviceData.rain_height_hourly === undefined && !_accEnd) {   // T-LEGACY-01 (B-01)\n          try {\n            const _g1",
    "B-01 ωριαίο: εφεδρεία ρυθμού μόνο χωρίς μετρητή")

# B-03 · πέτρες
sub("    _stoneFrac = _stoneRaw <= 1 ? _stoneRaw : _stoneRaw / 100;\n",
    "    // T-LEGACY-01 (B-03): η φόρμα γράφει ΑΚΕΡΑΙΟ ποσοστό· «1» = 1 %, όχι κλάσμα 1,0 (→ 70 % → δόση ×0,30).\n"
    "    // Κλάσμα δεχόμαστε μόνο για παλιές ρυθμίσεις 0 < x < 1.\n"
    "    _stoneFrac = _stoneRaw < 1 ? _stoneRaw : _stoneRaw / 100;\n",
    "B-03 πέτρες 1 % = 1 %")

# B-04 · διαπερατότητα (δύο σημεία, διαφορετικά ονόματα)
sub("  const _trans = (Number.isFinite(_tRaw) && _tRaw > 0.2 && _tRaw <= 1) ? _tRaw : 0.65;",
    "  const _trans = (Number.isFinite(_tRaw) && _tRaw >= 0.2 && _tRaw <= 1) ? _tRaw : 0.65;   // T-LEGACY-01 (B-04): η φόρμα αποθηκεύει 20 % = 0,2",
    "B-04 διαπερατότητα (ET0)")
sub("      trans = (Number.isFinite(t) && t > 0.2 && t <= 1) ? t : _SAG_COVER_TRANS_DEFAULT;",
    "      trans = (Number.isFinite(t) && t >= 0.2 && t <= 1) ? t : _SAG_COVER_TRANS_DEFAULT;   // T-LEGACY-01 (B-04)",
    "B-04 διαπερατότητα (BPI)")

# B-06 · παλιές ομάδες σβήνουν
sub("    if (over.length) {\n      out.push({ variable: 'stale_measurement_groups', value: over.map(g => g.name).join(' · '),\n"
    "        metadata: { color: 'orange', text: 'Ομάδες αισθητήρων με παλιά δεδομένα σε αυτόν τον κύκλο.' } });\n    }\n",
    "    if (over.length) {\n      out.push({ variable: 'stale_measurement_groups', value: over.map(g => g.name).join(' · '),\n"
    "        metadata: { color: 'orange', text: 'Ομάδες αισθητήρων με παλιά δεδομένα σε αυτόν τον κύκλο.' } });\n"
    "    } else {\n"
    "      // T-LEGACY-01 (B-06): ρητό σβήσιμο — αλλιώς έμενε πορτοκαλί 50 ω μετά την ανάκαμψη.\n"
    "      out.push({ variable: 'stale_measurement_groups', value: null, metadata: {} });\n    }\n",
    "B-06 παλιές ομάδες σβήνουν")

# B-07 · βλάβη άρδευσης σβήνει
sub("    if (H.lostIrr) {\n      out.push({ variable: 'irrigation_sensor_fault',\n",
    "    if (!H.lostIrr) {\n"
    "      // T-LEGACY-01 (B-07): ρητό σβήσιμο — αλλιώς η κόκκινη ταινία «χωρίς δόση» έμενε 12 ω δίπλα σε έγκυρη δόση.\n"
    "      out.push({ variable: 'irrigation_sensor_fault', value: null, metadata: {} });\n"
    "    }\n"
    "    if (H.lostIrr) {\n      out.push({ variable: 'irrigation_sensor_fault',\n",
    "B-07 βλάβη άρδευσης σβήνει")

out = s.replace("\n", "\r\n").encode("utf-8"); assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
