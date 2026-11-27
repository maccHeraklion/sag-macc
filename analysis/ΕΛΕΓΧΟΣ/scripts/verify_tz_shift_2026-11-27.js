// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · Μιχάλης: «στις χρονοσειρές φαίνεται ότι έγινε αλλαγή ώρας από UTC σε ελληνική».
// Ρολόι αναφοράς = ο ήλιος. Για κάθε επιλεγμένη ημέρα διαβάζει τη φωτεινότητα (light_intensity) ενός S2120 και βρίσκει σε UTC:
// ανατολή (πρώτο > 50 lx), δύση (τελευταίο > 50 lx), μέσο τους (ηλιακό μεσημέρι). Στην Κρήτη (~25°Α) το ηλιακό μεσημέρι είναι
// 10:00–10:30 UTC όλο τον χρόνο. Αλλαγή των χρονοσημάνσεων σε ώρα Ελλάδας = άλμα +2/+3 ω στο μέσο. Τυπώνει και τη μορφή του `time`.
// Scope {ids:[...], from:"YYYY-MM-DD", to:"YYYY-MM-DD", step:7, dense:["YYYY-MM-DD", ...]}. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "TZ|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
let S = {}; try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); S = (Array.isArray(s) ? s[0] : s) || {}; } catch (_e) {}
const hhmm = (ms) => { const d = new Date(ms); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const days = new Set();
  const from = Date.parse((S.from || "2026-02-01") + "T00:00:00Z"), to = Date.parse((S.to || "2026-11-26") + "T00:00:00Z");
  for (let t = from; t <= to; t += (Number(S.step) || 7) * 864e5) days.add(new Date(t).toISOString().slice(0, 10));
  for (const d of S.dense || []) days.add(d);
  const list = [...days].sort();
  for (const id of (S.ids || [])) {
    let fmt = "";
    for (const day of list) {
      try {
        const a = day + "T00:00:00.000Z", b = new Date(Date.parse(a) + 864e5 - 1).toISOString();
        const rows = await get(`/device/${id}/data?variables=light_intensity&start_date=${a}&end_date=${b}&qty=1000`);
        if (!fmt && rows[0]) { fmt = String(rows[0].time); console.log(P + "FMT|" + id.slice(-4) + "|" + fmt + "|created_at=" + String(rows[0].created_at || "")); }
        const lit = rows.filter((r) => Number(r.value) > 50).map((r) => Date.parse(r.time)).filter(Number.isFinite).sort((x, y) => x - y);
        if (lit.length < 3) { console.log(P + "D|" + id.slice(-4) + "|" + day + "|n=" + rows.length + "|χωρίς φως"); continue; }
        let mx = rows[0]; for (const r of rows) if (Number(r.value) > Number(mx.value)) mx = r;
        const mid = (lit[0] + lit[lit.length - 1]) / 2;
        console.log(P + "D|" + id.slice(-4) + "|" + day + "|n=" + rows.length + "|ανατολή=" + hhmm(lit[0]) + "|δύση=" + hhmm(lit[lit.length - 1])
          + "|μέσο=" + hhmm(mid) + "|μέγιστο=" + hhmm(Date.parse(mx.time)));
      } catch (e) { console.log(P + "ERR|" + id.slice(-4) + "|" + day + "|" + e.message.slice(0, 80)); }
    }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
