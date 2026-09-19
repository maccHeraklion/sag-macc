#!/usr/bin/env node
/* Ελεγκτής πυρήνα v50.148 · T-STAGEPREAMBLE-01 — το προοίμιο του crop_stage στην κάρτα μεθόδου.
 *
 * Ο ελεγκτής ΕΚΤΕΛΕΙ τον αυτολεξεί κώδικα του πυρήνα και κρίνει το ΑΠΟΤΕΛΕΣΜΑ: τι έμεινε στην
 * ωριαία κάρτα, τι πήγε στην ημερήσια. Δεν αρκείται στο ότι «γράφτηκε ο κώδικας που ήθελα» —
 * αυτό ακριβώς ήταν το λάθος της v50.144 (βλ. ecshield_text2_check).
 *
 * Ο ΠΙΟ ΕΠΙΚΙΝΔΥΝΟΣ ΤΡΟΠΟΣ ΝΑ ΣΠΑΣΕΙ: να αλλάξει έστω ΕΝΑΣ χαρακτήρας στο προοίμιο σε ένα από
 * τα δύο σημεία (σταθερά / σημείο εκπομπής). Τότε το indexOf αποτυγχάνει ΣΙΩΠΗΛΑ και το
 * προοίμιο μένει για πάντα στο bundle. Ελέγχεται ρητά, byte προς byte.
 *
 *   node analysis/test/stagepreamble_check.mjs            → έλεγχοι
 *   node analysis/test/stagepreamble_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => {
  const i = c.indexOf(a);
  const j = i < 0 ? -1 : c.indexOf(b, i + 1);
  return (i < 0 || j < 0) ? null : c.slice(i, j);
};

const PRE_DECL = (c) => slice(c, "const _SAG_STAGE_PREAMBLE =", "_SAG_METHOD_CARD = null;");
const TRIM = (c) => slice(c, "    let _stageTrim = 0;", "    if (_parts.length) _SAG_METHOD_CARD");
/* Το κείμενο του προοιμίου όπως γράφεται στο ΣΗΜΕΙΟ ΕΚΠΟΜΠΗΣ (T-THERMAL-01). */
const EMIT = (c) => {
  const m = c.match(/\?\s*\('(ΥΔΑΤΙΚΟ στάδιο[^']*)'/);
  return m ? m[1] : null;
};
/* Η τιμή της σταθεράς, αποτιμημένη — όχι διαβασμένη με το μάτι. */
function preambleValue(core) {
  const d = PRE_DECL(core);
  if (!d) return null;
  try { return new Function(d + "\nreturn _SAG_STAGE_PREAMBLE;")(); } catch (e) { return null; }
}

/* Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα περικοπής πάνω σε καλλιέργειες που φτιάχνουμε εμείς. */
function run(core, crops) {
  const decl = PRE_DECL(core), trim = TRIM(core);
  if (!decl || !trim) return null;
  const src = `
    ${decl}
    const cropsPackedArr = CROPS;
    const _parts = PARTS;
${trim}
    return { parts: _parts, crops: cropsPackedArr, trimmed: _stageTrim };`;
  try { return new Function("CROPS", "PARTS", src)(crops, []); } catch (e) { return null; }
}

const mkCrop = (id, text) => ({ cultivation_type: id, indicators: { crop_stage: { value: "x", metadata: { text, color: "green" } } } });

const CHECKS = [
  ["core: έκδοση ≥ v50.148 και T-STAGEPREAMBLE-01 παρόν", f => {
    const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /);
    return !!m && Number(m[1]) >= 148 && f.core.includes("T-STAGEPREAMBLE-01 (v50.148"); }],
  ["core: η σταθερά και το μπλοκ περικοπής εντοπίζονται", f => !!PRE_DECL(f.core) && !!TRIM(f.core)],

  ["ΤΑΥΤΙΣΗ BYTE-BYTE: η σταθερά είναι ΑΚΡΙΒΩΣ το κείμενο του σημείου εκπομπής", f => {
    const a = preambleValue(f.core), b = EMIT(f.core);
    return typeof a === "string" && typeof b === "string" && a === b && a.length > 40; }],
  ["το προοίμιο τελειώνει με κενό (αλλιώς κολλάει στην επόμενη λέξη)", f => {
    const a = preambleValue(f.core);
    return typeof a === "string" && a.endsWith(" "); }],

  ["ΠΕΡΙΚΟΠΗ: το προοίμιο φεύγει και το ΥΠΟΛΟΙΠΟ μένει ακέραιο", f => {
    const p = preambleValue(f.core); if (!p) return false;
    const rest = "Το φύλλωμα γερνά. Θερμική πρόοδος: 61 %.";
    const r = run(f.core, [mkCrop("olive", p + rest)]); if (!r) return false;
    return r.crops[0].indicators.crop_stage.metadata.text === rest; }],
  ["ΠΕΡΙΚΟΠΗ: μπαίνει η σημαία _mp (όχι _m — το κείμενο ΔΕΝ έφυγε ολόκληρο)", f => {
    const p = preambleValue(f.core); if (!p) return false;
    const r = run(f.core, [mkCrop("olive", p + "υπόλοιπο")]); if (!r) return false;
    const md = r.crops[0].indicators.crop_stage.metadata;
    return md._mp === 1 && md._m === undefined; }],
  ["ΠΕΡΙΚΟΠΗ: η ΤΙΜΗ και το χρώμα δεν πειράζονται", f => {
    const p = preambleValue(f.core); if (!p) return false;
    const r = run(f.core, [mkCrop("olive", p + "υπόλοιπο")]); if (!r) return false;
    const e = r.crops[0].indicators.crop_stage;
    return e.value === "x" && e.metadata.color === "green"; }],

  ["ΜΙΑ ΦΟΡΑ: με 4 καλλιέργειες, το προοίμιο μπαίνει ΜΙΑ φορά στην κάρτα", f => {
    const p = preambleValue(f.core); if (!p) return false;
    const r = run(f.core, ["a", "b", "c", "d"].map((k) => mkCrop(k, p + "υπ " + k))); if (!r) return false;
    const hits = r.parts.filter((x) => x.indexOf("crop_stage: ") === 0);
    return r.trimmed === 4 && hits.length === 1; }],
  ["ΜΙΑ ΦΟΡΑ: και οι 4 καλλιέργειες έχασαν το προοίμιο", f => {
    const p = preambleValue(f.core); if (!p) return false;
    const r = run(f.core, ["a", "b", "c", "d"].map((k) => mkCrop(k, p + "υπ " + k))); if (!r) return false;
    return r.crops.every((c) => c.indicators.crop_stage.metadata.text.indexOf(p) !== 0
      && c.indicators.crop_stage.metadata._mp === 1); }],

  ["ΑΛΛΟΣ ΚΛΑΔΟΣ: κείμενο ΧΩΡΙΣ το προοίμιο μένει ΑΝΕΓΓΙΧΤΟ", f => {
    // Ο μη-FAO κλάδος γράφει «Προσδιορίστηκε από τις βαθμοημέρες…» — δεν έχει προοίμιο.
    const other = "Προσδιορίστηκε από τις βαθμοημέρες ανάπτυξης.";
    const r = run(f.core, [mkCrop("olive", other)]); if (!r) return false;
    const md = r.crops[0].indicators.crop_stage.metadata;
    return md.text === other && md._mp === undefined && r.trimmed === 0 && r.parts.length === 0; }],
  ["ΜΕΣΑ ΣΤΟ ΚΕΙΜΕΝΟ: το προοίμιο κόβεται ΜΟΝΟ αν είναι στην ΑΡΧΗ", f => {
    const p = preambleValue(f.core); if (!p) return false;
    const r = run(f.core, [mkCrop("olive", "Κάτι άλλο πρώτα. " + p + "υπόλοιπο")]); if (!r) return false;
    return r.trimmed === 0 && r.crops[0].indicators.crop_stage.metadata._mp === undefined; }],
  ["ΧΩΡΙΣ crop_stage: καμία κατάρρευση, καμία εγγραφή", f => {
    const r = run(f.core, [{ cultivation_type: "olive", indicators: {} }, { cultivation_type: "x" }]);
    return !!r && r.trimmed === 0 && r.parts.length === 0; }],

  ["ΑΜΕΤΑΒΛΗΤΟ: η σάρωση ΟΛΟΚΛΗΡΟΥ κειμένου (v50.146) ΔΕΝ περιλαμβάνει το crop_stage", f => {
    const keys = slice(f.core, "const _SAG_METHOD_KEYS = [", "];");
    return !!keys && !/'crop_stage'/.test(keys); }],
  ["ΑΜΕΤΑΒΛΗΤΟ: το crop_stage παραμένει στην ασπίδα του bundle", f =>
    f.core.includes("/^crop_stage$/")],
  ["core: CRLF χωρίς BOM, node --check", f => {
    if (f.raw.charCodeAt(0) === 0xFEFF) return false;
    if ((f.raw.match(/\r\n/g) || []).length !== (f.raw.match(/\n/g) || []).length) return false;
    const t = join(tmpdir(), "stagepre_check_core.js"); writeFileSync(t, f.raw);
    try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } }],
];

const MUTATIONS = [
  ["η σταθερά αποκλίνει κατά ΕΝΑΝ χαρακτήρα από το σημείο εκπομπής", c => c.replace(
    "  const _SAG_STAGE_PREAMBLE =\n    'ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογία. ';",
    "  const _SAG_STAGE_PREAMBLE =\n    'ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογια. ';")],
  ["χάνεται το τελικό κενό του προοιμίου", c => c.replace(
    "ΔΕΝ είναι φαινολογία. ';", "ΔΕΝ είναι φαινολογία.';")],
  ["το προοίμιο κόβεται ΟΠΟΥΔΗΠΟΤΕ, όχι μόνο στην αρχή", c => c.replace(
    "if (typeof t !== 'string' || t.indexOf(_SAG_STAGE_PREAMBLE) !== 0) continue;",
    "if (typeof t !== 'string' || t.indexOf(_SAG_STAGE_PREAMBLE) < 0) continue;")],
  ["μπαίνει _m αντί για _mp (λέει ψέματα ότι έφυγε ΟΛΟ το κείμενο)", c => c.replace(
    "      v.metadata._mp = 1;   // «το προοίμιο ζει στην ταυτότητα του αγρού»",
    "      v.metadata._m = 1;")],
  ["το προοίμιο μπαίνει στην κάρτα ΜΙΑ ΦΟΡΑ ΑΝΑ ΚΑΛΛΙΕΡΓΕΙΑ", c => c.replace(
    "      _stageTrim++;\n    }\n    if (_stageTrim) _parts.push('crop_stage: ' + _SAG_STAGE_PREAMBLE.trim());",
    "      _stageTrim++;\n      _parts.push('crop_stage: ' + _SAG_STAGE_PREAMBLE.trim());\n    }")],
  ["σβήνεται ΟΛΟ το κείμενο αντί για το προοίμιο", c => c.replace(
    "      v.metadata.text = t.slice(_SAG_STAGE_PREAMBLE.length);",
    "      delete v.metadata.text;")],
  ["το crop_stage μπαίνει στη σάρωση ΟΛΟΚΛΗΡΟΥ κειμένου (διπλή αφαίρεση)", c => c.replace(
    "    'dli_comparable',  ", "    'crop_stage', 'dli_comparable',  ")],
  ["η έκδοση δεν ανέβηκε", c => c.replace("const SAG_KERNEL_VERSION = 'v50.148 · 2026-09-19';",
    "const SAG_KERNEL_VERSION = 'v50.147 · 2026-09-19';")],
];

// Ο πυρήνας είναι CRLF· τα μοτίβα είναι LF. Μεταλλάσσουμε ΠΑΝΤΑ σε LF, αλλιώς καμία
// μετάλλαξη δεν εφαρμόζεται και ο ελεγκτής φαίνεται πράσινος χωρίς να ελέγχει τίποτα.
function load(lf) { return { core: lf, raw: lf.replace(/\n/g, "\r\n") }; }

const raw = readFileSync(CORE, "utf8");
const LF = raw.replace(/\r\n/g, "\n");
const mutate = process.argv.includes("--mutate");

if (!mutate) {
  const f = load(LF);
  let ok = 0;
  for (const [name, fn] of CHECKS) {
    let pass = false;
    try { pass = !!fn(f); } catch (e) { pass = false; }
    console.log((pass ? "  ✔ " : "  ✘ ") + name);
    if (pass) ok++;
  }
  console.log(`\nT-STAGEPREAMBLE-01: ${ok}/${CHECKS.length}`);
  process.exit(ok === CHECKS.length ? 0 : 1);
} else {
  let killed = 0;
  for (const [name, mut] of MUTATIONS) {
    const m = mut(LF);
    if (m === LF) { console.log("  ✘ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ (ο ελεγκτής ξεκόλλησε): " + name); continue; }
    const f = load(m);
    let survived = true;
    for (const [, fn] of CHECKS) {
      let pass = false;
      try { pass = !!fn(f); } catch (e) { pass = false; }
      if (!pass) { survived = false; break; }
    }
    console.log((survived ? "  ✘ ΕΠΕΖΗΣΕ: " : "  ✔ σκοτώθηκε: ") + name);
    if (!survived) killed++;
  }
  console.log(`\nμεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`);
  process.exit(killed === MUTATIONS.length ? 0 : 1);
}
