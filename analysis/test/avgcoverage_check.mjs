// Ελεγκτής v50.153 · T-AVG-COVERAGE-01 — οι 24ωροι μέσοι δηλώνουν κάλυψη και δεν τρέφουν
// υπολογισμό χωρίς αυτήν. Τρέχει τους ΠΡΑΓΜΑΤΙΚΟΥΣ βοηθούς του πυρήνα και ελέγχει την
// καλωδίωση σε κάθε πύλη. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
if (raw.includes("\n") && !raw.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = raw.replace(/\r\n/g, "\n");

function fnText(text, name) {
  const m = text.indexOf("function " + name + "(");
  if (m < 0) throw new Error("δεν βρέθηκε " + name);
  const open = text.indexOf("{", m); let d = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === "{") d++; else if (text[k] === "}") { d--; if (d === 0) return text.slice(m, k + 1); }
  }
  throw new Error("άνοιγμα χωρίς κλείσιμο: " + name);
}
function build(text) {
  const n = text.match(/const _SAG_AVG_MIN_N = ([0-9.]+);/), h = text.match(/const _SAG_AVG_MIN_SPAN_H = ([0-9.]+);/);
  if (!n || !h) throw new Error("κατώφλια πύλης δεν βρέθηκαν");
  const src = `const _SAG_AVG_MIN_N = ${n[1]}; const _SAG_AVG_MIN_SPAN_H = ${h[1]};\n`
    + fnText(text, "_sagAvgCov") + "\n" + fnText(text, "_sagAvgGate") + "\n" + fnText(text, "_sagAvgCovIndicators")
    + "\nreturn { _sagAvgCov, _sagAvgGate, _sagAvgCovIndicators, N: _SAG_AVG_MIN_N, H: _SAG_AVG_MIN_SPAN_H };";
  return new Function(src)();
}

function run(text) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  ok(text.includes("const SAG_KERNEL_VERSION = 'v50.155 · 2026-09-24';"), "έκδοση v50.154");
  // καλωδίωση: επτά πύλες (κόμη T+RH, σταθμός T+RH, έδαφος se0x βρόχος, lse01 υγρασία + θερμοκρασία)
  const gates = (text.match(/_sagAvgGate\(data, _inv, info\?\.name \|\| value, /g) || []).length;
  ok(gates === 7, "7 πύλες _sagAvgGate (βρέθηκαν " + gates + ")");
  ok(text.includes("if (!_sagAvgGate(data, _inv, info?.name || value, _SOIL_AVG_CH[_i])) continue;"), "πύλη εδάφους se0x/lse02 στον βρόχο");
  ok(text.includes("_okAirT &&\n          (deviceData.air_temperature_avg === null ||"), "πύλη σταθμού στον μέσο");
  ok(text.includes("_okAirT &&\n          (deviceData.air_temperature_max === null ||"), "πύλη σταθμού στο μέγιστο");
  ok(text.includes("_okAirT &&\n          (deviceData.air_temperature_min === null ||"), "πύλη σταθμού στο ελάχιστο");
  ok(text.includes("if (_okAirRH && Number.isFinite(Number(avgRhArr?.[0]?.value))) {"), "πύλη σταθμού στην υγρασία");
  ok(text.includes("if (_okCanT && avgMap.temperature &&") && text.includes("if (_okCanRH && rhAvgMap.humidity &&"), "πύλες κόμης");
  ok(text.includes("..._sagAvgCovIndicators(measurements?.data),"), "ο δείκτης avg_window_status εκπέμπεται");
  let B; try { B = build(text); } catch (e) { f.push("εξαγωγή: " + e.message); return f; }
  // ── συμπεριφορά ──
  ok(B.N === 6 && B.H === 6, "κατώφλια πύλης 6 μετρήσεις / 6 ώρες (δηλωμένα στο DEPLOY_LOG)");
  ok(B._sagAvgCov(null) === null && B._sagAvgCov({}) === null && B._sagAvgCov({ n: "x", spanH: 2 }) === null, "Α1 άγνωστη κάλυψη -> null (δεν κρίνει)");
  ok(B._sagAvgCov({ n: 70, spanH: 23.66 }).ok === true, "Α2 Κουτσάκης 70/23,7 ω -> ΟΚ");
  ok(B._sagAvgCov({ n: 3, spanH: 20 }).ok === false, "Α3 3 μετρήσεις -> όχι");
  ok(B._sagAvgCov({ n: 40, spanH: 4 }).ok === false, "Α4 4 ώρες κάλυψης -> όχι");
  ok(B._sagAvgCov({ n: 6, spanH: 6 }).ok === true, "Α5 ακριβώς στο όριο -> ΟΚ");
  const data = {};
  const inv = { stats: { soil_moisture1: { n: 70, spanH: 23.7 }, soil_moisture2: { n: 2, spanH: 23.7 }, air_temperature: { n: 288, spanH: 3.5 } } };
  ok(B._sagAvgGate(data, inv, "se0x_A", "soil_moisture1") === true, "Β1 πύλη ανοίγει με κάλυψη");
  ok(B._sagAvgGate(data, inv, "se0x_A", "soil_moisture2") === false, "Β2 πύλη κλείνει με 2 μετρήσεις");
  ok(B._sagAvgGate(data, inv, "s2120_B", "air_temperature") === false, "Β3 πύλη κλείνει με 3,5 ώρες");
  ok(B._sagAvgGate(data, inv, "s2120_B", "air_temperature") === false, "Β3β δεύτερο πέρασμα (T-REMERGE-01) ίδια κρίση");
  ok(B._sagAvgGate(data, { stats: {} }, "νέος", "temperature") === true && B._sagAvgGate(data, null, "χωρίς", "humidity") === true, "Β4 άγνωστη κάλυψη -> ανοιχτή (πρώτη εγκατάσταση)");
  ok(Array.isArray(data._sagAvgCov) && data._sagAvgCov.length === 6, "Β5 κάθε κρίση καταγράφεται");
  const ind = B._sagAvgCovIndicators(data);
  ok(ind.length === 1 && ind[0].variable === "avg_window_status" && ind[0].metadata.color === "orange", "Γ1 ελλιπή -> πορτοκαλί");
  ok(ind[0].value === "Ελλιπή 24ωρα: 2 από 3 μεγέθη", "Γ2 πλήθος: 2 από 3 (τα άγνωστα δεν μετρούν, το διπλό πέρασμα αφαιρείται) — " + ind[0].value);
  ok(/soil_moisture2 \(se0x_A\): 2 μετρήσεις σε 23\.7 ώρες/.test(ind[0].metadata.text) && /air_temperature \(s2120_B\): 288 μετρήσεις σε 3\.5 ώρες/.test(ind[0].metadata.text), "Γ3 το κείμενο λέει ποιο μέγεθος, πόσες μετρήσεις, πόσες ώρες");
  ok(/όριο 6 μετρήσεις σε 6 ώρες/.test(ind[0].metadata.text) && /ΑΓΝΟΗΘΗΚΕ/.test(ind[0].metadata.text), "Γ4 το κείμενο δηλώνει το όριο και τη συνέπεια");
  const d2 = {}; B._sagAvgGate(d2, inv, "se0x_A", "soil_moisture1"); B._sagAvgGate(d2, null, "x", "y");
  const ind2 = B._sagAvgCovIndicators(d2);
  ok(ind2.length === 1 && ind2[0].metadata.color === "green" && ind2[0].value === "Πλήρη 24ωρα · 1 μεγέθη" && ind2[0].metadata.text === undefined, "Γ5 όλα ΟΚ -> πράσινο, χωρίς κείμενο (TEXTDIET)");
  ok(B._sagAvgCovIndicators({}).length === 0 && B._sagAvgCovIndicators({ _sagAvgCov: [{ dev: "a", v: "b", ok: null }] }).length === 0, "Γ6 χωρίς γνωστή κάλυψη -> σιωπή");
  return f;
}

const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 παλιά έκδοση", "'v50.155 · 2026-09-24'", "'v50.154 · 2026-09-24'"],
  ["m2 όριο μετρήσεων 0", "const _SAG_AVG_MIN_N = 6;", "const _SAG_AVG_MIN_N = 0;"],
  ["m3 όριο ωρών 0", "const _SAG_AVG_MIN_SPAN_H = 6;", "const _SAG_AVG_MIN_SPAN_H = 0;"],
  ["m4 πύλη πάντα ανοιχτή", "return cov ? cov.ok : true;\n}", "return true;\n}"],
  ["m5 έδαφος χωρίς πύλη", "        if (!_sagAvgGate(data, _inv, info?.name || value, _SOIL_AVG_CH[_i])) continue;\n", ""],
  ["m6 σταθμός: μέγιστο χωρίς πύλη", "_okAirT &&\n          (deviceData.air_temperature_max === null ||", "(deviceData.air_temperature_max === null ||"],
  ["m7 δείκτης δεν εκπέμπεται", "            ..._sagAvgCovIndicators(measurements?.data),   // T-AVG-COVERAGE-01\n", ""],
  ["m8 ελλιπή σε πράσινο", "    metadata: { color: 'orange',\n      text: bad.map(", "    metadata: { color: 'green',\n      text: bad.map("],
  ["m9 χωρίς αφαίρεση διπλού περάσματος", "    if (seen[k]) continue;", "    if (false) continue;"],
  ["m10 άγνωστη κάλυψη κρίνεται ως κακή", "  if (!stat || typeof stat !== 'object') return null;", "  if (!stat || typeof stat !== 'object') return { n: 0, spanH: 0, ok: false };"],
  ["m11 το κείμενο χάνει το όριο", "+ ' — όριο ' + _SAG_AVG_MIN_N + ' μετρήσεις σε ' + _SAG_AVG_MIN_SPAN_H + ' ώρες. Ο μέσος 24ώρου '", "+ '. Ο μέσος 24ώρου '"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!SRC.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(SRC.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
