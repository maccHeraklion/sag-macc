// Ελεγκτής v50.165 · T-SOILREF-04 (29/10/2026): αισθητήρας απόφασης εδάφους ΜΟΝΟ με δήλωση στη φόρμα.
// Michalis: «Ο μέσος όρος μένει μόνο μέχρι να δηλωθεί αισθητήρας απόφασης στη φόρμα» — μετά την επιστροφή του v50.164
// («ο πιο ξηρός» διάλεξε στον ΚΑΜΠΑΝΗ σόνδα εκτός χώματος → 226.589 λίτρα· ψευδείς βλάβες).
// Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα και ΕΚΤΕΛΕΙ συγχώνευση + επιλογή + λίστα σονδών.
// ΚΕΝΤΡΙΚΟ ΚΡΙΤΗΡΙΟ: ΧΩΡΙΣ δήλωση, ΙΔΙΑ έξοδος με τον ζωντανό v50.163 (commit fc7597c) — και σε αγρούς με πολλές σόνδες.
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const OLD_COMMIT = "fc7597c";   // v50.163 · 3248e5c9… (ζωντανός)
const OLD = execSync("git show " + OLD_COMMIT + ":analysis/runPerTich.js", { cwd: path.join(here, "..", ".."), maxBuffer: 1 << 26 })
  .toString("utf8").replace(/\r\n/g, "\n");
const req = createRequire(KPATH);
function load(src, names) {
  const shim = (m) => {
    if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null, envToJson: () => ({}) } }; }
    return req(m);
  };
  const get = names.map((n) => `case ${JSON.stringify(n)}: return typeof ${n} === 'undefined' ? undefined : ${n};`).join("\n");
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const proc = { env: {}, exit() {}, on() {}, version: process.version, versions: process.versions };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename",
    src + `\n;return { get(n){ switch(n){\n${get}\n} throw new Error('όνομα ' + n); } };`)(
    shim, { exports: {} }, {}, proc, quiet, path.dirname(KPATH), KPATH);
}
const T = new Date(Date.now() - 20 * 60000).toISOString();        // πρόσφατη μέτρηση
const OLDT = new Date(Date.now() - 10 * 3600e3).toISOString();     // 10 ώρες πριν (πάνω από το όριο εδάφους 6ω)
const S = (v, t = T) => [{ value: v, time: t }];
const J = (x) => JSON.stringify(x);
const C = (x) => JSON.parse(J(x));
const se0x = (m1, m2, a1, a2, t1, t2, c1, c2, t = T) => ({ soil_moisture1: S(m1, t), soil_moisture2: S(m2, t), soil_moisture1_avg: S(a1, t), soil_moisture2_avg: S(a2, t),
  soil_temperature1: S(t1, t), soil_temperature2: S(t2, t), conduct_soil1: S(c1, t), conduct_soil2: S(c2, t) });
const MAR = se0x(16.2, 13.6, 16.0, 13.8, 18.4, 18.1, 131, 400);
const PEL = se0x(8.58, 15.9, 8.7, 15.7, 18.3, 18.9, 52, 150);
const BIO = se0x(12.8, 17.9, 12.9, 17.8, 17.0, 18.5, 213, 185);
const IDS = { "Μάρτυρας": "6a7c73108b06e3000cb27004", "Pellet": "6a7c72b046a750000ce1866e", "Βιοδιεγέρτης": "6a7c720c23232f000cf5583b" };
const KAMP = [["Μάρτυρας", MAR], ["Pellet", PEL], ["Βιοδιεγέρτης", BIO]];
function merge(K, devs, withId = true) {
  let d = {};
  for (const [n, v] of devs) d = withId ? K.get("_sagMergeDeviceData")(d, C(v), n, "F", IDS[n] || ("id-" + n)) : K.get("_sagMergeDeviceData")(d, C(v), n, "F");
  return d;
}
const val = (d, k) => (Array.isArray(d[k]) && d[k][0]) ? d[k][0].value : undefined;
const strip = (d) => { const x = C(d); delete x._sagSoilCand; return x; };

async function run(core) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core, ["_sagMergeDeviceData", "_sagApplySoilRef", "_sagDivergenceIndicators", "_sagRootZoneMoisture", "_sagSyncSoilSensors", "SAG_KERNEL_VERSION"]);
    const O = load(OLD, ["_sagMergeDeviceData"]);
    const apply = (d, rid) => { K.get("_sagApplySoilRef")(d, rid, "F"); return d; };
    // ── Α: ΧΩΡΙΣ δήλωση → ο μέσος όρος, ΙΔΙΟΣ με τον v50.163 ──
    const ST1 = { air_temperature: S(20), air_humidity: S(60) }, ST2 = { air_temperature: S(22), air_humidity: S(70) };
    const PH = { soil_ph: S(7.4) };
    const SHAL = { soil_moisture1: S(14), soil_moisture1_avg: S(14.5), soil_temperature1: S(19), conduct_soil1: S(250) };
    const DEEP = { soil_moisture2: S(24), soil_moisture2_avg: S(23.5), soil_temperature2: S(18), conduct_soil2: S(320) };
    const cases = [KAMP, [["Μάρτυρας", MAR], ["Pellet", PEL]], [["Μάρτυρας", MAR]], [["Σ1", ST1], ["Σ2", ST2], ["Βιοδιεγέρτης", BIO]],
      [["pH", PH], ["Pellet", PEL]], [["Ρηχή", SHAL], ["Βαθιά", DEEP]]];
    let diffs = 0;
    for (const cs of cases) { const a = strip(apply(merge(K, cs), "")), b = merge(O, cs, false); if (J(a) !== J(b)) diffs++; }
    ok(diffs === 0, "Α1 ΧΩΡΙΣ δήλωση: ΙΔΙΑ έξοδος με τον ζωντανό v50.163 και με 2–3 σόνδες (" + diffs + "/" + cases.length + " διαφορές)");
    const d0 = apply(merge(K, KAMP), "");
    ok(!d0._sagSoilRef && d0._sagDivergeEc && J(K.get("_sagDivergenceIndicators")(d0)) !== "[]", "Α2 χωρίς δήλωση: καμία επιλογή, η «διαφωνία» μένει όπως πριν");
    ok(J(d0._sagSoilCand) === J(Object.keys(IDS).sort().map(n => ({ i: IDS[n], n }))), "Α3 η λίστα σονδών για τη φόρμα υπάρχει (" + J(d0._sagSoilCand) + ")");
    // ── Β: ΜΕ δήλωση ──
    const dm = apply(merge(K, KAMP), IDS["Μάρτυρας"]);
    for (const k of Object.keys(MAR)) ok(val(dm, k) === MAR[k][0].value && J(dm._sagSrc[k]) === J(["Μάρτυρας"]), "Β1 " + k + " από τον δηλωμένο Μάρτυρα");
    ok(!dm._sagDiverge && !dm._sagDivergeEc && J(K.get("_sagDivergenceIndicators")(dm)) === "[]", "Β2 με δήλωση: καμία «διαφωνία οργάνων» εδάφους");
    ok(dm._sagSoilRef && dm._sagSoilRef.n === "Μάρτυρας" && dm._sagSoilRef.w === "δηλωμένος" && !("_sagSoilDev" in dm), "Β3 σημείωση (" + J(dm._sagSoilRef) + ")");
    const miss = (devs, rid, extra) => { const d = merge(K, devs); if (extra) extra(d); apply(d, rid); return d; };
    const MSTALE = se0x(16.2, 13.6, 16.0, 13.8, 18.4, 18.1, 131, 400, OLDT);
    const ds = miss([["Μάρτυρας", MSTALE], ["Pellet", PEL], ["Βιοδιεγέρτης", BIO]], IDS["Μάρτυρας"]);
    ok(!ds._sagSoilRef && /τις τελευταίες 6 ώρες/.test(ds._sagSoilRefMiss || "") && J(strip(ds)) !== J(strip(dm)), "Β4 δηλωμένη χωρίς πρόσφατη μέτρηση → μέσος όρος (" + ds._sagSoilRefMiss + ")");
    const MEMPTY = C(MAR); for (const k of Object.keys(MEMPTY)) if (/^soil_moisture\d$/.test(k)) MEMPTY[k] = [];
    const de = miss([["Μάρτυρας", MEMPTY], ["Pellet", PEL], ["Βιοδιεγέρτης", BIO]], IDS["Μάρτυρας"]);
    ok(!de._sagSoilRef && /δεν έδωσε έγκυρη υγρασία/.test(de._sagSoilRefMiss || ""), "Β5 δηλωμένη χωρίς έγκυρη υγρασία → μέσος όρος");
    const dk = miss(KAMP, IDS["Μάρτυρας"], (d) => { d._sagFaults = { faults: [{ dev: "Μάρτυρας", kill: true }] }; });
    ok(!dk._sagSoilRef && /κρίθηκε χαλασμένη/.test(dk._sagSoilRefMiss || ""), "Β6 δηλωμένη που κρίθηκε χαλασμένη → μέσος όρος");
    const dw = miss(KAMP, IDS["Μάρτυρας"], (d) => { d._sagFaults = { faults: [{ dev: "Μάρτυρας", kill: false }] }; });
    ok(dw._sagSoilRef && dw._sagSoilRef.n === "Μάρτυρας", "Β7 προειδοποίηση (όχι απόσυρση) δεν ακυρώνει τη δήλωση");
    const MNULL = C(MAR); for (const k of Object.keys(MNULL)) if (/^soil_moisture\d$/.test(k)) MNULL[k] = [{ value: null, time: T }];
    const dn = miss([["Μάρτυρας", MNULL], ["Pellet", PEL], ["Βιοδιεγέρτης", BIO]], IDS["Μάρτυρας"]);
    ok(!dn._sagSoilRef && /δεν έδωσε έγκυρη υγρασία/.test(dn._sagSoilRefMiss || ""), "Β9 πρόσφατη αλλά ΚΕΝΗ τιμή (null ≠ 0) → μέσος όρος");
    const da = apply(merge(K, [["Σ1", ST1], ["Σ2", ST2], ["Μάρτυρας", MAR], ["Pellet", PEL]]), IDS["Μάρτυρας"]);
    ok(da._sagSoilRef && val(da, "air_temperature") === 21 && J(da._sagSrc.air_temperature) === J(["Σ1", "Σ2"]), "Β10 με δήλωση εδάφους ο αέρας ΔΕΝ αλλάζει (" + val(da, "air_temperature") + ")");
    const du = miss(KAMP, "000000000000000000000000");
    ok(!du._sagSoilRef && /δεν μετρά σε κοινό βάθος/.test(du._sagSoilRefMiss || ""), "Β8 άγνωστη σόνδα → μέσος όρος");
    // ── Γ: ρηχή + βαθιά → τίποτα, ριζόστρωμα όπως πριν ──
    const dz = apply(merge(K, [["Ρηχή", SHAL], ["Βαθιά", DEEP]]), "id-Ρηχή");
    ok(!dz._sagSoilRef && !dz._sagSoilCand && val(dz, "soil_moisture1") === 14 && val(dz, "soil_moisture2") === 24, "Γ1 ρηχή+βαθιά: κανένας ανταγωνισμός, και τα δύο βάθη");
    const PRZ = { cultivation_type_general: "olive", cultivation_type: "koroneiki", stage: "vegetative", sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 };
    const rz = K.get("_sagRootZoneMoisture")({ data: dz }, PRZ);
    ok(rz && rz.ok && rz.w1 > 0 && rz.w2 > 0 && /Δύο βάθη/.test(rz.basis), "Γ2 σταθμισμένο ριζόστρωμα από ΔΥΟ βάθη (" + (rz && rz.basis) + ")");
    // ── Λ: λίστα σονδών για τη φόρμα, ΜΟΝΟ όταν αλλάζει ──
    const fakeDev = (last) => { const w = { reads: 0, sent: [] }; w.getData = async () => { w.reads++; return last ? [last] : []; }; w.sendData = async (x) => { w.sent.push(...x); }; return w; };
    const sync = async (dev, data, daily) => K.get("_sagSyncSoilSensors")(dev, data, "F", daily);
    const s1 = fakeDev(null); await sync(s1, d0, false);
    ok(s1.sent.length === 1 && s1.sent[0].variable === "soil_sensors" && s1.sent[0].value === 3, "Λ1 πρώτη φορά: γράφεται η λίστα");
    const s2 = fakeDev({ metadata: { list: C(d0._sagSoilCand) } }); await sync(s2, d0, true);
    ok(s2.reads === 1 && s2.sent.length === 0, "Λ2 ίδια λίστα: ΚΑΜΙΑ εγγραφή");
    const s3 = fakeDev({ metadata: { list: C(d0._sagSoilCand).slice(0, 2) } }); await sync(s3, d0, false);
    ok(s3.sent.length === 1, "Λ3 άλλαξε η λίστα: εγγραφή");
    const s4 = fakeDev(null); await sync(s4, dz, false); await sync(s4, dz, true);
    ok(s4.reads === 1 && s4.sent.length === 0, "Λ4 χωρίς ανταγωνισμό: ανάγνωση μόνο την ημέρα, ΚΑΜΙΑ εγγραφή");
    const s5 = fakeDev({ metadata: { list: C(d0._sagSoilCand) } }); await sync(s5, dz, false); const r5 = s5.sent.length; await sync(s5, dz, true);
    ok(r5 === 0 && s5.sent.length === 1 && s5.sent[0].value === 0, "Λ5 αγρός που ΕΧΑΣΕ σόνδα: η λίστα σβήνει στον ημερήσιο");
    // ── Σ: καλωδίωση ──
    const iF = core.indexOf("  data._sagFaults = _sagSensorFaults(data, fieldName);\n");
    const iA = core.indexOf("  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n");
    const iG = core.indexOf("  _sagPlausibilityGate(data, fieldName);\n  // T-MERGE-SCREEN-01");
    const iR = core.indexOf("  return { data, prevBundle: _ringPrevBundle };", iA);
    ok(iG > 0 && iF > iG && iA > iF && iR > iA && core.split("_sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);").length === 2, "Σ1 η επιλογή τρέχει ΜΕΤΑ την πύλη και τον έλεγχο βλαβών, μία φορά");
    ok(core.split("data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);").length - 1 === 4, "Σ2 και οι 4 κλήσεις συγχώνευσης περνούν το id");
    ok(/_SAG_SUBSTRATE_ACTIVE = null;[^\n]*\n\s*_SAG_SOIL_REF_ID = '';/.test(core) && core.indexOf("_SAG_SOIL_REF_ID = String(fieldConfig?.soil_ref_device || '');") < core.indexOf("const measurements = await getMeasurements("), "Σ3 δήλωση ανά αγρό, μηδενισμός");
    ok(core.includes("if (String(_scPrev.w || '') !== _scW) {") && core.includes("            _scPrev = {};\n")
      && core.split("_scW ? { w: _scW } : {}").length - 1 === 2, "Σ4 μάθηση: επανεκκίνηση σε αλλαγή πηγής + πηγή στην κατάσταση (μόνο με δήλωση)");
    ok(core.includes("if (_SAG_SUBSTRATE_ACTIVE || !_sagDivergenceIndicators(measurements?.data).length) _purgeShared.push('sensor_divergence');")
      && core.includes("_purgeShared.push('soil_ec_status');") && /if \(!dailyTich && \/\^Σε αναστολή\//.test(core), "Σ5 οι κάρτες που δεν ισχύουν πια σβήνουν (αναστολή μόνο εκτός ημερήσιου)");
    const iB = core.indexOf("await dev_to_send_meas.sendData(packedIndicators);"), iY = core.indexOf("try { await _sagSyncSoilSensors(dev_to_send_meas, measurements?.data, fieldName, dailyTich); } catch (_eSS) {}");
    ok(iB > 0 && iY > iB && iY - iB < 300, "Σ6 η λίστα γράφεται αμέσως μετά το bundle, σε try");
    ok(!/ο πιο ξηρός/.test(core.slice(core.indexOf("function _sagApplySoilRef"), core.indexOf("async function _sagSyncSoilSensors"))), "Σ7 καμία αυτόματη επιλογή «πιο ξηρός»");
    ok(K.get("SAG_KERNEL_VERSION") === "v50.166 · 2026-10-31", "Σ8 έκδοση");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = await run(CORE);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (χωρίς δήλωση = v50.163 · με δήλωση + πύλες · ρηχή/βαθιά · λίστα φόρμας · καλωδίωση)");
const MUT = [
  ["m1 χωρίς κλήση επιλογής", "  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n", ""],
  ["m2 χωρίς έλεγχο φρεσκάδας", " && (function (a) { return a !== null && a <= _lim; })(_sagAgeMinutes(d[k], _now))", ""],
  ["m3 χωρίς έλεγχο βλάβης", "(_killed(ref) ? 'η δηλωμένη σόνδα κρίθηκε χαλασμένη' : '')", "''"],
  ["m4 βλάβη = και η προειδοποίηση", "some(f => f && f.kill && f.dev === n)", "some(f => f && f.dev === n)"],
  ["m5 null μετρά ως 0", "return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));", "return Number.isFinite(Number(v));"],
  ["m6 μένει η διαφωνία EC", "      if (data._sagDivergeEc) delete data._sagDivergeEc[k];\n", ""],
  ["m7 η πηγή δεν ενημερώνεται", "data[k] = devs[ref][k]; src[k] = [ref];", "data[k] = devs[ref][k];"],
  ["m8 πειράζει και κανάλια μίας συσκευής", "&& Array.isArray(src[k]) && src[k].length > 1);", "&& Array.isArray(src[k]));"],
  ["m9 μία κλήση χωρίς id", "data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);", "data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName);"],
  ["m10 χωρίς μηδενισμό ανά αγρό", "      _SAG_SOIL_REF_ID = '';          // T-SOILREF-01: ποτέ μεταφορά από τον προηγούμενο αγρό", "      // T-SOILREF-01"],
  ["m11 μένει το _sagSoilDev", "    delete data._sagSoilDev;\n", ""],
  ["m12 και ο αέρας", "const _SAG_SOIL_KEY_RE = /^(soil_|conduct_soil|temp_soil|water_soil)/;", "const _SAG_SOIL_KEY_RE = /^(soil_|conduct_soil|temp_soil|water_soil|air_)/;"],
  ["m13 έκδοση", "'v50.166 · 2026-10-31'", "'v50.164 · 2026-10-29'"],
  ["m14 λίστα κάθε ώρα", "  if (p && keyOf(p.metadata && p.metadata.list) === keyOf(cand)) return false;", "  if (false) return false;"],
  ["m15 λίστα και χωρίς ανταγωνισμό", "  if (!p && !cand.length) return false;", "  if (false) return false;"],
  ["m16 ανάγνωση κάθε ώρα παντού", "  if (!cand.length && !dailyTich) return false;", "  if (false) return false;"],
  ["m17 χωρίς επανεκκίνηση μάθησης", "            _scPrev = {};\n", ""],
  ["m18 χωρίς πηγή στη μάθηση", "Object.assign({ s: _scS, d: _scD, u: _scDay }, _scW ? { w: _scW } : {})", "Object.assign({ s: _scS, d: _scD, u: _scDay }, {})"],
  ["m19 μένει η παλιά διαφωνία", "if (_SAG_SUBSTRATE_ACTIVE || !_sagDivergenceIndicators(measurements?.data).length) _purgeShared.push('sensor_divergence');", "if (false) _purgeShared.push('sensor_divergence');"],
  ["m20 σβήνει και τη φρέσκια ημερήσια κρίση", "          if (!dailyTich && /^Σε αναστολή/", "          if (/^Σε αναστολή/"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = CORE.split(a).length - 1;
  if (n < 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = await run(CORE.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 140)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
