// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Επαλήθευση v50.167/v50.168 (T-DEPTH1-01/02) μετά τον ωριαίο κύκλο.
// (1) fleet_summary: έκδοση, πόσοι αγροί υπολογίστηκαν, σφάλματα · (2) field_bundle κάθε αγρού: φρεσκάδα, έκδοση, μέγεθος,
// πόσοι έχουν «δηλωμένο ένα βάθος». Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const FLEET = "6a98855ca06e41000bfae024";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "V168|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    const fs = await get(`/device/${FLEET}/data?variables=fleet_summary&qty=2`);
    for (const e of fs) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms);
    }
  } catch (e) { console.log(P + "ERR fleet|" + e.message); }
  try {
    const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    let fresh = 0, stale = 0, none = 0, maxB = 0, d1 = 0; const ver = {};
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
        if (s.includes("δηλωμένο ένα βάθος")) {
          d1++;
          const j = s.indexOf("soil_depth_basis");
          console.log(P + "DEPTH1|" + d.name + "|" + s.slice(j, j + 300));
        }
      } catch (_e) {}
    }
    console.log(P + "FIELDS|αγροί=" + devs.length + "|φρέσκα=" + fresh + "|μπαγιάτικα=" + stale + "|χωρίς bundle=" + none + "|εκδόσεις=" + JSON.stringify(ver).replace(/"/g, "") + "|μέγιστο bundle=" + maxB + "|ένα βάθος=" + d1);
  } catch (e) { console.log(P + "ERR fields|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
