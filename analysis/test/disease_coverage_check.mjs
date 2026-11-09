// Ελεγκτής v50.190 (9/11/2026) — ΚΑΛΥΨΗ ΑΣΘΕΝΕΙΩΝ ΣΕ ΟΛΟΥΣ ΤΟΥΣ ΑΓΡΟΥΣ (μετά τον περονόσπορο που δεν προβλέφθηκε).
// (1) Θετικός έλεγχος: κάθε μύκητας υγρού φύλλου/ωίδιο × κάθε ξενιστής × σενάρια οργάνων ΟΠΩΣ ΤΑ ΕΧΟΥΜΕ × ύπαιθρο/θερμοκήπιο
//     φτάνει «Υψηλός/Σοβαρός» σε ευνοϊκές συνθήκες (μόνη εξαίρεση: em320 με οροφή < 90 % χωρίς αισθητήρα φύλλου ΚΑΙ χωρίς
//     αναγνωρισμένη οροφή — το τυφλό σημείο που κλείνει το T-RH-CEILING-01).
// (2) Αμετάβλητο κάλυψης: σε ΚΑΘΕ καλλιέργεια του συστήματος, χωρίς αισθητήρα εδάφους/βροχόμετρο, ΚΑΘΕ παθογόνο του ξενιστή έχει
//     κάρτα (T-NOSILENT-CARD-01) — καμία ασθένεια δεν «εξαφανίζεται» σιωπηλά.
// (3) T-RH-CEILING-01: ανίχνευση οροφής, απεικόνιση RH, κάρτα βλάβης οργάνου.
// Μεταλλάξεις: κάθε βλάβη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadCore, simulate, WET, CEIL_INV } from "./disease_positive_control.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const rawC = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const EXTRA = "\nreturn Object.assign(__k, { calculate_NematodeRisk, _sagRhCeiling, _sagFieldRhCeiling, _sagRhEff, _sagDetectFaults, _sagLeafStuck, _sagFieldLeafStuck, CROP_PROFILE, SAG_KERNEL_VERSION });";
import { createRequire } from "node:module";
const req = createRequire(path.join(here, "..", "runPerTich.js"));
function loadCoreWith(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nconst __k = { calculate_GDD, calculate_InfectionHours, calculate_FIR, getPathogenMessages, _sagPathogenCases, PATHOGEN_PROFILE, _SAG_SEASON_WINDOWS, _SAG_NONFOLIAR_SUSPENDED, setTick: (v) => { try { _SAG_TICK_MIN = v; } catch (e) {} }, setCovered: (v) => { try { _SAG_COVERED_ACTIVE = !!v; } catch (e) {} } };" + EXTRA;
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, { exports: {} }, {}, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.join(here, ".."), path.join(here, "..", "runPerTich.js"));
}
void loadCore;
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCoreWith(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  ok(K.SAG_KERNEL_VERSION === "v50.190 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
  // ── (3) οροφή ──
  const ring = (vals) => vals.map((v, i) => [20000 + i, v]);
  const kouts = K._sagRhCeiling(ring([87, 91, 92.5, 92.5, 92, 92.5, 92.5, 92.5, 92, 92.5, 92.5, 93 - 0.5, 92.5, 92.5, 92.5, 80, 88, 88, 86, 90, 92.5]));
  ok(kouts && kouts.clip && kouts.top === 92.5 && kouts.hits >= 5, "Γ1 em320 92,5 πολλές ημέρες στην οροφή → οροφή (" + JSON.stringify(kouts) + ")");
  const dry = K._sagRhCeiling(ring([63, 71, 78, 80, 74, 69, 77, 85, 72, 66, 79, 81, 70, 68]));
  ok(dry && !dry.clip, "Γ2 διάσπαρτα μέγιστα (ξηρό διάστημα) → καμία οροφή (" + JSON.stringify(dry) + ")");
  const s2120 = K._sagRhCeiling(ring([99, 99, 98, 99, 97, 99, 99, 99, 98, 99]));
  ok(s2120 && !s2120.clip, "Γ3 S2120 που φτάνει 99 → καμία οροφή");
  ok(K._sagRhCeiling(ring([89.5, 89.5, 89.5, 89.5, 89.5, 89.5])) === null, "Γ4 < 7 ημέρες → καμία κρίση");
  const low = K._sagRhCeiling(ring([84, 84, 84, 84, 84, 84, 84, 84]));
  ok(low && !low.clip, "Γ5 οροφή < 85 % δεν διορθώνεται");
  ok(K._sagFieldRhCeiling({ data: { _sagDevInv: [{ t: "em320_th", rhc: { top: 89.5, hits: 9, n: 21, clip: true } }] } }) === 89.5, "Γ6 αγρός με em320 οροφής → 89,5");
  ok(K._sagFieldRhCeiling({ data: { _sagDevInv: [{ t: "em320_th", rhc: { top: 89.5, hits: 9, n: 21, clip: true } }, { t: "s2120", rhc: { top: 99, hits: 15, n: 21, clip: false } }] } }) === null, "Γ7 αν άλλο όργανο φτάνει 99 → καμία διόρθωση");
  ok(K._sagFieldRhCeiling({ data: { _sagDevInv: [{ t: "lms01_ls", rhc: { top: 50, hits: 9, n: 21, clip: true } }] } }) === null, "Γ8 μόνο όργανα αέρα");
  ok(K._sagRhEff(89, 89.5) === 100 && K._sagRhEff(81, 89.5) === 81 && Math.abs(K._sagRhEff(85, 89.5) - 90.13) < 0.05 && K._sagRhEff(95, null) === 95, "Γ9 απεικόνιση RH (" + K._sagRhEff(85, 89.5) + ")");
  // κάρτα βλάβης οργάνου
  const fl = K._sagDetectFaults({ n: "em320_x", t: "em320_th", ageMin: 5, stats: {}, rhc: { top: 89.5, hits: 9, n: 21, clip: true } },
    { _sagDelivered: {}, temperature: [{ value: 15 }], humidity: [{ value: 80 }] }, { rain24: 0 }) || [];
  ok(fl.some((x) => /δεν φτάνει ποτέ τον κορεσμό/.test(x.title) && x.kill === false), "Γ10 κάρτα βλάβης «δεν φτάνει τον κορεσμό» χωρίς ακύρωση μετρήσεων (" + fl.map((x) => x.title).join("/") + ")");
  // ── T-LEAF-STUCKDRY-01 ──
  const st1 = K._sagLeafStuck(ring([2, 2.1, 1.9, 2, 2.6, 2.1]));
  ok(st1 && st1.stuck, "Σ1 αισθητήρας φύλλου ~2 % επί 6 ημέρες → «δεν δείχνει νερό»");
  ok(!K._sagLeafStuck(ring([2, 2, 30, 2, 2, 2])).stuck && K._sagLeafStuck(ring([2, 2, 2, 2])) === null, "Σ2 ένα υγρό δείγμα τον αποκαθιστά · < 5 ημέρες καμία κρίση");
  ok(K._sagFieldLeafStuck({ data: { _sagDevInv: [{ t: "lms01_ls", lst: { max: 2, n: 8, stuck: true } }] } }) === true
    && K._sagFieldLeafStuck({ data: { _sagDevInv: [{ t: "lms01_ls", lst: { max: 2, n: 8, stuck: true } }, { t: "lms01_ls", lst: { max: 45, n: 8, stuck: false } }] } }) === false,
    "Σ3 αγρός: μόνο αν ΟΛΟΙ οι αισθητήρες φύλλου είναι κολλημένοι");
  const STUCK = [{ t: "lms01_ls", lst: { max: 2.1, n: 9, stuck: true } }];
  const pc = Object.values(K.PATHOGEN_PROFILE).map((c) => c.pseudoperonospora_cubensis).find(Boolean);
  const cuc = pc.crops.find((h) => h.cultivation_type === "cucumber");
  const scStuck = (T) => ({ T, RH: 98, lm: 2, lt: T + 0.2 });
  const rTrusted = simulate(K, "pseudoperonospora_cubensis", cuc, scStuck, true);
  const rStuck = simulate(K, "pseudoperonospora_cubensis", cuc, scStuck, true, 18, STUCK);
  ok(rTrusted.best < 3 && rStuck.best >= 3, "Σ4 κολλημένος αισθητήρας + RH 98: χωρίς τον κανόνα τυφλό (" + rTrusted.best + "), με τον κανόνα Υψηλός (" + rStuck.best + ")");
  const fl2 = K._sagDetectFaults({ n: "lms_x", t: "lms01_ls", ageMin: 5, stats: {}, lst: { max: 2.1, n: 9, stuck: true } }, { leaf_moisture: [{ value: 2 }] }, { rain24: 0 }) || [];
  ok(fl2.some((x) => /δεν δείχνει ποτέ νερό/.test(x.title) && x.kill === false), "Σ5 κάρτα βλάβης αισθητήρα φύλλου (" + fl2.map((x) => x.title).join("/") + ")");
  // ── (1) θετικός έλεγχος (υποσύνολο: ένας ξενιστής ανά παθογόνο, για ταχύτητα) ──
  let miss = [], blindSeen = 0;
  for (const cat of Object.values(K.PATHOGEN_PROFILE)) for (const [key, p] of Object.entries(cat)) {
    if (p.type !== "Infection_Triangle" || (K._SAG_NONFOLIAR_SUSPENDED || []).indexOf(key) >= 0) continue;
    const host = (p.crops || [])[0]; if (!host) continue;
    const needsWet = p.requiresLeafWetness !== false;
    for (const cov of [false, true]) {
      if (needsWet) {
        for (const [name, sc] of Object.entries(WET)) {
          const r = simulate(K, key, host, sc, cov);
          if (name === "em320(89,5) χωρίς φύλλο") { if (r.best < 3) blindSeen++; continue; }
          if (r.best < 3) miss.push(key + "/" + name + "/" + (cov ? "θ" : "υ"));
        }
        const rc = simulate(K, key, host, WET["em320(89,5) χωρίς φύλλο"], cov, 18, CEIL_INV);
        if (rc.best < 3) miss.push(key + "/οροφή/" + (cov ? "θ" : "υ"));
      } else {
        const oh = p.optimalHumidity || {}; const rh = Math.min(88, Math.max(Number(oh.min), (Number(oh.min) + (Number(oh.max) || 100)) / 2));
        const r = simulate(K, key, host, (T) => ({ T, RH: rh }), cov);
        if (r.best < 3) miss.push(key + "/ωίδιο/" + (cov ? "θ" : "υ"));
      }
    }
  }
  ok(miss.length === 0, "Θ1 όλες οι ασθένειες φτάνουν Υψηλό με τα όργανά μας (λείπουν: " + miss.slice(0, 6).join(", ") + (miss.length > 6 ? " …+" + (miss.length - 6) : "") + ")");
  ok(blindSeen > 0, "Θ2 χωρίς αναγνωρισμένη οροφή το em320 89,5 μένει τυφλό (τεκμηρίωση του κενού)");
  // ── (2) αμετάβλητο κάλυψης ──
  const hostsOf = {};
  for (const cat of Object.values(K.PATHOGEN_PROFILE)) for (const [key, p] of Object.entries(cat)) for (const h of p.crops || []) (hostsOf[h.cultivation_type_general + ":" + h.cultivation_type] = hostsOf[h.cultivation_type_general + ":" + h.cultivation_type] || []).push(key);
  const silent = [];
  for (const [g, crops] of Object.entries(K.CROP_PROFILE)) for (const c of Object.keys(crops)) {
    for (const withRain of [true, false]) {
      const crop = { cultivation_type_general: g, cultivation_type: c, stage: "vegetative", name: "X", soil_type: "silty_clay_loam", area: 2000, irrigation_system: "dripIrrigation", covered_cultivation: false };
      const data = { temperature: [{ value: 18 }], humidity: [{ value: 70 }], air_temperature: [{ value: 18 }], air_humidity: [{ value: 70 }], air_temperature_avg: [{ value: 18 }], air_temperature_max: [{ value: 23 }], air_temperature_min: [{ value: 13 }], dew_point: [{ value: 12.5 }], ipsi_avg: [{ value: 2 }], _sagAges: { temperature: 5, humidity: 5 } };
      if (withRain) data.rain_height_daily = [{ value: 0 }];
      const now = Date.UTC(2026, 10, 9, 10);
      const meas = { timezone: "Europe/Athens", now: new Date(now), _prevBundleTime: new Date(now - 36e5).toISOString(), data };
      K.setTick(60); K.setCovered(false);
      const gdd = K.calculate_GDD(true, true, meas, crop) || []; for (const x of gdd) if (x && x.variable) meas.data[x.variable] = [{ value: x.value }];
      const ih = K.calculate_InfectionHours(true, meas, crop) || []; for (const x of ih) meas.data[x.variable] = [{ value: x.value }];
      const fir = K.calculate_FIR(true, true, meas, [{ variable: "ipsi", value: 2 }], crop) || [];
      const msgs = K.getPathogenMessages(fir, meas) || [];
      const nem = K.calculate_NematodeRisk(true, meas, crop) || [];
      const have = new Set([...fir, ...msgs, ...nem].filter((x) => x && String(x.variable).startsWith("fir_message_")).map((x) => String(x.variable).slice(12)));
      for (const k of hostsOf[g + ":" + c] || []) if (!have.has(k)) silent.push(c + (withRain ? "" : "(χωρίς βροχόμετρο)") + ":" + k);
    }
  }
  ok(silent.length === 0, "Κ1 κάθε παθογόνο κάθε καλλιέργειας έχει κάρτα (σιωπηλά: " + silent.slice(0, 8).join(", ") + (silent.length > 8 ? " …+" + (silent.length - 8) : "") + ")");
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("disease_coverage_check: όλα ✔");
const MUT = [
  ["οροφή: χωρίς επανάληψη ημερών", "hits >= _SAG_RHC_HITS };", "hits >= 0 };"],
  ["οροφή: χωρίς κάτω όριο 85", "clip: top >= _SAG_RHC_LO &&", "clip: top >= 0 &&"],
  ["οροφή: αγνοεί όργανο που φτάνει 99", "if (air.some((d) => !d.rhc.clip && d.rhc.top >= _SAG_RHC_HI)) return null;", ""],
  ["διόρθωση RH δεν μπαίνει στη διαβροχή (RH και σημείο δρόσου)", "    RH: RHd,                 // T-RH-CEILING-01\n    dewPoint: _dpD,", "    RH: RH,\n    dewPoint: dewPoint,"],
  ["διόρθωση RH δεν μπαίνει στην πύλη", "const humidityOk = RHd >= _rhMin", "const humidityOk = RH >= _rhMin"],
  ["κάρτα βλάβης οργάνου λείπει", "if (dev.rhc && dev.rhc.clip) {", "if (false) {"],
  ["εδαφογενή σιωπηλά ξανά", "          indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',\n            metadata: { color: 'grey', text: _nfT", "          if (_nfT) indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο',\n            metadata: { color: 'grey', text: _nfT"],
  ["βακτηριακή καρκίνωση σιωπηλή ξανά", "        if (er === null) {   // T-NOSILENT-CARD-01: ούτε πληγές ούτε βροχή", "        if (er === null) continue; if (false) {   // "],
  ["σκληρωτινίαση σιωπηλή ξανά", "        if (er === null) {   // T-NOSILENT-CARD-01\n", "        if (er === null) continue; if (false) {\n"],
  ["νηματώδεις σιωπηλοί ξανά", "    if (st.v === null) {   // T-NOSILENT-CARD-01: κάρτα, όχι σιωπή", "    if (st.v === null) continue; if (false) {"],
  ["όριο RH 95 (πριν τον v50.176)", "(needsWet && (_lwsMeasuredWet || _lwsRainWet));   // T-RH-CEILING-01: RHd", "false;"],
  ["κολλημένος: όριο 5 % αγνοείται", "stuck: mx < _SAG_LST_MAX };", "stuck: mx < 0 };"],
  ["κολλημένος: αρκεί ένας αισθητήρας", "return lf.length > 0 && lf.every((d) => d.lst.stuck);", "return lf.some((d) => d.lst.stuck);"],
  ["κολλημένος: ο αισθητήρας ακυρώνει ακόμη", "    leafMoisture: _leafStuck ? null : leafMoistureHour,   // T-PHASE0B-01: μέγιστο της ώρας · T-LEAF-STUCKDRY-01: κολλημένος = χωρίς αισθητήρα\n    leafTemp: leafTemp,\n    leafShaded: _leafStuck ? false : _lwsShaded,", "    leafMoisture: leafMoistureHour,\n    leafTemp: leafTemp,\n    leafShaded: _lwsShaded,"],
  ["κάρτα κολλημένου αισθητήρα λείπει", "if (dev.lst && dev.lst.stuck) {", "if (false) {"],
  ["παλιά έκδοση", "'v50.190 · 2026-11-09'", "'v50.189 · 2026-11-09'"],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = run(SRC.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 70) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
if (dead !== MUT.length) process.exit(1);
