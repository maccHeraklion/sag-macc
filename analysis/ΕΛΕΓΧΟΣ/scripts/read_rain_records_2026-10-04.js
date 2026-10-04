// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ενιαίος υπολογισμός βροχής (T-RAIN-UNIFIED-01), 4/10/2026.
// Ανά σταθμό S2120: μετρητής ναι/όχι, μηνιαία σύνολα 2026 (για το «Φέτος»), σχήμα ημερήσιας εγγραφής, τρέχοντα σύνολα.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const q = (v, extra) => `/data?variable=${v}&ordination=descending${extra || ""}`;
(async () => {
  console.log("ΖΖΖ=== ΕΓΓΡΑΦΕΣ ΒΡΟΧΗΣ · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200&fields=id,name");
  let shown = 0;
  for (const d of devs) {
    try {
      const acc = await get(`/device/${d.id}` + q("rain_height_acc", "&qty=1"));
      const mon = await get(`/device/${d.id}` + q("rain_height_monthly", "&qty=20&start_date=2025-12-01T00:00:00Z"));
      const day = await get(`/device/${d.id}` + q("rain_height_daily", "&qty=1"));
      const ptd = [].concat(await get(`/device/${d.id}` + q("current_rain_height_daily", "&qty=1")), await get(`/device/${d.id}` + q("current_rain_height_yearly", "&qty=1")));
      const months = (mon || []).map(x => String((x.metadata || {}).period_start_utc || x.time).slice(0, 7) + "=" + Number(x.value).toFixed(1)
        + (x.metadata && x.metadata.ytd_end_mm != null ? "/ytd" + Number(x.metadata.ytd_end_mm).toFixed(0) : "")).reverse().join(",");
      console.log("ΖΖΖD|" + d.name + "|acc=" + (acc && acc[0] ? acc[0].time.slice(0, 16) : "—") + "|μήνες=" + (mon || []).length + "|" + months);
      if (shown < 3 && day && day[0]) { shown++; console.log("ΖΖΖDAY|" + d.name + "|" + JSON.stringify({ t: day[0].time, v: day[0].value, g: day[0].group, m: day[0].metadata })); }
      if (shown < 3 && ptd && ptd.length) console.log("ΖΖΖPTD|" + d.name + "|" + JSON.stringify(ptd.map(x => ({ var: x.variable, t: x.time, v: x.value, g: x.group }))));
    } catch (x) { console.log("ΖΖΖERR|" + d.name + "|" + x.message); }
  }
  console.log("ΖΖΖ=== ΤΕΛΟΣ · σταθμοί " + devs.length + " ===");
})();
