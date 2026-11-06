// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 6/11/2026 · Αισθητήρες φύλλου όλου του στόλου, 14 ημέρες.
// Ερώτηση Μιχάλη: πώς αποφασίζεται η υγρασία κάθε ώρας, τι γίνεται σε κενό ή σε ένα «στεγνό» δείγμα, και πώς
// εντοπίζουμε αισθητήρα φύλλου που δυσλειτουργεί (Κουτσάκης: 2–11 % από 4/11 με ίδια υγρασία αέρα).
// Για κάθε ζεύγος (αισθητήρας φύλλου, αισθητήρας αέρα) βγάζει ΩΡΙΑΙΕΣ γραμμές στο :22 UTC (όπως ο πυρήνας):
//   lmLast,lmAge,n,nWet,lmMin,lmMax,ltLast,T,RH,RHmin,RHmax,nAir,airAge
// Συμπιεσμένο (deflateRaw + base64) σε κομμάτια, γιατί το console κόβει στα 64 KiB. Εκτέλεση σε μέρη: scope {part, parts}.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const P = "LW6|"; const DAYS = 14; const WET = 15;
let PART = 0, PARTS = 3;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc;
  if (o && Number.isFinite(Number(o.part))) PART = Number(o.part); if (o && Number(o.parts) > 0) PARTS = Number(o.parts); } catch (e) { /* χωρίς scope */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
async function series(id, v, from) {
  const r = await get(`/device/${id}/data?variable=${v}&start_date=${from}&qty=6000&ordination=ascending`);
  return (r || []).map((x) => ({ ms: Date.parse(x.time), v: Number(x.value) })).filter((p) => Number.isFinite(p.v) && Number.isFinite(p.ms)).sort((a, b) => a.ms - b.ms);
}
const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const f1 = (x) => (x === null || x === undefined || !Number.isFinite(x)) ? "" : String(Math.round(x * 10) / 10);
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " part " + PART + "/" + PARTS);
  const fromMs = Date.now() - DAYS * 86400000; const from = new Date(fromMs).toISOString();
  const leafDevs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=lms01_ls&amount=200&fields=id,name,tags");
  const leafIds = new Map(leafDevs.map((d) => [d.id, d.name]));
  console.log(P + "LEAFDEVS|" + leafDevs.length + "|" + leafDevs.map((d) => d.name).join(","));
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const typeCache = new Map(); const pairs = new Map();
  for (const f of fields) {
    const ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || [];
    const leaf = ids.filter((x) => leafIds.has(x)); if (!leaf.length) continue;
    let air = null, airType = null;
    for (const id of ids) { if (leafIds.has(id)) continue;
      if (!typeCache.has(id)) { try { const d = await get(`/device/${id}`); typeCache.set(id, { type: String(tag(d, "type") || ""), name: d.name }); } catch (e) { typeCache.set(id, { type: "", name: "?" }); } }
      const t = typeCache.get(id).type;
      if (t === "s2120") { air = id; airType = t; break; }
      if ((t === "em300_th" || t === "em320_th") && !air) { air = id; airType = t; } }
    const nm = tag(f, "name") || f.name;
    for (const l of leaf) { const key = l + "|" + (air || "-"); if (!pairs.has(key)) pairs.set(key, { leaf: l, air, airType, fields: [] }); pairs.get(key).fields.push(nm); }
  }
  const list = Array.from(pairs.values());
  console.log(P + "PAIRS|" + list.length + "|" + list.map((p, i) => i + ":" + leafIds.get(p.leaf) + "+" + (p.air ? typeCache.get(p.air).name + "(" + p.airType + ")" : "-") + "=" + p.fields.join("/")).join(" ; ").slice(0, 2500));
  const t0 = Math.ceil((fromMs - 22 * 60000) / 3600000) * 3600000 + 22 * 60000;
  for (let i = 0; i < list.length; i++) {
    if (i % PARTS !== PART) continue; const p = list[i];
    try {
      const LM = await series(p.leaf, "leaf_moisture", from), LT = await series(p.leaf, "leaf_temperature", from);
      const tv = p.airType === "s2120" ? "air_temperature" : "temperature", hv = p.airType === "s2120" ? "air_humidity" : "humidity";
      const AT = p.air ? await series(p.air, tv, from) : [], AH = p.air ? await series(p.air, hv, from) : [];
      const gap = (S) => { const g = []; for (let k = 1; k < S.length; k++) g.push((S[k].ms - S[k - 1].ms) / 60000); return f1(med(g)); };
      const rows = []; let a = 0, b = 0, c = 0, d = 0;
      for (let tk = t0; tk <= Date.now(); tk += 3600000) {
        const lo = tk - 3600000; let n = 0, nW = 0, mn = null, mx = null;
        while (a < LM.length && LM[a].ms <= tk) a++;
        for (let k = a - 1; k >= 0 && LM[k].ms > lo; k--) { n++; if (LM[k].v > WET) nW++; mn = mn === null ? LM[k].v : Math.min(mn, LM[k].v); mx = mx === null ? LM[k].v : Math.max(mx, LM[k].v); }
        const lmL = a > 0 ? LM[a - 1] : null;
        while (b < LT.length && LT[b].ms <= tk) b++; const ltL = b > 0 ? LT[b - 1] : null;
        while (c < AT.length && AT[c].ms <= tk) c++; const tL = c > 0 ? AT[c - 1] : null;
        while (d < AH.length && AH[d].ms <= tk) d++; const hL = d > 0 ? AH[d - 1] : null;
        let nA = 0, hmn = null, hmx = null; for (let k = d - 1; k >= 0 && AH[k].ms > lo; k--) { nA++; hmn = hmn === null ? AH[k].v : Math.min(hmn, AH[k].v); hmx = hmx === null ? AH[k].v : Math.max(hmx, AH[k].v); }
        rows.push([lmL ? f1(lmL.v) : "", lmL ? Math.round((tk - lmL.ms) / 60000) : "", n, nW, f1(mn), f1(mx), ltL ? f1(ltL.v) : "", tL ? f1(tL.v) : "", hL ? f1(hL.v) : "", f1(hmn), f1(hmx), nA, hL ? Math.round((tk - hL.ms) / 60000) : ""].join(","));
      }
      const z = zlib.deflateRawSync(Buffer.from(rows.join(";"), "utf8")).toString("base64");
      console.log(P + "H|" + i + "|" + leafIds.get(p.leaf) + "|" + (p.air ? typeCache.get(p.air).name : "-") + "|" + (p.airType || "-") + "|" + p.fields.join("/") + "|t0=" + t0 + "|rows=" + rows.length + "|nLM=" + LM.length + "|nAH=" + AH.length + "|gapLM=" + gap(LM) + "|gapAH=" + gap(AH) + "|z=" + z.length);
      for (let k = 0, j = 0; k < z.length; k += 2400, j++) console.log(P + "Z|" + i + "|" + j + "|" + z.slice(k, k + 2400));
    } catch (e) { console.log(P + "ERR|" + i + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ part " + PART);
})().catch((e) => console.log(P + "FATAL|" + e.message));
