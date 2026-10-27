// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · v50.162: μέγεθος field_bundle ΠΡΙΝ/ΜΕΤΑ στους μεγαλύτερους αγρούς.
// Ίδιο με αυτό που έτρεξε στο probe 6aa2d24f στις 27/10 16:31 UTC (πολιτική ανάγνωσης 6ac171e0 ενεργή μόνο όσο έτρεχε).
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const ver = (e) => { try { return JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8")).shared.kernel_version.value.slice(0, 7); } catch (_e) { return "?"; } };
(async () => {
  console.log("ΥΥ8=== ΜΕΓΕΘΗ v50.161 → v50.162 · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name");
  const rows = [];
  for (const d of devs) {
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=3`);
      if (!Array.isArray(b) || !b.length) continue;
      const now = b[0], prev = b.find((x) => ver(x) !== ver(now)) || b[1];
      rows.push({ n: d.name || d.id, a: prev ? String(prev.metadata.data).length : null, av: prev ? ver(prev) : "", b: String(now.metadata.data).length, bv: ver(now) });
    } catch (x) { console.log("ΥΥ8ERR|" + d.id + "|" + x.message); }
  }
  rows.sort((x, y) => y.b - x.b);
  for (const r of rows.slice(0, 6)) console.log("ΥΥ8|" + r.n + "|πριν " + r.av + " " + r.a + "|μετά " + r.bv + " " + r.b + "|Δ " + (r.a == null ? "—" : r.b - r.a));
  const d = rows.filter((r) => r.a != null && r.av !== r.bv).map((r) => r.b - r.a);
  console.log("ΥΥ8SUM|ζεύγη=" + d.length + "|Δ ελάχ=" + Math.min(...d) + "|Δ μέγ=" + Math.max(...d) + "|Δ μέσο=" + (d.reduce((s, x) => s + x, 0) / (d.length || 1)).toFixed(1));
  console.log("ΥΥ8=== ΤΕΛΟΣ ===");
})();
