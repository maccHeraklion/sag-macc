# -*- coding: utf-8 -*-
"""T-GWBOARD-ACTILITY-01 (2) - η συσκευη-ΔΟΧΕΙΟ δεν ειναι gateway.

Οι γραμμες gateway_row γραφονται ΟΛΕΣ στη συσκευη εποπτειας. Η ingest() κραταει
εγγραφη ανα συσκευη-προελευση, αρα η ιδια η συσκευη εποπτειας θα εμφανιζοταν ως
ενα επιπλεον "(χωρις ονομα)" κουτι. Δεν ειναι gateway - ειναι ο ταχυδρομος.
"""
import io

P = (u"C:/Users/Katharak/OneDrive - \u0395\u03a0\u0399\u039c\u0395\u039b\u0397\u03a4\u0397\u03a1\u0399\u039f "
     u"\u0397\u03a1\u0391\u039a\u039b\u0395\u0399\u039f\u03a5/\u0395\u03c0\u03b9\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 "
     u"\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1\u03c2/MACC/custom_html_files/gateway-board.html")
s = io.open(P, encoding="utf-8").read()
assert s.count("\r\n") == 0, "CRLF!"


def sub(old, new, count=1):
    global s
    c = s.count(old)
    assert c == count, "anchor %d != %d: %r" % (c, count, old[:70])
    s = s.replace(old, new)


# 1 . Σημαδεψε τη συσκευη-δοχειο ΠΡΙΝ φτιαχτει η καρτα του gateway.
sub(
    "    if (r.variable === 'gateway_row' && r.value) {\n"
    "      var gid = 'lrr:' + String(r.value);",
    "    if (r.variable === 'gateway_row' || r.variable === 'gateway_summary'\n"
    "        || r.variable === 'gateway_scan_state') {\n"
    "      /* \u0397 \u03c3\u03c5\u03c3\u03ba\u03b5\u03c5\u03ae \u03c0\u03bf\u03c5 \u03bc\u03b5\u03c4\u03b1\u03c6\u03ad\u03c1\u03b5\u03b9 \u03c4\u03b9\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ad\u03c2 \u0394\u0395\u039d \u03b5\u03af\u03bd\u03b1\u03b9 gateway. \u0391\u03bd \u03b4\u03b5\u03bd \u03c4\u03bf\n"
    "         \u03c3\u03b7\u03bc\u03b1\u03b4\u03ad\u03c8\u03bf\u03c5\u03bc\u03b5, \u03b8\u03b1 \u03b5\u03bc\u03c6\u03b1\u03bd\u03b9\u03b6\u03cc\u03c4\u03b1\u03bd \u03c9\u03c2 \u03ad\u03bd\u03b1 \u03b5\u03c0\u03b9\u03c0\u03bb\u03ad\u03bf\u03bd \u00ab\u03ac\u03b3\u03bd\u03c9\u03c3\u03c4\u03bf\u00bb \u03ba\u03bf\u03c5\u03c4\u03af. */\n"
    "      e.container = true;\n"
    "    }\n"
    "\n"
    "    if (r.variable === 'gateway_row' && r.value) {\n"
    "      var gid = 'lrr:' + String(r.value);",
)

# 2 . Και μην τη βαζεις στον καταλογο.
sub(
    "function sortedList() {\n"
    "  var out = [];\n"
    "  for (var k in state.gw) {\n"
    "    if (Object.prototype.hasOwnProperty.call(state.gw, k)) out.push(state.gw[k]);\n"
    "  }",
    "function sortedList() {\n"
    "  var out = [];\n"
    "  for (var k in state.gw) {\n"
    "    if (!Object.prototype.hasOwnProperty.call(state.gw, k)) continue;\n"
    "    /* T-GWBOARD-ACTILITY-01: \u03b7 \u03c3\u03c5\u03c3\u03ba\u03b5\u03c5\u03ae-\u03b4\u03bf\u03c7\u03b5\u03af\u03bf \u03bc\u03ad\u03bd\u03b5\u03b9 \u03b5\u03ba\u03c4\u03cc\u03c2. */\n"
    "    if (state.gw[k].container) continue;\n"
    "    out.push(state.gw[k]);\n"
    "  }",
)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("ok")
