# -*- coding: utf-8 -*-
"""W-CONFIG-STUB-01 (3/11/2026, Michalis: «Εξακολουθεί να υπάρχει πρόβλημα» — Κοκοφοίνικας, κάρτα EC 5,01 / διάγραμμα ~1).
ΑΙΤΙΑ (ΕΠΙΒΕΒΑΙΩΜΕΝΟ, αναπαραγωγή με τον πραγματικό κώδικα του widget: κάρτα «EC στη ρίζα Βαθύ 5,01»):
  Σε καλυμμένους αγρούς ο πυρήνας βάζει στο shared του field_bundle ένα στέλεχος configuration = {"covered_cultivation":"true"}
  (T-COVERED-WIRE-01, v50.77). Το widget αντιγράφει το shared πάνω στο latest, άρα το re.configuration ΔΕΝ είναι η πλήρης
  ρύθμιση: οι σημαίες που διαβάζουν από εκεί έμεναν στις προεπιλογές — υπόστρωμα (W-SUBSTRATE-EC-01), ECw διαλύματος,
  βάθη/θύρα, υδρόμετρο, γεωγραφικό πλάτος (ET0 στην πρόγνωση). Αφορά 4/64 αγρούς (probe audit_covered_config_stub_2026-11-03):
  Κουτσάκης, Γρινιαράκης, Αμμουδάρες, Κοκοφοίνικα.
ΔΙΟΡΘΩΣΗ: οι σημαίες διαβάζουν την πλήρη ρύθμιση (t.config, από τη μεταβλητή configuration) με το στέλεχος από πάνω, ώστε το
  covered_cultivation να μένει ό,τι λέει ο πυρήνας (π.χ. από ετικέτα). Πυρήνας αμετάβλητος. Χωρίς στέλεχος: ίδια ρύθμιση με πριν.
count==1, LF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "_dist-sagMain/index-7cbd9a4e.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8"); assert "\r\n" not in s
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "W-SUBSTRATE-EC-01" in s and "W-CONFIG-STUB-01" not in s
SUBS = [
  ("/* W-SUBSTRATE-EC-01 */sagSubBox={v:!1},",
   "/* W-CONFIG-STUB-01 */sagCfgOf=(full,R)=>{let x=null;try{const c=R&&R.configuration&&R.configuration.value;x=typeof c==\"string\"?JSON.parse(c):c}catch(_e){x=null}"
   "const a=full&&typeof full==\"object\"?full:null,b=x&&typeof x==\"object\"?x:null;return a||b?{...(a||{}),...(b||{})}:null},"
   "/* W-SUBSTRATE-EC-01 */sagSubBox={v:!1},", "Σ1 συγχώνευση ρύθμισης"),
  ("LATV=l.useMemo(()=>{try{const c=re.configuration&&re.configuration.value;return sagLatOf(c)}catch(_e){return null}},[re])",
   "LATV=l.useMemo(()=>{try{return sagLatOf(sagCfgOf(t.config,re))}catch(_e){return null}},[re,t.config])", "Σ2 γεωγραφικό πλάτος"),
  ("CVD=l.useMemo(()=>{try{const c=re.configuration&&re.configuration.value;const o=typeof c==\"string\"?JSON.parse(c):c;const vv=",
   "CVD=l.useMemo(()=>{try{const o=sagCfgOf(t.config,re);const vv=", "Σ3α σημαίες"),
  ("sagDepthSet(2,1);sagSubSet(!1);return!1}},[re]),NOWM=", "sagDepthSet(2,1);sagSubSet(!1);return!1}},[re,t.config]),NOWM=", "Σ3β εξαρτήσεις"),
]
for a, b, n in SUBS:
    c = s.count(a); assert c == 1, (n, c); s = s.replace(a, b); print("OK", n)
fd, tmp = tempfile.mkstemp(suffix=".mjs"); os.close(fd)
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8"); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
