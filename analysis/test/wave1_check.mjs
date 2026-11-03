// Ελεγκτής T-WAVE1-01 (3/11/2026): κείμενο «σόνδα εκτός εδάφους» και χρώμα αναστολής βροχής. Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα και
// τρέχει τις ΠΡΑΓΜΑΤΙΚΕΣ _sagDetectFaults / calculate_IrrigationVolume. Το όριο και τα λίτρα δεν πρέπει να αλλάξουν. Μεταλλάξεις σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE0 = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const req = createRequire(KPATH);
function load(core) {
  const shim = (m) => { if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => "" } }; } return req(m); };
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", core
    + "\n;return { calculate_IrrigationVolume, _sagDetectFaults, _sagDevExpect, SAG_KERNEL_VERSION };")(
    shim, { exports: {} }, {}, { env: {}, on() {}, exit() {} }, quiet, path.dirname(KPATH), KPATH);
}
const T = new Date(Date.now() - 6e5).toISOString();
const A = (v) => [{ value: v, time: T, device: "Δ" }];
const M = (o) => { const d = {}; for (const [k, v] of Object.entries(o)) d[k] = A(v); return { data: d }; };
const P0 = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "full_canopy", area: 1000, soil_type: "loam",
  irrigation_system: "dripIrrigation", latitude_deg: 35, water_quality: "good" };
const WX = { air_temperature_max: 28, air_temperature_min: 15, air_temperature_avg: 21, air_humidity_avg: 60 };
const SOIL = { soil_moisture1: 18, soil_moisture2: 18, soil_temperature1: 20, soil_temperature2: 20 };
function run(core) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core);
    ok(K.SAG_KERNEL_VERSION === "v50.172 · 2026-11-03", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const faults = (range) => {
      const data = {}; for (const ch of K._sagDevExpect("se0x")) for (const a of [].concat(ch.a)) data[a] = [{ value: 20, time: T, device: "Δ" }];
      const dev = { n: "Δ", t: "se0x", qerr: 0, stats: { soil_temperature1: { n: 30, spanH: 24, range, min: 10, max: 10 + range } } };
      return K._sagDetectFaults(dev, data, {}).filter((x) => /μέσα στο χώμα/.test(x.title));
    };
    const a = faults(19);
    ok(a.length === 1, "Α1 εύρος 19 °C: ειδοποίηση (" + a.length + ")");
    ok(a[0] && /όριο για θαμμένο αισθητήρα: 18 °C/.test(a[0].what) && !/12 °C/.test(a[0].what), "Α2 το κείμενο λέει 18, όχι 12 (" + (a[0] && a[0].what) + ")");
    ok(faults(18).length === 0 && faults(17.9).length === 0, "Α3 όριο αμετάβλητο: 18 °C δεν ειδοποιεί");
    ok(faults(18.1).length === 1, "Α4 όριο αμετάβλητο: 18,1 °C ειδοποιεί");
    const rain = K.calculate_IrrigationVolume(true, M({ ...WX, ...SOIL, rain_height_daily: 20 }), [], P0);
    const g = (o, v) => (o || []).find((x) => x.variable === v);
    const im = g(rain, "irrigation_message");
    ok(g(rain, "irrigation_inhibited_by_rain")?.value === true && g(rain, "grossIrrigationLiters")?.value === 0, "Β1 αναστολή: 0 λίτρα όπως πριν");
    ok(im && /^Δεν απαιτείται πότισμα — βροχή 20\.0mm \(ωφέλιμη: 16\.0mm\)$/.test(im.value), "Β2 ίδιο κείμενο τιμής (" + (im && im.value) + ")");
    ok(im && im.metadata && im.metadata.color === "green" && /βροχή/.test(im.metadata.text || ""), "Β3 πράσινο με επεξήγηση (" + JSON.stringify(im && im.metadata) + ")");
    const dry = K.calculate_IrrigationVolume(true, M({ ...WX, ...SOIL, rain_height_daily: 0 }), [], P0);
    ok(!g(dry, "irrigation_inhibited_by_rain")?.value, "Β4 χωρίς βροχή καμία αναστολή");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(CORE0);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (κείμενο σόνδας, χρώμα αναστολής, όριο και λίτρα αμετάβλητα)");
const MUT = [
  ["μ1 όριο 12", "const _SAG_SOIL_RANGE_MAX = 18;", "const _SAG_SOIL_RANGE_MAX = 12;"],
  ["μ2 κείμενο με το παλιό 12", "όριο για θαμμένο αισθητήρα: ' + _SAG_SOIL_RANGE_MAX + ' °C.'", "όριο για θαμμένο αισθητήρα: 12 °C.'"],
  ["μ3 έλεγχος με >=", "if (s.range > _SAG_SOIL_RANGE_MAX && (worst", "if (s.range >= _SAG_SOIL_RANGE_MAX && (worst"],
  ["μ4 αναστολή χωρίς χρώμα", "metadata: { color: 'green', text: 'Η βροχή καλύπτει", "metadata: { text: 'Η βροχή καλύπτει"],
  ["μ5 αναστολή με λίτρα", "{ variable: 'grossIrrigationLiters', value: 0 },\n    { variable: 'irrigationDurationHours', value: 0 },\n    { variable: 'irrigation_inhibited_by_rain', value: true },", "{ variable: 'grossIrrigationLiters', value: 1 },\n    { variable: 'irrigationDurationHours', value: 0 },\n    { variable: 'irrigation_inhibited_by_rain', value: true },"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = CORE0.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(CORE0.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 110)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
