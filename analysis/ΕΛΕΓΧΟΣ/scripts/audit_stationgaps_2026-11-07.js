// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Σταθμοί S2120 με κενά: ποιους αγρούς τροφοδοτούν, πότε ακριβώς σιωπούν, τι λέει η μπαταρία τους, σε σύγκριση με σταθμούς χωρίς κενά.
// Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών πέρα από type και όνομα αγρού.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "SG|";
const HOURS = 120, TZ = 2, H = 3600000; const BAD = ["0445", "0068", "053e", "04c5", "01f3", "047e", "00d8"];
const BATV = ["battery", "batterypct", "battery_level", "bat"];
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now(); const h1 = Math.floor(now / H) * H; const h0 = h1 - HOURS * H;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const used = {};
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name).slice(0, 24); let fresh = false;
    try { const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; fresh = !!(b && (now - Date.parse(b.time)) / H < 1.2); } catch (e) { /* χωρίς bundle */ }
    let ids = []; try { ids = Object.values(JSON.parse(String(tag(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; }
    for (const id of ids.filter((x) => /^[0-9a-f]{24}$/i.test(x))) (used[id] = used[id] || []).push(nm + (fresh ? "" : "(χωρίς υπολογισμό)"));
  }
  const st = [];
  for (const id of Object.keys(used)) { try { const x = await get(`/device/${id}`); if (String(tag(x, "type")) === "s2120") st.push({ id, nm: String(x.name || "").slice(-14) }); } catch (e) { /* επόμενη */ } }
  const isBad = (s) => BAD.some((b) => s.nm.toLowerCase().endsWith(b));
  const pick = [...st.filter(isBad), ...st.filter((s) => !isBad(s)).slice(0, 6)];
  for (const s of pick) {
    let line = P + (isBad(s) ? "ΚΕΝΑ|" : "ΣΥΓΚΡΙΣΗ|") + s.nm + "|αγροί " + used[s.id].join(", ");
    try {
      const r0 = await get(`/device/${s.id}/data?variables=air_temperature&start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}&qty=3000`);
      const hs = new Set(r0.map((x) => Math.floor(Date.parse(x.time) / H))); const gaps = []; let a = null;
      for (let t = h0; t <= h1; t += H) { const miss = t < h1 && !hs.has(t / H); if (miss && a === null) a = t; if (!miss && a !== null) { const d = new Date(a + TZ * H); gaps.push(String(d.getUTCDate()) + "/" + String(d.getUTCHours()).padStart(2, "0") + "+" + (t - a) / H + "ω"); a = null; } }
      line += "|κενά (ημέρα/ώρα Ελλάδας+διάρκεια) " + (gaps.join(" ") || "κανένα");
    } catch (e) { line += "|ανάγνωση απέτυχε"; }
    for (const v of BATV) {
      try {
        const b = await get(`/device/${s.id}/data?variables=${v}&start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}&qty=400`);
        const n = b.map((x) => Number(x.value)).filter(Number.isFinite); if (!n.length) continue;
        line += "|" + v + " τελευταία=" + n[0] + " ελάχ=" + Math.min(...n) + " μέγ=" + Math.max(...n) + " n=" + n.length; break;
      } catch (e) { /* επόμενο όνομα */ }
    }
    console.log(line);
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
