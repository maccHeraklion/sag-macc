// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Αμμουδάρες 29/10: γιατί η αγωγιμότητα «δεν αλλάζει» μετά το πότισμα.
// Αισθητήρας se0x 6891d4a12e379b000a0cdf6f (conduct/moisture/temp ×2) + αγρός 6ad202ac174a0b000cf10008 (soil_ece*, soil_ec_pore*,
// field_bundle → shared.soil_ec_pore*/soil_ece*/soil_ec_raw*). Πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const SENSOR = "6891d4a12e379b000a0cdf6f", FIELD = "6ad202ac174a0b000cf10008";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}
const t = (s) => String(s).slice(5, 16).replace("T", " ");
const P = "ΑΜΜ|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  const start = new Date(Date.now() - 72 * 3600e3).toISOString();
  try {
    const vars = ["conduct_soil1", "conduct_soil2", "soil_moisture1", "soil_moisture2", "soil_temperature1", "soil_temperature2"];
    const rows = await get(`/device/${SENSOR}/data?${vars.map((v, i) => `variables[${i}]=${v}`).join("&")}&start_date=${start}&qty=2000`);
    const by = {};
    for (const r of rows) { (by[r.time] = by[r.time] || {})[r.variable] = r.value; }
    const times = Object.keys(by).sort();
    console.log(P + "ΑΙΣΘΗΤΗΡΑΣ σημεία=" + times.length + " (72 ω)");
    console.log(P + "ώρα UTC|EC1 µS|θ1 %|T1|EC2 µS|θ2 %|T2");
    for (const k of times) { const o = by[k];
      console.log(P + t(k) + "|" + o.conduct_soil1 + "|" + o.soil_moisture1 + "|" + o.soil_temperature1 + "|" + o.conduct_soil2 + "|" + o.soil_moisture2 + "|" + o.soil_temperature2); }
  } catch (e) { console.log(P + "ERR αισθητήρας " + e.message); }
  try {
    const sv = ["soil_ec_pore1", "soil_ec_pore2", "soil_ece1", "soil_ece2"];
    const rows = await get(`/device/${FIELD}/data?${sv.map((v, i) => `variables[${i}]=${v}`).join("&")}&start_date=${start}&qty=500`);
    const by = {};
    for (const r of rows) { (by[r.time] = by[r.time] || {})[r.variable] = r.value; }
    const times = Object.keys(by).sort();
    console.log(P + "ΣΕΙΡΕΣ ΑΓΡΟΥ σημεία=" + times.length);
    console.log(P + "ώρα UTC|pore1|pore2|ece1|ece2");
    for (const k of times) { const o = by[k]; console.log(P + "S " + t(k) + "|" + o.soil_ec_pore1 + "|" + o.soil_ec_pore2 + "|" + o.soil_ece1 + "|" + o.soil_ece2); }
  } catch (e) { console.log(P + "ERR σειρές " + e.message); }
  try {
    const rows = await get(`/device/${FIELD}/data?variables=field_bundle&start_date=${start}&qty=80`);
    console.log(P + "BUNDLES=" + rows.length);
    for (const r of rows.slice().reverse()) {
      try {
        const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(r.metadata.data), "base64")).toString("utf8"));
        const s = o.shared || {}; const v = (k) => (s[k] && s[k].value !== undefined) ? s[k].value : "—";
        const tx = (k) => (s[k] && s[k].metadata && s[k].metadata.text) ? String(s[k].metadata.text).slice(0, 140) : "";
        console.log(P + "B " + t(r.time) + "|pore1=" + v("soil_ec_pore1") + "|pore2=" + v("soil_ec_pore2") + "|ece1=" + v("soil_ece1") + "|ece2=" + v("soil_ece2")
          + "|raw1=" + v("soil_ec_raw1") + "|raw2=" + v("soil_ec_raw2") + "|st=" + v("soil_salinity_status") + "|" + tx("soil_ece1"));
      } catch (e) { console.log(P + "B " + t(r.time) + " ERR " + e.message); }
    }
  } catch (e) { console.log(P + "ERR bundles " + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
