# -*- coding: utf-8 -*-
"""πυρήνας v50.148 · T-STAGEPREAMBLE-01 — το προοίμιο του crop_stage πάει στην κάρτα μεθόδου.

ΑΠΟΦΑΣΗ ΜΙΧΑΛΗ 19/9: «βάλε το στην κάρτα μεθόδου.»

ΜΕΤΡΗΜΕΝΟ (απογραφή 19/9, 42 αγροί): το `crop_stage` είναι το ΑΚΡΙΒΟΤΕΡΟ κλειδί όλου του
συστήματος — 19.315 B, μέσος όρος 402 B ανά καλλιέργεια, 48 εμφανίσεις, κομμένο 6 φορές.
Η ΠΡΩΤΗ του πρόταση είναι ΣΤΑΘΕΡΗ, ίδια σε κάθε αγρό και κάθε ώρα:
  «ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογία. » (76 B)

ΔΕΝ διαγράφεται και ΔΕΝ χάνεται: είναι η τεκμηριωμένη διόρθωση της v50.116 που έλυσε τη
σύγχυση «υδατικό στάδιο ≠ φαινολογία». Μετακομίζει στην ημερήσια κάρτα `field_method_card`,
εκεί όπου ζουν ήδη οι άλλες εννιά εξηγήσεις μεθόδου (T-METHODCARD-01, v50.146).

ΓΙΑΤΙ ΧΩΡΙΣΤΟΣ ΜΗΧΑΝΙΣΜΟΣ: η σάρωση της v50.146 σβήνει ΟΛΟΚΛΗΡΟ το κείμενο ενός κλειδιού.
Εδώ ΔΕΝ γίνεται αυτό — το υπόλοιπο του crop_stage (στάδιο, θερμική πρόοδος, επόμενο στάδιο)
ΑΛΛΑΖΕΙ και μένει στην ωριαία κάρτα. Φεύγει ΜΟΝΟ το σταθερό προοίμιο. Σημαία `_mp: 1`
(«μετακόμισε το προοίμιο»), ξεχωριστή από το `_m: 1` («μετακόμισε όλο το κείμενο»), ώστε
να μην μπερδεύεται ποιος διαβάζει το bundle.

Το προοίμιο μπαίνει ΜΙΑ φορά στην κάρτα, όχι μία ανά καλλιέργεια: είναι το ίδιο κείμενο.
Όλα-ή-τίποτα, node --check, CRLF χωρίς BOM."""
import subprocess, tempfile, os
P = "analysis/runPerTich.js"
raw = open(P, "rb").read()
assert b"\r\n" in raw and not raw.startswith(b"\xef\xbb\xbf")
s = raw.decode("utf-8").replace("\r\n", "\n")


def sub(old, new, count=1):
    global s
    c = s.count(old)
    assert c == count, "anchor %d: %r" % (c, old[:90])
    s = s.replace(old, new)


sub("const SAG_KERNEL_VERSION = 'v50.147 · 2026-09-19';",
    "const SAG_KERNEL_VERSION = 'v50.148 · 2026-09-19';")

# Το προοίμιο ορίζεται ΜΙΑ φορά, δίπλα στη λίστα μεθόδου, ώστε να μην ξαναγραφτεί κατά λάθος
# διαφορετικά εδώ και στο σημείο εκπομπής. Η αντιστοιχία ελέγχεται από τον ελεγκτή.
sub("""  _SAG_METHOD_CARD = null;
  {
    const _parts = [];""",
"""  /* ══ T-STAGEPREAMBLE-01 (v50.148 · 19/9/2026) · ΤΟ ΠΡΟΟΙΜΙΟ ΤΟΥ crop_stage ══
     ΑΠΟΦΑΣΗ ΜΙΧΑΛΗ 19/9: «βάλε το στην κάρτα μεθόδου.»
     ΜΕΤΡΗΜΕΝΟ: το `crop_stage` είναι το ΑΚΡΙΒΟΤΕΡΟ κλειδί του συστήματος (19.315 B στον
     στόλο, 402 B μέσο όρο, κομμένο 6 φορές). Η πρώτη του πρόταση είναι ΣΤΑΘΕΡΗ — ίδια σε
     κάθε αγρό, κάθε ώρα, κάθε καλλιέργεια. Είναι μέθοδος, όχι κατάσταση.
     ΔΕΝ διαγράφεται: είναι η τεκμηριωμένη διόρθωση της v50.116 («υδατικό στάδιο ≠
     φαινολογία»). Μετακομίζει στην ημερήσια κάρτα, όπου ζουν ήδη οι άλλες εννιά.
     ΠΡΟΣΟΧΗ — ΔΕΝ είναι το ίδιο με τη σάρωση παρακάτω: εκείνη σβήνει ΟΛΟ το κείμενο ενός
     κλειδιού. Εδώ φεύγει ΜΟΝΟ το προοίμιο· το υπόλοιπο (στάδιο, θερμική πρόοδος, επόμενο
     στάδιο) ΑΛΛΑΖΕΙ και μένει στην ωριαία κάρτα. Γι' αυτό η σημαία είναι `_mp`, όχι `_m`. */
  const _SAG_STAGE_PREAMBLE =
    'ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογία. ';

  _SAG_METHOD_CARD = null;
  {
    const _parts = [];""")

sub("""    _sweep(sharedPacked, '');
    for (const crop of cropsPackedArr) {
      _sweep(crop.indicators, String(crop.cultivation_type || crop.id || '?') + '/');
    }
    if (_parts.length) _SAG_METHOD_CARD = { n: _parts.length, t: _parts.join('\\n') };""",
"""    _sweep(sharedPacked, '');
    for (const crop of cropsPackedArr) {
      _sweep(crop.indicators, String(crop.cultivation_type || crop.id || '?') + '/');
    }

    /* T-STAGEPREAMBLE-01: το σταθερό προοίμιο φεύγει από ΚΑΘΕ καλλιέργεια, αλλά μπαίνει
       ΜΙΑ φορά στην κάρτα — είναι το ίδιο κείμενο, δεν χρειάζεται να γραφτεί τέσσερις
       φορές σε αγρό με τέσσερις καλλιέργειες. */
    let _stageTrim = 0;
    for (const crop of cropsPackedArr) {
      const v = (crop.indicators || {}).crop_stage;
      if (!v || typeof v !== 'object' || !v.metadata) continue;
      const t = v.metadata.text;
      if (typeof t !== 'string' || t.indexOf(_SAG_STAGE_PREAMBLE) !== 0) continue;
      v.metadata.text = t.slice(_SAG_STAGE_PREAMBLE.length);
      v.metadata._mp = 1;   // «το προοίμιο ζει στην ταυτότητα του αγρού»
      _stageTrim++;
    }
    if (_stageTrim) _parts.push('crop_stage: ' + _SAG_STAGE_PREAMBLE.trim());

    if (_parts.length) _SAG_METHOD_CARD = { n: _parts.length, t: _parts.join('\\n') };""")

assert "\r" not in s
out = s.replace("\n", "\r\n").encode("utf-8")
tmp = os.path.join(tempfile.gettempdir(), "core_v50148.js")
open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
assert r.returncode == 0, "node --check: " + r.stderr[:1500]
open(P, "wb").write(out)
print("ok %d -> %d" % (len(raw), len(out)))
