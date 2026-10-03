// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Γύρος 2: ΑΥΣΤΗΡΑ τεστ για το τι είναι το rain_gauge του S2120.
// Δύο αντίπαλα μοντέλα για τον ωμό ρυθμό r = rain_gauge×12 (mm/h):
//  Μ10 (τεκμηρίωση Seeed): r = βροχή τελευταίων 10΄ × 6 → κάθε μη μηδενική τιμή = n × 1,524 mm/h (n ακέραιος ≥ 1),
//       και r = 0 όταν ο μετρητής δεν κινήθηκε για > 10΄.
//  ΜΔ (διάστημα ανατροπών): r = 914,4 / s, s = δευτερόλεπτα (ακέραια;) → φθίνει χωρίς να μηδενίζει όσο δεν πέφτει βροχή.
// Ανοχές ΣΦΙΧΤΕΣ (η πρώτη εκδοχή είχε ανοχή ±0,5 s που την περνά κάθε αριθμός — άκυρο τεστ).
// Τυχαία βάση: για ομοιόμορφα κλάσματα, P(|x−round(x)| ≤ 0,01) = 2 %.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ST = { "684c342a13af9d000a77bef3": "049e", "684c4e48cc1cd8000a10ddb9": "047c", "681c8f9c4f9c59000a0e3368": "04A4",
  "681c8f237a6e41000a900c8d": "03A4", "6a313eebd5cee5000c01c612": "01f3", "681c8f3d4f9c59000a0e267a": "0503",
  "681c8f825e2146000a16693b": "053E", "684c458bcd7675000a9ae991": "04e8", "69aed3c9962d2c00097b621f": "00c5",
  "67fe9a063b56fa000ac75c4b": "0138", "67fe99b670defa000a954bbe": "057C", "6818812a6c0953000a1ab9c8": "0534",
  "6971054abb3d630010741e09": "00d8", "681c8f5c8ee17b000a45de39": "03FC", "684c39adfcf7b1000a8dd206": "047e",
  "680e7c7822d66f000b008ff6": "0401*", "6797626820ac9d000954e70d": "0495*", "683379a2038bf5000a7eaaf3": "052A*",
  "683379ed697657000a7185e2": "054F*", "680e7bf064c02e000a714dcd": "04e0*" };
const K0 = 914.4, TIP = 0.254;
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 100));
  return j.result;
}
const rd = (id, v) => get(`/device/${id}/data?variables=${v}&qty=2400`).catch(() => []);
const near = (x, tol) => Math.abs(x - Math.round(x)) <= tol;
const pct = (a, b) => b ? (Math.round(1000 * a / b) / 10) + "%" : "-";
const qtl = (a, q) => { if (!a.length) return "-"; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]); };
const G = { nz: 0, m10: 0, below: 0, sInt: 0, sInt6: 0, stale: 0, staleNZ: 0, e300: [], eRx: [], tailShareP: 0, P: 0, C: 0 };
(async () => {
  console.log("=== ΓΥΡΟΣ 2 · " + new Date().toISOString() + " ===");
  for (const [id, nm] of Object.entries(ST)) {
    try {
      const old = nm.endsWith("*");
      const [g, a] = await Promise.all([rd(id, old ? "rain_height" : "rain_gauge"), old ? Promise.resolve([]) : rd(id, "rain_height_acc")]);
      const m = new Map();
      for (const x of (Array.isArray(g) ? g : [])) { const t = Date.parse(x.time); (m.get(t) || m.set(t, {}).get(t)).g = Number(x.value); }
      for (const x of (Array.isArray(a) ? a : [])) { const t = Date.parse(x.time); (m.get(t) || m.set(t, {}).get(t)).a = Number(x.value); }
      const S = [...m.entries()].map(([t, o]) => ({ t, ...o })).filter(o => Number.isFinite(o.g)).sort((x, y) => x.t - y.t);
      let lastA = null, lastMove = null;
      const L = { nz: 0, m10: 0, below: 0, sInt: 0, sInt6: 0, stale: 0, staleNZ: 0, e300: [], eRx: [], P: 0, Ptail: 0, C: 0 };
      for (let i = 0; i < S.length; i++) {
        const o = S[i], p = S[i - 1];
        if (Number.isFinite(o.a)) { if (lastA !== null && o.a - lastA > 0.001) { lastMove = o.t; L.C += o.a - lastA; } lastA = o.a; }
        const r = o.g * 12;
        L.P += o.g;
        if (r > 0) {
          L.nz++;
          if (r >= 1.524 - 1e-6 && near(r / 1.524, 0.001)) L.m10++;           // συμβατό με Μ10
          if (r < 1.524 - 1e-6) L.below++;                                       // ΑΔΥΝΑΤΟ για Μ10
          const s = K0 / r;
          if (near(s, 0.01)) L.sInt++;                                           // συμβατό με ΜΔ (ακέραια s)
          if (near(s / 6, 0.01 / 6)) L.sInt6++;
        }
        // Μ10 προβλέπει r=0 αν ο μετρητής ακίνητος > 15΄ (3 uplinks)
        if (!old && lastMove !== null && o.t - lastMove > 15 * 60e3 && Number.isFinite(o.a)) { L.stale++; if (r > 0) { L.staleNZ++; L.Ptail += o.g; } }
        // ΜΔ ουρά: s_k − s_{k-1} = διάστημα μέτρησης της συσκευής (300 s) ή χρόνος λήψης Δt
        if (p && r > 0 && p.g > 0 && !old && lastMove !== null && o.t - lastMove > 15 * 60e3) {
          const ds = K0 / r - K0 / (p.g * 12), dt = (o.t - p.t) / 1000;
          if (dt > 200 && dt < 400) { L.e300.push(Math.abs(ds - 300)); L.eRx.push(Math.abs(ds - dt)); }
        }
      }
      for (const k of ["nz", "m10", "below", "sInt", "sInt6", "stale", "staleNZ"]) G[k] += L[k];
      G.e300.push(...L.e300); G.eRx.push(...L.eRx); G.P += L.P; G.C += L.C; G.tailShareP += L.Ptail;
      const e1 = L.e300.filter(x => x <= 1).length, e6 = L.e300.filter(x => x <= 6).length;
      console.log(`R|${nm}|μη μηδ.=${L.nz}|Μ10: πολλ.1,524=${pct(L.m10, L.nz)} κάτω από 1,524=${pct(L.below, L.nz)}`
        + `|ΜΔ: s ακέραιο(±0,01)=${pct(L.sInt, L.nz)} s πολλ.6=${pct(L.sInt6, L.nz)}`
        + (old ? "" : `|μετρητής ακίνητος>15΄: σημεία=${L.stale} με r>0=${pct(L.staleNZ, L.stale)}`
        + `|ουρά Δs−300: ≤1s ${pct(e1, L.e300.length)} ≤6s ${pct(e6, L.e300.length)} n=${L.e300.length} p50=${qtl(L.e300, 0.5)} p90=${qtl(L.e300, 0.9)}`
        + `|Δs−Δt_λήψης p50=${qtl(L.eRx, 0.5)}|P=${Math.round(L.P)} C=${Math.round(L.C)} P/C=${L.C ? (L.P / L.C).toFixed(2) : "-"} ουρά/P=${pct(L.Ptail, L.P)}`));
    } catch (e) { console.log("ERR|" + nm + "|" + e.message); }
  }
  const e1 = G.e300.filter(x => x <= 1).length, e6 = G.e300.filter(x => x <= 6).length;
  console.log(`ΣΥΝ|μη μηδ.=${G.nz}|Μ10 πολλ.1,524=${pct(G.m10, G.nz)}|κάτω από 1,524 (αδύνατο για Μ10)=${pct(G.below, G.nz)}|ΜΔ s ακέραιο=${pct(G.sInt, G.nz)} (τυχαία βάση 2%)`
    + `|μετρητής ακίνητος>15΄ με r>0=${pct(G.staleNZ, G.stale)} (Μ10 προβλέπει 0%)|ουρά Δs−300 ≤1s=${pct(e1, G.e300.length)} ≤6s=${pct(e6, G.e300.length)} n=${G.e300.length}`
    + `|ΣP/ΣC=${(G.P / G.C).toFixed(2)}|ουρά/P=${pct(G.tailShareP, G.P)}`);
  console.log("=== ΤΕΛΟΣ ===");
})();
