# -*- coding: utf-8 -*-
"""Φόρμα configuration.html v25 · T-SOILREF-02 — «Αισθητήρας απόφασης εδάφους» (Michalis 29/10: «φόρμα»).
Όταν ο αγρός έχει ≥2 σόνδες στο ίδιο βάθος (λίστα `soil_sensors` από τον πυρήνα v50.165), η φόρμα δείχνει επιλογή:
«Αυτόματα — ο πιο ξηρός» ή μία σόνδα. Αποθηκεύεται ως configuration.soil_ref_device (id συσκευής) — ο πυρήνας
v50.164+ το διαβάζει (T-SOILREF-01). Χωρίς λίστα (ένας αισθητήρας, ή ρηχός+βαθύς χωριστά) το πεδίο ΔΕΝ φαίνεται και η
αποθήκευση ΚΡΑΤΑ την προηγούμενη δήλωση (ποτέ σιωπηλή διαγραφή).
  Φ1 HTML πεδίο (κρυφό) κάτω από τα βάθη αισθητήρων.
  Φ2 βοηθοί _sagSoilRefList / _sagSoilRefRender (μόνο textContent — ονόματα συσκευών δεν μπαίνουν ως HTML).
  Φ3 payload: ορατό → η επιλογή (κενό = αυτόματα = null)· κρυφό → prevConf.soil_ref_device.
  Φ4 υδροδότηση από τη ρύθμιση · Φ5 απόδοση σε κάθε πακέτο δεδομένων (όχι όσο ο χρήστης γράφει) · Φ6 καθάρισμα
     σε αλλαγή αγρού.
LF, count==1, node --check στο <script>, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
F = "custom_html_files/configuration.html"
raw = io.open(F, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
crlf = "\r\n" in s
if crlf: s = s.replace("\r\n", "\n")
print("ΠΡΙΝ φόρμα", hashlib.sha256(raw).hexdigest(), len(raw), "CRLF" if crlf else "LF")
assert "T-SOILREF-02" not in s, "ήδη εφαρμοσμένο"
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

DM = '<div class="muted" id="depthMixNote" style="display:none; font-size:.85rem; padding:8px 10px; border-radius:8px; background:#fff7ed; border:1px solid #fed7aa; color:#8a4b12"></div>\n        </div>\n'
sub(DM, DM +
    '        <!-- v25 · T-SOILREF-02: αισθητήρας απόφασης — φαίνεται ΜΟΝΟ όταν ο αγρός έχει ≥2 σόνδες στο ίδιο βάθος -->\n'
    '        <div class="field" id="soilRefWrap" style="grid-column:1/-1; display:none">\n'
    '          <label>Αισθητήρας απόφασης εδάφους</label>\n'
    '          <select id="soil_ref_device" onchange="this.dataset.touched=\'1\'"><option value="">Αυτόματα — ο πιο ξηρός</option></select>\n'
    '          <div class="muted" style="font-size:.85rem; margin-top:4px" id="soilRefNote">—</div>\n'
    '        </div>\n', "Φ1 HTML")

HELP = r"""/* v25 · T-SOILREF-02: αισθητήρας απόφασης εδάφους. Τη λίστα των σονδών που μετρούν το ΙΔΙΟ βάθος τη γράφει ο
   πυρήνας (μεταβλητή soil_sensors, μόνο όταν αλλάζει). Ο πυρήνας ΔΕΝ βγάζει μέσο όρο σονδών (T-SOILREF-01): χωρίς
   δήλωση αποφασίζει ο πιο ξηρός, ώστε να μη διψάσει κανένα τμήμα. Ονόματα συσκευών μόνο ως textContent. */
function _sagSoilRefList(){
  try{
    const row = state.lastDataMap && state.lastDataMap.soil_sensors;
    const l = (row && row.metadata && Array.isArray(row.metadata.list)) ? row.metadata.list : [];
    return l.filter(function(x){ return x && typeof x.i === 'string' && /^[0-9a-f]{24}$/.test(x.i) && x.n != null && String(x.n) !== ''; });
  }catch(e){ return []; }
}
function _sagSoilRefRender(){
  const wrap = $('soilRefWrap'), sel = $('soil_ref_device'), note = $('soilRefNote');
  if (!wrap || !sel) return;
  const list = _sagSoilRefList();
  if (list.length < 2){ wrap.style.display = 'none'; return; }
  const want = sel.dataset.touched === '1' ? sel.value : String(state.soilRefConf || '');
  sel.innerHTML = '';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Αυτόματα — ο πιο ξηρός'; sel.appendChild(o0);
  list.forEach(function(x){ const o = document.createElement('option'); o.value = x.i; o.textContent = String(x.n); sel.appendChild(o); });
  const has = list.some(function(x){ return x.i === want; });
  sel.value = has ? want : '';
  if (note) note.textContent = (want && !has)
    ? 'Ο αισθητήρας που είχε δηλωθεί δεν μετρά πια σε αυτό το βάθος — ισχύει ο πιο ξηρός. Επιλέξτε ξανά και αποθηκεύστε.'
    : ('Ο αγρός έχει ' + list.length + ' σόνδες στο ίδιο βάθος. Από τον αισθητήρα απόφασης βγαίνουν η συμβουλή άρδευσης '
       + 'και η αλατότητα· οι άλλοι φαίνονται χωριστά στις μετρήσεις. «Αυτόματα» = ο πιο ξηρός, ώστε να μη διψάσει κανένα τμήμα.');
  wrap.style.display = '';
}
function _keepPrev(v, prev){"""
sub("function _keepPrev(v, prev){", HELP, "Φ2 βοηθοί")
sub("    sensorShallow_depth_cm: intOrNull($('sensorShallow_depth_cm').value),\n",
    "    sensorShallow_depth_cm: intOrNull($('sensorShallow_depth_cm').value),\n"
    "    /* v25 · T-SOILREF-02: ορατό πεδίο → η επιλογή (κενό = αυτόματα)· κρυφό → ΚΡΑΤΑ την προηγούμενη δήλωση. */\n"
    "    soil_ref_device: ($('soilRefWrap') && $('soilRefWrap').style.display !== 'none')\n"
    "      ? ($('soil_ref_device').value || null) : (prevConf.soil_ref_device ?? null),\n", "Φ3 payload")
sub("        if (conf.sensorShallow_depth_cm!=null) $('sensorShallow_depth_cm').value = conf.sensorShallow_depth_cm;\n",
    "        if (conf.sensorShallow_depth_cm!=null) $('sensorShallow_depth_cm').value = conf.sensorShallow_depth_cm;\n"
    "        state.soilRefConf = conf.soil_ref_device || ''; _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n", "Φ4 υδροδότηση")
sub("  if (!formLocked) {\n", "  if (!formLocked) {\n  _sagSoilRefRender();   /* v25 · T-SOILREF-02: η λίστα σονδών μπορεί να φτάσει σε οποιοδήποτε πακέτο */\n", "Φ5 απόδοση")
sub("          .forEach(function(id){ const e=$(id); if(e) e.value=''; });\n      }\n",
    "          .forEach(function(id){ const e=$(id); if(e) e.value=''; });\n"
    "        state.soilRefConf = ''; { const _sr = $('soil_ref_device'); if (_sr) _sr.dataset.touched = ''; } _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n"
    "      }\n", "Φ6 αλλαγή αγρού")

out_s = s.replace("\n", "\r\n") if crlf else s
out = out_s.encode("utf-8")
scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)
for i, sc in enumerate(scripts):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"node --check script {i}: " + r.stderr[:400]
print("  OK node --check σε", len(scripts), "script")
io.open(F, "wb").write(out)
print("ΜΕΤΑ φόρμα", hashlib.sha256(out).hexdigest(), len(out))
