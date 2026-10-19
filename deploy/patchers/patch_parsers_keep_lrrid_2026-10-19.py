# -*- coding: utf-8 -*-
# T-GWID-01 (19/10/2026, Μιχάλης: «ναι, ετοίμασε τους parsers, δοκίμασε πρώτα σε έναν»).
# Οι parsers των connectors έχουν το 'lrrid' στη λίστα ignore_vars → η ταυτότητα gateway (ποιο gateway του
# Actility παρέλαβε το πακέτο) πετιέται στη λήψη. ΜΟΝΗ αλλαγή: βγαίνει το 'lrrid' από τη λίστα.
# Τα lrrlat/lrrlon/lrrrssi/lrrsnr ΜΕΝΟΥΝ εκτός (+1 εγγραφή ανά uplink, όχι +5).
# Εφαρμόζεται ΜΟΝΟ σε αρχεία που είναι byte-ίσα με τον ΖΩΝΤΑΝΟ connector (μετρημένο 19/10 15:46 UTC, probe v2).
import sys, io, hashlib

LIVE_SHA16 = {  # sha256 (LF, χωρίς BOM) του ζωντανού κώδικα connector, πρώτα 16
    "payload_parsers/dragino_se02_parser.js": "b4da5d81a6f31a11",   # 67adaadd «Dragino SE02 - CyRIC IoT - MACC Parser» (3 συσκευές, 1 ενεργή)
    "payload_parsers/dragino_se0x_parser.js": "bd5211ef56f04fe9",   # 685bafd3 «Dragino SE0X - CyRIC IoT - MACC Parser» (24)
    "payload_parsers/dragino_se01_parser.js": "5eeaa071270a4e96",   # 69293aaf «Dragino SE01 - Cyric IoT - MACC Parser» (32)
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
    start = lf.index("const ignore_vars = [")   # ΟΧΙ το πρώτο «ignore_vars»: μπορεί να είναι σε σχόλιο
    end = lf.index("]", start)
    block = lf[start:end + 1]
    cands = ["'lrrid', ", "'lrrid',", ", 'lrrid'", ",'lrrid'"]
    hit = [c for c in cands if block.count(c) == 1]
    if not hit or block.count("'lrrid'") != 1:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: το 'lrrid' δεν βρέθηκε ακριβώς μία φορά στη λίστα" % path)
    nb = block.replace(hit[0], "", 1)
    out = lf[:start] + nb + lf[end + 1:]
    assert "'lrrid'" not in out[start:start + len(nb)]
    io.open(path, "w", encoding="utf-8", newline="").write(out)
    print("OK %s · έφυγε το %r · νέο sha %s" % (path, hit[0], hashlib.sha256(out.encode("utf-8")).hexdigest()[:16]))
