/* T-GWMAP-08 (7/11/2026) — ΕΛΕΓΧΟΣ: σύμβολα χάρτη. Τρέχει τη λογική της σελίδας (<script id="sag-logic">) και τους πραγματικούς συνδυασμούς οργάνων της απογραφής 7/11.
 * Το είδος βγαίνει από τα όργανα, το σήμα μπαίνει μόνο όταν κάτι δεν πάει καλά. Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const H0 = readFileSync(fileURLToPath(new URL("../../custom_html_files/sag-map.html", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const logic = (h) => { const a = h.indexOf('<script id="sag-logic">') + 23, b = h.indexOf("</script>", a); const sb = { console }; vm.createContext(sb); vm.runInContext(h.slice(a, b) + "\nglobalThis.X = { kindOf, badgeOf, KIND, GW_SVG, SEV, FSTATE, GSTATE, ISTATE, gwZ, fieldsZ, PIN_TOP };", sb); return sb.X; };
const T = (s) => (s ? s.split("+").map((t) => ({ t })) : []);
const CASES = [["aglwpp01+em320_th+lms01_ls+lse02+s2120+uc511", "field"], ["em300_th+lms01_ls+lse02", "field"], ["em320_th+lse01", "field"], ["lse01+s2120", "field"], ["lse01+s2120+uc511", "field"], ["lse02+se0x", "field"], ["s2120+se0x", "field"], ["se0x", "field"], ["lms01_ls+s2120+se0x+sph01", "field"], ["se0x+uc511", "field"], ["lms01_ls+uc511", "field"], ["s2120+zzz", "field"], ["s2120", "station"], ["s2120+uc511", "valve"], ["uc511", "valve"], ["", "none"]];

function check(h) {
  const bad = []; let X; try { X = logic(h); } catch (e) { return ["η λογική δεν φορτώνει: " + e.message]; }
  const eq = (n, a, b) => { if (a !== b) bad.push(n + ": πήρα " + a + " αντί " + b); };
  for (const [ts, k] of CASES) eq("είδος " + (ts || "κανένα"), X.kindOf(T(ts)).k, k);
  eq("άγνωστος τύπος", X.kindOf([{ t: null }]).k, "field");
  eq("κεφαλαία", X.kindOf(T("S2120")).k, "station");
  eq("όνομα δεν μετρά", X.kindOf([{ t: "s2120", n: "Ηλεκτροβάνα 1" }]).k, "station");
  const [v0, v1, v2, v3] = X.SEV;
  eq("εντάξει χωρίς σήμα", X.badgeOf(v0, null), null); eq("γραφείο", X.badgeOf(v1, null), v1.ic); eq("έλεγχος", X.badgeOf(v2, null), v2.ic); eq("επίσκεψη", X.badgeOf(v3, null), v3.ic);
  eq("σιωπή υπερισχύει σε εντάξει", X.badgeOf(v0, X.FSTATE.silent), X.FSTATE.silent.ic); eq("κενά υπερισχύουν σε επίσκεψη", X.badgeOf(v3, X.FSTATE.gaps), X.FSTATE.gaps.ic);
  eq("χωρίς υπολογισμό", X.badgeOf(X.FSTATE.nocalc, null), null); eq("χωρίς όργανο", X.badgeOf(X.FSTATE.noinst, null), null);
  eq("πύλη ζωντανή", X.badgeOf(X.GSTATE.g_alive, null), null);
  for (const k of ["g_sparse", "g_nowit", "g_unid", "g_storage"]) eq("πύλη " + k, X.badgeOf(X.GSTATE[k], null), X.GSTATE[k].ic);
  for (const k of ["field", "station", "valve", "none"]) if (!/^<svg [^>]*viewBox/.test(X.KIND[k].svg)) bad.push("χωρίς σχέδιο " + k);
  if (!/^<svg /.test(X.GW_SVG)) bad.push("χωρίς σχέδιο πύλης");
  if (new Set(["field", "station", "valve", "none"].map((k) => X.KIND[k].svg).concat(X.GW_SVG)).size !== 5) bad.push("ίδιο σχέδιο σε δύο είδη");
  const F = (s, keys = []) => ({ computed: true, s, keys }), G = (k) => X.gwZ({ st: { k } });
  const lt = (n, a, b) => { if (!(a < b)) bad.push("σειρά: " + n + " " + a + " όχι κάτω από " + b); };
  lt("αγρός επίσκεψη πάνω από ζωντανή πύλη", G("g_alive"), X.fieldsZ([F(3)])); lt("αγρός έλεγχος πάνω από ζωντανή πύλη", G("g_alive"), X.fieldsZ([F(2)])); lt("αγρός γραφείο πάνω από ζωντανή πύλη", G("g_alive"), X.fieldsZ([F(1)]));
  lt("ζωντανή πύλη πάνω από υγιή αγρό", X.fieldsZ([F(0)]), G("g_alive")); lt("πύλη χωρίς ταυτοποίηση κάτω από υγιή αγρό", G("g_unid"), X.fieldsZ([F(0)])); lt("αποθήκη κάτω από όλα", G("g_storage"), G("g_unid"));
  lt("πύλη χωρίς μάρτυρα πάνω από αραιή", G("g_sparse"), G("g_nowit")); lt("αραιή πάνω από ζωντανή", G("g_alive"), G("g_sparse")); lt("η ομάδα παίρνει τη χειρότερη", X.fieldsZ([F(0)]), X.fieldsZ([F(0), F(3)])); lt("η ομάδα κοιτά όλα τα μέλη", X.fieldsZ([F(1)]), X.fieldsZ([F(1), F(3)])); lt("σιωπή ανεβάζει", X.fieldsZ([F(0)]), X.fieldsZ([F(0, ["silent"])]));
  lt("το επιλεγμένο πάνω από όλα", X.fieldsZ([F(3, ["silent", "gaps"])]), X.PIN_TOP);
  const has = (n, t) => { if (!h.includes(t)) bad.push("λείπει: " + n); };
  has("η πύλη με σχέδιο", "!!selGw && selGw === g, GW_SVG)"); has("το σήμα της πύλης", "'Πύλη', badgeOf(g.st, null)"); has("ο αγρός με σχέδιο", "isSel, kind ? kind.svg : null)"); has("το είδος στο μοντέλο", "kind: kindOf(devs)"); has("το σχέδιο περνά χωρίς esc", "(glyph || esc(text))"); has("το σήμα της ομάδας", "sub = badgeOf(s, null); }");
  has("σειρά αγρών", "zIndexOffset: isSel ? PIN_TOP : fieldsZ(list)"); has("σειρά πυλών", "selGw === g) ? PIN_TOP : gwZ(g)");
  if (/pinIcon\(g\.st, 'gw', g\.st\.ic/.test(h)) bad.push("έμεινε το τσεκ στην πύλη"); if (/στρογγυλή πινέζα/.test(h)) bad.push("έμεινε το παλιό υπόμνημα");
  return bad;
}
const r = check(H0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : `ΟΚ ${CASES.length} συνδυασμοί οργάνων`);
const MUT = [["/lse0|se0|lms01|em3|sph01|aglwpp/", "/lse0|lms01|em3|sph01|aglwpp/"], ["/lse0|se0|lms01|em3|sph01|aglwpp/", "/lse0|se0|em3|sph01|aglwpp/"], ["if (!ts.length) return KIND.none;", ""], ["/uc5|ws558/.test(t); })) return KIND.valve", "/ws558/.test(t); })) return KIND.valve"], ["ts.every(function (t) { return /s2120/.test(t); })", "ts.some(function (t) { return /s2120/.test(t); })"], [".toLowerCase(); });\n  if (!ts.length)", "; });\n  if (!ts.length)"],
  ["if (ss) return ss.ic;", ""], ["s.c === 'ok' || ", ""], ["s.k === 'nocalc' || ", ""], [" || s.k === 'noinst'", ""], ["kind: kindOf(devs), ", ""], ["(glyph || esc(text))", "esc(text)"], ["'Πύλη', badgeOf(g.st, null)", "'Πύλη', null"], ["sub = badgeOf(s, null); }", "}"], ["selGw === g, GW_SVG)", "selGw === g)"], ["isSel, kind ? kind.svg : null)", "isSel)"], ["g_alive: 500", "g_alive: 1500"], ["g_unid: -500", "g_unid: 500"], ["g_storage: -1000", "g_storage: -100"], ["g_sparse: 2000", "g_sparse: 400"], ["g_nowit: 3000", "g_nowit: 1500"], ["return Math.max(a, trouble(f));", "return a || trouble(f);"], ["zIndexOffset: isSel ? PIN_TOP : fieldsZ(list)", "zIndexOffset: 0"], ["selGw === g) ? PIN_TOP : gwZ(g)", "selGw === g) ? PIN_TOP : 1000"], ["var PIN_TOP = 5000;", "var PIN_TOP = 3000;"]];
let k = 0; for (const [a, b] of MUT) { if (!H0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } if (check(H0.replace(a, b)).length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
