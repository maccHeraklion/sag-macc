// Ελεγκτής ΑΛΥΣΙΔΑΣ ΑΣΘΕΝΕΙΩΝ (εντολή Μιχάλη 24/9): «όλα τα εμπλεκόμενα μέρη στον υπολογισμό
// ασθενειών λειτουργούν σωστά, υπάρχει ευαισθησία και θα έχουμε ενδείξεις όταν πραγματικά
// υπάρχουν οι συνθήκες». Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα (runPerTich.js) σε test mode
// και προσομοιώνει ωριαίους παλμούς όπως ο βρόχος παραγωγής (InfectionHours -> ένεση -> FIR ->
// getPathogenMessages -> πακετάρισμα bundle -> ανάγνωση widget). Κάθε μετάλλαξη πρέπει να σκοτώνεται.
// Απαιτεί analysis/node_modules (moment-timezone, axios) — gitignored· `npm i moment-timezone axios --no-save`.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const req = createRequire(corePath);
try { req.resolve("moment-timezone"); } catch (e) { console.log("ΑΔΥΝΑΤΟ: λείπει moment-timezone — `cd analysis && npm i moment-timezone axios --no-save`"); process.exit(1); }

// ── φόρτωση ολόκληρου του πυρήνα ως συνάρτηση, με πρόσβαση στα εσωτερικά του ──
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_VPD, calculate_IPSI, calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages,"
    + " _sagInfectionAheadIndicators, packCalculatedIndicators, compressFieldBundle, decompressFieldBundle, PATHOGEN_PROFILE, _sagLeafWetness,"
    + " setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; }, setTick: (h) => { _SAG_TICK_H = h; } };";
  const mod = { exports: {} };
  const proc = { env: { RPERTICH_TEST_MODE: "true" }, exit: () => {}, on: () => {} };
  const quiet = { log: () => {}, warn: () => {}, error: () => {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, proc, quiet, path.dirname(corePath), corePath);
}

// ── προσομοίωση αγρού: αγγούρι σε θερμοκήπιο (Κουτσάκης) με em320 (temperature/humidity) + lms01 ──
const CROP = { cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber", stage: "fruiting", name: "ΔΟΚΙΜΗ",
  covered_cultivation: true, soil_type: "silty_clay_loam", area: 1950, irrigation_system: "dripIrrigation" };
const GRAPE = { cultivation_type_general: "vineCrops", cultivation_type: "wine_grapes", stage: "fruit_dev", name: "ΑΜΠΕΛΙ" };
const T0 = Date.UTC(2026, 8, 24, 20, 0, 0);
function mkMeas(prevData, hour, o) {
  const now = new Date(T0 + hour * 3600e3);
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH;
  const dp = Number.isFinite(o.dp) ? o.dp : (T - (100 - RH) / 5);   // Magnus-ish
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; else delete data.leaf_moisture;
  if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }]; else delete data.leaf_temperature;
  if (o.rain !== undefined) data.rain_height_hourly = [{ value: o.rain }]; else delete data.rain_height_hourly;
  data.ipsi_avg = [{ value: o.ipsi ?? 2 }];
  data._sagAges = Object.assign({ temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 }, o.ages || {});
  return { timezone: "Europe/Athens", now, _prevBundleTime: new Date(T0 + (hour - 1) * 3600e3).toISOString(), data };
}
// ένας ωριαίος παλμός όπως ο βρόχος παραγωγής (γρ. ~19282–19332)
function tick(K, state, hour, o, crop = CROP, daily = false) {
  K.setTick(1); K.setCovered(!!crop.covered_cultivation);
  const meas = mkMeas(state.data, hour, o);
  if (o.spray) meas.data["last_spray_" + o.spray.key] = [{ value: JSON.stringify({ d: o.spray.d, p: o.spray.p, n: o.spray.n }) }];
  const gdd = K.calculate_GDD(true, daily, meas, crop) || [];
  for (const g of gdd) if (g && g.variable) meas.data[g.variable] = [{ value: g.value }];
  const ih = K.calculate_InfectionHours(true, meas, crop) || [];
  for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
  const ipsiArr = [{ variable: "ipsi", value: o.ipsi ?? 2 }];
  const fir = K.calculate_FIR(true, daily, meas, ipsiArr, crop) || [];
  for (const x of fir) meas.data[x.variable] = [{ value: x.value }];
  const msgs = K.getPathogenMessages(fir, meas) || [];
  // η επόμενη ώρα βλέπει τους συσσωρευτές όπως τους έγραψε το bundle
  state.data = {};
  for (const x of [...gdd, ...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_|fir_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  if (o.spray) state.data["last_spray_" + o.spray.key] = meas.data["last_spray_" + o.spray.key];
  const g = (arr, v) => { const e = arr.find(x => x && x.variable === v); return e ? e : null; };
  return { gdd, ih, fir, msgs, cnt: (k) => Number((g(ih, "infection_hours_counter_" + k) || {}).value ?? NaN),
    firOf: (k) => Number((g(fir, "fir_" + k) || {}).value ?? NaN), msg: (k) => g(msgs, "fir_message_" + k) || g(fir, "fir_message_" + k),
    status: g(ih, "infection_model_status"), lws: g(ih, "leaf_wetness_source") };
}
function run(src, w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  // ── Α. ωίδιο κολοκυνθοειδών (podosphaera_xanthii): 12 ω, T 15–30, RH ≥ 50, ΧΩΡΙΣ διαβροχή ──
  let st = { data: {} }; const ladder = [];
  for (let h = 1; h <= 14; h++) { const r = tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5 }); ladder.push({ h, c: r.cnt("podosphaera_xanthii"), fir: r.firOf("podosphaera_xanthii"), v: (r.msg("podosphaera_xanthii") || {}).value, col: ((r.msg("podosphaera_xanthii") || {}).metadata || {}).color }); }
  const L = (h) => ladder[h - 1];
  ok(L(1).c === 1 && L(6).c === 6 && L(12).c === 12 && L(14).c === 14, "Α1 ο μετρητής ωρών ωιδίου προχωρά +1/ώρα με T 24 °C, RH 70 % (" + ladder.map(x => x.c).join(",") + ")");
  ok(L(2).v === "Χαμηλός κίνδυνος" && L(2).col === "green", "Α2 2 ώρες -> Χαμηλός/πράσινο (" + L(2).v + ")");
  ok(L(6).v === "Μέτριος κίνδυνος" && L(6).col === "blue", "Α3 6 ώρες -> Μέτριος/μπλε (" + L(6).v + ", fir " + L(6).fir + ")");
  ok(L(10).v === "Υψηλός κίνδυνος" && L(10).col === "yellow", "Α4 10 ώρες -> Υψηλός/κίτρινο (" + L(10).v + ", fir " + L(10).fir + ")");
  ok(L(12).v === "Σοβαρός κίνδυνος" && L(12).col === "red" && L(12).fir >= 0.99, "Α5 12 ώρες (= requiredDurationHrs) -> Σοβαρός/κόκκινο, FIR 1 (" + L(12).v + ", fir " + L(12).fir + ")");
  ok(ladder.every((x, i) => i === 0 || x.fir >= ladder[i - 1].fir), "Α6 το FIR είναι μονότονο όσο συνεχίζουν οι συνθήκες");
  const m12 = st && L(12); const msgTxt = String(((tick(K, { data: {} }, 1, { T: 24, RH: 70, lm: 0, lt: 23.5 }).msg("podosphaera_xanthii") || {}).metadata || {}).text || "");
  ok(/Χωρίς κίνδυνο/.test(msgTxt), "Α7 το κείμενο χαμηλού κινδύνου υπάρχει");
  // ξανά 12 ώρες για να διαβάσω το κείμενο του σοβαρού
  st = { data: {} }; let r12 = null; for (let h = 1; h <= 12; h++) r12 = tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5 });
  const sev = r12.msg("podosphaera_xanthii");
  ok(sev && /12ω ευνοϊκός καιρός/.test(sev.metadata.text) && /χωρίς προστασία/.test(sev.metadata.text) && /Ψεκάστε/.test(sev.metadata.text), "Α8 το σοβαρό μήνυμα λέει αιτία (12ω ευνοϊκός καιρός), προστασία και ενέργεια — " + (sev && sev.metadata.text));
  ok(r12.status && /^Ενεργές · \d+ μύκητ/.test(String(r12.status.value)), "Α9 infection_model_status ενεργό με αριθμό (" + (r12.status && r12.status.value) + ")");
  // ── Β. περονόσπορος κολοκυνθοειδών (pseudoperonospora_cubensis): 6 ω, T 5–30, RH ≥ 95, ΜΕ διαβροχή ──
  st = { data: {} }; let rB = null; for (let h = 1; h <= 6; h++) rB = tick(K, st, h, { T: 19, RH: 97, lm: 60, lt: 18.5 });
  ok(rB.cnt("pseudoperonospora_cubensis") === 6 && rB.firOf("pseudoperonospora_cubensis") >= 0.99 && (rB.msg("pseudoperonospora_cubensis") || {}).value === "Σοβαρός κίνδυνος", "Β1 6 ω υγρό φύλλο (αισθητήρας 60 %) + RH 97 + 19 °C -> Σοβαρός περονόσπορος (" + rB.cnt("pseudoperonospora_cubensis") + " ω, fir " + rB.firOf("pseudoperonospora_cubensis") + ")");
  ok(rB.lws && rB.lws.value === "Αισθητήρας φύλλου", "Β2 η πηγή διαβροχής είναι ο αισθητήρας φύλλου (" + (rB.lws && rB.lws.value) + ")");
  ok(/υγρά φύλλα/.test(String((rB.msg("pseudoperonospora_cubensis") || {}).metadata.text)), "Β3 το μήνυμα λέει «υγρά φύλλα»");
  // Β4 χωρίς αισθητήρα φύλλου: RH 96 -> δρόσος εκτίμηση ή RH -> ΠΑΛΙ μετρά (ευαισθησία χωρίς όργανο)
  st = { data: {} }; let rB4 = null; for (let h = 1; h <= 6; h++) rB4 = tick(K, st, h, { T: 19, RH: 96 });
  ok(rB4.cnt("pseudoperonospora_cubensis") === 6 && rB4.lws && /Δρόσος|Σχετική υγρασία/.test(rB4.lws.value), "Β4 χωρίς αισθητήρα φύλλου, RH 96 -> διαβροχή από δρόσο/RH, ο μετρητής προχωρά (" + (rB4.lws && rB4.lws.value) + ", " + rB4.cnt("pseudoperonospora_cubensis") + " ω)");
  // Β5 ΜΟΝΟ RH (χωρίς σημείο δρόσου, χωρίς φύλλο): RH 91 -> «Σχετική υγρασία», RH 89 -> στεγνό
  const lw1 = K._sagLeafWetness({ T_air: 19, RH: 91 }), lw2 = K._sagLeafWetness({ T_air: 19, RH: 89 });
  ok(lw1.wet === true && lw1.source === "rh" && lw2.wet === false && lw2.source === "none", "Β5 εφεδρεία RH ≥ 90: 91 -> υγρό (rh), 89 -> στεγνό");
  // Β6 στεγνός ΣΚΙΑΣΜΕΝΟΣ αισθητήρας ΔΕΝ σβήνει τη δρόσο (κώδικας: dew_air πριν το sensor_dry) — καταγράφεται ως συμπεριφορά
  const lw3 = K._sagLeafWetness({ leafMoisture: 0, leafShaded: true, leafTemp: 22, T_air: 19, RH: 96, dewPoint: 18.4 });
  ok(lw3.wet === true && lw3.source === "dew_air", "Β6 [ΣΥΜΠΕΡΙΦΟΡΑ] στεγνός σκιασμένος αισθητήρας + RH 96/δρόσος -> ΥΓΡΟ από «δρόσος (εκτίμηση)» — η μέτρηση φύλλου ΔΕΝ υπερισχύει (" + lw3.source + ")");
  // ── Γ. αρνητικοί μάρτυρες ──
  st = { data: {} }; let rC = null; for (let h = 1; h <= 14; h++) rC = tick(K, st, h, { T: 24, RH: 40, lm: 0, lt: 23.5 });
  ok(rC.cnt("podosphaera_xanthii") === 0 && rC.cnt("pseudoperonospora_cubensis") === 0 && (rC.msg("podosphaera_xanthii") || {}).value === "Χαμηλός κίνδυνος" && (rC.msg("pseudoperonospora_cubensis") || {}).value === "Χαμηλός κίνδυνος", "Γ1 RH 40 %, στεγνό: κανένας μετρητής, όλα Χαμηλός");
  st = { data: {} }; let rC2 = null; for (let h = 1; h <= 14; h++) rC2 = tick(K, st, h, { T: 31, RH: 70, lm: 0, lt: 30 });
  ok(rC2.cnt("podosphaera_xanthii") === 0, "Γ2 T 31 °C (> max 30) -> ωίδιο δεν μετρά");
  st = { data: {} }; let rC3 = null; for (let h = 1; h <= 2; h++) rC3 = tick(K, st, h, { T: 30, RH: 50, lm: 0, lt: 29 });
  ok(rC3.cnt("podosphaera_xanthii") === 2, "Γ3 όρια συμπεριληπτικά: T 30, RH 50 -> μετρά");
  st = { data: {} }; let rC4 = null; for (let h = 1; h <= 6; h++) rC4 = tick(K, st, h, { T: 19, RH: 97, lm: 5, lt: 18.5, dp: 5 });
  ok(rC4.cnt("pseudoperonospora_cubensis") === 6, "Γ4 RH 97 χωρίς αισθητήρα-υγρό και δρόσο μακριά -> εφεδρεία RH ≥ 90 κρατά τον περονόσπορο ενεργό (" + rC4.cnt("pseudoperonospora_cubensis") + ")");
  // ── Δ. παγώματα ──
  st = { data: {} }; for (let h = 1; h <= 5; h++) tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5 });
  const rD = tick(K, st, 6, { T: 24, RH: 70, lm: 0, lt: 23.5, ages: { temperature: 200, humidity: 200 } });
  ok(rD.cnt("podosphaera_xanthii") === 5 && rD.status && /Σε παύση/.test(rD.status.value), "Δ1 παλιά μέτρηση αέρα (200΄ > 90΄): ο μετρητής ΠΑΓΩΝΕΙ στο 5 και το δηλώνει (" + (rD.status && rD.status.value) + ")");
  st = { data: {} }; for (let h = 1; h <= 3; h++) tick(K, st, h, { T: 19, RH: 97, lm: 60, lt: 18.5 });
  const rD2 = tick(K, st, 4, { T: 19, RH: 97, lm: 60, lt: 18.5, ages: { leaf_temperature: 200, leaf_moisture: 200 } });
  ok(rD2.cnt("pseudoperonospora_cubensis") === 3 && rD2.lws && /ΠΑΥΣΗ/.test(String(rD2.lws.metadata.text)), "Δ2 παλιός αισθητήρας φύλλου: ο περονόσπορος (θέλει διαβροχή) παγώνει στο 3 (" + rD2.cnt("pseudoperonospora_cubensis") + ")");
  ok(rD2.cnt("podosphaera_xanthii") === 4, "Δ3 …ενώ το ωίδιο (χωρίς διαβροχή) συνεχίζει: 4 (" + rD2.cnt("podosphaera_xanthii") + ")");
  // ── Ε. διακοπή συνθηκών: ο ωριαίος μετρητής μηδενίζει, το ΜΕΓΙΣΤΟ κρατά το επεισόδιο ως το ημερήσιο tick ──
  st = { data: {} }; for (let h = 1; h <= 8; h++) tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5 });
  const rE = tick(K, st, 9, { T: 24, RH: 40, lm: 0, lt: 23.5 });
  ok(rE.cnt("podosphaera_xanthii") === 0 && rE.firOf("podosphaera_xanthii") === L(8).fir && L(8).fir > 0.3, "Ε1 μετά από 8 ευνοϊκές ώρες μία ξηρή: μετρητής 0 αλλά ο κίνδυνος ΔΕΝ χάνεται (max 8 ω -> ίδιο FIR " + rE.firOf("podosphaera_xanthii") + " = " + (rE.msg("podosphaera_xanthii") || {}).value + ")");
  const rE2 = tick(K, st, 10, { T: 24, RH: 40, lm: 0, lt: 23.5 }, CROP, true);
  const rE3 = tick(K, st, 11, { T: 24, RH: 40, lm: 0, lt: 23.5 });
  ok((rE3.msg("podosphaera_xanthii") || {}).value === "Χαμηλός κίνδυνος", "Ε2 μετά το ημερήσιο tick το μέγιστο καταναλώνεται -> Χαμηλός (" + (rE3.msg("podosphaera_xanthii") || {}).value + ")");
  // ── Ζ. βροχή ξεπλένει το ωίδιο αμπελιού (rainInhibitsInfection) ──
  st = { data: {} }; for (let h = 1; h <= 4; h++) tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5 }, GRAPE);
  const rZ = tick(K, st, 5, { T: 24, RH: 70, lm: 0, lt: 23.5, rain: 3.0 }, GRAPE);
  ok(rZ.cnt("erysiphe_necator") === 0, "Ζ1 αμπέλι: 3 mm/ω βροχή μηδενίζει το ωίδιο (" + rZ.cnt("erysiphe_necator") + ")");
  ok(!("infection_hours_counter_erysiphe_necator" in Object.fromEntries(rC.ih.map(x => [x.variable, 1]))), "Ζ2 το ωίδιο αμπελιού ΔΕΝ υπολογίζεται για αγγούρι (T-OIDIO-SPLIT-01)");
  // ── Η. δηλωμένος ψεκασμός μειώνει τον κίνδυνο και αλλάζει το κείμενο ──
  st = { data: {} }; let rH = null; const sprayD = new Date(Date.now() - 1 * 86400e3).toISOString();
  for (let h = 1; h <= 12; h++) rH = tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5, spray: { key: "podosphaera_xanthii", d: sprayD, p: "sulfur", n: 7 } });
  ok(rH.firOf("podosphaera_xanthii") < 0.4 && rH.firOf("podosphaera_xanthii") > 0.2 && (rH.msg("podosphaera_xanthii") || {}).value === "Μέτριος κίνδυνος" && /χωρίς ψεκασμό/.test(String((rH.msg("podosphaera_xanthii") || {}).metadata.text)), "Η1 ψεκασμός χθες (7 ημ., PEI≈0,69): FIR 1 -> " + rH.firOf("podosphaera_xanthii") + " = Μέτριος, «χωρίς ψεκασμό» (" + (rH.msg("podosphaera_xanthii") || {}).value + ")");
  st = { data: {} }; let rH2 = null; const sprayD2 = new Date(Date.now() - 2 * 86400e3).toISOString();
  for (let h = 1; h <= 12; h++) rH2 = tick(K, st, h, { T: 24, RH: 70, lm: 0, lt: 23.5, spray: { key: "podosphaera_xanthii", d: sprayD2, p: "sulfur", n: 7 } });
  ok((rH2.msg("podosphaera_xanthii") || {}).value === "Υψηλός κίνδυνος" && /Προστασία έως \d+\/\d+ — μην ψεκάσετε ξανά/.test(String((rH2.msg("podosphaera_xanthii") || {}).metadata.text)), "Η2 ψεκασμός προχθές (PEI≈0,46): Υψηλός + «Προστασία έως η/μ — μην ψεκάσετε ξανά» (" + String((rH2.msg("podosphaera_xanthii") || {}).metadata.text) + ")");
  ok(rH2.firOf("podosphaera_xanthii") > rH.firOf("podosphaera_xanthii"), "Η3 όσο παλιώνει ο ψεκασμός ο κίνδυνος ανεβαίνει (" + rH.firOf("podosphaera_xanthii") + " -> " + rH2.firOf("podosphaera_xanthii") + ")");
  // ── Θ. έντομα (GDD_Pest) για αγγούρι: φαινολογία με μήνυμα ──
  st = { data: {} }; let rT = null; for (let h = 1; h <= 3; h++) rT = tick(K, st, h, { T: 28, RH: 60, lm: 0, lt: 27 });
  const pests = ["bemisia_tabaci", "myzus_persicae", "tetranychus_urticae"];
  ok(pests.every(k => Number((rT.gdd.find(x => x.variable === "gdd_daily_" + k) || {}).value) > 0), "Θ1 στους 28 °C οι βαθμοημέρες των 3 εχθρών του αγγουριού προχωρούν");
  ok(pests.every(k => rT.msg(k) && rT.msg(k).value && rT.msg(k).metadata && rT.msg(k).metadata.color), "Θ2 κάθε εχθρός έχει fir_message με τιμή και χρώμα (" + pests.map(k => (rT.msg(k) || {}).value).join(" / ") + ")");
  // ── Ι. πρόγνωση: καλυμμένη -> σιωπή· ανοιχτή -> «ευνοείται» όταν έρχονται 6+ υγρές ώρες ──
  const fcs = { ok: true, i0: 0, i1: 24, at: (i) => 19, rh: Array(24).fill(97), rain: Array(24).fill(0) };
  K.setCovered(true); const ia1 = K._sagInfectionAheadIndicators(fcs, CROP, K.PATHOGEN_PROFILE, new Set());
  K.setCovered(false); const ia2 = K._sagInfectionAheadIndicators(fcs, CROP, K.PATHOGEN_PROFILE, new Set());
  ok(ia1.length === 0 && ia2.length === 1 && /Περονόσπορος Κολοκυνθοειδών/.test(ia2[0].metadata.text) && /24 συνεχόμενες/.test(ia2[0].metadata.text), "Ι1 πρόγνωση 24 ω RH 97/19 °C: θερμοκήπιο σιωπά, ανοιχτός αγρός «ευνοείται» ο περονόσπορος");
  const ia3 = K._sagInfectionAheadIndicators({ ok: true, i0: 0, i1: 24, at: () => 19, rh: Array(24).fill(80), rain: Array(24).fill(0) }, CROP, K.PATHOGEN_PROFILE, new Set());
  ok(ia3.length === 0, "Ι2 RH 80 στην πρόγνωση: καμία προειδοποίηση");
  K.setCovered(true);
  // ── Κ. πακετάρισμα bundle -> αποσυμπίεση -> το widget διαβάζει ──
  try {
    const cid = "vegetableCrops:cucumber:1";
    const packedArr = K.packCalculatedIndicators({ sharedIndicators: [], perCropIndicators: { [cid]: [...r12.ih, ...r12.fir, ...r12.msgs] }, prevBundle: null,
      currentCropsConfig: [{ id: cid, cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber" }] });
    const packed = Array.isArray(packedArr) ? packedArr[0] : packedArr;
    const b64 = packed && packed.metadata && packed.metadata.data;
    const dec = typeof b64 === "string" ? K.decompressFieldBundle(b64) : null;
    const crops = (dec && dec.crops) || []; const ind = ((crops.find(c => c && c.id === cid) || crops[0] || {}).indicators) || {};
    ok(typeof b64 === "string" && b64.length < 10000 && crops.length === 1, "Κ0 ένα bundle, μία καλλιέργεια, " + (typeof b64 === "string" ? b64.length : "?") + " B base64");
    const fm = ind.fir_message_podosphaera_xanthii;
    ok(fm && fm.value === "Σοβαρός κίνδυνος" && fm.metadata && fm.metadata.color === "red" && /12ω/.test(fm.metadata.text), "Κ1 το fir_message επιβιώνει στο bundle με τιμή/χρώμα/κείμενο (" + JSON.stringify(fm && fm.value) + ")");
    ok(!("fir_podosphaera_xanthii" in ind) && ("infection_hours_counter_podosphaera_xanthii" in ind), "Κ2 το fir_<key> ΔΕΝ ταξιδεύει (νεκρό βάρος), ο μετρητής ωρών ΝΑΙ");
  } catch (e) { f.push("Κ πακετάρισμα: " + e.message); }
  // ── Λ. widget: επίπεδο από την τιμή, φίλτρο ξενιστή, κύρια κάρτα ≥ Υψηλός ──
  const a = w.indexOf("function Ba("); const b = w.indexOf("}", w.indexOf("return", a)) + 1;
  let Ba; try { Ba = new Function(w.slice(a, b) + "\nreturn Ba;")(); } catch (e) { f.push("widget Ba: " + e.message); return f; }
  ok(Ba("Σοβαρός κίνδυνος") === 4 && Ba("Υψηλός κίνδυνος") === 3 && Ba("Μέτριος κίνδυνος") === 2 && Ba("Χαμηλός κίνδυνος") === 1 && Ba("Μη διαθέσιμο") === 0, "Λ1 το widget μεταφράζει τις 4 βαθμίδες του πυρήνα (4/3/2/1/0)");
  ok(w.includes('if(R<3&&!Vc)continue;const X=R===4?"b-red":R===3?"b-orange":"b-yellow"'), "Λ2 η κύρια κάρτα δείχνει Υψηλός/Σοβαρός (ή ανοιχτή υπόθεση), κόκκινο/πορτοκαλί");
  const hi = w.indexOf("sagHostMap={"); const he = w.indexOf("}", hi); const hm = new Function("return (" + w.slice(hi + 11, he + 1) + ")")();
  ok(hm.podosphaera_xanthii.includes("vegetableCrops:cucumber") && hm.pseudoperonospora_cubensis.includes("vegetableCrops:cucumber") && !hm.erysiphe_necator.includes("vegetableCrops:cucumber"), "Λ3 ο χάρτης ξενιστών του widget δείχνει ωίδιο+περονόσπορο κολοκυνθοειδών στο αγγούρι");
  // κάθε ζεύγος παθογόνο/ξενιστής του πυρήνα περνά το φίλτρο του widget (εκτός γνωστής εξαίρεσης)
  const hidden = [];
  for (const cat of Object.values(K.PATHOGEN_PROFILE)) for (const [k, p] of Object.entries(cat)) { if (!hm[k]) continue; for (const c of (p.crops || [])) { const hk = c.cultivation_type_general + ":" + c.cultivation_type; if (hm[k].indexOf(hk) < 0) hidden.push(k + "←" + hk); } }
  ok(hidden.length === 1 && hidden[0] === "botrytis_cinerea←vegetableCrops:faba_bean", "Λ4 μόνο 1 ζεύγος πυρήνα κρύβεται από το widget (botrytis/faba_bean) — " + hidden.join(","));
  return f;
}

const base = run(SRC, W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 η υγρασία δεν ελέγχεται", "const humidityOk = RH >= Number(_oh.min);", "const humidityOk = true;", "c"],
  ["m2 ο μετρητής δεν προχωρά", ": (conditionsOk ? parseFloat((prevCount + _sagTickHours()).toFixed(1)) : 0);", ": 0;", "c"],
  ["m3 er ποτέ 1", "er = (infection_hours >= _reqDur) ? 1.0", "er = (infection_hours >= _reqDur) ? 0.5", "c"],
  ["m4 κατώφλι Σοβαρού πέφτει στο 0,4", "    } else if (firValue < 0.7) {", "    } else if (firValue < 0.4) {", "c"],
  ["m5 χωρίς πάγωμα", "const _frozenHere = _ihFrozen || (needsWet && _leafFrozen);", "const _frozenHere = false;", "c"],
  ["m6 η βροχή δεν ξεπλένει", "rainInhibit = (rainfall_1h > (pathogen.rainInhibitThresholdMm || 2.5));", "rainInhibit = false;", "c"],
  ["m7 εφεδρεία RH σβηστή", "  if (Number.isFinite(RH) && RH >= 90)\n    return { wet: true, weight: 0.6, source: 'rh'", "  if (Number.isFinite(RH) && RH >= 200)\n    return { wet: true, weight: 0.6, source: 'rh'", "c"],
  ["m8 πρόγνωση ποτέ", "        if (best >= need) {", "        if (best >= need + 9999) {", "c"],
  ["m9 ο ψεκασμός αγνοείται", "const _rawFir = _envPressure * (1 - pei);", "const _rawFir = _envPressure;", "c"],
  ["m10 το μέγιστο επεισοδίου χάνεται", "const infection_hours = Math.max(rawCounter, Number(getVal(measurements, maxKey, 0)) || 0);", "const infection_hours = rawCounter;", "c"],
  ["m11 ωίδιο αμπελιού ξανά στο αγγούρι", "    (c) => c && c.cultivation_type_general === \"vineCrops\"", "    (c) => true", "c"],
  ["m12 θερμοκήπιο δεν σιωπά", "    if (_SAG_COVERED_ACTIVE) return [];\n    const RH = Array.isArray(fcs.rh)", "    if (false) return [];\n    const RH = Array.isArray(fcs.rh)", "c"],
  ["W1 widget χάνει το «σοβαρ»", 'function Ba(t){const s=String(t||"").toLowerCase();return s.includes("χαμηλ")?1:s.includes("μέτρι")||s.includes("μετρι")?2:s.includes("υψηλ")?3:s.includes("σοβαρ")?4:0}', 'function Ba(t){const s=String(t||"").toLowerCase();return s.includes("χαμηλ")?1:s.includes("μέτρι")||s.includes("μετρι")?2:s.includes("υψηλ")?3:0}', "w"],
  ["W2 κύρια κάρτα μόνο Σοβαρός", 'if(R<3&&!Vc)continue;const X=R===4?"b-red"', 'if(R<4&&!Vc)continue;const X=R===4?"b-red"', "w"],
];
let k = 0;
for (const [n, a, b, which] of MUT) {
  const src = which === "w" ? W : SRC;
  if (!src.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  const m = src.replace(a, b);
  let r; try { r = run(which === "c" ? m : SRC, which === "w" ? m : W); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 110)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
