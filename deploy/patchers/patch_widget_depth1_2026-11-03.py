# -*- coding: utf-8 -*-
"""W-DEPTH1-01 (3/11/2026 · T-DEPTH1-01, Michalis: «ένας μόνο αισθητήρας βάθους … να επιλέγεται στην παραμετροποίηση»).
Με soil_depth_count = 1 στη ρύθμιση του αγρού:
  Δ1 κουτί σημαίας από τη ρύθμιση (ίδιο σημείο με κάλυμμα/λίπασμα)·
  Δ2 οι κάρτες του καναλιού 2 (υγρασία/θερμοκρασία/αγωγιμότητα εδάφους, EC ρίζας, αλατότητα, ένδειξη, αναφορά) ΚΡΥΒΟΝΤΑΙ
     ΜΟΝΟ σε συσκευή που δίνει και κανάλι 1 (σόνδα μόνο στο κανάλι 2 — π.χ. lse01_deep — μένει ορατή)·
     στο παράθυρο συσκευής ΚΑΙ στις «Όλες οι μετρήσεις»·
  Δ3 οι ετικέτες του καναλιού 1 χάνουν το «Ρηχό» (δεν υπάρχει βαθύ για να ξεχωρίσει)·
  Δ4 τίτλοι καρτών/διαγραμμάτων EC: «EC στη ρίζα» / «… εδάφους» αντί για «Ρηχό».
Απόν ή 2 → ΑΚΡΙΒΩΣ όπως πριν. count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-DEPTH1-01" not in s

RE2 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)2(_avg)?$/"
RE1 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)1(_avg)?$/"
SUBS = [
  ("sagMeterBox={v:!1},sagMeterSet=z=>{sagMeterBox.v=!!z},",
   "sagMeterBox={v:!1},sagMeterSet=z=>{sagMeterBox.v=!!z},/* W-DEPTH1-01 */sagDepthBox={v:2},sagDepthSet=z=>{sagDepthBox.v=String(z)===\"1\"?1:2},"
   "sagDepthHide=(v,dev)=>{if(sagDepthBox.v!==1||!" + RE2 + ".test(String(v)))return!1;const o=dev||{};return!!(o.soil_moisture1||o.soil_moisture||o.soil_temperature1||o.conduct_soil1)},",
   "Δ1α κουτί + κρύψιμο"),
  ("sagFertSet(o&&o.fert_ecw_dsm);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);return!1}",
   "sagFertSet(o&&o.fert_ecw_dsm);sagDepthSet(o&&o.soil_depth_count);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);sagDepthSet(2);return!1}",
   "Δ1β σημαία από τη ρύθμιση"),
  ("if(!Object.prototype.hasOwnProperty.call(St,v)||sagRainHide.has(v))return!1;",
   "if(!Object.prototype.hasOwnProperty.call(St,v)||sagRainHide.has(v)||sagDepthHide(v,j))return!1;", "Δ2α παράθυρο συσκευής"),
  ("if(!Object.prototype.hasOwnProperty.call(St,d)||sagRainHide.has(d))return!1;",
   "if(!Object.prototype.hasOwnProperty.call(St,d)||sagRainHide.has(d)||sagDepthHide(d,N))return!1;", "Δ2β όλες οι μετρήσεις"),
  ("function Ne(t){let s=St[t];",
   "function Ne(t){let s=St[t];/* W-DEPTH1-01 */if(s&&sagDepthBox.v===1&&" + RE1 + ".test(String(t)))s={...s,label:s.label.replace(\" Ρηχό\",\"\")};",
   "Δ3 ετικέτες"),
  ('sagEceD9=q=>q==="1"?" Ρηχό":', 'sagEceD9=q=>q==="1"?(sagDepthBox.v===1?"":" Ρηχό"):', "Δ4α τίτλοι καρτών EC"),
  ('_dp8=_q8==="2"?"Βαθύ":"Ρηχό"', '_dp8=_q8==="2"?"Βαθύ":(sagDepthBox.v===1?"εδάφους":"Ρηχό")', "Δ4β διάγραμμα αισθητήρα"),
  ('_dp9=_q9==="2"?"Βαθύ":"Ρηχό"', '_dp9=_q9==="2"?"Βαθύ":(sagDepthBox.v===1?"εδάφους":"Ρηχό")', "Δ4γ διάγραμμα αγρού"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
