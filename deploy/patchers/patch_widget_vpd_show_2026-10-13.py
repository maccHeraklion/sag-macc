# -*- coding: utf-8 -*-
"""Widget · T-VPD-SHOW-01 (εντολή Μιχάλη 13/10: «βάλε το [VPD] όπως προτείνεις να βγει σε όλους τους αγρούς»).
Ο πυρήνας υπολογίζει ΚΑΘΕ ώρα το VPD (calculate_VPD, FAO-56) και το γράφει στο field_bundle → shared.vpd· το widget
το έχει ήδη στο `re.vpd` αλλά δεν το έδειχνε πουθενά. Τώρα: γραμμή στην κάρτα «Συνθήκες ανάπτυξης σήμερα»:
  «Έλλειμμα πίεσης υδρατμών (VPD): 1,85 kPa [καταπόνηση]»
Ζώνες (εγκρίθηκαν από τον Μιχάλη 13/10, ΜΟΝΟ για εμφάνιση — κανένας υπολογισμός δεν αλλάζει):
  < 0,4 «υγρός αέρας — ευνοεί μύκητες» (μπλε) · 0,4–1,2 «καλό» (πράσινο) · 1,2–1,6 «ξηρός αέρας» (κίτρινο) · > 1,6 «καταπόνηση» (κόκκινο).
Κρύβεται αν λείπει, αν είναι εκτός 0–10 kPa ή παλαιότερη από 3 ώρες. LF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
W = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(W, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
w = raw.decode("utf-8"); print("ΠΡΙΝ widget", hashlib.sha256(raw).hexdigest()[:16], len(raw))
assert "T-VPD-SHOW-01" not in w, "ήδη εφαρμοσμένο"
def sub(old, new, label):
    global w; n = w.count(old); assert n == 1, f"{label}: βρέθηκε {n} φορές"; w = w.replace(old, new); print("  OK", label)

sub("return{stomata:c,perfPct:y,perfDays:perfDays",
    "const _vp9=(()=>{try{const x=n&&n.vpd,v=Number(x&&x.value);if(!Number.isFinite(v)||v<0||v>10)return null;"
    "const tm=Date.parse(x&&x.time);if(Number.isFinite(tm)&&Date.now()-tm>3*36e5)return null;"
    "const z=v<0.4?[\"υγρός αέρας — ευνοεί μύκητες\",\"badge b-blue\"]:v<=1.2?[\"καλό\",\"badge b-green\"]:v<=1.6?[\"ξηρός αέρας\",\"badge b-yellow\"]:[\"καταπόνηση\",\"badge b-red\"];"
    "return{v:v.toFixed(2).replace(\".\",\",\"),label:z[0],cls:z[1]}}catch{return null}})();/*T-VPD-SHOW-01*/"
    "return{vpd:_vp9,stomata:c,perfPct:y,perfDays:perfDays",
    "1 υπολογισμός γραμμής VPD")
sub("(Le.perfPct!==null||Le.stomata||Le.bucketLabel)&&e.jsxs(\"div\",{className:\"bpi-extra\"",
    "(Le.perfPct!==null||Le.stomata||Le.bucketLabel||Le.vpd)&&e.jsxs(\"div\",{className:\"bpi-extra\"",
    "2 η περιοχή εμφανίζεται και μόνο με VPD")
sub("Le.stomata&&e.jsxs(\"div\",{className:\"muted\",children:[\"Στόματα φύλλων: \",Le.stomata]}),",
    "Le.vpd&&e.jsxs(\"div\",{title:\"Έλλειμμα πίεσης υδρατμών: πόσο «τραβάει» νερό ο αέρας από το φύλλο. Κάτω από 0,4 υγρός αέρας (κίνδυνος μυκήτων) · 0,4–1,2 καλό · 1,2–1,6 ξηρός · πάνω από 1,6 καταπόνηση.\","
    "style:{marginTop:2},children:[\"Έλλειμμα πίεσης υδρατμών (VPD): \",e.jsx(\"b\",{children:Le.vpd.v+\" kPa\"}),\" \","
    "e.jsx(\"span\",{className:Le.vpd.cls,style:{fontSize:\"0.85em\"},children:Le.vpd.label})]}),"
    "Le.stomata&&e.jsxs(\"div\",{className:\"muted\",children:[\"Στόματα φύλλων: \",Le.stomata]}),",
    "3 γραμμή VPD στην κάρτα")

out = w.encode("utf-8"); assert b"\r\n" not in out
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(W, "wb").write(out)
print("ΜΕΤΑ widget", hashlib.sha256(out).hexdigest(), len(out))
