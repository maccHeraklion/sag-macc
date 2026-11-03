# -*- coding: utf-8 -*-
"""T-DEPTH1-02 · φόρμα v27 (3/11/2026, Michalis: «πώς γίνεται η σωστή αντιστοίχιση του ρηχού αισθητήρα και του βαθιού …»).
  Φ1 με «Ένα βάθος» νέο πεδίο «Ποια θύρα του αισθητήρα είναι στο έδαφος» (Θύρα 1 | Θύρα 2) → soil_depth_port 1 | 2
     (σε SE0X/LSE02 ο ρόλος ορίζεται από τη θύρα· LSE01 μίας σόνδας αναγνωρίζεται αυτόματα).
  Φ2 με «Ένα βάθος», αν το βάθος είναι γραμμένο ΜΟΝΟ στο «βαθύ», μεταφέρεται στο ένα πεδίο (28 αγροί LSE01).
  Φ3 προειδοποίηση (όπως όλοι οι έλεγχοι της φόρμας, όχι φραγμός): δύο βάθη με βαθύ ≤ ρηχό.
  Φ4 το σημείωμα «Δύο βάθη» εξηγεί πώς ορίζεται ποιος αισθητήρας είναι ρηχός/βαθύς.
count==1, LF, node --check σε κάθε inline script."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-01" in s and "T-DEPTH1-02" not in s

SUBS = [
  ('        <div class="field" id="deepDepthWrap">\n',
   '        <!-- v27 · T-DEPTH1-02: με ένα βάθος, ποια θύρα του αισθητήρα είναι στο έδαφος -->\n'
   '        <div class="field" id="depthPortWrap" style="display:none">\n'
   '          <label>Ποια θύρα του αισθητήρα είναι στο έδαφος</label>\n'
   '          <select id="soil_depth_port">\n'
   '            <option value="1">Θύρα 1</option>\n'
   '            <option value="2">Θύρα 2</option>\n'
   '          </select>\n'
   '          <div class="muted" style="font-size:.85rem; margin-top:4px">Μόνο για αισθητήρες με δύο θύρες (Dragino SE0X / LSE02). Αισθητήρας μίας σόνδας (LSE01) αναγνωρίζεται αυτόματα.</div>\n'
   '        </div>\n'
   '        <div class="field" id="deepDepthWrap">\n', "Φ1 πεδίο θύρας"),
  ("    const w = $('deepDepthWrap'); if (w) w.style.display = one ? 'none' : '';\n",
   "    const w = $('deepDepthWrap'); if (w) w.style.display = one ? 'none' : '';\n"
   "    const pw = $('depthPortWrap'); if (pw) pw.style.display = one ? '' : 'none';   /* v27 · T-DEPTH1-02 */\n"
   "    const sh = $('sensorShallow_depth_cm'), dp = $('sensor_deep_depth_cm');   /* v27: βάθος γραμμένο μόνο στο «βαθύ» */\n"
   "    if (one && sh && dp && String(sh.value).trim() === '' && String(dp.value).trim() !== '') sh.value = dp.value;\n",
   "Φ1β/Φ2 εμφάνιση + μεταφορά βάθους"),
  ("      : 'Δύο βάθη: η υγρασία ριζοστρώματος σταθμίζεται ανάμεσα στο ρηχό και στο βαθύ ανάλογα με το βάθος της ρίζας.';\n",
   "      : 'Δύο βάθη: η υγρασία ριζοστρώματος σταθμίζεται ανάμεσα στο ρηχό και στο βαθύ ανάλογα με το βάθος της ρίζας. '\n"
   "        + 'Σε αισθητήρα δύο θυρών η θύρα 1 είναι το ρηχό και η 2 το βαθύ· δύο αισθητήρες μίας σόνδας δηλώνονται ρηχός/βαθύς στην προσθήκη συσκευών του αγρού.';\n",
   "Φ4 σημείωμα"),
  ("    soil_depth_count: ($('soil_depth_count') && $('soil_depth_count').value === '1') ? 1 : 2,   /* v26 · T-DEPTH1-01 */\n",
   "    soil_depth_count: ($('soil_depth_count') && $('soil_depth_count').value === '1') ? 1 : 2,   /* v26 · T-DEPTH1-01 */\n"
   "    soil_depth_port: ($('soil_depth_count') && $('soil_depth_count').value === '1' && $('soil_depth_port') && $('soil_depth_port').value === '2') ? 2 : 1,   /* v27 · T-DEPTH1-02 */\n",
   "Φ1γ αποθήκευση"),
  ("        $('soil_depth_count').value = String(conf.soil_depth_count) === '1' ? '1' : '2'; _sagDepthUi();   /* v26 · T-DEPTH1-01 */\n",
   "        $('soil_depth_count').value = String(conf.soil_depth_count) === '1' ? '1' : '2';\n"
   "        $('soil_depth_port').value = String(conf.soil_depth_port) === '2' ? '2' : '1'; _sagDepthUi();   /* v26/v27 · T-DEPTH1-01/02 */\n",
   "Φ1δ φόρτωση"),
  ("        { const _dc = $('soil_depth_count'); if (_dc) _dc.value = '2'; } _sagDepthUi();   /* v26 · T-DEPTH1-01 */\n",
   "        { const _dc = $('soil_depth_count'); if (_dc) _dc.value = '2'; const _dpo = $('soil_depth_port'); if (_dpo) _dpo.value = '1'; } _sagDepthUi();   /* v26/v27 · T-DEPTH1-01/02 */\n",
   "Φ1ε καθαρισμός"),
  ("  /* γύρος 4: μισοσυμπληρωμένη σειρά καλλιέργειας (χωρίς είδος) — ο πυρήνας\n",
   "  /* v27 · T-DEPTH1-02: δύο βάθη → το βαθύ πρέπει να είναι βαθύτερα από το ρηχό (αλλιώς η στάθμιση ριζοστρώματος\n"
   "     αντιστρέφεται). Προειδοποίηση, όπως όλοι οι έλεγχοι εδώ. */\n"
   "  (function(){\n"
   "    if ($('soil_depth_count') && $('soil_depth_count').value === '1') return;\n"
   "    var sh = numOrNull($('sensorShallow_depth_cm').value), dp = numOrNull($('sensor_deep_depth_cm').value);\n"
   "    if (sh !== null && dp !== null && !(dp > sh))\n"
   "      msgs.push('Το <b>βάθος του βαθιού αισθητήρα</b> (' + dp + ' cm) δεν είναι μεγαλύτερο από του <b>ρηχού</b> (' + sh\n"
   "        + ' cm) — ελέγξτε ποιο είναι ποιο· αν ο αγρός έχει μία σόνδα, επιλέξτε «Ένα βάθος».');\n"
   "  })();\n"
   "  /* γύρος 4: μισοσυμπληρωμένη σειρά καλλιέργειας (χωρίς είδος) — ο πυρήνας\n",
   "Φ3 προειδοποίηση βαθών"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

for i, sc in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"node --check script {i}: " + r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
