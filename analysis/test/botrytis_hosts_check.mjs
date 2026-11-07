// Ελεγκτής T-BOTRYTIS-HOSTS-01 (v50.181, 6/11/2026) + W-BOTRYTIS-HOSTS-01: νέοι ξενιστές βοτρύτη, μόνο λίστα ξενιστών.
// Πραγματικός πυρήνας και πραγματικό widget. Αγγούρι (Κουτσάκης), σταφίδα, ροδακινιά, ελιά (μη ξενιστής).
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
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const CUC = { cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber", stage: "fruiting", name: "ΚΟΥΤΣΑΚΗΣ", covered_cultivation: true, soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
const mk = (g, c, extra) => Object.assign({ cultivation_type_general: g, cultivation_type: c, stage: "fruiting", name: c, soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" }, extra || {});
const NEW = [["vineCrops", "raisin_grapes"], ["vegetableCrops", "cucumber"], ["vegetableCrops", "zucchini"], ["vegetableCrops", "eggplant"], ["vegetableCrops", "potato"], ["vegetableCrops", "cabbage"], ["stoneFruits", "peach"]];
const OLD = [["vineCrops", "wine_grapes"], ["vineCrops", "table_grapes"], ["vegetableCrops", "onion"], ["vegetableCrops", "dry_beans"], ["vegetableCrops", "faba_bean"], ["vegetableCrops", "green_beans"], ["vegetableCrops", "lettuce"], ["vegetableCrops", "tomato"], ["vegetableCrops", "pepper"], ["vegetableCrops", "strawberry"], ["vegetableCrops", "garlic"], ["ornamentalCrops", "floriculture_generic"]];
function run(src, w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    const BC = "botrytis_cinerea";
    ok(K.SAG_KERNEL_VERSION === "v50.186 · 2026-11-07", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const p = Object.values(K.PATHOGEN_PROFILE).map((c) => c && c[BC]).find(Boolean);
    const has = (g, c) => p.crops.some((x) => x.cultivation_type_general === g && x.cultivation_type === c);
    ok(NEW.every(([g, c]) => has(g, c)), "Π1 οι 7 νέοι ξενιστές στο προφίλ (λείπουν: " + NEW.filter(([g, c]) => !has(g, c)).map((x) => x[1]).join(",") + ")");
    ok(OLD.every(([g, c]) => has(g, c)) && p.crops.length === 19, "Π2 οι 12 παλιοί μένουν, σύνολο 19 (" + p.crops.length + ")");
    ok(p.optimalTempRange.min === 5 && p.optimalTempRange.max === 30 && p.optimalHumidity.min === 92 && p.requiredDurationHrs === 10 && p.type === "Infection_Triangle", "Π3 τα όρια του βοτρύτη ΔΕΝ άλλαξαν (5–30 °C, RH 92, 10 ώρες)");
    ok(!has("olive", "koroneiki") && !has("vegetableCrops", "watermelon") && !has("stoneFruits", "apricot"), "Π4 καμία καλλιέργεια πέρα από τις εγκεκριμένες");
    // Α. αγγούρι θερμοκηπίου, 18 °C, RH 92, μετρημένο υγρό φύλλο, 10 ώρες → μετρητής 10, κάρτα «Υψηλός» με επιθεώρηση
    const a = series(K, T_NOV, 10, { T: 18, RH: 92, lm: 60, lt: 17.5 }, CUC);
    ok(a.cnt(BC) === 10 && a.firOf(BC) >= 0.49, "Α1 αγγούρι: 10 ώρες βοτρύτη, FIR ≥ 0,5 (κλάσεις W(T), v50.184) (" + a.cnt(BC) + "/" + a.firOf(BC) + ")");
    const am = a.msg(BC);
    ok(am && am.value === "Υψηλός κίνδυνος" && /βοτρύτη/.test(am.metadata.text) && /[Εε]πιθεωρήστε/.test(am.metadata.text), "Α2 αγγούρι: «Υψηλός» με επιθεώρηση για βοτρύτη (" + JSON.stringify(am) + ")");
    const a0 = series(K, T_NOV, 4, { T: 18, RH: 60 }, CUC);
    ok(a0.cnt(BC) === 0 && a0.msg(BC) && a0.msg(BC).value === "Χαμηλός κίνδυνος", "Α3 αγγούρι στεγνό: 0 ώρες, κάρτα «Χαμηλός» υπάρχει (" + a0.cnt(BC) + ", " + JSON.stringify(a0.msg(BC)) + ")");
    ok(a.cnt("pseudoperonospora_cubensis") === 10, "Α4 ο περονόσπορος κολοκυνθοειδών μετρά όπως πριν (" + a.cnt("pseudoperonospora_cubensis") + ")");
    // Β. κάθε νέος ξενιστής βγάζει μετρητή και κάρτα
    for (const [g, c] of NEW) { const r = series(K, T_NOV, 10, { T: 18, RH: 95, lm: 60, lt: 17.5 }, mk(g, c)); ok(r.cnt(BC) === 10 && r.msg(BC), "Β " + c + ": μετρητής 10 και κάρτα (" + r.cnt(BC) + ")"); }
    // Γ. μη ξενιστές: ούτε μετρητής ούτε κάρτα
    for (const [g, c] of [["olive", "koroneiki"], ["vegetableCrops", "watermelon"]]) { const r = series(K, T_NOV, 10, { T: 18, RH: 95, lm: 60, lt: 17.5 }, mk(g, c)); ok(r.cnt(BC) === null && !r.msg(BC), "Γ " + c + ": χωρίς βοτρύτη (" + r.cnt(BC) + ")"); }
    // Δ. widget: κανένα ζεύγος βοτρύτη του πυρήνα δεν κρύβεται, ούτε περισσεύει
    const hi = w.indexOf("sagHostMap={"); const he = w.indexOf("}", hi); const hm = new Function("return (" + w.slice(hi + 11, he + 1) + ")")();
    const kset = p.crops.map((x) => x.cultivation_type_general + ":" + x.cultivation_type).sort(); const wset = (hm[BC] || []).slice().sort();
    ok(JSON.stringify(kset) === JSON.stringify(wset), "Δ1 χάρτης ξενιστών widget = προφίλ πυρήνα για τον βοτρύτη (πυρήνας−widget: " + kset.filter((x) => wset.indexOf(x) < 0).join(",") + " · widget−πυρήνας: " + wset.filter((x) => kset.indexOf(x) < 0).join(",") + ")");
    const hidden = [];
    for (const cat of Object.values(K.PATHOGEN_PROFILE)) for (const [k, pp] of Object.entries(cat)) { if (!hm[k]) continue; for (const c of (pp.crops || [])) { const hk = c.cultivation_type_general + ":" + c.cultivation_type; if (hm[k].indexOf(hk) < 0) hidden.push(k + "←" + hk); } }
    ok(hidden.length === 0, "Δ2 κανένα ζεύγος παθογόνο/ξενιστής του πυρήνα δεν κρύβεται από το widget (" + hidden.join(",") + ")");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(SRC, W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const E2 = (a, b) => '          cultivation_type: "' + a + '"\n        },\n        {\n          cultivation_type_general: "vegetableCrops",\n          cultivation_type: "' + b + '"';
const PE = (c) => '          cultivation_type_general: "stoneFruits",\n          cultivation_type: "' + c + '"\n        },\n        {\n          cultivation_type_general: "ornamentalCrops",';
const RH = (rh, h) => "      optimalHumidity: { min: " + rh + ", max: 100 },\n      requiredDurationHrs: " + h + ",\n      notes: \"Απαιτεί πολύ υψηλή υγρασία";
const M = [
  ["M1 χωρίς αγγούρι στον πυρήνα", "k", E2("cucumber", "zucchini"), E2("watermelon", "zucchini")],
  ["M2 χωρίς σταφίδα στον πυρήνα", "k", E2("raisin_grapes", "onion"), E2("wine_grapes", "onion")],
  ["M3 χωρίς ροδακινιά στον πυρήνα", "k", PE("peach"), PE("apricot")],
  ["M4 όριο RH βοτρύτη 80", "k", RH(92, 10), RH(80, 10)],
  ["M5 βοτρύτης 6 ώρες", "k", RH(92, 10), RH(92, 6)],
  ["M6 widget χωρίς αγγούρι", "w", '"vegetableCrops:garlic","vegetableCrops:cucumber","vegetableCrops:zucchini"', '"vegetableCrops:garlic","vegetableCrops:zucchini"'],
  ["M7 widget χωρίς κουκί", "w", '"vegetableCrops:onion","vegetableCrops:dry_beans","vegetableCrops:faba_bean"', '"vegetableCrops:onion","vegetableCrops:dry_beans"'],
  ["M8 widget με καρπούζι", "w", '"vegetableCrops:cabbage","stoneFruits:peach"', '"vegetableCrops:cabbage","vegetableCrops:watermelon","stoneFruits:peach"'],
];
let bad = 0;
for (const [n, where, a, b] of M) {
  const S0 = where === "k" ? SRC : W;
  if (S0.split(a).length !== 2) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ " + n); bad++; continue; }
  const r = where === "k" ? run(SRC.replace(a, b), W) : run(SRC, W.replace(a, b));
  console.log((r.length ? "ΣΚΟΤΩΘΗΚΕ " : "ΕΠΕΖΗΣΕ ") + n);
  if (!r.length) bad++;
}
console.log(bad ? "ΑΠΟΤΥΧΙΑ: " + bad + " μεταλλάξεις επέζησαν ή ήταν άκυρες" : "ΟΛΕΣ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΣΚΟΤΩΘΗΚΑΝ (" + M.length + "/" + M.length + ")");
process.exit(bad ? 1 : 0);
