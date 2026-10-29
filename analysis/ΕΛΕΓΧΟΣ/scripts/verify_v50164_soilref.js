// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · επαλήθευση v50.164 T-SOILREF-01 μετά τον κύκλο hh:21.
// (1) κάθε αγρός: φρεσκάδα, έκδοση, μέγεθος bundle, undefined/NaN · (2) οι 9 αγροί με 2–3 σόνδες: πηγή εδάφους στο
// measurement_sources (ΕΝΑΣ αισθητήρας, όχι «μ.ό.»), χωρίς sensor_divergence, κατάσταση αλατότητας, κείμενο άρδευσης.
// Πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const MULTI = { "69b6f6f0fce2b5000a72e8eb": "Βενζινάδικο", "6a425d51ef0469000b69611c": "ΚΑΜΠΑΝΗΣ", "6a8420ea052bf2000ce0aa50": "Καμπιτάκης(α)",
  "6a84217b34440f000ba2fa5f": "Καμπιτάκης(β)", "6a841fdbef7327000b112a95": "Καμπιτάκης BIO", "699733fae43c8b000aafec9f": "ΚΟΥΤΣΑΚΗΣ",
  "6a4d6181bf7c42000c7ec6cf": "Μεγάλη Ντάμα", "6a7462748acfb8000cd40c6e": "ΠΑΝΕΤΕΚ", "6a842421052bf2000ce17d3c": "Τσικαλάς" };
const P = "V164|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name");
  let fresh = 0, stale = 0, none = 0, junk = 0, maxB = 0, maxN = "";
  const ver = {};
  for (const d of devs) {
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) { none++; if (MULTI[d.id]) console.log(P + "M|" + MULTI[d.id] + "|χωρίς bundle"); continue; }
      const ageMin = (Date.now() - Date.parse(e.time)) / 60000;
      if (ageMin > 75) { stale++; console.log(P + "STALE|" + (d.name || d.id) + "|" + Math.round(ageMin) + "΄"); continue; }
      fresh++;
      const sz = String(e.metadata.data).length; if (sz > maxB) { maxB = sz; maxN = d.name || d.id; }
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
      const sh = o.shared || {};
      const v = String((sh.kernel_version || {}).value || "—"); ver[v] = (ver[v] || 0) + 1;
      const all = JSON.stringify(o);
      if (/undefined|NaN|\[object /.test(all)) { junk++; console.log(P + "JUNK|" + (d.name || d.id)); }
      if (MULTI[d.id]) {
        const t = (k) => sh[k] ? (String(sh[k].value) + " ¦ " + String((sh[k].metadata || {}).text || "").slice(0, 160)) : "—";
        console.log(P + "M|" + MULTI[d.id] + "|v=" + v + "|bytes=" + sz + "|src=" + t("measurement_sources") + "|inv=" + t("device_inventory"));
        console.log(P + "M|" + MULTI[d.id] + "|divergence=" + t("sensor_divergence") + "|ec_status=" + t("soil_ec_status"));
        const c0 = (o.crops || [])[0]; const im = c0 && c0.indicators && c0.indicators.irrigation_message;
        console.log(P + "M|" + MULTI[d.id] + "|άρδευση=" + (im ? String(im.value) + " ¦ " + String((im.metadata || {}).text || "").slice(0, 160) : "—"));
      }
    } catch (x) { console.log(P + "ERR|" + (d.name || d.id) + "|" + x.message); }
  }
  console.log(P + "SUM|αγροί=" + devs.length + "|φρέσκα=" + fresh + "|μπαγιάτικα=" + stale + "|χωρίς bundle=" + none
    + "|εκδόσεις=" + JSON.stringify(ver) + "|undefined/NaN=" + junk + "|μέγιστο bundle=" + maxB + " (" + maxN + ")");
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
