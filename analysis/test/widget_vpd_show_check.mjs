// Ελεγκτής widget · T-VPD-SHOW-01: το VPD του αγρού (re.vpd από field_bundle.shared) φαίνεται στην κάρτα «Συνθήκες
// ανάπτυξης σήμερα» με ζώνη χρώματος. Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα του bundle και τον ΕΚΤΕΛΕΙ. Κάθε μετάλλαξη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");

function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const a = w.indexOf("Le=l.useMemo("); const b = w.indexOf(",[re])", a);
    if (a < 0 || b < 0) throw new Error("δεν βρέθηκε το Le");
    const fn = w.slice(a + "Le=l.useMemo(".length, b);
    const Le = (re) => new Function("re", "return (" + fn + ")();")(re);
    const now = new Date().toISOString(), old = new Date(Date.now() - 4 * 3600e3).toISOString(), ok2 = new Date(Date.now() - 2 * 3600e3).toISOString();
    const at = (v, t) => Le({ vpd: { value: v, time: t === undefined ? now : t } }).vpd;
    const cases = [[0.3, "υγρός αέρας — ευνοεί μύκητες", "badge b-blue"], [0.4, "καλό", "badge b-green"], [1.2, "καλό", "badge b-green"],
      [1.21, "ξηρός αέρας", "badge b-yellow"], [1.6, "ξηρός αέρας", "badge b-yellow"], [1.61, "καταπόνηση", "badge b-red"], [1.85, "καταπόνηση", "badge b-red"]];
    for (const [v, lab, cls] of cases) { const r = at(v); ok(r && r.label === lab && r.cls === cls, "Ζ VPD " + v + " → «" + lab + "» " + cls + " (" + JSON.stringify(r) + ")"); }
    ok(at(1.85).v === "1,85", "Μ1 ελληνική υποδιαστολή «1,85» (" + (at(1.85) || {}).v + ")");
    ok(Le({}).vpd === null, "Κ1 χωρίς vpd → τίποτα");
    for (const v of [NaN, -1, 12, "abc"]) ok(at(v) === null, "Κ2 άκυρη τιμή " + v + " → τίποτα");
    ok(at(1, old) === null, "Κ3 παλιά τιμή 4 ω → τίποτα");
    ok(at(1, ok2) !== null, "Κ4 τιμή 2 ω → φαίνεται");
    ok(at(1, null) !== null, "Κ5 χωρίς χρόνο → φαίνεται");
    const L = Le({ vpd: { value: 0.9, time: now }, bpi_performance_pct: { value: 55 } });
    ok(L.perfPct === 55 && "stomata" in L && "bucketLabel" in L, "Κ6 τα υπόλοιπα πεδία της κάρτας άθικτα");
    // απόδοση γραμμής
    const s0 = w.indexOf('Le.vpd&&e.jsxs("div",{title:'); const s1 = w.indexOf("})]}),", s0);
    if (s0 < 0 || s1 < 0) throw new Error("δεν βρέθηκε η γραμμή");
    const expr = w.slice(s0, s1 + 5);   // «})]})» = 5 χαρακτήρες
    const e = { jsx: (t, p) => ({ t, p }), jsxs: (t, p) => ({ t, p }) };
    const flat = (x) => x == null || x === false ? "" : typeof x === "string" || typeof x === "number" ? String(x) : Array.isArray(x) ? x.map(flat).join("") : flat(x.p && x.p.children);
    const node = new Function("Le", "e", "return " + expr + ";")({ vpd: at(1.85) }, e);
    const txt = flat(node);
    ok(/Έλλειμμα πίεσης υδρατμών \(VPD\): 1,85 kPa καταπόνηση/.test(txt), "Α1 κείμενο γραμμής (" + txt + ")");
    ok(node && node.p && /0,4–1,2 καλό/.test(node.p.title), "Α2 επεξήγηση ζωνών στο title");
    ok(new Function("Le", "e", "return " + expr + ";")({ vpd: null }, e) === null, "Α3 χωρίς VPD → καμία γραμμή");
    ok(w.includes('(Le.perfPct!==null||Le.stomata||Le.bucketLabel||Le.vpd)&&e.jsxs("div",{className:"bpi-extra"'), "Α4 η περιοχή ανοίγει και μόνο με VPD");
    ok(w.indexOf('Le.vpd&&e.jsxs("div",{title:') < w.indexOf('Le.stomata&&e.jsxs("div",{className:"muted"') && w.indexOf("Συνθήκες ανάπτυξης σήμερα") < w.indexOf('Le.vpd&&e.jsxs("div",{title:'), "Α5 μέσα στην κάρτα «Συνθήκες ανάπτυξης σήμερα»");
  } catch (x) { f.push("εκτέλεση: " + x.message); }
  return f;
}
const base = run(WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 όριο υγρού 0,5", "v<0.4?[", "v<0.5?["],
  ["m2 όριο καλού 1,0", "v<=1.2?[", "v<=1.0?["],
  ["m3 όριο ξηρού 2,0", "v<=1.6?[", "v<=2.0?["],
  ["m4 χωρίς έλεγχο παλαιότητας", "if(Number.isFinite(tm)&&Date.now()-tm>3*36e5)return null;", ""],
  ["m5 χωρίς υποδιαστολή", 'v.toFixed(2).replace(".",",")', "v.toFixed(2)"],
  ["m6 η περιοχή δεν ανοίγει με VPD", "||Le.bucketLabel||Le.vpd)&&", "||Le.bucketLabel)&&"],
  ["m7 vpd δεν επιστρέφεται", "return{vpd:_vp9,stomata:c,", "return{stomata:c,"],
  ["m8 χρώμα καταπόνησης κίτρινο", '["καταπόνηση","badge b-red"]', '["καταπόνηση","badge b-yellow"]'],
  ["m9 άκυρες τιμές περνούν", "if(!Number.isFinite(v)||v<0||v>10)return null;", "if(!Number.isFinite(v))return null;"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = WID.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(WID.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
