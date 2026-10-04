# -*- coding: utf-8 -*-
"""Φόρμα v21 · T-FORM-UNITGUARD-01 (έλεγχος μετεωρολογικών §14, εντολή Μιχάλη «πρόσθεσε τον έλεγχο στη φόρμα»).
Μετρημένο 4/10: ECw 3220 / 400 (μS/cm αντί dS/m) σε Κουκιά, Βενζινάδικο, Καμπιτάκη BIO· απόσταση σταλακτήρων
20 / 50 (εκατοστά αντί μέτρα) σε Κουκιά, Βενζινάδικο, Μεγάλη Ντάμα, Καμπιτάκη BIO. Ο πυρήνας ήδη αγνοεί/αρνείται
αυτές τις τιμές· η φόρμα δεν τις έπιανε τη στιγμή που γράφονταν.
Νέο: (α) επιτόπια υπόδειξη κάτω από το πεδίο, μόλις γραφτεί ή φορτωθεί η τιμή, με κουμπί «Χρήση X»·
(β) η ίδια προειδοποίηση στο παράθυρο επιβεβαίωσης πριν την αποθήκευση. ΚΑΜΙΑ σιωπηλή μετατροπή — ο χρήστης
αποφασίζει. Όρια: ECw 50-15.000 (÷1000 → 0,05-15 dS/m, το εύρος του πυρήνα), απόσταση > 12 m (το ίδιο με τον πυρήνα).
LF, count==1, όλα-ή-τίποτα· ο έλεγχος σύνταξης γίνεται στον ελεγκτή (εξαγωγή του <script>)."""
import io, sys, hashlib
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

# 1 · οι κανόνες και οι βοηθοί, αμέσως μετά το numOrNull
sub("function numOrNull(v){ const t=_clean(v); if(t==='') return null; const n=parseFloat(t); return Number.isFinite(n)?n:null; }\n",
    "function numOrNull(v){ const t=_clean(v); if(t==='') return null; const n=parseFloat(t); return Number.isFinite(n)?n:null; }\n"
    "/* v21 · 4/10/2026 · T-FORM-UNITGUARD-01: λάθος ΜΟΝΑΔΑ τη στιγμή που γράφεται. Μετρημένο 4/10 σε 4 αγρούς: ECw 3220\n"
    "   και 400 (μS/cm αντί dS/m), απόσταση σταλακτήρων 20 και 50 (εκατοστά αντί μέτρα). Ο πυρήνας τις αγνοεί (ECw εκτός\n"
    "   0,05-15) ή δεν βγάζει διάρκεια (απόσταση > 12 m) — σωστά, αλλά ο παραγωγός το μάθαινε μόνο από την κάρτα.\n"
    "   Εδώ: υπόδειξη κάτω από το πεδίο με κουμπί «Χρήση X» + γραμμή στο παράθυρο επιβεβαίωσης. ΠΟΤΕ σιωπηλή μετατροπή.\n"
    "   Τα όρια είναι ΤΑ ΙΔΙΑ με του πυρήνα (T-MEASURED-WATER-01, T-IRR-RATE-SANITY-01). */\n"
    "var _SAG_UNIT_RULES = [\n"
    "  { id: 'water_ecw_dsm', label: 'EC νερού άρδευσης', unit: 'dS/m', why: 'μοιάζει με μS/cm',\n"
    "    test: function(v){ return v >= 50 && v <= 15000; }, fix: function(v){ return v / 1000; },\n"
    "    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει την τυπική τιμή της κλάσης νερού.' },\n"
    "  { id: 'fert_ecw_dsm', label: 'EC μείγματος λίπανσης', unit: 'dS/m', why: 'μοιάζει με μS/cm',\n"
    "    test: function(v){ return v >= 50 && v <= 15000; }, fix: function(v){ return v / 1000; },\n"
    "    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση.' },\n"
    "  { id: 'irrig_emitter_spacing_m', label: 'απόσταση σταλακτήρων', unit: 'm', why: 'μοιάζει με εκατοστά',\n"
    "    test: function(v){ return v > 12 && v <= 1200; }, fix: function(v){ return v / 100; },\n"
    "    cons: 'Αλλιώς το σύστημα δεν θα δείχνει διάρκεια ποτίσματος.' },\n"
    "  { id: 'irrig_row_spacing_m', label: 'απόσταση γραμμών', unit: 'm', why: 'μοιάζει με εκατοστά',\n"
    "    test: function(v){ return v > 12 && v <= 1200; }, fix: function(v){ return v / 100; },\n"
    "    cons: 'Αλλιώς το σύστημα δεν θα δείχνει διάρκεια ποτίσματος.' }\n"
    "];\n"
    "function _sagFmtNum(x){ return Number(x).toLocaleString('el-GR', { maximumFractionDigits: 3, useGrouping: false }); }\n"
    "function _sagUnitCheck(rule){\n"
    "  var e = $(rule.id); if (!e) return null;\n"
    "  var v = numOrNull(e.value);\n"
    "  if (v === null || !rule.test(v)) return null;\n"
    "  return { v: v, s: rule.fix(v) };\n"
    "}\n"
    "function _sagUnitGuard(rule){\n"
    "  var e = $(rule.id); if (!e) return;\n"
    "  var box = document.getElementById(rule.id + '__unit');\n"
    "  var r = _sagUnitCheck(rule);\n"
    "  if (!r){ if (box) box.remove(); return; }\n"
    "  if (!box){\n"
    "    box = document.createElement('div'); box.id = rule.id + '__unit'; box.className = 'unitHint';\n"
    "    box.style.cssText = 'margin-top:6px; padding:6px 8px; border-radius:8px; background:#fff4e5; border:1px solid #f0b75a; color:#7a4b00; font-size:.85rem';\n"
    "    e.insertAdjacentElement('afterend', box);\n"
    "  }\n"
    "  box.innerHTML = '';\n"
    "  var t = document.createElement('span');\n"
    "  t.innerHTML = 'Η τιμή <b>' + _sagFmtNum(r.v) + '</b> ' + rule.why + ' — εννοείτε <b>' + _sagFmtNum(r.s) + ' ' + rule.unit + '</b>; ';\n"
    "  var b = document.createElement('button'); b.type = 'button'; b.className = 'btn';\n"
    "  b.style.cssText = 'margin-left:6px; padding:2px 8px; font-size:.85rem';\n"
    "  b.textContent = 'Χρήση ' + _sagFmtNum(r.s);\n"
    "  b.onclick = function(){\n"
    "    e.value = _sagFmtNum(r.s);\n"
    "    e.dispatchEvent(new Event('input', { bubbles: true }));\n"
    "    e.dispatchEvent(new Event('change', { bubbles: true }));\n"
    "    _sagUnitGuard(rule);\n"
    "  };\n"
    "  box.appendChild(t); box.appendChild(b);\n"
    "}\n"
    "function _sagUnitGuardAll(){ _SAG_UNIT_RULES.forEach(_sagUnitGuard); }\n"
    "function _sagUnitMsgs(){\n"
    "  var out = [];\n"
    "  _SAG_UNIT_RULES.forEach(function(rule){\n"
    "    var r = _sagUnitCheck(rule);\n"
    "    if (r) out.push('Το πεδίο <b>' + rule.label + '</b> έχει <b>' + _sagFmtNum(r.v) + '</b> — ' + rule.why\n"
    "      + '. Αν εννοείτε <b>' + _sagFmtNum(r.s) + ' ' + rule.unit + '</b>, πατήστε «Χρήση» κάτω από το πεδίο. ' + rule.cons);\n"
    "  });\n"
    "  return out;\n"
    "}\n"
    "_SAG_UNIT_RULES.forEach(function(rule){\n"
    "  var e = $(rule.id);\n"
    "  if (e){ e.addEventListener('input', function(){ _sagUnitGuard(rule); }); e.addEventListener('change', function(){ _sagUnitGuard(rule); }); }\n"
    "});\n",
    "κανόνες + βοηθοί μονάδας")

# 2 · παράθυρο επιβεβαίωσης
sub("  var w = $('confirmAreaWarn');\n",
    "  _sagUnitMsgs().forEach(function(m){ msgs.push(m); });   /* v21 · T-FORM-UNITGUARD-01 */\n"
    "  var w = $('confirmAreaWarn');\n",
    "προειδοποίηση στο παράθυρο επιβεβαίωσης")

# 3 · υπόδειξη και για τιμές που ΦΟΡΤΩΘΗΚΑΝ (οι 4 αγροί τη βλέπουν μόλις ανοίξουν τη φόρμα)
sub("      if (conf && typeof conf === 'object' && !Array.isArray(conf)) state.hydrated = true;\n",
    "      if (conf && typeof conf === 'object' && !Array.isArray(conf)){ state.hydrated = true; setTimeout(_sagUnitGuardAll, 0); }   /* v21 · T-FORM-UNITGUARD-01 */\n",
    "υπόδειξη μετά τη φόρτωση (configuration)")
sub("        && (latest.cultivation_type || state.lastDataMap.cultivation_type)) state.hydrated = true;\n",
    "        && (latest.cultivation_type || state.lastDataMap.cultivation_type)){ state.hydrated = true; setTimeout(_sagUnitGuardAll, 0); }   /* v21 · T-FORM-UNITGUARD-01 */\n",
    "υπόδειξη μετά τη φόρτωση (παλαιά διαδρομή)")

out = s.encode("utf-8"); assert b"\r\n" not in out
io.open(P, "wb").write(out)
print("ΜΕΤΑ sha256", hashlib.sha256(out).hexdigest(), "bytes", len(out))
