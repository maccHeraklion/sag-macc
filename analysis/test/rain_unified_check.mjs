// Ελεγκτής T-RAIN-UNIFIED-01 · ανάλυση αθροισμάτων βροχής v34 (ενιαίος υπολογισμός με τον πυρήνα).
// Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα της ανάλυσης σε εικονικό σταθμό (getData/sendData όπως το TagoIO) και ελέγχει:
// ταύτιση byte-byte με τον πυρήνα, «άγνωστο ≠ 0», εκτίμηση ρυθμού, ώρα Ελλάδας με γέφυρα, ιεραρχία, «Φέτος».
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const anPath = path.join(here, "..", "calculate_old_rainHeightSums.v34.js");
const corePath = path.join(here, "..", "runPerTich.js");
const AN = fs.readFileSync(anPath, "utf8").replace(/\r\n/g, "\n");
const CORE = fs.readFileSync(corePath, "utf8").replace(/\r\n/g, "\n");
const req = createRequire(corePath);
const moment = req("moment-timezone");

function coreBlock(src) {
  const a = src.indexOf("const _SAG_RAIN_MAX_MMH = 450;");
  const endMark = "  } catch (x) { return { ok: false, why: 'ανάγνωση απέτυχε', end: null }; }\n}\n";
  const b = src.indexOf(endMark, a);
  return a < 0 || b < 0 ? null : src.slice(a, b + endMark.length);
}
function load(src) {
  const mock = { Analysis: { use() {} }, Resources: {}, Account: class {}, Device: class {} };
  const shim = (m) => (m === "@tago-io/sdk" ? mock : req(m));
  const mod = { exports: {} };
  new Function("require", "module", "exports", "console", src)(shim, mod, mod.exports, { log: () => {} });
  return mod.exports;
}
// Εικονικός σταθμός: σειρές ανά μεταβλητή {t(ms), v, metadata, group}
function fakeDevice(series) {
  const S = {}; for (const [k, arr] of Object.entries(series)) S[k] = arr.map(x => ({ ...x }));
  const sent = [];
  return {
    sent, S,
    async getData(q) {
      const vars = q.variables || [q.variable];
      let rows = [];
      for (const v of vars) rows = rows.concat((S[v] || []).map(x => ({ variable: v, value: x.v, time: new Date(x.t).toISOString(), metadata: x.metadata, group: x.group })));
      const s = q.start_date ? Date.parse(q.start_date) : -Infinity, e = q.end_date ? Date.parse(q.end_date) : Infinity;
      rows = rows.filter(r => { const t = Date.parse(r.time); return t >= s && t <= e; });
      if (q.query === "sum") return [{ value: rows.reduce((a, r) => a + Number(r.value), 0) }];
      rows.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
      if ((q.ordination || "descending") === "descending") rows.reverse();
      return rows.slice(0, q.qty || 15);
    },
    async sendData(arr) {
      for (const x of [].concat(arr)) { sent.push(x); (S[x.variable] = S[x.variable] || []).push({ t: Date.parse(x.time), v: x.value, metadata: x.metadata, group: x.group }); }
    },
  };
}
const Z = (s) => Date.parse(s);
const cut = Z("2026-10-04T21:00:00.000Z"), TZ = "Europe/Athens";
// μετρητής κάθε 5΄ από t0 ως t1, με βροχή rainFn(t) (mm ανά βήμα) και προαιρετικό μηδενισμό
function counterSeries(t0, t1, rainFn, resetAt) {
  const out = []; let acc = 100;
  for (let t = t0; t <= t1; t += 300000) { if (resetAt && t === resetAt) acc = 0; acc = Math.round((acc + rainFn(t)) * 1000) / 1000; out.push({ t, v: acc }); }
  return out;
}
async function runAt(A, nowIso, dev) {
  const real = Date.now; Date.now = () => Z(nowIso); const n0 = dev.sent.length;
  try { await A.computeForDevice(dev, "δοκιμή", { TZ, cutMs: cut }); } finally { Date.now = real; }
  return dev.sent.slice(n0);   // μόνο ό,τι έγραψε ΑΥΤΗ η εκτέλεση
}
const by = (sent, v) => sent.filter(x => x.variable === v);

async function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  const blk = coreBlock(CORE);
  ok(blk && src.includes(blk), "U0 το τμήμα μετρητή είναι ΑΥΤΟΥΣΙΟ αντίγραφο του πυρήνα");
  let A; try { A = load(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  ok(A.RAIN_VERSION === "v34 · 2026-10-04", "U1 έκδοση v34");

  // U2 · περίοδοι: γέφυρα και ώρα Ελλάδας
  const P = (u, t) => A.periodContaining(u, Z(t), TZ, cut);
  const br = P("day", "2026-10-04T12:00:00Z");
  ok(br.s === Z("2026-10-04T00:00:00Z") && br.e === cut, "U2α ημέρα-γέφυρα 4/10 = 00:00Z–21:00Z (" + new Date(br.s).toISOString() + "–" + new Date(br.e).toISOString() + ")");
  const d5 = P("day", "2026-10-05T12:00:00Z");
  ok(d5.s === cut && d5.e === Z("2026-10-05T21:00:00Z") && d5.key === "2026-10-05", "U2β 5/10 = τοπική ημέρα 4/10 21:00Z–5/10 21:00Z");
  const d3 = A.previousPeriod(br, TZ, cut);
  ok(d3.s === Z("2026-10-03T00:00:00Z") && d3.e === Z("2026-10-04T00:00:00Z"), "U2γ πριν τη γέφυρα = ημέρα UTC της v33 (χωρίς βρόχο)");
  const oct = P("month", "2026-10-15T12:00:00Z");
  ok(oct.s === Z("2026-10-01T00:00:00Z") && oct.e === Z("2026-10-31T22:00:00Z"), "U2δ Οκτώβριος = 1/10 00Z – 31/10 22Z (αλλαγή ώρας 25/10)");
  const w41 = P("week", "2026-10-07T12:00:00Z"), w40 = P("week", "2026-10-02T12:00:00Z");
  ok(w41.s === cut && w40.s === Z("2026-09-28T00:00:00Z") && w40.e === cut, "U2ε εβδομάδα 41 από την αλλαγή, 40 = γέφυρα 28/9 00Z–4/10 21Z");
  const d26 = P("day", "2026-10-25T12:00:00Z");
  ok(d26.e - d26.s === 25 * 3600000, "U2στ 25/10 έχει 25 ώρες");

  // U3 · σταθμός με μετρητή, βροχή 0,254 mm/5΄ από 06:00 ως 08:00 τοπική 6/10 (24 βήματα = 6,096 mm)
  const t0 = Z("2026-10-04T18:00:00Z"), now3 = Z("2026-10-06T09:02:00Z");
  const rainy = (t) => (t > Z("2026-10-06T03:00:00Z") && t <= Z("2026-10-06T05:00:00Z")) ? 0.254 : 0;
  const dv = fakeDevice({ rain_height_acc: counterSeries(t0, now3, rainy) });
  const s3 = await runAt(A, "2026-10-06T09:02:00Z", dv);
  const ptdD = by(s3, "current_rain_height_daily")[0];
  ok(ptdD && Math.abs(ptdD.value - 6.096) < 1e-6 && ptdD.metadata.status === "measured" && !ptdD.metadata.partial, "U3α σήμερα 6,096 mm μετρημένα (" + JSON.stringify(ptdD && ptdD.value) + ")");
  const d5w = by(s3, "rain_height_daily").find(x => x.metadata.period_key === "2026-10-05");
  ok(d5w && d5w.value === 0 && d5w.metadata.coverage === 1 && d5w.time === new Date(Z("2026-10-05T09:00:00Z")).toISOString(), "U3β κλειστή 5/10 = 0 μετρημένο, στο μέσο της ημέρας");
  const bridge = by(s3, "rain_height_daily").find(x => x.metadata.period_key === "2026-10-04");
  ok(bridge && bridge.metadata.period_start_utc === "2026-10-04T00:00:00.000Z" && bridge.metadata.period_end_utc === "2026-10-04T21:00:00.000Z", "U3γ γράφτηκε η γέφυρα 4/10");
  const hours = by(s3, "rain_height_hourly");
  const h4 = hours.find(x => x.metadata.period_start_utc === "2026-10-06T04:00:00.000Z");
  ok(h4 && Math.abs(h4.value - 3.048) < 1e-6, "U3δ ώρα 04Z = 3,048 mm");
  ok(hours.every(x => x.metadata.alg === "v34" && x.metadata.status === "measured"), "U3ε ώρες με σήμανση v34/μέτρηση");
  const s3b = await runAt(A, "2026-10-06T09:40:00Z", dv);
  ok(by(s3b, "rain_height_daily").length === 0 && by(s3b, "rain_height_hourly").length === 0, "U3στ δεύτερη εκτέλεση δεν ξαναγράφει κλειστές περιόδους");

  // U4 · σιωπηλός σταθμός: τελευταία τιμή μετρητή πριν 2 ημέρες → ΚΑΜΙΑ εγγραφή «0»
  const dvS = fakeDevice({ rain_height_acc: counterSeries(Z("2026-10-03T00:00:00Z"), Z("2026-10-04T10:00:00Z"), () => 0) });
  const s4 = await runAt(A, "2026-10-06T09:02:00Z", dvS);
  ok(by(s4, "current_rain_height_daily").length === 0, "U4α σιωπηλός: δεν γράφεται «σήμερα 0»");
  ok(by(s4, "rain_height_hourly").length === 0 && by(s4, "rain_height_daily").filter(x => x.metadata.period_key !== "2026-10-04").length === 0, "U4β σιωπηλός: καμία κλειστή ώρα/ημέρα «0»");
  const brS = by(s4, "rain_height_daily").find(x => x.metadata.period_key === "2026-10-04");
  ok(!brS || (brS.metadata.partial && brS.metadata.coverage < 0.6), "U4γ η γέφυρα (σιωπή από 10Z) είναι μερική, όχι πλήρης");
  const s4b = await runAt(A, "2026-10-06T10:02:00Z", dvS);
  ok(by(s4b, "rain_height_daily").length === 0, "U4δ μερική περίοδος δεν ξαναγράφεται χωρίς βελτίωση κάλυψης");

  // U5 · μηδενισμός μετρητή μέσα στην ημέρα: άθροισμα θετικών βημάτων, όχι 0
  const rz = Z("2026-10-05T12:00:00Z");
  const dvR = fakeDevice({ rain_height_acc: counterSeries(t0, now3, (t) => (t > Z("2026-10-05T10:00:00Z") && t <= Z("2026-10-05T14:00:00Z")) ? 0.254 : 0, rz) });
  const s5 = await runAt(A, "2026-10-06T09:02:00Z", dvR);
  const d5r = by(s5, "rain_height_daily").find(x => x.metadata.period_key === "2026-10-05");
  ok(d5r && Math.abs(d5r.value - 0.254 * 48) < 0.001, "U5 μηδενισμός: 5/10 = " + (d5r && d5r.value) + " (48 βήματα = 12,192 mm)");

  // U6 · σταθμός χωρίς μετρητή (fw 1.13): εκτίμηση
  const rate = []; for (let t = t0; t <= now3; t += 600000) rate.push({ t, v: rainy(t) ? 0.5 : 0 });
  const dvT = fakeDevice({ rain_height: rate });
  const s6 = await runAt(A, "2026-10-06T09:02:00Z", dvT);
  const p6 = by(s6, "current_rain_height_daily")[0];
  ok(p6 && p6.metadata.status === "estimate" && Math.abs(p6.value - 6) < 1e-6, "U6 ρυθμός = εκτίμηση 6 mm (" + JSON.stringify(p6 && [p6.value, p6.metadata.status]) + ")");

  // U7 · Φέτος από μηνιαίες εγγραφές v33 (Μάρτιος–Σεπτέμβριος) + τρέχων μήνας → μερικό «από 2026-03»
  const mon = [];
  for (let m = 3; m <= 9; m++) {
    const s = moment.utc(`2026-${String(m).padStart(2, "0")}-01`), e = s.clone().endOf("month");
    mon.push({ t: e.valueOf() + 14000, v: 10, metadata: { period_start_utc: s.toISOString(), period_end_utc: e.toISOString(), source_variable: "rain_height_acc" } });
  }
  const dvY = fakeDevice({ rain_height_acc: counterSeries(Z("2026-02-01T00:00:00Z"), now3, rainy).filter((x, i) => i % 6 === 0 || x.t > Z("2026-10-04T00:00:00Z")), rain_height_monthly: mon });
  const s7 = await runAt(A, "2026-10-06T09:02:00Z", dvY);
  const y7 = by(s7, "current_rain_height_yearly")[0];
  ok(y7 && y7.metadata.partial && y7.metadata.since === "2026-03" && Math.abs(y7.value - (70 + 6.096)) < 0.3, "U7 φέτος ≥ 76,1 από 2026-03 (" + JSON.stringify(y7 && [y7.value, y7.metadata.since, y7.metadata.partial]) + ")");

  // U8 · ερμηνεία παλιών εγγραφών v33
  const ctx = { accFirstMs: Z("2026-05-01T00:00:00Z"), accLastMs: Z("2026-08-27T10:00:00Z") };
  const rec = (src, s, e, v) => ({ value: v, metadata: { period_start_utc: s, period_end_utc: e, source_variable: src } });
  const a8 = A.readRecord(rec("rain_height", "2026-09-01T00:00:00.000Z", "2026-09-30T23:59:59.999Z", 0), ctx);
  ok(a8 && a8.cov === 0, "U8α v33 εφεδρεία ρυθμού σε σταθμό με μετρητή = άγνωστο");
  const b8 = A.readRecord(rec("rain_height", "2026-03-01T00:00:00.000Z", "2026-03-31T23:59:59.999Z", 40), ctx);
  ok(b8 && b8.cov === 1 && b8.est, "U8β v33 ρυθμός πριν τον μετρητή = εκτίμηση");
  const c8 = A.readRecord(rec("rain_height_acc", "2026-09-01T00:00:00.000Z", "2026-09-30T23:59:59.999Z", 0), ctx);
  ok(c8 && c8.cov === 0, "U8γ v33 «0» από σιωπηλό μετρητή = άγνωστο");
  return f;
}

const base = await run(AN);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 απόκλιση από τον πυρήνα", "const _SAG_RAIN_ACC_FRESH_MIN = 180;", "const _SAG_RAIN_ACC_FRESH_MIN = 240;"],
  ["m2 χωρίς γέφυρα (UTC αρχή)", "  if (unit !== 'hour' && st0 < cutMs) {", "  if (false) {"],
  ["m3 βρόχος προηγούμενης περιόδου", "periodContaining(p.unit, p.st0 - 1, TZ, cutMs)", "periodContaining(p.unit, p.s - 1, TZ, cutMs)"],
  ["m4 η γέφυρα δεν γράφεται", "    if (p.e < cutMs) break;                                  // εποχή v33", "    if (p.e <= cutMs) break;                                  // εποχή v33"],
  ["m5 άγνωστο → 0 (σιωπή)", "    if (lastMs == null || lastMs <= sMs) return { known: false, why: 'σιωπηλός σταθμός' };", "    if (lastMs == null || lastMs <= sMs) return { known: true, mm: 0, coverage: 1, status: 'measured', partial: false, method };"],
  ["m6 ρυθμός ως μέτρηση", "return { known: true, mm: r3(sum), coverage, status: 'estimate'", "return { known: true, mm: r3(sum), coverage, status: 'measured'"],
  ["m7 v33 εφεδρεία ως μέτρηση", "    return { s, e, mm: 0, cov: 0, est: false, alg: 'v33' };\n  }\n  return", "    return { s, e, mm: v, cov: 1, est: false, alg: 'v33' };\n  }\n  return"],
  ["m8 χωρίς μερική κάλυψη", "  if (partialable.indexOf(full.why) < 0) return", "  if (true) return"],
  ["m9 ξαναγράφει μερικές περιόδους", "    if (!res.known || (have && res.coverage <= have.cov + 0.01)) continue;\n    out.push(payload('rain_height_daily', p, res));", "    if (!res.known) continue;\n    out.push(payload('rain_height_daily', p, res));"],
  ["m10 φέτος χωρίς μερικό", "partial: coverage < FULL_COV, status: est ? 'estimate' : 'measured', method: 'sum_of_months'", "partial: false, status: est ? 'estimate' : 'measured', method: 'sum_of_months'"],
  ["m11 χρόνος στο τέλος", "const mid = Math.floor((p.s + p.e) / 2);", "const mid = p.e;"],
  ["m12 σιωπηλός μετρητής v33 = μέτρηση", "    if (ctx.accLastMs != null && ctx.accLastMs < e - _SAG_RAIN_ACC_FRESH_MIN * 60000)", "    if (false)"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!AN.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = await run(AN.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 100)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
