// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · S2120: πότε ο σταθμός στέλνει πλαίσιο σφάλματος (0x06) αντί για
// κατεύθυνση/ένταση βροχής/πίεση (0x4B). Για κάθε s2120: τελευταίο sensor_error_event, τελευταία πίεση· για 057C/0138
// πρώτο sensor_error_event και πρώτη/τελευταία πίεση από 25/9. Πολιτική 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει. Κόστος ~150 εγγραφές.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const one = async (id, v, extra) => { const a = await get(`/device/${id}/data?variable=${v}&qty=1${extra || "&ordination=descending"}`); return a && a[0] ? a[0].time.slice(0, 16) : "—"; };
(async () => {
  console.log("ΣΦ=== S2120 πλαίσια σφάλματος · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  const rows = []; let ok = 0;
  for (const d of devs) {
    try {
      const e = await one(d.id, "sensor_error_event");
      if (e === "—") continue;
      const pz = await one(d.id, "barometric_pressure_hpa");
      if (pz < e.slice(0, 13) || pz === "—") rows.push(String(d.name).replace(/sensecap_s?2120_/i, "") + " σφάλμα " + e + " · πίεση " + pz + " · τελευταίο uplink " + String(d.last_input || "").slice(0, 16));
      else ok++;
    } catch (x) { rows.push(d.name + " ERR " + x.message); }
  }
  console.log("ΣΦ1|σταθμοί με σφάλμα και πίεση που ΔΕΝ ξαναήρθε μετά: " + rows.length + " (με σφάλμα αλλά πίεση ξανά: " + ok + ") · " + rows.join(" | "));
  for (const [id, nm] of [["67fe99b670defa000a954bbe", "ΚΟΞΑΡΗ 057C"], ["67fe9a063b56fa000ac75c4b", "ΕΛΙΑ 0138"]]) {
    const asc = "&ordination=ascending&start_date=2026-09-25T00:00:00Z";
    try {
      console.log("ΣΦ2|" + nm + " · πρώτο σφάλμα από 25/9 " + await one(id, "sensor_error_event", asc) + " · τελευταίο σφάλμα " + await one(id, "sensor_error_event")
        + " · πρώτη πίεση μετά 3/10 " + await one(id, "barometric_pressure_hpa", "&ordination=ascending&start_date=2026-10-03T00:00:00Z")
        + " · τελευταία πίεση " + await one(id, "barometric_pressure_hpa"));
      const se = await get(`/device/${id}/data?variable=sensor_error_event&qty=3&ordination=descending`);
      console.log("ΣΦ2|" + nm + " · δείγμα σφάλματος: " + JSON.stringify((se || []).map((x) => ({ t: x.time, v: x.value, u: x.unit, m: x.metadata }))).slice(0, 400));
    } catch (x) { console.log("ΣΦ2|" + nm + " ERR " + x.message); }
  }
  console.log("ΣΦ=== τέλος ===");
})();
