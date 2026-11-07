// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Μέσος ώρας έναντι τελευταίας τιμής, ΟΛΟΣ Ο ΣΤΟΛΟΣ (διορθώνει το μικρό δείγμα του audit_hourmean: το φίλτρο configuration έκοβε αγρούς).
// Για κάθε τύπο: έως PER συσκευές ΠΟΥ ΣΤΕΛΝΟΥΝ (φύλλο: όλες), προσομοίωση κύκλου hh:21. Σύγκριση τελευταίου δείγματος με μέσο ώρας. Scope {hours, per}.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "HB|";
let HOURS = 120, PER = 10;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && Number(o.hours) > 0) HOURS = Number(o.hours); if (o && Number(o.per) > 0) PER = Number(o.per); } catch (e) { /* προεπιλογή */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const f2 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "-" : String(Math.round(x * 100) / 100));
const pc = (a, b) => (b ? Math.round(100 * a / b) : 0);
const VARS = { s2120: ["air_temperature", "air_humidity"], em300_th: ["temperature", "humidity"], em320_th: ["temperature", "humidity"], lms01_ls: ["leaf_temperature", "leaf_moisture"], se0x: ["soil_moisture1", "conduct_soil1"], lse02: ["soil_moisture1", "conduct_soil1"], lse01: ["soil_moisture", "conduct_soil"] };
const FULLV = { s2120: 12, em300_th: 3, em320_th: 3, lms01_ls: 2, se0x: 6, lse02: 6, lse01: 3 };
const TIER = (ty) => (ty === "s2120" || ty === "em300_th" || ty === "em320_th" || ty === "lms01_ls" ? 2 : (ty === "se0x" || ty === "lse02" ? 6 : 3));
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " hours=" + HOURS + " per=" + PER);
  const now = Date.now(); const start = now - (HOURS + 2) * 3600000;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const fleet = {}; const pairs = {}; const firstGrin = [];
  for (const f of fields) {
    let m; try { m = JSON.parse(String(tag(f, "devices") || "{}")); } catch (e) { continue; }
    const grin = /Γριν/i.test(String(tag(f, "name") || f.name));
    for (const [k0, ids] of Object.entries(m)) {
      const ty = String(k0).replace(/_\d+$/, "").replace(/_(shallow|deep)$/, "");
      if (!VARS[ty]) continue;
      for (const id of (Array.isArray(ids) ? ids : [ids])) { if (!/^[0-9a-f]{24}$/i.test(String(id))) continue; (fleet[ty] = fleet[ty] || new Set()).add(String(id)); pairs[ty] = (pairs[ty] || 0) + 1; if (grin) firstGrin.push(String(id)); }
    }
  }
  console.log(P + "στόλος|" + Object.entries(fleet).map(([k, v]) => k + "=" + v.size + " (ζεύγη αγρού " + pairs[k] + ")").join(" · "));
  let records = 0; const nByType = {};
  for (const [ty, set] of Object.entries(fleet)) {
    const ids = [...set].sort((a, b) => (firstGrin.includes(b) ? 1 : 0) - (firstGrin.includes(a) ? 1 : 0));
    const limit = ty === "lms01_ls" ? 99 : PER; let used = 0, silent = 0;
    const R = {}; for (const v of VARS[ty]) R[v] = { cyc: 0, zero: 0, n: [], age: [], d: [], rng: [], flip: 0, wl: 0, wa: 0, wm: 0, nights: 0 };
    for (const id of ids) {
      if (used >= limit) break;
      let any = false;
      for (const v of VARS[ty]) {
        let rows; try { rows = await get(`/device/${id}/data?variables=${v}&start_date=${new Date(start).toISOString()}&end_date=${new Date(now).toISOString()}&qty=2500`); } catch (e) { continue; }
        records += rows.length;
        const pts = rows.map((r) => ({ t: Date.parse(r.time), v: Number(r.value) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
        if (pts.length < HOURS / 2) continue;
        any = true; const b = R[v];
        for (let t = Math.ceil(start / 3600000) * 3600000 + 21 * 60000 + 2 * 3600000; t < now; t += 3600000) {
          const w = pts.filter((p) => p.t > t - 3600000 && p.t <= t); b.cyc++;
          if (!w.length) { b.zero++; continue; }
          const last = w[w.length - 1].v; const mean = w.reduce((s, p) => s + p.v, 0) / w.length; const mx = Math.max(...w.map((p) => p.v)), mn = Math.min(...w.map((p) => p.v));
          b.n.push(w.length); b.age.push((t - w[w.length - 1].t) / 60000); b.d.push(Math.abs(last - mean)); b.rng.push(mx - mn);
          if (/humidity$/.test(v) && (last >= 90) !== (mean >= 90)) b.flip++;
          if (v === "leaf_moisture") { if (last >= 15) b.wl++; if (mx >= 15) b.wa++; if (mean >= 15) b.wm++; }
        }
      }
      if (any) used++; else silent++;
    }
    for (const v of VARS[ty]) { const b = R[v]; if (!b.cyc) { console.log(P + ty + "|" + v + "|χωρίς δεδομένα"); continue; }
      nByType[ty] = q(b.n, 0.5);
      console.log(P + ty + "|" + v + "|συσκευές=" + used + " (σιωπηλές " + silent + ")|κύκλοι=" + b.cyc + "|χωρίς δείγμα " + pc(b.zero, b.cyc) + "%|n διάμ=" + q(b.n, 0.5) + " n=1:" + pc(b.n.filter((x) => x === 1).length, b.n.length) + "% n=2:" + pc(b.n.filter((x) => x === 2).length, b.n.length) + "% n≥3:" + pc(b.n.filter((x) => x >= 3).length, b.n.length) + "%|ηλικία διάμ=" + f2(q(b.age, 0.5)) + "΄ p95=" + f2(q(b.age, 0.95)) + "΄|διαφ διάμ=" + f2(q(b.d, 0.5)) + " p95=" + f2(q(b.d, 0.95)) + " max=" + f2(Math.max(...b.d)) + "|εύρος ώρας p95=" + f2(q(b.rng, 0.95)) + (/humidity$/.test(v) ? "|RH≥90 αλλάζει " + b.flip + " ώρες (" + pc(b.flip, b.d.length) + "%)" : "") + (v === "leaf_moisture" ? "|υγρές: τελευταίο " + b.wl + " · μέγιστο " + b.wa + " · μέσος " + b.wm : ""));
    }
  }
  console.log(P + "εγγραφές που διαβάστηκαν=" + records);
  let all = 0, core = 0; const parts = [];
  for (const [ty, set] of Object.entries(fleet)) { const n = nByType[ty] || 3; const a = pairs[ty] * n * FULLV[ty], c = set.size * n * TIER(ty); all += a; core += c; parts.push(ty + " " + set.size + "×n" + n + ": όλα " + a + " / βασικά " + c); }
  console.log(P + "κόστος/ώρα|" + parts.join(" · ") + "|ΟΛΕΣ οι μεταβλητές≈" + all + "/ώρα (" + Math.round(all * 720 / 1000) + " χιλ./μήνα)|ΒΑΣΙΚΕΣ, ανά συσκευή μία φορά≈" + core + "/ώρα (" + Math.round(core * 720 / 1000) + " χιλ./μήνα)");
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
