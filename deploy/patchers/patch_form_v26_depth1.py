# -*- coding: utf-8 -*-
"""T-DEPTH1-01 · φόρμα v26 (3/11/2026, Michalis: «αυτό θα έπρεπε να επιλέγεται στην παραμετροποίηση»).
  Φ1 νέο πεδίο «Αισθητήρες εδάφους σε»: Δύο βάθη (ρηχό και βαθύ) | Ένα βάθος → soil_depth_count 2 | 1.
  Φ2 με «Ένα βάθος» κρύβεται το βάθος του βαθιού και το ρηχό λέγεται «Βάθος αισθητήρα (cm)». Η τιμή του βαθιού ΔΕΝ
     σβήνεται (αν ξαναγίνει «Δύο βάθη» επιστρέφει) — ο πυρήνας v50.167 την αγνοεί.
  Φ3 αποθήκευση · Φ4 φόρτωση (απόν = Δύο βάθη) · Φ5 καθαρισμός σε αλλαγή αγρού · Φ6 ο έλεγχος άκυρου αριθμού δεν
     παραπονιέται για κρυφό πεδίο.
count==1, LF, node --check σε κάθε inline script."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-01" not in s

SUBS = [
  ('        <div class="field">\n          <label>Βάθος Αισθητήρα (Βαθύ) (cm)</label>\n'
   '          <input id="sensor_deep_depth_cm" type="number" step="1" placeholder="π.χ. 30" />\n        </div>\n'
   '        <div class="field">\n          <label>Βάθος Αισθητήρα (Ρηχό) (cm)</label>\n',
   '        <!-- v26 · T-DEPTH1-01: ένα ή δύο βάθη αισθητήρα εδάφους -->\n'
   '        <div class="field">\n          <label>Αισθητήρες εδάφους σε</label>\n'
   '          <select id="soil_depth_count" onchange="_sagDepthUi()">\n'
   '            <option value="2">Δύο βάθη (ρηχό και βαθύ)</option>\n'
   '            <option value="1">Ένα βάθος</option>\n          </select>\n'
   '          <div class="muted" style="font-size:.85rem; margin-top:4px" id="depthCountNote">Πόσα βάθη μετρά ο αισθητήρας εδάφους του αγρού.</div>\n'
   '        </div>\n'
   '        <div class="field" id="deepDepthWrap">\n          <label>Βάθος Αισθητήρα (Βαθύ) (cm)</label>\n'
   '          <input id="sensor_deep_depth_cm" type="number" step="1" placeholder="π.χ. 30" />\n        </div>\n'
   '        <div class="field">\n          <label id="shallowDepthLabel">Βάθος Αισθητήρα (Ρηχό) (cm)</label>\n', "Φ1 πεδίο"),
  ("function _keepPrev(v, prev){",
   "/* v26 · T-DEPTH1-01: «Ένα βάθος» κρύβει το βαθύ (η τιμή του ΜΕΝΕΙ — ο πυρήνας v50.167 την αγνοεί). */\n"
   "function _sagDepthUi(){\n"
   "  try{\n"
   "    const sel = $('soil_depth_count'); if (!sel) return;\n"
   "    const one = sel.value === '1';\n"
   "    const w = $('deepDepthWrap'); if (w) w.style.display = one ? 'none' : '';\n"
   "    const l = $('shallowDepthLabel'); if (l) l.textContent = one ? 'Βάθος αισθητήρα (cm)' : 'Βάθος Αισθητήρα (Ρηχό) (cm)';\n"
   "    const n = $('depthCountNote');\n"
   "    if (n) n.textContent = one\n"
   "      ? 'Ένα βάθος: η άρδευση, η αλατότητα και ο έλεγχος οργάνων χρησιμοποιούν μόνο αυτό· το δεύτερο κανάλι του αισθητήρα (αν υπάρχει) αγνοείται και δεν βγάζει ψευδείς βλάβες.'\n"
   "      : 'Δύο βάθη: η υγρασία ριζοστρώματος σταθμίζεται ανάμεσα στο ρηχό και στο βαθύ ανάλογα με το βάθος της ρίζας.';\n"
   "  }catch(e){}\n"
   "}\n"
   "function _keepPrev(v, prev){", "Φ2 εμφάνιση"),
  ("    sensor_deep_depth_cm: intOrNull($('sensor_deep_depth_cm').value),\n",
   "    sensor_deep_depth_cm: intOrNull($('sensor_deep_depth_cm').value),\n"
   "    soil_depth_count: ($('soil_depth_count') && $('soil_depth_count').value === '1') ? 1 : 2,   /* v26 · T-DEPTH1-01 */\n", "Φ3 αποθήκευση"),
  ("        if (conf.sensorShallow_depth_cm!=null) $('sensorShallow_depth_cm').value = conf.sensorShallow_depth_cm;\n"
   "        state.soilRefConf = conf.soil_ref_device || ''; _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n",
   "        if (conf.sensorShallow_depth_cm!=null) $('sensorShallow_depth_cm').value = conf.sensorShallow_depth_cm;\n"
   "        $('soil_depth_count').value = String(conf.soil_depth_count) === '1' ? '1' : '2'; _sagDepthUi();   /* v26 · T-DEPTH1-01 */\n"
   "        state.soilRefConf = conf.soil_ref_device || ''; _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n", "Φ4 φόρτωση"),
  ("        state.soilRefConf = ''; { const _sr = $('soil_ref_device'); if (_sr) _sr.dataset.touched = ''; } _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n",
   "        state.soilRefConf = ''; { const _sr = $('soil_ref_device'); if (_sr) _sr.dataset.touched = ''; } _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n"
   "        { const _dc = $('soil_depth_count'); if (_dc) _dc.value = '2'; } _sagDepthUi();   /* v26 · T-DEPTH1-01 */\n", "Φ5 καθαρισμός"),
  ("   ['sensor_deep_depth_cm','βάθος βαθιού αισθητήρα'],['sensorShallow_depth_cm','βάθος ρηχού αισθητήρα'],\n",
   "   ['sensor_deep_depth_cm','βάθος βαθιού αισθητήρα'],['sensorShallow_depth_cm','βάθος αισθητήρα'],\n", "Φ6α ετικέτα σφάλματος"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

# Φ6β: το άκυρο κείμενο σε ΚΡΥΦΟ πεδίο βαθιού δεν μπλοκάρει την αποθήκευση — βρίσκουμε το σώμα του forEach.
m = re.search(r"\['fert_ecw_dsm','EC μείγματος λίπανσης'\]\]\n  \.forEach\(function\(pair\)\{\n", s)
assert m, "Φ6β: δεν βρέθηκε το forEach ελέγχου"
s = s[:m.end()] + "    if (pair[0] === 'sensor_deep_depth_cm' && $('soil_depth_count') && $('soil_depth_count').value === '1') return;   /* v26 · T-DEPTH1-01 */\n" + s[m.end():]
print("  OK Φ6β κρυφό βαθύ εκτός ελέγχου")

for i, sc in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"node --check script {i}: " + r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
