// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 9/11/2026 · Προδιαγραφές οργάνων (πρόθεμα SP9): ανά όργανο του στόλου και ανά μέγεθος,
// 21 ημέρες, ερωτήματα πλατφόρμας min/max/avg/count (ένα στοιχείο το καθένα — όχι σειρές). Σύγκριση με τα φύλλα προδιαγραφών τοπικά.
// scope {from:N, n:M}. Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "SP9|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 100)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
let S = {}; try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); S = (Array.isArray(s) ? s[0] : s) || {}; } catch (_e) {}
const VARS = {
  s2120: ["air_temperature", "air_humidity", "light_intensity", "uv_index", "wind_speed_kmh", "wind_direction_sensor", "rain_gauge", "barometric_pressure_hpa"],
  em320_th: ["temperature", "humidity"], em300_th: ["temperature", "humidity"],
  lms01_ls: ["leaf_moisture", "leaf_temperature"],
  lse01: ["soil_moisture", "temp_soil", "conduct_soil"],
  lse02: ["soil_moisture1", "soil_temperature1", "conduct_soil1", "soil_moisture2", "soil_temperature2", "conduct_soil2"],
  se0x: ["soil_moisture1", "soil_temperature1", "conduct_soil1", "soil_moisture2", "soil_temperature2", "conduct_soil2"],
  sph01: ["soil_ph", "soil_temperature", "temp_soil"],
  aglwpp01: ["pressure_adc_mv"],
};
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " from=" + (S.from || 0));
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,tags");
  const ids = new Set(); for (const f of fields) { let dv = {}; try { dv = JSON.parse(tag(f, "devices") || "{}") || {}; } catch (_e) {} for (const x of Object.values(dv)) if (typeof x === "string") ids.add(x); }
  const list = [...ids].sort().slice(Number(S.from) || 0, (Number(S.from) || 0) + (Number(S.n) || 40));
  const st = new Date(Date.now() - 21 * 864e5).toISOString();
  for (const id of list) {
    try {
      const d = await get(`/device/${id}?fields=id,tags,last_input`);
      const ty = String(tag(d, "type") || ""); const vs = VARS[ty]; if (!vs) continue;
      const out = [];
      for (const v of vs) {
        const q = async (k) => { try { const r = await get(`/device/${id}/data?variables=${v}&query=${k}&start_date=${st}`); const x = r && r[0] ? Number(r[0].value) : NaN; return Number.isFinite(x) ? +x.toFixed(2) : "-"; } catch (_e) { return "E"; } };
        const [mn, mx, av, ct] = await Promise.all([q("min"), q("max"), q("avg"), q("count")]);
        if (mn === "-" && mx === "-" && (ct === "-" || ct === 0)) continue;
        out.push(v + "=" + mn + "/" + av + "/" + mx + "#" + ct);
      }
      console.log(P + "D|" + id.slice(-6) + "|" + ty + "|last=" + String(d.last_input || "").slice(5, 16) + "|" + out.join(" "));
    } catch (e) { console.log(P + "D|" + id.slice(-6) + "|ERR " + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL " + e.message));
