// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · έλεγχος πληρότητας 4/10:
// (1) σε ΚΑΘΕ αγρό, τι απορρίπτει/σημαίνει ήδη ο πυρήνας (αδύνατες μετρήσεις, άγνωστες συσκευές, βλάβες, παλιές ομάδες, σφάλματα ρύθμισης)·
// (2) τα αθροίσματα βροχής (analysis calculate_old_rainHeightSums) σε σταθμούς χωρίς μετρητή και με μετρητή.
// Πολιτική 6ac171e063d4f4000b05d9e5 (προσωρινή). ΚΑΜΙΑ εγγραφή.
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
const T = (x, n = 140) => x ? (String(x.value).slice(0, 50) + (x.metadata && x.metadata.text ? "«" + String(x.metadata.text).slice(0, n) + "»" : "")) : null;
(async () => {
  console.log("ΩΩΩ=== ΕΛΕΓΧΟΣ ΠΛΗΡΟΤΗΤΑΣ · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id");
  for (const d of devs) {
    try {
      const info = await get(`/device/${d.id}`).catch(() => ({}));
      const nm = String(info.name || d.id).replace("Field_", "");
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) continue;
      const o = unpack(e); const sh = o.shared || {};
      const parts = [];
      const add = (k, n) => { const v = T(sh[k], n); if (v) parts.push(k + "=" + v); };
      if (sh.sensor_quality && !/όλες έγκυρες/.test(String(sh.sensor_quality.value))) add("sensor_quality", 260);
      add("device_mapping_status", 200);
      if (sh.sensor_faults && sh.sensor_faults.value) add("sensor_faults", 200);
      if (sh.stale_measurement_groups && sh.stale_measurement_groups.value) add("stale_measurement_groups", 160);
      if (sh.hidden_advice && sh.hidden_advice.value) add("hidden_advice", 120);
      if (sh.sensor_divergence && sh.sensor_divergence.value) add("sensor_divergence", 120);
      for (const c of (o.crops || [])) {
        const i = c.indicators || {};
        if (i.irrigation_config_error && i.irrigation_config_error.value) parts.push("C.irrigation_config_error=" + T(i.irrigation_config_error, 160));
        if (i.irrigation_dose_basis && i.irrigation_dose_basis.metadata && i.irrigation_dose_basis.metadata.color === "orange") parts.push("C.dose_basis=" + T(i.irrigation_dose_basis, 160));
      }
      console.log("ΩΩΩF|" + nm + "|" + e.time.slice(11, 16) + "|" + (parts.length ? parts.join(" ¦ ") : "καθαρό"));
    } catch (x) { console.log("ΩΩΩERR|" + d.id + "|" + x.message); }
  }
  // (2) αθροίσματα βροχής σε σταθμούς
  const ST = { "683379a2038bf5000a7eaaf3": "052A fw1.13", "67f3ece305bd5d000a6ac97b": "0514 fw1.13", "680e7bf064c02e000a714dcd": "04e0 fw1.13",
               "684c342a13af9d000a77bef3": "049e μετρητής", "684c4e48cc1cd8000a10ddb9": "047c μετρητής" };
  for (const [id, nm] of Object.entries(ST)) {
    try {
      const out = [];
      for (const v of ["rain_height_daily", "current_rain_height_daily", "rain_height_weekly", "current_rain_height_monthly", "current_rain_height_yearly", "rain_height_yearly"]) {
        const r = await get(`/device/${id}/data?variable=${v}&qty=4`).catch(() => []);
        out.push(v + "=" + (Array.isArray(r) && r.length ? r.map(x => String(x.time).slice(5, 13) + ":" + Number(x.value).toFixed(1)).join(",") : "—"));
      }
      console.log("ΩΩΩR|" + nm + "|" + out.join(" ¦ "));
    } catch (x) { console.log("ΩΩΩR|" + nm + "|ERR " + x.message); }
  }
  console.log("ΩΩΩ=== ΤΕΛΟΣ ===");
})();
