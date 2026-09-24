#!/usr/bin/env node
/* Ελεγκτής v50.139 · κάρτα BPI: T-BPI-SOILTEMP-01 (Κ2) + T-BPI-WARMTEXT-01 (Κ6) + T-BPI-NIGHT-01 (Κ10), 19/9/2026.
 *
 *   node analysis/test/bpi_card_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ (fTempAsymmetric, buildBPIMessages, getFertilizationGrowthMessages)
 *   node analysis/test/bpi_card_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 *
 * Οι συναρτήσεις εξάγονται ΑΥΤΟΥΣΙΕΣ από τον πυρήνα. Τίποτα δεν γράφεται στον δίσκο.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const lf = (s) => s.replace(/\r\n/g, "\n");

function fnSrc(core, name, nextMarker) {
  const a = core.indexOf("function " + name + "(");
  if (a < 0) return null;
  const b = core.indexOf(nextMarker, a + 1);
  return b < 0 ? null : core.slice(a, b);
}
function build(core) {
  const fTemp = fnSrc(core, "fTempAsymmetric", "\n}\n") + "\n}\n";
  const bbm = fnSrc(core, "buildBPIMessages", "\nfunction _sagBlankCfg");
  const gfg = fnSrc(core, "getFertilizationGrowthMessages", "\n  // Fallback to legacy behaviour");
  // v50.151 · T-BPI-DAYS-01: η getFertilizationGrowthMessages καλεί τον βοηθό _sagBpiDaysTxt — μπαίνει κι αυτός αυτούσιος.
  const days = fnSrc(core, "_sagBpiDaysTxt", "\n}\n");
  if (!fTemp || !bbm || !gfg || !days) return null;
  // Η getFertilizationGrowthMessages κόβεται στο σημείο του legacy fallback: το σώμα κλείνει με «return null».
  const src = `${fTemp}\n${bbm}\n${days}\n}\n${gfg}\n  return null;\n}\nreturn { fTempAsymmetric, buildBPIMessages, getFertilizationGrowthMessages };`;
  return new Function(src)();
}
// Η καμπύλη εδάφους, όπως στον πυρήνα (αντιγραφή του τύπου για έλεγχο τιμών)
function soilTrapFromCore(core) {
  const m = core.match(/const _soilTrap = Number\.isFinite\(_sbtRaw\)\n\s+\? \{ min: _sbtRaw - 2, opt: _sbtRaw \+ 8, max: 50, src: 'soil_base_temp' \}\n\s+: \{ min: optMin, opt: peak - (\d+), max: optMax \+ (\d+), src: 'optimal_temp_range' \};/);
  return m ? { dOpt: Number(m[1]), dMax: Number(m[2]) } : null;
}
const ctx = (over = {}) => ({ efficiency_pct: 50, limiting_factor: "warm", performance_pct: 40, status: { code: "WARM_SUBOPTIMAL" }, light_source: "sensor", ...over });

const CHECKS = [
  ["core: έκδοση ≥ v50.139 (η κάρτα BPI μπήκε στη v50.139· νεότερες εκδόσεις την περιέχουν)",
    f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 139; }],
  ["core: soilBaseTemp ΔΕΝ υπάρχει πια· _soilTrap μία φορά· _soilHot από _soilTrap.opt", f => !f.core.includes("soilBaseTemp")
    && (f.core.match(/const _soilTrap = /g) || []).length === 1 && f.core.includes("const _soilHot = soilTemp_avg > _soilTrap.opt;")],
  ["Κ2: καμπύλη εδάφους = min / peak − 3 / max + 5 (εγκεκριμένα 18/9)", f => { const t = soilTrapFromCore(f.core); return !!t && t.dOpt === 3 && t.dMax === 5; }],
  ["Κ2: ελιά (7/31/35) με έδαφος 30 °C → f_Soil ≈ 0,83 (ήταν 0,625 με Topt 18/Tmax 50)", f => {
    const b = build(f.core); if (!b) return false; const t = soilTrapFromCore(f.core); if (!t) return false;
    const v = b.fTempAsymmetric(30, 7, 31 - t.dOpt, 35 + t.dMax); const old = b.fTempAsymmetric(30, 8, 18, 50);
    return Math.abs(v - 10 / 12) < 1e-9 && Math.abs(old - 0.625) < 1e-9;
  }],
  ["Κ2: τομάτα (10/25/37) με έδαφος 28 °C → f_Soil 0,70· έδαφος 22 °C → 1,0", f => {
    const b = build(f.core); if (!b) return false; const t = soilTrapFromCore(f.core); if (!t) return false;
    return Math.abs(b.fTempAsymmetric(28, 10, 25 - t.dOpt, 37 + t.dMax) - 0.7) < 1e-9 && b.fTempAsymmetric(22, 10, 22, 42) === 1;
  }],
  ["Κ2: δηλωμένο soil_base_temp κρατά το παλιό τραπέζιο (−2/+8/50)", f => /\? \{ min: _sbtRaw - 2, opt: _sbtRaw \+ 8, max: 50, src: 'soil_base_temp' \}/.test(f.core)],
  ["Κ6: warm 50 % → «warning» (Μειωμένο), κείμενο χωρίς «καταπόνηση» και χωρίς 🔥", f => {
    const b = build(f.core); if (!b) return false; const r = b.buildBPIMessages({ efficiency_pct: 50, limiting_factor: "warm", performance_pct: 40 });
    return r.daily.severity === "warning" && !/Θερμική καταπόνηση|🔥/.test(r.daily.message) && /εντός των ορίων/.test(r.daily.message);
  }],
  ["Κ6: warm 25 % → «alert» αλλά κείμενο ☀️ «χωρίς ζημιά», όχι 🔥", f => {
    const b = build(f.core); if (!b) return false; const r = b.buildBPIMessages({ efficiency_pct: 25, limiting_factor: "warm", performance_pct: 40 });
    return r.daily.severity === "alert" && /χωρίς ζημιά/.test(r.daily.message) && !/🔥/.test(r.daily.message);
  }],
  ["Κ6: warm 80 % → «advisory» με δικό του κείμενο", f => {
    const b = build(f.core); if (!b) return false; const r = b.buildBPIMessages({ efficiency_pct: 80, limiting_factor: "warm", performance_pct: 40 });
    return r.daily.severity === "advisory" && /λίγο πάνω από το άριστο/.test(r.daily.message);
  }],
  ["Κ6: heat 50 % → «🔥 Έντονη θερμική καταπόνηση» ΜΟΝΟ όταν alert (< 55)· heat 50 = alert 🔥, heat 60 = warning ☀️", f => {
    const b = build(f.core); if (!b) return false;
    const a = b.buildBPIMessages({ efficiency_pct: 50, limiting_factor: "heat", performance_pct: 40 });
    const w = b.buildBPIMessages({ efficiency_pct: 60, limiting_factor: "heat", performance_pct: 40 });
    return a.daily.severity === "alert" && /🔥 Έντονη/.test(a.daily.message) && w.daily.severity === "warning" && /Θερμική καταπόνηση μειώνει/.test(w.daily.message);
  }],
  ["Κ6: άλλοι παράγοντες αμετάβλητοι (water 50 → alert 🚨, cool 50 → advisory)", f => {
    const b = build(f.core); if (!b) return false;
    const w = b.buildBPIMessages({ efficiency_pct: 50, limiting_factor: "water", performance_pct: 40 });
    const c = b.buildBPIMessages({ efficiency_pct: 50, limiting_factor: "cool", performance_pct: 40 });
    return w.daily.severity === "alert" && /🚨/.test(w.daily.message) && c.daily.severity === "advisory";
  }],
  ["Κ10: context NIGHT → ΕΝΑ μήνυμα «Νύχτα» γκρι, ΚΑΝΕΝΑ bpi_season_message", f => {
    const b = build(f.core); if (!b) return false;
    const r = b.getFertilizationGrowthMessages(0, "", { efficiency_pct: 0, limiting_factor: "light", status: { code: "NIGHT", message: "Νύχτα" }, performance_pct: 0 });
    return Array.isArray(r) && r.length === 1 && r[0].variable === "bpi_message" && r[0].value === "Νύχτα" && r[0].metadata.color === "grey" && r[0].metadata.code === "NIGHT";
  }],
  ["Κ10: κανονικό context → 2 μηνύματα όπως πριν (bpi_message + bpi_season_message)", f => {
    const b = build(f.core); if (!b) return false;
    const r = b.getFertilizationGrowthMessages(1, "", ctx({ efficiency_pct: 95, limiting_factor: "mixed", performance_pct: 92, status: { code: "OK" } }));
    return Array.isArray(r) && r.length === 2 && r[0].value === "Κανονικό" && r[1].variable === "bpi_season_message";
  }],
  ["Κ6+Κ10: warm 50 % από άκρη σε άκρη → bpi_message «Μειωμένο» πορτοκαλί (όχι «Ελάχιστο» κόκκινο)", f => {
    const b = build(f.core); if (!b) return false; const r = b.getFertilizationGrowthMessages(1, "", ctx());
    return r[0].value === "Μειωμένο" && r[0].metadata.color === "orange" && !/🔥/.test(r[0].metadata.text);
  }],
  ["core: καθαρό CRLF, χωρίς BOM", f => !f.coreRaw.startsWith("﻿") && (f.coreRaw.match(/\n/g) || []).length === (f.coreRaw.match(/\r\n/g) || []).length],
];

const MUTATIONS = [
  ["Topt πίσω σε peak − 10", c => c.replace("opt: peak - 3, max: optMax + 5", "opt: peak - 10, max: optMax + 5")],
  ["Tmax εδάφους 50 για όλους", c => c.replace("opt: peak - 3, max: optMax + 5", "opt: peak - 3, max: 50")],
  ["_soilHot από παλιό +8", c => c.replace("const _soilHot = soilTemp_avg > _soilTrap.opt;", "const _soilHot = soilTemp_avg > (_soilTrap.opt + 8);")],
  ["warm ξανά στο κείμενο του heat (alert)", c => c.replace('      else if (limiting_factor === "warm")\n        daily.message = "☀️ Θερμοκρασία κοντά στο άνω όριο', '      else if (limiting_factor === "warm")\n        daily.message = "🔥 Έντονη θερμική καταπόνηση κοντά στο άνω όριο')],
  ["warm ξανά στο κείμενο του heat (warning)", c => c.replace('daily.message = "☀️ Ζεστός καιρός, εντός των ορίων της καλλιέργειας — μειωμένη φωτοσύνθεση, όχι καταπόνηση.";', 'daily.message = "☀️ Θερμική καταπόνηση μειώνει τη φωτοσύνθεση.";')],
  ["η οροφή του warm αφαιρείται", c => c.replace('} else if (efficiency_pct >= 55 || _warmCap) {', '} else if (efficiency_pct >= 55) {')],
  ["η οροφή του warm εφαρμόζεται και στο heat", c => c.replace('const _warmCap = (limiting_factor === "warm" &&', 'const _warmCap = ((limiting_factor === "warm" || limiting_factor === "heat") &&')],
  ["η νύχτα ξαναγίνεται συναγερμός", c => c.replace("if (bpiContext.status && bpiContext.status.code === 'NIGHT') {", "if (false) {")],
  ["η νύχτα εκπέμπει και season message", c => c.replace("light_source: (bpiContext.light_source) || 'sensor' } }];", "light_source: (bpiContext.light_source) || 'sensor' } }, { variable: 'bpi_season_message', value: 'x' }];")],
  ["η νύχτα βγαίνει κόκκινη", c => c.replace('metadata: { color: "grey", severity: "info", code: "NIGHT",', 'metadata: { color: "red", severity: "alert", code: "NIGHT",')],
  ["έκδοση πίσω πριν τη v50.139", c => c.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · [^']+';/, "const SAG_KERNEL_VERSION = 'v50.138 · 2026-09-18';")],
];

function load(coreText) { return { core: lf(coreText), coreRaw: coreText }; }
function run(f) {
  let ok = 0, bad = 0;
  for (const [name, fn] of CHECKS) {
    let r = false; try { r = !!fn(f); } catch (e) { r = false; }
    if (r) ok++; else { bad++; console.log("  ✘ " + name); }
  }
  return { ok, bad };
}
const coreRaw = readFileSync(CORE, "utf8");
if (process.argv.includes("--mutate")) {
  const base = run(load(coreRaw));
  if (base.bad) { console.log(`Βάση: ${base.ok} OK · ${base.bad} X — διόρθωσε πρώτα τη βάση`); process.exit(1); }
  let killed = 0;
  for (const [name, mut] of MUTATIONS) {
    const m = mut(lf(coreRaw)).replace(/\n/g, "\r\n");
    if (m === coreRaw) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + name); continue; }
    const r = run(load(m));
    if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad} έλεγχοι): ${name}`); }
    else console.log("  ✘ ΕΠΕΖΗΣΕ: " + name);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`);
  process.exit(killed === MUTATIONS.length ? 0 : 1);
} else {
  const r = run(load(coreRaw));
  console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`);
  process.exit(r.bad ? 1 : 0);
}
