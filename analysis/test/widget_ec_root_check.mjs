// Ελεγκτής widget · W-EC-ROOT-01 (29/10/2026): το πλακίδιο δείχνει «EC στη ρίζα» σε mS/cm δίπλα σε ό,τι ρίχνει ο
// παραγωγός και την κλίμακα εργαστηρίου (ECe) με το όριο της καλλιέργειας· το διάγραμμα δείχνει τη σειρά soil_ec_pore με
// γραμμή «Διάλυμα που ρίχνετε» (αλλιώς soil_ece με όριο) και κουτί εξήγησης. Τιμές: Αμμουδάρες 29/10 (ρηχό 3,14 / ECe 1,71 /
// όργανο 316 µS/cm, λίπασμα 3,3, όριο ντομάτας 2,5). Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα και τον ΕΚΤΕΛΕΙ. Κάθε μετάλλαξη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");

function cut(src, a, b, label, inclB = true) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const RAMM = { soil_ece1: { value: 1.71, metadata: { tol: 2.5 } }, soil_ec_pore1: { value: 3.14 }, soil_ec_raw1: { value: 316 },
  soil_ece2: { value: 1.33, metadata: { tol: 2.5 } }, soil_ec_pore2: { value: 2.78 }, soil_ec_raw2: { value: 223 } };

function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    // ── πλακίδιο ──
    const helpers = cut(w, "sagEceBox={v:null}", ",sagPendKey=", "βοηθοί", false);
    const H = new Function("let " + helpers + ";\nreturn {sagEceSet, sagFertSet, sagEceCard, sagEceF9, sagEceBox, sagFertBox};")();
    H.sagEceSet(RAMM); H.sagFertSet(3.3);
    const c1 = H.sagEceCard("conduct_soil1"), c2 = H.sagEceCard("conduct_soil2");
    ok(c1 && c1.t === "💧 EC στη ρίζα Ρηχό" && c1.v === "3,1 mS/cm", "Π1 τίτλος/τιμή ρηχό: " + JSON.stringify(c1));
    ok(c1 && c1.sub === "ρίχνετε 3,3 → στη ρίζα 95 % · κλίμακα εργαστηρίου (ECe) 1,7 · όριο καλλιέργειας 2,5", "Π2 υπότιτλος ρηχό: " + (c1 && c1.sub));
    ok(c2 && c2.v === "2,8 mS/cm" && /στη ρίζα 84 %/.test(c2.sub) && /\(ECe\) 1,3/.test(c2.sub), "Π3 βαθύ: " + JSON.stringify(c2));
    ok(!/νερό ρίζας|όργανο|µS\/cm/.test(JSON.stringify([c1, c2])), "Π4 χωρίς «νερό ρίζας» και χωρίς ένδειξη οργάνου στο πλακίδιο");
    H.sagFertSet(null);
    const c3 = H.sagEceCard("conduct_soil1");
    ok(c3 && c3.sub === "κλίμακα εργαστηρίου (ECe) 1,7 · όριο καλλιέργειας 2,5", "Π5 χωρίς δηλωμένο λίπασμα: " + (c3 && c3.sub));
    for (const bad of ["", "0", -1, "abc", undefined]) { H.sagFertSet(bad); if (H.sagFertBox.v !== null) f.push("Π6 άκυρο λίπασμα δεκτό: " + bad); }
    H.sagFertSet("3.3"); ok(H.sagFertBox.v === 3.3, "Π7 λίπασμα ως κείμενο");
    H.sagEceSet({ soil_ece1: { value: 1.71, metadata: { tol: 2.5 } } });
    const c4 = H.sagEceCard("conduct_soil1");
    ok(c4 && c4.t === "🧂 Αλατότητα εδάφους Ρηχό" && c4.v === "1,7 dS/m", "Π8 χωρίς EC ρίζας: πίσω στην ECe (" + JSON.stringify(c4) + ")");
    H.sagEceSet({ soil_ece1: { value: null, metadata: { text: "Χωρίς συγκρίσιμη τιμή: υγρασία κάτω από 15 %." } } });
    const c5 = H.sagEceCard("conduct_soil1");
    ok(c5 && c5.t === null && /υγρασία κάτω από 15/.test(c5.sub), "Π9 χωρίς τιμή: αιτία (" + JSON.stringify(c5) + ")");
    ok(H.sagEceCard("soil_moisture1") === null, "Π10 άλλες μεταβλητές ανέγγιχτες");
    // ── διάγραμμα ──
    const body = cut(w, "/* W-EC-ROOT-01 */const _q9=", "fe(!1);p(!0);return}if(_eS9.length)", "κλάδος διαγράμματος", false)
      + "fe(!1);p(!0);return}" + cut(w, "if(_eS9.length){const _l9=[];", "fe(!1);p(!0);return}", "κλάδος ECe");
    const chart = (hist, fert) => {
      H.sagEceSet(RAMM); H.sagFertSet(fert);
      const calls = {};
      const fn = new Function("_sagEc9", "t", "h", "re", "ue", "it", "b", "B", "w", "j", "$", "P", "fe", "p", "sagEceBox", "sagFertBox", "sagEceF9",
        body + "\nreturn 'πτώση';");
      const r = fn(["conduct_soil1", "1"], { history: { FIELD: hist } }, "FIELD", RAMM, "SENSOR", () => "Έδαφος",
        (x) => { calls.v = x; }, (x) => { calls.t = x; }, (x) => { calls.d = x; }, (x) => { calls.s = x; }, (x) => { calls.u = x; },
        (x) => { calls.refs = x; }, () => {}, () => {}, H.sagEceBox, H.sagFertBox, H.sagEceF9);
      return { r, calls };
    };
    const A = chart({ soil_ec_pore1: [{ t: 1, v: 3.1 }], soil_ece1: [{ t: 1, v: 1.7 }] }, 3.3);
    ok(A.r === undefined && A.calls.v === "soil_ec_pore1" && A.calls.u === "mS/cm" && A.calls.d === "FIELD", "Δ1 διάγραμμα EC ρίζας: " + JSON.stringify([A.r, A.calls.v, A.calls.u]));
    ok(A.calls.t === "💧 EC στη ρίζα Ρηχό — Έδαφος", "Δ2 τίτλος: " + A.calls.t);
    const fl = (A.calls.refs || []).find((x) => x.label === "Διάλυμα που ρίχνετε");
    ok(fl && fl.value === 3.3 && fl.dashed === true, "Δ3 γραμμή «Διάλυμα που ρίχνετε 3,3»");
    const note = ((A.calls.refs || []).find((x) => x.label === "_ec10") || {}).txt || "";
    ok(/316 µS\/cm/.test(note) && /3,1 mS\/cm/.test(note) && /\(3,3 mS\/cm\)/.test(note) && /\(1,7\)/.test(note) && /\(2,5\)/.test(note)
      && /χωρίς εργαστηριακή βαθμονόμηση/.test(note), "Δ4 εξήγηση με τους τρεις αριθμούς: " + note);
    const Bn = chart({ soil_ec_pore1: [{ t: 1, v: 3.1 }] }, null);
    ok(!(Bn.calls.refs || []).some((x) => x.label === "Διάλυμα που ρίχνετε") && !/mS\/cm\)\./.test(((Bn.calls.refs || []).find((x) => x.label === "_ec10") || {}).txt.replace("(3,1 mS/cm)", "")),
      "Δ5 χωρίς λίπασμα: χωρίς γραμμή και χωρίς αριθμό λιπάσματος");
    const C = chart({ soil_ece1: [{ t: 1, v: 1.7 }] }, 3.3);
    const lim = (C.calls.refs || []).find((x) => x.label === "Όριο καλλιέργειας (ECe)");
    ok(C.calls.v === "soil_ece1" && C.calls.u === "dS/m" && lim && lim.value === 2.5 && /κλίμακα εργαστηρίου \(ECe\)/.test(C.calls.t), "Δ6 χωρίς σειρά EC ρίζας: ECe με όριο");
    ok(chart({}, 3.3).r === "πτώση", "Δ7 χωρίς καμία σειρά: πέφτει στο ωμό διάγραμμα όπως πριν");
    // ── στατικά ──
    const gs = w.indexOf("const Gs=({open:t,variable:s,label:a,series:r,unit:i,refLines:p,");
    const nb = w.indexOf('find(x=>x&&x.label==="_ec10")');
    ok(gs > 0 && nb > gs && (w.indexOf("=({open:", gs + 20) < 0 || nb < w.indexOf("=({open:", gs + 20)), "Σ1 το κουτί εξήγησης αποδίδεται μέσα στο παράθυρο διαγράμματος");
    ok(w.includes('sagFertSet(o&&o.fert_ecw_dsm);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);return!1}'), "Σ2 το λίπασμα έρχεται από τη ρύθμιση του αγρού");
    ok(w.includes('soil_ec_pore1:{label:"💧 EC στη ρίζα Ρηχό"') && w.includes('soil_ec_pore2:{label:"💧 EC στη ρίζα Βαθύ"'), "Σ3 ετικέτες");
    ok(!w.includes("νερό ρίζας") && !w.includes("Αγωγιμότητα νερού πόρων"), "Σ4 χωρίς παλιές ετικέτες");
    ok(!/\r/.test(w), "Σ5 LF");
  } catch (e) { f.push("εκτέλεση: " + (e && e.message)); }
  return f;
}

const base = run(WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 ποσοστό ανάποδα", "Math.round(p9/fz9*100)", "Math.round(fz9/p9*100)"],
  ["m2 τιμή ECe στο πλακίδιο", 'v:sagEceF9(p9,1)+" mS/cm"', 'v:sagEceF9(e9,1)+" mS/cm"'],
  ["m3 δύο δεκαδικά", 'v:sagEceF9(p9,1)+" mS/cm"', 'v:sagEceF9(p9,2)+" mS/cm"'],
  ["m4 χωρίς όριο καλλιέργειας", '" · όριο καλλιέργειας "+sagEceF9(tl9,1)', '""'],
  ["m5 λίπασμα δεν τροφοδοτείται", "sagFertSet(o&&o.fert_ecw_dsm);return vv", "return vv"],
  ["m6 λίπασμα 0 δεκτό", "Number.isFinite(n)&&n>0)?n:null}", "Number.isFinite(n))?n:null}"],
  ["m7 διάγραμμα πάντα ECe", "if(_pS9.length){", "if(false){"],
  ["m8 χωρίς γραμμή λιπάσματος", '_fz9!==null&&_l9.push({value:_fz9,label:"Διάλυμα που ρίχνετε",dashed:!0});', ""],
  ["m9 λάθος μονάδα διαγράμματος", '$("mS/cm");P(_l9)', '$("µS/cm");P(_l9)'],
  ["m10 χωρίς κουτί εξήγησης", 'find(x=>x&&x.label==="_ec10");return _n10&&', 'find(x=>x&&x.label==="_ec11");return _n10&&'],
  ["m11 χωρίς όριο στο ECe", 'Number.isFinite(_t9)&&_t9>0&&_l9.push({value:_t9,label:"Όριο καλλιέργειας (ECe)",dashed:!0});', ""],
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
