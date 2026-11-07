# -*- coding: utf-8 -*-
# T-APPROVAL-01 (7/11/2026, οδηγία Μιχάλη «ψάξε να βρεις εσύ το Sivanto και όποιο άλλο αντίστοιχο υλικό»): πυρήνας v50.184 → v50.185.
#  1. Νέα δραστική ουσία flupyradifurone (SIVANTO PRIME 200 SL) ΑΠΟ ΤΗΝ ΕΓΚΡΙΣΗ ΥΠΑΑΤ αρ. 14670 (αποφάσεις ΔΙΑΥΓΕΙΑ
#     03.11.2026 ΑΔΑ Ρ6ΔΙ4653ΠΓ-Η0Ν για χρήσεις/δόσεις/εφαρμογές και 03.04.2026 ΑΔΑ 9ΕΕΓ4653ΠΓ-ΞΥΞ για PHI) — καμία τιμή από
#     μνήμη ή καταστήματα. Σημειώσεις: analysis/ΕΛΕΓΧΟΣ/βιβλιογραφία/εγκρίσεις_ΦΠΠ_2026-11-07/SIVANTO_PRIME.md.
#  2. Νέα δομή `approval.uses` ανά σκεύασμα (γραμμές της έγκρισης ανά καλλιέργεια × στόχο: μέγ. εφαρμογές, μεσοδιάστημα, PHI,
#     υπαίθρου/θερμοκηπίου) + βοηθός _sagApprovalUse(). Το PHI ανά καλλιέργεια (T-PHI-PERCROP-01) παίρνει ΠΡΩΤΑ το PHI της
#     έγκρισης για τη συγκεκριμένη καλλιέργεια (αν ο αγρότης δεν δήλωσε δικό του), αλλιώς το ενιαίο PHI_days του καταλόγου.
#  3. Συνώνυμα δηλώσεων: «Sivanto», «Sivanto Prime», «flupyradifurone» → flupyradifurone (ο Κουτσάκης το δήλωσε 30/9 και δεν αναγνωριζόταν).
#  4. Κανονιστική εικόνα (PESTICIDE_PROPOSAL_PROFILE): approved, IRAC 4D, άδεια έως 09.06.2030, ΕΕ έως 09.06.2029.
#  5. Καθαρισμός σχολίου «Innodays» (η εγκατάσταση διαγράφηκε 7/11).
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


def J(lines):
    return N.join(lines)


# 1. Έκδοση
sub("const SAG_KERNEL_VERSION = 'v50.184 · 2026-11-07';   // T-PHASE1-01",
    "const SAG_KERNEL_VERSION = 'v50.185 · 2026-11-07';   // T-APPROVAL-01 (SIVANTO PRIME από την έγκριση ΥΠΑΑΤ 14670: ουσία flupyradifurone, πίνακας χρήσεων ανά καλλιέργεια, PHI ανά καλλιέργεια από την έγκριση, συνώνυμα δηλώσεων) · T-PHASE1-01",
    'έκδοση')

# 2. Νέα ουσία στο τέλος των εντομοκτόνων (πριν τα ακαρεοκτόνα).
entry = J([
    "        },",
    "        // ── T-APPROVAL-01 (v50.185 · 7/11/2026) · SIVANTO PRIME 200 SL — ΑΠΟ ΤΗΝ ΕΓΚΡΙΣΗ ΥΠΑΑΤ αρ. 14670 ──────────",
    "        // Πηγές: απόφαση 03.11.2026 (ΑΔΑ Ρ6ΔΙ4653ΠΓ-Η0Ν, φάσμα δράσης/δόσεις/εφαρμογές) και 03.04.2026 (ΑΔΑ 9ΕΕΓ4653ΠΓ-ΞΥΞ,",
    "        // PHI σημείο 13)· λήξη άδειας 09.06.2030 (απόφαση 05.01.2026)· ΕΕ Καν. 2025/1489 έως 09.06.2029. Σημειώσεις:",
    "        // analysis/ΕΛΕΓΧΟΣ/βιβλιογραφία/εγκρίσεις_ΦΠΠ_2026-11-07/SIVANTO_PRIME.md. ΚΑΝΟΝΑΣ: καμία τιμή από μνήμη ή καταστήματα.",
    "        // residualDays = το μεσοδιάστημα των 2 εφαρμογών στο θερμοκήπιο (10 ημ.) — ΑΠΟΦΑΣΗ-CLAUDE, η έγκριση δεν ορίζει",
    "        // «διάρκεια προστασίας». washoff χαμηλός: σημείο 4 της έγκρισης «σταθερότητα στην έκπλυση από βροχή μετά από 2 ώρες».",
    "        // PHI_days = το ΑΥΣΤΗΡΟΤΕΡΟ της έγκρισης (εσπεριδοειδή 30) ως εφεδρεία· ανά καλλιέργεια ισχύει το approval.uses.",
    "        flupyradifurone: {",
    "          name: \"Flupyradifurone (SIVANTO PRIME 200 SL)\",",
    "          activeIngredientClass: \"Βουτενολίδη (IRAC 4D)\",",
    "          type: \"Διασυστηματικό (επαφής & στομάχου)\",",
    "          residualDays: 10,",
    "          washoffFactor: 0.01,",
    "          uvDegradationFactor: 0.03,",
    "          targetPathogens: [\"Δάκος\", \"Λεκάνιο\", \"Αφίδες\", \"Αλευρώδεις\", \"Τζιτζικάκια\", \"Βαμβακάδα\"],",
    "          targetPathogen_keys: [\"bactrocera_oleae\", \"saissetia_oleae\", \"myzus_persicae\", \"bemisia_tabaci\", \"asymmetrasca_decedens\", \"empoasca_decipiens\", \"euphyllura_phillyreae\"],",
    "          PHI_days: 30,",
    "          crop_registration: [\"olive\", \"citrusFruits\", \"vineCrops\", \"stoneFruits\", \"vegetableCrops\", \"industrialCrops\"],",
    "          REI_hours: null,   // ΔΕΝ ΒΡΕΘΗΚΕ στην έγκριση (μόνο ΜΑΠ επανεισόδου)",
    "          max_applications_per_season: 1,   // 2 μόνο σε θερμοκήπιο (βλ. approval.uses)",
    "          approval: {",
    "            authority: \"ΥΠΑΑΤ\", number: \"14670\", granted: \"2018-08-06\", expires: \"2030-06-09\",",
    "            source: \"ΑΔΑ Ρ6ΔΙ4653ΠΓ-Η0Ν (03.11.2026) · PHI: ΑΔΑ 9ΕΕΓ4653ΠΓ-ΞΥΞ (03.04.2026)\",",
    "            bees: \"Χωρίς SPe8· όχι σε συνδυασμό με μυκητοκτόνα EBI κατά την άνθηση όταν οι μέλισσες επισκέπτονται τα άνθη (σημείο 6)\",",
    "            // crops: 'general:type' ή 'general:*'· covered: 'open' (υπαίθρου) | 'covered' (θερμοκήπιο) | 'both'· phi_days null = «καθορίζεται από τον χρόνο εφαρμογής»/μη εφαρμόσιμο.",
    "            uses: [",
    "              { crops: [\"olive:*\"], targets: [\"bactrocera_oleae\", \"saissetia_oleae\", \"euphyllura_phillyreae\"], dose: \"75 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 14, covered: \"open\" },",
    "              { crops: [\"citrusFruits:*\"], targets: [\"αφίδες\"], dose: \"75 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 30, covered: \"open\" },",
    "              { crops: [\"vineCrops:*\"], targets: [\"asymmetrasca_decedens\", \"αφίδες\", \"ψευδόκοκκος\", \"φυλλοξήρα\"], dose: \"20–30 (τζιτζικάκια) / 50 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 14, covered: \"open\" },",
    "              { crops: [\"stoneFruits:peach\"], targets: [\"empoasca_decipiens\"], dose: \"37,5 κ.εκ./στρ (LWA)\", max_apps: 1, interval_days: null, phi_days: 14, covered: \"open\" },",
    "              { crops: [\"stoneFruits:cherry\"], targets: [\"αφίδες\"], dose: \"12,5–37,5 κ.εκ./στρ ανά ύψος κόμης\", max_apps: 1, interval_days: null, phi_days: 7, covered: \"open\" },",
    "              { crops: [\"stoneFruits:plum\"], targets: [\"αφίδες\"], dose: \"12,5–37,5 κ.εκ./στρ ανά ύψος κόμης\", max_apps: 1, interval_days: null, phi_days: 14, covered: \"open\" },",
    "              { crops: [\"vegetableCrops:tomato\", \"vegetableCrops:pepper\", \"vegetableCrops:eggplant\"], targets: [\"myzus_persicae\", \"αφίδες\"], dose: \"45 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 3, covered: \"open\" },",
    "              { crops: [\"vegetableCrops:cucumber\", \"vegetableCrops:zucchini\", \"vegetableCrops:watermelon\"], targets: [\"αφίδες\"], dose: \"56 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 3, covered: \"open\" },",
    "              { crops: [\"vegetableCrops:tomato\", \"vegetableCrops:pepper\", \"vegetableCrops:eggplant\", \"vegetableCrops:cucumber\", \"vegetableCrops:zucchini\", \"vegetableCrops:watermelon\"], targets: [\"myzus_persicae\", \"bemisia_tabaci\", \"αφίδες\"], dose: \"45 (αφίδες) / 56 (αλευρώδεις) κ.εκ./στρ ανά 100 εκ. ύψους\", max_apps: 2, interval_days: 10, phi_days: 3, covered: \"covered\" },",
    "              { crops: [\"vegetableCrops:lettuce\"], targets: [\"αφίδες\"], dose: \"62,5 κ.εκ./στρ ψεκασμός · 30 ριζοπότισμα\", max_apps: 1, interval_days: null, phi_days: 3, covered: \"open\" },",
    "              { crops: [\"vegetableCrops:strawberry\"], targets: [\"αφίδες\", \"αλευρώδεις\"], dose: \"50 / 62,5 κ.εκ./στρ\", max_apps: 2, interval_days: 10, phi_days: 3, covered: \"covered\" },",
    "              { crops: [\"vegetableCrops:carrot\"], targets: [\"ψύλλα καρότου\"], dose: \"37,5 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 21, covered: \"open\" },",
    "              { crops: [\"industrialCrops:cotton\"], targets: [\"αφίδες\", \"empoasca_decipiens\"], dose: \"37,5 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: 21, covered: \"open\" },",
    "              { crops: [\"industrialCrops:tobacco\"], targets: [\"myzus_persicae\"], dose: \"50 κ.εκ./στρ\", max_apps: 1, interval_days: null, phi_days: null, covered: \"open\" }",
    "            ]",
    "          }",
    "        }",
    "      },",
    "      acaricides: {",
])
sub("        }" + N + "      }," + N + "      acaricides: {", entry, 'ουσία flupyradifurone')

# 3. Κανονιστική εικόνα.
prop = J([
    "      },",
    "      // T-APPROVAL-01 (v50.185): SIVANTO PRIME — έγκριση ΥΠΑΑΤ 14670 έως 09.06.2030, ΕΕ (Καν. 2025/1489) έως 09.06.2029.",
    "      flupyradifurone: {",
    "        proposal_allowed: true,",
    "        regulatory_state: \"approved\",",
    "        modeOfActionGroup: \"IRAC 4D\",",
    "        pollinatorRisk: \"medium\",",
    "        avoidDuringBloom: false,",
    "        proposal_rank: 1,",
    "        proposal_note: \"Έγκριση ΥΠΑΑΤ 14670 (έως 09.06.2030). Χωρίς SPe8, αλλά όχι σε συνδυασμό με μυκητοκτόνα EBI στην άνθηση όταν πετούν μέλισσες. Εναλλαγή με ουσίες εκτός IRAC 4 (διαχείριση ανθεκτικότητας). Χρήσεις/δόσεις/PHI ανά καλλιέργεια: approval.uses.\"",
    "      }",
    "    };",
    "",
    "",
    "// ═══ T-SOIL-PORT-01",
])
sub("      }" + N + "    };" + N + N + N + "// ═══ T-SOIL-PORT-01", prop, 'κανονιστική εικόνα')

# 4. Συνώνυμα δηλώσεων.
sub("  'δελταμεθρινη': 'deltamethrin', 'decis': 'deltamethrin', 'σπινοσαντ': 'spinosad'," + N + "};",
    "  'δελταμεθρινη': 'deltamethrin', 'decis': 'deltamethrin', 'σπινοσαντ': 'spinosad'," + N +
    "  // T-APPROVAL-01 (v50.185): SIVANTO PRIME (έγκριση ΥΠΑΑΤ 14670) — ο Κουτσάκης το δήλωσε 30/9 και δεν αναγνωριζόταν." + N +
    "  'sivanto': 'flupyradifurone', 'sivanto prime': 'flupyradifurone', 'sivanto prime 200 sl': 'flupyradifurone'," + N +
    "  'flupyradifurone': 'flupyradifurone', 'φλουπυραντιφουρονη': 'flupyradifurone', 'σιβαντο': 'flupyradifurone'," + N +
    "  // LAINSECT 1,8 EC = abamectin 1,8 % (ΑΑΔΑ 14.631· αποφάσεις ΥΠΑΑΤ κατά παρέκκλιση 2025/2026) — δηλώθηκε 2/10 και δεν αναγνωριζόταν." + N +
    "  'lainsect': 'abamectin', 'lainsect 1 8 ec': 'abamectin'," + N + "};",
    'συνώνυμα')

# 5. Βοηθός πίνακα χρήσεων.
helper = J([
    "// ── T-APPROVAL-01 (v50.185 · 7/11/2026) · ΠΙΝΑΚΑΣ ΧΡΗΣΕΩΝ ΑΠΟ ΤΗΝ ΕΓΚΡΙΣΗ ──────────────────────────────",
    "// Ένα σκεύασμα μπορεί να έχει `approval.uses`: γραμμές ΑΠΟ ΤΗΝ ΑΠΟΦΑΣΗ ΕΓΚΡΙΣΗΣ του ΥΠΑΑΤ (όχι από μνήμη, όχι από",
    "// καταστήματα — κανόνας Μιχάλη). crops: 'general:type' ή 'general:*'· covered: 'open' | 'covered' | 'both'.",
    "// Επιστρέφει τη γραμμή που ταιριάζει στην καλλιέργεια (ο ακριβής τύπος υπερισχύει του *), αλλιώς null.",
    "function _sagApprovalUse(pesticide, hostKey, covered) {",
    "  try {",
    "    const uses = pesticide && pesticide.approval && Array.isArray(pesticide.approval.uses) ? pesticide.approval.uses : null;",
    "    if (!uses || !hostKey) return null;",
    "    const hk = String(hostKey); const gen = hk.split(':')[0] + ':*'; const want = covered ? 'covered' : 'open';",
    "    let exact = null, wild = null;",
    "    for (const u of uses) {",
    "      if (!u || !Array.isArray(u.crops)) continue;",
    "      const cov = u.covered || 'both';",
    "      if (cov !== 'both' && cov !== want) continue;",
    "      if (u.crops.indexOf(hk) >= 0) { if (!exact) exact = u; }",
    "      else if (u.crops.indexOf(gen) >= 0) { if (!wild) wild = u; }",
    "    }",
    "    return exact || wild || null;",
    "  } catch (_e) { return null; }",
    "}",
    "",
    "// Άγνωστο σκεύασμα: ισχύουν οι μέρες του αγρότη (1..60), αλλιώς 7 ημέρες βάση —",
])
sub("// Άγνωστο σκεύασμα: ισχύουν οι μέρες του αγρότη (1..60), αλλιώς 7 ημέρες βάση —", helper, 'βοηθός _sagApprovalUse')

# 6. PHI ανά καλλιέργεια: κρατάμε σκεύασμα/ημερομηνία/δηλωμένο PHI στη λίστα και εφαρμόζουμε την έγκριση ανά καλλιέργεια.
sub("              _phiSpr.push({ end: _endMs2, k: _pk, days: _ph," + N +
    "                prod: String(_rec2.p || 'δηλωμένο σκεύασμα').slice(0, 60) });",
    "              _phiSpr.push({ end: _endMs2, k: _pk, days: _ph," + N +
    "                prod: String(_rec2.p || 'δηλωμένο σκεύασμα').slice(0, 60)," + N +
    "                p: _rec2.p, dMs: _dMs,   // T-APPROVAL-01: για PHI της έγκρισης ανά καλλιέργεια" + N +
    "                h: (Number.isFinite(Number(_rec2.h)) && Number(_rec2.h) >= 0 && Number(_rec2.h) <= 90) ? Number(_rec2.h) : null });",
    'PHI λίστα')

sub("              for (const _sp2 of _phiSpr) {" + N +
    "                const _hs2 = _hostsMap2[_sp2.k];" + N +
    "                if (_hs2 && !_hs2.has(_hk)) continue;" + N +
    "                if (!_best || _sp2.end > _best.end) _best = _sp2;" + N +
    "              }",
    J([
    "              for (const _sp2 of _phiSpr) {",
    "                const _hs2 = _hostsMap2[_sp2.k];",
    "                if (_hs2 && !_hs2.has(_hk)) continue;",
    "                // T-APPROVAL-01 (v50.185): PHI ΤΗΣ ΕΓΚΡΙΣΗΣ για αυτή την καλλιέργεια, αν το σκεύασμα έχει πίνακα",
    "                // χρήσεων και ο αγρότης δεν δήλωσε δικό του PHI· αλλιώς το ενιαίο PHI_days του καταλόγου.",
    "                let _cand = _sp2;",
    "                if (_sp2.h === null || _sp2.h === undefined) {",
    "                  const _use = _sagApprovalUse(_sagFindPesticideByRef(_sp2.p), _hk, !!_SAG_COVERED_ACTIVE);",
    "                  if (_use && Number.isFinite(Number(_use.phi_days)) && Number.isFinite(_sp2.dMs)) {",
    "                    const _endA = _sp2.dMs + Number(_use.phi_days) * 86400000;",
    "                    if (_endA <= Date.now()) continue;",
    "                    _cand = Object.assign({}, _sp2, { end: _endA, days: Number(_use.phi_days) });",
    "                  }",
    "                }",
    "                if (!_best || _cand.end > _best.end) _best = _cand;",
    "              }",
    ]),
    'PHI ανά καλλιέργεια από την έγκριση')

# 7. Σχόλιο Innodays (η εγκατάσταση διαγράφηκε 7/11).
sub("// 0–9 ώρες σε 14 ημέρες· Innodays 227, ΚΥΔΩΝ 46, Β5 21 (κοινόχρηστοι αισθητήρες σε άλλο χώρο).",
    "// 0–9 ώρες σε 14 ημέρες· τρεις εγγραφές με κοινόχρηστους αισθητήρες σε άλλο χώρο έδωσαν 21–227 (6/11).",
    'σχόλιο Innodays')

out = s.encode('utf-8')
assert out.count(b'\n') == out.count(b'\r\n'), 'έξοδος όχι καθαρό CRLF'
open(p, 'wb').write(out)
print('ΓΡΑΦΤΗΚΕ', len(out), 'bytes')
