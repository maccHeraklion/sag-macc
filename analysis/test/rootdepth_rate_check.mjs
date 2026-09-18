#!/usr/bin/env node
/* Ελεγκτής v50.138 · T-ROOTDEPTH-ALIAS-01 (Κ1) + T-IRR-RATE-SANITY-01 (Κ8), 18/9/2026.
 *
 *   node analysis/test/rootdepth_rate_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ των δύο μπλοκ
 *   node analysis/test/rootdepth_rate_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 *
 * Τα μπλοκ εξάγονται ΑΥΤΟΥΣΙΑ από τον πυρήνα (ανάμεσα στους δείκτες T-… / End T-…) και
 * τρέχουν με στελέχη. Τίποτα δεν γράφεται στον δίσκο.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const lf = (s) => s.replace(/\r\n/g, "\n");

function slice(core, a, b) {
  const i = core.indexOf(a), j = core.indexOf(b);
  return (i < 0 || j < 0 || j < i) ? null : core.slice(i, j);
}
function buildRootKey(core) {
  const src = slice(core, "// ── T-ROOTDEPTH-ALIAS-01 (v50.138", "// ── End T-ROOTDEPTH-ALIAS-01");
  if (!src) return null;
  const logs = [];
  return { fn: new Function("console", src + "\nreturn _sagRootDepthKey;")({ log: (m) => logs.push(m) }), logs };
}
// Το μπλοκ Κ8 χρησιμοποιεί τοπικές μεταβλητές της calculate_IrrigationVolume — δίνονται ως στελέχη.
function runRate(core, { rateField, se, sr, lph, hours, areaWarn = [] }) {
  const src = slice(core, "  // ── T-IRR-RATE-SANITY-01 (v50.138", "  // ── End T-IRR-RATE-SANITY-01");
  if (!src) return null;
  const body = `
    const parameters = { irrig_emitter_spacing_m: ${JSON.stringify(se)}, irrig_row_spacing_m: ${JSON.stringify(sr)}, irrig_emitter_lph: ${JSON.stringify(lph)} };
    const _rateField = ${JSON.stringify(rateField)};
    const _rateIsDefault = !(Number.isFinite(_rateField) && _rateField > 0);
    const applicationRate = _rateIsDefault ? 4 : _rateField;
    let _durUnknown = false;
    let irrigationDurationHours = ${JSON.stringify(hours)};
    const _areaWarn = ${JSON.stringify(areaWarn)};
    ${src}
    return { _rateCfgErr, _durUnknown, irrigationDurationHours, _longDurTxt, _rateWarn, _areaWarn };`;
  return new Function(body)();
}

const CHECKS = [
  // ── στατικά ──
  ["core: έκδοση ≥ v50.138 (Κ1/Κ8 μπήκαν στη v50.138· νεότερες εκδόσεις τα περιέχουν)",
    f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 138; }],
  ["core: ο παλιός τοπικός χάρτης stageToRootDepth ΔΕΝ υπάρχει πια", f => !f.core.includes("stageToRootDepth")],
  ["core: _sagRootDepthKey ορίζεται μία φορά και καλείται σε ΔΥΟ θέσεις (άρδευση + στάθμιση)",
    f => (f.core.match(/function _sagRootDepthKey\(/g) || []).length === 1
      && f.core.includes("const rdKey = _sagRootDepthKey(stageKey);")
      && f.core.includes('const rdKey = _sagRootDepthKey(parameters?.stage || "initial");')],
  ["core: _rateWarn μπαίνει στην εκπομπή", f => /\.\.\._areaWarn,\n\s+\.\.\._rateWarn,/.test(f.core)],
  ["core: irrigationDurationHours εκπέμπεται με rate_mm_h/rate_source", f => /variable: 'irrigationDurationHours', value: irrigationDurationHours,\n\s+metadata: \{ rate_mm_h:/.test(f.core)],
  ["core: το μήνυμα διάρκειας διακρίνει λάθος παροχής από άγνωστη παροχή", f => f.core.includes("λάθος παροχή ή αποστάσεις, δείτε «Ρύθμιση άρδευσης»") && f.core.includes("+ _longDurTxt)")],
  ["core: καθαρό CRLF, χωρίς BOM", f => !f.coreRaw.startsWith("\uFEFF") && (f.coreRaw.match(/\n/g) || []).length === (f.coreRaw.match(/\r\n/g) || []).length],
  // ── εκτέλεση Κ1 ──
  ["Κ1: τα 7 στάδια της φόρμας που έπεφταν στο «initial» τώρα αντιστοιχούν σωστά", f => {
    const r = buildRootKey(f.core); if (!r) return false; const k = r.fn;
    return k("tillering") === "vegetative" && k("stem_elongation") === "vegetative" && k("anthesis") === "full_canopy"
      && k("grain_filling") === "full_canopy" && k("dormancy") === "full_canopy" && k("bloom") === "full_canopy" && k("fruit_set") === "full_canopy";
  }],
  ["Κ1: τα 5 στάδια του GDD (tasseling, tuberization, bulbing, maturity, establishment)", f => {
    const r = buildRootKey(f.core); if (!r) return false; const k = r.fn;
    return k("tasseling") === "full_canopy" && k("tuberization") === "full_canopy" && k("bulbing") === "full_canopy"
      && k("maturity") === "full_canopy" && k("establishment") === "initial";
  }],
  ["Κ1: τα 8 παλιά κλειδιά δίνουν ΑΚΡΙΒΩΣ ό,τι έδιναν (διαφορικός 0 για τους αγρούς που δούλευαν)", f => {
    const r = buildRootKey(f.core); if (!r) return false; const k = r.fn;
    const old = { transplant: "initial", germination: "initial", vegetative: "vegetative", flowering: "full_canopy",
      fruit_dev: "full_canopy", fruiting: "full_canopy", ripening: "full_canopy", harvest: "full_canopy" };
    return Object.keys(old).every(s => k(s) === old[s]) && k(undefined) === "initial" && k("") === "initial";
  }],
  ["Κ1: άγνωστο στάδιο → «initial» ΚΑΙ καταγραφή (όχι σιωπή)", f => {
    const r = buildRootKey(f.core); if (!r) return false;
    return r.fn("kalimera") === "initial" && r.logs.length === 1 && /kalimera/.test(r.logs[0]);
  }],
  // ── εκτέλεση Κ8 ──
  ["Κ8: ΚΟΥΤΣΑΚΗΣ 4 L/h @ 50 × 1,25 m → σφάλμα αποστάσεων, διάρκεια 0, config_error", f => {
    const r = runRate(f.core, { rateField: 0.064, se: 50, sr: 1.25, lph: 4, hours: 22.21 });
    return r && /εκατοστά αντί για μέτρα/.test(r._rateCfgErr) && r._durUnknown && r.irrigationDurationHours === 0
      && r._rateWarn.length === 1 && r._rateWarn[0].variable === "irrigation_config_error" && /Τα λίτρα δεν επηρεάζονται/.test(r._rateWarn[0].metadata.text);
  }],
  ["Κ8: Κουκιά 4 L/h @ 20 × 1,5 m → σφάλμα αποστάσεων", f => {
    const r = runRate(f.core, { rateField: 0.133, se: 20, sr: 1.5, lph: 4, hours: 44.46 });
    return r && !!r._rateCfgErr && r.irrigationDurationHours === 0;
  }],
  ["Κ8: παροχή 0,2 mm/h με αποστάσεις < 12 m → σφάλμα «παράλογα αραιός»", f => {
    const r = runRate(f.core, { rateField: 0.2, se: 5, sr: 4, lph: 4, hours: 30 });
    return r && /παράλογα αραιός/.test(r._rateCfgErr) && r.irrigationDurationHours === 0;
  }],
  ["Κ8: παροχή 80 mm/h → σφάλμα «πάνω από κάθε εκτοξευτήρα»", f => {
    const r = runRate(f.core, { rateField: 80, se: 0.3, sr: 0.5, lph: 12, hours: 0.1 });
    return r && /εκτοξευτήρα/.test(r._rateCfgErr) && r.irrigationDurationHours === 0;
  }],
  ["Κ8: ΚΕΚ 0,4 mm/h, 66,37 ω → ΟΧΙ σφάλμα, διάρκεια αμετάβλητη, κατάτμηση σε 9 ποτίσματα ~7,4 ω", f => {
    const r = runRate(f.core, { rateField: 0.4, se: 5, sr: 2, lph: 4, hours: 66.37 });
    return r && r._rateCfgErr === null && !r._durUnknown && r.irrigationDurationHours === 66.37 && r._rateWarn.length === 0
      && /9 ποτίσματα/.test(r._longDurTxt) && /7,4 ωρών/.test(r._longDurTxt);
  }],
  ["Κ8: Γρινιαράκης 10 mm/h, 0,36 ω → τίποτα (κείμενο κενό, καμία προειδοποίηση)", f => {
    const r = runRate(f.core, { rateField: 10, se: 0.4, sr: 1, lph: 4, hours: 0.36 });
    return r && r._rateCfgErr === null && r._longDurTxt === "" && r._rateWarn.length === 0 && r.irrigationDurationHours === 0.36;
  }],
  ["Κ8: 12 ω ακριβώς → χωρίς κατάτμηση· 12,1 ω → 2 ποτίσματα", f => {
    const a = runRate(f.core, { rateField: 2, se: 1, sr: 2, lph: 4, hours: 12 });
    const b = runRate(f.core, { rateField: 2, se: 1, sr: 2, lph: 4, hours: 12.1 });
    return a && b && a._longDurTxt === "" && /2 ποτίσματα/.test(b._longDurTxt);
  }],
  ["Κ8: προεπιλεγμένη παροχή (χωρίς δήλωση) → η πύλη ΔΕΝ τρέχει (μένει στην T-IRR-DURATION-SANITY-01)", f => {
    const r = runRate(f.core, { rateField: NaN, se: 50, sr: 50, lph: 4, hours: 3 });
    return r && r._rateCfgErr === null && r.irrigationDurationHours === 3;
  }],
  ["Κ8: όταν υπάρχει ήδη σφάλμα έκτασης, το σφάλμα παροχής ΠΡΟΣΤΙΘΕΤΑΙ στο ίδιο κλειδί (όχι δεύτερο irrigation_config_error)", f => {
    const r = runRate(f.core, { rateField: 0.064, se: 50, sr: 1.25, lph: 4, hours: 5,
      areaWarn: [{ variable: "irrigation_config_error", value: "Ύποπτα μικρή έκταση: 5 m²", metadata: { color: "orange", text: "Η έκταση…" } }] });
    return r && r._rateWarn.length === 0 && /Επίσης: Απόσταση σταλακτών/.test(r._areaWarn[0].metadata.text);
  }],
];

const MUTATIONS = [
  ["αφαίρεση tillering από τον χάρτη", c => c.replace("vegetative: 'vegetative', tillering: 'vegetative',", "vegetative: 'vegetative',")],
  ["dormancy → initial", c => c.replace("dormancy: 'full_canopy', dormant: 'full_canopy',", "dormancy: 'initial', dormant: 'full_canopy',")],
  ["άγνωστο στάδιο χωρίς καταγραφή", c => c.replace("  console.log('T-ROOTDEPTH-ALIAS-01: άγνωστο στάδιο «' + stage + '» — βάθος ρίζας «initial»');\n", "")],
  ["η στάθμιση αισθητήρων κρατά παλιό χάρτη", c => c.replace('const rdKey = _sagRootDepthKey(parameters?.stage || "initial");', 'const rdKey = "initial";')],
  ["όριο αποστάσεων 12 → 120 m", c => c.replace("(Number.isFinite(_seR) && _seR > 12) || (Number.isFinite(_srR) && _srR > 12)", "(Number.isFinite(_seR) && _seR > 120) || (Number.isFinite(_srR) && _srR > 120)")],
  ["κάτω όριο παροχής 0,3 → 0,03", c => c.replace("} else if (_rateField < 0.3) {", "} else if (_rateField < 0.03) {")],
  ["άνω όριο παροχής αφαιρείται", c => c.replace("} else if (_rateField > 60) {", "} else if (_rateField > 6000) {")],
  ["το σφάλμα δεν μηδενίζει τη διάρκεια", c => c.replace("if (_rateCfgErr) { _durUnknown = true; irrigationDurationHours = 0; }", "if (_rateCfgErr) { _durUnknown = true; }")],
  ["κατάτμηση από 12 → 120 ω", c => c.replace("irrigationDurationHours > 12)", "irrigationDurationHours > 120)")],
  ["ποτίσματα των 8 → 80 ωρών", c => c.replace("Math.ceil(irrigationDurationHours / 8)", "Math.ceil(irrigationDurationHours / 80)")],
  ["_rateWarn δεν εκπέμπεται", c => c.replace("    ..._rateWarn, // T-IRR-RATE-SANITY-01\n", "")],
  ["η πύλη τρέχει και με προεπιλογή", c => c.replace("  if (!_rateIsDefault) {\n    const _seR", "  if (true) {\n    const _seR")],
  ["διπλό irrigation_config_error", c => c.replace("const _rateWarn = (_rateCfgErr && !_areaWarn.length)", "const _rateWarn = (_rateCfgErr)")],
  ["έκδοση πίσω πριν τη v50.138", c => c.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · [^']+';/, "const SAG_KERNEL_VERSION = 'v50.137 · 2026-09-18';")],
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
    // οι μεταλλάξεις γράφονται με LF· εφαρμόζονται στο LF κείμενο και ξαναγίνονται CRLF
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
