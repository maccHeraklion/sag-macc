# -*- coding: utf-8 -*-
"""Πυρήνας v50.156 · T-LWS-SHADED-DRY-01 (απόφαση Μιχάλη 24/9, μετά τον έλεγχο αλυσίδας ασθενειών).
Στεγνός ΣΚΙΑΣΜΕΝΟΣ αισθητήρας φύλλου υπερισχύει της ΕΚΤΙΜΗΣΗΣ δρόσου (T_air−1,5 ≤ dp) και της
εφεδρείας RH ≥ 90 — όχι της βροχής, όχι της δρόσου από τη μετρημένη θερμοκρασία φύλλου.
Αλλάζει μόνο η ΣΕΙΡΑ των κλάδων στη _sagLeafWetness. Χωρίς αισθητήρα ή με μη σκιασμένο: αμετάβλητο.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.155 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.156 · 2026-09-24';", "έκδοση v50.156")
sub("  if (Number.isFinite(dp)) {\n"
    "    if (ltOk && lt <= dp + 0.5)\n"
    "      return { wet: true, weight: 1, source: 'dew_leaf', confidence: 'HIGH', lm: lmOut };\n"
    "    if (Number.isFinite(T) && (T - _SAG_CANOPY_COOLING) <= dp)\n"
    "      return { wet: true, weight: 0.8, source: 'dew_air', confidence: 'MEDIUM', lm: lmOut };\n"
    "  }\n"
    "\n"
    "  if (Number.isFinite(RH) && RH >= 90)\n"
    "    return { wet: true, weight: 0.6, source: 'rh', confidence: 'LOW', lm: lmOut };\n"
    "\n"
    "  if (hasLm && o.leafShaded === true)\n"
    "    return { wet: false, weight: 0, source: 'sensor_dry', confidence: 'HIGH', lm: lmOut };\n"
    "  if (hasLm)\n",
    "  if (Number.isFinite(dp) && ltOk && lt <= dp + 0.5)\n"
    "    return { wet: true, weight: 1, source: 'dew_leaf', confidence: 'HIGH', lm: lmOut };\n"
    "  // T-LWS-SHADED-DRY-01 (v50.156, απόφαση Μιχάλη 24/9): η ΜΕΤΡΗΣΗ ενός σκιασμένου (επαληθευμένου)\n"
    "  // αισθητήρα φύλλου υπερισχύει της ΕΚΤΙΜΗΣΗΣ δρόσου και της εφεδρείας RH — αυτό υπόσχεται το\n"
    "  // σχόλιο «ΑΣΥΜΜΕΤΡΙΑ» παραπάνω, αλλά οι κλάδοι ήταν σε λάθος σειρά. Σε θερμοκήπιο με νυχτερινή\n"
    "  // RH ≥ 90 ο περονόσπορος μετρούσε ώρες ακόμη κι αν το φύλλο έλεγε «στεγνό». Βροχή και δρόσος\n"
    "  // από τη ΜΕΤΡΗΜΕΝΗ θερμοκρασία φύλλου συνεχίζουν να προηγούνται. Μη σκιασμένος: αμετάβλητο.\n"
    "  if (hasLm && o.leafShaded === true)\n"
    "    return { wet: false, weight: 0, source: 'sensor_dry', confidence: 'HIGH', lm: lmOut };\n"
    "  if (Number.isFinite(dp) && Number.isFinite(T) && (T - _SAG_CANOPY_COOLING) <= dp)\n"
    "    return { wet: true, weight: 0.8, source: 'dew_air', confidence: 'MEDIUM', lm: lmOut };\n"
    "\n"
    "  if (Number.isFinite(RH) && RH >= 90)\n"
    "    return { wet: true, weight: 0.6, source: 'rh', confidence: 'LOW', lm: lmOut };\n"
    "\n"
    "  if (hasLm)\n",
    "T-LWS-SHADED-DRY-01 σειρά κλάδων")

out = s.replace("\n", "\r\n").encode("utf-8"); assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
