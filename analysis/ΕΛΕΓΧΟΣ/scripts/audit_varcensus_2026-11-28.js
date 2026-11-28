// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Απογραφή μεταβλητών για κέρδος χώρου.
// Σημ. 28/11: τα «συνολικά αποθηκευμένα» απέτυχαν (το count δέχεται έως 1 μήνα) — αντικαταστάθηκαν από audit_dead_history_2026-11-28.js.
// Για κάθε συσκευή με ≥ MIN εγγραφές: (α) ποιες μεταβλητές γράφονται τώρα (ωμά δεδομένα 3 ωρών, ≤ 400 εγγραφές), (β) πλήθος ανά
// μεταβλητή από 8/11 00:00 UTC (μετά το φίλτρο parser 7/11) και συνολικά αποθηκευμένο, με query=count (~1 εγγραφή Data Output/ερώτημα).
// Οι 24 μεταβλητές του φίλτρου (SAG_DROP) μετρώνται πάντα, για να φανεί πόσο νεκρό ιστορικό κουβαλάμε. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "VC28|"; const MIN = 20000; const T_MAX = 105e3;
const CN = { "67adaf5b": "S2120", "614afaa5": "LMS01", "69293aaf": "LSE01", "685bafd3": "SE0X", "69a84538": "EM320", "62333bd3": "ξενοδ.", "68e2531b": "UC511", "6544c9f1": "UC511β", "5f5a8f33": "αγροί" };
const DROP = ["adrbit", "basestationdata", "customerdxprofileid", "customerrealmid", "devlrrcnt", "downlinkurl", "drivercfg", "fcntdn", "fcntup", "frequency", "ismband", "lostuplinksas", "lrcid", "lrralt", "lrresp", "lrruuid", "mic_hex", "modelcfg", "mtype", "nbtrans", "payloadencryption", "spfact", "subband", "txpower"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let k = 0; k < 4; k++) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); if (r.status === 429) { await sleep(1500 * (k + 1)); continue; } const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; } throw new Error("429"); }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
const K = (x) => (x / 1e3).toFixed(0) + "k"; const M = (x) => (x / 1e6).toFixed(2) + "M";
(async () => {
  const t0 = Date.now(), now = new Date(); const S8 = "2026-11-08T00:00:00.000Z"; const days8 = (Date.now() - Date.parse(S8)) / 864e5;
  console.log(P + "=== " + now.toISOString());
  const devs = []; for (let page = 1; page <= 10; page++) { const c = await get(`/device?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=connector&fields[]=tags&fields[]=chunk_retention`); devs.push(...c); if (c.length < 100) break; }
  const amt = await pool(devs, 10, (d) => get(`/device/${d.id}/data_amount`).then(Number));
  const big = devs.map((d, k) => ({ d, a: amt[k] })).filter((x) => typeof x.a === "number" && x.a >= MIN);
  const s3 = new Date(Date.now() - 3 * 36e5).toISOString();
  const raw = await pool(big, 10, (x) => get(`/device/${x.d.id}/data?start_date=${s3}&qty=400`));
  let rawN = 0; big.forEach((x, k) => { const r = Array.isArray(raw[k]) ? raw[k] : []; rawN += r.length; x.live = [...new Set(r.map((e) => e.variable))]; x.pk = new Set(r.map((e) => String(e.time).slice(0, 19))).size; x.rawN = r.length; });
  console.log(P + "ΩΜΑ_3ω|συσκευές " + big.length + "|εγγραφές " + rawN + "|χρόνος " + Math.round((Date.now() - t0) / 1000) + "s");
  const jobs = []; for (const x of big) for (const v of new Set([...x.live, ...DROP])) { jobs.push({ x, v, w: "since" }); jobs.push({ x, v, w: "all" }); }
  let skipped = 0;
  const res = await pool(jobs, 14, async (j) => { if (Date.now() - t0 > T_MAX) { skipped++; return null; } const q = j.w === "since" ? `&start_date=${S8}` : `&start_date=2024-01-01T00:00:00.000Z`; return Number(await get(`/device/${j.x.d.id}/data?query=count&variable=${encodeURIComponent(j.v)}${q}&end_date=${now.toISOString()}`)); });
  const agg = {}; let errs = 0;
  jobs.forEach((j, k) => { const v = res[k]; if (v == null) return; if (typeof v !== "number") { errs++; return; } const c = String(j.x.d.connector || "?").slice(0, 8), g = CN[c] || c; const key = g + "|" + j.v; const o = agg[key] = agg[key] || { g, v: j.v, since: 0, all: 0, dev: new Set(), drop: DROP.includes(j.v) }; o[j.w] += v; if (v > 0) o.dev.add(j.x.d.id); });
  console.log(P + "ΕΡΩΤΗΜΑΤΑ|" + jobs.length + "|παραλείφθηκαν " + skipped + "|σφάλματα " + errs + "|χρόνος " + Math.round((Date.now() - t0) / 1000) + "s|ημέρες από 8/11 " + days8.toFixed(2));
  const rows = Object.values(agg); const tAll = rows.reduce((s, o) => s + o.all, 0), tDropAll = rows.filter((o) => o.drop).reduce((s, o) => s + o.all, 0), tDropNow = rows.filter((o) => o.drop).reduce((s, o) => s + o.since, 0);
  console.log(P + "ΣΥΝΟΛΑ|αθροισμένα αποθηκευμένα " + M(tAll) + "|SAG_DROP αποθηκευμένα " + M(tDropAll) + "|SAG_DROP από 8/11 " + K(tDropNow));
  const groups = {}; for (const o of rows) (groups[o.g] = groups[o.g] || []).push(o);
  for (const [g, list] of Object.entries(groups).sort((a, b) => b[1].reduce((s, o) => s + o.all, 0) - a[1].reduce((s, o) => s + o.all, 0))) {
    const live = list.filter((o) => o.since > 0).sort((a, b) => b.since - a.since); const ga = list.reduce((s, o) => s + o.all, 0), gd = list.filter((o) => o.drop).reduce((s, o) => s + o.all, 0);
    console.log(P + "ΟΜΑΔΑ|" + g + "|αποθηκευμένα " + M(ga) + "|από αυτά SAG_DROP " + M(gd) + "|ρυθμός/ημ " + K(live.reduce((s, o) => s + o.since, 0) / days8));
    console.log(P + "ΤΩΡΑ|" + g + "|" + live.map((o) => o.v + (o.drop ? "*" : "") + "=" + Math.round(o.since / days8) + "/" + o.dev.size).join(" "));
    const dead = list.filter((o) => o.drop && o.all > 0).sort((a, b) => b.all - a.all); console.log(P + "ΝΕΚΡΑ|" + g + "|" + dead.map((o) => o.v + "=" + K(o.all)).join(" "));
  }
  const samples = {}; for (const x of big) { const c = String(x.d.connector || "?").slice(0, 8), g = CN[c] || c; if (!samples[g] && x.pk > 0) samples[g] = x; }
  for (const [g, x] of Object.entries(samples)) console.log(P + "ΠΑΚΕΤΟ|" + g + "|" + String(x.d.name).slice(-22) + "|πακέτα3ω " + x.pk + "|εγγραφές/πακέτο " + (x.rawN / x.pk).toFixed(1) + "|" + x.live.join(","));
  console.log(P + "=== ΤΕΛΟΣ|" + Math.round((Date.now() - t0) / 1000) + "s");
})().catch((e) => console.log(P + "FATAL|" + e.message));
