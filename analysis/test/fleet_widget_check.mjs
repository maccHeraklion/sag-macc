#!/usr/bin/env node
/* Ελεγκτής σελίδας custom_html_files/sag-fleet.html · W-FLEETHEALTH-01 (19/9/2026)
 * Εξάγει ΑΥΤΟΛΕΞΕΙ από τη σελίδα τις sev/age/why/healthRow/renderSys/hAge/hNum και τις ΕΚΤΕΛΕΙ
 * (με ελάχιστο ψεύτικο document), ώστε ο έλεγχος να μην είναι αναζήτηση κειμένου.
 *
 *   node analysis/test/fleet_widget_check.mjs            → έλεγχοι
 *   node analysis/test/fleet_widget_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PAGE = join(ROOT, "custom_html_files/sag-fleet.html");
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };
const fn = (c, name) => { const src = slice(c, "function " + name + "(", "\n}\n"); return src ? src + "\n}\n" : null; };

/* Ψεύτικο document: κρατά ΜΟΝΟ το innerHTML ανά id — αρκεί για να διαβάσουμε τι έγραψε η renderSys. */
const DOMSTUB = `
  var _els = {};
  var document = { getElementById: function (id) { return (_els[id] = _els[id] || { id: id, innerHTML: '', textContent: '' }); } };
  var STATE = { rows: [], sum: null, at: null, filter: -1, sort: 'sev', q: '', open: {}, live: false };
  function nf(n) { return String(n); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
`;
function build(page) {
  const parts = [DOMSTUB, fn(page, "sev"), fn(page, "age"), fn(page, "hNum"), fn(page, "hAge"), fn(page, "hB"),
                 fn(page, "healthRow"), fn(page, "renderSys"), fn(page, "why")];
  if (parts.some(p => !p)) return null;
  return new Function(parts.join("\n")
    + "\nreturn { sev: sev, age: age, hAge: hAge, hNum: hNum, healthRow: healthRow, why: why,"
    + " sys: function (m, live) { STATE.sum = m ? { metadata: m } : null; STATE.live = !!live; renderSys(); return _els.sys.innerHTML; } };")();
}
const SUM = { kernel: "v50.143 · 2026-09-19", tick: { h: 1, d: 0, th: 1, gap: 0 }, ms: 42000,
  total: 42, computed: 42, nocfg: 0, errors: [], nopos: 6, locvar: 3,
  reads: { real: 300, cached: 700 },
  files: [{ p: "storage/sagMain/sag-fleet.html", h: 200, t: "text/html", c: 1 },
          { p: "storage/sagMain/index.html", h: 200, t: "text/html", c: 1 }],
  files_bad: 0, an: [{ n: "πρόγνωση", id: "6d225", h: 8.2, a: 1 }] };
const BAD = JSON.parse(JSON.stringify(SUM));
BAD.files[0] = { p: "storage/sagMain/sag-fleet.html", h: 403, t: "application/json", c: 0 };
BAD.files_bad = 1; BAD.computed = 40; BAD.errors = ["ΚΕΚ", "Κουκιά"]; BAD.nocfg = 2;
BAD.an = [{ n: "πρόγνωση", id: "6d225", h: 80, a: 1 }, { n: "φόρμα", id: "f833c", h: 2, a: 0 }];

const CHECKS = [
  ["σελίδα: LF χωρίς BOM και έγκυρη σύνταξη σε κάθε ενσωματωμένο <script>", f => {
    if (f.page.charCodeAt(0) === 0xFEFF || f.page.includes("\r")) return false;
    const blocks = [...f.page.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    if (blocks.length < 3) return false;
    return blocks.every((b, i) => { const t = join(tmpdir(), "fleet_widget_check_" + i + ".js"); writeFileSync(t, b);
      try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } });
  }],
  ["σελίδα: υπάρχει το δοχείο #sys ΠΡΙΝ από τη γραμμή ελέγχων και το render() καλεί renderSys()", f =>
    f.page.indexOf('<div class="sys" id="sys"></div>') > f.page.indexOf('<div class="hero" id="hero"></div>')
    && f.page.indexOf('<div class="sys" id="sys"></div>') < f.page.indexOf('<div class="bar">')
    && /function render\(\) \{\s*renderHero\(\);\s*renderSys\(\);/.test(f.page)],
  ["ΥΓΕΙΑ: πυρήνας χωρίς τα νέα πεδία (ή εκτός σύνδεσης) -> ΚΑΝΕΝΑ πλαίσιο (κανένα ψεύτικο «όλα καλά»)", f => {
    const g = build(f.page); if (!g) return false;
    return g.sys(null, true) === "" && g.sys(SUM, false) === "" && g.sys({}, true) === ""; }],
  ["ΥΓΕΙΑ: υγιής παλμός -> πράσινα αρχεία «2/2 απαντούν», αγροί 42/42, καμία κόκκινη ένδειξη", f => {
    const g = build(f.page); if (!g) return false; const h = g.sys(SUM, true);
    return h.includes("Υγεία συστήματος") && h.includes("2/2 απαντούν") && h.includes("42/42")
      && h.includes("v50.143") && !h.includes("chip bad"); }],
  ["ΥΓΕΙΑ: αρχείο που δεν απαντά -> ΚΟΚΚΙΝΟ με το ΟΝΟΜΑ του αρχείου και τον κωδικό (παγίδα #225)", f => {
    const g = build(f.page); if (!g) return false; const h = g.sys(BAD, true);
    return h.includes("chip bad") && h.includes("sag-fleet.html") && h.includes("403"); }],
  ["ΥΓΕΙΑ: αγροί που απέτυχαν -> κόκκινο με ονόματα· χωρίς ρύθμιση -> πορτοκαλί· 40/42", f => {
    const g = build(f.page); if (!g) return false; const h = g.sys(BAD, true);
    return h.includes("ΚΕΚ, Κουκιά") && h.includes("40/42") && h.includes("2 αγροί"); }],
  ["ΥΓΕΙΑ: analysis 80 ωρών -> κόκκινο· ΑΝΕΝΕΡΓΗ analysis -> κόκκινο με τη λέξη ΑΝΕΝΕΡΓΗ", f => {
    const g = build(f.page); if (!g) return false; const h = g.sys(BAD, true);
    return h.includes("ΑΝΕΝΕΡΓΗ") && (h.match(/chip bad/g) || []).length >= 3; }],
  ["ΥΓΕΙΑ: ΑΝΕΝΕΡΓΗ analysis σε κατά τα άλλα υγιή παλμό -> ΑΚΡΙΒΩΣ μία κόκκινη ένδειξη, η δική της", f => {
    const g = build(f.page); if (!g) return false;
    const m = JSON.parse(JSON.stringify(SUM)); m.an = [{ n: "φόρμα", id: "f833c", h: 2, a: 0 }];
    const h = g.sys(m, true);
    return (h.match(/chip bad/g) || []).length === 1 && h.includes("ΑΝΕΝΕΡΓΗ"); }],
  ["ΑΓΡΟΣ: σφάλμα κύκλου -> κόκκινη γραμμή υγείας ΚΑΙ πρώτο στο «γιατί»", f => {
    const g = build(f.page); if (!g) return false;
    const r = { f: "Α", i: "1", s: 2, e: "boom", d: [], z: [{ d: "x", t: "βλάβη", k: 1 }], g: [] };
    return g.healthRow(r).includes("Σφάλμα κύκλου: boom") && g.why(r).indexOf("Ο υπολογισμός απέτυχε: boom") === 0; }],
  ["ΑΓΡΟΣ: χωρίς ρύθμιση -> το «γιατί» το λέει, όχι «Όλα τα όργανα λειτουργούν»", f => {
    const g = build(f.page); if (!g) return false;
    const r = { f: "Α", i: "1", s: 1, nc: 1, d: [], z: [], g: ["ρύθμιση αγρού από τη φόρμα (καμία)"] };
    return /Δεν έχει ρύθμιση στη φόρμα/.test(g.why(r)) && g.healthRow(r).includes("Χωρίς ρύθμιση στη φόρμα"); }],
  ["ΑΓΡΟΣ: ok=0 -> «Δεν γράφτηκε κάρτα»· ok=1 -> μέγεθος· bt=1 -> προειδοποίηση περικοπής", f => {
    const g = build(f.page); if (!g) return false;
    const base = { f: "Α", i: "1", s: 0, d: [], z: [], g: [] };
    return g.healthRow({ ...base, ok: 0 }).includes("Δεν γράφτηκε κάρτα")
      && g.why({ ...base, ok: 0 }).includes("Δεν γράφτηκε κάρτα")
      && g.healthRow({ ...base, ok: 1, bb: 3204 }).includes("3204 B")
      && g.healthRow({ ...base, ok: 1, bb: 9100, bt: 1 }).includes("κόπηκαν παλιοί δείκτες"); }],
  ["ΑΓΡΟΣ: παλιός πυρήνας (χωρίς ok/fc/rj) -> ΚΑΜΙΑ γραμμή υγείας και κανένας ψεύτικος συναγερμός", f => {
    const g = build(f.page); if (!g) return false;
    const r = { f: "Α", i: "1", s: 0, d: [{ n: "d1", h: 1, q: 0, b: "3.5V", l: 0 }], z: [], g: [] };
    return g.healthRow(r) === "" && g.why(r) === "Όλα τα όργανα λειτουργούν"; }],
  ["ΑΓΡΟΣ: πρόγνωση 30 ωρών -> πορτοκαλί· fc=null -> «Χωρίς πρόγνωση»· απορρίψεις -> πορτοκαλί", f => {
    const g = build(f.page); if (!g) return false;
    const base = { f: "Α", i: "1", s: 0, d: [], z: [], g: [], ok: 1 };
    return g.healthRow({ ...base, fc: 30 }).includes("warn")
      && g.healthRow({ ...base, fc: null }).includes("Χωρίς πρόγνωση")
      && g.healthRow({ ...base, fc: 2, rj: 12 }).includes("12 μετρήσεις απορρίφθηκαν"); }],
  ["ΔΙΟΡΘΩΣΗ: σύνοψη ΧΩΡΙΣ γραμμές αγρών δεν ρίχνει πια στο παγωμένο δείγμα", f =>
    f.page.includes("if (!rows.length && !sum) return false;") && !f.page.includes("\n  if (!rows.length) return false;")],
  ["ΔΙΟΡΘΩΣΗ: καμία χρήση isFinite() σε ώρες σιωπής — μόνο Number.isFinite", f =>
    !/\(isFinite\(d\.h\)/.test(f.page) && (f.page.match(/Number\.isFinite\(d\.h\) && d\.h > 48/g) || []).length === 3],
  ["ΔΙΟΡΘΩΣΗ: η sev() εφαρμόζεται ΚΑΙ στο παγωμένο δείγμα", f =>
    /STATE\.rows = window\.SAG_DEMO\.map\(function \(r\) \{ r\.s = sev\(r\.s\); return r; \}\);/.test(f.page)],
  ["ΔΙΟΡΘΩΣΗ: η ετικέτα «Άνοιγμα όλων» γράφεται από το render (syncExpand), όχι μία φορά στο κλικ", f =>
    f.page.includes("function syncExpand() {") && /render\(\) \{[\s\S]{0,200}syncExpand\(\);/.test(f.page)
    && !/vis\.forEach\(function \(r\) \{ STATE\.open\[r\.f \+ '\|' \+ r\.i\] = anyClosed; \}\);\s*\n\s*this\.textContent/.test(f.page)],
  ["ΣΥΜΦΩΝΙΑ ΜΕ ΤΟΝ ΠΥΡΗΝΑ: κάθε πεδίο που διαβάζει η σελίδα το γράφει ο v50.143", f => {
    const rowKeys = ["e:", "nc:", "fc:", "rj:", "ok:", "bb:", "bt:"];
    const sumKeys = ["total:", "computed:", "nocfg:", "errors:", "nopos:", "tick:", "ms:", "reads:", "files:", "an:"];
    return rowKeys.every(k => f.core.includes("            " + k) || f.core.includes(" " + k))
      && sumKeys.every(k => f.core.includes("          " + k)); }],
];

const MUTATIONS = [
  ["το πλαίσιο υγείας εμφανίζεται και χωρίς δεδομένα", c => c.replace("if (!m || !STATE.live) { el.innerHTML = ''; return; }", "if (false) { el.innerHTML = ''; return; }")],
  ["τα χαλασμένα αρχεία δεν γίνονται κόκκινα", c => c.replace("    if (bad.length) {", "    if (false) {")],
  ["δεν αναφέρεται ΠΟΙΟ αρχείο λείπει", c => c.replace("return (String(x.p).split('/').pop()) + ' (' + (x.h || '—') + ')'; }).join(', '));", "return ''; }).join(''));")],
  ["οι αγροί που απέτυχαν δεν αναφέρονται", c => c.replace("if (errs.length) chip('bad', 'Σφάλμα κύκλου',", "if (false) chip('bad', 'Σφάλμα κύκλου',")],
  ["ανενεργή analysis περνά για υγιής", c => c.replace("var k = (a.a === 0 || a.e) ? 'bad'", "var k = (false) ? 'bad'")],
  ["το σφάλμα κύκλου δεν προηγείται στο «γιατί»", c => c.replace("  if (r.e) return 'Ο υπολογισμός απέτυχε: ' + r.e;", "")],
  ["η γραμμή υγείας αγνοεί το ok=0", c => c.replace("if (r.ok === 0 && !r.e && !r.nc) h.push('<span class=\"bad\">Δεν γράφτηκε κάρτα</span>');", "")],
  ["η γραμμή υγείας εμφανίζεται και σε παλιό πυρήνα (ψεύτικος συναγερμός)", c => c.replace("  if (!h.length) return '';", "  if (!h.length) return '<div class=\"sect\"><h3>Υγεία υπολογισμού</h3><div class=\"hx\"><span>—</span></div></div>';")],
  ["η σύνοψη χωρίς γραμμές ξαναρίχνει στο δείγμα", c => c.replace("if (!rows.length && !sum) return false;", "if (!rows.length) return false;")],
  ["επιστροφή στο isFinite() για τις ώρες σιωπής", c => c.replace("var dead = d.q || (Number.isFinite(d.h) && d.h > 48);", "var dead = d.q || (isFinite(d.h) && d.h > 48);")],
  ["το δείγμα ξαναμπαίνει χωρίς sev()", c => c.replace("STATE.rows = window.SAG_DEMO.map(function (r) { r.s = sev(r.s); return r; });", "STATE.rows = window.SAG_DEMO;")],
  ["το render δεν συγχρονίζει την ετικέτα", c => c.replace("  var list = STATE.rows.filter(matches);\n  syncExpand();", "  var list = STATE.rows.filter(matches);")],
];

function load(page, core) { return { page, core }; }
function run(f) { let ok = 0, bad = 0; for (const [n, x] of CHECKS) { let r = false; try { r = !!x(f); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
const page = readFileSync(PAGE, "utf8"), core = readFileSync(CORE, "utf8").replace(/\r\n/g, "\n");
if (process.argv.includes("--mutate")) {
  const b0 = run(load(page, core)); if (b0.bad) { console.log(`Βάση: ${b0.ok} OK · ${b0.bad} X`); process.exit(1); }
  let killed = 0;
  for (const [n, mut] of MUTATIONS) {
    const m = mut(page);
    if (m === page) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + n); continue; }
    const r = run(load(m, core)); if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad}): ${n}`); } else console.log("  ✘ ΕΠΕΖΗΣΕ: " + n);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`); process.exit(killed === MUTATIONS.length ? 0 : 1);
} else { const r = run(load(page, core)); console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`); process.exit(r.bad ? 1 : 0); }
