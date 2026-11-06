# -*- coding: utf-8 -*-
"""T-BOTRYTIS-HOSTS-01 (v50.181, 6/11/2026, σχόλιο γεωπόνου αρ. 5 + απόφαση Michalis «ναι προχώρα με το 1 και τη σταφίδα»).
ΕΥΡΗΜΑ (probe audit_agronomist_2026-11-06, ΕΠΙΒΕΒΑΙΩΜΕΝΟ): ο βοτρύτης δεν εμφανίζεται στον Κουτσάκη γιατί το αγγούρι δεν
ήταν στους δηλωμένους ξενιστές του. Προστίθενται ξενιστές ΜΟΝΟ — καμία αλλαγή σε όρια θερμοκρασίας/υγρασίας/ωρών:
  σταφίδα (vineCrops:raisin_grapes), αγγούρι, κολοκύθι, μελιτζάνα, πατάτα, λάχανο (vegetableCrops), ροδακινιά (stoneFruits:peach).
Βατόμουρο και σμέουρο δεν υπάρχουν ως καλλιέργειες στο σύστημα. count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile, re
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-SOILWOUND-01" in s and "T-BOTRYTIS-HOSTS-01" not in s
N = "\r\n"
def J(*lines): return N.join(lines) + N

s, n = re.subn(r"^const SAG_KERNEL_VERSION = 'v50\.180 · 2026-11-04';   // T-SOILWOUND-01",
               "const SAG_KERNEL_VERSION = 'v50.181 · 2026-11-06';   // T-BOTRYTIS-HOSTS-01 (βοτρύτης: +σταφίδα, αγγούρι, κολοκύθι, μελιτζάνα, πατάτα, λάχανο, ροδακινιά — μόνο ξενιστές) · T-SOILWOUND-01",
               s, count=1, flags=re.M)
assert n == 1, "έκδοση"; print("OK έκδοση")

def E(g, c, last=False):
    return ['        {', '          cultivation_type_general: "%s",' % g, '          cultivation_type: "%s"' % c, '        }' + ('' if last else ',')]

OLD = J('    botrytis_cinerea: {', '      crops: [',
        *E("vineCrops", "wine_grapes"), *E("vineCrops", "table_grapes"), *E("vegetableCrops", "onion"))
NEW = J('    botrytis_cinerea: {', '      crops: [',
        *E("vineCrops", "wine_grapes"), *E("vineCrops", "table_grapes"),
        '        // T-BOTRYTIS-HOSTS-01 (v50.181): σταφίδα — σχόλιο γεωπόνου 6/11, μόνο ξενιστής',
        *E("vineCrops", "raisin_grapes"), *E("vegetableCrops", "onion"))
assert s.count(OLD) == 1, ("αρχή λίστας", s.count(OLD)); s = s.replace(OLD, NEW); print("OK σταφίδα")

OLD2 = J(*E("vegetableCrops", "garlic"), *E("ornamentalCrops", "floriculture_generic", last=True), '      ],',
         '      name: "Τεφρά Σήψη (Botrytis cinerea)",')
NEW2 = J(*E("vegetableCrops", "garlic"),
         '        // T-BOTRYTIS-HOSTS-01 (v50.181): ο βοτρύτης έλειπε από το αγγούρι του Κουτσάκη — σχόλιο γεωπόνου 6/11. Μόνο ξενιστές.',
         *E("vegetableCrops", "cucumber"), *E("vegetableCrops", "zucchini"), *E("vegetableCrops", "eggplant"),
         *E("vegetableCrops", "potato"), *E("vegetableCrops", "cabbage"), *E("stoneFruits", "peach"),
         *E("ornamentalCrops", "floriculture_generic", last=True), '      ],',
         '      name: "Τεφρά Σήψη (Botrytis cinerea)",')
assert s.count(OLD2) == 1, ("τέλος λίστας", s.count(OLD2)); s = s.replace(OLD2, NEW2); print("OK λαχανικά + ροδακινιά")

assert s.count("\n") == s.count("\r\n")
out = s.encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.close(fd)
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8")
os.unlink(tmp)
assert r.returncode == 0, r.stderr[:600]
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
