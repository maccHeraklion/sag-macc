// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Μέσος ώρας έναντι τελευταίας τιμής (T-HOURMEAN, μέτρηση πριν από κάθε αλλαγή).
// Μέρος Α: ανάλυση της σκιώδους καταγραφής sag_shadow_hourly (εδαφικές σόνδες δύο βαθών, 31/10–7/11).
// Μέρος Β: για δείγμα συσκευών κάθε τύπου, 72 ώρες, προσομοιώνει τον κύκλο hh:21 και συγκρίνει ό,τι παίρνει σήμερα ο πυρήνας
// (τελευταίο δείγμα) με τον μέσο των δειγμάτων της τελευταίας ώρας. Μετρά και το κόστος σε εγγραφές Data Output.
// Scope: {part:"A"} ή {part:"B", hours:72, per:6}. Δεν γράφει τίποτα. Δεν τυπώνει τιμές ετικετών.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "HM|";
const FLEET = "6a98855ca06e41000bfae024";
let part = "A", HOURS = 72, PER = 6;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && o.part) part = String(o.part); if (o && Number(o.hours) > 0) HOURS = Number(o.hours); if (o && Number(o.per) > 0) PER = Number(o.per); } catch (e) { /* προεπιλογή */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const f2 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "-" : (Math.round(x * 100) / 100).toString());

async function partA() {
  const end = new Date().toISOString(); const start = "2026-10-31T07:00:00Z";
  let rows = [], skip = 0;
  for (let i = 0; i < 12; i++) { const r = await get(`/device/${FLEET}/data?variables=sag_shadow_hourly&start_date=${start}&end_date=${end}&qty=500&skip=${skip}`); rows = rows.concat(r); skip += r.length; if (r.length < 500) break; }
  console.log(P + "A|εγγραφές=" + rows.length);
  const by = {}; let bad = 0, sample = null;
  for (const e of rows) {
    let arr; try { arr = JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.z), "base64")).toString("utf8")); } catch (x) { bad++; continue; }
    if (!Array.isArray(arr)) { arr = arr.r || arr.rows || []; }
    if (!sample) sample = JSON.stringify(arr[0] || null).slice(0, 160);
    for (const o of arr) {
      const k = String(o.f) + "|" + String(o.d).slice(-6); const b = by[k] || (by[k] = { f: String(o.f).slice(0, 22), d: String(o.d).slice(-6), h: 0, n: [], a: [], dm: [], de: [], de_rel: [], spread: [] });
      b.h++; b.a.push(Number(o.a));
      for (const c of ["m1", "m2"]) if (Array.isArray(o[c])) { b.n.push(o[c][2]); b.dm.push(Math.abs(o[c][0] - o[c][1])); b.spread.push(o[c][4] - o[c][3]); }
      for (const c of ["e1", "e2"]) if (Array.isArray(o[c])) { b.de.push(Math.abs(o[c][0] - o[c][1])); if (o[c][1] > 0) b.de_rel.push(100 * Math.abs(o[c][0] - o[c][1]) / o[c][1]); }
    }
  }
  console.log(P + "A|δείγμα=" + sample + "|αποτυχίες αποσυμπίεσης=" + bad + "|σόνδες=" + Object.keys(by).length);
  const all = { n: [], a: [], dm: [], de: [], rel: [] };
  const list = Object.values(by).sort((x, y) => (q(y.dm, 0.95) || 0) - (q(x.dm, 0.95) || 0));
  for (const b of list) { all.n.push(...b.n); all.a.push(...b.a); all.dm.push(...b.dm); all.de.push(...b.de); all.rel.push(...b.de_rel); }
  const share = (arr, fn) => (arr.length ? Math.round(100 * arr.filter(fn).length / arr.length) : 0);
  console.log(P + "A|ΣΥΝΟΛΟ|ώρες×κανάλια=" + all.dm.length + "|n διάμεσος=" + q(all.n, 0.5) + "|n=1 " + share(all.n, (x) => x === 1) + "%|n=2 " + share(all.n, (x) => x === 2) + "%|n≥3 " + share(all.n, (x) => x >= 3) + "%|ηλικία τελευταίου λεπτά διάμ=" + q(all.a, 0.5) + " p95=" + q(all.a, 0.95));
  console.log(P + "A|ΥΓΡΑΣΙΑ θ (μον. %)|διάμ|τελ−μέσος|=" + f2(q(all.dm, 0.5)) + "|p95=" + f2(q(all.dm, 0.95)) + "|max=" + f2(Math.max(...all.dm)) + "|>0,5: " + share(all.dm, (x) => x > 0.5) + "%|>1: " + share(all.dm, (x) => x > 1) + "%|>3: " + share(all.dm, (x) => x > 3) + "%");
  console.log(P + "A|EC ρίζας|διάμ σχετ=" + f2(q(all.rel, 0.5)) + "%|p95=" + f2(q(all.rel, 0.95)) + "%|>5%: " + share(all.rel, (x) => x > 5) + "%|>10%: " + share(all.rel, (x) => x > 10) + "%");
  for (const b of list.slice(0, 12)) console.log(P + "A|ΣΟΝΔΑ|" + b.f + "|" + b.d + "|ώρες=" + b.h + "|n=" + q(b.n, 0.5) + "|θ διάμ=" + f2(q(b.dm, 0.5)) + " p95=" + f2(q(b.dm, 0.95)) + " max=" + f2(Math.max(...(b.dm.length ? b.dm : [0]))) + "|EC% p95=" + f2(q(b.de_rel, 0.95)));
}

const VARS = {
  s2120: ["air_temperature", "air_humidity", "wind_speed_kmh", "light_intensity"],
  em300_th: ["temperature", "humidity"], em320_th: ["temperature", "humidity"],
  lms01_ls: ["leaf_temperature", "leaf_moisture"],
  se0x: ["soil_moisture1", "conduct_soil1", "soil_temperature1"], lse02: ["soil_moisture1", "conduct_soil1", "soil_temperature1"],
  lse01: ["soil_moisture", "conduct_soil", "temp_soil"],
};
async function partB() {
  const now = Date.now(); const start = now - (HOURS + 2) * 3600000;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const fleet = {}; const pick = {};
  const ordered = [...fields].sort((a, b) => (/Γριν/i.test(String(tag(b, "name") || b.name)) ? 1 : 0) - (/Γριν/i.test(String(tag(a, "name") || a.name)) ? 1 : 0));
  for (const f of ordered) {
    let m; try { m = JSON.parse(String(tag(f, "devices") || "{}")); } catch (e) { continue; }
    if (!tag(f, "configuration")) continue;
    for (const [ty0, ids] of Object.entries(m)) {
      const ty = String(ty0).replace(/_\d+$/, "").replace(/_(shallow|deep)$/, "");
      for (const id of (Array.isArray(ids) ? ids : [ids])) {
        if (!VARS[ty] || !/^[0-9a-f]{24}$/i.test(String(id))) continue;
        (fleet[ty] = fleet[ty] || new Set()).add(String(id));
        pick[ty] = pick[ty] || []; if (pick[ty].length < PER && !pick[ty].includes(String(id))) pick[ty].push(String(id));
      }
    }
  }
  console.log(P + "B|στόλος ανά τύπο|" + Object.entries(fleet).map(([k, v]) => k + "=" + v.size).join(" "));
  const res = {}; let records = 0;
  for (const [ty, ids] of Object.entries(pick)) {
    for (const id of ids) {
      for (const v of VARS[ty]) {
        let rows; try { rows = await get(`/device/${id}/data?variables=${v}&start_date=${new Date(start).toISOString()}&end_date=${new Date(now).toISOString()}&qty=2000`); } catch (e) { continue; }
        records += rows.length;
        const pts = rows.map((r) => ({ t: Date.parse(r.time), v: Number(r.value) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
        if (pts.length < 6) continue;
        const k = ty + "|" + v; const b = res[k] || (res[k] = { ty, v, cyc: 0, n: [], age: [], d: [], rel: [], rng: [], flip: 0, wetLast: 0, wetAny: 0, wetMean: 0, zero: 0, perHour: [] });
        for (let t = Math.ceil(start / 3600000) * 3600000 + 21 * 60000 + 2 * 3600000; t < now; t += 3600000) {
          const w = pts.filter((p) => p.t > t - 3600000 && p.t <= t);
          b.cyc++;
          if (!w.length) { b.zero++; continue; }
          const last = w[w.length - 1].v; const mean = w.reduce((s, p) => s + p.v, 0) / w.length;
          const mn = Math.min(...w.map((p) => p.v)), mx = Math.max(...w.map((p) => p.v));
          b.n.push(w.length); b.age.push((t - w[w.length - 1].t) / 60000); b.d.push(Math.abs(last - mean)); b.rng.push(mx - mn);
          if (Math.abs(mean) > 1e-6) b.rel.push(100 * Math.abs(last - mean) / Math.abs(mean));
          if (/humidity$/.test(v) && (last >= 90) !== (mean >= 90)) b.flip++;
          if (v === "leaf_moisture") { if (last >= 15) b.wetLast++; if (mx >= 15) b.wetAny++; if (mean >= 15) b.wetMean++; }
        }
      }
    }
  }
  const share = (arr, fn) => (arr.length ? Math.round(100 * arr.filter(fn).length / arr.length) : 0);
  for (const b of Object.values(res)) {
    console.log(P + "B|" + b.ty + "|" + b.v + "|κύκλοι=" + b.cyc + "|χωρίς δείγμα στην ώρα=" + share(Array(b.cyc).fill(0).map((_, i) => (i < b.zero ? 1 : 0)), (x) => x === 1) + "%|n διάμ=" + q(b.n, 0.5) + " (n=1 " + share(b.n, (x) => x === 1) + "%, n≥3 " + share(b.n, (x) => x >= 3) + "%)|ηλικία διάμ=" + f2(q(b.age, 0.5)) + "΄|διαφ τελ−μέσος διάμ=" + f2(q(b.d, 0.5)) + " p95=" + f2(q(b.d, 0.95)) + " max=" + f2(b.d.length ? Math.max(...b.d) : null) + "|σχετ p95=" + f2(q(b.rel, 0.95)) + "%|εύρος ώρας p95=" + f2(q(b.rng, 0.95)) + (/humidity$/.test(b.v) ? "|αλλαγή κρίσης RH≥90: " + b.flip + " ώρες (" + share(Array(b.d.length).fill(0).map((_, i) => (i < b.flip ? 1 : 0)), (x) => x === 1) + "%)" : "") + (b.v === "leaf_moisture" ? "|υγρές ώρες: τελευταίο " + b.wetLast + " · μέγιστο " + b.wetAny + " · μέσος " + b.wetMean : ""));
  }
  console.log(P + "B|εγγραφές που διαβάστηκαν=" + records);
  let perHour = 0; const costs = [];
  for (const [ty, set] of Object.entries(fleet)) { const vs = (Object.values(res).filter((b) => b.ty === ty)); const nAvg = vs.length ? (q(vs.flatMap((b) => b.n), 0.5) || 0) : 0; const full = (ty === "s2120" ? 8 : (ty === "se0x" || ty === "lse02") ? 6 : VARS[ty].length); const c = set.size * nAvg * full; perHour += c; costs.push(ty + ": " + set.size + "×" + nAvg + "×" + full + "=" + c); }
  console.log(P + "B|κόστος αν διαβάζονται όλα τα δείγματα της ώρας|" + costs.join(" · ") + "|σύνολο/ώρα≈" + perHour + "|ανά μήνα≈" + Math.round(perHour * 24 * 30 / 1000) + " χιλ.");
}
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " part=" + part);
  if (part === "A") await partA(); else await partB();
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
