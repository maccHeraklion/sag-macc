# -*- coding: utf-8 -*-
# T-GWID-03 (19/10/2026, Μιχάλης: «ναι ετοίμασε το lrrlat/lrrlon, δοκίμασε πρώτα σε έναν»).
# Μετά το T-GWID-01 οι parsers κρατούν το lrrid (ΠΟΙΟ gateway) αλλά πετούν lrrlat/lrrlon (ΠΟΥ είναι). Νέοι κωδικοί
# LRR (1000EC0C Σκοτίνα, 1000EC3A Όρμα, 10013732 Βόλτα, 1000F991) μένουν χωρίς θέση και ο χάρτης δεν τους ενώνει
# με τη συσκευή-gateway. ΜΟΝΗ αλλαγή: βγαίνουν τα 'lrrlat' και 'lrrlon' από το ignore_vars. lrrrssi/lrrsnr μένουν εκτός.
# Εφαρμόζεται ΜΟΝΟ σε αρχεία byte-ίσα με τον ΖΩΝΤΑΝΟ connector (μετά το T-GWID-01, επαληθευμένο 19/10 16:30 UTC).
import sys, io, hashlib

LIVE_SHA16 = {
    "payload_parsers/dragino_se02_parser.js": "75917c86626e776f",   # 67adaadd SE02 (1 ενεργή συσκευή)
    "payload_parsers/dragino_se0x_parser.js": "cc12d6cf4a7130b9",   # 685bafd3 SE0X (24)
    "payload_parsers/dragino_se01_parser.js": "996ae048dbe84e76",   # 69293aaf SE01 (32)
}
only = sys.argv[1:] or list(LIVE_SHA16)
for path in only:
    raw = io.open(path, "r", encoding="utf-8", newline="").read()
    lf = raw.lstrip("﻿").replace("\r\n", "\n")
    h = hashlib.sha256(lf.encode("utf-8")).hexdigest()[:16]
    if h != LIVE_SHA16[path]:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: sha %s ≠ ζωντανό %s — ΔΕΝ αλλάζει" % (path, h, LIVE_SHA16[path]))
    if lf.count("const ignore_vars = [") != 1:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: η δήλωση ignore_vars δεν είναι ακριβώς μία" % path)
    start = lf.index("const ignore_vars = [")
    end = lf.index("]", start)
    block = lf[start:end + 1]
    nb = block
    for name in ("lrrlat", "lrrlon"):
        q = "'%s'" % name
        if nb.count(q) != 1:
            sys.exit("ΑΠΟΤΥΧΙΑ %s: το %s δεν βρέθηκε ακριβώς μία φορά στη λίστα" % (path, q))
        hit = [c for c in (q + ", ", q + ",", ", " + q, "," + q) if nb.count(c) == 1]
        if not hit:
            sys.exit("ΑΠΟΤΥΧΙΑ %s: δεν βρέθηκε ασφαλές σημείο αφαίρεσης για %s" % (path, q))
        nb = nb.replace(hit[0], "", 1)
    for keep in ("'lrrrssi'", "'lrrsnr'"):
        if keep not in nb:
            sys.exit("ΑΠΟΤΥΧΙΑ %s: χάθηκε το %s" % (path, keep))
    out = lf[:start] + nb + lf[end + 1:]
    io.open(path, "w", encoding="utf-8", newline="").write(out)
    print("OK %s · νέο sha %s" % (path, hashlib.sha256(out.encode("utf-8")).hexdigest()[:16]))
