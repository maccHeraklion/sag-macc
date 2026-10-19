// SAG — T-GWID-03 · ΑΛΛΑΓΗ ΚΩΔΙΚΑ CONNECTORS SE0X + SE01 ΑΠΟ ΤΟ PROBE · 19/10/2026 (μετά την επιτυχία στον SE02, 17:28 UTC)
// Εντολή Μιχάλη: «ναι προχώρα και στους SE0X και SE01». Ίδιο μπλοκ, ίδιες ασφαλίσεις, ΧΩΡΙΣΤΑ ανά connector.
// ΑΣΦΑΛΙΣΕΙΣ: (1) αλλάζει ΜΟΝΟ τους 2 connectors του TARGETS· (2) προχωρά ΜΟΝΟ αν ο ζωντανός = old16 (repo 691ca6b)·
// (3) βάζει το μπλοκ ακριβώς πριν από τη ΜΟΝΑΔΙΚΗ `const ignore_vars = [`, με το ίδιο τέλος γραμμής που έχει ο ζωντανός·
// (4) ο νέος πρέπει να βγάζει new16 (= repo) ΚΑΙ να περνά έλεγχο σύνταξης ΠΡΙΝ σταλεί·
// (5) μετά το PUT ξαναδιαβάζεται και πρέπει να είναι new16· αλλιώς ΕΠΑΝΑΦΟΡΑ του αρχικού κώδικα αυτόματα.
// Αν ο ΠΡΩΤΟΣ αποτύχει με οποιονδήποτε τρόπο, ο ΔΕΥΤΕΡΟΣ ΔΕΝ αγγίζεται.
// DRY = true: μόνο έλεγχοι, ΤΙΠΟΤΑ δεν γράφεται.
const crypto = require("crypto");
const vm = require("vm");
const DRY = true;
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const TARGETS = [
  { id: "685bafd351843b000ad23a36", label: "SE0X", old16: "cc12d6cf4a7130b9", new16: "b52aba54da662540" },
  { id: "69293aaf4da767000a1cc2f1", label: "SE01", old16: "996ae048dbe84e76", new16: "dd6b1ed22d612fcf" },
];
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
const sha16 = (s) => crypto.createHash("sha256").update(s.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"), "utf8").digest("hex").slice(0, 16);
async function api(p, opts = {}) {
  const r = await fetch(API + p, { ...opts, headers: { Authorization: TOKEN, "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(p.slice(0, 70) + " -> " + JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}
const read = async (CONNECTOR) => {
  const k = await api(`/integration/connector/${CONNECTOR}?fields[]=name&fields[]=payload_decoder`);
  return { name: k.name, b64: String(k.payload_decoder || ""), code: Buffer.from(String(k.payload_decoder || ""), "base64").toString("utf8") };
};
const put = (CONNECTOR, code) => api(`/integration/connector/${CONNECTOR}`, { method: "PUT", body: JSON.stringify({ payload_decoder: Buffer.from(code, "utf8").toString("base64") }) });
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
async function one(t) {
  const before = await read(t.id);
  const h0 = sha16(before.code);
  console.log(`ΕΦ|${t.label}|ΠΡΙΝ|${before.name}|sha=${h0}|bytes=${before.code.length}|crlf=${before.code.includes("\r\n")}`);
  if (h0 !== t.old16) { console.log(`ΕΦ|${t.label}|ΣΤΑΜΑΤΑ|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος ${t.old16} — καμία αλλαγή`); return false; }
  const next = build(before.code);
  const h1 = sha16(next);
  try { new vm.Script(next); } catch (e) { console.log(`ΕΦ|${t.label}|ΣΤΑΜΑΤΑ|συντακτικό σφάλμα: ` + e.message); return false; }
  console.log(`ΕΦ|${t.label}|ΝΕΟΣ|sha=${h1}|αναμενόμενος=${t.new16}|${h1 === t.new16 ? "ΤΑΥΤΙΖΕΤΑΙ" : "ΔΙΑΦΕΡΕΙ"}`);
  if (h1 !== t.new16) { console.log(`ΕΦ|${t.label}|ΣΤΑΜΑΤΑ|ο νέος δεν ταυτίζεται με το repo — καμία αλλαγή`); return false; }
  if (DRY) { console.log(`ΕΦ|${t.label}|DRY|όλοι οι έλεγχοι πέρασαν — ΤΙΠΟΤΑ δεν γράφτηκε`); return true; }
  await put(t.id, next);
  const after = await read(t.id);
  const h2 = sha16(after.code);
  if (h2 === t.new16) { console.log(`ΕΦ|${t.label}|ΟΚ|ζωντανός τώρα sha=${h2} = repo`); return true; }
  console.log(`ΕΦ|${t.label}|ΛΑΘΟΣ|μετά το PUT sha=${h2} — ΕΠΑΝΑΦΟΡΑ`);
  await put(t.id, before.code);
  const back = await read(t.id);
  console.log(`ΕΦ|${t.label}|ΕΠΑΝΑΦΟΡΑ|sha=${sha16(back.code)}|${sha16(back.code) === t.old16 ? "ΟΚ, όπως πριν" : "!!! ΑΠΑΙΤΕΙΤΑΙ ΧΕΙΡΟΚΙΝΗΤΟΣ ΕΛΕΓΧΟΣ"}`);
  return false;
}
if (require.main === module || process.env.T_ANALYSIS_TOKEN) (async () => {
  console.log("ΕΦ|== " + new Date().toISOString() + " · DRY=" + DRY);
  for (const t of TARGETS) {
    let ok = false;
    try { ok = await one(t); } catch (e) { console.log(`ΕΦ|${t.label}|ΣΦΑΛΜΑ|` + e.message); }
    if (!ok) { console.log("ΕΦ|ΔΙΑΚΟΠΗ|οι υπόλοιποι connectors ΔΕΝ αγγίζονται"); break; }
  }
  console.log("ΕΦ|== ΤΕΛΟΣ");
})();
