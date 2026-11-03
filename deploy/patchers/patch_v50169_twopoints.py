# -*- coding: utf-8 -*-
"""T-DEPTH1-03 · πυρήνας v50.169 (3/11/2026, Michalis: «υπάρχει και η περίπτωση να μπουν … οι 2 διαφορετικοί αισθητήρες
εδάφους στο ίδιο βάθος σε 2 διαφορετικά χωρικά σημεία … 2 ανεξάρτητα σημεία με αυτόνομες μετρήσεις» → «πάμε με α»:
η σύσταση του αγρού από τον ΜΕΣΟ ΟΡΟ, κάθε σημείο ορατό χωριστά).

soil_depth_port = 3 («Και οι δύο θύρες — δύο σημεία στο ίδιο βάθος») μαζί με soil_depth_count = 1:
  Σ1 η θύρα 2 μιας συσκευής δύο θυρών γίνεται ΔΕΥΤΕΡΟ ΣΗΜΕΙΟ: εικονική συσκευή «<όνομα> · θύρα 2» (id «<id>:2») με τα
     κλειδιά της στο κανάλι 1. Περνά από την ΙΔΙΑ πύλη/συγχώνευση με κάθε άλλη συσκευή → ο υπάρχων κυλιόμενος μέσος όρος,
     η προειδοποίηση διαφωνίας (≥ 8 μονάδες υγρασίας / 2,5× αγωγιμότητα) και η επιλογή αισθητήρα απόφασης (T-SOILREF)
     ισχύουν αυτούσια. Κανένα «βαθύ», καμία στάθμιση ρηχού-βαθέος.
  Σ2 η μάσκα δεν κόβει τίποτα (η θύρα 2 έγινε ήδη σημείο)· η ημερήσια διάγνωση, τα στατιστικά «κολλημένου» και οι μέσοι
     24ώρου διαβάζουν ΚΑΙ τις δύο θύρες (ο μέσος της θύρας 2 πηγαίνει στο σημείο 2).
  Σ3 κείμενο: «… ένα βάθος αισθητήρα εδάφους σε δύο σημεία (μέσος όρος)».
Πολλοί αισθητήρες μίας σόνδας (LSE01) στο ίδιο βάθος: ΗΔΗ μέσος όρος — αμετάβλητο. Χωρίς θύρα 3: ΤΑΥΤΟΣΗΜΑ με v50.168.
Καμία αγρονομική σταθερά δεν αλλάζει. count==1 (εκτός όπου δηλώνεται), CRLF, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-02" in s and "T-DEPTH1-03" not in s

SUBS = [
  ("const SAG_KERNEL_VERSION = 'v50.168 · 2026-11-03';   // T-DEPTH1-02 (θύρα σόνδας με ένα βάθος) ·",
   "const SAG_KERNEL_VERSION = 'v50.169 · 2026-11-03';   // T-DEPTH1-03 (δύο σημεία στο ίδιο βάθος) · T-DEPTH1-02 (θύρα σόνδας με ένα βάθος) ·",
   "Ε έκδοση"),
  ("function _sagDepth1PortOf(cfg) { return Number(cfg && cfg.soil_depth_port) === 2 ? 2 : 1; }\n",
   "// T-DEPTH1-03: 3 = «Και οι δύο θύρες» — δύο σημεία στο ίδιο βάθος (μέσος όρος, κάθε σημείο ορατό χωριστά).\n"
   "function _sagDepth1PortOf(cfg) { const v = Number(cfg && cfg.soil_depth_port); return (v === 2 || v === 3) ? v : 1; }\n"
   "// T-DEPTH1-03: η θύρα 2 γίνεται ΔΕΥΤΕΡΟ ΣΗΜΕΙΟ (εικονική συσκευή) με τα κλειδιά της στο κανάλι 1· επιστρέφει τα δεδομένα\n"
   "// του σημείου 2 (και τα αφαιρεί από τη συσκευή) ή null. Μέσος όρος / διαφωνία / αισθητήρας απόφασης: οι υπάρχοντες μηχανισμοί.\n"
   "function _sagSplitPoints(deviceData) {\n"
   "  if (!_SAG_DEPTH1_ACTIVE || _SAG_DEPTH1_PORT !== 3 || !deviceData || typeof deviceData !== 'object') return null;\n"
   "  const ks = Object.keys(deviceData);\n"
   "  if (!ks.some(k => _SAG_D1_M2_RE.test(k)) || !ks.some(k => _SAG_D1_CH1_RE.test(k))) return null;\n"
   "  const p2 = {};\n"
   "  for (const k of ks) {\n"
   "    if (!_SAG_D1_CH2_RE.test(k)) continue;\n"
   "    const nk = k.replace(/2((?:_avg|_max|_min|_sum)?)$/, '1$1');\n"
   "    const v = deviceData[k];\n"
   "    p2[nk] = Array.isArray(v) ? v.map(x => (x && typeof x === 'object' && x.variable) ? Object.assign({}, x, { variable: nk }) : x) : v;\n"
   "    delete deviceData[k];\n"
   "  }\n"
   "  return p2;\n"
   "}\n",
   "Σ1 θύρα 3 + διαχωρισμός σημείων"),
  ("  if (!_SAG_DEPTH1_ACTIVE || !deviceData || typeof deviceData !== 'object') return 0;\n  const ks = Object.keys(deviceData);\n  const p2 = ",
   "  if (!_SAG_DEPTH1_ACTIVE || !deviceData || typeof deviceData !== 'object') return 0;\n"
   "  if (_SAG_DEPTH1_PORT === 3) return 0;   // T-DEPTH1-03: η θύρα 2 έγινε ήδη δεύτερο σημείο\n"
   "  const ks = Object.keys(deviceData);\n  const p2 = ",
   "Σ2α μάσκα"),
  ("  if (!_SAG_DEPTH1_ACTIVE || !dev || (dev.t !== 'se0x' && dev.t !== 'lse02')) return st;\n",
   "  if (!_SAG_DEPTH1_ACTIVE || _SAG_DEPTH1_PORT === 3 || !dev || (dev.t !== 'se0x' && dev.t !== 'lse02')) return st;   // T-DEPTH1-03: και οι δύο θύρες\n",
   "Σ2β στατιστικά"),
  ("    const _diagVars = typeName ? ((_SAG_DEPTH1_ACTIVE && (typeName === 'se0x' || typeName === 'lse02'))",
   "    const _diagVars = typeName ? ((_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 3 && (typeName === 'se0x' || typeName === 'lse02'))",
   "Σ2γ διάγνωση"),
  ("      const _SOIL_AVG_CH = _SAG_DEPTH1_ACTIVE ? (_SAG_DEPTH1_PORT === 2 ?",
   "      const _SOIL_AVG_CH = (_SAG_DEPTH1_ACTIVE && _SAG_DEPTH1_PORT !== 3) ? (_SAG_DEPTH1_PORT === 2 ?",
   "Σ2δ μέσοι 24ώρου"),
  ("  const d = (_d1p === 1 && _s0) ? null : _dd0;\n",
   "  const d = ((_d1p === 1 || _d1p === 3) && _s0) ? null : _dd0;   // T-DEPTH1-03: δύο σημεία = κανένα βαθύ\n",
   "Σ2ε ριζόστρωμα"),
  ("            ? ('Ο αγρός έχει δηλωμένο ένα βάθος αισθητήρα εδάφους' + (_SAG_DEPTH1_PORT === 2 ? ' (θύρα 2 του αισθητήρα)' : '')\n",
   "            ? ('Ο αγρός έχει δηλωμένο ένα βάθος αισθητήρα εδάφους' + (_SAG_DEPTH1_PORT === 2 ? ' (θύρα 2 του αισθητήρα)'\n"
   "              : (_SAG_DEPTH1_PORT === 3 ? ' σε δύο σημεία (μέσος όρος)' : ''))   // T-DEPTH1-03\n",
   "Σ3 κείμενο"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new); print("  OK", label)

# Σ1β: ΟΛΑ τα σημεία «έλεγχος + συγχώνευση» συσκευής (ακριβώς 4) περνούν από τον διαχωρισμό σημείων.
pat = re.compile(r"(?P<i>[ ]+)_devRejects\.push\(\.\.\._sagScreenDevice\(deviceData, info\?\.name \|\| value, fieldName\)\);\n"
                 r"(?P=i)data = _sagMergeDeviceData\(data, deviceData, info\?\.name \|\| value, fieldName, value\);\n")
found = pat.findall(s); assert len(found) == 4, f"Σ1β: βρέθηκαν {len(found)} σημεία (αναμένονταν 4)"
n = [0]
def rep(m):
    n[0] += 1; i = m.group("i"); v = "_pt2" + "abcd"[n[0] - 1]
    return (i + "const " + v + " = _sagSplitPoints(deviceData);   // T-DEPTH1-03: θύρα 2 = δεύτερο σημείο στο ίδιο βάθος\n"
            + m.group(0)
            + i + "if (" + v + ") {\n"
            + i + "  _devRejects.push(..._sagScreenDevice(" + v + ", (info?.name || value) + ' · θύρα 2', fieldName));\n"
            + i + "  data = _sagMergeDeviceData(data, " + v + ", (info?.name || value) + ' · θύρα 2', fieldName, String(value) + ':2');\n"
            + i + "}\n")
s = pat.sub(rep, s); print("  OK Σ1β 4 σημεία συγχώνευσης")

fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
