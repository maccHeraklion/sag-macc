// Ελεγκτής πυρήνα v50.161 · T-PEST-ALIAS-01: τα ονόματα σκευασμάτων που έγραψαν πραγματικοί αγρότες (ημερολόγια 14/10)
// αναγνωρίζονται ως σκευάσματα ΗΔΗ υπάρχοντα στον κατάλογο. Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα. Κάθε μετάλλαξη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rawC = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const C = rawC.replace(/\r\n/g, "\n");

function fnText(c, name) {
  const m = c.indexOf("function " + name + "("); if (m < 0) throw new Error("δεν βρέθηκε " + name);
  let d = 0; for (let k = c.indexOf("{", m); k < c.length; k++) { if (c[k] === "{") d++; else if (c[k] === "}") { d--; if (!d) return c.slice(m, k + 1); } }
  throw new Error("άνοιγμα χωρίς κλείσιμο " + name);
}
function build(c) {
  const a = c.indexOf("const PESTICIDE_PROFILE ="), b = c.indexOf("\nconst PESTICIDE_PROPOSAL_PROFILE", a);
  const s = c.indexOf("const _SAG_PEST_REF_ALIAS"), e = c.indexOf("};", s) + 2;
  if (a < 0 || b < 0 || s < 0) throw new Error("ορισμοί δεν βρέθηκαν");
  return new Function(c.slice(a, b) + "\n" + fnText(c, "_peiStrip") + "\n" + c.slice(s, e) + "\n" + fnText(c, "_sagPestAliasKey") + "\n"
    + fnText(c, "_sagFindPesticideByRef") + "\n" + fnText(c, "_sagPesticideKeyByRef") + "\nreturn { P: PESTICIDE_PROFILE, A: _SAG_PEST_REF_ALIAS, f: _sagFindPesticideByRef, k: _sagPesticideKeyByRef };")();
}
function run(c) {
  const f = []; const ok = (x, m) => { if (!x) f.push(m); };
  ok(c.includes("const SAG_KERNEL_VERSION = 'v50.161 · 2026-10-14';"), "Ε0 έκδοση v50.161");
  let X; try { X = build(c); } catch (e) { f.push("εξαγωγή: " + e.message); return f; }
  // πραγματικά ονόματα από τα ημερολόγια 14/10
  const want = [["karate", "lambda_cyhalothrin"], ["Neemazal", "azadirachtin"], ["Azadiraktinh", "azadirachtin"], ["Azadiraktini", "azadirachtin"],
    ["Heliosoufre", "sulfur"], ["Χαλκός", "copperHydroxide"], ["βακιλος", "bt"], ["NeemAzal-T/S", "azadirachtin"], ["Karate Zeon", "lambda_cyhalothrin"], ["Βάκιλλος", "bt"]];
  for (const [n, k] of want) {
    ok(X.k(n) === k, "Α " + n + " → κλειδί " + k + " (" + X.k(n) + ")");
    const p = X.f(n); let pk = null; for (const o of Object.values(X.P)) if (o && typeof o === "object" && !Array.isArray(o) && o[k]) pk = o[k];
    ok(p && p === pk, "Β " + n + " → ίδιο αντικείμενο καταλόγου με το «" + k + "»");
  }
  // τα ήδη γνωστά δεν αλλάζουν
  for (const n of ["deltamethrin", "sulfur", "spinosad", "azadirachtin", "Θείο", "Spinosad"]) ok(X.f(n) !== null, "Γ γνωστό «" + n + "» αναγνωρίζεται όπως πριν");
  ok(X.k("sulfur") === "sulfur" && X.k("Θείο") === "sulfur", "Γ2 ακριβές κλειδί και όνομα καταλόγου προηγούνται");
  // ΚΑΜΙΑ νέα δραστική: άγνωστα μένουν άγνωστα (χρειάζονται έγκριση)
  for (const n of ["Surround wp", "Sivanto", "Revyona", "Lainsect", "Myclobutanil", "Ραουνταπ", "", "ab"]) ok(X.f(n) === null && X.k(n) === null, "Δ «" + n + "» μένει άγνωστο");
  // κάθε συνώνυμο οδηγεί σε υπάρχον κλειδί καταλόγου
  const keys = new Set(Object.values(X.P).flatMap(o => o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : []));
  for (const [al, k] of Object.entries(X.A)) ok(keys.has(k), "Ε συνώνυμο «" + al + "» → υπαρκτό κλειδί (" + k + ")");
  // ο χαλκός: πανομοιότυπος με τον οξυχλωριούχο → καμία αγρονομική υπόθεση
  const cu = X.f("Χαλκός"), ox = X.f("copper_oxychloride");
  ok(cu && ox && cu.residualDays === ox.residualDays && cu.washoffFactor === ox.washoffFactor && cu.uvDegradationFactor === ox.uvDegradationFactor && cu.PHI_days === ox.PHI_days, "ΣΤ «Χαλκός» = ίδιες παράμετροι με τον οξυχλωριούχο");
  X.A["zz δοκιμη"] = "ανυπαρκτο_κλειδι";
  ok(X.k("ZZ Δοκιμή") === null && X.f("ZZ Δοκιμή") === null, "Η συνώνυμο προς ανύπαρκτο κλειδί → άγνωστο (όχι ψευδές κλειδί)");
  ok(!/fuzzy|includes\(norm\)|indexOf\(norm\)/.test(fnText(c, "_sagPestAliasKey")), "Ζ ακριβής αντιστοίχιση, όχι ασαφής");
  return f;
}
const base = run(C);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 παλιά έκδοση", "'v50.161 · 2026-10-14'", "'v50.160 · 2026-10-05'"],
  ["m2 χωρίς συνώνυμα στο σκεύασμα", "  const _ak = _sagPestAliasKey(key);   // T-PEST-ALIAS-01\n  if (_ak) { for", "  const _ak = null;\n  if (_ak) { for"],
  ["m3 χωρίς συνώνυμα στο κλειδί", "  const _ak = _sagPestAliasKey(key);   // T-PEST-ALIAS-01\n  if (_ak) return _ak;", "  const _ak = null;\n  if (_ak) return _ak;"],
  ["m4 karate σε λάθος σκεύασμα", "'karate': 'lambda_cyhalothrin',", "'karate': 'deltamethrin',"],
  ["m5 συνώνυμο σε ανύπαρκτο κλειδί", "'heliosoufre': 'sulfur',", "'heliosoufre': 'sulphur',"],
  ["m6 χωρίς κανονικοποίηση συμβόλων", ".replace(/[^a-z0-9\\u03b1-\\u03c9\\u03c2]+/g, ' ')", ""],
  ["m7 ο χαλκός ως βορδιγάλειος", "'χαλκος': 'copperHydroxide',", "'χαλκος': 'bordeaux_mixture',"],
  ["m8 χωρίς έλεγχο ύπαρξης στον κατάλογο", "      if (typeof catObj === 'object' && !Array.isArray(catObj) && catObj[k]) return k;\n    }\n  } catch (_e) {}\n  return null;", "    }\n    return k;\n  } catch (_e) {}\n  return null;"],
];
let killed = 0;
for (const [n, a, b] of MUT) {
  const cnt = C.split(a).length - 1;
  if (cnt !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + n + " (βρέθηκε " + cnt + ")"); continue; }
  let r; try { r = run(C.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { killed++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
