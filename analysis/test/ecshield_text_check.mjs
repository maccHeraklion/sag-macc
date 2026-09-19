#!/usr/bin/env node
/* Ελεγκτής πυρήνα v50.144 · T-ECSHIELD-TEXT-01 — η ασπίδα καλύπτει ΚΑΙ τα κείμενα.
 * ΔΕΝ αρκεί αναζήτηση κειμένου: ο ελεγκτής ΑΝΑΠΑΡΑΓΕΙ τη σειρά θυσίας και των δύο φάσεων
 * (α: παλιά κείμενα · γ: φρέσκα κείμενα) με τους ΑΥΤΟΛΕΞΕΙ κανόνες του πυρήνα και ελέγχει
 * ότι τα soil_ec_status / salinity_stress φεύγουν ΤΕΛΕΥΤΑΙΑ, όχι πρώτα.
 *
 *   node analysis/test/ecshield_text_check.mjs            → έλεγχοι
 *   node analysis/test/ecshield_text_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };

/* Εξάγουμε ΑΥΤΟΛΕΞΕΙ τις τρεις λίστες και την ασπίδα, και τις εκτελούμε. */
function build(core) {
  const shield = slice(core, "const _SAG_BUNDLE_SHIELD = [", "_victims.sort(");
  const sortA = slice(core, "_victims.sort((a, b) =>", ";\n");
  const low = slice(core, "const _LOW_PRIORITY = [", "];");
  const act = slice(core, "const _ACTION_LAST = [", "];");
  const pri = slice(core, "pri: _never ? 3000", "len: v.metadata.text.length");
  if (!shield || !sortA || !low || !act || !pri) return null;
  const src = shield
    + "\nconst _victims = VICTIMS;\nconst _spent = (x) => x.spent;\n"
    + sortA + ";\n"
    + low + "];\n" + act + "];\n"
    + "function priOf(k, color) {\n"
    + "  const _pri = _LOW_PRIORITY.indexOf(k);\n"
    + "  const _isPatho = /^fir_message_/.test(k);\n"
    + "  const _act = _ACTION_LAST.indexOf(k) >= 0;\n"
    + "  const _never = ['sensor_faults'].indexOf(k) >= 0;\n"
    + "  const _c = String(color || '');\n"
    + "  const _risk = (_c === 'red') ? 400 : (_c === 'orange') ? 300 : (_c === 'yellow') ? 200 : 0;\n"
    + "  return " + pri.replace("pri:", "").trim().replace(/,$/, "") + ";\n}\n"
    + "return { shielded: _sagShielded, sortedVictims: _victims, priOf, LOW: _LOW_PRIORITY, ACT: _ACTION_LAST };";
  // τα θύματα της φάσης (α): ίδιο "spent"/μήκος, ώστε να κρίνει ΜΟΝΟ η ασπίδα
  const VICTIMS = [
    { k: "soil_ec_status", spent: 0.9, len: 300 },
    { k: "measurement_age", spent: 0.9, len: 300 },
    { k: "salinity_stress", spent: 0.9, len: 300 },
    { k: "forecast_status", spent: 0.9, len: 300 },
    { k: "fir_message_botrytis_cinerea", spent: 0.9, len: 300 },
  ];
  try { return new Function("VICTIMS", src)(VICTIMS); } catch (e) { return null; }
}
/* Σειρά θυσίας φρέσκων κειμένων: μικρότερο pri φεύγει ΠΡΩΤΟ (ίδια ταξινόμηση με τον πυρήνα). */
function freshOrder(g, keys) {
  return keys.map(k => ({ k, pri: g.priOf(k, "grey"), len: 300 }))
    .sort((a, b) => (a.pri - b.pri) || (b.len - a.len)).map(x => x.k);
}

const CHECKS = [
  ["core: έκδοση ≥ v50.144 και T-ECSHIELD-TEXT-01 παρόν", f => {
    const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /);
    return !!m && Number(m[1]) >= 144 && f.core.includes("T-ECSHIELD-TEXT-01 (v50.144"); }],
  ["core: η ασπίδα ορίζεται ΜΙΑ φορά και ΠΡΙΝ τη φάση (α)", f => {
    const d = (f.core.match(/const _SAG_BUNDLE_SHIELD = \[/g) || []).length;
    const s = (f.core.match(/const _sagShielded = /g) || []).length;
    return d === 1 && s === 1
      && f.core.indexOf("const _sagShielded = ") < f.core.indexOf("_victims.sort((a, b)"); }],
  ["ΑΣΠΙΔΑ: πιάνει soil_ec_status, salinity_stress, salinity_ks, fir_message_*, crop_stage", f => {
    const g = build(f.core); if (!g) return false;
    return ["soil_ec_status", "salinity_stress", "salinity_ks", "fir_message_botrytis_cinerea", "crop_stage", "harvest_index"]
      .every(k => g.shielded(k)); }],
  ["ΑΣΠΙΔΑ: ΔΕΝ πιάνει πληροφοριακά (measurement_age, forecast_status, soil_ph_status)", f => {
    const g = build(f.core); if (!g) return false;
    return ["measurement_age", "forecast_status", "soil_ph_status", "upgrade_opportunities"].every(k => !g.shielded(k)); }],
  ["ΦΑΣΗ (α) ΠΑΛΙΑ ΚΕΙΜΕΝΑ: με ΙΔΙΑ ηλικία και μήκος, τα ασπιδοφόρα πάνε ΤΕΛΕΥΤΑΙΑ", f => {
    const g = build(f.core); if (!g) return false;
    const order = g.sortedVictims.map(v => v.k);
    const iEc = order.indexOf("soil_ec_status"), iSal = order.indexOf("salinity_stress");
    const iAge = order.indexOf("measurement_age"), iFc = order.indexOf("forecast_status");
    return iAge < iEc && iAge < iSal && iFc < iEc && iFc < iSal; }],
  ["ΦΑΣΗ (γ) ΦΡΕΣΚΑ ΚΕΙΜΕΝΑ: soil_ec_status/salinity_stress ΔΕΝ είναι πια χαμηλής προτεραιότητας", f => {
    const g = build(f.core); if (!g) return false;
    return g.LOW.indexOf("soil_ec_status") < 0 && g.LOW.indexOf("salinity_stress") < 0
      && g.ACT.indexOf("soil_ec_status") >= 0 && g.ACT.indexOf("salinity_stress") >= 0; }],
  ["ΦΑΣΗ (γ): η ετυμηγορία αλατότητας θυσιάζεται ΜΕΤΑ από κάθε πληροφοριακό κείμενο", f => {
    const g = build(f.core); if (!g) return false;
    const o = freshOrder(g, ["forecast_status", "measurement_age", "upgrade_opportunities",
      "soil_ph_status", "soil_ec_status", "salinity_stress", "sensor_redundancy"]);
    const iEc = o.indexOf("soil_ec_status"), iSal = o.indexOf("salinity_stress");
    return ["forecast_status", "measurement_age", "upgrade_opportunities", "soil_ph_status", "sensor_redundancy"]
      .every(k => o.indexOf(k) < iEc && o.indexOf(k) < iSal); }],
  ["ΦΑΣΗ (γ): παίρνει την ΙΔΙΑ προτεραιότητα με τα μηνύματα δράσης (2500), όχι 999", f => {
    const g = build(f.core); if (!g) return false;
    return g.priOf("soil_ec_status", "grey") === 2500 && g.priOf("salinity_stress", "grey") === 2500
      && g.priOf("root_zone_basis", "grey") !== 2500; }],
  ["ΦΑΣΗ (γ): η κάρτα βλαβών (3000) παραμένει ΠΑΝΩ από την ετυμηγορία — καμία ανατροπή", f => {
    const g = build(f.core); if (!g) return false;
    return g.priOf("sensor_faults", "grey") === 3000 && g.priOf("sensor_faults", "grey") > g.priOf("soil_ec_status", "grey"); }],
  ["ΦΑΣΗ (γ): το soil_ph_status ΜΕΝΕΙ χαμηλής προτεραιότητας (είναι πληροφοριακό)", f => {
    const g = build(f.core); if (!g) return false;
    return g.LOW.indexOf("soil_ph_status") >= 0 && g.priOf("soil_ph_status", "grey") < 999; }],
  ["ΦΑΣΗ (γ): κόκκινο παθογόνο (2400) παραμένει ΚΑΤΩ από την ετυμηγορία δράσης", f => {
    const g = build(f.core); if (!g) return false;
    return g.priOf("fir_message_botrytis_cinerea", "red") === 2400
      && g.priOf("fir_message_botrytis_cinerea", "red") < g.priOf("soil_ec_status", "grey"); }],
  ["core: CRLF χωρίς BOM, node --check", f => {
    if (f.raw.charCodeAt(0) === 0xFEFF) return false;
    if ((f.raw.match(/\r\n/g) || []).length !== (f.raw.match(/\n/g) || []).length) return false;
    const t = join(tmpdir(), "ecshield_check_core.js"); writeFileSync(t, f.raw);
    try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } }],
];

const MUTATIONS = [
  ["η ασπίδα φεύγει από τη σειρά των παλιών κειμένων", c => c.replace(
    "_victims.sort((a, b) => ((_sagShielded(a.k) ? 1 : 0) - (_sagShielded(b.k) ? 1 : 0))\n      || (_spent(b) - _spent(a)) || (b.len - a.len));",
    "_victims.sort((a, b) => (_spent(b) - _spent(a)) || (b.len - a.len));")],
  ["τα δύο κλειδιά ξαναμπαίνουν στη χαμηλή προτεραιότητα", c => c.replace(
    "      const _LOW_PRIORITY = ['forecast_status',\n        'soil_ph_status',",
    "      const _LOW_PRIORITY = ['forecast_status',\n        'soil_ec_status', 'soil_ph_status', 'salinity_stress',")],
  ["τα δύο κλειδιά φεύγουν από την ομάδα δράσης", c => c.replace(
    "        'soil_ec_status', 'salinity_stress'];", "        ];")],
  ["η ασπίδα δεν πιάνει πια το soil_ec_status", c => c.replace("/^soil_ec_status$/, /^salinity_/,", "/^salinity_/,")],
  ["η ασπίδα δεν πιάνει πια την αλατότητα", c => c.replace("/^soil_ec_status$/, /^salinity_/,", "/^soil_ec_status$/,")],
  ["η κάρτα βλαβών χάνει τη δική της βαθμίδα", c => c.replace("pri: _never ? 3000", "pri: _never ? 100")],
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
