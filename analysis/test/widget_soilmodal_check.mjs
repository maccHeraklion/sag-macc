// Ελεγκτής widget · T-SOILMODAL-01 (καρτέλα υγρασίας εδάφους).
// Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα του bundle (εξαγωγή με δείκτες), όχι αντίγραφο.
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
if (W.includes("\r\n")) throw new Error("το widget πρέπει να είναι LF");

const H = 36e5, MIN = 6e4;
const T0 = Date.UTC(2026, 8, 17, 0, 0, 0);
// Κουτσάκης ρηχός: 8 ημέρες, βήμα 20΄, πότισμα +5 στις 08:00 τις ημέρες 0–4, μετά επίπεδο ~25.
function shallow() {
  const out = []; let v = 29;
  for (let t = T0; t < T0 + 8 * 24 * H; t += 20 * MIN) {
    const day = Math.floor((t - T0) / (24 * H)), hh = ((t - T0) % (24 * H)) / H;
    if (day <= 4 && Math.abs(hh - 8) < 1e-9) v += 5;
    else if (day <= 4) v -= 5 / 71;           // στραγγίζει ως το επόμενο πότισμα
    else v -= 0.02 / 72;                       // 0,02/ημέρα: πρακτικά επίπεδο
    out.push([t, Number(v.toFixed(3))]);
  }
  return out;
}
// Κουτσάκης βαθύς: μόνο μικρές άνοδοι +0,4 κάθε πρωί, 23,6–24,9.
function deep() {
  const out = []; let v = 24.2;
  for (let t = T0; t < T0 + 8 * 24 * H; t += 20 * MIN) {
    const hh = ((t - T0) % (24 * H)) / H;
    if (Math.abs(hh - 8) < 1e-9) v += 0.4; else v -= 0.4 / 71;
    out.push([t, Number(v.toFixed(3))]);
  }
  return out;
}
// Υγιής αγρός: πάνω από το σημείο ποτίσματος, στεγνώνει 1 μον./ημέρα τις τελευταίες 3 ημέρες.
function drying(perDay) {
  const out = []; let v = 36;
  for (let t = T0; t < T0 + 3 * 24 * H; t += 20 * MIN) { v -= perDay / 72; out.push([t, Number(v.toFixed(4))]); }
  return out;
}
function withGap(series, hours) {   // αφαιρεί hours ώρες μετρήσεων στη μέση
  const mid = series[Math.floor(series.length / 2)][0];
  return series.filter(a => a[0] < mid || a[0] >= mid + hours * H);
}
const chk = (sv, zl, zu, st, rz) => {
  let mn = Infinity, mx = -Infinity; for (const a of sv) { mn = Math.min(mn, a[1]); mx = Math.max(mx, a[1]); }
  const ovr = (Number.isFinite(zl) && Number.isFinite(zu) && zu > zl) ? Math.max(0, Math.min(zu, mx) - Math.max(zl, mn)) / (zu - zl) : null;
  return { mn, mx, last: sv[sv.length - 1][1], zl, zu, st, rz, ovr, flat: false, days: 8 };
};
const refs = (basis, irr) => [{ label: "Κάτω όριο", value: 30.35 }, { label: "_basis10", value: NaN, txt: basis }, ...(irr ? [{ label: "_irr10", value: NaN, txt: irr }] : [])];
const BASIS2 = "Δύο βάθη: 10 cm (100 %) + 30 cm (0 %)";

function build(src) {
  const a = src.indexOf("_sagEv10=l.useMemo(()=>{"); if (a < 0) throw new Error("_sagEv10 δεν βρέθηκε");
  const b = src.indexOf("},[V,p,s,_sagChk7])", a); if (b < 0) throw new Error("τέλος _sagEv10 δεν βρέθηκε");
  const ev = new Function("V", "p", "s", "_sagChk7", src.slice(a + "_sagEv10=l.useMemo(()=>{".length, b));
  const c = src.indexOf("_sagF10=(x,d)=>"); const d = src.indexOf(",_sagChk7=l.useMemo(", c);
  if (c < 0 || d < 0) throw new Error("ετυμηγορία δεν βρέθηκε");
  const { _sagSoilVerdict9 } = new Function("const " + src.slice(c, d) + "; return {_sagF10,_sagSoilVerdict9};")();
  return { ev, verdict: _sagSoilVerdict9 };
}

function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  // ── καλωδίωση ──
  ok(src.includes('.filter(I=>I.label!=="Ριζόστρωμα τώρα (σταθμ. FAO-56)")'), "η γραμμή «Ριζόστρωμα τώρα» πρέπει να φιλτράρεται");
  ok(src.includes('"Άνω όριο":"Στόχος έως εδώ"') && src.includes('"Έναρξη άρδευσης":"Πότισμα από εδώ"'), "χάρτης ονομάτων γραμμών");
  ok((src.match(/&&!_sagChk7&&e\.jsxs\("div",\{className:"statBadge"/g) || []).length === 3, "Μέσος/Μέγιστο/Ελάχιστο κρυμμένα (3)");
  ok(src.includes('"Στο διάγραμμα: "+te(_sagEv10.t0)'), "δήλωση κάλυψης");
  ok(src.includes('_sagSoilVerdict9(Object.assign({},_sagChk7,_sagEv10||{}))'), "η απόφαση παίρνει βάση/συμμετοχή");
  ok(!src.includes("Στη δική του κλίμακα") && !src.includes("Τα όρια δεν σχεδιάζονται") && !src.includes("Η ετυμηγορία βγαίνει"), "παλιά κείμενα φύγανε");
  ok(src.includes('label:"_basis10",txt:_b10') && src.includes('label:"_irr10"'), "βάση βαθών + κάρτα άρδευσης περνούν στο modal");
  let B; try { B = build(src); } catch (e) { f.push("εξαγωγή: " + e.message); return f; }
  // ── Α. ρηχός Κουτσάκη ──
  const S = shallow(); const cS = chk(S, 30.35, 33.75, NaN, 24.61);
  const eS = B.ev(S, refs(BASIS2, "Ποτίστε 3 mm"), "soil_moisture1", cS);
  ok(eS && eS.n === S.length && Math.round(eS.stepMin) === 20 && eS.maxGapH < 1, "Α1 κάλυψη: n, βήμα 20΄, κανένα κενό");
  ok(eS && eS.ev.length === 5 && eS.small.length === 0, "Α2 πέντε ποτίσματα ≥1 μον., καμία μικρή άνοδος");
  ok(eS && eS.sinceH > 36 && eS.sinceH < 4 * 24, "Α3 από το τελευταίο πότισμα > 36 ω");
  ok(eS && eS.dry && eS.dry.hours >= 12 && Math.abs(eS.dry.perDay - 0.02) < 0.01, "Α4 στέγνωμα ≈0,02/ημέρα στις τελευταίες 48 ώρες");
  ok(eS && eS.daysTo === null && Number.isFinite(eS.trig) && eS.last < eS.trig, "Α5 ήδη κάτω από το σημείο ποτίσματος → χωρίς πρόβλεψη ημερών");
  ok(eS && eS.wt === 100 && eS.basis === BASIS2 && eS.irr === "Ποτίστε 3 mm", "Α6 συμμετοχή 100 %, βάση, κάρτα άρδευσης");
  const vS = B.verdict(Object.assign({}, cS, eS || {}));
  ok(vS && vS.tone === "red" && vS.head.includes("ΠΟΤΙΣΜΑ") && vS.head.includes("24,6 %") && vS.head.includes("30,4 %"), "Α7 απόφαση: κόκκινο, ριζόστρωμα 24,6 κάτω από 30,4");
  ok(vS && vS.body.includes(BASIS2) && vS.body.includes("κατά 100 %") && vS.irr === "Ποτίστε 3 mm", "Α8 σώμα: βάση + συμμετοχή + κάρτα άρδευσης");
  // ── Β. βαθύς Κουτσάκη ──
  const D = deep(); const cD = chk(D, 30.35, 33.75, NaN, 24.61);
  const eD = B.ev(D, refs(BASIS2), "soil_moisture2", cD);
  ok(eD && eD.ev.length === 0 && eD.small.length === 8, "Β1 βαθύς: κανένα καθαρό πότισμα, 8 μικρές άνοδοι");
  ok(eD && eD.wt === 0, "Β2 βαθύς: συμμετοχή 0 %");
  ok(cD.ovr !== null && cD.ovr <= 0, "Β3 βαθύς: τα όρια δεν συναντούν το εύρος (η πρόταση του πίνακα εμφανίζεται)");
  // ── Γ. υγιής αγρός: πρόβλεψη ημερών ──
  const G = drying(1); const cG = chk(G, 30.35, 33.75, 31, 33.5);
  const eG = B.ev(G, refs("Ένα βάθος: 20 cm"), "soil_moisture", cG);
  ok(eG && eG.dry && Math.abs(eG.dry.perDay - 1) < 0.05 && eG.trig === 31, "Γ1 στέγνωμα 1 μον./ημέρα, σημείο = έναρξη FAO-56");
  ok(eG && eG.daysTo !== null && Math.abs(eG.daysTo - (eG.last - 31)) < 0.15, "Γ2 ημέρες ως το σημείο ποτίσματος");
  ok(eG && eG.wt === 100, "Γ3 ένα βάθος, ρηχός: 100 %");
  const G2 = drying(0.02); const eG2 = B.ev(G2, refs("Ένα βάθος: 20 cm"), "soil_moisture", chk(G2, 30.35, 33.75, 31, 35));
  ok(eG2 && eG2.daysTo === null, "Γ4 ρυθμός ≤0,05/ημέρα: καμία πρόβλεψη (θα ήταν εικασία)");
  const vG = B.verdict(Object.assign({}, cG, eG || {}));
  ok(vG && vG.tone === "green", "Γ5 ριζόστρωμα 33,5 μέσα στον στόχο → πράσινο");
  ok(B.verdict(Object.assign({}, cG, { rz: 30.8 })).tone === "orange", "Γ6 ριζόστρωμα 30,8 ≤ έναρξη 31 → πορτοκαλί");
  ok(B.verdict(Object.assign({}, cG, { rz: 35 })).tone === "blue", "Γ7 ριζόστρωμα 35 > 33,75 → μπλε");
  ok(B.verdict(Object.assign({}, cG, { rz: 29 })).tone === "red", "Γ8 ριζόστρωμα 29 < κάτω όριο 30,35 → κόκκινο (όχι μόνο 5 μον. κάτω)");
  // ── Δ. βάση ενός βάθους / κενά ──
  const eD1 = B.ev(D, refs("Ένα βάθος: 20 cm"), "soil_moisture2", cD);
  ok(eD1 && eD1.wt === 0, "Δ1 ένα βάθος ρηχό, διάγραμμα βαθέος → 0 %");
  const eD2 = B.ev(D, refs("Ένα βάθος: 50 cm (βαθύς)"), "soil_moisture2", cD);
  ok(eD2 && eD2.wt === 100, "Δ2 ένα βάθος βαθύ, διάγραμμα βαθέος → 100 %");
  const eGap = B.ev(withGap(S, 6), refs(BASIS2), "soil_moisture1", cS);
  ok(eGap && Math.abs(eGap.maxGapH - 6.33) < 0.2 && Math.round(eGap.stepMin) === 20, "Δ3 κενό 6 ω δηλώνεται, το βήμα μένει 20΄");
  return f;
}

const base = run(W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 κατώφλι ποτίσματος 1→0,3", "if(d>=1)ev.push", "if(d>=.3)ev.push"],
  ["m2 μικρές άνοδοι αγνοούνται", "else if(d>=.3)small.push", "else if(d>=5)small.push"],
  ["m3 παράθυρο στεγνώματος 48→4 ώρες", "const from=t1-48*36e5", "const from=t1-4*36e5"],
  ["m4 γραμμή «Ριζόστρωμα τώρα» σχεδιάζεται", '.filter(I=>I.label!=="Ριζόστρωμα τώρα (σταθμ. FAO-56)")', ""],
  ["m5 συμμετοχή πάντα του ρηχού", "wt=Number(ms[idx][2])", "wt=Number(ms[0][2])"],
  ["m6 «Άνω όριο» μένει ακατανόητο", '"Άνω όριο":"Στόχος έως εδώ"', '"Άνω όριο":"Άνω όριο"'],
  ["m7 κόκκινο μόνο 5 μον. κάτω", 'if(b<zl){tone="red"', 'if(b<zl-5){tone="red"'],
  ["m8 «Μέγιστο» ξαναφαίνεται", 'w.showMax&&!_sagChk7&&', 'w.showMax&&'],
  ["m9 πρόβλεψη ημερών από θόρυβο", "dry.perDay>.05", "dry.perDay>-1"],
  ["m10 ένα βάθος: πάντα 100 %", "wt=((idx===1)===/βαθύς/.test(basis))?100:0", "wt=100"],
  ["m11 απόφαση χωρίς βάση", "_sagSoilVerdict9(Object.assign({},_sagChk7,_sagEv10||{}))", "_sagSoilVerdict9(_sagChk7)"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!W.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(W.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
