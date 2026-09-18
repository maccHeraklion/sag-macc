/* ΑΡΜΟΣ ΕΛΕΓΧΟΥ FAILSAFE — τρέχει ΤΟΝ ΙΔΙΟ κώδικα που τρέχει στην παραγωγή.
   Ο πυρήνας ΔΕΝ αγγίζεται στον δίσκο: διαβάζεται, του προστίθεται ΜΙΑ γραμμή
   εξαγωγών στη μνήμη, και εκτελείται με στελέχη για @tago-io/sdk. */

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const KERNEL = "C:/Users/Katharak/OneDrive - ΕΠΙΜΕΛΗΤΗΡΙΟ ΗΡΑΚΛΕΙΟΥ/Επιφάνεια εργασίας/MACC/analysis/runPerTich.js";

/* ── ΣΤΕΛΕΧΟΣ SDK ─────────────────────────────────────────────────────── */
class AnalysisStub { constructor(fn) { this.fn = fn; } }
const sdkStub = {
  Analysis: AnalysisStub,
  Resources: function () {},
  Account: function () {},
  Services: function () {},
  Device: function () {},
  Utils: {},
};

/* ── ΦΟΡΤΩΣΗ ΠΥΡΗΝΑ ΜΕ ΕΠΙΠΛΕΟΝ ΕΞΑΓΩΓΕΣ (ΜΟΝΟ ΣΤΗ ΜΝΗΜΗ) ───────────── */
const EXTRA = [
  "_sagLeafWetness", "_sagRootZoneMoisture", "_sagRootZone24h",
  "_sagSensorDepthCm", "_sagRootDepthMm", "getVal", "_sagNum", "_sagNumFrom",
  "_SAG_AGE_LIMITS", "_SAG_FAO_EXTRACTION", "_SAG_LWS_SOURCE_EL",
  "_SAG_SOIL_M_SHALLOW", "_SAG_SOIL_M_DEEP", "_sagPhRead",
  "calculate_VPD", "calculate_IPSI", "calculate_InfectionHours",
  "calculate_IrrigationVolume", "CROP_PROFILE", "calculate_ET0_PM",
  "WATER_PROFILE", "IRRIGATION_SYSTEM_PROFILE", "SOIL_PROFILE", "PATHOGEN_PROFILE",
  "computeSoilMoistureLimits", "buildSoilMoistureLimitIndicators",
  "calculate_ET0_Hargreaves", "calculate_FIR", "calculate_BPI", "calculate_GDD",
];

let src = fs.readFileSync(KERNEL, "utf8");
src += "\n;module.exports = { __all: { " + EXTRA.join(", ") + " } };\n";

process.env.RPERTICH_TEST_MODE = "false";   // ΟΧΙ το test-mode block — θέλουμε ΟΛΑ

const mod = { exports: {} };
const kreq = Module.createRequire(KERNEL);
const req = (name) => {
  if (name === "@tago-io/sdk") return sdkStub;
  try { return kreq(name); } catch (e) { return require(name); }
};
const fn = new Function("module", "exports", "require", "process", "__filename", "__dirname", src);
fn(mod, mod.exports, req, process, KERNEL, path.dirname(KERNEL));

const K = mod.exports.__all;
if (!K || typeof K._sagLeafWetness !== "function") {
  console.log("X  Ο ΠΥΡΗΝΑΣ ΔΕΝ ΦΟΡΤΩΘΗΚΕ");
  process.exit(1);
}

/* ── ΕΡΓΑΛΕΙΑ ΕΛΕΓΧΟΥ ─────────────────────────────────────────────────── */
let ok = 0, bad = 0;
const rows = [];
const T = (id, what, cond, got) => {
  if (cond) { ok += 1; rows.push([id, "OK", what, got === undefined ? "" : String(got)]); }
  else { bad += 1; rows.push([id, "X", what, got === undefined ? "" : String(got)]); }
};
const S = (t) => rows.push(["", "", "== " + t + " ==", ""]);

const NOW = Date.parse("2026-09-12T14:00:00+03:00");
const ser = (v, minsAgo) => [{ value: v, time: new Date(NOW - (minsAgo || 5) * 60000).toISOString() }];

function meas(vars, ages) {
  const d = {};
  for (const k of Object.keys(vars)) d[k] = Array.isArray(vars[k]) ? vars[k] : ser(vars[k]);
  d._sagAges = ages || {};
  return { data: d, now: NOW, timezone: "Europe/Athens",
           _prevBundleTime: new Date(NOW - 3600000).toISOString() };
}

/* ═══════════════════════════════════════════════════════════════════════
   1 · ΦΥΛΛΟ · ΣΗΜΕΙΟ ΔΡΟΣΟΥ · Η ΚΛΙΜΑΚΑ ΤΩΝ ΕΝΝΙΑ ΠΗΓΩΝ
   ═══════════════════════════════════════════════════════════════════════ */
S("1 · ΥΓΡΑΣΙΑ ΦΥΛΛΩΜΑΤΟΣ — Η ΚΛΙΜΑΚΑ ΥΠΟΚΑΤΑΣΤΑΣΗΣ");
const LW = K._sagLeafWetness;

let r = LW({ rain1h: 1.0, leafMoisture: 0, T_air: 25, RH: 40, dewPoint: 5, leafTemp: 25, leafShaded: true });
T("LW-1", "Βροχή νικάει τα πάντα", r.source === "rain" && r.wet === true && r.weight === 1, r.source);

r = LW({ rain1h: 0, leafMoisture: 60, T_air: 25, RH: 40, dewPoint: 5, leafShaded: true });
T("LW-2", "Αισθητήρας φύλλου υψηλός -> HIGH", r.source === "sensor" && r.confidence === "HIGH", r.source + "/" + r.confidence);

r = LW({ rain1h: 0, leafMoisture: 20, T_air: 25, RH: 40, dewPoint: 5, leafShaded: true });
T("LW-3", "Αισθητήρας οριακός -> MEDIUM με βάρος", r.source === "sensor" && r.confidence === "MEDIUM" && r.weight > 0 && r.weight < 1, r.weight);

/* ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΤΟΥ ΜΙΧΑΛΗ: φύλλο ΣΤΟΝ ΗΛΙΟ (leafShaded=false) */
r = LW({ rain1h: 0, leafMoisture: null, T_air: 12.0, RH: 95, dewPoint: 11.8, leafTemp: 11.0, leafShaded: false });
T("LW-4", "ΦΥΛΛΟ ΣΤΟΝ ΗΛΙΟ: η θερμ. φύλλου ΔΕΝ χρησιμοποιείται για δρόσο",
  r.source !== "dew_leaf", r.source);
T("LW-5", "  ...και τη θέση της παίρνει το ΣΗΜΕΙΟ ΔΡΟΣΟΥ από τον αέρα",
  r.source === "dew_air" && r.wet === true, r.source);

r = LW({ rain1h: 0, leafMoisture: null, T_air: 12.0, RH: 95, dewPoint: 11.8, leafTemp: 11.0, leafShaded: true });
T("LW-6", "ΦΥΛΛΟ ΣΚΙΑΣΜΕΝΟ: χρησιμοποιείται η θερμ. φύλλου (ακριβέστερο)",
  r.source === "dew_leaf" && r.confidence === "HIGH", r.source);

/* ΧΩΡΙΣ dew_point — ΤΟ ΚΡΙΣΙΜΟ ΣΕΝΑΡΙΟ */
r = LW({ rain1h: 0, leafMoisture: null, T_air: 12.0, RH: 95, dewPoint: null, leafTemp: 11.0, leafShaded: true });
T("LW-7", "ΧΩΡΙΣ dew_point + RH 95: πέφτει στη σχετική υγρασία", r.source === "rh" && r.wet === true, r.source);
T("LW-8", "  ...με ΧΑΜΗΛΗ εμπιστοσύνη και μειωμένο βάρος", r.confidence === "LOW" && r.weight < 0.8, r.confidence + "/" + r.weight);

/* ΤΟ ΚΕΝΟ: δρόσος υπάρχει φυσικά αλλά RH < 90 και ΔΕΝ υπάρχει dew_point */
r = LW({ rain1h: 0, leafMoisture: null, T_air: 12.0, RH: 88, dewPoint: null, leafTemp: 11.6, leafShaded: true });
const rWithDp = LW({ rain1h: 0, leafMoisture: null, T_air: 12.0, RH: 88, dewPoint: 10.7, leafTemp: 11.6, leafShaded: true });
T("LW-9", "ΜΕ dew_point 10,7 και T_air 12,0 (ψύξη κόμης 1,5): ΥΓΡΟ", rWithDp.wet === true && rWithDp.source === "dew_air", rWithDp.source);
T("LW-10", "ΧΩΡΙΣ dew_point, ΙΔΙΕΣ συνθήκες: ΣΤΕΓΝΟ — Η ΠΛΗΡΟΦΟΡΙΑ ΧΑΝΕΤΑΙ",
  r.wet === false, r.source + " / wet=" + r.wet);

r = LW({ rain1h: 0, leafMoisture: 3, T_air: 25, RH: 40, dewPoint: 5, leafShaded: false });
T("LW-11", "Στεγνό από ΑΣΚΙΑΣΤΟ αισθητήρα -> δηλώνεται ΑΒΕΒΑΙΟ", r.source === "sensor_unverified" && r.confidence === "LOW", r.source);
r = LW({ rain1h: 0, leafMoisture: 3, T_air: 25, RH: 40, dewPoint: 5, leafShaded: true });
T("LW-12", "Στεγνό από ΣΚΙΑΣΜΕΝΟ αισθητήρα -> HIGH", r.source === "sensor_dry" && r.confidence === "HIGH", r.source);
r = LW({ rain1h: 0, leafMoisture: null, T_air: 25, RH: 40, dewPoint: 5 });
T("LW-13", "Καμία πηγή -> 'none', ΠΟΤΕ σιωπηλό ψευδές υγρό", r.source === "none" && r.wet === false, r.source);

/* ΑΚΡΑΙΕΣ ΤΙΜΕΣ ΟΡΓΑΝΟΥ */
r = LW({ rain1h: 0, leafMoisture: 0, T_air: 25, RH: 40, dewPoint: 5, leafTemp: 40.00, leafShaded: true });
T("LW-14", "leaf_temp 40,00 (όριο κλίμακας) δεν παράγει ψευδή δρόσο", r.wet === false, r.source);
r = LW({ rain1h: 0, leafMoisture: null, T_air: 12, RH: 95, dewPoint: 11.8, leafTemp: 200, leafShaded: true });
T("LW-15", "leaf_temp 200 °C απορρίπτεται ως εκτός φυσικού εύρους", r.source !== "dew_leaf", r.source);

/* ═══════════════════════════════════════════════════════════════════════
   2 · ΥΓΡΑΣΙΑ ΡΙΖΟΣΤΡΩΜΑΤΟΣ — ΕΝΑΣ Η ΔΥΟ ΑΙΣΘΗΤΗΡΕΣ
   ═══════════════════════════════════════════════════════════════════════ */
S("2 · ΥΓΡΑΣΙΑ ΡΙΖΟΣΤΡΩΜΑΤΟΣ — ΠΡΟΣΑΡΜΟΓΗ ΣΤΟ ΠΛΗΘΟΣ ΟΡΓΑΝΩΝ");
const RZ = K._sagRootZoneMoisture;
const P_OLIVE = { cultivation_type_general: "olive", cultivation_type: "koroneiki",
                  stage: "fruit_dev", name: "ΔΟΚΙΜΗ" };

let z = RZ(meas({ soil_moisture1: 18, soil_moisture2: 30 }), P_OLIVE);
T("RZ-1", "ΔΥΟ βάθη: και τα δύο βάρη > 0", z.ok && z.w1 > 0 && z.w2 > 0, "w1=" + z.w1 + " w2=" + z.w2);
T("RZ-2", "  ...και αθροίζουν 1,00 (FAO-56 §7 40/30/20/10)", Math.abs(z.w1 + z.w2 - 1) < 1e-9, z.w1 + z.w2);
T("RZ-3", "  ...η τιμή είναι ΑΝΑΜΕΣΑ στις δύο μετρήσεις", z.value > 18 && z.value < 30, z.value);

z = RZ(meas({ soil_moisture1: 18 }), P_OLIVE);
T("RZ-4", "ΕΝΑΣ ΡΗΧΟΣ: βάρος 1,00 στον ρηχό", z.ok && z.w1 === 1 && z.w2 === 0, "w1=" + z.w1);
T("RZ-5", "  ...η τιμή είναι ΑΚΡΙΒΩΣ η μέτρηση", z.value === 18, z.value);

z = RZ(meas({ soil_moisture2: 30 }), P_OLIVE);
T("RZ-6", "ΜΟΝΟ ΒΑΘΥΣ: βάρος 1,00 στον βαθύ (δεν χάνεται ο αγρός)", z.ok && z.w2 === 1 && z.w1 === 0, "w2=" + z.w2);
T("RZ-7", "  ...η τιμή είναι ΑΚΡΙΒΩΣ η μέτρηση", z.value === 30, z.value);

z = RZ(meas({}), P_OLIVE);
T("RZ-8", "ΚΑΝΕΝΑΣ αισθητήρας: ok=false, ΟΧΙ ψεύτικο 0", z.ok === false || !Number.isFinite(z.value), "ok=" + z.ok + " v=" + z.value);

z = RZ(meas({ soil_moisture1: [{ value: null }] }), P_OLIVE);
T("RZ-9", "Νεκρό κανάλι [{value:null}] ΔΕΝ περνάει για μέτρηση 0", z.ok === false || z.value !== 0, "ok=" + z.ok + " v=" + z.value);
z = RZ(meas({ soil_moisture1: [] }), P_OLIVE);
T("RZ-10", "Κενός πίνακας [] ΔΕΝ περνάει για μέτρηση", z.ok === false || !Number.isFinite(z.value), "ok=" + z.ok);

/* ΣΥΝΩΝΥΜΑ ΟΝΟΜΑΤΩΝ — ο στόλος στέλνει με πολλά ονόματα */
for (const nm of ["soil_humidity", "water_soil", "soil_moisture", "soil_humidity1", "water_soil1"]) {
  const zz = RZ(meas({ [nm]: 22 }), P_OLIVE);
  T("RZ-syn-" + nm, "συνώνυμο ρηχού '" + nm + "' αναγνωρίζεται", zz.ok && zz.value === 22, zz.value);
}
for (const nm of ["soil_humidity2", "water_soil2", "soil_moisture2"]) {
  const zz = RZ(meas({ [nm]: 26 }), P_OLIVE);
  T("RZ-syn-" + nm, "συνώνυμο βαθέος '" + nm + "' αναγνωρίζεται", zz.ok && zz.value === 26, zz.value);
}

/* ΒΑΘΗ ΑΠΟ ΤΗ ΦΟΡΜΑ — αλλάζουν πραγματικά τα βάρη; */
const shallowFirst = RZ(meas({ soil_moisture1: 10, soil_moisture2: 40 }),
  Object.assign({}, P_OLIVE, { sensorShallow_depth_cm: 10, sensor_deep_depth_cm: 140 }));
const deepFirst = RZ(meas({ soil_moisture1: 10, soil_moisture2: 40 }),
  Object.assign({}, P_OLIVE, { sensorShallow_depth_cm: 100, sensor_deep_depth_cm: 140 }));
T("RZ-11", "Τα βάθη της φόρμας ΑΛΛΑΖΟΥΝ τα βάρη", shallowFirst.w1 !== deepFirst.w1,
  shallowFirst.w1 + " vs " + deepFirst.w1);
T("RZ-12", "Αισθητήρας ΒΑΘΥΤΕΡΑ μέσα στο ριζόστρωμα παίρνει ΜΕΓΑΛΥΤΕΡΟ βάρος",
  deepFirst.w1 > shallowFirst.w1, "10cm->" + shallowFirst.w1 + " · 100cm->" + deepFirst.w1);
T("RZ-13", "Ρίζα ελιάς 150 cm: ο ρηχός στα 10 cm κρατά 0,70 (2 από 4 τέταρτα)",
  Math.abs(shallowFirst.w1 - 0.7) < 1e-9, shallowFirst.w1);

/* ═══════════════════════════════════════════════════════════════════════
   3 · ΑΕΡΑΣ — ΤΟ ΜΟΝΤΕΛΟ ΜΟΛΥΝΣΗΣ ΔΕΝ ΣΙΩΠΑ ΠΟΤΕ
   ═══════════════════════════════════════════════════════════════════════ */
S("3 · ΜΟΝΤΕΛΟ ΜΟΛΥΝΣΗΣ — ΣΙΩΠΗ ΑΠΑΓΟΡΕΥΕΤΑΙ");
const IH = K.calculate_InfectionHours;
const findVar = (arr, v) => (Array.isArray(arr) ? arr.find((x) => x && x.variable === v) : null);

let out = IH(true, meas({}), P_OLIVE);
let st = findVar(out, "infection_model_status");
T("IH-1", "ΧΩΡΙΣ αέρα: δηλώνεται ΡΗΤΑ 'Ανενεργό', όχι σιωπή", !!st && st.value === "Ανενεργό", st && st.value);
T("IH-2", "  ...με κόκκινο χρώμα και εξήγηση τι λείπει",
  !!st && st.metadata && st.metadata.color === "red" && /θερμοκρασία αέρα/.test(st.metadata.text || ""), st && st.metadata && st.metadata.color);

out = IH(true, meas({ air_temperature: 20, air_humidity: 95 },
                    { air_temperature: 300, air_humidity: 300 }), P_OLIVE);
st = findVar(out, "infection_model_status");
T("IH-3", "ΠΑΛΙΑ μέτρηση αέρα (300΄ > 90΄): 'Σε παύση', ΟΧΙ σιωπηλή προσθήκη ωρών",
  !!st && /παύση/.test(String(st.value)), st && st.value);

out = IH(true, meas({ air_temperature: 20, air_humidity: 95 },
                    { air_temperature: 10, air_humidity: 10 }), P_OLIVE);
st = findVar(out, "infection_model_status");
T("IH-4", "ΦΡΕΣΚΙΑ μέτρηση: 'ενεργές' — δηλώνεται ΚΑΙ η επιτυχία",
  !!st && /ενεργ/.test(String(st.value)), st && st.value);

/* ═══════════════════════════════════════════════════════════════════════
   4 · ΟΡΙΑ ΗΛΙΚΙΑΣ — ΜΙΑ ΠΟΛΙΤΙΚΗ ΑΝΑ ΟΡΓΑΝΟ
   ═══════════════════════════════════════════════════════════════════════ */
S("4 · ΟΡΙΑ ΗΛΙΚΙΑΣ ΜΕΤΡΗΣΕΩΝ");
const AL = K._SAG_AGE_LIMITS;
const grp = (n) => (AL || []).find((g) => g && g.name === n);
T("AGE-1", "ομάδα «αέρας» 90΄", grp("αέρας") && grp("αέρας").limit === 90, grp("αέρας") && grp("αέρας").limit);
T("AGE-2", "ομάδα «φύλλο» 90΄", grp("φύλλο") && grp("φύλλο").limit === 90, grp("φύλλο") && grp("φύλλο").limit);
T("AGE-3", "ομάδα «έδαφος» 360΄ (6 h)", grp("έδαφος") && grp("έδαφος").limit === 360, grp("έδαφος") && grp("έδαφος").limit);
T("AGE-4", "το dew_point ελέγχεται μαζί με τον αέρα",
  grp("αέρας") && grp("αέρας").keys.indexOf("dew_point") !== -1);
T("AGE-5", "η conduct_soil ελέγχεται μαζί με το έδαφος",
  grp("έδαφος") && grp("έδαφος").keys.indexOf("conduct_soil") !== -1);
T("AGE-6", "ΚΕΝΟ: τα soil_moisture1/2 ελέγχονται, τα _avg ΟΧΙ (παράθυρο, όχι στιγμή)",
  grp("έδαφος") && grp("έδαφος").keys.indexOf("soil_moisture_avg") === -1);

/* ═══════════════════════════════════════════════════════════════════════
   5 · IPSI — Η ΑΠΟΥΣΙΑ ΜΕΤΡΗΣΗΣ ΔΕΝ ΕΙΝΑΙ ΜΕΤΡΗΣΗ ΑΠΟΥΣΙΑΣ
   ═══════════════════════════════════════════════════════════════════════ */
S("5 · IPSI — ΑΠΟΥΣΙΑ ΔΗΛΩΝΕΤΑΙ, ΔΕΝ ΥΠΟΚΑΘΙΣΤΑΤΑΙ ΣΙΩΠΗΛΑ");
const P_F = Object.assign({}, P_OLIVE, { latitude: 35.2, longitude: 25.1, area: 10, soil_type: "loam" });
function ipsiRun(vars, ages) {
  const m = meas(vars, ages);
  const v = K.calculate_VPD(true, m, P_F);
  return K.calculate_IPSI(true, m, v.vpdData, P_F, v.vpdError);
}
const V = (o, n) => { const x = (o.ipsi || []).find((y) => y && y.variable === n); return x ? x.value : undefined; };
const FULL = { air_temperature: 28, air_humidity: 45, soil_moisture1: 18, soil_moisture2: 30,
               temp_soil: 22, leaf_temperature: 29, leaf_moisture: 2 };
const AGES_OK = { air_temperature: 10, air_humidity: 10, leaf_temperature: 10, soil_moisture1: 10 };

let o = ipsiRun(FULL, AGES_OK);
T("IP-1", "ΠΛΗΡΗΣ εγκατάσταση: το IPSI υπολογίζεται", !o.ipsiError && V(o, "ipsi") !== undefined, V(o, "ipsi"));
T("IP-2", "  ...και δηλώνει ότι η κόμη ΜΕΤΡΙΕΤΑΙ", V(o, "ipsi_canopy_signal") === "sensor", V(o, "ipsi_canopy_signal"));
T("IP-3", "  ...και ότι η θερμ. εδάφους ΜΕΤΡΙΕΤΑΙ", /Μετρημ/.test(String(V(o, "soil_temp_source"))), V(o, "soil_temp_source"));

let n = Object.assign({}, FULL); delete n.air_temperature; delete n.temperature;
o = ipsiRun(n, AGES_OK);
T("IP-4", "ΧΩΡΙΣ αέρα: ΔΕΝ βγαίνει IPSI και λέγεται ΓΙΑΤΙ", !!o.ipsiError && V(o, "ipsi") === undefined, o.ipsiError);

n = Object.assign({}, FULL); delete n.soil_moisture1; delete n.soil_moisture2;
o = ipsiRun(n, AGES_OK);
T("IP-5", "ΧΩΡΙΣ υγρασία εδάφους: ΔΕΝ βγαίνει IPSI (όχι ψεύτικο 0)",
  !!o.ipsiError && /υγρασίας εδάφους/.test(o.ipsiError), (o.ipsiError || "").slice(0, 45));
T("IP-6", "  ...και το μήνυμα λέει στον τεχνικό ΤΙ να ελέγξει",
  /μπαταρία|επαφή|καλώδιο/.test(String(o.ipsiError)));

n = Object.assign({}, FULL); delete n.temp_soil;
o = ipsiRun(n, AGES_OK);
T("IP-7", "ΧΩΡΙΣ θερμ. εδάφους: το IPSI ΣΥΝΕΧΙΖΕΙ", !o.ipsiError && V(o, "ipsi") !== undefined, V(o, "ipsi"));
T("IP-8", "  ...αλλά δηλώνεται ΡΗΤΑ «Δεν μετριέται» (καμία σιωπηλή χρήση του αέρα)",
  /Δεν μετριέται/.test(String(V(o, "soil_temp_source"))), V(o, "soil_temp_source"));
T("IP-9", "  ...και η T_soil ΔΕΝ έγινε ίση με τη θερμοκρασία αέρα",
  V(o, "ipsi_T_soil") === null || V(o, "ipsi_T_soil") === undefined || Number(V(o, "ipsi_T_soil")) !== 28,
  V(o, "ipsi_T_soil"));

n = Object.assign({}, FULL); delete n.leaf_temperature; delete n.leaf_moisture;
o = ipsiRun(n, { air_temperature: 10, air_humidity: 10, soil_moisture1: 10 });
T("IP-10", "ΧΩΡΙΣ φύλλο: το IPSI ΣΥΝΕΧΙΖΕΙ με αναφορά τον αέρα", !o.ipsiError, o.ipsiError || "—");
T("IP-11", "  ...και δηλώνεται 'absent' — ο αγρότης ξέρει τι λείπει",
  V(o, "ipsi_canopy_signal") === "absent", V(o, "ipsi_canopy_signal"));

o = ipsiRun(Object.assign({}, FULL, { leaf_temperature: 29 }),
            Object.assign({}, AGES_OK, { leaf_temperature: 300 }));
T("IP-12", "ΠΑΓΩΜΕΝΟ φύλλο (300΄ > 90΄): αντιμετωπίζεται ως 'stale'",
  V(o, "ipsi_canopy_signal") === "stale", V(o, "ipsi_canopy_signal"));

o = ipsiRun(Object.assign({}, FULL, { leaf_temperature: 40, air_temperature: 28 }), AGES_OK);
T("IP-13", "ΦΥΛΛΟ ΣΤΟΝ ΗΛΙΟ (dT = +12 > 5): αντιμετωπίζεται ως 'unshaded'",
  V(o, "ipsi_canopy_signal") === "unshaded", V(o, "ipsi_canopy_signal"));
T("IP-14", "  ...και ΔΕΝ κηρύσσει ψεύτικη θερμική καταπόνηση από το dT",
  Number(V(o, "ipsi_T_diff")) === 0 || V(o, "ipsi_T_diff") === null || V(o, "ipsi_T_diff") === undefined,
  V(o, "ipsi_T_diff"));

/* ═══════════════════════════════════════════════════════════════════════
   6 · ET0 — PENMAN-MONTEITH ΜΕ ΕΦΕΔΡΕΙΑ HARGREAVES
   ═══════════════════════════════════════════════════════════════════════ */
S("6 · ET0 — ΕΦΕΔΡΕΙΑ ΟΤΑΝ ΛΕΙΠΕΙ ΑΝΕΜΟΣ Η ΑΚΤΙΝΟΒΟΛΙΑ");
const PM = K.calculate_ET0_PM, HG = K.calculate_ET0_Hargreaves;
const DOY = 255, LAT = 35.2;
const pmFull = PM(25, 32, 18, 50, 2.0, 22.0, DOY, LAT, 100);
T("ET0-1", "PM με πλήρη δεδομένα δίνει αριθμό", Number.isFinite(pmFull) && pmFull > 0, pmFull && pmFull.toFixed(2));
T("ET0-2", "ΧΩΡΙΣ άνεμο: PM επιστρέφει null (ΔΕΝ εφευρίσκει τιμή)",
  PM(25, 32, 18, 50, NaN, 22.0, DOY, LAT, 100) === null);
T("ET0-3", "ΧΩΡΙΣ υγρασία: PM επιστρέφει null", PM(25, 32, 18, NaN, 2.0, 22.0, DOY, LAT, 100) === null);
const pmNoRs = PM(25, 32, 18, 50, 2.0, NaN, DOY, LAT, 100);
T("ET0-4", "ΧΩΡΙΣ ακτινοβολία: PM ΔΟΥΛΕΥΕΙ με την εκτίμηση 0,16·sqrt(ΔT)·Ra (FAO-56 Εξ. 50)",
  Number.isFinite(pmNoRs) && pmNoRs > 0, pmNoRs && pmNoRs.toFixed(2));
const hg = HG(25, 32, 18, DOY, LAT);
T("ET0-5", "Hargreaves δουλεύει ΜΟΝΟ με θερμοκρασίες", Number.isFinite(hg) && hg > 0, hg && hg.toFixed(2));
T("ET0-6", "PM και Hargreaves συμφωνούν εντός 35 % (τεκμηριωμένο εύρος ±25 %)",
  Math.abs(pmFull - hg) / hg < 0.35, "PM=" + pmFull.toFixed(2) + " HG=" + hg.toFixed(2));
T("ET0-7", "Hargreaves χωρίς θερμοκρασίες -> δεν παράγει αριθμό",
  !Number.isFinite(HG(NaN, NaN, NaN, DOY, LAT)) || HG(NaN, NaN, NaN, DOY, LAT) === null);
const pmCold = PM(5, 8, 2, 80, 1.0, 5.0, 15, LAT, 100);
T("ET0-8", "Χειμώνας: ET0 μικρή αλλά ΘΕΤΙΚΗ (όχι αρνητική)", Number.isFinite(pmCold) && pmCold >= 0, pmCold && pmCold.toFixed(2));

/* ═══════════════════════════════════════════════════════════════════════
   7 · 24ΩΡΟΣ ΜΕΣΟΣ ΡΙΖΟΣΤΡΩΜΑΤΟΣ — Η ΑΠΟΥΣΙΑ ΔΕΝ ΥΠΟΒΑΘΜΙΖΕΙ
   ═══════════════════════════════════════════════════════════════════════ */
S("7 · 24ΩΡΟΣ ΜΕΣΟΣ (T-DRAIN-TRANSIENT-01)");
const RZ24 = K._sagRootZone24h;
T("R24-1", "ΧΩΡΙΣ κανάλια _avg: null (όχι ψεύτικο 0)", RZ24(meas({ soil_moisture1: 20 }), P_OLIVE) === null,
  String(RZ24(meas({ soil_moisture1: 20 }), P_OLIVE)));
T("R24-2", "ΜΕ _avg ενός βάθους: επιστρέφει τη μέτρηση",
  RZ24(meas({ soil_moisture1_avg: 21 }), P_OLIVE) === 21, RZ24(meas({ soil_moisture1_avg: 21 }), P_OLIVE));
const r24 = RZ24(meas({ soil_moisture1_avg: 18, soil_moisture2_avg: 30 }), P_OLIVE);
T("R24-3", "ΜΕ δύο _avg: ίδια στάθμιση με τη στιγμιαία (0,4/0,6)",
  Math.abs(r24 - (18 * 0.4 + 30 * 0.6)) < 1e-9, r24);
T("R24-4", "ΜΟΝΟ βαθύ _avg: δεν χάνεται ο αγρός",
  RZ24(meas({ soil_moisture2_avg: 30 }), P_OLIVE) === 30, RZ24(meas({ soil_moisture2_avg: 30 }), P_OLIVE));

/* ═══ 8 · ΑΡΔΕΥΣΗ — ΟΙ ΦΡΟΥΡΟΙ ΡΥΘΜΙΣΗΣ ═══ */
S("8 · ΑΡΔΕΥΣΗ — ΦΡΟΥΡΟΙ ΡΥΘΜΙΣΗΣ (ΕΚΕΙ ΒΓΑΙΝΟΥΝ ΤΑ ΛΙΤΡΑ)");
const P_IRR = { cultivation_type_general: "olive", cultivation_type: "koroneiki", stage: "fruit_dev",
  name: "ΔΟΚΙΜΗ", latitude: 35.2, longitude: 25.1, area: 4000, soil_type: "loam",
  water_quality: "good", irrigation_system: "dripIrrigation", planting_density: 25 };
const M_DRY = { air_temperature: 30, air_humidity: 35, air_temperature_max: 34, air_temperature_min: 20,
  soil_moisture1: 12, soil_moisture2: 16, temp_soil: 24, wind_speed_kmh: 7, light_intensity: 40000 };
const AGES_IRR = { air_temperature: 10, air_humidity: 10, soil_moisture1: 10 };

function irr(vars, params, ipsiOverride) {
  const m = meas(vars, AGES_IRR);
  const p = Object.assign({}, P_IRR, params || {});
  const v = K.calculate_VPD(true, m, p);
  const ip = K.calculate_IPSI(true, m, v.vpdData, p, v.vpdError);
  const use = ipsiOverride !== undefined ? ipsiOverride : ip.ipsi;
  return { out: K.calculate_IrrigationVolume(true, m, use, p) || [], ipsi: ip };
}
const IV = (o, n) => { const x = (o || []).find((y) => y && y.variable === n); return x ? x.value : undefined; };
const IMD = (o, n) => { const x = (o || []).find((y) => y && y.variable === n); return x && x.metadata ? x.metadata : {}; };

let q = irr(M_DRY, {});
T("IR-1", "ΠΛΗΡΗΣ ρύθμιση + ξηρό έδαφος: βγαίνουν λίτρα",
  Number(IV(q.out, "grossIrrigationLiters")) > 0, IV(q.out, "grossIrrigationLiters"));
T("IR-2", "  ...και διάρκεια ωρών",
  Number(IV(q.out, "irrigationDurationHours")) > 0, IV(q.out, "irrigationDurationHours"));
T("IR-3", "  ...χωρίς σφάλμα ρύθμισης",
  IV(q.out, "irrigation_config_error") === undefined || IV(q.out, "irrigation_config_error") === null,
  IV(q.out, "irrigation_config_error"));

q = irr(M_DRY, { area: null });
T("IR-4", "ΧΩΡΙΣ έκταση: ΔΕΝ υπολογίζει, το λέει ρητά",
  /Δεν έχει δηλωθεί έκταση/.test(String(IV(q.out, "irrigation_config_error"))),
  IV(q.out, "irrigation_config_error"));
T("IR-5", "  ...και τα λίτρα ΔΕΝ είναι αριθμός (όχι ψεύτικο 0)",
  IV(q.out, "grossIrrigationLiters") === null || IV(q.out, "grossIrrigationLiters") === undefined,
  IV(q.out, "grossIrrigationLiters"));

q = irr(M_DRY, { area: 40 });
T("IR-6", "ΥΠΟΠΤΑ ΜΙΚΡΗ έκταση 40 m²: προειδοποίηση για το 10.000 vs 10000",
  /Ύποπτα μικρή έκταση/.test(String(IV(q.out, "irrigation_config_error"))),
  IV(q.out, "irrigation_config_error"));
T("IR-7", "  ...αλλά ΔΕΝ μπλοκάρει τον υπολογισμό",
  Number(IV(q.out, "grossIrrigationLiters")) > 0, IV(q.out, "grossIrrigationLiters"));

q = irr(M_DRY, { irrigation_system: "drip" });
T("IR-8", "ΛΑΘΟΣ σύστημα άρδευσης: ονομάζεται η λάθος τιμή",
  /drip/.test(String(IV(q.out, "irrigation_config_error"))), IV(q.out, "irrigation_config_error"));
q = irr(M_DRY, { irrigation_system: "" });
T("IR-9", "ΚΕΝΟ σύστημα: «Δεν έχει δηλωθεί» — ΑΛΛΟ μήνυμα",
  /Δεν έχει δηλωθεί σύστημα/.test(String(IV(q.out, "irrigation_config_error"))),
  IV(q.out, "irrigation_config_error"));

q = irr(M_DRY, { water_quality: "kalo" });
T("IR-10", "ΛΑΘΟΣ ποιότητα νερού: μπλοκάρει και εξηγεί",
  /νερού/.test(String(IV(q.out, "irrigation_config_error"))), IV(q.out, "irrigation_config_error"));

/* Η λάθος υφή εδάφους ΔΕΝ μπλοκάρει την άρδευση — δηλώνεται αλλού (§12). */
q = irr(M_DRY, { soil_type: "agnosto" });
T("IR-11", "ΛΑΘΟΣ υφή εδάφους: η άρδευση ΣΥΝΕΧΙΖΕΙ (δεν μένει απότιστος ο αγρός)",
  Number(IV(q.out, "grossIrrigationLiters")) > 0, IV(q.out, "grossIrrigationLiters"));

/* ═══ 9 · ΤΟ ΦΥΣΙΟΛΟΓΙΚΟ ΒΕΤΟ ═══ */
S("9 · ΦΥΣΙΟΛΟΓΙΚΟ ΒΕΤΟ — ΤΟ ΤΑΜΠΛΟ ΔΕΝ ΑΥΤΟΑΝΑΙΡΕΙΤΑΙ");
q = irr(M_DRY, {}, [{ variable: "ipsi_stress_type", value: "COLD_PHYSIOLOGICAL_DROUGHT" }]);
T("VT-1", "ΚΡΥΟ ΕΔΑΦΟΣ: λίτρα ΑΚΡΙΒΩΣ 0 παρότι το έδαφος είναι ξηρό",
  Number(IV(q.out, "grossIrrigationLiters")) === 0, IV(q.out, "grossIrrigationLiters"));
T("VT-2", "  ...και διάρκεια 0",
  Number(IV(q.out, "irrigationDurationHours")) === 0, IV(q.out, "irrigationDurationHours"));
const msgCold = String(IV(q.out, "irrigation_message") || "");
T("VT-3", "  ...με μήνυμα στον παραγωγό, όχι σιωπή", msgCold.length > 0, msgCold);
q = irr(M_DRY, {}, [{ variable: "ipsi_stress_type", value: "WATERLOGGING" }]);
const msgWlog = String(IV(q.out, "irrigation_message") || "");
T("VT-4", "ΥΠΕΡΚΟΡΕΣΜΟΣ: λίτρα ΑΚΡΙΒΩΣ 0",
  Number(IV(q.out, "grossIrrigationLiters")) === 0, IV(q.out, "grossIrrigationLiters"));
T("VT-5", "  ...με ΔΙΑΦΟΡΕΤΙΚΟ μήνυμα από του κρύου",
  msgWlog.length > 0 && msgWlog !== msgCold, msgWlog);
q = irr(M_DRY, {}, [{ variable: "ipsi_stress_type", value: "HEAT_STRESS" }]);
T("VT-6", "ΘΕΡΜΙΚΗ καταπόνηση ΔΕΝ μπλοκάρει (σωστό: το νερό βοηθά)",
  Number(IV(q.out, "grossIrrigationLiters")) > 0, IV(q.out, "grossIrrigationLiters"));

/* ═══ 10 · GDD ═══ */
S("10 · GDD — Ο ΣΥΣΣΩΡΕΥΤΗΣ ΦΑΙΝΟΛΟΓΙΑΣ");
const gvars = { air_temperature: 24, air_temperature_max: 30, air_temperature_min: 16, air_humidity: 45 };
let g = K.calculate_GDD(true, false, meas(gvars, { air_temperature: 10 }), P_IRR) || [];
T("GD-1", "ΦΡΕΣΚΙΑ θερμοκρασία: το GDD τρέχει",
  Array.isArray(g) && g.length > 0, g.length + " μεταβλητές");
const g2 = K.calculate_GDD(true, false, meas(gvars, { air_temperature: 400 }), P_IRR) || [];
const st1 = (g.find((x) => x && /status/.test(x.variable)) || {}).value;
const st2 = (g2.find((x) => x && /status/.test(x.variable)) || {}).value;
T("GD-2", "ΠΑΛΙΑ θερμοκρασία (400΄): η κατάσταση το δηλώνει",
  String(st1) !== String(st2) || /εκτίμ/.test(String(st2)), String(st1) + " -> " + String(st2));
const g3 = K.calculate_GDD(true, false, meas({ air_humidity: 45 }, {}), P_IRR) || [];
T("GD-3", "ΧΩΡΙΣ θερμοκρασία: καμία ψεύτικη βαθμοημέρα",
  !g3.some((x) => x && /gdd_crop_hourly|gdd_crop_accumulated/.test(x.variable) && Number(x.value) > 0),
  g3.map((x) => x.variable).join(",").slice(0, 70));

/* ═══ 11 · ΕΓΚΑΤΑΣΤΑΣΕΙΣ ΧΩΡΙΣ ΚΑΛΛΙΕΡΓΕΙΑ ═══ */
S("11 · ΖΩΝΗ ΞΕΝΟΔΟΧΕΙΟΥ / ΣΤΑΘΜΟΣ / ΜΙΑ ΒΑΝΑ");
const P_BARE = { name: "ΖΩΝΗ", latitude: 35.2, longitude: 25.1, area: 300 };
const mBare = meas(M_DRY, AGES_IRR);
const vBare = K.calculate_VPD(true, mBare, P_BARE);
const ipBare = K.calculate_IPSI(true, mBare, vBare.vpdData, P_BARE, vBare.vpdError);
const outBare = K.calculate_IrrigationVolume(true, mBare, ipBare.ipsi, P_BARE) || [];
T("BR-1", "ΖΩΝΗ χωρίς καλλιέργεια: καμία δόση στα τυφλά",
  !(Number(IV(outBare, "grossIrrigationLiters")) > 0), IV(outBare, "grossIrrigationLiters"));
T("BR-2", "  ...και δηλώνει ΓΙΑΤΙ",
  typeof IV(outBare, "irrigation_config_error") === "string", IV(outBare, "irrigation_config_error"));
T("BR-3", "  ...το IPSI επίσης αρνείται και εξηγεί",
  !!ipBare.ipsiError, (ipBare.ipsiError || "—").slice(0, 55));
const ihB = K.calculate_InfectionHours(true, meas({ air_temperature: 20, air_humidity: 95 },
  { air_temperature: 10, air_humidity: 10 }), P_BARE) || [];
T("BR-4", "ΣΤΑΘΜΟΣ χωρίς καλλιέργεια: καμία εφεύρεση παθογόνου",
  !ihB.some((x) => x && /^fir_/.test(String(x.variable))), ihB.map((x) => x.variable).join(",").slice(0, 65));

/* ═══ 12 · ΥΦΗ ΕΔΑΦΟΥΣ — Η ΕΦΕΔΡΕΙΑ ΔΗΛΩΝΕΤΑΙ ═══ */
S("12 · ΥΦΗ ΕΔΑΦΟΥΣ — Η ΠΡΟΕΛΕΥΣΗ ΔΗΛΩΝΕΤΑΙ ΣΤΟΝ ΠΑΡΑΓΩΓΟ");
const CSL = K.computeSoilMoistureLimits, BSL = K.buildSoilMoistureLimitIndicators;
const SV = (arr, n) => { const x = (arr || []).find((y) => y && y.variable === n); return x || {}; };

let lim = CSL(Object.assign({}, P_IRR, { soil_type: "loam" }), null, meas(M_DRY, AGES_IRR));
let ind = BSL(lim) || [];
T("SL-1", "ΑΝΑΓΝΩΡΙΣΙΜΗ υφή: τα όρια βγαίνουν από το SOIL_PROFILE",
  lim && lim.ok === true, "source=" + (lim && lim.source));
T("SL-2", "  ...και ο παραγωγός βλέπει το ελληνικό όνομα του εδάφους",
  /^Έδαφος:/.test(String(SV(ind, "soil_profile_status").value)),
  SV(ind, "soil_profile_status").value);
T("SL-3", "  ...με πράσινο χρώμα",
  (SV(ind, "soil_profile_status").metadata || {}).color === "green",
  (SV(ind, "soil_profile_status").metadata || {}).color);

lim = CSL(Object.assign({}, P_IRR, { soil_type: "agnosto" }), null, meas(M_DRY, AGES_IRR));
ind = BSL(lim) || [];
const sps = SV(ind, "soil_profile_status");
T("SL-4", "ΑΓΝΩΣΤΗ υφή: ΔΗΛΩΝΕΤΑΙ «Άγνωστος τύπος εδάφους» — ΟΧΙ σιωπή",
  /Άγνωστος τύπος/.test(String(sps.value)), sps.value);
T("SL-5", "  ...με ΠΟΡΤΟΚΑΛΙ χρώμα (προειδοποίηση)",
  (sps.metadata || {}).color === "orange", (sps.metadata || {}).color);
T("SL-6", "  ...το κείμενο λέει οτι τρέχει με ΜΕΣΟ ΠΗΛΩΔΕΣ",
  /ΠΗΛΩΔΕΣ/.test(String((sps.metadata || {}).text || "")));
T("SL-7", "  ...και ότι σε αμμώδες/αργιλώδες η ανάγκη διαφέρει",
  /αμμώδες/.test(String((sps.metadata || {}).text || ""))
  && /αργιλώδες/.test(String((sps.metadata || {}).text || "")));
/* ΕΥΡΗΜΑ Κ4 — ΚΛΕΙΔΩΜΕΝΗ ΤΡΕΧΟΥΣΑ ΣΥΜΠΕΡΙΦΟΡΑ.
   Το σχόλιο στον πυρήνα (γρ. 11264-11267) λέει ρητά: «στο ΑΓΝΩΣΤΟ δείχνουμε
   ό,τι έγραψε ο ίδιος στη φόρμα, γιατί ακριβώς αυτό πρέπει να διορθώσει».
   Η υλοποίηση δεν το κάνει: το `limits.soil_key` είναι `null` ΑΚΡΙΒΩΣ στην άγνωστη
   περίπτωση (το `_sagSoilKeyOf` επιστρέφει null), οπότε το «(«…»)» δεν γράφεται ποτέ.
   Ο έλεγχος κλειδώνει το ΣΗΜΕΡΑ: όταν διορθωθεί, ΑΥΤΟΣ Ο ΙΣΧΥΡΙΣΜΟΣ ΘΑ ΣΠΑΣΕΙ
   και θα αναγκάσει ενημέρωση του ελέγχου μαζί με τον κώδικα. */
T("SL-8", "ΕΥΡΗΜΑ Κ4: ΔΕΝ ονομάζει την τιμή που έγραψε ο χρήστης (αντίθετα με το σχόλιο)",
  !/agnosto/.test(String((sps.metadata || {}).text || "")), "soil_key=" + JSON.stringify(lim && lim.soil_key));
T("SL-8b", "  ...ενώ ο αντίστοιχος φρουρός του συστήματος άρδευσης ΤΗΝ ΟΝΟΜΑΖΕΙ",
  /drip/.test(String(IV(irr(M_DRY, { irrigation_system: "drip" }).out, "irrigation_config_error"))));
T("SL-8c", "  ...και σωστή ελληνική υφή «ΠΗΛΩΔΕΣ» θεωρείται επίσης αγνώστη",
  String((K.buildSoilMoistureLimitIndicators(
    K.computeSoilMoistureLimits(Object.assign({}, P_IRR, { soil_type: "ΠΗΛΩΔΕΣ" }), null, meas(M_DRY, AGES_IRR))
  ) || []).find((x) => x && x.variable === "soil_profile_status").value) === "Άγνωστος τύπος εδάφους");

/* Η υφή ΕΧΕΙ συνέπεια στη δόση — αλλιώς η εφεδρεία δεν θα είχε σημασία */
const dose = {};
for (const st of ["sand", "loam", "clay", "agnosto"]) dose[st] = Number(IV(irr(M_DRY, { soil_type: st }).out, "grossIrrigationLiters"));
T("SL-9", "Η υφή ΑΛΛΑΖΕΙ τη δόση (αμμώδες ≠ αργιλώδες)",
  Number.isFinite(dose.sand) && Number.isFinite(dose.clay) && dose.sand !== dose.clay,
  "sand=" + dose.sand + " clay=" + dose.clay);
T("SL-10", "Η ΑΓΝΩΣΤΗ υφή πέφτει ακριβώς στο πηλώδες (loam)",
  dose.agnosto === dose.loam, "agnosto=" + dose.agnosto + " loam=" + dose.loam);

/* ═══════════════════════════════════════════════════════════════════════
   ΕΚΤΥΠΩΣΗ
   ═══════════════════════════════════════════════════════════════════════ */
const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); };
for (const [id, mark, what, got] of rows) {
  if (!id && !mark) { console.log("\n" + what); continue; }
  console.log(" " + pad(mark, 3) + pad(id, 14) + pad(what, 68) + got);
}
console.log("\n════════════════════════════════════════");
console.log("ΣΥΝΟΛΟ: " + ok + " OK · " + bad + " X");
process.exit(bad === 0 ? 0 : 2);
