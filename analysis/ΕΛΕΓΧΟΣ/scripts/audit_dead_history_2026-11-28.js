// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Πόσο «νεκρό» ιστορικό κουβαλάμε: εγγραφές των 24 πεδίων δικτύου του φίλτρου
// SAG_DROP (T-PARSER-SLIM-01) που γράφτηκαν πριν το φίλτρο και μένουν ως τη λήξη της διατήρησης. Το count δέχεται έως 1 μήνα ανά
// ερώτημα, άρα μετρά ανά ημερολογιακό μήνα UTC (~1 εγγραφή Data Output/ερώτημα). LMS01: και τα 24· S2120/SE0X/LSE01/EM320: τα 4 που
// έγραφαν (ismband, lrralt, lrruuid, payloadencryption). Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "DH|"; const T_MAX = 105e3;
const CN = { "67adaf5b": "S2120", "614afaa5": "LMS01", "69293aaf": "LSE01", "685bafd3": "SE0X", "69a84538": "EM320" };
const DROP = ["adrbit", "basestationdata", "customerdxprofileid", "customerrealmid", "devlrrcnt", "downlinkurl", "drivercfg", "fcntdn", "fcntup", "frequency", "ismband", "lostuplinksas", "lrcid", "lrralt", "lrresp", "lrruuid", "mic_hex", "modelcfg", "mtype", "nbtrans", "payloadencryption", "spfact", "subband", "txpower"];
const FEW = ["ismband", "lrralt", "lrruuid", "payloadencryption"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let k = 0; k < 4; k++) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); if (r.status === 429) { await sleep(1500 * (k + 1)); continue; } const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; } throw new Error("429"); }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
const K = (x) => (x / 1e3).toFixed(0) + "k"; const M = (x) => (x / 1e6).toFixed(2) + "M";
(async () => {
  const t0 = Date.now(); console.log(P + "=== " + new Date().toISOString());
  const devs = []; for (let page = 1; page <= 10; page++) { const c = await get(`/device?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=connector&fields[]=chunk_retention`); devs.push(...c); if (c.length < 100) break; }
  const sel = devs.filter((d) => CN[String(d.connector || "").slice(0, 8)]);
  const amt = await pool(sel, 10, (d) => get(`/device/${d.id}/data_amount`).then(Number));
  const big = sel.map((d, k) => ({ d, a: amt[k], g: CN[String(d.connector).slice(0, 8)] })).filter((x) => typeof x.a === "number" && x.a >= 20000);
  const jobs = [];
  for (const x of big) { const R = Number(x.d.chunk_retention) || 12; const vars = x.g === "LMS01" ? DROP : FEW;
    for (let back = 0; back <= R; back++) { const y = 2026, m = 10 - back; const s = new Date(Date.UTC(y, m, 1)), e = new Date(Date.UTC(y, m + 1, 1)); for (const v of vars) jobs.push({ x, v, s, e, mk: s.toISOString().slice(0, 7) }); } }
  let skipped = 0;
  const res = await pool(jobs, 14, async (j) => { if (Date.now() - t0 > T_MAX) { skipped++; return null; } return Number(await get(`/device/${j.x.d.id}/data?query=count&variable=${j.v}&start_date=${j.s.toISOString()}&end_date=${j.e.toISOString()}`)); });
  let errs = 0; const byG = {}, byGM = {}, byGV = {}, byDev = {};
  jobs.forEach((j, k) => { const v = res[k]; if (v == null) return; if (typeof v !== "number") { errs++; return; }
    byG[j.x.g] = (byG[j.x.g] || 0) + v; const gm = j.x.g + "|" + j.mk; byGM[gm] = (byGM[gm] || 0) + v; const gv = j.x.g + "|" + j.v; byGV[gv] = (byGV[gv] || 0) + v;
    const dk = j.x.d.id; byDev[dk] = byDev[dk] || { n: j.x.d.name, g: j.x.g, R: j.x.d.chunk_retention, a: j.x.a, dead: 0 }; byDev[dk].dead += v; });
  console.log(P + "ΕΡΩΤΗΜΑΤΑ|" + jobs.length + "|παραλείφθηκαν " + skipped + "|σφάλματα " + errs + "|" + Math.round((Date.now() - t0) / 1000) + "s");
  console.log(P + "ΣΥΝΟΛΟ_ΝΕΚΡΩΝ|" + M(Object.values(byG).reduce((s, v) => s + v, 0)) + "|" + Object.entries(byG).map(([g, v]) => g + " " + M(v)).join(" · "));
  for (const g of Object.keys(byG)) { console.log(P + "ΜΗΝΕΣ|" + g + "|" + Object.entries(byGM).filter(([k]) => k.startsWith(g + "|")).sort().map(([k, v]) => k.split("|")[1].slice(2) + ":" + K(v)).join(" "));
    console.log(P + "ΜΕΤΑΒΛΗΤΕΣ|" + g + "|" + Object.entries(byGV).filter(([k, v]) => k.startsWith(g + "|") && v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => k.split("|")[1] + "=" + K(v)).join(" ")); }
  for (const d of Object.values(byDev).sort((a, b) => b.dead - a.dead).slice(0, 25)) console.log(P + "ΣΥΣΚ|" + String(d.n).slice(-24) + "|" + d.g + "|διατήρηση " + d.R + "|σύνολο " + K(d.a) + "|νεκρά " + K(d.dead) + " (" + (100 * d.dead / d.a).toFixed(0) + "%)");
  console.log(P + "=== ΤΕΛΟΣ|" + Math.round((Date.now() - t0) / 1000) + "s");
})().catch((e) => console.log(P + "FATAL|" + e.message));
