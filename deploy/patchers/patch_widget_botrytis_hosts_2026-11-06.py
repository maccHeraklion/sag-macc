# -*- coding: utf-8 -*-
"""W-BOTRYTIS-HOSTS-01 (6/11/2026, μαζί με τον πυρήνα v50.181 T-BOTRYTIS-HOSTS-01).
Το widget φιλτράρει τις κάρτες παθογόνων με δικό του χάρτη ξενιστών (sagHostMap). Χωρίς αυτή την αλλαγή ο βοτρύτης που
θα βγάζει ο πυρήνας για αγγούρι/κολοκύθι/μελιτζάνα/πατάτα/λάχανο/ροδακινιά/σταφίδα θα κρυβόταν. Μπαίνει και το κουκί
(faba_bean), που ο πυρήνας το είχε ήδη και το widget το έκρυβε (γνωστή εξαίρεση Λ4 του disease_chain_check).
Μόνο ο χάρτης, κανένας υπολογισμός. count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-COVERAGE-01" in s
OLD = '"botrytis_cinerea":["vineCrops:wine_grapes","vineCrops:table_grapes","vegetableCrops:onion","vegetableCrops:dry_beans","vegetableCrops:green_beans","vegetableCrops:lettuce","vegetableCrops:tomato","vegetableCrops:pepper","vegetableCrops:strawberry","vegetableCrops:garlic","ornamentalCrops:floriculture_generic"]'
NEW = '"botrytis_cinerea":["vineCrops:wine_grapes","vineCrops:table_grapes","vineCrops:raisin_grapes","vegetableCrops:onion","vegetableCrops:dry_beans","vegetableCrops:faba_bean","vegetableCrops:green_beans","vegetableCrops:lettuce","vegetableCrops:tomato","vegetableCrops:pepper","vegetableCrops:strawberry","vegetableCrops:garlic","vegetableCrops:cucumber","vegetableCrops:zucchini","vegetableCrops:eggplant","vegetableCrops:potato","vegetableCrops:cabbage","stoneFruits:peach","ornamentalCrops:floriculture_generic"]'
assert s.count(OLD) == 1, s.count(OLD)
s = s.replace(OLD, NEW); print("OK χάρτης ξενιστών βοτρύτη")
out = s.encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".mjs"); os.close(fd)
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8")
os.unlink(tmp)
assert r.returncode == 0, r.stderr[:600]
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
