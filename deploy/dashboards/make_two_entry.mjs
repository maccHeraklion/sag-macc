// T-DASH-SRC-01 · από κάθε αντίγραφο <dash>_<widget>.json παράγει <dash>_<widget>.two.json:
// δύο πηγές για τη συσκευή του αγρού — Α (field_bundle κ.λπ.) και Β (καταγραφές) — με κάθε μεταβλητή ΜΙΑ φορά.
// Μηχανικός μετασχηματισμός (όχι χειρόγραφος). Οι πηγές άλλων συσκευών μένουν ΑΥΤΟΥΣΙΕΣ και στη θέση τους.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "backup_2026-10-14");
const LOG = ["field_calendar", "spray_declaration", "inspection_declaration", "declaration_undo", "action_log"];
let ok = 0, bad = 0;
for (const f of fs.readdirSync(DIR).filter(n => /^[0-9a-f]{24}_[0-9a-f]{24}\.json$/.test(n))) {
  const o = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  const d = o.data;
  const fo = o.field_origin || (d.find(e => (e.variables || []).includes("field_bundle")) || {}).origin;
  const F = d.filter(e => e.origin === fo);
  const main = F.find(e => (e.variables || []).includes("field_bundle"));
  const errs = [];
  if (!fo || !main) errs.push("χωρίς πηγή field_bundle");
  const U = []; for (const e of [main, ...F.filter(x => x !== main)]) for (const v of (e && e.variables) || []) if (!U.includes(v)) U.push(v);
  const A = { ...main, variables: U.filter(v => !LOG.includes(v)) }; delete A.bucket;
  const B = { qty: 500, origin: fo, variables: LOG.slice() };
  const out = []; for (const e of d) { if (e === main) out.push(A); else if (e.origin !== fo) out.push(e); } out.push(B);
  // έλεγχοι
  const fe = out.filter(e => e.origin === fo);
  if (fe.length !== 2) errs.push("πηγές αγρού " + fe.length);
  const seen = new Set(); for (const e of fe) for (const v of e.variables) { if (seen.has(v)) errs.push("διπλή " + v); seen.add(v); }
  if (!A.variables.includes("field_bundle") || LOG.some(v => A.variables.includes(v))) errs.push("Α λάθος");
  for (const v of U) if (!seen.has(v)) errs.push("χάθηκε " + v);
  const nonF = d.filter(e => e.origin !== fo), nonOut = out.filter(e => e.origin !== fo);
  if (JSON.stringify(nonF) !== JSON.stringify(nonOut)) errs.push("άλλαξαν πηγές άλλων συσκευών");
  if (out.length !== d.length - F.length + 2) errs.push("πλήθος");
  if ("bucket" in A) errs.push("bucket");
  fs.writeFileSync(path.join(DIR, f.replace(/\.json$/, ".two.json")), JSON.stringify({ dashboard: o.dashboard, widget: o.widget, label: o.label, data: out }, null, 1));
  const nf = path.join(DIR, f.replace(/\.json$/, ".new.json"));
  if (fs.existsSync(nf)) { const nd = JSON.parse(fs.readFileSync(nf, "utf8")).data; const norm = x => JSON.stringify(x.map(e => Object.fromEntries(Object.entries(e).sort())));
    if (norm(nd) !== norm(out)) errs.push("ΔΙΑΦΕΡΕΙ από το .new.json του βοηθού"); }
  if (errs.length) { bad++; console.log("ΑΠΟΤΥΧΙΑ " + (o.label || f) + ": " + errs.join(", ")); }
  else { ok++; console.log("OK " + String(o.label || f).padEnd(34) + d.length + " → " + out.length + " · Α: " + A.variables.join(",")); }
}
console.log("ΣΥΝΟΛΟ OK " + ok + " · ΑΠΟΤΥΧΙΕΣ " + bad);
if (bad) process.exit(1);
