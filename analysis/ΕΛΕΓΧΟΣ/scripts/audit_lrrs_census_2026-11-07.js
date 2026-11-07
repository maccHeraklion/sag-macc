// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Απογραφή για T-GWMAP-07: σόνδες και αισθητήρες φύλλου, connector, parser συσκευής, ποιοι έχουν lrrid, ποιοι είναι ξενοδοχείο ή βάνα. Τυπώνει μόνο πλήθη. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "LC7|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tv = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const TYPES = ["se0x", "lse01", "lse02", "lms01_ls"];
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields[]=id&fields[]=name&fields[]=tags");
  const owner = {}; const hotel = {};
  for (const f of fields) { const c = String(tv(f, "clientName") || ""); let ids = []; try { ids = Object.values(JSON.parse(String(tv(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tv(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; } for (const id of ids) { (owner[id] = owner[id] || new Set()).add(c); if (/volta/i.test(c) || /βολτα|volta|Διαμον/i.test(c)) hotel[id] = 1; } }
  const out = {};
  for (const t of TYPES) {
    const list = await get(`/device?filter[tags][0][key]=type&filter[tags][0][value]=${t}&amount=200&fields[]=id&fields[]=name&fields[]=connector&fields[]=last_input`);
    for (const d of list) {
      const k = t + "|" + String(d.connector).slice(-6); const b = out[k] || (out[k] = { n: 0, field: 0, hotel: 0, silent: 0, lrr: 0, parser: 0, slim: 0, own: 0, lens: {} }); b.n++;
      if (owner[d.id]) b.field++; if (hotel[d.id]) b.hotel++;
      const age = d.last_input ? (Date.now() - Date.parse(d.last_input)) / 36e5 : Infinity; if (age > 48) b.silent++;
      try { const x = await get(`/device/${d.id}`); const v = x.payload_decoder; const s = v && v.data ? Buffer.from(v.data).toString("utf8") : String(v || ""); const c = /^[A-Za-z0-9+/=\s]+$/.test(s) ? Buffer.from(s, "base64").toString("utf8") : s; if (c.trim()) { b.parser++; if (c.includes("T-PARSER-SLIM-01")) b.slim++; else b.own++; b.lens[c.length] = (b.lens[c.length] || 0) + 1; } } catch (e) { /* επόμενη */ }
      try { const r = await get(`/device/${d.id}/data?variables[]=lrrid&qty=1`); if (r.length) b.lrr++; } catch (e) { /* επόμενη */ }
    }
  }
  for (const [k, b] of Object.entries(out)) console.log(P + k + "|συσκευές " + b.n + "|σε αγρό " + b.field + "|ξενοδοχείο " + b.hotel + "|σιωπηλές >48ω " + b.silent + "|με lrrid " + b.lrr + "|με parser συσκευής " + b.parser + " (φίλτρο " + b.slim + ", άλλος " + b.own + ")|μήκη " + JSON.stringify(b.lens));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
