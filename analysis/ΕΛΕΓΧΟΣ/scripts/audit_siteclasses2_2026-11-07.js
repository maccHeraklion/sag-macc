// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Ανά εγγραφή αγρού: δηλωμένος σκοπός, κάλυψη (ετικέτα ή φόρμα, όπως ο πυρήνας), κατάσταση στον πίνακα στόλου. Από τις ετικέτες διαβάζει ΜΟΝΟ field_purpose και covered_cultivation. Δεν γράφει τίποτα, δεν τυπώνει θέσεις.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G17|"; const O = "6a98855ca06e41000bfae024";
const COV = ["true", "ναι", "θερμοκήπιο", "θερμοκηπιο", "greenhouse", "1"];
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const map = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seen = new Map(); for (const r of map) { const m = r.metadata || {}; if (!seen.has(m.i)) seen.set(m.i, m); }
  const ff = await get(`/device/${O}/data?variables[]=fleet_field&qty=130`); const fl = {}; for (const r of ff) { let t = {}; try { t = JSON.parse((r.metadata || {}).text || "{}"); } catch (e) {} if (t.i && !fl[t.i]) fl[t.i] = { s: (r.metadata || {}).state, p: t.p, g: (t.g || []).length, z: (t.z || []).length, a: (t.a || []).length, nc: t.nc }; }
  const tally = {};
  for (const [id, m] of seen) {
    const d = await get(`/device/${id}?fields[]=tags`).catch(() => ({})); const t = d.tags || []; const v = (k) => (t.find((x) => x.key === k) || {}).value;
    const c = await get(`/device/${id}/data?variables[]=configuration&qty=1`).catch(() => []); const cm = ((c[0] || {}).metadata) || {};
    const raw = v("covered_cultivation") !== undefined ? v("covered_cultivation") : cm.covered_cultivation; const covered = COV.includes(String(raw == null ? "" : raw).trim().toLowerCase());
    const ts = (m.dv || []).map((x) => String(x.t || "").toLowerCase()); const f = fl[String(id).slice(-6)] || {}; const hotel = /volta/i.test(String(m.c || ""));
    const station = ts.length > 0 && ts.every((x) => /s2120/.test(x)); const cls = hotel ? "ξενοδοχείο" : covered ? "θερμοκήπιο" : station ? "σταθμός" : ts.length && ts.every((x) => /uc5|ws558/.test(x)) ? "μόνο βάνα" : "τυπικός αγρός";
    const key = cls + "|σκοπός " + (v("field_purpose") || "χωρίς ετικέτα"); tally[key] = (tally[key] || 0) + 1;
    if (cls !== "τυπικός αγρός") console.log(P + "ΕΓΓΡΑΦΗ|" + cls + "|" + m.n + "|σκοπός " + (v("field_purpose") || "-") + "|στόλος " + (f.s || "-") + "|p " + (f.p || "-") + "|κενά ρύθμισης " + (f.g === undefined ? "-" : f.g) + "|καλλιέργεια " + String(cm.cultivation_type || cm.crop || "-").slice(0, 24) + "|κάλυψη " + (raw === undefined ? "-" : String(raw).slice(0, 14)));
  }
  for (const k of Object.keys(tally).sort()) console.log(P + "ΣΥΝΟΛΟ|" + k + "|" + tally[k]);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
