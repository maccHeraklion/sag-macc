# -*- coding: utf-8 -*-
"""Widget · T-BPISINCE-W-01 — «Αξιοποίηση σεζόν: 46 % (από 19/9, 6 ημέρες με πλήρη δεδομένα)»
από το bpi_total_since, ή «(σε ≥32 ημέρες με πλήρη δεδομένα)» όταν υπάρχει bpi_total_days_floor.
LF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub('perfDays=(Number.isFinite(_pd)&&_pd>0)?Math.round(_pd):null,S=n==null?void 0:n.bpi_loss_bucket,',
    'perfDays=(Number.isFinite(_pd)&&_pd>0)?Math.round(_pd):null,'
    '_ps=n==null?void 0:n.bpi_total_since==null?void 0:n.bpi_total_since.value,perfSince=/^\\d{4}-\\d{2}-\\d{2}$/.test(String(_ps||""))?String(_ps):null,'
    '_pf=Number(n==null?void 0:n.bpi_total_days_floor==null?void 0:n.bpi_total_days_floor.value),perfFloor=_pf===1,'
    'S=n==null?void 0:n.bpi_loss_bucket,',
    "T-BPISINCE-W-01 perfSince/perfFloor")
sub('return{stomata:c,perfPct:y,perfDays:perfDays,bucketLabel:X,',
    'return{stomata:c,perfPct:y,perfDays:perfDays,perfSince:perfSince,perfFloor:perfFloor,bucketLabel:X,',
    "T-BPISINCE-W-01 στο Le")
sub('Le.perfDays!==null?" (σε "+Le.perfDays+(Le.perfDays===1?" ημέρα":" ημέρες")+" με πλήρη δεδομένα)":""',
    'Le.perfDays!==null?(Le.perfFloor?" (σε ≥"+Le.perfDays+" ημέρες με πλήρη δεδομένα)"'
    ':(Le.perfSince?" (από "+(m9=>m9?Number(m9[3])+"/"+Number(m9[2]):"")(Le.perfSince.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/))+", "+Le.perfDays+(Le.perfDays===1?" ημέρα":" ημέρες")+" με πλήρη δεδομένα)"'
    ':" (σε "+Le.perfDays+(Le.perfDays===1?" ημέρα":" ημέρες")+" με πλήρη δεδομένα)")):""',
    "T-BPISINCE-W-01 κείμενο κάρτας")

out = s.encode("utf-8"); tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk))
