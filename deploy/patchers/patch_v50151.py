# -*- coding: utf-8 -*-
"""Πυρήνας v50.151 · T-BPI-DAYS-01 + T-ANOM-SINCE-01 (§8.2 και §8.4 της απογραφής 24/9).
CRLF χωρίς BOM, κάθε αντικατάσταση count==1, node --check, όλα-ή-τίποτα.
Καμία αγρονομική σταθερά, κανένας υπολογισμός δεν αλλάζει — μόνο ένας μετρητής ημερών
και δύο δηλώσεις παραθύρου στα κείμενα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read()
assert raw[:3] != b"\xef\xbb\xbf", "BOM"
assert raw.count(b"\n") == raw.count(b"\r\n"), "γυμνά LF στον πυρήνα"
s = raw.decode("utf-8").replace("\r\n", "\n")
print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))

def sub(old, new, label):
    global s
    c = s.count(old)
    assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new)
    print("  OK", label)

# ── έκδοση ──
sub("const SAG_KERNEL_VERSION = 'v50.150 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.151 · 2026-09-24';", "έκδοση v50.151")

# ── T-BPI-DAYS-01 · μετρητής ημερών των σωρευτικών BPI ──
sub("  const prev_potential = Number(measurements?.data?.bpi_total_potential?.[0]?.value ?? 0);\n",
    "  const prev_potential = Number(measurements?.data?.bpi_total_potential?.[0]?.value ?? 0);\n"
    "  // T-BPI-DAYS-01 (v50.151 · 24/9/2026): πόσες ημέρες πρόσθεσαν στα σύνολα. Χωρίς\n"
    "  // αυτό το «Αξιοποίηση σεζόν 46 %» δεν λέει αν μετρήθηκε σε 5 ή σε 50 ημέρες\n"
    "  // (Κουτσάκης: ~5). Προχωρά ΜΟΝΟ εδώ, μαζί με τα σύνολα — η «Νύχτα» δεν μετρά.\n"
    "  const prev_days = Number(measurements?.data?.bpi_total_days?.[0]?.value ?? 0);\n"
    "  const new_total_days = ((Number.isFinite(prev_days) && prev_days >= 0) ? Math.floor(prev_days) : 0) + 1;\n",
    "T-BPI-DAYS-01 μετρητής")
sub("    total_potential: Number(new_total_potential.toFixed(2)),\n    performance_pct,\n  };\n",
    "    total_potential: Number(new_total_potential.toFixed(2)),\n    performance_pct,\n"
    "    total_days: new_total_days,   // T-BPI-DAYS-01\n  };\n",
    "T-BPI-DAYS-01 bpi_context.total_days")
sub('    { variable: "bpi_total_potential", value: Number(new_total_potential.toFixed(2)) },\n',
    '    { variable: "bpi_total_potential", value: Number(new_total_potential.toFixed(2)) },\n'
    '    { variable: "bpi_total_days", value: new_total_days },   // T-BPI-DAYS-01\n',
    "T-BPI-DAYS-01 δείκτης bpi_total_days")
sub("function getFertilizationGrowthMessages(bpi, bpiError, bpiContext) {\n",
    "// T-BPI-DAYS-01: η δήλωση κάλυψης του σωρευτικού — σε πόσες ημέρες μετρήθηκε.\n"
    "function _sagBpiDaysTxt(days) {\n"
    "  const n = Number(days);\n"
    "  if (!Number.isFinite(n) || n < 1) return '';\n"
    "  const r = Math.round(n);\n"
    "  return ' Μετρημένο σε ' + r + (r === 1 ? ' ημέρα' : ' ημέρες') + ' με πλήρη δεδομένα.';\n"
    "}\n\n"
    "function getFertilizationGrowthMessages(bpi, bpiError, bpiContext) {\n",
    "T-BPI-DAYS-01 βοηθός κειμένου")
sub("      text: accumulated.message + ((bpiContext && bpiContext.light_source && bpiContext.light_source !== 'sensor')\n",
    "      text: accumulated.message + _sagBpiDaysTxt(bpiContext.total_days)   // T-BPI-DAYS-01\n"
    "        + ((bpiContext && bpiContext.light_source && bpiContext.light_source !== 'sensor')\n",
    "T-BPI-DAYS-01 κείμενο σεζόν")
sub("      total_potential: bpiContext.total_potential,\n    };\n",
    "      total_potential: bpiContext.total_potential,\n      total_days: bpiContext.total_days,   // T-BPI-DAYS-01\n    };\n",
    "T-BPI-DAYS-01 seasonMeta.total_days")

# ── T-ANOM-SINCE-01 · η θερμική ανωμαλία λέει από πότε μετρά ──
sub("function _sagSeasonAnomalyDays(Tbase, Tupper, accumGDD, nowDate, latitude, seasonStart, elevM) {\n",
    "// T-ANOM-SINCE-01 (v50.151): η δήλωση παραθύρου της θερμικής ανωμαλίας — από ποια\n"
    "// ημερομηνία αθροίζονται οι βαθμοημέρες. Χωρίς ICU: ημέρα/μήνας/έτος με το χέρι.\n"
    "function _sagAnomSinceTxt(from) {\n"
    "  if (!(from instanceof Date) || isNaN(from.getTime())) return '';\n"
    "  return ' Μετρημένο από ' + from.getDate() + '/' + (from.getMonth() + 1) + '/' + from.getFullYear()\n"
    "    + ' (έναρξη σεζόν βαθμοημερών).';\n"
    "}\n\n"
    "function _sagSeasonAnomalyDays(Tbase, Tupper, accumGDD, nowDate, latitude, seasonStart, elevM) {\n",
    "T-ANOM-SINCE-01 βοηθός")
sub("          let _anomDays = null;\n",
    "          let _anomDays = null, _anomFrom = null;   // T-ANOM-SINCE-01: από πότε μετρά\n",
    "T-ANOM-SINCE-01 δήλωση _anomFrom")
sub("              _anomDays = _sagSeasonAnomalyDays(\n"
    "                Number(_cpProf.optimal_temp_range?.min) || 0,\n"
    "                Number(_cpProf.optimal_temp_range?.max) || 35,\n"
    "                Number(getVal(measurementsForCrop, 'gdd_crop_accumulated', NaN)),\n"
    "                new Date(now), fieldConfig?.latitude,\n"
    "                _sagSeasonStartDate(_sagSeasonKey(cropParams, new Date(now))),\n",
    "              _anomFrom = _sagSeasonStartDate(_sagSeasonKey(cropParams, new Date(now)));   // T-ANOM-SINCE-01\n"
    "              _anomDays = _sagSeasonAnomalyDays(\n"
    "                Number(_cpProf.optimal_temp_range?.min) || 0,\n"
    "                Number(_cpProf.optimal_temp_range?.max) || 35,\n"
    "                Number(getVal(measurementsForCrop, 'gdd_crop_accumulated', NaN)),\n"
    "                new Date(now), fieldConfig?.latitude,\n"
    "                _anomFrom,\n",
    "T-ANOM-SINCE-01 κλήση με _anomFrom")
sub("                  text: Math.abs(_anomDays) < 5\n"
    "                    ? 'Η εποχή εξελίσσεται κανονικά για την περιοχή σας.'\n",
    "                  text: (Math.abs(_anomDays) < 5\n"
    "                    ? 'Η εποχή εξελίσσεται κανονικά για την περιοχή σας.'\n",
    "T-ANOM-SINCE-01 κείμενο (αρχή)")
sub("                          : 'νωρίτερα — η χρονιά είναι όψιμη. Τα στάδια θα καθυστερήσουν αντίστοιχα.')) } });\n",
    "                          : 'νωρίτερα — η χρονιά είναι όψιμη. Τα στάδια θα καθυστερήσουν αντίστοιχα.')))\n"
    "                    + _sagAnomSinceTxt(_anomFrom) } });   // T-ANOM-SINCE-01\n",
    "T-ANOM-SINCE-01 κείμενο (τέλος)")

out = s.replace("\n", "\r\n").encode("utf-8")
assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js")
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True)
os.remove(tmp)
if r.returncode:
    print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ — τίποτα δεν γράφτηκε")
io.open(P, "wb").write(out)
chk = io.open(P, "rb").read()
assert chk.count(b"\n") == chk.count(b"\r\n") and chk[:3] != b"\xef\xbb\xbf"
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
