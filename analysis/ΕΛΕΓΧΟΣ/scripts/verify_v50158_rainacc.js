// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · επαλήθευση v50.158 (T-RAIN-ACC-01): έκδοση + φρεσκάδα σε ΚΑΘΕ αγρό,
// και σε αγρούς με σταθμό μετρητή που έβρεξε στο 24ωρο: τα μηνύματα πριν (≤ 22:30Z) και μετά (τελευταίο).
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const RAINY = { "68feaa80b92ceb000af181d2": "Μπότζης(047c)", "6876921b4090c0000aaab90b": "Α2 Σταυρακάκης(03A4)",
  "6a4b9dac4ec8b7000c30b173": "ΚΥΔΩΝ(01f3)", "69b6f6f0fce2b5000a72e8eb": "Βενζινάδικο(00c5)" };
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const unpack = (e) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
const txt = (x) => x ? (String(x.value).slice(0, 40) + (x.metadata && x.metadata.text ? "«" + String(x.metadata.text).slice(0, 150) + "»" : "")) : "—";
(async () => {
  console.log("ΥΥΥ=== ΕΠΑΛΗΘΕΥΣΗ v50.158 · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name");
  const ver = {}; let fresh = 0, none = 0, old = 0;
  for (const d of devs) {
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) { none++; continue; }
      if (Date.now() - Date.parse(e.time) > 30 * 60e3) { old++; continue; }
      fresh++;
      const v = String(((unpack(e).shared || {}).kernel_version || {}).value || "—"); ver[v] = (ver[v] || 0) + 1;
    } catch (x) { console.log("ΥΥΥERR|" + d.id + "|" + x.message); }
  }
  console.log("ΥΥΥSUM|αγροί=" + devs.length + "|φρέσκα=" + fresh + "|παλιά=" + old + "|χωρίς=" + none + "|εκδόσεις=" + JSON.stringify(ver));
  for (const [id, nm] of Object.entries(RAINY)) {
    for (const [lab, q] of [["ΠΡΙΝ", `&end_date=${encodeURIComponent("2026-10-03T22:30:00Z")}`], ["ΜΕΤΑ", ""]]) {
      try {
        const b = await get(`/device/${id}/data?variable=field_bundle&qty=1&ordination=descending${q}`);
        const e = Array.isArray(b) && b[0]; if (!e) { console.log("ΥΥΥR|" + nm + "|" + lab + "|κανένα"); continue; }
        const o = unpack(e); const c = ((o.crops || [])[0] || {}).indicators || {};
        console.log("ΥΥΥR|" + nm + "|" + lab + "|" + e.time.slice(11, 16) + "|ver=" + ((o.shared || {}).kernel_version || {}).value
          + "|άρδευση=" + txt(c.irrigation_message) + "|καταπόνηση=" + txt(c.plant_stress) + "|διαβροχή=" + txt(c.leaf_wetness_source));
      } catch (x) { console.log("ΥΥΥR|" + nm + "|" + lab + "|ERR " + x.message); }
    }
  }
  console.log("ΥΥΥ=== ΤΕΛΟΣ ===");
})();
