// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Γύρος 3: σε παράθυρα με Ν ανατροπές (από τον μετρητή) ποιος τύπος δίνει τον ρυθμό;
// Για κάθε 5λεπτο με Ν = ΔA/0,254 ανατροπές: s = 914,4 / r. Αν r = 914,4·j / T με T ακέραια δευτερόλεπτα, τότε s·j ακέραιο.
// Πίνακας Ν × j (j = 1..6): ποσοστό με |s·j − ακέραιο| ≤ 0,01·j. Η διαγώνιος j=Ν → «ανατροπές στο παράθυρο / χρόνος»·
// j=Ν−1 → «διαστήματα μεταξύ πρώτης και τελευταίας ανατροπής»· j=1 → «τελευταίο διάστημα».
// Επίσης λόγος q = rain_gauge / ΔA (ό,τι αθροίζει το σύστημα ÷ ό,τι έπεσε) ανά Ν: διάμεσος και τεταρτημόρια.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ST = ["684c342a13af9d000a77bef3", "684c4e48cc1cd8000a10ddb9", "681c8f9c4f9c59000a0e3368", "681c8f237a6e41000a900c8d",
  "6a313eebd5cee5000c01c612", "681c8f3d4f9c59000a0e267a", "681c8f825e2146000a16693b", "684c458bcd7675000a9ae991",
  "69aed3c9962d2c00097b621f", "67fe9a063b56fa000ac75c4b", "67fe99b670defa000a954bbe", "6818812a6c0953000a1ab9c8",
  "6971054abb3d630010741e09", "681c8f5c8ee17b000a45de39", "684c39adfcf7b1000a8dd206"];
const K0 = 914.4, TIP = 0.254;
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 100));
  return j.result;
}
const rd = (id, v) => get(`/device/${id}/data?variables=${v}&qty=2400`).catch(() => []);
const near = (x, tol) => Math.abs(x - Math.round(x)) <= tol;
const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "-";
const qs = (a) => { if (!a.length) return "-"; const s = a.slice().sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); return q(0.25) + "/" + q(0.5) + "/" + q(0.75); };
const M = {}; const Q = {}; const ZERO = {}; const NN = {};
(async () => {
  console.log("=== ΓΥΡΟΣ 3 · " + new Date().toISOString() + " ===");
  for (const id of ST) {
    try {
      const [g, a] = await Promise.all([rd(id, "rain_gauge"), rd(id, "rain_height_acc")]);
      const m = new Map();
      for (const x of (Array.isArray(g) ? g : [])) { const t = Date.parse(x.time); (m.get(t) || m.set(t, {}).get(t)).g = Number(x.value); }
      for (const x of (Array.isArray(a) ? a : [])) { const t = Date.parse(x.time); (m.get(t) || m.set(t, {}).get(t)).a = Number(x.value); }
      const S = [...m.entries()].map(([t, o]) => ({ t, ...o })).filter(o => Number.isFinite(o.g) && Number.isFinite(o.a)).sort((x, y) => x.t - y.t);
      for (let i = 1; i < S.length; i++) {
        const o = S[i], p = S[i - 1], dt = (o.t - p.t) / 1000;
        if (dt < 240 || dt > 360) continue;                          // μόνο κανονικά 5λεπτα
        const N = Math.round((o.a - p.a) / TIP);
        if (N < 1 || N > 40) continue;
        const key = N >= 6 ? "6+" : String(N);
        NN[key] = (NN[key] || 0) + 1;
        if (!(o.g > 0)) { ZERO[key] = (ZERO[key] || 0) + 1; continue; }   // ανατροπή αλλά ρυθμός 0
        const s = K0 / (o.g * 12);
        (Q[key] = Q[key] || []).push(o.g / (o.a - p.a));
        const row = M[key] = M[key] || { n: 0, j: [0, 0, 0, 0, 0, 0, 0] };
        row.n++;
        for (let j = 1; j <= 6; j++) if (near(s * j, 0.01 * j)) row.j[j]++;
      }
    } catch (e) { console.log("ERR|" + id + "|" + e.message); }
  }
  for (const key of ["1", "2", "3", "4", "5", "6+"]) {
    const row = M[key]; if (!row) continue;
    console.log(`N=${key}|παράθυρα=${NN[key]}|ρυθμός 0 παρά τις ανατροπές=${ZERO[key] || 0}|s·j ακέραιο: ` + [1, 2, 3, 4, 5, 6].map(j => `j${j}=${pct(row.j[j], row.n)}`).join(" ")
      + `|q=rain_gauge/ΔA (p25/p50/p75)=${qs(Q[key] || [])}`);
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
