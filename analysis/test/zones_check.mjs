// Ελεγκτής T-ZONES-01 (3/11/2026): ζώνες άρδευσης μέσα στον αγρό (φάση 1, χωρίς βάνες) — πυρήνας v50.170, sync v18,
// φόρμα v29, widget W-ZONES-01. Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα και τρέχει τον ΠΡΑΓΜΑΤΙΚΟ calculate_IrrigationVolume:
// ζώνη με τους ίδιους αισθητήρες και τα ίδια m² με την καλλιέργεια ⇒ ΤΑ ΙΔΙΑ λίτρα (ταυτότητα). Εκτελεί τον πραγματικό κώδικα
// sync/φόρμας/widget με ψεύτικα περιβάλλοντα. Μεταλλάξεις σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, "..", "..");
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE0 = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const SYNC0 = fs.readFileSync(path.join(here, "..", "setFieldParametersFromDeviceData.js"), "utf8").replace(/\r\n/g, "\n");
const FORM0 = fs.readFileSync(path.join(root, "custom_html_files", "configuration.html"), "utf8").replace(/\r\n/g, "\n");
const WID0 = fs.readFileSync(path.join(root, "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const req = createRequire(KPATH);
function load(core) {
  const shim = (m) => { if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null } }; } return req(m); };
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", core
    + "\n;return { calculate_IrrigationVolume, _sagZonesParse, _sagZoneMeas, _sagZonesForCrop, _sagZonesShared, _sagZonesSend, getFieldParameters, SAG_KERNEL_VERSION,"
    + " _setDev: (d) => { _SAG_SOIL_DEV_LAST = d; }, _reset: () => { _SAG_ZONES_ACC = null; }, _acc: () => _SAG_ZONES_ACC, _card: (c) => { _SAG_METHOD_CARD = c; } };")(
    shim, { exports: {} }, {}, { env: {}, on() {}, exit() {} }, quiet, path.dirname(KPATH), KPATH);
}
function cut(src, a, b, label, inclB = false) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const J = (x) => JSON.stringify(x);
const T = "2026-11-03T10:00:00Z";
const A = (v) => [{ value: v, time: T }];
const M = (o) => { const d = {}; for (const [k, v] of Object.entries(o)) d[k] = A(v); return { data: d }; };
const IDA = "a".repeat(24), IDB = "b".repeat(24), IDC = "c".repeat(24);
const P0 = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "full_canopy", area: 1000, soil_type: "loam",
  irrigation_system: "dripIrrigation", latitude_deg: 35, water_quality: "good" };
const WX = { air_temperature_max: 28, air_temperature_min: 15, air_temperature_avg: 21, air_humidity_avg: 60, rain_height_daily: 0 };
const L = (out) => { const g = (out || []).find((x) => x.variable === "grossIrrigationLiters"); return g ? g.value : undefined; };
function run(core, sync, form, wid) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core);
    ok(K.SAG_KERNEL_VERSION === "v50.192 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    // ── Α: ανάγνωση ──
    const zp = K._sagZonesParse(J([{ n: " Γκαζόν Β ", s: [IDA, IDB + ":2", "κακό"], c: [["c1", 500], ["c2"]] }, { n: "", c: [["c1"]] }, { n: "Χωρίς καλλιέργεια", s: [IDA], c: [] }, null]));
    ok(J(zp) === J([{ n: "Γκαζόν Β", s: [IDA, IDB + ":2"], c: [{ id: "c1", a: 500 }, { id: "c2", a: NaN }] }]), "Α1 καθαρισμός ζωνών (" + J(zp) + ")");
    ok(J(K._sagZonesParse("όχι json")) === "[]" && J(K._sagZonesParse(undefined)) === "[]" && J(K._sagZonesParse("{}")) === "[]", "Α2 άκυρο tag → καμία ζώνη");
    const fp = K.getFieldParameters({ tags: [{ key: "name", value: "Δ" }, { key: "configuration", value: J({ crops: [] }) },
      { key: "irrigation_zones", value: J([{ n: "Ζ1", s: [IDA], c: [["c1", 100]] }]) }] });
    ok(fp && fp.irrigation_zones.length === 1 && fp.irrigation_zones[0].n === "Ζ1", "Α3 getFieldParameters διαβάζει το tag irrigation_zones");
    const fp0 = K.getFieldParameters({ tags: [{ key: "name", value: "Δ" }, { key: "configuration", value: J({ crops: [] }) }] });
    ok(fp0 && J(fp0.irrigation_zones) === "[]", "Α4 χωρίς tag: κενή λίστα");
    // ── Μ: μετρήσεις ζώνης ──
    const DEVS = { "SE0X-A": { _id: IDA, soil_moisture1: A(12), soil_temperature1: A(18) }, "SE0X-A · θύρα 2": { _id: IDA + ":2", soil_moisture1: A(30) },
      "LSE01-C": { _id: IDC, soil_moisture1: A([])[0] ? A(20) : A(20) } };
    K._setDev(DEVS);
    const mf = M(Object.assign({ soil_moisture1: 21, soil_temperature1: 17, conduct_soil1: 300 }, WX));
    const z1 = K._sagZoneMeas(mf, { s: [IDA] });
    ok(z1.own && z1.meas.data.soil_moisture1[0].value === 12 && z1.meas.data.soil_temperature1[0].value === 18 && !z1.meas.data.conduct_soil1 && z1.meas.data.air_temperature_max, "Μ1 ζώνη ενός αισθητήρα: δικό της έδαφος, καιρός του αγρού");
    ok(mf.data.soil_moisture1[0].value === 21, "Μ2 οι μετρήσεις του αγρού ΔΕΝ αλλάζουν");
    const z2 = K._sagZoneMeas(mf, { s: [IDA, IDA + ":2"] });
    ok(z2.own && z2.meas.data.soil_moisture1[0].value === 21 && z2.n === 2, "Μ3 δύο σημεία: μέσος όρος 21");
    const z3 = K._sagZoneMeas(mf, { s: [] });
    ok(!z3.own && z3.meas === mf, "Μ4 χωρίς αισθητήρα: οι μετρήσεις του αγρού");
    const z4 = K._sagZoneMeas(mf, { s: [IDB] });
    ok(!z4.own && z4.meas === mf, "Μ5 αισθητήρας χωρίς μέτρηση: οι μετρήσεις του αγρού");
    // ── Λ: λίτρα ανά ζώνη (πραγματικός υπολογισμός) ──
    const mfC = M(Object.assign({ soil_moisture1: 12 }, WX));
    const base = L(K.calculate_IrrigationVolume(true, mfC, [], P0));
    ok(Number.isFinite(base) && base > 0, "Λ0 ο υπολογισμός βγάζει λίτρα (" + base + ")");
    K._setDev({ "S": { _id: IDA, soil_moisture1: A(12) } });
    const crop = { id: "c1" };
    const FC = (zones) => ({ irrigation_zones: K._sagZonesParse(J(zones)) });
    K._reset(); K._sagZonesForCrop(FC([{ n: "Ίδια", s: [IDA], c: [["c1", 1000]] }]), crop, P0, mfC, [], true);
    let acc = K._acc();
    ok(acc && acc[0].cr[0].L === Math.round(base) && acc[0].own === true && acc[0].m === 12, "Λ1 ΤΑΥΤΟΤΗΤΑ: ίδιος αισθητήρας + ίδια m² = ίδια λίτρα (" + J(acc && acc[0]) + " vs " + base + ")");
    K._reset(); K._sagZonesForCrop(FC([{ n: "Μισή", s: [IDA], c: [["c1", 500]] }]), crop, P0, mfC, [], true);
    acc = K._acc();
    ok(Math.abs(acc[0].cr[0].L - Math.round(base / 2)) <= 2, "Λ2 μισά m² → μισά λίτρα (" + acc[0].cr[0].L + ")");
    K._setDev({ "S": { _id: IDA, soil_moisture1: A(30) } });
    K._reset(); K._sagZonesForCrop(FC([{ n: "Υγρή", s: [IDA], c: [["c1", 1000]] }]), crop, P0, mfC, [], true);
    acc = K._acc();
    ok(acc[0].m === 30 && !(acc[0].cr[0].L > base), "Λ3 υγρότερη ζώνη: όχι περισσότερα λίτρα (" + acc[0].cr[0].L + ")");
    K._reset(); K._sagZonesForCrop(FC([{ n: "Α", s: [], c: [["c1"]] }]), crop, P0, mfC, [], true);
    acc = K._acc();
    ok(acc[0].own === false && acc[0].cr[0].a === 1000 && acc[0].cr[0].L === Math.round(base), "Λ4 καλλιέργεια σε ΜΙΑ ζώνη χωρίς m²: τα m² της καλλιέργειας, μέσος του αγρού");
    K._reset();
    const two = FC([{ n: "Α", s: [], c: [["c1"]] }, { n: "Β", s: [], c: [["c1", 400]] }]);
    K._sagZonesForCrop(two, crop, P0, mfC, [], true);
    acc = K._acc();
    ok(acc[0].cr[0].L === null && /Δηλώστε τα m²/.test(acc[0].cr[0].t) && acc[1].cr[0].a === 400 && acc[1].cr[0].L > 0, "Λ5 καλλιέργεια σε 2 ζώνες: χωρίς m² ΚΑΝΕΝΑ λίτρο, με m² κανονικά");
    K._reset(); K._sagZonesForCrop(FC([{ n: "Α", s: [], c: [["c1", 1000]] }]), crop, P0, mfC, [], false);
    ok(K._acc() === null, "Λ6 μόνο στον ωριαίο κύκλο");
    K._reset(); K._sagZonesForCrop({ irrigation_zones: [] }, crop, P0, mfC, [], true);
    ok(K._acc() === null && K._sagZonesShared({ irrigation_zones: [] }, T) === null, "Λ7 χωρίς ζώνες: τίποτα");
    K._reset(); K._sagZonesForCrop(FC([{ n: "Α", s: [], c: [["άλλη", 100]] }]), crop, P0, mfC, [], true);
    acc = K._acc(); ok(acc && acc[0].cr.length === 0, "Λ8 ζώνη άλλης καλλιέργειας: καμία γραμμή για αυτήν");
    // ── Σ: αποτέλεσμα + εγγραφή ──
    K._reset();
    const FZ = FC([{ n: "Α", s: [], c: [["c1", 300], ["c2", 200]] }]);
    K._sagZonesForCrop(FZ, { id: "c1" }, P0, mfC, [], true);
    K._sagZonesForCrop(FZ, { id: "c2" }, P0, mfC, [], true);
    const sh = K._sagZonesShared(FZ, T), zz = sh.irrigation_zones.metadata.z[0];
    ok(zz.cr.length === 2 && zz.L === zz.cr[0].L + zz.cr[1].L && sh.irrigation_zones.metadata.t === T, "Σ1 ζώνη δύο καλλιεργειών: άθροισμα λίτρων (" + J(zz) + ")");
    const sent = []; const dev = { sendData: async (x) => { sent.push(x); } };
    K._card({ n: 3, t: "κάρτα μεθόδου" });
    await_(K._sagZonesSend(dev, FZ, "Αγρός", false));
    ok(sent.length === 1 && sent[0][0].variable === "field_bundle_2" && sent[0][0].metadata.shared.irrigation_zones && sent[0][0].metadata.shared.field_method_card.metadata.text === "κάρτα μεθόδου",
      "Σ2 ωριαία εγγραφή field_bundle_2 με ζώνες ΚΑΙ κάρτα μεθόδου");
    sent.length = 0; await_(K._sagZonesSend(dev, FZ, "Αγρός", true));
    ok(sent.length === 0, "Σ3 στον ημερήσιο κύκλο την εγγραφή την κάνει η ημερήσια αναφορά");
    sent.length = 0; K._reset(); await_(K._sagZonesSend(dev, FZ, "Αγρός", false));
    ok(sent.length === 0, "Σ4 χωρίς αποτελέσματα: καμία εγγραφή");
    // ── Κ: στατικά πυρήνα ──
    ok(core.includes("  configuration.irrigation_zones = _sagZonesParse((field.tags.filter(item => item.key === 'irrigation_zones')[0] || {}).value);"), "Κ1 ανάγνωση στο getFieldParameters");
    ok(core.includes("    delete data._sagSoilDev;\n    _SAG_SOIL_DEV_LAST = devs;"), "Κ2 οι τιμές ανά συσκευή κρατιούνται");
    ok(core.includes("...(irrigationVolume ?? [])];\n          // T-ZONES-01: η ίδια άρδευση ανά ζώνη (η σύσταση της καλλιέργειας παραπάνω ΔΕΝ αλλάζει).\n          try { _sagZonesForCrop(fieldConfig, crop, cropParams, measurementsForCrop, ipsi, hourTich); }"), "Κ3 κλήση ΜΕΤΑ την άρδευση της καλλιέργειας");
    const sd = core.indexOf("await dev_to_send_meas.sendData(packedIndicators);"), zs = core.indexOf("await _sagZonesSend(dev_to_send_meas, fieldConfig, fieldName, dailyTich)");
    ok(sd > 0 && zs > sd && zs - sd < 900, "Κ4 εγγραφή ζωνών ΜΕΤΑ το bundle");
    ok(core.includes("_sagZonesShared(fieldConfig, new Date().toISOString()) || {}) } });   // T-ZONES-01: και οι ζώνες"), "Κ5 η ημερήσια εγγραφή κρατά τις ζώνες");
    ok(core.includes("      _SAG_SOIL_DEV_LAST = null; _SAG_ZONES_ACC = null;   // T-ZONES-01"), "Κ6 μηδενισμός ανά αγρό");
    ok(core.includes(".sort().map(n => ({ i: String(_D[n]._id), n, c: _cn.has(n) ? 1 : 0 }));"), "Κ7 λίστα σονδών: όλες, με σημάδι c");
    // ── Υ: sync ──
    const cz = new Function(cut(sync, "function compactZones(list) {", "function stripCropExtras(crops) {", "compactZones") + "\nreturn compactZones;")();
    ok(J(cz([{ n: " Ζ ", s: [IDA, "x", IDB + ":2"], c: [["c1", "250.55"], ["c2", 0], [""], 5] }, { n: "", c: [["c1"]] }, { n: "Κενή", c: [] }]))
      === J([{ n: "Ζ", s: [IDA, IDB + ":2"], c: [["c1", 250.6], ["c2"]] }]), "Υ1 συμπαγής μορφή + καθαρισμός");
    ok(sync.includes('if (packed && Array.isArray(packed.irrigation_zones)) {') && sync.includes('if (typeof zonesTag === "string") newTags.push({ key: "irrigation_zones", value: zonesTag });')
      && sync.includes('&& (zonesTag === undefined || item.key !== "irrigation_zones"));'), "Υ2 δικό τους tag· άθικτο χωρίς πεδίο, διαγραφή με κενή λίστα");
    ok(sync.includes('if (typeof zonesTag === "string" && zonesTag.length > TAG_SAFE_LIMIT) {'), "Υ3 όριο μεγέθους με ειδοποίηση");
    // ── Φ: φόρμα ──
    const zsrc = cut(form, "function _sagZonePoints(){", "function _sagZonesRender(){", "Φ ζώνες");
    const st = { lastDataMap: { soil_sensors: { metadata: { list: [{ i: IDA, n: "SE0X-A", c: 0 }, { i: IDA + ":2", n: "SE0X-A · θύρα 2", c: 1 }, { i: "κακό", n: "Χ" }] } } }, zones: [] };
    const crops = [{ id: "vegetablecrops:tomato:1", cultivation_type_general: "vegetableCrops", cultivation_type: "tomato" }, { id: "x:y:2", cultivation_type_general: "x", cultivation_type: "" }];
    const FZf = new Function("state", "readCropsFromUI", "CULTIVATION_TYPES", "numOrNull", "$", zsrc + "\nreturn { _sagZonePoints, _sagZoneCrops, _sagZonesFromConf, readZonesFromUI };")(
      st, () => crops, { vegetableCrops: { tomato: "Ντομάτα" } }, (v) => { const n = parseFloat(String(v).replace(",", ".")); return String(v).trim() === "" || !Number.isFinite(n) ? null : n; }, () => null);
    ok(J(FZf._sagZonePoints().map((p) => p.i)) === J([IDA, IDA + ":2"]), "Φ1 όλες οι σόνδες (και «θύρα 2»)");
    ok(J(FZf._sagZoneCrops()) === J([{ id: "vegetablecrops:tomato:1", ok: true, label: "#1 Ντομάτα" }]), "Φ2 μόνο καλλιέργειες με είδος");
    st.zones = FZf._sagZonesFromConf([{ n: "Ζ", s: [IDA], c: [["vegetablecrops:tomato:1", 300], ["χάθηκε", 5]] }]);
    ok(J(st.zones) === J([{ n: "Ζ", s: [IDA], c: { "vegetablecrops:tomato:1": "300", "χάθηκε": "5" } }]), "Φ3 φόρτωση");
    st.zones.push({ n: "", s: [], c: { "vegetablecrops:tomato:1": "" } });
    ok(J(FZf.readZonesFromUI()) === J([{ n: "Ζ", s: [IDA], c: [["vegetablecrops:tomato:1", 300]] }]), "Φ4 αποθήκευση: χωρίς άγνωστες καλλιέργειες και ανώνυμες ζώνες");
    const rl = new Function("state", cut(form, "function _sagSoilRefList(){", "function _sagSoilRefRender(){", "Φ απόφαση") + "\nreturn _sagSoilRefList;")(st);
    ok(J(rl().map((x) => x.i)) === J([IDA + ":2"]), "Φ5 αισθητήρας απόφασης: μόνο c:1");
    const rl0 = new Function("state", cut(form, "function _sagSoilRefList(){", "function _sagSoilRefRender(){", "Φ απόφαση") + "\nreturn _sagSoilRefList;")({ lastDataMap: { soil_sensors: { metadata: { list: [{ i: IDA, n: "Α" }, { i: IDB, n: "Β" }] } } } });
    ok(rl0().length === 2, "Φ6 παλιά λίστα (χωρίς c): όπως πριν");
    ok(form.includes("    irrigation_zones: readZonesFromUI(),   /* v29 · T-ZONES-01 */") && form.includes("state.zones = _sagZonesFromConf(conf.irrigation_zones); _sagZonesRender();")
      && form.includes("state.zones = []; _sagZonesRender();") && form.includes('<div id="zonesList"'), "Φ7 αποθήκευση/φόρτωση/καθαρισμός/ενότητα");
    ok(/const _hasC = l\.some/.test(form) && form.includes("_sagZonesMaybeRefresh();   /* v29"), "Φ8 ανανέωση μόνο όταν αλλάζουν τα δεδομένα");
    // ── W: widget ──
    const wsrc = cut(wid, "/* W-ZONES-01 */sagZonesCard=", "sagMeterBox={v:!1},", "W κάρτα");
    const card = new Function("let " + wsrc.replace(/,$/, "") + ";\nreturn sagZonesCard;")();
    const Jx = { jsx: (t, p) => ({ t, p }), jsxs: (t, p) => ({ t, p }) };
    const now = new Date().toISOString(), old = new Date(Date.now() - 4 * 3600e3).toISOString();
    const R = (t, z) => ({ irrigation_zones: { value: z.length, metadata: { t, z } } });
    const c1 = card(Jx, R(now, [{ n: "Γκαζόν", m: 21.4, L: 1500, own: true, cr: [{ t: "Απαιτείται άρδευση" }] }, { n: "Θάμνοι", m: null, L: null, own: false, cr: [] }]));
    const rows = c1 && c1.p.children.slice(1);
    ok(rows && rows.length === 2 && rows[0].p.children[0].p.children === "Γκαζόν" && /21,4 % · 1\.500 λ$/.test(rows[0].p.children[1].p.children)
      && /— · — · μέσος αγρού/.test(rows[1].p.children[1].p.children) && rows[0].p.title === "Απαιτείται άρδευση", "W1 γραμμές ζωνών");
    ok(card(Jx, R(old, [{ n: "Α" }])) === null && card(Jx, {}) === null && card(Jx, R(now, [])) === null, "W2 παλιό/κενό: κρυφό");
    ok(wid.includes('Hargreaves:"εκτίμηση από τις θερμοκρασίες"}[MT]||MT):"")})]})})(),sagZonesCard(e,re)]'), "W3 μέσα στην κάρτα «Άρδευση»");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
function await_(p) { /* οι εγγραφές του ψεύτικου dev είναι συγχρονες· το promise λύνεται αμέσως */ return p; }
async function runA(core, sync, form, wid) {
  // οι κλήσεις _sagZonesSend είναι async: τρέχουμε το run και περιμένουμε microtasks
  const r = run(core, sync, form, wid);
  await new Promise((res) => setTimeout(res, 0));
  return r;
}
const base = await runA(CORE0, SYNC0, FORM0, WID0);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (ανάγνωση, μετρήσεις ζώνης, ταυτότητα λίτρων, m², εγγραφή, sync, φόρμα, widget)");
const MUT = [
  ["μ1 ζώνη με το έδαφος του αγρού", "  for (const k of Object.keys(agg)) data[k] = _sagWithValue(agg[k].tpl, agg[k].s / agg[k].c);\n", "", "k"],
  ["μ2 m² της καλλιέργειας παντού", "(inZones === 1 ? Number(cropParams.area) : NaN)", "Number(cropParams.area)", "k"],
  ["μ3 m² ζώνης αγνοούνται", "const p = Object.assign({}, cropParams, { area: row.a, area_source: 'zone' });", "const p = Object.assign({}, cropParams);", "k"],
  ["μ4 χωρίς άθροισμα", "Ls.reduce((x, y) => x + y, 0)", "Ls[0]", "k"],
  ["μ5 χωρίς ανάγνωση tag", "  configuration.irrigation_zones = _sagZonesParse((field.tags.filter(item => item.key === 'irrigation_zones')[0] || {}).value);", "  configuration.irrigation_zones = [];", "k"],
  ["μ6 χωρίς κάρτα μεθόδου", "    sh.field_method_card = { value:", "    sh.field_method_cardX = { value:", "k"],
  ["μ7 και εκτός ωριαίου κύκλου", "  if (!zs.length || !hourTich || !crop) return;", "  if (!zs.length || !crop) return;", "k"],
  ["μ8 sync: όριο αγνοείται", 'if (typeof zonesTag === "string" && zonesTag.length > TAG_SAFE_LIMIT) {', 'if (false) {', "s"],
  ["μ9 sync: κρατά μηδενικά m²", "c.push(Number.isFinite(a) && a > 0 ? [String(x[0]), Math.round(a * 10) / 10] : [String(x[0])]);", "c.push([String(x[0]), a]);", "s"],
  ["μ10 φόρμα: αποθηκεύει άγνωστες καλλιέργειες", ".filter(function(id){ return ids[id]; }).map(function(id){\n        const a = numOrNull(z.c[id]);", ".map(function(id){\n        const a = numOrNull(z.c[id]);", "f"],
  ["μ11 φόρμα: αισθητήρας απόφασης όλες οι σόνδες", "&& (!_hasC || x.c === 1); });", "; });", "f"],
  ["μ12 widget: δείχνει και παλιές ζώνες", "Date.now()-tt>108e5", "Date.now()-tt>1e15", "w"],
];
let killed = 0;
for (const [name, a, b, where] of MUT) {
  const src = { k: CORE0, s: SYNC0, f: FORM0, w: WID0 }[where];
  const cnt = src.split(a).length - 1;
  if (cnt !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + cnt + ")"); continue; }
  const m = src.replace(a, b);
  const r = await runA(where === "k" ? m : CORE0, where === "s" ? m : SYNC0, where === "f" ? m : FORM0, where === "w" ? m : WID0);
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 120)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
