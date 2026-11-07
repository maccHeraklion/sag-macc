// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Όλος ο στόλος: τελευταία θέση που έγραψε η ΦΟΡΜΑ (location με value=coords) έναντι τρέχουσας θέσης, ετικέτας και ρύθμισης, και απόσταση αγρού από τις πύλες που ακούνε τις σόνδες του.
// Δεν γράφει τίποτα. Τυπώνει μόνο θέσεις, ώρες, κωδικούς πυλών (4 ψηφία). Η έξοδος δεν μπαίνει στο δημόσιο repo.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "FP|"; const OVERSEER = "6a98855ca06e41000bfae024";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tv = (d, k) => (d.tags || []).filter((t) => String(t.key).toLowerCase() === k.toLowerCase()).map((t) => t.value);
const km = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) * r / 2), y = (b[0] - a[0]) * r; return R * Math.hypot(x, y); };
const pair = (s) => { const m = String(s || "").match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const f5 = (p) => (p ? p.map((x) => Number(x).toFixed(5)).join(",") : "-");
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const gwRows = await get(`/device/${OVERSEER}/data?variables[]=gateway_row&qty=200`); const gw = {}; for (const r of gwRows) { const l = r.metadata && r.metadata.location; if (!gw[r.value] && l && Number.isFinite(Number(l.lat))) gw[r.value] = [Number(l.lat), Number(l.lng)]; }
  const posCount = {}; for (const p of Object.values(gw)) { const k = f5(p); posCount[k] = (posCount[k] || 0) + 1; }
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields[]=id&fields[]=name&fields[]=tags");
  let lost = 0, noForm = 0, same = 0;
  for (const f of fields) {
    const nm = String(tv(f, "name")[0] || f.name || "").slice(0, 26); const tagP = pair(tv(f, "coordinates")[0]);
    let cfg = {}; try { cfg = JSON.parse(String(tv(f, "configuration")[0] || "{}")); } catch (e) { cfg = {}; } const cfgP = Number.isFinite(Number(cfg.latitude)) && cfg.latitude !== null && cfg.latitude !== "" ? [Number(cfg.latitude), Number(cfg.longitude)] : null;
    const rows = await get(`/device/${f.id}/data?variables[]=location&qty=200`); const pts = rows.filter((r) => r.location && r.location.coordinates).map((r) => ({ t: r.time, v: String(r.value || ""), p: [Number(r.location.coordinates[1]), Number(r.location.coordinates[0])] })).sort((a, b) => (a.t < b.t ? 1 : -1));
    const cur = pts[0] ? pts[0].p : null; const forms = pts.filter((x) => x.v === "coords"); const form = forms[0] || null; if (!form) noForm++;
    const differ = form && cur && km(form.p, cur) > 1; const older = forms.filter((x) => cur && km(x.p, cur) > 1); const everDiff = older[0] || null;
    if (!differ && !everDiff) { same++; continue; }
    let ids = []; try { ids = Object.values(JSON.parse(String(tv(f, "devices")[0] || "{}"))).flat().map(String); } catch (e) { ids = []; }
    const seen = {}; for (const id of ids.slice(0, 8)) { try { const x = await get(`/device/${id}/data?variables[]=lrrid&qty=1`); if (x[0]) seen[String(x[0].value)] = 1; } catch (e) { /* επόμενη */ } }
    const gws = Object.keys(seen).filter((k) => gw[k] && posCount[f5(gw[k])] === 1); const dist = (p) => (p && gws.length ? Math.min(...gws.map((k) => km(p, gw[k]))).toFixed(1) : "-");
    if (differ) lost++;
    console.log(P + "ΑΓΡΟΣ|" + f.id.slice(-6) + "|" + nm + "|τρέχουσα " + f5(cur) + " " + String(pts[0].t).slice(0, 16) + (pts[0].v === "coords" ? " φόρμα" : " όχι φόρμα") + "|ετικέτα " + f5(tagP) + "|ρύθμιση " + f5(cfgP) + "|τελευταία φόρμα " + (form ? f5(form.p) + " " + String(form.t).slice(0, 16) : "-") + "|παλιά φόρμα διαφορετική " + (everDiff ? f5(everDiff.p) + " " + String(everDiff.t).slice(0, 10) : "-") + "|πύλες " + (gws.map((k) => k.slice(-4)).join(",") || "-") + "|km πύλης από τρέχουσα " + dist(cur) + " από φόρμα " + dist(everDiff ? everDiff.p : (form && form.p)));
  }
  console.log(P + "ΣΥΝΟΛΟ|αγροί=" + fields.length + "|φόρμα ίδια με τρέχουσα ή χωρίς διαφορά=" + same + "|τελευταία φόρμα διαφέρει=" + lost + "|χωρίς εγγραφή φόρμας=" + noForm);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
