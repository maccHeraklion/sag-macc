// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Η πύλη 10013714 του σταθμού 047e: ποια άλλα όργανα περνούν από αυτήν και αν σίγησαν τις νύχτες που σιώπησε ο 047e. Τυπώνει ονόματα συσκευών, ώρες, πλήθη. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G3|"; const O = "6a98855ca06e41000bfae024"; const CODE = "10013714"; const HOURS = 120, TZ = 2, H = 3600000;
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
function gaps(times, h0, h1) { const hs = new Set(times.map((t) => Math.floor(Date.parse(t) / H))); const out = []; let a = null, miss = 0; for (let t = h0; t <= h1; t += H) { const m = t < h1 && !hs.has(t / H); if (m) miss++; if (m && a === null) a = t; if (!m && a !== null) { if ((t - a) / H >= 3) { const d = new Date(a + TZ * H); out.push(d.getUTCDate() + "/" + String(d.getUTCHours()).padStart(2, "0") + "+" + (t - a) / H + "ω"); } a = null; } } return { miss, list: out.join(" ") || "κανένα" }; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now(), h1 = Math.floor(now / H) * H, h0 = h1 - HOURS * H;
  const rows = await get(`/device/${O}/data?variables[]=gateway_row&qty=60`); const g = rows.find((r) => String(r.value) === CODE);
  console.log(P + "ΚΑΡΤΑ|" + (g ? "κατάσταση " + (g.metadata || {}).state + "|αισθητήρες " + (g.metadata || {}).sensors + "|ηλικία ω " + (g.metadata || {}).age_h + "|rssi " + (g.metadata || {}).rssi + "|θέση " + JSON.stringify((g.metadata || {}).location || null) + "|αγροί " + JSON.stringify(((g.metadata || {}).fields || []).map((x) => x.f + ":" + x.k)) : "καμία κάρτα"));
  const st = await get(`/device/${O}/data?variables[]=gateway_heard_state&qty=1`); const h = ((st[0] || {}).metadata || {}).h || {};
  const keys = Object.keys(h).filter((k) => h[k][CODE] !== undefined); console.log(P + "ΜΝΗΜΗ|όργανα με αυτή την πύλη " + keys.length + "|σύνολο μνήμης " + Object.keys(h).length);
  const devs = []; for (let page = 1; page <= 4; page++) { const c = await get(`/device?amount=200&page=${page}&fields[]=id&fields[]=name&filter[network]=5ede22a7427104001c248b08`); devs.push(...c); if (c.length < 200) break; }
  const ids = devs.filter((d) => keys.includes(String(d.id).slice(-10)) || /_047e$/i.test(d.name));
  for (const d of ids) { const v = /s2120/.test(d.name) ? "air_temperature" : "lrrid"; const r = await get(`/device/${d.id}/data?variables[]=${v}&start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}&qty=3000`); const x = gaps(r.map((z) => z.time), h0, h1); console.log(P + "ΟΡΓΑΝΟ|" + String(d.name).slice(-20) + "|εγγραφές " + r.length + "|κενές ώρες " + x.miss + "/" + HOURS + "|κενά ≥3ω " + x.list); }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
