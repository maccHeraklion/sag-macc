// T-GWID-01 — ΕΛΕΓΧΟΣ: ο parser SE02 με το 'lrrid' εκτός λίστας δίνει ΑΚΡΙΒΩΣ τα ίδια με τον ζωντανό + ΜΟΝΟ το lrrid.
// Τρέχει τον ΠΑΛΙΟ (git HEAD, = ζωντανός, sha b4da5d81) και τον ΝΕΟ κώδικα στο ίδιο πακέτο Actility, σε vm όπως η TagoIO
// (καθολικό `payload`). Σενάρια: uplink fPort 2, uplink άλλης θύρας, πακέτο χωρίς payload. Μεταλλάξεις.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import vm from "node:vm";
const ROOT = new URL("../../", import.meta.url);
const NEW = readFileSync(new URL("payload_parsers/dragino_se02_parser.js", ROOT), "utf8").replace(/\r\n/g, "\n");
const OLD = execSync("git show HEAD:payload_parsers/dragino_se02_parser.js", { cwd: ROOT, encoding: "utf8", maxBuffer: 1e7 }).replace(/\r\n/g, "\n");
const serie = "a84041e5f85a7889", time = "2026-10-19T15:28:28.756Z";
const base = (port, hex) => [
  ...(hex ? [{ variable: "payload", value: hex, serie, time }] : []),
  { variable: "fport", value: port, serie, time }, { variable: "fcnt", value: 1234, serie, time },
  { variable: "lrrid", value: "1000C238", serie, time }, { variable: "lrrrssi", value: -112, serie, time },
  { variable: "lrrsnr", value: -3.5, serie, time }, { variable: "lrrlat", value: 35.367, serie, time },
  { variable: "lrrlon", value: 24.731, serie, time }, { variable: "spfact", value: 9, serie, time },
  { variable: "deveui", value: serie, serie, time }];
function run(code, pl) {
  const sb = { payload: JSON.parse(JSON.stringify(pl)), console: { log() {}, error() {} }, device: { params: [] }, Buffer };
  vm.createContext(sb);
  vm.runInContext(code, sb, { timeout: 2000 });
  return sb.payload.map((x) => ({ variable: x.variable, value: x.value }));
}
const bad = [];
const want = (l, ok, info) => { if (!ok) bad.push(l + (info ? " — " + info : "")); };
function scen(code) {
  const out = [];
  for (const [label, pl] of [["fPort 2 μέτρηση", base(2, "0E1000FA0BB8096000C80C1C08FC00DC00")], ["fPort 5 κατάσταση", base(5, "0E01001E0101")], ["χωρίς payload", base(2, null)]]) {
    let o, n;
    try { o = run(OLD, pl); } catch (e) { o = ["ΣΦΑΛΜΑ " + e.message]; }
    try { n = run(code, pl); } catch (e) { n = ["ΣΦΑΛΜΑ " + e.message]; }
    const nNoLrr = Array.isArray(n) ? n.filter((x) => x.variable !== "lrrid") : n;
    out.push([label, JSON.stringify(nNoLrr) === JSON.stringify(o), Array.isArray(n) && n.filter((x) => x.variable === "lrrid").length === 1 && n.find((x) => x.variable === "lrrid").value === "1000C238",
      Array.isArray(n) && !n.some((x) => ["lrrlat", "lrrlon", "lrrrssi", "lrrsnr", "spfact", "fcnt"].includes(x.variable)), o, n]);
  }
  return out;
}
const res = scen(NEW);
// έγκυρο frame 17 bytes: η μέτρηση ΠΡΕΠΕΙ να αποκωδικοποιείται (όχι parse_error) — αλλιώς η σύγκριση δεν αποδεικνύει τίποτα
const m0 = res[0][5];
want("έγκυρη μέτρηση αποκωδικοποιείται (υγρασία 30 %, μπαταρία 3,6 V)", Array.isArray(m0) && m0.some((x) => x.variable === "soil_moisture1" && x.value === 30) && m0.some((x) => x.variable === "battery" && x.value === 3.6) && !m0.some((x) => x.variable === "parse_error"));
for (const [label, same, hasL, noExtra, o, n] of res) {
  console.log(`${label}: παλιός ${o.length} μεταβλητές · νέος ${n.length} · ${(Array.isArray(n) ? n.map((x) => x.variable).join(",") : n)}`);
  want(label + ": ίδια αποτελέσματα με τον ζωντανό (εκτός lrrid)", same);
  want(label + ": ΕΝΑ lrrid με τη σωστή τιμή", hasL);
  want(label + ": κανένα άλλο πεδίο δικτύου δεν περνά", noExtra);
}
want("ο παλιός = ζωντανός (sha b4da5d81)", (await import("node:crypto")).createHash("sha256").update(OLD, "utf8").digest("hex").startsWith("b4da5d81a6f31a11"));
const MUT = [["το lrrid ξαναμπαίνει στη λίστα", "'subband','late'", "'subband','lrrid','late'"], ["περνά και το lrrrssi", "'lrrrssi',", ""], ["σπασμένη σύνταξη", "const ignore_vars = [", "const ignore_vars = [["]];
let k = 0;
for (const [n, a, b] of MUT) {
  if (NEW.split(a).length !== 2) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); continue; }
  const r = scen(NEW.replace(a, b));
  const fail = r.some(([, same, hasL, noExtra]) => !(same && hasL && noExtra));
  if (fail) { k++; console.log("✓ σκοτώθηκε: " + n); } else console.log("✗✗ ΕΠΕΖΗΣΕ: " + n);
}
console.log(bad.length ? "ΑΠΟΤΥΧΙΕΣ:\n  " + bad.join("\n  ") : "ΒΑΣΗ ✓");
console.log(`μεταλλάξεις ${k}/${MUT.length}`);
process.exit(bad.length === 0 && k === MUT.length ? 0 : 1);
