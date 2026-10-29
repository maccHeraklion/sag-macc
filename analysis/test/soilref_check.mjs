// Ελεγκτής v50.164 · T-SOILREF-01 (29/10/2026): ΕΝΑΣ αισθητήρας απόφασης για το έδαφος, όχι μέσος όρος (επιλογή «Α»).
// Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα και ΕΚΤΕΛΕΙ τη συγχώνευση + την επιλογή με τα νούμερα του Καμπιτάκη BIO.
// Διαφορικό έναντι v50.163 (commit fc7597c): με ΕΝΑΝ αισθητήρα εδάφους, και για τον αέρα, ΙΔΙΑ έξοδος.
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const OLD_COMMIT = "fc7597c";   // v50.163 · 3248e5c9…
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
const T = "2026-10-29T16:12:38.000Z";
const S = (v) => [{ value: v, time: T }];
const J = (x) => JSON.stringify(x);
const C = (x) => JSON.parse(J(x));
const se0x = (m1, m2, a1, a2, t1, t2, c1, c2) => ({ soil_moisture1: S(m1), soil_moisture2: S(m2), soil_moisture1_avg: S(a1), soil_moisture2_avg: S(a2),
  soil_temperature1: S(t1), soil_temperature2: S(t2), conduct_soil1: S(c1), conduct_soil2: S(c2) });
// Καμπιτάκης BIO 29/10 (υγρασία/θερμ. από τα στιγμιότυπα)· ο Pellet είναι ο πιο ξηρός στον μέσο 24ώρου.
const MAR = se0x(16.2, 13.6, 16.0, 13.8, 18.4, 18.1, 131, 400);
const PEL = se0x(8.58, 15.9, 8.7, 15.7, 18.3, 18.9, 52, 150);
const BIO = se0x(12.8, 17.9, 12.9, 17.8, 17.0, 18.5, 213, 185);
const IDS = { "Μάρτυρας": "6a7c73108b06e3000cb27004", "Pellet": "6a7c72b046a750000ce1866e", "Βιοδιεγέρτης": "6a7c720c23232f000cf5583b" };
function merge(K, devs, withId = true) {
  let d = {};
  for (const [n, v] of devs) d = withId ? K.get("_sagMergeDeviceData")(d, C(v), n, "F", IDS[n] || ("id-" + n)) : K.get("_sagMergeDeviceData")(d, C(v), n, "F");
  return d;
}
const KAMP = [["Μάρτυρας", MAR], ["Pellet", PEL], ["Βιοδιεγέρτης", BIO]];
const val = (d, k) => (Array.isArray(d[k]) && d[k][0]) ? d[k][0].value : undefined;

function run(core) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core, ["_sagMergeDeviceData", "_sagApplySoilRef", "_sagMultiSensorIndicators", "_sagDivergenceIndicators", "_sagRootZoneMoisture", "SAG_KERNEL_VERSION"]);
    const O = load(OLD, ["_sagMergeDeviceData"]);
    const apply = (d, rid) => { K.get("_sagApplySoilRef")(d, rid, "F"); return d; };
    // ── Κ: Καμπιτάκης, 3 σόνδες, καμία δήλωση → ο πιο ξηρός (Pellet, μέσος 24ώρου 12,2 %) ──
    const before = merge(K, KAMP);
    ok(before._sagDivergeEc && J(K.get("_sagDivergenceIndicators")(before)) !== "[]", "Κ0 πριν: ο μέσος όρος έβγαζε «διαφωνία οργάνων» (αγωγιμότητα 400 ↔ 150)");
    const d = apply(C(before), "");
    for (const k of Object.keys(PEL)) ok(val(d, k) === PEL[k][0].value, "Κ1 " + k + " από τον Pellet (" + val(d, k) + " ≠ " + PEL[k][0].value + ")");
    for (const k of Object.keys(PEL)) ok(J(d._sagSrc[k]) === J(["Pellet"]), "Κ2 πηγή " + k + " = μόνο ο Pellet (" + J(d._sagSrc[k]) + ")");
    ok(!d._sagDiverge && !d._sagDivergeEc && J(K.get("_sagDivergenceIndicators")(d)) === "[]", "Κ3 καμία «διαφωνία οργάνων» εδάφους");
    ok(J(K.get("_sagMultiSensorIndicators")(d)) === "[]", "Κ4 κανένα μέγεθος εδάφους «από πολλαπλούς αισθητήρες»");
    ok(d._sagSoilRef && d._sagSoilRef.n === "Pellet" && d._sagSoilRef.w === "ο πιο ξηρός" && d._sagSoilRef.c === 3 && !("_sagSoilDev" in d), "Κ5 σημείωση επιλογής (" + J(d._sagSoilRef) + ")");
    // ── δήλωση ──
    const dm = apply(C(before), IDS["Μάρτυρας"]);
    ok(val(dm, "soil_moisture2") === 13.6 && val(dm, "conduct_soil1") === 131 && dm._sagSoilRef.w === "δηλωμένος", "Κ6 δηλωμένος Μάρτυρας (" + J(dm._sagSoilRef) + ")");
    const MARX = C(MAR); for (const k of Object.keys(MARX)) if (/^soil_moisture/.test(k)) MARX[k] = [];
    const dx = apply(merge(K, [["Μάρτυρας", MARX], ["Pellet", PEL], ["Βιοδιεγέρτης", BIO]]), IDS["Μάρτυρας"]);
    ok(dx._sagSoilRef && dx._sagSoilRef.n === "Pellet" && /δεν δίνει έγκυρη υγρασία/.test(dx._sagSoilRef.w), "Κ7 δηλωμένος χωρίς έγκυρη υγρασία → ο πιο ξηρός (" + J(dx._sagSoilRef) + ")");
    ok(apply(C(before), "000000000000000000000000")._sagSoilRef.n === "Pellet", "Κ8 άγνωστο id → ο πιο ξηρός");
    // ── μέσος 24ώρου, όχι η τελευταία τιμή ──
    const X = se0x(5, 5, 30, 30, 20, 20, 300, 300), Y = se0x(20, 20, 20, 20, 20, 20, 300, 300);
    ok(apply(merge(K, [["Χ", X], ["Υ", Y]]), "")._sagSoilRef.n === "Υ", "Κ9 «πιο ξηρός» από τον μέσο 24ώρου (σταθερός μέσα στη μέρα)");
    // ── κανάλι που μετρά ΜΙΑ συσκευή (pH) μένει· αέρας μένει μέσος όρος ──
    const PH = { soil_ph: S(7.4) };
    const dp = apply(merge(K, [["Μάρτυρας", MAR], ["Pellet", PEL], ["pH", PH]]), "");
    ok(val(dp, "soil_ph") === 7.4 && J(dp._sagSrc.soil_ph) === J(["pH"]) && dp._sagSoilRef.c === 2, "Κ10 το pH (μία συσκευή) μένει, δεν είναι υποψήφιο (" + J(dp._sagSoilRef) + ")");
    const ST1 = { air_temperature: S(20), air_humidity: S(60) }, ST2 = { air_temperature: S(22), air_humidity: S(70) };
    const da = apply(merge(K, [["Σ1", ST1], ["Σ2", ST2], ["Μάρτυρας", MAR], ["Pellet", PEL]]), "");
    ok(val(da, "air_temperature") === 21 && J(da._sagSrc.air_temperature) === J(["Σ1", "Σ2"]), "Κ11 ο αέρας ΔΕΝ αλλάζει (" + val(da, "air_temperature") + ")");
    // ── Ρ: ΔΥΟ συσκευές, ΜΙΑ ρηχή + ΜΙΑ βαθιά (lse01_shallow → *1, lse01_deep → *2) → η στάθμιση FAO-56 μένει ──
    const SHAL = { soil_moisture1: S(14), soil_moisture1_avg: S(14.5), soil_temperature1: S(19), conduct_soil1: S(250) };
    const DEEP = { soil_moisture2: S(24), soil_moisture2_avg: S(23.5), soil_temperature2: S(18), conduct_soil2: S(320) };
    const dz = apply(merge(K, [["Ρηχή", SHAL], ["Βαθιά", DEEP]]), "");
    ok(val(dz, "soil_moisture1") === 14 && val(dz, "soil_moisture2") === 24 && !dz._sagSoilRef, "Ρ1 ρηχή + βαθιά: ΚΑΙ τα δύο βάθη μένουν, καμία «επιλογή» (" + J(dz._sagSoilRef) + ")");
    const PRZ = { cultivation_type_general: "olive", cultivation_type: "koroneiki", stage: "vegetative", sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 };
    const rz = K.get("_sagRootZoneMoisture")({ data: dz }, PRZ);
    ok(rz && rz.ok && rz.m1 === 14 && rz.m2 === 24 && rz.w1 > 0 && rz.w2 > 0 && Math.abs(rz.value - (14 * rz.w1 + 24 * rz.w2)) < 1e-9 && /Δύο βάθη/.test(rz.basis),
      "Ρ2 σταθμισμένο ριζόστρωμα από ΔΥΟ βάθη (" + (rz && rz.basis) + " → " + (rz && rz.value) + ")");
    const rzOld = K.get("_sagRootZoneMoisture")({ data: merge(O, [["Ρηχή", SHAL], ["Βαθιά", DEEP]], false) }, PRZ);
    ok(rz && rzOld && rz.value === rzOld.value && rz.basis === rzOld.basis, "Ρ3 ίδιο ριζόστρωμα με τον v50.163 (" + (rzOld && rzOld.value) + ")");
    // ── Δ: διαφορικό έναντι v50.163 ──
    const cases = [[["Μάρτυρας", MAR]], [["Σ1", ST1], ["Σ2", ST2], ["Βιοδιεγέρτης", BIO]], [["pH", PH], ["Pellet", PEL]], [["Σ1", ST1]], [["Ρηχή", SHAL], ["Βαθιά", DEEP]]];
    let diffs = 0;
    for (const cs of cases) { const a = apply(merge(K, cs), ""), b = merge(O, cs, false); if (J(a) !== J(b)) { diffs++; if (process.env.SR_DEBUG) console.log(J(a), "\n", J(b)); } }
    ok(diffs === 0, "Δ1 ένας αισθητήρας εδάφους / αέρας: ΙΔΙΑ έξοδος με τον v50.163 (" + diffs + "/" + cases.length + " διαφορές)");
    ok(J(apply(merge(K, KAMP), "")) !== J(merge(O, KAMP, false)), "Δ2 με 3 σόνδες η έξοδος ΑΛΛΑΖΕΙ (το διαφορικό βλέπει την αλλαγή)");
    // ── Σ: καλωδίωση ──
    const iA = core.indexOf("  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n  _sagPlausibilityGate(data, fieldName);");
    const iR = core.lastIndexOf("  return { data, prevBundle: _ringPrevBundle };");
    ok(iA > 0 && iA < iR, "Σ1 η επιλογή τρέχει ΠΡΙΝ την πύλη ευλογοφάνειας, μέσα στη getMeasurements");
    ok(core.split("data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);").length - 1 === 4, "Σ2 και οι 4 κλήσεις συγχώνευσης περνούν το id");
    ok(/_SAG_SUBSTRATE_ACTIVE = null;[^\n]*\n\s*_SAG_SOIL_REF_ID = '';/.test(core), "Σ3 μηδενισμός δήλωσης σε κάθε αγρό");
    const iS = core.indexOf("_SAG_SOIL_REF_ID = String(fieldConfig?.soil_ref_device || '');"), iG = core.indexOf("const measurements = await getMeasurements(");
    ok(iS > 0 && iS < iG, "Σ4 η δήλωση ορίζεται ΠΡΙΝ τη getMeasurements");
    ok(K.get("SAG_KERNEL_VERSION") === "v50.164 · 2026-10-29", "Σ5 έκδοση");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(CORE);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (Καμπιτάκης 3 σόνδες, δήλωση, μέσος 24ώρου, pH/αέρας, διαφορικό έναντι " + OLD_COMMIT + ")");
const MUT = [
  ["m1 χωρίς επιλογή", "  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n", ""],
  ["m2 ο πιο υγρός", "const v = score(devs[n]); if (Number.isFinite(v) && v < best)", "const v = -score(devs[n]); if (Number.isFinite(v) && v < best)"],
  ["m3 τελευταία τιμή αντί μέσου 24ώρου", "/^soil_moisture\\d?_avg$/, ", ""],
  ["m4 αγνοεί τη δήλωση", "    if (_rid) {\n", "    if (false) {\n"],
  ["m5 δήλωση χωρίς έλεγχο υγρασίας", "if (n && Number.isFinite(score(devs[n]))) { ref = n;", "if (n) { ref = n;"],
  ["m6 μένει η διαφωνία EC", "      if (data._sagDivergeEc) delete data._sagDivergeEc[k];\n", ""],
  ["m7 η πηγή δεν ενημερώνεται", "data[k] = devs[ref][k]; src[k] = [ref];", "data[k] = devs[ref][k];"],
  ["m8 πειράζει και κανάλια μίας συσκευής", "&& Array.isArray(src[k]) && src[k].length > 1);", "&& Array.isArray(src[k]));"],
  ["m9 μία κλήση χωρίς id", "data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);", "data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName);"],
  ["m10 χωρίς μηδενισμό ανά αγρό", "      _SAG_SOIL_REF_ID = '';          // T-SOILREF-01: ποτέ μεταφορά από τον προηγούμενο αγρό", "      // T-SOILREF-01"],
  ["m11 μένει το _sagSoilDev", "    delete data._sagSoilDev;\n", ""],
  ["m12 και ο αέρας", "const _SAG_SOIL_KEY_RE = /^(soil_|conduct_soil|temp_soil|water_soil)/;", "const _SAG_SOIL_KEY_RE = /^(soil_|conduct_soil|temp_soil|water_soil|air_)/;"],
  ["m13 έκδοση", "'v50.164 · 2026-10-29'", "'v50.163 · 2026-10-29'"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = CORE.split(a).length - 1;
  if (n < 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(CORE.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 140)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
