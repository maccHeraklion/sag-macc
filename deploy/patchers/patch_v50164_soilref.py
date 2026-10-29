# -*- coding: utf-8 -*-
"""Πυρήνας v50.164 · T-SOILREF-01 — ΕΝΑΣ αισθητήρας απόφασης για το έδαφος, ΟΧΙ μέσος όρος.
Michalis 29/10: «ποτέ δεν θα έχει νόημα η μέση τιμή των τιμών των αισθητήρων αφού κάθε τμήμα εδάφους έχει τα δικά
του χαρακτηριστικά» → επιλογή «Α»: αισθητήρας απόφασης ανά αγρό· χωρίς δήλωση ο πιο ξηρός, ώστε να μη διψάσει κανένα
τμήμα· οι άλλοι φαίνονται χωριστά, χωρίς συναγερμό «διαφωνίας».
Αφορμή: Καμπιτάκης BIO — πείραμα με μαλλί προβάτου σε τμήματα του εδάφους· οι 3 σόνδες ΦΥΣΙΟΛΟΓΙΚΑ διαφέρουν, ο μέσος
όρος τους έβγαζε υγρασία/EC/κρίσεις που δεν αντιστοιχούν σε κανένα τμήμα, και ψευδή «τα όργανα διαφωνούν».

ΕΜΒΕΛΕΙΑ (ελέγχθηκε): αλλάζουν ΜΟΝΟ κανάλια εδάφους που έρχονταν από ≥2 συσκευές (ο κυλιόμενος μέσος του
T-MULTISENSOR-MERGE-01). Αγροί με έναν αισθητήρα εδάφους: ΤΙΠΟΤΑ (επιστροφή πριν από κάθε αλλαγή). Αέρας/σταθμοί:
ΤΙΠΟΤΑ. Κανένας αυτοματισμός βανών δεν διαβάζει αυτές τις τιμές (μόνο συμβουλές/κάρτες). 9 αγροί έχουν 2–3 σόνδες.
  Σ1 _sagMergeDeviceData κρατά επιπλέον τις τιμές εδάφους ΚΑΘΕ συσκευής (data._sagSoilDev, με το id της).
  Σ2 _sagApplySoilRef — ΠΡΙΝ την πύλη ευλογοφάνειας/ηλικίες/βλάβες: αισθητήρας απόφασης = ο δηλωμένος
     (fieldConfig.soil_ref_device = id συσκευής) αν έχει έγκυρη υγρασία, αλλιώς ο πιο ξηρός με βάση τον μέσο 24ώρου
     της υγρασίας του (σταθερός μέσα στη μέρα· εφεδρεία η τελευταία τιμή). Κάθε κανάλι που ήταν μέσος όρος παίρνει
     την τιμή ΤΟΥ (ή φεύγει αν δεν το μετρά)· η πηγή του γίνεται μόνο αυτός· οι «διαφωνίες» εδάφους σβήνουν.
  Σ3 η δήλωση φτάνει στη getMeasurements μέσω σημαίας αγρού (όπως T-SUBSTRATE-01), μηδενίζεται σε ΚΑΘΕ αγρό.
  Σ4 έκδοση v50.164.
Καμία αγρονομική σταθερά. CRLF, count==N, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"
raw = io.open(C, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
assert "\r\n" in s and s.count("\n") == s.count("\r\n"), "ο πυρήνας πρέπει να είναι καθαρό CRLF"
print("ΠΡΙΝ πυρήνας", hashlib.sha256(raw).hexdigest(), len(raw))
assert "T-SOILREF-01" not in s, "ήδη εφαρμοσμένο"
s = s.replace("\r\n", "\n")
def sub(old, new, label, n=1):
    global s; c = s.count(old); assert c == n, f"{label}: βρέθηκε {c} φορές (αναμενόταν {n})"; s = s.replace(old, new); print("  OK", label, f"×{n}")

sub("const SAG_KERNEL_VERSION = 'v50.163 · 2026-10-29';", "const SAG_KERNEL_VERSION = 'v50.164 · 2026-10-29';", "Σ4 έκδοση")

# Σ1 — καταγραφή των τιμών εδάφους κάθε συσκευής
sub("function _sagMergeDeviceData(data, deviceData, deviceName, fieldName) {\n  data._sagSrc = data._sagSrc || {};\n  for (const key of Object.keys(deviceData)) {\n    if (key.startsWith('_sag')) { data[key] = deviceData[key]; continue; }\n    const incoming = deviceData[key];\n",
    "function _sagMergeDeviceData(data, deviceData, deviceName, fieldName, deviceId) {\n  data._sagSrc = data._sagSrc || {};\n  for (const key of Object.keys(deviceData)) {\n    if (key.startsWith('_sag')) { data[key] = deviceData[key]; continue; }\n    const incoming = deviceData[key];\n"
    "    // T-SOILREF-01: οι τιμές εδάφους ΚΑΘΕ συσκευής κρατιούνται χωριστά — ο μέσος όρος παρακάτω\n"
    "    // αντικαθίσταται από τον αισθητήρα απόφασης (_sagApplySoilRef) πριν φτάσει σε υπολογισμό.\n"
    "    if (_SAG_SOIL_KEY_RE.test(key)) {\n"
    "      data._sagSoilDev = data._sagSoilDev || {};\n"
    "      const _sd = data._sagSoilDev[deviceName] || (data._sagSoilDev[deviceName] = { _id: String(deviceId == null ? '' : deviceId) });\n"
    "      _sd[key] = incoming;\n"
    "    }\n", "Σ1 καταγραφή ανά συσκευή")
sub("data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName);",
    "data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);", "Σ1 id συσκευής στις κλήσεις", 4)

# Σ2 — ο αισθητήρας απόφασης
SOILREF = r"""
// ═══ T-SOILREF-01 (v50.164 · 29/10/2026, επιλογή «Α» του Μιχάλη) ══════════════════════════
// ΕΝΑΣ αισθητήρας απόφασης για το έδαφος — ΟΧΙ μέσος όρος. Κάθε τμήμα εδάφους έχει τα δικά
// του χαρακτηριστικά (Καμπιτάκης BIO: μαλλί προβάτου σε τμήματα του αγρού· οι 3 σόνδες
// ΦΥΣΙΟΛΟΓΙΚΑ διαφέρουν). Ο μέσος όρος έβγαζε υγρασία/EC που δεν αντιστοιχούσαν σε κανένα
// τμήμα, και ψευδή «τα όργανα διαφωνούν». Ίδιος κανόνας με τον αέρα (T-MET-REFERENCE-01).
// ΑΙΣΘΗΤΗΡΑΣ ΑΠΟΦΑΣΗΣ: ο δηλωμένος (fieldConfig.soil_ref_device = id συσκευής), αν δίνει
// έγκυρη υγρασία· αλλιώς ο ΠΙΟ ΞΗΡΟΣ — μία βάνα ποτίζει όλο τον αγρό, και η απόφαση δεν
// πρέπει να αφήνει κανένα τμήμα να διψάσει. «Πιο ξηρός» = ο μικρότερος μέσος 24ώρου της
// υγρασίας του (σταθερός μέσα στη μέρα — όχι εναλλαγή κάθε ώρα)· εφεδρεία η τελευταία τιμή.
// ΕΜΒΕΛΕΙΑ: ΜΟΝΟ κανάλια εδάφους που έρχονταν από ≥2 συσκευές. Με έναν αισθητήρα, ή κανάλια
// που μετρά μία μόνο συσκευή (π.χ. pH), ΤΙΠΟΤΑ δεν αλλάζει. Τρέχει ΠΡΙΝ την πύλη
// ευλογοφάνειας, τις ηλικίες και τις βλάβες — όλα βλέπουν τον αισθητήρα απόφασης.
const _SAG_SOIL_KEY_RE = /^(soil_|conduct_soil|temp_soil|water_soil)/;
// id του αισθητήρα απόφασης για τον αγρό που επεξεργάζεται ΤΩΡΑ (μηδενίζεται σε κάθε αγρό).
let _SAG_SOIL_REF_ID = '';
function _sagApplySoilRef(data, refId, fieldName) {
  try {
    if (!data || typeof data !== 'object') return;
    const devs = data._sagSoilDev || {};
    delete data._sagSoilDev;
    const src = data._sagSrc || {};
    const multi = Object.keys(src).filter(k => _SAG_SOIL_KEY_RE.test(k) && Array.isArray(src[k]) && src[k].length > 1);
    if (!multi.length) return;
    const names = Object.keys(devs).filter(n => multi.some(k => devs[n][k] !== undefined)).sort();
    if (names.length < 2) return;
    const score = (d) => {
      for (const re of [/^soil_moisture\d?_avg$/, /^soil_moisture\d?$/, /^(water_soil|soil_humidity)\d?(_avg)?$/]) {
        const xs = Object.keys(d).filter(k => re.test(k)).map(k => _sagMergeNum(d[k])).filter(Number.isFinite);
        if (xs.length) return xs.reduce((a, b) => a + b, 0) / xs.length;
      }
      return NaN;
    };
    const _rid = String(refId == null ? '' : refId).trim();
    let ref = null, why = '';
    if (_rid) {
      const n = names.find(x => devs[x]._id === _rid);
      if (n && Number.isFinite(score(devs[n]))) { ref = n; why = 'δηλωμένος'; }
    }
    if (!ref) {
      let best = Infinity;
      for (const n of names) { const v = score(devs[n]); if (Number.isFinite(v) && v < best) { best = v; ref = n; } }
      if (ref) why = _rid ? 'ο δηλωμένος δεν δίνει έγκυρη υγρασία — ο πιο ξηρός' : 'ο πιο ξηρός';
    }
    if (!ref) return;   // κανένας με έγκυρη υγρασία: ό,τι ίσχυε (οι πύλες θα το πουν)
    for (const k of multi) {
      if (devs[ref][k] !== undefined) { data[k] = devs[ref][k]; src[k] = [ref]; }
      else { delete data[k]; delete src[k]; }
      if (data._sagDiverge) delete data._sagDiverge[k];
      if (data._sagDivergeEc) delete data._sagDivergeEc[k];
    }
    for (const o of ['_sagDiverge', '_sagDivergeEc']) if (data[o] && !Object.keys(data[o]).length) delete data[o];
    data._sagSoilRef = { n: ref, w: why, c: names.length };
    console.log('[' + (fieldName || '—') + '] T-SOILREF-01: έδαφος από «' + ref + '» (' + why + ') — '
      + names.length + ' αισθητήρες, ' + multi.length + ' κανάλια χωρίς μέσο όρο');
  } catch (_e) { /* η επιλογή αισθητήρα δεν επιτρέπεται να ρίξει τον αγρό */ }
}

// T-LIGHTMERGE-01: ημερήσια ολοκληρώματα φωτός."""
sub("\n// T-LIGHTMERGE-01: ημερήσια ολοκληρώματα φωτός.", SOILREF, "Σ2 _sagApplySoilRef")
sub("\n  _sagPlausibilityGate(data, fieldName);\n",
    "\n  // T-SOILREF-01: ΕΝΑΣ αισθητήρας απόφασης για το έδαφος, ΠΡΙΝ από κάθε πύλη και υπολογισμό.\n"
    "  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n  _sagPlausibilityGate(data, fieldName);\n", "Σ2 κλήση πριν την πύλη")

# Σ3 — η δήλωση του αγρού
sub("      _SAG_SUBSTRATE_ACTIVE = null;   // T-SUBSTRATE-01: ποτέ μεταφορά από τον προηγούμενο αγρό",
    "      _SAG_SUBSTRATE_ACTIVE = null;   // T-SUBSTRATE-01: ποτέ μεταφορά από τον προηγούμενο αγρό\n"
    "      _SAG_SOIL_REF_ID = '';          // T-SOILREF-01: ποτέ μεταφορά από τον προηγούμενο αγρό", "Σ3 μηδενισμός ανά αγρό")
sub("        _SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);   // T-SUBSTRATE-01\n",
    "        _SAG_SUBSTRATE_ACTIVE = _sagSubstrateOf(fieldConfig);   // T-SUBSTRATE-01\n"
    "        _SAG_SOIL_REF_ID = String(fieldConfig?.soil_ref_device || '');   // T-SOILREF-01\n", "Σ3 δήλωση από τη ρύθμιση")

out = s.replace("\n", "\r\n").encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(C, "wb").write(out)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(out).hexdigest(), len(out))
