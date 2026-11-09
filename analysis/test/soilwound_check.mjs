// Ελεγκτής T-SOILWOUND-01 (v50.180, 4/11/2026): μελάνωση καστανιάς και γομμώσεις εσπεριδοειδών στο εδαφογενές μοντέλο
// (κορεσμός + μνήμη κορεσμού, παράθυρο γομμώσεων), έλκος καστανιάς σε μοντέλο πληγών. Πραγματικός πυρήνας.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, _sagNoCaseKeySet, _sagInSeasonWindow, PATHOGEN_PROFILE, SAG_KERNEL_VERSION, setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; }, setTick: (h) => { _SAG_TICK_H = h; } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const CH = { cultivation_type_general: "nutCrops", cultivation_type: "chestnut", stage: "fruiting", name: "ΜΕΛΙΒΟΙΑ", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
const ORA = { cultivation_type_general: "citrusFruits", cultivation_type: "orange", stage: "fruiting", name: "ΡΗΓΑΚΗΣ", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
// silty_clay_loam: FC 38, WP 21 → soil_moisture 38 = AWC 100 %, 24 = 18 %
const T_NOV = Date.UTC(2026, 10, 3, 10, 0, 0), T_JUL = Date.UTC(2026, 6, 15, 10, 0, 0), T_MAY = Date.UTC(2026, 4, 20, 10, 0, 0), T_JAN = Date.UTC(2026, 0, 15, 10, 0, 0);
function mkMeas(prevData, t0, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = T - (100 - RH) / 5;
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.st !== undefined) data.soil_temperature1 = [{ value: o.st }]; else delete data.soil_temperature1;
  if (o.sm !== undefined) data.soil_moisture1 = [{ value: o.sm }]; else delete data.soil_moisture1;
  if (o.rain !== undefined) data.rain_height_daily = [{ value: o.rain }]; else delete data.rain_height_daily;
  data.ipsi_avg = [{ value: 2 }];
  data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, soil_temperature1: 5, soil_moisture1: 5 };
  return { timezone: "Europe/Athens", now: new Date(t0 + hour * 3600e3), _prevBundleTime: new Date(t0 + (hour - 1) * 3600e3).toISOString(), data };
}
function tick(K, state, t0, hour, o, crop) {
  K.setTick(1); K.setCovered(false);
  const meas = mkMeas(state.data, t0, hour, o);
  const gdd = K.calculate_GDD(true, false, meas, crop) || [];
  for (const g of gdd) if (g && g.variable) meas.data[g.variable] = [{ value: g.value }];
  const ih = K.calculate_InfectionHours(true, meas, crop) || [];
  for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
  const fir = K.calculate_FIR(true, false, meas, [{ variable: "ipsi", value: 2 }], crop) || [];
  for (const x of fir) meas.data[x.variable] = [{ value: x.value }];
  const msgs = K.getPathogenMessages(fir, meas) || [];
  state.data = {};
  for (const x of [...gdd, ...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_|fir_|soilsat_|soilhist_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  const g = (arr, v) => arr.find((x) => x && x.variable === v) || null;
  return { ih, fir, msgs, meas, cnt: (k) => { const e = g(ih, "infection_hours_counter_" + k); return e ? Number(e.value) : null; },
    firOf: (k) => { const e = g(fir, "fir_" + k); return e ? Number(e.value) : null; }, msg: (k) => g(msgs, "fir_message_" + k) || g(fir, "fir_message_" + k), sat: (k) => g(fir, "soilsat_last_" + k) };
}
function series(K, t0, steps, crop, pre) { let st = { data: Object.assign({}, pre || {}) }, r = null; let h = 0; for (const o of steps) r = tick(K, st, t0, ++h, o, crop); return r; }
const rep = (o, n) => Array.from({ length: n }, () => o);
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.191 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const XC = "phytophthora_xcambivora", CP = "cryphonectria_parasitica", PC = "phytophthora_citrophthora";
    const prof = (k) => Object.values(K.PATHOGEN_PROFILE).map((c) => c && c[k]).find(Boolean);
    ok(prof(XC).type === "Soilborne_Disease_Model" && prof(PC).type === "Soilborne_Disease_Model" && prof(CP).type === "Wound_Canker_Model", "Π1 τύποι μοντέλων");
    // Α. καστανιά ΧΩΡΙΣ αισθητήρα εδάφους, Νοέμβριος: μελάνωση γκρι με αιτία, έλκος εκτός περιόδου «Χαμηλός»
    const a = series(K, T_NOV, rep({ T: 18, RH: 97 }, 3), CH);
    ok(a.cnt(XC) === null && a.cnt(CP) === null, "Α1 χωρίς μετρητές ωρών (" + a.cnt(XC) + "/" + a.cnt(CP) + ")");
    ok(a.firOf(XC) === null, "Α2 μελάνωση χωρίς έδαφος: κανένα fir_");
    const mx = a.msg(XC);
    ok(mx && mx.value === "Μη διαθέσιμο" && mx.metadata.color === "grey" && /χωρίς αισθητήρα εδάφους/.test(mx.metadata.text) && /ριζών και λαιμού/.test(mx.metadata.text) && /στράγγιση/.test(mx.metadata.text) && !/[Ψψ]εκάσ/.test(mx.metadata.text), "Α3 μελάνωση: γκρι «χωρίς αισθητήρα εδάφους» με μέτρα (" + JSON.stringify(mx) + ")");
    const mc = a.msg(CP);
    ok(a.firOf(CP) === 0 && mc && mc.value === "Χαμηλός κίνδυνος" && /δίοδο μόλυνσης/.test(mc.metadata.text), "Α4 έλκος Νοέμβριο: fir 0, «Χαμηλός», χωρίς δίοδο (" + a.firOf(CP) + ", " + JSON.stringify(mc) + ")");
    // Β. καστανιά ΜΕ αισθητήρα εδάφους, Νοέμβριος: κορεσμένο 20 °C → υψηλός· στεγνό → χαμηλός· κρύο → 0
    const b = series(K, T_NOV, rep({ T: 18, RH: 90, st: 20, sm: 38 }, 3), CH);
    ok(b.firOf(XC) !== null && b.firOf(XC) >= 0.4, "Β1 κορεσμένο 20 °C: FIR ≥ 0,4 (" + b.firOf(XC) + ")");
    ok(b.sat(XC) && Number.isFinite(Number(b.sat(XC).value)), "Β2 soilsat_last εκπέμπεται (" + JSON.stringify(b.sat(XC)) + ")");
    ok(b.msg(XC) && /κίνδυνος/.test(b.msg(XC).value) && b.msg(XC).value !== "Μη διαθέσιμο" && !/[Ψψ]εκάσ/.test(b.msg(XC).metadata.text), "Β3 κάρτα κινδύνου χωρίς «ψεκάστε» (" + JSON.stringify(b.msg(XC)) + ")");
    const b2 = series(K, T_NOV, rep({ T: 18, RH: 90, st: 20, sm: 24 }, 3), CH);
    ok(b2.firOf(XC) !== null && b2.firOf(XC) < 0.2, "Β4 στεγνό (AWC 18 %) χωρίς ιστορικό κορεσμού: FIR < 0,2 (" + b2.firOf(XC) + ")");
    const b3 = series(K, T_NOV, [{ T: 18, RH: 90, st: 20, sm: 38 }, ...rep({ T: 18, RH: 90, st: 20, sm: 24 }, 10)], CH);
    ok(b3.firOf(XC) >= 0.4, "Β5 κορεσμός πριν 10 ώρες, τώρα στεγνό: η μνήμη κρατά FIR ≥ 0,4 (" + b3.firOf(XC) + ")");
    const oldMin = Math.floor((T_NOV + 3 * 3600e3) / 60000) - 40 * 1440;
    const b4 = series(K, T_NOV, rep({ T: 18, RH: 90, st: 20, sm: 24 }, 3), CH, { ["soilsat_last_" + XC]: [{ value: oldMin }] });
    ok(b4.firOf(XC) < 0.2, "Β6 κορεσμός πριν 40 ημέρες: η μνήμη έσβησε, FIR < 0,2 (" + b4.firOf(XC) + ")");
    const b5 = series(K, T_NOV, rep({ T: 18, RH: 90, st: 10, sm: 38 }, 3), CH);
    ok(b5.firOf(XC) === 0, "Β7 έδαφος 10 °C (< 15): FIR 0 (" + b5.firOf(XC) + ")");
    // Γ. γομμώσεις: Νοέμβριος μέσα στο παράθυρο (χωρίς έδαφος → γκρι)· Ιούλιος εκτός → «Εκτός περιόδου» χωρίς fir_· με έδαφος Νοέμβριο → κίνδυνος
    const c = series(K, T_NOV, rep({ T: 20, RH: 90 }, 2), ORA);
    ok(c.msg(PC) && c.msg(PC).value === "Μη διαθέσιμο" && /χωρίς αισθητήρα εδάφους/.test(c.msg(PC).metadata.text) && /κορμού/.test(c.msg(PC).metadata.text), "Γ1 γομμώσεις Νοέμβριο χωρίς έδαφος: γκρι (" + JSON.stringify(c.msg(PC)) + ")");
    const c2 = series(K, T_JUL, rep({ T: 28, RH: 70, st: 24, sm: 38 }, 2), ORA);
    ok(c2.firOf(PC) === null && c2.msg(PC) && c2.msg(PC).value === "Χαμηλός κίνδυνος" && /Εκτός περιόδου για τις γομμώσεις/.test(c2.msg(PC).metadata.text), "Γ2 γομμώσεις Ιούλιο: εκτός περιόδου, χωρίς fir_ (" + c2.firOf(PC) + ", " + JSON.stringify(c2.msg(PC)) + ")");
    const c3 = series(K, T_NOV, rep({ T: 20, RH: 90, st: 20, sm: 38 }, 3), ORA);
    ok(c3.firOf(PC) !== null && c3.firOf(PC) >= 0.2, "Γ3 γομμώσεις Νοέμβριο με κορεσμένο έδαφος 20 °C: FIR ≥ 0,2 (" + c3.firOf(PC) + ")");
    ok(K._sagInSeasonWindow(PC, 1103) && K._sagInSeasonWindow(PC, 415) && !K._sagInSeasonWindow(PC, 715) && !K._sagInSeasonWindow(PC, 1215), "Γ4 παράθυρα γομμώσεων 1/3–30/6 και 1/9–30/11");
    // Δ. έλκος: Μάιος + βροχή 3 mm + 20 °C → Μέτριος· + δηλωμένο κλάδεμα → Σοβαρός χωρίς «ψεκάστε»· χωρίς βροχή/πληγή → 0· 35 °C → 0· Ιανουάριος → 0
    const d = series(K, T_MAY, rep({ T: 20, RH: 80, rain: 3 }, 2), CH);
    ok(d.firOf(CP) >= 0.3 && d.firOf(CP) < 0.5 && d.msg(CP) && d.msg(CP).value === "Μέτριος κίνδυνος", "Δ1 Μάιος, βροχή 3 mm, 20 °C: FIR ~0,38 Μέτριος (" + d.firOf(CP) + ", " + (d.msg(CP) && d.msg(CP).value) + ")");
    const CHW = Object.assign({}, CH, { wound_history: { days_since_pruning: 5 } });
    const d2 = series(K, T_MAY, rep({ T: 20, RH: 80, rain: 0 }, 2), CHW);
    ok(d2.firOf(CP) >= 0.7 && d2.msg(CP) && d2.msg(CP).value === "Σοβαρός κίνδυνος" && !/[Ψψ]εκάσ/.test(d2.msg(CP).metadata.text) && /χημική/.test(d2.msg(CP).metadata.text), "Δ2 Μάιος με κλάδεμα πριν 5 ημέρες: Σοβαρός χωρίς ψεκασμό, «χημική» (" + d2.firOf(CP) + ", " + JSON.stringify(d2.msg(CP)) + ")");
    const d3 = series(K, T_MAY, rep({ T: 20, RH: 80, rain: 0 }, 2), CH);
    ok(d3.firOf(CP) === 0 && d3.msg(CP) && d3.msg(CP).value === "Χαμηλός κίνδυνος", "Δ3 Μάιος χωρίς βροχή/πληγή: 0 (" + d3.firOf(CP) + ")");
    const d4 = series(K, T_MAY, rep({ T: 35, RH: 80, rain: 3 }, 2), CHW);
    ok(d4.firOf(CP) === 0, "Δ4 35 °C: 0 (" + d4.firOf(CP) + ")");
    const d5 = series(K, T_JAN, rep({ T: 20, RH: 80, rain: 3 }, 2), CHW);
    ok(d5.firOf(CP) === 0, "Δ5 Ιανουάριος με κλάδεμα και βροχή: 0 (" + d5.firOf(CP) + ")");
    const d6 = series(K, T_MAY, rep({ T: 20, RH: 80, rain: 3 }, 2), Object.assign({}, CH, { wound_history: { days_since_pruning: 40 } }));
    ok(d6.firOf(CP) >= 0.3 && d6.firOf(CP) < 0.5, "Δ6 κλάδεμα πριν 40 ημέρες (> 28): μόνο η βροχή μετρά (" + d6.firOf(CP) + ")");
    // Ε. υποθέσεις: και τα 3 εκτός κύκλου
    const ncs = K._sagNoCaseKeySet();
    ok(ncs.has(XC) && ncs.has(CP) && ncs.has(PC) && !ncs.has("phytophthora_infestans"), "Ε1 τα 3 εκτός κύκλου υπόθεσης");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 χωρίς γκρι κάρτα όταν λείπει έδαφος", "          indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',\n            metadata: { color: 'grey', text: _nfT", "          if (false) indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',\n            metadata: { color: 'grey', text: _nfT"],
  ["M2 παράθυρο αγνοείται στο εδαφογενές", "        if (!_sagInSeasonWindow(pathogenKey, _sagMonthDayNow(measurements))) {\n          indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός κίνδυνος',", "        if (false) {\n          indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός κίνδυνος',"],
  ["M3 μνήμη κορεσμού σβηστή", "    f_M = satDays <= _mem ? 1.0 : Math.max(0.3, 1.0 - (satDays - _mem) / _mem);", "    f_M = f_M;"],
  ["M4 η βροχή δεν ανοίγει δίοδο", "const f_entry = woundPresent ? 1.0 : (rain24 >= rainMin ? 0.5 : 0);", "const f_entry = woundPresent ? 1.0 : 0;"],
  ["M5 έλκος όλο τον χρόνο", "season_weights: [[501, 731, 1.0], [301, 430, 0.6], [801, 1031, 0.6]]", "season_weights: [[101, 1231, 1.0]]"],
  ["M6 οι πληγές αγνοούνται", "const woundPresent = recent('days_since_pruning', 'pruning', 28)", "const woundPresent = false && recent('days_since_pruning', 'pruning', 28)"],
  ["M7 έλκος μέσα στον κύκλο υπόθεσης", "'Soil_Phenology_DD', 'Wound_Canker_Model']", "'Soil_Phenology_DD']"],
  ["M8 γομμώσεις χωρίς παράθυρο", "ranges: [[301, 630], [901, 1130]]", "ranges: [[101, 1231]]"],
  ["M9 μελάνωση δροσερή (Tmin 5)", "soil_T_optimal_C: [15, 30],          // Nesbitt 1979", "soil_T_optimal_C: [5, 30],          // Nesbitt 1979"],
  ["M10 soilsat_last δεν αποθηκεύεται", "            indicators = [...indicators, { variable: 'soilsat_last_' + pathogenKey, value: _last }];\n", ""],
  ["M11 χωρίς κλάδο πληγών", "} else if (erCalculationType === \"Wound_Canker_Model\") {", "} else if (false) {"],
  ["M12 πληγή 40 ημερών ακόμη ανοιχτή", "wound_windows_days: { pruning: 28, hail: 28, storm: 28, frost: 60 },", "wound_windows_days: { pruning: 90, hail: 28, storm: 28, frost: 60 },"],
];
let bad = 0;
for (const [n, a, b] of M) {
  if (SRC.split(a).length !== 2) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ " + n); bad++; continue; }
  const r = run(SRC.replace(a, b));
  console.log((r.length ? "ΣΚΟΤΩΘΗΚΕ " : "ΕΠΕΖΗΣΕ ") + n);
  if (!r.length) bad++;
}
console.log(bad ? "ΑΠΟΤΥΧΙΑ μεταλλάξεων: " + bad : "ΜΕΤΑΛΛΑΞΕΙΣ " + M.length + "/" + M.length);
process.exit(bad ? 1 : 0);
