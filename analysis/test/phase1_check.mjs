// Ελεγκτής T-PHASE1-01 (v50.184, 7/11/2026): εποχικά παράθυρα εντόμων + θερινή παύση δάκου, W(T) με κλάσεις, HS ουδέτερο,
// προστασία ψεκασμού ως το μεσοδιάστημα, νέα παθογόνα (τζιτζικάκια, ανθρακνώσεις) με keymap. Μεταλλάξεις: κάθε βλάβη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, SAG_KERNEL_VERSION, PATHOGEN_PROFILE, _sagWetHoursReq, _sagInSeasonWindow, _SAG_SEASON_WINDOWS, _SAG_KEYMAP_PATHOGENS: (typeof _SAG_KEYMAP_PATHOGENS !== 'undefined' ? _SAG_KEYMAP_PATHOGENS : null), setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const TOM = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "fruiting", name: "T", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
const CUC = Object.assign({}, TOM, { cultivation_type: "cucumber", covered_cultivation: true });
const VINE = { cultivation_type_general: "vineCrops", cultivation_type: "wine_grapes", stage: "vegetative", name: "V", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
const OLIVE = { cultivation_type_general: "olive", cultivation_type: "koroneiki", stage: "fruiting", name: "O", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
const PC = "pseudoperonospora_cubensis", LB = "lobesia_botrana", BO = "bactrocera_oleae", TA = "tuta_absoluta", PI = "phytophthora_infestans";
function mkMeas(prevData, t0, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = Number.isFinite(o.dp) ? o.dp : (T - (100 - RH) / 5);
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  data.air_temperature = [{ value: T }]; data.air_humidity = [{ value: RH }];
  if (o.tavg !== undefined) data.air_temperature_avg = [{ value: o.tavg }];
  if (o.tmax !== undefined) data.air_temperature_max = [{ value: o.tmax }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; else delete data.leaf_moisture;
  if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }]; else delete data.leaf_temperature;
  if (o.rain !== undefined) data.rain_height_hourly = [{ value: o.rain }]; else delete data.rain_height_hourly;
  if (o.ipsi !== undefined) data.ipsi_avg = [{ value: o.ipsi }]; else data.ipsi_avg = [{ value: 2 }];
  if (o.gdd !== undefined) data["gdd_accumulated_" + o.gddKey] = [{ value: o.gdd }];
  if (o.wash !== undefined) data.pesticide_washoff_mm = [{ value: o.wash }];
  if (o.spray) data["last_spray_" + o.spray.key] = [{ value: JSON.stringify({ d: o.spray.iso, n: o.spray.days, w: o.spray.wash }) }];
  data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 };
  const prevH = o.prevH === undefined ? hour - 1 : o.prevH;
  return { timezone: "Europe/Athens", now: new Date(t0 + hour * 3600e3), _prevBundleTime: new Date(t0 + prevH * 3600e3).toISOString(), data };
}
function tick(K, state, t0, hour, o, crop, daily = false) {
  K.setTick(1); K.setCovered(!!crop.covered_cultivation);
  const meas = mkMeas(state.data, t0, hour, o);
  const gdd = K.calculate_GDD(true, daily, meas, crop) || [];
  for (const g of gdd) if (g && g.variable) meas.data[g.variable] = [{ value: g.value }];
  const ih = K.calculate_InfectionHours(true, meas, crop) || [];
  for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
  const fir = K.calculate_FIR(true, daily, meas, [{ variable: "ipsi", value: o.ipsi === undefined ? 2 : o.ipsi }], crop) || [];
  const msgs = K.getPathogenMessages(fir, meas) || [];
  state.data = {};
  for (const x of [...gdd, ...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_|case_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  const g = (arr, v) => { let r = null; for (const x of arr) if (x && x.variable === v) r = x; return r; };
  return { ih, fir, msgs, cnt: (k) => { const e = g(ih, "infection_hours_counter_" + k); return e ? Number(e.value) : null; },
    firOf: (k) => { const e = g(fir, "fir_" + k); return e ? Number(e.value) : null; },
    msg: (k) => g(msgs, "fir_message_" + k) || g(fir, "fir_message_" + k) };
}
const DATE = (m, d, h = 11) => Date.UTC(2026, m - 1, d, h, 0, 0);   // UTC 11:00 = 13:00 Ελλάδας
const WET18 = { T: 18, RH: 96, lm: 60, lt: 17.5, tavg: 20 };   // tavg 20 → W(T)=2 ώρες
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.187 · 2026-11-07", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const p = (k) => Object.values(K.PATHOGEN_PROFILE).map((c) => c && c[k]).find(Boolean);
    ok(p("asymmetrasca_decedens") && p("asymmetrasca_decedens").pestBaseTemp === 8.7 && p("empoasca_decipiens") && p("colletotrichum_orbiculare") && p("colletotrichum_coccodes"), "Ε2 τα 4 νέα προφίλ υπάρχουν");
    // keymap: ίδια 4 κλειδιά, ίδια σειρά, στο τέλος, και στο widget
    const km = SRC.match(/'meloidogyne_incognita',\n[^\n]*\n  '([^']+)', '([^']+)', '([^']+)', '([^']+)',\n\];/);
    ok(km && km[1] === "asymmetrasca_decedens" && km[4] === "colletotrichum_coccodes", "Ε3 keymap πυρήνα: τα 4 νέα στο τέλος");
    ok(W.includes('"meloidogyne_incognita", "asymmetrasca_decedens", "empoasca_decipiens", "colletotrichum_orbiculare", "colletotrichum_coccodes"]'), "Ε4 keymap widget ίδια σειρά");
    ok(W.includes('{key:"asymmetrasca_decedens",name:') && W.includes('"colletotrichum_coccodes":["vegetableCrops:tomato"'), "Ε5 widget: ονόματα και ξενιστές");
    // W(T)
    ok(Math.abs(K._sagWetHoursReq(PC, 20) - 2) < 1e-9 && Math.abs(K._sagWetHoursReq(PC, 17.5) - 2.5) < 1e-9 && K._sagWetHoursReq(PC, 0) === 8 && K._sagWetHoursReq("alternaria_solani", 20) === null, "W1 W(T) πίνακας/παρεμβολή (" + K._sagWetHoursReq(PC, 17.5) + ")");
    // ── Α · περονόσπορος κολοκυνθοειδών: 2 υγρές ώρες στους 18 °C = Υψηλός, 3 = Σοβαρός, 1 = Χαμηλός ──
    { const T0 = DATE(11, 3); let st = { data: {} }, r;
      r = tick(K, st, T0, 1, WET18, CUC);
      ok(r.cnt(PC) === 1 && r.firOf(PC) !== null && r.firOf(PC) < 0.2, "Α1 1 ώρα, μέση 20 °C (W=2): FIR " + r.firOf(PC) + " < 0,2");
      r = tick(K, st, T0, 2, WET18, CUC);
      ok(r.cnt(PC) === 2 && Math.abs(r.firOf(PC) - 0.5) < 1e-6 && r.msg(PC) && /Υψηλός/.test(r.msg(PC).value), "Α2 2 ώρες = W(T): FIR 0,5 Υψηλός (" + r.firOf(PC) + ", " + (r.msg(PC) || {}).value + ")");
      r = tick(K, st, T0, 3, WET18, CUC);
      // Οι περονόσποροι μένουν στη λέξη «Υψηλός — επιθεωρήστε» (T-LEAFWET-RH-01)· η κλάση φαίνεται στο FIR 0,75.
      ok(Math.abs(r.firOf(PC) - 0.75) < 1e-6 && r.msg(PC) && /Υψηλός|Σοβαρός/.test(r.msg(PC).value), "Α3 3 ώρες ≥ 1,5×W: FIR 0,75 (" + r.firOf(PC) + ", " + (r.msg(PC) || {}).value + ")");
      // κρύα νύχτα 8 °C: W=8 → 3 ώρες = 0,35×3/8 ≈ 0,13 Χαμηλός
      let s2 = { data: {} };
      for (let h = 1; h <= 3; h++) r = tick(K, s2, T0, h, { T: 10, RH: 96, lm: 60, lt: 9.5, tavg: 8 }, CUC);
      ok(r.cnt(PC) === 3 && r.firOf(PC) < 0.2, "Α4 κρύα νύχτα (8 °C, W=8): 3 ώρες μένουν Χαμηλός (" + r.firOf(PC) + ")");
    }
    // ── Β · HS ουδέτερο: ίδιο FIR με IPSI 1 και IPSI 9 ──
    { const T0 = DATE(11, 3); let a = { data: {} }, b = { data: {} }, ra, rb;
      for (let h = 1; h <= 2; h++) { ra = tick(K, a, T0, h, Object.assign({}, WET18, { ipsi: 1 }), CUC); rb = tick(K, b, T0, h, Object.assign({}, WET18, { ipsi: 9 }), CUC); }
      ok(ra.firOf(PC) !== null && Math.abs(ra.firOf(PC) - rb.firOf(PC)) < 1e-9, "Β1 η καταπόνηση δεν αλλάζει το FIR (" + ra.firOf(PC) + " vs " + rb.firOf(PC) + ")");
      // παλιό παθογόνο (αλτερνάρια, 6 σταθερές ώρες): 6 ώρες → ER 1 → FIR 1 ανεξάρτητα IPSI
      let c = { data: {} }, rc;
      for (let h = 1; h <= 6; h++) rc = tick(K, c, T0, h, { T: 24, RH: 96, lm: 60, lt: 23.5, ipsi: 1 }, TOM);
      ok(rc.firOf("alternaria_solani") !== null && Math.abs(rc.firOf("alternaria_solani") - 1) < 1e-9, "Β2 αλτερνάρια 6 ώρες: FIR 1 (" + rc.firOf("alternaria_solani") + ")");
    }
    // ── Γ · εποχικά παράθυρα ──
    { ok(K._sagInSeasonWindow(LB, 1103) === false && K._sagInSeasonWindow(LB, 615) === true, "Γ1 ευδεμίδα: Νοέμβριος εκτός, Ιούνιος εντός");
      ok(K._sagInSeasonWindow("spilocaea_oleagina", 1103) === true && K._sagInSeasonWindow("spilocaea_oleagina", 715) === false, "Γ2 κυκλοκόνιο: Νοέμβριος εντός, Ιούλιος εκτός");
      ok(K._sagInSeasonWindow("ceratitis_capitata", 115) === true, "Γ3 μεσογειακή μύγα: χωρίς παράθυρο");
      K.setCovered(true); const inGh = K._sagInSeasonWindow(TA, 115); K.setCovered(false); const outGh = K._sagInSeasonWindow(TA, 115);
      ok(inGh === true && outGh === false, "Γ4 τούτα: Ιανουάριος εντός σε θερμοκήπιο, εκτός υπαίθρια");
      // ευδεμίδα 3/11 με 1200 βαθμοημέρες: «Εκτός περιόδου», fir 0
      const T0 = DATE(11, 3); let st = { data: {} };
      const r = tick(K, st, T0, 1, { T: 18, RH: 60, tavg: 18, gdd: 1200, gddKey: LB }, VINE);
      ok(r.msg(LB) && /Χαμηλός/.test(r.msg(LB).value) && /Εκτός περιόδου/.test(r.msg(LB).metadata.text) && r.firOf(LB) === 0, "Γ5 ευδεμίδα Νοέμβριο: Εκτός περιόδου (" + JSON.stringify(r.msg(LB) && r.msg(LB).value) + ")");
      // ευδεμίδα 15/6 με 600 βαθμοημέρες: φαινολογία κανονικά
      const r2 = tick(K, { data: {} }, DATE(6, 15), 1, { T: 24, RH: 60, tavg: 24, gdd: 600, gddKey: LB }, VINE);
      ok(r2.msg(LB) && !/Εκτός περιόδου/.test(r2.msg(LB).metadata.text), "Γ6 ευδεμίδα Ιούνιο: κανονική φαινολογία (" + (r2.msg(LB) || {}).value + ")");
      // δάκος 20/8 με μέγιστη 34 °C: θερινή παύση· με 29 °C: κανονικά
      const r3 = tick(K, { data: {} }, DATE(8, 20), 1, { T: 28, RH: 60, tavg: 28, tmax: 34, gdd: 900, gddKey: BO }, OLIVE);
      ok(r3.msg(BO) && /Θερινή παύση/.test(r3.msg(BO).metadata.text) && r3.firOf(BO) === 0, "Γ7 δάκος με μέγιστη 34 °C: θερινή παύση (" + ((r3.msg(BO) || {}).metadata || {}).text + ")");
      const r4 = tick(K, { data: {} }, DATE(8, 20), 1, { T: 26, RH: 60, tavg: 26, tmax: 29, gdd: 900, gddKey: BO }, OLIVE);
      ok(r4.msg(BO) && !/Θερινή παύση|Εκτός περιόδου/.test(r4.msg(BO).metadata.text), "Γ8 δάκος με μέγιστη 29 °C: κανονικά (" + (r4.msg(BO) || {}).value + ")");
    }
    // ── Δ · προστασία ψεκασμού ──
    { const T0 = DATE(11, 3); let st = { data: {} };
      const sprayIso = new Date(Date.now() - 4 * 86400e3).toISOString();   // πριν 4 ημέρες (ρολόι Date.now() όπως ο πυρήνας), 7 ημέρες δηλωμένες
      let r;
      for (let h = 1; h <= 3; h++) r = tick(K, st, T0, h, Object.assign({}, WET18, { spray: { key: PC, iso: sprayIso, days: 7, wash: 5 } }), CUC);
      const m = r.msg(PC);
      ok(m && /Προστασία έως/.test(m.metadata.text) && !/Ψεκάστε το συντομότερο/.test(m.metadata.text), "Δ1 μέσα στο μεσοδιάστημα (ημέρα 4/7, pei≈0,02), 5 mm: «Προστασία έως», όχι «ψεκάστε» (" + ((m || {}).metadata || {}).text + ")");
      let s2 = { data: {} };
      for (let h = 1; h <= 3; h++) r = tick(K, s2, T0, h, Object.assign({}, WET18, { spray: { key: PC, iso: sprayIso, days: 7, wash: 30 } }), CUC);
      const m2 = r.msg(PC);
      ok(m2 && !/Προστασία έως/.test(m2.metadata.text), "Δ2 ξέπλυμα 30 mm: η προστασία δεν προβάλλεται (" + ((m2 || {}).metadata || {}).text + ")");
    }
  } catch (e) { f.push("ΕΞΑΙΡΕΣΗ: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
  return f;
}
const base = run(SRC);
console.log(base.length ? "ΒΑΣΗ: ΑΠΟΤΥΧΙΑ\n - " + base.join("\n - ") : "ΒΑΣΗ: ΟΚ");
const MUT = [
  ["m1 χωρίς W(T) (σταθερές ώρες)", "const _reqDur = _wtReq !== null ? Math.max(1, _wtReq) :", "const _reqDur = false ? Math.max(1, _wtReq) :"],
  ["m2 κλάσεις ναι/όχι", "er = _ratio >= 1.5 ? 0.75 : _ratio >= 1 ? 0.5 : 0.35 * _ratio;", "er = _ratio >= 1 ? 1 : 0;"],
  ["m3 HS πάλι πολλαπλασιαστής", "const _hsForModel = 1;", "const _hsForModel = hs;"],
  ["m4 χωρίς παράθυρο εντόμων", "if (!_sagInSeasonWindow(pathogenKey, _mdPest)) _pestOff = _sagSilentText(pathogenKey);", "if (false) _pestOff = _sagSilentText(pathogenKey);"],
  ["m5 χωρίς θερινή παύση", "const _SAG_HEAT_ARREST_MAX_C = { bactrocera_oleae: 31 };", "const _SAG_HEAT_ARREST_MAX_C = {};"],
  ["m6 χωρίς εξαίρεση θερμοκηπίου", "if (_SAG_COVERED_ACTIVE && _SAG_SEASON_COVERED_EXEMPT.indexOf(key) >= 0) return true;", "if (false) return true;"],
  ["m7 προστασία πάλι από pei", "if (pr.pei < 0.3 && _wash >= 25) return null;", "if (pr.pei < 0.3) return null;"],
  ["m8 χωρίς ξέπλυμα", "if (pr.pei < 0.3 && _wash >= 25) return null;", "if (false) return null;"],
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
