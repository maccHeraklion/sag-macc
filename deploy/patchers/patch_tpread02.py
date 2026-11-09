# T-TPREAD-02 (9/11/2026, Michalis «προχώρα με το στάδιο 2»): ωριαία ανάγνωση ThingPark στο gatewayLiveness + εμφάνιση στον χάρτη.
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


TP2 = r'''
// ── T-TPREAD-02 (9/11/2026) · ΣΤΑΔΙΟ 2: ΩΡΙΑΙΑ ΑΝΑΓΝΩΣΗ THINGPARK ─────────────────────────────────────────────────────────────
// Κάθε ωριαία εκτέλεση: πύλες (κατάσταση σύνδεσης, υγεία, τελευταίο πακέτο), ενεργοί συναγερμοί πυλών, συσκευές (τελευταίο
// πακέτο, χαμένα πακέτα, μπαταρία). Η κατάσταση του ThingPark μπαίνει στον κατάλογο (`gateway_roster`) για τις πύλες με
// ετικέτα network_lrrid και αντικαθιστά το στιγμιότυπο της 7/11: αποσυνδεδεμένη → `off` = ημέρα τελευταίου πακέτου,
// συνδεδεμένη → φεύγει το `off`. Μία εγγραφή `tp_network` στην εποπτεία με τη σύνοψη. Αποτυχία ThingPark = παλιά συμπεριφορά.
// Κόστος: ~5 κλήσεις στο ThingPark (όχι στο TagoIO), +1 εγγραφή/ώρα. Τιμές συσκευών ΩΜΕΣ (κλίμακα PER/μπαταρίας ΥΠΟ ΕΛΕΓΧΟ).
const TP_SILENT_H = 24;
async function tpReadNetwork(env) {
  const { token } = await tpToken(env);
  const bs = new Map();
  for (let page = 1; page <= 5; page++) {
    const j = await tpGet(token, `/partners/mine/bss?pageSize=100&pageIndex=${page}&sort=lrrID,asc`);
    for (const b of (j && j.briefs) || []) {
      const up = b.upFrame && b.upFrame.last && b.upFrame.last.date;
      bs.set(String(b.lrrID || "").toUpperCase(), { l: String(b.lrrID || "").toUpperCase(), n: String(b.name || "").slice(0, 40),
        c: b.cnxState || null, h: b.healthState || null, s: Number(b.cnxStateSince) || null, u: Number(up) || null, a: 0 });
    }
    if (!j || !j.more) break;
  }
  try {
    for (let page = 1; page <= 3; page++) {
      const j = await tpGet(token, `/partners/mine/bss/alarms?pageSize=100&pageIndex=${page}&state=3`);
      for (const x of (j && j.briefs) || []) { const k = String((x.bs && x.bs.lrrID) || "").toUpperCase(); if (bs.has(k)) bs.get(k).a++; }
      if (!j || !j.more) break;
    }
  } catch (e) { console.log("TP|συναγερμοί: " + e.message); }
  const devs = [];
  try {
    for (let page = 1; page <= 6; page++) {
      const j = await tpGet(token, `/subscriptions/mine/devices?pageSize=100&pageIndex=${page}`);
      for (const d of (j && j.briefs) || []) devs.push({ n: String(d.name || "").slice(0, 40), e: String(d.EUI || "").slice(-4),
        u: Number(d.lastUpTimestamp) || null, p: d.lastMeanPER == null ? null : Number(d.lastMeanPER),
        b: d.lastBatLevel == null ? null : Number(d.lastBatLevel), r: d.avgRSSI == null ? null : Number(d.avgRSSI) });
      if (!j || !j.more) break;
    }
  } catch (e) { console.log("TP|συσκευές: " + e.message); }
  return { bs, devs };
}
function tpApplyRoster(roster, bs) {
  let n = 0;
  for (const r of roster || []) {
    const b = r && r.lrr ? bs.get(String(r.lrr).toUpperCase()) : null;
    if (!b) continue;
    n++;
    r.tp = { c: b.c, h: b.h, s: b.s, u: b.u, a: b.a };
    if (b.c === "DISC") { const d = b.u || b.s; if (d) r.off = new Date(d).toISOString().slice(0, 10); }
    else if (b.c === "CNX") delete r.off;
  }
  return n;
}
function tpNetworkRecord(bs, devs, roster, now) {
  const list = Array.from(bs.values());
  const inRoster = new Set((roster || []).map((r) => String(r.lrr || "").toUpperCase()).filter(Boolean));
  const cnx = list.filter((b) => b.c === "CNX").length, disc = list.filter((b) => b.c === "DISC").length;
  const quiet = list.filter((b) => b.c === "CNX" && (!b.u || now - b.u > TP_SILENT_H * 36e5)).length;
  const silent = devs.filter((d) => !d.u || now - d.u > TP_SILENT_H * 36e5);
  const top = silent.slice().sort((x, y) => (y.u || 0) - (x.u || 0)).slice(0, 25);
  const md = { t: new Date(now).toISOString(), bs: list, not_in_roster: list.filter((b) => !inRoster.has(b.l)).map((b) => b.l),
    dev: { total: devs.length, silent_24h: silent.length, silent_top: top },
    color: disc > 0 ? "orange" : "green",
    text: `ThingPark: ${list.length} πύλες, ${cnx} συνδεδεμένες, ${disc} αποσυνδεδεμένες, ${quiet} συνδεδεμένες χωρίς πακέτο 24 ωρών.`
      + ` Συσκευές ${devs.length}, ${silent.length} χωρίς πακέτο 24 ωρών.` };
  if (JSON.stringify(md).length > 9000) md.dev.silent_top = top.slice(0, 5);
  return { variable: "tp_network", value: `${cnx}/${list.length} πύλες συνδεδεμένες`, metadata: md };
}

(async () => {
  const t0 = Date.now();
  if (readScope().tp_probe) {'''

a = sub(a, "\n(async () => {\n  const t0 = Date.now();\n  if (readScope().tp_probe) {", TP2)

a = sub(a, """  // 4β · T-GWMAP-02: ο κατάλογος — ΜΟΝΟ αν διαβάστηκε (ένας άδειος κατάλογος θα έσβηνε τον χάρτη).
  if (roster.length) {""", """  // 4α · T-TPREAD-02: η κατάσταση του ThingPark στον κατάλογο + σύνοψη. Αποτυχία = ο κατάλογος μένει με τις ετικέτες.
  try {
    const tpn = await tpReadNetwork(readEnvMap());
    const nApplied = tpApplyRoster(roster, tpn.bs);
    const rec = tpNetworkRecord(tpn.bs, tpn.devs, roster, Date.now());
    out.push(rec);
    console.log(`TP|πύλες=${tpn.bs.size}|στον κατάλογο=${nApplied}|συσκευές=${tpn.devs.length}|${rec.value}|χωρίς πακέτο 24ω=${rec.metadata.dev.silent_24h}`);
  } catch (e) { console.log("TP|ΣΦΑΛΜΑ|" + ((e && e.message) || e) + " — ο κατάλογος μένει με τις ετικέτες"); }

  // 4β · T-GWMAP-02: ο κατάλογος — ΜΟΝΟ αν διαβάστηκε (ένας άδειος κατάλογος θα έσβηνε τον χάρτη).
  if (roster.length) {""")

# ── σελίδα ──
h = sub(h, "storage: !!r.storage, off: r.off || null, lrr: r.lrr || null, conflict: !!r.conflict, p: p,",
        "storage: !!r.storage, off: r.off || null, lrr: r.lrr || null, tp: r.tp || null, conflict: !!r.conflict, p: p,")
h = sub(h, "    n.storage = r.storage; n.conflict = r.conflict; n.dev = r.dev; n.off = r.off; n.lrr = r.lrr;\n",
        "    n.storage = r.storage; n.conflict = r.conflict; n.dev = r.dev; n.off = r.off; n.lrr = r.lrr;\n    n.tp = r.tp;   // T-TPREAD-02\n")
h = sub(h, "    P.n.storage = P.r.storage; P.n.conflict = P.r.conflict; P.n.dev = P.r.dev; P.n.off = P.r.off;\n",
        "    P.n.storage = P.r.storage; P.n.conflict = P.r.conflict; P.n.dev = P.r.dev; P.n.off = P.r.off;\n    P.n.tp = P.r.tp;   // T-TPREAD-02\n")
h = sub(h, """  all.forEach(function (g) {
    if (g.p && g.conflict) { g.posKind = 'suspect'; g.posWhy = 'διπλή ετικέτα coordinates με διαφορετικές τιμές'; }
  });""", """  all.forEach(function (g) {
    if (g.p && g.conflict) { g.posKind = 'suspect'; g.posWhy = 'διπλή ετικέτα coordinates με διαφορετικές τιμές'; }
    /* T-TPREAD-02: το ThingPark ξέρει αν η πύλη είναι συνδεδεμένη· αποσυνδεδεμένη = ΕΚΤΟΣ ΔΙΚΤΥΟΥ, όποια κι αν είναι η μαρτυρία. */
    if (g.tp && g.tp.c === 'DISC' && !g.storage) g.st = GSTATE.g_off;
  });""")
h = sub(h, "  h += '<div class=\"meta\">Θέση: ' + (g.p ?", """  if (g.tp) {
    var tpUpH = g.tp.u ? (Date.now() - g.tp.u) / 36e5 : null;
    var tpWord = g.tp.c === 'CNX' ? 'συνδεδεμένη' : (g.tp.c === 'DISC' ? 'αποσυνδεδεμένη' : 'άγνωστη κατάσταση');
    h += '<div class="meta">ThingPark: ' + tpWord + (g.tp.s ? ' από ' + esc(new Date(g.tp.s).toLocaleString('el-GR', { hour12: false, timeZone: 'Europe/Athens' })) : '')
      + ' · τελευταίο πακέτο ' + esc(tpUpH == null ? 'ποτέ' : ageWords(tpUpH)) + (g.tp.a ? ' · ' + g.tp.a + ' ενεργοί συναγερμοί' : '') + '</div>';
    if (g.tp.c === 'CNX' && (tpUpH == null || tpUpH > 24)) h += '<div class="note">Η πύλη είναι συνδεδεμένη στο δίκτυο, αλλά δεν έχει περάσει κανένα πακέτο από αυτήν (' + esc(tpUpH == null ? 'ποτέ' : ageWords(tpUpH)) + '): δεν ακούει κανένα όργανο.</div>';
    if (g.tp.c === 'DISC') h += '<div class="note">Η πύλη έχασε τη σύνδεσή της με το δίκτυο (internet ή ρεύμα), όχι απαραίτητα η κεραία. Τα όργανα που ακούγονται μόνο από αυτήν δεν φτάνουν.</div>';
  }
  h += '<div class="meta">Θέση: ' + (g.p ?""")

open(A, 'wb').write(a.encode('utf-8'))
open(H, 'wb').write(h.encode('utf-8'))
r = subprocess.run(['node', '--check', A], capture_output=True, text=True)
print('node --check analysis', r.returncode, r.stderr[:300])
