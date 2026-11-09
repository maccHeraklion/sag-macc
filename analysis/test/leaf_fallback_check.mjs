// Ελεγκτής T-LEAF-FALLBACK-01 (v50.193, 9/11/2026, απόφαση Μιχάλη): όταν ο σταθμός σιωπά (αέρας παλιός) αλλά ο αισθητήρας
// φύλλου είναι φρέσκος, οι ασθένειες υγρού φύλλου μετρούν ώρες με τη ΘΕΡΜΟΚΡΑΣΙΑ ΦΥΛΛΟΥ όταν το φύλλο είναι μετρημένα βρεγμένο·
// «στεγνό» = διατήρηση· ωίδια σε παύση· κολλημένος/σε διαφωνία ή παλιός αισθητήρας = πάγωμα όπως πριν. Φορτώνει ΟΛΟΚΛΗΡΟ τον
// πραγματικό πυρήνα· κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagMildewPhase, PATHOGEN_PROFILE, setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; }, setTick: (h) => { _SAG_TICK_H = h; } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const CUKE = { cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber", stage: "fruiting", name: "ΚΟΥΤΣΑΚΗΣ", covered_cultivation: true, soil_type: "silty_clay_loam", area: 1950, irrigation_system: "dripIrrigation" };
const TOM = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "fruiting", name: "ΓΡΙΝΙΑΡΑΚΗΣ", covered_cultivation: true, soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
const T0 = Date.UTC(2026, 10, 3, 20, 0, 0);
function mkMeas(prevData, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = Number.isFinite(o.dp) ? o.dp : (T - (100 - RH) / 5);
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; else delete data.leaf_moisture;
  if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }]; else delete data.leaf_temperature;
  if (o.rain !== undefined) data.rain_height_hourly = [{ value: o.rain }]; else delete data.rain_height_hourly;
  data.ipsi_avg = [{ value: 2 }];
  data._sagAges = Object.assign({ temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 }, o.ages || {});
  return { timezone: "Europe/Athens", now: new Date(T0 + hour * 3600e3), _prevBundleTime: new Date(T0 + (hour - 1) * 3600e3).toISOString(), data };
}
function tick(K, state, hour, o, crop) {
  K.setTick(1); K.setCovered(!!crop.covered_cultivation);
  const meas = mkMeas(state.data, hour, o);
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
  return { cnt: (k) => Number((g(ih, "infection_hours_counter_" + k) || {}).value ?? NaN), firOf: (k) => Number((g(fir, "fir_" + k) || {}).value ?? NaN),
    msg: (k) => g(msgs, "fir_message_" + k), lws: g(ih, "leaf_wetness_source"), ind: (v) => g(ih, v), mx: (k) => Number((g(ih, "infection_hours_counter_max_" + k) || {}).value ?? NaN) };
}

const STALE = { temperature: 200, humidity: 200, dew_point: 200 };
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  const realNow = Date.now;
  try {
    Date.now = () => Date.parse("2026-11-04T10:00:00Z");
    const PC = "pseudoperonospora_cubensis", PX = "podosphaera_xanthii";
    const FRESH = { T: 19, RH: 92, lm: 60, lt: 18.5 };
    const after = (stale, n, pre, data) => { const st = { data: Object.assign({}, data || {}) }; let r = null, h = 1;
      for (let i = 0; i < (pre ? 3 : 0); i++) { r = tick(K, st, h++, pre, CUKE); if (data) Object.assign(st.data, data); }
      for (let i = 0; i < n; i++) r = tick(K, st, h++, stale, CUKE); return r; };
    // F1 σταθμός σιωπηλός, φύλλο βρεγμένο στους 17 °C: συνεχίζει 3 → 6, κάρτα «από τον αισθητήρα φύλλου»
    const f1 = after({ T: 19, RH: 92, lm: 60, lt: 17, ages: STALE }, 3, FRESH);
    const s1 = f1.ind("infection_model_status");
    ok(f1.cnt(PC) === 6 && f1.mx(PC) === 6, "F1 βρεγμένο φύλλο με σιωπηλό σταθμό: 6 ώρες (" + f1.cnt(PC) + "/" + f1.mx(PC) + ")");
    ok(s1 && s1.value === "Ώρες μόλυνσης: από τον αισθητήρα φύλλου" && s1.metadata.color === "orange" && /εδώ και 3\.3 ώρες/.test(s1.metadata.text) && /ωίδια/.test(s1.metadata.text), "F1β κάρτα κατάστασης (" + JSON.stringify(s1) + ")");
    ok(f1.ind("ih_leaf_fallback") && f1.ind("ih_leaf_fallback").value === "wet", "F1γ εσωτερική σημαία wet");
    // F2 στεγνό φύλλο: διατήρηση στις 3
    const f2 = after({ T: 19, RH: 92, lm: 5, lt: 17, ages: STALE }, 3, FRESH);
    ok(f2.cnt(PC) === 3 && f2.ind("ih_leaf_fallback") && f2.ind("ih_leaf_fallback").value === "dry", "F2 στεγνό φύλλο: διατήρηση 3 (" + f2.cnt(PC) + ")");
    // F3 και ο αισθητήρας φύλλου παλιός: πάγωμα όπως πριν, κάρτα παύσης
    const f3 = after({ T: 19, RH: 92, lm: 60, lt: 17, ages: Object.assign({ leaf_temperature: 200, leaf_moisture: 200 }, STALE) }, 3, FRESH);
    ok(f3.cnt(PC) === 3 && f3.ind("infection_model_status").value === "Σε παύση — παλιά μέτρηση" && !f3.ind("ih_leaf_fallback"), "F3 παλιό φύλλο: πάγωμα 3 (" + f3.cnt(PC) + ", " + f3.ind("infection_model_status").value + ")");
    // F4 βρεγμένο αλλά φύλλο 2 °C (κάτω από 5): μετρημένα δυσμενής ώρα → 0
    const f4 = after({ T: 19, RH: 92, lm: 60, lt: 2, ages: STALE }, 1, FRESH);
    ok(f4.cnt(PC) === 0 && f4.mx(PC) === 3, "F4 φύλλο εκτός εύρους: μηδενισμός, μέγιστο 3 (" + f4.cnt(PC) + "/" + f4.mx(PC) + ")");
    // F5 κρίνει η θερμοκρασία ΦΥΛΛΟΥ, όχι η παλιά του αέρα (αέρας 35 °C εκτός εύρους)
    const f5 = after({ T: 35, RH: 92, lm: 60, lt: 18, ages: STALE }, 3, null);
    ok(f5.cnt(PC) === 3, "F5 θερμοκρασία φύλλου 18 με παλιό αέρα 35: 3 ώρες (" + f5.cnt(PC) + ")");
    // F6 ωίδιο (δεν θέλει υγρό φύλλο): σε παύση
    const f6 = after({ T: 24, RH: 60, lm: 60, lt: 24, ages: STALE }, 3, { T: 24, RH: 60, lm: 5, lt: 23.5 });
    ok(f6.cnt(PX) === 3, "F6 ωίδιο σε παύση: 3 (" + f6.cnt(PX) + ")");
    // F7 αισθητήρας σε διαφωνία (δακτύλιος ενεργός): καμία εφεδρεία
    const RING = { leaf_disagree_ring: [{ value: JSON.stringify([["10-30", 4], ["10-31", 4]]) }] };
    const f7 = after({ T: 19, RH: 92, lm: 60, lt: 17, ages: STALE }, 3, FRESH, RING);
    ok(f7.cnt(PC) === 3 && !f7.ind("ih_leaf_fallback"), "F7 αισθητήρας σε διαφωνία: πάγωμα 3 (" + f7.cnt(PC) + ")");
    // F8 φρέσκος αέρας: η εφεδρεία δεν ενεργοποιείται
    const f8 = after(FRESH, 2, FRESH);
    ok(f8.cnt(PC) === 5 && !f8.ind("ih_leaf_fallback") && f8.ind("infection_model_status").value !== "Ώρες μόλυνσης: από τον αισθητήρα φύλλου", "F8 φρέσκος αέρας: όπως πριν (" + f8.cnt(PC) + ")");
    // F9 άγνωστη ηλικία φύλλου: δεν θεωρείται φρέσκο
    const f9 = after({ T: 19, RH: 92, lm: 60, lt: 17, ages: Object.assign({ leaf_temperature: undefined, leaf_moisture: undefined }, STALE) }, 3, FRESH);
    ok(f9.cnt(PC) === 3, "F9 άγνωστη ηλικία φύλλου: πάγωμα 3 (" + f9.cnt(PC) + ")");
    // F10 φρέσκος αέρας με θερμοκρασία φύλλου εκτός εύρους: κρίνει ο αέρας όπως πριν
    const f10 = after({ T: 19, RH: 92, lm: 60, lt: 2 }, 2, FRESH);
    ok(f10.cnt(PC) === 5, "F10 φρέσκος αέρας: η θερμοκρασία φύλλου δεν μπαίνει (" + f10.cnt(PC) + ")");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); } finally { Date.now = realNow; }
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 χωρίς εφεδρεία", "const _lfHere = _leafFallback && needsWet && _lfWet;", "const _lfHere = false;"],
  ["M2 θερμοκρασία αέρα", "const _lfTempOk = leafTemp >= Number(_otr.min) && leafTemp <= Number(_otr.max);", "const _lfTempOk = tempOk;"],
  ["M3 στεγνό μετρά", "const _lfWet = _leafFallback && _lfLm > _SAG_LWS_WET;", "const _lfWet = _leafFallback;"],
  ["M4 και για ωίδια", "const _lfHere = _leafFallback && needsWet && _lfWet;", "const _lfHere = _leafFallback && _lfWet;"],
  ["M5 κολλημένος/σε διαφωνία", "const _leafFallback = _ihFrozen && !_leafStuck", "const _leafFallback = _ihFrozen"],
  ["M6 παλιό φύλλο", "&& _lfLtAge <= _lwAgeLimitMin && _lfLmAge <= _lwAgeLimitMin", ""],
  ["M7 χωρίς κάρτα", "indicators.push(_leafFallback\n    ? {", "indicators.push(false\n    ? {"],
  ["M8 εκτός εύρους = διατήρηση", "(_lfTempOk && _inSeason) ? parseFloat((prevCount + _sagTickHours()).toFixed(1)) : 0)", "(_lfTempOk && _inSeason) ? parseFloat((prevCount + _sagTickHours()).toFixed(1)) : prevCount)"],
  ["M9 και με φρέσκο αέρα", "const _leafFallback = _ihFrozen && !_leafStuck", "const _leafFallback = !_leafStuck"],
  ["M10 άγνωστη ηλικία = φρέσκο", "&& _lfLtAge >= 0 && _lfLmAge >= 0 ", "&& true "],
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
