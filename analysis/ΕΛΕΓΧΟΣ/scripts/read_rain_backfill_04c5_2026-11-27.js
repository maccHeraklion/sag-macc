// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · T-RAIN-BACKFILL-01 βήμα 3: ωμά δεδομένα βροχής Σκοτίνας Πάνω (04c5)
// για το διάστημα χωρίς καμία εγγραφή βροχής (1/5/2026 → πρώτη εγγραφή v33). Τυπώνει συμπιεσμένα ανά ημέρα: για κάθε ώρα UTC
// «ώρα:άθροισμα:πρώτο λεπτό:τελευταίο λεπτό:δείγματα». Και τις υπάρχουσες εγγραφές ημέρας/εβδομάδας/μήνα του ορίου.
// Παράμετροι BF_FROM/BF_TO (env) για δεύτερο κομμάτι (3/8–17/8: ωριαίες ως την πρώτη ωριαία εγγραφή v33).
// Κόστος ≈ 95 ημέρες × ~160 δείγματα ≈ 15 χιλ. + ~100. Πολιτική 6ac171e0. Καμία εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ID = "67f3ec9f30b56a00090d20d6";
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
const rec = (x) => [x.time, x.value, (x.metadata || {}).period_start_utc, (x.metadata || {}).period_end_utc, (x.metadata || {}).alg || "v33", (x.metadata || {}).source_variable || ""].join("~");
(async () => {
  console.log("Β4=== 04c5 ωμά βροχής · " + new Date().toISOString() + " ===");
  const first = {};
  for (const v of ["rain_height_hourly", "rain_height_daily", "rain_height_weekly", "rain_height_monthly", "rain_height_yearly"]) {
    const r = await get(`/device/${ID}/data?` + q({ variable: v, qty: 1, ordination: "ascending", start_date: "2026-01-01T00:00:00Z" }));
    first[v] = r && r[0] ? r[0] : null;
    console.log("Β40|" + v + "|πρώτη " + (first[v] ? rec(first[v]) : "—"));
  }
  const firstRain = await get(`/device/${ID}/data?` + q({ variable: "rain_height", qty: 1, ordination: "ascending" }));
  console.log("Β40|rain_height|πρώτο δείγμα " + (firstRain && firstRain[0] ? firstRain[0].time : "—"));
  const stopMs = first.rain_height_daily ? Date.parse(first.rain_height_daily.metadata.period_start_utc) : Date.parse("2026-10-05T00:00:00Z");
  // Υπάρχουσες εγγραφές γύρω από το όριο (μήνας του ορίου ±): ημέρες, εβδομάδες, μήνες
  const bS = new Date(stopMs - 40 * 86400000).toISOString(), bE = new Date(stopMs + 40 * 86400000).toISOString();
  for (const v of ["rain_height_daily", "rain_height_weekly", "rain_height_monthly"]) {
    const r = await get(`/device/${ID}/data?` + q({ variable: v, start_date: bS, end_date: bE, qty: 200, ordination: "ascending" }));
    console.log("Β41|" + v + "|" + (r || []).map(rec).join(" "));
  }
  const FROM = Date.parse(process.env.BF_FROM || "2026-05-01T00:00:00Z"), TO = Date.parse(process.env.BF_TO || new Date(stopMs).toISOString());
  for (let t = FROM; t < TO; t += 86400000) {
    const r = await get(`/device/${ID}/data?` + q({ variable: "rain_height", start_date: new Date(t).toISOString(), end_date: new Date(t + 86400000 - 1).toISOString(), qty: 2000, ordination: "ascending" }));
    const H = new Map();
    for (const x of r || []) {
      const ms = Date.parse(x.time), v = Number(x.value); if (!Number.isFinite(ms) || !Number.isFinite(v)) continue;
      const h = Math.floor((ms - t) / 3600000), m = Math.round((ms - t - h * 3600000) / 1000);
      const o = H.get(h) || { s: 0, a: m, b: m, n: 0 }; o.s += v; o.a = Math.min(o.a, m); o.b = Math.max(o.b, m); o.n++; H.set(h, o);
    }
    console.log("Β42|" + new Date(t).toISOString().slice(0, 10) + "|" + [...H].sort((a, b) => a[0] - b[0]).map(([h, o]) => h + ":" + Math.round(o.s * 1000) / 1000 + ":" + o.a + ":" + o.b + ":" + o.n).join(" "));
  }
  console.log(`Β4=== τέλος · εγγραφές ≈ ${N} ===`);
})();
