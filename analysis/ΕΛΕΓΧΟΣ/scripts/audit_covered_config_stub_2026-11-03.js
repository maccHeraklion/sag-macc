// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 3/11/2026 · Καλυμμένοι αγροί: το πακέτο φέρνει στέλεχος configuration που κρύβει την πλήρη ρύθμιση από το widget.
// Για κάθε αγρό με το στέλεχος: τι ρυθμίσεις δεν έφταναν στο widget. Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "CVS|";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  let n = 0, stub = 0;
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    for (const f of fields) {
      n++;
      try {
        const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
        if (!b || !b.metadata || !b.metadata.data) continue;
        const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
        const c = o.shared && o.shared.configuration;
        if (!c) continue;
        stub++;
        const row = (await get(`/device/${f.id}/data?variables=configuration&qty=1`))[0];
        let v = {}; try { v = row ? (typeof row.value === "string" ? JSON.parse(row.value) : row.value) : {}; } catch (_e) { v = { _err: 1 }; }
        console.log(P + "F|" + (tag(f, "name") || f.name) + "|sub=" + tag(f, "subscriptionActive") + "|έχει μεταβλητή=" + !!row + "|covered=" + v.covered_cultivation + "|μετρητής=" + v.has_water_meter + "|fert=" + v.fert_ecw_dsm + "|βάθη=" + v.soil_depth_count + "|θύρα=" + v.soil_depth_port + "|έδαφος=" + v.soil_type + "|lat=" + v.latitude);
      } catch (e) { console.log(P + "ERR|" + f.name + "|" + e.message); }
    }
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "SUM|αγροί=" + n + "|με στέλεχος=" + stub);
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
