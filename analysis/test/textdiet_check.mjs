#!/usr/bin/env node
/* Ελεγκτής πυρήνα v50.145 · T-TEXTDIET-01 — δίαιτα κειμένων + το εμπορικό σε αναφορά.
 * Εκτελεί ΑΥΤΟΛΕΞΕΙ τη buildSoilMoistureLimitIndicators του πυρήνα και ελέγχει ότι:
 *   • το ΑΝΩ όριο δεν κουβαλά πια το κείμενο του κάτω, και το ΚΑΤΩ το κρατά ακέραιο
 *   • η κατάσταση ορίων σιωπά στην επιτυχία και ΜΙΛΑΕΙ στην αποτυχία (εκεί λέει τι να κάνεις)
 *   • το εμπορικό κείμενο ΔΕΝ μπαίνει στο bundle και γράφεται ΜΙΑ φορά την ημέρα εκτός
 *
 *   node analysis/test/textdiet_check.mjs            → έλεγχοι
 *   node analysis/test/textdiet_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };
const fn = (c, name) => { const src = slice(c, "function " + name + "(", "\n}\n"); return src ? src + "\n}\n" : null; };

function build(core) {
  const f = fn(core, "buildSoilMoistureLimitIndicators");
  if (!f) return null;
  /* Τα δύο εξωτερικά που αγγίζει η συνάρτηση: το _sagMsgTidy και ο κατάλογος εδαφών.
     Ο κατάλογος δίνεται ΕΛΑΧΙΣΤΟΣ επίτηδες — ο έλεγχος αφορά τα ΚΕΙΜΕΝΑ, όχι την αγρονομία. */
  const stub = "function _sagMsgTidy(x) { return String(x == null ? '' : x); }\n"
    + "const SOIL_PROFILE = { sandy_loam: { name: 'Αμμώδες Πηλώδες (Sandy Loam)' } };\n";
  try { return new Function(stub + f + "\nreturn buildSoilMoistureLimitIndicators;")(); }
  catch (e) { return null; }
}
/* Ελάχιστο «limits» που φτάνει για να τρέξει η διαδρομή επιτυχίας. */
const LIM = (fellBack) => ({
  ok: true, real_lower_limit: 15.05, real_upper_limit: 17.25,
  M_wilt: 10, M_field_capacity: 30, M_saturation: 45,
  M_lower_bound_pct: 40, M_upper_bound_pct: 70,
  soil_label: "Αμμώδες Πηλώδες (Sandy Loam)", soil_key: "sandy_loam",
  band_source: "crop", used_crop_fallback: !!fellBack,
  /* _fellBack = !_calMode && limits.source !== "SOIL_PROFILE" (πυρήνας, γρ. ~11580) */
  source: fellBack ? "crop_generic" : "SOIL_PROFILE",
});
function pick(rows, v) { return (rows || []).find(r => r && r.variable === v); }
function textOf(r) { return (r && r.metadata && typeof r.metadata.text === "string") ? r.metadata.text : null; }

const CHECKS = [
  ["core: έκδοση ≥ v50.145 και T-TEXTDIET-01 παρόν", f => {
    const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /);
    return !!m && Number(m[1]) >= 145 && f.core.includes("T-TEXTDIET-01 (v50.145"); }],

  ["ΕΜΠΟΡΙΚΟ: το upgrade_opportunities ΔΕΝ μπαίνει πια στο bundle", f =>
    !/out\.push\(\{ variable: 'upgrade_opportunities'/.test(f.core)],
  ["ΕΜΠΟΡΙΚΟ: το κείμενο φυλάσσεται στο data και μετριέται", f =>
    f.core.includes("data._sagUpgradeReport = 'Το σύστημα λειτουργεί κανονικά")
    && f.core.includes("data._sagUpgradeCount = H.offers.length;")],
  ["ΕΜΠΟΡΙΚΟ: γράφεται ως ξεχωριστή μεταβλητή upgrade_report ΜΟΝΟ στο ημερήσιο tick", f => {
    const i = f.core.indexOf("if (dailyTich) {\n          try {\n            const _upTxt");
    const j = f.core.indexOf("variable: 'upgrade_report'");
    return i > 0 && j > i && j - i < 400; }],
  ["ΕΜΠΟΡΙΚΟ: η αποτυχία εγγραφής ΔΕΝ ρίχνει τον αγρό (catch με μήνυμα)", f =>
    /variable: 'upgrade_report'[\s\S]{0,400}catch \(_eUp\)[\s\S]{0,200}T-TEXTDIET-01/.test(f.core)],
  ["ΕΜΠΟΡΙΚΟ: η αναφορά κόβεται στα 900 χαρακτήρες (δεν γίνεται νέο βάρος)", f =>
    f.core.includes("String(_upTxt).slice(0, 900)")],

  ["ΟΡΙΑ: το ΚΑΤΩ όριο κρατά το κείμενο ακέραιο", f => {
    const g = build(f.core); if (!g) return false;
    const t = textOf(pick(g(LIM(false)), "soil_moisture_lower_limit"));
    return typeof t === "string" && t.length > 40 && /Όρια υγρασίας/.test(t); }],
  ["ΟΡΙΑ: το ΑΝΩ όριο ΔΕΝ κουβαλά πια κείμενο, αλλά κρατά τα υπόλοιπα metadata", f => {
    const g = build(f.core); if (!g) return false;
    const up = pick(g(LIM(false)), "soil_moisture_upper_limit");
    return !!up && textOf(up) === null && !("text" in (up.metadata || {}))
      && Object.keys(up.metadata || {}).length > 0; }],
  ["ΟΡΙΑ: το ΑΝΩ όριο κρατά τη σωστή ΤΙΜΗ (τίποτα δεν χάθηκε εκτός από το κείμενο)", f => {
    const g = build(f.core); if (!g) return false;
    const up = pick(g(LIM(false)), "soil_moisture_upper_limit");
    const lo = pick(g(LIM(false)), "soil_moisture_lower_limit");
    return up && lo && up.value === 17.25 && lo.value === 15.05; }],
  ["ΟΡΙΑ: το _metaNoText είναι ΑΝΤΙΓΡΑΦΟ — δεν σβήνει το κείμενο του κάτω ορίου", f => {
    const g = build(f.core); if (!g) return false;
    const rows = g(LIM(false));
    return textOf(pick(rows, "soil_moisture_lower_limit")) !== null
      && textOf(pick(rows, "soil_moisture_upper_limit")) === null; }],

  ["ΚΑΤΑΣΤΑΣΗ ΟΡΙΩΝ: στην ΕΠΙΤΥΧΙΑ σιωπά (η τιμή «Εντάξει» τα λέει όλα)", f => {
    const g = build(f.core); if (!g) return false;
    const st = pick(g(LIM(false)), "soil_moisture_limits_status");
    return st && st.value === "Εντάξει" && textOf(st) === null && st.metadata.color === "green"; }],
  ["ΚΑΤΑΣΤΑΣΗ ΟΡΙΩΝ: στην ΑΠΟΤΥΧΙΑ ΜΙΛΑΕΙ — εκεί λέει στον αγρότη τι να κάνει", f => {
    const g = build(f.core); if (!g) return false;
    const st = pick(g(LIM(true)), "soil_moisture_limits_status");
    const t = textOf(st);
    return st && st.metadata.color === "orange" && typeof t === "string"
      && /Δηλώστε τύπο εδάφους/.test(t); }],
  ["ΚΑΤΑΣΤΑΣΗ ΟΡΙΩΝ: η διαδρομή σφάλματος (limits.ok = false) μένει ΑΝΕΓΓΙΧΤΗ", f => {
    const g = build(f.core); if (!g) return false;
    const rows = g({ ok: false, error: "δοκιμή" });
    const st = pick(rows, "soil_moisture_limits_status");
    const pr = pick(rows, "soil_profile_status");
    return st && pr && st.value === "Μη διαθέσιμο" && textOf(st) === "δοκιμή"; }],

  ["ΔΕΝ πειράχτηκε το προοίμιο του crop_stage (τεκμηριωμένη διόρθωση v50.116)", f =>
    f.core.includes("'ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογία. '")],

  ["core: CRLF χωρίς BOM, node --check", f => {
    if (f.raw.charCodeAt(0) === 0xFEFF) return false;
    if ((f.raw.match(/\r\n/g) || []).length !== (f.raw.match(/\n/g) || []).length) return false;
    const t = join(tmpdir(), "textdiet_check_core.js"); writeFileSync(t, f.raw);
    try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } }],
];

const MUTATIONS = [
  ["το εμπορικό ξαναμπαίνει στο bundle", c => c.replace(
    "      data._sagUpgradeReport = 'Το σύστημα λειτουργεί κανονικά με ό,τι έχετε. Τα παρακάτω θα '",
    "      out.push({ variable: 'upgrade_opportunities', value: 1, metadata: {} });\n      data._sagUpgradeReport = 'Το σύστημα λειτουργεί κανονικά με ό,τι έχετε. Τα παρακάτω θα '")],
  ["η αναφορά γράφεται σε ΚΑΘΕ παλμό, όχι ημερήσια", c => c.replace(
    "        if (dailyTich) {\n          try {\n            const _upTxt", "        if (true) {\n          try {\n            const _upTxt")],
  ["η αναφορά δεν κόβεται πια στα 900", c => c.replace("String(_upTxt).slice(0, 900)", "String(_upTxt)")],
  ["το άνω όριο ξανακουβαλά το κείμενο", c => c.replace(
    'value: Number(limits.real_upper_limit.toFixed(2)), metadata: _metaNoText },',
    'value: Number(limits.real_upper_limit.toFixed(2)), metadata: metaBase },')],
  ["το _metaNoText σβήνει ΚΑΙ το κείμενο του κάτω ορίου (κοινή αναφορά)", c => c.replace(
    "  const _metaNoText = Object.assign({}, metaBase);\n  delete _metaNoText.text;",
    "  const _metaNoText = metaBase;\n  delete _metaNoText.text;")],
  ["η κατάσταση ορίων σιωπά ΚΑΙ στην αποτυχία", c => c.replace(
    "      metadata: _fellBack\n        ? { color: \"orange\",", "      metadata: false\n        ? { color: \"orange\",")],
  ["η κατάσταση ορίων ξαναμιλάει και στην επιτυχία", c => c.replace(
    '        : { color: "green" } },', '        : { color: "green", text: `Τα όρια υγρασίας υπολογίστηκαν από τον τύπο εδάφους και την καλλιέργεια.` } },')],
  ["κόπηκε το προοίμιο του crop_stage", c => c.replace(
    "'ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογία. '", "''")],
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
