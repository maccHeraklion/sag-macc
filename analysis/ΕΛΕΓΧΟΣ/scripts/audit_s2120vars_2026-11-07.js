// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Τι φτάνει στους σταθμούς S2120: connectors, μεταβλητές τελευταίας ώρας, κλειδιά metadata, αν κάποιος σταθμός έχει ποτέ lrrid. Σύγκριση με σόνδα που το στέλνει.
// Τυπώνει μόνο ονόματα μεταβλητών, κλειδιά και πλήθη. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "SV|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tagv = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
async function vars(id, label) {
  const rows = await get(`/device/${id}/data?qty=150`); const c = {}; const mk = {}; for (const r of rows) { c[r.variable] = (c[r.variable] || 0) + 1; for (const k of Object.keys(r.metadata || {})) mk[k] = (mk[k] || 0) + 1; }
  console.log(P + label + "|μεταβλητές " + Object.keys(c).sort().join(",") + "|κλειδιά metadata " + (Object.keys(mk).join(",") || "κανένα"));
}
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const list = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=100&fields[]=id&fields[]=name&fields[]=connector&fields[]=network&fields[]=last_input");
  const by = {}; for (const d of list) { const k = String(d.connector).slice(-6) + "/" + String(d.network).slice(-6); (by[k] = by[k] || []).push(String(d.name).slice(-4)); }
  for (const [k, v] of Object.entries(by)) console.log(P + "CONNECTOR|" + k + "|" + v.length + "|" + v.slice(0, 12).join(","));
  let any = 0; for (const d of list) { try { const x = await get(`/device/${d.id}/data?variables[]=lrrid&variables[]=lrrrssi&variables[]=frequency&qty=1`); if (x.length) { any++; console.log(P + "ΕΧΕΙ|" + String(d.name).slice(-4) + "|" + x[0].variable + "|" + x[0].time); } } catch (e) { /* επόμενος */ } }
  console.log(P + "ΣΤΑΘΜΟΙ ΜΕ ΣΤΟΙΧΕΙΑ ΔΙΚΤΥΟΥ|" + any + " από " + list.length);
  await vars("684c39adfcf7b1000a8dd206", "047e");
  const s = list.find((d) => String(d.connector).slice(-6) !== "16aa5a"); if (s) await vars(s.id, "ΑΛΛΟΣ CONNECTOR " + String(s.name).slice(-4));
  const se = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=se0x&amount=1&fields[]=id&fields[]=name&fields[]=connector"); if (se[0]) { console.log(P + "ΣΟΝΔΑ connector|" + String(se[0].connector).slice(-6)); await vars(se[0].id, "SE0X " + String(se[0].name).slice(-4)); }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
