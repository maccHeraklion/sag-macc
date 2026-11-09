// Επανάληψη περονοσπόρου σε ΟΠΟΙΟΝΔΗΠΟΤΕ αγρό μέσα από τον πραγματικό πυρήνα, με ωριαία δεδομένα από την εξαγωγή
// `export_downy_hourly_2026-11-09.js` (πρόθεμα DH9). Χρήση:
//   node downy_field_replay.mjs <αρχείο.json> [--crop vegetableCrops:tomato] [--key phytophthora_infestans]
//        [--covered] [--ceil 92.5] [--stuck] [--norain]
// Το αρχείο: { rows: [{ d:"2026-11-03", h:21, T, RH, LX, LL, LT, R }] } — ώρα Ελλάδας (UTC+2).
// Τυπώνει ανά νύχτα: υγρές ώρες του πυρήνα, πηγές διαβροχής, μέγιστο μετρητή ωρών, FIR, βαθμίδα κάρτας, υπόθεση.
// --stuck: ο αισθητήρας φύλλου λογίζεται «δεν δείχνει νερό» (T-LEAF-STUCKDRY-01) — για σύγκριση.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const req = createRequire(corePath);
export function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, SAG_KERNEL_VERSION, setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const dp = (T, H) => { const a = 17.62, b = 243.12, g = Math.log(Math.max(1, Math.min(100, H)) / 100) + a * T / (b + T); return b * g / (a - g); };
export function replayField(src, fx, o) {
  const K = loadCore(src);
  const [gen, typ] = o.crop.split(":");
  const CROP = { cultivation_type_general: gen, cultivation_type: typ, stage: "fruiting", name: "R", soil_type: "loam", area: 1000, irrigation_system: "dripIrrigation", covered_cultivation: !!o.covered };
  const KEY = o.key;
  // Ώρες χωρίς σταθμό ΔΕΝ πετιούνται: ο πυρήνας διαβάζει την τελευταία τιμή με την ηλικία της και ΠΑΓΩΝΕΙ τον μετρητή
  // όταν περάσει το όριο ηλικίας (T-IHFREEZE-01). Το ίδιο εδώ — αλλιώς η επανάληψη μετρά ώρες που κανείς δεν μέτρησε.
  const all = []; let lastAir = null;
  for (const r0 of fx.rows.map((r) => Object.assign({ t: Date.parse(r.d + "T" + String(r.h).padStart(2, "0") + ":30:00Z") - 2 * 36e5 }, r)).sort((a, b) => a.t - b.t)) {
    if (Number.isFinite(r0.T) && Number.isFinite(r0.RH)) { lastAir = { T: r0.T, RH: r0.RH, t: r0.t }; all.push(Object.assign(r0, { airAge: 5 })); }
    else if (lastAir && r0.t - lastAir.t <= 24 * 36e5) all.push(Object.assign(r0, { T: lastAir.T, RH: lastAir.RH, airAge: Math.round((r0.t - lastAir.t) / 6e4) + 30 }));
  }
  const inv = [];
  if (o.ceil) inv.push({ t: "em320_th", rhc: { clip: true, top: o.ceil } });
  if (o.stuck) inv.push({ t: "lms01_ls", lst: { stuck: true, max: 4, n: 10 } });
  let state = Object.assign({}, o.initState || {}); let prevT = null; const nights = {};
  for (const r of all) {
    const win = all.filter((x) => x.t > r.t - 24 * 36e5 && x.t <= r.t && x.airAge <= 90);
    const data = Object.assign({}, state);
    data.air_temperature = [{ value: r.T }]; data.air_humidity = [{ value: r.RH }]; data.temperature = [{ value: r.T }]; data.humidity = [{ value: r.RH }];
    data.dew_point = [{ value: dp(r.T, r.RH) }]; data.air_temperature_avg = [{ value: win.reduce((a, x) => a + x.T, 0) / win.length }]; data.ipsi_avg = [{ value: 2 }];
    const hasL = Number.isFinite(r.LL) || Number.isFinite(r.LX);
    if (hasL) { data.leaf_moisture = [{ value: Number.isFinite(r.LL) ? r.LL : r.LX }]; if (Number.isFinite(r.LX)) data.leaf_moisture_hour_max = [{ value: r.LX }]; }
    if (Number.isFinite(r.LT)) data.leaf_temperature = [{ value: r.LT }];
    if (!o.norain && Number.isFinite(r.R)) data.rain_height_hourly = [{ value: r.R / 6 }];
    data._sagDevInv = inv;
    data._sagAges = { temperature: r.airAge, humidity: r.airAge, air_temperature: r.airAge, air_humidity: r.airAge, dew_point: r.airAge, leaf_temperature: Number.isFinite(r.LT) ? 5 : 999, leaf_moisture: hasL ? 5 : 999 };
    const meas = { timezone: "Europe/Athens", now: new Date(r.t), _prevBundleTime: new Date(prevT === null ? r.t - 36e5 : prevT).toISOString(), data };
    K.setTick(Math.round((prevT === null ? 36e5 : r.t - prevT) / 6e4)); K.setCovered(!!o.covered);
    const ih = K.calculate_InfectionHours(true, meas, CROP) || [];
    for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
    const fir = K.calculate_FIR(true, r.h === 2, meas, [{ variable: "ipsi", value: 2 }], CROP) || [];
    const msgs = K.getPathogenMessages(fir, meas) || [];
    const cases = K._sagPathogenCases(meas, [...fir, ...msgs], null, null, r.t, NaN, null) || [];
    state = {};
    for (const x of cases) if (x && x.variable && x.variable.startsWith("case_")) state[x.variable] = [{ value: x.value }];
    for (const x of [...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|leaf_|pei_)/.test(x.variable)) state[x.variable] = [{ value: x.value }];
    const g = (arr, v) => { let z = null; for (const x of arr) if (x && x.variable === v) z = x; return z; };
    const loc = new Date(r.t + 2 * 36e5); const nk = new Date(r.t + 2 * 36e5 - (loc.getUTCHours() < 12 ? 864e5 : 0)).toISOString().slice(5, 10);
    const n = (nights[nk] = nights[nk] || { wet: 0, c: 0, f: 0, lv: {}, src: {}, cs: "" });
    const c = Number((g(ih, "infection_hours_counter_" + KEY) || {}).value) || 0; n.c = Math.max(n.c, c);
    const f = Number((g(fir, "fir_" + KEY) || {}).value); if (Number.isFinite(f)) n.f = Math.max(n.f, f);
    const s = g(ih, "leaf_wetness_source"); const h = loc.getUTCHours();
    if (r.airAge > 90 && (h >= 18 || h < 9)) n.blind = (n.blind || 0) + 1;
    if (s && (h >= 18 || h < 9)) { n.src[s.value] = (n.src[s.value] || 0) + 1; if (/Αισθητήρας φύλλου$|Βροχή|Δρόσος|Σχετική/.test(s.value)) n.wet++; }
    const m = g(msgs, "fir_message_" + KEY) || g(fir, "fir_message_" + KEY); if (m) n.lv[m.value] = (n.lv[m.value] || 0) + 1;
    const cs = state["case_" + KEY]; if (cs) { try { n.cs = JSON.parse(cs[0].value).s; } catch (_e) {} }
    prevT = r.t;
  }
  return { version: K.SAG_KERNEL_VERSION, nights, state };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2); const arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const fx = JSON.parse(fs.readFileSync(a[0], "utf8"));
  const src = fs.readFileSync(corePath, "utf8").replace(/\r\n/g, "\n");
  const o = { crop: arg("--crop", "vegetableCrops:tomato"), key: arg("--key", "phytophthora_infestans"), covered: a.includes("--covered"), ceil: Number(arg("--ceil", "")) || null, stuck: a.includes("--stuck"), norain: a.includes("--norain") };
  const r = replayField(src, fx, o);
  console.log(r.version, JSON.stringify(o));
  for (const [d, x] of Object.entries(r.nights)) console.log(d, "υγρές(νύχτα)", x.wet, "μετρητής", x.c, "FIR", x.f.toFixed(2), JSON.stringify(x.lv), "υπόθεση", x.cs || "-", "τυφλές", x.blind || 0, JSON.stringify(x.src));
}
