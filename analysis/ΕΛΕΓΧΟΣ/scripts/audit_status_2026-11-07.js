// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Έλεγχος «έγιναν όλα;»: ρυθμός 0503 μετά το downlink, αγροί που δεν μετρούν ώρες μόλυνσης, αγροί/θέσεις χωρίς IPSI, κλειδιά ρύθμισης.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "ST7|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const unpack = (b) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  try { const rows = await get("/device/681c8f3d4f9c59000a0e267a/data?variables=air_temperature&qty=14"); const ts = rows.map((r) => Date.parse(r.time)).sort((a, b) => b - a); const g = []; for (let i = 0; i + 1 < ts.length; i++) g.push(Math.round((ts[i] - ts[i + 1]) / 60000)); console.log(P + "0503|last=" + new Date(ts[0]).toISOString().slice(11, 19) + "|κενά=" + g.join(",")); } catch (e) { console.log(P + "0503|ERR|" + e.message); }
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const now = Date.now(); let fresh = 0, stale = []; const noHours = [], noIpsi = [], src = {}; let slots = 0, slotsIpsi = 0; const purpose = {};
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name).slice(0, 26);
    const pu = String(tag(f, "field_purpose") || "—"); purpose[pu] = (purpose[pu] || 0) + 1;
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
      if (!b || !b.metadata || !b.metadata.data || (now - Date.parse(b.time)) / 3600000 > 1.2) { stale.push(nm); continue; }
      fresh++; const o = unpack(b);
      const c0 = ((o.crops || [])[0] || {}).indicators || {};
      const st = String(val(c0.infection_model_status)); const k = st.split(" ·")[0].split(" —")[0];
      src[k] = (src[k] || 0) + 1;
      if (!/^Ενεργές/.test(st)) noHours.push(nm + "=" + st.slice(0, 44));
      for (const c of o.crops || []) { slots++; const ip = (c.indicators || {}).plant_stress !== undefined || (c.indicators || {}).ipsi !== undefined; const v = String(val((c.indicators || {}).plant_stress)); if (ip && !/Μη διαθέσιμ|undefined/.test(v)) slotsIpsi++; else noIpsi.push(nm); }
    } catch (e) { console.log(P + "ERR|" + nm + "|" + e.message); }
  }
  console.log(P + "ΑΓΡΟΙ|σύνολο=" + fields.length + "|φρέσκοι=" + fresh + "|χωρίς φρέσκο bundle=" + stale.length + "|" + stale.join(", "));
  console.log(P + "ΜΟΝΤΕΛΟ|" + JSON.stringify(src));
  console.log(P + "ΧΩΡΙΣ_ΩΡΕΣ|" + noHours.length + "|" + noHours.join(" ; "));
  console.log(P + "IPSI|θέσεις=" + slots + "|με τιμή=" + slotsIpsi + "|χωρίς=" + Array.from(new Set(noIpsi)).join(", "));
  console.log(P + "PURPOSE|" + JSON.stringify(purpose));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
