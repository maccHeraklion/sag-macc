# -*- coding: utf-8 -*-
"""Widget · T-VPD-SHOW-02 (εντολή Μιχάλη 13/10: «φτιάξε το overlap με το cookie» — στιγμιότυπο Καμπιτάκης BIO).
Η γραμμή VPD του T-VPD-SHOW-01 στην κάρτα «Συνθήκες ανάπτυξης σήμερα»: όταν το σήμα (.badge: padding 6px 10px,
white-space:nowrap) αναδιπλώνεται κάτω από το κείμενο, το ύψος του ξεπερνά τη γραμμή και καλύπτει το «Έλλειμμα πίεσης
υδρατμών (VPD)». Τώρα: γραμμή flex με wrap και κενό σειρών, κείμενο+τιμή σε ένα span (δεν σπάνε χωριστά), σήμα με μικρό
padding/κανονικό line-height, που αναδιπλώνεται μέσα στην κάρτα αν είναι στενή (white-space:normal). Μόνο εμφάνιση. Βάση: ζωντανό dac782a9 (Κώστας, T-RAIN-CUST-01). LF, count==1, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
W = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(W, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and b"\r\n" not in raw
w = raw.decode("utf-8"); print("ΠΡΙΝ widget", hashlib.sha256(raw).hexdigest()[:16], len(raw))
assert "T-VPD-SHOW-02" not in w, "ήδη εφαρμοσμένο"
OLD = ('style:{marginTop:2},children:["Έλλειμμα πίεσης υδρατμών (VPD): ",e.jsx("b",{children:Le.vpd.v+" kPa"})," ",'
       'e.jsx("span",{className:Le.vpd.cls,style:{fontSize:"0.85em"},children:Le.vpd.label})]}),')
NEW = ('style:{marginTop:4,display:"flex",flexWrap:"wrap",alignItems:"center",columnGap:6,rowGap:4,lineHeight:1.35},'
       'children:[e.jsxs("span",{children:["Έλλειμμα πίεσης υδρατμών (VPD): ",e.jsx("b",{children:Le.vpd.v+" kPa"})]}),'
       'e.jsx("span",{className:Le.vpd.cls,style:{fontSize:"0.8em",padding:"2px 8px",lineHeight:1.3,display:"inline-block",whiteSpace:"normal",maxWidth:"100%"},children:Le.vpd.label})]}),/*T-VPD-SHOW-02*/')
n = w.count(OLD); assert n == 1, f"γραμμή VPD: βρέθηκε {n} φορές"
w = w.replace(OLD, NEW); print("  OK γραμμή VPD χωρίς επικάλυψη")
out = w.encode("utf-8"); assert b"\r\n" not in out
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(W, "wb").write(out)
print("ΜΕΤΑ widget", hashlib.sha256(out).hexdigest(), len(out))
