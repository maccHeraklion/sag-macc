// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · επαλήθευση v50.162 (T-SUBSTRATE-01): έκδοση + φρεσκάδα σε ΚΑΘΕ αγρό·
// ΚΑΝΕΝΑΣ αγρός δεν βγάζει κείμενα υποστρώματος (κανείς δεν έχει δηλώσει coir)· οι κάρτες άρδευσης/αλατότητας/ορίων
// υγρασίας βγαίνουν όπως πριν· μέγεθος bundle. Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const unpack = (e) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
(async () => {
  console.log("ΥΥ7=== ΕΠΑΛΗΘΕΥΣΗ v50.162 · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const ver = {}; let fresh = 0, none = 0, old = 0, subTxt = 0, irr = 0, lim = 0, ecst = 0, maxB = 0, maxN = "", coirCfg = 0;
  for (const d of devs) {
    try { const t = (d.tags || []).find(x => x.key === "configuration"); if (t && /"coir"/.test(t.value)) coirCfg++; } catch (_e) {}
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) { none++; continue; }
      if (Date.now() - Date.parse(e.time) > 40 * 60e3) { old++; console.log("ΥΥ7OLD|" + (d.name || d.id) + "|" + e.time); continue; }
      fresh++;
      const sz = String(e.metadata.data).length; if (sz > maxB) { maxB = sz; maxN = d.name || d.id; }
      const o = unpack(e); const v = String(((o.shared || {}).kernel_version || {}).value || "—"); ver[v] = (ver[v] || 0) + 1;
      const all = JSON.stringify(o);
      if (/Υπόστρωμα|slab/.test(all)) { subTxt++; console.log("ΥΥ7SUB|" + (d.name || d.id) + " ✗ κείμενο υποστρώματος σε αγρό χωρίς coir"); }
      if ((o.shared || {}).soil_ec_status) ecst++;
      for (const c of (o.crops || [])) {
        const ind = c.indicators || {};
        if (ind.irrigation_message) irr++;
        if (ind.soil_moisture_limits_status || ind.soil_profile_status) lim++;
      }
    } catch (x) { console.log("ΥΥ7ERR|" + d.id + "|" + x.message); }
  }
  console.log("ΥΥ7SUM|αγροί=" + devs.length + "|φρέσκα(<40΄)=" + fresh + "|παλιά=" + old + "|χωρίς=" + none + "|εκδόσεις=" + JSON.stringify(ver)
    + "|ρυθμίσεις με coir=" + coirCfg + "|bundles με κείμενο υποστρώματος=" + subTxt + "|καλλιέργειες με irrigation_message=" + irr
    + "|με όρια υγρασίας=" + lim + "|αγροί με soil_ec_status=" + ecst + "|μέγιστο bundle(base64)=" + maxB + " (" + maxN + ")");
  console.log("ΥΥ7=== ΤΕΛΟΣ ===");
})();
