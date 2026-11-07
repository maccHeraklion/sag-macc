// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Οι σταθμοί 047e και 01f3 σιωπούν τη νύχτα: τα άλλα όργανα του ίδιου αγρού εκπέμπουν τότε, και από ποια πύλη; Τυπώνει ονόματα, ώρες, πλήθη. Δεν γράφει τίποτα, δεν τυπώνει θέσεις.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G4|"; const O = "6a98855ca06e41000bfae024"; const HOURS = 72, H = 3600000; const NIGHT = (t) => { const u = new Date(t).getUTCHours(); return u >= 21 || u < 6; }; const STATIONS = /_(047e|01f3)$/i;
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const h1 = Math.floor(Date.now() / H) * H, h0 = h1 - HOURS * H; let nightH = 0; for (let t = h0; t < h1; t += H) if (NIGHT(t)) nightH++;
  const devs = []; for (let page = 1; page <= 6; page++) { const c = await get(`/device?amount=200&page=${page}&fields[]=id&fields[]=name`); devs.push(...c); if (c.length < 200) break; }
  const byTail = new Map(devs.map((d) => [String(d.id).slice(-6), d])); const st = devs.filter((d) => STATIONS.test(d.name)); console.log(P + "ΣΥΣΚΕΥΕΣ|" + devs.length + "|σταθμοί " + st.map((d) => d.name).join(","));
  const rows = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seen = new Set();
  for (const s of st) {
    const tail = String(s.id).slice(-6); const row = rows.find((r) => ((r.metadata || {}).dv || []).some((x) => x.i === tail)); if (!row) { console.log(P + "ΧΩΡΙΣ ΑΓΡΟ|" + s.name); continue; }
    const md = row.metadata; if (seen.has(md.i)) continue; seen.add(md.i); console.log(P + "ΑΓΡΟΣ|" + md.n + "|όργανα " + md.dv.length + (md.dc ? "|κομμένα " + md.dc : ""));
    for (const x of md.dv) {
      const d = byTail.get(x.i); if (!d) { console.log(P + "ΑΓΝΩΣΤΟ|" + x.i); continue; } const q = `start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}`;
      const lr = await get(`/device/${d.id}/data?variables[]=lrrid&${q}&qty=500`); const any = lr.length ? lr : await get(`/device/${d.id}/data?${q}&qty=1500`);
      const hrs = new Set(any.filter((r) => NIGHT(r.time)).map((r) => Math.floor(Date.parse(r.time) / H))); const by = {}; for (const r of lr) { const k = String(r.value) + (NIGHT(r.time) ? ":ν" : ":μ"); by[k] = (by[k] || 0) + 1; }
      console.log(P + "ΟΡΓΑΝΟ|" + String(d.name).slice(-22) + "|τύπος " + x.t + "|ηλικία ω " + x.h + "|πύλη " + (x.g || "-") + "|εγγραφές " + any.length + (lr.length ? " lrrid" : " όλες") + "|νυχτερινές ώρες με δεδομένα " + hrs.size + "/" + nightH + "|πύλες " + JSON.stringify(by));
    }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
