// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · P1 / μητρώο #204 · κατάταξη σονδών αγωγιμότητας, ΕΚΔΟΣΗ 2.
// Γιατί v2: η v1 (κάδοι υγρασίας 0,5 %, 14 ημέρες) έδωσε κλίσεις −0,34…+0,44 /°C — φυσικά αδύνατες — και για την
// ίδια σόνδα se0x_3ab3 κ1 +0,063 αντί για +0,021 της 16/9. Δύο συγχυτές: (α) αργή αλλαγή αλάτων από μέρα σε μέρα
// (λίπανση, πότισμα, βροχή 4/10) και (β) η ένδειξη υγρασίας FDR κινείται με τη θερμοκρασία μέσα στον κάδο.
// Μοντέλο v2: ln(EC) = a_ημέρας + b·T + c·ln(θ) — σταθερό αποτέλεσμα ανά ημέρα ώρας Ελλάδας (σβήνει την αργή
// αλλαγή), υγρασία ως συνεχής συμμεταβλητή. Μένει μόνο ο ημερήσιος κύκλος της T μέσα στη μέρα.
// Δύο ΑΝΕΞΑΡΤΗΤΑ παράθυρα: W1 = 2–16/9 (το παράθυρο της μέτρησης 16/9 — έλεγχος ότι ξαναβγαίνουν τα γνωστά),
// W2 = 20/9–4/10. Κατάταξη ΜΟΝΟ αν και τα δύο πέφτουν στην ίδια φυσική ζώνη:
//   ΑΝΤ  |b| ≤ 0,006 · ΧΩΡΙΣ 0,014 ≤ b ≤ 0,028 · αλλιώς ΑΒΕΒΑΙΟ (εκτός φυσικής ζώνης = συγχυτής, όχι όργανο).
// Φίλτρα: EC ≥ 30 µS/cm, υγρασία > 15 %, ημέρα με ≥ 12 σημεία και εύρος T ≥ 1 °C.
// Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const TYPES = ["se0x", "lse02", "lse01", "lse01_shallow", "lse01_deep", "se01", "se02_lb"];
const CH = [
  { k: "1", ec: "conduct_soil1", m: "soil_moisture1", t: "soil_temperature1" },
  { k: "2", ec: "conduct_soil2", m: "soil_moisture2", t: "soil_temperature2" },
  { k: "0", ec: "conduct_soil", m: "soil_moisture", t: "temp_soil" },
];
const W = [
  { n: "W1", s: "2026-09-01T21:00:00Z", e: "2026-09-16T21:00:00Z" },
  { n: "W2", s: "2026-09-19T21:00:00Z", e: "2026-10-04T21:00:00Z" },
];
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
async function series(id, v, s, e) {
  const r = await get(`/device/${id}/data?variable=${v}&start_date=${s}&end_date=${e}&qty=10000&ordination=ascending`);
  const out = new Map();
  for (const x of (r || [])) { const n = Number(x.value); if (Number.isFinite(n)) out.set(x.time, n); }
  return out;
}
const athDay = (ms) => new Date(ms + 3 * 3600000).toISOString().slice(0, 10);   // EEST ως 25/10
// σταθερό αποτέλεσμα ημέρας + συμμεταβλητή ln θ: αφαίρεση μέσων ανά ημέρα, μετά OLS δύο μεταβλητών
function fit(pts) {
  const days = new Map();
  for (const p of pts) { const d = athDay(p.ms); (days.get(d) || days.set(d, []).get(d)).push(p); }
  const rows = []; let nd = 0;
  for (const [, a] of days) {
    if (a.length < 12) continue;
    const ts = a.map(p => p.t); if (Math.max(...ts) - Math.min(...ts) < 1) continue;
    const mean = (f) => a.reduce((s, p) => s + f(p), 0) / a.length;
    const my = mean(p => p.y), mt = mean(p => p.t), mx = mean(p => p.x);
    for (const p of a) rows.push({ y: p.y - my, t: p.t - mt, x: p.x - mx });
    nd++;
  }
  if (nd < 3) return null;
  let stt = 0, sxx = 0, stx = 0, sty = 0, sxy = 0;
  for (const r of rows) { stt += r.t * r.t; sxx += r.x * r.x; stx += r.t * r.x; sty += r.t * r.y; sxy += r.x * r.y; }
  const det = stt * sxx - stx * stx;
  if (!(det > 1e-12)) return null;
  const b = (sty * sxx - sxy * stx) / det, c = (sxy * stt - sty * stx) / det;
  let sse = 0; for (const r of rows) { const e = r.y - b * r.t - c * r.x; sse += e * e; }
  const dof = Math.max(rows.length - nd - 2, 1);
  const se = Math.sqrt(sse / dof * sxx / det);
  return { b, se, c, n: rows.length, nd };
}
const zone = (r) => !r ? "—" : r.se > 0.004 ? "?" : Math.abs(r.b) <= 0.006 ? "ΑΝΤ" : (r.b >= 0.014 && r.b <= 0.028) ? "ΧΩΡΙΣ" : "ΕΚΤΟΣ";
(async () => {
  console.log("ΕΕ2=== ΚΑΤΑΤΑΞΗ ΣΟΝΔΩΝ EC v2 · " + new Date().toISOString() + " ===");
  const seen = new Set();
  for (const ty of TYPES) {
    let devs = [];
    try { devs = await get(`/device?filter[tags][0][key]=type&filter[tags][0][value]=${ty}&amount=200`); } catch (x) { console.log("ΕΕ2ERR|λίστα " + ty + "|" + x.message); continue; }
    for (const d of devs) {
      if (seen.has(d.id)) continue; seen.add(d.id);
      for (const c of CH) {
        try {
          const res = [];
          for (const w of W) {
            const E = await series(d.id, c.ec, w.s, w.e);
            if (E.size < 20) { res.push(null); continue; }
            const M = await series(d.id, c.m, w.s, w.e), T = await series(d.id, c.t, w.s, w.e);
            const pts = [];
            for (const [time, ec] of E) {
              const m = M.get(time), t = T.get(time);
              if (!(ec >= 30) || !(m > 15) || !Number.isFinite(t)) continue;
              pts.push({ y: Math.log(ec), x: Math.log(m), t, ms: Date.parse(time) });
            }
            res.push(fit(pts));
          }
          if (res.every(r => r === null)) continue;
          const z = res.map(zone);
          const verdict = (z[0] === z[1] && (z[0] === "ΑΝΤ" || z[0] === "ΧΩΡΙΣ")) ? (z[0] === "ΑΝΤ" ? "ΑΝΤΙΣΤΑΘΜΙΖΕΙ_ΣΤΗ_ΣΟΝΔΑ" : "ΧΩΡΙΣ_ΑΝΤΙΣΤΑΘΜΙΣΗ") : "ΑΒΕΒΑΙΟ";
          const f = (r, zz) => r ? r.b.toFixed(4) + "±" + r.se.toFixed(4) + " c" + r.c.toFixed(2) + " n" + r.n + "/ημ" + r.nd + " " + zz : "—";
          console.log("ΕΕ2C|" + d.name + "|" + ty + "|κ" + c.k + "|" + d.id + "|W1 " + f(res[0], z[0]) + "|W2 " + f(res[1], z[1]) + "|" + verdict);
        } catch (x) { console.log("ΕΕ2ERR|" + d.name + "|κ" + c.k + "|" + x.message); }
      }
    }
  }
  console.log("ΕΕ2=== ΤΕΛΟΣ · συσκευές " + seen.size + " ===");
})();
