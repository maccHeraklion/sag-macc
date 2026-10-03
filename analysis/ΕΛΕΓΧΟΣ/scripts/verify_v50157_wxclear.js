// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · επαλήθευση v50.157 (T-WXCLEAR-01) στο τελευταίο bundle ΚΑΘΕ αγρού.
// Πολιτική 6ac171e063d4f4000b05d9e5 (προσωρινή). Γράφει ΜΙΑ γραμμή ανά αγρό + σύνοψη.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const st = (e) => e === undefined ? "απόν" : (e && (e.value === null || e.value === undefined || e.value === "")) ? "κενό" : "ΤΙΜΗ:" + String(e && e.value).slice(0, 14);
(async () => {
  console.log("=== ΕΠΑΛΗΘΕΥΣΗ v50.157 · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name");
  const tally = { fresh: 0, old: 0, none: 0, frost: {}, heat: {}, rain: {}, inf: {}, bytes: [] };
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const d of devs) {
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) { tally.none++; continue; }
      const ageMin = Math.round((Date.now() - Date.parse(e.time)) / 60000);
      if (ageMin > 30) { tally.old++; console.log("OLD|" + d.name + "|" + e.time); continue; }
      tally.fresh++;
      const raw = String(e.metadata && e.metadata.data || ""); tally.bytes.push(raw.length);
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(raw, "base64")).toString("utf8"));
      const sh = o.shared || {}; const cr = o.crops || [];
      const fr = st(sh.weather_alert_frost), ra = st(sh.rain_ahead);
      inc(tally.frost, fr); inc(tally.rain, ra);
      const hs = cr.map(c => st((c.indicators || {}).weather_alert_heat)); const is = cr.map(c => st((c.indicators || {}).infection_ahead));
      hs.forEach(x => inc(tally.heat, x)); is.forEach(x => inc(tally.inf, x));
      const fc = sh.forecast_status ? String(sh.forecast_status.value) : "—";
      console.log(`F|${d.name}|${e.time.slice(11, 16)}|fc=${fc}|frost=${fr}|rain=${ra}|heat=${hs.join(",")}|inf=${is.join(",")}|b64=${raw.length}|fresh=${sh.bundle_freshness ? sh.bundle_freshness.value : "-"}`);
    } catch (x) { console.log("ERR|" + d.name + "|" + x.message); }
  }
  const mx = tally.bytes.length ? Math.max(...tally.bytes) : 0;
  console.log("SUM|αγροί=" + devs.length + "|φρέσκα=" + tally.fresh + "|παλιά=" + tally.old + "|χωρίς=" + tally.none
    + "|frost=" + JSON.stringify(tally.frost) + "|rain=" + JSON.stringify(tally.rain) + "|heat=" + JSON.stringify(tally.heat)
    + "|inf=" + JSON.stringify(tally.inf) + "|max b64=" + mx);
  console.log("=== ΤΕΛΟΣ ===");
})();
