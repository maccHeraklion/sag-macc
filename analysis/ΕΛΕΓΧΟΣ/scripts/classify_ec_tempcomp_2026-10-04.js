// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · P1 / μητρώο #204 · στατιστική κατάταξη σονδών αγωγιμότητας εδάφους:
// διορθώνει η ΣΟΝΔΑ τη θερμοκρασία (κλίση ≈ 0) ή ΟΧΙ (κλίση ≈ +0,020 /°C);
// Μέθοδος 16/9: κλίση ∂ln(EC)/∂T ΕΝΤΟΣ κάδων υγρασίας 0,5 % (σταθερά αποτελέσματα ανά κάδο), 14 ημέρες,
// δύο ανεξάρτητα δείγματα: Α = όλη μέρα · Β = μόνο νύχτα 22:00–06:00 ώρα Ελλάδας, εξαιρώντας 3 ω μετά από άλμα υγρασίας.
// Φίλτρα: EC ≥ 30 µS/cm (νεκρό όργανο), υγρασία > 15 % (όριο Hilhorst του πυρήνα), κάδος με n ≥ 6 και εύρος T ≥ 1,5 °C.
// Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const TYPES = ["se0x", "lse02", "lse01", "lse01_shallow", "lse01_deep", "se01", "se02_lb"];
const CH = [
  { k: "1", ec: "conduct_soil1", m: "soil_moisture1", t: "soil_temperature1" },
  { k: "2", ec: "conduct_soil2", m: "soil_moisture2", t: "soil_temperature2" },
  { k: "0", ec: "conduct_soil", m: "soil_moisture", t: "temp_soil" },
];
const DAYS = 14;
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
async function series(id, v, from) {
  const r = await get(`/device/${id}/data?variable=${v}&start_date=${from}&qty=10000&ordination=ascending`);
  const out = new Map();
  for (const x of (r || [])) { const n = Number(x.value); if (Number.isFinite(n)) out.set(x.time, n); }
  return out;
}
// σταθερά αποτελέσματα ανά κάδο υγρασίας
function fe(points) {
  const bins = new Map();
  for (const p of points) { const b = Math.round(p.m * 2) / 2; (bins.get(b) || bins.set(b, []).get(b)).push(p); }
  let sxy = 0, sxx = 0, n = 0, nb = 0; const resid = [];
  for (const [, arr] of bins) {
    if (arr.length < 6) continue;
    const ts = arr.map(p => p.t), tmin = Math.min(...ts), tmax = Math.max(...ts);
    if (tmax - tmin < 1.5) continue;
    const mt = ts.reduce((a, b) => a + b, 0) / arr.length, my = arr.reduce((a, p) => a + p.y, 0) / arr.length;
    for (const p of arr) { sxy += (p.t - mt) * (p.y - my); sxx += (p.t - mt) ** 2; }
    n += arr.length; nb++; arr._mt = mt; arr._my = my; resid.push(arr);
  }
  if (sxx <= 0 || nb === 0) return null;
  const slope = sxy / sxx;
  let sse = 0; for (const arr of resid) for (const p of arr) { const e = (p.y - arr._my) - slope * (p.t - arr._mt); sse += e * e; }
  const se = Math.sqrt(sse / Math.max(n - nb - 1, 1) / sxx);
  return { slope, se, n, nb };
}
const athHour = (iso) => (new Date(iso).getUTCHours() + 3) % 24;   // Οκτώβριος: EEST (UTC+3) ως 25/10
(async () => {
  console.log("ΕΕΕ=== ΚΑΤΑΤΑΞΗ ΣΟΝΔΩΝ EC (αντιστάθμιση θερμοκρασίας) · " + new Date().toISOString() + " ===");
  const from = new Date(Date.now() - DAYS * 86400000).toISOString();
  const seen = new Set();
  for (const ty of TYPES) {
    let devs = [];
    try { devs = await get(`/device?filter[tags][0][key]=type&filter[tags][0][value]=${ty}&amount=200`); } catch (x) { console.log("ΕΕΕERR|λίστα " + ty + "|" + x.message); continue; }
    for (const d of devs) {
      if (seen.has(d.id)) continue; seen.add(d.id);
      for (const c of CH) {
        try {
          const E = await series(d.id, c.ec, from);
          if (E.size < 20) continue;
          const M = await series(d.id, c.m, from), T = await series(d.id, c.t, from);
          const pts = [];
          for (const [time, ec] of E) {
            const m = M.get(time), t = T.get(time);
            if (!(ec >= 30) || !(m > 15) || !Number.isFinite(t)) continue;
            pts.push({ time, y: Math.log(ec), m, t, ms: Date.parse(time) });
          }
          pts.sort((a, b) => a.ms - b.ms);
          // Β: νύχτα, χωρίς 3 ω μετά από άλμα υγρασίας (> 1 μονάδα από το προηγούμενο σημείο)
          let lastJump = -Infinity; const night = [];
          for (let i = 0; i < pts.length; i++) {
            if (i > 0 && pts[i].m - pts[i - 1].m > 1.0) lastJump = pts[i].ms;
            const h = athHour(pts[i].time);
            if ((h >= 22 || h < 6) && pts[i].ms - lastJump > 3 * 3600000) night.push(pts[i]);
          }
          const A = fe(pts), B = fe(night);
          const tR = pts.length ? (Math.max(...pts.map(p => p.t)) - Math.min(...pts.map(p => p.t))).toFixed(1) : "—";
          const cls = (r) => !r ? "?" : (r.slope < 0.008 ? "ΑΝΤ" : r.slope > 0.012 ? "ΧΩΡΙΣ" : "?");
          const ca = cls(A), cb = cls(B);
          const verdict = (ca === cb && ca !== "?") ? (ca === "ΑΝΤ" ? "ΑΝΤΙΣΤΑΘΜΙΖΕΙ_ΣΤΗ_ΣΟΝΔΑ" : "ΧΩΡΙΣ_ΑΝΤΙΣΤΑΘΜΙΣΗ")
            : (ca !== "?" && cb === "?" && B === null) ? (ca === "ΑΝΤ" ? "ΑΝΤΙΣΤΑΘΜΙΖΕΙ(μόνο Α)" : "ΧΩΡΙΣ(μόνο Α)") : "ΑΒΕΒΑΙΟ";
          const f = (r) => r ? r.slope.toFixed(4) + "±" + r.se.toFixed(4) + " n" + r.n + "/κ" + r.nb : "—";
          console.log("ΕΕΕC|" + d.name + "|" + ty + "|κ" + c.k + "|" + d.id + "|A " + f(A) + "|B " + f(B) + "|ΔT " + tR + "|σημεία " + pts.length + "/" + E.size + "|" + verdict);
        } catch (x) { console.log("ΕΕΕERR|" + d.name + "|κ" + c.k + "|" + x.message); }
      }
    }
  }
  console.log("ΕΕΕ=== ΤΕΛΟΣ · συσκευές " + seen.size + " ===");
})();
