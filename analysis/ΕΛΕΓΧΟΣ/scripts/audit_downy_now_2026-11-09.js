// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 9/11/2026 · Περονόσπορος ΤΩΡΑ σε όλους τους αγρούς-ξενιστές (πρόθεμα DN9).
// Ανά αγρό με κάρτα περονοσπόρου (αμπέλι i00, ντομάτα/πατάτα i02, κρεμμύδι i17, κολοκυνθοειδή i18, λάχανα i22):
//   κάρτα (βαθμίδα + κείμενο), μετρητής ωρών μόλυνσης, μέγιστο, FIR, PEI, υπόθεση, ψεκασμός/προστασία,
//   πηγή διαβροχής, οροφή υγρασιομέτρου, κολλημένος αισθητήρας φύλλου.
// Και ανά όργανο αέρα/φύλλου του αγρού, 7 νύχτες (18:00–08:00 ώρα Ελλάδας): ώρες RH ≥ 90, ώρες RH ≥ (μέγιστο−1),
//   μέγιστο RH, ώρες φύλλου > 15 %, μέγιστο φύλλου. Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "DN9|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const txt = (x) => (x && typeof x === "object" && x.metadata && x.metadata.text ? String(x.metadata.text) : "");
const DOWNY = { "00": "plasmopara_viticola", "02": "phytophthora_infestans", "17": "peronospora_destructor", "18": "pseudoperonospora_cubensis", "22": "brassica_downy_mildew" };
// γράμματα προθεμάτων του _SAG_KEYMAP_PREFIXES: a=ώρες μέγ., b=ώρες, i=κάρτα, j=fir, k=pei, l=υπόθεση, m=τελευταίος ψεκασμός, n=τέλος προστασίας
const F = { a: "ihmax", b: "ih", j: "fir", k: "pei", l: "case", m: "spray", n: "prot" };
const night = (iso) => { const t = Date.parse(iso) + 2 * 3600e3; const d = new Date(t); const h = d.getUTCHours(); if (h >= 8 && h < 18) return null; const base = new Date(t - (h < 8 ? 864e5 : 0)); return base.toISOString().slice(5, 10); };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const st = new Date(Date.now() - 7 * 864e5).toISOString();
  for (const f of fields) {
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; if (!b || !b.metadata || !b.metadata.data) continue;
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      const sh = o.shared || {}; const rows = [];
      for (const cr of o.crops || []) {
        const ind = cr.indicators || {}; const g = (k) => (k in ind ? ind[k] : sh[k]);
        for (const c of Object.keys(DOWNY)) {
          if (g("i" + c) === undefined) continue;
          const extra = Object.keys(F).map((L) => { const x = g(L + c); return x === undefined ? "" : F[L] + "=" + JSON.stringify(val(x)).slice(0, 60); }).filter(Boolean).join(" ");
          rows.push(String(cr.id).split(":")[1] + "/" + DOWNY[c] + "|" + val(g("i" + c)) + "|" + extra + "|txt=" + txt(g("i" + c)).slice(0, 260));
        }
      }
      if (!rows.length) continue;
      const g0 = (k) => { for (const cr of o.crops || []) { const ind = cr.indicators || {}; if (k in ind) return ind[k]; } return sh[k]; };
      let c = {}; try { c = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
      const name = String(tag(f, "name") || f.name).slice(0, 30);
      console.log(P + "F|" + name + "|cov=" + c.covered_cultivation + "|age=" + Math.round((Date.now() - Date.parse(b.time)) / 6e4)
        + "|src=" + val(g0("leaf_wetness_source")) + "|ceil=" + JSON.stringify(val(g0("rh_instrument_ceiling"))) + "|stuck=" + JSON.stringify(val(g0("leaf_sensor_stuck_dry")))
        + "|ims=" + String(val(g0("infection_model_status"))).slice(0, 40) + "|" + txt(g0("infection_model_status")).slice(0, 160));
      for (const r of rows) console.log(P + "C|" + name + "|" + r);
      let dv = {}; try { dv = JSON.parse(tag(f, "devices") || "{}") || {}; } catch (_e) {}
      for (const id of [...new Set(Object.values(dv).filter((x) => typeof x === "string"))]) {
        try {
          const d = await get(`/device/${id}?fields=id,tags`); const ty = String(tag(d, "type") || "");
          const hv = /s2120/.test(ty) ? "air_humidity" : /em3/.test(ty) ? "humidity" : /lms01/.test(ty) ? "leaf_moisture" : null; if (!hv) continue;
          const rs = await get(`/device/${id}/data?variables=${hv}&qty=3000&start_date=${st}`);
          const mx = rs.reduce((m, r) => Math.max(m, Number(r.value) || 0), 0);
          const N = {};
          for (const r of rs) { const n = night(r.time); if (!n) continue; const v = Number(r.value); if (!Number.isFinite(v)) continue; const hr = String(r.time).slice(0, 13); const e = N[n] || (N[n] = { a: new Set(), b: new Set(), m: 0 });
            if (hv === "leaf_moisture") { if (v > 15) e.a.add(hr); } else { if (v >= 90) e.a.add(hr); if (v >= mx - 1) e.b.add(hr); } e.m = Math.max(e.m, v); }
          const s = Object.keys(N).sort().map((n) => n + ":" + N[n].a.size + (hv === "leaf_moisture" ? "" : "/" + N[n].b.size) + "@" + N[n].m).join(" ");
          console.log(P + "D|" + name + "|" + ty + "|" + id.slice(-4) + "|n=" + rs.length + "|max7d=" + mx + "|last=" + (rs[0] ? String(rs[0].time).slice(5, 16) + "=" + rs[0].value : "-") + "|" + s);
        } catch (e) { console.log(P + "D|" + name + "|ERR " + e.message.slice(0, 60)); }
      }
    } catch (e) { console.log(P + "ERR|" + f.id + "|" + e.message.slice(0, 80)); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
