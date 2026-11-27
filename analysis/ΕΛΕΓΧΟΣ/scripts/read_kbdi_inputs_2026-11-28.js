// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · T-KBDI-FIX-01: έλεγχος εισόδων της kbdi-v2 σε έναν σταθμό (Γρίβα).
// (1) aggregate hour max/min: σε ποιο σημείο της ώρας μπαίνει ο χρόνος· σύγκριση με τα ωμά της ίδιας ημέρας.
// (2) rain_height_daily των τελευταίων ημερών (περίοδοι ημέρας Ελλάδας). (3) οι τελευταίες εγγραφές kbdi1 (v1).
// Κόστος < 1.000 εγγραφές. Πολιτική 6ac171e0. Καμία εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ID = "67f426a236b2df000a053948";
const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
async function get(p) { const r = await fetch(API + p, { headers: { Authorization: TOKEN } }); const j = await r.json(); if (!j.status) throw new Error(JSON.stringify(j.message)); return j.result; }
(async () => {
  console.log("ΚΒ=== είσοδοι kbdi-v2 · " + new Date().toISOString() + " ===");
  const S = "2026-11-20T00:00:00Z", E = "2026-11-20T23:59:59Z";
  const ag = await get(`/device/${ID}/data?` + q({ variable: "air_temperature", query: "aggregate", interval: "hour", function: "max", start_date: S, end_date: E }));
  const raw = await get(`/device/${ID}/data?` + q({ variable: "air_temperature", start_date: S, end_date: E, qty: 400, ordination: "ascending" }));
  const byH = new Map(); for (const x of raw) { const h = x.time.slice(0, 13); byH.set(h, Math.max(byH.has(h) ? byH.get(h) : -1e9, Number(x.value))); }
  console.log("ΚΒ1|aggregate " + ag.length + " · " + ag.slice(0, 4).map((x) => x.time + "=" + x.value).join(" ") + " | ωμά μέγιστα ανά ώρα UTC: " + [...byH].slice(0, 4).map(([h, v]) => h + "=" + v).join(" ") + " | ωμά δείγματα " + raw.length);
  const rh = await get(`/device/${ID}/data?` + q({ variable: "air_humidity", query: "aggregate", interval: "hour", function: "min", start_date: S, end_date: E }));
  console.log("ΚΒ2|rh min aggregate " + rh.length + " · " + rh.slice(0, 3).map((x) => x.time + "=" + x.value).join(" "));
  const rd = await get(`/device/${ID}/data?` + q({ variable: "rain_height_daily", start_date: "2026-11-20T00:00:00Z", qty: 20, ordination: "ascending" }));
  console.log("ΚΒ3|rain_height_daily · " + rd.map((x) => (x.metadata || {}).period_start_utc + "→" + x.value + "(" + ((x.metadata || {}).alg || "v33") + "," + (x.metadata || {}).coverage + ")").join(" "));
  const kb = await get(`/device/${ID}/data?` + q({ variable: "kbdi1", qty: 3 }));
  console.log("ΚΒ4|kbdi1 τελευταίες · " + kb.map((x) => x.time + "=" + x.value + " " + JSON.stringify(x.metadata || {}).slice(0, 60)).join(" | "));
  console.log("ΚΒ=== τέλος ===");
})();
