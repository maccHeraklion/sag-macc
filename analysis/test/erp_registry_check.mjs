/* T-ERP-REG-01 (9/11/2026) — ΕΛΕΓΧΟΣ μητρώου πελατών: ΑΦΜ με ψηφίο ελέγχου, κανονικοποίηση/έλεγχοι πεδίων, διαφορές για το ιστορικό,
   αρίθμηση κωδικών, και η ροή εντολών (δημιουργία, ενημέρωση με έλεγχο έκδοσης, διπλός ΑΦΜ, αρχειοθέτηση, σημείωση) σε ψεύτικο API.
   Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const SRC0 = readFileSync(fileURLToPath(new URL("../erpRegistry.js", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
function load(src, db) {
  const calls = [];
  const fakeFetch = async (url, opts = {}) => {
    const u = String(url), m = (opts.method || "GET"); calls.push(m + " " + u);
    const ok = (result) => ({ json: async () => ({ status: true, result }) });
    if (u.includes("/entity/6af22b8790b4a2000cf7e0ed/data")) {
      if (m === "GET") return ok(db.cust.slice());
      const rows = JSON.parse(opts.body);
      if (m === "POST") { for (const r of rows) db.cust.push(Object.assign({ id: "c" + (db.cust.length + 1) }, r)); return ok(rows.length); }
      if (m === "PUT") { for (const r of rows) { const i = db.cust.findIndex((c) => c.id === r.id); db.cust[i] = Object.assign({}, db.cust[i], r); } return ok(rows.length); }
    }
    if (u.includes("/entity/6af22b8b90b4a2000cf7e184/data")) { if (m === "POST") { db.audit.push(...JSON.parse(opts.body)); return ok(1); } return ok(db.audit.slice()); }
    if (u.includes("/device/")) { if (m === "POST") db.posts.push(JSON.parse(opts.body)); return ok([]); }
    return ok([]);
  };
  const sb = { console: { log: (...a) => db.logs.push(a.join(" ")) }, process: { env: { T_ANALYSIS_TOKEN: "T", T_ANALYSIS_DATA: JSON.stringify(db.scope || []) } },
    fetch: fakeFetch, require: (m) => (m === "zlib" ? require_zlib : null), Buffer, JSON, Math, Date, Promise };
  vm.createContext(sb);
  vm.runInContext(src + "\n;globalThis.__T = { afmValid, normalize, diff, nextCode, runCommand };", sb);
  return { T: sb.__T, calls };
}
import zlib from "node:zlib"; const require_zlib = zlib;
async function check(src) {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); };
  try {
    const db = { cust: [], audit: [], posts: [], logs: [] };
    const { T } = load(src, db);
    ok(T.afmValid("090000045") && !T.afmValid("123456789") && !T.afmValid("000000000") && !T.afmValid("12345678"), "Α1 ΑΦΜ");
    const n1 = T.normalize({ name: "  Αγρός  Α ", email: "X@Y.GR", vat: "090000045", contacts: [{ n: "Γιώργος", phone: "6900000000" }, {}], labels: "θερμοκήπιο, θερμοκήπιο ,VIP" }, false);
    ok(n1.errors.length === 0 && n1.row.name === "Αγρός Α" && n1.row.email === "x@y.gr" && n1.row.kind === "client" && n1.row.status === "active", "Α2 κανονικοποίηση (" + JSON.stringify(n1) + ")");
    ok(n1.row.contacts.length === 1 && JSON.stringify(n1.row.labels) === JSON.stringify(["θερμοκήπιο", "VIP"]), "Α3 επαφές/ετικέτες");
    const n2 = T.normalize({ name: "", vat: "123", email: "x@", phone: "abc", postcode: "71", kind: "x" }, false);
    ok(n2.errors.length === 6, "Α4 έξι σφάλματα (" + n2.errors.length + ")");
    const n3 = T.normalize({ phone: "2810 123456" }, true);
    ok(Object.keys(n3.row).join() === "phone" && n3.errors.length === 0, "Α5 μερική ενημέρωση μόνο τα σταλμένα");
    ok(T.nextCode([{ code: "Π-0007" }, { code: "Π-0012" }]) === "Π-0013" && T.nextCode([]) === "Π-0001", "Α6 κωδικός");
    // ροή εντολών
    let r = await T.runCommand({ op: "customer.create", actor: "Μ", cmd_id: "k1", data: { name: "Νέος", vat: "090000045", labels: ["VIP"], contacts: [{ n: "Α" }] } });
    ok(r.ok && db.cust.length === 1 && db.cust[0].code === "Π-0001" && db.cust[0].version === 1 && db.audit.length === 1 && db.audit[0].action === "create", "Β1 δημιουργία (" + JSON.stringify(r) + ")");
    ok(db.cust[0].labels && Array.isArray(db.cust[0].labels.list) && db.cust[0].contacts.list.length === 1, "Β1β λίστες αποθηκεύονται ως {list}");
    r = await T.runCommand({ op: "customer.create", data: { name: "Δεύτερος", vat: "090000045" } });
    ok(!r.ok && /Υπάρχει ήδη/.test(r.msg), "Β2 διπλός ΑΦΜ απορρίπτεται");
    const id = db.cust[0].id;
    r = await T.runCommand({ op: "customer.update", id, base_version: 1, actor: "Μ", data: { phone: "2810123456", name: "Νέος" } });
    ok(r.ok && db.cust[0].version === 2 && db.cust[0].phone === "2810123456" && db.audit[1].changes.phone && !db.audit[1].changes.name, "Β3 ενημέρωση μόνο τα αλλαγμένα (" + JSON.stringify(db.audit[1]) + ")");
    r = await T.runCommand({ op: "customer.update", id, base_version: 1, data: { phone: "2810999999" } });
    ok(!r.ok && /άλλαξε στο μεταξύ/.test(r.msg) && db.cust[0].phone === "2810123456", "Β4 έλεγχος έκδοσης");
    ok(!("address" in db.cust[0]) && !("notes" in db.cust[0]), "Β3β κενά πεδία δεν στέλνονται στην εισαγωγή");
    r = await T.runCommand({ op: "customer.update", id, base_version: 2, data: { phone: "" } });
    ok(r.ok && db.cust[0].phone === null && db.cust[0].version === 3, "Β3γ άδειασμα πεδίου = null (" + JSON.stringify(db.cust[0].phone) + ")");
    r = await T.runCommand({ op: "customer.archive", id, base_version: 3 });
    ok(r.ok && db.cust[0].status === "archived" && db.audit[3].action === "archive", "Β5 αρχειοθέτηση");
    r = await T.runCommand({ op: "customer.note", id, note: "Τηλεφώνησε για προσφορά", kind: "τηλεφώνημα" });
    ok(r.ok && db.audit[4].action === "note" && db.audit[4].note.includes("προσφορά"), "Β6 σημείωση");
    r = await T.runCommand({ op: "customer.update", id: "zzz", data: { name: "x" } });
    ok(!r.ok, "Β7 άγνωστος πελάτης");
    r = await T.runCommand({ op: "customer.drop", id });
    ok(!r.ok && db.cust.length === 1, "Β8 άγνωστη εντολή δεν αγγίζει τίποτα");
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const r = await check(SRC0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ μητρώο πελατών");
const MUT = [
  ["return (sum % 11) % 10 === Number(s[8]);", "return true;"],
  ["if (row.vat && !afmValid(row.vat)) errors.push(", "if (false) errors.push("],
  ["if (m.base_version != null && Number(m.base_version) !== Number(cur.version || 1))", "if (false)"],
  ["const dv = dupVat(row.vat, null); if (dv) errors.push(", "const dv = null; if (dv) errors.push("],
  ["const take = (k, n) => { if (!partial || has(k)) row[k] = trim(d[k], n); };", "const take = (k, n) => { row[k] = trim(d[k], n); };"],
  ["version: Number(cur.version || 1) + 1,", "version: Number(cur.version || 1),"],
  ["if (a !== b) ch[k] = [oldRow ? oldRow[k] : null, newRow[k]];", "ch[k] = [oldRow ? oldRow[k] : null, newRow[k]];"],
  ["return \"Π-\" + String(mx + 1).padStart(4, \"0\");", "return \"Π-\" + String(mx).padStart(4, \"0\");"],
  ["if (r[k] !== \"\" && r[k] != null) o[k] = wrap(r[k]);", "o[k] = wrap(r[k]);"],
  ["o[k] = r[k] === \"\" ? null : wrap(r[k]);", "o[k] = wrap(r[k]);"],
  ["const wrap = (v) => (Array.isArray(v) ? { list: v } : v);", "const wrap = (v) => v;"],
];
let k = 0; for (const [a, b] of MUT) { if (!SRC0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } const x = await check(SRC0.replace(a, b)); if (x.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
