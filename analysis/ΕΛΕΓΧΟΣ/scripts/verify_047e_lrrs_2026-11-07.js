// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · T-GWMAP-06: ο σταθμός 047e, parser σε κώδικα, κανονικές μετρήσεις, και τι έχει το metadata των lrrid (λίστα πυλών ή ονόματα κλειδιών).
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "VR|"; const ID = "684c39adfcf7b1000a8dd206";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const d = await get(`/device/${ID}`); const v = d.payload_decoder; const src = v && v.data ? Buffer.from(v.data).toString("utf8") : String(v || ""); const txt = /^[A-Za-z0-9+/=\s]+$/.test(src) ? Buffer.from(src, "base64").toString("utf8") : src;
  console.log(P + "PARSER|μήκος " + txt.length + "|κώδικας " + txt.startsWith("/* This is") + "|έχει T-GWMAP-06 " + txt.includes("T-GWMAP-06") + "|last_input " + d.last_input + "|updated " + d.updated_at);
  for (const x of ["air_temperature", "air_humidity", "light_intensity"]) { const r = await get(`/device/${ID}/data?variables[]=${x}&qty=2`); console.log(P + "ΜΕΤΡΗΣΗ|" + x + "|" + r.map((z) => String(z.time).slice(11, 19) + "=" + z.value).join(" ")); }
  const r = await get(`/device/${ID}/data?variables[]=lrrid&qty=6`);
  for (const z of r) console.log(P + "LRRID|" + String(z.time).slice(11, 19) + "|" + z.value + "|" + JSON.stringify(z.metadata || null).slice(0, 420));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
