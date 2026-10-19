// Ελεγκτής T-DASH-SRC-03: ο createField (ensureFieldBundleSibling) ΔΕΝ ξαναπροσθέτει field_calendar κ.λπ. στην πηγή του
// field_bundle όταν η μεταβλητή υπάρχει ήδη σε άλλη πηγή της ίδιας συσκευής (δεύτερη πηγή καταγραφών του προτύπου).
// Αιτία: Αμμουδάρες 16/10 — field_calendar σε 2 πηγές → κάθε εγγραφή ×4. Εκτελεί τον πραγματικό κώδικα· μεταλλάξεις.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "createField.js"), "utf8").replace(/\r\n/g, "\n");
function fnText(c, name) {
  const m = c.indexOf("function " + name + "("); if (m < 0) throw new Error("δεν βρέθηκε " + name);
  let d = 0; for (let k = c.indexOf("{", m); k < c.length; k++) { if (c[k] === "{") d++; else if (c[k] === "}") { d--; if (!d) return c.slice(m, k + 1); } }
  throw new Error("άνοιγμα χωρίς κλείσιμο");
}
const F = "6ad202ac174a0b000cf10008";
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let S; try { S = new Function(fnText(src, "ensureFieldBundleSibling") + "\nreturn ensureFieldBundleSibling;")(); } catch (e) { return ["εξαγωγή: " + e.message]; }
  const count = (w, v) => w.data.filter(e => e.origin === F && e.variables.includes(v)).length;
  // Α. πρότυπο μετά τις 14/10: Α (field_bundle) + Β (καταγραφές)
  const two = { data: [{ origin: F, variables: ["configuration", "field_bundle", "forecast"] }, { origin: F, variables: ["field_calendar", "spray_declaration", "inspection_declaration", "declaration_undo", "action_log"] }] };
  S(two, "field_calendar");
  ok(count(two, "field_calendar") === 1, "Α1 field_calendar μένει σε ΜΙΑ πηγή (" + count(two, "field_calendar") + ")");
  S(two, "history_request");
  ok(count(two, "history_request") === 1 && two.data[0].variables.includes("history_request"), "Α2 history_request (δεν υπάρχει αλλού) μπαίνει στην πηγή του field_bundle");
  // Β. παλιά διάταξη μίας πηγής: προστίθεται όπως πριν
  const one = { data: [{ origin: F, variables: ["field_bundle"] }] };
  S(one, "field_calendar");
  ok(count(one, "field_calendar") === 1, "Β1 μία πηγή: το field_calendar προστίθεται");
  // Γ. άλλη συσκευή με την ίδια μεταβλητή ΔΕΝ εμποδίζει
  const other = { data: [{ origin: F, variables: ["field_bundle"] }, { origin: "x", variables: ["field_calendar"] }] };
  S(other, "field_calendar");
  ok(count(other, "field_calendar") === 1, "Γ1 ίδια μεταβλητή σε ΑΛΛΗ συσκευή δεν εμποδίζει την προσθήκη");
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 χωρίς έλεγχο «αλλού»", "&& !vars.includes(sibling) && !elsewhere)", "&& !vars.includes(sibling))"],
  ["m2 «αλλού» αγνοεί τη συσκευή", "o !== d && o?.origin === d?.origin &&", "o !== d &&"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  const r = run(SRC.replace(a, b));
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
