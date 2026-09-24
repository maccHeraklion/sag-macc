# -*- coding: utf-8 -*-
"""Widget · T-BPIDAYS-W-01 + T-SOILCAL-W-01 + T-ACCUMBASIS-W-01 (§8.2, §8.3, §8.5 της απογραφής 24/9).
LF, κάθε αντικατάσταση count==1, node --check, όλα-ή-τίποτα.

  T-BPIDAYS-W-01   «Αξιοποίηση σεζόν: 46 %» → «… (σε N ημέρες με πλήρη δεδομένα)» από το bpi_total_days (v50.151).
  T-SOILCAL-W-01   στην καρτέλα υγρασίας εδάφους: «Μάθηση πραγματικών ορίων από τα ποτίσματα: k/3 δείγματα»
                   από το soilcal_state (s = ρηχός, d = βαθύς)· το 3 είναι το `(st.n || 0) >= 3` του πυρήνα (:11459).
  T-ACCUMBASIS-W-01 στην κάρτα «Πώς υπολογίστηκαν»: σταθερή γραμμή «Βάση συσσωρευτών» (βαθμοημέρες, ώρες
                   μόλυνσης) — ανά ώρα, παλμός 0,5–2 ω, κενά ≤48 ω κλιματολογικά, >90΄ παγώνει. Οι αριθμοί
                   αντιγράφουν τις σταθερές του πυρήνα (_SAG_TICK_H_MIN/MAX, _SAG_TICK_GAP_MAX_H, _SAG_AGE_LIMITS)
                   και ο ελεγκτής τις διασταυρώνει με τον πυρήνα. Σταθερό κείμενο = μηδέν bytes στο bundle.
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

# ── T-BPIDAYS-W-01 ──
sub('y=Number.isFinite(f)?Math.round(f):null,S=n==null?void 0:n.bpi_loss_bucket,',
    'y=Number.isFinite(f)?Math.round(f):null,_pd=Number(n==null?void 0:n.bpi_total_days==null?void 0:n.bpi_total_days.value),'
    'perfDays=(Number.isFinite(_pd)&&_pd>0)?Math.round(_pd):null,S=n==null?void 0:n.bpi_loss_bucket,',
    "T-BPIDAYS-W-01 perfDays από bpi_total_days")
sub('return{stomata:c,perfPct:y,bucketLabel:X,',
    'return{stomata:c,perfPct:y,perfDays:perfDays,bucketLabel:X,',
    "T-BPIDAYS-W-01 perfDays στο Le")
sub('children:["Αξιοποίηση σεζόν: ",Le.perfPct,"%"]',
    'children:["Αξιοποίηση σεζόν: ",Le.perfPct,"%",Le.perfDays!==null?" (σε "+Le.perfDays+(Le.perfDays===1?" ημέρα":" ημέρες")+" με πλήρη δεδομένα)":""]',
    "T-BPIDAYS-W-01 κείμενο κάρτας")

# ── T-SOILCAL-W-01 ──
sub('typeof _im10=="string"&&_im10&&pe.push({value:NaN,label:"_irr10",txt:String(_im10).slice(0,160)});',
    'typeof _im10=="string"&&_im10&&pe.push({value:NaN,label:"_irr10",txt:String(_im10).slice(0,160)});'
    'const _sc10=re==null?void 0:re.soilcal_state==null?void 0:re.soilcal_state.value;'
    '_sc10&&pe.push({value:NaN,label:"_scal10",txt:typeof _sc10=="string"?_sc10:JSON.stringify(_sc10)});',
    "T-SOILCAL-W-01 soilcal_state → refLines")
sub('const basis=pickT("_basis10"),irr=pickT("_irr10");const idx=/2$/.test(String(s||""))?1:0;let wt=null;',
    'const basis=pickT("_basis10"),irr=pickT("_irr10");const idx=/2$/.test(String(s||""))?1:0;let wt=null;'
    'let scHas=false,scN=0,scF=null;try{const _scj=pickT("_scal10");const _sco=_scj?JSON.parse(_scj):null;'
    'const _scs=_sco?(idx===1?_sco.d:_sco.s):null;if(_scs&&typeof _scs=="object"){scHas=true;'
    'scN=Number.isFinite(Number(_scs.n))?Math.max(0,Math.floor(Number(_scs.n))):0;scF=Number.isFinite(Number(_scs.f))?Number(_scs.f):null}}catch{}',
    "T-SOILCAL-W-01 ανάγνωση s/d ανά βάθος")
sub('wt:wt,last:last,trig:trig,sinceH:lastEv?(t1-lastEv.t)/36e5:null}}catch{return null}},[V,p,s,_sagChk7])',
    'wt:wt,last:last,trig:trig,sinceH:lastEv?(t1-lastEv.t)/36e5:null,scHas:scHas,scN:scN,scF:scF}}catch{return null}},[V,p,s,_sagChk7])',
    "T-SOILCAL-W-01 scHas/scN/scF στο memo")
sub('και δεν σχεδιάζονται· το σύστημα μαθαίνει το πραγματικό όριο από τα ποτίσματα.":"")]}):null]}):null',
    'και δεν σχεδιάζονται· το σύστημα μαθαίνει το πραγματικό όριο από τα ποτίσματα.":""),'
    '(_sagEv10.scHas?" Μάθηση πραγματικών ορίων από τα ποτίσματα (αυτό το βάθος): "+_sagEv10.scN+"/3 δείγματα"'
    '+(_sagEv10.scF!==null?" · εκτίμηση μετά από πότισμα "+_sagF10(_sagEv10.scF)+" %":"")'
    '+(_sagEv10.scN>=3?" — αρκετά για να προσαρμοστούν τα όρια.":" — μέχρι τότε ισχύουν τα όρια του πίνακα."):"")'
    ']}):null]}):null',
    "T-SOILCAL-W-01 κείμενο k/3")

# ── T-ACCUMBASIS-W-01 ──
sub('kernel_version:"Έκδοση συστήματος υπολογισμών"};',
    'kernel_version:"Έκδοση συστήματος υπολογισμών",accumulator_basis:"Βάση συσσωρευτών (βαθμοημέρες, ώρες μόλυνσης)"};',
    "T-ACCUMBASIS-W-01 ετικέτα")
sub('const TR=Object.keys(TL).map(k=>({k,d:TB[k]})).filter(x=>x.d&&x.d.value!==null&&x.d.value!==void 0&&String(x.d.value)!=="");if(!TR.length)return null;',
    'const TR=Object.keys(TL).map(k=>({k,d:TB[k]})).filter(x=>x.d&&x.d.value!==null&&x.d.value!==void 0&&String(x.d.value)!=="");'
    'if(TB.gdd_crop_status||TB.infection_model_status)TR.push({k:"accumulator_basis",d:{value:"Ανά ώρα, από την τελευταία μέτρηση",metadata:{text:'
    '"Οι βαθμοημέρες και οι ώρες μόλυνσης προχωρούν σε κάθε ωριαίο κύκλο κατά τις ώρες που πραγματικά πέρασαν (0,5–2 ώρες), με την τελευταία μέτρηση αέρα. '
    'Κενό επικοινωνίας έως 48 ώρες συμπληρώνεται από την κλιματική νόρμα της περιοχής και δηλώνεται· πάνω από 48 ώρες δεν συμπληρώνεται. '
    'Μέτρηση αέρα παλαιότερη από 90΄ παγώνει τις ώρες μόλυνσης — δεν τις μηδενίζει. Οι συσσωρευτές δεν λήγουν ποτέ."}}});'
    'if(!TR.length)return null;',
    "T-ACCUMBASIS-W-01 γραμμή στην κάρτα «Πώς υπολογίστηκαν»")

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
