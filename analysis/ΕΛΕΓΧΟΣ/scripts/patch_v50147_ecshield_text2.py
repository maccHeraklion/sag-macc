# -*- coding: utf-8 -*-
"""πυρήνας v50.147 · T-ECSHIELD-TEXT-02 — η ασπίδα κειμένων ΔΕΝ δούλευε στη φάση (α).

ΤΟ ΕΥΡΗΜΑ (probe 19/9 16:28, bundles του παλμού 16:20, ΠΡΩΤΟΣ με v50.145):
  ΣΥΝΟΛΟ κομμένων κειμένων 185 -> 180. Και οι 8 αγροί ΕΞΑΚΟΛΟΥΘΟΥΝ να χάνουν την
  ετυμηγορία αλατότητας: ΚΕΚ, Ρηγάκης, Κουκιά, Βενζινάδικο, Μεγάλη Ντάμα, Καμπιτάκης,
  ΚΑΜΠΑΝΗΣ, ΚΥΔΩΝ. Η v50.144 ΔΕΝ πέτυχε τον σκοπό της.

Η ΑΙΤΙΑ: η v50.144 έβαλε την ασπίδα στην ΤΑΞΙΝΟΜΗΣΗ των θυμάτων της φάσης (α) —
αλλά ο βρόχος σβήνει σε ΠΑΡΤΙΔΕΣ των 8 (μετά 16, 32, 64, 128) και ΜΕΤΑ ξανασυμπιέζει.
Η ταξινόμηση είναι άχρηστη αν η πρώτη κιόλας παρτίδα καταπίνει ΟΛΗ τη λίστα.
ΚΑΜΠΑΝΗΣ: 7 παλιά θύματα συνολικά -> μία παρτίδα των 8 τα σβήνει όλα μαζί, μαζί και
το προστατευμένο `salinity_stress`, πριν καν μετρηθεί αν χρειαζόταν.

Η ΔΙΟΡΘΩΣΗ: ίδιος φρουρός συνόρου με τη φάση (β), που τον είχε ΗΔΗ σωστά.
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


sub("const SAG_KERNEL_VERSION = 'v50.146 · 2026-09-19';",
    "const SAG_KERNEL_VERSION = 'v50.147 · 2026-09-19';")

sub("""    let _i = 0;
    while (_i < _victims.length && compressedData.length > _SAG_BUNDLE_MAX_B64) {
      const _end = Math.min(_victims.length, _i + _batch);
      for (; _i < _end; _i++) {""",
"""    /* ══ T-ECSHIELD-TEXT-02 (v50.147 · 19/9/2026) · Η ΑΣΠΙΔΑ ΤΗΣ v50.144 ΔΕΝ ΔΟΥΛΕΥΕ ══
       ΜΕΤΡΗΜΕΝΟ 19/9 16:28 UTC (bundles του παλμού 16:20, ο ΠΡΩΤΟΣ με v50.145): τα
       κομμένα κείμενα πήγαν 185 -> 180, και **και οι 8 αγροί χάνουν ΑΚΟΜΗ την
       ετυμηγορία αλατότητας** (ΚΕΚ, Ρηγάκης, Κουκιά, Βενζινάδικο, Μεγάλη Ντάμα,
       Καμπιτάκης, ΚΑΜΠΑΝΗΣ, ΚΥΔΩΝ). Η ασπίδα της v50.144 ΔΕΝ έπιασε.

       Η ΑΙΤΙΑ: η v50.144 έβαλε την ασπίδα στην **ταξινόμηση** των θυμάτων — αλλά ο
       βρόχος σβήνει σε **παρτίδες** των 8 (μετά 16, 32, 64, 128) και ΜΕΤΑ ξανασυμπιέζει.
       Η ταξινόμηση είναι άχρηστη αν η πρώτη κιόλας παρτίδα καταπίνει ΟΛΗ τη λίστα.
       ΚΑΜΠΑΝΗΣ (μετρημένο): 7 παλιά θύματα συνολικά, μία παρτίδα των 8 τα σβήνει ΟΛΑ
       μαζί — μαζί και το προστατευμένο `salinity_stress` — πριν καν μετρηθεί αν
       χρειαζόταν.

       Η φάση (β) είχε ΗΔΗ τον σωστό φρουρό συνόρου· η (α) δεν τον πήρε ποτέ. ΕΔΩ
       μπαίνει ο ίδιος: η παρτίδα ΣΤΑΜΑΤΑ στο σύνορο της ασπίδας, και μέσα στην ασπίδα
       πάμε ΕΝΑ-ΕΝΑ με επανασυμπίεση, ώστε να σβήσει ακριβώς όσα χρειάζονται και ούτε
       ένα παραπάνω. Το κόστος (~5 ms ανά επανασυμπίεση) πληρώνεται ΜΟΝΟ όταν έχουμε
       ήδη μπει στην ασπίδα, δηλαδή σπάνια. */
    let _i = 0;
    while (_i < _victims.length && compressedData.length > _SAG_BUNDLE_MAX_B64) {
      if (_sagShielded(_victims[_i].k)) _batch = 1;   // στην ασπίδα: ένα-ένα, όχι παρτίδες
      let _end = Math.min(_victims.length, _i + _batch);
      // η παρτίδα ΔΕΝ περνά το σύνορο της ασπίδας: ξαναμετράμε πριν αγγίξουμε προστατευμένο
      if (!_sagShielded(_victims[_i].k)) { let _q = _i; while (_q < _end && !_sagShielded(_victims[_q].k)) _q++; _end = _q; }
      for (; _i < _end; _i++) {""")

sub("""      compressedData = compressFieldBundle({ shared: sharedPacked, crops: cropsPackedArr });
      _batch = Math.min(128, _batch * 2);
    }
    // (β) ολόκληροι δείκτες""",
"""      compressedData = compressFieldBundle({ shared: sharedPacked, crops: cropsPackedArr });
      if (_batch > 1) _batch = Math.min(128, _batch * 2);   // T-ECSHIELD-TEXT-02: στην ασπίδα μένει 1
    }
    // (β) ολόκληροι δείκτες""")

assert "\r" not in s
out = s.replace("\n", "\r\n").encode("utf-8")
tmp = os.path.join(tempfile.gettempdir(), "core_v50147.js")
open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
assert r.returncode == 0, "node --check: " + r.stderr[:1500]
open(P, "wb").write(out)
print("ok %d -> %d" % (len(raw), len(out)))
