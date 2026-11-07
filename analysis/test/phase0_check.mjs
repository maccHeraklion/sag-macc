// Ελεγκτής T-PHASE0-01 (v50.182, 6/11/2026): πέντε διορθώσεις σφαλμάτων της αλυσίδας ασθενειών, πάνω στον πραγματικό πυρήνα.
// Ν3 ώρα βροχής και όριο RH · Ν4 κρίση σκιάς στα μεσάνυχτα · Ν5 αισθητήρας φύλλου εκτός χώρου ή με μηδενικά ·
// Ν9 ώρες στο κείμενο · Δ διπλή μέτρηση μυκήτων. Και ότι ό,τι ΔΕΝ έπρεπε να αλλάξει έμεινε ίδιο.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagLeafWetness, packCalculatedIndicators, decompressFieldBundle, _sagKeyTtlHours, PATHOGEN_PROFILE, SAG_KERNEL_VERSION, _SAG_LWS_COLD_DT, setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; }, setTick: (h) => { _SAG_TICK_H = h; } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
// Υπαίθρια ντομάτα (όχι καλυμμένη, ώστε να μετρά η βροχή) και αμπέλι
const TOM = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "fruiting", name: "T", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation" };
const VINE = { cultivation_type_general: "vineCrops", cultivation_type: "wine_grapes", stage: "vegetative", name: "V", soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" };
const PI = "phytophthora_infestans", AS = "alternaria_solani", EN = "erysiphe_necator", LT = "leveillula_taurica";
// 3 Νοεμβρίου 13:00 ώρα Ελλάδας = 11:00 UTC
const T0 = Date.UTC(2026, 10, 3, 11, 0, 0);
function mkMeas(prevData, t0, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = Number.isFinite(o.dp) ? o.dp : (T - (100 - RH) / 5);
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; else delete data.leaf_moisture;
  if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }]; else delete data.leaf_temperature;
  if (o.rain !== undefined) data.rain_height_hourly = [{ value: o.rain }]; else delete data.rain_height_hourly;
  data.ipsi_avg = [{ value: 2 }];
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
  const fir = K.calculate_FIR(true, daily, meas, [{ variable: "ipsi", value: 2 }], crop) || [];
  const msgs = K.getPathogenMessages(fir, meas) || [];
  state.data = {};
  for (const x of [...gdd, ...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  const g = (arr, v) => { let r = null; for (const x of arr) if (x && x.variable === v) r = x; return r; };
  return { ih, fir, msgs, cnt: (k) => { const e = g(ih, "infection_hours_counter_" + k); return e ? Number(e.value) : null; },
    firOf: (k) => { const e = g(fir, "fir_" + k); return e ? Number(e.value) : null; }, msg: (k) => g(msgs, "fir_message_" + k), get: (v) => g(ih, v) };
}
const WET = { T: 16, RH: 96, lm: 60, lt: 15.5 };   // υγρό από αισθητήρα
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.187 · 2026-11-07", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    ok(K._SAG_LWS_COLD_DT === 3, "Ε2 όριο ψυχρού αισθητήρα 3 °C (" + K._SAG_LWS_COLD_DT + ")");
    const p = (k) => Object.values(K.PATHOGEN_PROFILE).map((c) => c && c[k]).find(Boolean);
    ok(p(PI).optimalHumidity.min === 90 && p(PI).requiredDurationHrs === 10 && p(AS).requiredDurationHrs === 6 && p(EN).requiredDurationHrs === 6, "Ε3 τα όρια των παθογόνων δεν άλλαξαν");

    // ── Ν3 · ώρα με βροχή και RH κάτω από το όριο ──
    { let st = { data: {} }, r;
      for (let h = 1; h <= 4; h++) r = tick(K, st, T0, h, WET, TOM);
      ok(r.cnt(PI) === 4, "Ν3α 4 υγρές ώρες από αισθητήρα (" + r.cnt(PI) + ")");
      r = tick(K, st, T0, 5, { T: 16, RH: 86, lm: 5, lt: 16, rain: 3 }, TOM);
      ok(r.get("leaf_wetness_source").value === "Βροχή", "Ν3β η πηγή είναι βροχή (" + r.get("leaf_wetness_source").value + ")");
      ok(r.cnt(PI) === 5 && r.cnt(AS) === 5, "Ν3γ ώρα βροχής με RH 86 ΣΥΝΕΧΙΖΕΙ τον μετρητή (περονόσπορος " + r.cnt(PI) + ", αλτερνάρια " + r.cnt(AS) + ")");
      r = tick(K, st, T0, 6, { T: 16, RH: 60, lm: 5, lt: 17 }, TOM);
      ok(r.cnt(PI) === 0, "Ν3δ στεγνή ώρα χωρίς βροχή μηδενίζει όπως πριν (" + r.cnt(PI) + ")");
      // χωρίς αισθητήρα φύλλου: RH 86, χωρίς βροχή → δεν μετρά· με βροχή → μετρά
      let s2 = { data: {} }; let a = tick(K, s2, T0, 1, { T: 16, RH: 86 }, TOM);
      ok(a.cnt(PI) === 0, "Ν3ε RH 86 χωρίς βροχή και χωρίς αισθητήρα: δεν μετρά (" + a.cnt(PI) + ")");
      a = tick(K, s2, T0, 2, { T: 16, RH: 86, rain: 1 }, TOM);
      ok(a.cnt(PI) === 1, "Ν3ζ RH 86 με βροχή 1 mm: μετρά (" + a.cnt(PI) + ")");
      // θερμοκρασία εκτός ορίων: η βροχή δεν την παρακάμπτει
      a = tick(K, { data: {} }, T0, 1, { T: 3, RH: 86, rain: 3 }, TOM);
      ok(a.cnt(PI) === 0, "Ν3η βροχή στους 3 °C (εκτός ορίων θερμοκρασίας): δεν μετρά (" + a.cnt(PI) + ")");
    }
    // ωίδιο αμπελιού (Μάιος): ελαφριά βροχή ΔΕΝ το κόβει μέσω wetLeafInhibits (αμετάβλητο)· δυνατή βροχή το μηδενίζει όπως πριν
    { const TM = Date.UTC(2026, 4, 10, 10, 0, 0); let st = { data: {} }, r;
      for (let h = 1; h <= 3; h++) r = tick(K, st, TM, h, { T: 25, RH: 70 }, VINE);
      ok(r.cnt(EN) === 3, "Ν3θ ωίδιο αμπελιού 3 ώρες (" + r.cnt(EN) + ")");
      r = tick(K, st, TM, 4, { T: 25, RH: 70, rain: 1 }, VINE);
      ok(r.cnt(EN) === 4, "Ν3ι ελαφριά βροχή 1 mm ΔΕΝ μηδενίζει το ωίδιο αμπελιού, όπως πριν (" + r.cnt(EN) + ")");
      r = tick(K, st, TM, 5, { T: 25, RH: 70, rain: 4 }, VINE);
      ok(r.cnt(EN) === 0, "Ν3κ βροχή 4 mm το μηδενίζει όπως πριν (" + r.cnt(EN) + ")");
    }

    // ── Ν4 · η κρίση σκιάς δεν αλλάζει στα μεσάνυχτα ──
    { let st = { data: {} }, r;
      r = tick(K, st, T0, 1, { T: 22, RH: 60, lm: 5, lt: 30 }, TOM);   // 14:00, ήλιος στον αισθητήρα (dT 8)
      ok(r.get("leaf_sensor_placement").value === "Απαιτείται επανατοποθέτηση", "Ν4α ήλιος στις 14:00: κάρτα επανατοποθέτησης");
      let cnts = [];
      for (let h = 7; h <= 14; h++) { r = tick(K, st, T0, h, { T: 16, RH: 93, lm: 5, lt: 16.5, prevH: h === 7 ? 1 : h - 1 }, TOM); cnts.push(r.cnt(PI)); }   // 20:00 → 03:00
      ok(cnts.join(",") === "1,2,3,4,5,6,7,8", "Ν4β ο μετρητής συνεχίζει μέσα από τα μεσάνυχτα (" + cnts.join(",") + ")");
      ok(r.get("leaf_sensor_placement").value === "Σωστή τοποθέτηση", "Ν4γ η ΚΑΡΤΑ τοποθέτησης κρίνει μόνο τη σημερινή ημέρα (" + r.get("leaf_sensor_placement").value + ")");
      ok(r.get("leaf_sensor_dt_max_yday") && r.get("leaf_sensor_dt_max_yday").value === 8, "Ν4δ το χθεσινό μέγιστο κρατιέται (" + JSON.stringify(r.get("leaf_sensor_dt_max_yday")) + ")");
      // επόμενη ημέρα χωρίς ήλιο, και η μεθεπόμενη νύχτα: ο αισθητήρας ξαναγίνεται επαληθευμένος
      for (let h = 15; h <= 35; h++) r = tick(K, st, T0, h, { T: 18, RH: 60, lm: 5, lt: 18.5 }, TOM);   // ως 00:00 της μεθεπόμενης
      r = tick(K, st, T0, 36, { T: 16, RH: 93, lm: 5, lt: 16.5 }, TOM);   // 01:00, δύο ημέρες μετά τον ήλιο
      ok(r.get("leaf_wetness_source").value === "Αισθητήρας φύλλου (στεγνό)" && r.cnt(PI) === 0, "Ν4ε μετά από μία καθαρή ημέρα ο στεγνός αισθητήρας υπερισχύει ξανά (" + r.get("leaf_wetness_source").value + ", " + r.cnt(PI) + ")");
    }
    // σωστά τοποθετημένος αισθητήρας: καμία αλλαγή — το στεγνό υπερισχύει της εκτίμησης, και πριν και μετά τα μεσάνυχτα
    { let st = { data: {} }, r; const src = [];
      for (let h = 1; h <= 14; h++) { r = tick(K, st, T0, h, { T: 16, RH: 93, lm: 5, lt: 16.5 }, TOM); src.push(r.get("leaf_wetness_source").value); }
      ok(src.every((x) => x === "Αισθητήρας φύλλου (στεγνό)") && r.cnt(PI) === 0, "Ν4ζ σκιασμένος αισθητήρας: «στεγνό» παντού, μετρητής 0 (" + Array.from(new Set(src)).join("|") + ")");
    }

    // ── Ν5 · αισθητήρας πολύ ψυχρότερος από τον αέρα ──
    { let r = tick(K, { data: {} }, T0, 1, { T: 18, RH: 60, lm: 0, lt: 0 }, TOM);   // μηδενικά
      ok(r.get("leaf_wetness_source").value !== "Δρόσος (θερμ. φύλλου)" && r.cnt(PI) === 0, "Ν5α αισθητήρας με μηδενικά, RH 60: ΟΧΙ δρόσος (" + r.get("leaf_wetness_source").value + ", " + r.cnt(PI) + ")");
      ok(r.get("leaf_sensor_placement").value === "Εκτός χώρου ή βλάβη" && r.get("leaf_sensor_placement").metadata.color === "orange" && /18,0 °C χαμηλότερη/.test(r.get("leaf_sensor_placement").metadata.text), "Ν5β κάρτα «Εκτός χώρου ή βλάβη» (" + JSON.stringify(r.get("leaf_sensor_placement")) + ")");
      r = tick(K, { data: {} }, T0, 1, { T: 18, RH: 80, lm: 5, lt: 14 }, TOM);   // 4 °C ψυχρότερος (περίπτωση κοινόχρηστου αισθητήρα σε άλλο χώρο, 6/11)
      ok(r.get("leaf_wetness_source").value === "Στεγνό (αβέβαιο)" && r.cnt(PI) === 0, "Ν5γ 4 °C ψυχρότερος, RH 80: όχι δρόσος, «Στεγνό (αβέβαιο)» (" + r.get("leaf_wetness_source").value + ")");
      r = tick(K, { data: {} }, T0, 1, { T: 18, RH: 96, lm: 5, lt: 14 }, TOM);
      ok(r.get("leaf_wetness_source").value === "Δρόσος (εκτίμηση)" && r.cnt(PI) === 1, "Ν5δ 4 °C ψυχρότερος, RH 96: περνά στην ΕΚΤΙΜΗΣΗ από τον αέρα (" + r.get("leaf_wetness_source").value + ")");
      r = tick(K, { data: {} }, T0, 1, { T: 18, RH: 60, lm: 60, lt: 14 }, TOM);
      ok(r.get("leaf_wetness_source").value === "Αισθητήρας φύλλου" && r.cnt(PI) === 1, "Ν5ε το «υγρό» του αισθητήρα μετρά πάντα, και όταν είναι ψυχρός (" + r.get("leaf_wetness_source").value + ")");
      // όρια: 2,9 °C ψυχρότερος = κανονικός· 3,1 = εκτός
      r = tick(K, { data: {} }, T0, 1, { T: 18, RH: 85, dp: 15.6, lm: 5, lt: 15.1 }, TOM);
      ok(r.get("leaf_sensor_placement").value === "Σωστή τοποθέτηση" && r.get("leaf_wetness_source").value === "Δρόσος (θερμ. φύλλου)", "Ν5ζ 2,9 °C ψυχρότερος: κανονικός, η δρόσος από θερμοκρασία φύλλου ισχύει (" + r.get("leaf_sensor_placement").value + ", " + r.get("leaf_wetness_source").value + ")");
      r = tick(K, { data: {} }, T0, 1, { T: 18, RH: 85, dp: 15.6, lm: 5, lt: 14.9 }, TOM);
      ok(r.get("leaf_sensor_placement").value === "Εκτός χώρου ή βλάβη" && r.get("leaf_wetness_source").value !== "Δρόσος (θερμ. φύλλου)", "Ν5η 3,1 °C ψυχρότερος: εκτός, χωρίς δρόσο από θερμοκρασία φύλλου (" + r.get("leaf_wetness_source").value + ")");
      // συνηθισμένη νύχτα δρόσου με σωστό αισθητήρα: αμετάβλητη
      r = tick(K, { data: {} }, T0, 1, { T: 16, RH: 96, lm: 5, lt: 15.4 }, TOM);
      ok(r.get("leaf_wetness_source").value === "Δρόσος (θερμ. φύλλου)" && r.cnt(PI) === 1, "Ν5θ σωστός αισθητήρας, RH 96: δρόσος από θερμοκρασία φύλλου όπως πριν (" + r.get("leaf_wetness_source").value + ")");
      // ένας ψυχρός παλμός δεν «επαληθεύει» τον αισθητήρα για την υπόλοιπη ημέρα
      let st = { data: {} }; tick(K, st, T0, 1, { T: 18, RH: 60, lm: 0, lt: 0 }, TOM);
      r = tick(K, st, T0, 2, { T: 18, RH: 60, lm: 5, lt: 18.5 }, TOM);
      ok(r.get("leaf_sensor_placement").value === "Σωστή τοποθέτηση", "Ν5ι μόλις ο αισθητήρας δώσει λογική τιμή, η κάρτα επανέρχεται (" + r.get("leaf_sensor_placement").value + ")");
    }

    // ── Ν9 · οι ώρες μένουν στο κείμενο αφού στεγνώσει το φύλλο ──
    { let st = { data: {} }, r;
      for (let h = 1; h <= 7; h++) r = tick(K, st, T0, h, WET, TOM);
      ok(/7ω υγρά φύλλα/.test(r.msg(AS).metadata.text) && r.msg(AS).value === "Σοβαρός κίνδυνος", "Ν9α στη διάρκεια: «7ω υγρά φύλλα» (" + r.msg(AS).metadata.text + ")");
      r = tick(K, st, T0, 8, { T: 18, RH: 60, lm: 5, lt: 18.5 }, TOM);
      ok(r.cnt(AS) === 0 && r.msg(AS).value === "Σοβαρός κίνδυνος" && /7ω υγρά φύλλα/.test(r.msg(AS).metadata.text), "Ν9β μία ώρα μετά το στέγνωμα η κάρτα ΚΡΑΤΑ το «7ω υγρά φύλλα» (" + r.msg(AS).metadata.text + ")");
      const low = tick(K, { data: {} }, T0, 1, { T: 18, RH: 60, lm: 5, lt: 18.5 }, TOM);
      ok(low.msg(AS).value === "Χαμηλός κίνδυνος" && low.msg(AS).metadata.text === "Χωρίς κίνδυνο τώρα.", "Ν9γ χωρίς επεισόδιο το κείμενο μένει «Χωρίς κίνδυνο τώρα.»");
    }

    // ── Δ · οι μύκητες μετρώνται μία φορά ──
    { const r = tick(K, { data: {} }, T0, 1, WET, TOM); const st = r.get("infection_model_status").value;
      const nCnt = r.ih.filter((x) => /^infection_hours_counter_(?!max_)/.test(x.variable)).length;
      ok(nCnt === 5 && st === "Ενεργές · 5 μύκητες · μέγ. 1 ω", "Δ1 5 μετρητές (+C. coccodes, v50.184) → «5 μύκητες» (" + nCnt + ", " + st + ")");
    }

    // ── Π · το νέο κλειδί επιβιώνει στο bundle ──
    { const nowMin = Math.floor(Date.now() / 60000); const crops = [{ id: "c1", cultivation_type_general: "vegetableCrops", cultivation_type: "tomato" }];
      const out = K.packCalculatedIndicators({ sharedIndicators: [], perCropIndicators: { c1: [{ variable: "leaf_sensor_dt_max_yday", value: 8, metadata: { internal: true } }, { variable: "leaf_sensor_dt_max_today", value: 0.5 }] },
        prevBundle: { time: new Date(Date.now() - 3600e3).toISOString(), shared: {}, cropsById: {} }, currentCropsConfig: crops });
      const b = K.decompressFieldBundle(out[0].metadata.data); const ind = (b.crops[0] || {}).indicators || {};
      const v = ind.leaf_sensor_dt_max_yday; ok(v !== undefined && Number(v && typeof v === "object" ? v.value : v) === 8, "Π1 το leaf_sensor_dt_max_yday γράφεται στο bundle (" + JSON.stringify(v) + ")");
      ok(K._sagKeyTtlHours("leaf_sensor_dt_max_yday") >= 12, "Π2 διάρκεια ζωής κλειδιού ≥ 12 ώρες (" + K._sagKeyTtlHours("leaf_sensor_dt_max_yday") + ")");
    }
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 η βροχή δεν μετρά στο όριο RH", "(needsWet && (_lwsMeasuredWet || _lwsRainWet));", "(needsWet && _lwsMeasuredWet);"],
  ["M2 η βροχή μπαίνει στο wetLeafInhibits", "const _wetInhibit = pathogen.wetLeafInhibits === true && _lwsMeasuredWet;", "const _wetInhibit = pathogen.wetLeafInhibits === true && (_lwsMeasuredWet || _lwsRainWet);"],
  ["M3 η βροχή παρακάμπτει και τη θερμοκρασία", "const conditionsOk = tempOk && humidityOk && wetOk && !rainInhibit && !_wetInhibit && _inSeason;", "const conditionsOk = (tempOk || _lwsRainWet) && humidityOk && wetOk && !rainInhibit && !_wetInhibit && _inSeason;"],
  ["M4 χωρίς χθεσινό μέγιστο στην κρίση σκιάς", "_lwsDtMax = _lwsColdOff ? NaN : Math.max(dTmax, Number.isFinite(_lwsDtYday) ? _lwsDtYday : -99);", "_lwsDtMax = _lwsColdOff ? NaN : dTmax;"],
  ["M5 το χθεσινό μέγιστο δεν ανανεώνεται στην αλλαγή ημέρας", '_lwsSameDay ? "leaf_sensor_dt_max_yday" : "leaf_sensor_dt_max_today", NaN));', '"leaf_sensor_dt_max_yday", NaN));'],
  ["M6 το χθεσινό μέγιστο δεν ξεχνιέται ποτέ", '_lwsSameDay ? "leaf_sensor_dt_max_yday" : "leaf_sensor_dt_max_today", NaN));', '_lwsSameDay ? "leaf_sensor_dt_max_yday" : "leaf_sensor_dt_max_yday", NaN));'],
  ["M7 ψυχρός αισθητήρας θεωρείται σκιασμένος", "_lwsDtMax = _lwsColdOff ? NaN : Math.max(dTmax, Number.isFinite(_lwsDtYday) ? _lwsDtYday : -99);", "_lwsDtMax = Math.max(dTmax, Number.isFinite(_lwsDtYday) ? _lwsDtYday : -99);"],
  ["M8 όριο ψυχρού 5 °C", "const _SAG_LWS_COLD_DT    = 3;    // °C", "const _SAG_LWS_COLD_DT    = 5;    // °C"],
  ["M9 όριο ψυχρού 2 °C", "const _SAG_LWS_COLD_DT    = 3;    // °C", "const _SAG_LWS_COLD_DT    = 2;    // °C"],
  ["M10 ψυχρός = και το υγρό αγνοείται", "    _lwsColdOff = dTnow < -_SAG_LWS_COLD_DT;\n", "    _lwsColdOff = dTnow < -_SAG_LWS_COLD_DT;\n    if (_lwsColdOff) { return []; }\n"],
  ["M11 κάρτα ψυχρού χωρίς χρώμα προσοχής", '? { variable: "leaf_sensor_placement", value: "Εκτός χώρου ή βλάβη", metadata: { color: "orange",', '? { variable: "leaf_sensor_placement", value: "Εκτός χώρου ή βλάβη", metadata: { color: "green",'],
  ["M12 ώρες μόνο από τον πίνακα fir", "                         measurements ? (Number(getVal(measurements, 'infection_hours_counter_max_' + key, 0)) || 0) : 0);", "                         0);"],
  ["M13 διπλή μέτρηση μυκήτων", "\n      && x.variable.indexOf(INFECTION_HOURS_COUNTER_PREFIX + 'max_') !== 0);", ");"],
  ["M14 η κάρτα τοποθέτησης κρίνει και το χθες", "      : dTmax > 5\n      ? { variable: \"leaf_sensor_placement\", value: \"Απαιτείται επανατοποθέτηση\"", "      : Math.max(dTmax, Number.isFinite(_lwsDtYday) ? _lwsDtYday : -99) > 5\n      ? { variable: \"leaf_sensor_placement\", value: \"Απαιτείται επανατοποθέτηση\""],
];
let bad = 0;
for (const [n, a, b] of M) {
  if (SRC.split(a).length !== 2) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ " + n); bad++; continue; }
  const r = run(SRC.replace(a, b));
  console.log((r.length ? "ΣΚΟΤΩΘΗΚΕ " : "ΕΠΕΖΗΣΕ ") + n + (r.length ? "  ← " + r[0].slice(0, 70) : ""));
  if (!r.length) bad++;
}
console.log(bad ? "ΑΠΟΤΥΧΙΑ: " + bad + " μεταλλάξεις επέζησαν ή ήταν άκυρες" : "ΟΛΕΣ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΣΚΟΤΩΘΗΚΑΝ (" + M.length + "/" + M.length + ")");
process.exit(bad ? 1 : 0);
