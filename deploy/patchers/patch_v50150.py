# -*- coding: utf-8 -*-
"""v50.150 · T-SOILCAL-02 + T-COVERED-ANOM-01 · όλα-ή-τίποτα, count==1, node --check, CRLF."""
import io, sys, subprocess, hashlib, re, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read()
assert raw[:3] != b"\xef\xbb\xbf", "BOM"
assert raw.count(b"\n") == raw.count(b"\r\n"), "γυμνά LF στην είσοδο"
s = raw.decode("utf-8").replace("\r\n", "\n")
print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))

def sub(old, new, label):
    global s
    c = s.count(old)
    assert c == 1, f"{label}: βρέθηκε {c} φορές, περίμενα 1"
    s = s.replace(old, new)
    print("  OK", label)

# 0. έλεγχος εμβέλειας: `crop` και `parameters` πριν από το SOILCAL block της computeSoilMoistureLimits
i_fn = s.find("function computeSoilMoistureLimits(")
i_cal = s.find("// ── T-SOILCAL-01 (v50.53, απόφαση χρήστη 29/8)")
assert 0 < i_fn < i_cal, "σειρά συνάρτησης/μπλοκ"
head = s[i_fn:i_cal]
assert re.search(r"\bconst crop\b|\bcrop\s*=", head), "το `crop` δεν ορίζεται πριν το SOILCAL block"
assert "parameters" in s[i_fn:i_fn+200], "η υπογραφή δεν έχει parameters"
print("  OK εμβέλεια: crop/parameters ορατά στο SOILCAL block")

# 1. έκδοση
sub("const SAG_KERNEL_VERSION = 'v50.149 · 2026-09-20';",
    "const SAG_KERNEL_VERSION = 'v50.150 · 2026-09-24';", "έκδοση")

# 2. T-SOILCAL-02a · δείγμα πλατό σε συνεχόμενες υγρές ημέρες
old_a = """              if (_wet) { st.e = 1; }
              else if (st.e === 1) {
                // ΕΠΟΜΕΝΗ ημέρα μετά την ύγρανση = στραγγισμένο πλατό -> δείγμα FC
                if (cur >= st.w + 0.8) {
                  st.f = _scR2(Number.isFinite(st.f) ? 0.75 * st.f + 0.25 * cur : cur);
                  st.n = (st.n || 0) + 1;
                }
                st.e = 0;
              }
"""
new_a = """              // ── T-SOILCAL-02 (v50.150 · 24/9/2026, Κουτσάκης) ──────────────
              // ΠΡΙΝ: δείγμα FC ΜΟΝΟ την πρώτη ΣΤΕΓΝΗ ημέρα μετά από υγρή. Με
              // καθημερινή στάγδην (θερμοκήπιο) ΚΑΘΕ ημέρα είναι υγρή -> e=1 για
              // πάντα, n=0 για πάντα, ο SOILCAL δεν δέσμευε ΠΟΤΕ. Μετρημένο 24/9:
              // Κουτσάκης 6 ποτίσματα +5…+16 σε 6 ημέρες, soilcal_state χωρίς f/n.
              // ΤΩΡΑ: σε συνεχόμενες υγρές ημέρες η ένδειξη του ημερήσιου tick
              // (πριν το επόμενο πότισμα, στο κάτω τρίτο του 24ώρου) ΕΙΝΑΙ το
              // στραγγισμένο πλατό -> δείγμα. Η παλιά διαδρομή (στεγνή ημέρα μετά
              // από υγρή, ένδειξη ≥ δάπεδο+0,8) μένει ακριβώς ίδια.
              const _lowSide = !rng || (cur <= rng.mn + 0.35 * (rng.mx - rng.mn));
              // Υγρή ημέρα: μόνο ένδειξη στο κάτω τρίτο (πριν το πότισμα). Στεγνή
              // ημέρα: η παλιά πύλη «≥ δάπεδο + 0,8». Ποτέ η κορυφή της ημέρας.
              if (st.e === 1 && (_wet ? _lowSide : (cur >= st.w + 0.8))) {
                st.f = _scR2(Number.isFinite(st.f) ? 0.75 * st.f + 0.25 * cur : cur);
                st.n = (st.n || 0) + 1;
              }
              st.e = _wet ? 1 : 0;
"""
sub(old_a, new_a, "T-SOILCAL-02a δειγματοληψία πλατό")

# 3. T-SOILCAL-02b · «σοβαρή ασυμφωνία» = πλατό κάτω από την επαναπλήρωση του πίνακα
old_b = """          // Ενεργοποίηση ΜΟΝΟ σε σοβαρή ασυμφωνία με τον δηλωμένο πίνακα
          const _mismatch = (_fcE < M_wilt + 0.25 * _tawT)
            || (Number.isFinite(_floorE) && _floorE < M_wilt - 3);
"""
new_b = """          // ── T-SOILCAL-02 (v50.150): «σοβαρή ασυμφωνία» = το στραγγισμένο πλατό
          // του αισθητήρα κάθεται ΚΑΤΩ από το σημείο επαναπλήρωσης του πίνακα.
          // Τότε το «πότισε» δεν σβήνει ΠΟΤΕ, όσο κι αν ποτίσει ο αγρότης
          // (Κουτσάκης 24/9: πλατό ~28,5 %, επαναπλήρωση πίνακα 30,35 %). Το παλιό
          // κριτήριο (< WP + 25 % TAW = 25,3 %) δεν το έπιανε. Το κάτω όριο της
          // καλλιέργειας διαβάζεται ΟΠΩΣ στο T-OMR-STAGE-01 (στάδιο -> default).
          const _omrP = crop?.optimal_moisture_range || {};
          const _stP = String(parameters?.stage || '').trim();
          const _bandP = (_omrP.stages && _stP && _omrP.stages[_stP] && typeof _omrP.stages[_stP] === 'object')
            ? _omrP.stages[_stP]
            : ((_omrP.default && typeof _omrP.default === 'object') ? _omrP.default : _omrP);
          const _lbP = Number(_bandP?.lower_bound);
          const _refillT = Number.isFinite(_lbP) ? (M_wilt + _lbP * _tawT / 100) : (M_wilt + 0.25 * _tawT);
          const _mismatch = (_fcE < _refillT)
            || (Number.isFinite(_floorE) && _floorE < M_wilt - 3);
"""
sub(old_b, new_b, "T-SOILCAL-02b κριτήριο ασυμφωνίας")

# 4. T-COVERED-ANOM-01 · σιωπή θερμικής ανωμαλίας σε κάλυμμα
old_c = """          try {
            if (_cpProf) {
              // T-ANCHOR-MATCH-01: η νόρμα μετριέται από την ΙΔΙΑ ημερομηνία
              // έναρξης με τον συσσωρευτή, και στο ΙΔΙΟ υψόμετρο.
              _anomDays = _sagSeasonAnomalyDays("""
new_c = """          try {
            // T-COVERED-ANOM-01 (v50.150 · 24/9/2026, Κουτσάκης): η θερμική
            // ανωμαλία συγκρίνει GDD του ΜΕΤΡΗΜΕΝΟΥ αέρα με ΕΞΩΤΕΡΙΚΗ κλιματική
            // νόρμα. Μέσα σε κάλυμμα ο αέρας δεν είναι ο έξω -> «Εποχή 10 ημ.
            // πίσω» χωρίς νόημα. Σε καλυμμένη καλλιέργεια: null (σιωπή).
            if (_cpProf && !fieldConfig?.covered_cultivation) {
              // T-ANCHOR-MATCH-01: η νόρμα μετριέται από την ΙΔΙΑ ημερομηνία
              // έναρξης με τον συσσωρευτή, και στο ΙΔΙΟ υψόμετρο.
              _anomDays = _sagSeasonAnomalyDays("""
sub(old_c, new_c, "T-COVERED-ANOM-01 πύλη καλύμματος")

# must_absent: τίποτα από τα παλιά
for bad in ["if (_wet) { st.e = 1; }", "const _mismatch = (_fcE < M_wilt + 0.25 * _tawT)", "v50.149 · 2026-09-20"]:
    assert bad not in s, "παλιό κείμενο ακόμη μέσα: " + bad

out = s.replace("\n", "\r\n").encode("utf-8")
tmp = P.replace(".js", ".v50150.check.js")
io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True)
if r.returncode != 0:
    print(r.stderr.decode("utf-8", "replace")); os.remove(tmp); raise SystemExit("node --check ΑΠΕΤΥΧΕ — δεν γράφτηκε τίποτα")
io.open(P, "wb").write(out)
import os; os.remove(tmp)
chk = io.open(P, "rb").read()
assert chk.count(b"\n") == chk.count(b"\r\n") and chk[:3] != b"\xef\xbb\xbf"
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
