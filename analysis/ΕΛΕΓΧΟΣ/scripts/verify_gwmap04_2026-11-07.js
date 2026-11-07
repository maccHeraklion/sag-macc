// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Επαλήθευση T-GWMAP-04: γράφτηκαν τα map_field, έμειναν κανονικά οι κάρτες πυλών, τι καλύπτουν. Τυπώνει μόνο πλήθη και ώρες.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "VM|"; const O = "6a98855ca06e41000bfae024";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const m = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const t0 = m[0] && m[0].time; const last = m.filter((x) => x.time === t0);
  const md = last.map((x) => x.metadata || {}); const dv = md.flatMap((x) => x.dv || []);
  const by = {}; for (const d of dv) by[d.t || "?"] = (by[d.t || "?"] || 0) + 1;
  console.log(P + "MAP_FIELD|εγγραφές συνολικά " + m.length + "|τελευταία παρτίδα " + t0 + "|γραμμές " + last.length + "|με θέση " + md.filter((x) => x.y != null && x.x != null).length + "|με παραγωγό " + md.filter((x) => x.c).length + "|παραγωγοί " + new Set(md.map((x) => x.c).filter(Boolean)).size + "|όργανα " + dv.length + "|με πύλη " + dv.filter((d) => d.g).length + "|κομμένα dc " + md.reduce((s, x) => s + (Number(x.dc) || 0), 0) + "|μέγιστο μέγεθος " + Math.max(0, ...md.map((x) => JSON.stringify(x).length)));
  console.log(P + "ΤΥΠΟΙ|" + Object.entries(by).map(([k, n]) => k + "=" + n).join(" "));
  const s2 = dv.filter((d) => /s2120/.test(String(d.t))); console.log(P + "ΣΤΑΘΜΟΙ|" + s2.length + "|με πύλη " + s2.filter((d) => d.g).length);
  for (const v of ["gateway_row", "gateway_summary", "gateway_roster", "tech_tasks", "gateway_scan_state"]) { const r = await get(`/device/${O}/data?variables[]=${v}&qty=1`); console.log(P + "ΑΛΛΑ|" + v + "|" + (r[0] ? r[0].time : "καμία")); }
  const s = await get(`/device/${O}/data?variables[]=gateway_summary&qty=1`); const q = (s[0] || {}).metadata || {}; console.log(P + "ΣΥΝΟΨΗ|ορατά=" + q.total + " ζωντανά=" + q.alive + " αισθητήρες με πύλη=" + q.sensors_seen + " από " + q.sensors_total + " αναγνώσεις=" + q.reads + " ms=" + q.ms);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
