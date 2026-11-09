// ΘΕΤΙΚΟΣ ΕΛΕΓΧΟΣ ΑΣΘΕΝΕΙΩΝ (9/11/2026): για ΚΑΘΕ μύκητα υγρού φύλλου/ωίδιο (Infection_Triangle) × ΚΑΘΕ καλλιέργεια-ξενιστή ×
// σενάρια οργάνων ΟΠΩΣ ΤΑ ΕΧΟΥΜΕ (em320 με οροφή 92,5 % ή 89,5 %, S2120, αισθητήρας φύλλου ή όχι) × ύπαιθρο/θερμοκήπιο, δίνει
// 18 ώρες ευνοϊκών συνθηκών στη βέλτιστη θερμοκρασία του προφίλ, μέσα στην περίοδο του, και ελέγχει ότι η κάρτα φτάνει «Υψηλός»
// ή «Σοβαρός». Αρνητικός έλεγχος: στεγνές συνθήκες → όχι Υψηλός. Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα.
// Χρήση: node disease_positive_control.mjs [--json out.json]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const SRC = fs.readFileSync(corePath, "utf8").replace(/\r\n/g, "\n");
const req = createRequire(corePath);
export function loadCore(src = SRC) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, PATHOGEN_PROFILE, _SAG_SEASON_WINDOWS, _SAG_NONFOLIAR_SUSPENDED, setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };";
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, { exports: {} }, {}, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const LV = { "Χαμηλός κίνδυνος": 1, "Μέτριος κίνδυνος": 2, "Υψηλός κίνδυνος": 3, "Σοβαρός κίνδυνος": 4 };
const dpOf = (T, H) => { const a = 17.62, b = 243.12, g = Math.log(Math.max(1, H) / 100) + a * T / (b + T); return b * g / (a - g); };
function mdStart(K, key) {
  const w = K._SAG_SEASON_WINDOWS[key];
  const pick = (md) => { const m = Math.floor(md / 100), d = md % 100; return [m, Math.min(28, d + 3)]; };
  if (!w) return key === "erysiphe_necator" || key === "plasmopara_viticola" ? [5, 15] : [5, 15];
  if (Array.isArray(w.ranges)) return pick(w.ranges[0][0]);
  return pick(w.from);
}
// σενάριο → συνάρτηση ώρας (h = 0..N-1) που δίνει μετρήσεις
export function simulate(K, key, host, sc, covered, hours = 18, inv = null) {
  const p = Object.values(K.PATHOGEN_PROFILE).map((c) => c[key]).find(Boolean);
  const crop = { cultivation_type_general: host.cultivation_type_general, cultivation_type: host.cultivation_type, stage: "fruiting", name: "X", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation", covered_cultivation: covered };
  const tr = p.optimalTempRange || {}; const T = Number.isFinite(Number(tr.opt)) ? Number(tr.opt) : (Number(tr.min) + Number(tr.max)) / 2;
  const [mo, da] = mdStart(K, key);
  const t0 = Date.UTC(2026, mo - 1, da, 16, 0, 0);   // 18:00 Ελλάδας (UTC+2/+3 δεν μετρά εδώ)
  let state = {}; let best = 0, bestVal = "", firstHigh = null, last = null;
  for (let h = 0; h < hours; h++) {
    const o = sc(T, p);
    const data = Object.assign({}, state);
    data.temperature = [{ value: o.T }]; data.humidity = [{ value: o.RH }]; data.air_temperature = [{ value: o.T }]; data.air_humidity = [{ value: o.RH }];
    data.dew_point = [{ value: dpOf(o.T, o.RH) }]; data.air_temperature_avg = [{ value: o.T }]; data.ipsi_avg = [{ value: 2 }];
    if (o.lm !== undefined) { data.leaf_moisture = [{ value: o.lm }]; data.leaf_temperature = [{ value: o.lt }]; } else { delete data.leaf_moisture; delete data.leaf_temperature; }
    if (o.rain !== undefined) data.rain_height_hourly = [{ value: o.rain }];
    data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 };
    if (inv) data._sagDevInv = inv;
    const now = t0 + h * 36e5;
    const meas = { timezone: "Europe/Athens", now: new Date(now), _prevBundleTime: new Date(now - 36e5).toISOString(), data };
    K.setTick(60); K.setCovered(covered);
    const daily = h === 8;   // 02:00
    const gdd = K.calculate_GDD(true, daily, meas, crop) || []; for (const x of gdd) if (x && x.variable) meas.data[x.variable] = [{ value: x.value }];
    const ih = K.calculate_InfectionHours(true, meas, crop) || []; for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
    const fir = K.calculate_FIR(true, daily, meas, [{ variable: "ipsi", value: 2 }], crop) || [];
    const msgs = K.getPathogenMessages(fir, meas) || [];
    const cases = K._sagPathogenCases(meas, [...fir, ...msgs], null, null, now, NaN, null) || [];
    state = {};
    for (const x of [...ih, ...fir, ...cases]) if (x && x.variable && /^(infection_hours_counter_|leaf_|case_|pei_|gdd_)/.test(x.variable)) state[x.variable] = [{ value: x.value }];
    const g = (arr, v) => { let r = null; for (const x of arr) if (x && x.variable === v) r = x; return r; };
    const m = g(msgs, "fir_message_" + key) || g(fir, "fir_message_" + key);
    const lv = m ? (LV[m.value] || 0) : -1;
    if (lv > best) { best = lv; bestVal = m.value + " · " + String((m.metadata || {}).text || "").slice(0, 90); }
    if (lv >= 3 && firstHigh === null) firstHigh = h + 1;
    last = { m: m ? m.value : "(καμία κάρτα)", c: Number((g(ih, "infection_hours_counter_" + key) || {}).value) };
  }
  return { best, bestVal, firstHigh, last, T, date: mo + "/" + da };
}
// Σενάρια οργάνων. Η νύχτα: θερμοκρασία = βέλτιστη του προφίλ.
export const WET = {
  "φύλλο+em320(92,5)": (T) => ({ T, RH: 92, lm: 60, lt: T - 0.3 }),
  "φύλλο+em320(89,5)": (T) => ({ T, RH: 89, lm: 60, lt: T - 0.3 }),
  "em320(92,5) χωρίς φύλλο": (T) => ({ T, RH: 92 }),
  "S2120 χωρίς φύλλο": (T) => ({ T, RH: 98 }),
  "em320(89,5) χωρίς φύλλο": (T) => ({ T, RH: 89 }),
  "βροχή χωρίς φύλλο": (T) => ({ T, RH: 85, rain: 1.5 }),
};
export const CEIL_INV = [{ t: "em320_th", rhc: { top: 89.5, hits: 12, n: 21, clip: true } }];
export const DRY_RH = (p) => { const oh = p.optimalHumidity || {}; const lo = Number(oh.min), hi = Number.isFinite(Number(oh.max)) ? Number(oh.max) : 100; return Math.min(88, Math.max(lo, Math.min(hi, (lo + hi) / 2))); };
export function matrix(src = SRC) {
  const K = loadCore(src);
  const rows = [];
  for (const cat of Object.values(K.PATHOGEN_PROFILE)) for (const [key, p] of Object.entries(cat)) {
    if (p.type !== "Infection_Triangle") continue;
    if ((K._SAG_NONFOLIAR_SUSPENDED || []).indexOf(key) >= 0) { rows.push({ key, host: "-", sc: "-", cov: "-", res: { best: -9 }, note: "ΑΝΑΣΤΟΛΗ (μη φυλλική)" }); continue; }
    const needsWet = p.requiresLeafWetness !== false;
    for (const host of p.crops || []) {
      for (const cov of [false, true]) {
        if (needsWet) {
          for (const [name, sc] of Object.entries(WET)) rows.push({ key, host: host.cultivation_type, sc: name, cov, blind: name === "em320(89,5) χωρίς φύλλο", res: simulate(K, key, host, sc, cov) });
          // T-RH-CEILING-01: ίδιο όργανο με αναγνωρισμένη οροφή 89,5 % → πρέπει να βλέπει
          rows.push({ key, host: host.cultivation_type, sc: "em320(89,5) χωρίς φύλλο + οροφή", cov, res: simulate(K, key, host, WET["em320(89,5) χωρίς φύλλο"], cov, 18, CEIL_INV) });
        } else {
          const rh = DRY_RH(p);
          rows.push({ key, host: host.cultivation_type, sc: "ξηρό φύλλο RH " + rh, cov, res: simulate(K, key, host, (T) => ({ T, RH: rh, lm: 2, lt: T + 0.5 }), cov) });
          rows.push({ key, host: host.cultivation_type, sc: "ξηρό φύλλο RH " + rh + " χωρίς φύλλο", cov, res: simulate(K, key, host, (T) => ({ T, RH: rh }), cov) });
        }
        // αρνητικός: στεγνός αέρας 55 %, στεγνό φύλλο, ίδια θερμοκρασία
        rows.push({ key, host: host.cultivation_type, sc: "ΑΡΝΗΤΙΚΟ στεγνό 55 %", cov, neg: true, res: simulate(K, key, host, (T) => ({ T, RH: 55, lm: 2, lt: T + 1 }), cov) });
      }
    }
  }
  return rows;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = matrix();
  const fails = rows.filter((r) => !r.neg && !r.blind && r.res.best >= 0 && r.res.best < 3);
  const nocard = rows.filter((r) => r.res.best === -1);
  const negHigh = rows.filter((r) => r.neg && r.res.best >= 3);
  console.log("γραμμές " + rows.length + " · θετικές χωρίς Υψηλό " + fails.length + " · χωρίς κάρτα " + nocard.length + " · αρνητικές με Υψηλό " + negHigh.length);
  const grp = {};
  for (const r of fails) { const k = r.key + " | " + r.sc + " | " + (r.cov ? "θερμοκήπιο" : "ύπαιθρο"); (grp[k] = grp[k] || []).push(r.host + ":" + r.res.best + "(" + r.res.last.m.split(" ")[0] + ",c" + r.res.last.c + ",T" + r.res.T + "," + r.res.date + ")"); }
  for (const [k, v] of Object.entries(grp)) console.log("ΧΩΡΙΣ ΥΨΗΛΟ | " + k + " | " + v.join(" ").slice(0, 200));
  for (const r of nocard) console.log("ΧΩΡΙΣ ΚΑΡΤΑ | " + r.key + " | " + r.host + " | " + r.sc + " | " + (r.cov ? "θ" : "υ"));
  for (const r of negHigh) console.log("ΨΕΥΔΗΣ ΣΤΟ ΣΤΕΓΝΟ | " + r.key + " | " + r.host + " | " + (r.cov ? "θ" : "υ") + " | " + r.res.bestVal);
  for (const r of rows.filter((x) => x.note)) console.log("ΣΗΜ | " + r.key + " | " + r.note);
  const i = process.argv.indexOf("--json"); if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(rows));
}
