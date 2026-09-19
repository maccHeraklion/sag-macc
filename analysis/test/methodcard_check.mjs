#!/usr/bin/env node
/* Ελεγκτής πυρήνα v50.146 · T-METHODCARD-01 — η μέθοδος φεύγει από την ωριαία κάρτα.
 * Εξάγει ΑΥΤΟΛΕΞΕΙ τη λίστα κλειδιών και τον βρόχο σάρωσης από τον πυρήνα και τα ΕΚΤΕΛΕΙ
 * πάνω σε συνθετικό bundle: τα κείμενα μεθόδου πρέπει να φεύγουν, οι ΤΙΜΕΣ να μένουν,
 * και ό,τι κατευθύνει ενέργεια να μην αγγίζεται.
 *
 *   node analysis/test/methodcard_check.mjs            → έλεγχοι
 *   node analysis/test/methodcard_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };

/* Ο βρόχος ζει μέσα στην packCalculatedIndicators. Τον βγάζουμε αυτούσιο και του δίνουμε
   τα δύο κουτιά που θα έβρισκε εκεί (sharedPacked, cropsPackedArr). */
function build(core) {
  const body = slice(core, "  const _SAG_METHOD_KEYS = [", "  // ── SAG-BUNDLE-FIT-01");
  if (!body) return null;
  try {
    return new Function("sharedPacked", "cropsPackedArr",
      "let _SAG_METHOD_CARD = null;\n" + body + "\nreturn { card: _SAG_METHOD_CARD, keys: _SAG_METHOD_KEYS };");
  } catch (e) { return null; }
}
const ind = (text) => ({ value: 1, metadata: { color: "grey", text } });
function fixture() {
  return {
    shared: {
      met_reference_source: ind("Χωρίς μετεωρολογικό σταθμό: οι θερμοκρασίες έρχονται από τον αισθητήρα κόμης."),
      leaf_wetness_source: ind("ΣΕ ΠΑΥΣΗ: ο αισθητήρας φύλλου δεν έχει στείλει μέτρηση."),
      soil_depth_basis: ind("Ένα μόνο βάθος."),
      soil_moisture_rootzone: ind("Σταθμισμένη κατά FAO-56. Δύο βάθη."),
      // ΔΡΑΣΗ — ΔΕΝ πρέπει να πειραχτούν
      irrigation_message: ind("Συνιστώμενη ποσότητα 1.031.465 λίτρα."),
      plant_stress: ind("Ποτίστε τώρα."),
      soil_ec_status: ind("Συσσώρευση αλάτων."),
      irrigation_dose_basis: ind("Η ΜΕΤΡΗΣΗ ΣΑΣ 3220 dS/m ΑΓΝΟΗΘΗΚΕ."),
      irrigation_area_basis: ind("Ο αγρός έχει 2 καλλιέργειες χωρίς δηλωμένα m²."),
      sensor_faults: ind("1) dragino_lms01_ls_3ac7 — Το όργανο σιωπά."),
    },
    crops: [{
      id: "c1", cultivation_type: "koroneiki",
      indicators: {
        bpi_comparability: ind("Δείτε το BPI μόνο ως τάση του ίδιου αγρού."),
        dli_comparable: ind("Πλήρης φωτοπερίοδος."),
        pathogen_hs_basis: ind("Ευπάθεια φυτού: ατμοσφαιρική μόνο."),
        et0_inputs_basis: ind("Είσοδοι ζήτησης νερού (FAO-56)."),
        pathogen_analysis_status: ind("Υπολογίζεται από τον καιρό."),
        bpi_message: ind("Μέτρια δραστηριότητα ριζών."),
        crop_stage: ind("ΥΔΑΤΙΚΟ στάδιο (FAO-56)."),
      },
    }],
  };
}
function runSweep(g) {
  const f = fixture();
  const r = g(f.shared, f.crops);
  return { f, card: r.card, keys: r.keys };
}
const txt = (box, k) => (box[k] && box[k].metadata && typeof box[k].metadata.text === "string") ? box[k].metadata.text : null;

const CHECKS = [
  ["core: έκδοση ≥ v50.146 και T-METHODCARD-01 παρόν", f => {
    const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /);
    return !!m && Number(m[1]) >= 146 && f.core.includes("T-METHODCARD-01 (v50.146"); }],
  ["ΛΙΣΤΑ: 9 κλειδιά μεθόδου, και ΔΕΝ περιέχει τα δύο irrigation_*_basis (είναι δράση)", f => {
    const g = build(f.core); if (!g) return false; const { keys } = runSweep(g);
    return keys.length === 9 && keys.indexOf("irrigation_dose_basis") < 0
      && keys.indexOf("irrigation_area_basis") < 0 && keys.indexOf("met_reference_source") >= 0; }],
  ["ΣΑΡΩΣΗ: τα κείμενα μεθόδου του shared ΦΕΥΓΟΥΝ από το bundle", f => {
    const g = build(f.core); if (!g) return false; const { f: b } = runSweep(g);
    return ["met_reference_source", "leaf_wetness_source", "soil_depth_basis", "soil_moisture_rootzone"]
      .every(k => txt(b.shared, k) === null); }],
  ["ΣΑΡΩΣΗ: τα κείμενα μεθόδου ΑΝΑ ΚΑΛΛΙΕΡΓΕΙΑ φεύγουν κι αυτά", f => {
    const g = build(f.core); if (!g) return false; const { f: b } = runSweep(g);
    const box = b.crops[0].indicators;
    return ["bpi_comparability", "dli_comparable", "pathogen_hs_basis", "et0_inputs_basis", "pathogen_analysis_status"]
      .every(k => txt(box, k) === null); }],
  ["ΣΑΡΩΣΗ: οι ΤΙΜΕΣ μένουν ανέγγιχτες — χάνεται κείμενο, όχι μέτρηση", f => {
    const g = build(f.core); if (!g) return false; const { f: b } = runSweep(g);
    return b.shared.met_reference_source.value === 1 && b.crops[0].indicators.dli_comparable.value === 1; }],
  ["ΣΑΡΩΣΗ: μπαίνει η σημαία _m ώστε το widget να ξέρει ότι το κείμενο ΜΕΤΑΚΟΜΙΣΕ", f => {
    const g = build(f.core); if (!g) return false; const { f: b } = runSweep(g);
    return b.shared.met_reference_source.metadata._m === 1 && b.crops[0].indicators.dli_comparable.metadata._m === 1; }],
  ["ΔΡΑΣΗ ΑΝΕΓΓΙΧΤΗ: άρδευση, καταπόνηση, αλατότητα, βλάβες, BPI, στάδιο κρατούν το κείμενό τους", f => {
    const g = build(f.core); if (!g) return false; const { f: b } = runSweep(g);
    return ["irrigation_message", "plant_stress", "soil_ec_status", "sensor_faults"].every(k => txt(b.shared, k) !== null)
      && txt(b.crops[0].indicators, "bpi_message") !== null
      && txt(b.crops[0].indicators, "crop_stage") !== null; }],
  ["ΔΡΑΣΗ ΑΝΕΓΓΙΧΤΗ: τα δύο irrigation_*_basis κρατούν την προειδοποίηση δεδομένων", f => {
    const g = build(f.core); if (!g) return false; const { f: b } = runSweep(g);
    return /ΑΓΝΟΗΘΗΚΕ/.test(txt(b.shared, "irrigation_dose_basis") || "")
      && txt(b.shared, "irrigation_area_basis") !== null; }],
  ["ΚΑΡΤΑ: μαζεύει 9 κείμενα, με πρόθεμα καλλιέργειας στα ανά καλλιέργεια", f => {
    const g = build(f.core); if (!g) return false; const { card } = runSweep(g);
    return card && card.n === 9 && /koroneiki\/bpi_comparability: /.test(card.t)
      && /^met_reference_source: /m.test(card.t); }],
  ["ΚΑΡΤΑ: χωρίς κείμενα μεθόδου -> ΚΑΜΙΑ κάρτα (καμία κενή εγγραφή)", f => {
    const g = build(f.core); if (!g) return false;
    const r = g({ irrigation_message: ind("x") }, []);
    return r.card === null; }],
  ["ΕΓΓΡΑΦΗ: γράφεται ΜΟΝΟ στο ημερήσιο tick, μαζί με την αναφορά αναβάθμισης, σε ΜΙΑ κλήση", f => {
    /* Ο πυρήνας έχει 5 κλάδους `if (dailyTich)`. Αγκιστρώνουμε στον ΣΥΓΚΕΚΡΙΜΕΝΟ,
       αυτόν που χτίζει τη λίστα `_daily`, αλλιώς η απόσταση μετριέται από άλλον. */
    const d = f.core.indexOf("const _daily = [];");
    const i = f.core.lastIndexOf("if (dailyTich) {", d);
    const j = f.core.indexOf("variable: 'field_method_card'", d);
    const k = f.core.indexOf("if (_daily.length) await dev_to_send_meas.sendData(_daily);", d);
    return d > 0 && i > 0 && j > i && k > j && (k - i) < 1600; }],
  ["ΕΓΓΡΑΦΗ: η κάρτα κόβεται στα 2000 χαρακτήρες (δεν γίνεται νέο βάρος)", f =>
    f.core.includes("String(_SAG_METHOD_CARD.t).slice(0, 2000)")],
  ["ΚΑΤΑΣΤΑΣΗ: μηδενίζεται ανά εκτέλεση ΚΑΙ ανά αγρό (καμία διαρροή από αγρό σε αγρό)", f =>
    f.core.includes("_SAG_METHOD_CARD = null;  // T-METHODCARD-01")
    && (f.core.match(/_SAG_METHOD_CARD = null;/g) || []).length >= 3],
  ["core: CRLF χωρίς BOM, node --check", f => {
    if (f.raw.charCodeAt(0) === 0xFEFF) return false;
    if ((f.raw.match(/\r\n/g) || []).length !== (f.raw.match(/\n/g) || []).length) return false;
    const t = join(tmpdir(), "methodcard_check_core.js"); writeFileSync(t, f.raw);
    try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } }],
];

const MUTATIONS = [
  ["το irrigation_dose_basis μπαίνει στη λίστα μεθόδου (χάνεται προειδοποίηση)", c => c.replace(
    "    'met_reference_source',      // από ποιον αισθητήρα έρχονται οι θερμοκρασίες",
    "    'irrigation_dose_basis',\n    'met_reference_source',      // από ποιον αισθητήρα έρχονται οι θερμοκρασίες")],
  ["η σάρωση σβήνει ΚΑΙ την τιμή, όχι μόνο το κείμενο", c => c.replace(
    "        delete v.metadata.text;\n        v.metadata._m = 1;", "        delete v.metadata.text;\n        delete v.value;\n        v.metadata._m = 1;")],
  ["δεν μπαίνει η σημαία _m", c => c.replace("        v.metadata._m = 1;   // «το κείμενο ζει", "        v.metadata._m = 0;   // «το κείμενο ζει")],
  ["η σάρωση αγνοεί τις καλλιέργειες", c => c.replace(
    "    for (const crop of cropsPackedArr) {\n      _sweep(crop.indicators,", "    for (const crop of []) {\n      _sweep(crop.indicators,")],
  ["η σάρωση αγνοεί το shared", c => c.replace("    _sweep(sharedPacked, '');", "")],
  ["η κάρτα γράφεται σε ΚΑΘΕ παλμό", c => c.replace("        if (dailyTich) {\n          try {\n            const _daily = [];", "        if (true) {\n          try {\n            const _daily = [];")],
  ["η κάρτα δεν κόβεται στα 2000", c => c.replace("String(_SAG_METHOD_CARD.t).slice(0, 2000)", "String(_SAG_METHOD_CARD.t)")],
  ["κενή κάρτα γράφεται κι αυτή", c => c.replace("    if (_parts.length) _SAG_METHOD_CARD =", "    if (true) _SAG_METHOD_CARD =")],
];

function load(raw) { return { raw, core: raw.replace(/\r\n/g, "\n") }; }
function run(f) { let ok = 0, bad = 0; for (const [n, x] of CHECKS) { let r = false; try { r = !!x(f); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
const raw = readFileSync(CORE, "utf8");
if (process.argv.includes("--mutate")) {
  const b0 = run(load(raw)); if (b0.bad) { console.log(`Βάση: ${b0.ok} OK · ${b0.bad} X`); process.exit(1); }
  let killed = 0;
  for (const [n, mut] of MUTATIONS) {
    const base = raw.replace(/\r\n/g, "\n");
    const m = mut(base);
    if (m === base) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + n); continue; }
    const r = run(load(m.replace(/\n/g, "\r\n")));
    if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad}): ${n}`); } else console.log("  ✘ ΕΠΕΖΗΣΕ: " + n);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`); process.exit(killed === MUTATIONS.length ? 0 : 1);
} else { const r = run(load(raw)); console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`); process.exit(r.bad ? 1 : 0); }
