// Ελεγκτής T-RAIN-ACC-01 (v50.158 · Α3 του ελέγχου μετεωρολογικών): η βροχή του πυρήνα από τον βαθμονομημένο
// μετρητή `rain_height_acc`, με λογικούς ελέγχους. Φορτώνει ΟΛΟΚΛΗΡΟ τον πραγματικό πυρήνα και τρέχει τους βοηθούς
// πάνω σε ψεύτικη συσκευή που απαντά όπως το TagoIO (end_date + qty:1 → νεότερο σημείο ≤ end_date· σειρά asc).
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
try { req.resolve("moment-timezone"); } catch (e) { console.log("ΑΔΥΝΑΤΟ: λείπει moment-timezone — `cd analysis && npm i moment-timezone axios --no-save`"); process.exit(1); }
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { _sagRainFromCounter, _sagAccPointAtOrBefore, SAG_KERNEL_VERSION };";
  const mod = { exports: {} };
  const proc = { env: { RPERTICH_TEST_MODE: "true" }, exit: () => {}, on: () => {} };
  const quiet = { log: () => {}, warn: () => {}, error: () => {} };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail)(shimReq, mod, mod.exports, proc, quiet, path.dirname(corePath), corePath);
}
// ψεύτικη συσκευή: σειρά [{t(ms), v}] για rain_height_acc
function dev(points) {
  const P = points.map(([t, v]) => ({ t, v })).sort((a, b) => a.t - b.t);
  const calls = [];
  return { calls, async getData(q) {
    calls.push(q);
    if (!q.variables || q.variables[0] !== "rain_height_acc") return [];
    const end = q.end_date ? Date.parse(q.end_date) : Infinity, st = q.start_date ? Date.parse(q.start_date) : -Infinity;
    let R = P.filter(p => p.t <= end && p.t >= st);
    R = q.ordination === "ascending" ? R : R.slice().reverse();
    return R.slice(0, q.qty || 15).map(p => ({ variable: "rain_height_acc", value: p.v, time: new Date(p.t).toISOString(), unit: "mm" }));
  } };
}
const NOW = Date.UTC(2026, 9, 3, 22, 20, 0), H = 3600e3, M = 60e3;
const iso = (ms) => new Date(ms).toISOString();
// σειρά ανά 5΄ από t0 ως t1 με συνάρτηση τιμής
const series = (t0, t1, f) => { const a = []; for (let t = t0; t <= t1; t += 5 * M) a.push([t, f(t)]); return a; };

async function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση πυρήνα: " + e.message]; }
  ok(K.SAG_KERNEL_VERSION === "v50.158 · 2026-10-04", "V έκδοση v50.158 (" + K.SAG_KERNEL_VERSION + ")");
  const R = (d, st, en, lead) => K._sagRainFromCounter(d, iso(st), iso(en), undefined, lead);
  // Ρ1 κανονική βροχή: 100 → 112,7 στο 24ωρο (σταθερά 0,529 mm/h), 1ω = ~0,53
  const lin = series(NOW - 30 * H, NOW - 2 * M, t => 100 + Math.max(0, Math.floor(((t - (NOW - 24 * H)) / (24 * H)) * 50)) * 0.254);
  const d1 = dev(lin);
  const a1 = await R(d1, NOW - 24 * H, NOW, 180);
  const exp24 = lin.filter(p => p[0] <= NOW).slice(-1)[0][1] - lin.filter(p => p[0] <= NOW - 24 * H).slice(-1)[0][1];
  ok(a1.ok && Math.abs(a1.mm - exp24) < 1e-6, "Ρ1 24ωρο = διαφορά μετρητή (" + JSON.stringify(a1) + " αναμ. " + exp24 + ")");
  const a1h = await R(d1, NOW - H, NOW, 30);
  ok(a1h.ok && a1h.mm >= 0 && a1h.mm <= 0.6, "Ρ2 ωριαίο από μετρητή (" + JSON.stringify(a1h) + ")");
  // Ρ3 καμία βροχή: σταθερός μετρητής → 0 (ΜΕΤΡΗΣΗ, όχι «άγνωστο»)
  const a3 = await R(dev(series(NOW - 30 * H, NOW - 2 * M, () => 640.334)), NOW - 24 * H, NOW, 180);
  ok(a3.ok && a3.mm === 0, "Ρ3 σταθερός μετρητής → 0 mm έγκυρο (" + JSON.stringify(a3) + ")");
  // Ρ4 σιωπηλός σταθμός: τελευταία τιμή πριν 4 ω
  const a4 = await R(dev(series(NOW - 30 * H, NOW - 4 * H, t => 50)), NOW - 24 * H, NOW, 180);
  ok(!a4.ok && /σιωπηλός/.test(a4.why), "Ρ4 σιωπηλός σταθμός → άκυρο (" + JSON.stringify(a4) + ")");
  // Ρ5 καμία τιμή πριν το παράθυρο (νέος σταθμός)
  const a5 = await R(dev(series(NOW - 2 * H, NOW - 2 * M, t => 3)), NOW - 24 * H, NOW, 180);
  ok(!a5.ok && /πριν το παράθυρο/.test(a5.why), "Ρ5 χωρίς αρχική τιμή → άκυρο (" + JSON.stringify(a5) + ")");
  // Ρ6 κενό πριν το παράθυρο: τελευταία τιμή πριν την αρχή 5 ω νωρίτερα (24ωρο, ανοχή 3 ω)
  const gap = [...series(NOW - 40 * H, NOW - 29 * H, () => 10), ...series(NOW - 20 * H, NOW - 2 * M, () => 30)];
  const a6 = await R(dev(gap), NOW - 24 * H, NOW, 180);
  ok(!a6.ok && /κενό/.test(a6.why), "Ρ6 κενό 5 ω πριν το 24ωρο → άκυρο (" + JSON.stringify(a6) + ")");
  // Ρ7 ωριαίο με κενό 40΄ πριν την ώρα (ανοχή 30΄) → άκυρο· με 20΄ → έγκυρο
  const g7 = [...series(NOW - 3 * H, NOW - H - 40 * M, () => 5), [NOW - 30 * M, 6], [NOW - 2 * M, 7]];
  const a7 = await R(dev(g7), NOW - H, NOW, 30);
  ok(!a7.ok, "Ρ7 ωριαίο με κενό 40΄ → άκυρο (" + JSON.stringify(a7) + ")");
  const g7b = [...series(NOW - 3 * H, NOW - H - 20 * M, () => 5), [NOW - 30 * M, 6], [NOW - 2 * M, 7]];
  const a7b = await R(dev(g7b), NOW - H, NOW, 30);
  ok(a7b.ok && Math.abs(a7b.mm - 2) < 1e-9, "Ρ8 ωριαίο με κενό 20΄ → 2 mm (" + JSON.stringify(a7b) + ")");
  // Ρ9 μηδενισμός μέσα στο παράθυρο: 100 → 105 (+5), μηδέν, 0 → 3 (+3) ⇒ 8 mm
  const rs = [...series(NOW - 30 * H, NOW - 12 * H, t => t <= NOW - 24 * H ? 100 : Math.min(105, 100 + Math.floor((t - (NOW - 24 * H)) / (H)) * 1)),
              ...series(NOW - 12 * H + 5 * M, NOW - 2 * M, t => Math.min(3, Math.floor((t - (NOW - 12 * H)) / H) * 0.5))];
  const a9 = await R(dev(rs), NOW - 24 * H, NOW, 180);
  ok(a9.ok && Math.abs(a9.mm - 8) < 1e-6 && a9.resets === 1, "Ρ9 μηδενισμός → 5 + 3 = 8 mm (" + JSON.stringify(a9) + ")");
  // Ρ10 αδύνατο βήμα (+500 mm σε 5΄) σε σειρά με μηδενισμό → απορρίπτεται, μετρά μόνο το υπόλοιπο
  const gl = [[NOW - 25 * H, 100], [NOW - 20 * H, 101], [NOW - 20 * H + 5 * M, 601], [NOW - 10 * H, 0.5], [NOW - 2 * M, 1.5]];
  const a10 = await R(dev(gl), NOW - 24 * H, NOW, 300);
  ok(a10.ok && a10.dropped === 1 && Math.abs(a10.mm - 2.5) < 1e-6, "Ρ10 αδύνατο βήμα απορρίπτεται: 1 + 0,5 + 1 = 2,5 mm (" + JSON.stringify(a10) + ")");
  // Ρ11 αδύνατη συνολική διαφορά χωρίς μηδενισμό (+5000 mm/24ω) → άκυρο
  const a11 = await R(dev([[NOW - 25 * H, 1], [NOW - 2 * M, 30001]]), NOW - 24 * H, NOW, 300);
  ok(!a11.ok && /αδύνατη/.test(a11.why), "Ρ11 αδύνατη διαφορά → άκυρο (" + JSON.stringify(a11) + ")");
  // Ρ12 ακραία αλλά ΠΡΑΓΜΑΤΙΚΗ βροχή (Ανώγεια 1/10: 266 mm/24ω) → δεκτή, χωρίς την παλιά οροφή 200
  const a12 = await R(dev([[NOW - 25 * H, 469.646], [NOW - 2 * M, 735.846]]), NOW - 24 * H, NOW, 300);
  ok(a12.ok && Math.abs(a12.mm - 266.2) < 1e-6, "Ρ12 266,2 mm/24ω δεκτά (" + JSON.stringify(a12) + ")");
  // Ρ13 χωρίς μετρητή (fw 1.13) → άκυρο «χωρίς μετρητή» → η παλιά διαδρομή
  const a13 = await R(dev([]), NOW - 24 * H, NOW, 180);
  ok(!a13.ok && /χωρίς μετρητή/.test(a13.why), "Ρ13 χωρίς μετρητή → παλιά διαδρομή (" + JSON.stringify(a13) + ")");
  // Ρ14 ερώτηση σημείου: end_date + qty 1 + φθίνουσα
  const d14 = dev(lin); await K._sagAccPointAtOrBefore(d14, iso(NOW));
  const q = d14.calls[0] || {};
  ok(q.qty === 1 && q.end_date === iso(NOW) && q.ordination === "descending" && !q.query, "Ρ14 σχήμα ερώτησης σημείου (" + JSON.stringify(q) + ")");

  // ── καλωδίωση στα ΠΡΑΓΜΑΤΙΚΑ σημεία κλήσης ──
  ok(src.includes("const _accDay = _accEnd ? await _sagRainFromCounter(device, start, now, _accEnd, 180) : { ok: false, why: 'χωρίς μετρητή' };"), "Κ1 24ωρο από μετρητή με ανοχή 3 ω");
  ok(src.includes("        if (_accDay.ok) {\n          totalRain = [{ variable: rainKey, value: parseFloat(_accDay.mm.toFixed(2)), unit: \"mm\" }];"), "Κ2 24ωρο γράφεται από τον μετρητή");
  ok(src.includes("        } else\n        try {\n          totalRain = await device.getData({\n            variables: [\"rain_height\"],"), "Κ3 παλιά διαδρομή ΜΟΝΟ όταν ο μετρητής άκυρος");
  ok(src.includes("const _rainEmpty = !_accDay.ok && (") && src.includes("        if (_accDay.ok) { /* T-RAIN-ACC-01: η ποσότητα ήρθε από τον μετρητή */ }\n        else if (_rainEmpty) {"), "Κ4 η εφεδρεία ρυθμού δεν πατά τον μετρητή");
  ok(src.includes("const _accH = await _sagRainFromCounter(device, moment(now).subtract(1, 'hours').toISOString(), now, _accEnd, 30);\n          if (_accH.ok) deviceData.rain_height_hourly = _accH.mm;"), "Κ5 ωριαίο από μετρητή με ανοχή 30΄");
  ok(src.includes("if (deviceData.rain_height_hourly === undefined && !_accDay.ok) try {") && src.includes("if (deviceData.rain_height_hourly === undefined && !_accDay.ok) {\n          try {\n            const _g1"), "Κ6 ωριαίο: παλιές διαδρομές μόνο χωρίς μετρητή");
  return f;
}

const base = await run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 χωρίς έλεγχο σιωπής", "    if ((endMs - e.t) / 60000 > _SAG_RAIN_ACC_FRESH_MIN) return", "    if (false) return"],
  ["m2 χωρίς έλεγχο κενού", "    if ((startMs - st.t) / 60000 > maxLeadMin) return", "    if (false) return"],
  ["m3 μηδενισμός αγνοείται", "        if (d < -0.001) { resets++; d = P[i].v; }", "        if (d < -0.001) { resets++; d = 0; }"],
  ["m4 χωρίς απόρριψη αδύνατου βήματος", "        if (d > _SAG_RAIN_MAX_MMH * dh + 0.254) { dropped++; continue; }", "        if (false) { dropped++; continue; }"],
  ["m5 χωρίς έλεγχο συνόλου", "    if (!(mm >= 0) || mm > _SAG_RAIN_MAX_MMH * spanH + 0.254) return", "    if (!(mm >= 0)) return"],
  ["m6 παλιά οροφή 200", "    return { ok: true, mm: Math.round(mm * 1000) / 1000, resets, dropped, end: e };", "    return { ok: true, mm: Math.min(200, Math.round(mm * 1000) / 1000), resets, dropped, end: e };"],
  ["m7 σημείο με αύξουσα σειρά", "end_date: iso, qty: 1, ordination: 'descending' }", "end_date: iso, qty: 1, ordination: 'ascending' }"],
  ["m8 24ωρο από ρυθμό ξανά", "        if (_accDay.ok) {\n          totalRain = [{ variable: rainKey, value: parseFloat(_accDay.mm.toFixed(2)), unit: \"mm\" }];", "        if (false) {\n          totalRain = [{ variable: rainKey, value: parseFloat(_accDay.mm.toFixed(2)), unit: \"mm\" }];"],
  ["m9 εφεδρεία πατά τον μετρητή", "const _rainEmpty = !_accDay.ok && (", "const _rainEmpty = true || ("],
  ["m10 ωριαίο όχι από μετρητή", "          if (_accH.ok) deviceData.rain_height_hourly = _accH.mm;", "          if (false) deviceData.rain_height_hourly = _accH.mm;"],
  ["m11 ωριαίο ανοχή 3 ω", "now, _accEnd, 30);", "now, _accEnd, 180);"],
  ["m12 παλιά έκδοση", "'v50.158 · 2026-10-04'", "'v50.157 · 2026-10-04'"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!SRC.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = await run(SRC.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 110)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
