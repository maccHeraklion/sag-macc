// Ελεγκτής v50.162 · T-SUBSTRATE-01 (Στάδια 0-1): υπόστρωμα κοκοφοίνικα χωρίς ζημιά, με μάθηση.
// Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα (new Function + shim require) και ΕΚΤΕΛΕΙ τις συναρτήσεις.
// Διαφορικό: ο v50.161 (καρφωμένος στο commit f62b02e) και ο v50.162 με τη σημαία ΚΛΕΙΣΤΗ δίνουν
// ΙΔΙΑ έξοδο στις συναρτήσεις που άλλαξαν. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const OLD_COMMIT = "f62b02e";   // v50.161 · d2a5bc74…
const OLD = execSync("git show " + OLD_COMMIT + ":analysis/runPerTich.js", { cwd: path.join(here, "..", ".."), maxBuffer: 1 << 26 })
  .toString("utf8").replace(/\r\n/g, "\n");
const req = createRequire(KPATH);

const FNS = ["_sagSubstrateOf", "_sagSubstrateMask", "_sagSubstrateLearnState", "_sagSubstrateIrrigationMsg",
  "_sagSubstrateEcHist", "_sagSubstrateEcStatus", "_sagPlausibilityGate", "calculate_IPSI", "calculate_IrrigationVolume"];
const OLD_FNS = ["_sagPlausibilityGate", "calculate_IPSI", "calculate_IrrigationVolume"];
function load(src, names, lets) {
  const shim = (m) => {
    if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null, envToJson: () => ({}) } }; }
    return req(m);
  };
  const get = names.map((n) => `case ${JSON.stringify(n)}: return typeof ${n} === 'undefined' ? undefined : ${n};`).join("\n");
  const set = lets.map((n) => `case ${JSON.stringify(n)}: ${n} = v; return true;`).join("\n");
  const tail = `\n;return { get(n){ switch(n){\n${get}\n} throw new Error('όνομα ' + n); }, set(n, v){ switch(n){\n${set}\n} throw new Error('όχι let ' + n); } };`;
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const proc = { env: {}, exit() {}, on() {}, version: process.version, versions: process.versions };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail)(
    shim, { exports: {} }, {}, proc, quiet, path.dirname(KPATH), KPATH);
}
const S = (v) => [{ value: v, time: new Date().toISOString() }];
const J = (x) => { try { return JSON.stringify(x); } catch (e) { return "ERR " + e.message; } };
const call = (f, ...a) => { try { return J(f(...a)); } catch (e) { return "THROW " + e.message; } };
function cut(src, a, b, label) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, j);
}
// Ο εκτιμητής μάθησης ζει μέσα στον κύριο βρόχο: εξάγεται το τμήμα του (από _scPlaus ως _scS) και εκτελείται.
function scKit(src, active) {
  const body = cut(src, "const _scPlaus = ", "            const _scS = ", "εκτιμητής soilcal");
  const moment = req("moment-timezone");
  return new Function("getVal", "measurements", "moment", "_SAG_SUBSTRATE_ACTIVE", "_SAG_SUBSTRATE_MOIST_HI",
    body + "\nreturn { _scUpd, _scPlaus };")(
    (m, k, d) => { const v = m?.data?.[k]; return Array.isArray(v) && v.length ? v[0].value : d; },
    { data: {}, timezone: "Europe/Athens" }, moment, active, 100);
}

const PARAMS = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "vegetative",
  soil_type: "loamy", soil_texture_class: "loam", irrigation_system: "dripIrrigation", area: 1000, total_plants: 2500,
  irrig_emitter_spacing_m: 0.3, irrig_row_spacing_m: 1.2, irrig_emitter_lph: 2 };
const IPSI_DATA = (withSoil) => ({ timezone: "Europe/Athens", data: Object.assign({
  air_temperature: S(26), air_humidity: S(60), soil_temperature1: S(22) },
  withSoil ? { soil_moisture1: S(24), conduct_soil1: S(900) } : {}) });

function run(core) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core, FNS.concat(["_SAG_SUBSTRATE_ACTIVE", "_SAG_SUB_TXT_IPSI"]), ["_SAG_SUBSTRATE_ACTIVE", "_SAG_COVERED_ACTIVE"]);
    const O = load(OLD, OLD_FNS, ["_SAG_COVERED_ACTIVE"]);
    const g = (n) => K.get(n);
    // (ε) ταυτότητα — ακριβής σύγκριση
    const sub = g("_sagSubstrateOf");
    ok(sub({ soil_type: "coir" }) === "coir" && sub({ soil_texture_class: "coir" }) === "coir", "Ε1 'coir' αναγνωρίζεται");
    ok(sub({ soil_type: "constructor" }) === null && sub({ soil_type: "__proto__" }) === null, "Ε2 'constructor'/'__proto__' δεν είναι υπόστρωμα");
    ok(sub({ soil_type: "coir_x" }) === null && sub({ soil_type: "Coir" }) === null && sub({ soil_type: "loam" }) === null && sub(null) === null, "Ε3 μόνο ακριβές 'coir'");
    // (β) μάσκα: φεύγουν υγρασία/αγωγιμότητα, μένουν θερμοκρασία και κατάσταση μάθησης
    const d = { soil_moisture1: 1, soil_moisture1_avg: 1, soil_moisture: 1, water_soil2: 1, soil_humidity: 1, conduct_soil1: 1, conduct_soil_avg: 1,
      soil_temperature1: 1, temp_soil: 1, soilcal_state: "{}", soil_moisture_awc_extra: 1, air_humidity: 1 };
    g("_sagSubstrateMask")(d);
    ok(J(Object.keys(d).sort()) === J(["air_humidity", "soil_moisture_awc_extra", "soil_temperature1", "soilcal_state", "temp_soil"]), "Β1 μάσκα: " + J(Object.keys(d)));
    // (β)/(γ) πύλη ευλογοφάνειας: 62,6 % περνά ΜΟΝΟ σε υπόστρωμα
    const gate = (active, v) => { K.set("_SAG_SUBSTRATE_ACTIVE", active); const dd = { soil_moisture1: S(v) }; g("_sagPlausibilityGate")(dd, "x"); return Array.isArray(dd.soil_moisture1) && dd.soil_moisture1.length === 1; };
    ok(gate("coir", 62.6) === true, "Β2 υπόστρωμα: 62,6 % ΔΕΝ απορρίπτεται");
    ok(gate("coir", 101) === false, "Β3 υπόστρωμα: 101 % απορρίπτεται (εύρος οργάνου)");
    ok(gate(null, 62.6) === false, "Γ1 χώμα: 62,6 % απορρίπτεται όπως πριν");
    ok(gate(null, 40) === true, "Γ2 χώμα: 40 % περνά");
    // (β) IPSI: σε υπόστρωμα (μάσκα → χωρίς υγρασία) το κείμενο είναι του υποστρώματος
    K.set("_SAG_SUBSTRATE_ACTIVE", "coir");
    const ipsiSub = g("calculate_IPSI")(true, IPSI_DATA(false), [{ value: 1.2 }], PARAMS, "");
    ok(ipsiSub.ipsi === undefined && ipsiSub.ipsiError === g("_SAG_SUB_TXT_IPSI"), "Β4 IPSI υποστρώματος: " + J(ipsiSub.ipsiError));
    K.set("_SAG_SUBSTRATE_ACTIVE", null);
    const ipsiSoil = g("calculate_IPSI")(true, IPSI_DATA(false), [{ value: 1.2 }], PARAMS, "");
    ok(/^δεν υπάρχει έγκυρη μέτρηση υγρασίας εδάφους/.test(String(ipsiSoil.ipsiError)), "Γ3 IPSI χωραφιού χωρίς σόνδα: αμετάβλητο κείμενο");
    // (β) άρδευση: σε υπόστρωμα ΠΟΤΕ λίτρα, γκρι «μαθαίνει» με 0 ημέρες
    K.set("_SAG_SUBSTRATE_ACTIVE", "coir");
    const irr = g("calculate_IrrigationVolume")(true, IPSI_DATA(false), undefined, PARAMS) || [];
    const im = irr.find((x) => x.variable === "irrigation_message");
    const lit = irr.find((x) => x.variable === "grossIrrigationLiters");
    ok(im && im.value === "Υπόστρωμα: μαθαίνει (0/10)" && im.metadata.color === "grey", "Β5 άρδευση υποστρώματος: " + J(im));
    ok(!lit || lit.value === null, "Β6 άρδευση υποστρώματος: λίτρα ρητά κενά (" + J(lit) + ")");
    ok(!irr.some((x) => x.metadata && x.metadata.color === "red"), "Β7 ποτέ κόκκινο σε υπόστρωμα");
    ok(String(im && im.metadata.text).length <= 160 && String(im && im.value).length <= 160, "Β8 κείμενο ≤160 χαρακτήρες");
    // (ζ) κατάσταση μάθησης (Ε1)
    const LS = g("_sagSubstrateLearnState");
    const st = (n, fs, extra) => ({ timezone: "Europe/Athens", data: { soilcal_state: S(JSON.stringify({ s: Object.assign({ n, fs }, extra || {}), d: {} })) } });
    ok(LS(st(10, [40, 41, 42, 41, 40])).learned === true, "Ζ1 10 ημέρες, διασπορά 2 → μαθημένο");
    ok(LS(st(12, [40, 44, 42, 41, 40])).learned === false, "Ζ2 διασπορά 4 → όχι μαθημένο");
    ok(LS(st(9, [40, 41, 42, 41, 40])).learned === false, "Ζ3 9 ημέρες → όχι μαθημένο");
    const learnedMsg = g("_sagSubstrateIrrigationMsg")(st(11, [40, 41, 42, 41, 40], { r: 6.25, rd: 7.5 }));
    ok(learnedMsg.metadata.color === "blue" && /κινήθηκε 7,5 μονάδες, συνήθως 6,3\./.test(learnedMsg.metadata.text), "Ζ4 μαθημένο: " + learnedMsg.metadata.text);
    const unstable = g("_sagSubstrateIrrigationMsg")(st(12, [40, 46, 42, 41, 40]));
    ok(/δεν έχει σταθεροποιηθεί/.test(unstable.metadata.text) && unstable.value === "Υπόστρωμα: μαθαίνει (10/10)", "Ζ5 ασταθές: " + unstable.metadata.text);
    // (ζ) ιστορικό και τάση αγωγιμότητας (Ε2)
    const EH = g("_sagSubstrateEcHist"), ES = g("_sagSubstrateEcStatus");
    const em = (ec, t) => ({ timezone: "Europe/Athens", data: { conduct_soil1_avg: S(ec), soil_temperature1_avg: S(t) } });
    let eh = null;
    for (let day = 100; day < 107; day++) eh = EH(eh, em(1000, 25), day);
    ok(eh.v.length === 7 && ES(eh).value === "Υπόστρωμα: μαθαίνει (6/7)", "Ζ6 7 ημέρες → μαθαίνει 6/7 (" + J(eh) + ")");
    ok(J(EH(eh, em(5000, 25), 106)) === J(eh), "Ζ7 ίδια ημέρα: καμία διπλή εγγραφή");
    const up = EH(eh, em(1110, 25), 107), flat = EH(eh, em(1090, 25), 107), down = EH(eh, em(880, 25), 107);
    ok(ES(up).value === "Αγωγιμότητα slab: ανεβαίνει" && ES(flat).value === "Αγωγιμότητα slab: σταθερή" && ES(down).value === "Αγωγιμότητα slab: πέφτει",
      "Ζ8 τάση ±10 %: " + [ES(up).value, ES(flat).value, ES(down).value].join(" | "));
    ok(EH(eh, em(1000, 35), 107).v[7] === 833, "Ζ9 αναγωγή στους 25 °C με 2 %/°C (1000 στους 35 °C → 833)");
    ok(J(EH(eh, em(20, 25), 107)) === J(eh), "Ζ10 νεκρό όργανο (<30 µS/cm): δεν μαθαίνει");
    ok(EH(eh, em(1000, 25), 111).v.length === 1, "Ζ11 κενό >3 ημερών: η εβδομάδα ξεκινά από την αρχή");
    ok(!/κόκκινο|red/.test(J([ES(up), ES(down)])), "Ζ12 η τάση δεν είναι ποτέ κόκκινη");
    // (ζ) εκτιμητής μάθησης: υπόστρωμα με ενδείξεις > 60 μαθαίνει· χώμα με τις ίδιες ΔΕΝ μαθαίνει
    const seq = (kit) => { let s = {}; for (let k = 0; k < 12; k++) {
      s = kit._scUpd(s, 61 + (k % 2) * 0.4, { mn: 61, mx: 69 }); s.k = s.k - 1; } return s; };
    const subSt = seq(scKit(core, "coir"));
    ok(subSt.n >= 10 && Array.isArray(subSt.fs) && subSt.fs.length === 5 && subSt.rd === 8 && Number.isFinite(subSt.r), "Ζ13 υπόστρωμα μαθαίνει >60: " + J(subSt));
    const soilSt = seq(scKit(core, null));
    ok(!soilSt.n && soilSt.fs === undefined, "Ζ14 χώμα: 61–69 % απορρίπτονται όπως πριν (" + J(soilSt) + ")");
    // (η) μέγεθος: πλήρης κατάσταση υποστρώματος
    const full = JSON.stringify({ s: Object.assign({}, subSt), d: {}, eh: up, u: "2026-10-27" });
    const base = JSON.stringify({ s: { w: 61, l: 61.4, k: 20000, e: 1, f: 63.1, n: 11 }, d: {}, u: "2026-10-27" });
    ok(full.length - base.length < 200, "Η1 επιπλέον bytes κατάστασης υποστρώματος " + (full.length - base.length) + " < 200");
    // ΔΙΑΦΟΡΙΚΟ v50.161 ↔ v50.162 με κλειστή σημαία: ίδια έξοδος
    K.set("_SAG_SUBSTRATE_ACTIVE", null);
    const cases = [IPSI_DATA(true), IPSI_DATA(false),
      { timezone: "Europe/Athens", data: { air_temperature: S(31), air_humidity: S(35), soil_moisture1: S(14), soil_moisture2: S(22), soil_temperature1: S(27) } },
      { timezone: "Europe/Athens", data: { temperature: S(18), humidity: S(90), soil_moisture: S(38), temp_soil: S(15) } }];
    let diffs = 0, real = 0, total = 0;
    const seen = (x) => { total++; if (!/^THROW|^undefined$/.test(x) && x.length > 20) real++; return x; };
    for (const c of cases) {
      for (const cov of [false, true]) {
        K.set("_SAG_COVERED_ACTIVE", cov); O.set("_SAG_COVERED_ACTIVE", cov);
        const a = (fn, ...x) => seen(call(K.get(fn), ...JSON.parse(JSON.stringify(x))));
        const b = (fn, ...x) => call(O.get(fn), ...JSON.parse(JSON.stringify(x)));
        if (a("calculate_IPSI", true, c, [{ value: 1.4 }], PARAMS, "") !== b("calculate_IPSI", true, c, [{ value: 1.4 }], PARAMS, "")) diffs++;
        if (a("calculate_IrrigationVolume", true, c, undefined, PARAMS) !== b("calculate_IrrigationVolume", true, c, undefined, PARAMS)) diffs++;
        const g1 = JSON.parse(JSON.stringify(c.data)), g2 = JSON.parse(JSON.stringify(c.data));
        g1.soil_moisture1 = S(62.6); g2.soil_moisture1 = S(62.6);
        if (call(K.get("_sagPlausibilityGate"), g1, "x") + J(g1) !== call(O.get("_sagPlausibilityGate"), g2, "x") + J(g2)) diffs++;
      }
    }
    const kitN = scKit(core, null), kitO = scKit(OLD, undefined);
    const seqDiff = (kit) => { let s = {}; const out = []; for (let k = 0; k < 15; k++) {
      s = kit._scUpd(s, 18 + (k % 3) * 4, { mn: 16, mx: 26 + (k % 2) }); out.push(J(s)); s.k = s.k - 1; } return out.join("|"); };
    if (seqDiff(kitN) !== seqDiff(kitO)) diffs++;
    ok(diffs === 0, "Δ1 διαφορικό v50.161 ↔ v50.162 (σημαία κλειστή): " + diffs + " διαφορές");
    ok(real === total && total === 16, "Δ2 το διαφορικό συγκρίνει ΠΡΑΓΜΑΤΙΚΑ αποτελέσματα, όχι σφάλματα: " + real + "/" + total);
    if (process.env.SUB_DEBUG) console.log("δείγμα άρδευσης:", call(K.get("calculate_IrrigationVolume"), true, cases[0], undefined, PARAMS).slice(0, 400));
    // στατικοί έλεγχοι καλωδίωσης στον κύριο βρόχο
    ok(/for \(let i = 0; i < fields\.length; i=i\+1\)\n    \{\n      _SAG_SUBSTRATE_ACTIVE = null;/.test(core), "Σ1 μηδενισμός σημαίας σε κάθε αγρό");
    const iSet = core.indexOf("_SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);"), iGet = core.indexOf("const measurements = await getMeasurements(");
    ok(iSet > 0 && iSet < iGet, "Σ2 η σημαία ορίζεται ΠΡΙΝ το getMeasurements");
    ok(/injectPrevIndicators\(measurementsForCrop[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(_SAG_SUBSTRATE_ACTIVE\) _sagSubstrateMask\(measurementsForCrop\.data\);/.test(core), "Σ3 μάσκα ΜΟΝΟ στο αντίγραφο της καλλιέργειας");
    ok((core.match(/_sagSubstrateMask\(/g) || []).length === 2, "Σ4 η μάσκα καλείται σε ΕΝΑ σημείο");
    ok(core.includes("const _ecRefIndicators = _SAG_SUBSTRATE_ACTIVE ? [] : _sagEcRefIndicators("), "Σ5 χωρίς αναφορά EC σε υπόστρωμα");
    ok(/if \(_SAG_SUBSTRATE_ACTIVE\) \{\n(?:\s*\/\/[^\n]*\n)+\s*\} else if \(_ecDiv\) \{/.test(core), "Σ6 χωρίς κρίση αλατότητας/ECe σε υπόστρωμα");
    ok(core.includes("...(_SAG_SUBSTRATE_ACTIVE ? [] : _sagEcIndicators(measurements, fieldConfig,"), "Σ7 χωρίς _sagEcIndicators σε υπόστρωμα");
    ok(core.includes("...(_SAG_SUBSTRATE_ACTIVE ? [] : _sagDivergenceIndicators(measurements?.data))"), "Σ8 χωρίς απόκλιση βαθών σε υπόστρωμα");
    ok(core.includes("const limIndicators = _SAG_SUBSTRATE_ACTIVE ? [] : buildSoilMoistureLimitIndicators(lim);"), "Σ9 χωρίς όρια υγρασίας σε υπόστρωμα");
    ok(core.includes("if (_SAG_SUBSTRATE_ACTIVE) _soilcalIndicators.push(_sagSubstrateEcStatus(_scEh));"), "Σ10 κάρτα αγωγιμότητας από τη μάθηση");
    ok(core.includes("_sagFaultIndicators(measurements?.data)") && !/_sagSubstrateMask\(measurements\.data\)/.test(core), "Σ11 η υγεία οργάνων βλέπει ωμές τιμές");
    ok(core.includes("if (_SAG_SUBSTRATE_ACTIVE && !fieldConfig?.covered_cultivation) _gapF.push('υπόστρωμα σε ακάλυπτο αγρό');"), "Σ12 σημείωση: υπόστρωμα σε ακάλυπτο αγρό");
    ok(!/SOIL_PROFILE\.coir|\bcoir:\s*\{\s*name:[^}]*hydraulics/.test(core), "Σ13 ο κοκοφοίνικας ΔΕΝ μπαίνει στο SOIL_PROFILE");
    ok(/const SAG_KERNEL_VERSION = 'v50\.162 · 2026-10-27';/.test(core) && /const SAG_KERNEL_VERSION = 'v50\.161 · 2026-10-14';/.test(OLD), "Σ14 εκδόσεις v50.161 → v50.162");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}

const base = run(CORE);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (διαφορικό έναντι " + OLD_COMMIT + ")");
const MUT = [
  ["m1 χωρίς μάσκα", "if (_SAG_SUBSTRATE_ACTIVE) _sagSubstrateMask(measurementsForCrop.data);", ""],
  ["m2 μάσκα σε όλο τον αγρό", "_sagSubstrateMask(measurementsForCrop.data);", "_sagSubstrateMask(measurements.data);"],
  ["m3 σημαία πάντα αληθής", "_SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);", "_SAG_SUBSTRATE_ACTIVE = 'coir';"],
  ["m4 σημαία χωρίς μηδενισμό", "      _SAG_SUBSTRATE_ACTIVE = null;   // T-SUBSTRATE-01: ποτέ μεταφορά", "      // T-SUBSTRATE-01: ποτέ μεταφορά"],
  ["m5 όριο 60 χωρίς εξαίρεση", ": (_SAG_SUBSTRATE_ACTIVE && _SAG_SUBSTRATE_MOIST_RE.test(_kBase))", ": (false && _SAG_SUBSTRATE_MOIST_RE.test(_kBase))"],
  ["m6 όριο 100 για όλους", ": (_SAG_SUBSTRATE_ACTIVE && _SAG_SUBSTRATE_MOIST_RE.test(_kBase))", ": (_SAG_SUBSTRATE_MOIST_RE.test(_kBase))"],
  ["m7 χωρίς παράλειψη αλατότητας", "            if (_SAG_SUBSTRATE_ACTIVE) {\n              // T-SUBSTRATE-01: η κάρτα", "            if (false) {\n              // T-SUBSTRATE-01: η κάρτα"],
  ["m8 χωρίς παράλειψη _sagEcIndicators", "...(_SAG_SUBSTRATE_ACTIVE ? [] : _sagEcIndicators(", "...(false ? [] : _sagEcIndicators("],
  ["m9 χωρίς κείμενο άρδευσης υποστρώματος", "  if (_SAG_SUBSTRATE_ACTIVE) return emitIrrigationState([_sagSubstrateIrrigationMsg(measurements)]);\n", ""],
  ["m10 μη ακριβής σύγκριση", "for (const _k of _c) if (_k === 'coir') return 'coir';", "for (const _k of _c) if (String(_k).toLowerCase().includes('coir')) return 'coir';"],
  ["m11 χωρίς κείμενο IPSI υποστρώματος", "ipsiError: _SAG_SUBSTRATE_ACTIVE ? _SAG_SUB_TXT_IPSI : \"", "ipsiError: \""],
  ["m12 Ε1 χωρίς διασπορά", "const learned = n >= _SAG_SUB_LEARN_N && spread !== null && spread <= _SAG_SUB_LEARN_SPREAD;", "const learned = n >= _SAG_SUB_LEARN_N;"],
  ["m13 Ε2 κατώφλι 0", "const w = rel > _SAG_SUB_EC_TREND ?", "const w = rel > 0 ?"],
  ["m14 μάθηση με όριο 60", "&& v <= (_SAG_SUBSTRATE_ACTIVE ? _SAG_SUBSTRATE_MOIST_HI : 60);", "&& v <= 60;"],
  ["m15 χωρίς παράλειψη ορίων υγρασίας", "const limIndicators = _SAG_SUBSTRATE_ACTIVE ? [] : buildSoilMoistureLimitIndicators(lim);", "const limIndicators = buildSoilMoistureLimitIndicators(lim);"],
  ["m16 μάθηση χωρίς πύλη (fs και για χώμα)", "if (_SAG_SUBSTRATE_ACTIVE) st.fs = ", "if (true) st.fs = "],
  ["m17 χωρίς αναγωγή 25 °C", "const ec25 = _tf > 0.2 ? ec / _tf : ec;", "const ec25 = ec;"],
  ["m18 έκδοση", "'v50.162 · 2026-10-27'", "'v50.161 · 2026-10-14'"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = CORE.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(CORE.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 140)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
