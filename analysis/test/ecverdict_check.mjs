#!/usr/bin/env node
/* Ελεγκτής v50.142 · T-ECRATIO-01 + T-ECVERDICT-01 (Φάση Α, βήματα Α4 + Α5): R/CF/φρουρός/τάση και ΜΙΑ ημερήσια
 * ετυμηγορία από την προ-αρδευτική αναφορά· ωριαίες κάρτες πληροφοριακές· πύλη νεκρού οργάνου και στο ημερήσιο (Κ5).
 *
 *   node analysis/test/ecverdict_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ της _sagEcDailyVerdict αυτούσιας
 *   node analysis/test/ecverdict_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const lf = (s) => s.replace(/\r\n/g, "\n");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };

function build(core) {
  const src = slice(core, "const _SAG_ECR_ZONES = [", "// ── End T-ECRATIO-01 / T-ECVERDICT-01");
  if (!src) return null;
  return new Function(src + "\nreturn { verdict: _sagEcDailyVerdict, zone: _sagEcZoneR };")();
}
const base = (o = {}) => ({ e1: 400, e2: 300, ref1: 2.4, ref2: 2.0, fert: 3.0, ecw: 0.8, eceMax: 2.5, eceEst: 1.2, eceHow: " (Hilhorst)",
  dead: false, refHist: [], today: "2026-09-19", valTxt: "ρηχό 400 · βαθύ 300 µS/cm", ...o });
const get = (out, v) => out.find(x => x.variable === v);
const hist7 = (vals) => vals.map((r, i) => ({ d: "2026-09-1" + i, r }));

const CHECKS = [
  ["core: έκδοση ≥ v50.142", f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 142; }],
  ["core: helper μία φορά, καλείται από το ημερήσιο μπλοκ με την αναφορά (_refOfE) και την πύλη νεκρού (_deadDaily)", f =>
    (f.core.match(/function _sagEcDailyVerdict\(/g) || []).length === 1 && f.core.includes("_ecphIndicators.push(..._sagEcDailyVerdict({")
    && f.core.includes("dead: _deadDaily, refHist: _refHistE, today: _todayE, valTxt: _valTxt }));")],
  ["core: το Ks (T-SALT-KS-01) δεν βγαίνει από νεκρό όργανο", f => f.core.includes("if (Number.isFinite(_eceMax) && e1 !== null && !_deadDaily) {")],
  ["core: η παλιά ετυμηγορία από τάσεις bulk (Συσσώρευση από t1 > 25 και e1 ≥ 800) ΔΕΝ υπάρχει πια", f => !f.core.includes("if (t1 !== null && t1 > 25 && e1 !== null && e1 >= 800) {")],
  ["core: ωριαία soil_ece γκρι, χωρίς «ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ»· soil_salinity_status «Στιγμιαία ένδειξη» γκρι· ο κλάδος T-ECDEAD μένει", f =>
    !f.core.includes("' — ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ, χρειάζεται έκπλυση.'") && f.core.includes("value: 'Στιγμιαία ένδειξη',")
    && f.core.includes("out.push({ variable: 'soil_salinity_status', value: 'Το όργανο δεν μετράει',") && !f.core.includes("? 'Υψηλή αλατότητα'")],
  ["core: κατάσταση ec_ref_hist αθάνατη· soil_ec_ratio/conc στις σειρές· ημερήσιο TTL για soil_ec_ref/ratio/conc", f =>
    /\/\^ec_ref_hist\$\/,/.test(f.core) && /_SAG_SERIES_KEYS = \[[^\]]*'soil_ec_ratio', 'soil_ec_conc'\]/.test(f.core)
    && /\[\/\^soil_ec_ref\/,\s+_SAG_TTL_DAILY_H\]/.test(f.core) && /\[\/\^soil_ec_ratio\$\/,\s+_SAG_TTL_DAILY_H\]/.test(f.core)],
  ["core: καθαρό CRLF, χωρίς BOM", f => !f.coreRaw.startsWith("﻿") && (f.coreRaw.match(/\n/g) || []).length === (f.coreRaw.match(/\r\n/g) || []).length],
  ["ζώνες R: 0,5 → ξεπλένονται θρεπτικά · 1,0 → στόχος · 1,7 → παρακολούθηση · 2,5 → συσσώρευση", f => {
    const g = build(f.core); if (!g) return false; return g.zone(0.5) === "ξεπλένονται θρεπτικά" && g.zone(1.0) === "στόχος" && g.zone(1.7) === "παρακολούθηση" && g.zone(2.5) === "συσσώρευση"; }],
  ["Γρινιαράκης: ref 2,4/2,0, λίπασμα 3, νερό 0,8 → R 0,80 «στόχος», CF 3,0, «Χωρίς συσσώρευση» πράσινο, χωρίς φρουρό", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base());
    const r = get(out, "soil_ec_ratio"), c = get(out, "soil_ec_conc"), st = get(out, "soil_ec_status");
    return r && r.value === 0.8 && r.metadata.zone === "στόχος" && c && c.value === 3 && st && st.value === "Χωρίς συσσώρευση" && st.metadata.color === "green" && /Μη βαθμονομημένο/.test(st.metadata.text); }],
  ["το χειρότερο βάθος κρίνει: ref1 2,4 / ref2 5,2 → R 1,73 «Παρακολούθηση» πορτοκαλί", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base({ ref2: 5.2 }));
    return get(out, "soil_ec_ratio").value === 1.73 && get(out, "soil_ec_status").value === "Παρακολούθηση" && get(out, "soil_ec_status").metadata.color === "orange"; }],
  ["R ≥ 2 → «Συσσώρευση αλάτων» κόκκινο (ref 6,0 σε 3,0)· φρουρός ΔΕΝ ανάβει (6,0 = 2× max)", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base({ ref1: 6.0, ref2: 5.0 }));
    return get(out, "soil_ec_status").value === "Συσσώρευση αλάτων" && get(out, "soil_ec_status").metadata.color === "red" && get(out, "soil_ec_ratio").value === 2; }],
  ["φρουρός: ref 0,4 < 0,7·0,8 → soil_ec_ratio null + «Ελέγξτε τις δηλώσεις EC» πορτοκαλί· ref 7 > 2·3 → το ίδιο", f => {
    const g = build(f.core); if (!g) return false;
    const a = g.verdict(base({ ref1: 0.4, ref2: 0.3 })), b = g.verdict(base({ ref1: 7, ref2: 2 }));
    return get(a, "soil_ec_ratio").value === null && get(a, "soil_ec_status").value === "Ελέγξτε τις δηλώσεις EC" && get(a, "soil_ec_status").metadata.color === "orange"
      && get(b, "soil_ec_status").value === "Ελέγξτε τις δηλώσεις EC" && !get(b, "soil_ec_conc"); }],
  ["χωρίς λίπασμα: «Χωρίς δήλωση λίπανσης» γκρι, CF βγαίνει, R όχι", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base({ fert: null }));
    return get(out, "soil_ec_status").value === "Χωρίς δήλωση λίπανσης" && !get(out, "soil_ec_ratio") && get(out, "soil_ec_conc").value === 3; }],
  ["χωρίς αναφορά ακόμη (πρώτο παράθυρο): «Αναμονή αναφοράς» γκρι, χωρίς R/CF, χωρίς δακτύλιο", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base({ ref1: null, ref2: null }));
    return get(out, "soil_ec_status").value === "Αναμονή αναφοράς" && !get(out, "soil_ec_ratio") && !get(out, "ec_ref_hist"); }],
  ["νεκρό όργανο (Κ5): «Το όργανο δεν μετράει» γκρι + salinity_stress «Μη διαθέσιμο», ΤΙΠΟΤΑ άλλο", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base({ dead: true }));
    return out.length === 2 && get(out, "soil_ec_status").value === "Το όργανο δεν μετράει" && get(out, "salinity_stress").value === "Μη διαθέσιμο" && !get(out, "soil_ec_ratio"); }],
  ["όριο καλλιέργειας υπερισχύει: ECe 3,1 > 2,5 → «Πάνω από το όριο της καλλιέργειας» κόκκινο, ακόμη κι αν R = 0,8", f => {
    const g = build(f.core); if (!g) return false; const out = g.verdict(base({ eceEst: 3.1 }));
    return get(out, "soil_ec_status").value === "Πάνω από το όριο της καλλιέργειας" && get(out, "soil_ec_status").metadata.color === "red"; }],
  ["δακτύλιος: 7 παλιές ημέρες + σήμερα → 8 εγγραφές, η σημερινή τελευταία· τάση = μέσος 3 τελευταίων vs 3 προηγούμενων (+25 %)", f => {
    const g = build(f.core); if (!g) return false;
    const out = g.verdict(base({ ref1: 2.5, ref2: 2.0, refHist: hist7([2.0, 2.0, 2.0, 2.0, 2.0, 2.5, 2.5]) }));
    const h = JSON.parse(get(out, "ec_ref_hist").value); const st = get(out, "soil_ec_status");
    return h.length === 8 && h[7].d === "2026-09-19" && h[7].r === 2.5 && /Τάση 7ημ \+25 %/.test(st.metadata.text); }],
  ["δακτύλιος: η ίδια ημέρα δεν διπλογράφεται· < 6 τιμές → χωρίς τάση", f => {
    const g = build(f.core); if (!g) return false;
    const out = g.verdict(base({ refHist: [{ d: "2026-09-19", r: 9 }, { d: "2026-09-18", r: 2.1 }] }));
    const h = JSON.parse(get(out, "ec_ref_hist").value);
    return h.length === 2 && h.filter(x => x.d === "2026-09-19").length === 1 && h[1].r === 2.4 && !/Τάση/.test(get(out, "soil_ec_status").metadata.text); }],
];

const MUTATIONS = [
  ["ζώνη 1,5 → 15", c => c.replace("[1.5, 'στόχος'], [2.0, 'παρακολούθηση']", "[15, 'στόχος'], [20, 'παρακολούθηση']")],
  ["το ρηχό αντί για το χειρότερο βάθος", c => c.replace("const refF = hasRef ? Math.max(...refs) : NaN;", "const refF = hasRef ? refs[0] : NaN;")],
  ["φρουρός χαλαρός (0,07× / 20×)", c => c.replace("((Number.isFinite(lo) && refF < 0.7 * lo) || (Number.isFinite(hi) && refF > 2.0 * hi))", "((Number.isFinite(lo) && refF < 0.07 * lo) || (Number.isFinite(hi) && refF > 20 * hi))")],
  ["R ≥ 2 δεν είναι κόκκινο", c => c.replace("else st = { v: 'Συσσώρευση αλάτων', c: 'red',", "else st = { v: 'Συσσώρευση αλάτων', c: 'orange',")],
  ["νεκρό όργανο συνεχίζει στην κρίση", c => c.replace("  if (a.dead) {\n    out.push({ variable: 'soil_ec_status', value: 'Το όργανο δεν μετράει',", "  if (false) {\n    out.push({ variable: 'soil_ec_status', value: 'Το όργανο δεν μετράει',")],
  ["το όριο καλλιέργειας δεν υπερισχύει", c => c.replace("if (Number.isFinite(a.eceMax) && Number.isFinite(a.eceEst) && a.eceEst > a.eceMax) {", "if (false) {")],
  ["τάση από 2 αντί 3 ημέρες", c => c.replace("const n = xs.length, b = (xs[n - 1] + xs[n - 2] + xs[n - 3]) / 3, p = (xs[n - 4] + xs[n - 5] + xs[n - 6]) / 3;", "const n = xs.length, b = (xs[n - 1] + xs[n - 2]) / 2, p = (xs[n - 3] + xs[n - 4]) / 2;")],
  ["το Ks βγαίνει και από νεκρό όργανο", c => c.replace("if (Number.isFinite(_eceMax) && e1 !== null && !_deadDaily) {", "if (Number.isFinite(_eceMax) && e1 !== null) {")],
  ["η ωριαία κάρτα ξανακρίνει", c => c.replace("value: 'Στιγμιαία ένδειξη',", "value: 'Φυσιολογική',")],
  ["έκδοση πίσω", c => c.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · [^']+';/, "const SAG_KERNEL_VERSION = 'v50.141 · 2026-09-19';")],
];

function load(t) { return { core: lf(t), coreRaw: t }; }
function run(f) { let ok = 0, bad = 0; for (const [n, x] of CHECKS) { let r = false; try { r = !!x(f); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
const coreRaw = readFileSync(CORE, "utf8");
if (process.argv.includes("--mutate")) {
  const b0 = run(load(coreRaw)); if (b0.bad) { console.log(`Βάση: ${b0.ok} OK · ${b0.bad} X`); process.exit(1); }
  let killed = 0;
  for (const [n, mut] of MUTATIONS) {
    const m = mut(lf(coreRaw)).replace(/\n/g, "\r\n");
    if (m === coreRaw) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + n); continue; }
    const r = run(load(m)); if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad}): ${n}`); } else console.log("  ✘ ΕΠΕΖΗΣΕ: " + n);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`); process.exit(killed === MUTATIONS.length ? 0 : 1);
} else { const r = run(load(coreRaw)); console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`); process.exit(r.bad ? 1 : 0); }
