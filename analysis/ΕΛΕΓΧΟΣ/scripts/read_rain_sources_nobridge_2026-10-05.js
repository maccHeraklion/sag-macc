// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · οι 10 σταθμοί χωρίς γέφυρα 4/10: έχουν ΠΗΓΗ βροχής;
// Ανά σταθμό: τελευταία air_temperature / rain_height_acc / rain_height (χρόνος). Και 03D4: πλήθος rain_height ανά ώρα 21Z–06Z
// (έστελνε θερμοκρασία αλλά δεν γράφτηκαν ωριαίες 23Z–04Z). Πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const NOB = ["00d8-1", "0298", "03C4", "0425", "03F1", "05B6", "0401", "05AA", "0068", "03bb"];
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const lastT = async (id, v) => { const a = await get(`/device/${id}/data?variable=${v}&qty=1&ordination=descending`); return a && a[0] ? a[0].time.slice(0, 16) : "ποτέ"; };
(async () => {
  console.log("ΠΗΓ=== ΠΗΓΕΣ ΒΡΟΧΗΣ ΣΤΑΘΜΩΝ ΧΩΡΙΣ ΓΕΦΥΡΑ · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  for (const code of NOB) {
    const d = devs.find(x => String(x.name || "").toLowerCase().endsWith(code.toLowerCase()));
    if (!d) { console.log("ΠΗΓ|" + code + "|δεν βρέθηκε"); continue; }
    try {
      console.log("ΠΗΓ|" + d.name + "|θερμ " + await lastT(d.id, "air_temperature") + " · μετρητής " + await lastT(d.id, "rain_height_acc")
        + " · ρυθμός " + await lastT(d.id, "rain_height") + " · fw " + await lastT(d.id, "firmware_version"));
    } catch (x) { console.log("ΠΗΓERR|" + code + "|" + x.message); }
  }
  const d = devs.find(x => String(x.name || "").toLowerCase().endsWith("03d4"));
  if (d) {
    const r = await get(`/device/${d.id}/data?variable=rain_height&start_date=2026-10-04T21:00:00Z&end_date=2026-10-05T06:00:00Z&qty=2000&ordination=ascending`);
    const t = await get(`/device/${d.id}/data?variable=air_temperature&start_date=2026-10-04T21:00:00Z&end_date=2026-10-05T06:00:00Z&qty=2000&ordination=ascending`);
    const by = (a) => { const o = {}; for (const x of a || []) { const h = x.time.slice(11, 13); o[h] = (o[h] || 0) + 1; } return o; };
    const R = by(r), T = by(t);
    console.log("ΠΗΓ03D4|ανά ώρα UTC (rain_height/air_temperature): " + ["21", "22", "23", "00", "01", "02", "03", "04", "05"].map(h => h + ":" + (R[h] || 0) + "/" + (T[h] || 0)).join(" "));
    const h = await get(`/device/${d.id}/data?variable=rain_height_hourly&start_date=2026-10-04T20:00:00Z&end_date=2026-10-05T08:00:00Z&qty=100&ordination=ascending`);
    console.log("ΠΗΓ03D4|ωριαίες εγγραφές: " + (h || []).map(x => String((x.metadata || {}).period_start_utc).slice(11, 13) + "=" + x.value + "/κ" + (x.metadata || {}).coverage + "/" + String((x.metadata || {}).calc_at || "").slice(11, 16)).join(" "));
  }
  console.log("ΠΗΓ=== ΤΕΛΟΣ ===");
})();
