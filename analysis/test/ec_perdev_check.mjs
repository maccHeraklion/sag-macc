// Ελεγκτής widget · W-EC-PERDEV-01 (29/10/2026): σε αγρό με ΠΟΛΛΟΥΣ αισθητήρες αγωγιμότητας στο ίδιο βάθος, κάθε κάρτα και
// κάθε διάγραμμα «EC στη ρίζα» βγαίνει από τον ΔΙΚΟ του αισθητήρα — όχι από την τιμή του αγρού (μέσος όρος όλων).
// Αφορμή: Καμπιτάκης BIO, 29/10 — Μάρτυρας βαθύ θ 13,6 % έδειχνε «4,3 mS/cm» (μέσος θ αγρού 15,8 %), ενώ τα ρηχά
// έλεγαν «Αγωγιμότητα εδάφους» με άλλο τίτλο. Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα του widget και τον ΕΚΤΕΛΕΙ.
// Διαφορικό: ο τύπος του widget (sagEceChain9) = _sagEcChain του ΠΡΑΓΜΑΤΙΚΟΥ πυρήνα σε πλέγμα τιμών. Μεταλλάξεις σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const req = createRequire(KPATH);
function loadKernelChain() {
  const shim = (m) => {
    if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null, envToJson: () => ({}) } }; }
    return req(m);
  };
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const proc = { env: {}, exit() {}, on() {}, version: process.version, versions: process.versions };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", CORE + "\n;return _sagEcChain;")(
    shim, { exports: {} }, {}, proc, quiet, path.dirname(KPATH), KPATH);
}
const KCHAIN = loadKernelChain();
function cut(src, a, b, label, inclB = true) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const pt = (v, t = "2026-10-29T16:12:38.000Z") => [{ v, t }];
// Καμπιτάκης BIO 29/10 ~18:10 (ώρα Ελλάδας), από τα στιγμιότυπα: ρηχό/βαθύ θ και T· αγωγιμότητα ρηχού από τις κάρτες.
const FIELD = "6a841fdbef7327000b112a95", MAR = "6a7c73108b06e3000cb27004", PEL = "6a7c72b046a750000ce1866e", BIO = "6a7c720c23232f000cf5583b";
const KAMP = {
  [FIELD]: { field_bundle: pt(1) },
  [MAR]: { conduct_soil1: pt(131), soil_moisture1: pt(16.2), soil_temperature1: pt(18.4), conduct_soil2: pt(160), soil_moisture2: pt(13.6), soil_temperature2: pt(18.1) },
  [PEL]: { conduct_soil1: pt(52), soil_moisture1: pt(8.58), soil_temperature1: pt(18.3), conduct_soil2: pt(180), soil_moisture2: pt(15.9), soil_temperature2: pt(18.9) },
  [BIO]: { conduct_soil1: pt(213), soil_moisture1: pt(12.8), soil_temperature1: pt(17.0), conduct_soil2: pt(185), soil_moisture2: pt(17.9), soil_temperature2: pt(18.5) },
};
const KAMP_FIELD_BOX = { soil_ece1: { value: null, metadata: { text: "Όργανο 0,133 dS/m (ρηχό) — αλλάζει με την υγρασία, δεν συγκρίνεται με όρια. Χωρίς συγκρίσιμη τιμή: υγρασία κάτω από 15 % — ο τύπος Hilhorst δεν ισχύει σε τόσο ξηρό έδαφος." } },
  soil_ece2: { value: 1.62, metadata: { tol: 2.7 } }, soil_ec_pore2: { value: 4.3 } };
const RAMM = { soil_ece1: { value: 1.71, metadata: { tol: 2.5 } }, soil_ec_pore1: { value: 3.14 }, soil_ece2: { value: 1.33, metadata: { tol: 2.5 } }, soil_ec_pore2: { value: 2.78 } };
const AMM = { F: { field_bundle: pt(1) }, S: { conduct_soil1: pt(316), soil_moisture1: pt(23.5), soil_temperature1: pt(23), conduct_soil2: pt(223), soil_moisture2: pt(20.7), soil_temperature2: pt(23) } };

function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const helpers = cut(w, "sagEceBox={v:null}", ",sagPendKey=", "βοηθοί", false);
    const H = new Function("let " + helpers + ";\nreturn {sagEceSet, sagFertSet, sagEceCard, sagEceF9, sagEceChain9, sagEceMulti9};")();
    // ── Δ: διαφορικό τύπου widget ↔ πυρήνα ──
    let cmp = 0, num = 0, bad = 0, ex = "";
    for (const raw of [NaN, -1, 0, 5, 29, 30, 52, 131, 173, 223, 316, 900, 2500])
      for (const th of [NaN, 0, 8.58, 12.8, 14.99, 15, 15.01, 15.8, 16.2, 23.5, 40, 60])
        for (const tc of [NaN, 0, 10, 18.4, 25, 35]) {
          const k = KCHAIN(raw, th, tc, NaN), q = H.sagEceChain9(raw, th, tc); cmp++;
          const kp = k.pore, wp = q.p;
          if (kp === null || wp === null) { if (!(kp === null && wp === null && k.why === q.why)) { bad++; ex = ex || [raw, th, tc, kp, wp, k.why, q.why].join("|"); } }
          else { num++; if (Math.abs(kp - wp) > 1e-12) { bad++; ex = ex || [raw, th, tc, kp, wp].join("|"); } }
        }
    ok(bad === 0, "Δ1 ο τύπος του widget διαφέρει από τον πυρήνα σε " + bad + "/" + cmp + " (π.χ. " + ex + ")");
    ok(num >= 200, "Δ2 το διαφορικό συγκρίνει ΠΡΑΓΜΑΤΙΚΟΥΣ αριθμούς: " + num);
    // ── Κ: Καμπιτάκης, 3 αισθητήρες ανά βάθος ──
    H.sagEceSet(KAMP_FIELD_BOX); H.sagFertSet(null);
    ok(H.sagEceMulti9(KAMP, "conduct_soil2") === true && H.sagEceMulti9(AMM, "conduct_soil2") === false, "Κ0 ανίχνευση πολλών αισθητήρων");
    const exp = (raw, th, tc) => { const k = KCHAIN(raw, th, tc, NaN); return k.pore === null ? "—" : H.sagEceF9(k.pore, 1) + " mS/cm"; };
    const cards = {};
    for (const [dev, nm] of [[MAR, "Μάρτυρας"], [PEL, "Pellet"], [BIO, "Βιοδιεγέρτης"]])
      for (const q of ["1", "2"]) {
        const c = H.sagEceCard("conduct_soil" + q, KAMP, dev); cards[nm + q] = c;
        const d = KAMP[dev];
        ok(c && c.t === "💧 EC στη ρίζα " + (q === "1" ? "Ρηχό" : "Βαθύ"), "Κ1 " + nm + q + ": ΙΔΙΟΣ τίτλος σε όλες τις κάρτες (" + (c && c.t) + ")");
        ok(c && c.v === exp(d["conduct_soil" + q][0].v, d["soil_moisture" + q][0].v, d["soil_temperature" + q][0].v),
          "Κ2 " + nm + q + ": τιμή από τον ΔΙΚΟ του αισθητήρα (" + (c && c.v) + " ≠ " + exp(d["conduct_soil" + q][0].v, d["soil_moisture" + q][0].v, d["soil_temperature" + q][0].v) + ")");
        ok(c && !/ECe|όριο καλλιέργειας/.test(c.sub || ""), "Κ3 " + nm + q + ": χωρίς ECe/όριο (είναι τιμή αγρού)");
      }
    ok(cards["Μάρτυρας2"].v === "—" && /υγρασία κάτω από 15/.test(cards["Μάρτυρας2"].sub), "Κ4 Μάρτυρας βαθύ θ 13,6 → «—» με αιτία (" + JSON.stringify(cards["Μάρτυρας2"]) + ")");
    ok(cards["Μάρτυρας1"].v !== "—" && /από αυτόν τον αισθητήρα/.test(cards["Μάρτυρας1"].sub), "Κ5 Μάρτυρας ρηχό θ 16,2 → δική του τιμή (" + JSON.stringify(cards["Μάρτυρας1"]) + ")");
    ok(cards["Pellet1"].v === "—" && cards["Βιοδιεγέρτης1"].v === "—", "Κ6 ξηρά ρηχά → «—»");
    ok(cards["Pellet2"].v !== "4,3 mS/cm" || cards["Βιοδιεγέρτης2"].v !== "4,3 mS/cm", "Κ7 όχι πια η ΙΔΙΑ τιμή αγρού σε όλους");
    H.sagFertSet(3.3);
    const cf = H.sagEceCard("conduct_soil2", KAMP, BIO);
    ok(/^ρίχνετε 3,3 → στη ρίζα \d+ % · από αυτόν τον αισθητήρα$/.test(cf.sub), "Κ8 σύγκριση με το διάλυμα (" + cf.sub + ")");
    const DEAD = JSON.parse(JSON.stringify(KAMP)); DEAD[PEL].conduct_soil2 = pt(10); DEAD[PEL].soil_moisture2 = pt(25);
    const cd = H.sagEceCard("conduct_soil2", DEAD, PEL);
    ok(cd.v === "—" && /ελέγξτε τον αισθητήρα/.test(cd.sub), "Κ9 όργανο ~0 σε υγρό χώμα → «—» (" + JSON.stringify(cd) + ")");
    const NOM = JSON.parse(JSON.stringify(KAMP)); delete NOM[PEL].soil_moisture2;
    const cn = H.sagEceCard("conduct_soil2", NOM, PEL);
    ok(cn && cn.v === "—" && /χωρίς μέτρηση υγρασίας/.test(cn.sub), "Κ9β σόνδα χωρίς υγρασία → «χωρίς μέτρηση», όχι «κάτω από 15 %» (" + JSON.stringify(cn) + ")");
    const NOEC = JSON.parse(JSON.stringify(KAMP)); delete NOEC[MAR].conduct_soil2;
    ok(H.sagEceCard("conduct_soil2", NOEC, MAR) === null, "Κ10 συσκευή χωρίς αγωγιμότητα → καμία αντικατάσταση");
    ok(H.sagEceCard("soil_moisture2", KAMP, MAR) === null, "Κ11 άλλες μεταβλητές ανέγγιχτες");
    // ── Α: ένας αισθητήρας (Αμμουδάρες) → τιμή αγρού όπως πριν ──
    H.sagEceSet(RAMM); H.sagFertSet(3.3);
    const a1 = H.sagEceCard("conduct_soil1", AMM, "S"), a0 = H.sagEceCard("conduct_soil1");
    ok(a1 && a1.v === "3,1 mS/cm" && a1.sub === "ρίχνετε 3,3 → στη ρίζα 95 % · κλίμακα εργαστηρίου (ECe) 1,7 · όριο καλλιέργειας 2,5", "Α1 ένας αισθητήρας: τιμή αγρού + ECe (" + JSON.stringify(a1) + ")");
    ok(J(a0) === J(a1), "Α2 χωρίς δεδομένα συσκευών: ίδια συμπεριφορά");
    H.sagEceSet({ soil_ece1: { value: null, metadata: { text: "Χωρίς συγκρίσιμη τιμή: υγρασία κάτω από 15 %." } } });
    const a3 = H.sagEceCard("conduct_soil1", AMM, "S");
    ok(a3 && a3.t === "💧 EC στη ρίζα Ρηχό" && a3.v === "—" && /υγρασία κάτω από 15/.test(a3.sub), "Α3 χωρίς τιμή: ίδιος τίτλος + «—» (" + J(a3) + ")");
    H.sagEceSet({ soil_ece1: { value: null, metadata: { text: "x. Χωρίς συγκρίσιμη τιμή: χωρίς κοκκομετρία." } }, soil_ec_pore1: { value: 2.5 } });
    const a4 = H.sagEceCard("conduct_soil1", AMM, "S");
    ok(a4 && a4.v === "2,5 mS/cm" && !/ECe/.test(a4.sub), "Α4 σ_w χωρίς ECe → η σ_w (" + J(a4) + ")");
    // ── Γ: διάγραμμα αισθητήρα (σειρά από τον ΔΙΚΟ του αισθητήρα) ──
    const decl = cut(w, "const _q8=_sagEc9[1],", ";if(_S8.length)", "διάγραμμα", false);
    const G = new Function("n", "t", "ue", "_sagEc9", "sagEceMT9", "sagEceChain9", "sagFertBox", decl + ";return {_S8,_cnt8};");
    const MT9 = (q) => q === "" ? ["soil_moisture", "temp_soil"] : ["soil_moisture" + q, "soil_temperature" + q];
    const T0 = "2026-10-29T10:00:00Z", T1 = "2026-10-29T11:00:00Z", T2 = "2026-10-29T12:00:00Z";
    const HIST = { [FIELD]: { soil_ec_pore2: [{ v: 4.3, t: T2 }] },
      [PEL]: { conduct_soil2: [{ v: 150, t: T0 }, { v: 180, t: T1 }, { v: 200, t: T2 }], soil_moisture2: [{ v: 14, t: T0 }, { v: 15.9, t: T1 }, { v: 21, t: T2 }],
        soil_temperature2: [{ v: 18, t: T0 }, { v: 18.9, t: T1 }, { v: 20, t: T2 }] },
      [MAR]: { conduct_soil2: [{ v: 160, t: T2 }] } };
    const g = G("conduct_soil2", { history: HIST }, PEL, ["conduct_soil2", "2"], MT9, H.sagEceChain9, { v: 3.3 });
    const k1 = KCHAIN(180, 15.9, 18.9, NaN).pore, k2 = KCHAIN(200, 21, 20, NaN).pore;
    ok(g._S8.length === 2 && g._S8[0].t === T1 && g._S8[1].t === T2, "Γ1 σειρά: ξηρή ώρα (14 %) παραλείπεται (" + J(g._S8) + ")");
    ok(g._S8.length === 2 && g._S8[0].v === Number(k1.toFixed(3)) && g._S8[1].v === Number(k2.toFixed(3)), "Γ2 κάθε σημείο με τη ΔΙΚΗ του ώρα υγρασίας/θερμ. = πυρήνας");
    ok(g._cnt8 === 2, "Γ3 πλήθος αισθητήρων στο βάθος (" + g._cnt8 + ")");
    // ── Σ: καλωδίωση ──
    ok(w.includes("_E9=sagEceCard(j,r,s)"), "Σ1 παράθυρο συσκευής περνά δεδομένα + συσκευή");
    ok(w.includes("_E9=sagEceCard(N,r,D)"), "Σ2 «Όλες οι μετρήσεις» περνά δεδομένα + συσκευή");
    ok(w.includes('if(_sagEc9&&h&&sagEceMulti9(t.history,n)){/* W-EC-PERDEV-01 */') && w.includes('else if(_sagEc9&&h){/* W-EC-ROOT-01 */'), "Σ3 διάγραμμα: κλάδος πολλών αισθητήρων πριν από τον κλάδο αγρού");
    ok(w.includes('b("soil_ec_pore"+_q8);B("💧 EC στη ρίζα "+_dp8+" — "+it(ue));w(ue);j(_S8);$("mS/cm");P(_l8)'), "Σ4 διάγραμμα: σειρά/τίτλος/συσκευή του αισθητήρα");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const J = (x) => JSON.stringify(x);
const base = run(WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (διαφορικό widget ↔ πυρήνας, Καμπιτάκης 3×2, Αμμουδάρες, διάγραμμα)");
const MUT = [
  ["m1 χωρίς κλάδο πολλών αισθητήρων", "if(DV&&dv&&sagEceMulti9(DV,M[0]))return sagEceDev9", "if(false)return sagEceDev9"],
  ["m2 κλάδος και με ΕΝΑΝ αισθητήρα", "a&&a.length&&c++}return c>1}", "a&&a.length&&c++}return c>0}"],
  ["m3 ε0 4,0", "e25/(eb-4.1)", "e25/(eb-4.0)"],
  ["m4 όριο υγρασίας 14 %", "th<=0.15)return{p:null", "th<=0.14)return{p:null"],
  ["m5 χωρίς αναγωγή θερμοκρασίας", "tf=1+0.02*(t-25),e25", "tf=1,e25"],
  ["m6 χωρίς πύλη νεκρού οργάνου", "if(Number.isFinite(th)&&th>15&&raw<30)return{t:t9", "if(false)return{t:t9"],
  ["m7 υγρασία άλλου αισθητήρα", "th=sagEceLast9(DV,dv,mt[0])", "th=sagEceLast9(DV,Object.keys(DV)[1],mt[0])"],
  ["m8 παράθυρο συσκευής χωρίς δεδομένα", "_E9=sagEceCard(j,r,s)", "_E9=sagEceCard(j)"],
  ["m9 «Όλες οι μετρήσεις» χωρίς δεδομένα", "_E9=sagEceCard(N,r,D)", "_E9=sagEceCard(N)"],
  ["m10 διάγραμμα στη συσκευή αγρού", "w(ue);j(_S8)", "w(h);j(_S8)"],
  ["m11 διάγραμμα με μία υγρασία για όλα", "th=_nn8(_mm8.get(String(x.t)))", "th=_nn8((_H8[_mt8[0]]||[{}]).slice(-1)[0].v)"],
  ["m12 ξηρές ώρες ως μηδέν", "return c.p===null?null:{...x", "return c.p===null?{...x,v:0}:{...x"],
  ["m13 χωρίς τιμή → παλιός τίτλος", 'if(e9===null&&p9===null)return{t:"💧 EC στη ρίζα"+d9', "if(e9===null&&p9===null)return{t:null"],
  ["m15 χωρίς υγρασία ως «κάτω από 15 %»", "/* W-EC-PERDEV-02 */if(!Number.isFinite(th))return", "/* W-EC-PERDEV-02 */if(false)return"],
  ["m14 ECe στην κάρτα αισθητήρα", '"","από αυτόν τον αισθητήρα"]', '"","κλίμακα εργαστηρίου (ECe) 1,6"]'],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = WID.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(WID.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 140)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
