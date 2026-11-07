// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Ακριβές λεπτό που σταματούν και ξαναρχίζουν οι σταθμοί 047e, 01f3 και ο ελεγκτής 3914 τη νύχτα, ώρα Ελλάδας, κενά άνω των 3 ωρών. Μία μεταβλητή ανά όργανο, χωρίς κόψιμο από το όριο εγγραφών. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G5|"; const HOURS = 120, H = 3600000, TZ = 2; const WANT = [[/s2120_047e$/i, "air_temperature"], [/s2120_01f3$/i, "air_temperature"], [/uc511_3914$/i, null], [/lms01_ls_067a$/i, "lrrid"]];
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const gr = (t) => { const d = new Date(t + TZ * H); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const h1 = Date.now(), h0 = h1 - HOURS * H; const q = `start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}`;
  const devs = []; for (let page = 1; page <= 6; page++) { const c = await get(`/device?amount=200&page=${page}&fields[]=id&fields[]=name`); devs.push(...c); if (c.length < 200) break; }
  for (const [re, v0] of WANT) {
    const d = devs.find((x) => re.test(x.name)); if (!d) { console.log(P + "ΛΕΙΠΕΙ|" + re); continue; } let v = v0;
    if (!v) { const s = await get(`/device/${d.id}/data?${q}&qty=60`); const c = {}; for (const r of s) c[r.variable] = (c[r.variable] || 0) + 1; v = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; console.log(P + "ΜΕΤΑΒΛΗΤΕΣ|" + d.name + "|" + JSON.stringify(c)); }
    const r = await get(`/device/${d.id}/data?variables[]=${v}&${q}&qty=3000`); const t = [...new Set(r.map((x) => Date.parse(x.time)))].sort((a, b) => a - b); const steps = []; const out = [];
    for (let i = 1; i < t.length; i++) { const g = t[i] - t[i - 1]; steps.push(g); if (g >= 3 * H) out.push(gr(t[i - 1]) + "→" + gr(t[i]) + " (" + (g / H).toFixed(1) + "ω)"); }
    steps.sort((a, b) => a - b); console.log(P + "ΟΡΓΑΝΟ|" + d.name + "|" + v + "|εγγραφές " + r.length + "|διάμεσο βήμα λ " + (steps.length ? Math.round(steps[steps.length >> 1] / 60000) : "-") + "|κενά " + (out.join(" · ") || "κανένα"));
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
