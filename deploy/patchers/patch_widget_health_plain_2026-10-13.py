# -*- coding: utf-8 -*-
"""Widget · T-HEALTH-PLAIN-01 (εντολή Μιχάλη 13/10, στιγμιότυπα Ρηγάκης Αντώνης: «Η Υγεία εγκατάστασης και το Πώς
υπολογίστηκαν έχουν ακατανόητα μηνύματα με συντομεύσεις… Τα τρία θέματα δεν είναι θέματα… περιττή και άχρηστη
πληροφορία για τον αγρότη — βελτίωσέ το»).

ΠΡΙΝ: μία κάρτα «🩺 Υγεία εγκατάστασης» με 40 κλειδιά ανάμεικτα (βλάβες + καιρός + αλατότητα + μεθοδολογία)· ως «θέμα»
μετρούσε ΚΑΘΕ πορτοκαλί, άρα «3 θέματα» στον Ρηγάκη = πρόγνωση μόλυνσης + «αισθητήρας κόμης» + «αισθητήρας φύλλου»
(κανένα δεν είναι βλάβη). «Πώς υπολογίστηκαν»: ωμές γραμμές κάρτας μεθόδου («orange:2/leaf_wetness_source: …»,
«koroneiki:1/bpi_comparability: …»), BPI/DLI/HS/FAO-56, έκδοση πυρήνα, κείμενο συσσωρευτών.

ΜΕΤΑ (μόνο εμφάνιση — καμία τιμή/υπολογισμός/δόση δεν αλλάζει, ο πυρήνας άθικτος):
  1. «🩺 Υγεία εγκατάστασης» = ΜΟΝΟ όργανα, δεδομένα, ρυθμίσεις και αν τρέχουν οι υπολογισμοί. «Θέμα» = μόνο ό,τι από
     αυτά είναι κόκκινο/πορτοκαλί/κίτρινο. Τα εντάξει σε ένα κλειστό «Λειτουργούν κανονικά» με απλή φράση
     («Λειτουργεί · παρακολουθούνται 6 ασθένειες από μύκητες» αντί «Ενεργές · 6 μύκητες · μέγ. 5 ω»).
  2. ΝΕΑ «📢 Ειδοποιήσεις για τον αγρό» = καιρός/ασθένειες/άλατα που ΘΕΛΟΥΝ προσοχή (όχι πράσινα/γκρι). Η πρόγνωση
     μόλυνσης και η βροχή ξαναγράφονται σε απλά ελληνικά χωρίς κεφαλαία· αν το κείμενο του πυρήνα αλλάξει μορφή,
     φαίνεται αυτούσιο (καμία απώλεια).
  3. «🔍 Πώς υπολογίστηκαν» = μόνο ό,τι αφορά τον αγρότη: έκταση δόσης, αλατότητα νερού/απόδοση δικτύου, στάδιο,
     τύπος εδάφους, βάθη αισθητήρων, υγρασία ριζών, πέτρες, εξατμισοδιαπνοή, από πού έρχονται θερμοκρασία και
     βρέξιμο φύλλου. Χωρίς ωμά κλειδιά, χωρίς «στρ.»/«κ.ό.»/ECw/BPI/DLI/HS/FAO-56. Έκδοση μόνο ως μικρή υποσημείωση.
Αφαιρούνται από την οθόνη (υπάρχουν αλλού ή είναι εσωτερικά): ipsi_primary_cause, bpi_daily_status, PTQ, ECe ανά
βάθος (είναι στις «Μετρήσεις»), soil_temp_source, sensor_redundancy, κάρτα μεθόδου ανά καλλιέργεια, συσσωρευτές,
«N επεξηγήσεις δεν χώρεσαν». Βάση: ζωντανό 8b3f15d7 (T-VPD-SHOW-02). LF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
W = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(W, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
w = raw.decode("utf-8"); print("ΠΡΙΝ widget", hashlib.sha256(raw).hexdigest()[:16], len(raw))
assert "T-HEALTH-PLAIN-01" not in w, "ήδη εφαρμοσμένο"

START = "(()=>{let RM;try{RM=re}catch(_hx){return null}if(!RM)return null;const HL={"
END = ',e.jsxs("div",{className:"card",id:"varsCard"'
assert w.count(START) == 1, "αρχή κάρτας υγείας"
assert w.count(END) == 1, "αρχή κάρτας μετρήσεων"
a = w.index(START); b = w.index(END)
OLD = w[a:b]
for must in ('id:"healthCard"', 'id:"basisCard"', "Μέθοδος (ημερήσια κάρτα)", "Βάση συσσωρευτών", "δεν χώρεσαν"):
    assert OLD.count(must) == 1, "παλιό τμήμα χωρίς: " + must
assert 8000 < len(OLD) < 10000, len(OLD)

# Κάθε γραμμή τελειώνει σε ; ή σε σημείο έκφρασης — οι γραμμές ενώνονται χωρίς αλλαγή γραμμής.
NEW = r'''
(()=>{let RM;try{RM=re}catch(_hx){return null}if(!RM)return null;/*T-HEALTH-PLAIN-01 υγεία*/
const G=k=>{const d=RM[k];return d&&d.value!==null&&d.value!==void 0&&String(d.value)!==""?d:null};
const CO=d=>String(((d||{}).metadata||{}).color||"");
const BADC=c=>c==="red"||c==="orange"||c==="yellow";
const PL=s=>String(s).replace(/ ?κ\.ό\./g,"").replace(/στρ\./g,"στρέμματα");
const DOT={red:"#dc2626",orange:"#ea580c",yellow:"#d97706",green:"#16a34a",blue:"#2563eb",grey:"#6b7280"};
const HK=[["sensor_faults","Όργανα αγρού"],["device_battery","Μπαταρίες οργάνων"],["sensor_alert","Αισθητήρας φύλλου"],["leaf_sensor_placement","Τοποθέτηση αισθητήρα φύλλου"],["measurement_age","Πόσο πρόσφατες είναι οι μετρήσεις"],["stale_measurement_groups","Μετρήσεις που καθυστερούν"],["avg_window_status","Πληρότητα μετρήσεων 24ώρου"],["sensor_quality","Αξιοπιστία μετρήσεων"],["device_mapping_status","Αναγνώριση οργάνων"],["sensor_divergence","Αισθητήρες υγρασίας που διαφωνούν"],["irrigation_config_error","Ρύθμιση άρδευσης"],["soil_moisture_limits_status","Τύπος εδάφους στη φόρμα"],["hidden_advice","Συμβουλές που αποσύρθηκαν"],["forecast_status","Πρόγνωση καιρού"],["infection_model_status","Παρακολούθηση ασθενειών"],["gdd_pest_status","Παρακολούθηση εντόμων"],["gdd_crop_status","Παρακολούθηση ανάπτυξης"],["irrigation_dose_basis","Στοιχεία άρδευσης στη φόρμα",1]];
const OKV=(k,d)=>{const v=String(d.value);let m;
if(k==="infection_model_status"){m=/(\d+)\s*μύκητ/.exec(v);return "Λειτουργεί"+(m?" · παρακολουθούνται "+m[1]+(m[1]==="1"?" ασθένεια":" ασθένειες")+" από μύκητες":"")}
if(k==="gdd_pest_status"){m=/(\d+)\s*εχθρ/.exec(v);return "Λειτουργεί"+(m?" · παρακολουθούνται "+m[1]+(m[1]==="1"?" εχθρός":" εχθροί")+" (έντομα, ακάρεα)":"")}
if(k==="gdd_crop_status"||k==="forecast_status")return "Λειτουργεί";
return PL(v)};
const HT=(k,md)=>{try{if(k==="measurement_sources")return _sagSrcTxt9||"";if(k==="device_battery"){const _ks=Object.keys(_sagBat9||{});if(!_ks.length)return "";const _tail=String(md&&md.text||"").split("—").slice(1).join("—").trim();return _ks.map(_k=>{const _e=(_sagInv9||{})[_k];return ((_e&&_e.n)?_e.n:_k)+": "+_sagBat9[_k]}).join(" · ")+(_tail?" — "+_tail:"")}return PL(String(md&&md.text||""))}catch{return String(md&&md.text||"")}};
const ALL=HK.map(([k,l,po])=>({k,l,po,d:G(k)})).filter(x=>x.d).filter((x,_i,arr)=>!(x.k==="leaf_sensor_placement"&&arr.some(z=>z.k==="sensor_alert"))).filter(x=>!(x.po&&!BADC(CO(x.d))));
const BAD=ALL.filter(x=>BADC(CO(x.d)));
const OK=ALL.filter(x=>!BADC(CO(x.d)));
const SRC=G("measurement_sources"),UPG=G("upgrade_opportunities");
if(!ALL.length&&!SRC&&!UPG)return null;
const DT=c=>e.jsx("span",{style:{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block",flex:"0 0 auto"}});
const ROW=(x,ok)=>{const md=x.d.metadata||{};const cl=ok?DOT.green:(DOT[CO(x.d)]||DOT.grey);const v=ok?OKV(x.k,x.d):PL(x.d.value);const t=(ok&&x.k!=="device_battery")?"":HT(x.k,md);
return e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[DT(cl),e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:x.l}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:v})]}),t?e.jsx("div",{style:{fontSize:12,color:"#475569",marginTop:2},children:t}):null]},x.k)};
const INF=(k,l,t)=>t?e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsx("div",{style:{fontSize:12,color:"#64748b"},children:l}),e.jsx("div",{style:{fontSize:12,color:"#475569",marginTop:2},children:t})]},k):null;
return e.jsxs("details",{className:"card",id:"healthCard",children:[e.jsxs("summary",{style:{cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},children:["🩺 Υγεία εγκατάστασης",BAD.length?e.jsx("span",{style:{color:"#b45309",fontWeight:600,fontSize:13},children:BAD.length===1?"1 θέμα":BAD.length+" θέματα"}):e.jsx("span",{style:{color:"#15803d",fontWeight:600,fontSize:13},children:"όλα λειτουργούν"})]}),
e.jsxs("div",{style:{marginTop:10,display:"flex",flexDirection:"column",gap:8},children:[e.jsx("div",{style:{fontSize:12,color:"#64748b"},children:"Αν τα όργανα του αγρού στέλνουν σωστά μετρήσεις και αν οι υπολογισμοί τρέχουν. Καιρός και κίνδυνοι είναι στις «Ειδοποιήσεις για τον αγρό»."}),
BAD.map(x=>ROW(x,false)),
(OK.length||SRC||UPG)?e.jsxs("details",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("summary",{style:{cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[DT(DOT.green),e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:OK.length?"Λειτουργούν κανονικά":"Λεπτομέρειες"}),OK.length?e.jsx("span",{style:{fontSize:13,fontWeight:600},children:OK.length+(OK.length===1?" έλεγχος":" έλεγχοι")}):null]}),
e.jsxs("div",{style:{marginTop:6,display:"flex",flexDirection:"column",gap:8,paddingLeft:14},children:[OK.map(x=>ROW(x,true)),SRC?INF("measurement_sources","Ποιο όργανο μετρά τι",HT("measurement_sources",SRC.metadata||{})):null,UPG?INF("upgrade_opportunities","Προτάσεις για επιπλέον όργανα",PL(String((UPG.metadata||{}).text||UPG.value))):null]})]},"okgroup"):null]})]})})(),
(()=>{let RA;try{RA=re}catch(_ax){return null}if(!RA)return null;/*T-HEALTH-PLAIN-01 ειδοποιήσεις*/
const AK=[["frost_warning","Παγετός"],["heat_warning","Καύσωνας"],["night_temp_warning","Νυχτερινή θερμοκρασία"],["rain_ahead","Βροχή τις επόμενες ώρες"],["infection_ahead","Καιρός που ευνοεί ασθένειες"],["pesticide_washoff_mm","Ξέπλυμα ψεκασμού από τη βροχή"],["irrigation_warning","Νερό άρδευσης"],["salinity_stress","Άλατα στο έδαφος"],["soil_ec_status","Αλατότητα εδάφους"],["soil_ph_status","pH εδάφους"],["soil_depth_divergence","Ρηχό και βαθύ στρώμα εδάφους διαφέρουν"]];
const DOT={red:"#dc2626",orange:"#ea580c",yellow:"#d97706",blue:"#2563eb"};
const RWS=AK.map(([k,l])=>({k,l,d:RA[k]})).filter(x=>x.d&&x.d.value!==null&&x.d.value!==void 0&&String(x.d.value)!=="").filter(x=>{const c=String((x.d.metadata||{}).color||"");return c!=="green"&&c!=="grey"});
if(!RWS.length)return null;
const VT=x=>{const md=x.d.metadata||{},v=x.d.value,t=String(md.text||"");let m;
if(x.k==="infection_ahead"){m=/^(\d+)/.exec(String(v));const n=Number(md.count)||(m?Number(m[1]):0);const h=/έως (\d+) συνεχόμενες ώρες/.exec(t),p=/εύρος μόλυνσης για: (.+?)\. Ο ΚΙΝΔΥΝΟΣ/.exec(t);
return [n?"Ευνοϊκός για "+n+(n===1?" ασθένεια":" ασθένειες"):String(v),(h&&p)?"Η πρόγνωση δίνει έως "+h[1]+" συνεχόμενες ώρες με υγρασία και θερμοκρασία που ευνοούν: "+p[1]+". Αν σκοπεύετε προληπτικό ψεκασμό, κάντε τον ώστε να προλάβει να στεγνώσει πριν τη βροχή. Ο κίνδυνος στις κάρτες ασθενειών αλλάζει μόνο με όσα μετρηθούν στον αγρό.":t]}
if(x.k==="rain_ahead"){const r=/συνολικά ([\d.,]+) mm βροχής μέσα στις επόμενες (\d+) ώρες, με αρχή γύρω στις (.+?)\. /.exec(t);
return [r?r[1]+" mm":String(v),r?"Η πρόγνωση δίνει "+r[1]+" mm μέσα στις επόμενες "+r[2]+" ώρες, με αρχή γύρω στις "+r[3]+". Η δόση νερού αλλάζει μόνο όταν η βροχή μετρηθεί στον αγρό· αν θέλετε, αναβάλετε το πότισμα και δείτε αύριο.":t]}
if(x.k==="soil_depth_divergence"){m=/\(([\d.,]+) % στα (\d+) cm έναντι ([\d.,]+) % στα (\d+) cm\)/.exec(t);return [m?"ρηχό "+m[1]+" % · βαθύ "+m[3]+" %":String(v),t]}
if(typeof v==="number"&&Number.isFinite(v))return [v.toLocaleString("el-GR",{maximumFractionDigits:1})+(md.unit?" "+md.unit:""),t];
return [String(v),t]};
return e.jsxs("details",{className:"card",id:"alertsCard",children:[e.jsxs("summary",{style:{cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},children:["📢 Ειδοποιήσεις για τον αγρό",e.jsx("span",{style:{color:"#b45309",fontWeight:600,fontSize:13},children:RWS.length===1?"1 ειδοποίηση":RWS.length+" ειδοποιήσεις"})]}),
e.jsx("div",{style:{marginTop:10,display:"flex",flexDirection:"column",gap:8},children:RWS.map(x=>{const md=x.d.metadata||{},cl=DOT[String(md.color||"")]||"#ea580c",vt=VT(x);
return e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[e.jsx("span",{style:{width:8,height:8,borderRadius:"50%",background:cl,display:"inline-block",flex:"0 0 auto"}}),e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:x.l}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:vt[0]})]}),vt[1]?e.jsx("div",{style:{fontSize:12,color:"#475569",marginTop:2},children:vt[1]}):null]},x.k)})})]})})(),
(()=>{let TB;try{TB=re}catch(_tx){return null}if(!TB)return null;/*T-HEALTH-PLAIN-01 βάση*/
const G=k=>{const d=TB[k];return d&&d.value!==null&&d.value!==void 0&&String(d.value)!==""?d:null};
const PL=s=>String(s).replace(/ ?κ\.ό\./g,"").replace(/στρ\./g,"στρέμματα");
const N1=(v,u)=>Number.isFinite(Number(v))?Number(v).toLocaleString("el-GR",{maximumFractionDigits:1})+u:PL(v);
const MC=(()=>{const o={};try{const t=TB.field_method_card&&TB.field_method_card.metadata&&TB.field_method_card.metadata.text;if(typeof t=="string")for(const ln of t.split("\n")){const m=/^(?:(.*)\/)?([a-z0-9_]+):\s*(.+)$/.exec(ln);if(m&&(!(m[2] in o)||!m[1]))o[m[2]]=m[3].trim()}}catch{}return o})();
const LW={"Αισθητήρας φύλλου":"αισθητήρα φύλλου","Αισθητήρας φύλλου (στεγνό)":"αισθητήρα φύλλου","Στεγνό (αβέβαιο)":"αισθητήρα φύλλου (αβέβαιη ένδειξη)","Στεγνό":"εκτίμηση από την υγρασία του αέρα","Δρόσος (εκτίμηση)":"εκτίμηση δρόσου από την υγρασία του αέρα","Δρόσος (θερμ. φύλλου)":"δρόσο, από τη θερμοκρασία του φύλλου","Σχετική υγρασία":"την υγρασία του αέρα","Βροχή":"τη βροχή"};
const BK=[["irrigation_area_basis","Για ποια έκταση είναι η δόση",v=>PL(v),1],
["irrigation_dose_basis","Αλατότητα νερού και απόδοση δικτύου",v=>{const s=String(v);return (/ECw μετρημένη/.test(s)?"νερό: μετρημένο":"νερό: τυπική τιμή")+" · "+(/απόδοση μετρημένη/.test(s)?"δίκτυο: μετρημένο":"δίκτυο: τυπική τιμή")},4],
["crop_stage","Στάδιο καλλιέργειας για το πότισμα",v=>PL(v),0],
["soil_profile_status","Τύπος εδάφους",v=>PL(String(v).replace(/^Έδαφος:\s*/,"")),0],
["soil_depth_basis","Βάθη αισθητήρων υγρασίας εδάφους",v=>PL(String(v).replace(/\s*\(\d+ %\)/g,"")),0],
["soil_moisture_rootzone","Υγρασία στη ζώνη των ριζών",v=>N1(v," %"),0],
["stone_fraction_applied","Πέτρες και χαλίκια στο έδαφος",v=>N1(v," %"),1],
["et0_mm_day","Νερό που χάνεται σήμερα (εξάτμιση και διαπνοή)",v=>N1(v," mm"),0],
["met_reference_source","Θερμοκρασία και υγρασία αέρα από",v=>String(v)==="Αισθητήρας κόμης"?"αισθητήρα μέσα στο φύλλωμα":String(v)==="Μετεωρολογικός σταθμός"?"μετεωρολογικό σταθμό":PL(v),2],
["leaf_wetness_source","Το βρέξιμο του φύλλου φαίνεται από",v=>LW[String(v)]||PL(v),0],
["pathogen_analysis_status","Τι λείπει για τις ασθένειες",v=>PL(v),3]];
const TX=(x,mode)=>{const md=x.d.metadata||{},t=typeof md.text=="string"?md.text:"";
if(mode===1)return PL(t);
if(mode===2)return String(md.color)==="orange"?"Δεν υπάρχει μετεωρολογικός σταθμός στον αγρό. Ο αισθητήρας μέσα στο φύλλωμα δείχνει λίγο ψηλότερες θερμοκρασίες, οπότε η δόση νερού μπορεί να βγαίνει λίγο μεγαλύτερη.":"";
if(mode===3)return PL(t||MC[x.k]||"");
if(mode===4)return PL(t.replace(/:\s*δόση\s*=.*$/,"."));
return ""};
const TR=BK.map(([k,l,f,mode])=>({k,l,f,mode,d:G(k)})).filter(x=>x.d).filter(x=>!(x.k==="pathogen_analysis_status"&&String(x.d.value)==="Ενεργή"));
const KV=G("kernel_version");
if(!TR.length)return null;
return e.jsxs("details",{className:"card",id:"basisCard",children:[e.jsx("summary",{style:{cursor:"pointer",fontWeight:600},children:"🔍 Πώς υπολογίστηκαν"}),e.jsxs("div",{style:{marginTop:10,display:"flex",flexDirection:"column",gap:8},children:[TR.map(x=>{const t=TX(x,x.mode);
return e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("div",{style:{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"},children:[e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:x.l}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:x.f(x.d.value)})]}),t?e.jsx("div",{style:{fontSize:12,color:"#475569",marginTop:2},children:t}):null]},x.k)}),
KV?e.jsx("div",{style:{fontSize:11,color:"#94a3b8",marginTop:4},children:"Έκδοση υπολογισμών: "+String(KV.value).split(" ")[0]}):null]})]})})()
'''
NEW = "".join(l.strip() for l in NEW.strip().splitlines())
assert "\n" not in NEW and "//" not in NEW.replace("://", "")
w = w[:a] + NEW + w[b:]
assert w.count("T-HEALTH-PLAIN-01") == 3 and w.count(END) == 1
print("  OK τρεις κάρτες: υγεία · ειδοποιήσεις · πώς υπολογίστηκαν")
out = w.encode("utf-8"); assert b"\r\n" not in out
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(W, "wb").write(out)
print("ΜΕΤΑ widget", hashlib.sha256(out).hexdigest(), len(out))
