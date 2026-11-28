// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Ημερήσιο πλήθος εγγραφών (query=count, ~1 εγγραφή Data Output ανά ερώτημα)
// 20/10–28/11 για 4 συσκευές που άλλαξαν απότομα τον Νοέμβριο: ξενοδοχείο (Volta Aggregator), S2120 0023, 00d8, 00c5.
// Δεν διαβάζει τιμές, δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G28D|";
const DEV = { "6a101c71fa9771000cd901bf": "Volta Aggregator", "681315a0ed3243000a85e3c2": "s2120_0023", "6971054abb3d630010741e09": "s2120_00d8", "69aed3c9962d2c00097b621f": "s2120_00c5" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let k = 0; k < 4; k++) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); if (r.status === 429) { await sleep(1500 * (k + 1)); continue; } const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; } throw new Error("429"); }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const D0 = Date.UTC(2026, 9, 20), days = Math.ceil((Date.now() - D0) / 864e5); const jobs = [];
  for (const id of Object.keys(DEV)) for (let d = 0; d < days; d++) jobs.push({ id, d });
  const res = await pool(jobs, 10, ({ id, d }) => { const s = new Date(D0 + d * 864e5).toISOString(), e = new Date(D0 + (d + 1) * 864e5).toISOString(); return get(`/device/${id}/data?query=count&start_date=${s}&end_date=${e}`).then(Number); });
  for (const id of Object.keys(DEV)) { const row = []; jobs.forEach((j, k) => { if (j.id === id) row.push(new Date(D0 + j.d * 864e5).toISOString().slice(5, 10) + ":" + (typeof res[k] === "number" ? res[k] : "E")); });
    const info = await get(`/device/${id}`).catch(() => ({})); console.log(P + DEV[id] + "|last_input " + info.last_input + "|" + row.join(" ")); }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
