// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Χώρος εγγραφών 92,7 %: πού είναι, πόσο μεγαλώνει, και πόσα θα σβήσει
// ΜΟΝΗ της η διατήρηση (chunk retention) την 1/12 00:00 UTC. Το token της ανάλυσης δεν βλέπει τα chunks (Authorization denied),
// άρα μετρά εγγραφές ανά ημερολογιακό μήνα UTC με query=count (κοστίζει ~1 εγγραφή Data Output ανά ερώτημα, όχι όσες μετρά).
// Μόνο για συσκευές με ≥ MIN εγγραφές. Δεν διαβάζει τιμές μετρήσεων, δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G28|"; const MIN = 20000; const T_MAX = 100e3;
const CN = { "67adaf5b": "S2120", "614afaa5": "LMS01", "69293aaf": "LSE01", "685bafd3": "SE0X", "69a84538": "EM320", "62333bd3": "ξενοδ.", "68e2531b": "UC511", "6544c9f1": "UC511β", "5f5a8f33": "αγροί" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let k = 0; k < 4; k++) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); if (r.status === 429) { await sleep(1500 * (k + 1)); continue; } const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; } throw new Error("429"); }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
const K = (x) => (x / 1e3).toFixed(0) + "k"; const M = (x) => (x / 1e6).toFixed(2) + "M";
const MONTHS = []; for (let k = 0; k < 23; k++) MONTHS.push([2025 + Math.floor(k / 12), k % 12]); // 2025-01 … 2026-11
const mk = ([y, m]) => y + "-" + String(m + 1).padStart(2, "0");
const iso = (y, m) => new Date(Date.UTC(y, m, 1)).toISOString();
(async () => {
  const t0 = Date.now(); console.log(P + "=== " + new Date().toISOString() + "|μήνες " + mk(MONTHS[0]) + "…" + mk(MONTHS[MONTHS.length - 1]));
  const devs = []; for (let page = 1; page <= 10; page++) { const c = await get(`/device?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=connector&fields[]=last_input&fields[]=tags&fields[]=type&fields[]=chunk_period&fields[]=chunk_retention&fields[]=data_retention`); devs.push(...c); if (c.length < 100) break; }
  console.log(P + "ΔΕΙΓΜΑ_ΠΕΔΙΩΝ|" + JSON.stringify(Object.fromEntries(Object.entries(devs[0] || {}).filter(([k]) => k !== "tags"))).slice(0, 300));
  const amt = await pool(devs, 10, (d) => get(`/device/${d.id}/data_amount`).then(Number));
  const big = devs.map((d, k) => ({ d, a: amt[k] })).filter((x) => typeof x.a === "number" && x.a >= MIN);
  const jobs = []; for (const x of big) for (let i = 0; i < MONTHS.length; i++) jobs.push({ x, i });
  let skipped = 0;
  const cnt = await pool(jobs, 12, async ({ x, i }) => { if (Date.now() - t0 > T_MAX) { skipped++; return null; } const [y, m] = MONTHS[i]; const n = m === 11 ? [y + 1, 0] : [y, m + 1]; return Number(await get(`/device/${x.d.id}/data?query=count&start_date=${iso(y, m)}&end_date=${iso(n[0], n[1])}`)); });
  jobs.forEach((j, k) => { (j.x.mon = j.x.mon || new Array(MONTHS.length).fill(null))[j.i] = typeof cnt[k] === "number" ? cnt[k] : null; });
  console.log(P + "ΧΡΟΝΟΣ s|" + Math.round((Date.now() - t0) / 1000) + "|συσκευές " + devs.length + "|μετρήθηκαν " + big.length + " (≥" + K(MIN) + ")|ερωτήματα " + jobs.length + "|παραλείφθηκαν " + skipped + "|σφάλματα " + cnt.filter((c) => c && c.err).length);
  const tot = amt.reduce((s, a) => s + (Number(a) || 0), 0), totBig = big.reduce((s, x) => s + x.a, 0);
  console.log(P + "ΣΥΝΟΛΟ|" + M(tot) + "|στις μετρημένες " + M(totBig));
  const grp = (x) => { const c = String(x.d.connector || "?").slice(0, 8); return CN[c] || c; };
  const ret = (x) => (x.d.chunk_period || "?") + "/" + (x.d.chunk_retention == null ? "?" : x.d.chunk_retention) + "/" + (x.d.data_retention || "?");
  const agg = (keyFn) => { const o = {}; for (const x of big) { const k = keyFn(x); const g = o[k] = o[k] || { n: 0, a: 0, mon: new Array(MONTHS.length).fill(0), sumMon: 0 }; g.n++; g.a += x.a; (x.mon || []).forEach((v, i) => { if (v != null) { g.mon[i] += v; g.sumMon += v; } }); } return o; };
  const line = (tag, k, g) => console.log(P + tag + "|" + k + "|" + g.n + "|" + M(g.a) + "|Σμηνών " + M(g.sumMon) + "|" + MONTHS.map((mm, i) => mk(mm).slice(2) + ":" + K(g.mon[i])).join(" "));
  line("ΜΗΝΕΣ_ΟΛΟΙ", "όλοι", Object.values(agg(() => "x"))[0]);
  for (const [k, g] of Object.entries(agg(grp)).sort((a, b) => b[1].a - a[1].a)) line("ΜΗΝΕΣ_CONN", k, g);
  for (const [k, g] of Object.entries(agg(ret)).sort((a, b) => b[1].a - a[1].a)) line("ΜΗΝΕΣ_ΔΙΑΤ", k, g);
  for (const x of big.sort((a, b) => b.a - a.a).slice(0, 45)) { const ty = ((x.d.tags || []).find((t) => t.key === "type") || {}).value || "-"; const li = x.d.last_input ? Math.round((Date.now() - Date.parse(x.d.last_input)) / 864e5) : "-";
    console.log(P + "ΣΥΣΚ|" + x.d.id + "|" + String(x.d.name).slice(-24) + "|" + grp(x) + "|" + ty + "|" + K(x.a) + "|" + ret(x) + "|σιωπή " + li + "|" + (x.mon || []).map((v) => (v == null ? "?" : Math.round(v / 1e3))).join(",")); }
  console.log(P + "=== ΤΕΛΟΣ|" + Math.round((Date.now() - t0) / 1000) + "s");
})().catch((e) => console.log(P + "FATAL|" + e.message));
