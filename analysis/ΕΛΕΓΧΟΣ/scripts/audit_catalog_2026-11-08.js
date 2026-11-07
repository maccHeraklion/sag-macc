// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 8/11/2026 · Ο τιμοκατάλογος του «Δημιουργία Προσφοράς» (συσκευή costing, μεταβλητή costing_list, v4 zlib) και οι 2 συσκευές subscriptionConfiguration. Τυπώνει τον κατάλογο σε κομμάτια JSON για μεταφορά στο demo. Δεν γράφει τίποτα. Οι τιμές είναι επιχειρηματικά δεδομένα: η έξοδος ΔΕΝ μπαίνει στο git.
const zlib = require("zlib"); const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G22|"; const DEV = "69aca356e36f78000a64dc57";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const rows = await get(`/device/${DEV}/data?variables[]=costing_list&qty=1`); const m = (rows[0] || {}).metadata || {};
  console.log(P + "ΕΓΓΡΑΦΗ|" + (rows[0] || {}).time + "|value " + (rows[0] || {}).value + "|v " + m.v + "|u " + m.u + "|ic " + m.ic + "|pc " + m.pc + "|κλειδιά " + Object.keys(m).join(","));
  let cat = null;
  if (m.cl) { const buf = Buffer.from(m.cl, "base64"); try { cat = JSON.parse(zlib.inflateSync(buf).toString("utf8")); } catch (e) { try { cat = JSON.parse(zlib.inflateRawSync(buf).toString("utf8")); } catch (e2) { try { cat = JSON.parse(buf.toString("utf8")); } catch (e3) { console.log(P + "ΑΠΟΣΥΜΠΙΕΣΗ ΑΠΕΤΥΧΕ|" + e.message); } } } }
  else if (m.costing_list) cat = typeof m.costing_list === "string" ? JSON.parse(m.costing_list) : m.costing_list;
  if (cat) {
    const head = { v: cat.v, u: cat.u, c: cat.c, ct: cat.ct, in: cat.in, vn: cat.vn, gname: (cat.g || {}).n, vr: (cat.g || {}).vr };
    console.log(P + "HEAD|" + JSON.stringify(head));
    const items = cat.i || []; for (let k = 0; k < items.length; k += 12) console.log(P + "I|" + k + "|" + JSON.stringify(items.slice(k, k + 12).map((x) => Array.isArray(x) ? x.slice(0, 9).map((v, n) => (n === 7 ? undefined : v)) : x)));
    for (const p of cat.pk || []) console.log(P + "PK|" + JSON.stringify(p));
    for (const s of cat.sb || []) console.log(P + "SB|" + JSON.stringify(s));
    console.log(P + "ΠΛΗΘΗ|είδη " + items.length + "|πακέτα " + (cat.pk || []).length + "|συνδρομές " + (cat.sb || []).length);
  }
  const sc = await get(`/device?amount=20&page=1&fields[]=id&fields[]=name&fields[]=tags&filter[tags][0][key]=subscriptionConfiguration&filter[tags][0][value]=yes`);
  for (const d of sc) console.log(P + "SUBCFG|" + d.name + "|" + JSON.stringify((d.tags || []).filter((t) => !/key|token|eui|pass|secret|mail|phone/i.test(t.key)).map((t) => [t.key, String(t.value).slice(0, 300)])));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
