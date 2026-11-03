# -*- coding: utf-8 -*-
"""T-DEPTH1-01 · sync v16 (3/11/2026): +soil_depth_count στη λευκή λίστα (αλλιώς η δήλωση «ένα βάθος» της φόρμας v26
κόβεται εδώ και δεν φτάνει ποτέ στον πυρήνα — παγίδα #1). count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/setFieldParametersFromDeviceData.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-01" not in s
SUBS = [
  ('  "soil_ref_device",\n',
   '  "soil_ref_device",\n  /* v16 · T-DEPTH1-01: πλήθος βαθών αισθητήρα εδάφους (1 | 2· απόν = 2) — πυρήνας v50.167 _sagDepth1Of */\n  "soil_depth_count",\n', "λίστα"),
  (" ** v15 · 29/10/2026 — T-SOILREF-02:",
   " ** v16 · 3/11/2026 — T-DEPTH1-01: +soil_depth_count (φόρμα v26: «ένα βάθος αισθητήρα»· πυρήνας v50.167).\n ** v15 · 29/10/2026 — T-SOILREF-02:", "κεφαλίδα"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: {c}"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
