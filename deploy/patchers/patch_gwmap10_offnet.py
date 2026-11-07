# -*- coding: utf-8 -*-
"""T-GWMAP-10 (7/11/2026, εντολή Michalis): νέα κατάσταση πύλης «ΕΚΤΟΣ ΔΙΚΤΥΟΥ». Πύλες που δηλώνονται εγκατεστημένες αλλά στο ThingPark
δεν έχουν πακέτο. Δεν είναι αποθήκη ούτε «χωρίς ταυτοποίηση». Η ημερομηνία έρχεται από την ετικέτα network_last_uplink της συσκευής."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = sys.argv[1]


def patch(path, subs):
    s = open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in s
    s = s.replace('\r\n', '\n')
    for a, b in subs:
        assert s.count(a) == 1, a[:70]
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)


patch(ROOT + '/analysis/gatewayLiveness.js', [
    ("""  if (val("deployedGateway") !== "yes") e.storage = true;
  return e;
""", """  if (val("deployedGateway") !== "yes") e.storage = true;
  // T-GWMAP-10: δηλωμένη πύλη χωρίς πακέτο στο ThingPark. Μόνο πλήρης ημερομηνία, αλλιώς αγνοείται.
  const off = val("network_last_uplink"), lrr = val("network_lrrid");
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(off)) e.off = off;
  if (lrr) e.lrr = lrr;
  return e;
"""),
])
patch(ROOT + '/custom_html_files/sag-map.html', [
    ("""  g_unid: { k: 'g_unid', w: 'ΧΩΡΙΣ ΤΑΥΤΟΠΟΙΗΣΗ', ic: '?', c: 'grey' },
""", """  g_off: { k: 'g_off', w: 'ΕΚΤΟΣ ΔΙΚΤΥΟΥ', ic: '✕', c: 'check' },
  g_unid: { k: 'g_unid', w: 'ΧΩΡΙΣ ΤΑΥΤΟΠΟΙΗΣΗ', ic: '?', c: 'grey' },
"""),
    ("""g_sparse: 2000, g_alive: 500, g_unid: -500,""", """g_sparse: 2000, g_off: 1500, g_alive: 500, g_unid: -500,"""),
    ("""      age: null, st: r.storage ? GSTATE.g_storage : GSTATE.g_unid, storage: !!r.storage, conflict: !!r.conflict, p: p,
""", """      age: null, st: r.storage ? GSTATE.g_storage : (r.off ? GSTATE.g_off : GSTATE.g_unid), storage: !!r.storage, off: r.off || null, lrr: r.lrr || null, conflict: !!r.conflict, p: p,
"""),
    ("""    P.n.storage = P.r.storage; P.n.conflict = P.r.conflict; P.n.dev = P.r.dev;
""", """    P.n.storage = P.r.storage; P.n.conflict = P.r.conflict; P.n.dev = P.r.dev; P.n.off = P.r.off;
"""),
    ("""gwUnid: gws.filter(function (g) { return !g.net && g.st.k !== 'g_storage'; }).length, gwStore:""",
     """gwUnid: gws.filter(function (g) { return !g.net && g.st.k === 'g_unid'; }).length, gwOff: gws.filter(function (g) { return g.st.k === 'g_off'; }).length, gwStore:"""),
    ("""function gwTrouble(g) { return { g_nowit: 3, g_sparse: 2, g_unid: 1,""", """function gwTrouble(g) { return { g_nowit: 3, g_off: 2.5, g_sparse: 2, g_unid: 1,"""),
    ("""  if (g.code) h += '<div class="meta">Κωδικός δικτύου <span class="mono">' + esc(g.code) + '</span></div>';
""", """  if (g.code) h += '<div class="meta">Κωδικός δικτύου <span class="mono">' + esc(g.code) + '</span></div>';
  if (g.off) h += '<div class="meta">Τελευταίο πακέτο στο ThingPark: ' + esc(g.off.split('-').reverse().join('/')) + (g.lrr ? ' · <span class="mono">' + esc(g.lrr) + '</span>' : '') + '</div>';
"""),
    ("""  ['g_alive', 'g_sparse', 'g_nowit', 'g_unid', 'g_storage'].forEach(""", """  ['g_alive', 'g_sparse', 'g_nowit', 'g_off', 'g_unid', 'g_storage'].forEach("""),
    ("""  parts.push('<span>Δηλωμένες χωρίς ταυτοποίηση: <b>' + c.gwUnid + '</b> · στην αποθήκη: <b>' + c.gwStore + '</b></span>');
""", """  parts.push('<span>Δηλωμένες χωρίς ταυτοποίηση: <b>' + c.gwUnid + '</b> · εκτός δικτύου: <b>' + c.gwOff + '</b> · στην αποθήκη: <b>' + c.gwStore + '</b></span>');
"""),
    ("""GSTATE.g_nowit, GSTATE.g_unid, GSTATE.g_storage]);""", """GSTATE.g_nowit, GSTATE.g_off, GSTATE.g_unid, GSTATE.g_storage]);"""),
])
print('ok')
