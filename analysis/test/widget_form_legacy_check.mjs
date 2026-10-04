// Ελεγκτής T-LEGACY-01 (widget + φόρμα): B-05 το `irrigation_warning` φαίνεται στην κάρτα υγείας·
// B-08 η στήλη μS/cm της ποιότητας νερού = dS/m × 1000 (όχι TDS mg/L). Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα όπου γίνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const F = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "configuration.html"), "utf8");
function run(w, form) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  // B-05 · ο χάρτης ετικετών της κάρτας υγείας, εκτελεσμένος
  const a = w.indexOf("const HL={"); const b = w.indexOf("};", a);
  let HL = null; try { HL = new Function("return " + w.slice(a + 9, b + 1))(); } catch (e) { f.push("B-05 HL δεν διαβάζεται: " + e.message); }
  ok(HL && HL.irrigation_warning === "Προειδοποίηση άρδευσης", "B-05 το irrigation_warning έχει γραμμή στην κάρτα υγείας");
  ok(w.includes('.filter(x=>x.d&&x.d.value!==null&&x.d.value!==void 0&&String(x.d.value)!=="")'), "B-05 η κάρτα υγείας παραλείπει κενή τιμή (δεν εμφανίζεται «null»)");
  // B-08 · WATER_INFO εκτελεσμένο: us = ecw × 1000
  const s = form.indexOf("  excellent: { ecw:"); const e = form.indexOf("\n};", s);
  let WI = null; try { WI = new Function("return {" + form.slice(s, e) + "\n}")(); } catch (x) { f.push("B-08 WATER_INFO δεν διαβάζεται: " + x.message); }
  if (WI) {
    const nums = (t) => (String(t).match(/[\d.,]+/g) || []).map(v => Number(v.replace(/\./g, "").replace(",", ".")));
    for (const k of ["excellent", "good", "marginal", "poor"]) {
      const d = nums(WI[k].ecw), u = nums(WI[k].us);
      ok(d.length === u.length && d.every((x, i) => Math.abs(x * 1000 - u[i]) < 1e-6), "B-08 " + k + ": μS/cm = dS/m × 1000 (" + WI[k].ecw + " ↔ " + WI[k].us + ")");
    }
  }
  return f;
}
const base = run(W, F);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["W1 χωρίς irrigation_warning", 'const HL={irrigation_warning:"Προειδοποίηση άρδευσης",', 'const HL={', "w"],
  ["F1 good ξανά 450–1.300", "us:'700 – 2.000 μS/cm'", "us:'450 – 1.300 μS/cm'", "f"],
  ["F2 poor ξανά > 2.000", "us:'> 3.000 μS/cm'", "us:'> 2.000 μS/cm'", "f"],
];
let k = 0;
for (const [n, a, b, which] of MUT) {
  const src = which === "w" ? W : F;
  if (!src.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  const m = src.replace(a, b);
  const r = which === "w" ? run(m, F) : run(W, m);
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 90)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
