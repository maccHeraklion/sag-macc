// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · ΟΛΟΣ Ο ΣΤΟΛΟΣ: τελευταίο δείγμα έναντι στατιστικών ώρας, με σωστή απαρίθμηση (τύπος από τη συσκευή) και πραγματική σημαία κάλυψης.
// Ανά συσκευή 120 ώρες (φύλλο 336), προσομοίωση κύκλου hh:21 UTC. Scope {hours, leafHours, part, parts}. Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών πέρα από type/covered.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "HF|";
let HOURS = 120, LEAFH = 336;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && Number(o.hours) > 0) HOURS = Number(o.hours); if (o && Number(o.leafHours) > 0) LEAFH = Number(o.leafHours); } catch (e) { /* προεπιλογή */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const f2 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "-" : String(Math.round(x * 100) / 100));
const pc = (a, b) => (b ? Math.round(100 * a / b) : 0);
const VARS = { s2120: ["air_temperature", "air_humidity"], em300_th: ["temperature", "humidity"], em320_th: ["temperature", "humidity"], lms01_ls: ["leaf_temperature", "leaf_moisture"], se0x: ["soil_moisture1"], lse02: ["soil_moisture1"], lse01: ["soil_moisture"], lse01_shallow: ["soil_moisture"], lse01_deep: ["soil_moisture"] };
const COVT = ["true", "ναι", "θερμοκήπιο", "θερμοκηπιο", "greenhouse", "1"];
const es = (T) => 0.6108 * Math.exp(17.27 * T / (T + 237.3));
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " hours=" + HOURS + " leaf=" + LEAFH);
  const now = Date.now();
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const dev = {}; const rows = [];
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name).slice(0, 24);
    let ids = []; try { ids = Object.values(JSON.parse(String(tag(f, "devices") || "{}"))).flat().map(String); } catch (e) { ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; }
    ids = ids.filter((x) => /^[0-9a-f]{24}$/i.test(x));
    let fresh = false; try { const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; fresh = !!(b && (now - Date.parse(b.time)) / 3600000 < 1.2); } catch (e) { /* χωρίς bundle */ }
    let cfg = {}; try { cfg = JSON.parse(String(tag(f, "configuration") || "{}")); } catch (e) { cfg = {}; }
    const ct = tag(f, "covered_cultivation"); const cov = COVT.includes(String(ct !== undefined ? ct : (cfg.covered_cultivation ?? "")).trim().toLowerCase());
    rows.push({ nm, fresh, cov, ids, src: ct !== undefined ? "ετικέτα" : "φόρμα" });
    for (const id of ids) if (!dev[id]) dev[id] = { t: "?" };
  }
  for (const [id, d] of Object.entries(dev)) { try { const x = await get(`/device/${id}`); d.t = String(tag(x, "type") || "χωρίς τύπο"); } catch (e) { d.t = "ΣΦΑΛΜΑ"; } }
  for (const r of rows.filter((x) => x.fresh && x.cov)) console.log(P + "ΚΑΛΥΨΗ|" + r.nm + "|πηγή " + r.src + "|όργανα " + r.ids.map((i) => dev[i].t).filter((t) => t !== "uc511").join(","));
  console.log(P + "ΚΑΛΥΠΤΟΜΕΝΟΙ|" + rows.filter((x) => x.fresh && x.cov).length + " από " + rows.filter((x) => x.fresh).length);
  const R = {}; let records = 0;
  const per = {};
  for (const [id, d] of Object.entries(dev)) {
    if (!VARS[d.t]) continue; const H = d.t === "lms01_ls" ? LEAFH : HOURS; const start = now - (H + 2) * 3600000; const series = {};
    for (const v of VARS[d.t]) {
      let r0; try { r0 = await get(`/device/${id}/data?variables=${v}&start_date=${new Date(start).toISOString()}&end_date=${new Date(now).toISOString()}&qty=3000`); } catch (e) { continue; }
      records += r0.length;
      const pts = r0.map((r) => ({ t: Date.parse(r.time), v: Number(r.value) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
      if (pts.length < 12) continue; series[v] = pts;
      const k = d.t.replace(/_(shallow|deep)$/, "") + "|" + v; const b = R[k] || (R[k] = { dev: 0, cyc: 0, zero: 0, n: [], age: [], d: [], flip: 0, wl: 0, wa: 0, wm: 0, w30: 0, nl: 0, na: 0 }); b.dev++;
      let lastRun = false;
      for (let t = Math.ceil(start / 3600000) * 3600000 + 21 * 60000 + 2 * 3600000; t < now; t += 3600000) {
        const w = pts.filter((p) => p.t > t - 3600000 && p.t <= t); b.cyc++;
        if (!w.length) { b.zero++; continue; }
        const last = w[w.length - 1].v; const mean = w.reduce((s, p) => s + p.v, 0) / w.length; const mx = Math.max(...w.map((p) => p.v));
        b.n.push(w.length); b.age.push((t - w[w.length - 1].t) / 60000); b.d.push(Math.abs(last - mean));
        if (/humidity$/.test(v) && (last >= 90) !== (mean >= 90)) b.flip++;
        if (v === "leaf_moisture") { const wet = w.filter((p) => p.v >= 15).length; if (last >= 15) b.wl++; if (mx >= 15) b.wa++; if (mean >= 15) b.wm++; if (wet / w.length >= 0.5) b.w30++; }
      }
    }
    const Tn = series.air_temperature || series.temperature, Hn = series.air_humidity || series.humidity;
    if (Tn && Hn) { const k = "VPD|" + d.t; const b = per[k] || (per[k] = { dl: [], dm: [] }); for (let t = Math.ceil(start / 3600000) * 3600000 + 21 * 60000 + 2 * 3600000; t < now; t += 3600000) { const a = Tn.filter((p) => p.t > t - 3600000 && p.t <= t), h = Hn.filter((p) => p.t > t - 3600000 && p.t <= t); if (!a.length || a.length !== h.length) continue; const vs = a.map((p, i) => es(p.v) * (1 - h[i].v / 100)); const perSample = vs.reduce((s, x) => s + x, 0) / vs.length; const mT = a.reduce((s, p) => s + p.v, 0) / a.length, mH = h.reduce((s, p) => s + p.v, 0) / h.length; const fromMeans = es(mT) * (1 - mH / 100); const last = vs[vs.length - 1]; b.dl.push(Math.abs(last - perSample)); b.dm.push(Math.abs(fromMeans - perSample)); } }
  }
  for (const [k, b] of Object.entries(R)) console.log(P + k + "|συσκευές=" + b.dev + "|κύκλοι=" + b.cyc + "|χωρίς δείγμα " + pc(b.zero, b.cyc) + "%|n διάμ=" + q(b.n, 0.5) + " n=1:" + pc(b.n.filter((x) => x === 1).length, b.n.length) + "% n=2:" + pc(b.n.filter((x) => x === 2).length, b.n.length) + "% n≥3:" + pc(b.n.filter((x) => x >= 3).length, b.n.length) + "%|ηλικία διάμ=" + f2(q(b.age, 0.5)) + "΄ p95=" + f2(q(b.age, 0.95)) + "΄|διαφ διάμ=" + f2(q(b.d, 0.5)) + " p95=" + f2(q(b.d, 0.95)) + " max=" + f2(b.d.length ? Math.max(...b.d) : null) + (/humidity$/.test(k) ? "|RH≥90 αλλάζει " + b.flip + " (" + pc(b.flip, b.d.length) + "%)" : "") + (k.endsWith("leaf_moisture") ? "|υγρές ώρες: τελευταίο " + b.wl + " · οποιοδήποτε " + b.wa + " · μέσος " + b.wm + " · ≥μισά δείγματα " + b.w30 : ""));
  for (const [k, b] of Object.entries(per)) console.log(P + k + "|ώρες=" + b.dl.length + "|kPa τελευταίο−ανά δείγμα διάμ=" + f2(q(b.dl, 0.5)) + " p95=" + f2(q(b.dl, 0.95)) + "|από μέσους−ανά δείγμα διάμ=" + f2(q(b.dm, 0.5)) + " p95=" + f2(q(b.dm, 0.95)));
  console.log(P + "εγγραφές=" + records);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
