// SAG — ΕΠΑΛΗΘΕΥΣΗ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · T-GWID-03 · πρώτα πακέτα SE02 μετά την αλλαγή 17:10:41 UTC (19/10/2026).
// Ελέγχει: μετρήσεις κανονικές, lrrid με location, ΚΑΜΙΑ εγγραφή lrrlat/lrrlon, κανένα parse_error, ίδιο πλήθος εγγραφών/πακέτο.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const DEV = "68d6691e15f048000abad6e8"; // dragino_lse02_7889 (Ρηγάκης), η μόνη ενεργή του connector SE02
const SINCE = Date.parse("2026-10-19T17:10:41Z");
async function api(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(p.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
(async () => {
  console.log("ΕΠ3|== " + new Date().toISOString());
  const rows = await api(`/device/${DEV}/data?qty=80`);
  const byT = new Map();
  for (const r of rows || []) { const k = r.time; if (!byT.has(k)) byT.set(k, []); byT.get(k).push(r); }
  const times = [...byT.keys()].sort().reverse().slice(0, 4);
  for (const t of times) {
    const g = byT.get(t);
    const after = Date.parse(t) >= SINCE;
    const id = g.find((x) => x.variable === "lrrid");
    console.log(`ΕΠ3|ΠΑΚΕΤΟ|${t}|${after ? "ΜΕΤΑ" : "πριν"}|εγγραφές=${g.length}|lrrid=${id ? id.value : "—"}|location=${id && id.location ? JSON.stringify(id.location) : "—"}`
      + `|lrrlat/lon ως εγγραφές=${g.filter((x) => x.variable === "lrrlat" || x.variable === "lrrlon").length}|parse_error=${g.filter((x) => x.variable === "parse_error").length}`
      + `|${g.map((x) => x.variable + "=" + (typeof x.value === "number" ? x.value : String(x.value).slice(0, 12))).join(" ")}`);
  }
  console.log("ΕΠ3|== ΤΕΛΟΣ");
})().catch((e) => console.log("ΕΠ3|ΣΦΑΛΜΑ|" + e.message));
