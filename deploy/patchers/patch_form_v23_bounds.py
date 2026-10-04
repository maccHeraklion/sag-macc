# -*- coding: utf-8 -*-
"""Φόρμα v23 · T-FORM-BOUNDS-01 (έλεγχος πληρότητας 4/10, B-16· εντολή Μιχάλη «ναι στα δύο του B-16»).
Πριν: (α) απόδοση δικτύου: η φόρμα δεχόταν 10-100 % και ΣΙΩΠΗΛΑ έκοβε στο 10 %, ενώ ο πυρήνας δέχεται μόνο
0,30-1,00 και κάτω από αυτό παίρνει την τυπική απόδοση του προφίλ — ο παραγωγός δεν το μάθαινε ποτέ.
(β) ECw νερού/λίπανσης: ο πυρήνας δέχεται 0,05-15 dS/m· η φόρμα έπιανε μόνο το 50-15.000 (μS/cm). Τιμές
κάτω από 0,05 ή 15-50 περνούσαν χωρίς λέξη και ο πυρήνας τις αγνοούσε.
Νέο: απόδοση < 30 % → υπόδειξη «ελέγξτε το δίκτυο» + γραμμή στο παράθυρο επιβεβαίωσης, ΔΕΝ αποθηκεύεται (κενό →
τυπική απόδοση του συστήματος, ό,τι ήδη έκανε ο πυρήνας). ECw < 0,05 και 15-50 → υπόδειξη χωρίς κουμπί
(δεν υπάρχει ασφαλής διόρθωση να προταθεί). Τα όρια είναι ΤΑ ΙΔΙΑ με του πυρήνα· καμία αγρονομική σταθερά δεν αλλάζει.
LF, count==1, όλα-ή-τίποτα· ο έλεγχος σύνταξης γίνεται στον ελεγκτή (εξαγωγή του <script>)."""
import io, sys, hashlib
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
assert "T-FORM-BOUNDS-01" not in s, "ήδη εφαρμοσμένο"
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

# 1 · το πεδίο: ελάχιστο 30
sub('<input id="irrig_efficiency_pct" type="number" step="1" min="10" max="100" placeholder="π.χ. 90" />',
    '<input id="irrig_efficiency_pct" type="number" step="1" min="30" max="100" placeholder="π.χ. 90" />',
    "πεδίο απόδοσης min=30")

# 2 · αποθήκευση: < 30 → κενό (όχι σιωπηλό κόψιμο στο 10 %)
sub("    irrig_efficiency_measured: (function(){ const v = numOrNull($('irrig_efficiency_pct').value);\n"
    "                                            return v === null ? null : Math.min(1, Math.max(0.1, v/100)); })(),\n",
    "    irrig_efficiency_measured: (function(){ const v = numOrNull($('irrig_efficiency_pct').value);   /* v23 · T-FORM-BOUNDS-01: < 30 % → κενό */\n"
    "                                            return (v === null || v < 30) ? null : Math.min(1, v/100); })(),\n",
    "αποθήκευση απόδοσης")

# 3 · νέοι κανόνες (χωρίς κουμπί διόρθωσης: fix null)
sub("    test: function(v){ return v > 12 && v <= 1200; }, fix: function(v){ return v / 100; },\n"
    "    cons: 'Αλλιώς το σύστημα δεν θα δείχνει διάρκεια ποτίσματος.' }\n"
    "];\n",
    "    test: function(v){ return v > 12 && v <= 1200; }, fix: function(v){ return v / 100; },\n"
    "    cons: 'Αλλιώς το σύστημα δεν θα δείχνει διάρκεια ποτίσματος.' },\n"
    "  /* v23 · T-FORM-BOUNDS-01 (B-16): τα όρια του πυρήνα, χωρίς κουμπί — δεν υπάρχει ασφαλής διόρθωση να προταθεί. */\n"
    "  { id: 'irrig_efficiency_pct', key: 'low', label: 'απόδοση δικτύου', fix: null,\n"
    "    why: 'είναι κάτω από 30 % — <b>ελέγξτε το δίκτυο</b> (διαρροές, βουλωμένοι σταλάκτες, πίεση): χρειάζεται επισκευή',\n"
    "    test: function(v){ return v < 30; },\n"
    "    cons: 'Η τιμή δεν θα αποθηκευτεί· η δόση θα υπολογίζεται με την τυπική απόδοση του συστήματος άρδευσης.' },\n"
    "  { id: 'water_ecw_dsm', key: 'low', label: 'EC νερού άρδευσης', fix: null,\n"
    "    why: 'είναι κάτω από το κατώτατο 0,05 dS/m — ελέγξτε τη μέτρηση και τη μονάδα',\n"
    "    test: function(v){ return v < 0.05; },\n"
    "    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει την τυπική τιμή της κλάσης νερού.' },\n"
    "  { id: 'water_ecw_dsm', key: 'mid', label: 'EC νερού άρδευσης', fix: null,\n"
    "    why: 'δεν ταιριάζει ούτε σε dS/m (έως 15) ούτε σε μS/cm (από 50) — ελέγξτε τη μονάδα και τη μέτρηση',\n"
    "    test: function(v){ return v > 15 && v < 50; },\n"
    "    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση και θα χρησιμοποιήσει την τυπική τιμή της κλάσης νερού.' },\n"
    "  { id: 'fert_ecw_dsm', key: 'low', label: 'EC μείγματος λίπανσης', fix: null,\n"
    "    why: 'είναι κάτω από το κατώτατο 0,05 dS/m — ελέγξτε τη μέτρηση και τη μονάδα',\n"
    "    test: function(v){ return v < 0.05; },\n"
    "    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση.' },\n"
    "  { id: 'fert_ecw_dsm', key: 'mid', label: 'EC μείγματος λίπανσης', fix: null,\n"
    "    why: 'δεν ταιριάζει ούτε σε dS/m (έως 15) ούτε σε μS/cm (από 50) — ελέγξτε τη μονάδα και τη μέτρηση',\n"
    "    test: function(v){ return v > 15 && v < 50; },\n"
    "    cons: 'Αλλιώς το σύστημα θα αγνοήσει τη μέτρηση.' }\n"
    "];\n",
    "νέοι κανόνες")

# 4 · έλεγχος: fix null → χωρίς πρόταση
sub("  return { v: v, s: rule.fix(v) };\n",
    "  return { v: v, s: rule.fix ? rule.fix(v) : null };\n",
    "check με fix null")

# 5 · υπόδειξη: ξεχωριστό κουτί ανά κανόνα, χωρίς κουμπί όταν fix null
sub("  var box = document.getElementById(rule.id + '__unit');\n",
    "  var bid = rule.id + '__' + (rule.key || 'unit');\n"
    "  var box = document.getElementById(bid);\n",
    "id κουτιού ανά κανόνα")
sub("    box = document.createElement('div'); box.id = rule.id + '__unit'; box.className = 'unitHint';\n",
    "    box = document.createElement('div'); box.id = bid; box.className = 'unitHint';\n",
    "δημιουργία κουτιού")
sub("  var t = document.createElement('span');\n"
    "  t.innerHTML = 'Η τιμή <b>' + _sagFmtNum(r.v) + '</b> ' + rule.why + ' — εννοείτε <b>' + _sagFmtNum(r.s) + ' ' + rule.unit + '</b>; ';\n",
    "  var t = document.createElement('span');\n"
    "  if (!rule.fix){ t.innerHTML = 'Η τιμή <b>' + _sagFmtNum(r.v) + '</b> ' + rule.why + '. ' + rule.cons; box.appendChild(t); return; }\n"
    "  t.innerHTML = 'Η τιμή <b>' + _sagFmtNum(r.v) + '</b> ' + rule.why + ' — εννοείτε <b>' + _sagFmtNum(r.s) + ' ' + rule.unit + '</b>; ';\n",
    "υπόδειξη χωρίς κουμπί")

# 6 · παράθυρο επιβεβαίωσης
sub("    if (r) out.push('Το πεδίο <b>' + rule.label + '</b> έχει <b>' + _sagFmtNum(r.v) + '</b> — ' + rule.why\n",
    "    if (r && !rule.fix) out.push('Το πεδίο <b>' + rule.label + '</b> έχει <b>' + _sagFmtNum(r.v) + '</b> — ' + rule.why + '. ' + rule.cons);\n"
    "    else if (r) out.push('Το πεδίο <b>' + rule.label + '</b> έχει <b>' + _sagFmtNum(r.v) + '</b> — ' + rule.why\n",
    "γραμμή επιβεβαίωσης")

out = s.encode("utf-8"); assert b"\r\n" not in out
io.open(P, "wb").write(out)
print("ΜΕΤΑ sha256", hashlib.sha256(out).hexdigest()[:16], "bytes", len(out))
