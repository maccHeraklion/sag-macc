# T-COORD-SYNC-02 (9/11/2026, αποφάσεις Michalis: «η δηλωμένη θέση + σήμα διαφοράς»): θέσεις πυλών και αγρών στο gatewayLiveness
# και στον χάρτη στόλου. Η ετικέτα coordinates της πύλης είναι το ΚΥΡΙΟ σημείο· η μνήμη θέσης ξαναγράφεται από αυτήν· η θέση του
# ThingPark γίνεται έλεγχος (διαφορά > 500 m → σήμα). Ο έλεγχος «λάθος αγρός» παίρνει τη θέση του αγρού από τη φόρμα.
import sys, subprocess
A, H = sys.argv[1], sys.argv[2]


def load(p):
    s = open(p, 'rb').read().decode('utf-8')
    assert '\r\n' not in s
    return s


a, h = load(A), load(H)


def sub(src, old, new, cnt=1):
    n = src.count(old)
    assert n == cnt, (n, old[:80])
    return src.replace(old, new)


# 1. «λάθος αγρός»: θέση αγρού από τη φόρμα πρώτα (ίδια σειρά με τον χάρτη), όχι μόνο από την ετικέτα
a = sub(a, """    let coords = null;
    const cm = tag("coordinates").match(/^\\s*(-?\\d+(?:\\.\\d+)?)\\s*[,;\\s]\\s*(-?\\d+(?:\\.\\d+)?)\\s*$/);
    if (cm) coords = { lat: Number(cm[1]), lon: Number(cm[2]) };""",
"""    // T-COORD-SYNC-02: ίδια σειρά με τον χάρτη — φόρμα (configuration) πρώτα, μετά η ετικέτα coordinates.
    let coords = null;
    const _mp = mapFieldPosition(tags);
    if (_mp && _mp.y != null && _mp.x != null) coords = { lat: _mp.y, lon: _mp.x };""")

# 2. θέση ThingPark κρατιέται για τον έλεγχο
a = sub(a, """        c: b.cnxState || null, h: b.healthState || null, s: Number(b.cnxStateSince) || null, u: Number(up) || null, a: 0 });""",
"""        c: b.cnxState || null, h: b.healthState || null, s: Number(b.cnxStateSince) || null, u: Number(up) || null, a: 0,
        la: Number.isFinite(Number(b.lat)) && Number(b.lat) !== 0 ? Number(b.lat) : null, lo: Number.isFinite(Number(b.lon)) && Number(b.lon) !== 0 ? Number(b.lon) : null });""")
a = sub(a, """    r.tp = { c: b.c, h: b.h, s: b.s, u: b.u, a: b.a };""",
"""    r.tp = { c: b.c, h: b.h, s: b.s, u: b.u, a: b.a };
    // T-COORD-SYNC-02: η δηλωμένη θέση είναι η κύρια· η θέση του ThingPark είναι έλεγχος. Διαφορά > 500 m → σήμα «διορθώστε στο ThingPark».
    if (r.lat != null && r.lng != null && b.la != null && b.lo != null) {
      const _d = Math.round(haversineKm(r.lat, r.lng, b.la, b.lo) * 1000);
      if (_d > TP_POS_DIFF_M) r.tp.dm = _d;
    }""")
a = sub(a, "const TP_SILENT_H = 24;", "const TP_SILENT_H = 24;\nconst TP_POS_DIFF_M = 500;   // T-COORD-SYNC-02: απόσταση δηλωμένης θέσης από τη θέση του ThingPark πάνω από την οποία βγαίνει σήμα")

# 3. μνήμη θέσης: η ΔΗΛΩΜΕΝΗ θέση (ετικέτα) γράφει πάνω στη θέση δικτύου και στη μνήμη· μετακίνηση πύλης = αλλάζει η ετικέτα → αλλάζει παντού
a = sub(a, """  const pos = st.pos || {};
  for (const [id, g] of gw.entries()) {""",
"""  const pos = st.pos || {};
  // T-COORD-SYNC-02: πύλη με δηλωμένη θέση (ετικέτα coordinates, μία τιμή) → αυτή μπαίνει στην κάρτα και στη μνήμη, όποια κι αν
  // ήταν η παλιά. Έτσι η μεταφορά μιας πύλης ενημερώνεται παντού με μία αλλαγή της ετικέτας. Διπλή ετικέτα (conflict) δεν κρίνει.
  for (const r of roster || []) {
    if (!r || !r.lrr || r.lat == null || r.lng == null || r.conflict) continue;
    const k = String(r.lrr).toUpperCase(), g = gw.get(k) || gw.get(String(r.lrr));
    if (g) { g.lat = r.lat; g.lon = r.lng; g.posDecl = true; }
    pos[k] = { lat: r.lat, lon: r.lng, decl: 1 };
  }
  for (const [id, g] of gw.entries()) {""")
a = sub(a, """    if (g.lat != null && g.lon != null) pos[id] = { lat: Number(g.lat), lon: Number(g.lon) };
    else if (pos[id]) { g.lat = pos[id].lat; g.lon = pos[id].lon; g.posMem = true; }""",
"""    if (g.posDecl) continue;
    if (g.lat != null && g.lon != null && !(pos[id] && pos[id].decl)) pos[id] = { lat: Number(g.lat), lon: Number(g.lon) };
    else if (pos[id]) { g.lat = pos[id].lat; g.lon = pos[id].lon; g.posMem = !pos[id].decl; g.posDecl = !!pos[id].decl; }""")

# 4. σελίδα χάρτη: η δηλωμένη θέση κερδίζει, και φαίνεται η διαφορά με το ThingPark
h = sub(h, "    if (!n.p && r.p) { n.p = r.p; n.posKind = 'ok'; n.posWhy = ''; n.sharedP = null; }",
           "    if (r.p && !r.conflict) { n.p = r.p; n.posKind = 'ok'; n.posWhy = 'δηλωμένη θέση'; n.sharedP = null; }   // T-COORD-SYNC-02: η δηλωμένη θέση κερδίζει\n    else if (!n.p && r.p) { n.p = r.p; n.posKind = 'ok'; n.posWhy = ''; n.sharedP = null; }")
h = sub(h, "    if (g.tp.c === 'DISC') h += '<div class=\"note\">Η πύλη έχασε τη σύνδεσή της",
           "    if (g.tp.dm) h += '<div class=\"note\">Η θέση στο ThingPark απέχει ' + (g.tp.dm >= 1000 ? (g.tp.dm / 1000).toFixed(1).replace('.', ',') + ' km' : g.tp.dm + ' m') + ' από τη δηλωμένη. Ο χάρτης δείχνει τη δηλωμένη· διορθώστε τη θέση στο ThingPark (ή την ετικέτα, αν λάθος είναι αυτή).</div>';\n    if (g.tp.c === 'DISC') h += '<div class=\"note\">Η πύλη έχασε τη σύνδεσή της")

open(A, 'wb').write(a.encode('utf-8'))
open(H, 'wb').write(h.encode('utf-8'))
r = subprocess.run(['node', '--check', A], capture_output=True, text=True)
print('node --check analysis', r.returncode, r.stderr[:300])
