# -*- coding: utf-8 -*-
"""W-COVERAGE-01 (4/11/2026, Michalis: «καλό είναι κάπου να μας δείχνει για πόσες ασθένειες και έντομα
καλύπτεται ο αγρός όπως το έδειχνε παλιότερα, ακόμα και αν δε λέει ποιες»).
ΕΥΡΗΜΑ (probe audit_diseases_snapshot/audit_downy_fleet 2026-11-04, ΕΠΙΒΕΒΑΙΩΜΕΝΟ):
  · Ο αριθμός υπήρχε μόνο δύο κλικ βαθιά, στην κάρτα υγείας, και ήταν λάθος: ο πυρήνας μετρά μαζί
    infection_hours_counter_ και infection_hours_counter_max_, άρα «4 μύκητες» στον Κουτσάκη ενώ οι
    μετρητές είναι 2. Και αφήνει απέξω τα μοντέλα εδάφους, τα βακτήρια και τους νηματώδεις.
ΔΙΟΡΘΩΣΗ (μόνο εμφάνιση, κανένας υπολογισμός):
  Κ1 βοηθός sagCov9: μετρά τι έβγαλε πραγματικά ο πυρήνας για την καλλιέργεια, από τα fir_message_*.
  Κ2 γραμμή κάτω από τον τίτλο «Συναγερμοί Παθογόνων».
  Κ3 η κάρτα υγείας παίρνει τον ίδιο αριθμό και όχι τον διπλό του πυρήνα.
count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-CONFIG-STUB-01" in s and "W-COVERAGE-01" not in s

# Ξενιστές των μοντέλων εδάφους/βακτηρίων/νηματωδών: το sagHostMap δεν τους έχει. Χωριστός χάρτης, ώστε να μην
# αλλάξει καμία άλλη χρήση του sagHostMap. Παραγμένος από το PATHOGEN_PROFILE του πυρήνα v50.175.
HOSTX = '{"verticillium_dahliae":["industrialCrops:cotton","vegetableCrops:eggplant","vegetableCrops:potato","vegetableCrops:strawberry","vegetableCrops:tomato","vegetableCrops:pepper","olive:koroneiki","specialtyMediterranean:mint","specialtyMediterranean:artichoke","industrialCrops:sunflower","vegetableCrops:cucumber","vegetableCrops:melon","vegetableCrops:watermelon"],"phytophthora_capsici":["vegetableCrops:pepper","vegetableCrops:eggplant","vegetableCrops:cucumber","vegetableCrops:watermelon","vegetableCrops:melon","vegetableCrops:zucchini","vegetableCrops:tomato"],"rhizoctonia_solani":["vegetableCrops:potato","industrialCrops:sugar_beet"],"sclerotinia_sclerotiorum":["industrialCrops:sunflower","vegetableCrops:dry_beans","vegetableCrops:faba_bean","vegetableCrops:green_beans","vegetableCrops:lettuce","vegetableCrops:cabbage","vegetableCrops:broccoli","vegetableCrops:tomato","vegetableCrops:eggplant","vegetableCrops:pepper","vegetableCrops:cucumber","vegetableCrops:melon","vegetableCrops:watermelon","vegetableCrops:carrot","vegetableCrops:potato","vegetableCrops:strawberry","vegetableCrops:zucchini","specialtyMediterranean:artichoke"],"pseudomonas_savastanoi":["olive:koroneiki"],"erwinia_amylovora":["pomeFruits:apple"],"meloidogyne_incognita":["vegetableCrops:tomato","vegetableCrops:eggplant","vegetableCrops:cucumber","vegetableCrops:melon","vegetableCrops:watermelon","vegetableCrops:pepper","vegetableCrops:zucchini","vegetableCrops:carrot"]}'
HELPER = ('/* W-COVERAGE-01 */sagHostX9=' + HOSTX + ','
          'sagCov9=(R,hk)=>{try{let d=0,p=0,u=0,w=0;for(const f of bt){const k=f.key,hm=sagHostMap[k]||sagHostX9[k],ih=!!(hk&&hm&&hm.indexOf(hk)>=0);'
          'if(hk&&hm&&!ih)continue;const m=R&&R["fir_message_"+k];if(!m||m.value===null||m.value===void 0||m.value===""){if(ih)w++;continue}'
          'if(/^Μη διαθέσιμ/.test(String(m.value))){u++;continue}const q=sagKindMap[k];q==="i"||q==="m"?p++:d++}'
          'return d+p+u+w?{d,p,u,w}:null}catch{return null}},'
          'sagCovTxt9=c=>{if(!c)return"";const a=[];if(c.d)a.push(c.d+(c.d===1?" ασθένεια":" ασθένειες"));if(c.p)a.push(c.p+(c.p===1?" έντομο ή ακάρι":" έντομα και ακάρεα"));'
          'let t=c.d+c.p?"Καλύπτονται "+(c.d+c.p)+": "+a.join(" · "):"Δεν καλύπτεται τώρα καμία ασθένεια ή εχθρός";'
          'if(c.u)t+=" · "+c.u+" χωρίς μετρήσεις τώρα";if(c.w)t+=" · "+c.w+" χωρίς υπολογισμό τώρα";return t},')

SUBS = [
  ('sagKindIcon=k9=>sagKindMap[k9]==="i"?', HELPER + 'sagKindIcon=k9=>sagKindMap[k9]==="i"?', "Κ1 βοηθός"),
  ('children:"Υπόμνημα: 🐛 έντομο · 🕷️ ακάρι · 🦠 βακτήριο · χωρίς σύμβολο = ασθένεια (μύκητας/ωομύκητας)"}),',
   'children:"Υπόμνημα: 🐛 έντομο · 🕷️ ακάρι · 🦠 βακτήριο · χωρίς σύμβολο = ασθένεια (μύκητας/ωομύκητας)"}),'
   '(()=>{const _c9=sagCov9(re,_hk9);if(!_c9)return null;return e.jsx("div",{id:"pathoCoverage",className:"muted",'
   'title:"Πόσες ασθένειες και εχθροί υπολογίζονται τώρα για αυτή την καλλιέργεια. Χωρίς μετρήσεις: λείπει θερμοκρασία ή υγρασία αέρα. Χωρίς υπολογισμό: λείπει αισθητήρας εδάφους ή το μοντέλο δεν έχει ακόμη το ερέθισμα που χρειάζεται.",'
   'style:{fontSize:".72rem",margin:"0 0 4px",fontWeight:600,color:_c9.d+_c9.p===0||_c9.u?"#b45309":"#15803d"},children:sagCovTxt9(_c9)})})(),',
   "Κ2 γραμμή κάλυψης"),
  ('if(k==="infection_model_status"){m=/(\\d+)\\s*μύκητ/.exec(v);return "Λειτουργεί"+(m?" · παρακολουθούνται "+m[1]+(m[1]==="1"?" ασθένεια":" ασθένειες")+" από μύκητες":"")}',
   'if(k==="infection_model_status"){const _c9=sagCov9(RM,_hk9);return "Λειτουργεί"+(_c9&&_c9.d?" · παρακολουθούνται "+_c9.d+(_c9.d===1?" ασθένεια":" ασθένειες"):"")}',
   "Κ3 κάρτα υγείας"),
]
for old, new, label in SUBS:
    n = s.count(old)
    assert n == 1, (label, n)
    s = s.replace(old, new)
    print("OK", label)

out = s.encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".mjs"); os.close(fd)
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8")
os.unlink(tmp)
assert r.returncode == 0, r.stderr[:600]
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
