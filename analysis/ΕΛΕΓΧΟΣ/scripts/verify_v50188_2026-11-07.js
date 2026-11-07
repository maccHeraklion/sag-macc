// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Έλεγχος παλμού v50.188 (T-FLEET-NC-01) και ανά περίπτωση: η κάλυψη από την ετικέτα configuration, όπως τη διαβάζει ο πυρήνας, και αν ο πίνακας στόλου βλέπει τα όργανα κάθε εγγραφής. Τυπώνει μόνο πλήθη, ναι/όχι και ονόματα αγρών. Δεν γράφει τίποτα, δεν τυπώνει θέσεις.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G19|"; const O = "6a98855ca06e41000bfae024";
const COV = ["true", "ναι", "θερμοκήπιο", "θερμοκηπιο", "greenhouse", "1"];
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fs = await get(`/device/${O}/data?variables[]=fleet_summary&qty=1`); for (const r of fs) { const m = r.metadata || {}; console.log(P + "ΣΥΝΟΨΗ|" + r.time + "|" + r.value + "|πυρήνας " + m.kernel + "|αγροί " + m.fields + "|όργανα " + m.devices + "|χωρίς ρύθμιση " + m.nocfg + "|ms " + m.ms + "|reads " + JSON.stringify(m.reads) + "|σφάλματα " + (m.errors || []).length); }
  const map = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seen = new Map(); for (const r of map) { const m = r.metadata || {}; if (!seen.has(m.i)) seen.set(m.i, m); }
  const ff = await get(`/device/${O}/data?variables[]=fleet_field&qty=130`); const fl = {}; for (const r of ff) { let t = {}; try { t = JSON.parse((r.metadata || {}).text || "{}"); } catch (e) {} if (t.i && !fl[t.i]) fl[t.i] = { s: (r.metadata || {}).state, nc: t.nc, d: (t.d || []).length, p: t.p }; }
  const tally = {};
  for (const [id, m] of seen) {
    const d = await get(`/device/${id}?fields[]=tags`).catch(() => ({})); const t = d.tags || []; const v = (k) => (t.find((x) => x.key === k) || {}).value;
    let cfg = null; try { cfg = JSON.parse(v("configuration")); } catch (e) {}
    const raw = v("covered_cultivation") !== undefined ? v("covered_cultivation") : (cfg || {}).covered_cultivation; const covered = COV.includes(String(raw == null ? "" : raw).trim().toLowerCase());
    const ts = (m.dv || []).map((x) => String(x.t || "").toLowerCase()); const f = fl[String(id).slice(-6)] || {}; const hotel = /volta/i.test(String(m.c || ""));
    const cls = hotel ? "ξενοδοχείο" : covered ? "θερμοκήπιο" : ts.length && ts.every((x) => /s2120/.test(x)) ? "σταθμός" : ts.length && ts.every((x) => /uc5|ws558/.test(x)) ? "μόνο βάνα" : "τυπικός αγρός";
    const silent = (m.dv || []).filter((x) => Number(x.h) > 48).length;
    const key = cls + "|ρύθμιση " + (cfg ? "ναι" : "όχι") + "|στόλος βλέπει όργανα " + (f.d > 0 ? "ναι" : "όχι") + "|κατάσταση " + (f.s || "-"); tally[key] = (tally[key] || 0) + 1;
    if (cls === "θερμοκήπιο" || cls === "σταθμός" || (silent && f.s === "ΕΝΤΑΞΕΙ")) console.log(P + "ΕΓΓΡΑΦΗ|" + cls + "|" + m.n + "|ρύθμιση " + (cfg ? "ναι" : "όχι") + "|nc " + (f.nc ? 1 : 0) + "|όργανα στόλου " + f.d + "|όργανα χάρτη " + ts.length + "|σιωπή >48ω " + silent + "|στόλος " + (f.s || "-") + "|καλλιέργειες " + (cfg && Array.isArray(cfg.crops) ? cfg.crops.length : "-"));
  }
  for (const k of Object.keys(tally).sort()) console.log(P + "ΣΥΝΟΛΟ|" + k + "|" + tally[k]);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
