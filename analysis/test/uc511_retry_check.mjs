// Ελεγκτής T-IRRIG-RETRY-01 (analysis/uc511_status_check.js): εντολή βαλβίδας χωρίς επιβεβαίωση ξαναστέλνεται
// μετά από 5΄ και κάθε 5΄ έως το όριο· μόνο η τελευταία εντολή ανά βαλβίδα· επιβεβαίωση μόνο με τη ζητούμενη
// κατάσταση· μετά το όριο σταματά ΜΙΑ φορά (όχι βρόχος)· το FF55 είναι ίδιο με του UC511_downlink.
// Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα (μπλοκ «ΛΟΓΙΚΗ ΕΠΑΝΑΛΗΨΗΣ» + encoders).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "uc511_status_check.js"), "utf8");
const DL = fs.readFileSync(path.join(here, "..", "uc511_downlink.js"), "utf8");
const A = "// ═══ ΛΟΓΙΚΗ ΕΠΑΝΑΛΗΨΗΣ", B = "// ═══ ΤΕΛΟΣ ΛΟΓΙΚΗΣ ΕΠΑΝΑΛΗΨΗΣ";

function load(code) {
  const a = code.indexOf(A), b = code.indexOf(B), h = code.indexOf("/* ================= helpers");
  if (a < 0 || b < 0 || h < 0) throw new Error("δεν βρέθηκε το μπλοκ ΛΟΓΙΚΗ ΕΠΑΝΑΛΗΨΗΣ");
  const helpers = code.slice(h, code.indexOf("async function listAllDevicesByTags"));
  return new Function(code.slice(a, b) + helpers +
    "\nreturn { retryConfig, latestValveCommands, isValveAcked, pendingRuleSequences, parseState, retryDecision, buildFF55FromMetadata };")();
}

const M = 60000, T0 = Date.parse("2026-10-05T08:00:00Z");
const cmd = (variable, value, min, metadata = {}) => ({ variable, value, metadata, ts: T0 + min * M });
const ack = (variable, value, min) => ({ variable, value, ts: T0 + min * M });

// Προσομοίωση: τρέχει την απόφαση κάθε λεπτό από 0΄ έως `until`΄ και γυρνά τα λεπτά αποστολής / εγκατάλειψης.
function simulate(R, job, until, ackAtMin = null) {
  const cfg = R.retryConfig({});
  let saved = null; const sends = []; const gaveUp = []; let lastPending = true;
  for (let m = 0; m <= until; m++) {
    const j = { ...job, acked: ackAtMin != null && m >= ackAtMin };
    const d = R.retryDecision(R.parseState(saved), j, T0 + m * M + 1000, cfg);
    if (d.action === "send") sends.push(m);
    if (d.action === "give_up") gaveUp.push(m);
    if (d.write) saved = JSON.stringify(d.state);
    lastPending = d.pending;
  }
  return { sends, gaveUp, lastPending };
}

function run(code, dl) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let R; try { R = load(code); } catch (e) { return ["U0 φόρτωση: " + e.message]; }

  // U1 ρυθμός: πρώτη επανάληψη στα 5΄, μετά κάθε 5΄
  const cfg = R.retryConfig({});
  ok(cfg.everyMs === 5 * M && cfg.maxOpen === 6 && cfg.maxClose === 24, "U1α προεπιλογές 5΄ / 6 / 24 (" + JSON.stringify(cfg) + ")");
  const close = simulate(R, { ts: T0, open: false, acked: false }, 200);
  ok(JSON.stringify(close.sends.slice(0, 3)) === "[5,10,15]", "U1β κλείσιμο: επαναλήψεις 5΄,10΄,15΄ (" + close.sends.slice(0, 5) + ")");
  ok(close.sends.length === 24 && close.sends[23] === 120, "U1γ κλείσιμο: 24 επαναλήψεις έως 120΄ (" + close.sends.length + ")");
  // U2 όριο: μία εγκατάλειψη, καμία αποστολή μετά (ο παλιός κώδικας μηδένιζε και ξανάρχιζε)
  ok(JSON.stringify(close.gaveUp) === "[125]" && close.lastPending === false, "U2α κλείσιμο: εγκατάλειψη μία φορά στα 125΄ (" + close.gaveUp + ")");
  const open = simulate(R, { ts: T0, open: true, acked: false }, 120);
  ok(open.sends.length === 6 && open.sends[5] === 30 && JSON.stringify(open.gaveUp) === "[35]", "U2β άνοιγμα: 6 επαναλήψεις έως 30΄, εγκατάλειψη 35΄ (" + open.sends + " | " + open.gaveUp + ")");
  ok(cfg.lookbackMs > 125 * M, "U2γ το παράθυρο ανάγνωσης καλύπτει όλη τη ζωή της εντολής (" + cfg.lookbackMs / M + "΄)");
  // U3 επιβεβαίωση σταματά τις επαναλήψεις
  const acked = simulate(R, { ts: T0, open: false, acked: false }, 60, 7);
  ok(JSON.stringify(acked.sends) === "[5]" && acked.gaveUp.length === 0 && acked.lastPending === false, "U3 επιβεβαίωση στο 7΄: μόνο μία επανάληψη (" + acked.sends + ")");
  ok(simulate(R, { ts: T0, open: true, acked: false }, 60, 0).sends.length === 0, "U3β επιβεβαίωση αμέσως: καμία επανάληψη");
  // U4 νέα εντολή = νέα μέτρηση (το ts ταυτοποιεί την εντολή)
  const failedOld = JSON.stringify({ ts: T0 - 300 * M, n: 6, last: T0 - 270 * M, failed: true });
  const dNew = R.retryDecision(R.parseState(failedOld), { ts: T0, open: true, acked: false }, T0 + 5 * M + 1000, cfg);
  ok(dNew.action === "send" && dNew.state.n === 1, "U4 νέα εντολή μετά από αποτυχημένη ξεκινά από 1 (" + dNew.action + ")");
  ok(R.parseState("0") === null && R.parseState("") === null, "U4β παλιές τιμές param «0» = καμία κατάσταση");
  // U9 παλιά εντολή που ο checker δεν είδε ποτέ (πριν το deploy) δεν ανασταίνεται
  const dOld = R.retryDecision(null, { ts: T0, open: true, acked: false }, T0 + 60 * M, cfg);
  ok(dOld.action === "expired" && !dOld.pending, "U9α «άνοιξε» 60΄ πριν, χωρίς ιστορικό → δεν ξαναστέλνεται (" + dOld.action + ")");
  ok(R.retryDecision(null, { ts: T0, open: false, acked: false }, T0 + 6 * M, cfg).action === "send", "U9β 6΄ μετά, πρώτη ματιά → κανονική επανάληψη");
  // U10 χωρίς ολίσθηση: ο checker τρέχει κάθε 61΄΄, οι επαναλήψεις μένουν στα 5΄,10΄,…
  { let saved = null; const at = [];
    for (let s = 0; s <= 130 * 60; s += 61) { const d = R.retryDecision(R.parseState(saved), { ts: T0, open: false, acked: false }, T0 + s * 1000, cfg);
      if (d.action === "send") at.push(Math.floor(s / 60)); if (d.write) saved = JSON.stringify(d.state); }
    ok(at.length === 24 && at[23] <= 121, "U10 24 επαναλήψεις έως ~120΄ παρά τον ρυθμό 61΄΄ (" + at.length + " · τελευταία " + at[23] + "΄)"); }

  // U5 μόνο η τελευταία εντολή ανά βαλβίδα
  const latest = R.latestValveCommands([cmd("valve_1_command", "on", 0), cmd("valve_1_command", "off", 2),
    cmd("valve_2_time_command", 20, 1), cmd("valve_2_command", "on", 0)]);
  const v1 = latest.find((c) => c.valve === 1), v2 = latest.find((c) => c.valve === 2);
  ok(latest.length === 2 && v1.state === "off" && v2.kind === "time" && v2.minutes === 20, "U5 τελευταία ανά βαλβίδα (" + JSON.stringify(latest.map((c) => [c.valve, c.state, c.kind])) + ")");

  // U6 επιβεβαίωση μόνο με τη ζητούμενη κατάσταση και μετά την εντολή
  const off = { ...cmd("valve_1_command", "off", 10), valve: 1, state: "off", kind: "onoff" };
  ok(!R.isValveAcked(off, [ack("valve_1", "on", 11)]), "U6α periodic «on» μετά από «off» ΔΕΝ είναι επιβεβαίωση");
  ok(!R.isValveAcked(off, [ack("valve_1", "off", 9)]), "U6β «off» ΠΡΙΝ την εντολή δεν μετρά");
  ok(R.isValveAcked(off, [ack("valve_1_command_feedback", "off", 10.3)]), "U6γ feedback «off» μετά = επιβεβαίωση");
  ok(R.isValveAcked(off, [ack("valve_1", "off", 10.5)]), "U6δ valve_1 «off» μετά = επιβεβαίωση");
  ok(!R.isValveAcked(off, [ack("valve_2", "off", 11)]), "U6ε άλλη βαλβίδα δεν μετρά");
  const t2 = { ...cmd("valve_1_time_command", 2, 0), valve: 1, state: "on", kind: "time", minutes: 2 };
  ok(R.isValveAcked(t2, [ack("valve_1", "off", 2.2)]), "U6ζ χρονικό 2΄ που έκλεισε μόνο του = άνοιξε");
  ok(!R.isValveAcked(t2, [ack("valve_1", "off", 0.5)]), "U6η «off» πριν λήξει η διάρκεια δεν μετρά");

  // U7 κανόνες: εκκρεμεί ό,τι δεν ακολουθείται από ruleN
  const rules = R.pendingRuleSequences([cmd("rule3_set", 1, 0, { start_iso: "2026-10-06T05:00:00Z" }), cmd("rule3_enable", true, 1),
    cmd("rule4_enable", true, 0)], [ack("rule4", 1, 0.5)]);
  ok(rules.length === 1 && rules[0].ruleId === 3 && rules[0].events.length === 2, "U7 rule3 εκκρεμεί (set+enable), rule4 επιβεβαιώθηκε");

  // U8 FF55 ίδιο με του UC511_downlink (duration_sec, water_pulses, weekday_mask)
  const md = { start_iso: "2026-10-06T05:00:00Z", repeat: true, unit: "week", interval: 1, weekday_mask: 0b0010101,
    valve: 2, duration_sec: 1830, water_pulses: 0, enabled: true };
  const ff = R.buildFF55FromMetadata(5, md, 4);
  const s = Math.floor(Date.parse(md.start_iso) / 1000);
  const le32 = (n) => [0, 8, 16, 24].map((k) => ((n >>> k) & 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  const want = "FF55" + "05" + "01" + "01" + le32(s) + "00000000" + "01" + "02" + "15" + "01" + "02" + "02" + "01" + "01" + le32(1830) + "00" + "00000000";
  ok(ff === want, "U8α FF55 εβδομαδιαίο με διάρκεια σε δευτερόλεπτα (" + ff + " ≠ " + want + ")");
  ok(R.buildFF55FromMetadata(1, { start_iso: md.start_iso, water_pulses: 50 }, null).endsWith("01" + le32(50)), "U8β παλμοί νερού = 50 (όχι 0xFFFFFFFF)");
  ok(R.buildFF55FromMetadata(1, { start_iso: md.start_iso, repeat: true, unit: "month", interval: 2 }, 4).includes("01" + "00" + "02" + "00" + "02"), "U8γ μήνας σε HW v4");
  // ο encoder του downlink έχει ακόμη τα ίδια πεδία (αν αλλάξει εκεί, πρέπει να αλλάξει κι εδώ)
  ok(dl.includes("md.duration_sec != null") && dl.includes("md.water_pulses ?? md.pulses") && dl.includes("md.weekday_mask"), "U8δ UC511_downlink χρησιμοποιεί τα ίδια πεδία");
  return f;
}

const fails = run(SRC, DL);
if (fails.length) { console.log("ΑΠΟΤΥΧΙΑ (" + fails.length + "):\n - " + fails.join("\n - ")); process.exitCode = 1; }
else console.log("OK — uc511_retry_check: όλοι οι έλεγχοι πέρασαν");

// Μεταλλάξεις: κάθε μία πρέπει να ρίχνει τουλάχιστον έναν έλεγχο.
const MUT = [
  ["χωρίς λήξη παλιών εντολών", "if (fresh && now - job.ts > 2 * cfg.everyMs)", "if (false)"],
  ["ολίσθηση από την τελευταία αποστολή", "now < state.ts + (state.n + 1) * cfg.everyMs", "now - state.last < cfg.everyMs"],
  ["5΄ → 1΄","num(env.RETRY_EVERY_MIN, 5)", "num(env.RETRY_EVERY_MIN, 1)"],
  ["χωρίς έλεγχο κατάστασης στην επιβεβαίωση", "if (v === c.state) return true;", "return true;"],
  ["επανεκκίνηση μετά το όριο", "action: \"give_up\", state: { ...state, failed: true }", "action: \"give_up\", state: { ...state, n: 0, last: now }"],
  ["όλες οι εντολές αντί της τελευταίας", "if (!prev || c.ts > prev.ts)", "if (true)"],
  ["παλιό duration_min", "md.duration_sec != null ? Number(md.duration_sec) : ", ""],
  ["παλιό bug παλμών", "clampInt(Number(md.water_pulses ?? md.pulses) || 0, 0, 0xffffffff)", "clampInt(Number(md.pulses) || 0, 0xffffffff)"],
];
let alive = 0;
for (const [name, from, to] of MUT) {
  if (!SRC.includes(from)) { console.log("μετάλλαξη χωρίς στόχο: " + name); alive++; continue; }
  if (!run(SRC.replace(from, to), DL).length) { console.log("ΕΠΙΖΗΣΕ μετάλλαξη: " + name); alive++; }
}
if (alive) process.exitCode = 1; else console.log("OK — " + MUT.length + "/" + MUT.length + " μεταλλάξεις σκοτώθηκαν");
