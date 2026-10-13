# -*- coding: utf-8 -*-
"""Widget · T-RAIN-CUST-01 (Κώστας 13/10: τι βλέπουν οι πελάτες για τη βροχή).
Ο πελάτης βλέπει ΜΟΝΟ πέντε στοιχεία βροχής:
  1. Βροχή ημέρας   = current_rain_height_daily   (mm, από τον μετρητή · ανάλυση v34)
  2. Βροχή μήνα     = current_rain_height_monthly (mm)
  3. Βροχή έτους    = current_rain_height_yearly  (mm)
  4. Ραγδαιότητα βροχής = rain_height_rate (mm/h) — ΕΙΚΟΝΙΚΗ μεταβλητή του widget: τελευταία τιμή ×12,
     δηλαδή η ένταση που στέλνει ο ίδιος ο σταθμός (κανάλι 4113), όπως λειτουργούσε πάντα.
  5. Βροχή τελευταίου 5λέπτου = rain_height (mm) — το rain_gauge (fw 2.x) ή το rain_height (fw 1.13)
     όπως τα γράφει ο parser (ένταση × 5/60). Στο ιστορικό το rain_gauge αποθηκεύεται ως rain_height.
Κρύβονται (τα δεδομένα συνεχίζουν να γράφονται): εβδομάδα, ωριαίο, ιστορικά ανά ημέρα/εβδομάδα/μήνα/έτος.
Τα 4–5 δείχνουν «—» όταν η τελευταία αποστολή είναι παλαιότερη από 30΄.
Καμία ανάλυση, κανένας υπολογισμός συνόλων δεν αλλάζει. LF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
W = sys.argv[1] if len(sys.argv) > 1 else "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(W, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
w = raw.decode("utf-8"); print("ΠΡΙΝ widget", hashlib.sha256(raw).hexdigest()[:16], len(raw))
assert "T-RAIN-CUST-01" not in w, "ήδη εφαρμοσμένο"
def sub(old, new, label):
    global w; n = w.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; w = w.replace(old, new); print("  OK", label)

# 1 ετικέτες + νέα εικονική μεταβλητή ραγδαιότητας
sub('rain_height:{label:"🌧 Βροχή ανά αποστολή (εκτίμηση ρυθμού)",...H.rain_height}',
    'rain_height:{label:"🌧 Βροχή τελευταίου 5λέπτου",...H.rain_height,showSum:!1},'
    'rain_height_rate:{label:"🌧 Ραγδαιότητα βροχής",defaultUnit:"mm/h",conversions:{"mm/h":t=>t},showAverage:!0,showSum:!1,showMax:!0,showMin:!0}',
    "1α ετικέτα 5λέπτου + ραγδαιότητα")
sub('current_rain_height_daily:{label:"🌧 Ύψος βροχής (Σήμερα)"', 'current_rain_height_daily:{label:"🌧 Βροχή ημέρας"', "1β βροχή ημέρας")
sub('current_rain_height_monthly:{label:"🌧 Ύψος βροχής (Αυτό τον μήνα)"', 'current_rain_height_monthly:{label:"🌧 Βροχή μήνα"', "1γ βροχή μήνα")
sub('current_rain_height_yearly:{label:"🌧 Ύψος βροχής (Φέτος)"', 'current_rain_height_yearly:{label:"🌧 Βροχή έτους"', "1δ βροχή έτους")

# 2 βοηθητικά: κρυφές μεταβλητές, «—» για παλιό 5λεπτο
sub('sagRainAnyRe=/^(rain_height|current_rain_height)/;',
    'sagRainAnyRe=/^(rain_height|current_rain_height)/,sagRainHide=new Set(["current_rain_height_weekly","rain_height_hourly",'
    '"rain_height_daily","rain_height_weekly","rain_height_monthly","rain_height_yearly"]);/*T-RAIN-CUST-01*/',
    "2α σύνολο κρυφών")
sub('if(/^current_rain_height/.test(k)&&Number.isFinite(tms)&&Date.now()-tms>4*36e5)return"— (χωρίς πρόσφατη μέτρηση)";',
    'if(/^current_rain_height/.test(k)&&Number.isFinite(tms)&&Date.now()-tms>4*36e5)return"— (χωρίς πρόσφατη μέτρηση)";'
    'if((k==="rain_height"||k==="rain_height_rate")&&Number.isFinite(tms)&&Date.now()-tms>30*6e4)return"— (χωρίς πρόσφατη μέτρηση)";',
    "2β «—» για 5λεπτο/ραγδαιότητα > 30΄")

# 3 ιστορικό: rain_gauge → rain_height, και εικονική ραγδαιότητα = τιμή × 12
sub('F=d.trim(),M=x[F]?[...x[F]]:[];M.push(sagRainH(d,u,o,v)),x[F]=M,b[m]=x}',
    'F=d.trim()==="rain_gauge"?"rain_height":d.trim(),M=x[F]?[...x[F]]:[];M.push(sagRainH(d,u,o,v)),x[F]=M;'
    'if(F==="rain_height"){const R9=x.rain_height_rate?[...x.rain_height_rate]:[];R9.push({t:o,v:v*12}),x.rain_height_rate=R9}b[m]=x}',
    "3 ιστορικό 5λέπτου + ραγδαιότητας")

# 4 απόκρυψη στις δύο οθόνες μετρήσεων
sub('call(St,v))return!1;return!0', 'call(St,v)||sagRainHide.has(v))return!1;return!0', "4α κρυφά στη συσκευή")
sub('call(St,d))return!1;return!0', 'call(St,d)||sagRainHide.has(d))return!1;return!0', "4β κρυφά στο «Όλες οι μετρήσεις»")

# 5 σειρά καρτών στη συσκευή
sub('const P=["current_rain_height_daily","current_rain_height_weekly","current_rain_height_monthly","current_rain_height_yearly","rain_height_hourly","rain_height","rain_height_daily","rain_height_weekly","rain_height_monthly","rain_height_yearly"]',
    'const P=["current_rain_height_daily","current_rain_height_monthly","current_rain_height_yearly","rain_height_rate","rain_height"]',
    "5 σειρά: ημέρα, μήνας, έτος, ραγδαιότητα, 5λεπτο")

out = w.encode("utf-8"); assert b"\r\n" not in out
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(W, "wb").write(out)
print("ΜΕΤΑ widget", hashlib.sha256(out).hexdigest(), len(out))
