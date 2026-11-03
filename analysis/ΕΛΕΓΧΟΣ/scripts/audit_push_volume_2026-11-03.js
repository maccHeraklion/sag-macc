// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 3/11/2026 · (1) κύκλος πυρήνα από fleet_summary (2) πόσα push_alert γράφτηκαν τις τελευταίες 30 μέρες, ανά είδος και αγρό.
// Χρειάζεται πριν συνδεθεί Action, λόγω ορίων λογαριασμού (20 push, 200 email τον μήνα). Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "PV|"; const FLEET = "6a98855ca06e41000bfae024";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=2`)) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms);
    }
  } catch (e) { console.log(P + "ERR fleet|" + e.message); }
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const list = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const kinds = {}, per = [], days = {}; let total = 0;
    for (const f of list) {
      const rows = await get(`/device/${f.id}/data?variables=push_alert&qty=1000&start_date=${encodeURIComponent(since)}`).catch(() => []);
      if (!rows.length) continue;
      total += rows.length; const k = {};
      for (const r of rows) { const x = (r.metadata && r.metadata.kind) || "?"; kinds[x] = (kinds[x] || 0) + 1; k[x] = (k[x] || 0) + 1; const d = String(r.time).slice(0, 10); days[d] = (days[d] || 0) + 1; }
      per.push({ n: tag(f, "name") || f.name, c: rows.length, k });
    }
    per.sort((a, b) => b.c - a.c);
    console.log(P + "SUM|σύνολο 30 ημ=" + total + "|αγροί=" + per.length + "/" + list.length + "|είδη=" + JSON.stringify(kinds));
    const dv = Object.values(days); console.log(P + "ΗΜΕΡΕΣ|με ειδοποίηση=" + dv.length + "|μέγιστο/ημέρα=" + Math.max(0, ...dv));
    for (const x of per.slice(0, 12)) console.log(P + "F|" + x.n + "|" + x.c + "|" + JSON.stringify(x.k));
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
