// Ελεγκτής v50.150 · T-SOILCAL-02 (a+b) + T-COVERED-ANOM-01.
// Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα του πυρήνα (εξαγωγή με ταίριασμα αγκυλών), όχι αντίγραφο.
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.join(here, "..", "runPerTich.js");
const raw = fs.readFileSync(CORE, "utf8");
if (raw.includes("\n") && !raw.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = raw.replace(/\r\n/g, "\n");

function extractBlock(text, startMarker) {
  const i = text.indexOf(startMarker);
  if (i < 0) throw new Error("δεν βρέθηκε: " + startMarker);
  const open = text.indexOf("{", i + startMarker.length - 1);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const ch = text[k];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(i, k + 1); }
  }
  throw new Error("άνοιγμα χωρίς κλείσιμο: " + startMarker);
}

function buildScUpd(text) {
  const block = extractBlock(text, "const _scUpd = (st, cur, rng) => {");
  const body = block.replace(/^const _scUpd = /, "");
  const _scPlaus = (v) => Number.isFinite(v) && v >= 0.5 && v <= 60;
  const _scR2 = (x) => Math.round(x * 100) / 100;
  const mk = new Function("_scPlaus", "_scR2", "_scDayNum", "return " + body);
  return { at: (d) => mk(_scPlaus, _scR2, d) };
}

function buildMismatch(text) {
  const a = text.indexOf("const _omrP = crop?.optimal_moisture_range");
  const b = text.indexOf("M_wilt - 3);", a);
  if (a < 0 || b < 0) throw new Error("μπλοκ ασυμφωνίας δεν βρέθηκε");
  const src = text.slice(a, b + "M_wilt - 3);".length);
  return new Function("crop", "parameters", "M_wilt", "_tawT", "_fcE", "_floorE",
    src + "\nreturn { _mismatch, _refillT };");
}

function run(text) {
  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };

  // ── Α. καλωδίωση ──
  ok(text.includes("const SAG_KERNEL_VERSION = 'v50.150 · 2026-09-24';"), "έκδοση v50.150");
  ok((text.match(/if \(_cpProf && !fieldConfig\?\.covered_cultivation\) \{/g) || []).length === 1, "πύλη καλύμματος στο _anomDays");
  ok(text.includes("st.e = _wet ? 1 : 0;"), "st.e από _wet");
  ok(text.includes("const _lowSide = !rng || (cur <= rng.mn + 0.35 * (rng.mx - rng.mn));"), "_lowSide");
  ok(text.includes("const _mismatch = (_fcE < _refillT)"), "_mismatch από _refillT");

  // ── Β. συμπεριφορά _scUpd ──
  let U;
  try { U = buildScUpd(text); } catch (e) { failures.push("εξαγωγή _scUpd: " + e.message); return failures; }
  // Β1 · κύκλος 5 ημερών (παλιά διαδρομή): δάπεδο 20, υγρή μέρα, μετά στεγνή -> 1 δείγμα
  {
    let st = { w: 20, l: 20.5, k: 20700 };
    st = U.at(20701)(st, 26, { mn: 20, mx: 34 });
    ok(st.e === 1 && st.n === undefined, "Β1 υγρή μέρα: e=1, χωρίς δείγμα");
    st = U.at(20702)(st, 28.5, { mn: 28.0, mx: 29.0 });
    ok(st.e === 0 && st.n === 1 && st.f === 28.5, "Β1 στεγνή μετά από υγρή: δείγμα f=28,5 n=1 e=0 (ίδιο με πριν)");
  }
  // Β2 · καθημερινή στάγδην (Κουτσάκης): πλατό στο κάτω τρίτο ΚΑΘΕ υγρής μέρας -> n αυξάνει
  {
    let st = { w: 28.2, l: 28.4, k: 20700 };
    st = U.at(20701)(st, 28.5, { mn: 28.2, mx: 33.5 });
    ok(st.e === 1 && st.n === undefined, "Β2 ημέρα 1: e=1, χωρίς δείγμα");
    st = U.at(20702)(st, 28.6, { mn: 28.3, mx: 34.0 });
    ok(st.n === 1 && Math.abs(st.f - 28.6) < 1e-9 && st.e === 1, "Β2 ημέρα 2: δείγμα f=28,6 n=1 e=1");
    st = U.at(20703)(st, 28.7, { mn: 28.2, mx: 44.8 });
    ok(st.n === 2 && st.e === 1 && st.f > 28.6 && st.f < 28.7, "Β2 ημέρα 3: n=2, f=EMA");
  }
  // Β3 · νυχτερινό πότισμα: η ένδειξη του tick είναι η ΚΟΡΥΦΗ -> ΟΧΙ δείγμα
  {
    let st = { w: 28.2, l: 28.4, k: 20700, e: 1 };
    st = U.at(20701)(st, 33.5, { mn: 28.0, mx: 34.0 });
    ok(st.n === undefined && st.e === 1, "Β3 κορυφή: κανένα δείγμα");
  }
  // Β4 · ίδια ημέρα: καμία διπλή ενημέρωση
  {
    const st = { w: 28.2, l: 28.4, k: 20701, e: 1 };
    const st2 = U.at(20701)(st, 28.6, { mn: 28.3, mx: 34.0 });
    ok(st2.n === undefined && st2.l === 28.4, "Β4 ίδια ημέρα: αμετάβλητο");
  }
  // Β5 · στεγνή μέρα μετά από υγρή αλλά ένδειξη στο δάπεδο -> κανένα δείγμα (παλιά συμπεριφορά)
  {
    let st = { w: 28.2, l: 28.4, k: 20700, e: 1 };
    st = U.at(20701)(st, 28.3, { mn: 28.1, mx: 28.4 });
    ok(st.n === undefined && st.e === 0, "Β5 στεγνή στο δάπεδο: χωρίς δείγμα, e=0");
  }

  // ── Γ. κριτήριο ασυμφωνίας ──
  let M;
  try { M = buildMismatch(text); } catch (e) { failures.push("εξαγωγή ασυμφωνίας: " + e.message); return failures; }
  const crop = { optimal_moisture_range: { lower_bound: 55, upper_bound: 75 } };
  let r = M(crop, { stage: "initial" }, 21, 17, 28.5, 25.3);
  ok(r._mismatch === true && Math.abs(r._refillT - 30.35) < 1e-9, "Γ1 Κουτσάκης: πλατό 28,5 < επαναπλήρωση 30,35 -> ασυμφωνία");
  r = M(crop, { stage: "initial" }, 21, 17, 36, 25.3);
  ok(r._mismatch === false, "Γ2 σωστό έδαφος: καμία ασυμφωνία");
  ok(!(28.5 < 21 + 0.25 * 17), "Γ3 το παλιό κριτήριο δεν έπιανε τον Κουτσάκη (τεκμηρίωση)");
  const cropS = { optimal_moisture_range: { default: { lower_bound: 55, upper_bound: 75 }, stages: { fruiting: { lower_bound: 70, upper_bound: 85 } } } };
  r = M(cropS, { stage: "fruiting" }, 21, 17, 32, 25);
  ok(r._mismatch === true && Math.abs(r._refillT - 32.9) < 1e-9, "Γ4 στάδιο fruiting: επαναπλήρωση 32,9");
  r = M(cropS, { stage: "initial" }, 21, 17, 32, 25);
  ok(r._mismatch === false, "Γ5 στάδιο χωρίς band -> default 55 % -> 30,35 < 32 -> όχι");
  r = M({}, {}, 21, 17, 24, 25);
  ok(r._mismatch === true && Math.abs(r._refillT - 25.25) < 1e-9, "Γ6 χωρίς band: εφεδρεία 25 %");
  r = M(crop, {}, 21, 17, 36, 17.5);
  ok(r._mismatch === true, "Γ7 δάπεδο < WP−3");

  // ── Δ. πύλη καλύμματος (η ίδια η έκφραση) ──
  const cond = new Function("_cpProf", "fieldConfig", "return (_cpProf && !fieldConfig?.covered_cultivation);");
  ok(cond({}, { covered_cultivation: true }) === false, "Δ1 καλυμμένη -> σιωπή");
  ok(cond({}, { covered_cultivation: false }) === true, "Δ2 υπαίθρια -> υπολογισμός");
  ok(cond({}, undefined) === true, "Δ3 χωρίς ρύθμιση -> υπολογισμός");
  return failures;
}

const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");

const MUT = [
  ["m1 χωρίς δειγματοληψία σε υγρή μέρα", "(_wet ? _lowSide : (cur >= st.w + 0.8))", "(cur >= st.w + 0.8)"],
  ["m2 _lowSide πάντα αληθές", "const _lowSide = !rng || (cur <= rng.mn + 0.35 * (rng.mx - rng.mn));", "const _lowSide = true;"],
  ["m3 e πάντα 1", "st.e = _wet ? 1 : 0;", "st.e = 1;"],
  ["m4 παλιό κριτήριο ασυμφωνίας", "const _mismatch = (_fcE < _refillT)", "const _mismatch = (_fcE < M_wilt + 0.25 * _tawT)"],
  ["m5 χωρίς πύλη καλύμματος", "if (_cpProf && !fieldConfig?.covered_cultivation) {", "if (_cpProf) {"],
  ["m6 κάτω τρίτο -> όλο το εύρος", "0.35 * (rng.mx - rng.mn)", "1.0 * (rng.mx - rng.mn)"],
  ["m7 παλιά έκδοση", "'v50.150 · 2026-09-24'", "'v50.149 · 2026-09-20'"],
  ["m8 στάδιο αγνοείται", "? _omrP.stages[_stP]\n", "? _omrP.default\n"],
  ["m9 μετρητής δειγμάτων παγωμένος", "st.n = (st.n || 0) + 1;", "st.n = (st.n || 0);"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  if (!SRC.includes(a)) { console.log("ΜΕΤΑΛΛΑΞΗ ΑΝΕΦΑΡΜΟΣΤΗ (δεν βρέθηκε το κείμενο): " + name); process.exit(1); }
  const mutated = SRC.replace(a, b);
  let f;
  try { f = run(mutated); } catch (e) { f = ["εξαίρεση: " + e.message]; }
  if (f.length) { killed++; console.log("  σκοτώθηκε  " + name + "  <- " + f[0]); }
  else { console.log("  ΕΠΕΖΗΣΕ    " + name); }
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ: " + killed + "/" + MUT.length + " σκοτώθηκαν");
process.exit(killed === MUT.length ? 0 : 1);
