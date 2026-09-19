#!/usr/bin/env node
/* Ελεγκτής sync v13 · T-CROPKEYS-03 (έλεγχος 18/9, Κ13): η προβολή ανά καλλιέργεια σηκώνει τα κλειδιά που ο πυρήνας
 * διαβάζει (plants, area_m2, irrig_emitter_spacing_m, irrig_row_spacing_m, irrig_emitter_lph, cultivation_variety) και σε
 * υπέρβαση ορίου κόβονται ΠΡΩΤΑ αυτά.
 *
 *   node analysis/test/sync_cropkeys_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ projectCrop / stripCropExtras
 *   node analysis/test/sync_cropkeys_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SYNC = join(ROOT, "analysis/setFieldParametersFromDeviceData.js");
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };
const fn = (c, name) => { const src = slice(c, "function " + name + "(", "\n}\n"); return src ? src + "\n}\n" : null; };

function build(sync) {
  const consts = slice(sync, "const _CROP_EXTRA_NUM = [", "function stripCropExtras(");
  const parts = [consts, fn(sync, "stripCropExtras"), fn(sync, "isBlank"), fn(sync, "projectCrop")];
  if (parts.some(p => !p)) return null;
  return new Function(parts.join("\n") + "\nreturn { projectCrop, stripCropExtras, _CROP_EXTRA_KEYS };")();
}
const CROP = { id: "c1", cultivation_type_general: "olive", cultivation_type: "koroneiki", plantation_year: 2010,
  periods: { flowering: { start: "05-01", end: "05-20" } } };

const CHECKS = [
  ["sync: v13 δηλωμένη στην κεφαλίδα και _CROP_EXTRA_KEYS ορισμένα μία φορά", f => /\*\* v13 · 19\/9\/2026 — T-CROPKEYS-03/.test(f.sync) && (f.sync.match(/const _CROP_EXTRA_KEYS = /g) || []).length === 1],
  ["sync: η υπέρβαση ορίου κόβει ΠΡΩΤΑ τα πρόσθετα (stripCropExtras) και μόνο μετά αποτυγχάνει", f =>
    f.sync.indexOf("const _stripped = stripCropExtras(tag.crops);") > 0 && f.sync.indexOf("const _stripped = stripCropExtras(tag.crops);") < f.sync.lastIndexOf("ΥΠΕΡΒΑΣΗ ΜΕΓΕΘΟΥΣ TAG: ${serialized.length}") && f.sync.includes("let serialized = JSON.stringify(tag);")],
  ["sync: χωρίς BOM, ενιαίες γραμμές (LF στο index· το working tree των Windows μπορεί να είναι CRLF)", f =>
    !f.syncRaw.startsWith("﻿") && ((f.syncRaw.match(/\r/g) || []).length === 0 || (f.syncRaw.match(/\r\n/g) || []).length === (f.syncRaw.match(/\n/g) || []).length)],
  ["πυρήνας: διαβάζει crop.plants / area_m2 / irrig_emitter_lph / irrig_row_spacing_m / irrig_emitter_spacing_m (τα κλειδιά που σηκώνει η v13)", f =>
    ["crop.plants", "crop.area_m2", "crop.irrig_emitter_lph", "crop.irrig_row_spacing_m", "crop.irrig_emitter_spacing_m"].every(k => f.core.includes(k))],
  ["projectCrop: πλήρης δήλωση → και τα 6 πρόσθετα περνούν (plants ακέραιο, αριθμοί 2 δεκαδικά, ποικιλία)", f => {
    const g = build(f.sync); if (!g) return false;
    const p = g.projectCrop({ ...CROP, plants: "194", area_m2: 660.456, irrig_emitter_spacing_m: "0,5", irrig_row_spacing_m: 1.25, irrig_emitter_lph: 4, cultivation_variety: "kalamon" }, 0);
    return p.plants === 194 && p.area_m2 === 660.46 && p.irrig_emitter_spacing_m === 0.5 && p.irrig_row_spacing_m === 1.25 && p.irrig_emitter_lph === 4 && p.cultivation_variety === "kalamon"
      && p.cultivation_type === "koroneiki" && p.periods && p.plantation_year === 2010;
  }],
  ["projectCrop: κενά / μη αριθμοί / ≤ 0 / ποικιλία = τύπος ΔΕΝ περνούν (μηδέν κόστος για τον αγρό που δεν απαντά)", f => {
    const g = build(f.sync); if (!g) return false;
    const p = g.projectCrop({ ...CROP, plants: "", area_m2: "abc", irrig_emitter_spacing_m: -1, irrig_row_spacing_m: 0, irrig_emitter_lph: null, cultivation_variety: "koroneiki" }, 0);
    return !("plants" in p) && !("area_m2" in p) && !("irrig_emitter_spacing_m" in p) && !("irrig_row_spacing_m" in p) && !("irrig_emitter_lph" in p) && !("cultivation_variety" in p);
  }],
  ["projectCrop: χωρίς πρόσθετα → ΙΔΙΑ προβολή με τη v12 (id, general, type, periods, plantation_year)", f => {
    const g = build(f.sync); if (!g) return false; const p = g.projectCrop(CROP, 0);
    return Object.keys(p).sort().join(",") === "cultivation_type,cultivation_type_general,id,periods,plantation_year";
  }],
  ["projectCrop: ποικιλία κόβεται στους 40 χαρακτήρες", f => {
    const g = build(f.sync); if (!g) return false; const p = g.projectCrop({ ...CROP, cultivation_variety: "x".repeat(60) }, 0); return p.cultivation_variety.length === 40;
  }],
  ["stripCropExtras: αφαιρεί ΜΟΝΟ τα 6 πρόσθετα, δεν αγγίζει periods/plantation_year, δεν μεταλλάσσει το πρωτότυπο", f => {
    const g = build(f.sync); if (!g) return false;
    const src = [{ ...CROP, plants: 3, area_m2: 10, irrig_emitter_lph: 4, cultivation_variety: "v" }];
    const out = g.stripCropExtras(src);
    return !("plants" in out[0]) && !("cultivation_variety" in out[0]) && out[0].periods && out[0].plantation_year === 2010 && src[0].plants === 3 && g._CROP_EXTRA_KEYS.length === 6;
  }],
];

const MUTATIONS = [
  ["plants δεν περνά", c => c.replace('const _CROP_EXTRA_NUM = ["plants", "area_m2",', 'const _CROP_EXTRA_NUM = ["area_m2",')],
  ["τα ≤ 0 περνούν", c => c.replace("if (!Number.isFinite(n) || n <= 0) continue;", "if (!Number.isFinite(n)) continue;")],
  ["η ποικιλία δεν κόβεται", c => c.replace(".trim().slice(0, 40);", ".trim();")],
  ["η υπέρβαση δεν κόβει τα πρόσθετα", c => c.replace("    if (_s2.length <= TAG_SAFE_LIMIT && _s2.length < serialized.length) {", "    if (false) {").replace("const _stripped = stripCropExtras(tag.crops);", "const _stripped = tag.crops;")],
  ["stripCropExtras αφήνει την ποικιλία", c => c.replace('const _CROP_EXTRA_KEYS = [..._CROP_EXTRA_NUM, "cultivation_variety"];', "const _CROP_EXTRA_KEYS = [..._CROP_EXTRA_NUM];")],
];

function load(sr, cr) { return { sync: sr.replace(/\r\n/g, "\n"), syncRaw: sr, core: cr.replace(/\r\n/g, "\n") }; }
function run(f) { let ok = 0, bad = 0; for (const [n, x] of CHECKS) { let r = false; try { r = !!x(f); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
const syncRaw = readFileSync(SYNC, "utf8"), coreRaw = readFileSync(CORE, "utf8");
if (process.argv.includes("--mutate")) {
  const b0 = run(load(syncRaw, coreRaw)); if (b0.bad) { console.log(`Βάση: ${b0.ok} OK · ${b0.bad} X`); process.exit(1); }
  let killed = 0;
  for (const [n, mut] of MUTATIONS) {
    const base = syncRaw.replace(/\r\n/g, "\n");
    const m = mut(base);
    if (m === base) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + n); continue; }
    const r = run(load(m, coreRaw)); if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad}): ${n}`); } else console.log("  ✘ ΕΠΕΖΗΣΕ: " + n);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`); process.exit(killed === MUTATIONS.length ? 0 : 1);
} else { const r = run(load(syncRaw, coreRaw)); console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`); process.exit(r.bad ? 1 : 0); }
