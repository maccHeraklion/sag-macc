// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Αλυσίδα λήψης: ανά αγρό ποια όργανα τον τροφοδοτούν και με ποιο πραγματικό βήμα, ανά τύπο κατανομή βημάτων.
// Ο τύπος διαβάζεται από τη συσκευή (ετικέτα type), όπως στον πυρήνα (Object.values(devices)) — όχι από το κλειδί της ετικέτας devices. Δεν τυπώνει τιμές ετικετών πέρα από type.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "PL|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const MAIN = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature", lms01_ls: "leaf_moisture", se0x: "soil_moisture1", lse02: "soil_moisture1", se02: "soil_moisture1", lse01: "soil_moisture", lse01_shallow: "soil_moisture", lse01_deep: "soil_moisture", se01: "soil_moisture", sph01: "ph" };
const ROLE = (t) => (t === "s2120" ? "Σ" : /^em3/.test(t) ? "Θ" : t === "lms01_ls" ? "Φ" : MAIN[t] ? "Ε" : "");
const bucket = (g) => (g === null ? "σιωπή" : g <= 7 ? "5΄" : g <= 13 ? "10΄" : g <= 25 ? "20΄" : g <= 45 ? "30΄" : g <= 90 ? "60΄" : ">90΄");
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now();
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const dev = {}; const used = {}; const rows = [];
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name).slice(0, 24);
    let ids = []; try { ids = Object.values(JSON.parse(String(tag(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; }
    ids = ids.filter((x) => /^[0-9a-f]{24}$/i.test(x));
    let fresh = false; try { const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; fresh = !!(b && (now - Date.parse(b.time)) / 3600000 < 1.2); } catch (e) { /* χωρίς bundle */ }
    let cfg = {}; try { cfg = JSON.parse(String(tag(f, "configuration") || "{}")); } catch (e) { cfg = {}; }
    for (const id of ids) {
      used[id] = (used[id] || 0) + (fresh ? 1 : 0);
      if (dev[id]) continue;
      const d = dev[id] = { t: "?", g: null, age: null, c: "", nm: "" };
      try {
        const x = await get(`/device/${id}`); d.t = String(tag(x, "type") || "χωρίς τύπο"); d.c = String(x.connector || "").slice(-6); d.nm = String(x.name || "").slice(-16);
        const mv = MAIN[d.t];
        if (mv) { const r = await get(`/device/${id}/data?variables=${mv}&qty=30`); const ts = r.map((z) => Date.parse(z.time)).filter(Number.isFinite).sort((a, b) => b - a); if (ts.length) d.age = (now - ts[0]) / 3600000; const gaps = []; for (let i = 0; i + 1 < ts.length; i++) gaps.push((ts[i] - ts[i + 1]) / 60000); if (d.age !== null && d.age < 6 && gaps.length >= 3) d.g = med(gaps); }
      } catch (e) { d.t = "ΣΦΑΛΜΑ"; }
    }
    rows.push({ nm, fresh, cov: cfg.covered_cultivation === true, ids });
  }
  const byType = {};
  for (const [id, d] of Object.entries(dev)) { const b = byType[d.t] || (byType[d.t] = { n: 0, conn: new Set(), bk: {} }); b.n++; if (d.c) b.conn.add(d.c); const k = MAIN[d.t] ? bucket(d.g) : "δεν μετρήθηκε"; b.bk[k] = (b.bk[k] || 0) + 1; }
  for (const [t, b] of Object.entries(byType).sort((x, y) => y[1].n - x[1].n)) console.log(P + "ΤΥΠΟΣ|" + t + "|συσκευές=" + b.n + "|connectors=" + b.conn.size + "|βήμα " + JSON.stringify(b.bk));
  const shared = Object.entries(used).filter(([, n]) => n > 1).length;
  console.log(P + "ΣΥΝΟΛΟ|αγροί=" + fields.length + "|υπολογίζονται=" + rows.filter((r) => r.fresh).length + "|συσκευές=" + Object.keys(dev).length + "|σε >1 υπολογιζόμενο αγρό=" + shared);
  let noAir = 0, noLeaf = 0, noSoil = 0, mixed = 0;
  for (const r of rows.filter((x) => x.fresh)) {
    const p = {}; for (const id of r.ids) { const d = dev[id]; const k = ROLE(d.t); if (!k) continue; (p[k] = p[k] || []).push(d.g === null ? "×" : String(Math.round(d.g))); }
    const live = (k) => (p[k] || []).some((x) => x !== "×");
    if (!live("Σ") && !live("Θ")) noAir++; if (!live("Φ")) noLeaf++; if (!live("Ε")) noSoil++;
    const steps = new Set(Object.values(p).flat().filter((x) => x !== "×").map((x) => bucket(Number(x)))); if (steps.size > 1) mixed++;
    console.log(P + "ΑΓΡΟΣ|" + r.nm + (r.cov ? "|κάλυψη" : "|ύπαιθρος") + "|" + Object.entries(p).map(([k, v]) => k + ":" + v.join(",")).join(" "));
  }
  console.log(P + "ΚΕΝΑ|χωρίς ζωντανό αέρα=" + noAir + "|χωρίς ζωντανό φύλλο=" + noLeaf + "|χωρίς ζωντανό έδαφος=" + noSoil + "|με διαφορετικά βήματα στον ίδιο αγρό=" + mixed);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
