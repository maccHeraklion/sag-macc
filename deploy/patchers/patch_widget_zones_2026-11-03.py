# -*- coding: utf-8 -*-
"""W-ZONES-01 (3/11/2026 · T-ZONES-01): στην κάρτα «Άρδευση» λίστα «Ζώνες άρδευσης» — όνομα, υγρασία (%), λίτρα και
«μέσος αγρού» όταν η ζώνη δεν έχει δικό της αισθητήρα με μέτρηση. Πηγή: shared.irrigation_zones από το field_bundle_2
(πυρήνας v50.170, ήδη συγχωνεύεται στο shared). Κρύβεται όταν δεν υπάρχει ή είναι παλαιότερο από 3 ώρες (ζώνες που
αφαιρέθηκαν). Επεξήγηση ανά ζώνη στο title. Ονόματα ως κείμενο (React). count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-DEPTH1-03" in s and "W-ZONES-01" not in s
CARD = ('/* W-ZONES-01 */sagZonesCard=(J,R)=>{try{const x=R&&R.irrigation_zones,md=x&&x.metadata,z=md&&Array.isArray(md.z)?md.z:null;'
        'if(!z||!z.length)return null;const tt=Date.parse(md.t);if(!Number.isFinite(tt)||Date.now()-tt>108e5)return null;'
        'const f1=v=>Number(v).toLocaleString("el-GR",{maximumFractionDigits:1});'
        'return J.jsxs("div",{style:{marginTop:8,borderTop:"1px solid #e5e7eb",paddingTop:6},children:['
        'J.jsx("div",{className:"muted",style:{fontSize:12,fontWeight:600},children:"Ζώνες άρδευσης"}),'
        '...z.map((q,i)=>J.jsxs("div",{style:{display:"flex",justifyContent:"space-between",gap:8,fontSize:12,padding:"2px 0"},'
        'title:(q.cr||[]).map(r=>r&&r.t?r.t:"").filter(Boolean).join(" · "),children:['
        'J.jsx("span",{children:String(q.n)}),'
        'J.jsx("span",{className:"muted",children:(q.m==null?"—":f1(q.m)+" %")+" · "+(q.L==null?"—":Number(q.L).toLocaleString("el-GR")+" λ")+(q.own?"":" · μέσος αγρού")})]},i))]})'
        '}catch(_e){return null}},')
SUBS = [
  ("sagCoveredSet=z=>{sagCoveredBox.v=!!z},sagMeterBox={v:!1},", "sagCoveredSet=z=>{sagCoveredBox.v=!!z}," + CARD + "sagMeterBox={v:!1},", "Ζ1 κάρτα"),
  ('Hargreaves:"εκτίμηση από τις θερμοκρασίες"}[MT]||MT):"")})]})})()]',
   'Hargreaves:"εκτίμηση από τις θερμοκρασίες"}[MT]||MT):"")})]})})(),sagZonesCard(e,re)]', "Ζ2 στην κάρτα «Άρδευση»"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
