// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 9/11/2026 · Ωριαία εξαγωγή 7 ημερών για επανάληψη περονοσπόρου (πρόθεμα DH9).
// Για κάθε αγρό με καλλιέργεια-ξενιστή περονοσπόρου και ζωντανό όργανο αέρα: ανά ώρα Ελλάδας
//   [ώρα, T s2120, RH s2120, T em3xx, RH em3xx, RH μέγ. ώρας, φύλλο μέγ. ώρας, φύλλο τελευταίο, θερμ. φύλλου, βροχή μέγ.].
// Μία γραμμή ανά αγρό-ημέρα. Χωρίς ταυτότητες οργάνων. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "DH9|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const HOSTS = /tomato|potato|cucumber|zucchini|melon|watermelon|pumpkin|grapes|onion|cabbage|broccoli|cauliflower|lettuce/;
let S = {}; try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); S = (Array.isArray(s) ? s[0] : s) || {}; } catch (_e) {}
const DAYS = Number(S.days) || 7;
const loc = (iso) => { const d = new Date(Date.parse(iso) + 2 * 3600e3); return [d.toISOString().slice(0, 10), d.getUTCHours()]; };
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " days=" + DAYS);
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const st = new Date(Date.now() - DAYS * 864e5).toISOString();
  for (const f of fields) {
    let c = {}; try { c = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
    const crops = (Array.isArray(c.crops) && c.crops.length ? c.crops : [c]).map((x) => x.cultivation_type || "");
    if (!crops.some((x) => HOSTS.test(x))) continue;
    if (S.only && !String(S.only).split("|").some((x) => String(tag(f, "name") || f.name).includes(x))) continue;
    let dv = {}; try { dv = JSON.parse(tag(f, "devices") || "{}") || {}; } catch (_e) {}
    const H = {}; const cell = (iso) => { const [d, h] = loc(iso); const k = d + "|" + h; return H[k] || (H[k] = { d, h }); };
    const put = (rows, key, mode) => { for (const r of [...rows].reverse()) { const v = Number(r.value); if (!Number.isFinite(v)) continue; const e = cell(r.time); if (mode === "max") e[key] = Math.max(e[key] ?? -1, v); else e[key] = v; } };
    let have = false;
    for (const id of [...new Set(Object.values(dv).filter((x) => typeof x === "string"))]) {
      try {
        const d = await get(`/device/${id}?fields=id,tags`); const ty = String(tag(d, "type") || "");
        const q = async (v) => get(`/device/${id}/data?variables=${v}&qty=3000&start_date=${st}`);
        if (/s2120/.test(ty)) { const t = await q("air_temperature"); if (!t.length) continue; have = true; put(t, "Ts"); const h = await q("air_humidity"); put(h, "Hs"); put(h, "HsX", "max"); put(await q("rain_gauge"), "R", "max"); }
        else if (/em3/.test(ty)) { const t = await q("temperature"); if (!t.length) continue; have = true; put(t, "Te"); const h = await q("humidity"); put(h, "He"); put(h, "HeX", "max"); }
        else if (/lms01/.test(ty)) { const l = await q("leaf_moisture"); put(l, "LX", "max"); put(l, "LL"); put(await q("leaf_temperature"), "LT"); }
      } catch (e) { console.log(P + "ERR|" + e.message.slice(0, 60)); }
    }
    if (!have) continue;
    const name = String(tag(f, "name") || f.name).slice(0, 30);
    console.log(P + "F|" + name + "|cov=" + c.covered_cultivation + "|crops=" + crops.join(","));
    const byDay = {};
    for (const e of Object.values(H)) (byDay[e.d] = byDay[e.d] || []).push(e);
    const n = (x) => (x === undefined ? "" : +Number(x).toFixed(1));
    for (const d of Object.keys(byDay).sort()) {
      const s = byDay[d].sort((a, b) => a.h - b.h).map((e) => [e.h, n(e.Ts), n(e.Hs), n(e.Te), n(e.He), n(Math.max(e.HsX ?? -1, e.HeX ?? -1) < 0 ? undefined : Math.max(e.HsX ?? -1, e.HeX ?? -1)), n(e.LX), n(e.LL), n(e.LT), n(e.R)].join(",")).join(";");
      console.log(P + "R|" + name + "|" + d + "|" + s);
    }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
