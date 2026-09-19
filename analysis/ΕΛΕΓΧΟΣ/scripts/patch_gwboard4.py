# -*- coding: utf-8 -*-
"""T-GWNAMES-01 - ο πινακας δειχνει ΟΝΟΜΑΤΑ, και ξεχωριζει το βεβαιο απο το πιθανο.

Τα ονοματα βρεθηκαν με ΘΕΣΗ: το lrrlat/lrrlon του δικτυου vs η δηλωμενη θεση της
συσκευης-gateway. Το ονομα ζει στην ετικετα `comment`. ΔΕΝ ειναι ολα βεβαια, και
η σελιδα ΠΡΕΠΕΙ να το δειχνει - αλλιως ενα πιθανο ονομα διαβαζεται ως γεγονος.
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


# 1 . Ο χαρτης ονοματων + η συναρτηση που κρινει βεβαιο/πιθανο
sub(
    "var ACTILITY_SRC = '\u03b4\u03af\u03ba\u03c4\u03c5\u03bf Actility (\u03c0\u03b5\u03b4\u03af\u03bf LRR)';",
    "var ACTILITY_SRC = '\u03b4\u03af\u03ba\u03c4\u03c5\u03bf Actility (\u03c0\u03b5\u03b4\u03af\u03bf LRR)';\n"
    "\n"
    "/* \u2500\u2500 T-GWNAMES-01 \u00b7 \u03a4\u0391 \u039f\u039d\u039f\u039c\u0391\u03a4\u0391 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "   \u03a4\u03bf \u03b4\u03af\u03ba\u03c4\u03c5\u03bf \u03b4\u03af\u03bd\u03b5\u03b9 \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc (`lrrid`), \u03cc\u03c7\u03b9 \u03cc\u03bd\u03bf\u03bc\u03b1. \u03a4\u03bf \u03cc\u03bd\u03bf\u03bc\u03b1 \u03b6\u03b5\u03b9 \u03c3\u03c4\u03b7\u03bd \u03b5\u03c4\u03b9\u03ba\u03ad\u03c4\u03b1\n"
    "   `comment` \u03c4\u03b7\u03c2 \u03c3\u03c5\u03c3\u03ba\u03b5\u03c5\u03ae\u03c2-gateway. \u0397 \u03b3\u03ad\u03c6\u03c5\u03c1\u03b1 \u03b1\u03bd\u03ac\u03bc\u03b5\u03c3\u03ac \u03c4\u03bf\u03c5\u03c2 \u03b5\u03af\u03bd\u03b1\u03b9 \u03b7 \u0398\u0395\u03a3\u0397:\n"
    "   \u03c4\u03bf lrrlat/lrrlon \u03bb\u03ad\u03b5\u03b9 \u03a0\u039f\u03a5 \u03b5\u03af\u03bd\u03b1\u03b9 \u03c4\u03bf gateway. \u0394\u03b5\u03bd \u03ba\u03bb\u03b5\u03af\u03bd\u03b5\u03b9 \u03cc\u03bc\u03c9\u03c2 \u03ba\u03ac\u03b8\u03b5\n"
    "   \u03c0\u03b5\u03c1\u03af\u03c0\u03c4\u03c9\u03c3\u03b7: \u03c3\u03c4\u03bf \u03af\u03b4\u03b9\u03bf \u03c3\u03b7\u03bc\u03b5\u03af\u03bf \u03ba\u03ac\u03b8\u03bf\u03bd\u03c4\u03b1\u03b9 \u03c0\u03b5\u03c1\u03b9\u03c3\u03c3\u03cc\u03c4\u03b5\u03c1\u03b1 \u03b1\u03c0\u03cc \u03ad\u03bd\u03b1. \u0393\u03b9' \u03b1\u03c5\u03c4\u03cc\n"
    "   \u03ba\u03ac\u03b8\u03b5 \u03cc\u03bd\u03bf\u03bc\u03b1 \u03ad\u03c7\u03b5\u03b9 \u03c3\u03b7\u03bc\u03b1\u03af\u03b1 `q`: \u03cc\u03c4\u03b1\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9, \u03c4\u03bf \u03cc\u03bd\u03bf\u03bc\u03b1 \u03b5\u03af\u03bd\u03b1\u03b9 \u03a0\u0399\u0398\u0391\u039d\u039f\n"
    "   \u03ba\u03b1\u03b9 \u03b3\u03c1\u03ac\u03c6\u03b5\u03c4\u03b1\u03b9 \u03c9\u03c2 \u03c0\u03b9\u03b8\u03b1\u03bd\u03cc. \u0388\u03bd\u03b1 \u03c0\u03b9\u03b8\u03b1\u03bd\u03cc \u03cc\u03bd\u03bf\u03bc\u03b1 \u03c0\u03bf\u03c5 \u03b3\u03c1\u03ac\u03c6\u03b5\u03c4\u03b1\u03b9 \u03c3\u03ba\u03ad\u03c4\u03bf \u03b4\u03b9\u03b1\u03b2\u03ac\u03b6\u03b5\u03c4\u03b1\u03b9\n"
    "   \u03c9\u03c2 \u03b3\u03b5\u03b3\u03bf\u03bd\u03cc\u03c2 \u2014 \u03ba\u03b1\u03b9 \u03c4\u03cc\u03c4\u03b5 \u03ba\u03ac\u03c0\u03bf\u03b9\u03bf\u03c2 \u03c0\u03ac\u03b5\u03b9 \u03bb\u03ac\u03b8\u03bf\u03c2 \u03c7\u03c9\u03c1\u03b9\u03cc. */\n"
    "var GW_NAMES = {};\n"
    "\n"
    "function gwLabel(code) {\n"
    "  var e = GW_NAMES[code];\n"
    "  if (!e || !e.n) return { name: 'Gateway ' + code, sure: null };\n"
    "  if (e.q) return { name: 'Gateway ' + code, sure: false, guess: e.n };\n"
    "  return { name: e.n, sure: true };\n"
    "}",
)

# 2 . Το ονομα μπαινει στην καρτα του gateway
sub(
    "      ent.code = String(r.value);\n"
    "      if (!ent.name) ent.name = 'Gateway ' + ent.code;",
    "      ent.code = String(r.value);\n"
    "      var lab = gwLabel(ent.code);\n"
    "      ent.name = lab.name;\n"
    "      ent.nameSure = lab.sure;\n"
    "      ent.nameGuess = lab.guess || '';",
)

# 3 . Η γραμμη δειχνει τον κωδικο ΠΑΝΤΑ, και το πιθανο ονομα ως πιθανο
sub(
    "      + (g.sensors != null\n"
    "          ? '<br>' + esc(String(g.sensors))",
    "      + (g.code\n"
    "          ? '<br><span class=\"mono\">\u03ba\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2 ' + esc(g.code) + '</span>'\n"
    "            + (g.nameGuess\n"
    "                ? ' \u00b7 <span style=\"color:var(--yellow)\">\u03c0\u03b9\u03b8\u03b1\u03bd\u03cc\u03bd: ' + esc(g.nameGuess)\n"
    "                  + ' (\u03b1\u03bd\u03b5\u03c0\u03b9\u03b2\u03b5\u03b2\u03b1\u03af\u03c9\u03c4\u03bf)</span>'\n"
    "                : '')\n"
    "          : '')\n"
    "      + (g.sensors != null\n"
    "          ? '<br>' + esc(String(g.sensors))",
)

# 4 . Ο καταλογος ονοματων ερχεται ΠΡΙΝ απο τα δεδομενα, οπως και ο roster
sub(
    "      var ps = (w && w.display && w.display.parameters) || [];\n"
    "      for (var pi = 0; pi < ps.length; pi++) {\n"
    "        if (ps[pi] && ps[pi].key === 'fleet_roster') {\n"
    "          applyRoster(JSON.parse(String(ps[pi].value || '[]')));\n"
    "          break;\n"
    "        }\n"
    "      }",
    "      var ps = (w && w.display && w.display.parameters) || [];\n"
    "      for (var pi = 0; pi < ps.length; pi++) {\n"
    "        if (!ps[pi]) continue;\n"
    "        /* T-GWNAMES-01: \u03c4\u03b1 \u03bf\u03bd\u03cc\u03bc\u03b1\u03c4\u03b1 \u03a0\u03a1\u03a9\u03a4\u0391 \u2014 \u03b1\u03bb\u03bb\u03b9\u03ce\u03c2 \u03b7 \u03c0\u03c1\u03ce\u03c4\u03b7 \u03c0\u03b1\u03c1\u03c4\u03af\u03b4\u03b1\n"
    "           \u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03c9\u03bd \u03b8\u03b1 \u03ad\u03c6\u03c4\u03b9\u03b1\u03c7\u03bd\u03b5 \u03ba\u03ac\u03c1\u03c4\u03b5\u03c2 \u03bc\u03b5 \u03c3\u03ba\u03ad\u03c4\u03bf\u03c5\u03c2 \u03ba\u03c9\u03b4\u03b9\u03ba\u03bf\u03cd\u03c2. */\n"
    "        if (ps[pi].key === 'gateway_names') {\n"
    "          try { GW_NAMES = JSON.parse(String(ps[pi].value || '{}')) || {}; } catch (_eN) { GW_NAMES = {}; }\n"
    "        }\n"
    "      }\n"
    "      for (var pj = 0; pj < ps.length; pj++) {\n"
    "        if (ps[pj] && ps[pj].key === 'fleet_roster') {\n"
    "          applyRoster(JSON.parse(String(ps[pj].value || '[]')));\n"
    "          break;\n"
    "        }\n"
    "      }",
)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("ok")
