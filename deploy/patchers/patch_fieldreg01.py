# T-FIELDREG-01 (11/11/2026, Michalis: «έλεγχος του ονόματος αγρού, της θέσης στο χάρτη και της θέσης gateway που λαμβάνει σήμα,
# έτσι θα ξέρουμε αν είναι σωστή η καταχώρηση»). gatewayLiveness: για κάθε αγρό, συμπέρασμα rc στη γραμμή map_field:
#   θέση: η πύλη που ακούει τα όργανα (με αξιόπιστη θέση) απέχει ≤ 15 km → «επιβεβαιωμένη»· αλλιώς «μακριά» (+ ποιο άλλο αντίγραφο
#   θέσης συμφωνεί με την πύλη)· «χωρίς μάρτυρα» / «χωρίς θέση».  όνομα: ίδιο όνομα με άλλη εγγραφή · όνομα ≠ όνομα συσκευής.
# Κοινόχρηστα όργανα (shared_instrument=yes) δεν μετράνε ως μάρτυρες. Σελίδα χάρτη: ενότητα «Έλεγχος καταχώρησης» στο πάνελ αγρού.
# Μόνο ανάγνωση/αναφορά — δεν αλλάζει καμία ετικέτα.
import sys, subprocess
A, H = sys.argv[1], sys.argv[2]


def load(p):
    s = open(p, 'rb').read().decode('utf-8')
    assert '\r\n' not in s
    return s


def sub(src, old, new, cnt=1):
    n = src.count(old)
    assert n == cnt, (n, old[:90])
    return src.replace(old, new)


a, h = load(A), load(H)

# 1. κοινόχρηστα: η mapDeviceTypes τα σημειώνει πριν σβήσει τις ετικέτες
a = sub(a, """    const t = mapTagAll(d.tags, "type")[0];
    if (t) typeOf.set(d.id, t.toLowerCase());
    delete d.tags;""", """    const t = mapTagAll(d.tags, "type")[0];
    if (t) typeOf.set(d.id, t.toLowerCase());
    if (/^(yes|ναι|true|1)$/i.test(mapTagAll(d.tags, "shared_instrument")[0] || "")) MAP_SHARED.add(String(d.id).slice(-6));   // T-FIELDREG-01
    delete d.tags;""")

# 2. ο έλεγχος (καθαρές συναρτήσεις) πριν από το τέλος του μπλοκ T-GWMAP-04
REG = r'''
// ═══ T-FIELDREG-01 (11/11/2026) · ΕΛΕΓΧΟΣ ΚΑΤΑΧΩΡΗΣΗΣ ΑΓΡΟΥ: ΟΝΟΜΑ · ΘΕΣΗ ΣΤΟΝ ΧΑΡΤΗ · ΠΥΛΗ ΠΟΥ ΑΚΟΥΕΙ ═══════════
// Michalis: «έτσι θα ξέρουμε αν είναι σωστή η καταχώρηση». Η πύλη που παραδίδει τα πακέτα των οργάνων είναι ανεξάρτητος
// μάρτυρας της θέσης: αν απέχει > 15 km από τη θέση του χάρτη, ή η θέση ή η ανάθεση οργάνων είναι λάθος. Μόνο αναφορά.
// Αξιόπιστη θέση πύλης = δηλωμένη (ετικέτα) ή μοναδική (θέση που μοιράζονται ≥2 πύλες είναι η θέση καταχώρισης, άγνωστη).
// Κοινόχρηστα όργανα δεν είναι μάρτυρες (ο σταθμός του δήμου ακούγεται από τη δική του πύλη). 0 νέες αναγνώσεις.
const REG_NEAR_KM = WRONG_FIELD_KM;   // ίδιο όριο με το «λάθος αγρός»
function regFold(s) {
  return String(s == null ? "" : s).replace(/^Field_/i, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/ς/g, "σ").replace(/ει|οι|[ηυ]/g, "ι").replace(/ω/g, "ο").replace(/[^a-z0-9α-ω]+/g, " ").trim();
}
function regGatewayPositions(pos, gw) {
  const cand = new Map(), cnt = new Map(), out = new Map();
  const key = (q) => q.lat.toFixed(3) + "," + q.lon.toFixed(3);
  for (const [k, v] of Object.entries(pos || {})) {
    if (v && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lon)))
      cand.set(String(k).toUpperCase(), { lat: Number(v.lat), lon: Number(v.lon), decl: !!v.decl });
  }
  for (const [code, g] of (gw || new Map()).entries()) {
    const c = String(code).toUpperCase();
    if (!cand.has(c) && g && g.lat != null && g.lon != null && Number.isFinite(Number(g.lat)))
      cand.set(c, { lat: Number(g.lat), lon: Number(g.lon), decl: !!g.posDecl });
  }
  for (const q of cand.values()) cnt.set(key(q), (cnt.get(key(q)) || 0) + 1);
  for (const [c, q] of cand) if (q.decl || cnt.get(key(q)) === 1) out.set(c, q);
  return out;
}
/* Προσθέτει rc σε κάθε γραμμή map_field. rc.v: ok · far · nogw · nopos · rc.km/g: πλησιέστερη πύλη-μάρτυρας ·
   rc.a/ak: το ΑΛΛΟ αντίγραφο θέσης (tag/form) που συμφωνεί με την πύλη · rc.x="tagold": η πύλη επιβεβαιώνει τη φόρμα, η ετικέτα
   είναι παλιά · rc.nm: dup (ίδιο όνομα με rc.nd άλλες εγγραφές) / ren (όνομα εγγραφής ≠ όνομα συσκευής rc.on). */
function regCheckRows(rows, fields, gpos, shared6) {
  const sum = { n: 0, ok: 0, far: 0, nogw: 0, nopos: 0, dup: 0, ren: 0, list: [] };
  const fById = new Map((fields || []).map((f) => [String(f.id), f]));
  const byName = new Map();
  for (const r of rows || []) { const k = regFold(r.metadata.n); if (k) byName.set(k, (byName.get(k) || 0) + 1); }
  for (const r of rows || []) {
    const m = r.metadata, f = fById.get(String(m.i)) || {}, tags = Array.isArray(f.tags) ? f.tags : [];
    const rc = {};
    sum.n++;
    const nk = regFold(m.n);
    if (nk && byName.get(nk) > 1) { rc.nm = "dup"; rc.nd = byName.get(nk) - 1; sum.dup++; }
    else if (mapTagAll(tags, "name")[0] && f.name && regFold(f.name) !== nk) { rc.nm = "ren"; rc.on = truncName(f.name, 40); sum.ren++; }
    const codes = new Set();
    for (const d of m.dv || []) {
      if (shared6 && shared6.has(String(d.i))) continue;
      if (d.g) codes.add(String(d.g).toUpperCase());
      for (const x of d.gs || []) if (x && x[0]) codes.add(String(x[0]).toUpperCase());
    }
    const known = [...codes].map((c) => [c, gpos && gpos.get(c)]).filter((x) => x[1]);
    const near = (pt) => { let b = null; for (const [c, q] of known) { const km = haversineKm(pt.lat, pt.lon, q.lat, q.lon); if (!b || km < b.km) b = { c, km }; } return b; };
    if (m.y == null || m.x == null) { rc.v = "nopos"; sum.nopos++; }
    else if (!known.length) { rc.v = "nogw"; sum.nogw++; }
    else {
      const b = near({ lat: m.y, lon: m.x });
      rc.km = Math.round(b.km * 10) / 10; rc.g = b.c;
      // Τα ΔΥΟ αντίγραφα θέσης: φόρμα (configuration) και ετικέτα coordinates.
      let form = null, tag = null;
      try { const c = JSON.parse(mapTagAll(tags, "configuration")[0] || "{}"); form = c && typeof c === "object" ? mapPoint(c.latitude, c.longitude) : null; } catch (e) { form = null; }
      for (const raw of mapTagAll(tags, "coordinates")) {
        const mm = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (mm && !tag) tag = mapPoint(mm[1], mm[2]);
      }
      const alt = m.ps === "form" ? tag : (m.ps === "tag" ? form : null);
      if (b.km <= REG_NEAR_KM) {
        rc.v = "ok"; sum.ok++;
        if (m.ps === "form" && tag && haversineKm(form.lat, form.lng, tag.lat, tag.lng) > MAP_DIFF_KM) rc.x = "tagold";
      } else {
        rc.v = "far"; sum.far++;
        if (alt) { const ab = near({ lat: alt.lat, lon: alt.lng }); if (ab && ab.km <= REG_NEAR_KM) { rc.a = m.ps === "form" ? "tag" : "form"; rc.ak = Math.round(ab.km * 10) / 10; } }
        sum.list.push(truncName(m.n, 40) + "|" + rc.km + " km|" + (rc.a ? "συμφωνεί η " + (rc.a === "tag" ? "ετικέτα" : "φόρμα") : "κανένα αντίγραφο δεν συμφωνεί"));
      }
    }
    m.rc = rc;
    r.metadata = mapFitRow(m);
  }
  return sum;
}
// ═══ T-FIELDREG-01 (ΤΕΛΟΣ) ═══════════════════════════════════════════════════════════════════════════════
'''
# ΜΕΤΑ το τέλος του μπλοκ T-GWMAP-04 (το gwmap04_check φορτώνει μόνο το μπλοκ, χωρίς το WRONG_FIELD_KM)
_END = [l for l in a.split('\n') if l.startswith('// ═══ T-GWMAP-04 (ΤΕΛΟΣ)')]
assert len(_END) == 1
a = sub(a, _END[0] + '\n', _END[0] + '\n\n' + REG.strip('\n') + '\n')
# η λίστα κοινόχρηστων μένει ΜΕΣΑ στο μπλοκ του χάρτη (τη χρησιμοποιεί η mapDeviceTypes)
a = sub(a, "const MAP_NAME_STEPS = [24, 14, 8, 0];",
        "const MAP_SHARED = new Set();       // T-FIELDREG-01: τελευταία 6 ψηφία οργάνων με shared_instrument=yes (τα γεμίζει η mapDeviceTypes)\nconst MAP_NAME_STEPS = [24, 14, 8, 0];")

# 3. κλήση στην κύρια ροή: πριν γραφτούν οι γραμμές του χάρτη
a = sub(a, """    const mapRows = fieldRecs.length ? buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), heard, now }) : [];
""", """    const mapRows = fieldRecs.length ? buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), heard, now }) : [];
    // T-FIELDREG-01: έλεγχος καταχώρησης (όνομα · θέση · πύλη). Δικό του try: αν σκάσει, ο χάρτης γράφεται όπως πριν.
    try {
      const rg = regCheckRows(mapRows, fieldRecs, regGatewayPositions(pos, gw), MAP_SHARED);
      console.log(`ΚΑΤΑΧΩΡΗΣΕΙΣ|αγροί=${rg.n}|επιβεβαιωμένες=${rg.ok}|μακριά από την πύλη=${rg.far}|χωρίς μάρτυρα=${rg.nogw}|χωρίς θέση=${rg.nopos}|διπλό όνομα=${rg.dup}|όνομα≠συσκευή=${rg.ren}`);
      for (const l of rg.list.slice(0, 15)) console.log("ΚΑΤ|μακριά|" + l);
    } catch (e) { console.log("ΚΑΤΑΧΩΡΗΣΕΙΣ|σφάλμα " + ((e && e.name) || "άγνωστο")); }
""")

# ───────────── σελίδα χάρτη ─────────────
h = sub(h, "pq: md ? (md.pq || 'ok') : null,", "pq: md ? (md.pq || 'ok') : null, rc: (md && md.rc) || null,")
h = sub(h, """  if (f.pq === 'dup') h += '<div class="note">Διπλή ετικέτα coordinates με διαφορετικές τιμές.</div>';
""", """  if (f.pq === 'dup') h += '<div class="note">Διπλή ετικέτα coordinates με διαφορετικές τιμές.</div>';
  h += regBlock(f);
""")
h = sub(h, "function panelField(f) {", r"""/* T-FIELDREG-01: έλεγχος καταχώρησης — όνομα, θέση στον χάρτη, πύλη που ακούει τα όργανα (το συμπέρασμα το βγάζει το gatewayLiveness). */
function regKm(v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + ' km'; }
function regBlock(f) {
  var rc = f.rc;
  if (!rc) return '';
  var gwLink = function (code) {
    var g = null;
    Object.keys(f.gws || {}).forEach(function (k) { if (String(f.gws[k].code).toUpperCase() === String(code).toUpperCase()) g = f.gws[k]; });
    return g ? '<button type="button" class="link" data-sel="gw" data-key="' + esc(g.key) + '">' + esc(g.name) + '</button>' : 'πύλη ' + esc(code);
  };
  var h = '<h3>Έλεγχος καταχώρησης</h3>';
  if (rc.v === 'ok') {
    h += '<div class="meta">✔ Η θέση επιβεβαιώνεται: τα όργανα ακούγονται από ' + gwLink(rc.g) + ', ' + regKm(rc.km) + ' από τον αγρό.</div>';
    if (rc.x === 'tagold') h += '<div class="note">Η ετικέτα coordinates έχει άλλη, παλιά θέση. Σωστή είναι η φόρμα (την επιβεβαιώνει η πύλη)· η ετικέτα διορθώνεται μόνη της με την επόμενη αποθήκευση της φόρμας.</div>';
  } else if (rc.v === 'far') {
    h += '<div class="note">⚠ Τα όργανα του αγρού ακούγονται από ' + gwLink(rc.g) + ', που απέχει ' + regKm(rc.km) + ' από τη θέση του χάρτη (όριο ' + REG_KM + ' km). Είτε η θέση είναι λάθος είτε τα όργανα είναι δηλωμένα σε λάθος αγρό.</div>';
    if (rc.a) h += '<div class="note">Η θέση ' + (rc.a === 'tag' ? 'της ετικέτας coordinates' : 'της φόρμας') + ' απέχει μόνο ' + regKm(rc.ak) + ' από την πύλη — πιθανότατα αυτή είναι η σωστή.</div>';
  } else if (rc.v === 'nogw') {
    h += '<div class="meta">Δεν ελέγχεται: κανένα όργανο (εκτός κοινόχρηστων) δεν αναφέρει πύλη με γνωστή θέση.</div>';
  } else if (rc.v === 'nopos') {
    h += '<div class="meta">Δεν ελέγχεται: ο αγρός δεν έχει θέση.</div>';
  }
  if (rc.nm === 'dup') h += '<div class="note">Το ίδιο όνομα έχουν και ' + (rc.nd === 1 ? 'άλλη μία εγγραφή' : rc.nd + ' άλλες εγγραφές') + ': μπερδεύει παραγωγούς, χρεώσεις και αναφορές.</div>';
  if (rc.nm === 'ren') h += '<div class="note">Το όνομα της εγγραφής διαφέρει από το όνομα της συσκευής («' + esc(rc.on) + '»).</div>';
  return h;
}
var REG_KM = 15;
function panelField(f) {""")
h = sub(h, "+ '<div class=\"chips\">' + chip(s) + (ss ? chip(ss) : '') + (f.suspect ? '<span class=\"st c-check\">! ύποπτη θέση</span>' : '') + '</div>'",
           "+ '<div class=\"chips\">' + chip(s) + (ss ? chip(ss) : '') + (f.suspect ? '<span class=\"st c-check\">! ύποπτη θέση</span>' : '') + (f.rc && f.rc.v === 'far' ? '<span class=\"st c-check\">! θέση ≠ πύλη</span>' : '') + '</div>'", 2)   # λίστα + πάνελ

open(A, 'wb').write(a.encode('utf-8'))
open(H, 'wb').write(h.encode('utf-8'))
r = subprocess.run(['node', '--check', A], capture_output=True, text=True)
print('node --check analysis', r.returncode, r.stderr[:300])
assert r.returncode == 0
