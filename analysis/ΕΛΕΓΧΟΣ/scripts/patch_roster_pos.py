# -*- coding: utf-8 -*-
"""T-GWROSTER-POS-01 — o xartis edeixne 5 apo 21 gateways.

TO LATHOS: i thesi erxotan MONO apo to diktyo (lrrlat/lrrlon), diladi mono gia
gateways pou kapoios aisthitiras katonomase. Mono 38 apo 220 aisthitires stelnoun
lrrid, ara mono 5 gateways eixan thesi. Oi 21 syskeves-gateway pou kratoun ti
thesi tous se etiketa `coordinates` DEN emfanizontan pote.

I DIORTHOSI: o katalogos stolou feris KAI lat/lng. Xrisimopoiountai os EFEDREIA:
an to diktyo exei idi pei pou einai to gateway, EKEINO menei — mas esose idi mia
fora, stin Anxialo, opou i etiketa eixe lathos longitude (20.78 anti 22.78).

DIPLA PINEZA: ena gateway mporei na yparxei KAI os grammi diktyou (kleidi=lrrid)
KAI os eggrafi katalogou (kleidi=deviceId). Gia na min vgoun dyo pineza sto idio
simeio, i eggrafi katalogou paraleipetai an yparxei idi pineza se apostasi
mikroteri apo 150 m.
"""
import io

P = (u"C:/Users/Katharak/OneDrive - \u0395\u03a0\u0399\u039c\u0395\u039b\u0397\u03a4\u0397\u03a1\u0399\u039f "
     u"\u0397\u03a1\u0391\u039a\u039b\u0395\u0399\u039f\u03a5/\u0395\u03c0\u03b9\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 "
     u"\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1\u03c2/MACC/custom_html_files/gateway-board.html")

_raw = io.open(P, encoding="utf-8", newline="").read()
assert not _raw.startswith(u"\ufeff"), "BOM"
_CRLF = "\r\n" in _raw
s = _raw.replace("\r\n", "\n")
assert "\r" not in s, "mikti symvasi"


def sub(old, new, count=1):
    global s
    c = s.count(old)
    assert c == count, "anchor %d != %d: %r" % (c, count, old[:80])
    s = s.replace(old, new)


# ── 1. O katalogos dexetai thesi ────────────────────────────────────────────
sub(
    u"    var id = String(r.id);\n"
    u"    if (!state.gw[id]) {\n"
    u"      state.gw[id] = { id: id, name: r.name ? String(r.name) : '', phone: '',\n"
    u"        lat: null, lng: null, vars: {}, roster: true, storage: !!r.storage };\n"
    u"    } else {\n"
    u"      state.gw[id].roster = true;\n"
    u"      state.gw[id].storage = !!r.storage;\n"
    u"      if (!state.gw[id].name && r.name) state.gw[id].name = String(r.name);\n"
    u"    }\n",
    u"    var id = String(r.id);\n"
    u"    /* T-GWROSTER-POS-01: \u03bf \u03ba\u03b1\u03c4\u03ac\u03bb\u03bf\u03b3\u03bf\u03c2 \u03c6\u03ad\u03c1\u03bd\u03b5\u03b9 \u03c0\u03bb\u03ad\u03bf\u03bd \u039a\u0391\u0399 \u03b8\u03ad\u03c3\u03b7, \u03b1\u03c0\u03cc \u03c4\u03b7\u03bd\n"
    u"       \u03b5\u03c4\u03b9\u03ba\u03ad\u03c4\u03b1 \u00abcoordinates\u00bb \u03c4\u03b7\u03c2 \u03c3\u03c5\u03c3\u03ba\u03b5\u03c5\u03ae\u03c2. \u03a0\u03c1\u03b9\u03bd, \u03b7 \u03b8\u03ad\u03c3\u03b7 \u03b5\u03c1\u03c7\u03cc\u03c4\u03b1\u03bd \u039c\u039f\u039d\u039f \u03b1\u03c0\u03cc \u03c4\u03bf\n"
    u"       \u03b4\u03af\u03ba\u03c4\u03c5\u03bf (lrrlat/lrrlon) \u2014 \u03ac\u03c1\u03b1 \u03bc\u03cc\u03bd\u03bf \u03b3\u03b9\u03b1 \u03cc\u03c3\u03b1 gateway \u03ba\u03b1\u03c4\u03bf\u03bd\u03cc\u03bc\u03b1\u03c3\u03b5 \u03ba\u03ac\u03c0\u03bf\u03b9\u03bf\u03c2\n"
    u"       \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03b1\u03c2. \u039c\u03b5 38 \u03c3\u03c4\u03bf\u03c5\u03c2 220 \u03b1\u03b9\u03c3\u03b8\u03b7\u03c4\u03ae\u03c1\u03b5\u03c2 \u03bd\u03b1 \u03c3\u03c4\u03ad\u03bb\u03bd\u03bf\u03c5\u03bd lrrid, \u03bf \u03c7\u03ac\u03c1\u03c4\u03b7\u03c2\n"
    u"       \u03ad\u03b4\u03b5\u03b9\u03c7\u03bd\u03b5 5 \u03b1\u03c0\u03cc 21. */\n"
    u"    var rLat = Number(r.lat), rLng = Number(r.lng);\n"
    u"    var rHas = isFinite(rLat) && isFinite(rLng)\n"
    u"      && rLat >= -90 && rLat <= 90 && rLng >= -180 && rLng <= 180;\n"
    u"    if (!state.gw[id]) {\n"
    u"      state.gw[id] = { id: id, name: r.name ? String(r.name) : '', phone: '',\n"
    u"        lat: rHas ? rLat : null, lng: rHas ? rLng : null,\n"
    u"        vars: {}, roster: true, storage: !!r.storage, fromRoster: rHas };\n"
    u"    } else {\n"
    u"      state.gw[id].roster = true;\n"
    u"      state.gw[id].storage = !!r.storage;\n"
    u"      if (!state.gw[id].name && r.name) state.gw[id].name = String(r.name);\n"
    u"      /* \u0397 \u03b8\u03ad\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03b4\u03b9\u03ba\u03c4\u03cd\u03bf\u03c5 \u03a5\u03a0\u0395\u03a1\u0399\u03a3\u03a7\u03a5\u0395\u0399: \u03c3\u03c4\u03b7\u03bd \u0391\u03b3\u03c7\u03af\u03b1\u03bb\u03bf \u03b7 \u03b5\u03c4\u03b9\u03ba\u03ad\u03c4\u03b1 \u03b5\u03af\u03c7\u03b5 \u03bb\u03ac\u03b8\u03bf\u03c2\n"
    u"         \u03bc\u03ae\u03ba\u03bf\u03c2 (20,78 \u03b1\u03bd\u03c4\u03af 22,78) \u03ba\u03b1\u03b9 \u03c4\u03bf \u03b4\u03af\u03ba\u03c4\u03c5\u03bf \u03c4\u03bf \u03b4\u03b9\u03ad\u03c8\u03b5\u03c5\u03c3\u03b5. */\n"
    u"      if (rHas && state.gw[id].lat == null) {\n"
    u"        state.gw[id].lat = rLat; state.gw[id].lng = rLng; state.gw[id].fromRoster = true;\n"
    u"      }\n"
    u"    }\n",
)

# ── 2. Apofygi diplon pinezon sto idio simeio ───────────────────────────────
sub(
    u"function drawMap(list) {\n"
    u"  if (!state.map || !state.layer) return;\n",
    u"/* T-GWROSTER-POS-01: \u03ad\u03bd\u03b1 gateway \u03bc\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9 \u0394\u03a5\u039f \u03c6\u03bf\u03c1\u03ad\u03c2: \u03c9\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ae \u03b4\u03b9\u03ba\u03c4\u03cd\u03bf\u03c5\n"
    u"   (\u03ba\u03bb\u03b5\u03b9\u03b4\u03af = lrrid) \u03ba\u03b1\u03b9 \u03c9\u03c2 \u03b5\u03b3\u03b3\u03c1\u03b1\u03c6\u03ae \u03ba\u03b1\u03c4\u03b1\u03bb\u03cc\u03b3\u03bf\u03c5 (\u03ba\u03bb\u03b5\u03b9\u03b4\u03af = deviceId). \u0394\u03b5\u03bd \u03bc\u03c0\u03bf\u03c1\u03bf\u03cd\u03bc\u03b5\n"
    u"   \u03bd\u03b1 \u03c4\u03b1 \u03c4\u03b1\u03c5\u03c4\u03af\u03c3\u03bf\u03c5\u03bc\u03b5 \u03bc\u03b5 \u03b2\u03ad\u03b2\u03b1\u03b9\u03cc\u03c4\u03b7\u03c4\u03b1 \u2014 \u03b1\u03bb\u03bb\u03ac \u03b4\u03cd\u03bf \u03c0\u03b9\u03bd\u03ad\u03b6\u03b5\u03c2 \u03c3\u03c4\u03bf \u03af\u03b4\u03b9\u03bf \u03c3\u03b7\u03bc\u03b5\u03af\u03bf \u03b5\u03af\u03bd\u03b1\u03b9\n"
    u"   \u03c3\u03c7\u03b5\u03b4\u03cc\u03bd \u03c3\u03af\u03b3\u03bf\u03c5\u03c1\u03b1 \u03c4\u03bf \u03af\u03b4\u03b9\u03bf \u03bc\u03b7\u03c7\u03ac\u03bd\u03b7\u03bc\u03b1. \u03a0\u03c1\u03bf\u03c4\u03b5\u03c1\u03b1\u03b9\u03cc\u03c4\u03b7\u03c4\u03b1 \u03c3\u03c4\u03b7 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ae \u03b4\u03b9\u03ba\u03c4\u03cd\u03bf\u03c5,\n"
    u"   \u03c0\u03bf\u03c5 \u03ad\u03c7\u03b5\u03b9 \u03ba\u03b1\u03b9 \u03bc\u03b1\u03c1\u03c4\u03c5\u03c1\u03af\u03b1 \u03b6\u03c9\u03ae\u03c2. */\n"
    u"function _tooClose(a, b) {\n"
    u"  var dLat = (a.lat - b.lat) * 111320;\n"
    u"  var dLng = (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);\n"
    u"  return Math.sqrt(dLat * dLat + dLng * dLng) < 150;   /* \u03bc\u03ad\u03c4\u03c1\u03b1 */\n"
    u"}\n"
    u"\n"
    u"function drawMap(list) {\n"
    u"  if (!state.map || !state.layer) return;\n",
)

sub(
    u"    if (g.lat == null || g.lng == null) continue;\n",
    u"    if (g.lat == null || g.lng == null) continue;\n"
    u"    /* \u0391\u03bd \u03b1\u03c5\u03c4\u03cc \u03ad\u03c1\u03c7\u03b5\u03c4\u03b1\u03b9 \u03bc\u03cc\u03bd\u03bf \u03b1\u03c0\u03cc \u03c4\u03bf\u03bd \u03ba\u03b1\u03c4\u03ac\u03bb\u03bf\u03b3\u03bf \u03ba\u03b1\u03b9 \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9 \u03ae\u03b4\u03b7 \u03c0\u03b9\u03bd\u03ad\u03b6\u03b1 \u03b4\u03af\u03c0\u03bb\u03b1,\n"
    u"       \u03b5\u03af\u03bd\u03b1\u03b9 \u03c4\u03bf \u03af\u03b4\u03b9\u03bf \u03bc\u03b7\u03c7\u03ac\u03bd\u03b7\u03bc\u03b1 \u2014 \u03bc\u03b7\u03bd \u03c4\u03bf \u03b4\u03b5\u03af\u03be\u03b5\u03b9\u03c2 \u03b4\u03cd\u03bf \u03c6\u03bf\u03c1\u03ad\u03c2. */\n"
    u"    if (g.fromRoster) {\n"
    u"      var dup = false;\n"
    u"      for (var _p = 0; _p < _plotted.length; _p++) {\n"
    u"        if (_tooClose(g, _plotted[_p])) { dup = true; break; }\n"
    u"      }\n"
    u"      if (dup) continue;\n"
    u"    }\n"
    u"    _plotted.push({ lat: g.lat, lng: g.lng });\n",
)

sub(
    u"  state.markers = {};\n",
    u"  state.markers = {};\n"
    u"  var _plotted = [];\n",
)

out = s.replace("\n", "\r\n") if _CRLF else s
io.open(P, "w", encoding="utf-8", newline="").write(out)
print("ok — 4 allages, symvasi %s" % ("CRLF" if _CRLF else "LF"))
