# -*- coding: utf-8 -*-
"""Widget · T-SOILMODAL-01 · η καρτέλα υγρασίας εδάφους ξαναγράφεται για απόφαση.
LF, κάθε αντικατάσταση count==1, node --check, όλα-ή-τίποτα.

Τι αλλάζει (μόνο για soil_moisture*, τα άλλα διαγράμματα ανέπαφα):
  1. «Μέσος περιόδου / Μέγιστο / Ελάχιστο» φεύγουν· στη θέση τους ΔΗΛΩΣΗ ΚΑΛΥΨΗΣ
     (περίοδος, πλήθος μετρήσεων, βήμα, μεγαλύτερο κενό, εύρος).
  2. Η ετυμηγορία γίνεται «Απόφαση αγρού» από το ριζόστρωμα (βάση = soil_depth_basis),
     με τη συμμετοχή ΑΥΤΟΥ του αισθητήρα στην απόφαση και την κάρτα άρδευσης του πυρήνα.
  3. Νέα κάρτα «Τι είδε αυτός ο αισθητήρας»: ποτίσματα που έφτασαν σε αυτό το βάθος
     (άνοδος ≥1 μον. μεταξύ διαδοχικών μετρήσεων), μικρές άνοδοι (0,3–1), χρόνος από
     το τελευταίο, ρυθμός στεγνώματος (48 ω χωρίς άνοδο), ημέρες ως το σημείο ποτίσματος.
  4. Φεύγουν: η ζώνη «Στη δική του κλίμακα» και το κίτρινο «Τα όρια δεν σχεδιάζονται»
     (η ουσία του μπαίνει ως μία πρόταση στην κάρτα 3).
  5. Γραμμές διαγράμματος: «Ριζόστρωμα τώρα» ΔΕΝ σχεδιάζεται (τιμή «τώρα» σε άξονα
     χρόνου)· «Κάτω όριο»→«Πότισμα από εδώ» (ή «Ξηρό κάτω από εδώ» όταν υπάρχει
     ξεχωριστή έναρξη FAO-56), «Έναρξη άρδευσης»→«Πότισμα από εδώ», «Άνω όριο»→«Στόχος έως εδώ».
"""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read()
assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))

def sub(old, new, label):
    global s
    c = s.count(old)
    assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new)
    print("  OK", label)

def replace_span(start_marker, end_marker, new, label, keep_end=True):
    """Αντικαθιστά [start_marker … end_marker) — το end_marker μένει."""
    global s
    assert s.count(start_marker) == 1, f"{label}: αρχή {s.count(start_marker)} φορές"
    i = s.index(start_marker)
    j = s.index(end_marker, i)
    assert j > i, f"{label}: τέλος πριν την αρχή"
    assert s.count(end_marker) == 1, f"{label}: τέλος {s.count(end_marker)} φορές"
    s = s[:i] + new + s[j:]
    print("  OK", label, f"({j - i} → {len(new)} bytes)")

# ── 1. Η βάση των βαθών και η κάρτα άρδευσης περνούν στο modal μέσα από τα refLines ──
sub('pe[1]=Ke}P(pe)}else P([]);fe(!1),p(!0)};',
    'pe[1]=Ke}'
    'const _b10=re==null?void 0:re.soil_depth_basis==null?void 0:re.soil_depth_basis.value;'
    'typeof _b10=="string"&&_b10&&pe.push({value:NaN,label:"_basis10",txt:_b10});'
    'const _im10=re==null?void 0:re.irrigation_message==null?void 0:re.irrigation_message.value;'
    'typeof _im10=="string"&&_im10&&pe.push({value:NaN,label:"_irr10",txt:String(_im10).slice(0,160)});'
    'P(pe)}else P([]);fe(!1),p(!0)};',
    "T-SOILMODAL-01 βάση βαθών + κάρτα άρδευσης → refLines")

# ── 2. Ετυμηγορία → «Απόφαση αγρού» ──
VERDICT = (
 '_sagF10=(x,d)=>x==null||!Number.isFinite(x)?"—":new Intl.NumberFormat("el-GR",{maximumFractionDigits:d==null?1:d}).format(x),'
 '_sagSoilVerdict9=(c)=>{try{if(!c)return null;const _n=(x)=>Number.isFinite(Number(x))?Number(x):null;'
 'const zl=_n(c.zl),zu=_n(c.zu),st=_n(c.st),rz=_n(c.rz),last=_n(c.last);'
 'if(zl===null||zu===null||last===null||!(zu>zl))return null;const f=(x)=>_sagF10(x)+" %";'
 'const onRz=rz!==null;const b=onRz?rz:last;let tone,head;'
 'if(b<zl){tone="red";head="Απόφαση αγρού: ΠΟΤΙΣΜΑ — ριζόστρωμα "+f(b)+", κάτω από το κάτω όριο "+f(zl)+".";}'
 'else if(st!==null&&b<=st){tone="orange";head="Απόφαση αγρού: ώρα για πότισμα — ριζόστρωμα "+f(b)+", έφτασε το σημείο ποτίσματος "+f(st)+".";}'
 'else if(b>zu){tone="blue";head="Απόφαση αγρού: όχι πότισμα — ριζόστρωμα "+f(b)+", πάνω από τον στόχο "+f(zu)+".";}'
 'else{tone="green";head="Απόφαση αγρού: όχι πότισμα — ριζόστρωμα "+f(b)+", μέσα στον στόχο "+f(zl)+"–"+f(zu)+".";}'
 'const wt=Number.isFinite(Number(c.wt))?Number(c.wt):null;'
 'const body=onRz?("Η απόφαση βγαίνει από τη σταθμισμένη υγρασία του ριζοστρώματος ("+(c.basis||"όλα τα βάθη")+", κατά FAO-56 με το βάθος ρίζας του σταδίου) — όχι μόνο από αυτό το διάγραμμα. Αυτός ο αισθητήρας δείχνει "+f(last)+(wt!==null?" και μετρά στην απόφαση κατά "+_sagF10(wt,0)+" %":"")+".")'
 ':("Η απόφαση βγαίνει από αυτόν τον αισθητήρα ("+f(last)+"), επειδή δεν υπάρχει σταθμισμένη τιμή ριζοστρώματος για αυτόν τον αγρό.");'
 'return{tone:tone,head:head,body:body,irr:(typeof c.irr=="string"&&c.irr)?c.irr:null};}catch{return null}}'
)
replace_span('_sagSoilVerdict9=(c)=>{try{if(!c)return null;', ',_sagChk7=l.useMemo(', VERDICT,
             "T-SOILMODAL-01 ετυμηγορία → απόφαση αγρού")

# ── 3. Νέο memo _sagEv10: κάλυψη, ποτίσματα ανά βάθος, στέγνωμα, συμμετοχή ──
EV = (
 '},[V,p,m,s]),_sagEv10=l.useMemo(()=>{try{if(!_sagChk7)return null;'
 'const sv=(Array.isArray(V)?V:[]).map(a=>[typeof a[0]=="number"?a[0]:Date.parse(a[0]),Number(a[1])]).filter(a=>Number.isFinite(a[0])&&Number.isFinite(a[1])).sort((a,b)=>a[0]-b[0]);'
 'if(sv.length<6)return null;const n=sv.length,t0=sv[0][0],t1=sv[n-1][0];'
 'const gaps=[];for(let i=1;i<n;i++)gaps.push(sv[i][0]-sv[i-1][0]);gaps.sort((a,b)=>a-b);'
 'const stepMin=gaps.length?gaps[Math.floor(gaps.length/2)]/6e4:null;const maxGapH=gaps.length?gaps[gaps.length-1]/36e5:null;'
 'const ev=[],small=[];for(let i=1;i<n;i++){const d=sv[i][1]-sv[i-1][1];if(d>=1)ev.push({t:sv[i][0],d:d});else if(d>=.3)small.push({t:sv[i][0],d:d})}'
 'const lastEv=ev.length?ev[ev.length-1]:null,lastSmall=small.length?small[small.length-1]:null;'
 'let dry=null;{const from=t1-48*36e5;const seg=[];for(let i=n-1;i>=0;i--){if(sv[i][0]<from)break;if(i>0&&(sv[i][1]-sv[i-1][1])>=.3){seg.push(sv[i]);break}seg.push(sv[i])}'
 'if(seg.length>=6){seg.reverse();const a=seg[0],b=seg[seg.length-1];const h=(b[0]-a[0])/36e5;if(h>=12)dry={perDay:(a[1]-b[1])/h*24,hours:h}}}'
 'const last=sv[n-1][1];const trig=(Number.isFinite(_sagChk7.st)&&_sagChk7.st>0)?_sagChk7.st:_sagChk7.zl;'
 'let daysTo=null;if(dry&&dry.perDay>.05&&Number.isFinite(trig)&&last>trig)daysTo=(last-trig)/dry.perDay;'
 'const pickT=l9=>{const e9=(Array.isArray(p)?p:[]).find(x9=>x9&&x9.label===l9);return e9&&typeof e9.txt=="string"?e9.txt:null};'
 'const basis=pickT("_basis10"),irr=pickT("_irr10");const idx=/2$/.test(String(s||""))?1:0;let wt=null;'
 'if(basis){const ms=[...basis.matchAll(/(\\d+(?:[.,]\\d+)?)\\s*cm\\s*\\((\\d+)\\s*%\\)/g)];if(ms.length>=2)wt=Number(ms[idx][2]);else if(/^Ένα βάθος/.test(basis))wt=((idx===1)===/βαθύς/.test(basis))?100:0}'
 'return{n:n,t0:t0,t1:t1,stepMin:stepMin,maxGapH:maxGapH,ev:ev,small:small,lastEv:lastEv,lastSmall:lastSmall,dry:dry,daysTo:daysTo,basis:basis,irr:irr,wt:wt,last:last,trig:trig,sinceH:lastEv?(t1-lastEv.t)/36e5:null}}catch{return null}},[V,p,s,_sagChk7]),he=l.useMemo('
)
sub('},[V,p,m,s]),he=l.useMemo(', EV, "T-SOILMODAL-01 memo _sagEv10")

# ── 4. Η γραμμή «Ριζόστρωμα τώρα» δεν σχεδιάζεται σε άξονα χρόνου ──
sub('(I.converted<_sagChk7.mn||I.converted>_sagChk7.mx))),[p,m,_sagChk7])',
    '(I.converted<_sagChk7.mn||I.converted>_sagChk7.mx))).filter(I=>I.label!=="Ριζόστρωμα τώρα (σταθμ. FAO-56)"),[p,m,_sagChk7])',
    "T-SOILMODAL-01 χωρίς γραμμή «Ριζόστρωμα τώρα»")

# ── 5. Ονόματα γραμμών που καταλαβαίνει ο αγρότης ──
sub('return K?`${K}: ${q}`:q}},data:(()=>{const q9=he.map(',
    'const _dn9={"Κάτω όριο":(he.some(z9=>z9&&z9.label==="Έναρξη άρδευσης")?"Ξηρό κάτω από εδώ":"Πότισμα από εδώ"),"Έναρξη άρδευσης":"Πότισμα από εδώ","Άνω όριο":"Στόχος έως εδώ"};'
    'const K2=_dn9[K]||K;return K?`${K2}: ${q}`:q}},data:(()=>{const q9=he.map(',
    "T-SOILMODAL-01 ετικέτες γραμμών")

# ── 6. Μέσος/Μέγιστο/Ελάχιστο κρύβονται στα διαγράμματα υγρασίας εδάφους ──
sub('w.showAverage&&e.jsxs("div",{className:"statBadge",children:[e.jsx("span",{className:"s-label",children:"Μέσος περιόδου:"})',
    'w.showAverage&&!_sagChk7&&e.jsxs("div",{className:"statBadge",children:[e.jsx("span",{className:"s-label",children:"Μέσος περιόδου:"})',
    "T-SOILMODAL-01 κρύψιμο «Μέσος περιόδου»")
sub('w.showMax&&e.jsxs("div",{className:"statBadge",children:[e.jsx("span",{className:"s-label",children:"Μέγιστο:"})',
    'w.showMax&&!_sagChk7&&e.jsxs("div",{className:"statBadge",children:[e.jsx("span",{className:"s-label",children:"Μέγιστο:"})',
    "T-SOILMODAL-01 κρύψιμο «Μέγιστο»")
sub('w.showMin&&e.jsxs("div",{className:"statBadge",children:[e.jsx("span",{className:"s-label",children:"Ελάχιστο:"})',
    'w.showMin&&!_sagChk7&&e.jsxs("div",{className:"statBadge",children:[e.jsx("span",{className:"s-label",children:"Ελάχιστο:"})',
    "T-SOILMODAL-01 κρύψιμο «Ελάχιστο»")

# ── 7. Το μπλοκ κάτω από τα στατιστικά ξαναγράφεται ──
START = '_sagChk7?e.jsxs("div",{style:{margin:"6px 0 8px",display:"flex",flexDirection:"column",gap:6},children:['
END = ',e.jsx("div",{style:{display:"flex",justifyContent:"flex-end",marginBottom:4}'
i = s.index(START); j = s.index(END, i)
old_block = s[i:j]
# κρατάμε αυτούσιο το υπάρχον μπλοκ «δεν αποκρίνεται»
fa = old_block.index('_sagChk7.flat?e.jsxs(')
fb = old_block.index('ελέγξτε το όργανο."]}):null,') + len('ελέγξτε το όργανο."]}):null,')
FLAT = old_block[fa:fb]
assert 'Στη δική του κλίμακα' in old_block and 'Τα όρια δεν σχεδιάζονται' in old_block
BLOCK = (
 START +
 '_sagEv10?e.jsx("div",{style:{fontSize:11.5,color:"#475569"},children:"Στο διάγραμμα: "+te(_sagEv10.t0)+" – "+te(_sagEv10.t1)+" · "+_sagEv10.n+" μετρήσεις"'
 '+(_sagEv10.stepMin!==null?" · μία κάθε ≈"+Math.round(_sagEv10.stepMin)+"΄":"")'
 '+(_sagEv10.maxGapH!==null&&_sagEv10.maxGapH>3?" · μεγαλύτερο κενό "+_sagF10(_sagEv10.maxGapH)+" ώρες":"")'
 '+" · εύρος "+_sagF10(_sagChk7.mn)+"–"+_sagF10(_sagChk7.mx)+" %"}):null,'
 + FLAT +
 '(()=>{const _vd=_sagSoilVerdict9(Object.assign({},_sagChk7,_sagEv10||{}));if(!_vd)return null;'
 'const _C={red:["#fef2f2","#fecaca","#b91c1c"],orange:["#fff7ed","#fed7aa","#9a3412"],green:["#f0fdf4","#bbf7d0","#166534"],blue:["#eff6ff","#bfdbfe","#1e40af"]}[_vd.tone];'
 'return e.jsxs("div",{style:{background:_C[0],border:"1px solid "+_C[1],borderRadius:8,padding:"9px 11px",fontSize:12.5,lineHeight:1.45,color:_C[2]},children:['
 'e.jsx("div",{style:{fontWeight:700,marginBottom:3},children:_vd.head}),'
 'e.jsx("div",{style:{fontSize:11.5,opacity:.9},children:_vd.body}),'
 '_vd.irr?e.jsx("div",{style:{fontSize:11.5,opacity:.9,marginTop:3},children:"Κάρτα άρδευσης τώρα: «"+_vd.irr+"»"}):null]})})(),'
 '(_sagEv10&&!_sagChk7.flat)?e.jsxs("div",{style:{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",fontSize:12,lineHeight:1.45,color:"#1e293b"},children:['
 'e.jsx("b",{children:"Τι είδε αυτός ο αισθητήρας"+(_sagEv10.wt!==null?" (συμμετοχή στην απόφαση "+_sagF10(_sagEv10.wt,0)+" %)":"")+". "}),'
 '(_sagEv10.ev.length?"Ποτίσματα που έφτασαν σε αυτό το βάθος: "+_sagEv10.ev.length+" — τελευταίο "+te(_sagEv10.lastEv.t)+" (+"+_sagF10(_sagEv10.lastEv.d)+" μον.)."'
 ':(_sagEv10.small.length?"Κανένα καθαρό πότισμα (άνοδος ≥1 μον.) — μόνο "+_sagEv10.small.length+" μικρές άνοδοι (0,3–1 μον.), τελευταία "+te(_sagEv10.lastSmall.t)+": το νερό φτάνει ελάχιστα σε αυτό το βάθος."'
 ':"Καμία άνοδος υγρασίας στην περίοδο — κανένα πότισμα δεν φάνηκε σε αυτό το βάθος.")),'
 '(_sagEv10.sinceH!==null&&_sagEv10.sinceH>36?" Από τότε ("+_sagF10(_sagEv10.sinceH/24)+" ημέρες) καμία άνοδος: ή δεν ποτίστηκε, ή το νερό δεν φτάνει ως τον αισθητήρα.":""),'
 '(_sagEv10.dry?" Στέγνωμα: "+_sagF10(_sagEv10.dry.perDay,2)+" μον./ημέρα (τελευταίες "+Math.round(_sagEv10.dry.hours)+" ώρες χωρίς πότισμα)."'
 '+(_sagEv10.daysTo!==null?" Με αυτόν τον ρυθμό φτάνει το σημείο ποτίσματος ("+_sagF10(_sagEv10.trig)+" %) σε ≈"+_sagF10(_sagEv10.daysTo,0)+" ημέρες."'
 ':((Number.isFinite(_sagEv10.trig)&&_sagEv10.last<=_sagEv10.trig)?" Είναι ήδη κάτω από το σημείο ποτίσματος ("+_sagF10(_sagEv10.trig)+" %).":"")):""),'
 '((_sagChk7.ovr!==null&&_sagChk7.ovr<=0)?" Τα όρια του πίνακα ("+_sagF10(_sagChk7.zl)+"–"+_sagF10(_sagChk7.zu)+" %) είναι έξω από ό,τι μέτρησε αυτός ο αισθητήρας ("+_sagF10(_sagChk7.mn)+"–"+_sagF10(_sagChk7.mx)+" %) και δεν σχεδιάζονται· το σύστημα μαθαίνει το πραγματικό όριο από τα ποτίσματα.":"")'
 ']}):null]}):null'
)
s = s[:i] + BLOCK + s[j:]
print("  OK T-SOILMODAL-01 μπλοκ καρτέλας", f"({len(old_block)} → {len(BLOCK)} bytes)")
assert 'Στη δική του κλίμακα' not in s and 'Τα όρια δεν σχεδιάζονται' not in s and 'Η ετυμηγορία βγαίνει' not in s

out = s.encode("utf-8")
tmp = P.replace(".js", ".check.js")
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True)
os.remove(tmp)
if r.returncode:
    print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ — τίποτα δεν γράφτηκε")
io.open(P, "wb").write(out)
chk = io.open(P, "rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk))
