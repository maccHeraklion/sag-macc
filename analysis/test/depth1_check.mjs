// Ελεγκτής T-DEPTH1-01 (3/11/2026): «ένα βάθος αισθητήρα εδάφους» με δήλωση στη φόρμα — πυρήνας v50.167, φόρμα v26,
// sync v16, widget W-DEPTH1-01. Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα (και τον v50.166 από το git για ΔΙΑΦΟΡΙΚΟ: χωρίς δήλωση
// ΤΑΥΤΟΣΗΜΑ αποτελέσματα), εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα φόρμας/widget με ψεύτικο DOM. Μεταλλάξεις σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, "..", "..");
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE0 = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const OLD = execSync("git show 1b33dc36c26a1e52cb4eb2b69994bb8cdabf1af7:analysis/runPerTich.js", { cwd: root, maxBuffer: 64 << 20 }).toString("utf8").replace(/\r\n/g, "\n");
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
function cut(src, a, b, label, inclB = false) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const COMMON = "_sagRootZoneMoisture, _sagSensorDepthCm, _sagRootZoneIndicators, SAG_KERNEL_VERSION";
function run(core, form, sync, wid) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core, COMMON + ", _sagDepth1Mask, _sagDevExpect, _sagDevStatsD1, _sagEcChansD1, _sagDepth1Of, _SAG_DEV_EXPECT, _SAG_EC_CHANNELS, _setD1: (v) => { _SAG_DEPTH1_ACTIVE = v; }");
    const O = load(OLD, COMMON);
    ok(K.SAG_KERNEL_VERSION === "v50.167 · 2026-11-03", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    // ── Δ: ΔΙΑΦΟΡΙΚΟ — χωρίς δήλωση (απόν/2/άκυρο) ΤΑΥΤΟΣΗΜΑ με v50.166 ──
    let cmp = 0, bad = 0, ex = "";
    K._setD1(false);
    for (const cfg of [{}, { soil_depth_count: 2 }, { soil_depth_count: "2" }, { soil_depth_count: 0 }, { soil_depth_count: "x" }])
      for (const dd of [{}, { sensorShallow_depth_cm: 15 }, { sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 }, { sensor_deep_depth_cm: 60 }])
        for (const st of ["initial", "full_canopy"])
          for (const mv of [{}, { soil_moisture1: 22 }, { soil_moisture2: 30 }, { soil_moisture1: 22, soil_moisture2: 30 }, { soil_moisture: 18 }, { soil_moisture1: 9, soil_moisture2: 41, rain_height_daily: 3 }]) {
            const p = Object.assign({ cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: st }, cfg, dd);
            const a = J([K._sagRootZoneMoisture(M(mv), p), K._sagSensorDepthCm(p, 1), K._sagSensorDepthCm(p, 2)]);
            const b = J([O._sagRootZoneMoisture(M(mv), p), O._sagSensorDepthCm(p, 1), O._sagSensorDepthCm(p, 2)]);
            cmp++; if (a !== b) { bad++; ex = ex || a.slice(0, 160) + " ≠ " + b.slice(0, 160); }
            const rz = O._sagRootZoneMoisture(M(mv), p);
            if (J(K._sagRootZoneIndicators(rz)) !== J(O._sagRootZoneIndicators(rz))) { bad++; ex = ex || "ενδείξεις ριζοστρώματος"; }
          }
    ok(bad === 0 && cmp === 240, "Δ1 χωρίς δήλωση ΤΑΥΤΟΣΗΜΑ με v50.166 σε " + cmp + " περιπτώσεις (διαφορές " + bad + ": " + ex + ")");
    // ── Ρ: ένα βάθος ──
    const p1 = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "full_canopy", soil_depth_count: 1, sensorShallow_depth_cm: 15, sensor_deep_depth_cm: 40 };
    ok(K._sagDepth1Of(p1) && K._sagDepth1Of({ soil_depth_count: "1" }) && !K._sagDepth1Of({}) && !K._sagDepth1Of({ soil_depth_count: 2 }), "Ρ0 ανάγνωση δήλωσης");
    const r1 = K._sagRootZoneMoisture(M({ soil_moisture1: 22, soil_moisture2: 41 }), p1);
    ok(r1.ok && r1.value === 22 && r1.w1 === 1 && r1.w2 === 0 && r1.m2 === null && r1.divergence === null && r1.basis === "Ένα βάθος: 15 cm", "Ρ1 ριζόστρωμα = ΜΟΝΟ το ρηχό (" + J(r1) + ")");
    const r2 = K._sagRootZoneMoisture(M({ soil_moisture2: 33 }), p1);
    ok(r2.ok && r2.value === 33 && /Ένα βάθος: 15 cm/.test(r2.basis), "Ρ2 σόνδα μόνο στο κανάλι 2 (lse01_deep): κρατιέται, με το βάθος της φόρμας (" + r2.basis + ")");
    ok(K._sagSensorDepthCm(p1, 2) === 15 && K._sagSensorDepthCm(p1, 1) === 15, "Ρ3 ένα βάθος για κάθε θέση");
    K._setD1(true);
    const ind = K._sagRootZoneIndicators(r1), bas = ind.find((x) => x.variable === "soil_depth_basis"), tomb = ind.find((x) => x.variable === "soil_depth_divergence");
    ok(bas && bas.metadata.color === "green" && /δηλωμένο ένα βάθος/.test(bas.metadata.text), "Ρ4 κείμενο «δηλωμένο ένα βάθος», πράσινο (" + J(bas) + ")");
    ok(tomb && tomb.value === null && tomb.metadata.color === "grey", "Ρ5 ταφόπλακα στη σύγκριση βαθών (κλειδί καλλιέργειας)");
    // ── Μ: μάσκα ανά συσκευή ──
    const dv = { soil_moisture1: [1], soil_temperature1: [1], conduct_soil1: [1], soil_moisture2: [1], soil_temperature2: [1], conduct_soil2: [1], soil_moisture2_avg: [1], soil_temperature2_avg: [1], battery: [1] };
    const n = K._sagDepth1Mask(dv);
    ok(n === 5 && J(Object.keys(dv).sort()) === J(["battery", "conduct_soil1", "soil_moisture1", "soil_temperature1"]), "Μ1 συσκευή 2 καναλιών: κόβεται ΟΛΟ το κανάλι 2 (" + n + " " + J(Object.keys(dv)) + ")");
    const deep = { soil_moisture2: [1], soil_temperature2: [1], conduct_soil2: [1] };
    ok(K._sagDepth1Mask(deep) === 0 && Object.keys(deep).length === 3, "Μ2 σόνδα ΜΟΝΟ στο κανάλι 2: ανέγγιχτη");
    const bare = { soil_moisture: [1], temp_soil: [1], soil_moisture2: [1] };
    ok(K._sagDepth1Mask(bare) === 1 && !bare.soil_moisture2, "Μ3 γυμνά ονόματα (lse01) μετρούν ως κανάλι 1");
    K._setD1(false); const dv2 = { soil_moisture1: [1], soil_moisture2: [1] };
    ok(K._sagDepth1Mask(dv2) === 0 && dv2.soil_moisture2, "Μ4 χωρίς δήλωση: καμία μάσκα");
    // ── Β: βλάβες/αναμενόμενα ──
    K._setD1(true);
    const ex1 = K._sagDevExpect("se0x");
    ok(ex1.length === 2 && !ex1.some((c) => /βαθέος/.test(c.k)), "Β1 se0x: χωρίς «υγρασία/θερμοκρασία βαθέος»");
    ok(K._sagDevExpect("lse02").length === 2, "Β1β lse02 το ίδιο");
    ok(J(K._sagDevExpect("lse01_deep")) === J(K._SAG_DEV_EXPECT.lse01_deep), "Β2 lse01_deep ανέγγιχτο");
    ok(K._sagDevExpect("uc511") === K._SAG_DEV_EXPECT.uc511, "Β2β άλλοι τύποι ανέγγιχτοι");
    const sts = K._sagDevStatsD1({ t: "se0x", stats: { soil_moisture1: 1, soil_moisture2: 2, soil_temperature2: 3 } });
    ok(J(Object.keys(sts)) === J(["soil_moisture1"]), "Β3 στατιστικά ημέρας χωρίς κανάλι 2");
    K._setD1(false);
    ok(K._sagDevExpect("se0x") === K._SAG_DEV_EXPECT.se0x, "Β4 χωρίς δήλωση: ο ίδιος πίνακας");
    // ── Ε: αγωγιμότητα ──
    K._setD1(true);
    const ch = K._sagEcChansD1(M({ soil_moisture1: 20, conduct_soil1: 300 }));
    ok(ch.length === 1 && ch[0].n === "1" && ch[0].el === "έδαφος" && K._SAG_EC_CHANNELS[0].el === "ρηχό", "Ε1 ένα κανάλι, «έδαφος», ο πίνακας ανέγγιχτος");
    ok(K._sagEcChansD1(M({ soil_moisture2: 20 })) === K._SAG_EC_CHANNELS, "Ε2 σόνδα μόνο στο 2: και τα δύο κανάλια (τίποτα δεν κόβεται)");
    K._setD1(false);
    ok(K._sagEcChansD1(M({ soil_moisture1: 20 })) === K._SAG_EC_CHANNELS, "Ε3 χωρίς δήλωση: όπως πριν");
    // ── Σ: στατικά πυρήνα ──
    ok(core.includes("    // T-DEPTH1-01: ΠΡΩΤΑ η μάσκα — πύλη, συγχώνευση, ηλικίες, βλάβες δεν βλέπουν ποτέ το κανάλι 2.\n    _sagDepth1Mask(deviceData);\n    const r = _sagPlausibilityGate("), "Σ1 μάσκα ΠΡΙΝ από την πύλη");
    ok(core.split("_sagScreenDevice(deviceData, info?.name || value, fieldName)").length - 1 >= 3, "Σ1β όλες οι διαδρομές συσκευών περνούν από τη μάσκα");
    const fl = core.indexOf("_SAG_DEPTH1_ACTIVE = _sagDepth1Of(fieldConfig);"), gm = core.indexOf("const measurements = await getMeasurements(hourTich, dailyTich, devices");
    ok(fl > 0 && gm > fl && gm - fl < 400, "Σ2 η σημαία τίθεται ΠΡΙΝ από τις αναγνώσεις του αγρού");
    ok(core.includes("      _SAG_DEPTH1_ACTIVE = false;     // T-DEPTH1-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n"), "Σ3 μηδενισμός ανά αγρό");
    ok(core.includes("if (_sagD1Masked(measurements)) _purgeShared.push('soil_ece2', 'soil_ec_pore2', 'soil_ec_raw2', 'soil_ec_ref2');"), "Σ4 purge καναλιού 2");
    ok(core.includes("const _scD = (_SAG_DEPTH1_ACTIVE && Number.isFinite(_scNum(_SAG_SOIL_M_SHALLOW))) ? {}"), "Σ5 βαθμονόμηση: το d δεν κρατιέται");
    ok(core.includes("const _SOIL_AVG_CH = _SAG_DEPTH1_ACTIVE ? ['soil_moisture1', 'soil_temperature1']"), "Σ6 χωρίς μέσους 24ώρου καναλιού 2");
    ok(core.split("const chans = _numbered ? _sagEcChansD1(measurements)").length - 1 === 2, "Σ7 αναφορά ημέρας + δείκτες EC");
    ok(core.includes("if (soil && !soil2 && !_SAG_DEPTH1_ACTIVE) {"), "Σ8 καμία πρόταση «ΔΕΥΤΕΡΟ ΒΑΘΟΣ»");
    ok(core.includes("&& !(_sagDepth1Of(parameters) && _cs.s && (Number(_cs.s.n) || 0) > 0);"), "Σ9 όρια: η παλιά βαθιά βαθμονόμηση αγνοείται");
    // ── Φ: φόρμα ──
    ok(/<select id="soil_depth_count" onchange="_sagDepthUi\(\)">\s*<option value="2">Δύο βάθη \(ρηχό και βαθύ\)<\/option>\s*<option value="1">Ένα βάθος<\/option>/.test(form), "Φ1 πεδίο, προεπιλογή «Δύο βάθη»");
    const uiSrc = cut(form, "function _sagDepthUi(){", "function _keepPrev(v, prev){", "Φ εμφάνιση");
    const els = { soil_depth_count: { value: "1" }, deepDepthWrap: { style: { display: "" } }, shallowDepthLabel: { textContent: "" }, depthCountNote: { textContent: "" } };
    const ui = new Function("$", uiSrc + "\nreturn _sagDepthUi;")((id) => els[id]);
    ui(); ok(els.deepDepthWrap.style.display === "none" && els.shallowDepthLabel.textContent === "Βάθος αισθητήρα (cm)" && /Ένα βάθος/.test(els.depthCountNote.textContent), "Φ2 «Ένα βάθος»: κρύβεται το βαθύ, ένα πεδίο βάθους");
    els.soil_depth_count.value = "2"; ui(); ok(els.deepDepthWrap.style.display === "" && /Ρηχό/.test(els.shallowDepthLabel.textContent), "Φ3 «Δύο βάθη»: όπως πριν");
    const sv = cut(form, "    soil_depth_count: ", ",   /* v26 · T-DEPTH1-01 */", "Φ αποθήκευση").replace("    soil_depth_count: ", "");
    const save = (v) => new Function("$", "return " + sv + ";")((id) => (id === "soil_depth_count" ? { value: v } : null));
    ok(save("1") === 1 && save("2") === 2 && save("") === 2, "Φ4 αποθήκευση 1 | 2");
    ok(form.includes("$('soil_depth_count').value = String(conf.soil_depth_count) === '1' ? '1' : '2'; _sagDepthUi();"), "Φ5 φόρτωση: απόν → Δύο βάθη");
    ok(form.includes("{ const _dc = $('soil_depth_count'); if (_dc) _dc.value = '2'; } _sagDepthUi();"), "Φ6 αλλαγή αγρού: επαναφορά");
    ok(form.includes("if (pair[0] === 'sensor_deep_depth_cm' && $('soil_depth_count') && $('soil_depth_count').value === '1') return;"), "Φ7 κρυφό βαθύ εκτός ελέγχου αριθμού");
    // ── Υ: sync ──
    const wl = cut(sync, '"soil_ref_device",', "];", "λευκή λίστα");
    ok(/"soil_depth_count",/.test(wl), "Υ1 το sync περνά το soil_depth_count (παγίδα #1)");
    // ── W: widget ──
    const box = cut(wid, "/* W-DEPTH1-01 */sagDepthBox={v:2},", "sagEceBox={v:null}", "W κουτί");
    const W = new Function("let " + box.replace(/,$/, "") + ";\nreturn {sagDepthBox, sagDepthSet, sagDepthHide};")();
    W.sagDepthSet(1);
    ok(W.sagDepthHide("soil_moisture2", { soil_moisture1: [1] }) && W.sagDepthHide("soil_ec_pore2", { conduct_soil1: [1] }), "W1 ένα βάθος: κρύβεται το κανάλι 2 σε συσκευή με κανάλι 1");
    ok(!W.sagDepthHide("soil_moisture2", { soil_moisture2: [1] }), "W2 σόνδα μόνο στο 2: ορατή");
    ok(!W.sagDepthHide("soil_moisture1", { soil_moisture1: [1] }) && !W.sagDepthHide("air_temperature", { soil_moisture1: [1] }), "W3 τίποτε άλλο δεν κρύβεται");
    W.sagDepthSet(null); ok(!W.sagDepthHide("soil_moisture2", { soil_moisture1: [1] }), "W4 χωρίς δήλωση: όπως πριν");
    ok(wid.includes("sagFertSet(o&&o.fert_ecw_dsm);sagDepthSet(o&&o.soil_depth_count);return vv"), "W5 σημαία από τη ρύθμιση του αγρού");
    ok(wid.includes("sagRainHide.has(v)||sagDepthHide(v,j))return!1;") && wid.includes("sagRainHide.has(d)||sagDepthHide(d,N))return!1;"), "W6 και στις δύο λίστες μετρήσεων");
    ok(/function Ne\(t\)\{let s=St\[t\];\/\* W-DEPTH1-01 \*\/if\(s&&sagDepthBox\.v===1&&/.test(wid) && wid.includes('label:s.label.replace(" Ρηχό","")'), "W7 ετικέτες χωρίς «Ρηχό»");
    ok(wid.includes('sagEceD9=q=>q==="1"?(sagDepthBox.v===1?"":" Ρηχό"):'), "W8 τίτλος κάρτας EC");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(CORE0, FORM0, SYNC0, WID0);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (διαφορικό με v50.166, ένα βάθος, μάσκα, βλάβες, EC, φόρμα, sync, widget)");
const MUT = [
  ["μ1 μάσκα και σε σόνδα μόνο του 2", "if (!ks.some(k => _SAG_D1_CH1_RE.test(k))) return 0;", "", "k"],
  ["μ2 χωρίς μάσκα", "    _sagDepth1Mask(deviceData);\n    const r = _sagPlausibilityGate(", "    const r = _sagPlausibilityGate(", "k"],
  ["μ3 ριζόστρωμα με κανάλι 2", "  const d = (_sagDepth1Of(parameters) && s) ? null : _sagNumFrom(", "  const d = (false && s) ? null : _sagNumFrom(", "k"],
  ["μ4 βάθος βαθιού", "  if (_sagDepth1Of(parameters) && which === 2) return _sagSensorDepthCm(parameters, 1);\n", "", "k"],
  ["μ5 βαθέος στα αναμενόμενα", "  return e.filter(ch => !ch.a.every(k => /2(_avg)?$/.test(k)));", "  return e;", "k"],
  ["μ6 lse01_deep κομμένο", "(t !== 'se0x' && t !== 'lse02')) return e;", "false) return e;", "k"],
  ["μ7 χωρίς ταφόπλακα", "  if (_SAG_DEPTH1_ACTIVE && rz.divergence === null) {", "  if (false) {", "k"],
  ["μ8 και με 2 το ένα βάθος", "function _sagDepth1Of(cfg) { return Number(cfg && cfg.soil_depth_count) === 1; }", "function _sagDepth1Of(cfg) { return Number(cfg && cfg.soil_depth_count) >= 1; }", "k"],
  ["μ9 χωρίς purge", "if (_sagD1Masked(measurements)) _purgeShared.push(", "if (false) _purgeShared.push(", "k"],
  ["μ10 φόρμα: βαθύ πάντα ορατό", "const w = $('deepDepthWrap'); if (w) w.style.display = one ? 'none' : '';", "const w = $('deepDepthWrap'); if (w) w.style.display = '';", "f"],
  ["μ11 φόρμα: αποθηκεύει πάντα 2", "($('soil_depth_count') && $('soil_depth_count').value === '1') ? 1 : 2,", "2,", "f"],
  ["μ12 sync κόβει το κλειδί", '  "soil_depth_count",\n', "", "s"],
  ["μ13 widget κρύβει και σόνδα του 2", "return!!(o.soil_moisture1||o.soil_moisture||o.soil_temperature1||o.conduct_soil1)", "return!0", "w"],
  ["μ14 widget αγνοεί τη ρύθμιση", "sagDepthSet(o&&o.soil_depth_count);return vv", "return vv", "w"],
];
let killed = 0;
for (const [name, a, b, where] of MUT) {
  const src = { k: CORE0, f: FORM0, s: SYNC0, w: WID0 }[where];
  const n = src.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const m = src.replace(a, b);
  const r = run(where === "k" ? m : CORE0, where === "f" ? m : FORM0, where === "s" ? m : SYNC0, where === "w" ? m : WID0);
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 130)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
