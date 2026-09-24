# -*- coding: utf-8 -*-
"""Widget · T-METER-W-01 (§8.6) + T-METHODCARD-W-01 (§8.7). LF, count==1, node --check, όλα-ή-τίποτα.

T-METER-W-01: το «Μετρητής νερού» εμφανίζεται ΜΟΝΟ αν η φόρμα δηλώνει has_water_meter=true.
  Αλλιώς: τιμή «—», τίτλος «Μετρητής 1 — χωρίς υδρόμετρο», και το διάγραμμα παλμών λέγεται
  «Παλμοί ελεγκτή (χωρίς υδρόμετρο)» σε μονάδα παλμών, όχι m³.
T-METHODCARD-W-01: η κάρτα «Πώς υπολογίστηκαν» διαβάζει το shared.field_method_card (από το
  field_bundle_2 που γράφει ο πυρήνας v50.154 μία φορά την ημέρα), ενώνει το κείμενο κάθε
  μεθόδου με τη γραμμή της (soil_depth_basis, et0_inputs_basis …) και προσθέτει γραμμές για
  τις υπόλοιπες (πηγή θερμοκρασιών, διαβροχή φύλλου, στάδιο …)."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

# ── T-METER-W-01 ──
sub('sagCoveredBox={v:!1},sagCoveredSet=z=>{sagCoveredBox.v=!!z},',
    'sagCoveredBox={v:!1},sagCoveredSet=z=>{sagCoveredBox.v=!!z},sagMeterBox={v:!1},sagMeterSet=z=>{sagMeterBox.v=!!z},',
    "T-METER-W-01 σημαία υδρομέτρου")
sub('if(d==="configuration")try{const z=u.value,E=typeof z=="string"?JSON.parse(z):z;p=E&&typeof E=="object"?E:null}catch{p=null}',
    'if(d==="configuration")try{const z=u.value,E=typeof z=="string"?JSON.parse(z):z;p=E&&typeof E=="object"?E:null;sagMeterSet(!!(p&&String(p.has_water_meter)==="true"))}catch{p=null;sagMeterSet(!1)}',
    "T-METER-W-01 ανάγνωση has_water_meter στην εισαγωγή δεδομένων")
sub('const vv=!!(o&&String(o.covered_cultivation)==="true");sagCoveredSet(vv);return vv}',
    'const vv=!!(o&&String(o.covered_cultivation)==="true");sagCoveredSet(vv);sagMeterSet(!!(o&&String(o.has_water_meter)==="true"));return vv}',
    "T-METER-W-01 ανάγνωση has_water_meter από το configuration")
sub('case"valve_1_pulse":{const M=Number(d.value)||0,C=x.pulseToM3??1;x.meter1M3=M*C;break}',
    'case"valve_1_pulse":{const M=Number(d.value)||0,C=x.pulseToM3??1;x.meter1M3=sagMeterBox.v?M*C:null;break}',
    "T-METER-W-01 μετρητής 1 μόνο με υδρόμετρο")
sub('case"valve_2_pulse":{const M=Number(d.value)||0,C=x.pulseToM3??1;x.meter2M3=M*C;break}',
    'case"valve_2_pulse":{const M=Number(d.value)||0,C=x.pulseToM3??1;x.meter2M3=sagMeterBox.v?M*C:null;break}',
    "T-METER-W-01 μετρητής 2 μόνο με υδρόμετρο")
sub('children:"Μετρητής νερού 1"}', 'children:sagMeterBox.v?"Μετρητής νερού 1":"Μετρητής 1 — χωρίς υδρόμετρο"}', "T-METER-W-01 τίτλος 1")
sub('children:"Μετρητής νερού 2"}', 'children:sagMeterBox.v?"Μετρητής νερού 2":"Μετρητής 2 — χωρίς υδρόμετρο"}', "T-METER-W-01 τίτλος 2")
sub('function Ne(t){const s=St[t];return s||{label:t,',
    'function Ne(t){let s=St[t];if(s&&/^valve_\\d+_pulse$/.test(String(t))&&!sagMeterBox.v)s={...s,label:s.label.replace("🚰 Μετρητής νερού","🔢 Παλμοί ελεγκτή (χωρίς υδρόμετρο)"),defaultUnit:"pulse",conversions:{pulse:v9=>v9}};return s||{label:t,',
    "T-METER-W-01 διάγραμμα παλμών χωρίς υδρόμετρο")

# ── T-METHODCARD-W-01 ──
sub('kernel_version:"Έκδοση συστήματος υπολογισμών",accumulator_basis:"Βάση συσσωρευτών (βαθμοημέρες, ώρες μόλυνσης)"};',
    'kernel_version:"Έκδοση συστήματος υπολογισμών",accumulator_basis:"Βάση συσσωρευτών (βαθμοημέρες, ώρες μόλυνσης)",'
    'met_reference_source:"Πηγή θερμοκρασιών αναφοράς",leaf_wetness_source:"Πηγή διαβροχής φύλλου",pathogen_analysis_status:"Μοντέλο παθογόνων — τι λείπει",soil_moisture_rootzone:"Υγρασία ριζοστρώματος (στάθμιση)",crop_stage:"Υδατικό στάδιο (FAO-56)"};',
    "T-METHODCARD-W-01 ετικέτες μεθόδων")
sub('if(TB.gdd_crop_status||TB.infection_model_status)TR.push({k:"accumulator_basis"',
    'const _mc9=(TB.field_method_card&&TB.field_method_card.metadata&&typeof TB.field_method_card.metadata.text=="string")?TB.field_method_card.metadata.text:"";'
    'if(_mc9){for(const _ln of _mc9.split("\\n")){const _m9=/^([^:]+?):\\s*(.+)$/.exec(_ln);if(!_m9)continue;const _kf=_m9[1].trim(),_tx=_m9[2].trim();const _sl=_kf.lastIndexOf("/");const _k=_sl>=0?_kf.slice(_sl+1):_kf,_pre=_sl>=0?_kf.slice(0,_sl)+" · ":"";'
    'const _row=_pre?null:TR.find(x9=>x9.k===_k);if(_row){_row.d={...(_row.d||{}),metadata:{...((_row.d||{}).metadata||{}),text:_tx}};continue}'
    'TR.push({k:"mc:"+_kf,d:{value:_pre+(TL[_k]||_k),metadata:{text:_tx}},mcLabel:"Μέθοδος (ημερήσια κάρτα)"})}}'
    'if(TB.gdd_crop_status||TB.infection_model_status)TR.push({k:"accumulator_basis"',
    "T-METHODCARD-W-01 ανάγνωση της κάρτας μεθόδου")
sub('e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:TL[x.k]}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:String(x.d.value)+(md.unit?" "+md.unit:"")})',
    'e.jsx("span",{style:{fontSize:12,color:"#64748b"},children:TL[x.k]||x.mcLabel||x.k}),e.jsx("span",{style:{fontSize:13,fontWeight:600},children:String(x.d.value)+(md.unit?" "+md.unit:"")})',
    "T-METHODCARD-W-01 ετικέτα γραμμής")

out = s.encode("utf-8"); tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert b"\r\n" not in chk
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk))
