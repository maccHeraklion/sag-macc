# -*- coding: utf-8 -*-
"""T-DEPTH1-03 · φόρμα v28 (3/11/2026, Michalis: «πάμε με α» — δύο σημεία στο ίδιο βάθος, μέσος όρος).
  Φ1 τρίτη επιλογή θύρας: «Και οι δύο — δύο σημεία στο ίδιο βάθος (μέσος όρος)» → soil_depth_port 3.
  Φ2 αποθήκευση/φόρτωση 1 | 2 | 3 · σημείωμα: πολλοί αισθητήρες μίας σόνδας στο ίδιο βάθος = ήδη μέσος όρος.
count==1, LF, node --check σε κάθε inline script."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-02" in s and "T-DEPTH1-03" not in s
SUBS = [
  ('            <option value="2">Θύρα 2</option>\n          </select>\n',
   '            <option value="2">Θύρα 2</option>\n'
   '            <option value="3">Και οι δύο — δύο σημεία στο ίδιο βάθος (μέσος όρος)</option>   <!-- v28 · T-DEPTH1-03 -->\n'
   '          </select>\n', "Φ1 επιλογή"),
  ('Μόνο για αισθητήρες με δύο θύρες (Dragino SE0X / LSE02). Αισθητήρας μίας σόνδας (LSE01) αναγνωρίζεται αυτόματα.</div>',
   'Μόνο για αισθητήρες με δύο θύρες (Dragino SE0X / LSE02). Αισθητήρας μίας σόνδας (LSE01) αναγνωρίζεται αυτόματα. '
   '«Και οι δύο»: οι δύο σόνδες είναι στο ίδιο βάθος σε διαφορετικά σημεία· η άρδευση βγαίνει από τον μέσο όρο και κάθε σημείο φαίνεται χωριστά. '
   'Πολλοί αισθητήρες μίας σόνδας στο ίδιο βάθος δίνουν ήδη μέσο όρο.</div>', "Φ2α σημείωμα"),
  ("    soil_depth_port: ($('soil_depth_count') && $('soil_depth_count').value === '1' && $('soil_depth_port') && $('soil_depth_port').value === '2') ? 2 : 1,   /* v27 · T-DEPTH1-02 */\n",
   "    soil_depth_port: ($('soil_depth_count') && $('soil_depth_count').value === '1' && $('soil_depth_port')) ? ({ '2': 2, '3': 3 }[$('soil_depth_port').value] || 1) : 1,   /* v27/v28 · T-DEPTH1-02/03 */\n",
   "Φ2β αποθήκευση"),
  ("        $('soil_depth_port').value = String(conf.soil_depth_port) === '2' ? '2' : '1'; _sagDepthUi();",
   "        $('soil_depth_port').value = ['2', '3'].indexOf(String(conf.soil_depth_port)) >= 0 ? String(conf.soil_depth_port) : '1'; _sagDepthUi();",
   "Φ2γ φόρτωση"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
for i, sc in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"node --check script {i}: " + r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
