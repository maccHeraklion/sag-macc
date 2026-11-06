// Ελεγκτής T-PHASE0B-01 (v50.183, 7/11/2026): (Α) η ώρα κρίνεται υγρή από ΟΠΟΙΟΔΗΠΟΤΕ δείγμα της ώρας (leaf_moisture_hour_max),
// (Β) διαβροχή φύλλων σε θερμοκήπιο χωρίς βροχή → leaf_wetting_event, (Γ) πύλη ξενιστή ΑΝΑ ΘΕΣΗ καλλιέργειας.
// Και μεταλλάξεις: κάθε βλάβη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagLeafWetness, packCalculatedIndicators, decompressFieldBundle, SAG_KERNEL_VERSION, PATHOGEN_PROFILE, _SAG_LWS_WET, _SAG_LWS_RAIN_MM, _sagLeafHourRead, setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const TOM = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "fruiting", name: "T", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
const TOMC = Object.assign({}, TOM, { covered_cultivation: true });
const PI = "phytophthora_infestans";
const T0 = Date.UTC(2026, 10, 3, 11, 0, 0);
function mkMeas(prevData, t0, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = Number.isFinite(o.dp) ? o.dp : (T - (100 - RH) / 5);
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; else delete data.leaf_moisture;
  if (o.lmMax !== undefined) data.leaf_moisture_hour_max = [{ value: o.lmMax }]; else delete data.leaf_moisture_hour_max;
  if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }]; else delete data.leaf_temperature;
  if (o.rain !== undefined) data.rain_height_hourly = [{ value: o.rain }]; else delete data.rain_height_hourly;
  data.ipsi_avg = [{ value: 2 }];
  data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 };
  const prevH = o.prevH === undefined ? hour - 1 : o.prevH;
  return { timezone: "Europe/Athens", now: new Date(t0 + hour * 3600e3), _prevBundleTime: new Date(t0 + prevH * 3600e3).toISOString(), data };
}
function tick(K, state, t0, hour, o, crop) {
  K.setTick(1); K.setCovered(!!crop.covered_cultivation);
  const meas = mkMeas(state.data, t0, hour, o);
  const gdd = K.calculate_GDD(true, false, meas, crop) || [];
  for (const g of gdd) if (g && g.variable) meas.data[g.variable] = [{ value: g.value }];
  const ih = K.calculate_InfectionHours(true, meas, crop) || [];
  state.data = {};
  for (const x of [...gdd, ...ih]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  const g = (v) => { let r = null; for (const x of ih) if (x && x.variable === v) r = x; return r; };
  return { ih, cnt: (k) => { const e = g("infection_hours_counter_" + k); return e ? Number(e.value) : null; }, get: g };
}
// Σκιασμένος αισθητήρας (lt ≈ T) ώστε το «στεγνό» του να υπερισχύει της εκτίμησης δρόσου.
const DRYLAST = { T: 16, RH: 96, lm: 5, lt: 16 };
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.183 · 2026-11-07", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    ok(typeof K._sagLeafHourRead === "function", "Ε2 υπάρχει _sagLeafHourRead");
    // ── Α · μέγιστο της ώρας ──
    { let st = { data: {} }, r;
      r = tick(K, st, T0, 1, DRYLAST, TOM);
      ok(r.cnt(PI) === 0, "Α1 τελευταίο δείγμα στεγνό (σκιασμένο), χωρίς μέγιστο: δεν μετρά (" + r.cnt(PI) + ")");
      let s2 = { data: {} };
      r = tick(K, s2, T0, 1, Object.assign({}, DRYLAST, { lmMax: 60 }), TOM);
      ok(r.cnt(PI) === 1, "Α2 τελευταίο στεγνό αλλά μέγιστο ώρας 60: η ώρα είναι ΥΓΡΗ (" + r.cnt(PI) + ")");
      ok(r.get("leaf_wetness_source") && /αισθητ/i.test(String(r.get("leaf_wetness_source").value)), "Α3 πηγή = αισθητήρας (" + (r.get("leaf_wetness_source") || {}).value + ")");
      r = tick(K, s2, T0, 2, Object.assign({}, DRYLAST, { lmMax: 8 }), TOM);
      ok(r.cnt(PI) === 0, "Α4 μέγιστο ώρας 8 (όλα στεγνά): μηδενίζει (" + r.cnt(PI) + ")");
      let s3 = { data: {} };
      r = tick(K, s3, T0, 1, { T: 16, RH: 96, lm: 60, lt: 16, lmMax: 5 }, TOM);
      ok(r.cnt(PI) === 1, "Α5 τελευταίο υγρό, μέγιστο μικρότερο (παλιό): max(60,5) υγρό (" + r.cnt(PI) + ")");
      const lmMaxT = r.get("leaf_moisture_max_today");
      ok(lmMaxT && Number(lmMaxT.value) === 60, "Α6 το διαγνωστικό μέγιστο ημέρας μένει από το ΤΕΛΕΥΤΑΙΟ δείγμα (" + (lmMaxT || {}).value + ")");
    }
    // ── Β · διαβροχή φύλλων σε θερμοκήπιο ──
    { let st = { data: {} }, r;
      r = tick(K, st, T0, 1, { T: 20, RH: 70, lm: 6, lt: 20 }, TOMC);
      ok(!r.get("leaf_wetting_event"), "Β1 πρώτη ώρα (χωρίς προηγούμενη): καμία κάρτα");
      const prev = r.get("leaf_moisture_prev_hour");
      ok(prev && Number(prev.value) === 6, "Β2 κρατιέται η προηγούμενη ώρα (" + (prev || {}).value + ")");
      r = tick(K, st, T0, 2, { T: 20, RH: 75, lm: 44, lt: 20 }, TOMC);
      const ev = r.get("leaf_wetting_event");
      ok(ev && ev.metadata && ev.metadata.color === "orange" && /βράχηκαν/.test(String(ev.value)), "Β3 6 → 44 % χωρίς βροχή σε θερμοκήπιο: κάρτα (" + JSON.stringify(ev && ev.value) + ")");
      ok(ev && /6 % σε 44 %/.test(String(ev.metadata.text)) && /πρωί/.test(String(ev.metadata.text)), "Β4 το κείμενο λέει τις τιμές και τη συμβουλή πρωινού ψεκασμού");
      r = tick(K, st, T0, 3, { T: 20, RH: 75, lm: 50, lt: 20 }, TOMC);
      ok(!r.get("leaf_wetting_event"), "Β5 44 → 50 (ήδη υγρό): καμία νέα κάρτα");
      let s2 = { data: {} };
      tick(K, s2, T0, 1, { T: 20, RH: 70, lm: 6, lt: 20 }, TOMC);
      r = tick(K, s2, T0, 2, { T: 20, RH: 75, lm: 44, lt: 20, rain: 3 }, TOMC);
      ok(!r.get("leaf_wetting_event"), "Β6 με βροχή 3 mm: καμία κάρτα (η βροχή το εξηγεί)");
      let s3 = { data: {} };
      tick(K, s3, T0, 1, { T: 20, RH: 70, lm: 6, lt: 20 }, TOM);
      r = tick(K, s3, T0, 2, { T: 20, RH: 75, lm: 44, lt: 20 }, TOM);
      ok(!r.get("leaf_wetting_event"), "Β7 υπαίθρια καλλιέργεια: καμία κάρτα");
      let s4 = { data: {} };
      tick(K, s4, T0, 1, { T: 20, RH: 70, lm: 6, lt: 20 }, TOMC);
      r = tick(K, s4, T0, 2, { T: 20, RH: 75, lm: 8, lt: 20, lmMax: 45 }, TOMC);
      ok(!!r.get("leaf_wetting_event"), "Β8 το μέγιστο της ώρας (45) αρκεί για την κάρτα ακόμη κι αν το τελευταίο δείγμα στέγνωσε");
    }
    // ── Γ · πύλη ξενιστή ανά θέση ──
    { const crops = [
        { id: "citrusFruits:orange:1", cultivation_type_general: "citrusFruits", cultivation_type: "orange" },
        { id: "olive:koroneiki:2", cultivation_type_general: "olive", cultivation_type: "koroneiki" }];
      const stale = (v) => ({ value: v, metadata: { _t: Math.floor(Date.now() / 60000) - 60 } });
      const prevBundle = { shared: {}, cropsById: {
        "citrusFruits:orange:1": { case_bactrocera_oleae: stale("open"), fir_message_phytophthora_citrophthora: stale("x") },
        "olive:koroneiki:2": { case_bactrocera_oleae: stale("open") } } };
      const out = K.packCalculatedIndicators({ sharedIndicators: [], perCropIndicators: {
        "citrusFruits:orange:1": [{ variable: "bpi", value: 1 }], "olive:koroneiki:2": [{ variable: "bpi", value: 1 }] },
        prevBundle, currentCropsConfig: crops });
      const _packed = Array.isArray(out) ? out[0] : out;
      const _pk = _packed && _packed.metadata && typeof _packed.metadata.data === "string" ? _packed.metadata.data : null;
      const b = K.decompressFieldBundle(_pk);
      const byId = {}; for (const c of (b.crops || [])) byId[c.id] = c.indicators || {};
      const or = byId["citrusFruits:orange:1"] || {}, ol = byId["olive:koroneiki:2"] || {};
      ok(!("case_bactrocera_oleae" in or), "Γ1 η υπόθεση δάκου ΔΕΝ μεταφέρεται στη θέση της πορτοκαλιάς (" + Object.keys(or).join(",") + ")");
      ok("case_bactrocera_oleae" in ol, "Γ2 η υπόθεση δάκου μεταφέρεται στη θέση της ελιάς");
      ok("fir_message_phytophthora_citrophthora" in or, "Γ3 το παθογόνο της πορτοκαλιάς μένει στη θέση της");
    }
  } catch (e) { f.push("ΕΞΑΙΡΕΣΗ: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
  return f;
}
const base = run(SRC);
console.log(base.length ? "ΒΑΣΗ: ΑΠΟΤΥΧΙΑ\n - " + base.join("\n - ") : "ΒΑΣΗ: ΟΚ");
const MUT = [
  ["m1 χωρίς μέγιστο ώρας στην κρίση", "    leafMoisture: leafMoistureHour,", "    leafMoisture: leafMoisture,"],
  ["m2 χωρίς κάρτα διαβροχής", "indicators.push({ variable: 'leaf_wetting_event'", "void({ variable: 'leaf_wetting_event'"],
  ["m3 διαβροχή και με βροχή", "&& !(_lwsRain1h > _SAG_LWS_RAIN_MM)) {", "&& true) {"],
  ["m4 διαβροχή και υπαίθρια", "if (parameters && parameters.covered_cultivation === true && Number.isFinite(_wePrev)", "if (Number.isFinite(_wePrev)"],
  ["m5 πύλη ανά αγρό (παλιά)", "!_bundleShouldDropStaleByHost(k, _slotHostSet)", "!_bundleShouldDropStaleByHost(k, _currentHostSet)"],
  ["m6 χωρίς προηγούμενη ώρα", "indicators.push({ variable: 'leaf_moisture_prev_hour'", "void({ variable: 'leaf_moisture_prev_hour'"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  if (!SRC.includes(a)) { console.log("ΜΕΤΑΛΛΑΞΗ " + name + ": ΑΓΚΥΡΑ ΔΕΝ ΒΡΕΘΗΚΕ"); continue; }
  const r = run(SRC.replace(a, b));
  if (r.length) killed++;
  console.log("ΜΕΤΑΛΛΑΞΗ " + name + ": " + (r.length ? "σκοτώθηκε (" + r[0] + ")" : "ΕΠΕΖΗΣΕ"));
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ: " + killed + "/" + MUT.length);
if (base.length || killed !== MUT.length) process.exit(1);
