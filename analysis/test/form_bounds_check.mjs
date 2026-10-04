// Ελεγκτής φόρμας v23 · T-FORM-BOUNDS-01 (B-16): απόδοση δικτύου < 30 % → «ελέγξτε το δίκτυο», δεν αποθηκεύεται·
// ECw νερού/λίπανσης < 0,05 και 15-50 → υπόδειξη χωρίς κουμπί. Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα από το configuration.html
// και τον τρέχει σε ελάχιστο ψεύτικο DOM. Ελέγχει και τη σύνταξη ΟΛΩΝ των ενσωματωμένων <script>.
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const FORM = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "configuration.html"), "utf8");
if (FORM.includes("\r\n")) throw new Error("η φόρμα δεν είναι LF");

function extract(src) {
  const c0 = src.indexOf("function _clean(v){"); const c1 = src.indexOf("\n}\n", c0) + 3;
  const n0 = src.indexOf("function numOrNull(v){"); const n1 = src.indexOf("\n", n0) + 1;
  const g0 = src.indexOf("var _SAG_UNIT_RULES");
  const l0 = src.indexOf("_SAG_UNIT_RULES.forEach(function(rule){\n  var e = $(rule.id);");
  const g1 = src.indexOf("\n});\n", l0) + 5;
  if ([c0, n0, g0, l0].some(i => i < 0) || c1 < 3 || g1 < 5) throw new Error("δεν βρέθηκε ο κώδικας της φόρμας");
  return src.slice(c0, c1) + src.slice(n0, n1) + src.slice(g0, g1);
}
function saveExpr(src) {
  const a = src.indexOf("    irrig_efficiency_measured: (function(){");
  const b = src.indexOf("})(),\n", a);
  if (a < 0 || b < 0) throw new Error("δεν βρέθηκε η αποθήκευση απόδοσης");
  return src.slice(src.indexOf("(function(){", a), b + 4);
}
function env(code, ids) {
  const els = {};
  const mkEl = (id) => ({ id, value: "", children: [], listeners: {}, style: {}, textContent: "", _html: "",
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach(f => f(ev)); return true; },
    insertAdjacentElement(pos, el) { els[el.id] = el; el._after = this.id; },
    appendChild(c) { this.children.push(c); }, remove() { delete els[this.id]; },
    set innerHTML(v) { this._html = v; if (v === "") this.children = []; }, get innerHTML() { return this._html; } });
  for (const id of ids) els[id] = mkEl(id);
  const document = { getElementById: (id) => els[id] || null, createElement: () => mkEl(null) };
  const $ = (id) => document.getElementById(id);
  const api = new Function("document", "$", "Event", code + "\nreturn { _sagUnitGuardAll, _sagUnitMsgs };")(document, $, Event);
  const type = (id, v) => { els[id].value = v; els[id].dispatchEvent(new Event("input")); };
  const box = (id, key) => els[id + "__" + key] || null;
  const text = (id, key) => { const h = box(id, key); return h ? h.children.map(c => c.innerHTML || c.textContent).join(" ") : ""; };
  const hasBtn = (id, key) => { const h = box(id, key); return !!(h && h.children.find(c => typeof c.onclick === "function")); };
  return { els, api, type, box, text, hasBtn };
}
const IDS = ["irrig_efficiency_pct", "water_ecw_dsm", "fert_ecw_dsm", "irrig_emitter_spacing_m", "irrig_row_spacing_m"];

function run(form) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  // σύνταξη όλων των ενσωματωμένων script
  const scripts = [...form.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  ok(scripts.length > 0, "Σ0 βρέθηκαν script");
  scripts.forEach((sc, i) => { try { new Function(sc); } catch (e) { f.push("Σ1 σύνταξη script #" + i + ": " + e.message); } });
  let E; try { E = env(extract(form), IDS); } catch (e) { return f.concat(["φόρτωση: " + e.message]); }
  // απόδοση δικτύου
  E.type("irrig_efficiency_pct", "20");
  ok(/ελέγξτε το δίκτυο/.test(E.text("irrig_efficiency_pct", "low")) && /δεν θα αποθηκευτεί/.test(E.text("irrig_efficiency_pct", "low")),
     "Β1 απόδοση 20 → «ελέγξτε το δίκτυο… δεν θα αποθηκευτεί» (" + E.text("irrig_efficiency_pct", "low") + ")");
  ok(E.box("irrig_efficiency_pct", "low") && !E.hasBtn("irrig_efficiency_pct", "low") && !/null/.test(E.text("irrig_efficiency_pct", "low")), "Β2 χωρίς κουμπί, χωρίς «null»");
  E.type("irrig_efficiency_pct", "29,9"); ok(E.box("irrig_efficiency_pct", "low"), "Β3 απόδοση 29,9 → υπόδειξη");
  for (const v of ["30", "90", "100", ""]) { E.type("irrig_efficiency_pct", v); ok(!E.box("irrig_efficiency_pct", "low"), "Β4 απόδοση «" + v + "» → καμία υπόδειξη"); }
  // ECw νερού
  E.type("water_ecw_dsm", "0,03");
  ok(/0,05/.test(E.text("water_ecw_dsm", "low")) && !E.hasBtn("water_ecw_dsm", "low"), "Β5 ECw 0,03 → υπόδειξη κάτω ορίου χωρίς κουμπί (" + E.text("water_ecw_dsm", "low") + ")");
  for (const v of ["0,05", "0,5", "3,2", "15"]) { E.type("water_ecw_dsm", v); ok(!E.box("water_ecw_dsm", "low") && !E.box("water_ecw_dsm", "mid") && !E.box("water_ecw_dsm", "unit"), "Β6 ECw " + v + " → καμία υπόδειξη"); }
  for (const v of ["15,5", "20", "49"]) { E.type("water_ecw_dsm", v); ok(/ούτε σε dS\/m/.test(E.text("water_ecw_dsm", "mid")) && !E.hasBtn("water_ecw_dsm", "mid"), "Β7 ECw " + v + " → «ούτε σε dS/m ούτε σε μS/cm»"); }
  E.type("water_ecw_dsm", "50"); ok(!E.box("water_ecw_dsm", "mid") && E.box("water_ecw_dsm", "unit"), "Β8 ECw 50 → η παλιά υπόδειξη μονάδας, όχι η νέα");
  // ECw λίπανσης
  E.type("fert_ecw_dsm", "0,01"); ok(E.box("fert_ecw_dsm", "low"), "Β9 EC λίπανσης 0,01 → υπόδειξη");
  E.type("fert_ecw_dsm", "20"); ok(E.box("fert_ecw_dsm", "mid") && !E.box("fert_ecw_dsm", "low"), "Β10 EC λίπανσης 20 → υπόδειξη μεσαίου κενού");
  E.type("fert_ecw_dsm", "2"); ok(!E.box("fert_ecw_dsm", "mid") && !E.box("fert_ecw_dsm", "low"), "Β11 EC λίπανσης 2 → καμία");
  // παράθυρο επιβεβαίωσης
  E.els.irrig_efficiency_pct.value = "20"; E.els.water_ecw_dsm.value = "20"; E.els.fert_ecw_dsm.value = "";
  E.els.irrig_emitter_spacing_m.value = ""; E.els.irrig_row_spacing_m.value = "";
  const M = E.api._sagUnitMsgs();
  ok(M.length === 2 && M.some(m => /απόδοση δικτύου/.test(m) && /ελέγξτε το δίκτυο/.test(m) && /τυπική απόδοση/.test(m))
     && M.some(m => /EC νερού άρδευσης/.test(m) && /ούτε σε dS\/m/.test(m) && /κλάσης νερού/.test(m)) && !M.some(m => /null|«Χρήση»/.test(m)),
     "Β12 παράθυρο επιβεβαίωσης: 2 γραμμές, με συνέπεια, χωρίς «Χρήση» (" + M.length + ")");
  // φόρτωση αποθηκευμένης τιμής
  E.els.irrig_efficiency_pct.value = "20"; E.api._sagUnitGuardAll();
  ok(E.box("irrig_efficiency_pct", "low"), "Β13 υπόδειξη και για αποθηκευμένη τιμή");
  // αποθήκευση
  let save; try { save = (v) => new Function("$", "numOrNull", "return " + saveExpr(form))(() => ({ value: v }), (x) => { const t = String(x).replace(",", ".").trim(); if (t === "") return null; const n = parseFloat(t); return Number.isFinite(n) ? n : null; }); }
  catch (e) { f.push("αποθήκευση: " + e.message); save = () => "ERR"; }
  const cases = [["20", null], ["29", null], ["30", 0.3], ["85", 0.85], ["100", 1], ["150", 1], ["", null]];
  for (const [v, want] of cases) { let got; try { got = save(v); } catch (e) { got = "ERR " + e.message; } ok(got === want, "Β14 αποθήκευση απόδοσης «" + v + "» → " + want + " (" + got + ")"); }
  ok(form.includes('<input id="irrig_efficiency_pct" type="number" step="1" min="30" max="100"'), "Β15 πεδίο με ελάχιστο 30");
  return f;
}

const base = run(FORM);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");

const MUT = [
  ["m1 κατώφλι απόδοσης 10", "    test: function(v){ return v < 30; },", "    test: function(v){ return v < 10; },"],
  ["m2 παλιό σιωπηλό κόψιμο", "return (v === null || v < 30) ? null : Math.min(1, v/100); })(),", "return v === null ? null : Math.min(1, Math.max(0.1, v/100)); })(),"],
  ["m3 πεδίο min=10", 'id="irrig_efficiency_pct" type="number" step="1" min="30"', 'id="irrig_efficiency_pct" type="number" step="1" min="10"'],
  ["m4 κουμπί και χωρίς διόρθωση", "  if (!rule.fix){ t.innerHTML = 'Η τιμή <b>' + _sagFmtNum(r.v) + '</b> ' + rule.why + '. ' + rule.cons; box.appendChild(t); return; }\n", ""],
  ["m5 χωρίς μεσαίο κενό νερού", "    test: function(v){ return v > 15 && v < 50; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει", "    test: function(v){ return false; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει"],
  ["m6 κάτω όριο νερού 0,5", "    test: function(v){ return v < 0.05; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει", "    test: function(v){ return v < 0.5; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει"],
  ["m7 επιβεβαίωση σαν διόρθωση", "    if (r && !rule.fix) out.push('Το πεδίο <b>' + rule.label + '</b> έχει <b>' + _sagFmtNum(r.v) + '</b> — ' + rule.why + '. ' + rule.cons);\n    else if (r)", "    if (r)"],
  ["m8 κοινό κουτί", "  var bid = rule.id + '__' + (rule.key || 'unit');", "  var bid = rule.id + '__unit';"],
  ["m9 χωρίς μεσαίο κενό λίπανσης", "    test: function(v){ return v > 15 && v < 50; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση.' }\n];", "    test: function(v){ return false; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση.' }\n];"],
  ["m10 υπόδειξη χωρίς συνέπεια", "rule.why + '. ' + rule.cons; box.appendChild(t); return; }", "rule.why; box.appendChild(t); return; }"],
  ["m11 χαλασμένη σύνταξη", "  var bid = rule.id + '__' + (rule.key || 'unit');", "  var bid = rule.id + '__' + (rule.key || 'unit';"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const c = FORM.split(a).length - 1;
  if (c !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + c + ")"); continue; }
  const r = run(FORM.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
