# -*- coding: utf-8 -*-
"""Widget · T-AVGCOV-W-01 — ο δείκτης `avg_window_status` (v50.153) εμφανίζεται στην κάρτα
«Υγεία εγκατάστασης» με ετικέτα «Κάλυψη 24ωρων μέσων». LF, count==1, node --check."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
old = 'measurement_age:"Ηλικία μετρήσεων",stale_measurement_groups:'
new = 'measurement_age:"Ηλικία μετρήσεων",avg_window_status:"Κάλυψη 24ωρων μέσων",stale_measurement_groups:'
c = s.count(old); assert c == 1, f"ετικέτα HL: βρέθηκε {c} φορές"
s = s.replace(old, new); print("  OK T-AVGCOV-W-01 ετικέτα στην κάρτα υγείας")
out = s.encode("utf-8"); tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk))
