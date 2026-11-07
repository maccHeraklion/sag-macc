// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Αγροί με ίδια θέση: όλες οι πηγές θέσης (ετικέτες coordinates, latitude/longitude, ρύθμιση σε ετικέτα, μεταβλητή configuration, ιστορικό location με ώρες).
// Δεν γράφει τίποτα. Τυπώνει μόνο θέσεις και ώρες, όχι άλλες τιμές ετικετών. Η έξοδος δεν μπαίνει στο δημόσιο repo.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "SP|"; const WANT = /ΚΟΞΑΡΗ|Μιχάλης Χ|ΚΥΔΩΝ|ΠΑΝΕΤΕΚ|Τσικαλ/i;
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tv = (d, k) => (d.tags || []).filter((t) => String(t.key).toLowerCase() === k.toLowerCase()).map((t) => t.value);
const r5 = (x) => (Number.isFinite(Number(x)) && x !== "" && x !== null ? Number(x).toFixed(5) : "-");
const latlng = (o) => { if (!o || typeof o !== "object") return null; const la = o.latitude ?? o.lat, lo = o.longitude ?? o.lng ?? o.lon; return la !== undefined && lo !== undefined ? r5(la) + "," + r5(lo) : null; };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields[]=id&fields[]=name&fields[]=tags&fields[]=created_at");
  for (const f of fields) {
    const nm = String(tv(f, "name")[0] || f.name || ""); if (!WANT.test(nm)) continue;
    let cfg = {}; try { cfg = JSON.parse(String(tv(f, "configuration")[0] || "{}")); } catch (e) { cfg = {}; }
    let line = P + "ΑΓΡΟΣ|" + f.id.slice(-6) + "|" + nm.slice(0, 26) + "|ετικέτα " + tv(f, "coordinates").join(" & ") + "|lat/lng ετικέτες " + (tv(f, "latitude")[0] ?? "-") + "," + (tv(f, "longitude")[0] ?? "-") + "|ρύθμιση σε ετικέτα " + (latlng(cfg) || "-");
    try { const c = await get(`/device/${f.id}/data?variables[]=configuration&qty=20`); const seen = []; for (const r of c) { let m = r.metadata || {}; let p = latlng(m); if (!p) { try { p = latlng(JSON.parse(String(r.value))); } catch (e) { p = null; } } if (!p && m.config) p = latlng(m.config); seen.push((p || "χωρίς θέση") + " " + String(r.time).slice(0, 10)); } line += "|μεταβλητή configuration " + (seen.length ? [...new Set(seen)].slice(0, 4).join(" ; ") : "καμία"); } catch (e) { line += "|μεταβλητή configuration σφάλμα"; }
    console.log(line);
    const rows = await get(`/device/${f.id}/data?variables[]=location&qty=100`); const hist = {}; for (const r of rows) { const c = r.location && r.location.coordinates; if (!c) continue; const k = Number(c[1]).toFixed(5) + "," + Number(c[0]).toFixed(5) + (r.value ? " [" + String(r.value).slice(0, 8) + "]" : ""); const b = hist[k] || (hist[k] = { n: 0, a: r.time, z: r.time }); b.n++; if (r.time < b.a) b.a = r.time; if (r.time > b.z) b.z = r.time; }
    console.log(P + "ΙΣΤΟΡΙΚΟ|" + f.id.slice(-6) + "|" + Object.entries(hist).sort((a, b) => (a[1].z < b[1].z ? 1 : -1)).map(([k, b]) => k + " ×" + b.n + " " + String(b.a).slice(0, 10) + "→" + String(b.z).slice(0, 16)).join(" ; "));
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
