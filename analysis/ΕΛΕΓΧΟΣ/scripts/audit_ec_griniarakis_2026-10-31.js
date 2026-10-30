// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Γιατί το TagoIO δείχνει EC ρίζας βαθύ 3,0 ενώ το SAGGH 2,93 (Γρινιαράκης, 30/10 21:42 UTC).
// Διαβάζει τα πακέτα του dragino_se0x_5ea7 (conduct_soil2, soil_moisture2, soil_temperature2) 20:30–22:10 UTC και τα
// field_bundle του αγρού στο ίδιο διάστημα, και υπολογίζει το νερό πόρων με τον ΙΔΙΟ τύπο του πυρήνα (_sagEcChain).
// Πολιτική: 6aa2e0cf (Device Access + Get data). Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const SENSOR = "69779797803f37000a21342e", FIELD = "69e0aa6554a00e000aa67124";
const S = "2026-10-30T20:30:00Z", E = "2026-10-30T22:10:00Z";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
// Ίδια αλυσίδα με runPerTich.js (_sagEcChain, _SAG_EC_EPS0 = 4.1).
function pore(raw, vwc, t) {
  const tf = 1 + 0.02 * (t - 25), ec25 = (raw / 1000) / tf, th = vwc / 100;
  const eb = 3.03 + 9.3 * th + 146 * th * th - 76.7 * th * th * th;
  return (80.3 - 0.37 * (t - 20)) * ec25 / (eb - 4.1);
}
function find(o, key, depth) {
  if (!o || typeof o !== "object" || depth > 8) return undefined;
  if (Object.prototype.hasOwnProperty.call(o, key)) return o[key];
  for (const k of Object.keys(o)) { const r = find(o[k], key, depth + 1); if (r !== undefined) return r; }
  return undefined;
}
const P = "ECG|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  const recs = await get(`/device/${SENSOR}/data?variables=conduct_soil2&variables=soil_moisture2&variables=soil_temperature2&start_date=${S}&end_date=${E}&qty=100`);
  const by = {};
  for (const r of recs) { const k = String(r.time).slice(0, 19); (by[k] = by[k] || {})[r.variable] = Number(r.value); }
  for (const k of Object.keys(by).sort()) {
    const d = by[k];
    const p = (Number.isFinite(d.conduct_soil2) && Number.isFinite(d.soil_moisture2) && Number.isFinite(d.soil_temperature2))
      ? pore(d.conduct_soil2, d.soil_moisture2, d.soil_temperature2).toFixed(3) : "-";
    console.log(P + "PKT|" + k + "Z|raw=" + d.conduct_soil2 + "|θ=" + d.soil_moisture2 + "|T=" + d.soil_temperature2 + "|pore=" + p);
  }
  const b = await get(`/device/${FIELD}/data?variables=field_bundle&start_date=${S}&end_date=${E}&qty=10`);
  for (const e of b) {
    let v = "?";
    try {
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
      const x = find(o, "soil_ec_pore2", 0);
      v = JSON.stringify(x && typeof x === "object" && "value" in x ? x.value : x);
    } catch (err) { v = "ERR " + err.message.slice(0, 60); }
    console.log(P + "BUNDLE|" + e.time + "|soil_ec_pore2=" + v);
  }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
