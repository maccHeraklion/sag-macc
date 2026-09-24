// Ελεγκτής v50.151 · T-BPI-DAYS-01 + T-ANOM-SINCE-01.
// Τρέχει τους ΠΡΑΓΜΑΤΙΚΟΥΣ βοηθούς του πυρήνα (εξαγωγή με ταίριασμα αγκυλών) και
// ελέγχει την καλωδίωση. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
if (raw.includes("\n") && !raw.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = raw.replace(/\r\n/g, "\n");

function extractFn(text, name) {
  const m = text.indexOf("function " + name + "(");
  if (m < 0) throw new Error("δεν βρέθηκε " + name);
  const open = text.indexOf("{", m); let d = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === "{") d++; else if (text[k] === "}") { d--; if (d === 0) return new Function("return (" + text.slice(m, k + 1) + ")")(); }
  }
  throw new Error("άνοιγμα χωρίς κλείσιμο: " + name);
}

function run(text) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  // ── καλωδίωση ──
  ok(text.includes("const SAG_KERNEL_VERSION = 'v50.153 · 2026-09-24';"), "έκδοση v50.153");
  ok(text.includes("const prev_days = Number(measurements?.data?.bpi_total_days?.[0]?.value ?? 0);"), "prev_days από το προηγούμενο bundle");
  ok(text.includes("const new_total_days = _hadTotals ? (((Number.isFinite(prev_days) && prev_days >= 0) ? Math.floor(prev_days) : 0) + 1) : 1;"), "new_total_days = prev + 1, ή 1 σε νέα αρχή");
  ok(text.includes("const new_total_since = _hadTotals ? _prevSince : _todayISO;"), "T-BPI-SINCE-01: αρχή = σήμερα μόνο σε νέα αρχή, αλλιώς η προηγούμενη");
  ok(text.includes("const new_total_floor = _hadTotals && !_prevSince\n    && Number(measurements?.data?.bpi_total_days_floor?.[0]?.value ?? 0) === 1;"), "T-BPI-SINCE-01: η σημαία «τουλάχιστον» ζει μόνο όσο η αρχή είναι άγνωστη");
  ok(text.includes('...(new_total_since ? [{ variable: "bpi_total_since", value: new_total_since }] : []),'), "δείκτης bpi_total_since");
  ok(text.includes('...(new_total_floor ? [{ variable: "bpi_total_days_floor", value: 1 }] : []),'), "δείκτης bpi_total_days_floor");
  ok(text.includes("_sagBpiDaysTxt(bpiContext.total_days, bpiContext.total_since, bpiContext.total_floor)"), "το κείμενο σεζόν παίρνει αρχή και σημαία");
  ok(text.includes('{ variable: "bpi_total_days", value: new_total_days }'), "δείκτης bpi_total_days εκπέμπεται");
  ok(text.includes("    total_days: new_total_days,"), "bpi_context.total_days");
  ok(text.includes("text: accumulated.message + _sagBpiDaysTxt(bpiContext.total_days,"), "το κείμενο σεζόν δηλώνει ημέρες");
  ok(text.includes("      total_days: bpiContext.total_days,"), "seasonMeta.total_days");
  ok(text.includes("let _anomDays = null, _anomFrom = null;"), "_anomFrom δηλωμένο δίπλα στο _anomDays");
  ok(text.includes("_anomFrom = _sagSeasonStartDate(_sagSeasonKey(cropParams, new Date(now)));"), "_anomFrom από το κλειδί σεζόν");
  ok(/new Date\(now\), fieldConfig\?\.latitude,\n\s+_anomFrom,\n/.test(text), "η νόρμα μετρά από το ΙΔΙΟ _anomFrom");
  ok(text.includes("+ _sagAnomSinceTxt(_anomFrom) } });"), "το κείμενο ανωμαλίας δηλώνει από πότε");
  // η «Νύχτα» ΔΕΝ μετρά ημέρα: ο μετρητής ζει μόνο στη διαδρομή των συνόλων
  const nightIdx = text.indexOf('limiting_factor: "light",');
  const daysIdx = text.indexOf("const new_total_days =");
  ok(nightIdx > 0 && daysIdx > nightIdx, "ο μετρητής ημερών είναι μετά τον κλάδο «Νύχτα», όχι μέσα του");
  // ── συμπεριφορά βοηθών ──
  let D, A;
  try { D = extractFn(text, "_sagBpiDaysTxt"); A = extractFn(text, "_sagAnomSinceTxt"); }
  catch (e) { f.push("εξαγωγή: " + e.message); return f; }
  ok(D(5) === " Μετρημένο σε 5 ημέρες με πλήρη δεδομένα.", "Β1 5 ημέρες");
  ok(D(1) === " Μετρημένο σε 1 ημέρα με πλήρη δεδομένα.", "Β2 1 ημέρα (ενικός)");
  ok(D(0) === "" && D(undefined) === "" && D("x") === "" && D(-3) === "", "Β3 χωρίς ημέρες → κενό");
  ok(D(47.6) === " Μετρημένο σε 48 ημέρες με πλήρη δεδομένα.", "Β4 στρογγυλοποίηση");
  ok(D(6, "2026-09-19", false) === " Μετρημένο από 19/9/2026 (6 ημέρες με πλήρη δεδομένα).", "Β5 με ημερομηνία αρχής");
  ok(D(32, null, true) === " Μετρημένο σε τουλάχιστον 32 ημέρες με πλήρη δεδομένα — η αρχή είναι παλαιότερη από το διαθέσιμο ιστορικό.", "Β6 «τουλάχιστον» όταν η αρχή είναι άγνωστη");
  ok(D(32, "2026-08-23", true).indexOf("τουλάχιστον") > 0, "Β7 η σημαία υπερισχύει της ημερομηνίας");
  ok(D(3, "19/9/2026", false) === " Μετρημένο σε 3 ημέρες με πλήρη δεδομένα.", "Β8 μη έγκυρη ημερομηνία → χωρίς «από»");
  ok(A(new Date(2026, 2, 5)) === " Μετρημένο από 5/3/2026 (έναρξη σεζόν βαθμοημερών).", "Γ1 ημέρα/μήνας/έτος (5 Μαρτίου, όχι 3 Μαΐου)");
  ok(A(null) === "" && A("2026-03-05") === "" && A(new Date("x")) === "", "Γ2 χωρίς ημερομηνία → κενό");
  return f;
}

const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 παλιά έκδοση", "'v50.153 · 2026-09-24'", "'v50.152 · 2026-09-24'"],
  ["m2 μετρητής δεν προχωρά", "? Math.floor(prev_days) : 0) + 1) : 1;", "? Math.floor(prev_days) : 0) + 0) : 1;"],
  ["m2b νέα αρχή δεν μηδενίζει", "? Math.floor(prev_days) : 0) + 1) : 1;", "? Math.floor(prev_days) : 0) + 1) : ((Number.isFinite(prev_days) ? prev_days : 0) + 1);"],
  ["m2c η αρχή ξαναγράφεται κάθε μέρα", "const new_total_since = _hadTotals ? _prevSince : _todayISO;", "const new_total_since = _todayISO;"],
  ["m2d η σημαία δεν φεύγει ποτέ", "const new_total_floor = _hadTotals && !_prevSince\n", "const new_total_floor = _hadTotals\n"],
  ["m2e «τουλάχιστον» αγνοείται", "if (floor) return ' Μετρημένο σε τουλάχιστον '", "if (false) return ' Μετρημένο σε τουλάχιστον '"],
  ["m2f ημερομηνία αγνοείται", "if (m) return ' Μετρημένο από '", "if (false) return ' Μετρημένο από '"],
  ["m3 δείκτης δεν εκπέμπεται", '    { variable: "bpi_total_days", value: new_total_days },   // T-BPI-DAYS-01\n', ""],
  ["m4 κείμενο σεζόν χωρίς ημέρες", "text: accumulated.message + _sagBpiDaysTxt(bpiContext.total_days, bpiContext.total_since, bpiContext.total_floor)", "text: accumulated.message"],
  ["m5 βοηθός πάντα κενός", "if (!Number.isFinite(n) || n < 1) return '';", "if (!Number.isFinite(n) || n < 1e9) return '';"],
  ["m6 ενικός/πληθυντικός", "const d = r === 1 ? ' ημέρα' : ' ημέρες';", "const d = ' ημέρες';"],
  ["m7 μήνας/ημέρα ανάποδα", "from.getDate() + '/' + (from.getMonth() + 1)", "(from.getMonth() + 1) + '/' + from.getDate()"],
  ["m8 ανωμαλία χωρίς «από πότε»", "+ _sagAnomSinceTxt(_anomFrom) } });", "} });"],
  ["m9 η νόρμα ξαναϋπολογίζει την έναρξη", "                _anomFrom,\n", "                _sagSeasonStartDate(_sagSeasonKey(cropParams, new Date(now))),\n"],
  ["m10 _anomFrom δεν ορίζεται", "_anomFrom = _sagSeasonStartDate(_sagSeasonKey(cropParams, new Date(now)));   // T-ANOM-SINCE-01\n", ""],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!SRC.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(SRC.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
