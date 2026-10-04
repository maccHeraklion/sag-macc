// Ελεγκτής φόρμας v21 · T-FORM-UNITGUARD-01: η φόρμα πιάνει λάθος ΜΟΝΑΔΑ τη στιγμή που γράφεται (ECw σε μS/cm,
// απόσταση σταλακτήρων/γραμμών σε εκατοστά). Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα από το configuration.html και τον τρέχει
// σε ελάχιστο ψεύτικο DOM: πληκτρολόγηση → υπόδειξη → κουμπί «Χρήση» → διόρθωση· γραμμές στο παράθυρο επιβεβαίωσης·
// υπόδειξη μετά τη φόρτωση. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
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
  const api = new Function("document", "$", "Event", code + "\nreturn { _sagUnitGuardAll, _sagUnitMsgs, _sagUnitCheck, _SAG_UNIT_RULES };")(document, $, Event);
  const type = (id, v) => { els[id].value = v; els[id].dispatchEvent(new Event("input")); };
  const hint = (id) => els[id + "__unit"] || null;
  const hintText = (id) => { const h = hint(id); return h ? h.children.map(c => c.innerHTML || c.textContent).join(" ") : ""; };
  const btn = (id) => { const h = hint(id); return h ? h.children.find(c => typeof c.onclick === "function") : null; };
  return { els, api, type, hint, hintText, btn };
}
const IDS = ["water_ecw_dsm", "fert_ecw_dsm", "irrig_emitter_spacing_m", "irrig_row_spacing_m"];

function run(form) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let E; try { E = env(extract(form), IDS); } catch (e) { return ["φόρτωση: " + e.message]; }
  // ECw σε μS/cm
  E.type("water_ecw_dsm", "3220");
  ok(E.hint("water_ecw_dsm") && /3,22/.test(E.hintText("water_ecw_dsm")) && /dS\/m/.test(E.hintText("water_ecw_dsm")) && /μS\/cm/.test(E.hintText("water_ecw_dsm")),
     "Φ1 ECw 3220 → υπόδειξη «μοιάζει με μS/cm — εννοείτε 3,22 dS/m» (" + E.hintText("water_ecw_dsm") + ")");
  const b1 = E.btn("water_ecw_dsm");
  ok(b1 && b1.textContent === "Χρήση 3,22", "Φ2 κουμπί «Χρήση 3,22» (" + (b1 && b1.textContent) + ")");
  let changed = 0; E.els.water_ecw_dsm.addEventListener("input", () => changed++);
  if (b1) b1.onclick();
  ok(E.els.water_ecw_dsm.value === "3,22" && !E.hint("water_ecw_dsm") && changed >= 1, "Φ3 πάτημα → τιμή 3,22, η υπόδειξη φεύγει, ενημερώνεται η φόρμα (" + E.els.water_ecw_dsm.value + ")");
  E.type("water_ecw_dsm", "400");
  ok(/0,4/.test(E.hintText("water_ecw_dsm")), "Φ4 ECw 400 → 0,4 dS/m (" + E.hintText("water_ecw_dsm") + ")");
  for (const v of ["3,22", "1.6", "15", "20", "49", "15001"]) { E.type("water_ecw_dsm", v); ok(!E.hint("water_ecw_dsm"), "Φ5 ECw " + v + " → καμία υπόδειξη"); }
  E.type("water_ecw_dsm", "50"); ok(/0,05/.test(E.hintText("water_ecw_dsm")), "Φ6 ECw 50 → 0,05 (κάτω όριο του πυρήνα)");
  E.type("fert_ecw_dsm", "2800"); ok(/2,8/.test(E.hintText("fert_ecw_dsm")), "Φ7 EC λίπανσης 2800 → 2,8");
  // αποστάσεις σε εκατοστά
  E.type("irrig_emitter_spacing_m", "20");
  ok(/0,2/.test(E.hintText("irrig_emitter_spacing_m")) && /εκατοστά/.test(E.hintText("irrig_emitter_spacing_m")), "Φ8 απόσταση σταλακτήρων 20 → «εκατοστά — εννοείτε 0,2 m» (" + E.hintText("irrig_emitter_spacing_m") + ")");
  const b2 = E.btn("irrig_emitter_spacing_m"); if (b2) b2.onclick();
  ok(E.els.irrig_emitter_spacing_m.value === "0,2" && !E.hint("irrig_emitter_spacing_m"), "Φ9 πάτημα → 0,2 m");
  for (const v of ["0,75", "12", "6,75"]) { E.type("irrig_emitter_spacing_m", v); ok(!E.hint("irrig_emitter_spacing_m"), "Φ10 απόσταση " + v + " → καμία υπόδειξη"); }
  E.type("irrig_row_spacing_m", "125"); ok(/1,25/.test(E.hintText("irrig_row_spacing_m")), "Φ11 απόσταση γραμμών 125 → 1,25 m");
  // παράθυρο επιβεβαίωσης
  E.els.water_ecw_dsm.value = "3220"; E.els.irrig_emitter_spacing_m.value = "50"; E.els.irrig_row_spacing_m.value = "10"; E.els.fert_ecw_dsm.value = "";
  const M = E.api._sagUnitMsgs();
  ok(M.length === 2 && /EC νερού άρδευσης/.test(M[0]) && /3,22/.test(M[0]) && /απόσταση σταλακτήρων/.test(M[1]) && /0,5/.test(M[1]) && /διάρκεια ποτίσματος/.test(M[1]),
     "Φ12 παράθυρο επιβεβαίωσης: 2 γραμμές με πρόταση και συνέπεια (" + M.length + ")");
  // φόρτωση: τιμές που ήδη υπάρχουν (χωρίς πληκτρολόγηση) → υπόδειξη με _sagUnitGuardAll
  E.els.water_ecw_dsm.value = "400"; E.api._sagUnitGuardAll();
  ok(/0,4/.test(E.hintText("water_ecw_dsm")), "Φ13 υπόδειξη και για αποθηκευμένη τιμή");
  // καλωδίωση στη φόρμα
  ok(form.includes("  _sagUnitMsgs().forEach(function(m){ msgs.push(m); });   /* v21 · T-FORM-UNITGUARD-01 */\n  var w = $('confirmAreaWarn');"), "Κ1 οι γραμμές μπαίνουν στο παράθυρο επιβεβαίωσης");
  ok((form.match(/state\.hydrated = true; setTimeout\(_sagUnitGuardAll, 0\);/g) || []).length === 2, "Κ2 υπόδειξη μετά τη φόρτωση και στις δύο διαδρομές");
  ok(!/water_ecw_dsm[^\n]{0,80}\/ ?1000[^\n]{0,40}payload/.test(form) && !form.includes("_sagUnitAutoFix"), "Κ3 καμία σιωπηλή μετατροπή");
  return f;
}

const base = run(FORM);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 χωρίς ÷1000", "fix: function(v){ return v / 1000; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και", "fix: function(v){ return v; },\n    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και"],
  ["m2 ECw κατώφλι 10", "{ id: 'water_ecw_dsm', label: 'EC νερού άρδευσης', unit: 'dS/m', why: 'μοιάζει με μS/cm',\n    test: function(v){ return v >= 50 && v <= 15000; }", "{ id: 'water_ecw_dsm', label: 'EC νερού άρδευσης', unit: 'dS/m', why: 'μοιάζει με μS/cm',\n    test: function(v){ return v >= 10 && v <= 15000; }"],
  ["m3 απόσταση κατώφλι 5", "{ id: 'irrig_emitter_spacing_m', label: 'απόσταση σταλακτήρων', unit: 'm', why: 'μοιάζει με εκατοστά',\n    test: function(v){ return v > 12 && v <= 1200; }", "{ id: 'irrig_emitter_spacing_m', label: 'απόσταση σταλακτήρων', unit: 'm', why: 'μοιάζει με εκατοστά',\n    test: function(v){ return v > 5 && v <= 1200; }"],
  ["m4 χωρίς γραμμές στο παράθυρο", "  _sagUnitMsgs().forEach(function(m){ msgs.push(m); });   /* v21 · T-FORM-UNITGUARD-01 */\n", ""],
  ["m5 χωρίς υπόδειξη μετά τη φόρτωση", "      if (conf && typeof conf === 'object' && !Array.isArray(conf)){ state.hydrated = true; setTimeout(_sagUnitGuardAll, 0); }", "      if (conf && typeof conf === 'object' && !Array.isArray(conf)){ state.hydrated = true; }"],
  ["m6 χωρίς ακροατή πληκτρολόγησης", "  if (e){ e.addEventListener('input', function(){ _sagUnitGuard(rule); }); e.addEventListener('change', function(){ _sagUnitGuard(rule); }); }", "  if (e){ }"],
  ["m7 το κουμπί δεν γράφει την τιμή", "    e.value = _sagFmtNum(r.s);\n", "\n"],
  ["m8 η υπόδειξη δεν φεύγει", "  if (!r){ if (box) box.remove(); return; }", "  if (!r){ return; }"],
  ["m9 χωρίς απόσταση γραμμών", "  { id: 'irrig_row_spacing_m', label: 'απόσταση γραμμών',", "  { id: 'irrig_row_spacing_mX', label: 'απόσταση γραμμών',"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!FORM.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(FORM.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 100)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
