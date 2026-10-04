// Ελεγκτής v50.160 · T-COVERED-TXT-02: σε θερμοκήπιο οι κάρτες ΔΕΝ λένε ότι η βροχή μειώνει την προστασία και ο έλεγχος
// αισθητήρων ΔΕΝ χρεώνει βροχή του σταθμού στον ρηχό αισθητήρα. Στο ύπαιθρο ΑΜΕΤΑΒΛΗΤΑ.
// Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα (πυρήνας + widget) και τον ΕΚΤΕΛΕΙ. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const CORE = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8").replace(/\r\n/g, "\n");   // ο πυρήνας είναι CRLF
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");

function cut(src, a, b, label) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, j + b.length);
}
function run(core, wid) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    // 1 · κάρτα λήξης προστασίας (πυρήνας)
    const s1 = cut(core, "const _pInd = { variable: 'spray_protection_end_' + _pk,", "} };", "κάρτα λήξης").replace(/\r\n/g, "\n");
    const card = (cov) => new Function("_pk", "_inf", "moment", "_SAG_COVERED_ACTIVE", s1 + "\nreturn _pInd;")(
      "downy", { endMs: Date.UTC(2026, 9, 9), daysLeft: 4 }, () => ({ tz: () => ({ format: () => "9/10/2026" }) }), cov);
    const out = card(false).metadata.text, inn = card(true).metadata.text;
    ok(/Η βροχή τη μειώνει\.$/.test(out) && /4 ημ\. ακόμη\./.test(out), "Κ1 ύπαιθρο: «… 4 ημ. ακόμη. Η βροχή τη μειώνει.» (" + out + ")");
    ok(!/βροχ/i.test(inn) && /4 ημ\. ακόμη\.$/.test(inn), "Κ2 θερμοκήπιο: χωρίς λέξη για βροχή (" + inn + ")");
    // 2 · έλεγχος αισθητήρων: rain24 (πυρήνας)
    const rawNum = cut(core, "function _sagRawNum(data, key) {", "\n}", "_sagRawNum").replace(/\r\n/g, "\n");
    const line = cut(core, "      rain24: ", ",\n", "rain24").replace(/\r/g, "");
    const expr = line.replace(/^\s*rain24:\s*/, "").replace(/,\n$/, "");
    const r24 = (cov, v) => new Function("data", "_SAG_COVERED_ACTIVE", rawNum + "\nreturn (" + expr + ");")({ rain_height_daily: [{ value: v }] }, cov);
    ok(r24(false, 30) === 30, "Κ3 ύπαιθρο: rain24 = 30 (" + r24(false, 30) + ")");
    ok(r24(true, 30) === 0, "Κ4 θερμοκήπιο: rain24 = 0 (" + r24(true, 30) + ")");
    ok(r24(false, -3) === 0, "Κ5 ύπαιθρο: αρνητικό → 0");
    ok(core.indexOf("function _sagSensorFaults(") < core.indexOf("      rain24: ") && core.indexOf("      rain24: ") < core.indexOf("      owns: {"), "Κ6 η γραμμή rain24 είναι αυτή του _sagSensorFaults");
    // 3 · widget κάρτα παθογόνου
    const s3 = cut(wid, '(()=>{const _pr=s&&s["spray_protection_end_"+m.p.key]', "})()", "widget κάρτα");
    const wcard = (cov) => new Function("e", "s", "m", "sagCoveredBox", "return " + s3 + ";")(
      { jsx: (t, p) => p }, { spray_protection_end_downy: { value: "9/10/2026", metadata: { protection_days_left: 4 } } }, { p: { key: "downy" } }, { v: cov }).children;
    const wo = wcard(false), wi = wcard(true);
    ok(/Η βροχή μειώνει τη διάρκεια\.$/.test(wo) && /4 ημέρες ακόμη \(έως 9\/10\/2026\)\./.test(wo), "Κ7 widget ύπαιθρο: με βροχή (" + wo + ")");
    ok(!/βροχ/i.test(wi) && /\(έως 9\/10\/2026\)\.$/.test(wi), "Κ8 widget θερμοκήπιο: χωρίς βροχή (" + wi + ")");
    ok(/sagCoveredBox=\{v:!1\},sagCoveredSet=z=>\{sagCoveredBox\.v=!!z\}/.test(wid) && /sagCoveredSet\(vv\)/.test(wid), "Κ9 widget: η σημαία θερμοκηπίου τροφοδοτείται από τη ρύθμιση");
    ok(/const SAG_KERNEL_VERSION = 'v50\.160 · 2026-10-05';/.test(core), "Κ10 έκδοση v50.160");
  } catch (e) { f.push("εκτέλεση: " + e.message); }
  return f;
}

const base = run(CORE, WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 κάρτα: πάντα βροχή", "core", "' ημ. ακόμη.' + (_SAG_COVERED_ACTIVE ? '' : ' Η βροχή τη μειώνει.')", "' ημ. ακόμη.' + (' Η βροχή τη μειώνει.')"],
  ["m2 κάρτα: ανεστραμμένη", "core", "(_SAG_COVERED_ACTIVE ? '' : ' Η βροχή τη μειώνει.')", "(_SAG_COVERED_ACTIVE ? ' Η βροχή τη μειώνει.' : '')"],
  ["m3 κάρτα: ποτέ βροχή", "core", "(_SAG_COVERED_ACTIVE ? '' : ' Η βροχή τη μειώνει.')", "('')"],
  ["m4 rain24 χωρίς πύλη", "core", "rain24: _SAG_COVERED_ACTIVE ? 0 : Math.max(", "rain24: Math.max("],
  ["m5 rain24 πάντα 0", "core", "rain24: _SAG_COVERED_ACTIVE ? 0 : Math.max(", "rain24: true ? 0 : Math.max("],
  ["m6 widget: πάντα βροχή", "wid", '+")."+(sagCoveredBox.v?"":" Η βροχή μειώνει τη διάρκεια.")', '+")."+(" Η βροχή μειώνει τη διάρκεια.")'],
  ["m7 widget: ανεστραμμένο", "wid", '(sagCoveredBox.v?"":" Η βροχή μειώνει τη διάρκεια.")', '(sagCoveredBox.v?" Η βροχή μειώνει τη διάρκεια.":"")'],
  ["m8 widget: η σημαία δεν τροφοδοτείται", "wid", "sagCoveredSet(vv);", "sagCoveredSet(!1);"],
  ["m9 έκδοση", "core", "'v50.160 · 2026-10-05'", "'v50.159 · 2026-10-04'"],
];
let killed = 0;
for (const [name, which, a, b] of MUT) {
  const src = which === "core" ? CORE : WID; const n = src.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = which === "core" ? run(CORE.replace(a, b), WID) : run(CORE, WID.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
