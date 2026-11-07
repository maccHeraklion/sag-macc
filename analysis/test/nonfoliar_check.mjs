// Ελεγκτής T-NONFOLIAR-01 (v50.178, 4/11/2026): 7 ασθένειες ριζών/λαιμού/φλοιού/σπορόφυτου εκτός μηχανής υγρού φύλλου.
// Πραγματικός πυρήνας· καστανιά (Βρία/ΜΕΛΙΒΟΙΑ: s2120 χωρίς αισθητήρα φύλλου), πορτοκαλιά (Ρηγάκης), ντομάτα ως μάρτυρας.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, _sagNoCaseKeySet, PATHOGEN_PROFILE, SAG_KERNEL_VERSION, setCovered: (v) => { _SAG_COVERED_ACTIVE = !!v; }, setTick: (h) => { _SAG_TICK_H = h; } };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const SUSP = ["phytophthora_xcambivora", "cryphonectria_parasitica", "phytophthora_citrophthora", "phytophthora_niederhauserii", "phytophthora_pythium_root_rot_herbs", "fusarium_spp_corm_rot", "plasmopara_halstedii"];
const T0 = Date.UTC(2026, 10, 3, 20, 0, 0);
function cropOf(K, type) { for (const c of Object.values(K.PATHOGEN_PROFILE)) for (const p of Object.values(c)) for (const e of p.crops || []) if (e.cultivation_type === type) return { cultivation_type_general: e.cultivation_type_general, cultivation_type: type, stage: "fruiting", name: type, soil_type: "silty_clay_loam", area: 5000, irrigation_system: "dripIrrigation" }; throw new Error("no crop " + type); }
function mkMeas(prevData, hour, o) {
  const data = Object.assign({}, prevData);
  const T = o.T, RH = o.RH, dp = T - (100 - RH) / 5;
  data.temperature = [{ value: T }]; data.humidity = [{ value: RH }]; data.dew_point = [{ value: dp }];
  if (o.lm !== undefined) data.leaf_moisture = [{ value: o.lm }]; if (o.lt !== undefined) data.leaf_temperature = [{ value: o.lt }];
  data.ipsi_avg = [{ value: 2 }];
  data._sagAges = { temperature: 5, humidity: 5, dew_point: 5, leaf_temperature: 5, leaf_moisture: 5 };
  return { timezone: "Europe/Athens", now: new Date(T0 + hour * 3600e3), _prevBundleTime: new Date(T0 + (hour - 1) * 3600e3).toISOString(), data };
}
function tick(K, state, hour, o, crop) {
  K.setTick(1); K.setCovered(false);
  const meas = mkMeas(state.data, hour, o);
  const gdd = K.calculate_GDD(true, false, meas, crop) || [];
  for (const g of gdd) if (g && g.variable) meas.data[g.variable] = [{ value: g.value }];
  const ih = K.calculate_InfectionHours(true, meas, crop) || [];
  for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
  const fir = K.calculate_FIR(true, false, meas, [{ variable: "ipsi", value: 2 }], crop) || [];
  for (const x of fir) meas.data[x.variable] = [{ value: x.value }];
  const msgs = K.getPathogenMessages(fir, meas) || [];
  state.data = {};
  for (const x of [...gdd, ...ih, ...fir]) if (x && x.variable && /^(infection_hours_counter_|gdd_|dh_accumulated_|leaf_|pei_|fir_)/.test(x.variable)) state.data[x.variable] = [{ value: x.value }];
  const g = (arr, v) => arr.find((x) => x && x.variable === v) || null;
  return { ih, fir, msgs, meas, cnt: (k) => { const e = g(ih, "infection_hours_counter_" + k); return e ? Number(e.value) : null; },
    firOf: (k) => g(fir, "fir_" + k), msg: (k) => g(msgs, "fir_message_" + k) || g(fir, "fir_message_" + k) };
}
function series(K, n, o, crop) { let st = { data: {} }, r = null; for (let h = 1; h <= n; h++) r = tick(K, st, h, o, crop); return r; }
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.184 · 2026-11-07", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const CH = cropOf(K, "chestnut"), OR = cropOf(K, "orange"), TO = cropOf(K, "tomato");
    const XC = "phytophthora_xcambivora", CP = "cryphonectria_parasitica", PC = "phytophthora_citrophthora";
    // Α. καστανιά, 30 ώρες T 18 RH 97 χωρίς αισθητήρα φύλλου (πριν: μελάνωση 6 ω → Σοβαρός, έλκος 24 ω → Σοβαρός)
    const a = series(K, 30, { T: 18, RH: 97 }, CH);
    ok(a.cnt(XC) === null && a.cnt(CP) === null, "Α1 καστανιά: κανένας μετρητής ωρών για μελάνωση/έλκος (" + a.cnt(XC) + "/" + a.cnt(CP) + ")");
    ok(a.firOf(XC) === null && a.firOf(CP) && Number(a.firOf(CP).value) === 0, "Α2 καστανιά (v50.180): μελάνωση χωρίς fir_ (χωρίς έδαφος), έλκος fir 0 (εκτός περιόδου)");
    const mx = a.msg(XC), mc = a.msg(CP);
    ok(mx && mx.value === "Μη διαθέσιμο" && mx.metadata.color === "grey" && /ριζών και λαιμού/.test(mx.metadata.text) && /χωρίς αισθητήρα εδάφους/.test(mx.metadata.text) && !/[Ψψ]εκάσ/.test(mx.metadata.text), "Α3 μελάνωση (v50.180): γκρι «Μη διαθέσιμο», χωρίς αισθητήρα εδάφους, χωρίς «ψεκάστε» (" + JSON.stringify(mx) + ")");
    ok(mc && mc.value === "Χαμηλός κίνδυνος" && /δίοδο μόλυνσης/.test(mc.metadata.text) && !/[Ψψ]εκάσ/.test(mc.metadata.text), "Α4 έλκος (v50.180, μοντέλο πληγών, Νοέμβριος): Χαμηλός, χωρίς δίοδο, χωρίς ψεκασμό (" + JSON.stringify(mc) + ")");
    ok(a.msgs.every((m) => !/^fir_message_phytophthora_xcambivora$/.test(m.variable) || m.value === "Μη διαθέσιμο"), "Α5 η getPathogenMessages δεν ξαναγράφει την κάρτα της μελάνωσης");
    // Ε. ηλίανθος: ο περονόσπορος ηλίανθου παραμένει στη λίστα αναστολής (v50.180: μένουν 4)
    const SUN = cropOf(K, "sunflower"), PH = "plasmopara_halstedii";
    const e = series(K, 10, { T: 18, RH: 97 }, SUN);
    ok(e.cnt(PH) === null && e.firOf(PH) === null, "Ε1 ηλίανθος: χωρίς μετρητή και χωρίς fir_ (" + e.cnt(PH) + "/" + e.firOf(PH) + ")");
    ok(e.msg(PH) && e.msg(PH).value === "Μη διαθέσιμο" && /σπορόφυτο/.test(e.msg(PH).metadata.text) && /αποσύρθηκε/.test(e.msg(PH).metadata.text) && !/[Ψψ]εκάσ/.test(e.msg(PH).metadata.text), "Ε2 ηλίανθος: γκρι «αποσύρθηκε» (" + JSON.stringify(e.msg(PH)) + ")");
    // Β. πορτοκαλιά: γομμώσεις γκρι, η αλτερνάρια εσπεριδοειδών συνεχίζει να μετρά
    const b = series(K, 10, { T: 20, RH: 92 }, OR);
    ok(b.msg(PC) && b.msg(PC).value === "Μη διαθέσιμο" && /κορμού/.test(b.msg(PC).metadata.text) && !/[Ψψ]εκάσ/.test(b.msg(PC).metadata.text), "Β1 γομμώσεις (v50.180, χωρίς έδαφος): γκρι με αιτία, χωρίς ψεκασμό (" + JSON.stringify(b.msg(PC)) + ")");
    ok(b.cnt("alternaria_alternata_citrus_abs") === 10 && b.firOf("alternaria_alternata_citrus_abs"), "Β2 αλτερνάρια εσπεριδοειδών: μετρά 10 ώρες όπως πριν (" + b.cnt("alternaria_alternata_citrus_abs") + ")");
    // Γ. ντομάτα: ο περονόσπορος σολανωδών αμετάβλητος
    const c = series(K, 10, { T: 17, RH: 92 }, TO);
    ok(c.cnt("phytophthora_infestans") === 10 && c.msg("phytophthora_infestans") && c.msg("phytophthora_infestans").value === "Υψηλός κίνδυνος", "Γ1 ντομάτα: περονόσπορος σολανωδών μετρά και δίνει επιθεώρηση (" + c.cnt("phytophthora_infestans") + ")");
    // Δ. υποθέσεις: οι 7 εκτός κύκλου, ανοιχτή ειδοποίηση κλείνει «auto»
    const ncs = K._sagNoCaseKeySet();
    ok(SUSP.every((k) => ncs.has(k)) && !ncs.has("phytophthora_infestans") && !ncs.has("botrytis_cinerea"), "Δ1 οι 7 χωρίς κύκλο υπόθεσης, οι φυλλικές μέσα");
    const nowMs = T0 + 40 * 3600e3; const openRec = { s: "open", o: Math.floor((T0 - 10 * 864e5) / 60000), p: 4, h: Math.floor((T0 - 36e5) / 60000) };
    const meas = mkMeas({}, 40, { T: 18, RH: 97 }); meas.data["case_" + PH] = [{ value: JSON.stringify(openRec) }];
    const outC = K._sagPathogenCases(meas, e.fir, null, null, nowMs, NaN, null) || [];
    const cx = outC.find((x) => x.variable === "case_" + PH);
    ok(cx && JSON.parse(cx.value).s === "auto", "Δ2 ανοιχτή ειδοποίηση περονόσπορου ηλίανθου κλείνει αυτόματα (" + (cx && cx.value) + ")");
    ok(!outC.some((x) => x.variable === "fir_message_" + PH), "Δ3 δεν εκπέμπεται «Σε παρακολούθηση» για αυτόν");
    const meas2 = mkMeas({}, 40, { T: 17, RH: 92 }); meas2.data["case_phytophthora_infestans"] = [{ value: JSON.stringify(openRec) }];
    const outT = K._sagPathogenCases(meas2, c.fir, null, null, nowMs, NaN, null) || [];
    const ct = outT.find((x) => x.variable === "case_phytophthora_infestans");
    ok(ct && JSON.parse(ct.value).s === "open", "Δ4 φυλλική ασθένεια: ο κύκλος υπόθεσης όπως πριν (" + (ct && ct.value) + ")");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 χωρίς γκρι κάρτα όταν λείπει έδαφος (v50.180)", "if (_nfT) indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',", "if (false) indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',"],
  ["M2 ηλίανθος εκτός λίστας", "'fusarium_spp_corm_rot', 'plasmopara_halstedii'];", "'fusarium_spp_corm_rot'];"],
  ["M3 μετρητής συνεχίζει", "      if (_SAG_NONFOLIAR_SUSPENDED.indexOf(pathogenKey) >= 0) continue;   // T-NONFOLIAR-01: χωρίς μετρητή ωρών\n", ""],
  ["M4 κάρτα με κίνδυνο", "indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',\n          metadata: { color: 'grey'", "indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός κίνδυνος',\n          metadata: { color: 'green'"],
  ["M5 χωρίς continue", "αποσύρθηκε μέχρι να μπει σωστό μοντέλο. ' + _nfT[1] } }];\n        continue;", "αποσύρθηκε μέχρι να μπει σωστό μοντέλο. ' + _nfT[1] } }];"],
  ["M6 κείμενο «ψεκάστε» στις γομμώσεις", "'Κρατήστε τον λαιμό στεγνό, μην βρέχετε τον κορμό στο πότισμα, βελτιώστε τη στράγγιση.'],", "'Ψεκάστε τον κορμό.'],"],
  ["M7 υποθέσεις μένουν ανοιχτές", "    for (const _nf of _SAG_NONFOLIAR_SUSPENDED) s.add(_nf);", "    for (const _nf of []) s.add(_nf);"],
  ["M8 λάθος αιτία", "['ριζών και λαιμού από το έδαφος (μελάνωση καστανιάς)',", "['φύλλου (μελάνωση καστανιάς)',"],
];
let bad = 0;
for (const [n, a, b] of M) {
  if (SRC.split(a).length !== 2) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ " + n); bad++; continue; }
  const r = run(SRC.replace(a, b));
  console.log((r.length ? "ΣΚΟΤΩΘΗΚΕ " : "ΕΠΕΖΗΣΕ ") + n);
  if (!r.length) bad++;
}
console.log(bad ? "ΑΠΟΤΥΧΙΑ μεταλλάξεων: " + bad : "ΜΕΤΑΛΛΑΞΕΙΣ " + M.length + "/" + M.length);
process.exit(bad ? 1 : 0);
