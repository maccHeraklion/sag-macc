/* T-GWMAP-05 (7/11/2026) — ΕΛΕΓΧΟΣ: όλες οι πύλες ανά όργανο. Τρέχει τον πραγματικό κώδικα της μνήμης και της σύνδεσης της σελίδας. Κάθε μετάλλαξη πρέπει να πιαστεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const AN0 = readFileSync(here("../gatewayLiveness.js"), "utf8").replace(/\r\n/g, "\n");
const H0 = readFileSync(here("../../custom_html_files/sag-map.html"), "utf8").replace(/\r\n/g, "\n");
const NOW = Date.parse("2026-11-07T12:00:00Z"), HR = 36e5;
const iso = (h) => new Date(NOW - h * HR).toISOString();
const A = "abcdef000000000000000001", B = "abcdef000000000000000002";

function pure(AN) {
  const start = AN.indexOf("const HEARD_TTL_H"), end = AN.indexOf("// ═══ T-GWMAP-04 (ΤΕΛΟΣ)");
  const sb = {}; vm.createContext(sb);
  vm.runInContext(AN.slice(start, end) + "\nglobalThis.X = { noteHeard, pruneHeard, heardList, HEARD_MAX_CHARS };", sb);
  return sb.X;
}
function linkOf(H) {
  const s = H.indexOf("function link(fields, gws)"); let d = 0, e = -1;
  for (let j = H.indexOf("{", s); j < H.length; j++) { if (H[j] === "{") d++; else if (H[j] === "}" && --d === 0) { e = j + 1; break; } }
  const sb = {}; vm.createContext(sb); vm.runInContext(H.slice(s, e) + "\nglobalThis.link = link;", sb); return sb.link;
}
function check(AN, H) {
  const bad = []; const want = (n, got, exp) => { if (JSON.stringify(got) !== JSON.stringify(exp)) bad.push(n + " πήρα " + JSON.stringify(got)); };
  const X = pure(AN);
  const h = {};
  X.noteHeard(h, A, "1000BBBB", iso(5)); X.noteHeard(h, A, "1000AAAA", iso(1)); X.noteHeard(h, A, "1000BBBB", iso(30));
  want("κρατά τη νεότερη ώρα", X.heardList(h, A, "1000AAAA", NOW), [["1000BBBB", 5]]);
  want("χωρίς την τρέχουσα", X.heardList(h, A, "1000BBBB", NOW), [["1000AAAA", 1]]);
  want("νεότερη πρώτα", X.heardList(h, A, null, NOW).map((x) => x[0]), ["1000AAAA", "1000BBBB"]);
  want("άγνωστο όργανο", X.heardList(h, B, null, NOW), []);
  X.noteHeard(h, B, null, iso(1)); X.noteHeard(h, B, "", iso(1)); X.noteHeard(h, B, "1000CCCC", "χάλια");
  want("άκυρα δεν μπαίνουν", X.heardList(h, B, null, NOW), []);
  const old = {}; X.noteHeard(old, A, "1000AAAA", iso(2)); X.noteHeard(old, A, "1000BBBB", iso(200)); X.noteHeard(old, B, "1000CCCC", iso(200));
  X.pruneHeard(old, NOW);
  want("λήξη 7 ημερών", X.heardList(old, A, null, NOW).map((x) => x[0]), ["1000AAAA"]);
  want("άδειο όργανο φεύγει", Object.keys(old).length, 1);
  const big = {}; for (let i = 0; i < 400; i++) { const id = "ff" + String(i).padStart(22, "0"); X.noteHeard(big, id, "1000AAAA", iso(1)); X.noteHeard(big, id, "1000BBBB", iso(2 + (i % 50))); }
  X.pruneHeard(big, NOW);
  want("όριο μεγέθους", JSON.stringify(big).length <= X.HEARD_MAX_CHARS || Object.keys(big).every((k) => Object.keys(big[k]).length === 1), true);
  want("κρατά την πιο πρόσφατη κάθε οργάνου", Object.keys(big).every((k) => big[k]["1000AAAA"] !== undefined), true);
  const link = linkOf(H);
  const g1 = { key: "a", code: "1000AAAA", heard: {}, rowFields: [], orphans: [] }, g2 = { key: "b", code: "1000BBBB", heard: {}, rowFields: [], orphans: [] };
  const d = { g: "1000AAAA", gs: [["1000BBBB", 5], ["1000ZZZZ", 7]] }, f = { key: "f", name: "Α", devs: [d], gws: {} };
  link([f], [g1, g2]);
  want("και οι δύο πύλες ακούν", [!!g1.heard.f, !!g2.heard.f], [true, true]);
  want("ο αγρός έχει και τις δύο", Object.keys(f.gws).sort(), ["a", "b"]);
  want("άγνωστος κωδικός δεν σπάει", g2.heard.f.k, 1);
  const f2 = { key: "x", name: "Β", devs: [{ g: null, gs: [] }], gws: {} }; link([f2], [g1]);
  want("χωρίς πύλη δεν συνδέεται", Object.keys(f2.gws), []);
  return bad;
}
const r = check(AN0, H0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ ανάλυση και σελίδα");
const MUT = [
  ["AN", "if (!(e[c] >= h)) e[c] = h;", "e[c] = h;"], ["AN", "c !== String(latest)", "true"], ["AN", ".sort((a, b) => e[b] - e[a])", ""], ["AN", 'code === ""', "false"],
  ["AN", "|| !Number.isFinite(h)", ""], ["AN", "if (heard[k][c] < cut) delete heard[k][c];", ""], ["AN", "if (!Object.keys(heard[k]).length) delete heard[k];", ""],
  ["AN", "&& heard[k][c] < newest", ""],
  ["H", "[d.g].concat((d.gs || []).map(function (x) { return x[0]; }))", "[d.g]"], ["H", "f.gws[g.key] = g;\n      });\n    });", "});\n    });"], ["H", "var g = code ? byCode[code] : null;\n        if (!g) return;", "var g = byCode[code];"],
];
let k = 0; for (const [w, a, b] of MUT) {
  const src = w === "AN" ? AN0 : H0; if (!src.includes(a)) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ", a.slice(0, 50)); process.exitCode = 1; continue; }
  let bad; try { bad = check(w === "AN" ? AN0.replace(a, b) : AN0, w === "H" ? H0.replace(a, b) : H0); } catch (e) { bad = ["εξαίρεση"]; }
  if (bad.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a.slice(0, 60)); process.exitCode = 1; }
}
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
