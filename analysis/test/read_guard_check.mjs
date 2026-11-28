// Ελεγκτής T-READGUARD-01 (28/11/2026) — analysis/readGuard.js · evaluate().
// Σενάρια από πραγματικά περιστατικά: κανονική ώρα 27/11 (~8 χιλ./ώρα) · σφάλμα διαγνωστικής 9–27/11 (~33 χιλ./ώρα, 0,8 εκατ./ημέρα)
// · εξαγωγές 25/11 (~300 χιλ./ώρα, όριο 24 εκατ.) · αλλαγή μήνα · Οκτώβριος (είσοδος ~96 % του ορίου) · αποθήκευση 96 %.
import { createRequire } from "node:module"; import fs from "node:fs";
const require = createRequire(import.meta.url);
const PATH = new URL("../readGuard.js", import.meta.url);
const load = (src) => { const m = { exports: {} }; new Function("module", "exports", "require", "process", src)(m, m.exports, require, { env: {} }); return m.exports; };
const SRC = fs.readFileSync(PATH, "utf8");
const H = 36e5, T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const LIM = { output: 28e6, input: 7e6, data_records: 50e6 };
function series(perHourOut, perHourIn, hours, startOut, startIn, t0 = T0) { const h = []; for (let i = 0; i <= hours; i++) h.push({ ts: t0 + i * H, output: startOut + perHourOut * i, input: startIn + perHourIn * i }); return h; }
function scen(mod) {
  const { evaluate } = mod; const out = {};
  // 1. κανονικά: 8 χιλ./ώρα, 6,5 χιλ. εισόδου/ώρα, 20/11, 12 εκατ. χρήση → καθαρό
  { const h = series(8000, 6500, 25, 12e6, 3e6); const last = h.pop(); out.normal = evaluate({ ts: last.ts, used: { output: last.output, input: last.input, data_records: 44e6 }, limit: LIM }, h); }
  // 2. σφάλμα διαγνωστικής: 33 χιλ./ώρα → G2 warning (0,79 εκατ./ημέρα), όχι G1
  { const h = series(33000, 6500, 25, 12e6, 3e6); const last = h.pop(); out.diag = evaluate({ ts: last.ts, used: { output: last.output, input: last.input, data_records: 44e6 }, limit: LIM }, h); }
  // 3. εξαγωγές 25/11: τελευταία ώρα +300 χιλ., χρήση 23 εκατ. → G1 fault + G3 fault
  { const h = series(33000, 6500, 24, 21.5e6, 4e6, Date.UTC(2026, 10, 24, 13)); const p = h[h.length - 1]; out.export = evaluate({ ts: p.ts + H, used: { output: p.output + 300000, input: p.input + 6500, data_records: 45e6 }, limit: LIM }, h); }
  // 4. αλλαγή μήνα: ο μετρητής μηδενίστηκε → ιστορικό από την αρχή, καμία ψευδής G1
  { const h = series(8000, 6500, 25, 27e6, 5e6, Date.UTC(2026, 10, 29, 22)); out.reset = evaluate({ ts: Date.UTC(2026, 11, 1, 0, 45), used: { output: 9000, input: 7000, data_records: 41e6 }, limit: LIM }, h); }
  // 5. Οκτώβριος: είσοδος 9,3 χιλ./ώρα, 25/10, χρήση εισόδου 5,4 εκατ. → G4 warning (≥ 90 %)
  { const h = series(8000, 9300, 25, 9e6, 5.4e6 - 9300 * 25, Date.UTC(2026, 9, 24, 11)); const last = h.pop(); out.input = evaluate({ ts: last.ts, used: { output: last.output, input: last.input, data_records: 45e6 }, limit: LIM }, h); }
  // 6. αποθήκευση 96 % → G5 warning
  { const h = series(8000, 6500, 25, 12e6, 3e6); const last = h.pop(); out.storage = evaluate({ ts: last.ts, used: { output: last.output, input: last.input, data_records: 48e6 }, limit: LIM }, h); }
  // 7. πρώτη εκτέλεση χωρίς ιστορικό → ok, χωρίς έλεγχο ρυθμού
  { const h = series(8000, 6500, 40, 12e6, 3e6); const last = h.pop(); out.long = evaluate({ ts: last.ts, used: { output: last.output, input: last.input, data_records: 44e6 }, limit: LIM }, h); }
  out.first = evaluate({ ts: T0, used: { output: 12e6, input: 3e6, data_records: 44e6 }, limit: LIM }, []);
  return out;
}
const ids = (r) => r.checks.map((c) => c.id + ":" + c.sev).sort().join(",");
function verify(mod) {
  const f = []; let o; try { o = scen(mod); } catch (e) { return ["σφάλμα: " + e.message]; }
  const exp = { normal: "", diag: "G2:warning", export: "G1:fault,G2:warning,G3:fault", reset: "", input: "G4:warning", storage: "G5:warning", first: "" };
  for (const [k, v] of Object.entries(exp)) if (ids(o[k]) !== v) f.push(k + ": " + ids(o[k]) + " ≠ " + v);
  if (o.normal.status !== "ok") f.push("normal status " + o.normal.status);
  if (o.export.status !== "fault") f.push("export status " + o.export.status);
  if (o.reset.hist.length !== 1) f.push("reset ιστορικό " + o.reset.hist.length);
  if (o.long.hist.length !== 26) f.push("ιστορικό 40 ωρών κρατά " + o.long.hist.length + " ≠ 26");
  if (Math.round(o.diag.per_day) !== 792000) f.push("24ωρο diag " + o.diag.per_day);
  if (!o.export.checks.every((c) => /[α-ω]/.test(c.text_el))) f.push("κείμενα όχι ελληνικά");
  return f;
}
const base = verify(load(SRC));
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ βάσης:\n" + base.join("\n")); process.exit(1); }
console.log("βάση ✔ (7 σενάρια)");
const MUT = [
  ["G1 όριο 60k→600k", (s) => s.replace("hourWarn: 60000", "hourWarn: 600000").replace("hourFault: 150000", "hourFault: 1500000")],
  ["G2 όριο 0,5→5 εκατ.", (s) => s.replace("dayWarn: 500000", "dayWarn: 5000000")],
  ["πρόβλεψη 90→99 %", (s) => s.replace("projWarn: 0.9", "projWarn: 0.99")],
  ["αποθήκευση 95→99 %", (s) => s.replace("storWarn: 0.95", "storWarn: 0.99")],
  ["χωρίς μηδενισμό μήνα", (s) => s.replace("now.used.output < last.output || monthOf(last.ts) !== monthOf(now.ts)", "false")],
  ["πρόβλεψη χωρίς υπόλοιπες ημέρες", (s) => s.replace("day * daysLeft", "day * 0")],
  ["πρόβλεψη εισόδου με αναγνώσεις", (s) => s.replace("now.used.input + dayIn * daysLeft", "now.used.input + (day||0) * daysLeft")],
  ["χωρίς όριο ιστορικού", (s) => s.replace(".slice(-HIST_MAX)", "")],
  ["G1 από 24ωρο", (s) => s.replace("const h1 = back(1)", "const h1 = back(24)")],
  ["fault→warning", (s) => s.replace('checks.some((c) => c.sev === "fault") ? "fault"', 'false ? "fault"')],
];
let killed = 0;
for (const [n, m] of MUT) { const s2 = m(SRC); if (s2 === SRC) { console.log("ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + n); process.exit(1); } if (verify(load(s2)).length) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n); }
console.log("μεταλλάξεις " + killed + "/" + MUT.length); process.exit(killed === MUT.length ? 0 : 1);
