// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Ποια όργανά μας περνούν από τις 10 πύλες του τομέα American Farm School, και αν εξαρτώνται μόνο από αυτές. Δεν γράφει τίποτα, δεν τυπώνει θέσεις.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G13|"; const O = "6a98855ca06e41000bfae024";
const AFS = { "10009336": "Σουρωτή", "1000A341": "Πόμπια 42E7", "1000A1FE": "Πλώρα", "10014B6D": "Γαργαλιάνοι", "10007488": "mini HUB", "1001490C": "Μπαλαούρας", "10013E7D": "Ζόντανος", "10009B2D": "Βλαχόπουλο", "10009B2B": "Αγία Σωτήρα", "10009A11": "Στούπα" };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const map = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seenF = new Set(), seenD = new Set(); let total = 0, known = 0, hits = 0;
  for (const r of map) { const m = r.metadata || {}; if (seenF.has(m.i)) continue; seenF.add(m.i);
    for (const d of m.dv || []) { const key = d.i; const g = [d.g].concat((d.gs || []).map((x) => x[0])).filter(Boolean); if (!seenD.has(key)) { seenD.add(key); total++; if (g.length) known++; }
      const a = g.filter((c) => AFS[c]); if (!a.length) continue; hits++; const only = g.every((c) => AFS[c]);
      console.log(P + "ΟΡΓΑΝΟ|" + String(d.n).slice(-24) + "|τύπος " + d.t + "|αγρός " + m.n + "|πελάτης " + (m.c || "-") + "|κύρια " + (AFS[d.g] || d.g || "-") + "|όλες " + g.map((c) => AFS[c] || c).join(", ") + "|" + (only ? "ΜΟΝΟ ΣΧΟΛΗ" : "και άλλη πύλη") + "|ηλικία " + d.h); } }
  console.log(P + "ΣΥΝΟΛΟ|όργανα " + total + "|με γνωστή πύλη " + known + "|εγγραφές με πύλη Σχολής " + hits);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
