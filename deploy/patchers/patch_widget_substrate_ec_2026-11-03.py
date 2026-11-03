# -*- coding: utf-8 -*-
"""W-SUBSTRATE-EC-01 + W-CHART-GAP-01 (3/11/2026, Michalis: «στο διάγραμμα δείχνει 1,2 και στο ταμπλό 5 — τι δεν πάει καλά»).
ΕΥΡΗΜΑ (probe audit_ec_kokofoinika_2026-11-03, ΕΠΙΒΕΒΑΙΩΜΕΝΟ):
  · Κοκοφοίνικας = υπόστρωμα coir (T-SUBSTRATE-01). Ο ΠΥΡΗΝΑΣ σκόπιμα ΔΕΝ βγάζει EC στη ρίζα/ECe σε υπόστρωμα («Δεν είναι
    EC διαλύματος — μετρήστε με σύριγγα και απορροή»)· το WIDGET όμως την υπολόγιζε μόνο του ανά πακέτο (W-EC-INSTANT-01)
    με τον τύπο του ΧΩΜΑΤΟΣ (Hilhorst) → κάρτα 4,90/7,15 mS/cm, ενώ το διάγραμμα δείχνει το όργανο (1,0–1,2 mS/cm).
  · Το διάγραμμα μετρούσε 532 μηδενικά (9–28/9, σόνδα εκτός υποστρώματος) στον «μέσο περιόδου» (0,017) και γεφύρωνε με
    καμπύλη κενό 36 ημερών (28/9 → 3/11) σαν να ανέβαινε σιγά σιγά.
ΔΙΟΡΘΩΣΕΙΣ:
  Υ1 σημαία υποστρώματος από τη ρύθμιση (ίδιος κανόνας με τον πυρήνα _sagSubstrateOf: soil_type ή soil_texture_class = coir).
  Υ2 με υπόστρωμα: καμία κάρτα/διάγραμμα «EC στη ρίζα» — φαίνεται η μέτρηση του οργάνου, με όνομα «Αγωγιμότητα
     υποστρώματος (όργανο)».
  Δ1 διάγραμμα υγρασίας/αγωγιμότητας εδάφους: οι ακριβώς μηδενικές τιμές (σόνδα εκτός χώματος) δεν σχεδιάζονται ούτε
     μετρούν στα στατιστικά· κενό > 6 ώρες σπάει τη γραμμή («-» = χωρίς δεδομένα).
Χωρίς υπόστρωμα: οι κάρτες όπως πριν. count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-ZONES-01" in s and "W-SUBSTRATE-EC-01" not in s
SUBS = [
  ("sagEceBox={v:null},", "/* W-SUBSTRATE-EC-01 */sagSubBox={v:!1},sagSubSet=z=>{sagSubBox.v=!!z},sagEceBox={v:null},", "Υ1α κουτί"),
  ("sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);sagDepthSet(2,1);return!1}",
   "sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port);sagSubSet(!!o&&(o.soil_type===\"coir\"||o.soil_texture_class===\"coir\"));return vv}"
   "catch(_e){sagCoveredSet(!1);sagFertSet(null);sagDepthSet(2,1);sagSubSet(!1);return!1}", "Υ1β σημαία από τη ρύθμιση"),
  ('sagEceCard=(vn,DV,dv)=>{try{const M=/^conduct_soil([1-4]?)$/.exec(String(vn||""));if(!M)return null;',
   'sagEceCard=(vn,DV,dv)=>{try{const M=/^conduct_soil([1-4]?)$/.exec(String(vn||""));if(!M||sagSubBox.v)return null;', "Υ2α κάρτα"),
  ("if(_sagEc9&&h&&sagEceMulti9(t.history,n)){", "if(_sagEc9&&h&&!sagSubBox.v&&sagEceMulti9(t.history,n)){", "Υ2β διάγραμμα ανά αισθητήρα"),
  ("}else if(_sagEc9&&h){/* W-EC-ROOT-01 */", "}else if(_sagEc9&&h&&!sagSubBox.v){/* W-EC-ROOT-01 */", "Υ2γ διάγραμμα αγρού"),
  ("function Ne(t){let s=St[t];",
   "function Ne(t){let s=St[t];/* W-SUBSTRATE-EC-01 */if(s&&sagSubBox.v&&/^conduct_soil\\d?$/.test(String(t)))s={...s,label:s.label.replace(\"Αγωγιμότητα εδάφους\",\"Αγωγιμότητα υποστρώματος (όργανο)\")};",
   "Υ2δ ετικέτα"),
  (",V=l.useMemo(()=>E.map(g=>[g.t,m(g.v)]),[E,m])",
   ",V=l.useMemo(()=>{/* W-CHART-GAP-01 */const _z=/^(soil_moisture|soil_humidity|water_soil|conduct_soil)\\d?(_avg)?$/.test(String(s||\"\")),_o=[];let _pt=null;"
   "for(const g of E){if(_z&&Number(g.v)===0)continue;const _t=typeof g.t==\"number\"?g.t:new Date(g.t).getTime();"
   "if(_pt!==null&&Number.isFinite(_t)&&Math.abs(_t-_pt)>216e5)_o.push([Math.min(_t,_pt)+1,\"-\"]);_o.push([g.t,m(g.v)]);if(Number.isFinite(_t))_pt=_t}return _o},[E,m,s])",
   "Δ1 διάγραμμα: μηδενικά/κενά"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
