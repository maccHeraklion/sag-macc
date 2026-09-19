#!/usr/bin/env node
/* Ελεγκτής v50.141 · T-ECREF-01 (Φάση Α, βήμα Α3): προ-αρδευτική αναφορά soil_ec_ref1/2.
 *
 *   node analysis/test/ecref_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ της _sagEcRefIndicators αυτούσιας
 *   node analysis/test/ecref_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const lf = (s) => s.replace(/\r\n/g, "\n");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };
const fn = (c, name) => { const src = slice(c, "function " + name + "(", "\n}\n"); return src ? src + "\n}\n" : null; };

function build(core) {
  const parts = [
    /const _SAG_EC_EPS0 = [^\n]+/, /const _SAG_EC_MIN_VWC = [^\n]+/, /const _SAG_EC_DEAD_US = [^\n]+/,
  ].map(re => (core.match(re) || [null])[0]);
  const chans = slice(core, "const _SAG_EC_CHANNELS = [", "];") + "];";
  const fns = ["_sagEcWaterPermittivity", "_sagEcToppPermittivity", "_sagEcChain", "_sagEcRefIndicators"].map(n => fn(core, n));
  if (parts.some(p => !p) || fns.some(f => !f) || !chans) return null;
  const src = `const getVal = (m, k, d) => (m && m.data && Number.isFinite(Number(m.data[k]))) ? Number(m.data[k]) : d;
    const console = { log: () => {} };
    ${parts.join("\n")}\n${chans}\n${fns.join("\n")}\nreturn _sagEcRefIndicators;`;
  return new Function(src)();
}
const meas = (d) => ({ data: d });
const NOW = "2026-09-19T05:20:00.000Z";
const state = (out) => { const s = out.find(x => x.variable === "ec_ref_state"); return s ? JSON.parse(s.value) : null; };
const ref = (out, n) => out.find(x => x.variable === "soil_ec_ref" + n);

const CHECKS = [
  ["core: έκδοση ≥ v50.141", f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 141; }],
  ["core: helper T-ECREF-01 μία φορά, καλείται ΠΡΙΝ το T-ECPH-01 και μπαίνει στο bundle δίπλα στο _ecphIndicators", f =>
    (f.core.match(/function _sagEcRefIndicators\(/g) || []).length === 1
    && f.core.indexOf("const _ecRefIndicators = _sagEcRefIndicators(measurements, _prevBundleForWash?.shared, dailyTich,") < f.core.indexOf("let _ecphIndicators = [];")
    && f.core.includes("...(_ecRefIndicators ?? []),")],
  ["core: ec_ref_state είναι ΚΑΤΑΣΤΑΣΗ (αθάνατη) και soil_ec_ref1/2 στις σειρές", f => /\/\^ec_ref_state\$\/,/.test(f.core) && /_SAG_SERIES_KEYS = \[[^\]]*'soil_ec_ref1', 'soil_ec_ref2'[^\]]*\]/.test(f.core)],
  ["core: το _SAG_BUNDLE_DROP δεν πετά τα νέα κλειδιά", f => { const d = slice(f.core, "_SAG_BUNDLE_DROP", "];"); return !!d && !/ec_ref/.test(d); }],
  ["core: καθαρό CRLF, χωρίς BOM", f => !f.coreRaw.startsWith("﻿") && (f.coreRaw.match(/\n/g) || []).length === (f.coreRaw.match(/\r\n/g) || []).length],
  ["ωριαίο, χωρίς προηγούμενη κατάσταση: το δείγμα (θ 30, 500 µS, 20 °C) γίνεται κατάσταση, ΚΑΜΙΑ εκπομπή soil_ec_ref", f => {
    const g = build(f.core); if (!g) return false;
    const out = g(meas({ conduct_soil1: 500, soil_moisture1: 30, soil_temperature1: 20 }), {}, false, NOW);
    const st = state(out); return st && st["1"] && st["1"].th === 30 && st["1"].sw > 0 && st["1"].t === 20 && st["1"].ts === NOW && !ref(out, "1");
  }],
  ["ωριαίο: ξηρότερο δείγμα (θ 25) αντικαθιστά το θ 30· υγρότερο (θ 35) δεν το αγγίζει", f => {
    const g = build(f.core); if (!g) return false;
    const prev = { ec_ref_state: JSON.stringify({ "1": { th: 30, sw: 2.0, t: 20, ts: "x" } }) };
    const a = state(g(meas({ conduct_soil1: 480, soil_moisture1: 25, soil_temperature1: 19 }), prev, false, NOW));
    const b = state(g(meas({ conduct_soil1: 520, soil_moisture1: 35, soil_temperature1: 21 }), prev, false, NOW));
    return a && a["1"].th === 25 && b && b["1"].th === 30 && b["1"].sw === 2.0;
  }],
  ["ημερήσιο: εκπέμπει soil_ec_ref1 = σ_w του ξηρότερου (κατάσταση θ 25 vs τρέχον θ 24 → τρέχον) και ξεκινά νέο παράθυρο από το τρέχον", f => {
    const g = build(f.core); if (!g) return false;
    const prev = { ec_ref_state: JSON.stringify({ "1": { th: 25, sw: 2.2, t: 19, ts: "x" } }) };
    const out = g(meas({ conduct_soil1: 480, soil_moisture1: 24, soil_temperature1: 19 }), prev, true, NOW);
    const r = ref(out, "1"); const st = state(out);
    return r && r.metadata.theta === 24 && r.metadata.at === NOW && Math.abs(r.value - st["1"].sw) < 0.01 && st["1"].th === 24 && /ξηρότερο δείγμα/.test(r.metadata.text);
  }],
  ["ημερήσιο: η κατάσταση (θ 22) είναι ξηρότερη από το τρέχον (θ 28) → εκπέμπεται η κατάσταση (2,2 dS/m, θ 22), το νέο παράθυρο ξεκινά από θ 28", f => {
    const g = build(f.core); if (!g) return false;
    const prev = { ec_ref_state: JSON.stringify({ "1": { th: 22, sw: 2.2, t: 19, ts: "y" } }) };
    const out = g(meas({ conduct_soil1: 480, soil_moisture1: 28, soil_temperature1: 19 }), prev, true, NOW);
    const r = ref(out, "1"); const st = state(out);
    return r && r.value === 2.2 && r.metadata.theta === 22 && r.metadata.at === "y" && st["1"].th === 28;
  }],
  ["ημερήσιο χωρίς προηγούμενη κατάσταση (πρώτο παράθυρο): ΚΑΜΙΑ εκπομπή, η κατάσταση ξεκινά", f => {
    const g = build(f.core); if (!g) return false;
    const out = g(meas({ conduct_soil1: 480, soil_moisture1: 24, soil_temperature1: 19 }), {}, true, NOW);
    return !ref(out, "1") && state(out) && state(out)["1"].th === 24;
  }],
  ["νεκρό όργανο (20 µS σε θ 30) → κανένα δείγμα, η κατάσταση μένει· θ 12 % (εκτός Hilhorst) → το ίδιο", f => {
    const g = build(f.core); if (!g) return false;
    const prev = { ec_ref_state: JSON.stringify({ "1": { th: 25, sw: 2.2, t: 19, ts: "x" } }) };
    // θ 20 < κατάσταση 25: χωρίς την πύλη το νεκρό όργανο θα γινόταν «ξηρότερο δείγμα»
    const a = state(g(meas({ conduct_soil1: 20, soil_moisture1: 20, soil_temperature1: 19 }), prev, false, NOW));
    const b = state(g(meas({ conduct_soil1: 480, soil_moisture1: 12, soil_temperature1: 19 }), prev, false, NOW));
    return a && a["1"].th === 25 && a["1"].sw === 2.2 && b && b["1"].th === 25;
  }],
  ["δύο βάθη ανεξάρτητα: ref1 από θ 24, ref2 από θ 31", f => {
    const g = build(f.core); if (!g) return false;
    const prev = { ec_ref_state: JSON.stringify({ "1": { th: 26, sw: 2.0, t: 19, ts: "x" }, "2": { th: 33, sw: 1.4, t: 18, ts: "x" } }) };
    const out = g(meas({ conduct_soil1: 480, soil_moisture1: 24, soil_temperature1: 19, conduct_soil2: 300, soil_moisture2: 31, soil_temperature2: 18 }), prev, true, NOW);
    return ref(out, "1") && ref(out, "1").metadata.theta === 24 && ref(out, "2") && ref(out, "2").metadata.theta === 31;
  }],
  ["μη αριθμημένο κανάλι (conduct_soil/soil_moisture/temp_soil) → κανάλι 1", f => {
    const g = build(f.core); if (!g) return false;
    const st = state(g(meas({ conduct_soil: 400, soil_moisture: 27, temp_soil: 20 }), {}, false, NOW));
    return st && st["1"] && st["1"].th === 27;
  }],
  ["χαλασμένη κατάσταση (μη JSON) → αγνοείται χωρίς σφάλμα", f => {
    const g = build(f.core); if (!g) return false;
    const st = state(g(meas({ conduct_soil1: 480, soil_moisture1: 24, soil_temperature1: 19 }), { ec_ref_state: "{oops" }, false, NOW));
    return st && st["1"].th === 24;
  }],
];

const MUTATIONS = [
  ["ελάχιστο → μέγιστο θ", c => c.replace("const best = (cur && (!p || cur.th < Number(p.th))) ? cur : p;", "const best = (cur && (!p || cur.th > Number(p.th))) ? cur : p;")],
  ["χωρίς νέο παράθυρο μετά την εκπομπή", c => c.replace("        next[c.n] = cur;   // νέο παράθυρο από το τρέχον δείγμα", "        next[c.n] = best;")],
  ["εκπομπή και στο πρώτο παράθυρο", c => c.replace("        if (p && best) {", "        if (best) {")],
  ["χωρίς πύλη νεκρού οργάνου", c => c.replace("      if (!dead && Number.isFinite(raw) && Number.isFinite(th)) {", "      if (Number.isFinite(raw) && Number.isFinite(th)) {")],
  ["η κατάσταση παύει να είναι αθάνατη", c => c.replace("  /^ec_ref_state$/,", "")],
  ["οι σειρές χάνουν το soil_ec_ref", c => c.replace(", 'soil_ec_ref1', 'soil_ec_ref2'", "")],
  ["η κλήση μετακινείται ΜΕΤΑ το ημερήσιο μπλοκ", c => { const line = "        const _ecRefIndicators = _sagEcRefIndicators(measurements, _prevBundleForWash?.shared, dailyTich, new Date().toISOString());\n"; return c.replace(line, "").replace("        let _ecphIndicators = [];\n", "        let _ecphIndicators = [];\n" + line); }],
  ["έκδοση πίσω", c => c.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · [^']+';/, "const SAG_KERNEL_VERSION = 'v50.140 · 2026-09-19';")],
];

function load(t) { return { core: lf(t), coreRaw: t }; }
function run(f) { let ok = 0, bad = 0; for (const [n, x] of CHECKS) { let r = false; try { r = !!x(f); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
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
