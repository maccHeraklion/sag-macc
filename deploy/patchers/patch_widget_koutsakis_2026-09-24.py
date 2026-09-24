# -*- coding: utf-8 -*-
"""Widget · T-SEASONLABEL-01 + T-FLATABS-01 · LF, count==1, node --check, όλα-ή-τίποτα."""
import io,sys,subprocess,hashlib,os
sys.stdout.reconfigure(encoding="utf-8")
P="_dist-sagMain/index-7cbd9a4e.js"
raw=io.open(P,"rb").read(); assert b"\r\n" not in raw and raw[:3]!=b"\xef\xbb\xbf"
s=raw.decode("utf-8"); print("ΠΡΙΝ sha256",hashlib.sha256(raw).hexdigest()[:16],"bytes",len(raw))
def sub(old,new,label):
    global s; c=s.count(old); assert c==1,f"{label}: {c} φορές"; s=s.replace(old,new); print("  OK",label)
# T-SEASONLABEL-01: το bpi_performance_pct είναι αξιοποίηση δυναμικού, όχι χρονική πρόοδος
sub('"Πορεία σεζόν: "','"Αξιοποίηση σεζόν: "',"T-SEASONLABEL-01 ετικέτα")
# T-FLATABS-01: «δεν αποκρίνεται» = σχετικό εύρος <5 % ΚΑΙ απόλυτο εύρος <0,5 μονάδες (βαθύς 30 cm: 1,24/24,86=4,99 % ήταν ψευδές θετικό)
sub('flat:_days>=3&&_rel<.05,','flat:_days>=3&&_rel<.05&&_amp<.5,',"T-FLATABS-01 κατώφλι")
out=s.encode("utf-8"); tmp=P.replace(".js",".check.js"); io.open(tmp,"wb").write(out)
r=subprocess.run(["node","--check",tmp],capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8","replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P,"wb").write(out); chk=io.open(P,"rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256",hashlib.sha256(chk).hexdigest(),"bytes",len(chk))
