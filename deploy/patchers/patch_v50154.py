# -*- coding: utf-8 -*-
"""Πυρήνας v50.154 · T-METHODCARD-02 (§8.7 απογραφής, εντολή Μιχάλη 24/9).
Η ημερήσια κάρτα μεθόδου (field_method_card) ΔΕΝ φτάνει στο widget (δεν είναι στις μεταβλητές των
63 widget). Το widget όμως λαμβάνει και συγχωνεύει το `field_bundle_2` (shared + crops). Ο πυρήνας
γράφει την ΙΔΙΑ κάρτα, μία φορά την ημέρα, και ως field_bundle_2 → shared.field_method_card.
Καμία αλλαγή υπολογισμού. CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.153 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.154 · 2026-09-24';", "έκδοση v50.154")
sub("              _daily.push({ variable: 'field_method_card',\n"
    "                value: _SAG_METHOD_CARD.n,\n"
    "                metadata: { color: 'grey', text: String(_SAG_METHOD_CARD.t).slice(0, 2000) } });\n"
    "            }\n",
    "              _daily.push({ variable: 'field_method_card',\n"
    "                value: _SAG_METHOD_CARD.n,\n"
    "                metadata: { color: 'grey', text: String(_SAG_METHOD_CARD.t).slice(0, 2000) } });\n"
    "              // T-METHODCARD-02 (v50.154, §8.7): η ΙΔΙΑ κάρτα και ως field_bundle_2 — το widget δεν έχει το field_method_card στις μεταβλητές του, το field_bundle_2 ΝΑΙ (συγχωνεύεται στο shared). Μία φορά την ημέρα, χωρίς συμπίεση.\n"
    "              _daily.push({ variable: 'field_bundle_2', value: _SAG_METHOD_CARD.n, metadata: { schema: { name: 'field_bundle_2', version: 1, source: 'T-METHODCARD-02' },\n"
    "                shared: { field_method_card: { value: _SAG_METHOD_CARD.n, metadata: { color: 'grey', text: String(_SAG_METHOD_CARD.t).slice(0, 2000) } } } } });\n"
    "            }\n",
    "T-METHODCARD-02 field_bundle_2 ημερήσιο")

out = s.replace("\n", "\r\n").encode("utf-8"); assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
