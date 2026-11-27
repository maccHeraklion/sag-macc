// T-RAIN-BACKFILL-01 · 27/11/2026 · Τοπικός υπολογισμός των ωριαίων/ημερήσιων εγγραφών βροχής που λείπουν από τη Σκοτίνα Πάνω (04c5).
// Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα της v34.4 (analysis/calculate_old_rainHeightSums.js) και καλεί τις ΙΔΙΕΣ συναρτήσεις
// (periodContaining, rainRateWindow, payload) με μια ψεύτικη συσκευή που σερβίρει τα ωμά δεδομένα του probe
// read_rain_backfill_04c5_2026-11-27.js σε μορφή ανά ώρα (άθροισμα, πρώτο/τελευταίο δείγμα σε δευτερόλεπτα, πλήθος).
// Χρήση: node build_rain_backfill_04c5_2026-11-27.mjs <αρχείο Β42 γραμμών> <έξοδος.json>
// Γράφει ΜΟΝΟ τοπικό αρχείο. Η αποστολή στο TagoIO γίνεται χωριστά.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRCP = path.join(here, "..", "..", "calculate_old_rainHeightSums.js");
const req = createRequire(SRCP);
const [, , inFile, outFile] = process.argv;
const HOUR_TO = Date.parse("2026-08-17T10:00:00Z");   // πρώτη ωριαία εγγραφή v33 (period_start)
const DAY_TO = Date.parse("2026-08-03T00:00:00Z");    // πρώτη ημερήσια εγγραφή v33 (period_start)
const FROM = Date.parse("2026-05-01T00:00:00Z");

// ---- ωμά (ανά ώρα) ----
const H = new Map();   // ms αρχής ώρας → { s, a, b, n }
for (const line of fs.readFileSync(inFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^Β42\|(\d{4}-\d{2}-\d{2})\|(.*)$/); if (!m) continue;
  const d0 = Date.parse(m[1] + "T00:00:00Z");
  for (const tok of m[2].trim().split(/\s+/).filter(Boolean)) {
    const [h, s, a, b, n] = tok.split(":").map(Number);
    const k = d0 + h * 3600000;
    if (H.has(k)) throw new Error("διπλή ώρα " + new Date(k).toISOString());
    H.set(k, { s, a, b, n });
  }
}
const keys = [...H.keys()].sort((x, y) => x - y);
const samplesFirst = (k) => k + H.get(k).a * 1000, samplesLast = (k) => k + H.get(k).b * 1000;

// ---- ψεύτικη συσκευή: απαντά στα 3 ερωτήματα της rainRateWindow ----
const device = {
  async getData(q) {
    if (!q.variables || q.variables[0] !== "rain_height") throw new Error("απρόσμενο ερώτημα " + JSON.stringify(q));
    const S = q.start_date ? Date.parse(q.start_date) : -Infinity, E = q.end_date ? Date.parse(q.end_date) : Infinity;
    if (q.query === "sum") {
      let s = 0;
      for (const k of keys) { if (k >= S && k + 3600000 <= E) s += H.get(k).s; else if (k < E && k + 3600000 > S) throw new Error("μη ευθυγραμμισμένο άθροισμα"); }
      return [{ value: s }];
    }
    if (q.qty === 1 && q.ordination === "descending") {     // τελευταίο ≤ E
      for (let i = keys.length - 1; i >= 0; i--) { const t = samplesLast(keys[i]); if (t <= E) return [{ value: 0, time: new Date(t).toISOString() }]; }
      return [];
    }
    if (q.qty === 1 && q.ordination === "ascending") {      // πρώτο στο [S, E]
      for (const k of keys) { const t = samplesFirst(k); if (t >= S && t <= E) return [{ value: 0, time: new Date(t).toISOString() }]; if (t > E) break; }
      return [];
    }
    throw new Error("απρόσμενο ερώτημα " + JSON.stringify(q));
  },
};

// ---- φόρτωση v34.4 ----
const src = fs.readFileSync(SRCP, "utf8");
const sdk = { Analysis: { use() {} }, Resources: function () {}, Account: function () {}, Device: function () {} };
const mod = { exports: {} };
const K = new Function("require", "module", "exports", "console", src + "\nreturn { payload, periodContaining, rainRateWindow, RAIN_VERSION, RAIN_ALG, DEFAULT_TZ, DEFAULT_CUTOVER };")(
  (m) => (m === "@tago-io/sdk" ? sdk : req(m)), mod, mod.exports, { log() {}, warn() {}, error() {} });
if (K.RAIN_VERSION !== "v34.4 · 2026-11-27") throw new Error("άλλη έκδοση " + K.RAIN_VERSION);
const cutMs = Date.parse(K.DEFAULT_CUTOVER), TZ = K.DEFAULT_TZ;
const EXTRA = { backfill: "T-RAIN-BACKFILL-01" };

const out = [], stat = { h: 0, hRain: 0, hMm: 0, d: 0, dMm: 0, dPartial: 0, hUnknown: 0 };
// ώρες
for (let t = FROM; t < HOUR_TO; t += 3600000) {
  const p = K.periodContaining("hour", t, TZ, cutMs);
  if (p.s !== t) throw new Error("ώρα εκτός ευθυγράμμισης");
  const res = await K.rainRateWindow(device, new Date(p.s).toISOString(), new Date(p.e).toISOString());
  if (!res.known) { stat.hUnknown++; continue; }
  res.method = "rate_sum";
  out.push(K.payload("rain_height_hourly", p, res, EXTRA)); stat.h++; if (res.mm > 0) { stat.hRain++; stat.hMm += res.mm; }
}
// ημέρες (πριν την αλλαγή: ημέρα UTC)
for (let t = FROM; t < DAY_TO; t += 86400000) {
  const p = K.periodContaining("day", t + 3600000, TZ, cutMs);
  if (p.s !== t || p.e !== t + 86400000) throw new Error("ημέρα όχι UTC " + p.key);
  const res = await K.rainRateWindow(device, new Date(p.s).toISOString(), new Date(p.e).toISOString());
  if (!res.known) continue;
  res.method = "rate_sum";
  out.push(K.payload("rain_height_daily", p, res, EXTRA)); stat.d++; stat.dMm += res.mm; if (res.partial) stat.dPartial++;
}
// έλεγχος: Σ ωρών ανά ημέρα = ημέρα
const byDay = new Map();
for (const r of out) if (r.variable === "rain_height_hourly") { const k = r.metadata.period_start_utc.slice(0, 10); byDay.set(k, (byDay.get(k) || 0) + r.value); }
let mism = 0;
for (const r of out) if (r.variable === "rain_height_daily") { const k = r.metadata.period_start_utc.slice(0, 10); if (Math.abs((byDay.get(k) || 0) - r.value) > 0.01) { mism++; console.log("διαφορά", k, byDay.get(k), r.value); } }
// μηνιαία σύνολα για σύγκριση με τις υπάρχουσες μηνιαίες v33
const byMonth = {};
for (const r of out) if (r.variable === "rain_height_daily") { const k = r.metadata.period_start_utc.slice(0, 7); byMonth[k] = Math.round(((byMonth[k] || 0) + r.value) * 1000) / 1000; }
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(JSON.stringify({ ...stat, hMm: Math.round(stat.hMm * 10) / 10, dMm: Math.round(stat.dMm * 10) / 10, mism, byMonth, records: out.length, bytes: JSON.stringify(out).length }));
console.log("δείγμα ώρας:", JSON.stringify(out.find((r) => r.variable === "rain_height_hourly" && r.value > 0)));
console.log("δείγμα ημέρας:", JSON.stringify(out.find((r) => r.variable === "rain_height_daily" && r.value > 0)));
