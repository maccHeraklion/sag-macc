// Ελεγκτής T-KBDI-FIX-01 (28/11/2026) — analysis/kbdi.js (kbdi-v2).
// Κ1 ο μετρικός τύπος = ο αρχικός των Keetch & Byram (1968) σε ίντσες/°F (ανεξάρτητη υλοποίηση εδώ).
// (απόκλιση μετρικού/αρχικού < 0,1 % από τη στρογγυλοποίηση 1,5552 και 0,001736)
// Κ2 συγκράτηση 5,1 mm ανά βροχερό διάστημα· Κ3 DF ≥ 0 στο κρύο, Q ≤ 203,2· Κ4 R = ΕΤΗΣΙΑ βροχή (όχι της ημέρας).
// Κ5–Κ9 πλήρες τρέξιμο με ψεύτικη συσκευή: επανυπολογισμός από 1/5, Tmax/VPD από ωριαία, βροχή v34 > v33, αναμονή
// ημέρας χωρίς βροχή, δεύτερο τρέξιμο χωρίς νέες εγγραφές, συνέχεια από την κατάσταση, ημέρα-γέφυρα 4/10 και ημέρες Ελλάδας.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "kbdi.js");
const SRC = fs.readFileSync(file, "utf8");
const req = createRequire(file);
const moment = req("moment-timezone");

function load(src) {
  const sdk = { Analysis: { use() {} }, Resources: {}, Utils: {}, Account: function () {}, Device: function () {} };
  const mod = { exports: {} };
  new Function("require", "module", "exports", src)((m) => (m === "@tago-io/sdk" ? sdk : req(m)), mod, mod.exports);
  return mod.exports;
}
// ανεξάρτητη υλοποίηση: Keetch & Byram 1968, Q σε εκατοστά της ίντσας, T σε °F, R σε ίντσες
function dfImperial(Qmm, Tc, Rmm) {
  const Q = Qmm / 0.254, T = Tc * 1.8 + 32, R = Rmm / 25.4;
  const d = ((800 - Q) * (0.968 * Math.exp(0.0486 * T) - 8.30)) / (1 + 10.88 * Math.exp(-0.0441 * R)) * 1e-3;
  return Math.max(0, d) * 0.254;
}
const H = 3600000, D = 86400000;
function fakeDevice(opt) {
  const store = [];
  const tempAt = (h) => opt.temp(h), rhAt = (h) => opt.rh(h);
  const calls = [];
  return {
    store, calls,
    async getData(q) {
      calls.push(q);
      const v = q.variables[0];
      if (q.query === "aggregate") {
        const s = Date.parse(q.start_date), e = Date.parse(q.end_date);
        const out = [];
        for (let h = Math.ceil(s / H) * H; h <= e; h += H) {
          if (opt.off && opt.off(h)) continue;
          const x = v === "air_temperature" ? tempAt(h) : rhAt(h);
          if (x != null) out.push({ time: new Date(h).toISOString(), value: x });
        }
        if (q.function !== (v === "air_temperature" ? "max" : "min")) throw new Error("λάθος συνάρτηση " + q.function + " για " + v);
        return out;
      }
      if (v === "kbdi1") return store.filter((x) => x.variable === "kbdi1").sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, q.qty);
      if (v === "rain_height_daily") {
        const s = Date.parse(q.start_date), e = Date.parse(q.end_date);
        return opt.rain.filter((x) => Date.parse(x.time) >= s && Date.parse(x.time) <= e);
      }
      throw new Error("απρόσμενο " + JSON.stringify(q));
    },
    async sendData(arr) { for (const x of arr) store.push(x); },
  };
}

async function check(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K;
  try { K = load(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  // Κ1 — ισοδυναμία με τον αρχικό τύπο
  for (const [q, t, r] of [[0, 30, 700], [50, 25, 500], [120, 35, 900], [190, 15, 700]]) {
    const a = K.droughtFactor(q, t, r), b = dfImperial(q, t, r);
    ok(Math.abs(a - b) <= 0.001 * b + 1e-6, `Κ1 DF(Q=${q},T=${t},R=${r}) = ${a.toFixed(4)} ≠ αρχικός ${b.toFixed(4)}`);
  }
  ok(Math.abs(K.droughtFactor(0, 30, 700) - 2.643) < 0.01, "Κ1β DF(0,30,700) ≈ 2,64 mm/ημέρα (" + K.droughtFactor(0, 30, 700).toFixed(3) + ")");
  // Κ2 — συγκράτηση
  let s = { q: 100, cum: 0 };
  const seq = [[3, 0], [4, 1.9], [10, 10], [0, 0], [6, 0.9]];
  for (const [rain, net] of seq) { const r = K.kbdiStep(s, rain, 5, 700); ok(Math.abs(r.net - net) < 1e-9, `Κ2 βροχή ${rain} → καθαρή ${r.net} (αναμενόμενο ${net})`); s = { q: r.q, cum: r.cum }; }
  ok(Math.abs(s.q - (100 - 12.8)) < 1e-9, "Κ2β Q μετά τις βροχές = 87,2 (" + s.q + ")");
  // Κ3 — όρια
  ok(K.kbdiStep({ q: 50, cum: 0 }, 0, -5, 700).q === 50, "Κ3 κρύο: DF = 0, όχι αρνητικό");
  ok(K.kbdiStep({ q: 203.15, cum: 0 }, 0, 80, 700).q === 203.2, "Κ3β Q ≤ 203,2 (ακραία θερμοκρασία ως έλεγχος ορίου)");
  ok(K.kbdiStep({ q: 3, cum: 10 }, 20, 10, 700).q >= 0, "Κ3γ Q ≥ 0");
  // Κ4 — R = ετήσια βροχή
  ok(K.droughtFactor(0, 30, 900) > K.droughtFactor(0, 30, 300) && Math.abs(K.droughtFactor(0, 30, 700) - K.droughtFactor(0, 30, 2)) > 1, "Κ4 R = ετήσια βροχή: περισσότερη βροχή → πυκνότερη βλάστηση → ταχύτερη ξήρανση");

  // Κ5… — πλήρες τρέξιμο: 1/5 → 10/10 (περνά την αλλαγή 4–5/10)
  const tempOf = (h) => { const hour = new Date(h).getUTCHours(); return 18 + 10 * Math.sin(((hour - 6) / 24) * 2 * Math.PI); };   // μέγιστο 28 στις 12 UTC
  const rhOf = (h) => { const hour = new Date(h).getUTCHours(); return 60 - 25 * Math.sin(((hour - 6) / 24) * 2 * Math.PI); };   // ελάχιστο 35
  const rainRecs = [];
  const dayKeyUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
  for (let d = Date.parse("2026-05-01T00:00:00Z"); d < Date.parse("2026-10-04T00:00:00Z"); d += D) {
    const mm = dayKeyUTC(d) === "2026-05-10" ? 20 : dayKeyUTC(d) === "2026-06-02" ? 3 : 0;
    rainRecs.push({ variable: "rain_height_daily", value: mm, time: new Date(d + D + 16000).toISOString(), metadata: { period_start_utc: new Date(d).toISOString(), period_end_utc: new Date(d + D - 1).toISOString(), source_variable: "rain_height" } });
  }
  // 10/5: v34 συμπλήρωση με άλλη τιμή → πρέπει να κερδίσει
  rainRecs.push({ variable: "rain_height_daily", value: 30, time: "2026-05-10T12:00:00.000Z", metadata: { alg: "v34", coverage: 1, period_start_utc: "2026-05-10T00:00:00.000Z", period_end_utc: "2026-05-11T00:00:00.000Z" } });
  // γέφυρα 4/10 00:00Z–21:00Z, μετά ημέρες Ελλάδας 5/10 … 8/10 (9/10 λείπει: αναμονή)
  rainRecs.push({ variable: "rain_height_daily", value: 0, time: "2026-10-04T10:30:00.000Z", metadata: { alg: "v34", coverage: 1, period_start_utc: "2026-10-04T00:00:00.000Z", period_end_utc: "2026-10-04T21:00:00.000Z" } });
  for (let k = 0; k < 4; k++) {
    const s0 = Date.parse("2026-10-04T21:00:00Z") + k * D;
    rainRecs.push({ variable: "rain_height_daily", value: k === 1 ? 8 : 0, time: new Date(s0 + D / 2).toISOString(), metadata: { alg: "v34", coverage: 1, period_start_utc: new Date(s0).toISOString(), period_end_utc: new Date(s0 + D).toISOString() } });
  }
  const NOW = Date.parse("2026-10-09T23:00:00Z");   // 10/10 02:00 Ελλάδας: η 9/10 έκλεισε αλλά δεν έχει βροχή ακόμη
  const dev = fakeDevice({ temp: tempOf, rh: rhOf, rain: rainRecs });
  const info = { name: "Δοκιμή", tags: [{ key: "kbdi_annual_rain_mm", value: "700" }] };
  try { await K.processStation(dev, info, NOW, () => {}); } catch (e) { return f.concat(["τρέξιμο: " + e.message]); }
  const kb = dev.store.filter((x) => x.variable === "kbdi1");
  const byKey = Object.fromEntries(kb.map((x) => [x.metadata.period_key, x]));
  ok(kb.length > 0 && kb[0].metadata.period_key === "2026-05-01" && kb[0].metadata.q_prev === 0, "Κ5 ξεκινά 1/5 με Q = 0 (" + (kb[0] && kb[0].metadata.period_key) + ")");
  ok(byKey["2026-05-01"] && Math.abs(byKey["2026-05-01"].metadata.tmax - 28) < 1e-6, "Κ6 Tmax = μέγιστο ωριαίων (" + (byKey["2026-05-01"] && byKey["2026-05-01"].metadata.tmax) + ")");
  const v1 = dev.store.find((x) => x.variable === "vpd1" && x.metadata.period_key === "2026-05-01");
  ok(v1 && Math.abs(v1.value - 0.6108 * Math.exp((17.27 * 28) / (28 + 237.3)) * 0.65) < 0.002, "Κ6β VPD ημέρας = es(28)·(1−0,35) (" + (v1 && v1.value) + ")");
  ok(byKey["2026-05-10"] && byKey["2026-05-10"].metadata.rain_mm === 30 && Math.abs(byKey["2026-05-10"].metadata.net_rain_mm - 24.9) < 1e-6, "Κ7 βροχή v34 (30) κερδίζει τη v33 (20), καθαρή 24,9 (" + (byKey["2026-05-10"] && byKey["2026-05-10"].metadata.net_rain_mm) + ")");
  ok(byKey["2026-06-02"] && byKey["2026-06-02"].metadata.net_rain_mm === 0, "Κ7β βροχή 3 mm < 5,1: καθαρή 0");
  ok(byKey["2026-10-04"] && byKey["2026-10-04"].metadata.period_end_utc === "2026-10-04T21:00:00.000Z", "Κ8 ημέρα-γέφυρα 4/10 (" + (byKey["2026-10-04"] && byKey["2026-10-04"].metadata.period_end_utc) + ")");
  ok(byKey["2026-10-06"] && byKey["2026-10-06"].metadata.rain_mm === 8 && byKey["2026-10-06"].metadata.period_start_utc === "2026-10-05T21:00:00.000Z", "Κ8β ημέρα Ελλάδας 6/10 με βροχή 8");
  ok(!byKey["2026-10-09"] && byKey["2026-10-08"], "Κ9 η 9/10 χωρίς βροχή ακόμη αναμένει (τελευταία " + kb[kb.length - 1].metadata.period_key + ")");
  ok(kb.every((x, i) => i === 0 || Math.abs(x.metadata.q_prev - kb[i - 1].value) < 1e-9), "Κ9β κάθε ημέρα ξεκινά από την προηγούμενη");
  ok(kb[0].time === "2026-05-01T23:59:50.000Z", "Κ9γ χρόνος εγγραφής 23:59:50 της ημέρας (" + kb[0].time + ")");
  // δεύτερο τρέξιμο στην ίδια στιγμή: τίποτα νέο
  const n1 = dev.store.length;
  await K.processStation(dev, info, NOW, () => {});
  ok(dev.store.length === n1, "Κ10 δεύτερο τρέξιμο χωρίς νέες εγγραφές (" + (dev.store.length - n1) + ")");
  // η βροχή της 9/10 γράφεται → συνέχεια από την κατάσταση
  rainRecs.push({ variable: "rain_height_daily", value: 0, time: "2026-10-09T09:00:00.000Z", metadata: { alg: "v34", coverage: 1, period_start_utc: "2026-10-08T21:00:00.000Z", period_end_utc: "2026-10-09T21:00:00.000Z" } });
  await K.processStation(dev, info, NOW + H, () => {});
  const kb2 = dev.store.filter((x) => x.variable === "kbdi1");
  const lastNew = kb2[kb2.length - 1];
  ok(kb2.length === kb.length + 1 && lastNew.metadata.period_key === "2026-10-09" && Math.abs(lastNew.metadata.q_prev - byKey["2026-10-08"].value) < 1e-9, "Κ11 συνέχεια από την αποθηκευμένη κατάσταση");
  // σταθμός σβηστός μία μέρα: Tmax άγνωστη → DF 0, χωρίς vpd1
  const dev2 = fakeDevice({ temp: tempOf, rh: rhOf, rain: rainRecs, off: (h) => new Date(h).toISOString().startsWith("2026-05-03") });
  await K.processStation(dev2, info, Date.parse("2026-05-05T00:00:00Z"), () => {});
  const k3 = dev2.store.find((x) => x.variable === "kbdi1" && x.metadata.period_key === "2026-05-03");
  ok(k3 && k3.metadata.tmax === null && k3.metadata.drought_factor === 0 && !dev2.store.some((x) => x.variable === "vpd1" && x.metadata.period_key === "2026-05-03"), "Κ12 ημέρα χωρίς θερμοκρασία: DF 0, χωρίς VPD");
  ok(dev.calls.filter((c) => c.query === "aggregate").every((c) => Date.parse(c.end_date) - Date.parse(c.start_date) <= 31 * D), "Κ13 ερωτήματα aggregate ≤ 1 μήνας");
  return f;
}

const base = await check(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ " + base.length + ":\n  " + base.join("\n  ")); process.exit(1); }
console.log("kbdi_check: όλα ΟΚ");
const MUT = [
  ["η βροχή δεν αφαιρείται", "    q = Math.max(0, q - net);", ""],
  ["χωρίς συγκράτηση", "    net = before >= RAIN_INTERCEPT_MM ? rain : Math.max(0, cum - RAIN_INTERCEPT_MM);", "    net = rain;"],
  ["αρνητικό DF", "  return Math.max(0, (num / den) * 1e-3);", "  return (num / den) * 1e-3;"],
  ["χωρίς ανώτατο όριο", "  q = Math.min(Q_MAX, q + df);", "  q = q + df;"],
  ["δεν μηδενίζεται το διάστημα", "  } else if (rain != null) {\n    cum = 0;", "  } else if (rain != null) {\n    cum = cum;"],
  ["Tmax όπως η v1", "      if (Number.isFinite(t)) { hours++; if (t > tmax) tmax = t; }", "      if (Number.isFinite(t)) { hours++; if (tmax === -Infinity || t < tmax) tmax = t; }"],
  ["v33 πάνω από v34", '    const rank = (m.alg === "v34" ? 2 : 1) + cov;', '    const rank = (m.alg === "v34" ? 0 : 1) + cov;'],
  ["χωρίς αναμονή βροχής", "    if (!r && nowMs - d.e < RAIN_WAIT_DAYS * 86400000) break;", ""],
  ["πάντα από την αρχή", "  const last = (recent || []).find(", "  const last = null && (recent || []).find("],
  ["ημέρα UTC μετά την αλλαγή", "  if (s < CUTOVER_MS) {", "  if (true) {"],
  ["λάθος συντελεστής εκθέτη", "0.0875 * tmax + 1.5552", "0.0875 * tmax + 1.6552"],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = await check(SRC.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 70) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
process.exit(dead === MUT.length ? 0 : 1);
