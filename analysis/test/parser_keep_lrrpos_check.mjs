// T-GWID-03 — ΕΛΕΓΧΟΣ: οι parsers SE02/SE0X/SE01 με 'lrrlat','lrrlon' εκτός λίστας δίνουν ΑΚΡΙΒΩΣ τα ίδια με τον
// ζωντανό (git HEAD = T-GWID-01) + ΜΟΝΟ lrrlat/lrrlon. Έγκυρο frame ανά parser (η μέτρηση ΠΡΕΠΕΙ να αποκωδικοποιείται),
// uplink άλλης θύρας, πακέτο χωρίς payload. Μεταλλάξεις.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
const ROOT = new URL("../../", import.meta.url);
const P = [
  { f: "dragino_se02_parser.js", old: "75917c86626e776f", frame: "0E1000FA0BB8096000C80C1C08FC00DC00", m: "soil_moisture1" },
  { f: "dragino_se0x_parser.js", old: "cc12d6cf4a7130b9", frame: "0E1000FA080BB8096000C8", m: "soil_moisture1" },
  { f: "dragino_se01_parser.js", old: "996ae048dbe84e76", frame: "0E1000FA0BB8096000C800", m: "soil_moisture" },
];
const serie = "a84041e5f85a7889", time = "2026-10-19T15:28:28.756Z";
const base = (port, hex) => [
  ...(hex ? [{ variable: "payload", value: hex, serie, time }] : []),
  { variable: "fport", value: port, serie, time }, { variable: "fcnt", value: 1234, serie, time },
  { variable: "lrrid", value: "1000C238", serie, time }, { variable: "lrrrssi", value: -112, serie, time },
  { variable: "lrrsnr", value: -3.5, serie, time }, { variable: "lrrlat", value: 35.367168, serie, time },
  { variable: "lrrlon", value: 24.731676, serie, time }, { variable: "spfact", value: 9, serie, time },
  { variable: "deveui", value: serie, serie, time }];
function run(code, pl) {
  const sb = { payload: JSON.parse(JSON.stringify(pl)), console: { log() {}, error() {} }, device: { params: [] }, Buffer };
  vm.createContext(sb);
  vm.runInContext(code, sb, { timeout: 2000 });
  return sb.payload.map((x) => ({ variable: x.variable, value: x.value }));
}
const POS = ["lrrlat", "lrrlon"];
function scen(p, OLD, code, quiet) {
  const bad = [];
  for (const [label, pl] of [["fPort 2", base(2, p.frame)], ["fPort 5", base(5, "0E01001E0101")], ["χωρίς payload", base(2, null)]]) {
    let o, n;
    let eo = null, en = null;
    try { o = run(OLD, pl); } catch (e) { o = null; eo = e.message; }
    try { n = run(code, pl); } catch (e) { n = null; en = e.message; }
    // Ο ΖΩΝΤΑΝΟΣ SE01 σκάει ήδη σε θύρα ≠ 2 (parsePayload → undefined → .map). ΠΡΟΫΠΑΡΧΟΝ, ΔΕΝ το αλλάζουμε εδώ:
    // απαιτούμε μόνο ΙΔΙΑ συμπεριφορά με τον ζωντανό.
    if (!o && !n && eo === en) { if (!quiet) console.log(`  (${p.f} ${label}: εξαίρεση ΚΑΙ στον ζωντανό — «${eo}» — ίδια συμπεριφορά)`); continue; }
    if (!o || !n) { bad.push(`${p.f} ${label}: εξαίρεση μόνο στον ${o ? "νέο" : "παλιό"}`); continue; }
    if (JSON.stringify(n.filter((x) => !POS.includes(x.variable))) !== JSON.stringify(o)) bad.push(`${p.f} ${label}: διαφορά πέρα από lrrlat/lrrlon`);
    for (const [v, val] of [["lrrlat", 35.367168], ["lrrlon", 24.731676]])
      if (n.filter((x) => x.variable === v && x.value === val).length !== 1) bad.push(`${p.f} ${label}: λείπει/διπλό ${v}`);
    if (n.filter((x) => x.variable === "lrrid").length !== 1) bad.push(`${p.f} ${label}: χάθηκε το lrrid`);
    if (n.some((x) => ["lrrrssi", "lrrsnr", "spfact", "fcnt", "deveui"].includes(x.variable))) bad.push(`${p.f} ${label}: πέρασε άλλο πεδίο δικτύου`);
    if (label === "fPort 2" && !(n.some((x) => x.variable === p.m && x.value === 30) && !n.some((x) => x.variable === "parse_error")))
      bad.push(`${p.f} ${label}: η μέτρηση ΔΕΝ αποκωδικοποιήθηκε (υγρασία 30 %)`);
  }
  return bad;
}
// Ορίσματα: ποιοι parsers ελέγχονται (π.χ. `se02`). Χωρίς ορίσματα: και οι 3.
const ONLY = process.argv.slice(2);
let all = [], killed = 0, total = 0;
for (const p of P.filter((x) => !ONLY.length || ONLY.some((o) => x.f.includes(o)))) {
  const NEW = readFileSync(new URL("payload_parsers/" + p.f, ROOT), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const OLD = execSync("git show HEAD:payload_parsers/" + p.f, { cwd: ROOT, encoding: "utf8", maxBuffer: 1e7 }).replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!createHash("sha256").update(OLD, "utf8").digest("hex").startsWith(p.old)) all.push(`${p.f}: ο παλιός ≠ ζωντανός (${p.old})`);
  const b = scen(p, OLD, NEW);
  all = all.concat(b);
  console.log(`${p.f}: ${b.length ? "✗" : "✓"} νέο sha ${createHash("sha256").update(NEW, "utf8").digest("hex").slice(0, 16)}`);
  const MUT = [["ξαναμπαίνει lrrlat", "const ignore_vars = [", "const ignore_vars = ['lrrlat',"],
    ["ξαναμπαίνει lrrlon", "const ignore_vars = [", "const ignore_vars = ['lrrlon',"],
    ["χάνεται το lrrid", "const ignore_vars = [", "const ignore_vars = ['lrrid',"],
    ["περνά και το lrrrssi", "'lrrrssi',", ""]];
  for (const [n, a, r] of MUT) {
    total++;
    if (NEW.split(a).length !== 2) { console.log(`  ΑΝΕΦΑΡΜΟΣΤΗ ${n}`); continue; }
    if (scen(p, OLD, NEW.replace(a, r), true).length) { killed++; console.log(`  ✓ σκοτώθηκε: ${n}`); } else console.log(`  ✗✗ ΕΠΕΖΗΣΕ: ${n}`);
  }
}
console.log(all.length ? "ΑΠΟΤΥΧΙΕΣ:\n  " + all.join("\n  ") : "ΒΑΣΗ ✓");
console.log(`μεταλλάξεις ${killed}/${total}`);
process.exit(all.length === 0 && killed === total ? 0 : 1);
