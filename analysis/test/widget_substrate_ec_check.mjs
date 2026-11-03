// Ελεγκτής W-SUBSTRATE-EC-01 + W-CHART-GAP-01 (3/11/2026, Κοκοφοίνικας: διάγραμμα 1,2 vs κάρτα 4,90 mS/cm).
// (α) με υπόστρωμα coir το widget ΔΕΝ βγάζει «EC στη ρίζα» (όπως ο πυρήνας T-SUBSTRATE-01) — μένει η μέτρηση του οργάνου·
// (β) το διάγραμμα υγρασίας/αγωγιμότητας εδάφους δεν σχεδιάζει/μετρά μηδενικά (σόνδα εκτός μέσου) και σπάει σε κενά > 6 ω.
// Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα του widget. Τιμές: Κοκοφοίνικας 3/11 14:29 (EC όργανο 1032 µS/cm, θ 35,98 %, 22,5 °C).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
function cut(src, a, b, label, inclB = false) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const T = (h) => "2026-11-03T" + h + ":00Z";
function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const helpers = cut(w, "/* W-DEPTH1-01 */sagDepthBox={v:2,p:1},", ",sagPendKey=", "βοηθοί");
    const H = new Function("let " + helpers + ";\nreturn {sagSubSet, sagSubBox, sagEceCard, sagEceSet, sagFertSet};")();
    const DV = { "SE0X": { conduct_soil2: [{ t: T("14:29"), v: 1032 }], soil_moisture2: [{ t: T("14:29"), v: 35.98 }], soil_temperature2: [{ t: T("14:29"), v: 22.51 }] } };
    H.sagEceSet({ soil_ec_pore2: { value: 4.9 } }); H.sagFertSet(null);
    H.sagSubSet(false);
    const c0 = H.sagEceCard("conduct_soil2", DV, "SE0X");
    ok(c0 && /EC στη ρίζα/.test(c0.t), "Α1 χώμα: κάρτα «EC στη ρίζα» όπως πριν (" + JSON.stringify(c0 && c0.t) + ")");
    H.sagSubSet(true);
    ok(H.sagEceCard("conduct_soil2", DV, "SE0X") === null && H.sagEceCard("conduct_soil1", DV, "SE0X") === null, "Α2 υπόστρωμα: ΚΑΜΙΑ κάρτα «EC στη ρίζα» — μένει η μέτρηση του οργάνου");
    ok(w.includes('sagSubSet(!!o&&(o.soil_type==="coir"||o.soil_texture_class==="coir"));return vv}') && w.includes("sagDepthSet(2,1);sagSubSet(!1);return!1}"), "Α3 σημαία από τη ρύθμιση (κανόνας πυρήνα _sagSubstrateOf)");
    ok(w.includes("if(_sagEc9&&h&&!sagSubBox.v&&sagEceMulti9(t.history,n)){") && w.includes("}else if(_sagEc9&&h&&!sagSubBox.v){/* W-EC-ROOT-01 */"), "Α4 διαγράμματα «EC στη ρίζα» κλειστά σε υπόστρωμα");
    ok(/if\(s&&sagSubBox\.v&&\/\^conduct_soil\\d\?\$\/\.test\(String\(t\)\)\)s=\{\.\.\.s,label:s\.label\.replace\("Αγωγιμότητα εδάφους","Αγωγιμότητα υποστρώματος \(όργανο\)"\)\};/.test(w), "Α5 ετικέτα «Αγωγιμότητα υποστρώματος (όργανο)»");
    // ── διάγραμμα ──
    const body = cut(w, ",V=l.useMemo(()=>{/* W-CHART-GAP-01 */", ",[E,m,s])", "διάγραμμα").replace(",V=l.useMemo(()=>{/* W-CHART-GAP-01 */", "").replace(/\}$/, "");
    const V = (s, E) => new Function("E", "m", "s", body + "")(E, (x) => Number(x) / 1000, s);
    const E = [{ t: T("00:29").replace("11-03", "09-09"), v: 0 }, { t: "2026-09-28T08:05:00Z", v: 0 }, { t: T("10:08"), v: 396 }, { t: T("10:31"), v: 397 }, { t: T("13:51"), v: 1212 }];
    const v1 = V("conduct_soil2", E);
    ok(v1.length === 3 && v1[0][1] === 0.396 && v1.every((p) => p[1] !== 0), "Δ1 μηδενικά (σόνδα εκτός υποστρώματος) δεν σχεδιάζονται (" + JSON.stringify(v1) + ")");
    const v2 = V("soil_moisture2", [{ t: "2026-09-28T08:05:00Z", v: 21 }, { t: T("10:08"), v: 22 }, { t: T("10:31"), v: 22.1 }]);
    ok(v2.length === 4 && v2[1][1] === "-" && v2[2][1] === 22 / 1000, "Δ2 κενό > 6 ω σπάει τη γραμμή («-»)");
    ok(Number.isNaN(Number("-")), "Δ2β το «-» δεν μετρά στα στατιστικά (Number → NaN)");
    const v3 = V("air_temperature", [{ t: T("10:00"), v: 0 }, { t: T("11:00"), v: 5 }]);
    ok(v3.length === 2 && v3[0][1] === 0, "Δ3 άλλες μεταβλητές: το 0 μένει (π.χ. θερμοκρασία 0 °C)");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (υπόστρωμα χωρίς «EC στη ρίζα», διάγραμμα χωρίς μηδενικά/γέφυρες κενών)");
const MUT = [
  ["μ1 κάρτα και σε υπόστρωμα", 'if(!M||sagSubBox.v)return null;', 'if(!M)return null;'],
  ["μ2 σημαία δεν τίθεται", 'sagSubSet(!!o&&(o.soil_type==="coir"||o.soil_texture_class==="coir"));return vv}', 'return vv}'],
  ["μ3 διάγραμμα αγρού και σε υπόστρωμα", "}else if(_sagEc9&&h&&!sagSubBox.v){/* W-EC-ROOT-01 */", "}else if(_sagEc9&&h){/* W-EC-ROOT-01 */"],
  ["μ4 μηδενικά σχεδιάζονται", "if(_z&&Number(g.v)===0)continue;", ""],
  ["μ5 κενά γεφυρώνονται", "_o.push([Math.min(_t,_pt)+1,\"-\"]);", ""],
  ["μ6 ετικέτα χώματος", "\"Αγωγιμότητα υποστρώματος (όργανο)\"", "\"Αγωγιμότητα εδάφους\""],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = WID.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(WID.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 110)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
