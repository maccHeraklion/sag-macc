// ════════════════════════════════════════════════════════════════════════════
// SAG · warehouseSnapshot — ΕΙΚΟΝΑ ΤΗΣ ΑΠΟΘΗΚΗΣ ΓΙΑ ΤΟ DASHBOARD «Αποθήκη»
// T-WH-01 (27/10/2026) · Φάση 1: ΜΟΝΟ ανάγνωση. Αίτημα Κώστα: ένα dashboard με όλη την
// αποθήκη οργανωμένη σε κατηγορίες, αντί για ένα blueprint dashboard ανά μοντέλο.
// ════════════════════════════════════════════════════════════════════════════
//
// ΤΟ ΠΡΟΒΛΗΜΑ: «στην αποθήκη» σήμερα = ετικέτα `storage=yes` (τη βάζει το addDevice).
// Το createField τη σβήνει, το addSensorsToField ΟΧΙ. Μετρημένο 27/10: από τις 59 συσκευές
// με `storage=yes`, αρκετές δουλεύουν ήδη σε αγρό (π.χ. uc511_7352 Κουτσάκη, lse02_7889
// Ρηγάκη, τρεις στο ΚΕΚ). Αν το dashboard διάβαζε μόνο την ετικέτα, θα πρόσφερε «ανάθεση»
// ή «απόσυρση» σε ελεγκτή που ποτίζει χωράφι.
//
// Η ΛΥΣΗ: η ιδιοκτησία ζει στην ετικέτα `devices` (JSON όνομα → id) κάθε συσκευής-αγρού
// (`isField=yes`). Διαβάζουμε όλους τους αγρούς και σημαδεύουμε κάθε συσκευή αποθήκης
// που εμφανίζεται σε κάποιον ως «Σε αγρό».
//
// ── ΚΟΣΤΟΣ ──────────────────────────────────────────────────────────────────
// Μόνο λίστες συσκευών (ετικέτες + last_input), ΚΑΜΙΑ ανάγνωση μετρήσεων: ~3 κλήσεις ανά
// εκτέλεση. Γράφει στη συσκευή «SAG Εποπτεία» ΜΟΝΟ όταν αλλάξει η εικόνα, ή κάθε
// HEARTBEAT_H ώρες ώστε το widget να ξέρει ότι η εικόνα είναι φρέσκια.
// ΔΕΝ γράφει τίποτα σε συσκευές πελατών ή αποθήκης.
//
// ΓΡΑΦΕΙ: `warehouse_chunk` (έως CHUNK συσκευές ανά εγγραφή, στο metadata.items) και
// `warehouse_summary` (μετρητές + hash), όλα με το ίδιο `group` ανά εκτέλεση. Το widget
// κρατά μόνο την τελευταία ομάδα.

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";

const OVERSEER = "6a98855ca06e41000bfae024";   // συσκευή «SAG Εποπτεία»
const CHUNK = 20;                              // συσκευές ανά εγγραφή (metadata ~4 KB)
const HEARTBEAT_H = 6;                         // ώρες: γράψε ξανά ακόμη κι αν δεν άλλαξε τίποτα

async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}

/* Λίστα συσκευών με φίλτρο ετικέτας, σε σελίδες των 200. */
async function listDevices(tagKey, tagValue, fields) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const q = [
      `page=${page}`, "amount=200",
      `filter[tags][0][key]=${encodeURIComponent(tagKey)}`,
      `filter[tags][0][value]=${encodeURIComponent(tagValue)}`,
      ...fields.map((f) => `fields[]=${f}`),
    ].join("&");
    const r = await api(`/device?${q}`);
    out.push(...(r || []));
    if (!r || r.length < 200) break;
  }
  return out;
}

/* Η TagoIO δέχεται ΔΙΠΛΑ κλειδιά ετικετών (π.χ. δύο `isField` στο ΚΕΚ) — κρατάμε την πρώτη μη κενή. */
const tagOf = (d, k) => {
  for (const t of (d && d.tags) || []) if (t && t.key === k && String(t.value || "").trim()) return String(t.value).trim();
  return "";
};

/* Σταθερό hash για να ξέρουμε αν άλλαξε η εικόνα (χωρίς crypto module, για κάθε runtime). */
function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

(async () => {
  const t0 = Date.now();
  console.log("══ warehouseSnapshot T-WH-01 · " + new Date(t0).toISOString() + " ══");

  // 1 · Οι αγροί: ποια συσκευή ανήκει πού.
  const fields = await listDevices("isField", "yes", ["id", "name", "tags"]);
  const owner = {};   // deviceId → [{ f: όνομα αγρού, c: πελάτης }]
  let badJson = 0;
  for (const f of fields) {
    const raw = tagOf(f, "devices");
    if (!raw) continue;
    let map;
    try { map = JSON.parse(raw); } catch (_) { badJson++; continue; }
    const fname = tagOf(f, "name") || String(f.name || "").replace(/^Field_/, "");
    const client = tagOf(f, "clientName");
    for (const id of Object.values(map || {})) {
      if (typeof id !== "string") continue;
      (owner[id] = owner[id] || []).push({ f: fname, c: client && client !== "-" ? client : "" });
    }
  }

  // 2 · Η αποθήκη, όπως τη δηλώνει η ετικέτα.
  const devs = await listDevices("storage", "yes", ["id", "name", "tags", "last_input", "created_at", "active"]);

  const items = devs.map((d) => {
    const it = {
      i: d.id,
      n: d.name,
      t: tagOf(d, "type").toLowerCase(),
      m: tagOf(d, "manufacturer").toLowerCase(),
      e: tagOf(d, "eui").toLowerCase(),
    };
    if (d.last_input) it.l = d.last_input;
    if (d.created_at) it.c = String(d.created_at).slice(0, 10);
    if (d.active === false) it.x = 1;
    const k = tagOf(d, "comments");
    if (k) it.k = k.slice(0, 120);
    const own = owner[d.id];
    if (own) it.f = own;
    return it;
  }).sort((a, b) => a.n.localeCompare(b.n));

  const inField = items.filter((x) => x.f).length;
  const free = items.length - inField;
  // Το hash ΔΕΝ περιλαμβάνει το last_input: αλλιώς κάθε uplink θα έγραφε νέα εικόνα.
  const hash = hashOf(JSON.stringify(items.map((x) => [x.i, x.n, x.t, x.e, x.k || "", x.x || 0, x.f || 0])));

  // 3 · Γράφουμε μόνο αν άλλαξε κάτι ή πέρασε το heartbeat.
  let prev = null;
  try { prev = ((await api(`/device/${OVERSEER}/data?variables[]=warehouse_summary&qty=1`)) || [])[0] || null; } catch (_) {}
  const prevHash = prev && prev.metadata && prev.metadata.hash;
  const prevAgeH = prev ? (t0 - new Date(prev.time).getTime()) / 36e5 : Infinity;
  // Χειροκίνητη εκτέλεση με scope {"force": true} → γράφει πάντα (χρήσιμο μετά από αλλαγές).
  let force = false;
  try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); force = !!(sc && (sc.force || (Array.isArray(sc) && sc.some((s) => s && s.force)))); } catch (_) {}
  if (prevHash === hash && prevAgeH < HEARTBEAT_H && !force) {
    console.log(`ΑΜΕΤΑΒΛΗΤΗ|hash=${hash}|τελευταία εγγραφή πριν ${prevAgeH.toFixed(1)}ω — δεν γράφω`);
    console.log(`ΣΥΝΟΨΗ|συσκευές=${items.length}|ελεύθερες=${free}|σε αγρό=${inField}|αγροί=${fields.length}|ms=${Date.now() - t0}`);
    console.log("══ warehouseSnapshot · ΤΕΛΟΣ ══");
    return;
  }

  const group = String(t0);
  const chunks = [];
  for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK));
  const out = chunks.map((list, idx) => ({
    variable: "warehouse_chunk", value: idx, group,
    metadata: { items: list, part: idx, parts: chunks.length },
  }));
  out.push({
    variable: "warehouse_summary", value: `${free} ελεύθερες · ${inField} σε αγρό`, group,
    metadata: {
      hash, parts: chunks.length, total: items.length, free, in_field: inField, fields: fields.length,
      color: inField ? "orange" : "green",
      text: `Αποθήκη: ${items.length} συσκευές με ετικέτα αποθήκης. ${free} ελεύθερες,`
        + ` ${inField} δουλεύουν ήδη σε αγρό (η ετικέτα αποθήκης δεν σβήστηκε όταν μπήκαν).`,
    },
  });
  await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(out) });

  for (const x of items.filter((y) => y.f)) console.log(`ΣΕ ΑΓΡΟ|${x.n}|${x.f.map((o) => o.f + (o.c ? " (" + o.c + ")" : "")).join(" + ")}`);
  if (badJson) console.log(`ΠΡΟΣΟΧΗ|${badJson} αγροί με χαλασμένο JSON στην ετικέτα devices`);
  console.log(`ΓΡΑΦΤΗΚΕ|group=${group}|εγγραφές=${out.length}|hash=${hash}|πριν=${prevHash || "—"}`);
  console.log(`ΣΥΝΟΨΗ|συσκευές=${items.length}|ελεύθερες=${free}|σε αγρό=${inField}|αγροί=${fields.length}|ms=${Date.now() - t0}`);
  console.log("══ warehouseSnapshot · ΤΕΛΟΣ ══");
})().catch((e) => {
  console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
  console.log("══ warehouseSnapshot · ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
});
