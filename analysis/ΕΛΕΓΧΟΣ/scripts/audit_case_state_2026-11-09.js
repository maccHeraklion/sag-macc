// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 9/11/2026 · Ζωντανή κατάσταση υποθέσεων/ψεκασμών ανά αγρό (πρόθεμα CS9).
// scope {ids:[...]}: για κάθε αγρό, από το τελευταίο field_bundle, ώρα/έκδοση, σφραγίδα σπόρου, κλειδιά υπόθεσης (l), τελευταίου
// ψεκασμού (m), τέλους προστασίας (n) ανά καλλιέργεια, και ο δακτύλιος διαφωνίας αισθητήρα φύλλου. Δεν γράφει τίποτα.
// Χρήση: φίλτρο σπόρων αναδρομικών ειδοποιήσεων (πριν) και επαλήθευση της εφαρμογής τους (μετά τον κύκλο).
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "CS9|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
let S = {}; try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); S = (Array.isArray(s) ? s[0] : s) || {}; } catch (_e) {}
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  for (const id of (S.ids || [])) {
    try {
      const b = (await get(`/device/${id}/data?variables=field_bundle&qty=1`))[0];
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      const out = { _t: b.time, _k: val((o.shared || {}).kernel_version), _seed: val((o.shared || {}).case_seed_applied) };
      for (const [box, tag] of [[o.shared || {}, "sh"], ...(o.crops || []).map((c) => [c.indicators || {}, String(c.id).split(":")[1]])]) {
        for (const k of Object.keys(box)) if (/^[lmn]\d\d$/.test(k) || k === "leaf_disagree_ring" || k === "leaf_sensor_disagrees") out[tag + "." + k] = val(box[k]);
      }
      console.log(P + "F|" + id + "|" + JSON.stringify(out));
    } catch (e) { console.log(P + "ERR|" + id + "|" + e.message.slice(0, 80)); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
