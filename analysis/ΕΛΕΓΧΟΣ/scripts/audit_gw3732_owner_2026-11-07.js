// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Σε ποιον πελάτη ανήκουν οι 8 αγροί της πύλης 10013732, και αν οι 13 ελεγκτές uc511 που σίγησαν την ίδια μέρα περνούσαν από αυτήν. Δεν γράφει τίποτα, δεν στέλνει εντολές, δεν διαβάζει ετικέτες.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G15|"; const O = "6a98855ca06e41000bfae024"; const NET = "5ede22a7427104001c248b08"; const H = 3600000;
const FIELDS = ["Υπόσκαφο", "Ανατολικός Δρόμος", "Βραχόκηπος (Reception)", "Νότια είσοδος (Reception)", "Γκαζόν V8", "Γκαζόν V2", "Γκαζόν V4", "Κτίριο V10"];
const UC = ["9984", "2160", "5621", "4616", "2069", "2120", "8950", "1544", "9958", "7899", "2198", "2453", "0583"];
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const gr = (ms) => { const d = new Date(ms + 2 * H); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const map = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seenF = new Set(), inField = {};
  for (const r of map) { const m = r.metadata || {}; if (seenF.has(m.i)) continue; seenF.add(m.i);
    for (const d of m.dv || []) { const t = String(d.n).slice(-4); if (/uc511/i.test(String(d.n)) && UC.includes(t)) (inField[t] = inField[t] || []).push(m.n + " / " + (m.c || "-")); }
    if (FIELDS.includes(m.n)) console.log(P + "ΑΓΡΟΣ|" + m.n + "|πελάτης " + (m.c || "-") + "|όργανα " + (m.dv || []).map((d) => String(d.n).slice(-20) + ":" + d.t + ":ηλ " + d.h + ":πύλη " + (d.g || "-")).join(" , ")); }
  console.log(P + "ΕΓΓΡΑΦΕΣ ΧΑΡΤΗ|" + seenF.size);
  const devs = []; for (let page = 1; page <= 4; page++) { const c = await get(`/device?amount=200&page=${page}&fields[]=id&fields[]=name&fields[]=last_input&filter[network]=${NET}`); devs.push(...c); if (c.length < 200) break; }
  const ucs = devs.filter((d) => /uc511/i.test(d.name) && UC.includes(String(d.name).slice(-4)));
  for (const d of ucs) {
    const t = String(d.name).slice(-4); const r = await get(`/device/${d.id}/data?qty=200`);
    const times = [...new Set(r.map((x) => Date.parse(x.time)))].sort((a, b) => a - b), gaps = []; for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 60000);
    const lr = r.filter((x) => x.variable === "lrrid"); const vars = [...new Set(r.map((x) => x.variable))].length;
    console.log(P + "ΕΛΕΓΚΤΗΣ|" + String(d.name).slice(-20) + "|αγρός " + ((inField[t] || []).join(" + ") || "-") + "|τελευταία είσοδος " + gr(Date.parse(d.last_input)) + "|χρονικά σημεία " + times.length + "|διάμεσο μεσοδιάστημα λ " + Math.round(med(gaps) || 0) + "|πρώτο δείγμα " + (times.length ? gr(times[0]) : "-") + "|μεταβλητές " + vars + "|lrrid " + (lr.length ? lr.slice(0, 3).map((x) => x.value).join(",") : "κανένα"));
  }
  console.log(P + "ΕΛΕΓΚΤΕΣ|" + ucs.length); console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
