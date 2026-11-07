// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Πόσες εγγραφές έχει κάθε περίπτωση (θερμοκήπιο, ξενοδοχείο, τυπικός αγρός, σταθμός καιρού) και με τι όργανα. Από τις ετικέτες διαβάζει ΜΟΝΟ το covered_cultivation και το substrate. Δεν γράφει τίποτα, δεν τυπώνει θέσεις.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G16|"; const O = "6a98855ca06e41000bfae024";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const has = (ts, re) => ts.some((t) => re.test(t));
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const map = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seen = new Map(); for (const r of map) { const m = r.metadata || {}; if (!seen.has(m.i)) seen.set(m.i, m); }
  const first = [...seen.values()][0] || {}; console.log(P + "ΚΛΕΙΔΙΑ ΧΑΡΤΗ|" + Object.keys(first).join(",") + "|κλειδιά οργάνου " + Object.keys((first.dv || [])[0] || {}).join(","));
  const cov = {}; let n = 0; for (const id of seen.keys()) { const d = await get(`/device/${id}?fields[]=tags`).catch(() => null); n++; if (!d) continue; const t = d.tags || []; const v = (k) => (t.find((x) => x.key === k) || {}).value; cov[id] = { c: v("covered_cultivation"), s: v("substrate"), isf: t.some((x) => x.key === "isField") }; }
  console.log(P + "ΕΤΙΚΕΤΕΣ ΔΙΑΒΑΣΤΗΚΑΝ|" + Object.keys(cov).length + "/" + n);
  const cls = { hotel: [], greenhouse: [], station: [], valveOnly: [], none: [], field: [] };
  for (const [id, m] of seen) { const ts = (m.dv || []).map((d) => String(d.t || "").toLowerCase()); const c = cov[id] || {}; const covered = /^(1|true|yes|ναι)$/i.test(String(c.c == null ? "" : c.c)); const soilLeaf = has(ts, /lse0|se0|lms01|em3|sph01|aglwpp/);
    const k = /volta/i.test(String(m.c || "")) ? "hotel" : covered ? "greenhouse" : !ts.length ? "none" : soilLeaf ? "field" : has(ts, /uc5|ws558/) ? "valveOnly" : ts.every((t) => /s2120/.test(t)) ? "station" : "field"; cls[k].push({ n: m.n, c: m.c, ts, sub: c.s }); }
  for (const k of Object.keys(cls)) { const a = cls[k], cnt = {}; for (const e of a) for (const t of new Set(e.ts)) cnt[t] = (cnt[t] || 0) + 1; console.log(P + "ΠΕΡΙΠΤΩΣΗ|" + k + "|εγγραφές " + a.length + "|αγροί με τύπο " + JSON.stringify(cnt) + "|πελάτες " + new Set(a.map((e) => e.c || "-")).size); if (k !== "field") console.log(P + "ΟΝΟΜΑΤΑ|" + k + "|" + a.map((e) => e.n + (e.sub ? " [υπόστρωμα]" : "")).join(" · ")); }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
