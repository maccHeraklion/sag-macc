# -*- coding: utf-8 -*-
"""T-ECE-NOFALLBACK-01 (4/11/2026, απόφαση Michalis «ναι στο 3»): η εφεδρεία ECe = EC × 2,5 φεύγει από την κρίση.
Χωρίς πηγή (FAO-57: βαθμονόμηση ανά έδαφος, όχι σε ξηρό χώμα), και έδινε ψευδές πράσινο: ίδια ένδειξη 800 µS/cm, στο 15,1 % «Σοβαρή», στο 15 % «Καμία».
Όταν η αλυσίδα δεν βγάζει ECe σε κανένα βάθος: καμία κρίση ορίου, κανένα Ks, «Δεν υπολογίζεται σήμερα» με την αιτία.
Η κρίση από την προ-αρδευτική αναφορά (λόγος προς λίπασμα) δεν χρησιμοποιούσε το ×2,5 και μένει. Το όριο 15 % μένει. Λίτρα αμετάβλητα.
count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-ECE-NOFALLBACK-01" not in s
N = "\r\n"
def cut(a, b):
    i = s.index(a); j = s.index(b, i); return s[i:j + len(b)]
old_block = cut("            // ΕΦΕΔΡΕΙΑ: χωρίς μέτρηση υγρασίας (ή κάτω από το όριο ισχύος του", "' (ενδεικτικά ×2,5 — λείπει μέτρηση υγρασίας)';" + N)
new_block = ("            // T-ECE-NOFALLBACK-01: χωρίς αλυσίδα δεν υπάρχει ECe. Το παλιό ×2,5 δεν είχε πηγή και μπορούσε να δώσει ψευδές πράσινο." + N
  + "            const _eceNoWhy = _sagEceNoWhy(e1 !== null ? e1 : e2, e1 !== null ? _ecVwcE : _nE('soil_moisture2'), _ecSatE);" + N)
SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.173 · 2026-11-03';   // T-COVERED-WX-01",
   "const SAG_KERNEL_VERSION = 'v50.174 · 2026-11-04';   // T-ECE-NOFALLBACK-01 (χωρίς εφεδρεία ×2,5) · T-COVERED-WX-01", "έκδοση"),
  ("function _sagEcDailyVerdict(a) {" + N,
   "// T-ECE-NOFALLBACK-01: γιατί δεν βγαίνει ECe σήμερα, με λόγια αγρότη." + N
   + "function _sagEceNoWhy(ec, vwc, sat) {" + N
   + "  if (vwc === null || vwc === undefined) return { v: 'Λείπει η υγρασία', t: 'Η αλατότητα υπολογίζεται από την αγωγιμότητα μαζί με την υγρασία του εδάφους, και σήμερα δεν υπάρχει μέτρηση υγρασίας.' };" + N
   + "  if (!(Number(sat) > 0)) return { v: 'Δηλώστε τύπο εδάφους', t: 'Η αλατότητα χρειάζεται τον τύπο εδάφους. Δηλώστε τον στη φόρμα παραμετροποίησης.' };" + N
   + "  return { v: 'Πολύ ξερό για μέτρηση σήμερα', t: 'Σε τόσο ξερό έδαφος η αγωγιμότητα δεν δίνει αξιόπιστη αλατότητα. Θα ξαναϋπολογιστεί όταν το έδαφος υγρανθεί.' };" + N
   + "}" + N + N + "function _sagEcDailyVerdict(a) {" + N, "Σ1 αιτία"),
  (old_block, new_block, "Σ2 χωρίς ×2,5"),
  ("              : { v: (e1 !== null ? _eceEst(e1) : NaN), el: 'ρηχό', how: _eceHow });",
   "              : { v: NaN, el: 'ρηχό', how: '' });", "Σ3 χωρίς τιμή"),
  ("                eceMax: _eceMax, eceEst: _eceW.v, eceHow: _eceW.how,   // T-ECWORST-01",
   "                eceMax: _eceMax, eceEst: _eceW.v, eceHow: _eceW.how, noEce: Number.isFinite(_eceW.v) ? null : _eceNoWhy,   // T-ECWORST-01 · T-ECE-NOFALLBACK-01", "Σ4 πέρασμα αιτίας"),
  ("  if (!hasRef) {" + N + "    st = { v: 'Αναμονή αναφοράς', c: 'grey',",
   "  if (!hasRef && a.noEce) {" + N
   + "    st = { v: 'Δεν υπολογίζεται σήμερα', c: 'grey', t: a.noEce.v + '. ' + a.noEce.t };   // T-ECE-NOFALLBACK-01" + N
   + "  } else if (!hasRef) {" + N + "    st = { v: 'Αναμονή αναφοράς', c: 'grey',", "Σ5 κάρτα"),
  ("              if (Number.isFinite(_eceMax) && e1 !== null && !_deadDaily) {   // T-ECVERDICT-01 (Κ5): χωρίς Ks από νεκρό όργανο" + N,
   "              if (Number.isFinite(_eceMax) && e1 !== null && !_deadDaily && !Number.isFinite(_eceW.v)) {   // T-ECE-NOFALLBACK-01: χωρίς ECe, κανένα Ks" + N
   + "                _ecphIndicators.push({ variable: 'salinity_ks', value: null, metadata: { internal: true } });" + N
   + "                _ecphIndicators.push({ variable: 'salinity_stress', value: 'Μη διαθέσιμο'," + N
   + "                  metadata: { color: 'grey', text: _eceNoWhy.v + '. Σήμερα δεν εκτιμάται οσμωτική καταπόνηση.' } });" + N
   + "              } else if (Number.isFinite(_eceMax) && e1 !== null && !_deadDaily) {   // T-ECVERDICT-01 (Κ5): χωρίς Ks από νεκρό όργανο" + N, "Σ6 χωρίς Ks"),
]
for a, b, n in SUBS:
    c = s.count(a); assert c == 1, (n, c); s = s.replace(a, b); print("OK", n)
assert "×2,5" not in s.replace("το παλιό ×2,5", "").replace("Το παλιό ×2,5", "").replace("(χωρίς εφεδρεία ×2,5)", ""), "έμεινε ×2,5"
assert s.count("\n") == s.count("\r\n")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.close(fd)
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8"); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
