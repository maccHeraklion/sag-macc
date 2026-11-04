// Ελεγκτής T-LEAFWET-RH-01 (v50.176, 4/11/2026): μετρημένο υγρό φύλλο υπερισχύει του ορίου RH για τα παθογόνα
// που απαιτούν υγρό φύλλο· περονόσποροι + βοτρύτης με μήνυμα επιθεώρησης. Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό
// πυρήνα και τρέχει ωριαίους παλμούς με τις τιμές που μετρήθηκαν στον Κουτσάκη (RH μέγ. 92,5 %) και στον
// Γρινιαράκη (RH μέγ. 89,5 %). Κάθε μετάλλαξη πρέπει να σκοτώνεται.
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
    msg: (k) => g(msgs, "fir_message_" + k), lws: g(ih, "leaf_wetness_source") };
}
function series(K, n, o, crop) { let st = { data: {} }, r = null; for (let h = 1; h <= n; h++) r = tick(K, st, h, o, crop); return r; }
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  const realNow = Date.now;
  try {
    Date.now = () => Date.parse("2026-11-04T10:00:00Z");
    const PC = "pseudoperonospora_cubensis", PI = "phytophthora_infestans", BC = "botrytis_cinerea", PX = "podosphaera_xanthii", AS = "alternaria_solani";
    // Α. Κουτσάκης: T 19, RH 92 (κάτω από το όριο 95), αισθητήρας φύλλου 60 % → μετρά
    const a = series(K, 6, { T: 19, RH: 92, lm: 60, lt: 18.5 }, CUKE);
    ok(a.cnt(PC) === 6 && a.firOf(PC) >= 0.99, "Α1 RH 92 < 95 με μετρημένο υγρό φύλλο: 6 ώρες, FIR 1 (" + a.cnt(PC) + "/" + a.firOf(PC) + ")");
    ok(a.lws && a.lws.value === "Αισθητήρας φύλλου", "Α2 πηγή: αισθητήρας φύλλου (" + (a.lws && a.lws.value) + ")");
    const am = a.msg(PC);
    ok(am && am.value === "Υψηλός κίνδυνος" && am.metadata.color === "orange" && /για περονόσπορο \(6ω υγρά φύλλα/.test(am.metadata.text) && /επιθεωρήστε το φύλλωμα/.test(am.metadata.text) && !/Σοβαρός|το συντομότερο/.test(am.metadata.text), "Α3 μήνυμα: Υψηλός/πορτοκαλί με επιθεώρηση για περονόσπορο (" + JSON.stringify(am) + ")");
    // Β. Γρινιαράκης: T 17, RH 89 (όριο 90 / 92), φύλλο 60 %
    const b = series(K, 10, { T: 17, RH: 89, lm: 60, lt: 16.5 }, TOM);
    ok(b.cnt(PI) === 10 && b.cnt(BC) === 10, "Β1 ντομάτα RH 89: περονόσπορος και βοτρύτης 10 ώρες (" + b.cnt(PI) + "/" + b.cnt(BC) + ")");
    ok(b.msg(BC) && b.msg(BC).value === "Υψηλός κίνδυνος" && /για βοτρύτη/.test(b.msg(BC).metadata.text), "Β2 βοτρύτης: επιθεώρηση (" + JSON.stringify(b.msg(BC)) + ")");
    ok(b.cnt(AS) === 10, "Β3 αλτερνάρια (T-LITVALUES-01: Tmin 13, μετρημένο υγρό φύλλο) μετρά 10 ώρες στους 17 °C (" + b.cnt(AS) + ")");
    // Γ. χωρίς αισθητήρα φύλλου: RH 92 → διαβροχή από εκτίμηση, το όριο RH ισχύει όπως πριν
    const c = series(K, 6, { T: 19, RH: 92 }, CUKE);
    ok(c.cnt(PC) === 6 && c.lws && /Σχετική υγρασία|Δρόσος \(εκτίμηση\)/.test(c.lws.value), "Γ1 χωρίς όργανο, RH 92: με οροφή 90 (T-RH-CAP-90-01) μετρά (" + c.cnt(PC) + ", " + (c.lws && c.lws.value) + ")");
    const c3 = series(K, 6, { T: 19, RH: 89 }, CUKE);
    ok(c3.cnt(PC) === 0, "Γ1β χωρίς όργανο, RH 89: στεγνό, δεν μετρά (" + c3.cnt(PC) + ")");
    const c4 = series(K, 6, { T: 17, RH: 91 }, TOM);
    ok(c4.cnt(BC) === 6 && c4.cnt(PI) === 6, "Γ1γ ντομάτα χωρίς όργανο, RH 91: βοτρύτης (92→90) και περονόσπορος μετρούν (" + c4.cnt(BC) + "/" + c4.cnt(PI) + ")");
    const ORANGE = { cultivation_type_general: "citrusFruits", cultivation_type: "orange", stage: "fruiting", name: "ΠΟΡΤΟΚΑΛΙ", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
    // Γ1δ (ενημέρωση v50.179): η φυτόφθορα εσπεριδοειδών είναι εκτός μηχανής φύλλου από v50.178· η εξαίρεση της οροφής ελέγχεται στο ωίδιο με όριο 95 στο προφίλ (προσωρινά).
    const _pEN = Object.values(K.PATHOGEN_PROFILE).map((c) => c && c.leveillula_taurica).find(Boolean); const _oldMin = _pEN.optimalHumidity.min; _pEN.optimalHumidity.min = 95;
    const c5 = series(K, 6, { T: 20, RH: 92 }, TOM); _pEN.optimalHumidity.min = _oldMin;
    const c6 = series(K, 6, { T: 19, RH: 87, dp: 18 }, CUKE);
    ok(c6.cnt(PC) === 0 && c6.lws && /Δρόσος \(εκτίμηση\)/.test(c6.lws.value), "Γ1ε εκτίμηση δρόσου από αέρα με RH 87: κάτω από την οροφή 90, δεν μετρά (" + c6.cnt(PC) + ", " + (c6.lws && c6.lws.value) + ")");
    ok(c5.cnt("leveillula_taurica") === 0, "Γ1δ ωίδιο σολανωδών (χωρίς απαίτηση υγρού φύλλου) με όριο 95: η οροφή 90 ΔΕΝ ισχύει, RH 92 δεν μετρά (" + c5.cnt("leveillula_taurica") + ")");
    const c2 = series(K, 6, { T: 19, RH: 96 }, CUKE);
    ok(c2.cnt(PC) === 6, "Γ2 χωρίς όργανο, RH 96: μετρά όπως πριν");
    // Δ. δρόσος στο φύλλο (μετρημένη θερμοκρασία φύλλου ≤ σημείο δρόσου, σκιασμένο): μετρά
    const d = series(K, 6, { T: 19, RH: 88, dp: 17.4, lm: 5, lt: 17.0 }, CUKE);
    ok(d.cnt(PC) === 6 && d.lws && d.lws.value === "Δρόσος (θερμ. φύλλου)", "Δ1 δρόσος στο φύλλο (μετρημένη θερμοκρασία φύλλου) μετρά και με RH 88 (" + d.cnt(PC) + ", " + (d.lws && d.lws.value) + ")");
    // Ε. ωίδιο δεν θέλει υγρό φύλλο: RH 40 με βρεγμένο φύλλο ΔΕΝ μετρά (όριο RH 50 ισχύει)
    const e = series(K, 3, { T: 24, RH: 40, lm: 60, lt: 23.5 }, CUKE);
    ok(e.cnt(PX) === 0, "Ε1 ωίδιο: το υγρό φύλλο δεν παρακάμπτει το όριο RH (" + e.cnt(PX) + ")");
    // ΣΤ. θερμοκρασία εκτός ορίου: δεν μετρά
    const s6 = series(K, 3, { T: 3, RH: 92, lm: 60, lt: 2.5 }, CUKE);
    ok(s6.cnt(PC) === 0, "ΣΤ1 T 3 °C: δεν μετρά");
    // Ζ. παγωμένος αισθητήρας φύλλου: ο μετρητής μένει
    let st = { data: {} }; for (let h = 1; h <= 3; h++) tick(K, st, h, { T: 19, RH: 92, lm: 60, lt: 18.5 }, CUKE);
    const z = tick(K, st, 4, { T: 19, RH: 92, lm: 60, lt: 18.5, ages: { leaf_temperature: 300, leaf_moisture: 300 } }, CUKE);
    ok(z.cnt(PC) === 3, "Ζ1 παλιό όργανο φύλλου: ο μετρητής παγώνει στις 3 (" + z.cnt(PC) + ")");
    // Η. στεγνό φύλλο από σκιασμένο αισθητήρα: δεν μετρά ούτε με RH 96
    const h = series(K, 3, { T: 19, RH: 96, lm: 0, lt: 18.9 }, CUKE);
    ok(h.cnt(PC) === 0, "Η1 σκιασμένος αισθητήρας στεγνός, RH 96: δεν μετρά (T-LWS-SHADED-DRY-01 αμετάβλητο)");
    // Θ. μηνύματα: ημερολόγιο αμπελιού για τον περονόσπορο, όπως το ωίδιο
    const ph = K._sagMildewPhase, PV = "plasmopara_viticola";
    ok(ph(PV, 515) === "critical" && ph(PV, 115) === "silent" && ph(PV, 1104) === "normal" && ph(PI, 115) === "normal" && ph(BC, 115) === "normal" && ph(AS, 515) === "off", "Θ1 περίοδοι (" + [ph(PV, 515), ph(PV, 115), ph(PV, 1104), ph(PI, 115), ph(BC, 115), ph(AS, 515)].join(",") + ")");
    const msg = (iso, key, v) => { Date.now = () => Date.parse(iso); return (K.getPathogenMessages([{ variable: "fir_" + key, value: v }], { timezone: "Europe/Athens", data: {} }) || []).find((x) => x.variable === "fir_message_" + key); };
    const NOV = "2026-11-04T10:00:00Z", MAY = "2026-05-15T10:00:00Z", JAN = "2026-01-15T10:00:00Z";
    const t1 = msg(MAY, PV, 0.9); ok(t1 && t1.value === "Σοβαρός κίνδυνος" && t1.metadata.color === "red", "Θ2 αμπέλι Μάιος: Σοβαρός όπως πριν");
    const t2 = msg(JAN, PV, 0.9); ok(t2 && t2.value === "Χαμηλός κίνδυνος" && /τον περονόσπορο του αμπελιού/.test(t2.metadata.text), "Θ3 αμπέλι Ιανουάριος: σιωπή με σωστό όνομα (" + JSON.stringify(t2) + ")");
    const t3 = msg(NOV, PV, 0.9); ok(t3 && t3.value === "Υψηλός κίνδυνος" && /για περονόσπορο/.test(t3.metadata.text), "Θ4 αμπέλι Νοέμβριος: επιθεώρηση");
    const t4 = msg(JAN, BC, 0.9); ok(t4 && t4.value === "Υψηλός κίνδυνος" && /για βοτρύτη/.test(t4.metadata.text), "Θ5 βοτρύτης Ιανουάριος: επιθεώρηση");
    const t5 = msg(NOV, "erysiphe_necator", 0.9); ok(t5 && /για ωίδιο/.test(t5.metadata.text), "Θ6 ωίδιο: ίδιο κείμενο όπως πριν");
    const t6 = msg(NOV, AS, 0.9); ok(t6 && t6.value === "Σοβαρός κίνδυνος" && t6.metadata.color === "red", "Θ7 αλτερνάρια: όπως πριν");
    const t7 = msg(NOV, PI, 0.3); ok(t7 && t7.value === "Μέτριος κίνδυνος", "Θ8 κάτω από 0,4: όπως πριν");
    ok(msg(NOV, "peronospora_destructor", 0.9).value === "Υψηλός κίνδυνος" && msg(NOV, "brassica_downy_mildew", 0.9).value === "Υψηλός κίνδυνος", "Θ9 κρεμμύδι/σταυρανθή: επιθεώρηση");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); } finally { Date.now = realNow; }
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 χωρίς παράκαμψη", "const humidityOk = RH >= _rhMin || (needsWet && _lwsMeasuredWet);", "const humidityOk = RH >= _rhMin;"],
  ["M2 παράκαμψη και για ωίδια", "const humidityOk = RH >= _rhMin || (needsWet && _lwsMeasuredWet);", "const humidityOk = RH >= _rhMin || _lwsMeasuredWet;"],
  ["M3 κάθε υγρό φύλλο (και εκτίμηση)", "const _lwsMeasuredWet = leafIsWet && (_lws.source === 'sensor' || _lws.source === 'dew_leaf');", "const _lwsMeasuredWet = leafIsWet;"],
  ["M4 χωρίς δρόσο φύλλου", "(_lws.source === 'sensor' || _lws.source === 'dew_leaf')", "(_lws.source === 'sensor')"],
  ["M5 βοτρύτης εκτός λίστας", "'brassica_downy_mildew', 'botrytis_cinerea'];", "'brassica_downy_mildew'];"],
  ["M6 περονόσπορος αμπελιού χωρίς ημερολόγιο", "if (key !== 'erysiphe_necator' && key !== 'plasmopara_viticola') return 'normal';", "if (key !== 'erysiphe_necator') return 'normal';"],
  ["M7 όνομα", "key === 'botrytis_cinerea' ? 'βοτρύτη' : 'περονόσπορο'", "'περονόσπορο'"],
  ["M11 χωρίς αιτία", "(_SAG_WET_INSPECT.indexOf(pathogenKey) >= 0 && _whyFor(pathogenKey, pathogen) ? ' (' + _whyFor(pathogenKey, pathogen) + ')' : '')", "''"],
  ["M8 σιωπή με λάθος όνομα", "(key === 'plasmopara_viticola' ? 'τον περονόσπορο' : 'το ωίδιο')", "'το ωίδιο'"],
  ["M9 η πύλη θερμοκρασίας", "const conditionsOk = tempOk && humidityOk && wetOk && !rainInhibit && !_wetInhibit && _inSeason;", "const conditionsOk = humidityOk && wetOk && !rainInhibit && !_wetInhibit && _inSeason;"],
  ["M10 πάγωμα οργάνου", "const _frozenHere = _ihFrozen || (needsWet && _leafFrozen);", "const _frozenHere = _ihFrozen;"],
  ["M12 χωρίς οροφή", "const _rhMin = needsWet ? Math.min(Number(_oh.min), _SAG_WET_RH_CAP) : Number(_oh.min);", "const _rhMin = Number(_oh.min);"],
  ["M13 οροφή και στα χωρίς υγρό φύλλο", "const _rhMin = needsWet ? Math.min(Number(_oh.min), _SAG_WET_RH_CAP) : Number(_oh.min);", "const _rhMin = Math.min(Number(_oh.min), _SAG_WET_RH_CAP);"],
  ["M14 οροφή 85", "const _SAG_WET_RH_CAP     = 90;", "const _SAG_WET_RH_CAP     = 85;"],
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
