# -*- coding: utf-8 -*-
"""T-RAIN-UNIFIED-W-01 · widget: παρουσίαση βροχής για τον ενιαίο υπολογισμό (ανάλυση αθροισμάτων v34).
 W1 ιστορικό: οι κλειστές περίοδοι (ώρα/ημέρα/εβδομάδα/μήνας/έτος) τοποθετούνται στο ΜΕΣΟ της περιόδου από
    metadata.period_start_utc/period_end_utc — ισχύει και για τις παλιές εγγραφές v33 (που σφραγίζονταν στο
    τέλος + 10 s, δηλαδή με την ημερομηνία της ΕΠΟΜΕΝΗΣ ημέρας). Ίδια περίοδος από v33 και v34 → κρατιέται μία
    (η v34, και ανάμεσα σε v34 αυτή με τη μεγαλύτερη κάλυψη).
 W2 τιμές: «≥» μερική κάλυψη, «≈ … (εκτίμηση)» σταθμός χωρίς μετρητή, «· από ΜΜ/ΕΕΕΕ» στο «Φέτος» όταν λείπουν
    μήνες, και «—» στα τρέχοντα σύνολα όταν η τελευταία εγγραφή είναι παλαιότερη από 4 ω (σιωπηλός σταθμός).
    Σε: κεντρική κάρτα, κάρτες συσκευής, «Όλες οι μετρήσεις».
 W3 ετικέτα: «Ύψος βροχής (5λεπτο)» → «Βροχή ανά αποστολή (εκτίμηση ρυθμού)» (μόνο οι σταθμοί fw 1.13 τη στέλνουν).
 W4 «Σύνολο» στο διάγραμμα: ΟΧΙ για τα τρέχοντα σύνολα (κυλιόμενα· το άθροισμά τους διπλομετρά).
LF, count==1, όλα-ή-τίποτα."""
import io, sys, hashlib
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); assert b"\r\n" not in raw and raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); print(P, "ΠΡΙΝ", hashlib.sha256(raw).hexdigest()[:16], len(raw))
assert "sagRainT" not in s, "ήδη εφαρμοσμένο"
HELPERS = (
    'const sagRainClosedRe=/^rain_height_(hourly|daily|weekly|monthly|yearly)$/,sagRainAnyRe=/^(rain_height|current_rain_height)/;'
    'function sagRainT(d,u,o){try{if(!sagRainClosedRe.test(String(d)))return o;const m=u&&u.metadata||{},a=Date.parse(m.period_start_utc);let z=Date.parse(m.period_end_utc);'
    'if(!Number.isFinite(a)||!Number.isFinite(z)||z<=a)return o;if(z%1e3===999)z+=1;return Math.floor((a+z)/2)}catch{return o}}'
    'function sagRainH(d,u,o,v){const h={t:o,v};try{if(!sagRainAnyRe.test(String(d)))return h;const m=u&&u.metadata||{};'
    'if(m.alg==="v34"){h.q=2+(Number(m.coverage)||0);h.m={alg:"v34",partial:!!m.partial,status:m.status,since:m.since||null}}else h.q=1}catch{}return h}'
    'function sagRainFlag(n,meta,tms,txt){try{const k=String(n);if(!sagRainAnyRe.test(k))return txt;'
    'if(/^current_rain_height/.test(k)&&Number.isFinite(tms)&&Date.now()-tms>4*36e5)return"— (χωρίς πρόσφατη μέτρηση)";'
    'const m=meta||{};if(m.alg!=="v34")return txt;const est=m.status==="estimate";'
    'const since=m.partial&&m.since?" · από "+String(m.since).split("-").reverse().join("/"):"";'
    'return(m.partial?"≥ ":est?"≈ ":"")+txt+(est?" (εκτίμηση)":"")+since}catch{return txt}}'
)
subs = [
    ("function kt(t,s){var j,N,w;", HELPERS + "function kt(t,s){var j,N,w;", "W0 βοηθητικά"),
    ('const o=Date.parse(u.time||u.created_at||u.inserted_at||""),v=(u.value==null||u.value==="")?NaN:Number(u.value);',
     'const o=sagRainT(d,u,Date.parse(u.time||u.created_at||u.inserted_at||"")),v=(u.value==null||u.value==="")?NaN:Number(u.value);', "W1 μέσο περιόδου"),
    ("M.push({t:o,v}),x[F]=M,b[m]=x}", "M.push(sagRainH(d,u,o,v)),x[F]=M,b[m]=x}", "W1 σήμανση ιστορικού"),
    ("!x||x.t!==v.t?d.push(v):d[d.length-1]=v}", "!x||x.t!==v.t?d.push(v):((v.q||0)>=(x.q||0)&&(d[d.length-1]=v))}", "W1 μία εγγραφή ανά περίοδο"),
    ('w=T(j),k=w?B(j,w.v):"—"', 'w=T(j),k=w?sagRainFlag(j,w.m,w.t,B(j,w.v)):"—"', "W2 κάρτες συσκευής"),
    ('const $=k?T(N,k.v):"—",O=fa(D)', 'const $=k?sagRainFlag(N,k.m,k.t,T(N,k.v)):"—",O=fa(D)', "W2 όλες οι μετρήσεις"),
    ('S=c?Ya(n,c.value):"—",R=c?Ja(c.time):"—"', 'S=c?sagRainFlag(n,c.metadata,Date.parse(c.time),Ya(n,c.value)):"—",R=c?Ja(c.time):"—"', "W2 κεντρική κάρτα"),
    ('rain_height:{label:"🌧 Ύψος βροχής (5λεπτο)",...H.rain_height}', 'rain_height:{label:"🌧 Βροχή ανά αποστολή (εκτίμηση ρυθμού)",...H.rain_height}', "W3 ετικέτα"),
    ('current_rain_height_daily:{label:"🌧 Ύψος βροχής (Σήμερα)",...H.rain_height}', 'current_rain_height_daily:{label:"🌧 Ύψος βροχής (Σήμερα)",...H.rain_height,showSum:!1}', "W4 σήμερα"),
    ('current_rain_height_weekly:{label:"🌧 Ύψος βροχής (Αυτή την εβδομάδα)",...H.rain_height}', 'current_rain_height_weekly:{label:"🌧 Ύψος βροχής (Αυτή την εβδομάδα)",...H.rain_height,showSum:!1}', "W4 εβδομάδα"),
    ('current_rain_height_monthly:{label:"🌧 Ύψος βροχής (Αυτό τον μήνα)",...H.rain_height}', 'current_rain_height_monthly:{label:"🌧 Ύψος βροχής (Αυτό τον μήνα)",...H.rain_height,showSum:!1}', "W4 μήνας"),
    ('current_rain_height_yearly:{label:"🌧 Ύψος βροχής (Φέτος)",...H.rain_height}', 'current_rain_height_yearly:{label:"🌧 Ύψος βροχής (Φέτος)",...H.rain_height,showSum:!1}', "W4 φέτος"),
]
for old, new, label in subs:
    c = s.count(old); assert c == 1, f"{label}: {c} φορές"; s = s.replace(old, new); print("  OK", label)
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("  ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
