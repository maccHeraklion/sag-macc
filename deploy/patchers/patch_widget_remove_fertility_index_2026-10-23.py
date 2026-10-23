# -*- coding: utf-8 -*-
# T-FERTIDX-01 (23/10/2026, Μιχάλης: «ναι να φύγει ο παλαιός δείκτης parser από παντού»).
# Το widget έδειχνε κάρτες «🌾 Παλιός δείκτης parser … (αποσύρεται)» (fertility_index1-4) με τιμές μηνών (Αμμουδάρες:
# 18/8), σε mS/cm — αριθμητικά ίδια μονάδα με τα dS/m της σωστής αλατότητας, άρα παραπλανητικές. Ο parser δεν τις παράγει
# από 8/9 (αυθαίρετος συντελεστής 2/3). Οι λίστες μετρήσεων δείχνουν ΜΟΝΟ μεταβλητές που υπάρχουν στον χάρτη ετικετών
# `St` → βγαίνουν οι 4 εγγραφές του χάρτη. Βγαίνουν και τα 2 νεκρά σύνολα `fertility_index(\d+)` (υπολογίζονταν, δεν
# χρησιμοποιούνταν πουθενά). Ο κώδικας είναι ΜΙΑ γραμμή minified: κάθε αντικατάσταση count==1, αλλιώς τίποτα.
import io, sys, hashlib
P = "_dist-sagMain/index-7cbd9a4e.js"
s = io.open(P, "r", encoding="utf-8", newline="").read()
assert "\r" not in s, "το widget πρέπει να είναι LF"
before = hashlib.sha256(s.encode("utf-8")).hexdigest()
SUBS = [
  ('fertility_index1:{label:"🌾 Παλιός δείκτης parser Ρηχό (αποσύρεται)",...H.conductivity},', ''),
  ('fertility_index2:{label:"🌾 Παλιός δείκτης parser Βαθύ (αποσύρεται)",...H.conductivity},', ''),
  ('fertility_index3:{label:"🌾 Παλιός δείκτης parser 3 (αποσύρεται)",...H.conductivity},', ''),
  ('fertility_index4:{label:"🌾 Παλιός δείκτης parser 4 (αποσύρεται)",...H.conductivity},', ''),
  (r'const w=new Set(N.flatMap(v=>{const x=v.match(/^fertility_index(\d+)$/);return x?[x[1]]:[]})),k=N.filter(', 'const k=N.filter('),
  (r'const k=new Set(w.flatMap(d=>{const m=d.match(/^fertility_index(\d+)$/);return m?[m[1]]:[]})),$=w.filter(', 'const $=w.filter('),
]
for a, b in SUBS:
    n = s.count(a)
    if n != 1:
        sys.exit("ΑΠΟΤΥΧΙΑ: %d εμφανίσεις (αντί 1) για: %s" % (n, a[:70]))
    s = s.replace(a, b, 1)
if "fertility_index" in s:
    sys.exit("ΑΠΟΤΥΧΙΑ: έμεινε fertility_index")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("OK πριν", before[:16], "μετά", hashlib.sha256(s.encode("utf-8")).hexdigest()[:16], "bytes", len(s.encode("utf-8")))
