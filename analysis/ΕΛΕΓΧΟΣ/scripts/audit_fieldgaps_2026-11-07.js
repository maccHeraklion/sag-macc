// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Στους αγρούς με νυχτερινά κενά σταθμού: σιωπούν την ίδια ώρα και τα υπόλοιπα όργανα του αγρού; (σταθμός ή gateway)
// Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών πέρα από type και όνομα αγρού.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "FG|";
const HOURS = 120, TZ = 2, H = 3600000; const WANT = ["Σκοτίνα Πάνω", "Όρμα", "Α1 - Περαντωνάκης", "ΚΥΔΩΝ", "ΠΑΝΕΤΕΚ", "ΓΑΛΥΦΑ"];
const MAIN = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature", lms01_ls: "leaf_moisture", se0x: "soil_moisture1", lse02: "soil_moisture1", lse01: "soil_moisture" };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now(); const h1 = Math.floor(now / H) * H; const h0 = h1 - HOURS * H;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name); if (!WANT.some((w) => nm.startsWith(w))) continue;
    let ids = []; try { ids = Object.values(JSON.parse(String(tag(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; }
    for (const id of ids.filter((x) => /^[0-9a-f]{24}$/i.test(x))) {
      try {
        const x = await get(`/device/${id}`); const t = String(tag(x, "type") || ""); const v = MAIN[t]; if (!v) continue;
        const r0 = await get(`/device/${id}/data?variables=${v}&start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}&qty=3000`);
        const hs = new Set(r0.map((z) => Math.floor(Date.parse(z.time) / H))); const gaps = []; let a = null; let miss = 0;
        for (let u = h0; u <= h1; u += H) { const m = u < h1 && !hs.has(u / H); if (m) miss++; if (m && a === null) a = u; if (!m && a !== null) { if ((u - a) / H >= 2) { const d = new Date(a + TZ * H); gaps.push(String(d.getUTCDate()) + "/" + String(d.getUTCHours()).padStart(2, "0") + "+" + (u - a) / H + "ω"); } a = null; } }
        console.log(P + nm.slice(0, 22) + "|" + t + "|" + String(x.name || "").slice(-5) + "|δείγματα " + r0.length + "|κενές ώρες " + miss + "/" + HOURS + "|κενά ≥2ω " + (gaps.join(" ") || "κανένα"));
      } catch (e) { console.log(P + nm.slice(0, 22) + "|ανάγνωση απέτυχε"); }
    }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
