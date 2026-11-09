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
const E_OFF = "6af236dd90b4a2000cfadc76";         // Entity «ERP · Προσφορές»
const VERSION = "erpRegistry v1.3 · 2026-11-09";

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
  if (op.indexOf("offer.") === 0) return runOfferCommand(m, actor, cmd);
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


/* ── Προσφορές (T-ERP-OFFERS-01) ─────────────────────────────────────────────────────────────────── */
const OFF_N = { draft: "Πρόχειρη", sent: "Στάλθηκε", accepted: "Αποδεκτή", rejected: "Απορρίφθηκε", cancelled: "Ακυρώθηκε" };
const OFF_NEXT = { draft: ["sent", "cancelled"], sent: ["accepted", "rejected", "cancelled"], accepted: [], rejected: ["draft"], cancelled: ["draft"] };
const LINE_KINDS = ["eq", "svc", "subpk", "subi", "addon", "plan", "other"];
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const r2 = (v) => Math.round(v * 100) / 100;
function cleanLines(v) {
  const errors = [], out = [];
  const a = Array.isArray(v) ? v : [];
  if (!a.length) errors.push("Η προσφορά χρειάζεται τουλάχιστον ένα είδος.");
  if (a.length > 200) errors.push("Πάνω από 200 γραμμές.");
  a.slice(0, 200).forEach((x, i) => {
    const q = num(x && x.q), price = num(x && x.price), renew = x && x.renew != null && x.renew !== "" ? num(x.renew) : 0;
    const cost = x && x.cost != null && x.cost !== "" ? num(x.cost) : null;
    const n = trim(x && x.n, 200), kind = LINE_KINDS.indexOf(String(x && x.kind)) >= 0 ? String(x.kind) : "other";
    if (!n) errors.push("Γραμμή " + (i + 1) + ": χωρίς περιγραφή.");
    if (!(q > 0 && q <= 10000)) errors.push("Γραμμή " + (i + 1) + " («" + n + "»): ποσότητα εκτός ορίων.");
    if (!(price >= 0 && price <= 1e6)) errors.push("Γραμμή " + (i + 1) + " («" + n + "»): μη έγκυρη τιμή.");
    if (!(renew >= 0 && renew <= 1e6)) errors.push("Γραμμή " + (i + 1) + " («" + n + "»): μη έγκυρη ανανέωση.");
    out.push({ k: trim(x && x.k, 60), sku: trim(x && x.sku, 60), n, kind, q, price: r2(price), renew: r2(renew), cost: cost != null && Number.isFinite(cost) && cost >= 0 ? r2(cost) : null });
  });
  return { lines: out, errors };
}
// Τα σύνολα υπολογίζονται ΠΑΝΤΑ εδώ από τις γραμμές — ποτέ δεν εμπιστευόμαστε σύνολα της σελίδας.
function offerTotals(lines, discount) {
  const d = Math.min(Math.max(num(discount) || 0, 0), 50);
  const net = lines.reduce((s, l) => s + l.q * l.price, 0), base = net * (1 - d / 100);
  const goods = lines.filter((l) => l.kind !== "subpk"), gBase = goods.reduce((s, l) => s + l.q * l.price, 0) * (1 - d / 100);
  const cost = goods.some((l) => l.cost == null) ? null : goods.reduce((s, l) => s + l.q * l.cost, 0);
  return { net: r2(net), discount: d, disc: r2(net - base), base: r2(base), vat: r2(base * 0.24), gross: r2(base * 1.24),
    renew: r2(lines.reduce((s, l) => s + l.q * l.renew, 0)), cost: cost == null ? null : r2(cost), margin: cost == null ? null : r2(gBase - cost) };
}
function normalizeOffer(input, partial) {
  const d = input || {}, row = {}, errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(d, k);
  if (!partial || has("title")) row.title = trim(d.title, 100);
  if (!partial || has("template")) row.template = trim(d.template, 60);
  if (!partial || has("notes")) row.notes = String(d.notes == null ? "" : d.notes).slice(0, 5000);
  if (!partial || has("area")) { const a = d.area === "" || d.area == null ? null : num(d.area); if (a != null && !(a >= 0 && a <= 100000)) errors.push("Μη έγκυρη έκταση."); row.area = a; }
  if (!partial || has("installments")) { const n = Math.round(num(d.installments) || 1); if ([1, 3, 6, 12].indexOf(n) < 0) errors.push("Δόσεις: 1, 3, 6 ή 12."); row.installments = n; }
  if (!partial || has("valid_until")) { const v = trim(d.valid_until, 10); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push("Μη έγκυρη ημερομηνία ισχύος."); row.valid_until = v; }
  if (!partial || has("discount")) { const x = num(d.discount) || 0; if (x < 0 || x > 50) errors.push("Η έκπτωση πρέπει να είναι 0–50 %."); row.discount = x; }
  if (!partial || has("lines")) { const cl = cleanLines(d.lines); errors.push(...cl.errors); row.lines = cl.lines; }
  return { row, errors };
}
async function allOffers() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api(`/entity/${E_OFF}/data?amount=500&page=${page}`);
    const rows = Array.isArray(r) ? r : [];
    out.push(...rows.map((o) => Object.assign({}, o, { lines: o.lines && Array.isArray(o.lines.list) ? o.lines.list : [] })));
    if (rows.length < 500) break;
  }
  return out;
}
function nextOfferNumber(all, year) {
  let mx = 0; for (const o of all) { const m = String(o.number || "").match(/^ΠΡ-(\d{4})-(\d+)$/); if (m && Number(m[1]) === year) mx = Math.max(mx, Number(m[2])); }
  return "ΠΡ-" + year + "-" + String(mx + 1).padStart(4, "0");
}
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
async function runOfferCommand(m, actor, cmd) {
  const op = String(m.op || "");
  const custs = await allCustomers();
  const offs = await allOffers();
  const byId = (id) => offs.find((o) => String(o.id) === String(id));
  const custOk = (id) => custs.find((c) => String(c.id) === String(id) && c.status !== "archived");
  if (op === "offer.create" || op === "offer.copy") {
    let input = m.data || {}, cid = m.customer_id || (m.data && m.data.customer_id);
    const src = op === "offer.copy" ? byId(m.id) : null;
    if (op === "offer.copy") {
      if (!src) return { ok: false, msg: "Η προσφορά δεν βρέθηκε." };
      input = { title: src.title, template: src.template, notes: src.notes, area: src.area, installments: src.installments, discount: src.discount, lines: src.lines, valid_until: "" };
      cid = m.customer_id || src.customer_id;
    }
    const c = custOk(cid); if (!c) return { ok: false, msg: "Διαλέξτε ενεργό πελάτη από το μητρώο." };
    const { row, errors } = normalizeOffer(input, false);
    if (errors.length) return { ok: false, msg: errors.join(" ") };
    const year = new Date().getUTCFullYear();
    Object.assign(row, { number: nextOfferNumber(offs, year), customer_id: String(c.id), customer_name: c.name, status: "draft", revision: 1,
      valid_until: row.valid_until || addDays(30), totals: offerTotals(row.lines, row.discount), version: 1, updated_by: actor });
    await insertRows(E_OFF, [row]);
    const fresh = (await allOffers()).find((o) => o.number === row.number);
    await audit({ ref_type: "offer", ref_id: fresh ? String(fresh.id) : row.number, action: src ? "copy" : "create", actor,
      changes: { number: [null, row.number], customer: [null, c.name], gross: [null, row.totals.gross] }, note: src ? "Αντίγραφο της " + src.number : "", cmd_id: cmd });
    return { ok: true, msg: "Αποθηκεύτηκε η προσφορά " + row.number + " για «" + c.name + "» (" + row.totals.gross.toFixed(2) + " € με ΦΠΑ).", id: fresh ? fresh.id : null, kind: "offer" };
  }
  const cur = byId(m.id); if (!cur) return { ok: false, msg: "Η προσφορά δεν βρέθηκε." };
  if (m.base_version != null && Number(m.base_version) !== Number(cur.version || 1))
    return { ok: false, msg: "Η προσφορά άλλαξε στο μεταξύ από άλλον χρήστη (" + (cur.updated_by || "—") + "). Ανανεώστε και ξαναδοκιμάστε." };
  if (op === "offer.update") {
    if (["accepted", "cancelled", "rejected"].indexOf(cur.status) >= 0) return { ok: false, msg: "Η προσφορά είναι «" + OFF_N[cur.status] + "»· για αλλαγές φτιάξτε αντίγραφο." };
    const { row, errors } = normalizeOffer(m.data, true);
    if (m.data && m.data.customer_id && String(m.data.customer_id) !== String(cur.customer_id)) {
      const c = custOk(m.data.customer_id);
      if (!c) errors.push("Διαλέξτε ενεργό πελάτη."); else { row.customer_id = String(c.id); row.customer_name = c.name; }
    }
    if (errors.length) return { ok: false, msg: errors.join(" ") };
    const lines = row.lines || cur.lines, disc = row.discount != null ? row.discount : cur.discount;
    row.totals = offerTotals(lines, disc);
    const newRev = cur.status === "sent";   // αλλαγή σε σταλμένη = νέα έκδοση, ξανά πρόχειρη
    const upd = Object.assign({ id: cur.id }, row, { version: Number(cur.version || 1) + 1, updated_by: actor },
      newRev ? { revision: Number(cur.revision || 1) + 1, status: "draft", sent_at: "" } : {});
    await editRows(E_OFF, [upd]);
    await audit({ ref_type: "offer", ref_id: String(cur.id), action: newRev ? "revision" : "update", actor,
      changes: { gross: [cur.totals ? cur.totals.gross : null, row.totals.gross], lines: [cur.lines.length, lines.length] }, note: "", cmd_id: cmd });
    return { ok: true, msg: (newRev ? "Νέα έκδοση " + (Number(cur.revision || 1) + 1) + " της " : "Αποθηκεύτηκε η ") + cur.number + " (" + row.totals.gross.toFixed(2) + " € με ΦΠΑ).", id: cur.id, kind: "offer" };
  }
  if (op === "offer.status") {
    const to = String(m.status || "");
    if ((OFF_NEXT[cur.status] || []).indexOf(to) < 0) return { ok: false, msg: "Δεν επιτρέπεται η αλλαγή «" + (OFF_N[cur.status] || cur.status) + "» → «" + (OFF_N[to] || to) + "»." };
    const now = new Date().toISOString(), upd = { id: cur.id, status: to, version: Number(cur.version || 1) + 1, updated_by: actor };
    if (to === "sent") upd.sent_at = now;
    if (to === "accepted" || to === "rejected") upd.decided_at = now;
    if (to === "draft") { upd.revision = Number(cur.revision || 1) + 1; upd.sent_at = ""; upd.decided_at = ""; }
    await editRows(E_OFF, [upd]);
    await audit({ ref_type: "offer", ref_id: String(cur.id), action: "status", actor, changes: { status: [cur.status, to] }, note: trim(m.note, 500), cmd_id: cmd });
    return { ok: true, msg: cur.number + ": «" + (OFF_N[cur.status] || cur.status) + "» → «" + OFF_N[to] + "».", id: cur.id, kind: "offer" };
  }
  return { ok: false, msg: "Άγνωστη εντολή «" + op + "»." };
}

/* ── Στιγμιότυπο για τη σελίδα ───────────────────────────────────────────────────────────────────── */
async function publish(extra) {
  const all = await allCustomers();
  const aud = await recentAudit(300);
  const offs = await allOffers().catch((e) => { console.log("ΠΡΟΣΦΟΡΕΣ|" + e.message); return []; });
  const payload = { v: VERSION, t: new Date().toISOString(), offers: offs,
    customers: all.map((c) => { const o = {}; for (const k of ["id", "code", "legacy_device_id", "version", "updated_by", "created_at", "updated_at"].concat(FIELDS)) o[k] = c[k]; return o; }),
    audit: aud.map((a) => ({ id: a.id, ref_type: a.ref_type, ref_id: a.ref_id, action: a.action, actor: a.actor, changes: a.changes, note: a.note, t: a.created_at })) };
  const z = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), "utf8")).toString("base64");
  const t = new Date();
  const out = [{ variable: "erp_customers", value: all.length, time: t.toISOString(), metadata: { v: VERSION, z, n: all.length, o: offs.length, a: aud.length } }];
  if (extra) out.push(extra);
  await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(out) });
  // Η Εποπτεία είναι immutable: τα παλιά στιγμιότυπα δεν σβήνονται (2 εγγραφές ανά εντολή, αμελητέο).
  console.log(`ΔΗΜΟΣΙΕΥΣΗ|πελάτες=${all.length}|προσφορές=${offs.length}|ιστορικό=${aud.length}|bytes=${z.length}`);
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
    last = { variable: "erp_cmd_result", value: res.ok ? "ok" : "error", metadata: { cmd_id: String(m.cmd_id || ""), ok: !!res.ok, msg: res.msg, id: res.id || null, kind: res.kind || "customer" } };
  }
  await publish(last);
})().catch((e) => console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e)));
