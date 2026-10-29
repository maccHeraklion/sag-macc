// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Ολοκληρωμένος έλεγχος 29/10/2026.
// (1) ζωντανός πυρήνας και sync: sha256 έναντι DEPLOY_LOG · (2) κάθε αγρός: φρεσκάδα, έκδοση, μέγεθος bundle, κείμενα με
// undefined/NaN/[object, κείμενα υποστρώματος σε αγρούς χωρίς coir, ύπαρξη καρτών άρδευσης/αλατότητας, σειρές soil_ec_pore 24ω.
// Πολιτικές: 6aa2e0cf (download_script, πάντα ενεργή) + 6ac171e0 (δεδομένα αγρών, ΕΝΕΡΓΗ μόνο όσο τρέχει).
const zlib = require("zlib"); const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
async function dl(id) {
  const m = await get(`/analysis/${id}/download`);
  const b = Buffer.from(await (await fetch(m.url)).arrayBuffer());
  return (b[0] === 0x1f && b[1] === 0x8b) ? zlib.gunzipSync(b) : b;
}
const P = "ΟΛΚ|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  for (const [n, id, exp] of [["πυρήνας", "6898958ea9fc0d000a382484", "c72951b62b6e9530"], ["sync", "68fe925b3607df0010ef833c", "5c7c53a29d85fef6"]]) {
    try { const b = await dl(id); const h = sha(b);
      console.log(P + "ANALYSIS|" + n + "|" + h.slice(0, 16) + "|" + b.length + "|" + (h.startsWith(exp) ? "ΣΩΣΤΟ" : "✗ ΔΙΑΦΕΡΕΙ (αναμενόμενο " + exp + ")"));
    } catch (e) { console.log(P + "ANALYSIS|" + n + "|ERR " + e.message); }
  }
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  let fresh = 0, stale = 0, none = 0, coir = 0, subBad = 0, junk = 0, maxB = 0, maxN = "", irrOk = 0, crops = 0, poreSer = 0, poreFields = 0;
  const ver = {};
  for (const d of devs) {
    let cfg = {}; try { const t = (d.tags || []).find((x) => x.key === "configuration"); cfg = t ? JSON.parse(t.value) : {}; } catch (_e) {}
    const isCoir = cfg.soil_type === "coir" || cfg.soil_texture_class === "coir"; if (isCoir) coir++;
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) { none++; continue; }
      const ageMin = (Date.now() - Date.parse(e.time)) / 60000;
      if (ageMin > 75) { stale++; console.log(P + "STALE|" + (d.name || d.id) + "|" + e.time + "|" + Math.round(ageMin) + "΄"); continue; }
      fresh++;
      const sz = String(e.metadata.data).length; if (sz > maxB) { maxB = sz; maxN = d.name || d.id; }
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
      const v = String(((o.shared || {}).kernel_version || {}).value || "—"); ver[v] = (ver[v] || 0) + 1;
      const all = JSON.stringify(o);
      const bad = all.match(/[^"]{0,40}(undefined|NaN|\[object )[^"]{0,40}/g);
      if (bad) { junk++; console.log(P + "JUNK|" + (d.name || d.id) + "|" + bad.slice(0, 3).join(" ¦ ").slice(0, 300)); }
      if (!isCoir && /Υπόστρωμα|slab/.test(all)) { subBad++; console.log(P + "SUBSTRATE_ΣΕ_ΧΩΜΑ|" + (d.name || d.id)); }
      for (const c of (o.crops || [])) { crops++; if ((c.indicators || {}).irrigation_message) irrOk++; }
      const sh = o.shared || {};
      if (sh.soil_ec_pore1 || sh.soil_ec_pore2 || sh.soil_ece1) {
        poreFields++;
        const s = await get(`/device/${d.id}/data?variables=soil_ec_pore1&start_date=${new Date(Date.now() - 24 * 3600e3).toISOString()}&qty=100`);
        if (Array.isArray(s) && s.length >= 12) poreSer++; else console.log(P + "ΛΙΓΗ_ΣΕΙΡΑ_PORE|" + (d.name || d.id) + "|" + (Array.isArray(s) ? s.length : "?") + " σε 24ω");
      }
    } catch (x) { console.log(P + "ERR|" + (d.name || d.id) + "|" + x.message); }
  }
  console.log(P + "SUM|αγροί=" + devs.length + "|φρέσκα=" + fresh + "|μπαγιάτικα=" + stale + "|χωρίς bundle=" + none + "|εκδόσεις=" + JSON.stringify(ver)
    + "|coir=" + coir + "|υπόστρωμα σε χώμα=" + subBad + "|bundles με undefined/NaN=" + junk + "|καλλιέργειες με κάρτα άρδευσης=" + irrOk + "/" + crops
    + "|αγροί με EC=" + poreFields + " (σειρά pore ≥12 σημεία/24ω: " + poreSer + ")|μέγιστο bundle=" + maxB + " (" + maxN + ")");
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
