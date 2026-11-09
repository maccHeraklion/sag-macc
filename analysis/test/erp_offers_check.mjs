/* T-ERP-OFFERS-01 (9/11/2026) — ΕΛΕΓΧΟΣ προσφορών στο erpRegistry: σύνολα πάντα από τον server, αρίθμηση ανά έτος,
   νέα έκδοση όταν αλλάζει σταλμένη, επιτρεπτές μεταβάσεις κατάστασης, κλείδωμα αποδεκτής, αντίγραφο, έλεγχος έκδοσης.
   Τρέχει τον πραγματικό κώδικα σε node:vm με ψεύτικο API. Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import zlib from "node:zlib";
const SRC0 = readFileSync(fileURLToPath(new URL("../erpRegistry.js", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const E = { c: "6af22b8790b4a2000cf7e0ed", a: "6af22b8b90b4a2000cf7e184", o: "6af236dd90b4a2000cfadc76" };
function load(src, db) {
  const ok = (result) => ({ json: async () => ({ status: true, result }) });
  const fakeFetch = async (url, opts = {}) => {
    const u = String(url), m = opts.method || "GET";
    for (const [k, id] of Object.entries(E)) if (u.includes("/entity/" + id + "/data")) {
      const T = db[k];
      if (m === "GET") return ok(T.slice());
      const rows = JSON.parse(opts.body);
      if (m === "POST") { for (const r of rows) T.push(Object.assign({ id: k + (T.length + 1) }, r)); return ok(rows.length); }
      if (m === "PUT") { for (const r of rows) { const i = T.findIndex((x) => x.id === r.id); T[i] = Object.assign({}, T[i], r); } return ok(rows.length); }
    }
    return ok([]);
  };
  const sb = { console: { log: () => {} }, process: { env: { T_ANALYSIS_TOKEN: "T", T_ANALYSIS_DATA: "[]" } }, fetch: fakeFetch,
    require: (m) => (m === "zlib" ? zlib : null), Buffer, JSON, Math, Date, Promise };
  vm.createContext(sb);
  vm.runInContext(src + "\n;globalThis.__T = { runCommand, offerTotals, nextOfferNumber };", sb);
  return sb.__T;
}
const L = [{ k: "lms01", n: "Αισθητήρας φύλλου", kind: "eq", q: 2, price: 100, renew: 0, cost: 60 },
  { k: "install", n: "Εγκατάσταση", kind: "svc", q: 1, price: 120, renew: 0, cost: 50 },
  { k: "sp_sense", n: "Συνδρομή Sense", kind: "subpk", q: 1, price: 59, renew: 59 }];
async function check(src) {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); };
  try {
    const db = { c: [{ id: "C1", name: "Πελάτης Α", status: "active", kind: "client" }, { id: "C2", name: "Παλιός", status: "archived" }], a: [], o: [] };
    const T = load(src, db);
    const t = T.offerTotals(L, 10);
    ok(t.net === 379 && t.base === 341.1 && t.vat === 81.86 && t.gross === 422.96 && t.renew === 59 && t.cost === 170 && t.margin === 118, "Α1 σύνολα (" + JSON.stringify(t) + ")");
    ok(T.nextOfferNumber([{ number: "ΠΡ-2026-0007" }, { number: "ΠΡ-2025-0099" }], 2026) === "ΠΡ-2026-0008", "Α2 αρίθμηση ανά έτος");
    let r = await T.runCommand({ op: "offer.create", customer_id: "C2", data: { lines: L } });
    ok(!r.ok && /ενεργό πελάτη/.test(r.msg), "Β1 αρχειοθετημένος πελάτης απορρίπτεται");
    r = await T.runCommand({ op: "offer.create", customer_id: "C1", data: { lines: [] } });
    ok(!r.ok && /τουλάχιστον ένα/.test(r.msg), "Β2 χωρίς γραμμές");
    r = await T.runCommand({ op: "offer.create", customer_id: "C1", actor: "Μ", data: { lines: L, discount: 10, totals: { gross: 1 } } });
    const o = db.o[0];
    ok(r.ok && o.status === "draft" && o.revision === 1 && o.totals.gross === 422.96 && /^ΠΡ-\d{4}-0001$/.test(o.number) && o.customer_name === "Πελάτης Α", "Β3 δημιουργία, σύνολα από τον server (" + JSON.stringify(o.totals) + ")");
    ok(o.lines && Array.isArray(o.lines.list) && o.lines.list.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(o.valid_until), "Β4 γραμμές ως {list}, ισχύς 30 ημ.");
    r = await T.runCommand({ op: "offer.status", id: o.id, base_version: 1, status: "accepted" });
    ok(!r.ok && /Δεν επιτρέπεται/.test(r.msg), "Γ1 πρόχειρη → αποδεκτή απαγορεύεται");
    r = await T.runCommand({ op: "offer.update", id: o.id, base_version: 1, data: { discount: 0, totals: { gross: 1 } } });
    ok(r.ok && db.o[0].totals.gross === 469.96 && db.o[0].revision === 1 && db.o[0].version === 2, "Γ2 αλλαγή πρόχειρης χωρίς νέα έκδοση (" + JSON.stringify(db.o[0].totals) + ")");
    r = await T.runCommand({ op: "offer.status", id: o.id, base_version: 2, status: "sent" });
    ok(r.ok && db.o[0].status === "sent" && db.o[0].sent_at, "Γ3 αποστολή");
    r = await T.runCommand({ op: "offer.update", id: o.id, base_version: 3, data: { discount: 5 } });
    ok(r.ok && db.o[0].status === "draft" && db.o[0].revision === 2, "Γ4 αλλαγή σταλμένης = νέα έκδοση 2, πρόχειρη");
    r = await T.runCommand({ op: "offer.update", id: o.id, base_version: 3, data: { discount: 7 } });
    ok(!r.ok && /άλλαξε στο μεταξύ/.test(r.msg), "Γ5 έλεγχος έκδοσης");
    await T.runCommand({ op: "offer.status", id: o.id, base_version: 4, status: "sent" });
    r = await T.runCommand({ op: "offer.status", id: o.id, base_version: 5, status: "accepted" });
    ok(r.ok && db.o[0].status === "accepted" && db.o[0].decided_at, "Γ6 αποδοχή");
    r = await T.runCommand({ op: "offer.update", id: o.id, base_version: 6, data: { discount: 1 } });
    ok(!r.ok && /αντίγραφο/.test(r.msg), "Γ7 αποδεκτή κλειδωμένη");
    r = await T.runCommand({ op: "offer.copy", id: o.id });
    ok(r.ok && db.o.length === 2 && db.o[1].status === "draft" && /0002$/.test(db.o[1].number) && db.o[1].revision === 1, "Δ1 αντίγραφο ως νέα πρόχειρη");
    ok(db.a.length >= 7 && db.a.every((x) => x.ref_type === "offer"), "Δ2 κάθε κίνηση στο ιστορικό");
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const r = await check(SRC0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ προσφορές");
const MUT = [
  ["const cost = goods.some((l) => l.cost == null) ? null : goods.reduce((s, l) => s + l.q * l.cost, 0);", "const cost = null;"],
  ["const goods = lines.filter((l) => l.kind !== \"subpk\")", "const goods = lines"],
  ["vat: r2(base * 0.24), gross: r2(base * 1.24)", "vat: r2(base * 0.24), gross: r2(net * 1.24)"],
  ["const newRev = cur.status === \"sent\";", "const newRev = false;"],
  ["if ((OFF_NEXT[cur.status] || []).indexOf(to) < 0) return", "if (false) return"],
  ["if ([\"accepted\", \"cancelled\", \"rejected\"].indexOf(cur.status) >= 0) return", "if (false) return"],
  ["row.totals = offerTotals(lines, disc);", "row.totals = m.data.totals || offerTotals(lines, disc);"],
  ["const c = custOk(cid); if (!c) return", "const c = custs.find((x) => String(x.id) === String(cid)); if (!c) return"],
  ["if (m && Number(m[1]) === year) mx", "if (m) mx"],
  ["if (op.indexOf(\"offer.\") === 0) return runOfferCommand(m, actor, cmd);", ""],
];
let k = 0; for (const [a, b] of MUT) { if (!SRC0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } const x = await check(SRC0.replace(a, b)); if (x.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
