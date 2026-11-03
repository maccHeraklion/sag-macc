# -*- coding: utf-8 -*-
"""W-DEPTH1-02 (3/11/2026 · T-DEPTH1-02): με «Ένα βάθος» το widget ακολουθεί τη ΘΥΡΑ που δήλωσε η φόρμα v27
(soil_depth_port 1 | 2· απόν = 1 = W-DEPTH1-01).
  Δ1 το κουτί κρατά και τη θύρα (sagDepthSet(πλήθος, θύρα))·
  Δ2 θύρα 2: κρύβονται οι κάρτες της θύρας 1 (και γυμνά ονόματα) ΜΟΝΟ σε συσκευή που δίνει και θύρα 2· θύρα 1 όπως πριν·
  Δ3 ετικέτες: η κρατημένη θύρα χάνει το «Ρηχό»/«Βαθύ»· τίτλοι καρτών/διαγραμμάτων EC «εδάφους».
count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-DEPTH1-01" in s and "W-DEPTH1-02" not in s
RE2 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)2(_avg)?$/"
RE1 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)1(_avg)?$/"
RE1B = r"/^((soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)1|soil_moisture|temp_soil|conduct_soil)(_avg)?$/"
SUBS = [
  ('/* W-DEPTH1-01 */sagDepthBox={v:2},sagDepthSet=z=>{sagDepthBox.v=String(z)==="1"?1:2},sagDepthHide=(v,dev)=>{if(sagDepthBox.v!==1||!' + RE2
   + '.test(String(v)))return!1;const o=dev||{};return!!(o.soil_moisture1||o.soil_moisture||o.soil_temperature1||o.conduct_soil1)},',
   '/* W-DEPTH1-01 */sagDepthBox={v:2,p:1},sagDepthSet=(z,p)=>{sagDepthBox.v=String(z)==="1"?1:2;sagDepthBox.p=String(p)==="2"?2:1},'
   'sagDepthHide=(v,dev)=>{if(sagDepthBox.v!==1)return!1;const o=dev||{};/* W-DEPTH1-02 */if(sagDepthBox.p===2)return ' + RE1B
   + '.test(String(v))&&!!(o.soil_moisture2||o.soil_temperature2||o.conduct_soil2);if(!' + RE2
   + '.test(String(v)))return!1;return!!(o.soil_moisture1||o.soil_moisture||o.soil_temperature1||o.conduct_soil1)},',
   "Δ1/Δ2 κουτί + κρύψιμο"),
  ("sagDepthSet(o&&o.soil_depth_count);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);sagDepthSet(2);return!1}",
   "sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);sagDepthSet(2,1);return!1}",
   "Δ1β θύρα από τη ρύθμιση"),
  ('if(s&&sagDepthBox.v===1&&' + RE1 + '.test(String(t)))s={...s,label:s.label.replace(" Ρηχό","")};',
   'if(s&&sagDepthBox.v===1&&sagDepthBox.p!==2&&' + RE1 + '.test(String(t)))s={...s,label:s.label.replace(" Ρηχό","")};'
   '/* W-DEPTH1-02 */if(s&&sagDepthBox.v===1&&sagDepthBox.p===2&&' + RE2 + '.test(String(t)))s={...s,label:s.label.replace(" Βαθύ","")};',
   "Δ3α ετικέτες"),
  ('sagEceD9=q=>q==="1"?(sagDepthBox.v===1?"":" Ρηχό"):q==="2"?" Βαθύ":',
   'sagEceD9=q=>q==="1"?(sagDepthBox.v===1&&sagDepthBox.p!==2?"":" Ρηχό"):q==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"":" Βαθύ"):',
   "Δ3β τίτλοι καρτών EC"),
  ('_dp8=_q8==="2"?"Βαθύ":(sagDepthBox.v===1?"εδάφους":"Ρηχό")',
   '_dp8=_q8==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":"Βαθύ"):(sagDepthBox.v===1&&sagDepthBox.p!==2?"εδάφους":"Ρηχό")',
   "Δ3γ διάγραμμα αισθητήρα"),
  ('_dp9=_q9==="2"?"Βαθύ":(sagDepthBox.v===1?"εδάφους":"Ρηχό")',
   '_dp9=_q9==="2"?(sagDepthBox.v===1&&sagDepthBox.p===2?"εδάφους":"Βαθύ"):(sagDepthBox.v===1&&sagDepthBox.p!==2?"εδάφους":"Ρηχό")',
   "Δ3δ διάγραμμα αγρού"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
