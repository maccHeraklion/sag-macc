# -*- coding: utf-8 -*-
# T-GWMAP-02 (19/10/2026, εντολή Μιχάλη): «διόρθωσε αυτό τον χάρτη που είναι κολλημένος και δεν μετακινείται,
# δεν ενημερώνεται, δεν έχει τις θέσεις των gateways σωστά· πρόσθεσε δορυφορικό layer».
#
# ΑΙΤΙΕΣ (ΕΠΙΒΕΒΑΙΩΜΕΝΕΣ στον κώδικα / στη ζωντανή ρύθμιση):
#  1. ΚΟΛΛΗΜΕΝΟΣ: το πέπλο «Πατήστε για να μετακινήσετε» έχει CSS `display:flex`, που ΑΚΥΡΩΝΕΙ το χαρακτηριστικό
#     `hidden`. Μετά το πάτημα το dragging ενεργοποιείται, αλλά το πέπλο ΜΕΝΕΙ από πάνω και τρώει κάθε κίνηση.
#     Επιπλέον το πέπλο έβγαινε σε υπολογιστή με οθόνη αφής (pointer:coarse) ενώ ο χρήστης έχει ποντίκι.
#  2. Κάθε ενημέρωση (realtime) ξανάκανε fitBounds → ο χάρτης «πηδούσε» πίσω όπου κι αν τον είχες πάει.
#  3. ΔΕΝ ΕΝΗΜΕΡΩΝΕΤΑΙ / ΘΕΣΕΙΣ: ο κατάλογος (`fleet_roster`) είναι ΠΑΓΩΜΕΝΟ αντίγραφο της 19/9 μέσα στις
#     παραμέτρους του widget: 33 gateways, ενώ σήμερα είναι 35 (2 νέα της 16/10 λείπουν), με ονόματα συσκευής
#     αντί για το όνομα τοποθεσίας. Τώρα η ανάλυση gatewayLiveness γράφει ΖΩΝΤΑΝΟ κατάλογο `gateway_roster`
#     από τις ετικέτες `coordinates`/`comment` των συσκευών, και η σελίδα τον προτιμά.
#  4. Νέο: επιλογή «Χάρτης / Δορυφόρος» (Esri World Imagery + ονόματα).
import sys, io, subprocess

PATH = "custom_html_files/gateway-board.html"
src = io.open(PATH, "r", encoding="utf-8", newline="").read()
assert "\r\n" not in src, "η σελίδα πρέπει να είναι LF"

def sub(old, new, label):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: βρέθηκε %d φορές" % (label, n))
    src = src.replace(old, new)

def must_absent(s, label):
    if s in src:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: υπάρχει ήδη" % label)

must_absent("T-GWMAP-02", "ήδη εφαρμοσμένο")

# 1 · το πέπλο κρύβεται πραγματικά
sub("#mapveil span{",
    "/* T-GWMAP-02: χωρίς αυτό, το display:flex ακυρώνει το hidden και το πέπλο μένει πάνω στον χάρτη για πάντα. */\n"
    "#mapveil[hidden]{display:none}\n#mapveil span{", "P1 css")

# 1β · πέπλο ΜΟΝΟ όταν δεν υπάρχει καθόλου ποντίκι
sub("      _isTouch = window.matchMedia('(pointer: coarse)').matches === true;\n",
    "      /* T-GWMAP-02: και laptop με οθόνη αφής μπορεί να δηλώνει coarse. Πέπλο μόνο αν ΔΕΝ υπάρχει ποντίκι. */\n"
    "      _isTouch = window.matchMedia('(pointer: coarse)').matches === true\n"
    "        && window.matchMedia('(any-pointer: fine)').matches !== true;\n", "P1b touch")

# 4 · χάρτης + δορυφόρος
sub("  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {\n"
    "    maxZoom: 19, attribution: '© OpenStreetMap'\n"
    "  }).addTo(state.map);\n",
    "  /* T-GWMAP-02: δύο υπόβαθρα — Χάρτης (OpenStreetMap) και Δορυφόρος (Esri World Imagery, με ονόματα). */\n"
    "  var _osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {\n"
    "    maxZoom: 19, attribution: '© OpenStreetMap'\n"
    "  });\n"
    "  var _sat = L.layerGroup([\n"
    "    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {\n"
    "      maxZoom: 19, maxNativeZoom: 18, attribution: 'Εικόνες © Esri, Maxar, Earthstar Geographics'\n"
    "    }),\n"
    "    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {\n"
    "      maxZoom: 19, maxNativeZoom: 18\n"
    "    })\n"
    "  ]);\n"
    "  _osm.addTo(state.map);\n"
    "  L.control.layers({ 'Χάρτης': _osm, 'Δορυφόρος': _sat }, null, { position: 'topright', collapsed: false }).addTo(state.map);\n"
    "  /* T-GWMAP-02: μόλις ο χρήστης πιάσει τον χάρτη, οι ενημερώσεις δεν τον ξαναμετακινούν. */\n"
    "  try {\n"
    "    var _mc = state.map.getContainer();\n"
    "    var _mark = function () { state.userMoved = true; };\n"
    "    _mc.addEventListener('mousedown', _mark);\n"
    "    _mc.addEventListener('touchstart', _mark, { passive: true });\n"
    "    state.map.on('dragstart', _mark);\n"
    "  } catch (_eM) {}\n", "P4 layers")

# 2 · fitBounds μία φορά (και όταν προστεθούν πινέζες, ΜΟΝΟ αν ο χρήστης δεν έχει πιάσει τον χάρτη)
sub("  if (pts.length > 0) {\n"
    "    try { state.map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 }); } catch (_e) {}\n"
    "  }\n",
    "  /* T-GWMAP-02: πριν, ΚΑΘΕ ενημέρωση ξανάκανε fitBounds και ο χάρτης πηδούσε πίσω. */\n"
    "  if (pts.length > 0 && !state.userMoved && pts.length !== state.fitN) {\n"
    "    state.fitN = pts.length;\n"
    "    try { state.map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 }); } catch (_e) {}\n"
    "  }\n", "P2 fit")
sub("  if (!g || g.lat == null || !state.map) return;\n  try {\n",
    "  if (!g || g.lat == null || !state.map) return;\n  state.userMoved = true;\n  try {\n", "P2b focus")

# 3 · ζωντανός κατάλογος
sub("var NOT_LIFE_SIGNS = ['location', 'gateway_config', 'gateway_row',\n  'gateway_summary', 'gateway_scan_state'];",
    "var NOT_LIFE_SIGNS = ['location', 'gateway_config', 'gateway_row',\n  'gateway_summary', 'gateway_scan_state', 'gateway_roster'];", "P3 nls")
sub("function applyRoster(list) {", "function applyRoster(list, live) {", "P3 sig")
sub("      if (!state.gw[id].name && r.name) state.gw[id].name = String(r.name);",
    "      /* T-GWMAP-02: ο ΖΩΝΤΑΝΟΣ κατάλογος (gateway_roster) αντικαθιστά όνομα και θέση του παγωμένου. */\n"
    "      if (r.name && (live || !state.gw[id].name)) state.gw[id].name = String(r.name);", "P3 name")
sub("      if (rHas && state.gw[id].lat == null) {",
    "      if (rHas && (state.gw[id].lat == null || (live && state.gw[id].fromRoster))) {", "P3 pos")
sub("    n++;\n  }\n  state.rosterSize = n;",
    "    if (live) { state.gw[id].posConflict = !!r.conflict; state.gw[id].liveRoster = true; }\n"
    "    n++;\n  }\n  state.rosterSize = n;", "P3 conflict")
sub("    if (r.variable === 'gateway_row' || r.variable === 'gateway_summary'\n        || r.variable === 'gateway_scan_state') {",
    "    if (r.variable === 'gateway_row' || r.variable === 'gateway_summary'\n        || r.variable === 'gateway_scan_state' || r.variable === 'gateway_roster') {", "P3 container")
sub("    if (r.variable === 'gateway_row' && r.value) {\n      var gid",
    "    /* T-GWMAP-02: ο ζωντανός κατάλογος του στόλου — μόνο η ΝΕΟΤΕΡΗ εγγραφή μετράει. */\n"
    "    if (r.variable === 'gateway_roster' && r.metadata && Array.isArray(r.metadata.list)) {\n"
    "      if (!state.rosterTime || Date.parse(r.time) >= Date.parse(state.rosterTime)) {\n"
    "        state.rosterTime = r.time;\n"
    "        applyRoster(r.metadata.list, true);\n"
    "      }\n"
    "      continue;\n"
    "    }\n\n"
    "    if (r.variable === 'gateway_row' && r.value) {\n      var gid", "P3 ingest")
sub("      : '<span class=\"mono\">' + g.lat.toFixed(5) + ', ' + g.lng.toFixed(5) + '</span>';",
    "      : '<span class=\"mono\">' + g.lat.toFixed(5) + ', ' + g.lng.toFixed(5) + '</span>'\n"
    "        + (g.posConflict ? ' · <span style=\"color:var(--red)\">ασυμφωνία θέσης στις ετικέτες της συσκευής</span>' : '');", "P3 conflict ui")

# έλεγχος σύνταξης του script της σελίδας ΠΡΙΝ γραφτεί (όλα ή τίποτα)
import re, tempfile, os
scripts = re.findall(r"<script>([\s\S]*?)</script>", src)
tmp = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8")
tmp.write("\n".join(scripts)); tmp.close()
r = subprocess.run(["node", "--check", tmp.name], capture_output=True, text=True)
os.unlink(tmp.name)
if r.returncode != 0:
    sys.exit("ΑΠΟΤΥΧΙΑ node --check: " + r.stderr[:400])
io.open(PATH, "w", encoding="utf-8", newline="").write(src)
print("OK T-GWMAP-02 · 15 αλλαγές · node --check ✔")
