#!/usr/bin/env node
/* Ελεγκτής πυρήνα v50.143 · T-FLEET-HEALTH-01 (υγεία συστήματος στον πίνακα εποπτείας).
 * Εξάγει ΑΥΤΟΛΕΞΕΙ από τον πυρήνα τις _sagFleetSeverity / _sagFleetPack / _sagFileOk / _sagFleetMark /
 * _sagFleetFiles και τις ΕΚΤΕΛΕΙ· επιπλέον στατικοί έλεγχοι στα σημεία ενσωμάτωσης.
 *
 *   node analysis/test/fleet_health_check.mjs            → έλεγχοι
 *   node analysis/test/fleet_health_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { writeFileSync } from "node:fs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE = join(ROOT, "analysis/runPerTich.js");
const slice = (c, a, b) => { const i = c.indexOf(a); const j = i < 0 ? -1 : c.indexOf(b, i + 1); return (i < 0 || j < 0) ? null : c.slice(i, j); };
const fn = (c, name) => { const src = slice(c, "function " + name + "(", "\n}\n"); return src ? src + "\n}\n" : null; };
const afn = (c, name) => { const src = slice(c, "async function " + name + "(", "\n}\n"); return src ? src + "\n}\n" : null; };

function build(core) {
  const consts = slice(core, "const _SAG_FLEET_FILES_BASE = ", "function _sagHeadFile(");
  const parts = [consts, fn(core, "_sagFleetSeverity"), fn(core, "_sagFileOk"), fn(core, "_sagFleetPack"), fn(core, "_sagFleetMark"), afn(core, "_sagFleetFiles")];
  if (parts.some(p => !p)) return null;
  // stub HEAD: το a.html «υπάρχει», το b.js δίνει 403/json, το c.css λήγει (timeout -> null)
  const stub = `const _SAG_FLEET = []; const _fake = { 'a.html': { h: 200, t: 'text/html' }, 'b.js': { h: 403, t: 'application/json' }, 'd.js': { h: 200, t: 'application/javascript' } };
    function _sagHeadFile(url) { const p = url.slice(_SAG_FLEET_FILES_BASE.length); return Promise.resolve(_fake[p] || { h: 0, t: 'timeout' }); }`;
  return new Function(stub + "\n" + parts.join("\n") + "\nreturn { _SAG_FLEET, _sagFleetSeverity, _sagFileOk, _sagFleetPack, _sagFleetMark, _sagFleetFiles, _SAG_FLEET_FILES };")();
}
const big = () => ({ f: "ΠΑΝΕΤΕΚ", i: "2bdff", s: 3, y: 35.1, x: 25.1,
  d: Array.from({ length: 120 }, (_, k) => ({ n: "dragino_se0x_" + k + "_με_μακρύ_όνομα_οργάνου", i: "0" + k, t: "se0x", h: 0.5, q: 0, b: "3.5V", l: 0 })),
  z: Array.from({ length: 80 }, (_, k) => ({ d: "dev" + k, t: "Ακίνητη ένδειξη υγρασίας " + k, w: "x".repeat(200), c: "y".repeat(200), y: "se0x", k: k % 2 })),
  g: ["πλήθος φυτών"], a: [{ g: "εδάφους", h: 30 }] });

const CHECKS = [
  ["core: έκδοση ≥ v50.143 και T-FLEET-HEALTH-01 παρόν", f => { const m = f.core.match(/const SAG_KERNEL_VERSION = 'v50\.(\d+) · /); return !!m && Number(m[1]) >= 143 && f.core.includes("T-FLEET-HEALTH-01 (v50.143"); }],
  ["core: η εγγραφή fleet_field περνά από _sagFleetPack (όχι slice(0, 8000) = άκυρο JSON)", f => f.core.includes("text: _sagFleetPack({ f: _r.f, i: _r.i, s: _s, y: _r.y, x: _r.x,") && !f.core.includes("a: _r.a || [] }).slice(0, 8000) } });")],
  ["σοβαρότητα: σφάλμα κύκλου = ΕΛΕΓΧΟΣ (2), όργανο νεκρό = 3, κενό ρύθμισης = 1, τίποτα = 0", f => { const g = build(f.core); if (!g) return false;
    return g._sagFleetSeverity({ e: "boom" }) === 2 && g._sagFleetSeverity({ e: "boom", k: ["x"] }) === 3 && g._sagFleetSeverity({ g: ["x"] }) === 1 && g._sagFleetSeverity({}) === 0 && g._sagFleetSeverity({ nc: 1, g: ["ρύθμιση"] }) === 1; }],
  ["_sagFleetPack: μικρή εγγραφή = ταυτόσημο JSON", f => { const g = build(f.core); if (!g) return false; const o = { f: "Α", i: "1", s: 0, d: [], z: [], g: [], a: [] }; return g._sagFleetPack(o) === JSON.stringify(o); }],
  ["_sagFleetPack: τεράστια εγγραφή -> ΕΓΚΥΡΟ JSON ≤ 8000, με _cut, κρατά f/i/s και ακυρωτικές βλάβες πρώτες", f => { const g = build(f.core); if (!g) return false;
    const sj = g._sagFleetPack(big()); if (sj.length > 8000) return false; let o; try { o = JSON.parse(sj); } catch (e) { return false; }
    return o._cut === 1 && o.f === "ΠΑΝΕΤΕΚ" && o.i === "2bdff" && o.s === 3 && (o.z || []).length > 0 && o.z[0].k === 1; }],
  ["_sagFileOk: html+text/html=1, js+text/javascript=1, js+application/javascript=1, css+text/css=1, html+json=0, 403=0, 302=0", f => { const g = build(f.core); if (!g) return false;
    return g._sagFileOk("a/x.html", { h: 200, t: "text/html" }) === 1 && g._sagFileOk("x.js", { h: 200, t: "text/javascript" }) === 1 && g._sagFileOk("x.js", { h: 200, t: "application/javascript" }) === 1
      && g._sagFileOk("x.css", { h: 200, t: "text/css" }) === 1 && g._sagFileOk("x.html", { h: 200, t: "application/json" }) === 0 && g._sagFileOk("x.html", { h: 403, t: "application/json" }) === 0 && g._sagFileOk("x.html", { h: 302, t: "text/plain" }) === 0; }],
  ["_sagFleetMark: σημειώνει την ΤΕΛΕΥΤΑΙΑ γραμμή του αγρού, false αν δεν υπάρχει", f => { const g = build(f.core); if (!g) return false;
    g._SAG_FLEET.push({ f: "Α" }, { f: "Β" }, { f: "Α" }); const r1 = g._sagFleetMark("Α", { ok: 1 }); const r2 = g._sagFleetMark("Γ", { ok: 1 });
    return r1 === true && r2 === false && g._SAG_FLEET[2].ok === 1 && g._SAG_FLEET[0].ok === undefined; }],
  ["_sagFleetFiles (εκτέλεση με ψεύτικο HEAD): a.html=OK, b.js(403/json)=ΟΧΙ, c.css(timeout)=ΟΧΙ, d.js(application/javascript)=OK· env FLEET_FILES παρακάμπτει", async f => { const g = build(f.core); if (!g) return false;
    const out = await g._sagFleetFiles([{ key: "FLEET_FILES", value: "a.html, b.js,c.css,d.js" }]);
    return out.length === 4 && out[0].c === 1 && out[1].c === 0 && out[1].h === 403 && out[2].c === 0 && out[3].c === 1; }],
  ["_SAG_FLEET_FILES: περιέχει index.html, index-7cbd9a4e.js, sag-fleet.html, configuration.html (παγίδα #225)", f => { const g = build(f.core); if (!g) return false;
    const L = g._SAG_FLEET_FILES; return ["storage/sagMain/index.html", "storage/sagMain/index-7cbd9a4e.js", "storage/sagMain/sag-fleet.html", "html_files/configuration.html"].every(p => L.includes(p)); }],
  ["_sagHeadFile: ακολουθεί 3xx (Location) έως 3 άλματα — το api.tago.io δίνει 302 ΚΑΙ για ανύπαρκτα", f => f.core.includes("if (r.statusCode >= 300 && r.statusCode < 400 && loc && hops < 3) {")],
  ["catch αγρού: σημειώνει e στη γραμμή ή προσθέτει ελάχιστη γραμμή με e", f => f.core.includes("if (!_sagFleetMark(fieldName, { e: _eTxt })) {") && f.core.includes("d: [], k: [], v: [], a: [], z: [], g: [], e: _eTxt });")],
  ["αγρός χωρίς ρύθμιση: γραμμή nc: 1 (ΓΡΑΦΕΙΟ) ΠΡΙΝ το continue", f => { const i = f.core.indexOf("g: ['ρύθμιση αγρού από τη φόρμα (καμία)'], nc: 1 });"); const j = f.core.indexOf("          continue;\n        }", i); return i > 0 && j > i && j - i < 200; }],
  ["bundle: _SAG_LAST_BUNDLE από τον φρουρό μεγέθους, σημείωση ok/bb/bt μετά το sendData, μηδενισμός ανά αγρό", f =>
    f.core.includes("_SAG_LAST_BUNDLE = { b: compressedData.length, t: _fitBefore > _SAG_BUNDLE_MAX_B64 ? 1 : 0 };") && f.core.includes("try { _sagFleetMark(fieldName, { ok: 1, bb: _SAG_LAST_BUNDLE ? _SAG_LAST_BUNDLE.b : null,") && f.core.includes("_SAG_LAST_BUNDLE = null;   // T-FLEET-HEALTH-01: θα γεμίσει")],
  ["πρόγνωση: _sagForecastAt από τη γραμμή forecast και fc (ώρες) στη γραμμή του αγρού", f => f.core.includes("measurements.data._sagForecastAt = _fcRow.time;") && f.core.includes("_sagForecastAt || ''));\n              return Number.isFinite(_t) ? Math.round((_nowMsF - _t) / 36000) / 100 : null; })(),")],
  ["σύνοψη: total/computed/nocfg/errors/nopos/tick/ms/reads/files/files_bad/an", f => ["total: Array.isArray(fields) ? fields.length : null,", "computed: _SAG_FLEET.filter(r => r && r.ok).length,", "nocfg: _SAG_FLEET.filter(r => r && r.nc).length,", "errors: fieldsWithErrors.slice(0, 40),", "tick: { h: hourTich ? 1 : 0, d: dailyTich ? 1 : 0, th: _SAG_TICK_H, gap: _SAG_TICK_GAP_H },", "reads: { real: _SAG_RUN_CACHE.miss, cached: _SAG_RUN_CACHE.hit },", "files: _fbFiles, files_bad: _fbFiles.filter(x => !x.c).length,", "an: _fbAn,"].every(k => f.core.includes(k))],
  ["σύνοψη: αρχεία + analyses ελέγχονται ΠΡΙΝ τη σύνοψη, παράλληλα, με catch (ποτέ δεν ρίχνουν τον πίνακα)", f => { const i = f.core.indexOf("_sagFleetFiles(context.environment).catch(() => []),"); const j = f.core.indexOf("files: _fbFiles, files_bad:"); return i > 0 && j > i && f.core.includes("_sagFleetAnalyses(account, context.environment).catch(() => []),"); }],
  ["core: CRLF χωρίς BOM, node --check", f => { if (f.raw.startsWith("﻿")) return false; if ((f.raw.match(/\r\n/g) || []).length !== (f.raw.match(/\n/g) || []).length) return false;
    const t = join(tmpdir(), "fleet_health_check_core.js"); writeFileSync(t, f.raw); try { execFileSync("node", ["--check", t], { stdio: "pipe" }); return true; } catch (e) { return false; } }],
];

const MUTATIONS = [
  ["σοβαρότητα αγνοεί το σφάλμα κύκλου", c => c.replace("if (r.e || (r.z || []).length > 0", "if ((r.z || []).length > 0")],
  ["η εγγραφή κόβεται με slice αντί για _sagFleetPack", c => c.replace("text: _sagFleetPack({ f: _r.f, i: _r.i, s: _s, y: _r.y, x: _r.x,", "text: JSON.stringify({ f: _r.f, i: _r.i, s: _s, y: _r.y, x: _r.x,")],
  ["_sagFleetPack επιστρέφει και >8000", c => c.replace("  let sj = JSON.stringify(o);\n  if (sj.length <= LIM) return sj;", "  let sj = JSON.stringify(o);\n  return sj;")],
  ["_sagFileOk αγνοεί content-type του html", c => c.replace("if (/\\.html?$/.test(p)) return t === 'text/html' ? 1 : 0;", "if (/\\.html?$/.test(p)) return 1;")],
  ["_sagHeadFile δεν ακολουθεί ανακατευθύνσεις", c => c.replace("&& loc && hops < 3) {", "&& loc && hops < 0) {")],
  ["catch αγρού δεν προσθέτει γραμμή", c => c.replace("d: [], k: [], v: [], a: [], z: [], g: [], e: _eTxt });", "d: [], k: [], v: [], a: [], z: [], g: [] });")],
  ["αγρός χωρίς ρύθμιση μένει αόρατος", c => c.replace("g: ['ρύθμιση αγρού από τη φόρμα (καμία)'], nc: 1 });", "g: [], nc: 0 });")],
  ["το bundle δεν σημειώνεται ως γραμμένο", c => c.replace("try { _sagFleetMark(fieldName, { ok: 1, bb:", "try { _sagFleetMark(fieldName, { ok: 0, bb:")],
  ["files_bad πάντα 0", c => c.replace("files: _fbFiles, files_bad: _fbFiles.filter(x => !x.c).length,", "files: _fbFiles, files_bad: 0,")],
  ["_sagFleetFiles θεωρεί όλα τα αρχεία εντάξει", c => c.replace("return { p, h: r ? r.h : 0, t: r ? r.t : 'timeout', c: _sagFileOk(p, r) };", "return { p, h: r ? r.h : 0, t: r ? r.t : 'timeout', c: 1 };")],
  ["_sagFleetMark σημειώνει την ΠΡΩΤΗ γραμμή", c => c.replace("for (let _k = _SAG_FLEET.length - 1; _k >= 0; _k--) {", "for (let _k = 0; _k < _SAG_FLEET.length; _k++) {")],
];

function load(raw) { return { raw, core: raw.replace(/\r\n/g, "\n") }; }
async function run(f) { let ok = 0, bad = 0; for (const [n, x] of CHECKS) { let r = false; try { r = !!(await x(f)); } catch (e) { r = false; } if (r) ok++; else { bad++; console.log("  ✘ " + n); } } return { ok, bad }; }
const raw = readFileSync(CORE, "utf8");
if (process.argv.includes("--mutate")) {
  const b0 = await run(load(raw)); if (b0.bad) { console.log(`Βάση: ${b0.ok} OK · ${b0.bad} X`); process.exit(1); }
  let killed = 0;
  for (const [n, mut] of MUTATIONS) {
    const base = raw.replace(/\r\n/g, "\n");
    const m = mut(base);
    if (m === base) { console.log("  ✘ η μετάλλαξη δεν εφαρμόστηκε: " + n); continue; }
    const r = await run(load(m.replace(/\n/g, "\r\n"))); if (r.bad > 0) { killed++; console.log(`  ✔ σκοτώθηκε (${r.bad}): ${n}`); } else console.log("  ✘ ΕΠΕΖΗΣΕ: " + n);
  }
  console.log(`Μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτώθηκαν`); process.exit(killed === MUTATIONS.length ? 0 : 1);
} else { const r = await run(load(raw)); console.log(`Έλεγχοι: ${r.ok} OK · ${r.bad} X (${CHECKS.length} σύνολο)`); process.exit(r.bad ? 1 : 0); }
