# -*- coding: utf-8 -*-
"""W-POINTNAMES-01 (17/11/2026 · Κώστα 4 #3, αίτημα Γιάννη για Kikis Land): ΔΙΚΑ ΜΑΣ ΟΝΟΜΑΤΑ για τις δύο θύρες της σόνδας.
  Η ρύθμιση `configuration` του αγρού παίρνει προαιρετικά `soil_point_names = {"1": "…", "2": "…"}`
  (θύρα 1 = αυτό που αλλιώς λέγεται «Ρηχό»/«σημείο 1», θύρα 2 = «Βαθύ»/«σημείο 2»).
  Η φόρμα παραμετροποίησης κρατά τα άγνωστα κλειδιά (Object.assign({}, prevConf, …)), άρα το κλειδί επιζεί στις αποθηκεύσεις.
  Χωρίς το κλειδί τίποτα δεν αλλάζει (όλα τα σημεία πέφτουν στην παλιά λογική).
  Δ0 sagDepthBox.n1/n2 (το σημείο αναφοράς «sagDepthBox={v:2,p:1},» των ελεγκτών μένει ίδιο), sagDepthSet 3ο όρισμα, sagPtNm9 μετά, καθαρισμός (≤ 24 χαρ., χωρίς < > " `)
  Δ1 η κλήση από τη ρύθμιση περνά o.soil_point_names
  Δ2 Ne(): ετικέτες μετρήσεων θύρας 1/2 → το όνομα (μετά τα W-DEPTH1-0x)
  Δ3 sagEceD9 (τίτλοι καρτών EC)   Δ4 _dp8 (διάγραμμα αισθητήρα)   Δ5 _dp9 (διάγραμμα αγρού)
  count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-DEPTH1-03" in s and "W-POINTNAMES-01" not in s
RE1 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)1(_avg)?$/"
RE2 = r"/^(soil_moisture|soil_temperature|conduct_soil|soil_ec_pore|soil_ece|soil_ec_raw|soil_ec_ref)2(_avg)?$/"
NM = ('/* W-POINTNAMES-01 */sagPtNm9=x=>{let o=x;if(typeof o==="string"){try{o=JSON.parse(o)}catch(_e){o=null}}'
      'const c=v=>v==null?"":String(v).replace(/[<>"`]/g,"").replace(/\\s+/g," ").trim().slice(0,24);'
      'return o&&typeof o==="object"&&!Array.isArray(o)?[c(o["1"]),c(o["2"])]:["",""]}')
SUBS = [
  ('sagDepthBox={v:2,p:1},sagDepthSet=(z,p)=>{sagDepthBox.v=String(z)==="1"?1:2;sagDepthBox.p=String(p)==="2"?2:String(p)==="3"?3:1}',
   'sagDepthBox={v:2,p:1},sagDepthSet=(z,p,nm)=>{sagDepthBox.v=String(z)==="1"?1:2;sagDepthBox.p=String(p)==="2"?2:String(p)==="3"?3:1;'
        'const _n9=sagPtNm9(nm);sagDepthBox.n1=_n9[0];sagDepthBox.n2=_n9[1]},' + NM,
   "Δ0 κουτί ονομάτων"),
  ('sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port);',
   'sagDepthSet(o&&o.soil_depth_count,o&&o.soil_depth_port,o&&o.soil_point_names);',
   "Δ1 κλήση από τη ρύθμιση"),
  ('if(s&&/^valve_\\d+_pulse$/.test(String(t))&&!sagMeterBox.v)',
   '/* W-POINTNAMES-01 */if(s&&sagDepthBox.n1&&' + RE1 + '.test(String(t))){const _b=s.label.replace(/ (Ρηχό|σημείο 1)(?= |$)/," "+sagDepthBox.n1);'
   's={...s,label:_b!==s.label?_b:s.label+" "+sagDepthBox.n1}}else if(s&&sagDepthBox.n2&&' + RE2 + '.test(String(t))){const _b=s.label.replace(/ (Βαθύ|σημείο 2)(?= |$)/," "+sagDepthBox.n2);'
   's={...s,label:_b!==s.label?_b:s.label+" "+sagDepthBox.n2}}'
   'if(s&&/^valve_\\d+_pulse$/.test(String(t))&&!sagMeterBox.v)',
   "Δ2 ετικέτες μετρήσεων"),
  ('sagEceD9=q=>q==="1"?',
   'sagEceD9=q=>(q==="1"&&sagDepthBox.n1)?" "+sagDepthBox.n1:(q==="2"&&sagDepthBox.n2)?" "+sagDepthBox.n2:q==="1"?',
   "Δ3 τίτλοι καρτών EC"),
  ('_dp8=_q8==="2"?',
   '_dp8=(_q8==="1"&&sagDepthBox.n1)?sagDepthBox.n1:(_q8==="2"&&sagDepthBox.n2)?sagDepthBox.n2:_q8==="2"?',
   "Δ4 διάγραμμα αισθητήρα"),
  ('_dp9=_q9==="2"?',
   '_dp9=(_q9==="1"&&sagDepthBox.n1)?sagDepthBox.n1:(_q9==="2"&&sagDepthBox.n2)?sagDepthBox.n2:_q9==="2"?',
   "Δ5 διάγραμμα αγρού"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
