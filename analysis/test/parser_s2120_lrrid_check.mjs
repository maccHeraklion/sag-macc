// T-GWID-04 — ΕΛΕΓΧΟΣ: ο parser 047e με το μπλοκ lrrid δίνει ΑΚΡΙΒΩΣ τα ίδια με τον ζωντανό + ΜΟΝΟ μία εγγραφή lrrid, για κάθε μορφή raw_payload, και ΠΟΤΕ δεν ρίχνει το uplink. Μεταλλάξεις: κάθε βλάβη πρέπει να πιαστεί.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "payload_parsers");
const OLD = fs.readFileSync(path.join(dir, "sensecap_s2120_047e_ORIGINAL_2026-11-07.js"), "utf8");
const NEW = fs.readFileSync(path.join(dir, "sensecap_s2120_047e_lrrid_2026-11-07.js"), "utf8");
const T = "2026-11-07T12:00:00.000Z";
const base = () => [{ variable: "air_temperature", value: 18.2, unit: "°C", time: T }, { variable: "air_humidity", value: 61, time: T }, { variable: "port", value: 2 }, { variable: "time", value: "x" }];
function run(src, raw, pl) {
  const fn = new Function("payload", "raw_payload", "console", `${src}\nreturn payload;`);
  return fn(pl === undefined ? base() : pl, raw, { log() {}, error() {} });
}
const up = { DevEUI_uplink: { Lrrid: "1000C238", LrrLAT: "35.1", LrrLON: "25.2", LrrRSSI: -110 } };
const multi = { DevEUI_uplink: { Lrrid: "1000C238", LrrLAT: "35.1", LrrLON: "25.2", Lrrs: { Lrr: [{ Lrrid: "1000C238", LrrRSSI: -90, LrrSNR: 8 }, { Lrrid: "1000F992", LrrRSSI: "-110.5", LrrSNR: "χάλια" }, { foo: 1 }] } } };
const CASES = [
  ["αντικείμενο Actility", up, "1000C238", true], ["συμβολοσειρά JSON", JSON.stringify(up), "1000C238", true],
  ["πίνακας με αντικείμενο", [up], "1000C238", true], ["πίνακας μεταβλητών", [{ variable: "Lrrid", value: "1000F992" }], "1000F992", false],
  ["χωρίς θέση", { DevEUI_uplink: { Lrrid: "1000AAAA", LrrLAT: "0", LrrLON: "0" } }, "1000AAAA", false],
  ["actility_payload ως κείμενο", [{ variable: "actility_payload", value: JSON.stringify(up) }], "1000C238", true], ["actility_payload ως αντικείμενο", [{ variable: "actility_payload", value: up }], "1000C238", true],
  ["actility_payload σε metadata", [{ variable: "actility_payload", value: "x", metadata: up }], "1000C238", true], ["actility_payload χωρίς wrapper", [{ variable: "actility_payload", value: up.DevEUI_uplink }], "1000C238", true],
  ["actility_payload χωρίς πύλη", [{ variable: "actility_payload", value: JSON.stringify({ DevEUI: "1000ΜΥΣΤΙΚΟ" }) }], null, false],
  ["με λίστα πυλών", [{ variable: "actility_payload", value: JSON.stringify(multi) }], "1000C238", true], ["λίστα ως ένα αντικείμενο", { DevEUI_uplink: { Lrrid: "1000C238", LrrLAT: "35.1", LrrLON: "25.2", Lrrs: { Lrr: { Lrrid: "1000C238", LrrRSSI: -90, LrrSNR: 8 } } } }, "1000C238", true],
  ["άγνωστη μορφή", { foo: 1 }, null, false], ["άγνωστη μορφή με τιμή", { foo: "1000ΜΥΣΤΙΚΟ" }, null, false], ["κενό", null, null, false], ["χαλασμένη συμβολοσειρά", "{oops", null, false], ["αριθμός", 42, null, false],
];
function check(src) {
  const bad = [];
  for (const [label, raw, want, loc] of CASES) {
    let n; try { n = run(src, raw); } catch (e) { bad.push(label + ": ΕΡΙΞΕ ΤΟ UPLINK " + e.message); continue; }
    const o = run(OLD, raw); const rest = n.filter((x) => x.variable !== "lrrid" && x.variable !== "lrr_probe");
    if (JSON.stringify(rest) !== JSON.stringify(o)) bad.push(label + ": άλλαξαν οι μετρήσεις");
    const l = n.filter((x) => x.variable === "lrrid"), p = n.filter((x) => x.variable === "lrr_probe");
    if (want) { if (l.length !== 1 || l[0].value !== want || l[0].time !== T) bad.push(label + ": λάθος lrrid"); if (!!l[0]?.location !== loc) bad.push(label + ": λάθος θέση"); if (p.length) bad.push(label + ": περιττό διαγνωστικό"); }
    else { if (l.length) bad.push(label + ": lrrid χωρίς πηγή"); if (p.length !== 1) bad.push(label + ": λείπει διαγνωστικό"); if (/1000|35\.1/.test(p[0]?.value || "")) bad.push(label + ": τιμή στο διαγνωστικό"); }
  }
  const ml = run(src, multi).find((x) => x.variable === "lrrid");
  if (JSON.stringify(ml?.metadata) !== JSON.stringify({ lrrs: [["1000C238", -90, 8], ["1000F992", -110.5, null]] })) bad.push("λάθος λίστα πυλών " + JSON.stringify(ml?.metadata));
  const so = run(src, { DevEUI_uplink: { Lrrid: "1000C238", Lrrs: { Lrr: { Lrrid: "1000C238", LrrRSSI: -90, LrrSNR: 8 } } } }).find((x) => x.variable === "lrrid");
  if (JSON.stringify(so?.metadata) !== JSON.stringify({ lrrs: [["1000C238", -90, 8]] })) bad.push("χάθηκε η λίστα ενός αντικειμένου");
  const nk = run(src, up).find((x) => x.variable === "lrrid");
  if (!/Lrrid/.test(nk?.metadata?.lrrs_keys || "") || /1000C238|35\.1/.test(JSON.stringify(nk?.metadata))) bad.push("το διαγνωστικό λίστας δεν είναι ονόματα κλειδιών");
  const one = run(src, [{ variable: "Lrrid", value: "1000F992" }]).find((x) => x.variable === "lrrid");
  if (one?.metadata) bad.push("metadata χωρίς πηγή");
  const twice = run(src, up, [...base(), { variable: "lrrid", value: "ΥΠΑΡΧΕΙ", time: T }]); if (twice.filter((x) => x.variable === "lrrid").length !== 1) bad.push("διπλό lrrid");
  // Payload που δεν είναι πίνακας: ο ΑΡΧΙΚΟΣ κώδικας ρίχνει ήδη στο δικό του .filter. Το μπλοκ δεν πρέπει να αλλάζει αυτή τη συμπεριφορά.
  const outcome = (s) => { try { return "ok:" + JSON.stringify(run(s, up, "κείμενο")); } catch (e) { return "throw"; } };
  if (outcome(src) !== outcome(OLD)) bad.push("άλλαξε η συμπεριφορά με payload κείμενο");
  return bad;
}
const r = check(NEW); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : `ΟΚ ${CASES.length} περιπτώσεις`);
const MUT = [["ξεχνά το αντικείμενο Actility", "o.DevEUI_uplink || ", ""], ["χωρίς JSON.parse", "_raw = JSON.parse(_raw);", ""], ["χωρίς φρουρό διπλού", "!payload.some((x) => x && x.variable === 'lrrid')", "true"],
  ["χωρίς try εσωτερικό", "try { _raw = JSON.parse(_raw); } catch (e) { _raw = null; }", "_raw = JSON.parse(_raw);"], ["θέση 0 περνά", " && _la !== 0 && _lo !== 0", ""], ["χάνει την ώρα", "if (_ref) _rec.time = _ref.time;", ""], ["διαγνωστικό με τιμές", "Object.keys(_raw).slice(0, 30).join(',')", "JSON.stringify(_raw)"], ["διαγνωστικό πίνακα με τιμές", "Object.keys(v).slice(0, 12).join(',')", "JSON.stringify(v)"], ["αγνοεί το value", "_pick(_obj(_x.value)) || ", ""], ["αγνοεί το metadata", " || _pick(_obj(_x.metadata))", ""], ["χωρίς ανάγνωση κειμένου", "try { return JSON.parse(v); } catch (e) { return null; }", "return null;"], ["αριθμητικό lrrid", "value: String(_up.Lrrid)", "value: _up"], ["λίστα μόνο ως πίνακας", "(Array.isArray(_lr) ? _lr : (_lr ? [_lr] : []))", "(Array.isArray(_lr) ? _lr : [])"], ["χωρίς φίλτρο εγγραφών", ".filter((x) => x && x.Lrrid)", ""], ["σκουπίδι στο SNR", "Number.isFinite(Number(x.LrrSNR)) ? Number(x.LrrSNR) : null", "x.LrrSNR"], ["διαγνωστικό με τιμές λίστας", "Object.keys(_up).slice(0, 40).join(',').slice(0, 400)", "JSON.stringify(_up)"]];
let killed = 0; for (const [label, a, b] of MUT) { if (!NEW.includes(a)) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ", label); process.exitCode = 1; continue; } let bad; try { bad = check(NEW.replace(a, b)); } catch (e) { bad = ["εξαίρεση"]; } if (bad.length) killed++; else { console.log("ΕΠΕΖΗΣΕ", label); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${killed}/${MUT.length}`);
if (r.length) process.exitCode = 1;
