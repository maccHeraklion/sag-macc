# -*- coding: utf-8 -*-
"""W-DEPTH1-03 (3/11/2026 · T-DEPTH1-03): soil_depth_port 3 = δύο σημεία στο ίδιο βάθος.
  Δ1 τίποτα δεν κρύβεται (και οι δύο θύρες είναι μετρήσεις του αγρού)·
  Δ2 ετικέτες/τίτλοι: «Ρηχό» → «σημείο 1», «Βαθύ» → «σημείο 2» (κάθε σημείο ορατό χωριστά)·
  θύρες 1/2 ακριβώς όπως W-DEPTH1-02. count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-DEPTH1-02" in s and "W-DEPTH1-03" not in s
RE1 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)1(_avg)?$/"
RE2 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)2(_avg)?$/"
SUBS = [
  ('sagDepthBox.p=String(p)==="2"?2:1}', 'sagDepthBox.p=String(p)==="2"?2:String(p)==="3"?3:1}', "Δ0 θύρα 3"),
  ("sagDepthHide=(v,dev)=>{if(sagDepthBox.v!==1)return!1;", "sagDepthHide=(v,dev)=>{if(sagDepthBox.v!==1||sagDepthBox.p===3)return!1;", "Δ1 κανένα κρύψιμο"),
  ('if(s&&sagDepthBox.v===1&&sagDepthBox.p!==2&&' + RE1 + '.test(String(t)))s={...s,label:s.label.replace(" Ρηχό","")};',
   'if(s&&sagDepthBox.v===1&&sagDepthBox.p===1&&' + RE1 + '.test(String(t)))s={...s,label:s.label.replace(" Ρηχό","")};'
   '/* W-DEPTH1-03 */if(s&&sagDepthBox.v===1&&sagDepthBox.p===3){if(' + RE1 + '.test(String(t)))s={...s,label:s.label.replace(" Ρηχό"," σημείο 1")};'
   'else if(' + RE2 + '.test(String(t)))s={...s,label:s.label.replace(" Βαθύ"," σημείο 2")}}',
   "Δ2α ετικέτες"),
  ('sagEceD9=q=>q==="1"?(sagDepthBox.v===1&&sagDepthBox.p!==2?"":" Ρηχό"):q==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"":" Βαθύ"):',
   'sagEceD9=q=>q==="1"?(sagDepthBox.v!==1?" Ρηχό":sagDepthBox.p===1?"":sagDepthBox.p===3?" σημείο 1":" Ρηχό"):q==="2"?(sagDepthBox.v!==1?" Βαθύ":sagDepthBox.p===2?"":sagDepthBox.p===3?" σημείο 2":" Βαθύ"):',
   "Δ2β τίτλοι καρτών EC"),
  ('_dp8=_q8==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":"Βαθύ"):(sagDepthBox.v===1&&sagDepthBox.p!==2?"εδάφους":"Ρηχό")',
   '_dp8=_q8==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":sagDepthBox.v===1&&sagDepthBox.p===3?"σημείο 2":"Βαθύ"):(sagDepthBox.v===1&&sagDepthBox.p===1?"εδάφους":sagDepthBox.v===1&&sagDepthBox.p===3?"σημείο 1":"Ρηχό")',
   "Δ2γ διάγραμμα αισθητήρα"),
  ('_dp9=_q9==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":"Βαθύ"):(sagDepthBox.v===1&&sagDepthBox.p!==2?"εδάφους":"Ρηχό")',
   '_dp9=_q9==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":sagDepthBox.v===1&&sagDepthBox.p===3?"σημείο 2":"Βαθύ"):(sagDepthBox.v===1&&sagDepthBox.p===1?"εδάφους":sagDepthBox.v===1&&sagDepthBox.p===3?"σημείο 1":"Ρηχό")',
   "Δ2δ διάγραμμα αγρού"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
