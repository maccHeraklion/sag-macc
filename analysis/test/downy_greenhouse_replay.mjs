// Επανάληψη 15/10–9/11/2026 του περονόσπορου κολοκυνθοειδών σε θερμοκήπιο αγγουριού με ΠΡΑΓΜΑΤΙΚΑ ωριαία δεδομένα
// (fixtures/downy_greenhouse_hourly_2026-10-15_11-09.json) μέσα από τον πραγματικό πυρήνα. Τυπώνει ανά ημέρα: υγρές ώρες,
// μέγιστο μετρητή, FIR, κάρτα. Με --old εφαρμόζει το όριο RH 95 πριν τον v50.176 (για σύγκριση).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
let SRC = fs.readFileSync(corePath, "utf8").replace(/\r\n/g, "\n");
const OLD = process.argv.includes("--old");
if (OLD) SRC = SRC.replace("const humidityOk = RHd >= _rhMin || (needsWet && (_lwsMeasuredWet || _lwsRainWet));", "const humidityOk = RH >= Number(_oh.min);");
const FX = JSON.parse(fs.readFileSync(path.join(here, "fixtures", "downy_greenhouse_hourly_2026-10-15_11-09.json"), "utf8"));
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, SAG_KERNEL_VERSION, setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const CUC = { cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber", stage: "fruiting", name: "GH", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation", covered_cultivation: true };
const PC = "pseudoperonospora_cubensis";
const dp = (T, H) => { const a = 17.62, b = 243.12, g = Math.log(Math.max(1, H) / 100) + a * T / (b + T); return b * g / (a - g); };
export function replay(src, opts = {}) {
  const K = loadCore(src);
  const all = FX.rows.map((r) => Object.assign({ t: Date.parse(r.d + "T" + String(r.h).padStart(2, "0") + ":30:00Z") - 2 * 36e5 }, r)).filter((r) => r.T !== null && r.RH !== null);
  const rows = all.filter((r) => (!opts.from || r.d.slice(5) >= opts.from) && (!opts.to || r.d.slice(5) <= opts.to));
  let state = Object.assign({}, opts.initState || {}); let prevT = null; const days = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const win = all.filter((x) => x.t > r.t - 24 * 36e5 && x.t <= r.t);
    const tavg = win.reduce((a, x) => a + x.T, 0) / win.length;
    const data = Object.assign({}, state);
    data.temperature = [{ value: r.T }]; data.humidity = [{ value: r.RH }]; data.air_temperature = [{ value: r.T }]; data.air_humidity = [{ value: r.RH }];
    data.dew_point = [{ value: dp(r.T, r.RH) }]; data.air_temperature_avg = [{ value: tavg }]; data.ipsi_avg = [{ value: 2 }];
    if (r.LMmax !== null) { data.leaf_moisture = [{ value: opts.lmLast ? r.LMmax : r.LMmax }]; if (opts.hourMax) data.leaf_moisture_hour_max = [{ value: r.LMmax }]; }
    if (r.LT !== null) data.leaf_temperature = [{ value: r.LT }];
    if (opts.spray && r.d.slice(5) >= opts.spray.from) data["last_spray_" + PC] = [{ value: JSON.stringify({ d: opts.spray.iso, n: opts.spray.days }) }];
    data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: r.LT !== null ? 5 : 999, leaf_moisture: r.LMmax !== null ? 5 : 999 };
    const meas = { timezone: "Europe/Athens", now: new Date(r.t), _prevBundleTime: new Date(prevT === null ? r.t - 36e5 : prevT).toISOString(), data };
    const daily = r.h === 2;
    K.setTick(Math.round((prevT === null ? 36e5 : r.t - prevT) / 6e4)); K.setCovered(true);
    const ih = K.calculate_InfectionHours(true, meas, CUC) || [];
    for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
    const fir = K.calculate_FIR(true, daily, meas, [{ variable: "ipsi", value: 2 }], CUC) || [];
    const msgs = K.getPathogenMessages(fir, meas) || [];
    const cases = opts.noCases ? [] : (K._sagPathogenCases(meas, [...fir, ...msgs], null, null, r.t, NaN, null) || []);
    state = {};
    for (const x of cases) if (x && x.variable && x.variable.startsWith("case_")) state[x.variable] = [{ value: x.value }];
    for (const x of [...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|leaf_|pei_)/.test(x.variable)) state[x.variable] = [{ value: x.value }];
    for (const x of ih) if (x && x.variable === "leaf_wet_hours_today") state.leaf_wet_hours_today = [{ value: x.value }];
    const g = (arr, v) => { let o = null; for (const x of arr) if (x && x.variable === v) o = x; return o; };
    const c = Number((g(ih, "infection_hours_counter_" + PC) || {}).value) || 0;
    const f = Number((g(fir, "fir_" + PC) || {}).value);
    const m = g(msgs, "fir_message_" + PC) || g(fir, "fir_message_" + PC);
    const day = r.d.slice(5); const d = (days[day] = days[day] || { wet: 0, c: 0, f: 0, lv: {}, src: {}, txt: {} });
    if (m) d.txt[m.value] = String((m.metadata || {}).text || "");
    d.c = Math.max(d.c, c); if (Number.isFinite(f)) d.f = Math.max(d.f, f);
    const w = g(ih, "leaf_wet_hours_today"); if (w) d.wet = Math.max(d.wet, Number(w.value));
    const s = g(ih, "leaf_wetness_source"); if (s) d.src[s.value] = (d.src[s.value] || 0) + 1;
    if (m) d.lv[m.value] = (d.lv[m.value] || 0) + 1;
    prevT = r.t;
  }
  return { version: K.SAG_KERNEL_VERSION, days };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = replay(SRC, { hourMax: process.argv.includes("--hourmax") });
  console.log(r.version + (OLD ? " (όριο RH 95 πριν τον v50.176)" : ""));
  let hi = 0;
  for (const [d, o] of Object.entries(r.days)) { if (o.lv["Υψηλός κίνδυνος"] || o.lv["Σοβαρός κίνδυνος"]) hi++; console.log(d, "υγρές", o.wet, "μετρητής", o.c, "FIR", o.f.toFixed(2), JSON.stringify(o.lv), JSON.stringify(o.src)); }
  console.log("ημέρες με Υψηλό/Σοβαρό:", hi, "/", Object.keys(r.days).length);
}
