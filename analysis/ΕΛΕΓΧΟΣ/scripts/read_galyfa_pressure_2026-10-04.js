// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · P4: πίεση του σταθμού ΓΑΛΥΦΑ (sensecap_s2120_047e).
// Ο parser της συσκευής προσθέτει σταθερή barometric_pressure_hpa = 1017,2 σε κάθε uplink.
// Ερώτηση: υπάρχει ΚΑΙ πραγματική πίεση από τον connector (δύο τιμές ανά uplink), ή μόνο η σταθερή;
// Σύγκριση με γειτονικούς σταθμούς. Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
(async () => {
  console.log("ΠΠΠ=== ΠΙΕΣΗ ΓΑΛΥΦΑ · " + new Date().toISOString() + " ===");
  const G = "684c39adfcf7b1000a8dd206";
  const p = await get(`/device/${G}/data?variable=barometric_pressure_hpa&qty=30&ordination=descending`);
  const byTime = {}; for (const x of p) { const k = x.time.slice(0, 19); (byTime[k] = byTime[k] || []).push(x.value); }
  console.log("ΠΠΠG|τελευταίες 30: " + p.map(x => x.time.slice(11, 19) + "=" + x.value + (x.group ? "/g" + String(x.group).slice(-4) : "")).join(" "));
  console.log("ΠΠΠG|ανά χρόνο: " + Object.entries(byTime).slice(0, 12).map(([k, v]) => k.slice(11) + ":" + v.join("|")).join(" "));
  const vals = p.map(x => Number(x.value)); const non = vals.filter(v => v !== 1017.2);
  console.log("ΠΠΠG|σταθερές 1017,2: " + (vals.length - non.length) + "/" + vals.length + " · άλλες τιμές: " + (non.length ? Math.min(...non) + "–" + Math.max(...non) : "καμία"));
  const other = await get(`/device/${G}/data?variable=air_temperature&qty=3&ordination=descending`);
  console.log("ΠΠΠG|air_temperature τελευταίες: " + other.map(x => x.time.slice(11, 19) + "=" + x.value + (x.group ? "/g" + String(x.group).slice(-4) : "")).join(" "));
  const raw = await get(`/device/${G}/data?qty=40&ordination=descending`);
  const t0 = raw.length ? raw[0].time : null;
  console.log("ΠΠΠG|μεταβλητές τελευταίου uplink (" + t0 + "): " + raw.filter(x => x.time === t0).map(x => x.variable + "=" + x.value).join(" "));
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  for (const d of devs) {
    if (d.id === G) continue;
    try {
      const q = await get(`/device/${d.id}/data?variable=barometric_pressure_hpa&qty=1&ordination=descending`);
      if (q && q[0] && Date.now() - Date.parse(q[0].time) < 6 * 3600e3) console.log("ΠΠΠN|" + d.name + "|" + q[0].value);
    } catch (x) {}
  }
  console.log("ΠΠΠ=== ΤΕΛΟΣ ===");
})();
