// Ελεγκτής v50.163 · T-EC-LABEL-01 (29/10/2026): τα κείμενα αλατότητας του πυρήνα λένε «EC στη ρίζα» αντί για
// «Νερό ρίζας» / «Νερό πόρων» — ίδια λέξη με το widget (W-EC-ROOT-01). Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα και
// ΕΚΤΕΛΕΙ τις τρεις συναρτήσεις που γράφουν τα κείμενα, σε 8 σενάρια (ένα για κάθε κείμενο που άλλαξε).
// Διαφορικό έναντι v50.162 (commit 8cdc657): μετά την αντικατάσταση των παλιών λέξεων, ΙΔΙΑ έξοδος — ίδιες τιμές,
// ίδια κλειδιά, ίδια χρώματα, κανένα bundle μεγαλύτερο. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const OLD_COMMIT = "8cdc657";   // v50.162 · c72951b6… (ζωντανός 27/10)
const OLD = execSync("git show " + OLD_COMMIT + ":analysis/runPerTich.js", { cwd: path.join(here, "..", ".."), maxBuffer: 1 << 26 })
  .toString("utf8").replace(/\r\n/g, "\n");
const req = createRequire(KPATH);
const FNS = ["_sagEcIndicators", "_sagEcRefIndicators", "_sagEcDailyVerdict", "SAG_KERNEL_VERSION"];
function load(src) {
  const shim = (m) => {
    if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null, envToJson: () => ({}) } }; }
    return req(m);
  };
  const get = FNS.map((n) => `case ${JSON.stringify(n)}: return typeof ${n} === 'undefined' ? undefined : ${n};`).join("\n");
  const tail = `\n;return { get(n){ switch(n){\n${get}\n} throw new Error('όνομα ' + n); } };`;
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const proc = { env: {}, exit() {}, on() {}, version: process.version, versions: process.versions };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail)(
    shim, { exports: {} }, {}, proc, quiet, path.dirname(KPATH), KPATH);
}
const S = (v) => [{ value: v, time: "2026-10-29T11:22:00.000Z" }];
const J = (x) => JSON.stringify(x);
const OLD_WORDS = /Νερό ρίζας|Νερό πόρων|νερό των πόρων|νερού πόρων|νερό ρίζας/;
const normOld = (t) => t.replace(/«Νερό πόρων»/g, "«EC στη ρίζα»").replace(/Νερό πόρων \(/g, "EC στη ρίζα (")
  .replace(/το νερό των πόρων \(/g, "η EC στη ρίζα (").replace(/αναφορά νερού πόρων/g, "EC στη ρίζα")
  .replace(/Νερό ρίζας /g, "EC στη ρίζα ");
// Αμμουδάρες 29/10 11:22 (ρηχό 316 µS/cm / 23,5 % · βαθύ 223 / 20,7 %), ντομάτα σε αμμώδες, λίπασμα 3,3.
const PARAMS = { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "vegetative", soil_type: "sandy" };
const M = { timezone: "Europe/Athens", data: { conduct_soil1: S(316), soil_moisture1: S(23.5), soil_temperature1: S(23),
  conduct_soil2: S(223), soil_moisture2: S(20.7), soil_temperature2: S(23) } };
const PREV = { ec_ref_state: { value: J({ "1": { th: 21.9, sw: 2.9, t: 22.2, ts: "2026-10-28T04:22:00Z" }, "2": { th: 19.4, sw: 2.8, t: 22.4, ts: "2026-10-28T04:22:00Z" } }) } };
const V = (o) => Object.assign({ today: "2026-10-29", refHist: [] }, o);
// Σενάρια → [ετικέτα, συνάρτηση, ορίσματα, κείμενο που ΠΡΕΠΕΙ να εμφανιστεί]
const CASES = [
  ["Λ7+Λ8 soil_ece / κατάσταση", "_sagEcIndicators", [M, PARAMS, undefined], ["EC στη ρίζα 3,", "«EC στη ρίζα» ↔ όργανο σε ΥΓΡΟ"]],
  ["Λ1 soil_ec_ref", "_sagEcRefIndicators", [M, PREV, true, "2026-10-29T11:22:00Z"], ["EC στη ρίζα (ρηχό) στο ξηρότερο δείγμα"]],
  ["Λ6 ημερήσια κρίση", "_sagEcDailyVerdict", [V({ ref1: 2.93, ref2: 2.8, fert: 3.3, ecw: 0.8 })], ["EC στη ρίζα 2,93 dS/m (προ-αρδευτικά), λίπασμα 3,3"]],
  ["Λ5 χωρίς λίπανση", "_sagEcDailyVerdict", [V({ ref1: 2.9, ecw: 0.8 })], ["EC στη ρίζα 2,9 dS/m (προ-αρδευτικά). Δηλώστε"]],
  ["Λ2+Λ4 ασύμβατες δηλώσεις", "_sagEcDailyVerdict", [V({ ref1: 9.5, fert: 3.3, ecw: 0.8 })], ["η EC στη ρίζα (9,5", "EC στη ρίζα 9,5 dS/m (προ-αρδευτικά) — ασύμβατο"]],
  ["Λ3 αναμονή αναφοράς", "_sagEcDailyVerdict", [V({ fert: 3.3, ecw: 0.8 })], ["προ-αρδευτική EC στη ρίζα (ξηρότερο"]],
];
function run(core) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core), O = load(OLD);
    let realOld = 0;
    for (const [lab, fn, args, must] of CASES) {
      const a = J(K.get(fn)(...JSON.parse(J(args)))), b = J(O.get(fn)(...JSON.parse(J(args))));
      if (OLD_WORDS.test(b)) realOld++;
      ok(a.length > 40 && !/undefined|NaN/.test(a), lab + ": κενή/χαλασμένη έξοδος " + a.slice(0, 120));
      ok(!OLD_WORDS.test(a), lab + ": έμεινε παλιά λέξη → " + (a.match(/.{0,30}(Νερό ρίζας|Νερό πόρων|νερό των πόρων|νερού πόρων).{0,30}/) || [""])[0]);
      for (const m of must) ok(a.includes(m), lab + ": λείπει «" + m + "»");
      ok(a === normOld(b), lab + ": ΔΙΑΦΟΡΑ πέρα από τη λέξη έναντι v50.162");
      ok(Buffer.byteLength(a) <= Buffer.byteLength(b), lab + ": μεγαλύτερο σε bytes (" + Buffer.byteLength(a) + " > " + Buffer.byteLength(b) + ")");
    }
    ok(realOld === CASES.length, "Δ το διαφορικό ΒΛΕΠΕΙ τις παλιές λέξεις σε κάθε σενάριο (" + realOld + "/" + CASES.length + ")");
    ok(K.get("SAG_KERNEL_VERSION") === "v50.166 · 2026-10-31" && O.get("SAG_KERNEL_VERSION") === "v50.162 · 2026-10-27", "Ε εκδόσεις");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(CORE);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (6 σενάρια, 8 κείμενα, διαφορικό έναντι " + OLD_COMMIT + ")");
const MUT = [
  ["m1 Λ1", "text: 'EC στη ρίζα (' + c.el", "text: 'Νερό πόρων (' + c.el"],
  ["m2 Λ2", ": η EC στη ρίζα (' + f(refF, 2)", ": το νερό των πόρων (' + f(refF, 2)"],
  ["m3 Λ3", "προ-αρδευτική EC στη ρίζα (ξηρότερο", "προ-αρδευτική αναφορά νερού πόρων (ξηρότερο"],
  ["m4 Λ4", "t: 'EC στη ρίζα ' + f(refF, 2) + ' dS/m (προ-αρδευτικά) — ασύμβατο", "t: 'Νερό ρίζας ' + f(refF, 2) + ' dS/m (προ-αρδευτικά) — ασύμβατο"],
  ["m5 Λ5", "t: 'EC στη ρίζα ' + f(refF, 2) + ' dS/m (προ-αρδευτικά). Δηλώστε", "t: 'Νερό ρίζας ' + f(refF, 2) + ' dS/m (προ-αρδευτικά). Δηλώστε"],
  ["m6 Λ6", "const rt = 'EC στη ρίζα '", "const rt = 'Νερό ρίζας '"],
  ["m7 Λ7", "+ 'EC στη ρίζα ' + _fmt(r.pore, 2)", "+ 'Νερό ρίζας ' + _fmt(r.pore, 2)"],
  ["m8 Λ8", "ΣΤΟ ΧΩΜΑ · «EC στη ρίζα» '", "ΣΤΟ ΧΩΜΑ · «Νερό πόρων» '"],
  ["m9 αλλαγή τιμής (όχι μόνο λέξης)", "const rt = 'EC στη ρίζα ' + f(refF, 2)", "const rt = 'EC στη ρίζα ' + f(refF, 1)"],
  ["m10 έκδοση", "'v50.166 · 2026-10-31'", "'v50.162 · 2026-10-27'"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = CORE.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(CORE.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 140)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
