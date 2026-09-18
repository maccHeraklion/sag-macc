#!/usr/bin/env node
/* Ελεγκτής T-BPI-LIGHTEST-01 (πυρήνας v50.136 + analysis forecast v9), 18/9/2026.
 *
 *   node analysis/test/bpi_lightest_check.mjs            → στατικοί έλεγχοι + ΕΚΤΕΛΕΣΗ της _sagBpiLightEstimate
 *   node analysis/test/bpi_lightest_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 *
 * Η συνάρτηση εκτίμησης εξάγεται ΑΥΤΟΥΣΙΑ από τον πυρήνα (ανάμεσα στους δείκτες T-BPI-LIGHTEST-01)
 * και τρέχει με στελέχη για readVal / _SAG_COVERED_ACTIVE. Τίποτα δεν γράφεται στον δίσκο.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const FC = join(ROOT, "analysis/forecast.js");
const lf = (s) => s.replace(/\r\n/g, "\n");

function extractHelper(core) {
  const a = core.indexOf("// ── T-BPI-LIGHTEST-01 (v50.136");
  const b = core.indexOf("// ── End T-BPI-LIGHTEST-01");
  if (a < 0 || b < 0) return null;
  return core.slice(a, b);
}
function buildEstimator(helperSrc, covered = false) {
  // στελέχη: readVal όπως στον πυρήνα (πρώτη τιμή σειράς ή αριθμός), σημαία καλύμματος
  const src = `
    const readVal = (s) => Array.isArray(s) ? Number(s[0] && s[0].value) : Number(s);
    let _SAG_COVERED_ACTIVE = ${covered ? "true" : "false"};
    ${helperSrc}
    return _sagBpiLightEstimate;`;
  return new Function(src)();
}
const NOW = Date.parse("2026-09-18T00:20:00Z");   // ημερήσιο tick → «χθες» = 2026-09-17 Αθήνας
const RAD = { dates: ["2026-09-17", "2026-09-18"], shortwave_radiation_sum: [16.08, 21.77] };
const meas = (extra = {}) => ({ now: NOW, timezone: "Europe/Athens", data: { _sagForecast: { radiation: RAD }, ...extra } });
const PPFD_EXPECTED = 16.08 * 1e6 * 0.45 * 4.57 / 86400;   // 382,7 µmol/m²/s
const near = (a, b, tol = 0.5) => Number.isFinite(a) && Math.abs(a - b) <= tol;

const CHECKS = [
  // ── στατικά · πυρήνας ──
  ["core: έκδοση ≥ v50.136 (το T-BPI-LIGHTEST-01 μπήκε στη v50.136· νεότερες εκδόσεις το περιέχουν)",
    f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 136; }],
  ["core: helper T-BPI-LIGHTEST-01 παρών, μία φορά", f => (f.core.match(/function _sagBpiLightEstimate\(/g) || []).length === 1],
  ["core: σταθερές 0,45 / 4,57 / 0,65 δηλωμένες", f => /_SAG_PAR_FRACTION = 0\.45;/.test(f.core) && /_SAG_PAR_UMOL_PER_J = 4\.57;/.test(f.core) && /_SAG_COVER_TRANS_DEFAULT = 0\.65;/.test(f.core)],
  ["core: το totalPAR παίρνει την εκτίμηση όταν λείπει ο αισθητήρας", f => f.core.includes("const totalPAR = _lightEst ? _lightEst.ppfd : lux_to_par(readVal(luxSeries));")],
  ["core: το παλιό σφάλμα «έλλειψη αισθητήρα φωτός!» ΔΕΝ υπάρχει πια ως μοναδική έξοδος", f => !f.core.includes('bpiError: " έλλειψη αισθητήρα φωτός!" }')],
  ["core: bpi_context μεταφέρει light_source/light_note", f => /light_source: _lightEst \? _lightEst\.source : 'sensor',/.test(f.core) && /light_note: _lightEst \? _lightEst\.note : '',/.test(f.core)],
  ["core: bpi_message.metadata.text παίρνει τη σήμανση + light_source", f => f.core.includes("text: daily.message + (_lightNote ? ' ' + _lightNote : ''),") && f.core.includes("light_source: (bpiContext && bpiContext.light_source) || 'sensor',")],
  ["core: bpi_daily_status μεταφέρει light_source", f => f.core.includes("metadata: _lightEst ? { ...diagnosis, light_source: _lightEst.source, light_note: _lightEst.note } : diagnosis },")],
  ["core: ο δακτύλιος PTQ συνεχίζει (2 σημεία κλήσης: αποτυχία + νύχτα)", f => (f.core.match(/_sagPtqRingIndicators\(measurements, parameters\)/g) || []).length >= 2],
  ["core: καθαρό CRLF, χωρίς BOM", f => !f.coreRaw.startsWith("﻿") && (f.coreRaw.match(/\n/g) || []).length === (f.coreRaw.match(/\r\n/g) || []).length],
  // ── στατικά · forecast v9 ──
  ["forecast: fetchOpenMeteoRadiation με past_days: 1 και daily shortwave_radiation_sum", f => /async function fetchOpenMeteoRadiation\(/.test(f.fc) && /past_days: 1,/.test(f.fc) && /daily: "shortwave_radiation_sum,sunshine_duration",/.test(f.fc)],
  ["forecast: metadata.radiation γράφεται", f => /\n\s+radiation,\n\s+};/.test(f.fc)],
  ["forecast: η ωριαία λίστα ΔΕΝ άλλαξε (11 πεδία, forecast_days 3, χωρίς past_days στην ωριαία κλήση)", f => {
    const m = f.fc.match(/const HOURLY_FIELDS = \[([\s\S]*?)\];/); const n = m ? (m[1].match(/"/g) || []).length / 2 : 0;
    const hourlyCall = f.fc.slice(f.fc.indexOf("async function fetchOpenMeteo("), f.fc.indexOf("async function fetchOpenMeteoRadiation("));
    return n === 11 && /const FORECAST_DAYS = 3;/.test(f.fc) && !/past_days\s*:/.test(hourlyCall);
  }],
  ["forecast: η αποτυχία ακτινοβολίας δεν μπλοκάρει την πρόγνωση (δικό της try/catch)", f => /radiation = await fetchOpenMeteoRadiation\(coords\.lat, coords\.lon\);/.test(f.fc) && /catch \(radErr\)/.test(f.fc)],
  // ── ΕΚΤΕΛΕΣΗ της _sagBpiLightEstimate ──
  ["run: Open-Meteo χθες → source openmeteo, 16,08 MJ/m², PPFD ≈ 382,7", f => { const r = f.est(meas(), { latitude: 35.3 }); return r && r.source === "openmeteo" && near(r.rsMJ, 16.08, 0.001) && near(r.ppfd, PPFD_EXPECTED) && r.date === "2026-09-17"; }],
  ["run: η σημείωση λέει «εκτίμηση» και «όχι μέτρηση»", f => { const r = f.est(meas(), {}); return r && /εκτίμηση/.test(r.note) && /όχι μέτρηση/.test(r.note) && /16\.1 MJ/.test(r.note); }],
  ["run: στεγασμένη (parameters) με διαπερατότητα 0,5 → PPFD × 0,5", f => { const r = f.est(meas(), { covered_cultivation: true, cover_transmissivity: 0.5 }); return r && r.covered && near(r.ppfd, PPFD_EXPECTED * 0.5) && /διαπερατότητα καλύμματος 0\.50/.test(r.note); }],
  ["run: στεγασμένη (σημαία πυρήνα) χωρίς δήλωση → × 0,65", f => { const r = f.estCovered(meas(), {}); return r && r.covered && near(r.ppfd, PPFD_EXPECTED * 0.65) && near(r.trans, 0.65, 1e-9); }],
  ["run: ακάλυπτη → καμία μείωση, χωρίς λέξη «κάλυμμα»", f => { const r = f.est(meas(), {}); return r && !r.covered && near(r.ppfd, PPFD_EXPECTED) && !/κάλυμμα/.test(r.note); }],
  ["run: χωρίς χθεσινή ημερομηνία στην πρόγνωση → εφεδρεία θερμοκρασιών (Hargreaves)", f => {
    const r = f.est({ now: NOW, timezone: "Europe/Athens", data: { _sagForecast: { radiation: { dates: ["2026-09-18"], shortwave_radiation_sum: [21.77] } },
      air_temperature_max: [{ value: 30 }], air_temperature_min: [{ value: 20 }] } }, { latitude: 35.3 });
    return r && r.source === "temperature" && r.rsMJ > 8 && r.rsMJ < 30 && /θερμοκρασίες/.test(r.note); }],
  ["run: χωρίς πρόγνωση και χωρίς θερμοκρασίες → null (το BPI δηλώνει έλλειψη)", f => f.est({ now: NOW, timezone: "Europe/Athens", data: {} }, { latitude: 35.3 }) === null],
  ["run: Tmax == Tmin → καμία εκτίμηση από θερμοκρασίες", f => f.est({ now: NOW, timezone: "Europe/Athens", data: { air_temperature_max: [{ value: 25 }], air_temperature_min: [{ value: 25 }] } }, { latitude: 35.3 }) === null],
  ["run: αρνητική/άκυρη ακτινοβολία αγνοείται", f => { const r = f.est({ now: NOW, timezone: "Europe/Athens", data: { _sagForecast: { radiation: { dates: ["2026-09-17"], shortwave_radiation_sum: [-1] } } } }, {}); return r === null; }],
];

function load() {
  const coreRaw = readFileSync(CORE, "utf8"), core = lf(coreRaw), fc = lf(readFileSync(FC, "utf8"));
  const helper = extractHelper(core);
  return { coreRaw, core, fc, helper, est: helper ? buildEstimator(helper, false) : () => undefined, estCovered: helper ? buildEstimator(helper, true) : () => undefined };
}
function run(files, quiet) {
  let fail = 0;
  for (const [name, fn] of CHECKS) {
    let ok = false; try { ok = !!fn(files); } catch (e) { ok = false; }
    if (!ok) fail++;
    if (!quiet) console.log((ok ? "  ✓ " : "  ✗ ") + name);
  }
  return fail;
}
const files = load();
if (!process.argv.includes("--mutate")) {
  const fail = run(files);
  console.log(`\n${CHECKS.length - fail}/${CHECKS.length} έλεγχοι πέρασαν`);
  process.exit(fail ? 1 : 0);
}
/* ΜΕΤΑΛΛΑΞΕΙΣ — στη μνήμη· κάθε μία πρέπει να ρίχνει ≥1 έλεγχο */
const mutCore = (f, a, b) => { const core = f.core.replace(a, b); const helper = extractHelper(core); return { ...f, core, helper, est: helper ? buildEstimator(helper, false) : () => undefined, estCovered: helper ? buildEstimator(helper, true) : () => undefined }; };
const MUT = [
  ["μερίδιο PAR 0,45 → 1", f => mutCore(f, "_SAG_PAR_FRACTION = 0.45;", "_SAG_PAR_FRACTION = 1;")],
  ["4,57 → 2", f => mutCore(f, "_SAG_PAR_UMOL_PER_J = 4.57;", "_SAG_PAR_UMOL_PER_J = 2;")],
  ["κάλυμμα αγνοείται (rsIn = rsMJ)", f => mutCore(f, "const rsIn = rsMJ * trans;", "const rsIn = rsMJ;")],
  ["προεπιλογή διαπερατότητας 0,65 → 1", f => mutCore(f, "_SAG_COVER_TRANS_DEFAULT = 0.65;", "_SAG_COVER_TRANS_DEFAULT = 1;")],
  ["«σήμερα» αντί «χθες»", f => mutCore(f, "_sagLocalDateStr(nowMs - 86400000, tz)", "_sagLocalDateStr(nowMs, tz)")],
  ["η εφεδρεία θερμοκρασιών αφαιρείται", f => mutCore(f, "if (rsMJ === null) {\n      const tmax", "if (false) {\n      const tmax")],
  ["δέχεται Tmax == Tmin", f => mutCore(f, "tmax > tmin &&", "tmax >= tmin &&")],
  ["δέχεται αρνητική ακτινοβολία", f => mutCore(f, "Number.isFinite(v) && v >= 0", "Number.isFinite(v)")],
  ["η λέξη «όχι μέτρηση» φεύγει από τη σημείωση", f => mutCore(f, ", όχι μέτρηση)'", ")'")],
  ["το totalPAR αγνοεί την εκτίμηση", f => ({ ...f, core: f.core.replace("const totalPAR = _lightEst ? _lightEst.ppfd : lux_to_par(readVal(luxSeries));", "const totalPAR = lux_to_par(readVal(luxSeries));") })],
  ["η κάρτα δεν παίρνει τη σήμανση", f => ({ ...f, core: f.core.replace("text: daily.message + (_lightNote ? ' ' + _lightNote : ''),", "text: daily.message,") })],
  ["forecast: past_days φεύγει", f => ({ ...f, fc: f.fc.replace("past_days: 1,", "") })],
  ["forecast: η ωριαία κλήση παίρνει past_days (θα άλλαζε το widget)", f => ({ ...f, fc: f.fc.replace("forecast_days: FORECAST_DAYS,", "forecast_days: FORECAST_DAYS,\n    past_days: 1,") })],
];
let survived = 0;
for (const [name, m] of MUT) {
  const fail = run(m(files), true);
  console.log((fail ? "  ☠ σκοτώθηκε: " : "  ⚠ ΕΠΕΖΗΣΕ: ") + name + (fail ? ` (${fail} έλεγχοι έπεσαν)` : ""));
  if (!fail) survived++;
}
console.log(`\n${MUT.length - survived}/${MUT.length} μεταλλάξεις σκοτώθηκαν`);
process.exit(survived ? 1 : 0);
