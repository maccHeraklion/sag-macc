# -*- coding: utf-8 -*-
"""Πυρήνας v50.152 · T-BPI-SINCE-01 — το παράθυρο του σωρευτικού BPI γίνεται ΗΜΕΡΟΜΗΝΙΑ
(`bpi_total_since`) και αποκτά σημαία «τουλάχιστον» (`bpi_total_days_floor`) για αγρούς
των οποίων η αρχή είναι παλαιότερη από το διαθέσιμο ιστορικό (απόφαση Μιχάλη 24/9, επιλογή 3).
CRLF χωρίς BOM, κάθε αντικατάσταση count==1, node --check, όλα-ή-τίποτα. Καμία αγρονομική
σταθερά, κανένας υπολογισμός δεν αλλάζει."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read()
assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n")
print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))

def sub(old, new, label):
    global s
    c = s.count(old)
    assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new)
    print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.151 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.152 · 2026-09-24';", "έκδοση v50.152")

sub("  const prev_days = Number(measurements?.data?.bpi_total_days?.[0]?.value ?? 0);\n"
    "  const new_total_days = ((Number.isFinite(prev_days) && prev_days >= 0) ? Math.floor(prev_days) : 0) + 1;\n",
    "  const prev_days = Number(measurements?.data?.bpi_total_days?.[0]?.value ?? 0);\n"
    "  // T-BPI-SINCE-01 (v50.152 · 24/9/2026, απόφαση Μιχάλη): το παράθυρο είναι ΗΜΕΡΟΜΗΝΙΑ,\n"
    "  // όχι μόνο μετρητής. Όταν τα σύνολα ξεκινούν από το μηδέν (κανένα προηγούμενο\n"
    "  // bpi_total_actual) η αρχή είναι σήμερα και ο μετρητής 1. Όταν η αρχή είναι άγνωστη\n"
    "  // (σπορά 24/9 σε αγρούς με ιστορικό παλαιότερο από τη διατήρηση δεδομένων) η σημαία\n"
    "  // `bpi_total_days_floor` λέει «τουλάχιστον» — και φεύγει μόνη της στην επόμενη αρχή.\n"
    "  const _hadTotals = Array.isArray(measurements?.data?.bpi_total_actual) && measurements.data.bpi_total_actual.length > 0;\n"
    "  const new_total_days = _hadTotals ? (((Number.isFinite(prev_days) && prev_days >= 0) ? Math.floor(prev_days) : 0) + 1) : 1;\n"
    "  const _todayISO = moment().tz(measurements?.timezone || 'Europe/Athens').format('YYYY-MM-DD');\n"
    "  const _prevSinceRaw = String(measurements?.data?.bpi_total_since?.[0]?.value ?? '');\n"
    "  const _prevSince = /^\\d{4}-\\d{2}-\\d{2}$/.test(_prevSinceRaw) ? _prevSinceRaw : null;\n"
    "  const new_total_since = _hadTotals ? _prevSince : _todayISO;\n"
    "  const new_total_floor = _hadTotals && !_prevSince\n"
    "    && Number(measurements?.data?.bpi_total_days_floor?.[0]?.value ?? 0) === 1;\n",
    "T-BPI-SINCE-01 αρχή/σημαία στο calculate_BPI")
sub("    total_days: new_total_days,   // T-BPI-DAYS-01\n  };\n",
    "    total_days: new_total_days,   // T-BPI-DAYS-01\n"
    "    total_since: new_total_since,   // T-BPI-SINCE-01\n"
    "    total_floor: new_total_floor,\n  };\n",
    "T-BPI-SINCE-01 bpi_context")
sub('    { variable: "bpi_total_days", value: new_total_days },   // T-BPI-DAYS-01\n',
    '    { variable: "bpi_total_days", value: new_total_days },   // T-BPI-DAYS-01\n'
    '    ...(new_total_since ? [{ variable: "bpi_total_since", value: new_total_since }] : []),   // T-BPI-SINCE-01\n'
    '    ...(new_total_floor ? [{ variable: "bpi_total_days_floor", value: 1 }] : []),\n',
    "T-BPI-SINCE-01 δείκτες")
sub("function _sagBpiDaysTxt(days) {\n"
    "  const n = Number(days);\n"
    "  if (!Number.isFinite(n) || n < 1) return '';\n"
    "  const r = Math.round(n);\n"
    "  return ' Μετρημένο σε ' + r + (r === 1 ? ' ημέρα' : ' ημέρες') + ' με πλήρη δεδομένα.';\n"
    "}\n",
    "// T-BPI-SINCE-01: με ημερομηνία αρχής όταν είναι γνωστή· «τουλάχιστον» όταν δεν είναι.\n"
    "function _sagBpiDaysTxt(days, since, floor) {\n"
    "  const n = Number(days);\n"
    "  if (!Number.isFinite(n) || n < 1) return '';\n"
    "  const r = Math.round(n);\n"
    "  const d = r === 1 ? ' ημέρα' : ' ημέρες';\n"
    "  if (floor) return ' Μετρημένο σε τουλάχιστον ' + r + d + ' με πλήρη δεδομένα — η αρχή είναι παλαιότερη από το διαθέσιμο ιστορικό.';\n"
    "  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(since || ''));\n"
    "  if (m) return ' Μετρημένο από ' + Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] + ' (' + r + d + ' με πλήρη δεδομένα).';\n"
    "  return ' Μετρημένο σε ' + r + d + ' με πλήρη δεδομένα.';\n"
    "}\n",
    "T-BPI-SINCE-01 βοηθός κειμένου")
sub("      text: accumulated.message + _sagBpiDaysTxt(bpiContext.total_days)   // T-BPI-DAYS-01\n",
    "      text: accumulated.message + _sagBpiDaysTxt(bpiContext.total_days, bpiContext.total_since, bpiContext.total_floor)   // T-BPI-DAYS-01/T-BPI-SINCE-01\n",
    "T-BPI-SINCE-01 κείμενο σεζόν")
sub("      total_days: bpiContext.total_days,   // T-BPI-DAYS-01\n    };\n",
    "      total_days: bpiContext.total_days,   // T-BPI-DAYS-01\n"
    "      total_since: bpiContext.total_since,   // T-BPI-SINCE-01\n"
    "      total_floor: bpiContext.total_floor,\n    };\n",
    "T-BPI-SINCE-01 seasonMeta")

out = s.replace("\n", "\r\n").encode("utf-8")
assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode:
    print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ — τίποτα δεν γράφτηκε")
io.open(P, "wb").write(out)
chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
