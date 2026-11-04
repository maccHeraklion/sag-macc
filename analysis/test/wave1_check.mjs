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
    + "\n;return { calculate_IrrigationVolume, _sagDetectFaults, _sagDevExpect, _sagFrostIndicators, _sagHeatIndicators, _sagEcDailyVerdict, _sagEceNoWhy, _sagMildewPhase, getPathogenMessages, SAG_KERNEL_VERSION, _cov: (v) => { _SAG_COVERED_ACTIVE = v; } };")(
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
    ok(K.SAG_KERNEL_VERSION === "v50.178 · 2026-11-04", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
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
    // ── Γ: T-COVERED-WX-01 παγετός/καύσωνας σε θερμοκήπιο: ίδια βαθμίδα, άλλο κείμενο ──
    const fc = (v) => ({ ok: true, i0: 0, i1: 3, t: [1793700000000, 1793703600000, 1793707200000], tz: "Europe/Athens", at: (i) => v[i] });
    const crop = { optimal_temp_range: { max: 30 } };
    K._cov(false);
    const fo = K._sagFrostIndicators(fc([3, -1, 4]))[0], ho = K._sagHeatIndicators(fc([31, 33, 29]), crop)[0];
    ok(fo && /Μέτρα: άρδευση/.test(fo.metadata.text) && !/ΕΞΩ/.test(fo.metadata.text), "Γ1 ανοιχτός: παγετός όπως πριν");
    ok(ho && /Ποτίστε ΠΡΙΝ/.test(ho.metadata.text) && !/ΕΞΩ/.test(ho.metadata.text), "Γ2 ανοιχτός: καύσωνας όπως πριν");
    K._cov(true);
    const fg = K._sagFrostIndicators(fc([3, -1, 4]))[0], hg = K._sagHeatIndicators(fc([31, 33, 29]), crop)[0];
    ok(fg && /ΕΞΩ από το θερμοκήπιο/.test(fg.metadata.text) && /ελέγξτε αν χρειάζεται προστασία/.test(fg.metadata.text) && !/Μέτρα: άρδευση/.test(fg.metadata.text), "Γ3 θερμοκήπιο: κείμενο παγετού (" + (fg && fg.metadata.text) + ")");
    ok(hg && /ΕΞΩ από το θερμοκήπιο/.test(hg.metadata.text) && /αερισμό και σκίαση/.test(hg.metadata.text) && !/Ποτίστε ΠΡΙΝ/.test(hg.metadata.text), "Γ4 θερμοκήπιο: κείμενο καύσωνα (" + (hg && hg.metadata.text) + ")");
    ok(fg && fo && fg.value === fo.value && fg.metadata.color === fo.metadata.color && hg && ho && hg.value === ho.value && hg.metadata.color === ho.metadata.color, "Γ5 βαθμίδα και χρώμα ίδια με τον ανοιχτό αγρό");
    ok(K._sagFrostIndicators(fc([8, 9, 10])).length === 0 && K._sagHeatIndicators(fc([20, 21, 22]), crop).length === 0, "Γ6 κάτω από τα όρια κανένας συναγερμός και σε θερμοκήπιο");
    K._cov(false);
    // ── Δ: T-ECE-NOFALLBACK-01 χωρίς ×2,5: πραγματική κρίση και πραγματικό μπλοκ Ks ──
    const V = (o) => K._sagEcDailyVerdict({ e1: 800, e2: null, ref1: null, ref2: null, fert: null, ecw: null, eceMax: 1, eceEst: NaN, eceHow: "", dead: false, refHist: [], today: "2026-11-04", valTxt: "ρηχό 800 µS/cm", ...o });
    const S = (r) => r.find((x) => x.variable === "soil_ec_status");
    const whyDry = K._sagEceNoWhy(800, 12, 45);
    const d1 = S(V({ noEce: whyDry }));
    ok(d1 && d1.value === "Δεν υπολογίζεται σήμερα" && d1.metadata.color === "grey" && /Πολύ ξερό/.test(d1.metadata.text), "Δ1 ξερό: γκρι με αιτία (" + JSON.stringify(d1) + ")");
    ok(K._sagEceNoWhy(800, null, 45).v === "Λείπει η υγρασία" && K._sagEceNoWhy(800, 30, NaN).v === "Δηλώστε τύπο εδάφους", "Δ2 σωστή αιτία ανά περίπτωση");
    const d3 = S(V({ eceEst: 2, noEce: null }));
    ok(d3 && d3.metadata.color === "red" && /Πάνω από το όριο/.test(d3.value), "Δ3 με ECe από αλυσίδα: η κρίση ορίου ισχύει όπως πριν");
    const d4 = S(V({ ref1: 2.9, fert: 3.3, noEce: whyDry }));
    ok(d4 && d4.value === "Χωρίς συσσώρευση", "Δ4 με αναφορά: η κρίση λόγου μένει (" + (d4 && d4.value) + ")");
    const d5 = S(V({ noEce: null }));
    ok(d5 && d5.value === "Αναμονή αναφοράς", "Δ5 χωρίς αιτία: αναμονή αναφοράς όπως πριν");
    const ks0 = core.indexOf("if (Number.isFinite(_eceMax) && e1 !== null && !_deadDaily");
    const ks1 = core.indexOf("\n            }\n            if (phv !== null) {", ks0);
    const KS = new Function("_eceMax", "e1", "_deadDaily", "_eceW", "_ecphIndicators", "_eceNoWhy", core.slice(ks0 < 0 ? 0 : ks0, ks1));
    const r1 = []; KS(2.5, 800, false, { v: NaN, el: "ρηχό", how: "" }, r1, whyDry);
    const ksv = (r, v) => r.find((x) => x.variable === v);
    ok(ksv(r1, "salinity_ks") && ksv(r1, "salinity_ks").value === null && ksv(r1, "salinity_stress").value === "Μη διαθέσιμο" && ksv(r1, "salinity_stress").metadata.color === "grey", "Δ6 χωρίς ECe: κανένα Ks, «Μη διαθέσιμο» (" + JSON.stringify(r1).slice(0, 160) + ")");
    const r2 = []; KS(2.5, 800, false, { v: 6.2, el: "ρηχό", how: " (ρηχό)" }, r2, whyDry);
    ok(ksv(r2, "salinity_ks").value < 1 && /εκτίμηση/.test(ksv(r2, "salinity_stress").value), "Δ7 με ECe: Ks όπως πριν");
    const c0 = core.indexOf("            const _eceChain2 = "), c1 = core.indexOf("\n", core.indexOf("how: '' });", c0));
    const EW = new Function("e1", "e2", "_ecNum1", "_eceChain", "_sagEcChain", "_nE", "_ecSatE", core.slice(c0, c1) + "\n;return _eceW;");
    ok(Number.isNaN(EW(800, null, true, null, () => ({ ece: null }), () => null, 45).v), "Δ8 χωρίς αλυσίδα: καμία τιμή, ούτε ×2,5");
    // ── Ε: T-MILDEW-INSPECT-01 ωίδιο: πραγματική getPathogenMessages με καρφωμένη ημερομηνία ──
    const ph = K._sagMildewPhase, EN = "erysiphe_necator";
    ok(ph(EN, 1130) === "normal" && ph(EN, 1201) === "silent" && ph(EN, 215) === "silent" && ph(EN, 216) === "normal" && ph(EN, 331) === "normal" && ph(EN, 401) === "critical" && ph(EN, 630) === "critical" && ph(EN, 701) === "normal", "Ε1 όρια ημερομηνιών αμπελιού");
    ok(ph("podosphaera_xanthii", 101) === "normal" && ph("leveillula_taurica", 515) === "normal" && ph("plasmopara_viticola", 515) === "critical" && ph("alternaria_solani", 515) === "off", "Ε2 λαχανικά πάντα κανονική, περονόσπορος αμπελιού με ημερολόγιο (T-LEAFWET-RH-01), άλλες εκτός");
    const realNow = Date.now;
    const msgs = (iso, key, v) => { Date.now = () => Date.parse(iso); try { return K.getPathogenMessages([{ variable: "fir_" + key, value: v }], { timezone: "Europe/Athens", data: {} }).filter((x) => x.variable === "fir_message_" + key); } finally { Date.now = realNow; } };
    const msg = (iso, key, v) => msgs(iso, key, v)[0];
    const NOV = "2026-11-04T10:00:00Z", MAY = "2026-05-15T10:00:00Z", JAN = "2026-01-15T10:00:00Z";
    const e3 = msg(NOV, EN, 0.9);
    ok(e3 && e3.value === "Υψηλός κίνδυνος" && e3.metadata.color === "orange" && /επιθεωρήστε το φύλλωμα/.test(e3.metadata.text) && !/το συντομότερο/.test(e3.metadata.text), "Ε3 αμπέλι Νοέμβριος: επιθεώρηση (" + JSON.stringify(e3) + ")");
    const e4 = msg(MAY, EN, 0.9);
    ok(e4 && e4.value === "Σοβαρός κίνδυνος" && e4.metadata.color === "red" && /Ψεκάστε το συντομότερο/.test(e4.metadata.text), "Ε4 αμπέλι Μάιος: όπως πριν (" + JSON.stringify(e4) + ")");
    const e5 = msg(JAN, EN, 0.9);
    ok(e5 && e5.value === "Χαμηλός κίνδυνος" && e5.metadata.color === "green" && msgs(JAN, EN, 0.9).length === 1 && msgs(NOV, EN, 0.9).length === 1, "Ε5 αμπέλι Ιανουάριος: σιωπή, ένα μόνο μήνυμα (" + JSON.stringify(e5) + ")");
    const e6 = msg(JAN, "leveillula_taurica", 0.9);
    ok(e6 && e6.value === "Υψηλός κίνδυνος" && /επιθεωρήστε/.test(e6.metadata.text), "Ε6 σολανώδη και τον Ιανουάριο: επιθεώρηση");
    const e7 = msg(NOV, "podosphaera_xanthii", 0.5);
    ok(e7 && e7.value === "Υψηλός κίνδυνος" && /επιθεωρήστε/.test(e7.metadata.text) && !/Ετοιμάστε/.test(e7.metadata.text), "Ε7 κολοκυνθοειδή 0,5: επιθεώρηση");
    const e8 = msg(NOV, EN, 0.3);
    ok(e8 && e8.value === "Μέτριος κίνδυνος", "Ε8 κάτω από 0,4: όπως πριν (" + (e8 && e8.value) + ")");
    const e9 = msg(NOV, "plasmopara_viticola", 0.9);
    ok(e9 && e9.value === "Υψηλός κίνδυνος" && e9.metadata.color === "orange", "Ε9 περονόσπορος αμπελιού Νοέμβριο (T-LEAFWET-RH-01): επιθεώρηση (" + JSON.stringify(e9) + ")");
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
  ["μ6 παγετός σβήνει σε θερμοκήπιο", "    if (mn > _SAG_FROST_WARN_C) return [];", "    if (mn > _SAG_FROST_WARN_C || _SAG_COVERED_ACTIVE) return [];"],
  ["μ7 καύσωνας με κείμενο ανοιχτού παντού", "        text: _SAG_COVERED_ACTIVE\n          ? 'Η πρόγνωση δίνει έως '", "        text: false\n          ? 'Η πρόγνωση δίνει έως '"],
  ["μ8 παγετός με κείμενο θερμοκηπίου παντού", "        text: _SAG_COVERED_ACTIVE\n          ? 'Η πρόγνωση δίνει ' + v1", "        text: true\n          ? 'Η πρόγνωση δίνει ' + v1"],
  ["μ9 επιστροφή του ×2,5", "{ v: NaN, el: 'ρηχό', how: '' });", "{ v: (e1 !== null ? e1 / 1000 * 2.5 : NaN), el: 'ρηχό', how: '' });"],
  ["μ10 Ks χωρίς φρουρό", " && !Number.isFinite(_eceW.v)) {   // T-ECE-NOFALLBACK-01", " && false) {   // T-ECE-NOFALLBACK-01"],
  ["μ11 κάρτα χωρίς αιτία", "if (!hasRef && a.noEce) {", "if (false) {"],
  ["μ12 αιτία πάντα ξερό", "if (vwc === null || vwc === undefined) return", "if (false) return"],
  ["μ13 σιωπή ως 28/2", "if (md >= 1201 || md <= 215) return", "if (md >= 1201 || md <= 228) return"],
  ["μ14 κρίσιμη από 15/4", "if (md >= 401 && md <= 630) return", "if (md >= 415 && md <= 630) return"],
  ["μ15 κρίσιμη και στα λαχανικά", "if (key !== 'erysiphe_necator' && key !== 'plasmopara_viticola') return 'normal';", "if (false) return 'normal';"],
  ["μ16 όριο 0,7 αντί 0,4", "if (_mildew === 'normal' && firValue >= 0.4) {", "if (_mildew === 'normal' && firValue >= 0.7) {"],
  ["μ17 όλες οι ασθένειες σαν ωίδιο", "if (_SAG_MILDEW_INSPECT.indexOf(key) < 0 && _SAG_WET_INSPECT.indexOf(key) < 0) return 'off';", ""],
  ["μ18 σιωπή χωρίς continue", "+ ' του αμπελιού.' } }];\n      continue;", "+ ' του αμπελιού.' } }];"],
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
