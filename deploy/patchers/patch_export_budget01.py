# T-EXPORT-BUDGET-01 (28/11/2026, απόφαση Μιχάλη «κάνε όλες τις αλλαγές 1-5») · fieldExportData.js: φρουρός αναγνώσεων.
# (α) Η ίδια εξαγωγή (αγρός, διάστημα, email, επιλογές) μέσα σε 60΄ δεν ξανατρέχει (26/11 η ίδια έτρεξε δύο φορές σε 4΄).
# (β) Ημερήσιο όριο αναγνώσεων ανά αγρό 1,5 εκατ. (κυλιόμενο 24ωρο): εκτίμηση με query=count ανά μήνα πριν διαβαστεί οτιδήποτε.
# (γ) Κάθε εξαγωγή γράφει export_log (αγρός, κλειδί, αναγνώσεις, εκτίμηση) στη συσκευή της φόρμας. Το email ΔΕΝ γράφεται (μόνο hash).
# Αν η εκτίμηση ή η ανάγνωση του export_log αποτύχει, η εξαγωγή συνεχίζει όπως πριν. Όλα-ή-τίποτα· CRLF· node --check.
import subprocess, sys, os
P = "analysis/fieldExportData.js"
raw = open(P, "rb").read().decode("utf-8"); crlf = "\r\n" in raw; s = raw.replace("\r\n", "\n")
def sub(a, b):
    global s
    n = s.count(a)
    if n != 1: sys.exit(f"ΑΠΟΤΥΧΙΑ: {n} εμφανίσεις του {a[:70]!r}")
    s = s.replace(a, b)
assert "T-EXPORT-BUDGET-01" not in s, "ήδη εφαρμοσμένο"
assert "T-KBDI-FIX-01" in s, "πρώτα το patch_export_kbdi01"

sub('''const VALIDATION_VARIABLE = "validationExport";''',
'''const VALIDATION_VARIABLE = "validationExport";
// T-EXPORT-BUDGET-01 (28/11/2026): φρουρός αναγνώσεων. Το όριο αναγνώσεων του λογαριασμού είναι κοινό για όλους τους πελάτες·
// μία εξαγωγή όλου του ιστορικού ενός σταθμού κοστίζει ~0,55 εκατ. αναγνώσεις (25/11 το όριο εξαντλήθηκε).
const EXPORT_LOG_VARIABLE = "export_log";
const FIELD_DAILY_READS = 1500000;   // ανά αγρό, κυλιόμενο 24ωρο (≈ 2–3 εξαγωγές όλου του ιστορικού ενός σταθμού)
const DUPLICATE_WINDOW_MIN = 60;     // η ίδια εξαγωγή μέσα σε 60΄ δεν ξανατρέχει
const READ_METER = { n: 0 };
function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
// Παράθυρα ≤ 28 ημερών (το query=count δέχεται έως 1 μήνα ανά ερώτημα), καθαρή αριθμητική UTC.
function monthWindows(startIso, endIso) {
  const out = []; let a = Date.parse(startIso); const end = Date.parse(endIso); const STEP = 28 * 864e5;
  if (!Number.isFinite(a) || !Number.isFinite(end)) return out;
  while (a < end && out.length < 60) { const b = Math.min(a + STEP, end); out.push([new Date(a).toISOString(), new Date(b).toISOString()]); a = b; }
  return out;
}
// Αμιγής απόφαση: logs = προηγούμενες εγγραφές export_log ({time, metadata}), key = hash αιτήματος, estimate = εκτίμηση αναγνώσεων.
function exportBudgetDecision(logs, nowMs, key, fieldId, estimate) {
  let used = 0, dupMin = null;
  for (const r of Array.isArray(logs) ? logs : []) {
    const m = (r && r.metadata) || {}; const ts = Date.parse((r && r.time) || m.ts); if (!Number.isFinite(ts)) continue;
    const age = nowMs - ts; if (age < 0) continue;
    if (m.field_id === fieldId && age < 864e5) used += Number(m.reads) || 0;
    if (m.key === key && m.status === "ok" && age < DUPLICATE_WINDOW_MIN * 6e4) { const mins = Math.max(1, Math.round(age / 6e4)); if (dupMin === null || mins < dupMin) dupMin = mins; }
  }
  if (dupMin !== null) return { action: "duplicate", minutes: dupMin, used };
  if (Number.isFinite(estimate) && used + estimate > FIELD_DAILY_READS) return { action: "budget", used, estimate };
  return { action: "go", used, estimate };
}''')

sub('''    if (!Array.isArray(data) || data.length === 0) break;
''', '''    if (!Array.isArray(data) || data.length === 0) break;
    READ_METER.n += data.length;   // T-EXPORT-BUDGET-01
''')

sub('''    noSensors: (f) => `Ο αγρός «${f}» δεν έχει συνδεδεμένους αισθητήρες.`,''',
'''    noSensors: (f) => `Ο αγρός «${f}» δεν έχει συνδεδεμένους αισθητήρες.`,
    duplicate: (f, m) => `Η ίδια εξαγωγή για τον αγρό «${f}» στάλθηκε πριν από ${m}΄. Ελέγξτε το email σας (και τα ανεπιθύμητα). Για να μην εξαντληθεί το κοινό όριο αναγνώσεων, η ίδια εξαγωγή ξανατρέχει μετά από ${DUPLICATE_WINDOW_MIN}΄.`,
    budget: (f, est, used) => `Η εξαγωγή για τον αγρό «${f}» θα διάβαζε ~${Math.round(est / 1000).toLocaleString("el-GR")} χιλ. εγγραφές· το όριο ανά αγρό είναι ${(FIELD_DAILY_READS / 1e6).toLocaleString("el-GR")} εκατ. το 24ωρο (ήδη ${Math.round(used / 1000).toLocaleString("el-GR")} χιλ.). Επιλέξτε μικρότερο διάστημα ή δοκιμάστε αργότερα.`,''')

sub('''    noSensors: (f) => `Field "${f}" has no sensors attached.`,''',
'''    noSensors: (f) => `Field "${f}" has no sensors attached.`,
    duplicate: (f, m) => `The same export for "${f}" was sent ${m} min ago. Please check your email (and spam folder). To protect the shared read limit, the same export can run again after ${DUPLICATE_WINDOW_MIN} min.`,
    budget: (f, est, used) => `The export for "${f}" would read ~${Math.round(est / 1000)}k records; the limit per field is ${FIELD_DAILY_READS / 1e6}M per 24 h (already ${Math.round(used / 1000)}k). Please choose a shorter period or try later.`,''')

sub('''    // Reading a long period across every sensor is the slow part - say so.
    await sendValidation("info", t.fetching(fieldName));''',
'''    // --- T-EXPORT-BUDGET-01: ίδια εξαγωγή μέσα σε 60΄ · όριο αναγνώσεων ανά αγρό ---------------
    READ_METER.n = 0;
    const exportKey = fnv1a([fieldInfo.id, startDate, endDate, emailValue.toLowerCase(), pairColumnsMode, hideEui, includeDiseases, lang].join("|"));
    let readEstimate = null;
    try {
      let est = 0;
      for (const sensor of sensors) {
        const counts = await Promise.all(monthWindows(startDate, endDate).map(([a, b]) =>
          resources.devices.getDeviceData(sensor.id, { query: "count", start_date: a, end_date: b })));
        for (const n of counts) est += Number(n) || 0;
      }
      readEstimate = est;
    } catch (err) {
      context.log(`[T-EXPORT-BUDGET-01] εκτίμηση απέτυχε (${err && err.message ? err.message : err}) — συνεχίζω χωρίς όριο.`);
    }
    let exportLogs = [];
    try {
      exportLogs = await resources.devices.getDeviceData(formDeviceId, { variables: [EXPORT_LOG_VARIABLE], qty: 50 });
    } catch (err) {
      context.log(`[T-EXPORT-BUDGET-01] ανάγνωση ${EXPORT_LOG_VARIABLE} απέτυχε (${err && err.message ? err.message : err}).`);
    }
    const writeExportLog = async (status) => {
      try {
        await postValidation({ variable: EXPORT_LOG_VARIABLE, value: fieldName, metadata: { field_id: fieldInfo.id, key: exportKey, status,
          start: startDate, end: endDate, reads: READ_METER.n, estimate: readEstimate, ts: new Date().toISOString(), ver: "T-EXPORT-BUDGET-01" } });
      } catch (err) { context.log(`[T-EXPORT-BUDGET-01] εγγραφή ${EXPORT_LOG_VARIABLE} απέτυχε (${err && err.message ? err.message : err}).`); }
    };
    const budget = exportBudgetDecision(exportLogs, Date.now(), exportKey, fieldInfo.id, readEstimate);
    context.log(`[T-EXPORT-BUDGET-01] εκτίμηση ${readEstimate} · 24ωρο αγρού ${budget.used} · απόφαση ${budget.action}`);
    if (budget.action === "duplicate") { await sendValidation("warning", t.duplicate(fieldName, budget.minutes)); return; }
    if (budget.action === "budget") { await sendValidation("warning", t.budget(fieldName, readEstimate, budget.used)); await writeExportLog("budget"); return; }

    // Reading a long period across every sensor is the slow part - say so.
    await sendValidation("info", t.fetching(fieldName));''')

sub('''    if (failedSensors.length > 0) {
      await sendValidation("warning", t.partial(fieldName, parts.length, failedSensors.join("; ")));
    } else {
      await sendValidation("success", t.ok(fieldName, parts.length));
    }''',
'''    await writeExportLog(failedSensors.length > 0 ? "partial" : "ok");   // T-EXPORT-BUDGET-01 (πριν το τελικό μήνυμα)
    context.log(`[T-EXPORT-BUDGET-01] αναγνώσεις ${READ_METER.n} (εκτίμηση ${readEstimate})`);
    if (failedSensors.length > 0) {
      await sendValidation("warning", t.partial(fieldName, parts.length, failedSensors.join("; ")));
    } else {
      await sendValidation("success", t.ok(fieldName, parts.length));
    }''')

out = s.replace("\n", "\r\n") if crlf else s
tmp = P + ".tmp_check.js"
open(tmp, "wb").write(out.encode("utf-8"))
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.remove(tmp)
if r.returncode: sys.exit("node --check: " + r.stderr)
open(P, "wb").write(out.encode("utf-8"))
print("ok · CRLF" if crlf else "ok · LF")
