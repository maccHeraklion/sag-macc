// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Κουτσάκης (θερμοκήπιο, αγγούρι): τι καταγράφει ο αισθητήρας φύλλου;
// Ερώτηση Μιχάλη 5/10: η υδρονέφωση βρέχει τα φύλλα και το βλέπει ο αισθητήρας — πρέπει να αλλάξει κάτι;
// Μετράμε: (α) βήμα αποστολής, (β) επεισόδια υγρού φύλλου (> 15 %) — ώρα, διάρκεια, θερμοκρασία/RH αέρα,
// (γ) ώρες «υγρού» όπως τις μετρά ο πυρήνας (ΜΙΑ ανάγνωση ανά ωριαίο tick στο :21) έναντι της διάρκειας
// όπως φαίνεται από τα δείγματα. Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const LMS = "67fe9ae85fccdd000a4bdd42", EM = "69779a27a6e2fb0011490969";
const DAYS = 10, WET = 15;
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}
async function series(id, v, from) {
  const r = await get(`/device/${id}/data?variable=${v}&start_date=${from}&qty=5000&ordination=ascending`);
  return (r || []).map(x => ({ ms: Date.parse(x.time), v: Number(x.value) })).filter(p => Number.isFinite(p.v) && Number.isFinite(p.ms)).sort((a, b) => a.ms - b.ms);
}
const ath = (ms) => new Date(ms + 3 * 3600000).toISOString().slice(5, 16).replace("T", " ");
const near = (arr, ms, tolMin) => { let best = null, bd = Infinity; for (const p of arr) { const d = Math.abs(p.ms - ms); if (d < bd) { bd = d; best = p; } if (p.ms > ms + tolMin * 60000) break; } return bd <= tolMin * 60000 ? best : null; };
(async () => {
  console.log("ΦΥΛ=== ΚΟΥΤΣΑΚΗΣ · αισθητήρας φύλλου · " + new Date().toISOString() + " ===");
  const from = new Date(Date.now() - DAYS * 86400000).toISOString();
  let LM, LT, AT, AH;
  try {
    LM = await series(LMS, "leaf_moisture", from); LT = await series(LMS, "leaf_temperature", from);
    AT = await series(EM, "temperature", from); AH = await series(EM, "humidity", from);
  } catch (e) { console.log("ΦΥΛERR|" + e.message); return; }
  console.log(`ΦΥΛN|leaf_moisture ${LM.length} · leaf_temperature ${LT.length} · em320 T ${AT.length} · RH ${AH.length}`);
  if (LM.length < 3) { console.log("ΦΥΛ=== λίγα δείγματα ==="); return; }
  const gaps = []; for (let i = 1; i < LM.length; i++) gaps.push((LM[i].ms - LM[i - 1].ms) / 60000);
  gaps.sort((a, b) => a - b);
  console.log(`ΦΥΛΒ|βήμα (λεπτά): διάμεσος ${gaps[gaps.length >> 1].toFixed(1)} · 10% ${gaps[Math.floor(gaps.length * .1)].toFixed(1)} · 90% ${gaps[Math.floor(gaps.length * .9)].toFixed(1)} · μέγιστο ${gaps[gaps.length - 1].toFixed(0)}`);
  const vals = LM.map(p => p.v).sort((a, b) => a - b);
  console.log(`ΦΥΛΤ|τιμές: min ${vals[0]} · διάμεσος ${vals[vals.length >> 1]} · 90% ${vals[Math.floor(vals.length * .9)]} · max ${vals[vals.length - 1]} · >15: ${vals.filter(v => v > WET).length}/${vals.length}`);
  // επεισόδια: συνεχόμενα δείγματα > 15
  const eps = []; let cur = null;
  for (let i = 0; i < LM.length; i++) {
    const p = LM[i];
    if (p.v > WET) { if (!cur) cur = { s: p.ms, e: p.ms, n: 0, mx: 0, prevDry: i > 0 ? LM[i - 1].ms : null }; cur.e = p.ms; cur.n++; cur.mx = Math.max(cur.mx, p.v); cur.nextDry = i + 1 < LM.length ? LM[i + 1].ms : null; }
    else if (cur) { eps.push(cur); cur = null; }
  }
  if (cur) eps.push(cur);
  console.log(`ΦΥΛΕ|επεισόδια υγρού φύλλου: ${eps.length}`);
  for (const ep of eps.slice(-40)) {
    const t = near(AT, ep.s, 20), h = near(AH, ep.s, 20), lt = near(LT, ep.s, 5);
    const minDur = (ep.e - ep.s) / 60000, maxDur = ((ep.nextDry || ep.e) - (ep.prevDry || ep.s)) / 60000;
    console.log(`ΦΥΛε|${ath(ep.s)}|δείγματα ${ep.n}|διάρκεια ${minDur.toFixed(0)}–${maxDur.toFixed(0)} λ|max ${ep.mx}|αέρας ${t ? t.v : "—"} °C RH ${h ? h.v : "—"} %|φύλλο ${lt ? lt.v : "—"} °C`);
  }
  // ανά ώρα Ελλάδας: ποσοστό υγρών δειγμάτων
  const hr = Array.from({ length: 24 }, () => [0, 0]);
  for (const p of LM) { const hh = (new Date(p.ms).getUTCHours() + 3) % 24; hr[hh][1]++; if (p.v > WET) hr[hh][0]++; }
  console.log("ΦΥΛΩ|υγρά/σύνολο ανά ώρα Ελλάδας: " + hr.map((x, i) => i + ":" + x[0] + "/" + x[1]).join(" "));
  // πυρήνας: μία ανάγνωση στο :21 UTC κάθε ώρας (η τελευταία ≤ tick) → 1 ώρα υγρή ή όχι
  // δείγματα: κάθε υγρό δείγμα «κρατά» ως το επόμενο (άνω όριο διάρκειας) — σύγκριση ανά ημέρα Ελλάδας
  const day = (ms) => new Date(ms + 3 * 3600000).toISOString().slice(0, 10);
  const core = {}, held = {};
  const t0 = Math.ceil(LM[0].ms / 3600000) * 3600000 + 21 * 60000;
  let j = 0;
  for (let tk = t0; tk < LM[LM.length - 1].ms; tk += 3600000) {
    while (j + 1 < LM.length && LM[j + 1].ms <= tk) j++;
    if (LM[j].ms > tk || tk - LM[j].ms > 90 * 60000) continue;
    const d = day(tk); core[d] = (core[d] || 0) + (LM[j].v > WET ? 1 : 0);
  }
  for (let i = 0; i + 1 < LM.length; i++) if (LM[i].v > WET) { const d = day(LM[i].ms); held[d] = (held[d] || 0) + Math.min(LM[i + 1].ms - LM[i].ms, 90 * 60000) / 3600000; }
  const ds = [...new Set([...Object.keys(core), ...Object.keys(held)])].sort();
  console.log("ΦΥΛΗ|ημέρα: ώρες πυρήνα (1 ανάγνωση/ώρα) · ώρες από δείγματα (άνω όριο): " + ds.map(d => d.slice(5) + " " + (core[d] || 0) + "·" + (held[d] || 0).toFixed(1)).join(" | "));
  console.log("ΦΥΛ=== ΤΕΛΟΣ ===");
})();
