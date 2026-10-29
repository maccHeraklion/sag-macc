# -*- coding: utf-8 -*-
# W-EC-ROOT-01 (29/10/2026, Μιχάλης: «προχώρα με το Β»). Αμμουδάρες (Νικολουδάκης): ο παραγωγός ρίχνει διάλυμα ~3,3 και
# έβλεπε «Αλατότητα εδάφους 1,71 dS/m» + «νερό ρίζας 3,14» (χωρίς μονάδα, ακατανόητο). Ο αριθμός που συγκρίνεται με ό,τι
# ρίχνει είναι η EC του νερού γύρω από τη ρίζα (soil_ec_pore, Hilhorst)· η ECe (soil_ece) είναι η κλίμακα του εργαστηρίου
# (αραίωση ως τον κορεσμό), όπου δίνονται τα όρια των καλλιεργειών. ΑΛΛΑΓΗ ΜΟΝΟ ΠΑΡΟΥΣΙΑΣΗΣ — καμία σταθερά, κανένας υπολογισμός:
#   1 πλακίδιο: «💧 EC στη ρίζα» σε mS/cm (μονάδα του αγωγιμόμετρου του παραγωγού, = dS/m) · «ρίχνετε X → στη ρίζα Y %»
#     (fert_ecw_dsm της φόρμας) · «κλίμακα εργαστηρίου (ECe) Z · όριο καλλιέργειας T». Η ένδειξη οργάνου φεύγει από το πλακίδιο.
#   2 διάγραμμα: σειρά soil_ec_pore με γραμμή «Διάλυμα που ρίχνετε»· αν λείπει, soil_ece με «Όριο καλλιέργειας (ECe)».
#   3 κουτί εξήγησης κάτω από τον τίτλο του διαγράμματος (όργανο → ρίζα → εργαστήριο).
#   4 ετικέτες soil_ec_pore*/soil_ece* στα ελληνικά που λέγονται στον παραγωγό.
# Το widget είναι ΜΙΑ γραμμή minified· κάθε αντικατάσταση count==1, αλλιώς τίποτα. LF.
import io, sys, hashlib, subprocess, tempfile, os
P = "_dist-sagMain/index-7cbd9a4e.js"
s = io.open(P, "r", encoding="utf-8", newline="").read()
assert "\r" not in s, "το widget πρέπει να είναι LF"
assert "W-EC-ROOT-01" not in s and "sagFertBox" not in s, "ήδη εφαρμοσμένο"
before = hashlib.sha256(s.encode("utf-8")).hexdigest()

def sub(a, b, label):
    global s
    n = s.count(a)
    if n != 1: sys.exit("ΑΠΟΤΥΧΙΑ %s: %d εμφανίσεις (αντί 1) για: %s" % (label, n, a[:80]))
    s = s.replace(a, b, 1); print("  OK", label)

# 1α · κουτί EC λιπάσματος (από τη ρύθμιση του αγρού)
sub('sagEceBox={v:null},sagEceSet=z=>{sagEceBox.v=(z&&typeof z==="object")?z:null},',
    'sagEceBox={v:null},sagEceSet=z=>{sagEceBox.v=(z&&typeof z==="object")?z:null},'
    'sagFertBox={v:null},sagFertSet=z=>{const n=Number(z);sagFertBox.v=(z!==null&&z!==undefined&&z!==""&&Number.isFinite(n)&&n>0)?n:null},',
    "1α κουτί λιπάσματος")
sub('sagMeterSet(!!(o&&String(o.has_water_meter)==="true"));return vv}catch(_e){sagCoveredSet(!1);return!1}',
    'sagMeterSet(!!(o&&String(o.has_water_meter)==="true"));sagFertSet(o&&o.fert_ecw_dsm);return vv}catch(_e){sagCoveredSet(!1);sagFertSet(null);return!1}',
    "1β τροφοδοσία από configuration")

# 1γ · πλακίδιο
sub('const p9=sagEceN9(R["soil_ec_pore"+q]),r9=sagEceN9(R["soil_ec_raw"+q]),d9=q==="1"?" Ρηχό":q==="2"?" Βαθύ":q?" "+q:"",'
    's9=[p9!==null?"νερό ρίζας "+sagEceF9(p9,2):"",r9!==null?"όργανο "+sagEceF9(r9,0)+" µS/cm":""].filter(Boolean).join(" · ");'
    'return{t:"🧂 Αλατότητα εδάφους"+d9,v:sagEceF9(e9,2)+" dS/m",sub:s9}}catch{return null}}',
    '/* W-EC-ROOT-01 */const p9=sagEceN9(R["soil_ec_pore"+q]),d9=q==="1"?" Ρηχό":q==="2"?" Βαθύ":q?" "+q:"",fz9=sagFertBox.v,'
    'tl9=Number(ec.metadata&&ec.metadata.tol),'
    'l9="κλίμακα εργαστηρίου (ECe) "+sagEceF9(e9,1)+(Number.isFinite(tl9)&&tl9>0?" · όριο καλλιέργειας "+sagEceF9(tl9,1):"");'
    'if(p9===null)return{t:"🧂 Αλατότητα εδάφους"+d9,v:sagEceF9(e9,1)+" dS/m",sub:l9};'
    'const s9=[fz9!==null?"ρίχνετε "+sagEceF9(fz9,1)+" → στη ρίζα "+Math.round(p9/fz9*100)+" %":"",l9].filter(Boolean).join(" · ");'
    'return{t:"💧 EC στη ρίζα"+d9,v:sagEceF9(p9,1)+" mS/cm",sub:s9}}catch{return null}}',
    "1γ πλακίδιο")

# 2 · διάγραμμα: αντικατάσταση ολόκληρου του εσωτερικού κλάδου ECe (από _sagEcK ως το return του)
A = 'const _sagEcK="soil_ece"+_sagEc9[1];'
Z = '$("dS/m");P(_l9);fe(!1);p(!0);return}'
assert s.count(A) == 1 and s.count(Z) == 1, "κλάδος διαγράμματος: άγκυρες"
i = s.index(A); j = s.index(Z, i) + len(Z)
assert j - i < 1200, "κλάδος διαγράμματος: απρόσμενο μήκος %d" % (j - i)
NEW_CHART = ('/* W-EC-ROOT-01 */const _q9=_sagEc9[1],_dp9=_q9==="2"?"Βαθύ":"Ρηχό",_R9=sagEceBox.v||{},'
  '_n9=k=>{const x=_R9[k];const v=x&&x.value;return v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v)},'
  '_fz9=sagFertBox.v,_pK9="soil_ec_pore"+_q9,_pS9=(t.history[h]||{})[_pK9]||[],_eK9="soil_ece"+_q9,_eS9=(t.history[h]||{})[_eK9]||[],'
  '_eM9=((re||{})[_eK9]||{}).metadata||{},_t9=Number(_eM9.tol),_p9=_n9(_pK9),_e9=_n9(_eK9),_r9=_n9("soil_ec_raw"+_q9),'
  '_x9=[_r9!==null?"Το όργανο μετρά χώμα, νερό και αέρα μαζί ("+sagEceF9(_r9,0)+" µS/cm) — αυτός ο αριθμός δεν συγκρίνεται με το διάλυμα.":"",'
  '(_p9!==null?"Από αυτό υπολογίζεται η EC του νερού γύρω από τη ρίζα ("+sagEceF9(_p9,1)+" mS/cm)":"Η EC του νερού γύρω από τη ρίζα")'
  '+", που συγκρίνεται με το διάλυμα που ρίχνετε"+(_fz9!==null?" ("+sagEceF9(_fz9,1)+" mS/cm)":"")+".",'
  '"Το εργαστήριο αραιώνει το ίδιο χώμα με νερό ως τον κορεσμό, γι\' αυτό δίνει μικρότερη τιμή"+(_e9!==null?" ("+sagEceF9(_e9,1)+")":"")'
  '+" — σε αυτή την κλίμακα (ECe) δίνονται τα όρια των καλλιεργειών"+(Number.isFinite(_t9)&&_t9>0?" ("+sagEceF9(_t9,1)+")":"")+".",'
  '"Το νερό της ρίζας αραιώνει με το πότισμα και πυκνώνει καθώς στεγνώνει το χώμα. Εκτίμηση χωρίς εργαστηριακή βαθμονόμηση."]'
  '.filter(Boolean).join(" ");'
  'if(_pS9.length){const _l9=[];_fz9!==null&&_l9.push({value:_fz9,label:"Διάλυμα που ρίχνετε",dashed:!0});'
  '_l9.push({value:NaN,label:"_ec10",txt:_x9});b(_pK9);B("💧 EC στη ρίζα "+_dp9+" — "+it(ue));w(h);j(_pS9);$("mS/cm");P(_l9);fe(!1);p(!0);return}'
  'if(_eS9.length){const _l9=[];Number.isFinite(_t9)&&_t9>0&&_l9.push({value:_t9,label:"Όριο καλλιέργειας (ECe)",dashed:!0});'
  '_l9.push({value:NaN,label:"_ec10",txt:_x9});b(_eK9);B("🧂 Αλατότητα "+_dp9+", κλίμακα εργαστηρίου (ECe) — "+it(ue));w(h);j(_eS9);$("dS/m");P(_l9);fe(!1);p(!0);return}')
s = s[:i] + NEW_CHART + s[j:]
print("  OK 2 διάγραμμα (αντικαταστάθηκαν %d χαρ.)" % (j - i))

# 3 · κουτί εξήγησης μέσα στο παράθυρο διαγράμματος (component Gs, prop refLines:p)
ANCH = ('e.jsx("div",{style:{display:"flex",justifyContent:"flex-end",marginBottom:4},children:e.jsxs("div",'
        '{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,fontSize:12},children:[e.jsxs("label"')
gs = s.index("const Gs=({open:t,variable:s,label:a,series:r,unit:i,refLines:p,")
ai = s.index(ANCH)
nxt = s.find("=({open:", gs + 20)
assert gs < ai and (nxt < 0 or ai < nxt), "το κουτί πρέπει να μπει μέσα στο Gs"
sub(ANCH,
    '(()=>{const _n10=(Array.isArray(p)?p:[]).find(x=>x&&x.label==="_ec10");return _n10&&typeof _n10.txt=="string"?'
    'e.jsx("div",{className:"muted",style:{fontSize:12,lineHeight:1.45,margin:"4px 0 8px"},children:_n10.txt}):null})(),' + ANCH,
    "3 κουτί εξήγησης")

# 4 · ετικέτες
sub('soil_ec_pore:{label:"💧 Αγωγιμότητα νερού πόρων",', 'soil_ec_pore:{label:"💧 EC στη ρίζα",', "4 ετικέτα pore")
sub('soil_ec_pore1:{label:"💧 Αγωγιμότητα νερού πόρων Ρηχό",', 'soil_ec_pore1:{label:"💧 EC στη ρίζα Ρηχό",', "4 ετικέτα pore1")
sub('soil_ec_pore2:{label:"💧 Αγωγιμότητα νερού πόρων Βαθύ",', 'soil_ec_pore2:{label:"💧 EC στη ρίζα Βαθύ",', "4 ετικέτα pore2")

assert "νερό ρίζας" not in s, "έμεινε «νερό ρίζας»"
b = s.encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".mjs"); os.write(fd, b); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
if r.returncode != 0: sys.exit("node --check: " + r.stderr[:400])
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("OK πριν", before[:16], "μετά", hashlib.sha256(b).hexdigest(), "bytes", len(b))
