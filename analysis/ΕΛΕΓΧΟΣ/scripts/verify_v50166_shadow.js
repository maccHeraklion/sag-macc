// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Επαλήθευση v50.166 μετά τον πρώτο ωριαίο κύκλο (31/10/2026 08:21 UTC).
// (1) fleet_summary: έκδοση, πόσοι αγροί υπολογίστηκαν, σφάλματα · (2) sag_shadow_hourly: τμήματα, εγγραφές, δείγμα
// (3) field_bundle κάθε αγρού: φρεσκάδα, έκδοση, μέγεθος, κείμενο άρδευσης. Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const FLEET = "6a98855ca06e41000bfae024";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "V166|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    const fs = await get(`/device/${FLEET}/data?variables=fleet_summary&qty=2`);
    for (const e of fs) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms + "|tick=" + JSON.stringify(m.tick));
    }
  } catch (e) { console.log(P + "ERR fleet|" + e.message); }
  try {
    const sh = await get(`/device/${FLEET}/data?variables=sag_shadow_hourly&qty=10`);
    console.log(P + "SHADOW|εγγραφές=" + sh.length);
    let all = [];
    for (const e of sh) {
      const m = e.metadata || {};
      try {
        const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(m.z), "base64")).toString("utf8"));
        console.log(P + "SHADOW_PART|" + e.time + "|p=" + o.p + "/" + o.of + "|k=" + o.k + "|r=" + o.r.length + "|zlen=" + String(m.z).length);
        if (o.t === (sh[0].metadata || {}).t) all = all.concat(o.r);
      } catch (err) { console.log(P + "SHADOW_ERR|" + err.message); }
    }
    const big = all.map((x) => { const d = (a) => a ? Math.abs(a[0] - a[1]) : 0; return { ...x, dm: Math.max(d(x.m1), d(x.m2)), de: Math.max(d(x.e1), d(x.e2)) }; });
    console.log(P + "SHADOW_SUM|αισθητήρες=" + all.length + "|με_EC=" + all.filter((x) => x.e1 || x.e2).length + "|ηλικία_μέγ=" + Math.max(...all.map((x) => x.a)) + "΄");
    for (const x of big.sort((a, b) => b.dm - a.dm).slice(0, 5)) console.log(P + "SH_TOPθ|" + x.f + "|" + x.d + "|a=" + x.a + "|m1=" + JSON.stringify(x.m1) + "|m2=" + JSON.stringify(x.m2));
    for (const x of big.sort((a, b) => b.de - a.de).slice(0, 5)) console.log(P + "SH_TOPEC|" + x.f + "|" + x.d + "|e1=" + JSON.stringify(x.e1) + "|e2=" + JSON.stringify(x.e2));
    const g = all.find((x) => /ΓΡΙΝΙΑΡΑΚΗΣ/.test(x.f)); if (g) console.log(P + "SH_GRIN|" + JSON.stringify(g));
  } catch (e) { console.log(P + "ERR shadow|" + e.message); }
  try {
    const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    let fresh = 0, stale = 0, none = 0, maxB = 0; const ver = {};
    for (const d of devs) {
      try {
        const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
        const e = Array.isArray(b) && b[0]; if (!e) { none++; continue; }
        const age = (Date.now() - Date.parse(e.time)) / 60000;
        if (age > 75) { stale++; continue; }
        fresh++;
        const sz = String(e.metadata.data).length; if (sz > maxB) maxB = sz;
        const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
        const s = JSON.stringify(o); const m = s.match(/v50\.\d+ · \d{4}-\d\d-\d\d/); const v = m ? m[0] : "?"; ver[v] = (ver[v] || 0) + 1;
      } catch (_e) {}
    }
    console.log(P + "FIELDS|αγροί=" + devs.length + "|φρέσκα=" + fresh + "|μπαγιάτικα=" + stale + "|χωρίς bundle=" + none + "|εκδόσεις=" + JSON.stringify(ver) + "|μέγιστο bundle=" + maxB);
  } catch (e) { console.log(P + "ERR fields|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
