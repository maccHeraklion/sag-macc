# -*- coding: utf-8 -*-
# T-PHASE0B-01 (7/11/2026, Michalis): πυρήνας v50.182 → v50.183. Μόνο με count==1 ανά αντικατάσταση, CRLF.
#  Α. Ώρα ΥΓΡΗ αν ΟΠΟΙΟΔΗΠΟΤΕ δείγμα της ώρας του αισθητήρα φύλλου είναι υγρό (ανάγνωση μέγιστου 65 λεπτών ανά LMS01, μόνο ωριαία).
#  Β. Διαβροχή φύλλων σε θερμοκήπιο χωρίς βροχή → κάρτα leaf_wetting_event.
#  Γ. Πύλη ξενιστή ΑΝΑ ΘΕΣΗ καλλιέργειας (όχι ανά αγρό): υπόλοιπα ελιάς δεν μεταφέρονται στη θέση πορτοκαλιάς.
import sys
p = sys.argv[1] if len(sys.argv) > 1 else 'analysis/runPerTich.js'
b = open(p, 'rb').read()
assert b.count(b'\r\n') > 1000 and b.count(b'\n') == b.count(b'\r\n'), 'ο πυρήνας πρέπει να είναι καθαρό CRLF'
s = b.decode('utf-8')
N = '\r\n'


def sub(old, new, label):
    global s
    c = s.count(old)
    assert c == 1, f'{label}: βρέθηκε {c} φορές'
    s = s.replace(old, new)
    print('ok', label)


# 1. Έκδοση
sub("const SAG_KERNEL_VERSION = 'v50.182 · 2026-11-06';   // T-PHASE0-01",
    "const SAG_KERNEL_VERSION = 'v50.183 · 2026-11-07';   // T-PHASE0B-01 (ώρα υγρή από ΟΛΑ τα δείγματα του αισθητήρα φύλλου, διαβροχή φύλλων σε θερμοκήπιο, πύλη ξενιστή ανά θέση καλλιέργειας) · T-PHASE0-01",
    'έκδοση')

# 2. Νέος βοηθός ανάγνωσης: μέγιστο υγρασίας φύλλου της τελευταίας ώρας (μόνο LMS01, μόνο ωριαία).
helper = N.join([
    "/* ══ T-PHASE0B-01 (v50.183 · 7/11/2026) · Η ΩΡΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΟΛΑ ΤΑ ΔΕΙΓΜΑΤΑ ΤΟΥ ΦΥΛΛΟΥ ══",
    "   ΤΟ ΕΥΡΗΜΑ (6/11, LW6): ο πυρήνας έκρινε «υγρό/στεγνό φύλλο» από ΕΝΑ δείγμα (το τελευταίο",
    "   πριν τον παλμό), ενώ ο LMS01 στέλνει 3 δείγματα την ώρα. Ένα στεγνό τελευταίο δείγμα",
    "   μηδένιζε τον μετρητή ωρών μόλυνσης ακόμη κι αν τα δύο προηγούμενα ήταν υγρά. Αγρονομικά",
    "   η ώρα είναι υγρή αν το φύλλο ήταν υγρό ΜΕΣΑ στην ώρα (Magarey 2005: η διαβροχή μετρά",
    "   αθροιστικά). Διαβάζουμε τα δείγματα των τελευταίων 65 λεπτών (≤10 εγγραφές, μόνο στον",
    "   ωριαίο παλμό, μόνο για αισθητήρες φύλλου: ~18 συσκευές × 24 = ~1.300 εγγραφές/ημέρα).",
    "   Η τιμή γίνεται μέτρηση `leaf_moisture_hour_max` και χρησιμοποιείται ΜΟΝΟ στην κρίση",
    "   υγρού φύλλου· το τελευταίο δείγμα μένει όπως είναι για ηλικία/κάρτες/διαγνωστικά. */",
    "async function _sagLeafHourRead(device, deviceData, nowIso, fieldName) {",
    "  try {",
    "    const end = Date.parse(String(nowIso || ''));",
    "    if (!Number.isFinite(end)) return;",
    "    const rows = await device.getData({ variables: ['leaf_moisture'],",
    "      start_date: new Date(end - 65 * 60000).toISOString(), end_date: new Date(end).toISOString(), qty: 10 });",
    "    let mx = -Infinity, n = 0, tLast = null;",
    "    for (const r of (rows || [])) {",
    "      const v = Number(r && r.value); const t = Date.parse(String(r && r.time || ''));",
    "      if (!Number.isFinite(v) || v < 0 || v > 100) continue;",
    "      n++; if (v > mx) mx = v; if (Number.isFinite(t) && (tLast === null || t > tLast)) tLast = t;",
    "    }",
    "    if (n === 0) return;",
    "    deviceData.leaf_moisture_hour_max = [{ variable: 'leaf_moisture_hour_max', value: parseFloat(mx.toFixed(1)), unit: '%',",
    "      time: new Date(tLast || end).toISOString(), metadata: { n } }];",
    "  } catch (_eLh) { /* ποτέ δεν επηρεάζει τον κύκλο: χωρίς μέγιστο, ισχύει το τελευταίο δείγμα */ }",
    "}",
    "",
    "/* ══ T-PROFILE-01 (3/3) · Ο ΣΚΟΠΟΣ ΤΗΣ ΕΓΚΑΤΑΣΤΑΣΗΣ"])
sub("/* ══ T-PROFILE-01 (3/3) · Ο ΣΚΟΠΟΣ ΤΗΣ ΕΓΚΑΤΑΣΤΑΣΗΣ", helper, 'βοηθός _sagLeafHourRead')

# 3. Κλήση στον βρόχο συσκευών, δίπλα στη σκιώδη ανάγνωση.
sub("      if (hourTich) await _sagShadowRead(device, fieldName, info?.name || value, now);",
    "      if (hourTich) await _sagShadowRead(device, fieldName, info?.name || value, now);" + N +
    "      // T-PHASE0B-01: μέγιστο υγρασίας φύλλου της ώρας (μόνο αισθητήρες φύλλου, μόνο ωριαία)." + N +
    "      if (hourTich && String(info?.tags?.find?.((t) => t && t.key === 'type')?.value || '') === 'lms01_ls') {" + N +
    "        await _sagLeafHourRead(device, deviceData, now, fieldName);" + N +
    "      }",
    'κλήση ανάγνωσης ώρας')

# 4. Κρίση υγρού φύλλου από το μέγιστο της ώρας.
sub('  const leafMoisture = getVal(measurements, "leaf_moisture", null);',
    '  const leafMoisture = getVal(measurements, "leaf_moisture", null);' + N +
    '  // T-PHASE0B-01 (v50.183): η ΩΡΑ είναι υγρή αν ΟΠΟΙΟΔΗΠΟΤΕ δείγμα της ώρας είναι υγρό. Το μέγιστο των' + N +
    '  // τελευταίων 65 λεπτών (leaf_moisture_hour_max, από τον βρόχο συσκευών) μπαίνει ΜΟΝΟ στην κρίση' + N +
    '  // διαβροχής· το τελευταίο δείγμα μένει για ηλικία, κάρτες και διαγνωστικά. Χωρίς μέγιστο (παλιά' + N +
    '  // δεδομένα, μη ωριαίος παλμός, άλλος τύπος οργάνου) ισχύει ακριβώς η παλιά συμπεριφορά.' + N +
    '  const _lmHourMax = Number(getVal(measurements, "leaf_moisture_hour_max", NaN));' + N +
    "  const _lmLastN = (leafMoisture === null || leafMoisture === undefined || leafMoisture === '') ? NaN : Number(leafMoisture);" + N +
    '  const leafMoistureHour = (Number.isFinite(_lmHourMax) && Number.isFinite(_lmLastN)) ? Math.max(_lmLastN, _lmHourMax) : leafMoisture;',
    'μέγιστο ώρας στην κρίση')
sub("    leafMoisture: leafMoisture,",
    "    leafMoisture: leafMoistureHour,   // T-PHASE0B-01: μέγιστο της ώρας, όχι μόνο το τελευταίο δείγμα",
    'όρισμα _sagLeafWetness')

# 5. Διαβροχή φύλλων σε θερμοκήπιο χωρίς βροχή.
event = N.join([
    "  const _lwsRainWet = leafIsWet && _lws.source === 'rain';",
    "  // ── T-PHASE0B-01 (v50.183) · ΔΙΑΒΡΟΧΗ ΦΥΛΛΩΝ ΣΕ ΘΕΡΜΟΚΗΠΙΟ ──────────────────────",
    "  // ΤΟ ΕΥΡΗΜΑ (Κουτσάκης 26/10–3/11): απότομα «βρεξίματα» 16:00–17:00 (υγρασία φύλλου από",
    "  // ≤15 % σε 40–48 % μέσα σε μία ώρα) χωρίς βροχή — πότισμα από πάνω, υδρονέφωση ή ψεκασμός.",
    "  // Ο παραγωγός δεν το έβλεπε πουθενά, ενώ είναι ακριβώς η στιγμή που αρχίζουν να μετρούν οι",
    "  // ώρες μόλυνσης (Wang 2019, θερμοκήπιο). Μόνο σε ΚΑΛΥΜΜΕΝΗ καλλιέργεια (έξω η βροχή/δρόσος",
    "  // το εξηγούν), μόνο με μετρημένο φύλλο, ποτέ με βροχή. Η προηγούμενη ώρα κρατιέται ως",
    "  // εσωτερική κατάσταση (leaf_moisture_prev_hour). Κάρτα 12 ωρών (προεπιλεγμένο TTL).",
    "  {",
    "    const _weNow = Number.isFinite(_lmHourMax) && Number.isFinite(_lmLastN) ? Math.max(_lmLastN, _lmHourMax) : _lmLastN;",
    "    if (Number.isFinite(_weNow) && _weNow >= 0 && _weNow <= 100) {",
    "      const _wePrev = Number(getVal(measurements, 'leaf_moisture_prev_hour', NaN));",
    "      indicators.push({ variable: 'leaf_moisture_prev_hour', value: parseFloat(_weNow.toFixed(1)), metadata: { internal: true } });",
    "      if (parameters && parameters.covered_cultivation === true && Number.isFinite(_wePrev)",
    "          && _wePrev <= _SAG_LWS_WET && _weNow >= _SAG_LWS_WET + 15 && !(_lwsRain1h > _SAG_LWS_RAIN_MM)) {",
    "        let _hhmm = '';",
    "        try { _hhmm = new Date(measurements.now).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: measurements.timezone || 'Europe/Athens' }); } catch (_eT) { _hhmm = ''; }",
    "        indicators.push({ variable: 'leaf_wetting_event', value: 'Τα φύλλα βράχηκαν' + (_hhmm ? ' στις ' + _hhmm : ''),",
    "          metadata: { color: 'orange',",
    "            text: 'Η υγρασία φύλλου ανέβηκε από ' + _wePrev.toFixed(0) + ' % σε ' + _weNow.toFixed(0) + ' % μέσα σε μία ώρα, χωρίς βροχή. '",
    "              + 'Σε θερμοκήπιο αυτό σημαίνει πότισμα από πάνω, υδρονέφωση, ψεκασμό ή συμπύκνωση — από τώρα μετρούν οι ώρες μόλυνσης. '",
    "              + 'Αν ψεκάζετε ή ποτίζετε με ράντισμα, κάντε το πρωί ώστε το φύλλωμα να στεγνώσει πριν τη νύχτα.' } });",
    "      }",
    "    }",
    "  }"])
sub("  const _lwsRainWet = leafIsWet && _lws.source === 'rain';", event, 'διαβροχή φύλλων')

# 6. Πύλη ξενιστή ανά ΘΕΣΗ καλλιέργειας.
old6 = ("    const prevIndicators = prevCropsById[crop.id];" + N +
        '    if (!prevIndicators || typeof prevIndicators !== "object") continue;' + N +
        "    for (const [k, v] of Object.entries(prevIndicators)) {" + N +
        "      if (_bundleDeadWeight(k)) continue;                // T-BUNDLE-DEADWEIGHT-01" + N +
        "      if (crop.indicators[k] == null && !_bundleShouldDropStaleByHost(k, _currentHostSet)) {")
new6 = ("    const prevIndicators = prevCropsById[crop.id];" + N +
        '    if (!prevIndicators || typeof prevIndicators !== "object") continue;' + N +
        "    // T-PHASE0B-01 (v50.183): η πύλη ξενιστή κρίνεται ΑΝΑ ΘΕΣΗ καλλιέργειας. Με πύλη ανά αγρό, σε αγρό" + N +
        "    // ελιά + πορτοκαλιά (Ρηγάκης) οι υποθέσεις δάκου/πυρηνοτρήτη έμεναν ΚΑΙ στη θέση της πορτοκαλιάς" + N +
        "    // (ήταν κάποτε ελιά) — υπόλειμμα που είδε ο έλεγχος ομοιομορφίας 6/11. Αν η θέση δεν βρεθεί στη" + N +
        "    // ρύθμιση, ισχύει η παλιά πύλη ανά αγρό (καμία νέα απόρριψη)." + N +
        "    const _slotCfg = Array.isArray(currentCropsConfig) ? currentCropsConfig.find((c) => c && String(c.id) === String(crop.id)) : null;" + N +
        "    const _slotHostSet = _slotCfg ? (_bundleBuildCurrentHostSet([_slotCfg]) || _currentHostSet) : _currentHostSet;" + N +
        "    for (const [k, v] of Object.entries(prevIndicators)) {" + N +
        "      if (_bundleDeadWeight(k)) continue;                // T-BUNDLE-DEADWEIGHT-01" + N +
        "      if (crop.indicators[k] == null && !_bundleShouldDropStaleByHost(k, _slotHostSet)) {")
sub(old6, new6, 'πύλη ξενιστή ανά θέση')

out = s.encode('utf-8')
assert out.count(b'\n') == out.count(b'\r\n'), 'γυμνά LF μετά το patch'
open(p, 'wb').write(out)
print('ΓΡΑΦΤΗΚΕ', len(out), 'bytes')
