// Ελεγκτής T-CRETAWX-RAIN-01 (Cretaweather · custom_html_files/weatherStation/weather-dashboard.js):
// η βροχή βγαίνει από τον μετρητή rain_height_acc με τους κανόνες του πυρήνα (μηδενισμός, 450 mm/ω, σιωπή 180΄,
// μερική κάλυψη), σε ώρα Ελλάδας — ΟΧΙ από άθροισμα του rain_gauge. Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα της σελίδας
// (μπλοκ «ΥΠΟΛΟΓΙΣΜΟΣ ΒΡΟΧΗΣ»). Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "weatherStation", "weather-dashboard.js"), "utf8");
const A = "  // ═══ ΥΠΟΛΟΓΙΣΜΟΣ ΒΡΟΧΗΣ", B = "  // ═══ ΤΕΛΟΣ ΥΠΟΛΟΓΙΣΜΟΥ ΒΡΟΧΗΣ";

function load(code) {
  const a = code.indexOf(A), b = code.indexOf(B);
  if (a < 0 || b < 0) throw new Error("δεν βρέθηκε το μπλοκ ΥΠΟΛΟΓΙΣΜΟΣ ΒΡΟΧΗΣ");
  return new Function(code.slice(a, b) + "\nreturn { rainPeriodStart, rainDayStarts, rainWindow, rainBuckets, RAIN_LEAD_MIN, RAIN_LEAD_HOUR_MIN };")();
}

const T = (iso) => Date.parse(iso);
// σειρά 5΄ από `from` για `n` σημεία, με συνάρτηση τιμής
const series = (from, n, valueAt, stepMin = 5) => Array.from({ length: n }, (_, i) => ({ t: T(from) + i * stepMin * 60000, v: valueAt(i) }));
const near = (a, b) => Math.abs(a - b) < 1e-6;

function run(code) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let R; try { R = load(code); } catch (e) { return ["R0 φόρτωση: " + e.message]; }
  const { rainPeriodStart, rainDayStarts, rainWindow, rainBuckets, RAIN_LEAD_MIN } = R;

  // R1 ώρα Ελλάδας (EEST έως 25/10)
  const now = T("2026-10-05T12:00:00Z");
  ok(new Date(rainPeriodStart("day", now)).toISOString() === "2026-10-04T21:00:00.000Z", "R1α ημέρα 5/10 αρχίζει 4/10 21:00Z");
  ok(new Date(rainPeriodStart("week", now)).toISOString() === "2026-10-04T21:00:00.000Z", "R1β εβδομάδα (Δευτέρα 5/10) αρχίζει 4/10 21:00Z");
  ok(new Date(rainPeriodStart("week", T("2026-10-11T20:00:00Z"))).toISOString() === "2026-10-04T21:00:00.000Z", "R1γ Κυριακή 11/10 → ίδια εβδομάδα");
  ok(new Date(rainPeriodStart("month", now)).toISOString() === "2026-09-30T21:00:00.000Z", "R1δ μήνας Οκτωβρίου αρχίζει 30/9 21:00Z");
  ok(new Date(rainPeriodStart("day", T("2026-10-04T21:30:00Z"))).toISOString() === "2026-10-04T21:00:00.000Z", "R1ε 00:30 ώρα Ελλάδας ανήκει ήδη στη νέα ημέρα");
  // αλλαγή ώρας 25/10 03:00 EEST → 02:00 EET
  const d26 = rainDayStarts(T("2026-10-26T10:00:00Z"), 3).map((x) => new Date(x).toISOString());
  ok(JSON.stringify(d26) === JSON.stringify(["2026-10-23T21:00:00.000Z", "2026-10-24T21:00:00.000Z", "2026-10-25T22:00:00.000Z"]), "R1ζ αλλαγή ώρας: 26/10 αρχίζει 25/10 22:00Z (" + d26 + ")");
  ok(rainPeriodStart("hour", now) === now - 3600000, "R1η «ένταση» = κυλιόμενη τελευταία ώρα");

  // R2 βασικό άθροισμα: 1 κλικ (0,254) ανά 5΄ από 00:00 ώρα Ελλάδας, 12 βήματα = 3,048 mm
  const S = rainPeriodStart("day", now);
  const P1 = series("2026-10-04T20:55:00Z", 14, (i) => 100 + Math.max(0, i - 1) * 0.254);   // σημείο άγκυρα 5΄ πριν
  const w1 = rainWindow(P1, S, T("2026-10-04T22:00:00Z"), RAIN_LEAD_MIN, T("2026-10-04T22:00:00Z"));
  ok(w1.known && near(w1.mm, 3.048) && !w1.partial, "R2 άθροισμα βημάτων μετρητή = 3,048 (" + JSON.stringify(w1) + ")");

  // R3 μηδενισμός μετρητή: 50 → 50,254 → 0,254 → 0,508 = 0,254 + 0,254 + 0,254
  const P3 = [{ t: S - 60000, v: 50 }, { t: S + 300000, v: 50.254 }, { t: S + 600000, v: 0.254 }, { t: S + 900000, v: 0.508 }];
  const w3 = rainWindow(P3, S, S + 900000, RAIN_LEAD_MIN, S + 900000);
  ok(w3.known && near(w3.mm, 0.762), "R3 μηδενισμός: μετρά η νέα τιμή → 0,762 (" + JSON.stringify(w3) + ")");

  // R4 αδύνατο βήμα (100 mm σε 5΄ = 1.200 mm/ω) απορρίπτεται, τα υπόλοιπα μένουν
  const P4 = [{ t: S - 60000, v: 10 }, { t: S + 300000, v: 10.254 }, { t: S + 600000, v: 110.254 }, { t: S + 900000, v: 110.508 }];
  const w4 = rainWindow(P4, S, S + 900000, RAIN_LEAD_MIN, S + 900000);
  ok(w4.known && near(w4.mm, 0.508), "R4 βήμα > 450 mm/ω απορρίπτεται → 0,508 (" + JSON.stringify(w4) + ")");
  // 30 mm σε 5΄ (360 mm/ω) είναι δεκτό
  const P4b = [{ t: S - 60000, v: 10 }, { t: S + 240000, v: 40 }];
  ok(near(rainWindow(P4b, S, S + 240000, RAIN_LEAD_MIN, S + 240000).mm, 30), "R4β ραγδαία αλλά δυνατή βροχή (360 mm/ω) μετρά");

  // R5 σιωπηλός σταθμός: τελευταία τιμή πριν 4 ω → άγνωστο, όχι 0
  const P5 = series("2026-10-05T00:00:00Z", 10, () => 5);
  const w5 = rainWindow(P5, S, now, RAIN_LEAD_MIN, T("2026-10-05T04:45:00Z") + 4 * 3600000);
  ok(!w5.known && w5.why === "silent", "R5α σιωπή > 180΄ → «silent» (" + JSON.stringify(w5) + ")");
  const P5b = series("2026-10-05T09:00:00Z", 10, () => 5);   // τελευταία 09:45Z, τώρα 12:00Z → 135΄
  const w5b = rainWindow(P5b, S, now, RAIN_LEAD_MIN, now);
  ok(w5b.known && w5b.mm === 0, "R5β 135΄ χωρίς uplink και χωρίς βροχή → 0, όχι σιωπή");

  // R6 μερική κάλυψη: η πρώτη τιμή μετά από κενό 6 ω πριν την αρχή → «≥», και το βήμα του κενού ΔΕΝ μετρά
  const P6 = [{ t: S - 6 * 3600000, v: 0 }, { t: S + 3600000, v: 20 }, { t: S + 3900000, v: 20.254 }];
  const w6 = rainWindow(P6, S, S + 3900000, RAIN_LEAD_MIN, S + 3900000);
  ok(w6.known && w6.partial && near(w6.mm, 0.254), "R6 κενό πριν την αρχή → μερική, χωρίς τη βροχή του κενού (" + JSON.stringify(w6) + ")");
  // άγκυρα 2 ω πριν (≤ 180΄): πλήρης, και το βήμα από την άγκυρα μετρά
  const P6b = [{ t: S - 2 * 3600000, v: 0 }, { t: S + 300000, v: 1.016 }];
  const w6b = rainWindow(P6b, S, S + 300000, RAIN_LEAD_MIN, S + 300000);
  ok(w6b.known && !w6b.partial && near(w6b.mm, 1.016), "R6β άγκυρα εντός 180΄ → πλήρης");

  // R7 χωρίς μετρητή (σταθμός fw 1.13) → άγνωστο· ποτέ άθροισμα έντασης
  ok(rainWindow([], S, now, RAIN_LEAD_MIN, now).why === "nocounter", "R7 χωρίς μετρητή → «nocounter»");
  ok(!/rain_gauge|rain_height["']/.test(code.slice(code.indexOf(A), code.indexOf(B))), "R7β το μπλοκ δεν διαβάζει rain_gauge / rain_height");

  // R8 μπάρες: ωριαίες μπάρες αθροίζουν στο σύνολο του παραθύρου· ώρα χωρίς τιμές → null (όχι 0)
  const P8 = series("2026-10-04T20:55:00Z", 30, (i) => i * 0.254);         // 20:55Z–23:20Z, βροχή συνεχώς
  const starts = [S, S + 3600000, S + 7200000, S + 10800000];
  const bk = rainBuckets(P8, starts, S + 4 * 3600000);
  const tot = rainWindow(P8, S, S + 8400000, RAIN_LEAD_MIN, S + 8400000);
  ok(near(bk[0].value + bk[1].value + bk[2].value, tot.mm), "R8α Σ μπαρών = σύνολο παραθύρου (" + bk.map((b) => b.value) + " vs " + tot.mm + ")");
  ok(bk[3].value === null, "R8β ώρα χωρίς μετρήσεις → null (" + bk[3].value + ")");
  ok(near(bk[0].value, 12 * 0.254), "R8γ πρώτη ώρα = 12 κλικ");

  // R9 διπλή αποστολή στην ίδια χρονική στιγμή (μετά το φίλτρο της σελίδας) δεν διπλομετρά
  const addAcc = SRC.slice(SRC.indexOf("function addAccPoints"), SRC.indexOf("// Κάρτα βροχής"));
  ok(/p\.t !== arr\[i - 1\]\.t/.test(addAcc), "R9 addAccPoints αφαιρεί διπλότυπα ίδιου χρόνου");
  // R10 η σελίδα δεν αθροίζει πια το rain_gauge πουθενά
  ok(!/AGG_SUM_VARS = \[[^\]]*rain_gauge/.test(code) && !/derivedRainRecord/.test(code), "R10 κανένα άθροισμα rain_gauge στη σελίδα");
  return f;
}

const base = run(SRC);
const mutants = [
  ["μηδενισμός αγνοείται", (s) => s.replace("if (d < -0.001) d = P[i].v;", "")],
  ["όριο 450 → 4500", (s) => s.replace("const RAIN_MAX_MMH = 450;", "const RAIN_MAX_MMH = 4500;")],
  ["σιωπή 180 → 600", (s) => s.replace("const RAIN_FRESH_MIN = 180;", "const RAIN_FRESH_MIN = 600;")],
  ["περιθώριο 180 → 600", (s) => s.replace("const RAIN_LEAD_MIN = 180;", "const RAIN_LEAD_MIN = 600;")],
  ["μερική: μετρά και το κενό", (s) => s.replace("{ i0 += 1; partial = true; }", "{ i0 = Math.max(i0, 0); partial = true; }")],
  ["ζώνη ώρας UTC", (s) => s.replace('const RAIN_TZ = "Europe/Athens";', 'const RAIN_TZ = "UTC";')],
  ["εβδομάδα από Κυριακή", (s) => s.replace("((local.getUTCDay() + 6) % 7)", "local.getUTCDay()")],
  ["μπάρα χωρίς τιμές = 0", (s) => s.replace("value: has ? Math.round((cum[b] - cum[Math.max(a, 0)]) * 1000) / 1000 : null", "value: Math.round((cum[b] - cum[Math.max(a, 0)]) * 1000) / 1000")],
  ["επιστροφή στο rain_gauge", (s) => s.replace("const AGG_SUM_VARS = [];", 'const AGG_SUM_VARS = ["rain_gauge"];')],
];
let killed = 0;
for (const [name, mut] of mutants) {
  const m = mut(SRC);
  if (m === SRC) { console.log("✗ μετάλλαξη δεν εφαρμόστηκε: " + name); continue; }
  const r = run(m);
  if (r.length) killed++; else console.log("✗ ΕΠΙΖΕΙ μετάλλαξη: " + name);
}
base.forEach((x) => console.log("✗ " + x));
console.log(`cretaweather_rain_check: ${base.length ? "ΑΠΟΤΥΧΙΑ" : "OK"} · μεταλλάξεις ${killed}/${mutants.length} σκοτώθηκαν`);
process.exit(base.length || killed !== mutants.length ? 1 : 0);
