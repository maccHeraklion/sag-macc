# -*- coding: utf-8 -*-
"""Widget sagMain · W-EC-PERDEV-01 (Michalis 29/10, Καμπιτάκης BIO: «για τον ίδιο αγρό ... άλλο τίτλο ... αναφέρει τιμή
για την EC στη ρίζα Βαθύ — Μάρτυρας ενώ η υγρασία του είναι κάτω από 15 %. ... διόρθωσέ τα»).

ΑΙΤΙΑ (ΕΠΙΒΕΒΑΙΩΜΕΝΟ): ο πυρήνας βγάζει ΜΙΑ «EC στη ρίζα»/ECe ανά βάθος για τον αγρό, από τον ΜΕΣΟ ΟΡΟ όλων των
αισθητήρων (getMeasurements → κυλιόμενος μέσος της αγωγιμότητας, υγρασίας, θερμοκρασίας). Το widget κολλούσε αυτή την
τιμή αγρού σε ΚΑΘΕ αισθητήρα σαν δική του. Καμπιτάκης: βαθύ μέσος θ 15,8 % → τιμή 4,3 σε όλους (και στον Μάρτυρα με
13,6 %)· ρηχό μέσος θ 12,5 % → «καμία τιμή» σε όλους, με τίτλο «Αγωγιμότητα εδάφους» (και στον Μάρτυρα με 16,2 %).
9 αγροί έχουν 2–3 αισθητήρες αγωγιμότητας.

ΔΙΟΡΘΩΣΗ (μόνο εμφάνιση, καμία νέα σταθερά):
  Π1 sagEceChain9 = ΑΚΡΙΒΕΣ αντίγραφο του _sagEcChain του πυρήνα (μέχρι τη σ_w· η ECe θέλει κοκκομετρία, μένει στον
     πυρήνα). Ο ελεγκτής το συγκρίνει αριθμητικά με τον πυρήνα.
  Π2 Όταν ≥2 συσκευές στέλνουν το ίδιο conduct_soil*, κάθε κάρτα υπολογίζεται από τη ΔΙΚΗ της αγωγιμότητα, υγρασία
     και θερμοκρασία· όργανο που δίνει ~0 σε υγρό χώμα → «—» με αιτία· υγρασία ≤15 % → «—» με αιτία.
  Π3 Ένας αισθητήρας: όπως πριν (τιμή αγρού + ECe + όριο). Χωρίς τιμή → ΙΔΙΟΣ τίτλος «💧 EC στη ρίζα …» με «—» και
     αιτία (όχι πια «Αγωγιμότητα εδάφους» με την ωμή ένδειξη). ECe χωρίς σ_w ή σ_w χωρίς ECe χειρίζονται χωριστά.
  Π4 Διάγραμμα αισθητήρα σε αγρό με πολλούς: σειρά σ_w του ΙΔΙΟΥ αισθητήρα (ίδια ώρα αγωγιμότητας/υγρασίας/θερμ.),
     όχι η σειρά του αγρού με το όνομα του αισθητήρα.
LF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
W = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(W, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
s = raw.decode("utf-8")
print("ΠΡΙΝ widget", hashlib.sha256(raw).hexdigest(), len(raw))
assert "W-EC-PERDEV-01" not in s, "ήδη εφαρμοσμένο"
def sub(old, new, label):
    global s; n = s.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; s = s.replace(old, new); print("  OK", label)

OLD_CARD = 'sagEceCard=vn=>{try{const M=/^conduct_soil([1-4]?)$/.exec(String(vn||""));if(!M)return null;const R=sagEceBox.v;if(!R)return null;const q=M[1]||"",ec=R["soil_ece"+q];if(!ec)return null;const e9=sagEceN9(ec);if(e9===null)return{t:null,v:null,sub:sagEceWhy9(ec.metadata)};/* W-EC-ROOT-01 */const p9=sagEceN9(R["soil_ec_pore"+q]),d9=q==="1"?" Ρηχό":q==="2"?" Βαθύ":q?" "+q:"",fz9=sagFertBox.v,tl9=Number(ec.metadata&&ec.metadata.tol),l9="κλίμακα εργαστηρίου (ECe) "+sagEceF9(e9,1)+(Number.isFinite(tl9)&&tl9>0?" · όριο καλλιέργειας "+sagEceF9(tl9,1):"");if(p9===null)return{t:"🧂 Αλατότητα εδάφους"+d9,v:sagEceF9(e9,1)+" dS/m",sub:l9};const s9=[fz9!==null?"ρίχνετε "+sagEceF9(fz9,1)+" → στη ρίζα "+Math.round(p9/fz9*100)+" %":"",l9].filter(Boolean).join(" · ");return{t:"💧 EC στη ρίζα"+d9,v:sagEceF9(p9,1)+" mS/cm",sub:s9}}catch{return null}}'
NEW_CARD = (
 '/* W-EC-PERDEV-01 */sagEceD9=q=>q==="1"?" Ρηχό":q==="2"?" Βαθύ":q?" "+q:"",'
 # Π1: αντίγραφο του _sagEcChain (runPerTich.js) ως τη σ_w — ΙΔΙΕΣ σταθερές: ε0 4,1 · όριο θ 0,15 · Topp · ε_w(T) · 2 %/°C
 'sagEceChain9=(raw,vwc,tc)=>{const ec=Number(raw);if(!Number.isFinite(ec)||ec<0)return{p:null,why:"χωρίς μέτρηση αγωγιμότητας"};'
 'const t=Number.isFinite(Number(tc))?Number(tc):25,bk=ec/1000,tf=1+0.02*(t-25),e25=tf>0.2?bk/tf:bk,th=Number(vwc)/100;'
 'if(!Number.isFinite(th)||th<=0.15)return{p:null,why:"υγρασία κάτω από "+Math.round(0.15*100)+" % — ο τύπος Hilhorst δεν ισχύει σε τόσο ξηρό έδαφος"};'
 'const eb=3.03+9.3*th+146*th*th-76.7*th*th*th;if(!Number.isFinite(eb)||eb<=4.1+0.1)return{p:null,why:"διηλεκτρική σταθερά πολύ χαμηλή για τον τύπο"};'
 'return{p:(80.3-0.37*(t-20))*e25/(eb-4.1),why:null}},'
 'sagEceLast9=(DV,dv,k)=>{const a=DV&&DV[dv]&&DV[dv][k];if(!a||!a.length)return NaN;const x=a[a.length-1],v=x&&x.v;return v===null||v===undefined||v===""?NaN:Number(v)},'
 'sagEceMulti9=(DV,vn)=>{try{let c=0;for(const d of Object.keys(DV||{})){const a=DV[d]&&DV[d][vn];a&&a.length&&c++}return c>1}catch{return!1}},'
 'sagEceMT9=q=>q===""?["soil_moisture","temp_soil"]:["soil_moisture"+q,"soil_temperature"+q],'
 # Π2: η κάρτα ΕΝΟΣ αισθητήρα, από τις δικές του τιμές (πύλη νεκρού οργάνου όπως T-ECDEAD-01: θ>15 και <30 µS/cm)
 'sagEceDev9=(q,DV,dv)=>{const t9="💧 EC στη ρίζα"+sagEceD9(q),raw=sagEceLast9(DV,dv,"conduct_soil"+q);if(!Number.isFinite(raw))return null;'
 'const mt=sagEceMT9(q),th=sagEceLast9(DV,dv,mt[0]),tc=sagEceLast9(DV,dv,mt[1]);'
 'if(Number.isFinite(th)&&th>15&&raw<30)return{t:t9,v:"—",sub:"το όργανο δίνει σχεδόν μηδέν σε υγρό χώμα — ελέγξτε τον αισθητήρα"};'
 'const c=sagEceChain9(raw,th,tc);if(c.p===null)return{t:t9,v:"—",sub:c.why};const fz=sagFertBox.v;'
 'return{t:t9,v:sagEceF9(c.p,1)+" mS/cm",sub:[fz!==null?"ρίχνετε "+sagEceF9(fz,1)+" → στη ρίζα "+Math.round(c.p/fz*100)+" %":"","από αυτόν τον αισθητήρα"].filter(Boolean).join(" · ")}},'
 # Π3: η κάρτα με την τιμή του αγρού, μόνο όταν το βάθος έχει ΕΝΑΝ αισθητήρα
 'sagEceCard=(vn,DV,dv)=>{try{const M=/^conduct_soil([1-4]?)$/.exec(String(vn||""));if(!M)return null;'
 'if(DV&&dv&&sagEceMulti9(DV,M[0]))return sagEceDev9(M[1]||"",DV,dv);'
 'const R=sagEceBox.v;if(!R)return null;const q=M[1]||"",ec=R["soil_ece"+q];if(!ec)return null;'
 'const e9=sagEceN9(ec),p9=sagEceN9(R["soil_ec_pore"+q]),d9=sagEceD9(q);'
 'if(e9===null&&p9===null)return{t:"💧 EC στη ρίζα"+d9,v:"—",sub:sagEceWhy9(ec.metadata)};'
 '/* W-EC-ROOT-01 */const fz9=sagFertBox.v,tl9=Number(ec.metadata&&ec.metadata.tol),l9=e9===null?"":"κλίμακα εργαστηρίου (ECe) "+sagEceF9(e9,1)+(Number.isFinite(tl9)&&tl9>0?" · όριο καλλιέργειας "+sagEceF9(tl9,1):"");'
 'if(p9===null)return{t:"🧂 Αλατότητα εδάφους"+d9,v:sagEceF9(e9,1)+" dS/m",sub:l9};'
 'const s9=[fz9!==null?"ρίχνετε "+sagEceF9(fz9,1)+" → στη ρίζα "+Math.round(p9/fz9*100)+" %":"",l9].filter(Boolean).join(" · ");'
 'return{t:"💧 EC στη ρίζα"+d9,v:sagEceF9(p9,1)+" mS/cm",sub:s9}}catch{return null}}')
sub(OLD_CARD, NEW_CARD, "Π1–Π3 βοηθοί + κάρτα")
sub('_E9=sagEceCard(j)', '_E9=sagEceCard(j,r,s)', "Π2 κλήση: παράθυρο συσκευής")
sub('_E9=sagEceCard(N)', '_E9=sagEceCard(N,r,D)', "Π2 κλήση: όλες οι μετρήσεις")
OLD_CH = 'if(_sagEc9&&h){/* W-EC-ROOT-01 */'
NEW_CH = (
 'if(_sagEc9&&h&&sagEceMulti9(t.history,n)){/* W-EC-PERDEV-01 */'
 'const _q8=_sagEc9[1],_dp8=_q8==="2"?"Βαθύ":"Ρηχό",_H8=t.history[ue]||{},_mt8=sagEceMT9(_q8),'
 '_mm8=new Map((_H8[_mt8[0]]||[]).map(x=>[String(x.t),x.v])),_tm8=new Map((_H8[_mt8[1]]||[]).map(x=>[String(x.t),x.v])),'
 '_nn8=x=>x===null||x===undefined||x===""?NaN:Number(x),_fz8=sagFertBox.v,'
 '_cnt8=Object.keys(t.history).filter(k=>((t.history[k]||{})[n]||[]).length).length,'
 '_S8=(_H8[n]||[]).map(x=>{const raw=_nn8(x.v),th=_nn8(_mm8.get(String(x.t)));if(!Number.isFinite(raw)||Number.isFinite(th)&&th>15&&raw<30)return null;'
 'const c=sagEceChain9(raw,th,_nn8(_tm8.get(String(x.t))));return c.p===null?null:{...x,v:Number(c.p.toFixed(3))}}).filter(Boolean);'
 'if(_S8.length){const _l8=[];_fz8!==null&&_l8.push({value:_fz8,label:"Διάλυμα που ρίχνετε",dashed:!0});'
 '_l8.push({value:NaN,label:"_ec10",txt:"Ο αγρός έχει "+_cnt8+" αισθητήρες αγωγιμότητας σε αυτό το βάθος. Εδώ η EC στη ρίζα υπολογίζεται μόνο από αυτόν τον αισθητήρα, από τη δική του αγωγιμότητα, υγρασία και θερμοκρασία· οι ώρες με υγρασία κάτω από 15 % παραλείπονται, γιατί εκεί ο υπολογισμός δεν ισχύει. Συγκρίνεται με το διάλυμα που ρίχνετε. Εκτίμηση χωρίς εργαστηριακή βαθμονόμηση."});'
 'b("soil_ec_pore"+_q8);B("💧 EC στη ρίζα "+_dp8+" — "+it(ue));w(ue);j(_S8);$("mS/cm");P(_l8);fe(!1);p(!0);return}}'
 'else if(_sagEc9&&h){/* W-EC-ROOT-01 */')
sub(OLD_CH, NEW_CH, "Π4 διάγραμμα αισθητήρα")
out = s.encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(W, "wb").write(out)
print("ΜΕΤΑ widget", hashlib.sha256(out).hexdigest(), len(out))
