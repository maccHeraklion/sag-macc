# -*- coding: utf-8 -*-
"""T-ZONES-01 · sync v18 (3/11/2026): οι ζώνες άρδευσης της φόρμας v29 γράφονται σε ΔΙΚΟ ΤΟΥΣ tag «irrigation_zones»
(δικό του όριο 1900 — δεν τρώνε το γεμάτο tag configuration). Συμπαγής μορφή [{n, s:[id|id:2], c:[[cropId, m²]]}],
καθαρισμός όπως στον πυρήνα (_sagZonesParse). Χωρίς irrigation_zones στη φόρμα → το tag μένει άθικτο· κενός πίνακας →
διαγράφεται· πάνω από το όριο → ΔΕΝ γράφεται και ο παραγωγός ενημερώνεται. count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/setFieldParametersFromDeviceData.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-02" in s and "T-ZONES-01" not in s
SUBS = [
  (" ** v17 · 3/11/2026 — T-DEPTH1-02:",
   " ** v18 · 3/11/2026 — T-ZONES-01: ζώνες άρδευσης σε δικό τους tag «irrigation_zones» (φόρμα v29· πυρήνας v50.170).\n ** v17 · 3/11/2026 — T-DEPTH1-02:", "κεφαλίδα"),
  ("function stripCropExtras(crops) {",
   "/* v18 · T-ZONES-01: ζώνες άρδευσης → συμπαγής, καθαρισμένη μορφή (ίδιοι κανόνες με τον πυρήνα _sagZonesParse). */\n"
   "function compactZones(list) {\n"
   "  const out = [];\n"
   "  for (const z of (Array.isArray(list) ? list : []).slice(0, 20)) {\n"
   "    if (!z || typeof z !== \"object\") continue;\n"
   "    const n = String(z.n == null ? \"\" : z.n).trim().slice(0, 40);\n"
   "    if (!n) continue;\n"
   "    const sn = (Array.isArray(z.s) ? z.s : []).map(String).filter((x) => /^[0-9a-f]{24}(:2)?$/.test(x)).slice(0, 10);\n"
   "    const c = [];\n"
   "    for (const x of (Array.isArray(z.c) ? z.c : []).slice(0, 20)) {\n"
   "      if (!Array.isArray(x) || x[0] == null || String(x[0]) === \"\") continue;\n"
   "      const a = Number(x[1]);\n"
   "      c.push(Number.isFinite(a) && a > 0 ? [String(x[0]), Math.round(a * 10) / 10] : [String(x[0])]);\n"
   "    }\n"
   "    if (!c.length) continue;\n"
   "    out.push({ n, s: sn, c });\n"
   "  }\n"
   "  return out;\n"
   "}\n"
   "function stripCropExtras(crops) {", "συνάρτηση"),
  ('  const newTags = existingTags.filter((item) => item && item.key && item.key !== "configuration");\n'
   '  newTags.push({ key: "configuration", value: serialized });\n',
   '  /* v18 · T-ZONES-01: undefined = άθικτο, null = διαγραφή, string = νέα τιμή. */\n'
   '  let zonesTag;\n'
   '  if (packed && Array.isArray(packed.irrigation_zones)) {\n'
   '    const _zs = compactZones(packed.irrigation_zones);\n'
   '    zonesTag = _zs.length ? JSON.stringify(_zs) : null;\n'
   '    if (typeof zonesTag === "string" && zonesTag.length > TAG_SAFE_LIMIT) {\n'
   '      warnings.push("οι ζώνες άρδευσης δεν χώρεσαν στο όριο αποθήκευσης (" + zonesTag.length + " > " + TAG_SAFE_LIMIT\n'
   '        + " χαρακτήρες) και ΔΕΝ αποθηκεύτηκαν — συντομέψτε τα ονόματα ή αφαιρέστε ζώνες.");\n'
   '      zonesTag = undefined;\n'
   '    }\n'
   '    if (zonesTag !== undefined) context.log("T-ZONES-01: ζώνες [" + device_id + "]: " + (zonesTag || "— (διαγραφή)"));\n'
   '  }\n'
   '  const newTags = existingTags.filter((item) => item && item.key && item.key !== "configuration"\n'
   '    && (zonesTag === undefined || item.key !== "irrigation_zones"));\n'
   '  newTags.push({ key: "configuration", value: serialized });\n'
   '  if (typeof zonesTag === "string") newTags.push({ key: "irrigation_zones", value: zonesTag });\n', "εγγραφή tag"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: {c}"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
