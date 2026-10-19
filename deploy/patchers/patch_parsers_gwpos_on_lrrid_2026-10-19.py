# -*- coding: utf-8 -*-
# T-GWID-03 (19/10/2026, Μιχάλης: «ναι προχώρα με τον τρόπο 1, δοκίμασε πρώτα στον SE02»).
# Η θέση ενός gateway είναι ΣΤΑΘΕΡΗ: δεν αξίζει δική της εγγραφή σε κάθε πακέτο (lrrlat + lrrlon = +2 εγγραφές/uplink,
# με τον χώρο του λογαριασμού στο 91 %). Τρόπος 1: η θέση μπαίνει ως `location` ΠΑΝΩ στην εγγραφή `lrrid` που ήδη
# γράφεται (T-GWID-01). Κατά την τεκμηρίωση TagoIO (Data Records) η location είναι μέρος της ΙΔΙΑΣ εγγραφής → 0 επιπλέον.
# lrrlat/lrrlon/lrrrssi/lrrsnr ΜΕΝΟΥΝ στο ignore_vars. Μπαίνει ένα μπλοκ ΑΚΡΙΒΩΣ πριν από τη δήλωση ignore_vars.
# Εφαρμόζεται ΜΟΝΟ σε αρχεία byte-ίσα με τον ΖΩΝΤΑΝΟ connector (μετά το T-GWID-01, επαληθευμένο 19/10 16:30 UTC).
import sys, io, hashlib

LIVE_SHA16 = {
    "payload_parsers/dragino_se02_parser.js": "75917c86626e776f",   # 67adaadd SE02 (1 ενεργή συσκευή)
    "payload_parsers/dragino_se0x_parser.js": "cc12d6cf4a7130b9",   # 685bafd3 SE0X (24)
    "payload_parsers/dragino_se01_parser.js": "996ae048dbe84e76",   # 69293aaf SE01 (32)
}
BLOCK = """// T-GWID-03: η θέση του gateway (lrrlat/lrrlon) μπαίνει ΠΑΝΩ στην εγγραφή lrrid — καμία νέα εγγραφή.
const _sagGwId = payload.find(x => x.variable === 'lrrid');
const _sagGwLat = payload.find(x => x.variable === 'lrrlat');
const _sagGwLon = payload.find(x => x.variable === 'lrrlon');
if (_sagGwId && _sagGwLat && _sagGwLon) {
  const la = Number(_sagGwLat.value), lo = Number(_sagGwLon.value);
  if (Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0)) _sagGwId.location = { lat: la, lng: lo };
}
"""
ANCHOR = "const ignore_vars = ["
only = sys.argv[1:] or list(LIVE_SHA16)
for path in only:
    raw = io.open(path, "r", encoding="utf-8", newline="").read()
    lf = raw.lstrip("﻿").replace("\r\n", "\n")
    h = hashlib.sha256(lf.encode("utf-8")).hexdigest()[:16]
    if h != LIVE_SHA16[path]:
        sys.exit("FAIL %s: sha %s != live %s" % (path, h, LIVE_SHA16[path]))
    if lf.count(ANCHOR) != 1 or "_sagGw" in lf:
        sys.exit("FAIL %s: anchor not exactly once, or block already present" % path)
    i = lf.index(ANCHOR)
    if i != 0 and lf[i - 1] != "\n":
        sys.exit("FAIL %s: anchor not at line start" % path)
    out = lf[:i] + BLOCK + lf[i:]
    io.open(path, "w", encoding="utf-8", newline="").write(out)
    print("OK %s new sha %s" % (path, hashlib.sha256(out.encode("utf-8")).hexdigest()[:16]))
