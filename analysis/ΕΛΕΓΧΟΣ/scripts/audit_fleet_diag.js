// SAG — ΜΟΝΟ ΑΝΑΓΝΩΣΗ (18/9/2026) · ΔΙΑΓΝΩΣΗ 3 ΜΟΤΙΒΩΝ σε επιλεγμένους αγρούς: (1) ώρες άρδευσης > 24, (2) BPI «Ελάχιστο» με IPSI 0,
// (3) άρδευση «Απαιτείται» ενώ καταπόνηση «Ιδανικό», (4) ECe = 0/0. Τυπώνει ανά αγρό: tag (ροή/έκταση/σύστημα), και από το bundle
// bpi_daily_status, ipsi_primary_cause, irrigation_dose_basis, irrigation_area_basis, et0_mm_day, air_temperature_avg, soil temp, dli.
// Τρέχει ως probe στην analysis 6aa2d24f2f585a000b90b1a1 (node-rt2025) με την πολιτική ανάγνωσης 6aa2e0cf. Έξοδος 18/9 18:36 UTC στην
// έκθεση analysis/ΕΛΕΓΧΟΣ/ΕΝΔΕΛΕΧΗΣ_ΕΛΕΓΧΟΣ_2026-09-18.md.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PICK = ["KEK", "ΚΑΜΠΑΝΗΣ ΧΡ", "Κουκιά", "ΜΕΛΙΒΟΙΑ-1", "ΜΕΛΙΒΟΙΑ-2", "Β3", "ΚΟΥΤΣΑΚΗΣ", "Α2", "Α5", "Innodays", "Κρασαγάκης", "ΚΥΔΩΝ", "Γρίβα", "Σκοτίνα Πάνω"];
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json();
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 200));
  return j.result;
}
const V = (o, k) => (o && o[k] && o[k].value !== undefined) ? o[k].value : undefined;
const M = (o, k, m) => (o && o[k] && o[k].metadata) ? o[k].metadata[m] : undefined;
const s = (v, n = 60) => v === undefined || v === null ? "—" : String(typeof v === "number" ? Math.round(v * 100) / 100 : v).slice(0, n);
(async () => {
  try {
    const fields = await get(`/device?amount=100&page=1&fields[]=id&fields[]=name&fields[]=tags&filter[tags][0][key]=isField&filter[tags][0][value]=yes`);
    const sel = fields.filter(f => PICK.some(p => (f.name || "").includes(p)));
    console.log("SEL|" + sel.length + "|" + new Date().toISOString());
    for (const f of sel) {
      try {
        const cfgTag = (f.tags || []).find(t => t.key === "configuration"); const cfg = cfgTag ? JSON.parse(cfgTag.value) : {};
        console.log(`T|${(f.name || "").slice(0, 20)}|area=${s(cfg.area)}|sys=${s(cfg.irrigation_system)}|fw=${s(cfg.irrig_fw_fraction)}|rate=${s(cfg.irrig_application_rate_mm_h)}|lph=${s(cfg.irrig_emitter_lph)}|sp=${s(cfg.irrig_emitter_spacing_m)}x${s(cfg.irrig_row_spacing_m)}|eff=${s(cfg.irrig_efficiency_measured)}|soil=${s(cfg.soil_type)}/${s(cfg.soil_texture_class)}|plants=${s(cfg.total_plants)}|crops=${(cfg.crops || []).map(c => c.cultivation_type).join(",")}|cov=${s(cfg.covered_cultivation)}`);
        const rows = await get(`/device/${f.id}/data?variables[]=field_bundle&qty=1`);
        const r0 = rows && rows[0]; if (!r0 || !r0.metadata || !r0.metadata.data) { console.log("  NO_BUNDLE"); continue; }
        const b = JSON.parse(zlib.inflateRawSync(Buffer.from(String(r0.metadata.data), "base64")).toString("utf8"));
        const sh = b.shared || {};
        console.log(`  S|Tavg=${s(V(sh, "air_temperature_avg"))}|Tnow=${s(V(sh, "air_temperature"))}|RHavg=${s(V(sh, "air_humidity_avg") ?? V(sh, "humidity_avg"))}|vpd=${s(V(sh, "vpd"))}|ecraw=${s(V(sh, "soil_ec_raw1"))}/${s(V(sh, "soil_ec_raw2"))}|ece=${s(V(sh, "soil_ece1"))}/${s(V(sh, "soil_ece2"))}|eceTxt=${s(M(sh, "soil_ece1", "text"), 90)}|salst=${s(V(sh, "soil_salinity_status"))}|faults=${s(V(sh, "sensor_faults"), 80)}`);
        (b.crops || []).forEach((c, i) => {
          const I = c.indicators || {};
          console.log(`  C${i}|${s(c.cultivation_type, 12)}|st=${s(V(I, "crop_stage"), 10)}|et0=${s(V(I, "et0_mm_day"))}(${s(V(I, "et0_method"), 14)})|etc=${s(V(I, "etc_mm_day"))}|kc=${s(M(I, "etc_mm_day", "kc") ?? M(I, "etc_mm_day", "Kc"))}|L=${s(V(I, "grossIrrigationLiters"))}|h=${s(V(I, "irrigationDurationHours"))}|hTxt=${s(M(I, "irrigationDurationHours", "text"), 110)}|dose=${s(V(I, "irrigation_dose_basis"), 120)}|areaB=${s(V(I, "irrigation_area_basis"), 60)}`);
          console.log(`     ipsi=${s(V(I, "ipsi"))}|type=${s(V(I, "ipsi_stress_type"))}|cause=${s(V(I, "ipsi_primary_cause"), 60)}|fM=${s(V(I, "ipsi_f_M_base"))}|stress=${s(V(I, "plant_stress"))}|rz=${s(V(I, "soil_moisture_rootzone"))}[${s(V(I, "soil_moisture_lower_limit"))}-${s(V(I, "soil_moisture_upper_limit"))}]|start=${s(V(I, "irrigation_start_moisture"))}|irr=${s(V(I, "irrigation_message"), 40)}`);
          console.log(`     bpi=${s(V(I, "bpi_message"))}|eff=${s(V(I, "bpi_efficiency_pct"))}|perf=${s(V(I, "bpi_performance_pct"))}|daily=${s(V(I, "bpi_daily_status"), 40)}|src=${s(M(I, "bpi_daily_status", "light_source"))}|txt=${s(M(I, "bpi_message", "text"), 120)}|dli=${s(V(I, "dli_mol_m2_day"))}|soilT=${s(V(I, "soil_temp_source"), 40)}`);
        });
      } catch (e) { console.log("  ERR " + e.message.slice(0, 100)); }
    }
    console.log("=== ΤΕΛΟΣ ===");
  } catch (e) { console.log("ERR " + e.message); }
})();
