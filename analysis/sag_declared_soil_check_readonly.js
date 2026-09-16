// SAG — ΜΟΝΟ ΑΝΑΓΝΩΣΗ. Ανοίγει το τελευταίο field_bundle του Γρινιαράκη (deflate-raw-base64) και τυπώνει ό,τι βλέπει ο παραγωγός για EC/άρδευση.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const FIELD = "69e0aa6554a00e000aa67124";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json();
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j));
  return j.result;
}
(async () => {
  try {
    const rows = await get(`/device/${FIELD}/data?variables[]=field_bundle&qty=1`);
    const r = rows[0];
    const raw = zlib.inflateRawSync(Buffer.from(String(r.metadata.data), "base64")).toString("utf8");
    const b = JSON.parse(raw);
    console.log("BUNDLE_TS|" + r.time + "|bytes=" + raw.length + "|topkeys=" + Object.keys(b).join(","));
    const flat = {};
    const walk = (o, p) => { if (o && typeof o === "object" && !Array.isArray(o)) { for (const [k, v] of Object.entries(o)) walk(v, p ? p + "." + k : k); } else flat[p] = o; };
    walk(b, "");
    const want = /soil_ec|salinity|ec_hist|irrigation_dose_basis|irrigation_message|irrigation_warning|grossIrrigation|leach|soilcal|lastHDaily|lastHour|Tich|ec_ref|conduct/i;
    for (const k of Object.keys(flat).sort()) {
      if (want.test(k)) console.log("K|" + k + "|" + String(flat[k]).slice(0, 260));
    }
  } catch (e) { console.log("ERR " + e.message); }
})();
