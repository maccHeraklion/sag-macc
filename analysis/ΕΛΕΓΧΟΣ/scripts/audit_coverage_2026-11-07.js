// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Κάλυψη 24ώρου στα όργανα αέρα: ποιες ώρες λείπουν, σε ποιο σημείο της ημέρας, και πόσο στρεβλώνει ο μέσος δειγμάτων (όπως το query avg του TagoIO).
// Ανά όργανο 120 ώρες θερμοκρασίας και 48 ώρες φωτός (μόνο S2120). Παράθυρα 24 ωρών που κλείνουν 00:21 UTC, όπως ο ημερήσιος παλμός. Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών πέρα από type.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "CV|";
const HOURS = 120, LIGHTH = 48, TZ = 2; // Νοέμβριος: Ελλάδα = UTC+2
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const f2 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "-" : String(Math.round(x * 100) / 100));
const pc = (a, b) => (b ? Math.round(100 * a / b) : 0);
const VARS = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature" };
const H = 3600000;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now(); const h1 = Math.floor(now / H) * H; const h0 = h1 - HOURS * H;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const dev = {};
  for (const f of fields) {
    let ids = []; try { ids = Object.values(JSON.parse(String(tag(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; }
    for (const id of ids.filter((x) => /^[0-9a-f]{24}$/i.test(x))) if (!dev[id]) dev[id] = {};
  }
  for (const [id, d] of Object.entries(dev)) { try { const x = await get(`/device/${id}`); d.t = String(tag(x, "type") || ""); d.nm = String(x.name || "").slice(-14); } catch (e) { d.t = "ΣΦΑΛΜΑ"; } }
  const blocks = {}; const W = {}; let records = 0; const rows = [];
  for (const [id, d] of Object.entries(dev)) {
    const v = VARS[d.t]; if (!v) continue;
    let r0; try { r0 = await get(`/device/${id}/data?variables=${v}&start_date=${new Date(h0 - 26 * H).toISOString()}&end_date=${new Date(now).toISOString()}&qty=3000`); } catch (e) { continue; }
    records += r0.length;
    const pts = r0.map((r) => ({ t: Date.parse(r.time), v: Number(r.value) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
    if (!pts.length || now - pts[pts.length - 1].t > 6 * H) continue; // μόνο ζωντανά όργανα
    const hb = {}; for (const p of pts) { const k = Math.floor(p.t / H); (hb[k] = hb[k] || []).push(p.v); }
    let miss = 0, night = 0, nightN = 0, day = 0, dayN = 0, run = 0, longest = 0;
    for (let t = h0; t < h1; t += H) {
      const k = t / H; const lh = (new Date(t).getUTCHours() + TZ) % 24; const b = Math.floor(lh / 3) * 3;
      const B = blocks[d.t + "|" + b] || (blocks[d.t + "|" + b] = { n: 0, m: 0 }); B.n++;
      const isN = lh >= 18 || lh < 6; if (isN) nightN++; else dayN++;
      if (!hb[k]) { miss++; B.m++; if (isN) night++; else day++; run++; if (run > longest) longest = run; } else run = 0;
    }
    rows.push({ nm: d.nm, t: d.t, miss, night, nightN, day, dayN, longest, id });
    // παράθυρα 24 ωρών που κλείνουν 00:21 UTC
    const k0 = Math.floor(now / (24 * H)) * 24 * H + 21 * 60000;
    for (let e = k0; e > h0 + 24 * H; e -= 24 * H) {
      if (e > now) continue;
      const w = pts.filter((p) => p.t > e - 24 * H && p.t <= e); if (w.length < 6) continue;
      const sm = w.reduce((s, p) => s + p.v, 0) / w.length;
      const bins = []; for (let i = 0; i < 24; i++) { const a = e - (24 - i) * H, z = a + H; const x = w.filter((p) => p.t > a && p.t <= z); bins.push(x.length ? x.reduce((s, p) => s + p.v, 0) / x.length : null); }
      const have = bins.filter((x) => x !== null); const hbm = have.reduce((s, x) => s + x, 0) / have.length;
      const fill = bins.slice(); for (let i = 0; i < 24; i++) if (fill[i] === null) { let a = i - 1, z = i + 1; while (a >= 0 && bins[a] === null) a--; while (z < 24 && bins[z] === null) z++; fill[i] = a >= 0 && z < 24 ? bins[a] + (bins[z] - bins[a]) * (i - a) / (z - a) : (a >= 0 ? bins[a] : bins[z]); }
      const fm = fill.reduce((s, x) => s + x, 0) / 24; const mn = Math.min(...w.map((p) => p.v)); const fmn = Math.min(mn, ...fill);
      const X = W[d.t] || (W[d.t] = { n: 0, hrs: [], dB: [], dF: [], dMin: [], low18: 0, low20: 0 }); X.n++; X.hrs.push(have.length); X.dB.push(Math.abs(sm - hbm)); X.dF.push(Math.abs(sm - fm)); X.dMin.push(Math.abs(mn - fmn)); if (have.length < 20) X.low20++; if (have.length < 18) X.low18++;
    }
  }
  const byT = {}; for (const r of rows) { const b = byT[r.t] || (byT[r.t] = { dev: 0, miss: 0, n: 0, night: 0, nightN: 0, day: 0, dayN: 0, with: 0 }); b.dev++; b.miss += r.miss; b.n += HOURS; b.night += r.night; b.nightN += r.nightN; b.day += r.day; b.dayN += r.dayN; if (r.miss) b.with++; }
  for (const [t, b] of Object.entries(byT)) console.log(P + "ΤΥΠΟΣ|" + t + "|ζωντανά=" + b.dev + "|με κενή ώρα=" + b.with + "|ώρες χωρίς δείγμα " + b.miss + "/" + b.n + " (" + pc(b.miss, b.n) + "%)|νύχτα 18-06 " + pc(b.night, b.nightN) + "%|μέρα 06-18 " + pc(b.day, b.dayN) + "%");
  for (const k of Object.keys(blocks).sort((a, b) => { const [x, y] = a.split("|"), [z, w] = b.split("|"); return x === z ? y - w : (x < z ? -1 : 1); })) console.log(P + "ΤΡΙΩΡΟ|" + k + "|κενές " + pc(blocks[k].m, blocks[k].n) + "% (" + blocks[k].m + "/" + blocks[k].n + ")");
  for (const [t, X] of Object.entries(W)) console.log(P + "ΠΑΡΑΘΥΡΟ|" + t + "|παράθυρα=" + X.n + "|ώρες διάμ=" + q(X.hrs, 0.5) + " p5=" + q(X.hrs, 0.05) + " ελάχ=" + Math.min(...X.hrs) + "|<20 ώρες " + X.low20 + " · <18 ώρες " + X.low18 + "|μέσος δειγμάτων−ανά ώρα διάμ=" + f2(q(X.dB, 0.5)) + " p95=" + f2(q(X.dB, 0.95)) + " max=" + f2(Math.max(...X.dB)) + "|−με παρεμβολή διάμ=" + f2(q(X.dF, 0.5)) + " p95=" + f2(q(X.dF, 0.95)) + " max=" + f2(Math.max(...X.dF)) + "|ελάχιστο−με παρεμβολή p95=" + f2(q(X.dMin, 0.95)) + " max=" + f2(Math.max(...X.dMin)));
  rows.sort((a, b) => b.miss - a.miss);
  for (const r of rows.filter((x) => x.miss >= 6).slice(0, 25)) console.log(P + "ΟΡΓΑΝΟ|" + r.nm + "|" + r.t + "|κενές " + r.miss + "/" + HOURS + "|νύχτα " + r.night + " μέρα " + r.day + "|μέγιστο κενό " + r.longest + " ώρες");
  // φως έναντι θερμοκρασίας στον ίδιο σταθμό, 48 ώρες
  let lt = 0, lb = 0, tOnly = 0, lOnly = 0, none = 0; const l0 = h1 - LIGHTH * H;
  for (const r of rows.filter((x) => x.t === "s2120")) {
    try {
      const [a, b] = await Promise.all(["air_temperature", "light_intensity"].map((v) => get(`/device/${r.id}/data?variables=${v}&start_date=${new Date(l0).toISOString()}&end_date=${new Date(h1).toISOString()}&qty=1000`)));
      records += a.length + b.length; const ha = new Set(a.map((x) => Math.floor(Date.parse(x.time) / H))), hl = new Set(b.map((x) => Math.floor(Date.parse(x.time) / H)));
      for (let t = l0; t < h1; t += H) { const k = t / H; const A = ha.has(k), L = hl.has(k); lt++; if (A && L) lb++; else if (A) tOnly++; else if (L) lOnly++; else none++; }
    } catch (e) { /* επόμενος */ }
  }
  console.log(P + "ΦΩΣ|ώρες σταθμών=" + lt + "|και τα δύο " + lb + " (" + pc(lb, lt) + "%)|μόνο θερμοκρασία " + tOnly + " (" + pc(tOnly, lt) + "%)|μόνο φως " + lOnly + "|κανένα " + none + " (" + pc(none, lt) + "%)");
  console.log(P + "εγγραφές=" + records);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
