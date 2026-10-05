// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · γιατί οι 0401 και 03D4 δεν έχουν ωριαίες βροχής ενώ στέλνουν;
// Για κάθε σταθμό: τελευταίες τιμές rain_height_acc / rain_height / rain_gauge / air_temperature (χρόνοι), και τι έγραψε η ανάλυση.
// Έλεγχος σύγκρισης: 03b2 και 00d8-1 (καμία ωριαία, χωρίς «!»). Πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PICK = ["0401", "03D4", "03b2", "00d8-1"];
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const last = (id, v, n) => get(`/device/${id}/data?variable=${v}&qty=${n}&ordination=descending`);
const fmt = (a) => (a || []).map(x => x.time.slice(5, 16) + "=" + x.value).join(" ");
(async () => {
  console.log("ΒΡΜ=== ΜΕΤΑΒΛΗΤΕΣ ΒΡΟΧΗΣ 0401/03D4 · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  for (const code of PICK) {
    const d = devs.find(x => String(x.name || "").toLowerCase().endsWith(code.toLowerCase()));
    if (!d) { console.log("ΒΡΜ|" + code + "|δεν βρέθηκε"); continue; }
    try {
      for (const v of ["air_temperature", "rain_height_acc", "rain_height", "rain_gauge"]) {
        const a = await last(d.id, v, v === "air_temperature" ? 4 : 8);
        console.log("ΒΡΜ|" + d.name + "|" + v + "|" + (a && a.length ? fmt(a) : "ΚΑΜΙΑ ΤΙΜΗ ΠΟΤΕ"));
      }
      const fw = await last(d.id, "firmware_version", 1).catch(() => []);
      const h = await last(d.id, "rain_height_hourly", 3);
      console.log("ΒΡΜ|" + d.name + "|fw=" + fmt(fw) + "|τελευταίες ωριαίες: " + (h || []).map(x => (x.metadata || {}).period_start_utc + "=" + x.value + "/" + ((x.metadata || {}).alg || "v33") + "/κ" + (x.metadata || {}).coverage).join(" "));
      const c = await last(d.id, "current_rain_height_daily", 2);
      console.log("ΒΡΜ|" + d.name + "|τελευταίο «σήμερα»: " + (c || []).map(x => x.time.slice(5, 16) + "=" + x.value + " " + x.group + " " + ((x.metadata || {}).alg || "v33") + " " + ((x.metadata || {}).method || "")).join(" ¦ "));
    } catch (x) { console.log("ΒΡΜERR|" + code + "|" + x.message); }
  }
  console.log("ΒΡΜ=== ΤΕΛΟΣ ===");
})();
