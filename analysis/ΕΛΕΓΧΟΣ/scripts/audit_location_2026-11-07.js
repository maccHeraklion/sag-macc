// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Κανάλια θέσης αγρών: ετικέτα coordinates, θέση στη φόρμα (configuration), μεταβλητή location. Σύγκριση ανά αγρό, και τα δύο πιθανά ζεύγη lat/lng.
// Δεν γράφει τίποτα. Τυπώνει μόνο θέσεις αγρών (όχι άλλες τιμές ετικετών). Η έξοδος δεν μπαίνει στο δημόσιο repo.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "LC|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tags = (d, k) => (d.tags || []).filter((t) => String(t.key).toLowerCase() === k.toLowerCase()).map((t) => t.value);
const km = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) * r / 2), y = (b[0] - a[0]) * r; return R * Math.hypot(x, y); };
const pair = (s) => { const m = String(s || "").match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const greece = (p) => p && p[0] > 34.5 && p[0] < 41.9 && p[1] > 19.2 && p[1] < 29.8;
const f5 = (p) => (p ? p.map((x) => Number(x).toFixed(5)).join(",") : "-");
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  let ok = 0, none = 0, diff = 0, multi = 0, noForm = 0, noTag = 0; const same = {};
  for (const f of fields) {
    const nm = String(tags(f, "name")[0] || f.name || "").replace(/^Field_/, "").slice(0, 28); const dupTag = tags(f, "coordinates"); const tagP = pair(dupTag[0]);
    let cfg = {}; try { cfg = JSON.parse(String(tags(f, "configuration")[0] || "{}")); } catch (e) { cfg = {}; }
    const ck = Object.keys(cfg).filter((k) => /lat|lng|lon|coord/i.test(k)); let formP = null; if (cfg.latitude !== undefined && cfg.longitude !== undefined && cfg.latitude !== "" && cfg.longitude !== "") formP = [Number(cfg.latitude), Number(cfg.longitude)];
    if (!formP && cfg.lat !== undefined && (cfg.lng ?? cfg.lon) !== undefined) formP = [Number(cfg.lat), Number(cfg.lng ?? cfg.lon)]; else if (!formP) for (const k of ck) { const v = cfg[k]; if (v && typeof v === "object" && v.lat !== undefined) { formP = [Number(v.lat), Number(v.lng ?? v.lon)]; break; } if (typeof v === "string" && pair(v)) { formP = pair(v); break; } }
    let rows = []; try { rows = await get(`/device/${f.id}/data?variables=location&qty=500`); } catch (e) { rows = []; }
    const seen = {}; for (const r of rows) { const c = r.location && r.location.coordinates; const raw = c ? c : (r.location ? [r.location.lat, r.location.lng] : null); if (!raw) continue; const k = raw.map((x) => Number(x).toFixed(5)).join(","); (seen[k] = seen[k] || { n: 0, last: r.time, raw }).n++; }
    const distinct = Object.entries(seen); const latest = rows.find((r) => r.location); let cur = null, swapped = false;
    if (latest) { const c = latest.location.coordinates || [latest.location.lat, latest.location.lng]; const geo = [Number(c[1]), Number(c[0])], rev = [Number(c[0]), Number(c[1])]; cur = greece(geo) ? geo : rev; swapped = !greece(geo) && greece(rev); }
    const ref = formP || tagP; const d = cur && ref ? km(cur, ref) : null; const dTF = tagP && formP ? km(tagP, formP) : null; const dTL = tagP && cur ? km(tagP, cur) : null; const key = f5(cur || ref); (same[key] = same[key] || []).push(nm);
    const round = (p) => p && (Number.isInteger(p[0]) || Number.isInteger(p[1])); const bad = !cur || (d !== null && d > 1) || (dTF !== null && dTF > 1) || (dTL !== null && dTL > 1) || !greece(cur) || dupTag.length > 1 || swapped || round(cur) || round(tagP) || round(formP); if (!formP) noForm++; if (!tagP) noTag++;
    if (!cur) none++; else if (d !== null && d > 1) diff++; else ok++; if (distinct.length > 1) multi++;
    if (bad || /Καμπιτ/.test(nm)) console.log(P + "ΑΓΡΟΣ|" + f.id.slice(-6) + "|" + nm + "|ετικέτα " + f5(tagP) + (dupTag.length > 1 ? " (×" + dupTag.length + ")" : "") + "|φόρμα " + f5(formP) + (ck.length ? " [" + ck.join(",") + "]" : "") + "|location " + f5(cur) + (latest ? " " + String(latest.time).slice(0, 16) : "") + (swapped ? " ΑΝΕΣΤΡΑΜΜΕΝΗ" : "") + "|εγγραφές " + rows.length + " διακριτές " + distinct.length + "|km location−αναφορά " + (d === null ? "-" : d.toFixed(1)) + "|km ετικέτα−φόρμα " + (dTF === null ? "-" : dTF.toFixed(1)) + "|km ετικέτα−location " + (dTL === null ? "-" : dTL.toFixed(1)));
  }
  for (const [k, v] of Object.entries(same)) if (v.length > 1) console.log(P + "ΙΔΙΑ ΘΕΣΗ|" + k + "|" + v.join(", "));
  console.log(P + "ΣΥΝΟΛΟ|αγροί=" + fields.length + "|location εντάξει=" + ok + "|χωρίς location=" + none + "|διαφορά >1 km=" + diff + "|με ιστορικό πολλών θέσεων=" + multi + "|χωρίς θέση φόρμας=" + noForm + "|χωρίς ετικέτα=" + noTag);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
