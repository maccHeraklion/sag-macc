// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 3/11/2026 · Κοκοφοίνικας: διάγραμμα «Αγωγιμότητα εδάφους Βαθύ» 1,2 vs κάρτα
// «EC στη ρίζα Βαθύ» 4,90 mS/cm. (1) ρύθμιση αγρού (υπόστρωμα, βάθη), (2) σόνδα: conduct/υγρασία/θερμοκρασία ανά κανάλι,
// τελευταίες 24 τιμές + πλήθος/ελάχιστο/μέγιστο/μέσος από 9/9, (3) σειρές του αγρού soil_ec_pore*/soil_ece*/history_data,
// (4) bundle shared: soil_ec_* και κείμενα υποστρώματος. Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "EKK|";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const hm = (t) => String(t).slice(5, 16).replace("T", " ");
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const f = fields.find((x) => /Κοκοφοίνικα/.test(tag(x, "name") || x.name));
    if (!f) { console.log(P + "ERR|δεν βρέθηκε αγρός"); return; }
    let conf = {}; try { conf = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
    const pick = {}; for (const k of Object.keys(conf)) if (/substrate|medium|depth|soil_type|cultivation|covered|fert|water_ecw|soil_ref/.test(k)) pick[k] = conf[k];
    console.log(P + "CONF|" + f.id + "|" + JSON.stringify(pick).slice(0, 700));
    let devs = {}; try { devs = JSON.parse(tag(f, "devices") || "{}"); } catch (_e) {}
    console.log(P + "DEVS|" + Object.keys(devs).join(", "));
    const since = "2026-09-09T00:00:00Z";
    for (const [nm, id] of Object.entries(devs)) {
      let d; try { d = await get(`/device/${id}`); } catch (_e) { continue; }
      const ty = String(tag(d, "type") || "");
      if (!/se0x|lse0|lse02/.test(ty)) continue;
      console.log(P + "DEV|" + nm + "|" + ty);
      for (const v of ["conduct_soil2", "conduct_soil1", "soil_moisture2", "soil_moisture1", "soil_temperature2"]) {
        try {
          const rows = await get(`/device/${id}/data?variables=${v}&qty=600&start_date=${since}&ordination=descending`);
          const vals = rows.map((r) => Number(r.value)).filter(Number.isFinite);
          const zero = vals.filter((x) => x === 0).length;
          const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
          console.log(P + "S|" + v + "|n=" + rows.length + "|μηδενικά=" + zero + "|min=" + Math.min(...vals) + "|max=" + Math.max(...vals) + "|μέσος=" + mean.toFixed(2)
            + "|πρώτη=" + (rows.length ? hm(rows[rows.length - 1].time) : "—") + "|τελευταία=" + (rows.length ? hm(rows[0].time) : "—"));
          console.log(P + "L|" + v + "|" + rows.slice(0, 14).map((r) => hm(r.time).slice(6) + "=" + r.value).join(" "));
          // κενά > 6 ω (πού σταμάτησε/ξεκίνησε)
          const gaps = [];
          for (let i = 1; i < rows.length; i++) { const g = (Date.parse(rows[i - 1].time) - Date.parse(rows[i].time)) / 3600e3; if (g > 6) gaps.push(hm(rows[i].time) + "→" + hm(rows[i - 1].time) + " (" + g.toFixed(0) + "ω)"); }
          if (gaps.length) console.log(P + "G|" + v + "|" + gaps.slice(0, 6).join(" · "));
        } catch (e) { console.log(P + "ERR|" + v + "|" + e.message); }
      }
    }
    for (const v of ["soil_ec_pore2", "soil_ec_pore1", "soil_ece2", "soil_ec_raw2"]) {
      try {
        const rows = await get(`/device/${f.id}/data?variables=${v}&qty=10&ordination=descending`);
        console.log(P + "F|" + v + "|n=" + rows.length + "|" + rows.slice(0, 6).map((r) => hm(r.time) + "=" + r.value).join(" "));
      } catch (e) { console.log(P + "ERR|" + v + "|" + e.message); }
    }
    try {
      const b = await get(`/device/${f.id}/data?variables=field_bundle&qty=1`);
      const e = b && b[0];
      if (e) {
        const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
        const sh = o.shared || {};
        const ks = Object.keys(sh).filter((k) => /soil_ec|soil_ece|substrate|conduct/.test(k));
        console.log(P + "B|" + hm(e.time) + "|" + ks.map((k) => k + "=" + JSON.stringify(sh[k] && sh[k].value) + (sh[k] && sh[k].metadata && sh[k].metadata.text ? "[" + String(sh[k].metadata.text).slice(0, 160) + "]" : "")).join(" ‖ ").slice(0, 1800));
      }
    } catch (e) { console.log(P + "ERR|bundle|" + e.message); }
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
