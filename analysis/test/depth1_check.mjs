// Ελεγκτής T-DEPTH1-01/02/03 (3/11/2026): «ένα βάθος αισθητήρα εδάφους» με δήλωση στη φόρμα, δήλωση θύρας και «δύο σημεία
// στο ίδιο βάθος» — πυρήνας v50.169, φόρμα v28, sync v17, widget W-DEPTH1-03. Διαφορικό και με τον v50.168 (θύρες 1/2). Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα και τον v50.166 από το git (ΔΙΑΦΟΡΙΚΟ:
// χωρίς δήλωση «ένα βάθος» ΤΑΥΤΟΣΗΜΑ, ακόμη κι αν υπάρχει soil_depth_port) και τον v50.167 (ένα βάθος, θύρα 1, βάθος
// ρηχού γραμμένο: ΤΑΥΤΟΣΗΜΑ). Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα φόρμας/widget με ψεύτικο DOM. Μεταλλάξεις σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, "..", "..");
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE0 = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const gshow = (c) => execSync("git show " + c + ":analysis/runPerTich.js", { cwd: root, maxBuffer: 64 << 20 }).toString("utf8").replace(/\r\n/g, "\n");
const OLD = gshow("1b33dc36c26a1e52cb4eb2b69994bb8cdabf1af7");   // v50.166
const V167 = gshow("068c4c43f2ef6ef9c12a85e74a5789ca65853d66");  // v50.167
const V168 = gshow("5257087697cde15cf14deb7c6b3c5e9e5ab917cf");  // v50.168
const FORM0 = fs.readFileSync(path.join(root, "custom_html_files", "configuration.html"), "utf8").replace(/\r\n/g, "\n");
const SYNC0 = fs.readFileSync(path.join(here, "..", "setFieldParametersFromDeviceData.js"), "utf8").replace(/\r\n/g, "\n");
const WID0 = fs.readFileSync(path.join(root, "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const req = createRequire(KPATH);
function load(core, extra) {
  const shim = (m) => { if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null, envToJson: () => ({}) } }; } return req(m); };
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const proc = { env: {}, exit() {}, on() {}, version: process.version, versions: process.versions };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", core + "\n;return {" + extra + "};")(
    shim, { exports: {} }, {}, proc, quiet, path.dirname(KPATH), KPATH);
}
const J = (x) => JSON.stringify(x);
const M = (o) => { const d = {}; for (const [k, v] of Object.entries(o)) d[k] = [{ value: v, time: "2026-11-03T10:00:00Z" }]; return { data: d }; };
const D = (o) => { const d = {}; for (const [k, v] of Object.entries(o)) d[k] = [{ value: v, time: "2026-11-03T10:00:00Z" }]; return d; };
function cut(src, a, b, label, inclB = false) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const COMMON = "_sagRootZoneMoisture, _sagSensorDepthCm, _sagRootZoneIndicators, SAG_KERNEL_VERSION";
const BASE = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato" };
function run(core, form, sync, wid) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core, COMMON + ", _sagDepth1Mask, _sagDevExpect, _sagDevStatsD1, _sagEcChansD1, _sagDepth1Of, _sagDepth1PortOf, _sagSplitPoints, _sagMergeDeviceData, _SAG_DEV_EXPECT, _SAG_EC_CHANNELS,"
      + " _setD1: (v, p) => { _SAG_DEPTH1_ACTIVE = v; _SAG_DEPTH1_PORT = p || 1; _SAG_D1_HINTS = []; }, _hints: () => _SAG_D1_HINTS");
    const O = load(OLD, COMMON), V = load(V167, COMMON), V8 = load(V168, COMMON);
    ok(K.SAG_KERNEL_VERSION === "v50.193 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    // ── Δ: ΔΙΑΦΟΡΙΚΑ ──
    const DD = [{}, { sensorShallow_depth_cm: 15 }, { sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 }, { sensor_deep_depth_cm: 60 }];
    const MV = [{}, { soil_moisture1: 22 }, { soil_moisture2: 30 }, { soil_moisture1: 22, soil_moisture2: 30 }, { soil_moisture: 18 }, { soil_moisture1: 9, soil_moisture2: 41, rain_height_daily: 3 }];
    const triple = (X, p) => J([X._sagRootZoneMoisture(M(p.__m), p), X._sagSensorDepthCm(p, 1), X._sagSensorDepthCm(p, 2)]);
    let cmp = 0, bad = 0, ex = "";
    K._setD1(false);
    for (const cfg of [{}, { soil_depth_count: 2 }, { soil_depth_count: "2" }, { soil_depth_count: 0 }, { soil_depth_count: "x" }, { soil_depth_port: 2 }, { soil_depth_count: 2, soil_depth_port: 2 }, { soil_depth_port: 3 }])
      for (const dd of DD) for (const st of ["initial", "full_canopy"]) for (const mv of MV) {
        const p = Object.assign({ stage: st, __m: mv }, BASE, cfg, dd);
        const a = triple(K, p), b = triple(O, p); cmp++;
        if (a !== b) { bad++; ex = ex || a.slice(0, 160) + " ≠ " + b.slice(0, 160); }
        const rz = O._sagRootZoneMoisture(M(mv), p);
        if (J(K._sagRootZoneIndicators(rz)) !== J(O._sagRootZoneIndicators(rz))) { bad++; ex = ex || "ενδείξεις ριζοστρώματος"; }
      }
    ok(bad === 0 && cmp === 384, "Δ1 χωρίς «ένα βάθος» ΤΑΥΤΟΣΗΜΑ με v50.166 σε " + cmp + " περιπτώσεις (διαφορές " + bad + ": " + ex + ")");
    cmp = 0; bad = 0; ex = "";
    for (const cfg of [{ soil_depth_count: 1 }, { soil_depth_count: 1, soil_depth_port: 1 }])
      for (const dd of [{ sensorShallow_depth_cm: 15 }, { sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 }])
        for (const mv of [{ soil_moisture1: 22 }, { soil_moisture1: 22, soil_moisture2: 30 }, { soil_moisture: 18 }, { soil_moisture1: 9, soil_moisture2: 41 }]) {
          const p = Object.assign({ stage: "full_canopy", __m: mv }, BASE, cfg, dd);
          const a = triple(K, p), b = triple(V, p); cmp++;
          if (a !== b) { bad++; ex = ex || a.slice(0, 160) + " ≠ " + b.slice(0, 160); }
        }
    ok(bad === 0 && cmp === 16, "Δ2 ένα βάθος, θύρα 1, βάθος γραμμένο: ΤΑΥΤΟΣΗΜΑ με v50.167 (" + bad + ": " + ex + ")");
    cmp = 0; bad = 0; ex = "";
    for (const cfg of [{ soil_depth_count: 1 }, { soil_depth_count: 1, soil_depth_port: 2 }, { soil_depth_count: 1, soil_depth_port: 1 }])
      for (const dd of DD) for (const mv of MV) {
        const p = Object.assign({ stage: "full_canopy", __m: mv }, BASE, cfg, dd);
        const a = triple(K, p), b = triple(V8, p); cmp++;
        if (a !== b) { bad++; ex = ex || a.slice(0, 160) + " ≠ " + b.slice(0, 160); }
      }
    ok(bad === 0 && cmp === 72, "Δ3 θύρες 1/2: ΤΑΥΤΟΣΗΜΑ με v50.168 (" + bad + ": " + ex + ")");
    // ── Ρ: ριζόστρωμα / βάθος ──
    const p1 = Object.assign({ stage: "full_canopy", soil_depth_count: 1, sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 }, BASE);
    const p2 = Object.assign({}, p1, { soil_depth_port: 2 });
    ok(K._sagDepth1PortOf(p2) === 2 && K._sagDepth1PortOf({ soil_depth_port: "2" }) === 2 && K._sagDepth1PortOf({}) === 1 && K._sagDepth1PortOf({ soil_depth_port: 7 }) === 1, "Ρ0 ανάγνωση θύρας");
    const r1 = K._sagRootZoneMoisture(M({ soil_moisture1: 22, soil_moisture2: 41 }), p1);
    ok(r1.ok && r1.value === 22 && r1.m2 === null && r1.basis === "Ένα βάθος: 15 cm", "Ρ1 θύρα 1 → μόνο η θύρα 1 (" + J(r1) + ")");
    const r2 = K._sagRootZoneMoisture(M({ soil_moisture1: 22, soil_moisture2: 41 }), p2);
    ok(r2.ok && r2.value === 41 && r2.m1 === null && r2.divergence === null && r2.basis === "Ένα βάθος: 15 cm", "Ρ2 θύρα 2 → μόνο η θύρα 2, χωρίς «(βαθύς)» (" + J(r2) + ")");
    const r3 = K._sagRootZoneMoisture(M({ soil_moisture: 18 }), p2);
    ok(r3.ok && r3.value === 18, "Ρ3 θύρα 2 αλλά σόνδα μίας θύρας (LSE01): μετρά κανονικά");
    const r4 = K._sagRootZoneMoisture(M({ soil_moisture2: 33 }), p1);
    ok(r4.ok && r4.value === 33 && r4.basis === "Ένα βάθος: 15 cm", "Ρ4 θύρα 1 αλλά σόνδα μόνο στη 2 (lse01_deep): κρατιέται (" + r4.basis + ")");
    const pD = Object.assign({ stage: "full_canopy", soil_depth_count: 1, sensor_deep_depth_cm: 30 }, BASE);
    ok(K._sagSensorDepthCm(pD, 1) === 30 && K._sagSensorDepthCm(pD, 2) === 30, "Ρ5 ένα βάθος γραμμένο ΜΟΝΟ στο «βαθύ» → 30 cm (όχι 20)");
    ok(K._sagSensorDepthCm(p1, 1) === 15 && K._sagSensorDepthCm(p1, 2) === 15, "Ρ6 ένα βάθος: προτιμάται το πεδίο «Βάθος αισθητήρα»");
    // ── Μ: μάσκα ανά θύρα ──
    const all = () => D({ soil_moisture1: 20, soil_temperature1: 18, conduct_soil1: 300, soil_moisture2: 30, soil_temperature2: 17, conduct_soil2: 250, soil_moisture2_avg: 29, soil_moisture1_avg: 21, battery: 3.6 });
    K._setD1(true, 1); let dv = all(); let n = K._sagDepth1Mask(dv, "Α");
    ok(n === 4 && J(Object.keys(dv).sort()) === J(["battery", "conduct_soil1", "soil_moisture1", "soil_moisture1_avg", "soil_temperature1"]), "Μ1 θύρα 1: κόβεται όλη η θύρα 2 (" + J(Object.keys(dv)) + ")");
    K._setD1(true, 2); dv = all(); n = K._sagDepth1Mask(dv, "Α");
    ok(n === 4 && J(Object.keys(dv).sort()) === J(["battery", "conduct_soil2", "soil_moisture2", "soil_moisture2_avg", "soil_temperature2"]), "Μ2 θύρα 2: κόβεται όλη η θύρα 1 (" + J(Object.keys(dv)) + ")");
    const bare = D({ soil_moisture: 18, temp_soil: 15, conduct_soil: 200 });
    ok(K._sagDepth1Mask(bare, "Β") === 0 && Object.keys(bare).length === 3, "Μ3 θύρα 2, LSE01 γυμνά ονόματα: ανέγγιχτο");
    K._setD1(true, 1); const deep = D({ soil_moisture2: 30, soil_temperature2: 17 });
    ok(K._sagDepth1Mask(deep, "Γ") === 0 && Object.keys(deep).length === 2, "Μ4 θύρα 1, σόνδα μόνο στη 2: ανέγγιχτη");
    K._setD1(false); dv = all();
    ok(K._sagDepth1Mask(dv, "Α") === 0 && Object.keys(dv).length === 9, "Μ5 χωρίς δήλωση: καμία μάσκα");
    // ── Φ: φρουρός λάθους θύρας ──
    K._setD1(true, 1); K._sagDepth1Mask(D({ soil_moisture1: 0, soil_moisture2: 31 }), "SE0X-Χ");
    ok(J(K._hints()) === J(["SE0X-Χ"]), "Φ1 θύρα 1 νεκρή, θύρα 2 μετρά → προειδοποίηση (" + J(K._hints()) + ")");
    K._setD1(true, 2); K._sagDepth1Mask(D({ soil_moisture1: 25, soil_moisture2: 0 }), "SE0X-Ψ");
    ok(J(K._hints()) === J(["SE0X-Ψ"]), "Φ2 θύρα 2 νεκρή, θύρα 1 μετρά → προειδοποίηση");
    K._setD1(true, 1); K._sagDepth1Mask(D({ soil_moisture1: 20, soil_moisture2: 31 }), "SE0X-Ω");
    ok(K._hints().length === 0, "Φ3 κανονικά: καμία προειδοποίηση");
    K._setD1(true, 1); K._sagDepth1Mask(D({ soil_moisture1: 0, soil_moisture2: 31 }), "SE0X-Χ");
    const indH = K._sagRootZoneIndicators(K._sagRootZoneMoisture(M({ soil_moisture1: 4 }), p1));
    const bh = indH.find((x) => x.variable === "soil_depth_basis");
    ok(bh && bh.metadata.color === "orange" && /ΠΡΟΣΟΧΗ: στο «SE0X-Χ» η δηλωμένη θύρα δεν δίνει μέτρηση/.test(bh.metadata.text), "Φ4 πορτοκαλί κείμενο με τη συσκευή (" + J(bh) + ")");
    K._setD1(true, 2);
    const ind2 = K._sagRootZoneIndicators(r2), b2 = ind2.find((x) => x.variable === "soil_depth_basis"), t2 = ind2.find((x) => x.variable === "soil_depth_divergence");
    ok(b2 && b2.metadata.color === "green" && /δηλωμένο ένα βάθος αισθητήρα εδάφους \(θύρα 2 του αισθητήρα\)/.test(b2.metadata.text), "Φ5 θύρα 2 αναφέρεται, πράσινο");
    ok(t2 && t2.value === null && t2.metadata.color === "grey", "Φ6 ταφόπλακα σύγκρισης βαθών");
    // ── Π: δύο σημεία στο ίδιο βάθος (θύρα 3) ──
    ok(K._sagDepth1PortOf({ soil_depth_port: 3 }) === 3 && K._sagDepth1PortOf({ soil_depth_port: "3" }) === 3, "Π0 ανάγνωση «και οι δύο»");
    K._setD1(true, 3); dv = all(); const pt2 = K._sagSplitPoints(dv);
    ok(pt2 && J(Object.keys(pt2).sort()) === J(["conduct_soil1", "soil_moisture1", "soil_moisture1_avg", "soil_temperature1"]) && pt2.soil_moisture1[0].value === 30
      && pt2.conduct_soil1[0].value === 250 && pt2.soil_moisture1_avg[0].value === 29, "Π1 η θύρα 2 γίνεται σημείο 2 στο κανάλι 1 (" + J(pt2) + ")");
    ok(J(Object.keys(dv).sort()) === J(["battery", "conduct_soil1", "soil_moisture1", "soil_moisture1_avg", "soil_temperature1"]) && dv.soil_moisture1[0].value === 20, "Π2 το σημείο 1 κρατά τη θύρα 1");
    ok(K._sagDepth1Mask(dv, "Α") === 0 && K._hints().length === 0, "Π3 μάσκα: τίποτα δεν κόβεται");
    ok(K._sagSplitPoints(D({ soil_moisture: 18 })) === null && K._sagSplitPoints(D({ soil_moisture2: 30 })) === null, "Π4 σόνδα μίας θύρας: κανένας διαχωρισμός");
    K._setD1(true, 1); ok(K._sagSplitPoints(all()) === null, "Π5 θύρα 1: κανένας διαχωρισμός");
    K._setD1(false); ok(K._sagSplitPoints(all()) === null, "Π6 χωρίς δήλωση: κανένας διαχωρισμός");
    K._setD1(true, 3); let dt = {}; const d1x = all(); const d2x = K._sagSplitPoints(d1x);
    dt = K._sagMergeDeviceData(dt, d1x, "SE0X", "Αγρός", "id1"); dt = K._sagMergeDeviceData(dt, d2x, "SE0X · θύρα 2", "Αγρός", "id1:2");
    ok(Number(dt.soil_moisture1[0].value) === 25 && J(dt._sagSrc.soil_moisture1) === J(["SE0X", "SE0X · θύρα 2"]) && !dt.soil_moisture2, "Π7 συγχώνευση: μέσος όρος 25 από δύο σημεία, κανένα βαθύ");
    ok(dt._sagDiverge && dt._sagDiverge.soil_moisture1 && dt._sagSoilDev && dt._sagSoilDev["SE0X · θύρα 2"]._id === "id1:2", "Π8 διαφωνία (20↔30) + σημεία διαθέσιμα ως αισθητήρες απόφασης");
    const p3 = Object.assign({}, p1, { soil_depth_port: 3 });
    const r5 = K._sagRootZoneMoisture(M({ soil_moisture1: 25, soil_moisture2: 40 }), p3);
    ok(r5.ok && r5.value === 25 && r5.m2 === null && r5.basis === "Ένα βάθος: 15 cm", "Π9 ριζόστρωμα = μέσος όρος σημείων, κανένα βαθύ (" + J(r5) + ")");
    const b3 = K._sagRootZoneIndicators(r5).find((x) => x.variable === "soil_depth_basis");
    ok(b3 && b3.metadata.color === "green" && /ένα βάθος αισθητήρα εδάφους σε δύο σημεία \(μέσος όρος\)/.test(b3.metadata.text), "Π10 κείμενο «δύο σημεία»");
    ok(K._sagDevStatsD1({ t: "se0x", stats: { soil_moisture1: 1, soil_moisture2: 2 } }).soil_moisture2 === 2, "Π11 στατιστικά: και οι δύο θύρες");
    ok(core.split("= _sagSplitPoints(deviceData);   // T-DEPTH1-03").length - 1 === 4 && core.split("(info?.name || value) + ' · θύρα 2', fieldName, String(value) + ':2');").length - 1 === 4, "Π12 και τα 4 σημεία συγχώνευσης");
    ok(core.includes("(_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 3 && (typeName === 'se0x'") && core.includes("const _SOIL_AVG_CH = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 3) ?"), "Π13 διάγνωση/μέσοι 24ώρου και των δύο θυρών");
    // ── Β: βλάβες / στατιστικά ──
    K._setD1(true, 1);
    ok(K._sagDevExpect("se0x").length === 2 && !K._sagDevExpect("se0x").some((c) => /βαθέος/.test(c.k)), "Β1 θύρα 1: χωρίς «βαθέος»");
    K._setD1(true, 2);
    const e2 = K._sagDevExpect("se0x"), e2b = K._sagDevExpect("lse02");
    ok(e2.length === 2 && e2.every((c) => /βαθέος/.test(c.k)) && e2b.length === 2, "Β2 θύρα 2: αναμένεται ΜΟΝΟ η θύρα 2 (" + J(e2.map((c) => c.k)) + ")");
    ok(J(K._sagDevExpect("lse01_deep")) === J(K._SAG_DEV_EXPECT.lse01_deep) && K._sagDevExpect("lse01") === K._SAG_DEV_EXPECT.lse01, "Β3 άλλοι τύποι ανέγγιχτοι");
    ok(J(Object.keys(K._sagDevStatsD1({ t: "se0x", stats: { soil_moisture1: 1, soil_moisture2: 2, soil_temperature1_avg: 3 } }))) === J(["soil_moisture2"]), "Β4 θύρα 2: στατιστικά μόνο της θύρας 2");
    K._setD1(true, 1);
    ok(J(Object.keys(K._sagDevStatsD1({ t: "se0x", stats: { soil_moisture1: 1, soil_moisture2: 2 } }))) === J(["soil_moisture1"]), "Β5 θύρα 1: στατιστικά μόνο της θύρας 1");
    K._setD1(false);
    ok(K._sagDevExpect("se0x") === K._SAG_DEV_EXPECT.se0x, "Β6 χωρίς δήλωση: ο ίδιος πίνακας");
    // ── Ε: αγωγιμότητα ──
    K._setD1(true, 1);
    let ch = K._sagEcChansD1(M({ soil_moisture1: 20 }));
    ok(ch.length === 1 && ch[0].n === "1" && ch[0].el === "έδαφος", "Ε1 θύρα 1: κανάλι 1 «έδαφος»");
    K._setD1(true, 2);
    ch = K._sagEcChansD1(M({ soil_moisture2: 20 }));
    ok(ch.length === 1 && ch[0].n === "2" && ch[0].el === "έδαφος" && K._SAG_EC_CHANNELS[1].el === "βαθύ", "Ε2 θύρα 2: κανάλι 2 «έδαφος», πίνακας ανέγγιχτος");
    ok(K._sagEcChansD1(M({ soil_moisture: 20 })) === K._SAG_EC_CHANNELS, "Ε3 θύρα 2 χωρίς θύρα 2 (LSE01): όπως πριν");
    K._setD1(false);
    ok(K._sagEcChansD1(M({ soil_moisture1: 20 })) === K._SAG_EC_CHANNELS, "Ε4 χωρίς δήλωση: όπως πριν");
    // ── Σ: στατικά πυρήνα ──
    ok(core.includes("    _sagDepth1Mask(deviceData, deviceName);\n    const r = _sagPlausibilityGate("), "Σ1 μάσκα (με όνομα) ΠΡΙΝ από την πύλη");
    ok(core.split("_sagScreenDevice(deviceData, info?.name || value, fieldName)").length - 1 >= 3, "Σ1β όλες οι διαδρομές συσκευών περνούν από τη μάσκα");
    const fl = core.indexOf("_SAG_DEPTH1_PORT = _sagDepth1PortOf(fieldConfig);"), gm = core.indexOf("const measurements = await getMeasurements(hourTich, dailyTich, devices");
    ok(core.indexOf("_SAG_DEPTH1_ACTIVE = _sagDepth1Of(fieldConfig);") > 0 && fl > 0 && gm > fl && gm - fl < 400, "Σ2 σημαία + θύρα ΠΡΙΝ από τις αναγνώσεις");
    ok(core.includes("      _SAG_DEPTH1_ACTIVE = false;     // T-DEPTH1-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n      _SAG_DEPTH1_PORT = 1; _SAG_D1_HINTS = [];"), "Σ3 μηδενισμός ανά αγρό");
    ok(core.includes("? ['soil_ece1', 'soil_ec_pore1', 'soil_ec_raw1', 'soil_ec_ref1'] : ['soil_ece2', 'soil_ec_pore2', 'soil_ec_raw2', 'soil_ec_ref2']));"), "Σ4 purge της κομμένης θύρας");
    ok(core.includes("const _scS = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT === 2 && Number.isFinite(_scNum(_SAG_SOIL_M_DEEP))) ? {}")
      && core.includes("const _scD = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 2 && Number.isFinite(_scNum(_SAG_SOIL_M_SHALLOW))) ? {}"), "Σ5 βαθμονόμηση της κρατημένης θύρας");
    ok(core.includes("const _SOIL_AVG_CH = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 3) ? (_SAG_DEPTH1_PORT === 2 ? ['soil_moisture2', 'soil_temperature2'] : ['soil_moisture1', 'soil_temperature1'])"), "Σ6 μέσοι 24ώρου της κρατημένης θύρας");
    ok(core.split("const chans = _numbered ? _sagEcChansD1(measurements)").length - 1 === 2, "Σ7 αναφορά ημέρας + δείκτες EC");
    ok(core.includes("if (soil && !soil2 && !_SAG_DEPTH1_ACTIVE) {"), "Σ8 καμία πρόταση «ΔΕΥΤΕΡΟ ΒΑΘΟΣ»");
    ok(core.includes("const _sOK = _calOk(_cs.s) && !(_p2c && _cs.d && (Number(_cs.d.n) || 0) > 0), _dOK = _calOk(_cs.d)\n        && !(_sagDepth1Of(parameters) && !_p2c && _cs.s && (Number(_cs.s.n) || 0) > 0);"), "Σ9 όρια: η βαθμονόμηση της άλλης θύρας αγνοείται");
    ok(core.includes("filter(v => !(_SAG_DEPTH1_PORT === 2 ? /1$/ : /2$/).test(v))"), "Σ10 ημερήσια διάγνωση της κρατημένης θύρας");
    // ── Φ: φόρμα ──
    ok(/<select id="soil_depth_count" onchange="_sagDepthUi\(\)">\s*<option value="2">Δύο βάθη \(ρηχό και βαθύ\)<\/option>\s*<option value="1">Ένα βάθος<\/option>/.test(form), "ΦΡ1 πεδίο, προεπιλογή «Δύο βάθη»");
    ok(/<div class="field" id="depthPortWrap" style="display:none">[\s\S]{0,120}<select id="soil_depth_port">\s*<option value="1">Θύρα 1<\/option>\s*<option value="2">Θύρα 2<\/option>\s*<option value="3">Και οι δύο — δύο σημεία στο ίδιο βάθος \(μέσος όρος\)<\/option>/.test(form), "ΦΡ2 πεδίο θύρας (1 | 2 | και οι δύο), κρυφό, προεπιλογή θύρα 1");
    const uiSrc = cut(form, "function _sagDepthUi(){", "function _keepPrev(v, prev){", "Φ εμφάνιση");
    const els = { soil_depth_count: { value: "1" }, deepDepthWrap: { style: { display: "" } }, depthPortWrap: { style: { display: "none" } }, shallowDepthLabel: { textContent: "" },
      depthCountNote: { textContent: "" }, sensorShallow_depth_cm: { value: "" }, sensor_deep_depth_cm: { value: "30" } };
    const ui = new Function("$", uiSrc + "\nreturn _sagDepthUi;")((id) => els[id]);
    ui(); ok(els.deepDepthWrap.style.display === "none" && els.depthPortWrap.style.display === "" && els.shallowDepthLabel.textContent === "Βάθος αισθητήρα (cm)", "ΦΡ3 «Ένα βάθος»: κρύβεται το βαθύ, φαίνεται η θύρα");
    ok(els.sensorShallow_depth_cm.value === "30", "ΦΡ4 βάθος γραμμένο μόνο στο «βαθύ» → μεταφέρεται (" + els.sensorShallow_depth_cm.value + ")");
    els.sensorShallow_depth_cm.value = "12"; ui(); ok(els.sensorShallow_depth_cm.value === "12", "ΦΡ5 υπάρχον βάθος δεν σκεπάζεται");
    els.soil_depth_count.value = "2"; els.sensorShallow_depth_cm.value = ""; ui();
    ok(els.deepDepthWrap.style.display === "" && els.depthPortWrap.style.display === "none" && els.sensorShallow_depth_cm.value === "" && /Ρηχό/.test(els.shallowDepthLabel.textContent)
      && /θύρα 1 είναι το ρηχό και η 2 το βαθύ/.test(els.depthCountNote.textContent), "ΦΡ6 «Δύο βάθη»: όπως πριν + εξήγηση αντιστοίχισης");
    const val = (id) => ({ soil_depth_count: { value: "1" }, soil_depth_port: { value: id } });
    const svC = cut(form, "    soil_depth_count: ", ",   /* v26 · T-DEPTH1-01 */", "Φ αποθ.").replace("    soil_depth_count: ", "");
    const svP = cut(form, "    soil_depth_port: ", ",   /* v27/v28 · T-DEPTH1-02/03 */", "Φ αποθ. θύρας").replace("    soil_depth_port: ", "");
    const ev = (src, map) => new Function("$", "return " + src + ";")((id) => map[id] || null);
    ok(ev(svC, { soil_depth_count: { value: "1" } }) === 1 && ev(svC, { soil_depth_count: { value: "2" } }) === 2, "ΦΡ7 αποθήκευση πλήθους");
    ok(ev(svP, val("2")) === 2 && ev(svP, val("1")) === 1 && ev(svP, val("3")) === 3 && ev(svP, { soil_depth_count: { value: "2" }, soil_depth_port: { value: "2" } }) === 1, "ΦΡ8 αποθήκευση θύρας (μόνο με ένα βάθος)");
    ok(form.includes("$('soil_depth_port').value = ['2', '3'].indexOf(String(conf.soil_depth_port)) >= 0 ? String(conf.soil_depth_port) : '1'; _sagDepthUi();"), "ΦΡ9 φόρτωση θύρας 1 | 2 | 3");
    ok(form.includes("const _dpo = $('soil_depth_port'); if (_dpo) _dpo.value = '1'; } _sagDepthUi();"), "ΦΡ10 αλλαγή αγρού: επαναφορά θύρας");
    const wSrc = cut(form, "  /* v27 · T-DEPTH1-02: δύο βάθη", "  /* γύρος 4: μισοσυμπληρωμένη", "Φ προειδοποίηση");
    const warn = (cnt, sh, dp) => { const msgs = []; new Function("$", "numOrNull", "msgs", wSrc)((id) => ({ soil_depth_count: { value: cnt }, sensorShallow_depth_cm: { value: sh }, sensor_deep_depth_cm: { value: dp } })[id],
      (v) => { const x = parseFloat(String(v).trim()); return String(v).trim() === "" || !Number.isFinite(x) ? null : x; }, msgs); return msgs; };
    ok(warn("2", "15", "5").length === 1 && warn("2", "30", "30").length === 1 && warn("2", "10", "30").length === 0 && warn("1", "15", "5").length === 0 && warn("2", "", "30").length === 0,
      "ΦΡ11 προειδοποίηση βαθύ ≤ ρηχό (Μιχάλης Χ 15/5, ΚΑΜΠΑΝΗΣ 30/30)");
    ok(form.includes("if (pair[0] === 'sensor_deep_depth_cm' && $('soil_depth_count') && $('soil_depth_count').value === '1') return;"), "ΦΡ12 κρυφό βαθύ εκτός ελέγχου αριθμού");
    // ── Υ: sync ──
    const wl = cut(sync, '"soil_ref_device",', "];", "λευκή λίστα");
    ok(/"soil_depth_count",/.test(wl) && /"soil_depth_port",/.test(wl), "Υ1 το sync περνά soil_depth_count ΚΑΙ soil_depth_port (παγίδα #1)");
    // ── W: widget ──
    const box = cut(wid, "/* W-DEPTH1-01 */sagDepthBox={v:2,p:1},", "sagEceBox={v:null}", "W κουτί");
    const d9 = cut(wid, "sagEceD9=q=>", ",sagEceChain9=", "W sagEceD9");
    const W = new Function("let " + box + d9 + ";\nreturn {sagDepthBox, sagDepthSet, sagDepthHide, sagEceD9};")();
    W.sagDepthSet(1, 1);
    ok(W.sagDepthHide("soil_moisture2", { soil_moisture1: [1] }) && !W.sagDepthHide("soil_moisture1", { soil_moisture1: [1], soil_moisture2: [1] }), "W1 θύρα 1: κρύβεται η θύρα 2");
    ok(!W.sagDepthHide("soil_moisture2", { soil_moisture2: [1] }), "W2 θύρα 1, σόνδα μόνο στη 2: ορατή");
    ok(W.sagEceD9("1") === "" && W.sagEceD9("2") === " Βαθύ", "W3 θύρα 1: τίτλος EC χωρίς «Ρηχό»");
    W.sagDepthSet("1", "2");
    ok(W.sagDepthHide("soil_moisture1", { soil_moisture1: [1], soil_moisture2: [1] }) && W.sagDepthHide("soil_ec_pore1", { conduct_soil2: [1] })
      && !W.sagDepthHide("soil_moisture2", { soil_moisture1: [1], soil_moisture2: [1] }), "W4 θύρα 2: κρύβεται η θύρα 1, φαίνεται η 2");
    ok(!W.sagDepthHide("soil_moisture", { soil_moisture: [1] }) && !W.sagDepthHide("air_temperature", { soil_moisture2: [1] }), "W5 θύρα 2, LSE01 / άλλες μεταβλητές: ορατά");
    ok(W.sagEceD9("2") === "" && W.sagEceD9("1") === " Ρηχό", "W6 θύρα 2: τίτλος EC χωρίς «Βαθύ»");
    W.sagDepthSet("1", "3");
    ok(!W.sagDepthHide("soil_moisture1", { soil_moisture1: [1], soil_moisture2: [1] }) && !W.sagDepthHide("soil_moisture2", { soil_moisture1: [1], soil_moisture2: [1] }), "W12 δύο σημεία: τίποτα κρυφό");
    ok(W.sagEceD9("1") === " σημείο 1" && W.sagEceD9("2") === " σημείο 2", "W13 δύο σημεία: τίτλοι «σημείο 1 / 2»");
    W.sagDepthSet(null, null);
    ok(!W.sagDepthHide("soil_moisture2", { soil_moisture1: [1] }) && !W.sagDepthHide("soil_moisture1", { soil_moisture2: [1] }) && W.sagEceD9("1") === " Ρηχό", "W7 χωρίς δήλωση: όπως πριν");
    ok(wid.includes("sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port);sagSubSet(") && wid.includes("sagDepthSet(2,1);sagSubSet(!1);return!1}"), "W8 πλήθος + θύρα από τη ρύθμιση");
    ok(wid.includes("sagRainHide.has(v)||sagDepthHide(v,j))return!1;") && wid.includes("sagRainHide.has(d)||sagDepthHide(d,N))return!1;"), "W9 και στις δύο λίστες μετρήσεων");
    ok(wid.includes('sagDepthBox.p===1&&/^(soil_moisture') && wid.includes('s={...s,label:s.label.replace(" Ρηχό"," σημείο 1")}') && wid.includes('s={...s,label:s.label.replace(" Βαθύ","")}'), "W10 ετικέτες ανά θύρα");
    ok(wid.includes('_dp8=_q8==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":sagDepthBox.v===1&&sagDepthBox.p===3?"σημείο 2":"Βαθύ")') && wid.includes('_dp9=_q9==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":sagDepthBox.v===1&&sagDepthBox.p===3?"σημείο 2":"Βαθύ")'), "W11 τίτλοι διαγραμμάτων");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(CORE0, FORM0, SYNC0, WID0);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (διαφορικά v50.166/v50.167, θύρες 1/2, μάσκα, φρουρός, βλάβες, EC, φόρμα, sync, widget)");
const MUT = [
  ["μ1 θύρα 2 αγνοείται στη μάσκα", "  const p2 = _SAG_DEPTH1_PORT === 2;   // T-DEPTH1-02\n", "  const p2 = false;\n", "k"],
  ["μ2 χωρίς μάσκα", "    _sagDepth1Mask(deviceData, deviceName);\n    const r = _sagPlausibilityGate(", "    const r = _sagPlausibilityGate(", "k"],
  ["μ3 ριζόστρωμα: θύρα 2 αγνοείται", "  const s = (_d1p === 2 && _dd0) ? null : _s0;\n", "  const s = _s0;\n", "k"],
  ["μ4 βάθος μόνο από το ρηχό", "      'sensor_deep_depth_cm', 'soil_sensor_depth_2_cm', 'sensor_depth_2_cm', 'soil_depth_2_cm']) {\n", "      ]) {\n", "k"],
  ["μ5 αναμενόμενα: πάντα θύρα 1", "  const re = _SAG_DEPTH1_PORT === 2 ? /1(_avg)?$/ : /2(_avg)?$/;   // T-DEPTH1-02: αναμένεται", "  const re = /2(_avg)?$/;   // T-DEPTH1-02: αναμένεται", "k"],
  ["μ6 χωρίς φρουρό", "    if (_SAG_D1_HINTS.indexOf(nm) < 0) _SAG_D1_HINTS.push(nm);\n", "", "k"],
  ["μ7 χωρίς ταφόπλακα", "  if (_SAG_DEPTH1_ACTIVE && rz.divergence === null) {", "  if (false) {", "k"],
  ["μ8 θύρα από λάθος τιμή", "return (v === 2 || v === 3) ? v : 1; }", "return v >= 1 ? 2 : 1; }", "k"],
  ["μ9 purge πάντα θύρας 2", "? ['soil_ece1', 'soil_ec_pore1', 'soil_ec_raw1', 'soil_ec_ref1'] : ['soil_ece2'", "? ['soil_ece2', 'soil_ec_pore2', 'soil_ec_raw2', 'soil_ec_ref2'] : ['soil_ece2'", "k"],
  ["μ10 EC πάντα κανάλι 1", "_SAG_EC_CHANNELS[_SAG_DEPTH1_PORT === 2 ? 1 : 0]", "_SAG_EC_CHANNELS[0]", "k"],
  ["μ11 φόρμα: θύρα πάντα κρυφή", "const pw = $('depthPortWrap'); if (pw) pw.style.display = one ? '' : 'none';", "const pw = $('depthPortWrap'); if (pw) pw.style.display = 'none';", "f"],
  ["μ12 φόρμα: θύρα πάντα 1", "({ '2': 2, '3': 3 }[$('soil_depth_port').value] || 1) : 1,", "1 : 1,", "f"],
  ["μ13 φόρμα: χωρίς μεταφορά βάθους", "sh.value = dp.value;\n", "\n", "f"],
  ["μ14 sync κόβει τη θύρα", '  "soil_depth_port",\n', "", "s"],
  ["μ15 widget: θύρα 2 αγνοείται", 'sagDepthBox.p=String(p)==="2"?2:String(p)==="3"?3:1}', 'sagDepthBox.p=String(p)==="3"?3:1}', "w"],
  ["μ18 χωρίς διαχωρισμό σημείων", "  if (!_SAG_DEPTH1_ACTIVE || _SAG_DEPTH1_PORT !== 3 || !deviceData", "  if (true || !deviceData", "k"],
  ["μ19 ένα σημείο συγχώνευσης χωρίς διαχωρισμό", "const _pt2b = _sagSplitPoints(deviceData);", "const _pt2b = null;", "k"],
  ["μ20 δύο σημεία: ριζόστρωμα με βαθύ", "((_d1p === 1 || _d1p === 3) && _s0)", "((_d1p === 1) && _s0)", "k"],
  ["μ21 δύο σημεία: στατιστικά μόνο θύρας 1", "|| _SAG_DEPTH1_PORT === 3 || !dev ||", "|| !dev ||", "k"],
  ["μ22 φόρμα: «και οι δύο» δεν αποθηκεύεται", "({ '2': 2, '3': 3 }[", "({ '2': 2 }[", "f"],
  ["μ23 widget: δύο σημεία κρύβουν θύρα", "if(sagDepthBox.v!==1||sagDepthBox.p===3)return!1;", "if(sagDepthBox.v!==1)return!1;", "w"],
  ["μ16 widget: θύρα 2 κρύβει και σόνδα μίας θύρας", "&&!!(o.soil_moisture2||o.soil_temperature2||o.conduct_soil2);", ";", "w"],
  ["μ17 widget αγνοεί τη θύρα της ρύθμισης", "sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port);", "sagDepthSet(o&&o.soil_depth_count);", "w"],
];
let killed = 0;
for (const [name, a, b, where] of MUT) {
  const src = { k: CORE0, f: FORM0, s: SYNC0, w: WID0 }[where];
  const cnt = src.split(a).length - 1;
  if (cnt !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + cnt + ")"); continue; }
  const m = src.replace(a, b);
  const r = run(where === "k" ? m : CORE0, where === "f" ? m : FORM0, where === "s" ? m : SYNC0, where === "w" ? m : WID0);
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 120)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
