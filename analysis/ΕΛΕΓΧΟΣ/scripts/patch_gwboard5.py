# -*- coding: utf-8 -*-
"""T-GWHONEST-01 (σελιδα) — οι ετικετες των πλακιδιων ελεγαν περισσοτερα απο οσα ξερουμε.

«8 λειτουργουν» πανω απο «43 στολος» διαβαζεται «35 χαλασμενα». Ψεμα: 145 απο τις
220 συσκευες εστειλαν τις τελευταιες 2 ωρες, ολες μεσω gateway, αλλα μονο 38 λενε
ποιο. Αρα κρινουμε ΜΟΝΟ οσα εχουν μαρτυρα.
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


# 1 . Οι ετικετες των πλακιδιων
sub(u'<div class="l">\u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03bf\u03cd\u03bd</div>',
    u'<div class="l">\u03bc\u03b5 \u03b1\u03c0\u03cc\u03b4\u03b5\u03b9\u03be\u03b7 \u03b6\u03c9\u03ae\u03c2</div>')
sub(u'<div class="l">\u03ba\u03b1\u03b8\u03c5\u03c3\u03c4\u03b5\u03c1\u03bf\u03cd\u03bd</div>',
    u'<div class="l">\u03b1\u03c1\u03b1\u03b9\u03cc\u03c2 \u03bc\u03ac\u03c1\u03c4\u03c5\u03c1\u03b1\u03c2</div>')
sub(u'<div class="l">\u03b4\u03b5\u03bd \u03b1\u03c0\u03bf\u03ba\u03c1\u03af\u03bd\u03bf\u03bd\u03c4\u03b1\u03b9</div>',
    u'<div class="l">\u03c7\u03c9\u03c1\u03af\u03c2 \u03c0\u03c1\u03cc\u03c3\u03c6\u03b1\u03c4\u03bf \u03bc\u03ac\u03c1\u03c4\u03c5\u03c1\u03b1</div>')

# 2 . Κρατα τη συνοψη οταν φτανει (φερνει sensors_seen / sensors_total)
sub(
    u"    if (r.variable === 'gateway_row' || r.variable === 'gateway_summary'\n"
    u"        || r.variable === 'gateway_scan_state') {",
    u"    /* T-GWHONEST-01: \u03b7 \u03c3\u03cd\u03bd\u03bf\u03c8\u03b7 \u03c6\u03ad\u03c1\u03bd\u03b5\u03b9 \u03c4\u03b7\u03bd \u039a\u0391\u039b\u03a5\u03a8\u0397 \u2014 \u03c0\u03cc\u03c3\u03bf\u03c5\u03c2 \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03b5\u03c2\n"
    u"       \u03b2\u03bb\u03ad\u03c0\u03bf\u03c5\u03bc\u03b5 \u03b1\u03c0\u03cc \u03c0\u03cc\u03c3\u03bf\u03c5\u03c2. \u03a7\u03c9\u03c1\u03af\u03c2 \u03b1\u03c5\u03c4\u03cc \u03bf \u03b1\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2 \u03c4\u03c9\u03bd \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03c9\u03bd \u03bb\u03ad\u03b5\u03b9 \u03c8\u03ad\u03bc\u03b1\u03c4\u03b1. */\n"
    u"    if (r.variable === 'gateway_summary' && r.metadata) {\n"
    u"      var sm = r.metadata;\n"
    u"      if (!state.summaryTime || Date.parse(r.time) >= Date.parse(state.summaryTime)) {\n"
    u"        state.summaryTime = r.time;\n"
    u"        state.seen = Number(sm.sensors_seen);\n"
    u"        state.totalSensors = Number(sm.sensors_total);\n"
    u"      }\n"
    u"    }\n"
    u"\n"
    u"    if (r.variable === 'gateway_row' || r.variable === 'gateway_summary'\n"
    u"        || r.variable === 'gateway_scan_state') {",
)

# 3 . Το υποσελιδο λεει την ΚΑΛΥΨΗ πρωτα απ' ολα
sub(
    u"    if (net > 0 && list.length > net) {",
    u"    /* T-GWHONEST-01: \u03c4\u03bf \u03c0\u03c1\u03ce\u03c4\u03bf \u03c0\u03c1\u03ac\u03b3\u03bc\u03b1 \u03c0\u03bf\u03c5 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03b4\u03b9\u03b1\u03b2\u03ac\u03c3\u03b5\u03b9 \u03ba\u03ac\u03c0\u03bf\u03b9\u03bf\u03c2. */\n"
    u"    if (net > 0 && isFinite(state.seen) && isFinite(state.totalSensors)\n"
    u"        && state.totalSensors > 0) {\n"
    u"      t += ' \u039a\u0391\u039b\u03a5\u03a8\u0397: \u03b7 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1 \u03c7\u03c4\u03af\u03b6\u03b5\u03c4\u03b1\u03b9 \u03b1\u03c0\u03cc ' + state.seen + ' \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03b5\u03c2 \u03b1\u03c0\u03cc '\n"
    u"        + state.totalSensors + '. \u039c\u03cc\u03bd\u03bf \u03b1\u03c5\u03c4\u03bf\u03af \u03b1\u03bd\u03b1\u03c6\u03ad\u03c1\u03bf\u03c5\u03bd \u03c0\u03bf\u03b9\u03bf gateway \u03c4\u03bf\u03c5\u03c2 \u03c0\u03b1\u03c1\u03ad\u03bb\u03b1\u03b2\u03b5. '\n"
    u"        + '\u038c\u03c3\u03b1 gateways \u03b5\u03be\u03c5\u03c0\u03b7\u03c1\u03b5\u03c4\u03bf\u03cd\u03bd \u03c4\u03bf\u03c5\u03c2 \u03c5\u03c0\u03cc\u03bb\u03bf\u03b9\u03c0\u03bf\u03c5\u03c2 \u0394\u0395\u039d \u03ba\u03c1\u03af\u03bd\u03bf\u03bd\u03c4\u03b1\u03b9 \u03b5\u03b4\u03ce: \u03b5\u03af\u03bd\u03b1\u03b9 '\n"
    u"        + '\u0391\u039f\u03a1\u0391\u03a4\u0391, \u039f\u03a7\u0399 \u03c7\u03b1\u03bb\u03b1\u03c3\u03bc\u03ad\u03bd\u03b1.';\n"
    u"    }\n"
    u"    if (c.red > 0) {\n"
    u"      t += ' \u03a4\u03bf \u00ab\u03c7\u03c9\u03c1\u03af\u03c2 \u03c0\u03c1\u03cc\u03c3\u03c6\u03b1\u03c4\u03bf \u03bc\u03ac\u03c1\u03c4\u03c5\u03c1\u03b1\u00bb \u0394\u0395\u039d \u03c3\u03b7\u03bc\u03b1\u03af\u03bd\u03b5\u03b9 \u03c7\u03b1\u03bb\u03b1\u03c3\u03bc\u03ad\u03bd\u03bf gateway \u2014 '\n"
    u"        + '\u03c3\u03b7\u03bc\u03b1\u03af\u03bd\u03b5\u03b9 \u03cc\u03c4\u03b9 \u03bf\u03b9 \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03b5\u03c2 \u03c0\u03bf\u03c5 \u03c4\u03bf \u03ba\u03b1\u03c4\u03bf\u03bd\u03bf\u03bc\u03ac\u03b6\u03bf\u03c5\u03bd \u03c3\u03c4\u03b1\u03bc\u03ac\u03c4\u03b7\u03c3\u03b1\u03bd \u03bd\u03b1 \u03c3\u03c4\u03ad\u03bb\u03bd\u03bf\u03c5\u03bd.';\n"
    u"    }\n"
    u"    if (net > 0 && list.length > net) {",
)

# 4 . Και το μηνυμα κατω απο τον τιτλο
sub(
    u"\u0398\u03ad\u03c3\u03b7, \u03c5\u03c0\u03b5\u03cd\u03b8\u03c5\u03bd\u03bf\u03c2 \u03ba\u03b1\u03b9 \u03ba\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1\u03c2.",
    u"\u0398\u03ad\u03c3\u03b7 \u03ba\u03b1\u03b9 \u03b1\u03c0\u03cc\u03b4\u03b5\u03b9\u03be\u03b7 \u03b6\u03c9\u03ae\u03c2 \u2014 \u03bc\u03cc\u03bd\u03bf \u03b3\u03b9\u03b1 \u03cc\u03c3\u03b1 gateways \u03ad\u03c7\u03bf\u03c5\u03bd \u03bc\u03ac\u03c1\u03c4\u03c5\u03c1\u03b1.",
)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("ok")
