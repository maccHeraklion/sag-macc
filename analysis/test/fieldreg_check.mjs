/* T-FIELDREG-01 (11/11/2026) — ΕΛΕΓΧΟΣ του ελέγχου καταχώρησης αγρού (όνομα · θέση στον χάρτη · πύλη που ακούει).
   Φορτώνει τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις από gatewayLiveness.js και sag-map.html. Σενάρια από τον στόλο της 10/11:
   ΚΥΔΩΝ (φόρμα Χανιά, ετικέτα Ηράκλειο), αγρός μακριά από την πύλη, σωστή ετικέτα/λάθος φόρμα, κοινόχρηστος σταθμός,
   πύλες με τη θέση του γραφείου (κοινή θέση = άγνωστη), Κτήριο/Κτίριο V3, Υπόσκαφο ≠ Field_Κτήριο V11. Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import vm from "node:vm";
const AN0 = readFileSync(new URL("../gatewayLiveness.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const HT0 = readFileSync(new URL("../../custom_html_files/sag-map.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function fn(src, name) {
  const s = src.indexOf("function " + name + "(");
  if (s < 0) throw new Error("δεν βρέθηκε η " + name);
  let d = 0;
  for (let j = src.indexOf("{", s); j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) return src.slice(s, j + 1); }
  throw new Error("δεν έκλεισε η " + name);
}
function load(AN, HT) {
  const block = AN.slice(AN.indexOf("const MAP_ROW_MAX"), AN.indexOf("// ═══ T-GWMAP-04 (ΤΕΛΟΣ)"));
  const reg = AN.slice(AN.indexOf("// ═══ T-FIELDREG-01 (11/11/2026)"), AN.indexOf("// ═══ T-FIELDREG-01 (ΤΕΛΟΣ)"));
  const sb = { console: { log() {} } };
  vm.createContext(sb);
  vm.runInContext(AN.match(/const GR_BOX = [^\n]+/)[0] + "\n" + AN.match(/const WRONG_FIELD_KM = [^\n]+/)[0] + "\n"
    + ["ageHours", "haversineKm", "truncName"].map((n) => fn(AN, n)).join("\n") + "\n" + block + "\n" + reg
    + "\nglobalThis.X = { regCheckRows, regGatewayPositions, regFold, mapDeviceTypes, MAP_SHARED };", sb);
  const pg = { };
  vm.createContext(pg);
  vm.runInContext(fn(HT, "esc") + "\n" + fn(HT, "regKm") + "\n" + fn(HT, "regBlock") + "\n" + HT.match(/var REG_KM = [^\n]+/)[0] + "\nglobalThis.P = { regBlock };", pg);
  return { X: sb.X, P: pg.P };
}
const T = (k, v) => ({ key: k, value: v });
const cfg = (lat, lon) => T("configuration", JSON.stringify({ latitude: lat, longitude: lon }));
const CHANIA = [35.3754, 23.8139], HER = [35.2861, 25.3232], HER2 = [35.30, 25.10];
function world() {
  const pos = {
    GA: { lat: 35.40, lon: 23.85, decl: 1 },       // Χανιά, δηλωμένη
    GB: { lat: 35.40, lon: 23.85, decl: 1 },       // ίδια δηλωμένη θέση: μετρά (δηλωμένη)
    GC: { lat: 35.30, lon: 25.10, decl: 1 },       // Ηράκλειο, δηλωμένη
    GX: { lat: 35.3397, lon: 25.1623 }, GY: { lat: 35.3397, lon: 25.1623 },   // θέση γραφείου σε δύο πύλες = άγνωστη
    GZ: { lat: 35.31, lon: 25.12 },                // μοναδική θέση δικτύου (2 km από τον αγρό): μετρά
  };
  const fields = [
    { id: "f1", name: "Field_ΚΥΔΩΝ", tags: [T("name", "ΚΥΔΩΝ"), cfg(...CHANIA), T("coordinates", HER.join(", "))] },
    { id: "f2", name: "Field_Αγρός Β", tags: [T("name", "Αγρός Β"), cfg(...HER2), T("coordinates", HER2.join(", "))] },
    { id: "f3", name: "Field_Αγρός Γ", tags: [T("name", "Αγρός Γ"), cfg(...CHANIA), T("coordinates", "35.31, 25.11")] },
    { id: "f4", name: "Field_Αγρός Δ", tags: [T("name", "Αγρός Δ"), cfg(...HER2)] },
    { id: "f5", name: "Field_Αγρός Ε", tags: [T("name", "Αγρός Ε")] },
    { id: "f6", name: "Field_Κτήριο V3", tags: [T("name", "Κτήριο V3"), cfg(...HER2)] },
    { id: "f7", name: "Field_Κτίριο V3", tags: [T("name", "Κτίριο V3"), cfg(...HER2)] },
    { id: "f8", name: "Field_Κτήριο V11", tags: [T("name", "Υπόσκαφο"), cfg(...HER2)] },
    { id: "f9", name: "Field_Αγρός Θ", tags: [T("name", "Αγρός Θ"), cfg(...HER2)] },
  ];
  const row = (i, n, p, ps, dv) => ({ variable: "map_field", metadata: { i, n, y: p ? p[0] : null, x: p ? p[1] : null, ps, pq: "ok", dv } });
  const rows = [
    row("f1", "ΚΥΔΩΝ", CHANIA, "form", [{ i: "aaaaa1", g: "GQ", gs: [["GA", 3]] }]),     // μάρτυρας μόνο στο gs
    row("f2", "Αγρός Β", HER2, "form", [{ i: "aaaaa2", g: "GB" }]),
    row("f3", "Αγρός Γ", CHANIA, "form", [{ i: "aaaaa3", g: "GC" }]),
    row("f4", "Αγρός Δ", HER2, "form", [{ i: "ssssss", g: "GA" }]),                     // μόνο κοινόχρηστο
    row("f5", "Αγρός Ε", null, null, [{ i: "aaaaa5", g: "GC" }]),
    row("f6", "Κτήριο V3", HER2, "form", [{ i: "aaaaa6", g: "GC" }]),
    row("f7", "Κτίριο V3", HER2, "form", [{ i: "aaaaa7", g: "GC" }]),
    row("f8", "Υπόσκαφο", HER2, "form", [{ i: "aaaaa8", g: "GZ" }]),
    row("f9", "Αγρός Θ", HER2, "form", [{ i: "aaaaa9", g: "GX" }]),                      // μόνο πύλη με θέση γραφείου
  ];
  return { pos, fields, rows };
}
async function check(AN, HT) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  try {
    const { X, P } = load(AN, HT);
    const W = world();
    const gp = X.regGatewayPositions(W.pos, new Map());
    want("Π1 θέση γραφείου σε δύο πύλες = άγνωστη", [gp.has("GX"), gp.has("GY"), gp.has("GZ"), gp.has("GA"), gp.has("GB")], [false, false, true, true, true]);
    const sum = X.regCheckRows(W.rows, W.fields, gp, new Set(["ssssss"]));
    const rc = (i) => W.rows.find((r) => r.metadata.i === i).metadata.rc;
    want("Α1 ΚΥΔΩΝ επιβεβαιώνεται από πύλη του gs", [rc("f1").v, rc("f1").g], ["ok", "GA"]);
    want("Α2 ΚΥΔΩΝ: η ετικέτα είναι παλιά", rc("f1").x, "tagold");
    want("Β1 αγρός μακριά από την πύλη", [rc("f2").v, rc("f2").km > 100, rc("f2").a], ["far", true, undefined]);
    want("Γ1 λάθος φόρμα, σωστή ετικέτα", [rc("f3").v, rc("f3").a, rc("f3").ak < 2], ["far", "tag", true]);
    want("Δ1 κοινόχρηστο δεν είναι μάρτυρας", rc("f4").v, "nogw");
    want("Ε1 χωρίς θέση", rc("f5").v, "nopos");
    want("Ζ1 Κτήριο/Κτίριο V3 = ίδιο όνομα", [rc("f6").nm, rc("f7").nm, rc("f6").nd], ["dup", "dup", 1]);
    want("Ζ2 όνομα ≠ όνομα συσκευής", [rc("f8").nm, rc("f8").on], ["ren", "Field_Κτήριο V11"]);
    want("Ζ3 μοναδική θέση δικτύου μετρά", rc("f8").v, "ok");
    want("Θ1 μόνο πύλη γραφείου → χωρίς μάρτυρα", rc("f9").v, "nogw");
    want("Σ1 σύνοψη", [sum.n, sum.ok, sum.far, sum.nogw, sum.nopos, sum.dup, sum.ren], [9, 4, 2, 2, 1, 2, 1]);
    // κοινόχρηστα από τις ετικέτες συσκευών
    X.mapDeviceTypes([{ id: "x".repeat(18) + "ssssss", tags: [T("type", "s2120"), T("shared_instrument", "yes")] }, { id: "y".repeat(18) + "nnnnnn", tags: [T("type", "se0x")] }]);
    want("Κ1 η mapDeviceTypes σημειώνει τα κοινόχρηστα", [X.MAP_SHARED.has("ssssss"), X.MAP_SHARED.has("nnnnnn")], [true, false]);
    // σελίδα
    const f = (r) => ({ rc: r, gws: { k1: { code: "GA", key: "gw:GA", name: "Πύλη Χανιά" } } });
    const h1 = P.regBlock(f(rc("f1"))), h3 = P.regBlock(f(rc("f3"))), h6 = P.regBlock(f(rc("f6"))), h8 = P.regBlock(f(rc("f8")));
    want("Σ2 σελίδα: επιβεβαίωση με σύνδεσμο πύλης", [h1.includes("✔ Η θέση επιβεβαιώνεται"), h1.includes('data-key="gw:GA"'), h1.includes("παλιά θέση")], [true, true, true]);
    want("Σ3 σελίδα: μακριά + ποιο αντίγραφο συμφωνεί", [h3.includes("⚠"), h3.includes("της ετικέτας coordinates απέχει μόνο")], [true, true]);
    want("Σ4 σελίδα: ονόματα", [h6.includes("άλλη μία εγγραφή"), h8.includes("Field_Κτήριο V11")], [true, true]);
    want("Σ5 σελίδα: χωρίς rc τίποτα", P.regBlock({ rc: null }), "");
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const base = await check(AN0, HT0);
for (const b of base) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(base.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ έλεγχος καταχώρησης");
const MUT = [
  ["an", "πάντα «επιβεβαιωμένη»", "if (b.km <= REG_NEAR_KM) {", "if (true) {"],
  ["an", "κοινόχρηστο ως μάρτυρας", "if (shared6 && shared6.has(String(d.i))) continue;", ""],
  ["an", "χωρίς εναλλακτικό αντίγραφο", "if (ab && ab.km <= REG_NEAR_KM) {", "if (false) {"],
  ["an", "εμπιστεύεται τη θέση γραφείου", "if (q.decl || cnt.get(key(q)) === 1) out.set(c, q);", "out.set(c, q);"],
  ["an", "χωρίς «παλιά ετικέτα»", 'if (m.ps === "form" && tag && haversineKm(form.lat, form.lng, tag.lat, tag.lng) > MAP_DIFF_KM) rc.x = "tagold";', ""],
  ["an", "χωρίς διπλά ονόματα", "if (nk && byName.get(nk) > 1) {", "if (false) {"],
  ["an", "η/ι ως διαφορετικά", '.replace(/ει|οι|[ηυ]/g, "ι")', ""],
  ["an", "αγνοεί τις άλλες πύλες (gs)", "for (const x of d.gs || []) if (x && x[0]) codes.add(String(x[0]).toUpperCase());", ""],
  ["an", "χωρίς μετονομασία", 'rc.nm = "ren"', 'rc.nm = undefined'],
  ["an", "χωρίς σήμανση κοινόχρηστων", "MAP_SHARED.add(String(d.id).slice(-6));", ";"],
  ["ht", "σελίδα: χωρίς εναλλακτικό", "if (rc.a) h +=", "if (false) h +="],
  ["ht", "σελίδα: χωρίς παλιά ετικέτα", "if (rc.x === 'tagold') h +=", "if (false) h +="],
];
let k = 0;
for (const [w, n, a, b] of MUT) {
  const src = w === "an" ? AN0 : HT0;
  if (src.split(a).length !== 2) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exitCode = 1; continue; }
  const r = await check(w === "an" ? src.replace(a, b) : AN0, w === "ht" ? src.replace(a, b) : HT0);
  if (r.length) { k++; console.log("✓ σκοτώθηκε «" + n + "» ← " + r[0].slice(0, 100)); } else { console.log("✗✗ ΕΠΕΖΗΣΕ «" + n + "»"); process.exitCode = 1; }
}
console.log(`μεταλλάξεις ${k}/${MUT.length}`);
if (base.length) process.exitCode = 1;
