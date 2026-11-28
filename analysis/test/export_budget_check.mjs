// Ελεγκτής T-EXPORT-BUDGET-01 (28/11/2026) — fieldExportData.js: exportBudgetDecision + monthWindows.
// Σενάρια: η ίδια εξαγωγή 4΄ μετά (26/11 ΕΠΑΛ ×2) → duplicate · ίδια μετά από 70΄ → go · άλλο email → go · αποτυχημένη/μερική
// προηγούμενη → go · όριο αγρού: 2 εξαγωγές ιστορικού (0,6 εκατ.) + νέα 0,6 → budget · άλλος αγρός δεν μετρά · χωρίς εκτίμηση → go.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "fieldExportData.js"), "utf8").replace(/\r\n/g, "\n");
const dayjs = null;   // η monthWindows δεν χρησιμοποιεί dayjs
function load(src) {
  const a = src.indexOf("const EXPORT_LOG_VARIABLE"); const endMark = 'return { action: "go", used, estimate };\n}';
  const b = src.indexOf(endMark, a); if (a < 0 || b < 0) throw new Error("δεν βρέθηκε ο κώδικας T-EXPORT-BUDGET-01");
  return new Function("dayjs", src.slice(a, b + endMark.length) + "\nreturn { exportBudgetDecision, monthWindows, fnv1a, FIELD_DAILY_READS, DUPLICATE_WINDOW_MIN };")(dayjs);
}
const NOW = Date.UTC(2026, 10, 26, 17, 30);
const rec = (minAgo, m) => ({ time: new Date(NOW - minAgo * 6e4).toISOString(), metadata: m });
function verify(src) {
  const f = []; let M; try { M = load(src); } catch (e) { return [e.message]; }
  const { exportBudgetDecision: D, monthWindows: W, fnv1a } = M;
  const F = "f".repeat(24), G = "g".repeat(24), K = fnv1a("επαλ|15-11|20-11|x"), K2 = fnv1a("επαλ|15-11|20-11|y");
  const eq = (got, exp, m) => { if (got !== exp) f.push(m + ": " + got + " ≠ " + exp); };
  eq(D([rec(4, { field_id: F, key: K, status: "ok", reads: 3000 })], NOW, K, F, 3000).action, "duplicate", "ίδια σε 4΄");
  eq(D([rec(4, { field_id: F, key: K, status: "ok", reads: 3000 })], NOW, K, F, 3000).minutes, 4, "λεπτά");
  eq(D([rec(70, { field_id: F, key: K, status: "ok", reads: 3000 })], NOW, K, F, 3000).action, "go", "ίδια σε 70΄");
  eq(D([rec(4, { field_id: F, key: K2, status: "ok", reads: 3000 })], NOW, K, F, 3000).action, "go", "άλλο email");
  eq(D([rec(4, { field_id: F, key: K, status: "partial", reads: 3000 })], NOW, K, F, 3000).action, "go", "μερική προηγούμενη");
  eq(D([rec(4, { field_id: F, key: K, status: "budget", reads: 0 })], NOW, K, F, 3000).action, "go", "απορριφθείσα προηγούμενη");
  const two = [rec(300, { field_id: F, key: "a", status: "ok", reads: 600000 }), rec(200, { field_id: F, key: "b", status: "ok", reads: 600000 })];
  eq(D(two, NOW, K, F, 600000).action, "budget", "τρίτη εξαγωγή ιστορικού");
  eq(D(two, NOW, K, F, 200000).action, "go", "μικρή μετά από δύο μεγάλες");
  eq(D(two, NOW, K, G, 600000).action, "go", "άλλος αγρός");
  eq(D([rec(25 * 60, { field_id: F, key: "a", status: "ok", reads: 1400000 })], NOW, K, F, 600000).action, "go", "παλιά > 24ω");
  eq(D(two, NOW, K, F, null).action, "go", "χωρίς εκτίμηση");
  eq(D(null, NOW, K, F, 2000000).action, "budget", "μία εξαγωγή > όριο");
  eq(W("2025-01-01T00:00:00Z", "2026-12-31T18:59:00Z").length, 27, "παράθυρα ιστορικού (28 ημ.)");
  eq(W("2025-01-01T00:00:00Z", "2026-12-31T18:59:00Z").every(([a, b]) => Date.parse(b) - Date.parse(a) <= 28 * 864e5), true, "κάθε παράθυρο ≤ 28 ημ.");
  eq(W("2026-11-15T00:00:00Z", "2026-11-20T00:00:00Z").length, 1, "μήνες 5 ημερών");
  const ws = W("2026-01-10T00:00:00Z", "2026-03-05T00:00:00Z");
  eq(ws[0][0] + "→" + ws[ws.length - 1][1], new Date("2026-01-10T00:00:00Z").toISOString() + "→" + new Date("2026-03-05T00:00:00Z").toISOString(), "άκρα παραθύρων");
  return f;
}
const base = verify(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ βάσης:\n" + base.join("\n")); process.exit(1); }
console.log("βάση ✔");
const MUT = [
  ["παράθυρο 60→600΄", (s) => s.replace("const DUPLICATE_WINDOW_MIN = 60;", "const DUPLICATE_WINDOW_MIN = 600;")],
  ["όριο 1,5→15 εκατ.", (s) => s.replace("const FIELD_DAILY_READS = 1500000;", "const FIELD_DAILY_READS = 15000000;")],
  ["διπλό και για μερική", (s) => s.replace('m.key === key && m.status === "ok"', "m.key === key")],
  ["24ωρο→72ω", (s) => s.replace("m.field_id === fieldId && age < 864e5", "m.field_id === fieldId && age < 3 * 864e5")],
  ["όλοι οι αγροί μετρούν", (s) => s.replace("m.field_id === fieldId && age < 864e5", "age < 864e5")],
  ["χωρίς εκτίμηση = όριο", (s) => s.replace("if (Number.isFinite(estimate) && used + estimate > FIELD_DAILY_READS)", "if (used + (estimate || 2e6) > FIELD_DAILY_READS)")],
  ["χωρίς την εκτίμηση στο όριο", (s) => s.replace("used + estimate > FIELD_DAILY_READS", "used > FIELD_DAILY_READS")],
  ["παράθυρα 28→56 ημ.", (s) => s.replace("const STEP = 28 * 864e5;", "const STEP = 56 * 864e5;")],
  ["χωρίς κόψιμο στο τέλος", (s) => s.replace("const b = Math.min(a + STEP, end);", "const b = a + STEP;")],
];
let killed = 0;
for (const [n, m] of MUT) { const s2 = m(SRC); if (s2 === SRC) { console.log("ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + n); process.exit(1); } if (verify(s2).length) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n); }
console.log("μεταλλάξεις " + killed + "/" + MUT.length); process.exit(killed === MUT.length ? 0 : 1);
