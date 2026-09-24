# -*- coding: utf-8 -*-
"""Φόρμα configuration.html v20 · T-METER-FORM-01 (§8.6 απογραφής, εντολή Μιχάλη 24/9).
Νέο πεδίο «Υδρόμετρο συνδεδεμένο στον ελεγκτή» (has_water_meter, προεπιλογή ΟΧΙ). Αποθηκεύεται στο
configuration· το widget κρύβει τις κάρτες «Μετρητής νερού» και ξαναβαφτίζει τους παλμούς όταν λείπει.
Ο πυρήνας ΔΕΝ διαβάζει το κλειδί (δεν χρησιμοποιεί ποτέ το valve_*_pulse). LF, count==1, όλα-ή-τίποτα."""
import io, sys, hashlib
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
assert "has_water_meter" not in s
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

# 1. το πεδίο, αμέσως μετά την «Καλυμμένη καλλιέργεια»
sub('          <div class="muted" style="font-size:.85rem; margin-top:4px">Σε καλυμμένη: η βροχή του σταθμού αγνοείται και το όριο θερμοκρασίας αέρα φτάνει 65 °C</div>\n'
    '        </div>\n',
    '          <div class="muted" style="font-size:.85rem; margin-top:4px">Σε καλυμμένη: η βροχή του σταθμού αγνοείται και το όριο θερμοκρασίας αέρα φτάνει 65 °C</div>\n'
    '        </div>\n'
    '        <!-- v20 · 24/9/2026 · T-METER-FORM-01: ο ελεγκτής Milesight μετρά ΠΑΛΜΟΥΣ· χωρίς υδρόμετρο ο\n'
    '             καταχωρητής δεν είναι νερό. Το widget δείχνει «Μετρητής νερού» μόνο αν δηλωθεί ΝΑΙ. -->\n'
    '        <div class="field">\n'
    '          <label>Υδρόμετρο συνδεδεμένο στον ελεγκτή</label>\n'
    '          <select id="has_water_meter">\n'
    '            <option value="false">Όχι — χωρίς υδρόμετρο</option>\n'
    '            <option value="true">Ναι — υδρόμετρο παλμών στην είσοδο του ελεγκτή</option>\n'
    '          </select>\n'
    '          <div class="muted" style="font-size:.85rem; margin-top:4px">Χωρίς υδρόμετρο ο ελεγκτής μετρά μόνο παλμούς — δεν είναι κυβικά νερού. Το ταμπλό κρύβει τον «Μετρητή νερού» όσο είναι «Όχι».</div>\n'
    '        </div>\n',
    "T-METER-FORM-01 πεδίο")
# 2. παρακολούθηση αλλαγών
sub("'irrig_fw_pct','irrigation_system','soil_type','water_quality','covered_cultivation',\n",
    "'irrig_fw_pct','irrigation_system','soil_type','water_quality','covered_cultivation','has_water_meter',\n",
    "T-METER-FORM-01 λίστα αλλαγών")
# 3. συλλογή
sub("    covered_cultivation: $('covered_cultivation').value === 'true',\n",
    "    covered_cultivation: $('covered_cultivation').value === 'true',\n"
    "    has_water_meter: $('has_water_meter').value === 'true',   /* v20 · T-METER-FORM-01 */\n",
    "T-METER-FORM-01 συλλογή")
# 4. φόρτωση
sub("        if (conf.covered_cultivation!=null) $('covered_cultivation').value = String(conf.covered_cultivation) === 'true' ? 'true' : 'false';\n",
    "        if (conf.covered_cultivation!=null) $('covered_cultivation').value = String(conf.covered_cultivation) === 'true' ? 'true' : 'false';\n"
    "        $('has_water_meter').value = String(conf.has_water_meter) === 'true' ? 'true' : 'false';   /* v20 · T-METER-FORM-01: κενό = Όχι */\n",
    "T-METER-FORM-01 φόρτωση")

out = s.encode("utf-8"); io.open(P, "wb").write(out)
chk = io.open(P, "rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk))
