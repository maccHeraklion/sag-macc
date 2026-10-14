// T-DASH-SRC-02 · KEK + 9 ταμπλό ΙΔΕ: η ΜΙΑ πηγή του αγρού έχει ήδη ημερολόγιο/ψεκασμό/επιθεώρηση ×1, αλλά λείπουν
// declaration_undo και action_log → οι αναιρέσεις και οι εντολές άρδευσης πετιούνται σιωπηλά. Η ελάχιστη αλλαγή: προσθήκη
// ΜΟΝΟ αυτών των δύο στο τέλος της πηγής του αγρού (όπως ο πιλότος Γρινιαράκης). Όλες οι άλλες πηγές μένουν ΑΥΤΟΥΣΙΕΣ.
// Είσοδος: backup_2026-10-14_r1/originals.json (ζωντανή ρύθμιση πριν). Έξοδος: targets.json. Έλεγχος με sagDashRules.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "backup_2026-10-14_r1");
const ADD = ["declaration_undo", "action_log"];
const SRC = fs.readFileSync(path.join(here, "..", "..", "analysis", "dashboard_config_audit.js"), "utf8").replace(/\r\n/g, "\n");
const a = SRC.indexOf("function sagDashRules("); let d = 0, b = -1;
for (let k = SRC.indexOf("{", a); k < SRC.length; k++) { if (SRC[k] === "{") d++; else if (SRC[k] === "}") { d--; if (!d) { b = k + 1; break; } } }
const R = new Function(SRC.slice(a, b) + "\nreturn sagDashRules;")();
const orig = JSON.parse(fs.readFileSync(path.join(DIR, "originals.json"), "utf8"));
const out = []; let bad = 0;
for (const o of orig) {
  const errs = [];
  const fi = o.data.findIndex(e => (e.variables || []).includes("field_bundle"));
  const F = o.data.filter(e => e.origin === o.data[fi].origin);
  if (F.length !== 1) errs.push("πηγές αγρού " + F.length + " (αναμενόταν 1)");
  if (ADD.some(v => o.data[fi].variables.includes(v))) errs.push("ήδη υπάρχει");
  const data = o.data.map((e, i) => i === fi ? { ...e, variables: e.variables.concat(ADD) } : e);
  // μόνο η πηγή του αγρού αλλάζει, και μόνο με τις 2 μεταβλητές στο τέλος
  for (let i = 0; i < data.length; i++) if (i !== fi && JSON.stringify(data[i]) !== JSON.stringify(o.data[i])) errs.push("άλλαξε η πηγή " + i);
  if (JSON.stringify(data[fi].variables.slice(0, -2)) !== JSON.stringify(o.data[fi].variables)) errs.push("άλλαξαν υπάρχουσες μεταβλητές");
  const before = R({ data: o.data, analysis_run: o.analysis_run, display: {} }).filter(x => x.level === "CRITICAL" || x.level === "HIGH");
  const after = R({ data, analysis_run: o.analysis_run, display: {} }).filter(x => x.level === "CRITICAL" || x.level === "HIGH");
  if (!before.some(x => x.code === "R1")) errs.push("δεν είχε R1 πριν");
  if (after.length) errs.push("μετά: " + after.map(x => x.code + " " + x.msg).join(" | "));
  if (errs.length) { bad++; console.log("ΑΠΟΤΥΧΙΑ " + o.label + ": " + errs.join(", ")); }
  else console.log("OK " + o.label.padEnd(26) + " πριν: " + before.map(x => x.code).join(",") + " → μετά: καθαρό");
  out.push({ dashboard: o.dashboard, widget: o.widget, label: o.label, data });
}
fs.writeFileSync(path.join(DIR, "targets.json"), JSON.stringify(out, null, 1));
console.log("ΣΥΝΟΛΟ " + (orig.length - bad) + "/" + orig.length);
if (bad) process.exit(1);
