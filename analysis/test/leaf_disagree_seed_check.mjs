// Ελεγκτής v50.191 (9/11/2026) — T-LEAF-DISAGREE-01 + T-CASE-SEED-01.
// (Α) Σκιασμένος αισθητήρας φύλλου στεγνός ενώ ο αέρας είναι στον κορεσμό: την 1η νύχτα ακυρώνει (κανόνας 24/9), τη 2η
//     μετρά μόλις συμπληρωθούν 3 ώρες διαφωνίας· ο δακτύλιος συνεχίζει να γράφει νύχτες διαφωνίας και μετά την ενεργοποίηση (χωρίς
//     ταλάντωση)· όταν ξανασυμφωνήσει για 10 νύχτες, ο κανόνας της 24/9 επανέρχεται· αισθητήρας που δείχνει νερό ή ξερός
//     αέρας δεν σημαδεύονται. Κάρτα βλάβης μόνο όταν ισχύει.
// (Β) Σπόρος ειδοποιήσεων: δέχεται μόνο έγκυρα, ανοίγει/συγχωνεύει, δεν σκεπάζει ενέργεια του παραγωγού.
// Μεταλλάξεις: κάθε βλάβη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
import { replayField } from "./downy_field_replay.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadX(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { _sagLeafDisRing, _sagLeafDisState, _sagLeafDisFromPrev, _sagParseCaseSeed, _sagApplyCaseSeed, _sagDetectFaults, SAG_KERNEL_VERSION };";
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, { exports: {} }, {}, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
// Συνθετικές ώρες: νύχτα (20–05) T 15 / RH 99 ή 70, ημέρα T 22 / RH 60· φύλλο σκιασμένο (ημέρα: αέρας − 0,3).
function rows(nights, opt = {}) {
  const out = []; const d0 = Date.UTC(2026, 9, 25);
  for (let i = 0; i < nights.length + 1; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) {
      const isN = h >= 20 || h <= 5;
      const idx = h >= 20 ? i : i - 1;      // ώρες 00–05 ανήκουν στην προηγούμενη νύχτα
      const humid = isN && idx >= 0 && idx < nights.length && nights[idx];
      const T = isN ? 15 : 22, RH = humid ? 99 : (isN ? 70 : 60);
      const LL = humid && opt.wetLeaf ? 40 : 2;
      out.push({ d, h, T, RH, LX: LL, LL, LT: isN ? T + 0.6 : T - 0.3, R: 0 });   // τη νύχτα πάνω από το σημείο δρόσου: ο αισθητήρας δεν «βλέπει» δρόσο από τη θερμοκρασία του
    }
  }
  return { rows: out };
}
const O = { crop: "vegetableCrops:tomato", key: "phytophthora_infestans", covered: false };
const nightsOf = (r) => Object.entries(r.nights).sort((a, b) => (a[0] < b[0] ? -1 : 1)).filter(([k]) => k >= "10-25").map(([, v]) => v.c);
const ringOf = (r) => { const v = r.state && r.state.leaf_disagree_ring; try { return JSON.parse(v[0].value); } catch (_e) { return []; } };
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadX(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  ok(K.SAG_KERNEL_VERSION === "v50.191 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
  // ── Α1 κύριο σενάριο: 6 υγρές νύχτες, αισθητήρας στεγνός ──
  let A1; try { A1 = replayField(src, rows([1, 1, 1, 1, 1, 1]), O); } catch (e) { return f.concat(["Α1 εκτέλεση: " + e.message]); }
  const c1 = nightsOf(A1);
  // 1η νύχτα: ο αισθητήρας ακυρώνει (κανόνας 24/9). 2η: μόλις συμπληρωθούν 3 ώρες διαφωνίας ενεργοποιείται — μετρά το υπόλοιπο.
  ok(c1[0] === 0 && c1[1] > 0 && c1[1] <= 7, "Α1 1η νύχτα ακυρώνει ο αισθητήρας, η 2η μετρά μετά τις 3 ώρες διαφωνίας: " + c1.join(","));
  ok(c1.slice(2, 6).every((x) => x >= 5), "Α1 από την 3η νύχτα μετρούν οι ώρες της εκτίμησης: " + c1.join(","));
  const ring1 = ringOf(A1);
  ok(ring1.filter((e) => e[1] >= 3).length >= 5, "Α2 ο δακτύλιος γράφει νύχτες διαφωνίας και μετά την ενεργοποίηση: " + JSON.stringify(ring1));
  // ── Α3 αισθητήρας που δείχνει νερό: μετρά από την 1η νύχτα, καμία διαφωνία ──
  const A3 = replayField(src, rows([1, 1, 1, 1], { wetLeaf: true }), O); const c3 = nightsOf(A3);
  ok(c3[0] >= 5 && c3[1] >= 5, "Α3 υγρός αισθητήρας μετρά από την 1η νύχτα: " + c3.join(","));
  ok(ringOf(A3).every((e) => e[1] === 0), "Α3 υγρός αισθητήρας χωρίς διαφωνία: " + JSON.stringify(ringOf(A3)));
  // ── Α4 ξερός αέρας: ούτε ώρες ούτε διαφωνία ──
  const A4 = replayField(src, rows([0, 0, 0, 0]), O);
  ok(nightsOf(A4).every((x) => x === 0) && ringOf(A4).every((e) => e[1] === 0), "Α4 ξερός αέρας: τίποτα");
  // ── Α5 επαναφορά: 2 υγρές, 9 ξερές, 1 υγρή → η τελευταία ξανακόβεται από τον αισθητήρα ──
  const A5 = replayField(src, rows([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]), O); const c5 = nightsOf(A5);
  ok(c5[11] === 0, "Α5 μετά από 10 νύχτες συμφωνίας ο κανόνας 24/9 επανέρχεται: " + c5.join(","));
  // ── Α6 κάρτα βλάβης ──
  const dev = { n: "lms_x", t: "lms01_ls", ageMin: 5, stats: {} };
  const card = (d, ld) => (K._sagDetectFaults(d, { leaf_moisture: [{ value: 2 }], _sagLeafDis: ld }, { rain24: 0 }) || []).filter((x) => /δεν βλέπει τη δρόσο/.test(x.title));
  ok(card(dev, { active: true, bad: 2, n: 6, hrs: 14 }).length === 1, "Α6 κάρτα όταν ισχύει");
  ok(card(dev, { active: false, bad: 1, n: 6, hrs: 6 }).length === 0, "Α6 χωρίς κάρτα όταν δεν ισχύει");
  ok(card(Object.assign({}, dev, { lst: { max: 2, n: 9, stuck: true } }), { active: true, bad: 2, n: 6, hrs: 14 }).length === 0, "Α6 όχι διπλή κάρτα με «δεν δείχνει ποτέ νερό»");
  ok(card({ n: "em", t: "em320_th", ageMin: 5, stats: {} }, { active: true, bad: 2, n: 6, hrs: 14 }).length === 0, "Α6 μόνο σε αισθητήρα φύλλου");
  const pb = { cropsById: { a: { leaf_disagree_ring: { value: JSON.stringify([["11-01", 4], ["11-02", 5]]) } }, b: {} } };
  ok(K._sagLeafDisFromPrev(pb).active === true && K._sagLeafDisFromPrev({ cropsById: {} }).active === false, "Α7 κατάσταση από το προηγούμενο bundle");
  ok(K._sagLeafDisState([["a", 3], ["b", 2.9]]).active === false && K._sagLeafDisState([["a", 3], ["b", 3]]).active === true, "Α8 όριο 3 ωρών / 2 νυχτών");
  // ── Β σπόρος ──
  const now = 29903000;
  const P = K._sagParseCaseSeed({ cases: {
    pseudoperonospora_cubensis: { o: now - 7 * 1440, h: now - 6 * 1440, p: 3, r: now - 7 * 1440 },
    phytophthora_infestans: { o: now - 20 * 1440, h: now - 19 * 1440, p: 3 },      // πολύ παλιό
    botrytis_cinerea: { o: now - 1440, h: now - 1440, p: 2 },                     // κάτω από βαθμίδα ανοίγματος
    plasmopara_viticola: { o: now - 1440, h: now - 2000, p: 3 },                  // h < o
    alternaria_solani: { o: now - 1440, h: now + 600, p: 3 },                     // μελλοντικό
    no_such_thing: { o: now - 1440, h: now - 1440, p: 3 } } }, now);
  ok(Object.keys(P).join() === "pseudoperonospora_cubensis", "Β1 δέχεται μόνο έγκυρο σπόρο: " + Object.keys(P).join());
  const seed = { pseudoperonospora_cubensis: { o: now - 7 * 1440, h: now - 6 * 1440, p: 3, r: now - 7 * 1440 } };
  const ind = [{ variable: "fir_message_pseudoperonospora_cubensis", value: "Χαμηλός κίνδυνος" }];
  const ap = (prev, indicators = ind) => { const m = { data: prev ? { case_pseudoperonospora_cubensis: [{ value: JSON.stringify(prev) }] } : {} };
    const d = K._sagApplyCaseSeed(seed, m, indicators); const v = m.data.case_pseudoperonospora_cubensis; return { d, rec: v ? JSON.parse(v[0].value) : null }; };
  let x = ap(null); ok(x.d.length === 1 && x.rec.s === "open" && x.rec.o === now - 7 * 1440, "Β2 χωρίς υπόθεση → ανοίγει");
  x = ap({ s: "auto", c: now - 1440, p: 4 }); ok(x.d.length === 1 && x.rec.s === "open", "Β3 αυτόματα κλεισμένη → ανοίγει");
  x = ap({ s: "open", o: now - 3 * 1440, p: 4, h: now - 8 * 1440 });
  ok(x.rec.o === now - 7 * 1440 && x.rec.p === 4 && x.rec.h === now - 6 * 1440, "Β4 ανοιχτή → συγχώνευση " + JSON.stringify(x.rec));
  x = ap({ s: "spray", c: now - 1440, o: 1, p: 3 }); ok(x.d.length === 0 && x.rec.s === "spray", "Β5 ψεκασμός μετά την αρχή → αμετάβλητο");
  x = ap({ s: "insp", c: now - 8 * 1440 }); ok(x.d.length === 1 && x.rec.s === "open", "Β6 επιθεώρηση πριν την αρχή → ανοίγει");
  x = ap(null, [{ variable: "fir_message_botrytis_cinerea", value: "x" }]); ok(x.d.length === 0 && x.rec === null, "Β7 όχι σε καλλιέργεια χωρίς το παθογόνο");
  // ── καλωδίωση ──
  ok(src.includes("data._sagLeafDis = _sagLeafDisFromPrev(_ringPrevBundle);"), "Γ1 η κατάσταση φτάνει στην κάρτα βλαβών");
  ok(/'declaration_undo', 'case_seed'\]/.test(src), "Γ2 ο σπόρος διαβάζεται μαζί με τις δηλώσεις");
  ok(src.includes("Object.assign(_seedCase, _sagParseCaseSeed(_pl,"), "Γ3 ο σπόρος αναλύεται");
  ok(src.includes("_sagApplyCaseSeed(_seedCase, measurementsForCrop, indicatorsForCrop)"), "Γ4 ο σπόρος εφαρμόζεται πριν τον κύκλο ζωής της υπόθεσης");
  ok(src.indexOf("_sagApplyCaseSeed(_seedCase, measurementsForCrop") < src.indexOf("const _caseIndicators = _sagPathogenCases("), "Γ5 σειρά: σπόρος πριν την υπόθεση");
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("βάση: όλα ✔ (" + loadX(SRC).SAG_KERNEL_VERSION + ")");
const M = [
  ["η διαφωνία δεν αλλάζει την κρίση", "const _leafStuck = _leafStuckDry || _leafDisagree;", "const _leafStuck = _leafStuckDry;"],
  ["όριο νυχτών 99", "_SAG_LDIS_NEED = 2", "_SAG_LDIS_NEED = 99"],
  ["όριο νυχτών 1", "_SAG_LDIS_NEED = 2", "_SAG_LDIS_NEED = 1"],
  ["όριο ωρών 0", "_SAG_LDIS_MIN_H = 3", "_SAG_LDIS_MIN_H = 0"],
  ["ο δακτύλιος κρίνεται με την τελική κρίση (ταλάντωση)", "_ldBySensor.source === 'sensor_dry'", "_lws.source === 'sensor_dry'"],
  ["διαφωνία χωρίς υγρό αέρα", "&& _ldByAir.wet && (_ldByAir.source === 'dew_air' || _ldByAir.source === 'rh')", "&& true"],
  ["ο δακτύλιος δεν κόβεται στις 10 νύχτες (ανάγνωση και εγγραφή)", ".slice(-_SAG_LDIS_NIGHTS)", ".slice(-99)"],
  ["ο δακτύλιος δεν αποθηκεύεται", "indicators.push({ variable: 'leaf_disagree_ring',", "void ({ variable: 'leaf_disagree_ring',"],
  ["κάρτα χωρίς έλεγχο ισχύος", "data && data._sagLeafDis && data._sagLeafDis.active)", "data && data._sagLeafDis)"],
  ["κάρτα και με «ποτέ νερό»", "dev.t === 'lms01_ls' && !(dev.lst && dev.lst.stuck) && data", "dev.t === 'lms01_ls' && data"],
  ["κατάσταση κάρτας δεν καλωδιώνεται", "data._sagLeafDis = _sagLeafDisFromPrev(_ringPrevBundle);", "data._sagLeafDis = null;"],
  ["σπόρος κάτω από βαθμίδα", "p >= _SAG_CASE_OPEN_LEVEL && p <= 4", "p >= 0 && p <= 4"],
  ["σπόρος χωρίς όριο ηλικίας", "nowMin - o <= 14 * 1440", "nowMin - o <= 999 * 1440"],
  ["σπόρος σε μελλοντική ώρα", "h <= nowMin + 60", "h <= nowMin + 99999"],
  ["σπόρος σκεπάζει ψεκασμό", "Number(pv.c) < sv.o) rec", "Number(pv.c) > -1) rec"],
  ["σπόρος δεν ανοίγει αυτόματα κλεισμένη", "if (!pv || pv.s === 'auto') rec", "if (!pv) rec"],
  ["σπόρος σε ξένη καλλιέργεια", "if (!(indicators || []).some((x) => x && x.variable === 'fir_message_' + k)) continue;", ""],
  ["σπόρος δεν διαβάζεται", "'declaration_undo', 'case_seed'], // T-JOURNAL-01", "'declaration_undo'], // T-JOURNAL-01"],
  ["σπόρος δεν εφαρμόζεται", "for (const _sk of _sagApplyCaseSeed(_seedCase, measurementsForCrop, indicatorsForCrop)) {", "for (const _sk of []) {"],
];
let dead = 0;
for (const [nm, a, b] of M) {
  if (!SRC.includes(a)) { console.log("✗ άγκυρα δεν βρέθηκε: " + nm); continue; }
  const r = run(SRC.split(a).join(b));
  if (r.length) { dead++; console.log("✔ σκοτώθηκε: " + nm); } else console.log("✗ ΕΠΕΖΗΣΕ: " + nm);
}
console.log("μεταλλάξεις: " + dead + "/" + M.length);
process.exit(dead === M.length ? 0 : 1);
