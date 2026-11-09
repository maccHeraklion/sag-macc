// SAG — ERP · ΜΗΤΡΩΟ ΠΕΛΑΤΩΝ (T-ERP-REG-01, 9/11/2026, εντολή Michalis: «πιο εύχρηστο, πιο πλήρες, επαγγελματικό»)
// Runtime node-rt2025, χωρίς εξαρτήσεις (fetch + T_ANALYSIS_TOKEN). Πολιτική πρόσβασης «[Analysis] - ERP registry».
//
// ΡΟΗ: η σελίδα ERP στέλνει εντολή `erp_cmd` στη συσκευή Εποπτείας → Action → αυτό το analysis. Η εντολή ελέγχεται,
// εφαρμόζεται στο Entity «ERP · Πελάτες», γράφεται γραμμή στο «ERP · Ιστορικό», δημοσιεύεται απάντηση `erp_cmd_result`
// και νέο στιγμιότυπο `erp_customers` (συμπιεσμένο) που διαβάζει η σελίδα. Τα παλιά στιγμιότυπα σβήνονται (όριο εγγραφών).
// Το μητρώο είναι ΚΥΡΙΟ από την εισαγωγή και μετά (απόφαση Michalis 9/11). Οι ετικέτες των συσκευών-πελατών ΔΕΝ αλλάζουν
// (τις διαβάζει το createField). Χειροκίνητα scope: {mode:"selftest"} · {mode:"import"} (μία φορά) · {mode:"publish"}.
const zlib = require("zlib");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const OVERSEER = "6a98855ca06e41000bfae024";      // συσκευή «SAG Εποπτεία»
const E_CUST = "6af22b8790b4a2000cf7e0ed";         // Entity «ERP · Πελάτες»
const E_AUDIT = "6af22b8b90b4a2000cf7e184";        // Entity «ERP · Ιστορικό»
const VERSION = "erpRegistry v1.2 · 2026-11-09";

const KINDS = ["client", "partner", "test"];
const STATUSES = ["active", "archived"];
const FIELDS = ["name", "kind", "status", "vat", "tax_office", "activity", "address", "city", "postcode", "region",
  "phone", "mobile", "email", "website", "contacts", "partner", "source", "labels", "notes"];
const LABEL = { name: "Επωνυμία", kind: "Είδος", status: "Κατάσταση", vat: "ΑΦΜ", tax_office: "ΔΟΥ", activity: "Δραστηριότητα",
  address: "Διεύθυνση", city: "Πόλη", postcode: "ΤΚ", region: "Περιοχή", phone: "Τηλέφωνο", mobile: "Κινητό", email: "Email",
  website: "Ιστοσελίδα", contacts: "Επαφές", partner: "Συνεργάτης", source: "Προέλευση", labels: "Ετικέτες", notes: "Σημειώσεις" };

async function api(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: TOKEN, "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.split("?")[0] + " -> " + JSON.stringify(j.message || j).slice(0, 200));
  return j.result;
}
function readScope() {
  try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); return Array.isArray(s) ? s : (s ? [s] : []); } catch (e) { return []; }
}

/* ── Έλεγχοι ─────────────────────────────────────────────────────────────────────────────────────── */
// ΑΦΜ: 9 ψηφία με ψηφίο ελέγχου (άθροισμα d[i]·2^(8-i) mod 11 mod 10).
function afmValid(v) {
  const s = String(v || "").replace(/\s+/g, "");
  if (!/^\d{9}$/.test(s) || /^0{9}$/.test(s)) return false;
  let sum = 0; for (let i = 0; i < 8; i++) sum += Number(s[i]) * Math.pow(2, 8 - i);
  return (sum % 11) % 10 === Number(s[8]);
}
const trim = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
function cleanContacts(v) {
  const a = Array.isArray(v) ? v : [];
  return a.slice(0, 20).map((c) => ({ n: trim(c && c.n, 80), role: trim(c && c.role, 60), phone: trim(c && c.phone, 30),
    email: trim(c && c.email, 100).toLowerCase() })).filter((c) => c.n || c.phone || c.email);
}
function cleanLabels(v) {
  const a = Array.isArray(v) ? v : String(v || "").split(",");
  return Array.from(new Set(a.map((x) => trim(x, 30)).filter(Boolean))).slice(0, 15);
}
// Επιστρέφει { row, errors[] }. `partial` = μόνο τα πεδία που στάλθηκαν (ενημέρωση).
function normalize(input, partial) {
  const d = input || {}; const row = {}; const errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(d, k);
  const take = (k, n) => { if (!partial || has(k)) row[k] = trim(d[k], n); };
  take("name", 100); take("vat", 20); take("tax_office", 60); take("activity", 100); take("address", 100); take("city", 60);
  take("postcode", 10); take("region", 60); take("phone", 30); take("mobile", 30); take("email", 100); take("website", 100);
  take("partner", 100); take("source", 60);
  if (!partial || has("kind")) row.kind = trim(d.kind, 20) || "client";
  if (!partial || has("status")) row.status = trim(d.status, 20) || "active";
  if (!partial || has("notes")) row.notes = String(d.notes == null ? "" : d.notes).slice(0, 5000);
  if (!partial || has("contacts")) row.contacts = cleanContacts(d.contacts);
  if (!partial || has("labels")) row.labels = cleanLabels(d.labels);
  if (row.email !== undefined) row.email = row.email.toLowerCase();
  if (row.vat !== undefined) row.vat = row.vat.replace(/\s+/g, "");
  if (row.name !== undefined && !row.name) errors.push("Η επωνυμία είναι υποχρεωτική.");
  if (row.kind !== undefined && KINDS.indexOf(row.kind) < 0) errors.push("Άγνωστο είδος πελάτη.");
  if (row.status !== undefined && STATUSES.indexOf(row.status) < 0) errors.push("Άγνωστη κατάσταση.");
  if (row.vat && !afmValid(row.vat)) errors.push("Ο ΑΦΜ «" + row.vat + "» δεν είναι έγκυρος (9 ψηφία με σωστό ψηφίο ελέγχου).");
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) errors.push("Το email «" + row.email + "» δεν είναι έγκυρο.");
  for (const k of ["phone", "mobile"]) if (row[k] && !/^\+?[\d\s()-]{6,20}$/.test(row[k])) errors.push(LABEL[k] + ": μόνο ψηφία, κενά, + ( ) -.");
  if (row.postcode && !/^\d{3}\s?\d{2}$/.test(row.postcode)) errors.push("Ο ΤΚ πρέπει να έχει 5 ψηφία.");
  return { row, errors };
}
function diff(oldRow, newRow) {
  const ch = {};
  for (const k of FIELDS) {
    if (!(k in newRow)) continue;
    const a = JSON.stringify(oldRow ? (oldRow[k] == null ? "" : oldRow[k]) : ""), b = JSON.stringify(newRow[k] == null ? "" : newRow[k]);
    if (a !== b) ch[k] = [oldRow ? oldRow[k] : null, newRow[k]];
  }
  return ch;
}

/* ── Entities ────────────────────────────────────────────────────────────────────────────────────── */
async function allCustomers() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api(`/entity/${E_CUST}/data?amount=500&page=${page}`);
    const rows = Array.isArray(r) ? r : [];
    out.push(...rows.map(unwrap));
    if (rows.length < 500) break;
  }
  return out;
}
async function recentAudit(n) {
  const r = await api(`/entity/${E_AUDIT}/data?amount=${n}&page=1&index=id_created_at_idx&orderBy=desc`).catch(() => []);
  return Array.isArray(r) ? r : [];
}
// Το Entity απορρίπτει κενά κείμενα («at least 1 character»): στην εισαγωγή τα κενά πεδία ΠΑΡΑΛΕΙΠΟΝΤΑΙ,
// στην ενημέρωση ένα πεδίο που άδειασε γράφεται null (σβήνει την τιμή).
// Τα πεδία json δέχονται μόνο ΑΝΤΙΚΕΙΜΕΝΟ: οι λίστες (επαφές, ετικέτες) αποθηκεύονται ως {list:[…]} και ξετυλίγονται στην ανάγνωση.
const wrap = (v) => (Array.isArray(v) ? { list: v } : v);
const unwrap = (r) => { const o = Object.assign({}, r); for (const k of ["contacts", "labels"]) { const v = o[k]; o[k] = v && Array.isArray(v.list) ? v.list : (Array.isArray(v) ? v : []); } return o; };
const packInsert = (r) => { const o = {}; for (const k of Object.keys(r)) if (r[k] !== "" && r[k] != null) o[k] = wrap(r[k]); return o; };
const packEdit = (r) => { const o = {}; for (const k of Object.keys(r)) o[k] = r[k] === "" ? null : wrap(r[k]); return o; };
const insertRows = (eid, rows) => api(`/entity/${eid}/data`, { method: "POST", body: JSON.stringify(rows.map(packInsert)) });
const editRows = (eid, rows) => api(`/entity/${eid}/data`, { method: "PUT", body: JSON.stringify(rows.map(packEdit)) });
function nextCode(all) {
  let mx = 0; for (const c of all) { const m = String(c.code || "").match(/(\d+)$/); if (m) mx = Math.max(mx, Number(m[1])); }
  return "Π-" + String(mx + 1).padStart(4, "0");
}
async function audit(row) {
  try { await insertRows(E_AUDIT, [row]); } catch (e) { console.log("ΙΣΤΟΡΙΚΟ|σφάλμα " + e.message); }
}

/* ── Εντολές ─────────────────────────────────────────────────────────────────────────────────────── */
async function runCommand(m) {
  const op = String(m.op || ""), actor = trim(m.actor, 100) || "γραφείο", cmd = trim(m.cmd_id, 60);
  const all = await allCustomers();
  const byId = (id) => all.find((c) => String(c.id) === String(id));
  const dupVat = (vat, selfId) => vat && all.find((c) => c.vat === vat && String(c.id) !== String(selfId) && c.status !== "archived");
  if (op === "customer.create") {
    const { row, errors } = normalize(m.data, false);
    const dv = dupVat(row.vat, null); if (dv) errors.push("Υπάρχει ήδη ενεργός πελάτης με ΑΦΜ " + row.vat + ": «" + dv.name + "».");
    if (errors.length) return { ok: false, msg: errors.join(" ") };
    row.code = nextCode(all); row.version = 1; row.updated_by = actor; row.legacy_device_id = "";
    await insertRows(E_CUST, [row]);
    const fresh = (await allCustomers()).find((c) => c.code === row.code);
    await audit({ ref_type: "customer", ref_id: fresh ? String(fresh.id) : row.code, action: "create", actor, changes: diff(null, row), note: "", cmd_id: cmd });
    return { ok: true, msg: "Δημιουργήθηκε ο πελάτης «" + row.name + "» (" + row.code + ").", id: fresh ? fresh.id : null };
  }
  if (op === "customer.update" || op === "customer.archive" || op === "customer.restore") {
    const cur = byId(m.id); if (!cur) return { ok: false, msg: "Ο πελάτης δεν βρέθηκε." };
    if (m.base_version != null && Number(m.base_version) !== Number(cur.version || 1))
      return { ok: false, msg: "Ο πελάτης άλλαξε στο μεταξύ από άλλον χρήστη (" + (cur.updated_by || "—") + "). Ανανεώστε και ξαναδοκιμάστε." };
    const input = op === "customer.update" ? m.data : { status: op === "customer.archive" ? "archived" : "active" };
    const { row, errors } = normalize(input, true);
    if (row.vat !== undefined) { const dv = dupVat(row.vat, cur.id); if (dv) errors.push("Υπάρχει ήδη ενεργός πελάτης με ΑΦΜ " + row.vat + ": «" + dv.name + "»."); }
    if (errors.length) return { ok: false, msg: errors.join(" ") };
    const ch = diff(cur, row);
    if (!Object.keys(ch).length) return { ok: true, msg: "Καμία αλλαγή.", id: cur.id };
    const upd = Object.assign({ id: cur.id }, row, { version: Number(cur.version || 1) + 1, updated_by: actor });
    await editRows(E_CUST, [upd]);
    await audit({ ref_type: "customer", ref_id: String(cur.id), action: op.split(".")[1], actor, changes: ch, note: "", cmd_id: cmd });
    const word = op === "customer.archive" ? "Αρχειοθετήθηκε" : op === "customer.restore" ? "Επανήλθε" : "Αποθηκεύτηκε";
    return { ok: true, msg: word + " ο πελάτης «" + (row.name || cur.name) + "» (" + Object.keys(ch).map((k) => LABEL[k] || k).join(", ") + ").", id: cur.id };
  }
  if (op === "customer.note") {
    const cur = byId(m.id); if (!cur) return { ok: false, msg: "Ο πελάτης δεν βρέθηκε." };
    const note = String(m.note || "").trim().slice(0, 5000), kind = trim(m.kind, 30) || "σημείωση";
    if (!note) return { ok: false, msg: "Κενή σημείωση." };
    await audit({ ref_type: "customer", ref_id: String(cur.id), action: "note", actor, changes: { kind }, note, cmd_id: cmd });
    return { ok: true, msg: "Καταχωρίστηκε " + kind + " στον πελάτη «" + cur.name + "».", id: cur.id };
  }
  return { ok: false, msg: "Άγνωστη εντολή «" + op + "»." };
}

/* ── Στιγμιότυπο για τη σελίδα ───────────────────────────────────────────────────────────────────── */
async function publish(extra) {
  const all = await allCustomers();
  const aud = await recentAudit(300);
  const payload = { v: VERSION, t: new Date().toISOString(),
    customers: all.map((c) => { const o = {}; for (const k of ["id", "code", "legacy_device_id", "version", "updated_by", "created_at", "updated_at"].concat(FIELDS)) o[k] = c[k]; return o; }),
    audit: aud.map((a) => ({ id: a.id, ref_type: a.ref_type, ref_id: a.ref_id, action: a.action, actor: a.actor, changes: a.changes, note: a.note, t: a.created_at })) };
  const z = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), "utf8")).toString("base64");
  const t = new Date();
  const out = [{ variable: "erp_customers", value: all.length, time: t.toISOString(), metadata: { v: VERSION, z, n: all.length, a: aud.length } }];
  if (extra) out.push(extra);
  await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(out) });
  // Τα παλιά στιγμιότυπα σβήνονται: κρατάμε μόνο το τρέχον (ο λογαριασμός είναι στο 90 % του ορίου εγγραφών).
  try {
    const old = await api(`/device/${OVERSEER}/data?variables=erp_customers&qty=20`);
    const prev = (old || []).filter((r) => Date.parse(r.time) < t.getTime());
    if (prev.length) {
      const newestOld = prev.reduce((a, r) => Math.max(a, Date.parse(r.time)), 0);
      await api(`/device/${OVERSEER}/data?variables=erp_customers&start_date=2026-01-01T00:00:00Z&end_date=${encodeURIComponent(new Date(newestOld).toISOString())}&qty=50`, { method: "DELETE" });
    }
  } catch (e) { console.log("ΚΑΘΑΡΙΣΜΟΣ|" + e.message); }
  console.log(`ΔΗΜΟΣΙΕΥΣΗ|πελάτες=${all.length}|ιστορικό=${aud.length}|bytes=${z.length}`);
}

/* ── Εισαγωγή των συσκευών-πελατών (μία φορά) ────────────────────────────────────────────────────── */
async function importLegacy() {
  const existing = await allCustomers();
  if (existing.some((c) => c.legacy_device_id)) return console.log("ΕΙΣΑΓΩΓΗ|ήδη έγινε — τίποτα");
  const devs = await api(`/device?amount=200&page=1&fields[]=id&fields[]=name&fields[]=tags&fields[]=created_at&filter[tags][0][key]=isClient&filter[tags][0][value]=yes`);
  const tag = (d, k) => { const t = (d.tags || []).find((x) => x && x.key === k); return t ? String(t.value || "").trim() : ""; };
  let code = 0; const rows = [];
  for (const d of (devs || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    code++;
    const vat = tag(d, "vat").replace(/\s+/g, "");
    const name = tag(d, "name") || String(d.name || "").trim();
    const r = { code: "Π-" + String(code).padStart(4, "0"), name: name.slice(0, 100), kind: "client", status: "active",
      vat: vat.slice(0, 20), tax_office: tag(d, "tab").slice(0, 60), email: tag(d, "email").toLowerCase().slice(0, 100),
      phone: tag(d, "phone").slice(0, 30), contacts: [], labels: [], notes: "", legacy_device_id: String(d.id), version: 1,
      updated_by: "εισαγωγή 9/11", activity: "", address: "", city: "", postcode: "", region: "", mobile: "", website: "", partner: "", source: "" };
    if (vat && !afmValid(vat)) r.labels = ["ΑΦΜ προς έλεγχο"];
    rows.push(r);
  }
  for (let i = 0; i < rows.length; i += 50) await insertRows(E_CUST, rows.slice(i, i + 50));
  const fresh = await allCustomers();
  const aud = fresh.filter((c) => c.legacy_device_id).map((c) => ({ ref_type: "customer", ref_id: String(c.id), action: "import", actor: "εισαγωγή 9/11",
    changes: { legacy_device_id: [null, c.legacy_device_id] }, note: "Εισαγωγή από τη συσκευή-πελάτη του TagoIO.", cmd_id: "" }));
  for (let i = 0; i < aud.length; i += 50) await insertRows(E_AUDIT, aud.slice(i, i + 50));
  console.log(`ΕΙΣΑΓΩΓΗ|πελάτες=${rows.length}|ΑΦΜ προς έλεγχο=${rows.filter((r) => r.labels.length).length}`);
}

/* ── Κύριο ───────────────────────────────────────────────────────────────────────────────────────── */
(async () => {
  console.log("══ " + VERSION + " · " + new Date().toISOString() + " ══");
  const scope = readScope();
  const manual = scope.find((x) => x && x.mode);
  if (manual && manual.mode === "selftest") {
    const a = await allCustomers(); const b = await recentAudit(5);
    console.log(`SELFTEST|πελάτες=${a.length}|ιστορικό=${b.length}|afm(090000045)=${afmValid("090000045")}|afm(123456789)=${afmValid("123456789")}`);
    return;
  }
  if (manual && manual.mode === "import") { await importLegacy(); await publish(null); return; }
  if (manual && manual.mode === "publish") { await publish(null); return; }
  const cmds = scope.filter((x) => x && x.variable === "erp_cmd");
  if (!cmds.length) { console.log("Καμία εντολή — δημοσίευση μόνο."); await publish(null); return; }
  let last = null;
  for (const c of cmds) {
    const m = c.metadata || {};
    let res;
    try { res = await runCommand(m); } catch (e) { res = { ok: false, msg: "Σφάλμα αποθήκευσης: " + e.message }; }
    console.log(`ΕΝΤΟΛΗ|${m.op}|${res.ok ? "ΟΚ" : "ΑΠΟΡΡΙΨΗ"}|${res.msg}`);
    last = { variable: "erp_cmd_result", value: res.ok ? "ok" : "error", metadata: { cmd_id: String(m.cmd_id || ""), ok: !!res.ok, msg: res.msg, id: res.id || null } };
  }
  await publish(last);
})().catch((e) => console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e)));
