// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Επαλήθευση ανεβάσματος και κύκλου v50.175: hash ζωντανού πυρήνα, fleet_summary, τρέχον μήνυμα ωιδίου στους αγρούς-ξενιστές. Δεν γράφει τίποτα.
const zlib = require("zlib"); const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "V175|"; const FLEET = "6a98855ca06e41000bfae024";
const CODES = { erysiphe_necator: "i01", podosphaera_xanthii: "i09", leveillula_taurica: "i16" };
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=1`)) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms);
    }
    const list = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const cnt = {}; let sample = ""; let maxLen = 0; let insp = 0;
    for (const f of list) {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`).catch(() => []))[0];
      if (!b || !b.metadata || !b.metadata.data) continue;
      maxLen = Math.max(maxLen, String(b.metadata.data).length);
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      for (const cr of o.crops || []) for (const [k, code] of Object.entries(CODES)) {
        const ind = cr.indicators || {}; const m = ind[code] || ind["fir_message_" + k]; if (!m) continue;
        const key = String(val(m));
        cnt[key] = (cnt[key] || 0) + 1;
        if (/επιθεωρ/i.test(JSON.stringify(m))) insp++;
        if (/επιθεωρ/i.test(JSON.stringify(m)) && !sample) sample = JSON.stringify(m).slice(0, 260);
      }
    }
    console.log(P + "ΩΙΔΙΟ|" + JSON.stringify(cnt));
    console.log(P + "ΕΠΙΘΕΩΡΗΣΗ=" + insp + "|ΔΕΙΓΜΑ|" + sample);
    console.log(P + "ΜΕΓΙΣΤΟ_BUNDLE=" + maxLen);
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
