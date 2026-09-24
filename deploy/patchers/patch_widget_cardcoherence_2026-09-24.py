# -*- coding: utf-8 -*-
"""Widget · T-CARD-W-01 (εντολή Μιχάλη 24/9, κάρτα υγείας Κουτσάκη) — μόνο εμφάνιση, κανένας υπολογισμός.
  1. «Όρια υγρασίας εδάφους: Εντάξει» φεύγει (σήμαινε «βρέθηκε τύπος εδάφους»)· η γραμμή μένει μόνο πορτοκαλί/γκρι με ετικέτα «Όρια υγρασίας: τύπος εδάφους».
  2. Τίτλοι γραμμών: αριθμοί σε el-GR με μονάδα («1,18 dS/m»)· «Ρηχό έναντι βαθέος» = «ρηχό 24,6 % · βαθύ 23,5 %».
  3. Σήμανση ηλικίας «⏱ πριν 20ω» ΚΑΙ σε δείκτες που δεν έχουν κείμενο (από τη σφραγίδα _t/_s του πυρήνα).
  4. Οι γραμμές «όλα εντάξει» για όργανα/δεδομένα σε ΜΙΑ πτυσσόμενη γραμμή «Όργανα και δεδομένα: N/N έλεγχοι εντάξει».
  5. «Θερμοκρασία εδάφους» → «Θερμοκρασία εδάφους τώρα».
LF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub('soil_moisture_limits_status:"Όρια υγρασίας εδάφους",',
    'soil_moisture_limits_status:"Όρια υγρασίας: τύπος εδάφους",', "ετικέτα ορίων")
sub('soil_temp_source:"Θερμοκρασία εδάφους",soil_ec_status:',
    'soil_temp_source:"Θερμοκρασία εδάφους τώρα",soil_ec_status:', "ετικέτα θερμοκρασίας εδάφους")
sub('.filter((x,_i,arr)=>!(x.k==="leaf_sensor_placement"&&arr.some(z=>z.k==="sensor_alert")));if(!RW.length)return null;',
    '.filter((x,_i,arr)=>!(x.k==="leaf_sensor_placement"&&arr.some(z=>z.k==="sensor_alert"))).filter(x=>!(x.k==="soil_moisture_limits_status"&&String(x.d.value)==="Εντάξει"));if(!RW.length)return null;',
    "T-CARD-W-01 φίλτρο «Εντάξει» ορίων")

ROW_OLD = ('RW.map(x=>{const md=x.d.metadata||{},cl=DOT[String(md.color||"grey")]||"#6b7280";return e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[e.jsx("span",{style:{width:8,height:8,borderRadius:"50%",background:cl,display:"inline-block",flex:"0 0 auto"}}),e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:HL[x.k]}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:String(x.d.value)})]}),(_ht=>_ht?e.jsx("div",{style:{fontSize:12,color:"#475569",marginTop:2},children:_ht}):null)(HT(x.k,md))]},x.k)}),')
ROW_BODY = ('x=>{const md=x.d.metadata||{},cl=DOT[String(md.color||"grey")]||"#6b7280";return e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[e.jsx("span",{style:{width:8,height:8,borderRadius:"50%",background:cl,display:"inline-block",flex:"0 0 auto"}}),e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:HL[x.k]}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:FV(x)+AG(md)})]}),(_ht=>_ht?e.jsx("div",{style:{fontSize:12,color:"#475569",marginTop:2},children:_ht}):null)(HT(x.k,md))]},x.k)}')
DEFS = (r'const OKK={sensor_faults:1,device_battery:1,leaf_sensor_placement:1,measurement_age:1,avg_window_status:1,stale_measurement_groups:1,hidden_advice:1,sensor_quality:1,measurement_sources:1,device_mapping_status:1,sensor_redundancy:1};'
        r'const OKR=RW.filter(x=>OKK[x.k]&&!AC(CO(x)));const RWX=RW.filter(x=>!(OKK[x.k]&&!AC(CO(x))));'
        r'const FV=x=>{const md=x.d.metadata||{},v=x.d.value;if(x.k==="soil_depth_divergence"){const m=/\(([\d.,]+) % στα (\d+) cm έναντι ([\d.,]+) % στα (\d+) cm\)/.exec(String(md.text||""));if(m)return "ρηχό "+m[1]+" % · βαθύ "+m[3]+" %"}if(typeof v==="number"&&Number.isFinite(v))return v.toLocaleString("el-GR",{maximumFractionDigits:2})+(md.unit?" "+md.unit:"");return String(v)};'
        r'const AG=md=>{try{if(md&&md._s===1&&!md.text&&Number.isFinite(Number(md._t))){const h=(Date.now()/6e4-Number(md._t))/60;if(h>=1)return " · ⏱ πριν "+(h<48?Math.round(h)+"ω":Math.round(h/24)+"ημ")}}catch{}return ""};'
        r'const ROW=' + ROW_BODY + ';')
GROUP = ('RWX.map(ROW),OKR.length?e.jsxs("details",{style:{borderTop:"1px solid #f1f5f9",paddingTop:8},children:[e.jsxs("summary",{style:{cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[e.jsx("span",{style:{width:8,height:8,borderRadius:"50%",background:DOT.green,display:"inline-block",flex:"0 0 auto"}}),e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:"Όργανα και δεδομένα"}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:OKR.length+"/"+OKR.length+" έλεγχοι εντάξει"})]}),e.jsx("div",{style:{marginTop:6,display:"flex",flexDirection:"column",gap:8,paddingLeft:14},children:OKR.map(ROW)})]},"okgroup"):null,')

sub('const DOT={red:"#dc2626",orange:"#ea580c",yellow:"#d97706",green:"#16a34a",blue:"#2563eb",grey:"#6b7280"};return e.jsxs("details",{className:"card",id:"healthCard",children:[',
    'const DOT={red:"#dc2626",orange:"#ea580c",yellow:"#d97706",green:"#16a34a",blue:"#2563eb",grey:"#6b7280"};' + DEFS + 'return e.jsxs("details",{className:"card",id:"healthCard",children:[',
    "T-CARD-W-01 ορισμοί OKK/FV/AG/ROW")
sub(ROW_OLD, GROUP, "T-CARD-W-01 γραμμές + ομάδα «Όργανα και δεδομένα»")

out = s.encode("utf-8"); assert b"\r\n" not in out
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk))
