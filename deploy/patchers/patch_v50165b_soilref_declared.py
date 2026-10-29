# -*- coding: utf-8 -*-
"""Πυρήνας v50.165 (αναθεώρηση, ΠΡΙΝ ανέβει) · T-SOILREF-04 — αισθητήρας απόφασης ΜΟΝΟ με δήλωση στη φόρμα.
Michalis 29/10, μετά την επιστροφή του v50.164: «Ο μέσος όρος μένει μόνο μέχρι να δηλωθεί αισθητήρας απόφασης στη φόρμα».
ΓΙΑΤΙ (ΕΠΙΒΕΒΑΙΩΜΕΝΟ 17:21): το αυτόματο «ο πιο ξηρός» διάλεξε στον ΚΑΜΠΑΝΗ σόνδα σχεδόν σίγουρα εκτός χώματος (226.589
λίτρα αντί «δεν χρειάζεται»), και ο έλεγχος βλαβών, τρέχοντας ΜΕΤΑ την επιλογή, έβγαζε ψευδείς βλάβες στις υγιείς σόνδες.
  Δ1 ΧΩΡΙΣ δήλωση: ΤΙΠΟΤΑ δεν αλλάζει — ο μέσος όρος όπως στον ζωντανό v50.163 (μόνο η λίστα σονδών για τη φόρμα).
  Δ2 ΜΕ δήλωση: η σόνδα γίνεται δεκτή μόνο αν (α) μετρά σε κοινό βάθος με τις άλλες, (β) έδωσε έγκυρη υγρασία μέσα στο
     όριο φρεσκάδας εδάφους (_SAG_AGE_LIMITS «έδαφος», 360΄ — υπάρχουσα σταθερά), (γ) ΔΕΝ κρίθηκε χαλασμένη (kill) από τον
     έλεγχο βλαβών. Αλλιώς μένει ο μέσος όρος, με αιτία στο log. ΚΑΜΙΑ αυτόματη επιλογή σόνδας.
  Δ3 Η επιλογή τρέχει ΜΕΤΑ την πύλη, τις ηλικίες ΚΑΙ τον έλεγχο βλαβών → ο έλεγχος βλαβών βλέπει ό,τι έβλεπε στον v50.163
     (καμία ψευδής βλάβη).
  Δ4 Μάθηση T-SOILCAL: όταν αλλάζει η πηγή εδάφους (μέσος όρος ↔ δηλωμένη, ή άλλη σόνδα) η μάθηση ξεκινά από την αρχή·
     η πηγή κρατιέται στο soilcal_state ως «w» ΜΟΝΟ όταν υπάρχει δήλωση (αλλιώς ίδια bytes).
  Δ5 Κάρτες που δεν ισχύουν πια ΔΕΝ μεταφέρονται: «διαφωνία οργάνων» όταν δεν βγαίνει αυτόν τον κύκλο· «αλατότητα σε
     αναστολή» εκτός ημερήσιου όταν δεν υπάρχει πια διαφωνία αγωγιμότητας (αλλιώς έμεναν έως 50ω / 24ω).
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
C = "analysis/runPerTich.js"
raw = io.open(C, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8")
assert "\r\n" in s and s.count("\n") == s.count("\r\n"), "ο πυρήνας πρέπει να είναι καθαρό CRLF"
print("ΠΡΙΝ πυρήνας", hashlib.sha256(raw).hexdigest(), len(raw))
assert "T-SOILREF-04" not in s, "ήδη εφαρμοσμένο"
s = s.replace("\r\n", "\n")
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

OLD_HDR = s[s.index("// ΕΝΑΣ αισθητήρας απόφασης για το έδαφος — ΟΧΙ μέσος όρος. Κάθε τμήμα εδάφους έχει τα δικά"):
            s.index("const _SAG_SOIL_KEY_RE = ")]
sub(OLD_HDR,
    "// Κάθε τμήμα εδάφους έχει τα δικά του χαρακτηριστικά (Καμπιτάκης BIO: μαλλί προβάτου σε τμήματα του\n"
    "// αγρού· οι 3 σόνδες ΦΥΣΙΟΛΟΓΙΚΑ διαφέρουν) — ο μέσος όρος τους δεν είναι κανένα τμήμα.\n"
    "// T-SOILREF-04 (v50.165, Michalis 29/10): «ο μέσος όρος μένει ΜΟΝΟ μέχρι να δηλωθεί αισθητήρας απόφασης\n"
    "// στη φόρμα». ΚΑΜΙΑ αυτόματη επιλογή: το «ο πιο ξηρός» (v50.164) διάλεξε στον ΚΑΜΠΑΝΗ σόνδα εκτός χώματος\n"
    "// (226.589 λίτρα αντί «δεν χρειάζεται») και επεστράφη. Η δηλωμένη σόνδα (fieldConfig.soil_ref_device = id\n"
    "// συσκευής) γίνεται δεκτή μόνο αν μετρά σε κοινό βάθος, έδωσε πρόσφατη έγκυρη υγρασία και ΔΕΝ κρίθηκε\n"
    "// χαλασμένη — αλλιώς μένει ο μέσος όρος. ΕΜΒΕΛΕΙΑ: ΜΟΝΟ κανάλια εδάφους από ≥2 συσκευές. Τρέχει ΜΕΤΑ την\n"
    "// πύλη, τις ηλικίες και τον έλεγχο βλαβών (που βλέπουν ό,τι έβλεπαν πάντα).\n", "Δ0 σχόλιο")

OLD_LOGIC = s[s.index("    const score = (d) => {\n      for (const re of [/^soil_moisture\\d?_avg$/"):
              s.index("    if (!ref) return;   // κανένας με έγκυρη υγρασία: ό,τι ίσχυε (οι πύλες θα το πουν)\n")
              + len("    if (!ref) return;   // κανένας με έγκυρη υγρασία: ό,τι ίσχυε (οι πύλες θα το πουν)\n")]
NEW_LOGIC = r"""    // T-SOILREF-04: ΧΩΡΙΣ δήλωση → ο μέσος όρος, ΑΚΡΙΒΩΣ όπως ίσχυε (v50.163).
    const _rid = String(refId == null ? '' : refId).trim();
    if (!_rid) return;
    const ref = names.find(x => devs[x]._id === _rid) || null;
    const _lim = (_SAG_AGE_LIMITS.find(g => g.name === 'έδαφος') || {}).limit || 360;
    const _now = Date.now();
    const _fresh = (d) => Object.keys(d).some(k => /^(soil_moisture|water_soil|soil_humidity)\d?$/.test(k)
      && (function (x) { const v = Array.isArray(x) && x[0] && typeof x[0] === 'object' ? x[0].value : undefined;
        return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)); })(d[k]) && (function (a) { return a !== null && a <= _lim; })(_sagAgeMinutes(d[k], _now)));
    const _killed = (n) => ((data._sagFaults && data._sagFaults.faults) || []).some(f => f && f.kill && f.dev === n);
    const miss = !ref ? 'η δηλωμένη σόνδα δεν μετρά σε κοινό βάθος με τις άλλες'
      : (!_fresh(devs[ref]) ? ('η δηλωμένη σόνδα δεν έδωσε έγκυρη υγρασία τις τελευταίες ' + Math.round(_lim / 60) + ' ώρες')
      : (_killed(ref) ? 'η δηλωμένη σόνδα κρίθηκε χαλασμένη' : ''));
    if (miss) {
      data._sagSoilRefMiss = miss;
      console.log('[' + (fieldName || '—') + '] T-SOILREF-04: ' + miss + ' — μένει ο μέσος όρος');
      return;
    }
    const why = 'δηλωμένος';
"""
sub(OLD_LOGIC, NEW_LOGIC, "Δ1/Δ2 μόνο δηλωμένη, με πύλες")
sub("  // T-SOILREF-01: ΕΝΑΣ αισθητήρας απόφασης για το έδαφος, ΠΡΙΝ από κάθε πύλη και υπολογισμό.\n"
    "  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n  _sagPlausibilityGate(data, fieldName);\n",
    "  _sagPlausibilityGate(data, fieldName);\n", "Δ3 αφαίρεση κλήσης πριν την πύλη")
sub("  data._sagFaults = _sagSensorFaults(data, fieldName);\n",
    "  data._sagFaults = _sagSensorFaults(data, fieldName);\n"
    "  // T-SOILREF-04: ο ΔΗΛΩΜΕΝΟΣ αισθητήρας απόφασης, ΜΕΤΑ τον έλεγχο βλαβών (χαλασμένη δηλωμένη σόνδα → μέσος όρος).\n"
    "  _sagApplySoilRef(data, _SAG_SOIL_REF_ID, fieldName);\n", "Δ3 κλήση μετά τις βλάβες")
sub("            if (_j0 && typeof _j0 === 'object') _scPrev = _j0; } catch (_e0) {}\n",
    "            if (_j0 && typeof _j0 === 'object') _scPrev = _j0; } catch (_e0) {}\n"
    "          // T-SOILREF-04: άλλαξε η πηγή εδάφους (μέσος όρος ↔ δηλωμένη σόνδα, ή άλλη σόνδα) → η μάθηση ξεκινά από την αρχή.\n"
    "          const _scW = (measurements?.data?._sagSoilRef && measurements.data._sagSoilRef.n) ? String(measurements.data._sagSoilRef.n) : '';\n"
    "          if (String(_scPrev.w || '') !== _scW) {\n"
    "            console.log('[' + fieldName + '] T-SOILREF-04: νέα πηγή εδάφους («' + (_scW || 'μέσος όρος') + '») — η μάθηση T-SOILCAL ξεκινά από την αρχή');\n"
    "            _scPrev = {};\n"
    "          }\n", "Δ4 επανεκκίνηση μάθησης")
sub("? { s: _scS, d: _scD, eh: _scEh, u: _scDay } : { s: _scS, d: _scD, u: _scDay }),",
    "? Object.assign({ s: _scS, d: _scD, eh: _scEh, u: _scDay }, _scW ? { w: _scW } : {})\n"
    "                : Object.assign({ s: _scS, d: _scD, u: _scDay }, _scW ? { w: _scW } : {})),", "Δ4 πηγή στη μάθηση")
sub("        const _purgeShared = [];\n",
    "        const _purgeShared = [];\n"
    "        // T-SOILREF-04: κάρτες εδάφους που ΔΕΝ ισχύουν πια δεν μεταφέρονται από το προηγούμενο bundle (TTL 50ω).\n"
    "        try {\n"
    "          if (_SAG_SUBSTRATE_ACTIVE || !_sagDivergenceIndicators(measurements?.data).length) _purgeShared.push('sensor_divergence');\n"
    "          const _pES = (_prevBundleForWash?.shared || {}).soil_ec_status;\n"
    "          const _pESv = (_pES && typeof _pES === 'object' && 'value' in _pES) ? _pES.value : _pES;\n"
    "          if (!dailyTich && /^Σε αναστολή/.test(String(_pESv || ''))\n"
    "              && !(measurements?.data?._sagDivergeEc && Object.keys(measurements.data._sagDivergeEc).length)) _purgeShared.push('soil_ec_status');\n"
    "        } catch (_eSR) {}\n", "Δ5 καθάρισμα παλιών καρτών")
out = s.replace("\n", "\r\n").encode("utf-8")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, out); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
io.open(C, "wb").write(out)
print("ΜΕΤΑ πυρήνας", hashlib.sha256(out).hexdigest(), len(out))
