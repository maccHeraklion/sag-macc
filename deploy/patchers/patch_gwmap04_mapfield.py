# -*- coding: utf-8 -*-
# T-GWMAP-04 (7/11/2026, Μιχάλης): ένας χάρτης αντί για πολλούς. Το gatewayLiveness γράφει μία γραμμή `map_field`
# ανά εγγραφή αγρού στη συσκευή εποπτείας: θέση, παραγωγός, όργανα, ηλικία, γνωστή πύλη.
#
# ΔΕΝ ΕΦΑΡΜΟΖΕΤΑΙ ΑΠΟ ΜΟΝΟ ΤΟΥ. Χωρίς ορίσματα κάνει ΔΟΚΙΜΗ: ελέγχει κάθε αντικατάσταση (count==1) και το
# `node --check`, και δεν γράφει τίποτα.
#   python deploy/patchers/patch_gwmap04_mapfield.py               δοκιμή, δεν γράφει
#   python deploy/patchers/patch_gwmap04_mapfield.py --out X.js    γράφει το αποτέλεσμα στο X.js (χρήση: gwmap04_check)
#   python deploy/patchers/patch_gwmap04_mapfield.py --apply       γράφει στο analysis/gatewayLiveness.js
#
# ΑΠΟΦΑΣΕΙΣ (βλ. αναφορά):
#  · Θέση: φόρμα, μετά ετικέτα. Η μεταβλητή `location` ΔΕΝ διαβάζεται: θα κόστιζε μία ανάγνωση ανά αγρό ανά ώρα.
#  · Τύπος οργάνου: από την ετικέτα `type` (fields[]=tags στον υπάρχοντα κατάλογο, 0 νέες κλήσεις). ΟΧΙ από το όνομα:
#    το «Ηλεκτροβάνα 1» είναι εγγραφή αγρού. Οι ετικέτες σβήνονται αμέσως μετά, γιατί έχουν κλειδιά συσκευών.
#  · Δεύτερη εγγραφή (POST) αφού γραφτούν οι κάρτες πύλης: ούτε απόρριψη των map_field από την TagoIO τις ακουμπά.
import argparse, io, os, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PATH = os.path.join(ROOT, "analysis", "gatewayLiveness.js")

ap = argparse.ArgumentParser()
ap.add_argument("--apply", action="store_true")
ap.add_argument("--out")
ap.add_argument("--src", default=PATH)
args = ap.parse_args()

src = io.open(args.src, "r", encoding="utf-8", newline="").read()
if "\r\n" in src:
    sys.exit("ΑΠΟΤΥΧΙΑ: το αρχείο έχει CRLF, περίμενα LF")
if "T-GWMAP-04" in src:
    sys.exit("ΑΠΟΤΥΧΙΑ: ήδη εφαρμοσμένο")


def sub(old, new, label):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit("ΑΠΟΤΥΧΙΑ %s: βρέθηκε %d φορές" % (label, n))
    src = src.replace(old, new)


# 1 · κεφαλίδα: το κόστος γράφεται εκεί που το ψάχνει κάποιος
sub("// ΔΕΝ γράφει ΤΙΠΟΤΑ σε συσκευές πελατών και ΔΕΝ αγγίζει τον πυρήνα.\n",
    "// + T-GWMAP-04 (7/11/2026): μία γραμμή `map_field` ανά εγγραφή αγρού για τον ενιαίο χάρτη (sag-map.html): +65 εγγραφές/ώρα\n"
    "//   = 1.560/ημέρα, 0 νέες αναγνώσεις δεδομένων, +1 POST ανά εκτέλεση.\n"
    "// ΔΕΝ γράφει ΤΙΠΟΤΑ σε συσκευές πελατών και ΔΕΝ αγγίζει τον πυρήνα.\n", "P1 κεφαλίδα")

# 2 · οι καθαρές συναρτήσεις, χωρίς API, ώστε να δοκιμάζονται εκτός TagoIO (analysis/test/gwmap04_check.mjs)
PURE = r'''// ═══ T-GWMAP-04 (7/11/2026) · ΕΝΙΑΙΟΣ ΧΑΡΤΗΣ: ΜΙΑ ΓΡΑΜΜΗ map_field ΑΝΑ ΕΓΓΡΑΦΗ ΑΓΡΟΥ (ΑΡΧΗ) ════════════════════
// Ο χάρτης πρέπει να δείχνει ΚΑΙ όσους αγρούς δεν υπολογίζονται, ενώ το fleet_field έχει μόνο τους υπολογισμένους.
// Εδώ όλα βγαίνουν από ό,τι έχει ήδη φορτωθεί: 0 αναγνώσεις δεδομένων. Μετρημένα 7/11: 65 εγγραφές, όλες με ετικέτα
// coordinates, 42 με θέση στη φόρμα, 64 με clientName, διπλά κλειδιά ετικετών υπάρχουν.
// ΠΟΤΕ δεν τυπώνονται τιμές ετικετών: οι ετικέτες αισθητήρων έχουν κλειδιά συσκευών.
const MAP_ROW_MAX = 1500;           // χαρακτήρες: κάθε metadata μένει ΚΑΤΩ από αυτό
const MAP_DIFF_KM = 1;              // km: φόρμα και ετικέτα πιο μακριά από αυτό = ασυμφωνία
const MAP_NAME_STEPS = [24, 14, 8, 0];   // πρώτα κόβονται τα ονόματα οργάνων, μόνο μετά φεύγουν όργανα

function mapTagAll(tags, key) {
  const k = String(key).toLowerCase(), out = [];
  for (const t of Array.isArray(tags) ? tags : []) {
    if (!t || String(t.key).toLowerCase() !== k) continue;
    const v = String(t.value == null ? "" : t.value).trim();
    if (v) out.push(v);
  }
  return out;
}
/* Number(null) === 0 και το 0 είναι πεπερασμένο: χωρίς αυτόν τον φράχτη άδειο πεδίο γίνεται σημείο στον ωκεανό. */
function mapNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}
function mapPoint(a, b) {
  const lat = mapNum(a), lng = mapNum(b);
  if (!(lat >= GR_BOX.latMin && lat <= GR_BOX.latMax && lng >= GR_BOX.lngMin && lng <= GR_BOX.lngMax)) return null;
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}
/* Θέση αγρού: φόρμα, μετά ετικέτα. ps = πηγή, pq = ποιότητα:
     ok · dup (διπλή ετικέτα, διαφορετικές τιμές) · diff (φόρμα και ετικέτα διαφέρουν > 1 km) · none (καμία θέση)
   Το shared (ίδιο σημείο με άλλον παραγωγό) το βάζει η buildMapFieldRows, που βλέπει όλες τις εγγραφές. */
function mapFieldPosition(tags) {
  const tagPts = [];
  for (const raw of mapTagAll(tags, "coordinates")) {
    const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    const p = m ? mapPoint(m[1], m[2]) : null;
    if (p && !tagPts.some((q) => haversineKm(p.lat, p.lng, q.lat, q.lng) < 0.01)) tagPts.push(p);
  }
  let form = null;
  try {
    const c = JSON.parse(mapTagAll(tags, "configuration")[0] || "{}");
    if (c && typeof c === "object") form = mapPoint(c.latitude, c.longitude);
  } catch (e) { form = null; }   // χαλασμένη φόρμα: μένει η ετικέτα. Το μήνυμα ΔΕΝ τυπώνεται, περιέχει την τιμή.
  const p = form || tagPts[0] || null;
  if (!p) return { y: null, x: null, ps: null, pq: "none" };
  let pq = "ok";
  if (tagPts.length > 1) pq = "dup";
  else if (form && tagPts.length && haversineKm(form.lat, form.lng, tagPts[0].lat, tagPts[0].lng) > MAP_DIFF_KM) pq = "diff";
  return { y: p.lat, x: p.lng, ps: form ? "form" : "tag", pq };
}
/* Ποια όργανα δηλώνει ο αγρός. Το `devices` είναι JSON {όνομα: id}· ίδια ανοχή με την buildFieldOf, και κρατάμε το
   όνομα γιατί συσκευή εκτός Actility δεν υπάρχει στον κατάλογο. Διπλή ετικέτα: ενώνονται και οι δύο. */
function mapFieldDevices(tags) {
  const out = [], seen = new Set();
  const add = (id, name) => {
    id = String(id);
    if (!/^[0-9a-f]{24}$/.test(id) || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: String(name || "") });
  };
  for (const raw of mapTagAll(tags, "devices")) {
    let o = null;
    try { o = JSON.parse(raw); } catch (e) { o = null; }
    if (Array.isArray(o)) o.forEach((id) => add(id, ""));
    else if (o && typeof o === "object") Object.keys(o).forEach((k) => add(o[k], k));
    else (raw.match(/[0-9a-f]{24}/g) || []).forEach((id) => add(id, ""));
  }
  return out;
}
/* Κρατά ΜΟΝΟ την ετικέτα `type` και σβήνει όλες τις ετικέτες από τον κατάλογο, ώστε κανένα κλειδί συσκευής να μη
   μείνει στη μνήμη της εκτέλεσης και να μη φτάσει ποτέ σε log. */
function mapDeviceTypes(devs) {
  const typeOf = new Map();
  for (const d of devs || []) {
    if (!d) continue;
    const t = mapTagAll(d.tags, "type")[0];
    if (t) typeOf.set(d.id, t.toLowerCase());
    delete d.tags;
  }
  return typeOf;
}
/* Από τα gateways αυτής της εκτέλεσης στο «ποια πύλη άκουσε ποια συσκευή». Όσοι δεν στέλνουν lrrid μένουν null:
   άγνωστη πύλη, όχι «καμία πύλη». */
function mapGatewayOf(gw) {
  const out = new Map();
  for (const [code, g] of (gw || new Map()).entries()) for (const s of (g && g.list) || []) out.set(s.id, code);
  return out;
}
/* Όριο μεγέθους. Σειρά: ονόματα οργάνων, μετά τα όργανα από το τέλος (η λίστα έχει τα χειρότερα πρώτα) με μέτρηση
   στο `dc`, ώστε η σελίδα να πει πόσα έφυγαν. Τέλος, για παθολογικά μεγάλο όνομα, το όνομα αγρού και παραγωγού. */
function mapFitRow(md) {
  const fits = () => JSON.stringify(md).length < MAP_ROW_MAX;
  if (fits()) return md;
  for (const n of MAP_NAME_STEPS) {
    for (const d of md.dv) d.n = n ? truncName(d.n, n) : "";
    if (fits()) return md;
  }
  while (md.dv.length && !fits()) { md.dv.pop(); md.dc = (md.dc || 0) + 1; }
  if (!fits()) { md.n = truncName(md.n, 60); md.c = md.c == null ? null : truncName(md.c, 40); }
  return md;
}
/* ΚΑΘΑΡΗ: ό,τι χρειάζεται της δίνεται. fields = εγγραφές αγρών με tags, devs = κατάλογος χωρίς tags. */
function buildMapFieldRows({ fields, devs, typeOf, gwOf, now }) {
  now = now || Date.now();
  const byId = new Map((devs || []).map((d) => [d.id, d]));
  const metas = [];
  for (const f of fields || []) {
    if (!f || !f.id) continue;
    const tags = Array.isArray(f.tags) ? f.tags : [];
    const dv = mapFieldDevices(tags).map((x) => {
      const d = byId.get(x.id) || {};
      const h = ageHours(d.last_input, now);
      return { i: x.id.slice(-6), n: String(d.name || x.name || ""), t: (typeOf && typeOf.get(x.id)) || null,
        h: Number.isFinite(h) ? Math.round(Math.max(0, h) * 10) / 10 : null, g: (gwOf && gwOf.get(x.id)) || null };
    });
    // Τα χειρότερα πρώτα: αν χρειαστεί να φύγει όργανο, φεύγει το πιο υγιές.
    dv.sort((a, b) => (b.h == null ? Infinity : b.h) - (a.h == null ? Infinity : a.h));
    const pos = mapFieldPosition(tags);
    metas.push({ i: String(f.id), n: mapTagAll(tags, "name")[0] || String(f.name || f.id),
      c: mapTagAll(tags, "clientName")[0] || null, y: pos.y, x: pos.x, ps: pos.ps, pq: pos.pq, dv });
  }
  // Ίδιο σημείο με ΑΛΛΟΝ παραγωγό = ύποπτη θέση. Ίδιος παραγωγός στο ίδιο σημείο είναι θεμιτό (π.χ. ξενοδοχείο).
  const owners = new Map();
  for (const m of metas) {
    if (m.y == null || !m.c) continue;
    const k = m.y.toFixed(5) + "," + m.x.toFixed(5);
    owners.set(k, (owners.get(k) || new Set()).add(m.c));
  }
  for (const m of metas) {
    if (m.y != null && (owners.get(m.y.toFixed(5) + "," + m.x.toFixed(5)) || new Set()).size > 1) m.pq = "shared";
  }
  const time = new Date(now).toISOString();   // ΙΔΙΑ ώρα σε όλη την παρτίδα: έτσι ο χάρτης ξεχωρίζει τον τελευταίο κύκλο
  return metas.map((m) => ({ variable: "map_field", value: m.dv.length, time, metadata: mapFitRow(m) }));
}
// ═══ T-GWMAP-04 (ΤΕΛΟΣ) ═══════════════════════════════════════════════════════════════════════════════════

'''
sub("/* Η ΜΝΗΜΗ: ποιες συσκευές ξέρουμε ότι στέλνουν lrrid, και πού σταμάτησε η ανακάλυψη.\n",
    PURE + "/* Η ΜΝΗΜΗ: ποιες συσκευές ξέρουμε ότι στέλνουν lrrid, και πού σταμάτησε η ανακάλυψη.\n", "P2 καθαρές συναρτήσεις")

# 3 · ο τύπος οργάνου: ίδια κλήση, ένα πεδίο παραπάνω
sub("    const c = await api(`/device?amount=200&page=${page}&fields[]=id&fields[]=name`\n"
    "      + `&fields[]=last_input&filter[network]=${ACTILITY_NET}`);\n",
    "    const c = await api(`/device?amount=200&page=${page}&fields[]=id&fields[]=name&fields[]=tags`\n"
    "      + `&fields[]=last_input&filter[network]=${ACTILITY_NET}`);\n", "P3 κατάλογος")
sub("  const live = devs.filter((d) => d.last_input);\n",
    "  // T-GWMAP-04: μένει μόνο ο τύπος· οι ετικέτες σβήνονται εδώ, πριν από οτιδήποτε άλλο.\n"
    "  let typeOf = new Map();\n"
    "  try { typeOf = mapDeviceTypes(devs); } catch (e) { for (const d of devs) if (d) delete d.tags; console.log(\"ΧΑΡΤΗΣ|τύποι: σφάλμα\"); }\n"
    "  const live = devs.filter((d) => d.last_input);\n", "P4 τύποι")

# 4 · οι εγγραφές αγρών μένουν διαθέσιμες για τον χάρτη (καμία νέα ανάγνωση)
sub("  let fieldOf = new Map();\n  try {\n",
    "  let fieldOf = new Map();\n  let fieldRecs = [];   // T-GWMAP-04: οι ίδιες εγγραφές τροφοδοτούν και το map_field\n  try {\n", "P5 δήλωση")
sub("    fieldOf = buildFieldOf((f || []).filter((d) => (d.tags || []).some((t) => t && t.key === \"isField\" && t.value === \"yes\")));\n",
    "    fieldRecs = (f || []).filter((d) => (d.tags || []).some((t) => t && t.key === \"isField\" && t.value === \"yes\"));\n"
    "    fieldOf = buildFieldOf(fieldRecs);\n", "P6 εγγραφές")

# 5 · η εγγραφή: ΜΕΤΑ τις κάρτες πύλης, σε δικό της POST και δικό της try/catch
sub("  await api(`/device/${OVERSEER}/data`, { method: \"POST\", body: JSON.stringify(out) });\n",
    "  await api(`/device/${OVERSEER}/data`, { method: \"POST\", body: JSON.stringify(out) });\n"
    "\n"
    "  // 4δ · T-GWMAP-04: ο ενιαίος χάρτης. Τρέχει ΑΦΟΥ γραφτούν οι κάρτες πύλης, άρα δεν μπορεί να τις σταματήσει ούτε\n"
    "  //      σφάλμα ούτε απόρριψη της εγγραφής. Χωρίς αγρούς δεν γράφει τίποτα: ο χάρτης θα δείξει ότι τα δεδομένα παλιώνουν.\n"
    "  try {\n"
    "    const mapRows = fieldRecs.length ? buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), now }) : [];\n"
    "    if (mapRows.length) await api(`/device/${OVERSEER}/data`, { method: \"POST\", body: JSON.stringify(mapRows) });\n"
    "    console.log(`ΧΑΡΤΗΣ|${mapRows.length} γραμμές map_field`);\n"
    "  } catch (e) { console.log(\"ΧΑΡΤΗΣ|σφάλμα \" + ((e && e.name) || \"άγνωστο\")); }\n", "P7 εγγραφή")

# έλεγχος σύνταξης πριν γραφτεί οτιδήποτε
fd, tmp = tempfile.mkstemp(suffix=".js")
os.close(fd)
try:
    with io.open(tmp, "w", encoding="utf-8", newline="") as f:
        f.write(src)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        sys.exit("ΑΠΟΤΥΧΙΑ node --check:\n" + r.stderr)
finally:
    os.unlink(tmp)

target = args.out or (PATH if args.apply else None)
if target:
    with io.open(target, "w", encoding="utf-8", newline="") as f:
        f.write(src)
    print("ΓΡΑΦΤΗΚΕ", target)
else:
    print("ΔΟΚΙΜΗ: 7 αντικαταστάσεις count==1, node --check ΟΚ. Δεν γράφτηκε τίποτα (χρειάζεται --apply).")
