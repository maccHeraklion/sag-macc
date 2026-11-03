# -*- coding: utf-8 -*-
"""T-DEPTH1-02 · sync v17 (3/11/2026): +soil_depth_port στη λευκή λίστα (αλλιώς η θύρα «Ένα βάθος» της φόρμας v27
κόβεται εδώ και ο πυρήνας κρατά πάντα τη θύρα 1 — παγίδα #1). count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/setFieldParametersFromDeviceData.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-01" in s and "T-DEPTH1-02" not in s
SUBS = [
  ('  "soil_depth_count",\n',
   '  "soil_depth_count",\n  /* v17 · T-DEPTH1-02: θύρα της σόνδας με ένα βάθος (1 | 2· απόν = 1) — πυρήνας v50.168 _sagDepth1PortOf */\n  "soil_depth_port",\n', "λίστα"),
  (" ** v16 · 3/11/2026 — T-DEPTH1-01:",
   " ** v17 · 3/11/2026 — T-DEPTH1-02: +soil_depth_port (φόρμα v27: «ποια θύρα είναι στο έδαφος»· πυρήνας v50.168).\n ** v16 · 3/11/2026 — T-DEPTH1-01:", "κεφαλίδα"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: {c}"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
