// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Ποιες συσκευές γεμίζουν το 90 % των εγγραφών, πόσο μεγάλωσαν από τις 31/10, με τι διατήρηση. Σύγκριση με τη μέτρηση 31/10 από το δημόσιο repo. Από τις ετικέτες διαβάζει ΜΟΝΟ type. Δεν γράφει τίποτα, δεν διαβάζει δεδομένα συσκευών.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G21|";
const OLD = "https://raw.githubusercontent.com/maccHeraklion/sag-macc/123041d/analysis/%CE%95%CE%9B%CE%95%CE%93%CE%A7%CE%9F%CE%A3/scripts/audit_storage_connectors_2026-10-31.js";
const CN = { "67adaf5b": "S2120", "614afaa5": "LMS01 (Natura)", "69293aaf": "LSE01", "685bafd3": "SE0X", "69a84538": "EM320", "62333bd3": "ξενοδοχείο κ.ά.", "68e2531b": "UC511", "6544c9f1": "UC511 (β)", "5f5a8f33": "αγροί/εικονικές" };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
const M = (x) => (x / 1e6).toFixed(2) + "M";
(async () => {
  const t0 = Date.now(); console.log(P + "=== " + new Date().toISOString());
  let old = {}; try { const txt = await (await fetch(OLD)).text(); old = JSON.parse(txt.match(/const AMT = (\{[^;]*\});/)[1]); } catch (e) { console.log(P + "ΠΑΛΙΑ ΜΕΤΡΗΣΗ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ|" + e.message); }
  const devs = []; for (let page = 1; page <= 10; page++) { const c = await get(`/device?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=connector&fields[]=last_input&fields[]=tags`); devs.push(...c); if (c.length < 100) break; }
  const res = await pool(devs, 8, async (d) => { const [a, info] = await Promise.all([get(`/device/${d.id}/data_amount`), get(`/device/${d.id}`)]); return { a: Number(a) || 0, ty: info.type, ret: info.chunk_retention, per: info.chunk_period }; });
  const by = {}, ret = {}, rows = []; let tot = 0, totOld = 0, totOldSame = 0, err = 0;
  devs.forEach((d, k) => { const r = res[k] || {}; if (r.err) { err++; return; } const c = String(d.connector || "?").slice(0, 8), cn = CN[c] || c, type = ((d.tags || []).find((t) => t.key === "type") || {}).value || "-";
    const o = old[d.id]; tot += r.a; if (o !== undefined) { totOld += o; totOldSame += r.a; }
    const g = by[cn] = by[cn] || { n: 0, a: 0, o: 0, on: 0 }; g.n++; g.a += r.a; if (o !== undefined) { g.o += o; g.on += r.a; }
    const rk = (r.ty || "?") + " " + (r.ret == null ? "-" : r.ret) + " " + (r.per || "-"); const q = ret[rk] = ret[rk] || { n: 0, a: 0 }; q.n++; q.a += r.a;
    rows.push({ n: String(d.name).slice(-26), cn, type, a: r.a, d: o === undefined ? null : r.a - o, ret: r.ret, li: d.last_input ? Math.round((Date.now() - Date.parse(d.last_input)) / 36e5) : null }); });
  console.log(P + "ΣΥΝΟΛΟ|συσκευές " + devs.length + "|σφάλματα " + err + "|εγγραφές " + M(tot) + "|παλιά 31/10 (ίδιες συσκευές) " + M(totOld) + " → " + M(totOldSame));
  for (const [k, g] of Object.entries(by).sort((a, b) => b[1].a - a[1].a)) console.log(P + "CONNECTOR|" + k + "|συσκευές " + g.n + "|" + M(g.a) + "|" + (100 * g.a / tot).toFixed(1) + "%|μεταβολή από 31/10 " + ((g.on - g.o) / 1e3).toFixed(0) + "k");
  for (const [k, q] of Object.entries(ret).sort((a, b) => b[1].a - a[1].a)) console.log(P + "ΔΙΑΤΗΡΗΣΗ|" + k + "|συσκευές " + q.n + "|" + M(q.a));
  const bt = {}; for (const r of rows) { const g = bt[r.type] = bt[r.type] || { n: 0, a: 0, silent: 0, sa: 0 }; g.n++; g.a += r.a; if (r.li == null || r.li > 24 * 30) { g.silent++; g.sa += r.a; } }
  for (const [k, g] of Object.entries(bt).sort((a, b) => b[1].a - a[1].a).slice(0, 18)) console.log(P + "ΤΥΠΟΣ|" + k + "|συσκευές " + g.n + "|" + M(g.a) + "|σιωπηλές >30ημ " + g.silent + " με " + M(g.sa));
  for (const r of rows.sort((a, b) => b.a - a.a).slice(0, 30)) console.log(P + "ΣΥΣΚΕΥΗ|" + r.n + "|" + r.cn + "|" + r.type + "|" + M(r.a) + "|από 31/10 " + (r.d == null ? "νέα" : (r.d / 1e3).toFixed(0) + "k") + "|διατήρηση " + (r.ret == null ? "-" : r.ret) + "|σιωπή ω " + (r.li == null ? "-" : r.li));
  console.log(P + "ΧΡΟΝΟΣ s|" + Math.round((Date.now() - t0) / 1000)); console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
