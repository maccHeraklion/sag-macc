// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · (1) κύκλος πυρήνα (2) τι έγραψε η 7857 μετά το φίλτρο (3) καλλιέργειες με ωίδιο στον στόλο, και αν έχουν δηλωμένη περίοδο (4) κάρτες αλατότητας. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "SC|"; const FLEET = "6a98855ca06e41000bfae024"; const DEV = "67fe9ae85fccdd000a4bdd42";
const HOST = ["wine_grapes", "table_grapes", "raisin_grapes", "cucumber", "zucchini", "melon", "watermelon", "tomato", "pepper", "eggplant", "artichoke", "strawberry", "apple", "wheat", "barley", "oats", "currants", "carob"];
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=2`)) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms);
    }
  } catch (e) { console.log(P + "ERR fleet|" + e.message); }
  try {
    const rows = await get(`/device/${DEV}/data?qty=120&ordination=descending`);
    const by = {};
    for (const r of rows) (by[r.group] = by[r.group] || { t: r.time, v: [] }).v.push(r.variable);
    const gs = Object.values(by).sort((a, b) => String(b.t).localeCompare(String(a.t)));
    for (const g of gs.slice(0, 5)) console.log(P + "7857|" + g.t + "|n=" + g.v.length + "|" + g.v.sort().join(",").slice(0, 420));
  } catch (e) { console.log(P + "ERR dev|" + e.message); }
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const crops = {}, st = {};
    for (const f of fields) {
      let c = {}; try { c = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
      const L = Array.isArray(c.crops) && c.crops.length ? c.crops : [c];
      for (const x of L) {
        const k = x.cultivation_type; if (!k) continue;
        const o = crops[k] = crops[k] || { n: 0, per: 0, cov: 0 };
        o.n++; if (x.periods && Object.keys(x.periods).length) o.per++; if (c.covered_cultivation) o.cov++;
      }
      try {
        const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
        if (!b || !b.metadata || !b.metadata.data) continue;
        const sh = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8")).shared || {};
        const s = sh.soil_ec_status; const v = s && typeof s === "object" ? s.value : s; if (v) st[v] = (st[v] || 0) + 1;
      } catch (_e) {}
    }
    console.log(P + "CROPS|όλες=" + JSON.stringify(crops).slice(0, 900));
    console.log(P + "HOSTS|" + HOST.filter((h) => crops[h]).map((h) => h + ":" + crops[h].n + "(περίοδος " + crops[h].per + ", καλυμμένα " + crops[h].cov + ")").join(" · "));
    console.log(P + "EC_STATUS|" + JSON.stringify(st).slice(0, 500));
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
