// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · έλεγχος αλλαγής ημέρας της ανάλυσης βροχής v34.2 (T-RAIN-UNIFIED-01)
// Αλλαγή σε ώρα Ελλάδας: Δευτέρα 5/10/2026 00:00 = 2026-10-04T21:00Z. Ελέγχει σε 5 σταθμούς:
//  (1) ημέρα-γέφυρα 4/10 = 00:00Z–21:00Z (μία εγγραφή v34, όχι και ημέρα UTC της v33 για 4/10)
//  (2) εβδομάδα-γέφυρα W40 = 28/9 00Z – 4/10 21Z και ότι ισούται με το άθροισμα των ημερών της
//  (3) «σήμερα» με group current_day_2026-10-05 και αρχή 4/10 21:00Z
//  (4) ωριαίες 19Z–03Z: καμία τρύπα, κανένα διπλότυπο ανά ώρα
// Απαιτεί την προσωρινή πολιτική ανάγνωσης 6ac171e0 (type=s2120) ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PICK = ["047c", "049e", "0514", "05B6", "01f3"];
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const recs = (id, v, a, b, qty) => get(`/device/${id}/data?variable=${v}&start_date=${a}&end_date=${b}&qty=${qty || 100}&ordination=ascending`);
const m = (x) => x.metadata || {};
const sh = (x) => (m(x).period_start_utc || "?").slice(5, 16) + "→" + (m(x).period_end_utc || "?").slice(5, 16) + "=" + Number(x.value).toFixed(3)
  + "[" + (m(x).alg || "v33") + (m(x).status === "estimate" ? "≈" : "") + (m(x).partial ? "≥" + m(x).coverage : "") + "]";
(async () => {
  console.log("ΚΚΚ=== ΕΛΕΓΧΟΣ ΑΛΛΑΓΗΣ ΗΜΕΡΑΣ ΒΡΟΧΗΣ · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  for (const code of PICK) {
    const d = devs.find(x => String(x.name || "").toLowerCase().endsWith(code.toLowerCase()));
    if (!d) { console.log("ΚΚΚ|" + code + "|δεν βρέθηκε"); continue; }
    try {
      const days = await recs(d.id, "rain_height_daily", "2026-09-27T00:00:00Z", "2026-10-06T00:00:00Z");
      const bridge = days.filter(x => m(x).period_start_utc === "2026-10-04T00:00:00.000Z");
      const ok1 = bridge.length === 1 && m(bridge[0]).alg === "v34" && m(bridge[0]).period_end_utc === "2026-10-04T21:00:00.000Z";
      console.log("ΚΚΚD|" + d.name + "|γέφυρα4/10 " + (ok1 ? "✔" : "✗") + " (" + bridge.length + " εγγρ.)|ημέρες: " + days.map(sh).join(" "));
      const weeks = await recs(d.id, "rain_height_weekly", "2026-09-27T00:00:00Z", "2026-10-06T00:00:00Z");
      const w40 = weeks.filter(x => m(x).period_start_utc === "2026-09-28T00:00:00.000Z");
      const v34w = w40.find(x => m(x).alg === "v34");
      const inW = days.filter(x => Date.parse(m(x).period_start_utc) >= Date.parse("2026-09-28T00:00:00Z") && Date.parse(m(x).period_start_utc) < Date.parse("2026-10-04T21:00:00Z"));
      const sumDays = inW.reduce((s, x) => s + Number(x.value), 0);
      console.log("ΚΚΚW|" + d.name + "|W40 εγγρ.=" + w40.length + "|" + (v34w ? sh(v34w) + " vs Σημερών(" + inW.length + ")=" + sumDays.toFixed(3) + (Math.abs(Number(v34w.value) - sumDays) < 0.01 ? " ✔" : " (διαφορά: δες κάλυψη/άγνωστες)") : "καμία v34"));
      const cur = await get(`/device/${d.id}/data?variable=current_rain_height_daily&qty=3&ordination=descending`);
      console.log("ΚΚΚC|" + d.name + "|" + cur.map(x => x.time.slice(5, 16) + "=" + x.value + " " + (x.group || "") + " αρχή " + (m(x).period_start_utc || "?").slice(5, 16) + " " + (m(x).alg || "v33")).join(" ¦ "));
      const hrs = await recs(d.id, "rain_height_hourly", "2026-10-04T19:00:00Z", "2026-10-05T04:00:00Z");
      const byStart = {}; for (const x of hrs) { const k = m(x).period_start_utc || "?"; byStart[k] = (byStart[k] || 0) + 1; }
      const want = []; for (let t = Date.parse("2026-10-04T19:00:00Z"); t < Date.parse("2026-10-05T03:00:00Z"); t += 3600000) want.push(new Date(t).toISOString());
      const miss = want.filter(k => !byStart[k]).map(k => k.slice(11, 13));
      const dup = Object.entries(byStart).filter(([, n]) => n > 1).map(([k, n]) => k.slice(11, 13) + "×" + n);
      console.log("ΚΚΚH|" + d.name + "|ώρες 19Z–03Z: λείπουν [" + miss.join(",") + "] · διπλές [" + dup.join(",") + "] · σύνολο εγγραφών " + hrs.length);
    } catch (x) { console.log("ΚΚΚERR|" + code + "|" + x.message); }
  }
  console.log("ΚΚΚ=== ΤΕΛΟΣ ===");
})();
