# -*- coding: utf-8 -*-
# T-GWMAP-03 (19/10/2026, Μιχάλης): «δεν κάνει ζουμ με τη ροδέλα· πώς λέει 0 άγνωστοι και έχει πολλούς
# άγνωστους σταθμούς στον χάρτη; πρέπει να γίνει σωστή ταυτοποίηση — οι σταθμοί σίγουρα λειτουργούν».
#
#  1. Ροδέλα: ενεργή σε υπολογιστή (ήταν σκόπιμα κλειστή από T-MAPSCROLL-01). Σε κινητό μένει κλειστή.
#  2. ΤΑΥΤΙΣΗ ΜΕ ΘΕΣΗ: κάθε gateway του δικτύου (κωδικός LRR, θέση lrrlat/lrrlon) ενώνεται με τη συσκευή-gateway
#     του καταλόγου που βρίσκεται ≤ 200 m (ετικέτα coordinates). Πρώτα τα πλησιέστερα ζεύγη, το καθένα μία φορά.
#     Αν υπάρχει και δεύτερος υποψήφιος ≤ 200 m, το όνομα γράφεται ως ΠΙΘΑΝΟ. Έτσι ο σταθμός εμφανίζεται ΜΙΑ φορά,
#     με όνομα τοποθεσίας και ένδειξη ζωής, αντί για ένα «Gateway 1000C238» + ένα γκρίζο αδήλωτο.
#  3. ΟΝΟΜΑΣΙΑ: «αδήλωτα» → «χωρίς ταυτοποίηση». Δεν είναι βλάβη: οι αισθητήρες τους δεν αναφέρουν από ποιο
#     gateway πέρασαν (οι parsers πετούν lrrid/gateway_eui — βλ. DEPLOY_LOG T-GWMAP-03).
import sys, io, re, os, subprocess, tempfile

PATH = "custom_html_files/gateway-board.html"
src = io.open(PATH, "r", encoding="utf-8", newline="").read()
assert "\r\n" not in src

def sub(old, new, label):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: βρέθηκε %d φορές" % (label, n))
    src = src.replace(old, new)

if "T-GWMAP-03" in src:
    sys.exit("ΑΠΟΤΥΧΙΑ: ήδη εφαρμοσμένο")

# 1 · ροδέλα
sub("    scrollWheelZoom: false,\n",
    "    /* T-GWMAP-03: ζουμ με τη ροδέλα σε υπολογιστή (αίτημα Μιχάλη 19/10). Σε κινητό μένει κλειστό. */\n"
    "    scrollWheelZoom: !_isTouch,\n", "P1 wheel")

# 3 · ονομασίες
sub('<div class="l">αδήλωτα</div>', '<div class="l">χωρίς ταυτοποίηση</div>', "P3 tile")
sub('<span><span class="dot grey"></span>χωρίς ένδειξη</span>',
    '<span><span class="dot grey"></span>χωρίς ταυτοποίηση (όχι βλάβη)</span>', "P3 legend")
sub("      ? '<span style=\"color:var(--blue)\">ΑΔΗΛΩΤΟ — δεν έχει στείλει ποτέ δεδομένα'",
    "      ? '<span style=\"color:var(--blue)\">ΧΩΡΙΣ ΤΑΥΤΟΠΟΙΗΣΗ — οι αισθητήρες που εξυπηρετεί δεν αναφέρουν'\n"
    "        + ' από ποιο gateway πέρασαν. ΔΕΝ σημαίνει ότι είναι εκτός λειτουργίας'", "P3 list")

# 2 · ταύτιση με θέση
sub("    if (state.gw[k].container) continue;\n",
    "    if (state.gw[k].container) continue;\n"
    "    /* T-GWMAP-03: συσκευή καταλόγου που ταυτίστηκε με gateway του δικτύου — εμφανίζεται ΜΕΣΑ σε εκείνο. */\n"
    "    if (state.gw[k].mergedInto) continue;\n", "P2 skip")
sub("function render() {\n  var list = sortedList();",
    "/* T-GWMAP-03 · ΤΑΥΤΙΣΗ gateway δικτύου ↔ συσκευή καταλόγου με ΘΕΣΗ (≤ LINK_M μέτρα).\n"
    "   Το δίκτυο δίνει κωδικό LRR και θέση· ο κατάλογος όνομα τοποθεσίας και θέση. Πρώτα τα πλησιέστερα ζεύγη,\n"
    "   το καθένα μία φορά. Δεύτερος υποψήφιος μέσα στην ακτίνα → το όνομα είναι ΠΙΘΑΝΟ, όχι βέβαιο. */\n"
    "var LINK_M = 200;\n"
    "function _distM(a, b) {\n"
    "  var dLat = (a.lat - b.lat) * 111320;\n"
    "  var dLng = (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);\n"
    "  return Math.sqrt(dLat * dLat + dLng * dLng);\n"
    "}\n"
    "function linkByPosition() {\n"
    "  var nets = [], ros = [], k;\n"
    "  for (k in state.gw) {\n"
    "    if (!Object.prototype.hasOwnProperty.call(state.gw, k)) continue;\n"
    "    var g = state.gw[k];\n"
    "    g.mergedInto = null;\n"
    "    if (g.fromNetwork) { g.linked = null; if (g.lat != null) nets.push(g); }\n"
    "    else if (g.roster && !g.container && g.lat != null) ros.push(g);\n"
    "  }\n"
    "  var pairs = [];\n"
    "  for (var i = 0; i < nets.length; i++) for (var j = 0; j < ros.length; j++) {\n"
    "    var d = _distM(nets[i], ros[j]);\n"
    "    if (d <= LINK_M) pairs.push({ n: nets[i], r: ros[j], d: d });\n"
    "  }\n"
    "  pairs.sort(function (a, b) { return a.d - b.d; });\n"
    "  var usedN = {}, usedR = {};\n"
    "  for (var p = 0; p < pairs.length; p++) {\n"
    "    var P = pairs[p];\n"
    "    if (usedN[P.n.id] || usedR[P.r.id]) continue;\n"
    "    usedN[P.n.id] = true; usedR[P.r.id] = true;\n"
    "    var rivals = 0;\n"
    "    for (var q = 0; q < pairs.length; q++) {\n"
    "      if (q !== p && (pairs[q].n === P.n || pairs[q].r === P.r)) rivals++;\n"
    "    }\n"
    "    P.r.mergedInto = P.n.id;\n"
    "    P.n.linked = { id: P.r.id, name: P.r.name || '', dist: Math.round(P.d), sure: rivals === 0 };\n"
    "    if (P.r.phone && !P.n.phone) P.n.phone = P.r.phone;\n"
    "    if (P.n.nameSure !== true && P.r.name) {\n"
    "      if (rivals === 0) { P.n.name = P.r.name; P.n.nameGuess = ''; }\n"
    "      else P.n.nameGuess = P.r.name + ' (' + Math.round(P.d) + ' m, υπάρχει κι άλλο κοντά)';\n"
    "    }\n"
    "  }\n"
    "}\n\n"
    "function render() {\n  linkByPosition();\n  var list = sortedList();", "P2 link")

scripts = re.findall(r"<script>([\s\S]*?)</script>", src)
tmp = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8")
tmp.write("\n".join(scripts)); tmp.close()
r = subprocess.run(["node", "--check", tmp.name], capture_output=True, text=True)
os.unlink(tmp.name)
if r.returncode != 0:
    sys.exit("ΑΠΟΤΥΧΙΑ node --check: " + r.stderr[:400])
io.open(PATH, "w", encoding="utf-8", newline="").write(src)
print("OK T-GWMAP-03 · 6 αλλαγές · node --check ✔")
