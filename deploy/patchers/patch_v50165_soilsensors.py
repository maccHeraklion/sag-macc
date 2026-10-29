# -*- coding: utf-8 -*-
"""Πυρήνας v50.165 · T-SOILREF-02 — η λίστα των σονδών εδάφους για τη ΦΟΡΜΑ (δήλωση αισθητήρα απόφασης).
Michalis 29/10: «φόρμα» — η δήλωση του αισθητήρα απόφασης (T-SOILREF-01) γίνεται από τη φόρμα του αγρού. Η φόρμα όμως
ΔΕΝ βλέπει τις συσκευές του αγρού (φορτώνει μόνο μεταβλητές της συσκευής-αγρού). Ο πυρήνας τις ξέρει.
  Λ1 _sagApplySoilRef κρατά τους «ανταγωνιστές» (σόνδες που μετρούν το ΙΔΙΟ βάθος) στο data._sagSoilCand = [{i, n}],
     ΑΝΕΞΑΡΤΗΤΑ από το αν κάποια δίνει έγκυρη υγρασία αυτή την ώρα (σταθερή λίστα, χωρίς αναβοσβήσματα).
  Λ2 _sagSyncSoilSensors: μεταβλητή `soil_sensors` στον αγρό (value = πλήθος, metadata.list = [{i, n}]) — γράφεται ΜΟΝΟ
     όταν η λίστα ΑΛΛΑΖΕΙ (σύγκριση με την τελευταία εγγραφή). Ποτέ σε αγρό χωρίς ανταγωνισμό. Ανάγνωση: κάθε ώρα μόνο
     στους αγρούς με ανταγωνισμό· μία φορά την ημέρα σε όλους (για να σβήσει λίστα αγρού που έχασε σόνδα).
     ΓΙΑΤΙ ΣΠΑΝΙΑ: η φόρμα φορτώνει με qty 500 — μια ωριαία μεταβλητή θα μπορούσε να σπρώξει τη ρύθμιση έξω από το
     παράθυρο (η τεκμηρίωση δεν λέει αν το qty είναι ανά μεταβλητή). Με εγγραφή μόνο στην αλλαγή, το ρίσκο είναι μηδέν.
  Λ3 έκδοση v50.165. Καμία αλλαγή σε τιμές, bundle ή επιλογή αισθητήρα.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"
raw = io.open(C, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
assert "\r\n" in s and s.count("\n") == s.count("\r\n"), "ο πυρήνας πρέπει να είναι καθαρό CRLF"
print("ΠΡΙΝ πυρήνας", hashlib.sha256(raw).hexdigest(), len(raw))
assert "T-SOILREF-02" not in s, "ήδη εφαρμοσμένο"
s = s.replace("\r\n", "\n")
def sub(old, new, label, n=1):
    global s; c = s.count(old); assert c == n, f"{label}: βρέθηκε {c} φορές (αναμενόταν {n})"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.164 · 2026-10-29';", "const SAG_KERNEL_VERSION = 'v50.165 · 2026-10-29';", "Λ3 έκδοση")
sub("    if (names.length < 2) return;\n    const score = (d) => {",
    "    if (names.length < 2) return;\n"
    "    // T-SOILREF-02: οι «ανταγωνιστές» για τη φόρμα — ανεξάρτητα από την εγκυρότητα αυτής της ώρας.\n"
    "    data._sagSoilCand = names.map(n => ({ i: devs[n]._id, n }));\n"
    "    const score = (d) => {", "Λ1 ανταγωνιστές")
SYNC = r"""
// T-SOILREF-02 (v50.165): η λίστα των σονδών που μετρούν το ΙΔΙΟ βάθος, για τη φόρμα του αγρού (δήλωση
// αισθητήρα απόφασης). Γράφεται ΜΟΝΟ όταν αλλάζει — η φόρμα φορτώνει με qty 500 και μια συχνή μεταβλητή
// θα μπορούσε να σπρώξει τη ρύθμιση έξω από το παράθυρο.
async function _sagSyncSoilSensors(dev, data, fieldName, dailyTich) {
  const cand = (data && Array.isArray(data._sagSoilCand)) ? data._sagSoilCand : [];
  if (!cand.length && !dailyTich) return false;          // χωρίς ανταγωνισμό: έλεγχος μία φορά την ημέρα
  const keyOf = (l) => (Array.isArray(l) ? l : []).map(c => String(c && c.i) + ':' + String(c && c.n)).join('|');
  const r = await dev.getData({ variables: ['soil_sensors'], qty: 1 });
  const p = Array.isArray(r) ? r[0] : null;
  if (!p && !cand.length) return false;                  // ποτέ ανταγωνισμός: καμία εγγραφή
  if (p && keyOf(p.metadata && p.metadata.list) === keyOf(cand)) return false;   // ίδια λίστα
  await dev.sendData([{ variable: 'soil_sensors', value: cand.length, metadata: { list: cand } }]);
  console.log('[' + (fieldName || '—') + '] T-SOILREF-02: λίστα σονδών για τη φόρμα → ' + (cand.map(c => c.n).join(', ') || '(καμία)'));
  return true;
}

// T-LIGHTMERGE-01: ημερήσια ολοκληρώματα φωτός."""
sub("\n// T-LIGHTMERGE-01: ημερήσια ολοκληρώματα φωτός.", SYNC, "Λ2 _sagSyncSoilSensors")
sub("        await dev_to_send_meas.sendData(packedIndicators);\n",
    "        await dev_to_send_meas.sendData(packedIndicators);\n"
    "        // T-SOILREF-02: λίστα σονδών για τη φόρμα — μόνο όταν αλλάζει· ποτέ δεν ρίχνει τον αγρό.\n"
    "        try { await _sagSyncSoilSensors(dev_to_send_meas, measurements?.data, fieldName, dailyTich); } catch (_eSS) {}\n",
    "Λ2 κλήση μετά το bundle")
out = s.replace("\n", "\r\n").encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(C, "wb").write(out)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(out).hexdigest(), len(out))
