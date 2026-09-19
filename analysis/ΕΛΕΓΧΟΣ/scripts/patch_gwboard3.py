# -*- coding: utf-8 -*-
"""T-GWBOARD-ACTILITY-01 (3) - τα ΑΔΗΛΩΤΑ πανε ΤΕΛΕΥΤΑΙΑ.

Βρεθηκε με δοκιμη στον πραγματικο συνδυασμο (33 καταλογος + 10 γραμμες δικτυου):
τα αδηλωτα κρινονταν "grey", και το grey εχει ταξη 1, αρα καθονταν ΠΑΝΩ απο τα
πρασινα. Αποτελεσμα: οι 33 σιωπηλες συσκευες εθαβαν τα gateways που ΟΝΤΩΣ
λειτουργουν. "Δεν μιλησε ποτε" ΔΕΝ ειναι επειγον - "μιλησε και σταματησε" ειναι.
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


sub(
    "  var rank = { red: 0, grey: 1, yellow: 2, green: 3 };\n"
    "  out.sort(function (a, b) {\n"
    "    var ra = rank[statusOf(a).cls], rb = rank[statusOf(b).cls];\n"
    "    if (ra !== rb) return ra - rb;",
    "  var rank = { red: 0, grey: 1, yellow: 2, green: 3 };\n"
    "  /* T-GWBOARD-ACTILITY-01: \u03c4\u03bf \u03b1\u03b4\u03ae\u03bb\u03c9\u03c4\u03bf \u03c0\u03ac\u03b5\u03b9 \u03a4\u0395\u039b\u0395\u03a5\u03a4\u0391\u0399\u039f. \u039a\u03c1\u03b9\u03bd\u03cc\u03c4\u03b1\u03bd \u03c9\u03c2 \u00ab\u03ac\u03b3\u03bd\u03c9\u03c3\u03c4\u03bf\u00bb\n"
    "     (\u03c4\u03ac\u03be\u03b7 1) \u03ba\u03b1\u03b9 \u03ad\u03c4\u03c3\u03b9 \u03bf\u03b9 33 \u03c3\u03b9\u03c9\u03c0\u03b7\u03bb\u03ad\u03c2 \u03c3\u03c5\u03c3\u03ba\u03b5\u03c5\u03ad\u03c2 \u03ba\u03ac\u03b8\u03bf\u03bd\u03c4\u03b1\u03bd \u03a0\u0391\u039d\u03a9 \u03b1\u03c0\u03cc \u03c4\u03b1 gateways\n"
    "     \u03c0\u03bf\u03c5 \u039f\u039d\u03a4\u03a9\u03a3 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03bf\u03cd\u03bd. \u00ab\u0394\u03b5\u03bd \u03bc\u03af\u03bb\u03b7\u03c3\u03b5 \u03c0\u03bf\u03c4\u03ad\u00bb \u0394\u0395\u039d \u03b5\u03af\u03bd\u03b1\u03b9 \u03b5\u03c0\u03b5\u03af\u03b3\u03bf\u03bd\u00b7\n"
    "     \u00ab\u03bc\u03af\u03bb\u03b7\u03c3\u03b5 \u03ba\u03b1\u03b9 \u03c3\u03c4\u03b1\u03bc\u03ac\u03c4\u03b7\u03c3\u03b5\u00bb \u03b5\u03af\u03bd\u03b1\u03b9. */\n"
    "  var rankOf = function (g) { return isUndeclared(g) ? 4 : rank[statusOf(g).cls]; };\n"
    "  out.sort(function (a, b) {\n"
    "    var ra = rankOf(a), rb = rankOf(b);\n"
    "    if (ra !== rb) return ra - rb;",
)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("ok")
