// SAG — T-GWID-03 · ΑΛΛΑΓΗ ΚΩΔΙΚΑ CONNECTOR SE02 ΑΠΟ ΤΟ PROBE (αντί για χειροκίνητη επικόλληση) · 19/10/2026
// Εντολή Μιχάλη: «κάνε το εσύ να μη γίνουν λάθη, πάρε όση πρόσβαση θες».
// ΑΣΦΑΛΙΣΕΙΣ: (1) αλλάζει ΜΟΝΟ τον connector 67adaadd· (2) προχωρά ΜΟΝΟ αν ο ζωντανός κώδικας = 75917c86… (repo 691ca6b)·
// (3) βάζει το μπλοκ ακριβώς πριν από τη ΜΟΝΑΔΙΚΗ `const ignore_vars = [`, με το ίδιο τέλος γραμμής που έχει ο ζωντανός·
// (4) ο νέος κώδικας πρέπει να βγάζει sha 68ca97c9… (repo 60da35c) ΚΑΙ να περνά έλεγχο σύνταξης ΠΡΙΝ σταλεί·
// (5) μετά το PUT ξαναδιαβάζεται και πρέπει να είναι 68ca97c9…· αλλιώς ΕΠΑΝΑΦΟΡΑ του αρχικού κώδικα αυτόματα.
// DRY = true: μόνο έλεγχοι, ΤΙΠΟΤΑ δεν γράφεται.
const crypto = require("crypto");
const vm = require("vm");
const DRY = false;   // πρόβα 17:04 UTC πέρασε· ρητή έγκριση Μιχάλη: «εγκρίνω την αλλαγή του SE02 στην παραγωγή»
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const CONNECTOR = "67adaadd576be9000ab220a6";
const OLD16 = "75917c86626e776f", NEW16 = "68ca97c9297cb17f";
const BLOCK = [
  "// T-GWID-03: η θέση του gateway (lrrlat/lrrlon) μπαίνει ΠΑΝΩ στην εγγραφή lrrid — καμία νέα εγγραφή.",
  "const _sagGwId = payload.find(x => x.variable === 'lrrid');",
  "const _sagGwLat = payload.find(x => x.variable === 'lrrlat');",
  "const _sagGwLon = payload.find(x => x.variable === 'lrrlon');",
  "if (_sagGwId && _sagGwLat && _sagGwLon) {",
  "  const la = Number(_sagGwLat.value), lo = Number(_sagGwLon.value);",
  "  if (Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0)) _sagGwId.location = { lat: la, lng: lo };",
  "}",
];
const sha16 = (s) => crypto.createHash("sha256").update(s.replace(/^﻿/, "").replace(/\r\n/g, "\n"), "utf8").digest("hex").slice(0, 16);
async function api(p, opts = {}) {
  const r = await fetch(API + p, { ...opts, headers: { Authorization: TOKEN, "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(p.slice(0, 70) + " -> " + JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}
const read = async () => {
  const k = await api(`/integration/connector/${CONNECTOR}?fields[]=name&fields[]=payload_decoder`);
  return { name: k.name, b64: String(k.payload_decoder || ""), code: Buffer.from(String(k.payload_decoder || ""), "base64").toString("utf8") };
};
const put = (code) => api(`/integration/connector/${CONNECTOR}`, { method: "PUT", body: JSON.stringify({ payload_decoder: Buffer.from(code, "utf8").toString("base64") }) });
function build(code) {
  const eol = code.includes("\r\n") ? "\r\n" : "\n";
  const anchor = "const ignore_vars = [";
  if (code.split(anchor).length !== 2) throw new Error("η δήλωση ignore_vars δεν είναι ακριβώς μία");
  if (code.includes("_sagGw")) throw new Error("το μπλοκ υπάρχει ήδη");
  const i = code.indexOf(anchor);
  if (i !== 0 && code[i - 1] !== "\n") throw new Error("η δήλωση δεν είναι σε αρχή γραμμής");
  return code.slice(0, i) + BLOCK.join(eol) + eol + code.slice(i);
}
module.exports = { build, sha16, BLOCK };
if (require.main === module || process.env.T_ANALYSIS_TOKEN) (async () => {
  console.log("ΕΦ|== " + new Date().toISOString() + " · DRY=" + DRY);
  const before = await read();
  const h0 = sha16(before.code);
  console.log(`ΕΦ|ΠΡΙΝ|${before.name}|sha=${h0}|bytes=${before.code.length}|crlf=${before.code.includes("\r\n")}`);
  if (h0 !== OLD16) { console.log(`ΕΦ|ΣΤΑΜΑΤΑ|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος ${OLD16} — καμία αλλαγή`); return; }
  const next = build(before.code);
  const h1 = sha16(next);
  try { new vm.Script(next); } catch (e) { console.log("ΕΦ|ΣΤΑΜΑΤΑ|συντακτικό σφάλμα: " + e.message); return; }
  console.log(`ΕΦ|ΝΕΟΣ|sha=${h1}|αναμενόμενος=${NEW16}|${h1 === NEW16 ? "ΤΑΥΤΙΖΕΤΑΙ" : "ΔΙΑΦΕΡΕΙ"}`);
  if (h1 !== NEW16) { console.log("ΕΦ|ΣΤΑΜΑΤΑ|ο νέος δεν ταυτίζεται με το repo — καμία αλλαγή"); return; }
  if (DRY) { console.log("ΕΦ|DRY|όλοι οι έλεγχοι πέρασαν — ΤΙΠΟΤΑ δεν γράφτηκε"); return; }
  await put(next);
  const after = await read();
  const h2 = sha16(after.code);
  if (h2 === NEW16) { console.log(`ΕΦ|ΟΚ|ζωντανός τώρα sha=${h2} = repo 60da35c`); return; }
  console.log(`ΕΦ|ΛΑΘΟΣ|μετά το PUT sha=${h2} — ΕΠΑΝΑΦΟΡΑ`);
  await put(before.code);
  const back = await read();
  console.log(`ΕΦ|ΕΠΑΝΑΦΟΡΑ|sha=${sha16(back.code)}|${sha16(back.code) === OLD16 ? "ΟΚ, όπως πριν" : "!!! ΑΠΑΙΤΕΙΤΑΙ ΧΕΙΡΟΚΙΝΗΤΟΣ ΕΛΕΓΧΟΣ"}`);
})().catch((e) => console.log("ΕΦ|ΣΦΑΛΜΑ|" + e.message));
