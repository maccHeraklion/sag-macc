// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Ποιο gateway άκουσε τους σταθμούς με νυχτερινά κενά και τις σόνδες δίπλα τους (lrrid), ημέρα έναντι νύχτας.
// Τα ids των gateways τυπώνονται με τα 4 τελευταία ψηφία. Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών πέρα από type και όνομα αγρού.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "GW|";
const HOURS = 96, TZ = 2, H = 3600000; const WANT = ["Σκοτίνα Πάνω", "Όρμα", "Α1 - Περαντωνάκης", "ΚΥΔΩΝ", "ΓΑΛΥΦΑ"];
const TYPES = ["s2120", "lse01", "se0x", "lms01_ls"];
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now(); const h1 = Math.floor(now / H) * H; const h0 = h1 - HOURS * H;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const seen = {};
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name); if (!WANT.some((w) => nm.startsWith(w))) continue;
    let ids = []; try { ids = Object.values(JSON.parse(String(tag(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; }
    for (const id of ids.filter((x) => /^[0-9a-f]{24}$/i.test(x))) {
      if (seen[id]) continue; seen[id] = 1;
      try {
        const x = await get(`/device/${id}`); const t = String(tag(x, "type") || ""); if (!TYPES.includes(t)) continue;
        const r0 = await get(`/device/${id}/data?variables=lrrid&start_date=${new Date(h0).toISOString()}&end_date=${new Date(h1).toISOString()}&qty=2000`);
        const c = {}; for (const r of r0) { const k = String(r.value).slice(-4); const lh = (new Date(r.time).getUTCHours() + TZ) % 24; const b = c[k] || (c[k] = { d: 0, n: 0 }); if (lh >= 22 || lh < 8) b.n++; else b.d++; }
        console.log(P + nm.slice(0, 20) + "|" + t + "|" + String(x.name || "").slice(-5) + "|lrrid εγγραφές " + r0.length + "|" + (Object.entries(c).sort((a, b) => (b[1].d + b[1].n) - (a[1].d + a[1].n)).map(([k, b]) => k + " μέρα=" + b.d + " νύχτα=" + b.n).join(" · ") || "χωρίς lrrid"));
      } catch (e) { console.log(P + nm.slice(0, 20) + "|ανάγνωση απέτυχε"); }
    }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
