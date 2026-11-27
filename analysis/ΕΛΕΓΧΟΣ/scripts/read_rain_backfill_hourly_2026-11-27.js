// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · T-RAIN-BACKFILL-01 βήμα 2: ωριαίες τιμές v33 έναντι ημερήσιου αθροίσματος ρυθμού.
// Ανά S2120 και μήνα (1/5–4/10/2026): ημερήσιο άθροισμα rain_height (aggregate) και ΜΟΝΟ οι θετικές ωριαίες rain_height_hourly
// (conditional gt 0 — λίγες) και οι θετικές ημερήσιες rain_height_daily. Ανά βροχερή ημέρα: ρυθμός / Σ θετικών ωριαίων v33 / ημερήσια v33.
// Κόστος ≈ 42 × 157 + θετικές εγγραφές ≈ 8–10 χιλ. Πολιτική 6ac171e0. Καμία εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const WINS = [["2026-05-01", "2026-06-01"], ["2026-06-01", "2026-07-01"], ["2026-07-01", "2026-08-01"], ["2026-08-01", "2026-09-01"], ["2026-09-01", "2026-10-01"], ["2026-10-01", "2026-10-05"]];
let N = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(p) {
  for (let k = 0; k < 3; k++) {
    await sleep(250 + k * 2000);
    const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
    const j = await r.json().catch(() => ({}));
    if (j.status) { N += Array.isArray(j.result) ? j.result.length : 1; return j.result; }
    if (k === 2) throw new Error(r.status + " " + JSON.stringify(j.message || j).slice(0, 100));
  }
}
const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
const dk = (x) => String((x.metadata && x.metadata.period_start_utc) || x.time).slice(0, 10);
(async () => {
  console.log("ΒΩ=== ωριαία v33 έναντι ρυθμού · " + new Date().toISOString() + " ===");
  const devs = await get("/device?" + q({ "filter[tags][0][key]": "type", "filter[tags][0][value]": "s2120", amount: 200 }));
  const T = { st: 0, hBad: 0, mmH: 0 };
  for (const d of devs) {
    try {
      const day = new Map(), hp = new Map(), hn = new Map(), dp = new Map(); let v34h = 0;
      for (const [s, e] of WINS) {
        const S = s + "T00:00:00Z", E = e + "T00:00:00Z";
        for (const x of (await get(`/device/${d.id}/data?` + q({ variable: "rain_height", query: "aggregate", interval: "day", function: "sum", start_date: S, end_date: E }))) || [])
          day.set(String(x.time).slice(0, 10), Number(x.value));
        if (![...day.values()].some((v) => v > 0)) continue;
        for (const x of (await get(`/device/${d.id}/data?` + q({ variable: "rain_height_hourly", query: "conditional", function: "gt", value: 0, start_date: S, end_date: E }))) || []) {
          if (x.metadata && x.metadata.alg === "v34") { v34h++; continue; }
          const k = dk(x); hp.set(k, (hp.get(k) || 0) + Number(x.value)); hn.set(k, (hn.get(k) || 0) + 1);
        }
        for (const x of (await get(`/device/${d.id}/data?` + q({ variable: "rain_height_daily", query: "conditional", function: "gt", value: 0, start_date: S, end_date: E }))) || [])
          if (!(x.metadata && x.metadata.alg === "v34")) dp.set(dk(x), Math.max(dp.get(dk(x)) || 0, Number(x.value)));
      }
      const wet = [...day].filter(([, v]) => v > 0.05).sort();
      if (!wet.length) { console.log(`ΒΩ1|${d.name}|χωρίς βροχή ρυθμού`); continue; }
      const badH = wet.filter(([k, v]) => (hp.get(k) || 0) < v - 0.05), badD = wet.filter(([k, v]) => (dp.get(k) || 0) < v - 0.05);
      const mm = wet.reduce((s, [, v]) => s + v, 0), mmH = badH.reduce((s, [k, v]) => s + v - (hp.get(k) || 0), 0);
      if (badH.length) { T.st++; T.hBad += badH.length; T.mmH += mmH; }
      console.log(`ΒΩ1|${d.name}|${d.id}|βροχερές ${wet.length} ${mm.toFixed(1)} mm|ωριαία v33 λιγότερο ${badH.length} ημ. (−${mmH.toFixed(1)} mm)|ημερήσια v33 λιγότερο ${badD.length}|v34 ωριαίες ${v34h}|` +
        wet.slice(0, 40).map(([k, v]) => k.slice(5).replace("-", "") + ":" + v.toFixed(1) + "/" + (hp.get(k) || 0).toFixed(1) + "(" + (hn.get(k) || 0) + ")/" + (dp.get(k) || 0).toFixed(1)).join(" "));
    } catch (e) { console.log(`ΒΩ1|${d.name}|ΣΦ ${e.message}`); }
  }
  console.log(`ΒΩ9|σταθμοί με λάθος ωριαία ${T.st} · ημέρες ${T.hBad} · −${T.mmH.toFixed(1)} mm`);
  console.log(`ΒΩ=== τέλος · εγγραφές ≈ ${N} ===`);
})();
