// Ελεγκτής T-RAIN-UTC-01 (28/11/2026) — βροχή v34.5 και KBDI v2.1: περίοδοι UTC από 1/12/2026 00:00 UTC.
// Τ1 κάθε μονάδα (ημέρα/εβδομάδα/μήνας/έτος) καλύπτει τον χρόνο ΣΥΝΕΧΩΣ 1/9–1/3: η κάθε περίοδος ξεκινά όπου τελείωσε η
//    προηγούμενη (καμία ώρα δύο φορές, καμία χαμένη), και previousPeriod δίνει ακριβώς την προηγούμενη.
// Τ2 πριν την αλλαγή ΤΙΠΟΤΑ δεν αλλάζει: ίδιες περίοδοι με τον παλιό κώδικα (git HEAD) για κάθε ώρα έως 29/11 21:59Z (ημέρα/μήνας
//    έως 30/11 21:59Z)· οι ώρες ίδιες παντού.
// Τ3 όρια: ημέρα 1/12 = 30/11 22Z–2/12 00Z · W49 = 29/11 22Z–7/12 00Z · Δεκ = 30/11 22Z–1/1 00Z · 2026 = 1/1/26 00Z–1/1/27 00Z ·
//    μετά: ημέρες/μήνες UTC με κλειδί UTC.  Τ4 KBDI: ίδιες ημέρες (αρχή/τέλος) με τη βροχή από 1/9 ως 1/3, ώστε η βροχή
//    της ημέρας (κλειδί period_start_utc) να βρίσκεται.  Τ5 RAIN_UTC_FROM=off → ακριβώς ο παλιός κώδικας.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const RF = path.join(here, "..", "calculate_old_rainHeightSums.js"), KF = path.join(here, "..", "kbdi.js");
const req = createRequire(RF);
const SRC_R = fs.readFileSync(RF, "utf8"), SRC_K = fs.readFileSync(KF, "utf8");
const OLD_R = execSync("git show HEAD:analysis/calculate_old_rainHeightSums.js", { cwd: path.join(here, "..", ".."), encoding: "utf8", maxBuffer: 1 << 26 });
const sdk = { Analysis: { use() {} }, Resources: {}, Utils: {}, Account: function () {}, Device: function () {} };
const load = (src) => { const m = { exports: {} }; new Function("require", "module", "exports", src)((x) => (x === "@tago-io/sdk" ? sdk : req(x)), m, m.exports); return m.exports; };
const TZ = "Europe/Athens", CUT = Date.parse("2026-10-04T21:00:00Z"), H = 36e5;
const Z = (s) => Date.parse(s);

function verify(SR, SK) {
  const f = []; let R, K, O;
  try { R = load(SR); K = load(SK); O = load(OLD_R); } catch (e) { return ["φόρτωση: " + e.message]; }
  const P = (u, t) => R.periodContaining(u, t, TZ, CUT);
  // Τ1 συνέχεια
  for (const u of ["day", "week", "month", "year"]) {
    let p = P(u, Z("2026-09-01T00:00Z")), n = 0;
    while (p.e < Z("2027-03-01T00:00Z") && n < 400) {
      const q = P(u, p.e); if (q.s !== p.e) { f.push(`Τ1 ${u} κενό/επικάλυψη μετά το ${p.key}: ${new Date(p.e).toISOString()} ≠ ${new Date(q.s).toISOString()}`); break; }
      const back = R.previousPeriod(q, TZ, CUT); if (back.s !== p.s || back.e !== p.e) { f.push(`Τ1 ${u} previousPeriod(${q.key}) = ${back.key} ≠ ${p.key}`); break; }
      for (let t = q.s; t < q.e; t += 6 * H) { const r = P(u, t); if (r.s !== q.s || r.e !== q.e) { f.push(`Τ1 ${u} ${new Date(t).toISOString()} σε άλλη περίοδο`); break; } }
      p = q; n++;
    }
  }
  { const y = P("year", Z("2026-06-01T00:00Z")), py = R.previousPeriod(y, TZ, CUT); if (py.key !== "2025" || py.e !== y.s) f.push(`Τ1 previousPeriod(2026) = ${py.key}`); }
  // Τ2 πριν την αλλαγή = παλιός κώδικας
  const lim = { day: Z("2026-11-30T22:00Z"), week: Z("2026-11-29T22:00Z"), month: Z("2026-11-30T22:00Z"), year: Z("2026-01-01T00:00Z") };
  for (const u of ["hour", "day", "week", "month", "year"]) for (let t = Z("2025-12-01T00:00Z"); t < (lim[u] || Z("2027-03-01T00:00Z")); t += 7 * H) {
    const a = P(u, t), b = O.periodContaining(u, t, TZ, CUT); if (a.s !== b.s || a.e !== b.e || a.key !== b.key) { f.push(`Τ2 ${u} ${new Date(t).toISOString()}: ${a.key} ≠ ${b.key}`); break; }
  }
  // Τ3 όρια
  const want = [["day", "2026-12-01T05:00Z", "2026-12-01", "2026-11-30T22:00Z", "2026-12-02T00:00Z"], ["day", "2026-11-30T23:00Z", "2026-12-01", "2026-11-30T22:00Z", "2026-12-02T00:00Z"],
    ["day", "2026-12-15T23:30Z", "2026-12-15", "2026-12-15T00:00Z", "2026-12-16T00:00Z"], ["week", "2026-12-06T23:00Z", "2026-W49", "2026-11-29T22:00Z", "2026-12-07T00:00Z"],
    ["month", "2026-12-31T23:00Z", "2026-12", "2026-11-30T22:00Z", "2027-01-01T00:00Z"], ["month", "2027-02-10T00:00Z", "2027-02", "2027-02-01T00:00Z", "2027-03-01T00:00Z"],
    ["year", "2026-12-31T23:00Z", "2026", "2026-01-01T00:00Z", "2027-01-01T00:00Z"]];
  for (const [u, t, k, s, e] of want) { const p = P(u, Z(t)); if (p.key !== k || p.s !== Z(s) || p.e !== Z(e)) f.push(`Τ3 ${u} ${t}: ${p.key} ${new Date(p.s).toISOString()}–${new Date(p.e).toISOString()}`); }
  // Τ4 KBDI = βροχή
  let d = K.dayContaining(Z("2026-09-01T12:00Z"));
  for (let i = 0; i < 200; i++) { const r = P("day", d.s + H); if (r.s !== d.s || r.e !== d.e) { f.push(`Τ4 KBDI ${d.key} ${new Date(d.s).toISOString()} ≠ βροχή ${r.key} ${new Date(r.s).toISOString()}`); break; } d = K.nextDay(d); }
  // Τ5 διακόπτης off
  R.setUtcFrom(NaN);
  for (let t = Z("2026-11-20T00:00Z"); t < Z("2027-01-10T00:00Z"); t += 5 * H) for (const u of ["day", "week", "month", "year"]) { const a = P(u, t), b = O.periodContaining(u, t, TZ, CUT); if (a.s !== b.s || a.e !== b.e) { f.push(`Τ5 off ${u} ${new Date(t).toISOString()}`); t = Infinity; break; } }
  return f;
}
const base = verify(SRC_R, SRC_K);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ βάσης:\n" + base.slice(0, 12).join("\n")); process.exit(1); }
console.log("βάση ✔ (Τ1–Τ5)");
const MUT = [
  ["βροχή: πρώτη περίοδος UTC χωρίς γέφυρα", "r", "const s = first ? old.s : st.valueOf();", "const s = st.valueOf();"],
  ["βροχή: st0 = s (λάθος previousPeriod έτους)", "r", "st0: first ? old.st0 : s", "st0: s"],
  ["βροχή: χωρίς max(ms, UTC_FROM)", "r", "moment.utc(Math.max(ms, UTC_FROM_MS)).startOf(u2)", "moment.utc(ms).startOf(u2)"],
  ["βροχή: αλλαγή από λάθος ημέρα", "r", 'const DEFAULT_UTC_FROM = "2026-12-01T00:00:00.000Z";', 'const DEFAULT_UTC_FROM = "2026-12-02T00:00:00.000Z";'],
  ["βροχή: κατώφλι στο UTC_FROM αντί της παλιάς αρχής", "r", "    if (ms >= old.s) {\n      const u2", "    if (ms >= UTC_FROM_MS) {\n      const u2"],
  ["βροχή: off αγνοείται", "r", 'UTC_FROM_MS = uf === "off" ? NaN : Date.parse(uf); }', 'UTC_FROM_MS = Date.parse(DEFAULT_UTC_FROM); }'],
  ["KBDI: χωρίς γέφυρα", "k", "return { s: st.valueOf() === UTC_FROM_MS ? old.s : st.valueOf(), e,", "return { s: st.valueOf(), e,"],
  ["KBDI: άλλη ημέρα αλλαγής", "k", 'const UTC_FROM_MS = Date.parse("2026-12-01T00:00:00.000Z");', 'const UTC_FROM_MS = Date.parse("2026-12-03T00:00:00.000Z");'],
  ["KBDI: χωρίς UTC καθόλου", "k", "  if (ms >= old.s) {\n    const st = moment.utc", "  if (false) {\n    const st = moment.utc"],
];
let killed = 0;
for (const [n, w, a, b] of MUT) {
  const s0 = w === "r" ? SRC_R : SRC_K; const s1 = s0.split(a).join(b);
  if (s1 === s0) { console.log("ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + n); process.exit(1); }
  if (n === "βροχή: off αγνοείται") { // ελέγχεται μέσω κειμένου: ο διακόπτης πρέπει να υπάρχει στο startAnalysis
    if (!/uf === "off" \? NaN/.test(s1)) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n); continue; }
  const r = verify(w === "r" ? s1 : SRC_R, w === "k" ? s1 : SRC_K);
  if (r.length) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n);
}
console.log("μεταλλάξεις " + killed + "/" + MUT.length); process.exit(killed === MUT.length ? 0 : 1);
