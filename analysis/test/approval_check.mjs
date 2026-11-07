// Ελεγκτής T-APPROVAL-01 (v50.185, 7/11/2026): SIVANTO PRIME (flupyradifurone) από την έγκριση ΥΠΑΑΤ 14670 —
// ουσία, συνώνυμα, πίνακας χρήσεων ανά καλλιέργεια, PHI της έγκρισης ανά καλλιέργεια, κανονιστική εικόνα.
// Μεταλλάξεις: κάθε βλάβη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { SAG_KERNEL_VERSION, PESTICIDE_PROFILE, PESTICIDE_PROPOSAL_PROFILE, _SAG_PEST_REF_ALIAS, _sagFindPesticideByRef, _sagPesticideKeyByRef, _sagApprovalUse, _sagDeclaredSprayInfo };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.186 · 2026-11-07", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    // Α · συνώνυμα και ουσία
    ok(K._sagPesticideKeyByRef("Sivanto") === "flupyradifurone" && K._sagPesticideKeyByRef("SIVANTO PRIME") === "flupyradifurone"
      && K._sagPesticideKeyByRef("Sivanto Prime 200 SL") === "flupyradifurone" && K._sagPesticideKeyByRef("flupyradifurone") === "flupyradifurone",
      "Α1 συνώνυμα Sivanto → flupyradifurone (" + K._sagPesticideKeyByRef("Sivanto") + ")");
    const P = K._sagFindPesticideByRef("sivanto");
    ok(P && P.PHI_days === 30 && P.residualDays === 10 && P.approval && P.approval.number === "14670" && P.approval.expires === "2030-06-09",
      "Α2 ουσία: PHI εφεδρεία 30, residual 10, άδεια 14670 έως 2030-06-09");
    ok(P && Array.isArray(P.approval.uses) && P.approval.uses.length === 14, "Α3 14 γραμμές χρήσεων (" + (P && P.approval && P.approval.uses ? P.approval.uses.length : "-") + ")");
    ok(P && ["bactrocera_oleae", "saissetia_oleae", "myzus_persicae", "bemisia_tabaci", "asymmetrasca_decedens", "empoasca_decipiens"].every((k) => P.targetPathogen_keys.includes(k)),
      "Α4 στόχοι: δάκος, λεκάνιο, Myzus, αλευρώδης, τζιτζικάκια");
    ok(K.PESTICIDE_PROFILE.insecticides && K.PESTICIDE_PROFILE.insecticides.flupyradifurone === P, "Α5 η ουσία είναι στα εντομοκτόνα");
    // Β · πίνακας χρήσεων ανά καλλιέργεια
    const u = (hk, cov) => K._sagApprovalUse(P, hk, cov);
    const tC = u("vegetableCrops:tomato", true), tO = u("vegetableCrops:tomato", false);
    ok(tC && tC.phi_days === 3 && tC.max_apps === 2 && tC.interval_days === 10, "Β1 ντομάτα θερμοκηπίου: PHI 3, 2 εφαρμογές/10 ημ. (" + JSON.stringify(tC && { p: tC.phi_days, m: tC.max_apps, i: tC.interval_days }) + ")");
    ok(tO && tO.phi_days === 3 && tO.max_apps === 1, "Β2 ντομάτα υπαίθρου: PHI 3, 1 εφαρμογή");
    ok(u("olive:koroneiki", false) && u("olive:koroneiki", false).phi_days === 14, "Β3 ελιά: PHI 14 (μέσω olive:*)");
    ok(u("citrusFruits:lemon", false) && u("citrusFruits:lemon", false).phi_days === 30, "Β4 λεμονιά: PHI 30");
    ok(u("stoneFruits:cherry", false) && u("stoneFruits:cherry", false).phi_days === 7 && u("stoneFruits:plum", false).phi_days === 14, "Β5 κερασιά 7 / δαμασκηνιά 14");
    ok(u("vegetableCrops:melon", false) === null && u("vegetableCrops:melon", true) === null, "Β6 πεπόνι: δεν είναι στην έγκριση → null");
    ok(u("stoneFruits:peach", true) === null && u("stoneFruits:peach", false) && u("stoneFruits:peach", false).phi_days === 14, "Β7 ροδακινιά μόνο υπαίθρου");
    ok(u("industrialCrops:tobacco", false) && u("industrialCrops:tobacco", false).phi_days === null, "Β8 καπνός: PHI «μη εφαρμόσιμο» = null");
    const fake = { approval: { uses: [{ crops: ["x:*"], phi_days: 9, covered: "both" }, { crops: ["x:y"], phi_days: 2, covered: "both" }] } };
    ok(K._sagApprovalUse(fake, "x:y", false).phi_days === 2 && K._sagApprovalUse(fake, "x:z", true).phi_days === 9 && K._sagApprovalUse(null, "x:y", false) === null && K._sagApprovalUse({}, "x:y", false) === null,
      "Β9 ακριβής τύπος υπερισχύει του *, χωρίς πίνακα → null");
    // Γ · η σύνδεση με το PHI ανά καλλιέργεια (T-PHI-PERCROP-01) υπάρχει στον κύριο βρόχο
    ok(/_phiSpr\.push\(\{ end: _endMs2, k: _pk, days: _ph,\n[^\n]*\n\s+p: _rec2\.p, dMs: _dMs,/.test(src), "Γ1 η λίστα PHI κρατά σκεύασμα και ημερομηνία");
    ok(src.includes("if (_sp2.h === null || _sp2.h === undefined) {\n                  const _use = _sagApprovalUse(_sagFindPesticideByRef(_sp2.p), _hk, !!_SAG_COVERED_ACTIVE);")
      && src.includes("if (_endA <= Date.now()) continue;") && src.includes("if (!_best || _cand.end > _best.end) _best = _cand;"),
      "Γ2 ο βρόχος ανά καλλιέργεια εφαρμόζει το PHI της έγκρισης όταν ο αγρότης δεν δήλωσε δικό του");
    // Δ · δήλωση ψεκασμού με «Sivanto» χωρίς ημέρες → προστασία 10 ημερών (residual της ουσίας)
    const d2 = new Date(Date.now() - 2 * 86400000).toISOString();
    const meas = { data: { "last_spray_bemisia_tabaci": [{ value: JSON.stringify({ d: d2, p: "Sivanto", w: 0 }) }] } };
    const inf = K._sagDeclaredSprayInfo(meas, "bemisia_tabaci");
    ok(inf && inf.active && inf.residual === 10 && inf.daysLeft === 8 && inf.pei > 0.5, "Δ1 δήλωση «Sivanto» χωρίς ημέρες: residual 10, 8 ημέρες ακόμη (" + JSON.stringify(inf && { r: inf.residual, l: inf.daysLeft, pei: +inf.pei.toFixed(2) }) + ")");
    // Ε · κανονιστική εικόνα + καθαρισμός
    const R = K.PESTICIDE_PROPOSAL_PROFILE.flupyradifurone;
    ok(R && R.proposal_allowed === true && R.regulatory_state === "approved" && R.modeOfActionGroup === "IRAC 4D", "Ε1 κανονιστική εικόνα: approved, IRAC 4D");
    ok(!/Innodays/.test(src), "Ε2 κανένα «Innodays» στον πυρήνα");
  } catch (e) { f.push("εξαίρεση: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
  return f;
}
const base = run(SRC);
console.log(base.length === 0 ? "ΒΑΣΗ: ΟΛΑ ΟΚ" : "ΒΑΣΗ ΑΠΟΤΥΧΙΕΣ:\n - " + base.join("\n - "));
const MUT = [
  ["m1 έκδοση", (s) => s.replace("'v50.186 · 2026-11-07'", "'v50.183 · 2026-11-07'")],
  ["m2 χωρίς συνώνυμα", (s) => s.replace("  'sivanto': 'flupyradifurone', 'sivanto prime': 'flupyradifurone', 'sivanto prime 200 sl': 'flupyradifurone',\n", "")],
  ["m3 λάθος PHI θερμοκηπίου", (s) => s.replace("max_apps: 2, interval_days: 10, phi_days: 3, covered: \"covered\" },\n              { crops: [\"vegetableCrops:lettuce\"]", "max_apps: 2, interval_days: 10, phi_days: 4, covered: \"covered\" },\n              { crops: [\"vegetableCrops:lettuce\"]")],
  ["m4 χωρίς πίνακα χρήσεων", (s) => s.replace("          approval: {\n            authority: \"ΥΠΑΑΤ\", number: \"14670\"", "          approvalX: {\n            authority: \"ΥΠΑΑΤ\", number: \"14670\"")],
  ["m5 * πριν τον ακριβή τύπο", (s) => s.replace("    return exact || wild || null;", "    return wild || exact || null;")],
  ["m6 ο βρόχος PHI αγνοεί την έγκριση", (s) => s.replace("if (_sp2.h === null || _sp2.h === undefined) {\n                  const _use = _sagApprovalUse(", "if (false) {\n                  const _use = _sagApprovalUse(")],
  ["m7 residual 7 αντί 10", (s) => s.replace("          residualDays: 10,\n          washoffFactor: 0.01,", "          residualDays: 7,\n          washoffFactor: 0.01,")],
  ["m8 Innodays ξανά", (s) => s.replace("τρεις εγγραφές με κοινόχρηστους αισθητήρες", "Innodays με κοινόχρηστους αισθητήρες")],
];
let killed = 0;
for (const [name, fn] of MUT) {
  const m = fn(SRC);
  if (m === SRC) { console.log("ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + name); continue; }
  const r = run(m);
  if (r.length) { killed++; console.log("σκοτώθηκε " + name + " → " + r[0]); } else console.log("ΕΠΕΖΗΣΕ " + name);
}
console.log("μεταλλάξεις: " + killed + "/" + MUT.length);
if (base.length || killed !== MUT.length) process.exit(1);
