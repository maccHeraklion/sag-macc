// Ελεγκτής widget · T-SEASONLABEL-01 + T-FLATABS-01 · μεταλλάξεις πρέπει να σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
if (W.includes("\r\n")) throw new Error("το widget πρέπει να είναι LF");
function run(s) {
  const f = [];
  if (!s.includes('"Αξιοποίηση σεζόν: "')) f.push("ετικέτα «Αξιοποίηση σεζόν»");
  if (s.includes('"Πορεία σεζόν: "')) f.push("παλιά ετικέτα «Πορεία σεζόν» ακόμη μέσα");
  const m = s.match(/flat:([^,]+),pos:/);
  if (!m) { f.push("κανόνας flat δεν βρέθηκε"); return f; }
  const flat = new Function("_days", "_rel", "_amp", "return (" + m[1] + ");");
  if (flat(8, 0.0499, 1.24) !== false) f.push("βαθύς Κουτσάκη (8 ημ, 4,99 %, 1,24 μονάδες) πρέπει ΟΧΙ flat");
  if (flat(8, 0.004, 0.1) !== true) f.push("καρφωμένος (0,1 μονάδες) πρέπει flat");
  if (flat(2, 0.001, 0.02) !== false) f.push("2 ημέρες: όχι ακόμη κρίση");
  if (flat(8, 0.2, 0.3) !== false) f.push("μικρή τιμή με σχετικό 20 %: όχι flat");
  return f;
}
const base = run(W); if (base.length) { console.log("ΑΠΟΤΥΧΙΑ: " + base.join(" · ")); process.exit(1); }
console.log("ΒΑΣΗ ΟΚ");
const MUT = [
  ["m1 χωρίς απόλυτο κατώφλι", "&&_amp<.5,", ","],
  ["m2 κατώφλι 5 μονάδες", "&&_amp<.5,", "&&_amp<5,"],
  ["m3 παλιά ετικέτα", '"Αξιοποίηση σεζόν: "', '"Πορεία σεζόν: "'],
  ["m4 χωρίς όρο ημερών", "flat:_days>=3&&", "flat:"],
];
let k = 0;
for (const [n, a, b] of MUT) { if (!W.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  const r = run(W.replace(a, b)); if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ " + n); }
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length); process.exit(k === MUT.length ? 0 : 1);
