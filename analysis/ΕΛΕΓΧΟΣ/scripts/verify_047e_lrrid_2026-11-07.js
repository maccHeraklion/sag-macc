// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Επαλήθευση T-GWID-04 στον σταθμό 047e: ο parser είναι κώδικας (όχι διπλό base64), οι κανονικές μετρήσεις γράφονται, εμφανίστηκε lrrid ή lrr_probe.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "VL|"; const ID = "684c39adfcf7b1000a8dd206";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const d = await get(`/device/${ID}`); const v = d.payload_decoder; const src = v && v.data ? Buffer.from(v.data).toString("utf8") : String(v || ""); const txt = /^[A-Za-z0-9+/=\s]+$/.test(src) ? Buffer.from(src, "base64").toString("utf8") : src;
  console.log(P + "PARSER|μήκος " + txt.length + "|αρχή κώδικα " + txt.startsWith("/* This is") + "|διπλό base64 " + txt.startsWith("LyogVGhpcy") + "|έχει T-GWID-04 " + txt.includes("T-GWID-04") + "|last_input " + d.last_input + "|updated " + d.updated_at);
  for (const x of ["air_temperature", "air_humidity", "wind_speed_kmh", "light_intensity", "rain_height_acc", "barometric_pressure_hpa"]) { const r = await get(`/device/${ID}/data?variables[]=${x}&qty=3`); console.log(P + "ΜΕΤΡΗΣΗ|" + x + "|" + r.map((z) => String(z.time).slice(11, 19) + "=" + z.value).join(" ")); }
  for (const x of ["lrrid", "lrr_probe"]) { const r = await get(`/device/${ID}/data?variables[]=${x}&qty=3`); console.log(P + "ΝΕΟ|" + x + "|" + (r.map((z) => String(z.time).slice(11, 19) + "=" + z.value + (z.location ? " με θέση" : "")).join(" ; ") || "καμία εγγραφή")); }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
