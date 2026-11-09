// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 9/11/2026 · Μετά το v50.193 (T-LEAF-FALLBACK-01): fleet_summary και, για τους αγρούς του
// scope {ids:[...]}, έκδοση πυρήνα, κατάσταση μοντέλου μόλυνσης, σημαία εφεδρείας φύλλου και μετρητές ωρών. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "V193|"; const FLEET = "6a98855ca06e41000bfae024";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
let S = {}; try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); S = (Array.isArray(s) ? s[0] : s) || {}; } catch (_e) {}
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  try { for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=1`)) { const m = e.metadata || {}; console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 300) + "|ms=" + m.ms); } } catch (e) { console.log(P + "ERR|fleet|" + e.message); }
  for (const id of (S.ids || [])) {
    try {
      const b = (await get(`/device/${id}/data?variables=field_bundle&qty=1`))[0];
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      const out = { _t: b.time, _k: val((o.shared || {}).kernel_version) };
      for (const [box, tag] of [[o.shared || {}, "sh"], ...(o.crops || []).map((c) => [c.indicators || {}, String(c.id).split(":")[1]])]) {
        for (const k of Object.keys(box)) if (/infection_model_status|ih_leaf_fallback|^b\d\d$|^a\d\d$/.test(k)) out[tag + "." + k] = val(box[k]);
      }
      console.log(P + "F|" + id.slice(-4) + "|" + JSON.stringify(out).slice(0, 900));
    } catch (e) { console.log(P + "ERR|" + id.slice(-4) + "|" + e.message.slice(0, 80)); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
