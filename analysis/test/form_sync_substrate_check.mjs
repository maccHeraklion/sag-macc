// Ελεγκτής φόρμας v24 + sync v14 · T-SUBSTRATE-01: ο κοκοφοίνικας επιλέγεται ΜΟΝΟ σε καλυμμένη
// καλλιέργεια, αποθηκεύεται ως soil_type='coir' + soil_texture_class='coir', ξαναφορτώνεται σωστά,
// και η μεταφορά (sync) τον δέχεται χωρίς ψευδή προειδοποίηση. Τα εδάφη ΑΜΕΤΑΒΛΗΤΑ.
// Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα και τον ΕΚΤΕΛΕΙ. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const FORM = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "configuration.html"), "utf8");
const SYNC = fs.readFileSync(path.join(here, "..", "setFieldParametersFromDeviceData.js"), "utf8").replace(/\r\n/g, "\n");

function cut(src, a, b, label) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, j + b.length);
}
function run(form, sync) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const tables = cut(form, "const SOIL_TYPES = {", "};", "SOIL_TYPES") + "\n"
      + cut(form, "const SOIL_TEXTURES = {", "};", "SOIL_TEXTURES") + "\n"
      + cut(form, "const SOIL_GROUP_DEFAULT = {", "};", "SOIL_GROUP_DEFAULT");
    const T = new Function(tables + "\nreturn { SOIL_TYPES, SOIL_TEXTURES, SOIL_GROUP_DEFAULT };")();
    ok(T.SOIL_TEXTURES.coir && T.SOIL_TEXTURES.coir.el === "Υπόστρωμα κοκοφοίνικα" && T.SOIL_TEXTURES.coir.group === "coir", "Φ1 επιλογή «Υπόστρωμα κοκοφοίνικα» με ομάδα coir");
    ok(T.SOIL_GROUP_DEFAULT.coir === "coir" && /^[Ͱ-Ͽἀ-῿ ()]+$/.test(T.SOIL_TYPES.coir || ""), "Φ1 ομάδα και ελληνική ετικέτα ομάδας (" + T.SOIL_TYPES.coir + ")");
    ok(Object.keys(T.SOIL_TEXTURES).length === 14 && T.SOIL_TEXTURES.loam.group === "loamy" && T.SOIL_TEXTURES.clay.group === "clay_loamy", "Φ1 τα 13 εδάφη αμετάβλητα");
    // αποθήκευση: ίδια έκφραση με το buildPayload
    const saveExpr = cut(form, "soil_type: _keepPrev(", "prevConf.soil_type),", "αποθήκευση soil_type");
    const save = (v, prev) => new Function("SOIL_TEXTURES", "$", "_keepPrev", "prevConf", "return {" + saveExpr + "}.soil_type;")(
      T.SOIL_TEXTURES, () => ({ value: v }), (a, b) => (a == null || a === "") ? b : a, { soil_type: prev });
    ok(save("coir", "loamy") === "coir", "Φ2 αποθήκευση: soil_type='coir'");
    ok(save("clay_loam", null) === "clay_loamy" && save("sand", null) === "sandy", "Φ2 αποθήκευση εδαφών αμετάβλητη");
    // ξαναφόρτωση
    const hyd = cut(form, "if (conf.soil_texture_class!=null && SOIL_TEXTURES[conf.soil_texture_class])", "(SOIL_TEXTURES[conf.soil_type] ? conf.soil_type : '');", "υδροδότηση");
    const rehyd = (conf) => { const el = { value: "" }; new Function("conf", "SOIL_TEXTURES", "SOIL_GROUP_DEFAULT", "$", hyd)(conf, T.SOIL_TEXTURES, T.SOIL_GROUP_DEFAULT, () => el); return el.value; };
    ok(rehyd({ soil_texture_class: "coir", soil_type: "coir" }) === "coir" && rehyd({ soil_type: "coir" }) === "coir", "Φ3 ξαναφόρτωση: κοκοφοίνικας");
    ok(rehyd({ soil_type: "loamy" }) === "loam", "Φ3 ξαναφόρτωση εδάφους αμετάβλητη");
    // συγχρονισμός καλυμμένης: η επιλογή ενεργή μόνο σε καλυμμένη
    const scg = cut(form, "function syncCoverGates(){", "\n}\n", "syncCoverGates");
    const opt = { disabled: false };
    const doc = (cov) => ({ getElementById: (id) => id === "covered_cultivation" ? { value: cov } : null,
      querySelector: (q) => q === '#soil_type option[value="coir"]' ? opt : null });
    const runScg = (cov) => { new Function("document", "COVER_GATES", scg + "\nsyncCoverGates();")(doc(cov), []); return opt.disabled; };
    ok(runScg("false") === true && runScg("true") === false, "Φ4 επιλογή ενεργή ΜΟΝΟ σε καλυμμένη");
    // φραγμός αποθήκευσης
    const gate = cut(form, "  /* v24 · T-SUBSTRATE-01: υπόστρωμα κοκοφοίνικα ΜΟΝΟ σε καλυμμένη", "    return;\n  }", "φραγμός");
    const blocked = (soil, cov) => { let b = null;
      const r = new Function("$", "showBanner", gate + "\nreturn 'πέρασε';")(
        (id) => ({ value: id === "soil_type" ? soil : cov }), (m, t) => { b = [m, t]; });
      return r !== "πέρασε" ? b : null; };
    const bb = blocked("coir", "false");
    ok(bb && bb[1] === "warn" && /μόνο σε καλυμμένη/.test(bb[0]) && /Τίποτα δεν αποθηκεύτηκε/.test(bb[0]), "Φ5 κοκοφοίνικας σε ακάλυπτο: ΦΡΑΓΜΟΣ με μήνυμα");
    ok(blocked("coir", "true") === null && blocked("loam", "false") === null, "Φ6 καλυμμένος κοκοφοίνικας / έδαφος σε ακάλυπτο: περνά");
    const _ig = form.indexOf("/* v24 · T-SUBSTRATE-01: υπόστρωμα κοκοφοίνικα ΜΟΝΟ σε καλυμμένη");
    ok(_ig > form.indexOf("$('btnSave').onclick") && _ig < form.indexOf("/* ── Προειδοποιήσεις, ΟΧΙ φραγμός ──"), "Φ7 ο φραγμός είναι μέσα στο btnSave, πριν τις προειδοποιήσεις");
    ok(!/\r/.test(form), "Φ8 φόρμα καθαρό LF");
    // sync: λεξιλόγιο εδάφους
    const kst = cut(sync, "const KERNEL_SOIL_TYPES = [", "];", "KERNEL_SOIL_TYPES");
    const voc = cut(sync, "  if (!isBlank(tag.soil_type) && KERNEL_SOIL_TYPES.indexOf(String(tag.soil_type)) < 0) {", "\n  }\n", "λεξιλόγιο");
    const isBlank = (v) => v === null || v === undefined || ["", "null", "undefined", "nan"].includes(String(v).trim().toLowerCase());
    const sy = (soil, prev) => { const tag = { soil_type: soil }, warnings = [];
      new Function("tag", "prevTag", "warnings", "isBlank", kst + "\n" + voc)(tag, { soil_type: prev }, warnings, isBlank); return { s: tag.soil_type, w: warnings.length }; };
    const c1 = sy("coir", "loamy");
    ok(c1.s === "coir" && c1.w === 0, "Σ1 sync: 'coir' δεκτό χωρίς προειδοποίηση (" + JSON.stringify(c1) + ")");
    const c2 = sy("Coir", "loamy"), c3 = sy("clay", "loamy");
    ok(c2.s === "loamy" && c2.w === 1 && c3.s === "loamy" && c3.w === 1, "Σ2 sync: άγνωστα κλειδιά όπως πριν");
    ok(/\*\* v14 · 27\/10\/2026 — T-SUBSTRATE-01/.test(sync), "Σ3 sync v14");
    ok(/"soil_type", "soil_texture_class",/.test(sync), "Σ4 το soil_texture_class περνά αυτούσιο στην προβολή");
  } catch (e) { f.push("εκτέλεση: " + (e && e.message)); }
  return f;
}

const base = run(FORM, SYNC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 χωρίς επιλογή", "form", "  coir:             { el:'Υπόστρωμα κοκοφοίνικα',        group:'coir',            hint:'Slabs/σακιά — μόνο σε θερμοκήπιο' }\n", "  _x: { el:'x', group:'loamy', hint:'' }\n"],
  ["m2 λάθος ομάδα", "form", "group:'coir',            hint:'Slabs", "group:'loamy',            hint:'Slabs"],
  ["m3 χωρίς ομάδα ξαναφόρτωσης", "form", ", coir:'coir' };", " };"],
  ["m4 επιλογή πάντα ενεργή", "form", "if (_coir) _coir.disabled = !covered;", "if (_coir) _coir.disabled = false;"],
  ["m5 χωρίς φραγμό", "form", "  if ($('soil_type').value === 'coir' && $('covered_cultivation').value !== 'true'){", "  if (false && $('soil_type').value === 'coir' && $('covered_cultivation').value !== 'true'){"],
  ["m6 φραγμός σε όλους", "form", "  if ($('soil_type').value === 'coir' && $('covered_cultivation').value !== 'true'){", "  if ($('covered_cultivation').value !== 'true'){"],
  ["m7 αγγλική ετικέτα ομάδας", "form", "  coir:'Υπόστρωμα (όχι έδαφος)'", "  coir:'coir substrate'"],
  ["m8 sync χωρίς coir", "sync", "\"calcareous_clay\", \"coir\"];", "\"calcareous_clay\"];"],
  ["m9 sync έκδοση", "sync", " ** v14 · 27/10/2026 — T-SUBSTRATE-01", " ** v13 · 27/10/2026 — T-SUBSTRATE-01"],
];
let killed = 0;
for (const [name, which, a, b] of MUT) {
  const src = which === "form" ? FORM : SYNC; const n = src.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = which === "form" ? run(FORM.replace(a, b), SYNC) : run(FORM, SYNC.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 120)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
