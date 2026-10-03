// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ΤΙ ΑΚΡΙΒΩΣ ΜΕΤΡΑ ΤΟ rain_gauge ΤΟΥ S2120.
// Υπόθεση Η: ωμός ρυθμός r (mm/h) = rain_gauge×12 = 914,4 / s, όπου 914,4 = 0,254 mm × 3600 και s = δευτερόλεπτα
// (α) ανάμεσα στις δύο τελευταίες ανατροπές, ή (β) από την τελευταία ανατροπή όταν αυτό είναι μεγαλύτερο (φθίνουσα ουρά).
// Τεστ: Τ1 ουρά (s αυξάνει κατά Δt όταν ο μετρητής δεν κινείται) · Τ2 κβάντο 6 s · Τ3 συνέπεια με τον αριθμό
// ανατροπών του μετρητή · Τ4 κβάντο μετρητή 0,254 · Τ5 πότε μηδενίζει · Τ6 βάθη ανά τοπική ημέρα:
// μετρητής (C) · άθροισμα parser (P = Σ rain_gauge, ό,τι αθροίζει το σύστημα) · ολοκλήρωμα ρυθμού με τα πραγματικά
// διαστήματα (I) · ανακατασκευή ανατροπών από τον ρυθμό (R) · ό,τι βλέπει ο πυρήνας (K = μέσος×24).
// Πολιτική 6ac171e063d4f4000b05d9e5 (προσωρινή, ανάγνωση). ΚΑΜΙΑ εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ACC = { "684c342a13af9d000a77bef3": "049e", "684c4e48cc1cd8000a10ddb9": "047c", "681c8f9c4f9c59000a0e3368": "04A4",
  "681c8f237a6e41000a900c8d": "03A4", "6a313eebd5cee5000c01c612": "01f3", "681c8f3d4f9c59000a0e267a": "0503",
  "681c8f825e2146000a16693b": "053E", "684c458bcd7675000a9ae991": "04e8", "69aed3c9962d2c00097b621f": "00c5",
  "67fe9a063b56fa000ac75c4b": "0138", "67fe99b670defa000a954bbe": "057C", "6818812a6c0953000a1ab9c8": "0534",
  "6971054abb3d630010741e09": "00d8", "681c8f5c8ee17b000a45de39": "03FC", "684c39adfcf7b1000a8dd206": "047e" };
const OLD = { "680e7c7822d66f000b008ff6": "0401", "6797626820ac9d000954e70d": "0495", "683379a2038bf5000a7eaaf3": "052A",
  "683379ed697657000a7185e2": "054F", "67f3ec9f30b56a00090d20d6": "04c5", "680e7bf064c02e000a714dcd": "04e0" };
const K0 = 914.4, TIP = 0.254, SINCE = Date.parse("2026-09-27T00:00:00Z");
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 100));
  return j.result;
}
const rd = (id, v) => get(`/device/${id}/data?variables=${v}&qty=2400`).catch(() => []);
const day = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(5, 10);
const f1 = (x) => Number.isFinite(x) ? (Math.round(x * 10) / 10).toString() : "-";
const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "-";

async function station(id, nm, hasAcc) {
  const [g, a] = await Promise.all([rd(id, hasAcc ? "rain_gauge" : "rain_height"), hasAcc ? rd(id, "rain_height_acc") : Promise.resolve([])]);
  const m = new Map();
  for (const x of (Array.isArray(g) ? g : [])) { const t = Date.parse(x.time); (m.get(t) || m.set(t, {}).get(t)).g = Number(x.value); }
  for (const x of (Array.isArray(a) ? a : [])) { const t = Date.parse(x.time); (m.get(t) || m.set(t, {}).get(t)).a = Number(x.value); }
  const S = [...m.entries()].map(([t, o]) => ({ t, ...o })).filter(o => Number.isFinite(o.g)).sort((x, y) => x.t - y.t);
  // διαφορά μετρητή ως προς το ΠΡΟΗΓΟΥΜΕΝΟ σημείο με μετρητή
  let lastA = null;
  for (const o of S) { if (Number.isFinite(o.a)) { o.dA = lastA === null ? null : o.a - lastA; lastA = o.a; } else o.dA = null; }
  const T = { n: 0, q6: 0, q1: 0, tailN: 0, tailFit: 0, tailE: [], tipN: 0, tipFit: 0, accQ: 0, accN: 0, neg: 0, zeros: 0, sBeforeZero: [], sMax: 0 };
  const D = {};   // ανά ημέρα
  const dd = (k) => (D[k] = D[k] || { C: 0, P: 0, I: 0, R: 0, sumg: 0, ng: 0 });
  for (let i = 0; i < S.length; i++) {
    const o = S[i], p = S[i - 1];
    const r = o.g * 12, s = r > 0 ? K0 / r : null, dt = p ? (o.t - p.t) / 1000 : null;
    if (s !== null) { T.n++; if (Math.abs(s / 6 - Math.round(s / 6)) * 6 <= 0.5) T.q6++; if (Math.abs(s - Math.round(s)) <= 0.5) T.q1++; if (s > T.sMax) T.sMax = s; }
    if (o.g === 0 && p && p.g > 0) { T.zeros++; T.sBeforeZero.push(Math.round(K0 / (p.g * 12))); }
    if (Number.isFinite(o.dA) && o.dA !== null) {
      if (o.dA < -0.001) T.neg++;
      if (o.dA > 0.001) { T.accN++; if (Math.abs(o.dA / TIP - Math.round(o.dA / TIP)) * TIP <= 0.003) T.accQ++; }
    }
    const ps = p && p.g > 0 ? K0 / (p.g * 12) : null;
    // Τ1: καμία ανατροπή (μετρητής ακίνητος) → s_k − s_{k-1} = Δt
    if (s !== null && ps !== null && dt !== null && dt < 1200 && o.t >= SINCE) {
      const noTip = hasAcc ? (o.dA !== null && Math.abs(o.dA) < 0.001) : (s > ps);
      if (noTip) { T.tailN++; const e = (s - ps) - dt; T.tailE.push(Math.abs(e)); if (Math.abs(e) <= 7) T.tailFit++; }
      // Τ3: Ν ανατροπές στο παράθυρο → (Ν≥2: s ≤ Δt) · (Ν=1: s_{k-1} ≤ s ≤ s_{k-1}+Δt)
      if (hasAcc && o.dA !== null && o.dA > 0.001) {
        const N = Math.round(o.dA / TIP); T.tipN++;
        const ok = N >= 2 ? (s <= dt + 7) : (s >= ps - 7 && s <= ps + dt + 7);
        if (ok) T.tipFit++;
      }
    }
    if (o.t < SINCE) continue;
    const k = dd(day(o.t));
    if (hasAcc && o.dA !== null && o.dA > 0.001) k.C += o.dA;
    k.P += o.g; k.sumg += o.g; k.ng++;
    if (dt !== null && dt < 1800) k.I += r * dt / 3600;
    // ανακατασκευή ανατροπών μόνο από τον ρυθμό: «άλμα» προς τα πάνω σε σχέση με την ουρά = ανατροπή(ές)
    if (s !== null && dt !== null) {
      const expectTail = ps !== null ? ps + dt : Infinity;
      if (s < expectTail - 7) k.R += TIP * Math.max(1, Math.round(Math.min(dt, 3600) / Math.max(s, 6)));
    }
  }
  const md = T.tailE.length ? T.tailE.sort((x, y) => x - y)[Math.floor(T.tailE.length / 2)] : null;
  console.log(`T|${nm}|${hasAcc ? "acc" : "fw1.13"}|σημεία=${S.length}|Τ2 κβάντο6s=${pct(T.q6, T.n)} (ακέραιο s ${pct(T.q1, T.n)}) n=${T.n}`
    + `|Τ1 ουρά=${pct(T.tailFit, T.tailN)} n=${T.tailN} διάμεσο|e|=${f1(md)}s|Τ3 ανατροπές=${pct(T.tipFit, T.tipN)} n=${T.tipN}`
    + `|Τ4 μετρητής 0,254=${pct(T.accQ, T.accN)} n=${T.accN} αρνητ=${T.neg}|Τ5 μηδενισμοί=${T.zeros} s πριν το 0=${T.sBeforeZero.slice(0, 6).join(",")} s_max=${Math.round(T.sMax)}`);
  const rows = Object.entries(D).filter(([, v]) => v.C > 0.2 || v.P > 0.2).map(([d, v]) =>
    `${d} C${f1(v.C)} P${f1(v.P)} I${f1(v.I)} R${f1(v.R)} K${f1(v.ng ? v.sumg / v.ng * 24 : NaN)}`);
  const tot = Object.values(D).reduce((s, v) => ({ C: s.C + v.C, P: s.P + v.P, I: s.I + v.I, R: s.R + v.R }), { C: 0, P: 0, I: 0, R: 0 });
  console.log(`D|${nm}|ΣΥΝΟΛΟ C${f1(tot.C)} P${f1(tot.P)} I${f1(tot.I)} R${f1(tot.R)}|${rows.join(" ; ")}`);
}
(async () => {
  console.log("=== ΜΟΝΤΕΛΟ rain_gauge · " + new Date().toISOString() + " · από 27/9 (τοπική ημέρα) ===");
  for (const [id, nm] of Object.entries(ACC)) { try { await station(id, nm, true); } catch (e) { console.log("ERR|" + nm + "|" + e.message); } }
  for (const [id, nm] of Object.entries(OLD)) { try { await station(id, nm, false); } catch (e) { console.log("ERR|" + nm + "|" + e.message); } }
  console.log("=== ΤΕΛΟΣ ===");
})();
