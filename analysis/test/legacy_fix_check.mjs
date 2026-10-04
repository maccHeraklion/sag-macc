// Ελεγκτής v50.159 · T-LEGACY-01 (έλεγχος πληρότητας 4/10): κατάλοιπα που οδηγούσαν σε παράλογα αποτελέσματα.
// B-03 πέτρες «1» = 1 % (όχι 70 %) · B-04 διαπερατότητα 0,2 γίνεται δεκτή · B-06/B-07 κάρτες βλαβών σβήνουν ρητά.
// Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα (φόρτωση πυρήνα + αυτούσια τμήματα πηγής). Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
try { req.resolve("moment-timezone"); } catch (e) { console.log("ΑΔΥΝΑΤΟ: λείπει moment-timezone"); process.exit(1); }
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { _sagAgeIndicators, _sagNum, SAG_KERNEL_VERSION };";
  const mod = { exports: {} };
  const proc = { env: { RPERTICH_TEST_MODE: "true" }, exit: () => {}, on: () => {} };
  const quiet = { log: () => {}, warn: () => {}, error: () => {} };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail)(shimReq, mod, mod.exports, proc, quiet, path.dirname(corePath), corePath);
}
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  ok(K.SAG_KERNEL_VERSION === "v50.160 · 2026-10-05", "V έκδοση v50.159 (" + K.SAG_KERNEL_VERSION + ")");
  // B-03 · αυτούσιο τμήμα πέτρας
  const a = src.indexOf("  const _stoneRaw = _sagNum(parameters?.stone_fraction_pct ?? parameters?.stone_fraction);");
  const b = src.indexOf("  const _fineEarth = 1 - _stoneFrac;", a);
  if (a < 0 || b < 0) f.push("B-03 δεν βρέθηκε το τμήμα πέτρας");
  else {
    const stone = new Function("_sagNum", "parameters", src.slice(a, b) + "\nreturn _stoneFrac;");
    const fr = (v) => stone(K._sagNum, { stone_fraction_pct: v });
    ok(Math.abs(fr(1) - 0.01) < 1e-9, "Β3α πέτρες 1 → 1 % (" + fr(1) + ")");
    ok(Math.abs(fr(5) - 0.05) < 1e-9 && Math.abs(fr(70) - 0.70) < 1e-9 && fr(90) === 0.70, "Β3β 5 → 5 %, 70 → 70 %, 90 → οροφή 70 %");
    ok(Math.abs(fr(0.3) - 0.3) < 1e-9, "Β3γ παλιό κλάσμα 0,3 → 30 %");
    ok(fr(0) === 0 && fr(null) === 0, "Β3δ 0 / κενό → 0");
  }
  // B-04 · αυτούσια γραμμή διαπερατότητας
  const tl = src.split("\n").find(l => l.includes("const _trans = (Number.isFinite(_tRaw)"));
  if (!tl) f.push("B-04 δεν βρέθηκε η γραμμή διαπερατότητας");
  else {
    const tr = new Function("_tRaw", tl.replace(/\/\/.*$/, "") + "\nreturn _trans;");
    ok(tr(0.2) === 0.2 && tr(0.21) === 0.21 && tr(1) === 1, "Β4α 0,2 / 0,21 / 1 γίνονται δεκτά (" + tr(0.2) + ")");
    ok(tr(0.19) === 0.65 && tr(1.5) === 0.65 && tr(NaN) === 0.65, "Β4β εκτός ορίων → 0,65");
  }
  ok(src.includes("      trans = (Number.isFinite(t) && t >= 0.2 && t <= 1) ? t : _SAG_COVER_TRANS_DEFAULT;"), "Β4γ ίδιο όριο και στο BPI");
  // B-06 · πραγματική συνάρτηση
  const fresh = K._sagAgeIndicators({ _sagAgeGroups: [{ name: "αέρας", age: 10, limit: 90 }] });
  const st = fresh.find(x => x.variable === "stale_measurement_groups");
  ok(st && st.value === null, "Β6α όλες φρέσκιες → stale_measurement_groups ΚΕΝΗ τιμή (" + JSON.stringify(st) + ")");
  const old = K._sagAgeIndicators({ _sagAgeGroups: [{ name: "αέρας", age: 200, limit: 90 }] });
  const st2 = old.find(x => x.variable === "stale_measurement_groups");
  ok(st2 && st2.value === "αέρας" && st2.metadata.color === "orange", "Β6β παλιά ομάδα → πορτοκαλί με όνομα");
  // B-07 · καλωδίωση (η συνάρτηση βλαβών θέλει πλήρες περιβάλλον οργάνων)
  ok(src.includes("    if (!H.lostIrr) {\n") && src.includes("      out.push({ variable: 'irrigation_sensor_fault', value: null, metadata: {} });"), "Β7 βλάβη άρδευσης σβήνει όταν υπάρχει δόση");
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 πέτρες ξανά ≤ 1", "    _stoneFrac = _stoneRaw < 1 ? _stoneRaw : _stoneRaw / 100;", "    _stoneFrac = _stoneRaw <= 1 ? _stoneRaw : _stoneRaw / 100;"],
  ["m2 διαπερατότητα ξανά > 0,2 (ET0)", "  const _trans = (Number.isFinite(_tRaw) && _tRaw >= 0.2", "  const _trans = (Number.isFinite(_tRaw) && _tRaw > 0.2"],
  ["m3 διαπερατότητα ξανά > 0,2 (BPI)", "      trans = (Number.isFinite(t) && t >= 0.2", "      trans = (Number.isFinite(t) && t > 0.2"],
  ["m4 παλιές ομάδες δεν σβήνουν", "      out.push({ variable: 'stale_measurement_groups', value: null, metadata: {} });", ""],
  ["m5 βλάβη άρδευσης δεν σβήνει", "      out.push({ variable: 'irrigation_sensor_fault', value: null, metadata: {} });", ""],
  ["m6 παλιά έκδοση", "'v50.160 · 2026-10-05'", "'v50.159 · 2026-10-04'"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!SRC.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(SRC.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 100)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
