// T-FERTIDX-01 — ΕΛΕΓΧΟΣ: το widget δεν έχει πια ΚΑΝΕΝΑ ίχνος του παλιού δείκτη parser, και η ΜΟΝΗ διαφορά από το
// προηγούμενο (git HEAD = ζωντανό 7167df7e…) είναι η αφαίρεση των 4 ετικετών + των 2 νεκρών συνόλων. Μεταλλάξεις.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
const ROOT = new URL("../../", import.meta.url);
const P = "_dist-sagMain/index-7cbd9a4e.js";
const NEW = readFileSync(new URL(P, ROOT), "utf8");
const OLD = execSync(`git show HEAD:${P}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 1e8 });
const REMOVED = [
  'fertility_index1:{label:"🌾 Παλιός δείκτης parser Ρηχό (αποσύρεται)",...H.conductivity},',
  'fertility_index2:{label:"🌾 Παλιός δείκτης parser Βαθύ (αποσύρεται)",...H.conductivity},',
  'fertility_index3:{label:"🌾 Παλιός δείκτης parser 3 (αποσύρεται)",...H.conductivity},',
  'fertility_index4:{label:"🌾 Παλιός δείκτης parser 4 (αποσύρεται)",...H.conductivity},',
];
const SWAP = [
  [String.raw`const w=new Set(N.flatMap(v=>{const x=v.match(/^fertility_index(\d+)$/);return x?[x[1]]:[]})),k=N.filter(`, "const k=N.filter("],
  [String.raw`const k=new Set(w.flatMap(d=>{const m=d.match(/^fertility_index(\d+)$/);return m?[m[1]]:[]})),$=w.filter(`, "const $=w.filter("],
];
function check(src) {
  const bad = [];
  if (src.includes("fertility_index")) bad.push("έμεινε fertility_index");
  if (src.includes("Παλιός δείκτης parser")) bad.push("έμεινε η ετικέτα «Παλιός δείκτης parser»");
  try { new vm.Script(src.replace(/^import[^;]*;/gm, "").replace(/\bexport\b/g, "")); } catch (e) { if (!/import|export|Cannot use/.test(e.message)) bad.push("σύνταξη: " + e.message); }
  for (const keep of ['conduct_soil1:{label:', 'soil_ece1:{label:"🧂 Αλατότητα εδάφους Ρηχό"', 'soil_ec_pore1:{label:',
    'k=N.filter(v=>{if(!Object.prototype.hasOwnProperty.call(St,v)||sagRainHide.has(v))return!1;return!0})',
    '$=w.filter(d=>{if(!Object.prototype.hasOwnProperty.call(St,d)||sagRainHide.has(d))return!1;return!0})',
    'return{t:"🧂 Αλατότητα εδάφους"+d9'])
    if (src.split(keep).length !== OLD.split(keep).length || OLD.split(keep).length < 2) bad.push("χάθηκε/διπλασιάστηκε: " + keep.slice(0, 50));
  let rebuilt = OLD;
  for (const r of REMOVED) rebuilt = rebuilt.replace(r, "");
  for (const [a, b] of SWAP) rebuilt = rebuilt.replace(a, b);
  if (rebuilt !== src) bad.push("η διαφορά από το ζωντανό ΔΕΝ είναι μόνο η αφαίρεση");
  return bad;
}
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
const base = check(NEW);
console.log(`παλιό ${sha(OLD)} → νέο ${sha(NEW)} · ${Buffer.byteLength(OLD) - Buffer.byteLength(NEW)} bytes λιγότερα`);
console.log(base.length ? "✗ " + base.join("\n✗ ") : "ΒΑΣΗ ✓");
const MUT = [
  ["μένει μία ετικέτα", (s) => s.replace("soil_ece:{label:", REMOVED[0] + "soil_ece:{label:")],
  ["σπάει το φίλτρο St", (s) => s.replace("hasOwnProperty.call(St,v)", "hasOwnProperty.call(Xt,v)")],
  ["χάνεται η αγωγιμότητα", (s) => s.replace("conduct_soil1:{label:", "conduct_soilX:{label:")],
  ["σβήνεται και άλλο", (s) => s.replace('soil_ec_pore1:{label:', 'soil_ec_poreZ:{label:')],
];
let k = 0;
for (const [n, f] of MUT) { const m = f(NEW); if (m === NEW) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); continue; } if (check(m).length) { k++; console.log("✓ σκοτώθηκε: " + n); } else console.log("✗✗ ΕΠΕΖΗΣΕ: " + n); }
console.log(`μεταλλάξεις ${k}/${MUT.length}`);
process.exit(base.length === 0 && k === MUT.length ? 0 : 1);
