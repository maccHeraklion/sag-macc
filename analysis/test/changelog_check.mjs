/* T-CHANGELOG-01 (27/11/2026) — ΕΛΕΓΧΟΣ του ημερολογίου αλλαγών συστήματος (changelog/system_changelog.json) και της
   περιγραφής δεδομένων (changelog/data_dictionary.json).
   1. ΜΟΝΟ ΠΡΟΣΘΗΚΕΣ: κάθε εγγραφή της τελευταίας δεσμευμένης έκδοσης (git HEAD, ή --base <ref>) υπάρχει ΑΥΤΟΥΣΙΑ, στην ίδια θέση.
   2. Μορφή: id SC-NNNN συνεχόμενα, ημερομηνίες ISO σε UTC (…Z), γνωστό είδος/κοινό, υποχρεωτικά πεδία.
   3. Κάθε μεταβλητή που εξάγει το fieldExportData.js έχει περιγραφή· κάθε known_issue δείχνει υπαρκτή εγγραφή.
   Τρέξιμο: node analysis/test/changelog_check.mjs   (ή --base origin/main) */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rel = "changelog/system_changelog.json";
const cur = JSON.parse(readFileSync(path.join(root, rel), "utf8"));
const dict = JSON.parse(readFileSync(path.join(root, "changelog/data_dictionary.json"), "utf8"));
const exportSrc = readFileSync(path.join(root, "analysis/fieldExportData.js"), "utf8");
const baseArg = process.argv.indexOf("--base");
const baseRef = baseArg > 0 ? process.argv[baseArg + 1] : "HEAD";
let base = null;
try { base = JSON.parse(execFileSync("git", ["show", `${baseRef}:${rel}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch (e) { base = null; }

const KINDS = new Set(["calculation", "export", "time_reference", "known_issue", "policy", "fix", "display", "data", "notice", "device"]);
const AUD = new Set(["researchers", "producers", "operators"]);
const ISOZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
function check(c, b) {
  const bad = [];
  const E = c.entries || [];
  if (c.time_reference !== "UTC") bad.push("time_reference ≠ UTC");
  E.forEach((e, i) => {
    const want = "SC-" + String(i + 1).padStart(4, "0");
    if (e.id !== want) bad.push(`θέση ${i}: id ${e.id} ≠ ${want}`);
    if (!ISOZ.test(e.date_utc || "")) bad.push(`${e.id}: date_utc όχι ISO UTC`);
    if (e.effective_utc !== null && !ISOZ.test(e.effective_utc || "")) bad.push(`${e.id}: effective_utc όχι ISO UTC ή null`);
    if (!KINDS.has(e.kind)) bad.push(`${e.id}: άγνωστο είδος ${e.kind}`);
    if (!Array.isArray(e.audience) || !e.audience.length || e.audience.some((a) => !AUD.has(a))) bad.push(`${e.id}: κοινό`);
    for (const k of ["title_el", "summary_el", "source"]) if (!String(e[k] || "").trim()) bad.push(`${e.id}: λείπει ${k}`);
    if (typeof e.reconstructed !== "boolean") bad.push(`${e.id}: reconstructed`);
    if (e.supersedes && !E.slice(0, i).some((x) => x.id === e.supersedes)) bad.push(`${e.id}: supersedes σε ανύπαρκτη/μεταγενέστερη`);
  });
  if (b) {
    const B = b.entries || [];
    if (E.length < B.length) bad.push(`σβήστηκαν εγγραφές (${B.length} → ${E.length})`);
    B.forEach((x, i) => { if (JSON.stringify(x) !== JSON.stringify(E[i])) bad.push(`η εγγραφή ${x.id} άλλαξε — μόνο νέες εγγραφές επιτρέπονται`); });
  }
  return bad;
}
const bad = check(cur, base);
// Περιγραφή δεδομένων: όλες οι μεταβλητές της εξαγωγής.
const grab = (name) => { const i = exportSrc.indexOf("const " + name + " = {"); const j = exportSrc.indexOf("\n};", i); return new Function("return " + exportSrc.slice(i + name.length + 9, j + 3))(); };
const exported = new Set();
for (const vs of Object.values(grab("DEVICE_TYPE_VARIABLES"))) vs.forEach((v) => exported.add(v));
for (const gs of Object.values(grab("EXTRA_BLOCK_GROUPS"))) gs.forEach((g) => g.vars.forEach((v) => exported.add(v)));
for (const vs of Object.values(grab("DERIVED_EXPORT_VARIABLES"))) vs.forEach((v) => exported.add(v));   // T-EXPORT-RAIN-01: στήλες που υπολογίζει η εξαγωγή
for (const v of exported) if (!dict.variables[v]) bad.push(`η μεταβλητή ${v} εξάγεται χωρίς περιγραφή`);
for (const [v, d] of Object.entries(dict.variables)) {
  for (const k of ["label_el", "source", "meaning_el", "sampling_el"]) if (d[k] === undefined || d[k] === "") bad.push(`${v}: λείπει ${k}`);
  if (d.known_issue && !cur.entries.some((e) => e.id === d.known_issue)) bad.push(`${v}: known_issue ${d.known_issue} ανύπαρκτο`);
}
for (const b of bad) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(bad.length ? "ΑΠΟΤΥΧΙΑ" : `ΟΚ ημερολόγιο (${cur.entries.length} εγγραφές, βάση ${base ? baseRef + " " + base.entries.length : "καμία"}) · περιγραφή ${exported.size} μεταβλητών`);
// Αυτοέλεγχος: οι παραβιάσεις πιάνονται.
const clone = () => JSON.parse(JSON.stringify(cur));
let k = 0, n = 0;
const mut = (name, f) => { n++; const c = clone(); f(c); if (check(c, cur).length) k++; else console.log("ΕΠΕΖΗΣΕ", name); };
mut("αλλαγή παλιάς εγγραφής", (c) => { c.entries[0].summary_el += " (διορθωμένο)"; });
mut("διαγραφή εγγραφής", (c) => { c.entries.pop(); });
mut("αλλαγή σειράς", (c) => { c.entries.reverse(); });
mut("ώρα χωρίς Z", (c) => { c.entries.push({ ...c.entries[0], id: "SC-" + String(c.entries.length + 1).padStart(4, "0"), date_utc: "2026-12-01T10:00:00" }); });
mut("κενό id", (c) => { c.entries.push({ ...c.entries[0], id: "SC-9999" }); });
console.log(`μεταλλάξεις ${k}/${n}`);
if (bad.length || k !== n) process.exitCode = 1;
