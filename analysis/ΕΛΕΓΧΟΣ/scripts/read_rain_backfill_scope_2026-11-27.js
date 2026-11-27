// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · T-RAIN-BACKFILL-01 βήμα 1: εύρος επανυπολογισμού βροχής 1/5–4/10/2026.
// Για κάθε S2120: (α) πρώτη τιμή μετρητή rain_height_acc· (β) ημερήσιο άθροισμα rain_height (aggregate, 1 εγγραφή/ημέρα)·
// (γ) οι ημερήσιες εγγραφές rain_height_daily της v33 στο ίδιο διάστημα. Τυπώνει μέρες με βροχή όπου η v33 έγραψε λιγότερο.
// Κόστος ≈ 42 × (157 + 157) ≈ 13–14 χιλ. εγγραφές. Πολιτική 6ac171e0 (s2120). Καμία εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const S = "2026-05-01T00:00:00Z", E = "2026-10-05T00:00:00Z";
const WINS = [["2026-05-01", "2026-06-01"], ["2026-06-01", "2026-07-01"], ["2026-07-01", "2026-08-01"], ["2026-08-01", "2026-09-01"], ["2026-09-01", "2026-10-01"], ["2026-10-01", "2026-10-05"]];
let N = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(p) {
  for (let k = 0; k < 3; k++) {
    await sleep(300 + k * 2000);
    const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
    const j = await r.json().catch(() => ({}));
    if (j.status) { N += Array.isArray(j.result) ? j.result.length : 1; return j.result; }
    if (k === 2) throw new Error(r.status + " " + JSON.stringify(j.message || j).slice(0, 100));
  }
}
const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
(async () => {
  console.log("ΒΦ=== εύρος επανυπολογισμού βροχής · " + new Date().toISOString() + " ===");
  const devs = await get("/device?" + q({ "filter[tags][0][key]": "type", "filter[tags][0][value]": "s2120", amount: 200, fields: '["id","name"]' }));
  console.log("ΒΦ0|σταθμοί " + devs.length);
  let tot = { st: 0, days: 0, mm: 0, v33: 0 };
  for (const d of devs) {
    try {
      const a = await get(`/device/${d.id}/data?` + q({ variable: "rain_height_acc", qty: 1, ordination: "ascending" }));
      const accFirst = a && a[0] ? a[0].time : null;
      const day = new Map(), cnt = new Map();
      for (const [s, e] of WINS) {
        const r = await get(`/device/${d.id}/data?` + q({ variable: "rain_height", query: "aggregate", interval: "day", function: "sum", start_date: s + "T00:00:00Z", end_date: e + "T00:00:00Z" }));
        for (const x of r || []) day.set(String(x.time).slice(0, 10), Number(x.value));
      }
      const v33 = new Map(); let algs = {};
      const recs = await get(`/device/${d.id}/data?` + q({ variable: "rain_height_daily", start_date: S, end_date: "2026-10-06T00:00:00Z", qty: 400, ordination: "ascending" }));
      for (const x of recs || []) {
        const m = x.metadata || {}; const k = String(m.period_start_utc || x.time).slice(0, 10);
        const al = m.alg || ("v33/" + (m.source_variable || "?")); algs[al] = (algs[al] || 0) + 1;
        if (m.alg === "v34") continue;
        v33.set(k, Math.max(v33.has(k) ? v33.get(k) : -1, Number(x.value)));
      }
      const wet = [...day].filter(([, v]) => v > 0.0001).sort();
      const bad = wet.filter(([k, v]) => !(v33.get(k) >= v - 0.01));
      const mm = wet.reduce((s, [, v]) => s + v, 0), mmBad = bad.reduce((s, [, v]) => s + v, 0);
      if (bad.length) { tot.st++; tot.days += bad.length; tot.mm += mmBad; }
      console.log(`ΒΦ1|${d.name}|${d.id}|μετρητής από ${accFirst ? accFirst.slice(0, 10) : "—"}|ημέρες με ρυθμό ${day.size}|βροχερές ${wet.length} (${mm.toFixed(1)} mm)|v33 λιγότερο σε ${bad.length} (${mmBad.toFixed(1)} mm)|ημερήσιες εγγραφές ${JSON.stringify(algs)}|` +
        bad.slice(0, 60).map(([k, v]) => k.slice(5).replace("-", "") + ":" + v.toFixed(1) + "/" + (v33.has(k) ? v33.get(k).toFixed(1) : "—")).join(" "));
    } catch (e) { console.log(`ΒΦ1|${d.name}|ΣΦ ${e.message}`); }
  }
  console.log(`ΒΦ9|σύνολο: σταθμοί με λάθος ${tot.st} · ημέρες ${tot.days} · ${tot.mm.toFixed(1)} mm`);
  console.log(`ΒΦ=== τέλος · εγγραφές ≈ ${N} ===`);
})();
