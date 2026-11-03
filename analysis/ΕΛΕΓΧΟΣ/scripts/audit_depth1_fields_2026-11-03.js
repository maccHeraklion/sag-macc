// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 3/11/2026 · Αγροί με soil_depth_count = 1: τι έβγαλε ο πυρήνας.
// Για κάθε τέτοιο αγρό: ετικέτες ελέγχου (subscriptionActive, isField), ρύθμιση (βάθη/θύρα/καλλιέργειες), field_bundle
// (ηλικία, έκδοση, κλειδιά εδάφους). Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "AD1|";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    for (const f of fields) {
      let conf = {}; try { conf = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
      if (Number(conf.soil_depth_count) !== 1) continue;
      const crops = Array.isArray(conf.crops) ? conf.crops.map((c) => c.cultivation_type).join(",") : "—";
      console.log(P + "F|" + (tag(f, "name") || f.name) + "|sub=" + tag(f, "subscriptionActive") + "|ρηχό=" + conf.sensorShallow_depth_cm + "|βαθύ=" + conf.sensor_deep_depth_cm
        + "|θύρα=" + conf.soil_depth_port + "|υπόστρωμα=" + (conf.substrate || conf.growing_medium || "—") + "|καλλιέργειες=" + crops + "|κλειδιά=" + Object.keys(conf).length);
      try {
        const b = await get(`/device/${f.id}/data?variables=field_bundle&qty=1`);
        const e = Array.isArray(b) && b[0];
        if (!e) { console.log(P + "  χωρίς field_bundle"); continue; }
        const age = Math.round((Date.now() - Date.parse(e.time)) / 60000);
        const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
        const s = JSON.stringify(o); const m = s.match(/v50\.\d+ · \d{4}-\d\d-\d\d/);
        const soil = (s.match(/"(soil_[a-z_0-9]+|sensor_divergence|sensor_fault[a-z_]*)"/g) || []).filter((x, i, a) => a.indexOf(x) === i).join(" ");
        console.log(P + "  bundle ηλικία=" + age + "΄|έκδοση=" + (m ? m[0] : "?") + "|μήκος=" + s.length + "|κλειδιά εδάφους=" + soil.slice(0, 500));
        for (const k of ["soil_depth_basis", "soil_moisture_rootzone", "soil_depth_divergence"]) {
          const i = s.indexOf('"' + k + '"'); if (i >= 0) console.log(P + "  " + s.slice(i, i + 300));
        }
      } catch (e) { console.log(P + "  ERR bundle|" + e.message); }
    }
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
