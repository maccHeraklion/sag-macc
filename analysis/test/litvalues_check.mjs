// Ελεγκτής T-LITVALUES-01 (v50.179, 4/11/2026): τιμές βιβλιογραφίας + παράθυρα ΠΚΠΦΠ Ηρακλείου.
// Πραγματικός πυρήνας. Ντομάτα (αλτερνάρια, ωίδιο σολανωδών), αμπέλι (ωίδιο, φώμοψη), πορτοκαλιά (ανθράκνωση).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, _sagMildewPhase, _sagInSeasonWindow, PATHOGEN_PROFILE, SAG_KERNEL_VERSION, setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; }, setTick: (h) => { _SAG_TICK_H = h; } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const TOM = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "fruiting", name: "ΓΡΙΝΙΑΡΑΚΗΣ", covered_cultivation: true, soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
const VINE = { cultivation_type_general: "vineCrops", cultivation_type: "wine_grapes", stage: "vegetative", name: "Β5", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
const ORA = { cultivation_type_general: "citrusFruits", cultivation_type: "orange", stage: "flowering", name: "ΡΗΓΑΚΗΣ", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
// Ημερομηνίες: Νοέμβριος (εκτός παραθύρων) και 5 Απριλίου (μέσα στα παραθύρα), ώρα Ελλάδας μεσημέρι
const T_NOV = Date.UTC(2026, 10, 3, 10, 0, 0), T_APR = Date.UTC(2026, 3, 5, 10, 0, 0);
function mkMeas(prevData, t0, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = Number.isFinite(o.dp) ? o.dp : (T - (100 - RH) / 5);
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; else delete data.leaf_moisture;
  if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }]; else delete data.leaf_temperature;
  data.ipsi_avg = [{ value: 2 }];
  data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 };
  return { timezone: "Europe/Athens", now: new Date(t0 + hour * 3600e3), _prevBundleTime: new Date(t0 + (hour - 1) * 3600e3).toISOString(), data };
}
function tick(K, state, t0, hour, o, crop) {
  K.setTick(1); K.setCovered(!!crop.covered_cultivation);
  const meas = mkMeas(state.data, t0, hour, o);
  const gdd = K.calculate_GDD(true, false, meas, crop) || [];
  for (const g of gdd) if (g && g.variable) meas.data[g.variable] = [{ value: g.value }];
  const ih = K.calculate_InfectionHours(true, meas, crop) || [];
  for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
  const fir = K.calculate_FIR(true, false, meas, [{ variable: "ipsi", value: 2 }], crop) || [];
  for (const x of fir) meas.data[x.variable] = [{ value: x.value }];
  const msgs = K.getPathogenMessages(fir, meas) || [];
  state.data = {};
  for (const x of [...gdd, ...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_|fir_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  const g = (arr, v) => arr.find((x) => x && x.variable === v) || null;
  return { ih, fir, msgs, meas, cnt: (k) => { const e = g(ih, "infection_hours_counter_" + k); return e ? Number(e.value) : null; },
    firOf: (k) => { const e = g(fir, "fir_" + k); return e ? Number(e.value) : null; }, msg: (k) => g(msgs, "fir_message_" + k), lws: g(ih, "leaf_wetness_source") };
}
function series(K, t0, n, o, crop) { let st = { data: {} }, r = null; for (let h = 1; h <= n; h++) r = tick(K, st, t0, h, o, crop); return r; }
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.193 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const AS = "alternaria_solani", EN = "erysiphe_necator", LT = "leveillula_taurica", PV = "phomopsis_viticola", CG = "colletotrichum_gloeosporioides";
    const prof = (k) => Object.values(K.PATHOGEN_PROFILE).map((c) => c && c[k]).find(Boolean);
    const pAS = prof(AS), pPV = prof(PV);
    ok(pAS.optimalTempRange.min === 13 && pAS.optimalTempRange.max === 32 && pAS.optimalHumidity.min === 90 && pAS.requiredDurationHrs === 6, "Π1 προφίλ αλτερνάριας {13,32}/90/6");
    ok(pPV && pPV.optimalTempRange.min === 8 && pPV.optimalTempRange.max === 35 && pPV.requiredDurationHrs === 12, "Π2 προφίλ φώμοψης {8,35}/12");
    // Α. αλτερνάρια ντομάτας: 18 °C, RH 92, μετρημένο υγρό φύλλο, 8 ώρες → μετρά (πριν: 0, Tmin 24)
    const a = series(K, T_NOV, 8, { T: 18, RH: 92, lm: 60, lt: 17.5 }, TOM);
    ok(a.cnt(AS) === 8 && a.firOf(AS) >= 0.99, "Α1 αλτερνάρια 18 °C: 8 ώρες, FIR 1 (" + a.cnt(AS) + "/" + a.firOf(AS) + ")");
    ok(a.msg(AS) && a.msg(AS).value !== "Χαμηλός κίνδυνος", "Α2 αλτερνάρια: κάρτα όχι «Χαμηλός» (" + JSON.stringify(a.msg(AS)) + ")");
    const a2 = series(K, T_NOV, 8, { T: 12, RH: 92, lm: 60, lt: 11.5 }, TOM);
    ok(a2.cnt(AS) === 0, "Α3 αλτερνάρια 12 °C (< 13): 0 ώρες (" + a2.cnt(AS) + ")");
    const a3 = series(K, T_NOV, 8, { T: 33, RH: 92, lm: 60, lt: 32 }, TOM);
    ok(a3.cnt(AS) === 0, "Α4 αλτερνάρια 33 °C (> 32): 0 ώρες (" + a3.cnt(AS) + ")");
    // Β. ωίδιο σολανωδών: max 30
    const b = series(K, T_NOV, 4, { T: 31, RH: 70 }, TOM);
    ok(b.cnt(LT) === 0, "Β1 ωίδιο σολανωδών 31 °C (> 30): 0 ώρες (" + b.cnt(LT) + ")");
    const b2 = series(K, T_NOV, 4, { T: 28, RH: 70 }, TOM);
    ok(b2.cnt(LT) === 4, "Β2 ωίδιο σολανωδών 28 °C: 4 ώρες (" + b2.cnt(LT) + ")");
    // Γ. ωίδιο αμπελιού: στεγνό φύλλο μετρά, ΜΕΤΡΗΜΕΝΟ υγρό φύλλο μηδενίζει, εκτίμηση δρόσου δεν μηδενίζει, max 32
    const c = series(K, T_NOV, 8, { T: 25, RH: 70 }, VINE);
    ok(c.cnt(EN) === 8, "Γ1 ωίδιο αμπελιού 25 °C RH 70 στεγνό: 8 ώρες (" + c.cnt(EN) + ")");
    const c2 = series(K, T_NOV, 8, { T: 25, RH: 70, lm: 60, lt: 24.5 }, VINE);
    ok(c2.cnt(EN) === 0 && c2.lws && c2.lws.value === "Αισθητήρας φύλλου", "Γ2 ωίδιο αμπελιού με μετρημένο νερό στο φύλλο: 0 ώρες (" + c2.cnt(EN) + ", " + (c2.lws && c2.lws.value) + ")");
    const c3 = series(K, T_NOV, 8, { T: 25, RH: 96 }, VINE);
    ok(c3.cnt(EN) === 8, "Γ3 ωίδιο αμπελιού, υγρό φύλλο μόνο από ΕΚΤΙΜΗΣΗ (RH 96): μετρά 8 ώρες όπως πριν (" + c3.cnt(EN) + ", " + (c3.lws && c3.lws.value) + ")");
    const c4 = series(K, T_NOV, 4, { T: 33, RH: 70 }, VINE);
    ok(c4.cnt(EN) === 0, "Γ4 ωίδιο αμπελιού 33 °C (> 32): 0 ώρες (" + c4.cnt(EN) + ")");
    const c5 = series(K, T_NOV, 8, { T: 25, RH: 70, lm: 60, lt: 24.5 }, TOM);
    ok(c5.cnt(LT) === 8, "Γ5 ωίδιο σολανωδών ΔΕΝ δηλώνει wetLeafInhibits: μετρά με υγρό φύλλο (" + c5.cnt(LT) + ")");
    // Δ. φώμοψη αμπελιού: 5/4 μέσα στο παράθυρο, 15 °C RH 97 υγρό 13 ώρες → 13 ≥ 12· Νοέμβριος → 0 και «Εκτός περιόδου»
    const d = series(K, T_APR, 13, { T: 15, RH: 97, lm: 60, lt: 14.5 }, VINE);
    ok(d.cnt(PV) === 13 && d.firOf(PV) >= 0.99, "Δ1 φώμοψη 5/4: 13 ώρες, FIR 1 (" + d.cnt(PV) + "/" + d.firOf(PV) + ")");
    ok(d.msg(PV) && d.msg(PV).value !== "Χαμηλός κίνδυνος", "Δ2 φώμοψη 5/4: κάρτα όχι «Χαμηλός» (" + JSON.stringify(d.msg(PV)) + ")");
    const d2 = series(K, T_APR, 11, { T: 15, RH: 97, lm: 60, lt: 14.5 }, VINE);
    ok(d2.cnt(PV) === 11 && d2.firOf(PV) < 0.99, "Δ3 φώμοψη 11 ώρες < 12: FIR κάτω από 1 (" + d2.firOf(PV) + ")");
    const d3 = series(K, T_NOV, 13, { T: 15, RH: 97, lm: 60, lt: 14.5 }, VINE);
    ok(d3.cnt(PV) === 0, "Δ4 φώμοψη Νοέμβριο: 0 ώρες (" + d3.cnt(PV) + ")");
    const dm = d3.msg(PV);
    ok(dm && dm.value === "Χαμηλός κίνδυνος" && dm.metadata.color === "green" && /Εκτός περιόδου για τη φώμοψη/.test(dm.metadata.text) && /έκπτυξη/.test(dm.metadata.text), "Δ5 φώμοψη Νοέμβριο: «Εκτός περιόδου για τη φώμοψη» (" + JSON.stringify(dm) + ")");
    const d4 = series(K, T_APR, 4, { T: 7, RH: 97, lm: 60, lt: 6.5 }, VINE);
    ok(d4.cnt(PV) === 0, "Δ6 φώμοψη 7 °C (< 8): 0 ώρες (" + d4.cnt(PV) + ")");
    // Ε. ανθράκνωση εσπεριδοειδών: 5/4 μέσα, 9 ώρες ≥ 8· Νοέμβριος σιωπή
    const e = series(K, T_APR, 9, { T: 22, RH: 95, lm: 60, lt: 21.5 }, ORA);
    ok(e.cnt(CG) === 9 && e.firOf(CG) >= 0.99, "Ε1 ανθράκνωση 5/4: 9 ώρες, FIR 1 (" + e.cnt(CG) + "/" + e.firOf(CG) + ")");
    const e2 = series(K, T_NOV, 9, { T: 22, RH: 95, lm: 60, lt: 21.5 }, ORA);
    ok(e2.cnt(CG) === 0 && e2.msg(CG) && /Εκτός περιόδου για την ανθράκνωση/.test(e2.msg(CG).metadata.text), "Ε2 ανθράκνωση Νοέμβριο: 0 ώρες και «Εκτός περιόδου» (" + e2.cnt(CG) + ", " + JSON.stringify(e2.msg(CG)) + ")");
    ok(e2.cnt("alternaria_alternata_citrus_abs") === 9, "Ε3 αλτερνάρια εσπεριδοειδών (χωρίς παράθυρο) μετρά Νοέμβριο (" + e2.cnt("alternaria_alternata_citrus_abs") + ")");
    // Ζ. παράθυρα: όρια
    ok(K._sagInSeasonWindow(PV, 301) && K._sagInSeasonWindow(PV, 510) && !K._sagInSeasonWindow(PV, 511) && !K._sagInSeasonWindow(PV, 228) && K._sagInSeasonWindow("botrytis_cinerea", 115), "Ζ1 όρια παραθύρου φώμοψης 1/3–10/5, άγνωστο κλειδί πάντα μέσα");
    ok(K._sagMildewPhase(PV, 1103) === "silent" && K._sagMildewPhase(PV, 405) === "off" && K._sagMildewPhase(EN, 1103) === "normal", "Ζ2 φάση: φώμοψη σιωπή Νοέμβριο, off Απρίλιο· ωίδιο αμπελιού normal Νοέμβριο");
    // Η. ανοιχτή υπόθεση φώμοψης τον Νοέμβριο κλείνει «auto»· τον Απρίλιο μένει
    const nowMs = T_NOV + 14 * 3600e3; const openRec = { s: "open", o: Math.floor((T_NOV - 10 * 864e5) / 60000), p: 4, h: Math.floor((T_NOV - 36e5) / 60000) };
    const mN = mkMeas({}, T_NOV, 14, { T: 15, RH: 97 }); mN.data["case_" + PV] = [{ value: JSON.stringify(openRec) }];
    const outN = K._sagPathogenCases(mN, d3.fir, null, null, nowMs, NaN, null) || [];
    const cN = outN.find((x) => x.variable === "case_" + PV);
    ok(cN && JSON.parse(cN.value).s === "auto", "Η1 ανοιχτή υπόθεση φώμοψης Νοέμβριο: κλείνει auto (" + (cN && cN.value) + ")");
    const nowA = T_APR + 14 * 3600e3; const openA = { s: "open", o: Math.floor((T_APR - 2 * 864e5) / 60000), p: 4, h: Math.floor((T_APR - 36e5) / 60000) };
    const mA = mkMeas({}, T_APR, 14, { T: 15, RH: 97 }); mA.data["case_" + PV] = [{ value: JSON.stringify(openA) }];
    const outA = K._sagPathogenCases(mA, d.fir, null, null, nowA, NaN, null) || [];
    const cA = outA.find((x) => x.variable === "case_" + PV);
    ok(!cA || JSON.parse(cA.value).s === "open", "Η2 ανοιχτή υπόθεση φώμοψης Απρίλιο: μένει ανοιχτή (" + (cA && cA.value) + ")");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 αλτερνάρια Tmin 24", "optimalTempRange: { min: 13, opt: 25, max: 32 },   // T-LITVALUES-01", "optimalTempRange: { min: 24, opt: 25, max: 32 },   // T-LITVALUES-01"],
  ["M2 αλτερνάρια 8 ώρες", "      requiredDurationHrs: 6,   // T-LITVALUES-01", "      requiredDurationHrs: 8,   // T-LITVALUES-01"],
  ["M3 χωρίς wetLeafInhibits στο προφίλ", "      wetLeafInhibits: true,          // T-LITVALUES-01", "      wetLeafInhibits: false,         // T-LITVALUES-01"],
  ["M4 ο μετρητής αγνοεί το νερό", "const _wetInhibit = pathogen.wetLeafInhibits === true && _lwsMeasuredWet;", "const _wetInhibit = false;"],
  ["M5 ο μετρητής αγνοεί το παράθυρο", "const _inSeason = _sagInSeasonWindow(pathogenKey, _sagMonthDayNow(measurements));", "const _inSeason = true;"],
  ["M6 παράθυρο φώμοψης όλο τον χρόνο", "phomopsis_viticola: { from: 301, to: 510,", "phomopsis_viticola: { from: 101, to: 1231,"],
  ["M7 φάση χωρίς σιωπή", "  if (_SAG_SEASON_WINDOWS[key] && !_sagInSeasonWindow(key, md)) return 'silent';   // T-LITVALUES-01\n", ""],
  ["M8 υπόθεση δεν κλείνει", "      || !_sagInSeasonWindow(k, _sagMonthDayNow(measurements));   // T-LITVALUES-01", "      || false;"],
  ["M9 ανθράκνωση 12 ώρες", "    requiredDurationHrs: 8,   // T-LITVALUES-01: ήταν 12.", "    requiredDurationHrs: 12,   // T-LITVALUES-01: ήταν 12."],
  ["M10 ωίδιο σολανωδών max 32", "optimalTempRange: { min: 15, opt: 25, max: 30 },   // T-LITVALUES-01", "optimalTempRange: { min: 15, opt: 25, max: 32 },   // T-LITVALUES-01"],
  ["M11 ωίδιο αμπελιού max 35", "optimalTempRange: { min: 15, max: 32 }, // B4 FIX", "optimalTempRange: { min: 15, max: 35 }, // B4 FIX"],
  ["M12 φώμοψη Tmin 5", "optimalTempRange: { min: 8, opt: 20, max: 35 },", "optimalTempRange: { min: 5, opt: 20, max: 35 },"],
  ["M13 ώρα από το ρολόι αντί του παλμού", "const n = measurements && measurements.now ? new Date(measurements.now) : null;", "const n = null;"],
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
