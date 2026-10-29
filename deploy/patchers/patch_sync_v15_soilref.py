# -*- coding: utf-8 -*-
"""Analysis setFieldParametersFromDeviceData v15 · T-SOILREF-02 — η δήλωση «αισθητήρας απόφασης» (soil_ref_device,
id συσκευής) περνά από τη φόρμα v25 στην ετικέτα configuration, απ' όπου τη διαβάζει ο πυρήνας (T-SOILREF-01).
Χωρίς αυτή τη γραμμή η λευκή λίστα θα την έκοβε σιωπηλά (μητρώο, παγίδα #1). ~+45 χαρ. στο tag μόνο όταν δηλωθεί.
EOL όπως το αρχείο, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/setFieldParametersFromDeviceData.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s
if crlf: s = s.replace("\r\n", "\n")
lf_sha = hashlib.sha256(s.encode("utf-8")).hexdigest()
print("ΠΡΙΝ sync LF-sha", lf_sha, "CRLF" if crlf else "LF")
assert "T-SOILREF-02" not in s, "ήδη εφαρμοσμένο"
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
sub(" ** v14 · 27/10/2026 — T-SUBSTRATE-01:",
    " ** v15 · 29/10/2026 — T-SOILREF-02: +soil_ref_device (id σόνδας «αισθητήρα απόφασης» από τη φόρμα v25· ο πυρήνας\n"
    " ** v50.164+ ΔΕΝ βγάζει μέσο όρο σονδών εδάφους — αποφασίζει ο δηλωμένος, αλλιώς ο πιο ξηρός).\n"
    " ** v14 · 27/10/2026 — T-SUBSTRATE-01:", "κεφαλίδα v15")
sub('  "total_plants", "covered_cultivation",\n];',
    '  "total_plants", "covered_cultivation",\n'
    '  /* v15 · T-SOILREF-02: αισθητήρας απόφασης εδάφους (id συσκευής) — πυρήνας _sagApplySoilRef */\n'
    '  "soil_ref_device",\n];', "λευκή λίστα")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
print("ΜΕΤΑ sync LF-sha", hashlib.sha256(s.encode("utf-8")).hexdigest())
io.open(P, "wb").write((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))
