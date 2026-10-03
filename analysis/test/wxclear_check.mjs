// Ελεγκτής T-WXCLEAR-01 (v50.157 · Α1 του ελέγχου μετεωρολογικών 4/10): οι προειδοποιήσεις από
// πρόγνωση ΣΒΗΝΟΥΝ όταν η έγκυρη πρόγνωση πάψει να τις δίνει — στο bundle ΚΑΙ στην cache του widget.
// Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα και τρέχει ωριαίους παλμούς πακετάρισμα → συμπίεση →
// αποσυμπίεση → προηγούμενο bundle, με ρολόι που προχωρά. Το widget προσομοιώνεται με την ΙΔΙΑ λογική
// cache/κάρτας με το bundle (index-7cbd9a4e.js), και ο ελεγκτής επαληθεύει ότι τα σχετικά κομμάτια
// του bundle είναι όντως αυτά. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
// Απαιτεί analysis/node_modules (moment-timezone, axios) — `cd analysis && npm i moment-timezone axios --no-save`.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const req = createRequire(corePath);
try { req.resolve("moment-timezone"); } catch (e) { console.log("ΑΔΥΝΑΤΟ: λείπει moment-timezone — `cd analysis && npm i moment-timezone axios --no-save`"); process.exit(1); }

function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { packCalculatedIndicators, decompressFieldBundle, _sagKeyTtlHours, _sagHeatIndicators, _sagFrostIndicators,"
    + " _sagRainAheadIndicators, _sagInfectionAheadIndicators, _sagForecastSeries, _sagWxClear, CROP_PROFILE, PATHOGEN_PROFILE,"
    + " SAG_KERNEL_VERSION, setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; } };";
  const mod = { exports: {} };
  const proc = { env: { RPERTICH_TEST_MODE: "true" }, exit: () => {}, on: () => {} };
  const quiet = { log: () => {}, warn: () => {}, error: () => {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, proc, quiet, path.dirname(corePath), corePath);
}

// Συνθετική πρόγνωση Open-Meteo, ίδια μορφή με το analysis forecast (τοπική ημέρα βάσης, +3 ω).
function mkFc(runMs, o) {
  const off = 10800; const base = new Date(runMs + off * 1000).toISOString().slice(0, 10);
  const t0 = Date.parse(base + "T00:00:00Z") - off * 1000;
  const T = [], P = [], RH = [];
  for (let i = 0; i < 72; i++) { const ms = t0 + i * 3600e3; T.push(o.T); P.push(ms >= runMs && ms < runMs + 6 * 3600e3 ? (o.P || 0) : 0); RH.push(o.RH ?? 60); }
  return { forecast_base_date: base, utc_offset_seconds: off, timezone: "Europe/Athens", run_at: new Date(runMs).toISOString(),
    hourly: { temperature_2m: T, precipitation: P, relative_humidity_2m: RH, wind_speed_10m: T.map(() => 2) } };
}

// ── Το widget: ΙΔΙΑ λογική με το useMemo `re` και την κάρτα `Pt` του bundle ──
const WKEYS = ["fir_message_", "bpi_message", "bpi_season_message", "plant_stress", "irrigation_message", "irrigation_warning", "spray_confirmation", "weather_alert_frost", "weather_alert_heat"];
function widgetView(bundle, cache, cropId) {
  const S = (k) => WKEYS.some(w => k === w || k.startsWith(w));
  const n = {};
  for (const [k, v] of Object.entries(bundle.shared || {})) n[k] = { value: v.value, metadata: v.metadata || {} };
  const Q = cache[cropId] = cache[cropId] || {}; const SH = cache.__shared__ = cache.__shared__ || {};
  for (const c of bundle.crops || []) {
    const qe = cache[c.id] = cache[c.id] || {};
    for (const [k, v] of Object.entries(c.indicators || {})) if (S(k)) qe[k] = { value: v.value, metadata: v.metadata || {} };
  }
  const cur = (bundle.crops || []).find(c => c.id === cropId);
  for (const [k, v] of Object.entries((cur && cur.indicators) || {})) { n[k] = { value: v.value, metadata: v.metadata || {} }; if (S(k)) Q[k] = n[k]; }
  for (const k of Object.keys(bundle.shared || {})) if (S(k) && n[k]) SH[k] = n[k];
  for (const [k, v] of Object.entries(Q)) n[k] || (n[k] = v);
  for (const [k, v] of Object.entries(SH)) n[k] || (n[k] = v);
  const alerts = []; for (const y of ["weather_alert_frost", "weather_alert_heat"]) { const e = n[y]; if (!e || !e.value) continue; alerts.push(y + "=" + e.value); }
  const health = ["rain_ahead", "infection_ahead", "night_temp_warning"].filter(k => n[k] && n[k].value !== null && n[k].value !== undefined && String(n[k].value) !== "");
  return { alerts, health, n };
}

const CID = "vegetableCrops:cucumber:1";
const CROPS = [{ id: CID, cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber" }];
const PARAMS = { cultivation_type_general: "vegetableCrops", cultivation_type: "cucumber", stage: "fruiting" };

function run(src, w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  // ── το widget είναι όντως αυτό που προσομοιώνεται ──
  ok(w.includes('for(const[ie,we]of Object.entries(Q))n[ie]||(n[ie]=we)'), "W0 cache widget: επαναφορά μόνο όταν λείπει το κλειδί");
  ok(w.includes('if(S(ie)&&n[ie]){_sagWx9[ie]=n[ie];Z=!0}'), "W1 cache widget: αποθήκευση shared κλειδιών ως έχουν (και με κενή τιμή)");
  ok(w.includes('qe[Ye]={value:gt.value,metadata:gt.metadata||{}'), "W2 cache widget: αποθήκευση κλειδιών καλλιέργειας ως έχουν");
  ok(w.includes('const S=re[y];if(!S||!S.value)continue;'), "W3 κάρτα συναγερμών παραλείπει την κενή τιμή");
  ok(w.includes('.filter(x=>x.d&&x.d.value!==null&&x.d.value!==void 0&&String(x.d.value)!=="")'), "W4 κάρτα υγείας παραλείπει την κενή τιμή");

  let K; try { K = loadCore(src); } catch (e) { return [...f, "φόρτωση πυρήνα: " + e.message]; }
  ok(K.SAG_KERNEL_VERSION === "v50.157 · 2026-10-04", "V έκδοση v50.157 (" + K.SAG_KERNEL_VERSION + ")");
  ok(K._sagKeyTtlHours("weather_alert_heat") === 12 && K._sagKeyTtlHours("weather_alert_frost") === 12, "T1 TTL weather_alert_* = 12 ω (" + K._sagKeyTtlHours("weather_alert_heat") + ")");
  ok(K._sagKeyTtlHours("rain_ahead") === 12 && K._sagKeyTtlHours("night_temp_warning") === 50, "T2 TTL rain_ahead 12 / night_temp_warning 50 αμετάβλητα");
  const cuc = K.CROP_PROFILE.vegetableCrops.cucumber;

  // ── η προσομοίωση: ωριαίοι παλμοί, όπως ο βρόχος παραγωγής ──
  const H0 = Date.UTC(2026, 9, 3, 9, 20, 0);
  const realNow = Date.now;
  const sim = (plan, covered = false) => {
    let prev = { shared: {}, cropsById: {} }; const cache = {}; const out = [];
    for (let h = 0; h < plan.length; h++) {
      const now = H0 + h * 3600e3; Date.now = () => now; K.setCovered(covered);
      const p = plan[h];
      const fcs = p ? K._sagForecastSeries(mkFc(now - 5 * 60e3, p), now) : K._sagForecastSeries(null, now);
      // ΙΔΙΑ σύνθεση με τα σημεία κλήσης του πυρήνα (ελέγχονται παρακάτω ως καλωδίωση)
      const shared = [...K._sagWxClear(fcs, K._sagFrostIndicators(fcs), "weather_alert_frost"),
                      ...K._sagWxClear(fcs, K._sagRainAheadIndicators(fcs), "rain_ahead")];
      const crop = [...K._sagWxClear(fcs, K._sagHeatIndicators(fcs, cuc), "weather_alert_heat"),
                    ...K._sagWxClear(fcs, K._sagInfectionAheadIndicators(fcs, PARAMS, K.PATHOGEN_PROFILE, new Set()), "infection_ahead"),
                    { variable: "plant_stress", value: 1, metadata: { text: "x", color: "green" } }];
      const row = K.packCalculatedIndicators({ sharedIndicators: shared, perCropIndicators: { [CID]: crop }, prevBundle: prev, currentCropsConfig: CROPS })[0];
      const b = K.decompressFieldBundle(row.metadata.data);
      const byId = {}; for (const c of b.crops) byId[c.id] = c.indicators;
      prev = { shared: b.shared, cropsById: byId };
      out.push({ h, fcsOk: !!fcs.ok, b, ci: byId[CID] || {}, w: widgetView(b, cache, CID), bytes: String(row.metadata.data).length });
    }
    Date.now = realNow; return out;
  };
  const HOT = { T: 34 }, MILD = { T: 17 }, COLD = { T: 0.5 }, RAIN = { T: 17, P: 1 }, WET = { T: 19, RH: 97 };

  // Σ1 · ο «καύσωνας» του Κουτσάκη: θερμή πρόγνωση, μετά ήπια ΕΓΚΥΡΗ
  const s1 = sim([HOT, MILD, MILD, MILD]);
  ok(s1[0].ci.weather_alert_heat && s1[0].ci.weather_alert_heat.value === "warning", "Σ1α 34 °C (> 32) → weather_alert_heat warning (" + JSON.stringify(s1[0].ci.weather_alert_heat && s1[0].ci.weather_alert_heat.value) + ")");
  ok(s1[0].w.alerts.includes("weather_alert_heat=warning"), "Σ1β το widget δείχνει τον συναγερμό όσο ισχύει");
  ok(s1[1].ci.weather_alert_heat && s1[1].ci.weather_alert_heat.value === null, "Σ1γ ήπια έγκυρη πρόγνωση → weather_alert_heat ΚΕΝΗ τιμή στο bundle (" + JSON.stringify(s1[1].ci.weather_alert_heat) + ")");
  ok(s1[1].w.alerts.length === 0 && s1[3].w.alerts.length === 0, "Σ1δ το widget ΔΕΝ δείχνει πια καύσωνα (" + s1[1].w.alerts + " / " + s1[3].w.alerts + ")");

  // Σ2 · παγετός (επίπεδο αγρού)
  const s2 = sim([COLD, MILD, MILD]);
  ok(s2[0].b.shared.weather_alert_frost && s2[0].b.shared.weather_alert_frost.value, "Σ2α 0,5 °C → weather_alert_frost");
  ok(s2[1].b.shared.weather_alert_frost && s2[1].b.shared.weather_alert_frost.value === null && s2[2].w.alerts.length === 0, "Σ2β ήπια πρόγνωση → παγετός σβήνει στο bundle ΚΑΙ στο widget");

  // Σ3 · βροχή μπροστά (ανοιχτός αγρός) και θερμοκήπιο
  const s3 = sim([RAIN, MILD]);
  ok(s3[0].b.shared.rain_ahead && s3[0].b.shared.rain_ahead.value && s3[0].w.health.includes("rain_ahead"), "Σ3α 6 mm → rain_ahead ορατό");
  ok(s3[1].b.shared.rain_ahead && s3[1].b.shared.rain_ahead.value === null && !s3[1].w.health.includes("rain_ahead"), "Σ3β χωρίς βροχή → rain_ahead κενή τιμή, αόρατο");
  const s3c = sim([RAIN, MILD], true);
  ok(s3c[0].b.shared.rain_ahead && s3c[0].b.shared.rain_ahead.value === null, "Σ3γ θερμοκήπιο: rain_ahead κενή τιμή (σίγαση T-COVERED-01 διατηρείται)");

  // Σ4 · μόλυνση μπροστά (ανά καλλιέργεια)
  const s4 = sim([WET, MILD]);
  ok(s4[0].ci.infection_ahead && s4[0].ci.infection_ahead.value, "Σ4α RH 97 / 19 °C → infection_ahead (" + JSON.stringify(s4[0].ci.infection_ahead && s4[0].ci.infection_ahead.value) + ")");
  ok(s4[1].ci.infection_ahead && s4[1].ci.infection_ahead.value === null && !s4[1].w.health.includes("infection_ahead"), "Σ4β ξηρή πρόγνωση → infection_ahead σβήνει");

  // Σ5 · ΧΩΡΙΣ έγκυρη πρόγνωση: δεν ξέρουμε → ο συναγερμός μεταφέρεται ≤ 12 ω, μετά ταφόπλακα
  const plan5 = [HOT]; for (let i = 1; i <= 30; i++) plan5.push(null);
  const s5 = sim(plan5);
  ok(!s5[1].fcsOk && s5[1].ci.weather_alert_heat && s5[1].ci.weather_alert_heat.value === "warning" && s5[1].ci.weather_alert_heat.metadata._s === 1,
     "Σ5α χωρίς πρόγνωση ο συναγερμός ΜΕΝΕΙ ως παλιός (" + JSON.stringify(s5[1].ci.weather_alert_heat && s5[1].ci.weather_alert_heat.value) + ")");
  ok(s5[12].ci.weather_alert_heat && s5[12].ci.weather_alert_heat.value === "warning", "Σ5β ώρα 12: ακόμη εντός TTL");
  ok(s5[13].ci.weather_alert_heat && s5[13].ci.weather_alert_heat.value === null, "Σ5γ ώρα 13: λήξη → ταφόπλακα κενής τιμής (" + JSON.stringify(s5[13].ci.weather_alert_heat) + ")");
  ok(s5[13].w.alerts.length === 0, "Σ5δ το widget δεν ανασταίνει τον συναγερμό στη λήξη (" + s5[13].w.alerts + ")");
  ok(!("weather_alert_heat" in s5[30].ci) && s5[30].w.alerts.length === 0, "Σ5ε η ταφόπλακα λήγει κι αυτή, και η cache κρατά την κενή τιμή (" + s5[30].w.alerts + ")");
  ok(s5[13].b.shared.weather_alert_frost === undefined, "Σ5στ ταφόπλακα ΜΟΝΟ όπου υπήρξε πραγματικός συναγερμός");
  // βροχή μπροστά: ΚΑΜΙΑ ταφόπλακα (δεν την κρατά η cache του widget)
  const plan5r = [RAIN]; for (let i = 1; i <= 14; i++) plan5r.push(null);
  const s5r = sim(plan5r);
  ok(s5r[12].b.shared.rain_ahead && s5r[12].b.shared.rain_ahead.value && !("rain_ahead" in s5r[13].b.shared), "Σ5ζ rain_ahead χωρίς πρόγνωση: μεταφορά 12 ω, μετά φεύγει χωρίς ταφόπλακα");

  // Σ6 · οι συναρτήσεις ΔΕΝ άλλαξαν (το push παγετού διαβάζει το [0] τους απευθείας)
  { const now = H0; const fcs = K._sagForecastSeries(mkFc(now - 60e3, MILD), now);
    ok(fcs.ok && K._sagFrostIndicators(fcs).length === 0 && K._sagHeatIndicators(fcs, cuc).length === 0, "Σ6 _sagFrost/_sagHeatIndicators επιστρέφουν [] χωρίς συναγερμό (push παγετού ασφαλές)"); }

  // Σ7 · κόστος bundle
  { Date.now = () => H0;
    const ps = { variable: "plant_stress", value: 1, metadata: { text: "x", color: "green" } };
    const nul = (v) => ({ variable: v, value: null, metadata: {} });
    const len = (sh, cr) => String(K.packCalculatedIndicators({ sharedIndicators: sh, perCropIndicators: { [CID]: cr }, prevBundle: null, currentCropsConfig: CROPS })[0].metadata.data).length;
    const extra = len([nul("weather_alert_frost"), nul("rain_ahead")], [ps, nul("weather_alert_heat"), nul("infection_ahead")]) - len([], [ps]);
    Date.now = realNow;
    ok(extra > 0 && extra < 200, "Σ7 οι κενές τιμές κοστίζουν 0–200 B base64 (" + extra + ")"); }

  // ── καλωδίωση στα ΠΡΑΓΜΑΤΙΚΑ σημεία κλήσης του πυρήνα ──
  ok(src.includes("..._sagWxClear(_sagFcOf(measurements), _sagFrostIndicators(_sagFcOf(measurements)),\n              'weather_alert_frost'),"), "Κ1 παγετός περνά από _sagWxClear στο bundle του αγρού");
  ok(src.includes("..._sagWxClear(_sagFcOf(measurements), _sagRainAheadIndicators(_sagFcOf(measurements)),\n              'rain_ahead'),"), "Κ2 βροχή μπροστά περνά από _sagWxClear");
  ok(src.includes("for (const _hw of _sagWxClear(_sagFcOf(measurementsForCrop),\n                   _sagHeatIndicators(_sagFcOf(measurementsForCrop), _cpProf), 'weather_alert_heat')) {"), "Κ3 καύσωνας περνά από _sagWxClear ανά καλλιέργεια");
  ok(src.includes("for (const _ia of _sagWxClear(_sagFcOf(measurementsForCrop), _sagInfectionAheadIndicators(\n                   _sagFcOf(measurementsForCrop), cropParams, PATHOGEN_PROFILE, _already),\n                   'infection_ahead')) {"), "Κ4 μόλυνση μπροστά περνά από _sagWxClear");
  ok(src.includes("x.variable === 'weather_alert_heat' && x.value);"), "Κ5 το push καύσωνα αγνοεί την κενή τιμή (αλλιώς push «null»)");
  ok(src.includes("    } else if (nt) {\n") && src.includes('bpiIndicators.push({ variable: "night_temp_warning", value: null, metadata: {} });'), "Κ6 η ζεστή νύχτα σβήνει όταν η ελάχιστη είναι κάτω από το όριο");
  ok((src.match(/_sagFrostIndicators\(/g) || []).length === 3, "Κ7 κανένα άλλο σημείο κλήσης παγετού (" + (src.match(/_sagFrostIndicators\(/g) || []).length + ")");
  return f;
}

const base = run(SRC, W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 κανόνας λήξης με το παλιό όνομα", "[/^(weather_alert_(frost|heat)|(frost|heat)_warning)$/, _SAG_TTL_HOURLY_H],", "[/^(frost|heat)_warning$/, _SAG_TTL_HOURLY_H],", "c"],
  ["m2 κανένα σβήσιμο", "  if (!fcs || !fcs.ok) return out;\n  if (out.some", "  return out;\n  if (out.some", "c"],
  ["m3 σβήσιμο και χωρίς πρόγνωση", "  if (!fcs || !fcs.ok) return out;\n  if (out.some", "  if (false) return out;\n  if (out.some", "c"],
  ["m4 καμία ταφόπλακα", "    if (_SAG_WX_TOMBSTONE.test(key) && e.value", "    if (false && e.value", "c"],
  ["m5 ταφόπλακα σε όλα", "    if (_SAG_WX_TOMBSTONE.test(key) && e.value", "    if (true && e.value", "c"],
  ["m6 ταφόπλακα που αναπαράγεται", " && e.value !== null && e.value !== undefined && e.value !== '')", ")", "c"],
  ["m7 παγετός χωρίς σβήσιμο", "..._sagWxClear(_sagFcOf(measurements), _sagFrostIndicators(_sagFcOf(measurements)),\n              'weather_alert_frost'),", "..._sagFrostIndicators(_sagFcOf(measurements)),", "c"],
  ["m8 βροχή μπροστά χωρίς σβήσιμο", "..._sagWxClear(_sagFcOf(measurements), _sagRainAheadIndicators(_sagFcOf(measurements)),\n              'rain_ahead'),", "..._sagRainAheadIndicators(_sagFcOf(measurements)),", "c"],
  ["m9 καύσωνας χωρίς σβήσιμο", "for (const _hw of _sagWxClear(_sagFcOf(measurementsForCrop),\n                   _sagHeatIndicators(_sagFcOf(measurementsForCrop), _cpProf), 'weather_alert_heat')) {", "for (const _hw of _sagHeatIndicators(_sagFcOf(measurementsForCrop), _cpProf)) {", "c"],
  ["m10 μόλυνση μπροστά χωρίς σβήσιμο", "for (const _ia of _sagWxClear(_sagFcOf(measurementsForCrop), _sagInfectionAheadIndicators(\n                   _sagFcOf(measurementsForCrop), cropParams, PATHOGEN_PROFILE, _already),\n                   'infection_ahead')) {", "for (const _ia of _sagInfectionAheadIndicators(\n                   _sagFcOf(measurementsForCrop), cropParams, PATHOGEN_PROFILE, _already)) {", "c"],
  ["m11 push «null»", "x.variable === 'weather_alert_heat' && x.value);", "x.variable === 'weather_alert_heat');", "c"],
  ["m12 ζεστή νύχτα δεν σβήνει", "    } else if (nt) {\n", "    } else if (false) {\n", "c"],
  ["m13 σβήσιμο με λάθος κλειδί", "  return out.concat([{ variable: key, value: null, metadata: {} }]);", "  return out.concat([{ variable: key + '_x', value: null, metadata: {} }]);", "c"],
  ["m14 παλιά έκδοση", "'v50.157 · 2026-10-04'", "'v50.156 · 2026-09-24'", "c"],
  ["W1 κάρτα συναγερμών δείχνει και την κενή τιμή", "const S=re[y];if(!S||!S.value)continue;", "const S=re[y];if(!S)continue;", "w"],
  ["W2 cache shared μόνο με τιμή", "if(S(ie)&&n[ie]){_sagWx9[ie]=n[ie];Z=!0}", "if(S(ie)&&n[ie]&&n[ie].value){_sagWx9[ie]=n[ie];Z=!0}", "w"],
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
