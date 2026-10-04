# -*- coding: utf-8 -*-
"""Πυρήνας v50.160 + widget · T-COVERED-TXT-02 (εντολή Μιχάλη 5/10: «όταν μια καλλιέργεια βρίσκεται μέσα σε
θερμοκήπιο όπως ο Κουτσάκης δεν πρέπει να δείχνει στις κάρτες ότι η βροχή μειώνει τη διάρκεια»).
ΕΠΙΒΕΒΑΙΩΜΕΝΟ: ο Κουτσάκης έχει covered_cultivation=true και ο πυρήνας ΗΔΗ μηδενίζει κάθε rain_height (T-COVERED-01)
— οι ΥΠΟΛΟΓΙΣΜΟΙ είναι σωστοί. Λάθος είναι ΤΡΙΑ κείμενα που δεν κοιτούσαν τη σημαία:
  1. πυρήνας · spray_protection_end_*: «… ημ. ακόμη. Η βροχή τη μειώνει.» (πάντα)·
  2. πυρήνας · _sagSensorFaults: rain24 διαβάζεται ΠΡΙΝ τον μηδενισμό → μετά από νεροποντή έξω, θερμοκήπιο με
     ρηχό αισθητήρα αμετάβλητο θα έπαιρνε «Βροχή X mm … ο αισθητήρας ίσως είναι εκτός ζώνης ύγρανσης»·
  3. widget · κάρτα παθογόνου: «🛡️ Προστατεύεται … Η βροχή μειώνει τη διάρκεια.» (πάντα).
Υπαίθριοι αγροί: ΑΜΕΤΑΒΛΗΤΟΙ. Καμία αγρονομική σταθερά. Κανένας υπολογισμός δόσης/ηλεκτροβάνας δεν αγγίζεται.
Πυρήνας CRLF, widget LF· count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"; W = "_dist-sagMain/index-7cbd9a4e.js"
rawC = io.open(C, "rb").read(); assert rawC[:3] != b"\xef\xbb\xbf" and rawC.count(b"\n") == rawC.count(b"\r\n")
rawW = io.open(W, "rb").read(); assert rawW[:3] != b"\xef\xbb\xbf" and b"\r\n" not in rawW
print("ΠΡΙΝ πυρήνας", hashlib.sha256(rawC).hexdigest()[:16], len(rawC), "· widget", hashlib.sha256(rawW).hexdigest()[:16], len(rawW))
c = rawC.decode("utf-8").replace("\r\n", "\n"); w = rawW.decode("utf-8")
assert "T-COVERED-TXT-02" not in c and "T-COVERED-TXT-02" not in w, "ήδη εφαρμοσμένο"
def sub(src, old, new, label):
    n = src.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; print("  OK", label); return src.replace(old, new)

c = sub(c, "const SAG_KERNEL_VERSION = 'v50.159 · 2026-10-04';", "const SAG_KERNEL_VERSION = 'v50.160 · 2026-10-05';", "έκδοση v50.160")
c = sub(c, "                  + ' ημ. ακόμη. Η βροχή τη μειώνει.' } };\n",
           "                  + ' ημ. ακόμη.' + (_SAG_COVERED_ACTIVE ? '' : ' Η βροχή τη μειώνει.') } };   // T-COVERED-TXT-02\n",
        "1 κάρτα λήξης προστασίας")
c = sub(c, "      rain24: Math.max(0, Number(_sagRawNum(data, 'rain_height_daily')) || 0),\n",
           "      // T-COVERED-TXT-02: τρέχει ΠΡΙΝ τον μηδενισμό του T-COVERED-01 — σε θερμοκήπιο η βροχή του σταθμού δεν\n"
           "      // βρέχει τον αισθητήρα, άρα δεν τεκμηριώνει «εκτός ζώνης ύγρανσης».\n"
           "      rain24: _SAG_COVERED_ACTIVE ? 0 : Math.max(0, Number(_sagRawNum(data, 'rain_height_daily')) || 0),\n",
        "2 έλεγχος αισθητήρων: rain24")
w = sub(w, 'children:"🛡️ Προστατεύεται από τον δηλωμένο ψεκασμό — "+_dl+(_dl===1?" ημέρα":" ημέρες")+" ακόμη (έως "+String(_pr.value||"")+"). Η βροχή μειώνει τη διάρκεια."})',
           'children:"🛡️ Προστατεύεται από τον δηλωμένο ψεκασμό — "+_dl+(_dl===1?" ημέρα":" ημέρες")+" ακόμη (έως "+String(_pr.value||"")+")."+(sagCoveredBox.v?"":" Η βροχή μειώνει τη διάρκεια.")/*T-COVERED-TXT-02*/})',
        "3 widget κάρτα παθογόνου")

outC = c.replace("\n", "\r\n").encode("utf-8"); outW = w.encode("utf-8")
for data, name in ((outC, "core.js"), (outW, "widget.js")):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, data); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"node --check {name}: {r.stderr[:400]}"
io.open(C, "wb").write(outC); io.open(W, "wb").write(outW)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(outC).hexdigest(), len(outC))
print("ΜΕΤΑ widget  ", hashlib.sha256(outW).hexdigest(), len(outW))
