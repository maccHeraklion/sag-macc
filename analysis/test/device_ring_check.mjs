// Ελεγκτής v50.190 (9/11/2026) — ο ΠΡΑΓΜΑΤΙΚΟΣ βρόχος ανάγνωσης οργάνων (getMeasurements) με ψεύτικες συσκευές:
// em320 με οροφή 89,5 % + LMS01 κολλημένο στο 2 %. Ελέγχει ότι ο πυρήνας ΠΑΡΑΓΕΙ ο ίδιος τους δακτυλίους (hx/lx), την οροφή
// (rhc) και τον κολλημένο αισθητήρα (lst), και ότι αυτά φτάνουν στον μετρητή ωρών μόλυνσης (το μάθημα της 7/11: ελεγκτής που
// δίνει έτοιμη την τιμή δεν αποδεικνύει ότι παράγεται). Μεταλλάξεις: κάθε βλάβη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
const NOW = Date.now();
function mkSdk(calls) {
  const T = (min) => new Date(NOW - min * 60000).toISOString();
  const DEV = {
    EM1: { info: { id: "EM1", name: "em320_test", tags: [{ key: "type", value: "em320_th" }], last_input: T(5) } },
    LMS1: { info: { id: "LMS1", name: "lms01_test", tags: [{ key: "type", value: "lms01_ls" }], last_input: T(5) } },
  };
  class Device {
    constructor(o) { this.id = String((o && o.token) || ""); }
    async info() { const d = DEV[this.id]; if (!d) throw new Error("no device " + this.id); return d.info; }
    async sendData() { return "ok"; }
    async getData(q) {
      calls.push([this.id, q && q.query, (q && q.variables || []).join(",")]);
      const vars = (q && q.variables) || [];
      if (this.id.startsWith("F:")) return [];
      if (this.id === "EM1") {
        if (q.query === "max" && vars[0] === "humidity") return [{ variable: "humidity", value: 89.5 }];
        if (q.query && vars[0] === "temperature") return [{ variable: "temperature", value: 15 }];
        if (q.query && vars[0] === "humidity") return [{ variable: "humidity", value: 85 }];
        if (q.query === "last_item") return [{ variable: "temperature", value: 15, time: T(5) }, { variable: "humidity", value: 89, time: T(5) }];
        if (!q.query) { const out = []; for (let i = 0; i < 100; i++) { out.push({ variable: "temperature", value: 12 + (i % 7), time: T(i * 14) }); out.push({ variable: "humidity", value: 80 + (i % 10), time: T(i * 14) }); } return out; }
        return [];
      }
      if (this.id === "LMS1") {
        if (q.query === "max" && vars[0] === "leaf_moisture") return [{ variable: "leaf_moisture", value: 2.1 }];
        if (q.query === "last_item") return [{ variable: "leaf_moisture", value: 2, time: T(5) }, { variable: "leaf_temperature", value: 15.2, time: T(5) }];
        if (!q.query) { const out = []; for (let i = 0; i < 70; i++) out.push({ variable: "leaf_moisture", value: 2 + (i % 2) * 0.1, time: T(i * 20) }); return out; }
        return [];
      }
      return [];
    }
  }
  class S { constructor() {} }
  return { Analysis: S, Resources: S, Account: S, Services: S, Device, Utils: { getTokenByName: async (_a, n) => String(n), envToJson: () => ({}) } };
}
function load(src, calls) {
  const sdk = mkSdk(calls);
  const shimReq = (m) => (m === "@tago-io/sdk" ? sdk : req(m));
  const tail = "\nreturn { getMeasurements, calculate_InfectionHours, SAG_KERNEL_VERSION, setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };";
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, { exports: {} }, {}, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {}, info() {}, debug() {} }, path.dirname(corePath), corePath);
}
async function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  const calls = [];
  let K; try { K = load(src, calls); } catch (e) { return ["φόρτωση: " + e.message]; }
  let meas;
  try { meas = await K.getMeasurements(true, false, { air: "EM1", leaf: "LMS1" }, "FIELD", "Δοκιμή"); }
  catch (e) { return ["getMeasurements: " + e.message]; }
  const data = (meas && (meas.data || meas)) || {};
  const inv = data._sagDevInv || [];
  const em = inv.find((d) => d.i === "EM1"), lm = inv.find((d) => d.i === "LMS1");
  ok(em && em.rhc && em.rhc.clip && em.rhc.top === 89.5 && em.rhc.n >= 7, "Δ1 ο πυρήνας παράγει οροφή 89,5 για το em320 (" + JSON.stringify(em && em.rhc) + ")");
  ok(lm && lm.lst && lm.lst.stuck && lm.lst.n >= 5, "Δ2 ο πυρήνας κρίνει κολλημένο το LMS01 (" + JSON.stringify(lm && lm.lst) + ")");
  const dk = Object.keys(data).find((k) => k.startsWith("diag_stats__") && /EM1/.test(k));
  let rec = null; try { rec = JSON.parse(Array.isArray(data[dk]) ? data[dk][0].value : data[dk]); } catch (_e) {}
  ok(rec && Array.isArray(rec.hx) && rec.hx.length >= 20, "Δ3 η διαγνωστική εγγραφή κρατά τον δακτύλιο 21 ημερών (" + (rec && rec.hx ? rec.hx.length : "—") + ")");
  const maxCalls = calls.filter((c) => c[1] === "max" && /humidity|leaf_moisture/.test(c[2])).length;
  ok(maxCalls >= 21 && maxCalls <= 40, "Δ4 συμπλήρωση μία φορά: " + maxCalls + " ερωτήματα «max» (αναμενόμενα 21 + 10)");
  // ροή ως τον μετρητή
  const crop = { cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber", stage: "fruiting", name: "Δοκιμή", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation", covered_cultivation: true };
  const m2 = meas.data ? meas : { data: meas, timezone: "Europe/Athens", now: new Date(NOW) };
  m2.now = m2.now || new Date(NOW); m2.timezone = m2.timezone || "Europe/Athens";
  m2.data.temperature = [{ value: 18 }]; m2.data.humidity = [{ value: 89 }]; m2.data.air_temperature = [{ value: 18 }]; m2.data.air_humidity = [{ value: 89 }];
  m2.data.leaf_temperature = [{ value: 18.2 }]; m2.data.leaf_moisture = [{ value: 2 }];
  m2.data._sagAges = { temperature: 5, humidity: 5, leaf_temperature: 5, leaf_moisture: 5 };
  K.setTick(60); K.setCovered(true);
  const ih = K.calculate_InfectionHours(true, m2, crop) || [];
  const g = (v) => ih.find((x) => x && x.variable === v);
  ok(g("rh_instrument_ceiling") && Number(g("rh_instrument_ceiling").value) === 89.5, "Δ5 η οροφή φτάνει στον μετρητή ωρών");
  ok(g("leaf_sensor_stuck_dry") && Number((g("infection_hours_counter_pseudoperonospora_cubensis") || {}).value) > 0, "Δ6 με RH 89 στην οροφή + κολλημένο αισθητήρα ο περονόσπορος μετρά ώρα (" + (g("leaf_wetness_source") || {}).value + ")");
  return f;
}
const base = await run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("device_ring_check: όλα ✔");
const MUT = [
  ["χωρίς δακτύλιο αέρα", "if (_hxOut) _rec.hx = _hxOut;   // T-RH-CEILING-01", ""],
  ["χωρίς συμπλήρωση ιστορικού", "if (_hx.length < _SAG_RHC_MIN_DAYS) {", "if (false) {"],
  ["η οροφή δεν περνά στην απογραφή", "{ const _c = _sagRhCeiling(_dro.hx); if (_c) _inv.rhc = _c; }", "{ }"],
  ["ο κολλημένος δεν περνά στην απογραφή", "{ const _l = _sagLeafStuck(_dro.lx); if (_l) _inv.lst = _l; }", "{ }"],
  ["χωρίς δακτύλιο φύλλου", "if (_lxOut) _rec.lx = _lxOut;   // T-LEAF-STUCKDRY-01", ""],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = await run(SRC.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 70) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
if (dead !== MUT.length) process.exit(1);
