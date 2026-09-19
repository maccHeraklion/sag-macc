#!/usr/bin/env node
/* Ελεγκτής v50.140 · μικρές διορθώσεις ελέγχου 18/9: Κ3 T-BPI-IPSIAVG-01 · Κ4 T-STRESS-DUE-01 ·
 * Κ7 T-COVERED-WIND-01 · Κ9 T-RAIN-INHIBIT-02 · Κ11 T-COLDSOIL-RAMP-01 · Κ12 T-IPSI-HASSERIES-01 · Κ14 T-ECE-OLIVE-01.
 *
 *   node analysis/test/audit_fixes_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ των μπλοκ αυτούσιων
 *   node analysis/test/audit_fixes_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const lf = (s) => s.replace(/\r\n/g, "\n");
const slice = (c, a, b) => { const i = c.indexOf(a), j = c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };

// Κ3: το μπλοκ ένεσης, με στελέχη
function runIpsiAvg(core, { dailyTich, prevIpsiAvg, prevIpsiCount, newAvg }) {
  const src = slice(core, "            // T-BPI-IPSIAVG-01 (v50.140", "            measurementsForCrop.data.ipsi_daily_avg = [{ value: _bpiAvg }];");
  if (!src) return null;
  return new Function("dailyTich", "prevIpsiAvg", "prevIpsiCount", "newAvg", src + "\nreturn _bpiAvg;")(dailyTich, prevIpsiAvg, prevIpsiCount, newAvg);
}
// Κ9: η συνθήκη «η βροχή φτάνει ακόμη»
function runRain(core, { rain1h, rzAvg, mNow }) {
  const src = slice(core, "const _rain1hIrr = Number(getVal(measurements, 'rain_height_hourly', NaN));", "if (effectiveRainfall_mm >= 5 && !_rainStillArriving) {");
  if (!src) return null;
  const body = `const getVal = () => ${JSON.stringify(rain1h)}; const _sagRootZone24h = () => ${JSON.stringify(rzAvg)};
    const measurements = {}, parameters = {}; const _mSoilNow = ${JSON.stringify(mNow)};\n${src}\nreturn _rainStillArriving;`;
  return new Function(body)();
}
// Κ11: κατώφλι, ζώνη, πολλαπλασιαστής
function runCold(core, { min, T_soil, M_soil = 30, FC = 40 }) {
  const src = slice(core, "  const _coldMinRaw = Number(crop?.optimal_temp_range?.min);", "    // ── End T-COLDSOIL-RAMP-01");
  if (!src) return null;
  const body = `const crop = { optimal_temp_range: { min: ${JSON.stringify(min)} } }; const _soilTempMeasured = true;
    const T_soil = ${T_soil}; const M_soil = ${M_soil}; const M_field_capacity = ${FC}; let cold_stress_multiplier = 1.0;
    let veto = false;\n${src.replace(/\n\s*\/\/ ── End[^\n]*$/, "")}\n    veto = true; }\n    return { _coldT, _coldFrac, cold_stress_multiplier, veto };`;
  return new Function(body)();
}
function hasSeries(core) {
  const src = slice(core, "function _sagHasSeries(v) {", "\n}\n") + "\n}";
  return new Function(src + "\nreturn _sagHasSeries;")();
}
function eceOf(core, key) {
  const i = core.indexOf(key + ": {"); if (i < 0) return NaN;
  const m = core.slice(i, i + 6000).match(/max_tolerance_ECe: ([\d.]+)/); return m ? Number(m[1]) : NaN;
}

const CHECKS = [
  ["core: έκδοση ≥ v50.140 (οι διορθώσεις μπήκαν στη v50.140· νεότερες εκδόσεις τις περιέχουν)",
    f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 140; }],
  ["core: καθαρό CRLF, χωρίς BOM", f => !f.coreRaw.startsWith("﻿") && (f.coreRaw.match(/\n/g) || []).length === (f.coreRaw.match(/\r\n/g) || []).length],
  ["Κ3: στο ημερήσιο tick με 20 ώρες συσσώρευσης το BPI παίρνει τον χθεσινό μέσο (4,2), όχι τον τρέχοντα (0,3)", f => runIpsiAvg(f.core, { dailyTich: true, prevIpsiAvg: 4.2, prevIpsiCount: 20, newAvg: 0.3 }) === 4.2],
  ["Κ3: ωριαίο tick → τρέχων σωρευτικός· ημερήσιο με < 6 ώρες → τρέχων", f => runIpsiAvg(f.core, { dailyTich: false, prevIpsiAvg: 4.2, prevIpsiCount: 20, newAvg: 2.1 }) === 2.1
    && runIpsiAvg(f.core, { dailyTich: true, prevIpsiAvg: 4.2, prevIpsiCount: 3, newAvg: 0.3 }) === 0.3
    && runIpsiAvg(f.core, { dailyTich: true, prevIpsiAvg: null, prevIpsiCount: 0, newAvg: 0.3 }) === 0.3],
  ["Κ12: η επιλογή σειράς θερμοκρασίας αέρα περνά από _sagHasSeries (και για air_temperature και για temperature)", f =>
    f.core.includes("if (_sagHasSeries(measurements?.data?.air_temperature)) airTempSeries = measurements.data.air_temperature; // s2120") && f.core.includes("else if (_sagHasSeries(measurements?.data?.temperature)) airTempSeries = measurements.data.temperature; // em300")],
  ["Κ12: _sagHasSeries([]) === false, _sagHasSeries([{value: 21}]) === true", f => { const h = hasSeries(f.core); return h([]) === false && h([{ value: 21 }]) === true && h(null) === false; }],
  ["Κ7: καλυμμένη χωρίς ανεμόμετρο → u2 = 0,5 (τρέχει PM), με ανεμόμετρο > 0,5 → 0,5 όπως πριν", f =>
    /if \(!Number\.isFinite\(u2_irr\)\) \{[\s\S]{0,900}u2_irr = _wIn;\n  \} else if \(u2_irr > _wIn\) \{/.test(f.core)],
  ["Κ9: βρέχει τώρα (1,2 mm/h) → αναστολή", f => runRain(f.core, { rain1h: 1.2, rzAvg: 20, mNow: 20 }) === true],
  ["Κ9: έβρεξε χθες, ριζόστρωμα ανεβαίνει ακόμη (22 > 20 + 0,5) → αναστολή", f => runRain(f.core, { rain1h: 0, rzAvg: 20, mNow: 22 }) === true],
  ["Κ9: έβρεξε χθες, ριζόστρωμα ήδη στο κατώφλι (18 < 20) → ΟΧΙ αναστολή, κρίνει το έλλειμμα", f => runRain(f.core, { rain1h: 0, rzAvg: 20, mNow: 18 }) === false],
  ["Κ9: χωρίς 24ωρο μέσο → παλιά (ασφαλής) αναστολή", f => runRain(f.core, { rain1h: NaN, rzAvg: null, mNow: 18 }) === true],
  ["Κ9: η αναστολή εφαρμόζεται ΜΟΝΟ με _rainStillArriving", f => f.core.includes("if (effectiveRainfall_mm >= 5 && _rainStillArriving) {") && !/\nif \(effectiveRainfall_mm >= 5\) \{/.test(f.core)],
  ["Κ11: ελιά (min 7) → κατώφλι 8· 9,9 °C → ήπιος 1,01, ΧΩΡΙΣ βέτο (πριν: βέτο)", f => { const r = runCold(f.core, { min: 7, T_soil: 9.9 }); return r && r._coldT === 8 && !r.veto && Math.abs(r.cold_stress_multiplier - 1.0125) < 1e-6; }],
  ["Κ11: ντομάτα (min 10) → 9,9 °C ήπιος 1,26 χωρίς βέτο· 7,9 °C βέτο με 1,5", f => {
    const a = runCold(f.core, { min: 10, T_soil: 9.9 }), b = runCold(f.core, { min: 10, T_soil: 7.9 });
    return a && b && a._coldT === 10 && !a.veto && Math.abs(a.cold_stress_multiplier - 1.2625) < 1e-6 && b.veto && Math.abs(b.cold_stress_multiplier - 1.51) < 1e-6; }],
  ["Κ11: εσπεριδοειδή (min 13) → κατώφλι φραγμένο 12· 14,1 °C → τίποτα· σιτάρι (min 0) → 8", f => {
    const a = runCold(f.core, { min: 13, T_soil: 14.1 }), b = runCold(f.core, { min: 0, T_soil: 20 });
    return a && b && a._coldT === 12 && a.cold_stress_multiplier === 1 && !a.veto && b._coldT === 8; }],
  ["Κ11: στεγνό έδαφος (M < 0,6·FC) → ούτε ζώνη ούτε βέτο", f => { const r = runCold(f.core, { min: 10, T_soil: 5, M_soil: 10, FC: 40 }); return r && !r.veto && r.cold_stress_multiplier === 1; }],
  ["Κ4: «Στο όριο άρδευσης» κίτρινο όταν IPSI < 3 ΚΑΙ λίτρα > 0· το «Ιδανικό» μένει για τα υπόλοιπα", f =>
    f.core.includes("} else if (ipsi < 3 && _irrDueNow) {") && f.core.includes("value: 'Στο όριο άρδευσης', metadata: { color: 'yellow'")
    && f.core.includes("const _irrDueNow = Array.isArray(irrigationVolumeParams)") && /\} else if \(ipsi < 3\) \{\n\s+messages =  \[\.\.\.messages, \{variable: 'plant_stress', value: 'Ιδανικό'/.test(f.core)],
  ["Κ14: ελιά ECe 2,7 · επιτραπέζια σταφύλια 1,5 · ντομάτα αμετάβλητη (2,5)", f => eceOf(f.core, "koroneiki") === 2.7 && eceOf(f.core, "table_grapes") === 1.5 && eceOf(f.core, "tomato") === 2.5],
];

const MUTATIONS = [
  ["Κ3: ο μέσος ξαναμηδενίζεται πριν το BPI", c => c.replace("? _prevAvgN : newAvg;", "? newAvg : newAvg;")],
  ["Κ12: γυμνό truthiness ξανά (στο IPSI, όχι στο VPD)", c => c.replace("if (_sagHasSeries(measurements?.data?.air_temperature)) airTempSeries = measurements.data.air_temperature; // s2120", "if (measurements?.data?.air_temperature) airTempSeries = measurements.data.air_temperature; // s2120")],
  ["Κ7: χωρίς ανεμόμετρο δεν ορίζεται 0,5", c => c.replace("  if (!Number.isFinite(u2_irr)) {\n", "  if (false) {\n")],
  ["Κ9: αναστολή ξανά χωρίς όρο", c => c.replace("if (effectiveRainfall_mm >= 5 && _rainStillArriving) {", "if (effectiveRainfall_mm >= 5) {")],
  ["Κ9: το ριζόστρωμα δεν εξετάζεται", c => c.replace("_mSoilNow > _rzAvgIrr + 0.5);", "true);")],
  ["Κ11: κατώφλι σταθερό 10", c => c.replace("Math.min(12, Math.max(8, Number.isFinite(_coldMinRaw) ? _coldMinRaw : 10))", "10")],
  ["Κ11: η ήπια ζώνη δίνει βέτο", c => c.replace("if (_coldFrac >= 1 && _coldWet) {", "if (_coldFrac > 0 && _coldWet) {")],
  ["Κ4: η ετικέτα δεν κοιτά τα λίτρα", c => c.replace("} else if (ipsi < 3 && _irrDueNow) {", "} else if (false) {")],
  ["Κ14: ελιά πίσω στο 4,7", c => c.replace("max_tolerance_ECe: 2.7,   // T-ECE-OLIVE-01", "max_tolerance_ECe: 4.7,   // T-ECE-OLIVE-01")],
  ["έκδοση πίσω πριν τη v50.140", c => c.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · [^']+';/, "const SAG_KERNEL_VERSION = 'v50.139 · 2026-09-19';")],
];

function load(t) { return { core: lf(t), coreRaw: t }; }
function run(f) { let ok = 0, bad = 0; for (const [n, fn] of CHECKS) { let r = false; try { r = !!fn(f); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
const coreRaw = readFileSync(CORE, "utf8");
if (process.argv.includes("--mutate")) {
  const base = run(load(coreRaw)); if (base.bad) { console.log(`Βάση: ${base.ok} OK · ${base.bad} X`); process.exit(1); }
  let killed = 0;
  for (const [n, mut] of MUTATIONS) {
    const m = mut(lf(coreRaw)).replace(/\n/g, "\r\n");
    if (m === coreRaw) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + n); continue; }
    const r = run(load(m)); if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad}): ${n}`); } else console.log("  ✘ ΕΠΕΖΗΣΕ: " + n);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`); process.exit(killed === MUTATIONS.length ? 0 : 1);
} else { const r = run(load(coreRaw)); console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`); process.exit(r.bad ? 1 : 0); }
