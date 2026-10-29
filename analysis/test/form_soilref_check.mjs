// Ελεγκτής φόρμας v25 + sync v15 · T-SOILREF-02 (29/10/2026): «Αισθητήρας απόφασης εδάφους» στη φόρμα.
// Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα (απόδοση πεδίου, αποθήκευση, προβολή του sync) και τον ΕΚΤΕΛΕΙ με ψεύτικο DOM.
// Κανόνες: πεδίο ΜΟΝΟ με ≥2 σόνδες· κρυφό πεδίο ΚΡΑΤΑ την παλιά δήλωση· «Αυτόματα» τη ΣΒΗΝΕΙ· ονόματα μόνο ως κείμενο.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const FORM = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "configuration.html"), "utf8").replace(/\r\n/g, "\n");
const SYNC = fs.readFileSync(path.join(here, "..", "setFieldParametersFromDeviceData.js"), "utf8").replace(/\r\n/g, "\n");
function cut(src, a, b, label, inclB = false) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, inclB ? j + b.length : j);
}
const J = (x) => JSON.stringify(x);
const ID = { M: "6a7c73108b06e3000cb27004", P: "6a7c72b046a750000ce1866e", B: "6a7c720c23232f000cf5583b" };
const LIST = [{ i: ID.B, n: "Βιοδιεγέρτης" }, { i: ID.M, n: "Μάρτυρας" }, { i: ID.P, n: "Pellet <b>x</b>" }];
function dom() {
  const els = {};
  const sel = { dataset: {}, opts: [], _v: "", appendChild(o) { this.opts.push(o); },
    set innerHTML(h) { if (h !== "") throw new Error("innerHTML με περιεχόμενο"); this.opts = []; },
    get value() { return this._v; }, set value(v) { this._v = this.opts.some(o => o.value === v) ? v : ""; } };
  els.soilRefWrap = { style: { display: "none" } }; els.soil_ref_device = sel; els.soilRefNote = { textContent: "" };
  const document = { createElement: () => ({ value: "", textContent: "" }) };
  return { els, $: (id) => els[id], document };
}
function run(form, sync) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const helpers = cut(form, "function _sagSoilRefList(){", "function _keepPrev(v, prev){", "βοηθοί");
    const mk = (state) => { const D = dom(); const R = new Function("state", "$", "document", helpers + "\nreturn { _sagSoilRefList, _sagSoilRefRender };")(state, D.$, D.document); return { D, R }; };
    // ── Α: απόδοση ──
    let st = { lastDataMap: {}, soilRefConf: "" }; let { D, R } = mk(st); R._sagSoilRefRender();
    ok(D.els.soilRefWrap.style.display === "none", "Α1 χωρίς λίστα: κρυφό");
    st = { lastDataMap: { soil_sensors: { metadata: { list: LIST.slice(0, 1) } } }, soilRefConf: "" }; ({ D, R } = mk(st)); R._sagSoilRefRender();
    ok(D.els.soilRefWrap.style.display === "none", "Α2 μία σόνδα: κρυφό");
    st = { lastDataMap: { soil_sensors: { metadata: { list: LIST } } }, soilRefConf: ID.M }; ({ D, R } = mk(st)); R._sagSoilRefRender();
    const s = D.els.soil_ref_device;
    ok(D.els.soilRefWrap.style.display === "" && s.opts.length === 4 && s.opts[0].value === "" && /Αυτόματα — ο πιο ξηρός/.test(s.opts[0].textContent), "Α3 τρεις σόνδες: ορατό με «Αυτόματα» + 3 (" + s.opts.length + ")");
    ok(s.value === ID.M, "Α4 δείχνει τη δηλωμένη (" + s.value + ")");
    ok(s.opts[3].textContent === "Pellet <b>x</b>", "Α5 όνομα ως κείμενο (καμία HTML)");
    ok(/3 σόνδες στο ίδιο βάθος/.test(D.els.soilRefNote.textContent), "Α6 σημείωμα με πλήθος");
    st.soilRefConf = "000000000000000000000000"; R._sagSoilRefRender();
    ok(s.value === "" && /δεν μετρά πια/.test(D.els.soilRefNote.textContent), "Α7 δηλωμένη που λείπει → «Αυτόματα» + προειδοποίηση");
    s.value = ID.P; s.dataset.touched = "1"; st.soilRefConf = ID.M; R._sagSoilRefRender();
    ok(s.value === ID.P, "Α8 η επιλογή του χρήστη δεν χάνεται σε νέο πακέτο");
    st = { lastDataMap: { soil_sensors: { metadata: { list: [{ i: "κακό", n: "x" }, { i: ID.M, n: "" }, { i: ID.P, n: "P" }] } } }, soilRefConf: "" }; ({ D, R } = mk(st)); R._sagSoilRefRender();
    ok(D.els.soilRefWrap.style.display === "none", "Α9 άκυρα id/ονόματα φιλτράρονται (μένει 1 → κρυφό)");
    // ── Β: αποθήκευση ──
    const _se = cut(form, "soil_ref_device: ($('soilRefWrap')", "),\n", "αποθήκευση");
    const saveExpr = (_se + ")").replace(/^soil_ref_device: /, "");
    const save = (shown, val, prev) => { const E = dom(); E.els.soilRefWrap.style.display = shown ? "" : "none"; E.els.soil_ref_device.opts = [{ value: "" }, { value: ID.M }]; E.els.soil_ref_device.value = val;
      return new Function("$", "prevConf", "return " + saveExpr + ";")(E.$, prev); };
    ok(save(false, "", { soil_ref_device: ID.P }) === ID.P, "Β1 κρυφό πεδίο: ΚΡΑΤΑ την παλιά δήλωση");
    ok(save(false, "", {}) === null, "Β2 κρυφό χωρίς παλιά δήλωση: null");
    ok(save(true, "", { soil_ref_device: ID.P }) === null, "Β3 «Αυτόματα»: σβήνει τη δήλωση");
    ok(save(true, ID.M, {}) === ID.M, "Β4 επιλογή σόνδας: αποθηκεύεται το id");
    // ── Γ: καλωδίωση φόρμας ──
    ok(form.includes('<select id="soil_ref_device" onchange="this.dataset.touched=\'1\'">'), "Γ1 HTML πεδίο");
    ok(form.includes("state.soilRefConf = conf.soil_ref_device || ''; _sagSoilRefRender();"), "Γ2 υδροδότηση");
    ok(/  if \(!formLocked\) \{\n  _sagSoilRefRender\(\);/.test(form), "Γ3 απόδοση σε κάθε πακέτο (όχι όσο γράφει ο χρήστης)");
    ok(/state\.lastDataMap = \{\};[\s\S]{0,1600}state\.soilRefConf = ''; \{ const _sr = \$\('soil_ref_device'\); if \(_sr\) _sr\.dataset\.touched = ''; \} _sagSoilRefRender\(\);/.test(form), "Γ4 καθάρισμα σε αλλαγή αγρού");
    // ── Δ: sync — η προβολή περνά/σβήνει το κλειδί ──
    const rk = new Function(cut(sync, "const ROOT_KEYS = [", "];", "ROOT_KEYS", true) + "\nreturn ROOT_KEYS;")();
    const pk = new Function(cut(sync, "const PROTECTED_KEYS = [", "];", "PROTECTED_KEYS", true) + "\nreturn PROTECTED_KEYS;")();
    const isBlank = new Function(cut(sync, "function isBlank(v) {", "\n}\n", "isBlank", true) + "\nreturn isBlank;")();
    const proj = cut(sync, "  const tag = {};\n  for (const k of ROOT_KEYS) {", "\n  if (legacy) {", "προβολή");
    const tagOf = (prevTag, packed) => new Function("ROOT_KEYS", "PROTECTED_KEYS", "isBlank", "prevTag", "packed", proj + "\nreturn tag;")(rk, pk, isBlank, prevTag, packed);
    ok(tagOf({}, { soil_ref_device: ID.M }).soil_ref_device === ID.M, "Δ1 sync: η δήλωση περνά στην ετικέτα");
    ok(!("soil_ref_device" in tagOf({ soil_ref_device: ID.M }, { soil_ref_device: null })), "Δ2 sync: «Αυτόματα» (null) τη σβήνει");
    ok(tagOf({ soil_ref_device: ID.M }, { area: 5 }).soil_ref_device === ID.M, "Δ3 sync: χωρίς το κλειδί κρατά την παλιά");
    ok(pk.indexOf("soil_ref_device") < 0, "Δ4 ΔΕΝ είναι προστατευμένο (αλλιώς το «Αυτόματα» δεν θα έσβηνε)");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = run(FORM, SYNC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (απόδοση, αποθήκευση, καλωδίωση, sync)");
const MUT = [
  ["f", "m1 φαίνεται και με μία σόνδα", "if (list.length < 2){ wrap.style.display = 'none'; return; }", "if (list.length < 1){ wrap.style.display = 'none'; return; }"],
  ["f", "m2 κρυφό σβήνει τη δήλωση", " : (prevConf.soil_ref_device ?? null)", " : (null)"],
  ["f", "m3 «Αυτόματα» δεν σβήνει", "? ($('soil_ref_device').value || null)", "? ($('soil_ref_device').value || prevConf.soil_ref_device || null)"],
  ["f", "m4 όνομα ως HTML", "o.textContent = String(x.n); sel.appendChild(o);", "o.textContent = String(x.n).replace(/<[^>]*>/g, ''); sel.appendChild(o);"],
  ["f", "m5 χωρίς φίλτρο id", "/^[0-9a-f]{24}$/.test(x.i)", "true"],
  ["f", "m6 αγνοεί τη δηλωμένη", "String(state.soilRefConf || '')", "''"],
  ["f", "m7 χάνει την επιλογή του χρήστη", "sel.dataset.touched === '1' ? sel.value : ", ""],
  ["f", "m8 χωρίς απόδοση σε πακέτο", "  _sagSoilRefRender();   /* v25 · T-SOILREF-02: η λίστα σονδών μπορεί να φτάσει σε οποιοδήποτε πακέτο */\n", ""],
  ["f", "m9 χωρίς καθάρισμα σε αλλαγή αγρού", "        state.soilRefConf = ''; { const _sr = $('soil_ref_device'); if (_sr) _sr.dataset.touched = ''; } _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n", ""],
  ["s", "m10 sync κόβει το κλειδί", '  "soil_ref_device",\n', ""],
];
let killed = 0;
for (const [w, name, a, b] of MUT) {
  const src = w === "f" ? FORM : SYNC; const n = src.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = w === "f" ? run(FORM.replace(a, b), SYNC) : run(FORM, SYNC.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 130)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
