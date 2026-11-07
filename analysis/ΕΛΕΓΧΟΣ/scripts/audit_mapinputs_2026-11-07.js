// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Τι έχουμε για ενιαίο χάρτη: κλειδιά ετικετών αγρών, ομάδες παραγωγών από τα ταμπλό, κάλυψη lrrid ανά τύπο οργάνου, στήλες κάρτας πύλης.
// Τυπώνει ΜΟΝΟ ονόματα κλειδιών και πλήθη, όχι τιμές ετικετών (οι ετικέτες αισθητήρων έχουν κλειδιά συσκευής). Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "MI|"; const OVERSEER = "6a98855ca06e41000bfae024";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tagv = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields[]=id&fields[]=name&fields[]=tags");
  const keys = {}; const cfgKeys = {}; for (const f of fields) { for (const t of f.tags || []) keys[t.key] = (keys[t.key] || 0) + 1; try { for (const k of Object.keys(JSON.parse(String(tagv(f, "configuration") || "{}")))) if (/owner|farmer|produc|client|customer|user|name|group|παραγ/i.test(k)) cfgKeys[k] = (cfgKeys[k] || 0) + 1; } catch (e) { /* χωρίς */ } }
  console.log(P + "ΚΛΕΙΔΙΑ ΑΓΡΟΥ|" + Object.entries(keys).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + "=" + n).join(" "));
  console.log(P + "ΚΛΕΙΔΙΑ ΦΟΡΜΑΣ|" + (Object.entries(cfgKeys).map(([k, n]) => k + "=" + n).join(" ") || "κανένα"));
  try { const d = await get("/dashboard?amount=200&fields[]=id&fields[]=label&fields[]=tags"); const g = {}; for (const x of d) { const v = tagv(x, "dashboardGroup") || "(χωρίς)"; g[v] = (g[v] || 0) + 1; } console.log(P + "ΤΑΜΠΛΟ|" + d.length + "|ομάδες " + Object.entries(g).map(([k, n]) => k + "=" + n).join(" · ")); } catch (e) { console.log(P + "ΤΑΜΠΛΟ|χωρίς πρόσβαση: " + e.message); }
  const s = await get(`/device/${OVERSEER}/data?variables[]=gateway_summary&qty=1`); const m = (s[0] || {}).metadata || {};
  console.log(P + "ΣΥΝΟΨΗ ΠΥΛΩΝ|" + (s[0] || {}).time + "|ορατά=" + m.total + " ζωντανά=" + m.alive + " αραιά=" + m.suspect + " χωρίς μάρτυρα=" + m.dead + "|αισθητήρες με lrrid=" + m.sensors_seen + " από " + m.sensors_total);
  const st = await get(`/device/${OVERSEER}/data?variables[]=gateway_scan_state&qty=1`); const ids = String(((st[0] || {}).metadata || {}).ids || "").split(",").filter(Boolean);
  const by = {}; for (const id of ids) { try { const x = await get(`/device/${id}?fields[]=tags`); const t = String(tagv(x, "type") || "χωρίς τύπο"); by[t] = (by[t] || 0) + 1; } catch (e) { by["σφάλμα"] = (by["σφάλμα"] || 0) + 1; } }
  console.log(P + "LRRID ΑΝΑ ΤΥΠΟ|" + Object.entries(by).map(([k, n]) => k + "=" + n).join(" "));
  const r = await get(`/device/${OVERSEER}/data?variables[]=gateway_roster&qty=1`); const l = (((r[0] || {}).metadata || {}).list) || []; console.log(P + "ΚΑΤΑΛΟΓΟΣ ΠΥΛΩΝ|" + l.length + "|με θέση=" + l.filter((x) => x.lat != null).length + "|αποθήκη=" + l.filter((x) => x.storage).length + "|σύγκρουση=" + l.filter((x) => x.conflict).length);
  const ff = await get(`/device/${OVERSEER}/data?variables[]=fleet_field&qty=1`); let o = {}; try { o = JSON.parse(((ff[0] || {}).metadata || {}).text || "{}"); } catch (e) { o = {}; } console.log(P + "ΚΑΡΤΑ ΑΓΡΟΥ|κλειδιά " + Object.keys(o).join(",") + "|d[0] κλειδιά " + (o.d && o.d[0] ? Object.keys(o.d[0]).join(",") : "-"));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
