// T-GWID-03 — ΕΛΕΓΧΟΣ: οι parsers SE02/SE0X/SE01 με το μπλοκ «θέση πάνω στο lrrid» δίνουν ΑΚΡΙΒΩΣ τις ίδιες εγγραφές
// με τον ζωντανό (repo 691ca6b = T-GWID-01, επαληθευμένο 16:30 UTC) — ΙΔΙΟ ΠΛΗΘΟΣ — και ΜΟΝΗ διαφορά: `location` στο lrrid.
// Σενάρια: έγκυρο frame (η μέτρηση ΠΡΕΠΕΙ να αποκωδικοποιείται), άλλη θύρα, χωρίς payload, χωρίς lrrlat, θέση 0,0.
// Ορίσματα: ποιοι parsers (π.χ. `se02`). Χωρίς ορίσματα: και οι 3.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
const ROOT = new URL("../../", import.meta.url);
const LIVE_COMMIT = "691ca6b";
const P = [
  { f: "dragino_se02_parser.js", old: "75917c86626e776f", frame: "0E1000FA0BB8096000C80C1C08FC00DC00", m: "soil_moisture1" },
  { f: "dragino_se0x_parser.js", old: "cc12d6cf4a7130b9", frame: "0E1000FA080BB8096000C8", m: "soil_moisture1" },
  { f: "dragino_se01_parser.js", old: "996ae048dbe84e76", frame: "0E1000FA0BB8096000C800", m: "soil_moisture" },
];
const serie = "a84041e5f85a7889", time = "2026-10-19T15:28:28.756Z";
const LAT = 35.367168, LON = 24.731676;
const base = (port, hex, lat = LAT, lon = LON) => [
  ...(hex ? [{ variable: "payload", value: hex, serie, time }] : []),
  { variable: "fport", value: port, serie, time }, { variable: "fcnt", value: 1234, serie, time },
  { variable: "lrrid", value: "1000C238", serie, time }, { variable: "lrrrssi", value: -112, serie, time },
  { variable: "lrrsnr", value: -3.5, serie, time },
  ...(lat === null ? [] : [{ variable: "lrrlat", value: lat, serie, time }, { variable: "lrrlon", value: lon, serie, time }]),
  { variable: "spfact", value: 9, serie, time }, { variable: "deveui", value: serie, serie, time }];
function run(code, pl) {
  const sb = { payload: JSON.parse(JSON.stringify(pl)), console: { log() {}, error() {} }, device: { params: [] }, Buffer };
  vm.createContext(sb);
  vm.runInContext(code, sb, { timeout: 2000 });
  return JSON.parse(JSON.stringify(sb.payload));
}
const strip = (a) => a.map(({ location, ...r }) => r);
function scen(p, OLD, code, quiet) {
  const bad = [];
  const S = [["fPort 2", base(2, p.frame), true], ["fPort 5", base(5, "0E01001E0101"), true], ["χωρίς payload", base(2, null), true],
    ["χωρίς lrrlat/lrrlon", base(2, p.frame, null), false], ["θέση 0,0", base(2, p.frame, 0, 0), false]];
  for (const [label, pl, wantLoc] of S) {
    let o, n, eo = null, en = null;
    try { o = run(OLD, pl); } catch (e) { o = null; eo = e.message; }
    try { n = run(code, pl); } catch (e) { n = null; en = e.message; }
    // Ο ΖΩΝΤΑΝΟΣ SE01 σκάει ήδη σε θύρα ≠ 2 (parsePayload → undefined → .map). ΠΡΟΫΠΑΡΧΟΝ, δεν αλλάζει εδώ.
    if (!o && !n && eo === en) { if (!quiet) console.log(`  (${p.f} ${label}: εξαίρεση ΚΑΙ στον ζωντανό — ίδια συμπεριφορά)`); continue; }
    if (!o || !n) { bad.push(`${p.f} ${label}: εξαίρεση μόνο στον ${o ? "νέο" : "παλιό"}`); continue; }
    if (n.length !== o.length) bad.push(`${p.f} ${label}: ${n.length} εγγραφές αντί ${o.length} (πρέπει ΙΔΙΟ πλήθος)`);
    if (JSON.stringify(strip(n)) !== JSON.stringify(strip(o))) bad.push(`${p.f} ${label}: διαφορά πέρα από το location`);
    const withLoc = n.filter((x) => x.location);
    const id = n.find((x) => x.variable === "lrrid");
    if (wantLoc) {
      if (!(id && id.location && id.location.lat === LAT && id.location.lng === LON)) bad.push(`${p.f} ${label}: το lrrid ΔΕΝ έχει σωστή θέση`);
      if (withLoc.length !== 1) bad.push(`${p.f} ${label}: θέση σε ${withLoc.length} εγγραφές (πρέπει 1)`);
    } else if (withLoc.length) bad.push(`${p.f} ${label}: θέση εκεί που δεν έπρεπε`);
    if (n.some((x) => ["lrrlat", "lrrlon", "lrrrssi", "lrrsnr", "spfact", "fcnt", "deveui"].includes(x.variable))) bad.push(`${p.f} ${label}: πέρασε πεδίο δικτύου`);
    if (label === "fPort 2" && !(n.some((x) => x.variable === p.m && x.value === 30) && !n.some((x) => x.variable === "parse_error")))
      bad.push(`${p.f} ${label}: η μέτρηση ΔΕΝ αποκωδικοποιήθηκε (υγρασία 30 %)`);
  }
  return bad;
}
const ONLY = process.argv.slice(2);
let all = [], killed = 0, total = 0;
for (const p of P.filter((x) => !ONLY.length || ONLY.some((o) => x.f.includes(o)))) {
  const NEW = readFileSync(new URL("payload_parsers/" + p.f, ROOT), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const OLD = execSync(`git show ${LIVE_COMMIT}:payload_parsers/${p.f}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 1e7 }).replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!createHash("sha256").update(OLD, "utf8").digest("hex").startsWith(p.old)) all.push(`${p.f}: ο παλιός ≠ ζωντανός (${p.old})`);
  const b = scen(p, OLD, NEW);
  all = all.concat(b);
  console.log(`${p.f}: ${b.length ? "✗" : "✓"} νέο sha ${createHash("sha256").update(NEW, "utf8").digest("hex").slice(0, 16)}`);
  const MUT = [["χωρίς ανάθεση θέσης", "_sagGwId.location = { lat: la, lng: lo };", ";"],
    ["ανάποδα lat/lng", "{ lat: la, lng: lo }", "{ lat: lo, lng: la }"],
    ["χωρίς φύλαξη 0,0", " && !(la === 0 && lo === 0)", ""],
    ["lrrlat γίνεται εγγραφή", (c) => c.replace(/(const ignore_vars = \[[\s\S]*?)'lrrlat'/, "$1'lrrlat_x'")],
    ["χάνεται το lrrid", "const ignore_vars = [", "const ignore_vars = ['lrrid',"]];
  for (const [n, a, r] of MUT) {
    total++;
    const M = typeof a === "function" ? a(NEW) : (NEW.split(a).length === 2 ? NEW.replace(a, r) : NEW);
    if (M === NEW) { console.log(`  ΑΝΕΦΑΡΜΟΣΤΗ ${n}`); continue; }
    if (scen(p, OLD, M, true).length) { killed++; console.log(`  ✓ σκοτώθηκε: ${n}`); } else console.log(`  ✗✗ ΕΠΕΖΗΣΕ: ${n}`);
  }
}
console.log(all.length ? "ΑΠΟΤΥΧΙΕΣ:\n  " + all.join("\n  ") : "ΒΑΣΗ ✓");
console.log(`μεταλλάξεις ${killed}/${total}`);
process.exit(all.length === 0 && killed === total ? 0 : 1);
