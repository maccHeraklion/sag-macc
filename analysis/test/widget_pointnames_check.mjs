// Ελεγκτής widget · W-POINTNAMES-01 (17/11/2026, Κώστα 4 #3 · Kikis Land): `soil_point_names` στη ρύθμιση του αγρού
// αντικαθιστά «Ρηχό/Βαθύ» (ή «σημείο 1/2») με δικά μας ονόματα. Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα από το bundle
// (H, St, Ne, sagPtNm9, sagDepthBox/sagDepthSet, sagEceD9) και τον εκτελεί. Χωρίς το κλειδί: ίδια συμπεριφορά με πριν.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");

// ταιριαστό κλείσιμο αγκύλης από τη θέση της «{» (αγνοεί αγκύλες μέσα σε απλά "…" strings)
function block(src, open) {
  let d = 0, q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{") d++; else if (c === "}" && --d === 0) return src.slice(open, i + 1);
  }
  throw new Error("χωρίς κλείσιμο");
}
const at = (needle) => { const i = W.indexOf(needle); if (i < 0) throw new Error("λείπει: " + needle); return i; };
const St = W.slice(at(",St={") + 4, at(";function Ne(t){"));
const NeBody = block(W, at("function Ne(t){") + 14);
const box = W.slice(at("sagDepthBox={v:2"), at(",sagDepthHide="));
const eceStart = at("sagEceD9=q=>");
const ece = W.slice(eceStart, W.indexOf(",sagEceChain9=", eceStart));

const code = `let sagSubBox={v:!1},sagMeterBox={v:!0};let ${box};let ${ece};
const H=new Proxy({},{get:()=>({})});const St=${St};function Ne(t)${NeBody};return {Ne,sagDepthSet,sagDepthBox,sagEceD9,sagPtNm9};`;
const M = new Function(code)();

let fail = 0, n = 0;
const eq = (name, got, want) => { n++; if (got !== want) { fail++; console.log("✗", name, "→", JSON.stringify(got), "αντί", JSON.stringify(want)); } };
const L = (k) => M.Ne(k).label;

// 1. Χωρίς ονόματα — όπως πριν (2 βάθη)
M.sagDepthSet(2, 1);
eq("χωρίς ονόματα, θύρα 1", L("soil_temperature1"), "🌱 Θερμοκρασία εδάφους Ρηχό");
eq("χωρίς ονόματα, θύρα 2", L("soil_moisture2"), "🌱 Υγρασία εδάφους Βαθύ");
eq("χωρίς ονόματα EC τίτλος", M.sagEceD9("2"), " Βαθύ");
// δύο σημεία χωρίς ονόματα
M.sagDepthSet(1, 3);
eq("σημείο 1", L("soil_moisture1"), "🌱 Υγρασία εδάφους σημείο 1");

// 2. Kikis Land: 1 = Μάρτυρας, 2 = Pellet (2 βάθη)
const NAMES = { "1": "Μάρτυρας", "2": "Pellet" };
M.sagDepthSet(2, 1, NAMES);
eq("θερμ. 1", L("soil_temperature1"), "🌱 Θερμοκρασία εδάφους Μάρτυρας");
eq("θερμ. 2", L("soil_temperature2"), "🌱 Θερμοκρασία εδάφους Pellet");
eq("EC ρίζα 1", L("soil_ec_pore1"), "💧 EC στη ρίζα Μάρτυρας");
eq("ακατέργαστη 2", L("soil_ec_raw2"), "🔬 Ένδειξη οργάνου Pellet (ακατέργαστη)");
eq("EC τίτλος 1", M.sagEceD9("1"), " Μάρτυρας");
eq("EC τίτλος 2", M.sagEceD9("2"), " Pellet");
eq("άσχετη μεταβλητή", L("air_temperature"), M.Ne("air_temperature").label);
eq("άσχετη δεν πειράζεται", /Μάρτυρας|Pellet/.test(L("air_temperature")), false);
// ίδιο με JSON string και με δύο σημεία
M.sagDepthSet(1, 3, JSON.stringify(NAMES));
eq("σημεία + όνομα 1", L("soil_moisture1"), "🌱 Υγρασία εδάφους Μάρτυρας");
eq("σημεία + όνομα 2", L("conduct_soil2"), "🌾 Αγωγιμότητα εδάφους Pellet");
// ένα βάθος, θύρα 1 (το «Ρηχό» είχε σβηστεί) → το όνομα προστίθεται
M.sagDepthSet(1, 1, NAMES);
eq("ένα βάθος + όνομα", L("soil_moisture1"), "🌱 Υγρασία εδάφους Μάρτυρας");
// μόνο το ένα όνομα
M.sagDepthSet(2, 1, { "2": "Pellet" });
eq("μόνο 2 → 1 μένει Ρηχό", L("soil_moisture1"), "🌱 Υγρασία εδάφους Ρηχό");
eq("μόνο 2 → 2", L("soil_moisture2"), "🌱 Υγρασία εδάφους Pellet");
// καθαρισμός / σκουπίδια
eq("καθαρισμός", M.sagPtNm9({ "1": ' <b>A"</b>  x ', "2": "x".repeat(40) }).join("|"), "bA/b x|" + "x".repeat(24));
eq("σκουπίδια JSON", M.sagPtNm9("{oops").join("|"), "|");
eq("πίνακας", M.sagPtNm9(["a", "b"]).join("|"), "|");
// επαναφορά (σφάλμα ρύθμισης → sagDepthSet(2,1)) σβήνει τα ονόματα
M.sagDepthSet(2, 1);
eq("επαναφορά", L("soil_moisture2"), "🌱 Υγρασία εδάφους Βαθύ");

console.log(fail ? `✗ ${fail}/${n} απέτυχαν` : `✓ ${n}/${n}`);
process.exit(fail ? 1 : 0);
