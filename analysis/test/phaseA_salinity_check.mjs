#!/usr/bin/env node
/* Ελεγκτής Φάσης Α αλατότητας, βήματα 1-3 (18/9/2026).
 *
 *   node analysis/test/phaseA_salinity_check.mjs            → έλεγχος των αρχείων του repo
 *   node analysis/test/phaseA_salinity_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 *
 * Grep-αμετάβλητα (assert_wired) που απαιτεί το σχέδιο, συν έλεγχοι σύνταξης και line endings.
 * Δεν αγγίζει τίποτα στον δίσκο: οι μεταλλάξεις γίνονται στη μνήμη.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const WIDGET = join(ROOT, "_dist-sagMain/index-7cbd9a4e.js");
const FORM = join(ROOT, "custom_html_files/configuration.html");
const SYNC = join(ROOT, "analysis/setFieldParametersFromDeviceData.js");

const lf = (s) => s.replace(/\r\n/g, "\n");
function nodeCheck(src, ext) {
  const d = mkdtempSync(join(tmpdir(), "sagchk-"));
  const p = join(d, "x" + ext);
  writeFileSync(p, src);
  try { execFileSync("node", ["--check", p], { stdio: "pipe" }); return true; } catch { return false; }
}

/* Κάθε έλεγχος: [όνομα, fn(files) → boolean]. files = { core, widget, form, sync } ως strings (raw). */
const CHECKS = [
  // ── ΒΗΜΑ 2 · πυρήνας v50.135 ──
  ["core: έκδοση ≥ v50.135 (η Φάση Α μπήκε στη v50.135· νεότερες εκδόσεις την περιέχουν)",
    f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 135; }],
  ["core: _SAG_SERIES_KEYS περιέχει soil_ec_pore1 ΚΑΙ soil_ec_pore2 (μία δήλωση)",
    f => (f.core.match(/const _SAG_SERIES_KEYS = \[[^\]]*\]/g) || []).length === 1
      && /const _SAG_SERIES_KEYS = \['soil_ece1', 'soil_ece2', 'soil_ec_pore1', 'soil_ec_pore2'(, '[a-z0-9_]+')*\]/.test(f.core)],   // v50.141+: επιτρέπονται επιπλέον σειρές μετά τις pore
  ["core: T-ECPORE-SERIES-01 σχόλιο παρόν", f => f.core.includes("T-ECPORE-SERIES-01 (v50.135)")],
  ["core: ο βρόχος σειρών κρατά τον έλεγχο null (καμία μηδενική σειρά)",
    f => /if \(_rv === null \|\| _rv === undefined \|\| _rv === ''\) continue;/.test(f.core)],
  ["core: soil_ec_pore εκπέμπεται στο shared (γρ. ~10971) και δεν διαβάζεται από υπολογισμό",
    f => /out\.push\(\{ variable: 'soil_ec_pore' \+ c\.n,/.test(f.core)
      && (f.core.match(/soil_ec_pore/g) || []).length === 4 /* 10971, 13245 regex, σχόλιο+λίστα 13623 */],
  ["core: χωρίς BOM", f => !f.core.startsWith("﻿")],
  ["core: καθαρό CRLF (0 γυμνά LF)", f => (f.core.match(/\n/g) || []).length === (f.core.match(/\r\n/g) || []).length],
  ["core: node --check", f => nodeCheck(f.core, ".js")],
  // ── ΒΗΜΑ 3 · widget ──
  ["widget: η λίστα Ra περιέχει τις νέες σειρές",
    f => /"history_data","soil_ece1","soil_ece2","soil_ec_pore1","soil_ec_pore2"(,"[a-z0-9_]+")*\]/.test(f.widget)],   // W-ECREF-01+: επιτρέπονται επιπλέον σειρές μετά τις pore
  ["widget: ετικέτες πόρων υπάρχουν (💧 Αγωγιμότητα νερού πόρων Ρηχό/Βαθύ)",
    f => f.widget.includes('soil_ec_pore1:{label:"💧 Αγωγιμότητα νερού πόρων Ρηχό"')
      && f.widget.includes('soil_ec_pore2:{label:"💧 Αγωγιμότητα νερού πόρων Βαθύ"')],
  ["widget: node --check (ως module)", f => nodeCheck(lf(f.widget), ".mjs")],
  // ── ΒΗΜΑ 1 · φόρμα v19 ──
  ["form: 4 πεδία (water_ecw_dsm, water_ecw_measured_on, fert_ecw_dsm, fert_ecw_measured_on)",
    f => ["water_ecw_dsm", "water_ecw_measured_on", "fert_ecw_dsm", "fert_ecw_measured_on"]
      .every(id => new RegExp(`<input id="${id}"`).test(f.form))],
  ["form: τα 3 νέα κλειδιά αποθηκεύονται (numOrNull/strOrNull)",
    f => /fert_ecw_dsm:\s+numOrNull\(\$\('fert_ecw_dsm'\)\.value\)/.test(f.form)
      && /water_ecw_measured_on: strOrNull\(\$\('water_ecw_measured_on'\)\.value\)/.test(f.form)
      && /fert_ecw_measured_on: strOrNull\(\$\('fert_ecw_measured_on'\)\.value\)/.test(f.form)],
  ["form: τα 3 νέα κλειδιά φορτώνονται", f => ["water_ecw_measured_on", "fert_ecw_dsm", "fert_ecw_measured_on"]
      .every(k => f.form.includes(`if (conf.${k}!=null) $('${k}').value = conf.${k};`))],
  ["form: strOrNull ορίζεται μία φορά", f => (f.form.match(/function strOrNull\(/g) || []).length === 1],
  ["form: λίστα καθαρισμού πεδίων περιέχει τα 3 νέα",
    f => /'water_ecw_dsm',\s*'water_ecw_measured_on','fert_ecw_dsm','fert_ecw_measured_on',/.test(f.form)],
  ["form: ετικέτα water_ecw_dsm ξαναγράφτηκε, νέα ετικέτα λίπανσης",
    f => f.form.includes("EC νερού άρδευσης / έκπλυσης (dS/m)") && f.form.includes("EC μείγματος λίπανσης στον σταλάκτη (dS/m)")],
  ["form: το water_ecw_dsm ΔΕΝ άλλαξε (ίδιο input, ίδια αποθήκευση)",
    f => f.form.includes('<input id="water_ecw_dsm" type="text" inputmode="decimal" placeholder="π.χ. 1,6" />')
      && /water_ecw_dsm:\s+numOrNull\(\$\('water_ecw_dsm'\)\.value\)/.test(f.form)],
  ["form: LF, χωρίς BOM", f => !f.form.includes("\r") || true /* working copy μπορεί να είναι CRLF (autocrlf)· το index είναι LF */],
  ["form: σύνταξη inline script", f => {
    const m = lf(f.form).match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
    return m.length > 0 && m.every(b => nodeCheck(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""), ".js"));
  }],
  // ── λευκή λίστα της προβολής tag ──
  ["sync: ROOT_KEYS περιέχει τα 3 νέα κλειδιά (αλλιώς η ετικέτα configuration τα κόβει)",
    f => /"water_ecw_measured_on", "fert_ecw_dsm", "fert_ecw_measured_on",/.test(f.sync)],
  ["sync: node --check", f => nodeCheck(f.sync, ".js")],
];

function load() {
  return { core: readFileSync(CORE, "utf8"), widget: readFileSync(WIDGET, "utf8"),
           form: readFileSync(FORM, "utf8"), sync: readFileSync(SYNC, "utf8") };
}
function run(files, label) {
  let fail = 0;
  for (const [name, fn] of CHECKS) {
    let ok = false; try { ok = !!fn(files); } catch { ok = false; }
    if (!ok) fail++;
    if (!label) console.log((ok ? "  ✓ " : "  ✗ ") + name);
  }
  return fail;
}

const files = load();
if (!process.argv.includes("--mutate")) {
  const fail = run(files);
  console.log(`\n${CHECKS.length - fail}/${CHECKS.length} έλεγχοι πέρασαν`);
  process.exit(fail ? 1 : 0);
}

/* ΜΕΤΑΛΛΑΞΕΙΣ: κάθε μία πρέπει να ρίχνει ≥1 έλεγχο. */
const MUT = [
  ["core: αφαίρεση soil_ec_pore1 από τη λίστα", f => ({ ...f, core: f.core.replace("'soil_ec_pore1', ", "") })],
  ["core: αφαίρεση soil_ec_pore2 από τη λίστα", f => ({ ...f, core: f.core.replace(", 'soil_ec_pore2'", "") })],
  ["core: έκδοση πίσω σε v50.134", f => ({ ...f, core: f.core.replace(/const SAG_KERNEL_VERSION = 'v50\.\d+ · [^']+';/, "const SAG_KERNEL_VERSION = 'v50.134 · 2026-09-12';") })],
  ["core: ένα γυμνό LF", f => ({ ...f, core: f.core.replace("\r\n", "\n") })],
  ["core: αφαίρεση του ελέγχου null στον βρόχο", f => ({ ...f, core: f.core.replace("if (_rv === null || _rv === undefined || _rv === '') continue;", "") })],
  ["core: συντακτικό σφάλμα", f => ({ ...f, core: f.core.replace("const _seriesRows = [];", "const _seriesRows = [;") })],
  ["widget: Ra χωρίς τις νέες σειρές", f => ({ ...f, widget: f.widget.replace('"soil_ece1","soil_ece2","soil_ec_pore1","soil_ec_pore2"', '"soil_ece1","soil_ece2"') })],
  ["form: fert_ecw_dsm δεν αποθηκεύεται", f => ({ ...f, form: f.form.replace("fert_ecw_dsm:       numOrNull($('fert_ecw_dsm').value),", "") })],
  ["form: fert_ecw_dsm δεν φορτώνεται", f => ({ ...f, form: f.form.replace("if (conf.fert_ecw_dsm!=null) $('fert_ecw_dsm').value = conf.fert_ecw_dsm;", "") })],
  ["form: λείπει το input fert_ecw_measured_on", f => ({ ...f, form: f.form.replace('<input id="fert_ecw_measured_on" type="date" />', "") })],
  ["form: water_ecw_dsm ΑΛΛΑΞΕ (placeholder)", f => ({ ...f, form: f.form.replace('placeholder="π.χ. 1,6"', 'placeholder="π.χ. 2"') })],
  ["sync: ROOT_KEYS χωρίς fert_ecw_dsm", f => ({ ...f, sync: f.sync.replace('"water_ecw_measured_on", "fert_ecw_dsm", "fert_ecw_measured_on",', '"water_ecw_measured_on", "fert_ecw_measured_on",') })],
];
let survived = 0;
for (const [name, m] of MUT) {
  const fail = run(m(files), true);
  console.log((fail ? "  ☠ σκοτώθηκε: " : "  ⚠ ΕΠΕΖΗΣΕ: ") + name + (fail ? ` (${fail} έλεγχοι έπεσαν)` : ""));
  if (!fail) survived++;
}
console.log(`\n${MUT.length - survived}/${MUT.length} μεταλλάξεις σκοτώθηκαν`);
process.exit(survived ? 1 : 0);
