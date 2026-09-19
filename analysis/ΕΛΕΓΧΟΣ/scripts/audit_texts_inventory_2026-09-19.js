// SAG · ΑΠΟΓΡΑΦΗ ΚΕΙΜΕΝΩΝ του field_bundle — ΜΟΝΟ ΑΝΑΓΝΩΣΗ (19/9/2026)
//
// ΤΙ ΑΠΑΝΤΑ: «πόσα κείμενα υπάρχουν, τι πληροφορία δίνουν, πόσο κοστίζουν, πόσο συχνά
// κόβονται». Τα ευρήματα και η κρίση: analysis/ΕΛΕΓΧΟΣ/ΑΠΟΓΡΑΦΗ_ΚΕΙΜΕΝΩΝ_2026-09-19.md
//
// ΜΕΤΡΗΣΗ 19/9 14:41 UTC σε 42 αγρούς: 415 διαφορετικά κλειδιά · 5.333 εμφανίσεις δεικτών ·
// 197.960 B κειμένου συνολικά (~4.713 B/αγρό, με πλαφόν bundle 9.200 B). Τα 45 μεγαλύτερα
// κλειδιά κρατούν 161.342 B — η απόφαση παίζεται σε ~20 κλειδιά, όχι σε 415.
// Ακριβότερα: crop_stage 19.315 B · upgrade_opportunities 12.669 B · forecast_status 7.868 B.
//
// ΤΡΕΞΙΜΟ: θέση probe 6aa2d24f2f585a000b90b1a1 (node-rt2025), πολιτική ΑΝΑΓΝΩΣΗΣ
// 6aa2e0cf8592a5000bec9547. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
function unpack(b64) {
  try { return JSON.parse(zlib.inflateRawSync(Buffer.from(b64, "base64")).toString("utf8")); }
  catch (e) { try { return JSON.parse(zlib.inflateSync(Buffer.from(b64, "base64")).toString("utf8")); } catch (e2) { return null; } }
}
(async () => {
  console.log("=== ΑΠΟΓΡΑΦΗ ΚΕΙΜΕΝΩΝ · " + new Date().toISOString() + " ===");
  let devs = [];
  try { devs = await api("/device?amount=200&fields[]=id&fields[]=name&fields[]=tags&filter[tags][0][key]=isField&filter[tags][0][value]=yes"); }
  catch (e) { console.log("ERR|" + e.message); return; }
  const agg = new Map();
  let fields = 0, totalTextB = 0, totalKeys = 0;
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < devs.length) {
      const d = devs[i++];
      try {
        const r = await api(`/device/${d.id}/data?variables[]=field_bundle&qty=1`);
        const p = (r || [])[0];
        if (!p || !p.metadata || !p.metadata.data) continue;
        const o = unpack(p.metadata.data);
        if (!o) continue;
        fields++;
        const scan = (box) => {
          for (const [k, v] of Object.entries(box || {})) {
            if (!v || typeof v !== "object" || !v.metadata) continue;
            totalKeys++;
            const t = typeof v.metadata.text === "string" ? v.metadata.text : null;
            // `_trunc` = ο SAG-BUNDLE-FIT-01 έσβησε το κείμενο για να χωρέσει το bundle
            const cut = v.metadata._trunc ? 1 : 0;
            const e = agg.get(k) || { n: 0, sum: 0, max: 0, cut: 0, sample: "" };
            e.n++;
            if (cut) e.cut++;
            if (t) {
              e.sum += t.length; totalTextB += t.length;
              if (t.length > e.max) { e.max = t.length; e.sample = t.slice(0, 90).replace(/\s+/g, " "); }
            }
            agg.set(k, e);
          }
        };
        scan(o.shared);
        for (const c of (o.crops || [])) scan(c.indicators);
      } catch (e) { /* αγνοείται: ένας αγρός δεν ρίχνει την απογραφή */ }
    }
  }));
  const rows = [...agg.entries()].map(([k, e]) => ({ k, ...e, avg: e.n ? Math.round(e.sum / e.n) : 0 }))
    .sort((a, b) => b.sum - a.sum);
  console.log(`ΣΥΝΟΛΟ|αγροί=${fields}|διαφορετικά κλειδιά=${agg.size}|εμφανίσεις δεικτών=${totalKeys}|συνολικά bytes κειμένου=${totalTextB}`);
  console.log("ΣΤΗΛΕΣ|κλειδί|εμφανίσεις|συνολικά B|μέσο B|μέγιστο B|φορές κομμένο|δείγμα");
  for (const r of rows.slice(0, 45)) console.log(`T|${r.k}|${r.n}|${r.sum}|${r.avg}|${r.max}|${r.cut}|${r.sample}`);
  const tail = rows.slice(45);
  if (tail.length) console.log(`ΥΠΟΛΟΙΠΑ|${tail.length} κλειδιά|${tail.reduce((s, x) => s + x.sum, 0)} B συνολικά`);
  console.log("=== ΤΕΛΟΣ ===");
})();
