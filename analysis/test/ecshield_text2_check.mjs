#!/usr/bin/env node
/* Ελεγκτής πυρήνα v50.147 · T-ECSHIELD-TEXT-02 — η ασπίδα δουλεύει ΣΤΗΝ ΠΡΑΞΗ, όχι στη σειρά.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο ελεγκτής της v50.144 (`ecshield_text_check`) ήταν ΠΡΑΣΙΝΟΣ και η ασπίδα
 * ΔΕΝ δούλευε. Έλεγχε τη ΣΕΙΡΑ ταξινόμησης — που ήταν όντως σωστή — αλλά ΟΧΙ τον βρόχο που
 * καταναλώνει τη σειρά. Ο βρόχος σβήνει σε ΠΑΡΤΙΔΕΣ των 8 και η πρώτη κιόλας παρτίδα
 * κατάπινε ολόκληρη τη λίστα μαζί με τα προστατευμένα. Μετρημένο 19/9 16:28 UTC: και οι 8
 * αγροί έχαναν ΑΚΟΜΗ την ετυμηγορία αλατότητας μετά τη v50.145.
 *
 * ΕΔΩ: εξάγεται ΑΥΤΟΛΕΞΕΙ ο βρόχος της φάσης (α) από τον πυρήνα και ΕΚΤΕΛΕΙΤΑΙ με ψεύτικο
 * συμπιεστή, ώστε να κριθεί το ΑΠΟΤΕΛΕΣΜΑ: ποια κείμενα επέζησαν.
 *
 *   node analysis/test/ecshield_text2_check.mjs            → έλεγχοι
 *   node analysis/test/ecshield_text2_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
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

/* Ο ΑΥΤΟΛΕΞΕΙ βρόχος της φάσης (α), από τη δήλωση της παρτίδας ως τη φάση (β). */
function phaseA(core) {
  return slice(core, "    let _batch = 8;", "    // (β) ολόκληροι δείκτες");
}

/* Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ βρόχο. Μοντέλο: κάθε κείμενο που σβήνεται κερδίζει `save` bytes.
 * Επιστρέφει ΠΟΙΑ κλειδιά κράτησαν το κείμενό τους. */
function run(core, { keys, shielded, start, cap, save }) {
  const loop = phaseA(core);
  if (!loop) return null;
  const src = `
    const _sagShielded = (k) => SHIELDED.indexOf(k) >= 0;
    const _SAG_BUNDLE_MAX_B64 = CAP;
    const box = {};
    for (const k of KEYS) box[k] = { metadata: { text: "x".repeat(300) } };
    const _victims = KEYS.map((k) => ({ box, k, len: 300 }));
    let _textsDropped = 0;
    const compressFieldBundle = () => {
      let gone = 0;
      for (const k of KEYS) if (typeof box[k].metadata.text !== "string") gone++;
      return "z".repeat(START - gone * SAVE);
    };
    const sharedPacked = {}, cropsPackedArr = [];
    let compressedData = compressFieldBundle();
${loop}
    return { kept: KEYS.filter((k) => typeof box[k].metadata.text === "string"), dropped: _textsDropped,
             finalLen: compressedData.length };`;
  try {
    return new Function("KEYS", "SHIELDED", "START", "CAP", "SAVE", src)(keys, shielded, start, cap, save);
  } catch (e) { return null; }
}

/* ΣΕΝΑΡΙΟ Α — η περίπτωση ΚΑΜΠΑΝΗΣ, μετρημένη 19/9: λίγα παλιά θύματα, μία παρτίδα τα τρώει όλα.
 * 6 απροστάτευτα + 2 προστατευμένα. Χρειάζονται 4 σβησίματα· τα 6 απροστάτευτα ΑΡΚΟΥΝ. */
const A = { keys: ["measurement_age", "forecast_status", "met_reference_source", "soil_ece1",
                   "dli_comparable", "bpi_comparability", "soil_ec_status", "salinity_stress"],
            shielded: ["soil_ec_status", "salinity_stress"], start: 9400, cap: 9200, save: 60 };

/* ΣΕΝΑΡΙΟ Β — τα απροστάτευτα ΔΕΝ αρκούν: μπαίνουμε στην ασπίδα, αλλά ΕΝΑ-ΕΝΑ.
 * 2 απροστάτευτα + 3 προστατευμένα, start 9440: 2+2 σβησίματα φτάνουν, το 3ο πρέπει να ΖΗΣΕΙ. */
const B = { keys: ["measurement_age", "forecast_status",
                   "soil_ec_status", "salinity_stress", "fir_message_botrytis_cinerea"],
            shielded: ["soil_ec_status", "salinity_stress", "fir_message_botrytis_cinerea"],
            start: 9440, cap: 9200, save: 60 };

/* ΣΕΝΑΡΙΟ Γ — τίποτα δεν αρκεί: ο βρόχος ΠΡΕΠΕΙ να τερματίζει, όχι να κολλάει. */
const C = { keys: ["a", "b", "soil_ec_status", "salinity_stress"],
            shielded: ["soil_ec_status", "salinity_stress"], start: 9999, cap: 9200, save: 1 };

const CHECKS = [
  ["core: έκδοση ≥ v50.147 και T-ECSHIELD-TEXT-02 παρόν", f => {
    const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /);
    return !!m && Number(m[1]) >= 147 && f.core.includes("T-ECSHIELD-TEXT-02 (v50.147"); }],
  ["core: ο βρόχος της φάσης (α) εντοπίζεται", f => !!phaseA(f.core)],
  ["core: η φάση (α) έχει ΠΛΕΟΝ φρουρό συνόρου ασπίδας", f => {
    const l = phaseA(f.core); if (!l) return false;
    return /if \(!_sagShielded\(_victims\[_i\]\.k\)\)/.test(l) && /_sagShielded\(_victims\[_q\]\.k\)/.test(l); }],
  ["core: μέσα στην ασπίδα η παρτίδα γίνεται 1 και ΔΕΝ ξαναμεγαλώνει", f => {
    const l = phaseA(f.core); if (!l) return false;
    return /if \(_sagShielded\(_victims\[_i\]\.k\)\) _batch = 1;/.test(l)
      && /if \(_batch > 1\) _batch = Math\.min\(128, _batch \* 2\);/.test(l); }],

  ["ΣΕΝΑΡΙΟ Α (ΚΑΜΠΑΝΗΣ): η ετυμηγορία αλατότητας ΕΠΙΖΕΙ ολόκληρη", f => {
    const r = run(f.core, A); if (!r) return false;
    return r.kept.includes("soil_ec_status") && r.kept.includes("salinity_stress"); }],
  ["ΣΕΝΑΡΙΟ Α: σβήνονται ΜΟΝΟ απροστάτευτα κείμενα", f => {
    const r = run(f.core, A); if (!r) return false;
    return r.dropped === 6 && r.kept.length === 2; }],
  ["ΣΕΝΑΡΙΟ Α: το bundle ΟΝΤΩΣ χώρεσε (ο σκοπός του φρουρού)", f => {
    const r = run(f.core, A); if (!r) return false;
    return r.finalLen <= A.cap; }],

  ["ΣΕΝΑΡΙΟ Β: μπαίνει στην ασπίδα ΜΟΝΟ όσο χρειάζεται — 1 προστατευμένο επιζεί", f => {
    const r = run(f.core, B); if (!r) return false;
    return r.dropped === 4 && r.kept.length === 1 && r.finalLen <= B.cap; }],
  ["ΣΕΝΑΡΙΟ Β: μέσα στην ασπίδα σβήνει ΕΝΑ-ΕΝΑ, όχι σε παρτίδα", f => {
    const r = run(f.core, B); if (!r) return false;
    // με παρτίδα 8 θα έφευγαν και τα 5· με φρουρό μένει ακριβώς 1
    return r.kept.length === 1; }],

  ["ΣΕΝΑΡΙΟ Γ: όταν τίποτα δεν αρκεί, ο βρόχος ΤΕΡΜΑΤΙΖΕΙ (καμία ατέρμονη επανάληψη)", f => {
    const r = run(f.core, C); if (!r) return false;
    return r.dropped === 4 && r.kept.length === 0; }],

  ["ΑΜΕΤΑΒΛΗΤΟ: η ΠΡΑΓΜΑΤΙΚΗ ασπίδα πιάνει ακόμη soil_ec_status / salinity_* / fir_message_*", f => {
    // Τα σενάρια περνούν δική τους λίστα, οπότε η αληθινή _SAG_BUNDLE_SHIELD πρέπει να
    // ασκηθεί ΡΗΤΑ — αλλιώς μια αφαίρεση κλειδιού από την ασπίδα περνά απαρατήρητη.
    const d = slice(f.core, "const _SAG_BUNDLE_SHIELD = [", "const _sagShielded");
    if (!d) return false;
    let re;
    try { re = new Function("return " + d.replace("const _SAG_BUNDLE_SHIELD = ", "").trim().replace(/;$/, ""))(); }
    catch (e) { return false; }
    if (!Array.isArray(re)) return false;
    const hit = (k) => re.some((r) => r.test(k));
    return hit("soil_ec_status") && hit("salinity_stress") && hit("salinity_ks")
      && hit("fir_message_botrytis_cinerea") && hit("crop_stage")
      && !hit("measurement_age") && !hit("forecast_status"); }],
  ["ΑΜΕΤΑΒΛΗΤΟ: η φάση (β) κρατά τον δικό της φρουρό συνόρου", f => {
    const l = slice(f.core, "const _sagDropOldKeys = ()", "// ── (γ) ΤΕΛΕΥΤΑΙΑ ΓΡΑΜΜΗ");
    if (!l) return false;
    return /if \(_sagShielded\(_order\[_ki\]\.k\)\) _kb = 1;/.test(l)
      && /while \(_q < _end && !_sagShielded\(_order\[_q\]\.k\)\) _q\+\+;/.test(l); }],
  ["ΑΜΕΤΑΒΛΗΤΟ: η ταξινόμηση της v50.144 παραμένει (ασπίδα → ηλικία → μήκος)", f =>
    f.core.includes("_victims.sort((a, b) => ((_sagShielded(a.k) ? 1 : 0) - (_sagShielded(b.k) ? 1 : 0))")],
  ["ΑΜΕΤΑΒΛΗΤΟ: οι φάσεις (α) και (β) δεν μπερδεύτηκαν — μία δήλωση ασπίδας", f =>
    (f.core.match(/const _SAG_BUNDLE_SHIELD = \[/g) || []).length === 1],
  ["core: CRLF χωρίς BOM, node --check", f => {
    if (f.raw.charCodeAt(0) === 0xFEFF) return false;
    if ((f.raw.match(/\r\n/g) || []).length !== (f.raw.match(/\n/g) || []).length) return false;
    const t = join(tmpdir(), "ecshield2_check_core.js"); writeFileSync(t, f.raw);
    try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } }],
];

/* Κάθε μετάλλαξη είναι ένας ΡΕΑΛΙΣΤΙΚΟΣ τρόπος να χαλάσει η διόρθωση. Όλες ΠΡΕΠΕΙ να πεθαίνουν. */
const MUTATIONS = [
  ["ο φρουρός συνόρου φεύγει από τη φάση (α) (= η συμπεριφορά της v50.146)", c => c.replace(
    "      if (!_sagShielded(_victims[_i].k)) { let _q = _i; while (_q < _end && !_sagShielded(_victims[_q].k)) _q++; _end = _q; }\n", "")],
  ["η παρτίδα ΔΕΝ γίνεται 1 μέσα στην ασπίδα", c => c.replace(
    "      if (_sagShielded(_victims[_i].k)) _batch = 1;   // στην ασπίδα: ένα-ένα, όχι παρτίδες\n", "")],
  ["η παρτίδα ξαναμεγαλώνει ακόμη και μέσα στην ασπίδα", c => c.replace(
    "      if (_batch > 1) _batch = Math.min(128, _batch * 2);   // T-ECSHIELD-TEXT-02: στην ασπίδα μένει 1",
    "      _batch = Math.min(128, _batch * 2);")],
  ["η ασπίδα δεν πιάνει πια το salinity_*", c => c.replace("/^soil_ec_status$/, /^salinity_/,", "/^soil_ec_status$/,")],
  ["η ταξινόμηση της ασπίδας χάνεται (τα προστατευμένα δεν πάνε τελευταία)", c => c.replace(
    "_victims.sort((a, b) => ((_sagShielded(a.k) ? 1 : 0) - (_sagShielded(b.k) ? 1 : 0))\n      || (_spent(b) - _spent(a)) || (b.len - a.len));",
    "_victims.sort((a, b) => (_spent(b) - _spent(a)) || (b.len - a.len));")],
  ["ο φρουρός αντιστρέφεται: κόβει στα ΑΠΡΟΣΤΑΤΕΥΤΑ αντί στα προστατευμένα", c => c.replace(
    "if (!_sagShielded(_victims[_i].k)) { let _q = _i; while (_q < _end && !_sagShielded(_victims[_q].k)) _q++; _end = _q; }",
    "if (_sagShielded(_victims[_i].k)) { let _q = _i; while (_q < _end && _sagShielded(_victims[_q].k)) _q++; _end = _q; }")],
  // Η μετάλλαξη ΔΕΝ καρφώνει έκδοση: κάθε νέα έκδοση θα την ξεκόλλαγε σιωπηλά.
  ["η έκδοση δεν ανέβηκε", c => c.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · /,
    "const SAG_KERNEL_VERSION = 'v50.146 · ")],
  ["η φάση (β) χάνει τον δικό της φρουρό (παλινδρόμηση v50.127)", c => c.replace(
    "        if (_sagShielded(_order[_ki].k)) _kb = 1;   // στην ασπίδα: ένα-ένα, όχι παρτίδες\n", "")],
];

// Ο πυρήνας είναι CRLF· τα μοτίβα των μεταλλάξεων είναι LF. Μεταλλάσσουμε ΠΑΝΤΑ σε LF και
// ξαναφτιάχνουμε το CRLF μόνο για τον έλεγχο μορφής — αλλιώς ΚΑΜΙΑ μετάλλαξη δεν εφαρμόζεται
// και ο ελεγκτής δείχνει «πράσινος» ενώ δεν ελέγχει τίποτα (ακριβώς το λάθος της v50.144).
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
  console.log(`\nT-ECSHIELD-TEXT-02: ${ok}/${CHECKS.length}`);
  process.exit(ok === CHECKS.length ? 0 : 1);
} else {
  let killed = 0;
  for (const [name, mut] of MUTATIONS) {
    const m = mut(LF);
    // Μια μετάλλαξη που δεν εφαρμόζεται ΔΕΝ είναι ουδέτερη: σημαίνει ότι ο ελεγκτής
    // ξεκόλλησε από τον πυρήνα. Μετράει ως ΑΠΟΤΥΧΙΑ, όχι ως παράλειψη.
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
