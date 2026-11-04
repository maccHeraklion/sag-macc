// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Ωίδιο σε πραγματικά δεδομένα: ένα πακέτο την ημέρα (12:00–13:00 UTC) για 30 ημέρες, σε αγρούς με αμπέλι, κολοκυνθοειδή ή σολανώδη.
// Μετρά τι έδειξε fir_message για τα 3 ωίδια. (2) κύκλος πυρήνα (3) κάρτες αλατότητας και ×2,5 (4) τελευταία πακέτα 7857. Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "ML|"; const FLEET = "6a98855ca06e41000bfae024"; const DEV = "67fe9ae85fccdd000a4bdd42";
const CODES = { erysiphe_necator: "i01", podosphaera_xanthii: "i09", leveillula_taurica: "i16" };
const HOST = ["wine_grapes", "table_grapes", "cucumber", "zucchini", "tomato", "pepper"];
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const inflate = (b) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=1`)) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms);
    }
    const rows = await get(`/device/${DEV}/data?qty=60&ordination=descending`);
    const by = {}; for (const r of rows) (by[r.group] = by[r.group] || { t: r.time, n: 0 }).n++;
    console.log(P + "7857|" + Object.values(by).sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 10).map((g) => String(g.t).slice(11, 16) + "=" + g.n).join(" "));
  } catch (e) { console.log(P + "ERR|" + e.message); }
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const tot = {}, per = {}; let days = 0; const st = {}; let x25 = 0;
    for (const f of fields) {
      let c = {}; try { c = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
      const L = Array.isArray(c.crops) && c.crops.length ? c.crops : [c];
      const name = tag(f, "name") || f.name;
      try {
        const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
        if (b && b.metadata && b.metadata.data) {
          const raw = zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8");
          if (raw.includes("×2,5")) x25++;
          const sh = JSON.parse(raw).shared || {}; const v = val(sh.soil_ec_status); if (v) st[v] = (st[v] || 0) + 1;
        }
      } catch (_e) {}
      if (!L.some((x) => HOST.includes(x.cultivation_type))) continue;
      for (let d = 1; d <= 30; d++) {
        const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
        try {
          const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1&start_date=${day}T12:00:00Z&end_date=${day}T13:00:00Z`))[0];
          if (!b || !b.metadata || !b.metadata.data) continue;
          days++;
          for (const cr of inflate(b).crops || []) {
            const ind = cr.indicators || {};
            for (const [k, code] of Object.entries(CODES)) {
              const m = ind[code] || ind["fir_message_" + k]; if (!m) continue;
              const v = String(val(m));
              const key = k + "|" + (cr.cultivation_type || cr.id || "?");
              (tot[key] = tot[key] || {})[v] = (tot[key][v] || 0) + 1;
              if (/^Σοβαρ/.test(v)) per[name] = (per[name] || 0) + 1;
            }
          }
        } catch (_e) {}
      }
    }
    console.log(P + "ΗΜΕΡΕΣ_ΠΑΚΕΤΩΝ=" + days);
    for (const [k, v] of Object.entries(tot)) console.log(P + "M|" + k + "|" + JSON.stringify(v));
    console.log(P + "ΑΓΡΟΙ_ΣΟΒΑΡΟΣ|" + JSON.stringify(per).slice(0, 700));
    console.log(P + "EC|με ×2,5=" + x25 + "|" + JSON.stringify(st).slice(0, 500));
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
