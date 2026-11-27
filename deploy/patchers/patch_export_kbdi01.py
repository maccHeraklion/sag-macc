# T-KBDI-FIX-01 (28/11/2026) · fieldExportData.js: οι ημερήσιοι δείκτες (kbdi1, soil_moisture_condition1, vpd1, stress_level1)
# εξάγονται ΜΟΝΟ από την kbdi-v2. Οι εγγραφές της v1 (2025 → 27/11/2026) είναι άκυρες (SC-0005) και έχουν τον ίδιο χρόνο
# 23:59:50 με τις νέες· χωρίς φίλτρο το αρχείο θα είχε δύο γραμμές ανά ημέρα με αντίθετες τιμές. Όλα-ή-τίποτα· CRLF· node --check.
import subprocess, sys, os
P = "analysis/fieldExportData.js"
raw = open(P, "rb").read().decode("utf-8"); crlf = "\r\n" in raw; s = raw.replace("\r\n", "\n")
def sub(a, b):
    global s
    n = s.count(a)
    if n != 1: sys.exit(f"ΑΠΟΤΥΧΙΑ: {n} εμφανίσεις του {a[:70]!r}")
    s = s.replace(a, b)
assert "T-KBDI-FIX-01" not in s, "ήδη εφαρμοσμένο"
assert "T-EXPORT-RAIN-01" in s, "πρώτα το patch_export_rain01"

sub('''    // Written back onto the station once a day at 23:59:50 by the Keetch-Byram
    // Drought Index analysis - not sent by the sensor at all.
    { label: "dailyIndices", vars: ["kbdi1", "soil_moisture_condition1", "vpd1", "stress_level1"] },''',
'''    // Written back onto the station once a day at 23:59:50 by the Keetch-Byram
    // Drought Index analysis - not sent by the sensor at all.
    // T-KBDI-FIX-01: only the corrected kbdi-v2 records (the v1 ones are invalid, changelog SC-0005).
    { label: "dailyIndices", vars: ["kbdi1", "soil_moisture_condition1", "vpd1", "stress_level1"], onlyAlg: "kbdi-v2" },''')

sub('''        // T-EXPORT-RAIN-01: μία τιμή ανά ώρα + διάστημα / κάλυψη / ποιότητα από τα metadata της εγγραφής.''',
'''        // T-KBDI-FIX-01: μόνο εγγραφές του διορθωμένου υπολογισμού (οι παλιές είναι άκυρες και έχουν τον ίδιο χρόνο).
        if (group.onlyAlg) {
          for (const v of group.vars) {
            const all = groupValues[v] || [];
            groupValues[v] = all.filter((dp) => dp && dp.metadata && dp.metadata.alg === group.onlyAlg);
            if (groupValues[v].length !== all.length) context.log(`${info.name}: ${v} ${all.length} -> ${groupValues[v].length} (μόνο ${group.onlyAlg})`);
          }
        }
        // T-EXPORT-RAIN-01: μία τιμή ανά ώρα + διάστημα / κάλυψη / ποιότητα από τα metadata της εγγραφής.''')

out = s.replace("\n", "\r\n") if crlf else s
tmp = P + ".tmp_check.js"
open(tmp, "wb").write(out.encode("utf-8"))
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.remove(tmp)
if r.returncode: sys.exit("node --check: " + r.stderr)
open(P, "wb").write(out.encode("utf-8"))
print("ok · CRLF" if crlf else "ok · LF")
