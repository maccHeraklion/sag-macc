# -*- coding: utf-8 -*-
"""T-SOILWOUND-01 (v50.180, 4/11/2026, απόφαση Michalis «ναι στις 7 γραμμές του πίνακα», γραμμές 2, 3, 4).
Πηγές: analysis/ΕΛΕΓΧΟΣ/ΤΙΜΕΣ_ΒΙΒΛΙΟΓΡΑΦΙΑΣ_ΠΑΘΟΓΟΝΩΝ_2026-11-04.md §1–3.
 (Γ2) μελάνωση καστανιάς → Soilborne_Disease_Model: T εδάφους [15,30], κορεσμός AWC ≥ 85 %, μνήμη κορεσμού 14 ημέρες·
 (Γ3) γομμώσεις εσπεριδοειδών → Soilborne_Disease_Model: T [12,27], κορεσμός, μνήμη 14 ημέρες, παράθυρα 1/3–30/6 και 1/9–30/11·
 (Γ4) έλκος καστανιάς → νέος τύπος Wound_Canker_Model: T αέρα [15,28], πληγές (κλάδεμα/χαλάζι/παγετός από τη φόρμα) ή βροχή ≥ 1 mm,
      εποχικά βάρη Μάιος–Ιούλιος 1,0 · Μάρτιος–Απρίλιος και Αύγουστος–Οκτώβριος 0,6 · χειμώνας 0.
 Χωρίς αισθητήρα εδάφους τα δύο εδαφογενή δίνουν γκρι «Μη διαθέσιμο» με αιτία και καλλιεργητικά μέτρα (όχι σιωπή).
 Οι 3 φεύγουν από τη λίστα αναστολής _SAG_NONFOLIAR_SUSPENDED (μένουν 4). count==1, CRLF, node --check."""
import io, sys, subprocess, hashlib, os, tempfile, re
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); s = raw.decode("utf-8")
assert s.count("\n") == s.count("\r\n"), "όχι καθαρό CRLF"
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-LITVALUES-01" in s and "T-SOILWOUND-01" not in s
N = "\r\n"
def J(*lines): return N.join(lines) + N

s, n = re.subn(r"^const SAG_KERNEL_VERSION = 'v50\.179 · 2026-11-04';   // T-LITVALUES-01",
               "const SAG_KERNEL_VERSION = 'v50.180 · 2026-11-04';   // T-SOILWOUND-01 (μελάνωση και γομμώσεις στο εδαφογενές μοντέλο, έλκος καστανιάς σε μοντέλο πληγών) · T-LITVALUES-01",
               s, count=1, flags=re.M)
assert n == 1, "έκδοση"; print("OK έκδοση")

OLD_CIT = J(
  '  phytophthora_citrophthora: {',
  '    name: "Γομμώσεις Εσπεριδοειδών (Phytophthora citrophthora)",',
  '    crops: [',
  '      { cultivation_type_general: "citrusFruits", cultivation_type: "orange" },',
  '      { cultivation_type_general: "citrusFruits", cultivation_type: "lemon" },',
  '      { cultivation_type_general: "citrusFruits", cultivation_type: "mandarin" }',
  '    ],',
  '    type: "Infection_Triangle",',
  '    description: "Γομμώσεις εσπεριδοειδών — ωομύκητας εδάφους. Προσβάλλει κορμό, ρίζες, καρπούς. Κορυφή κινδύνου: χειμώνας.",',
  '    optimalTempRange: { min: 10, opt: 24, max: 30 },',
  '    optimalHumidity: { min: 95, max: 100 },',
  '    requiredDurationHrs: 12,',
  '    requiresLeafWetness: false,',
  '    rainInhibitsInfection: false,',
  '    notes: "ΕΔΑΦΟΓΕΝΗΣ ωομύκητας — κίνδυνος σε βαρύ/κακοστράγγιστο έδαφος. Κορυφή: Νοε-Μαρ Μεσογείου. SAG v4.1 provisional."',
  '  },')
NEW_CIT = J(
  '  phytophthora_citrophthora: {',
  '    name: "Γομμώσεις Εσπεριδοειδών (Phytophthora citrophthora)",',
  '    crops: [',
  '      { cultivation_type_general: "citrusFruits", cultivation_type: "orange" },',
  '      { cultivation_type_general: "citrusFruits", cultivation_type: "lemon" },',
  '      { cultivation_type_general: "citrusFruits", cultivation_type: "mandarin" }',
  '    ],',
  '    type: "Soilborne_Disease_Model",',
  '    description: "Γομμώσεις εσπεριδοειδών — ωομύκητας εδάφους που προσβάλλει ρίζες και λαιμό/κορμό από κορεσμένο έδαφος. T-SOILWOUND-01 (v50.180, 4/11/2026): από Infection_Triangle (RH 95 %/12 ω — λάθος μοντέλο) σε εδαφογενές με εποχικό παράθυρο (_SAG_SEASON_WINDOWS: άνοιξη + φθινόπωρο, Álvarez 2009 Βαλένθια — όχι χειμώνας).",',
  '    risk_model_params: {',
  '      soil_T_optimal_C: [12, 27],          // Matheron & Porchas 1996: αποικισμός ριζών 9–27 °C, κρίσιμο 27· Matheron 1992: σποριάγγεια 20–30· βέλτιστο 24–28',
  '      soil_moisture_optimal_pct: [85, 150], // AWC %: κορεσμός (MacDonald & Duniway 1978)',
  '      saturation_memory_days: 14,          // Besoain 2005, Hord & Ristaino 1992: ένα επεισόδιο κορεσμού αρκεί',
  '      inoculum_decay_years: 10,',
  '      stress_amplifier: 1.2,',
  '      drainage_class_multipliers: { poor: 1.5, moderate: 1.0, good: 0.6 }',
  '    },',
  '    advice_el: "Κρατήστε τον λαιμό στεγνό: μην βρέχετε τον κορμό στο πότισμα, μην παραχώνετε τον εμβολιασμό, βελτιώστε τη στράγγιση. Σε έντονη εξίδρωση κόμμεος ζητήστε γεωπόνο.",',
  '    notes: "ΠΗΓΕΣ: ΤΙΜΕΣ_ΒΙΒΛΙΟΓΡΑΦΙΑΣ_ΠΑΘΟΓΟΝΩΝ_2026-11-04 §2."',
  '  },')
OLD_CRY = J(
  '  cryphonectria_parasitica: {',
  '    crops: [',
  '      { cultivation_type_general: "nutCrops", cultivation_type: "chestnut" }',
  '    ],',
  '    name: "Έλκος Καστανιάς (Cryphonectria parasitica — Chestnut Blight)",',
  '    type: "Infection_Triangle",',
  '    description: "Καστανόπληξ — είσοδος μέσω τραυμάτων φλοιού, νεκρώνει τον καμβιό, καταστρεπτικό νόσημα.",',
  '    optimalTempRange: { min: 10, opt: 25, max: 35 },',
  '    optimalHumidity: { min: 75, max: 100 },',
  '    requiresLeafWetness: false,',
  '    rainInhibitsInfection: false,',
  '    requiredDurationHrs: 24,',
  '    notes: "Τραύματα (παγετός, κλάδεμα) = πύλες εισόδου. Πολυετές νόσημα φλοιού. MODELING_APPROXIMATION: FIR ενδεικτικός υγρής-θερμής περιόδου, όχι άμεσος δείκτης φυλλικής μόλυνσης. SAG v4.1 LIT-tier."',
  '  },')
NEW_CRY = J(
  '  cryphonectria_parasitica: {',
  '    crops: [',
  '      { cultivation_type_general: "nutCrops", cultivation_type: "chestnut" }',
  '    ],',
  '    name: "Έλκος Καστανιάς (Cryphonectria parasitica — Chestnut Blight)",',
  '    type: "Wound_Canker_Model",',
  '    description: "Έλκος καστανιάς — μύκητας φλοιού που μπαίνει από πληγές (κλάδεμα, χαλάζι, παγετός) με βροχή σε ήπιο καιρό. T-SOILWOUND-01 (v50.180, 4/11/2026): από Infection_Triangle (RH 75 %/24 ω — μετρούσε «υγρή-θερμή περίοδο») σε μοντέλο πληγών.",',
  '    risk_model_params: {',
  '      T_optimal_C: [15, 28],               // Guérin 2001: ασκοσπόρια 15–25, μέγιστο 20–25· Guérin & Robin 2003: βλάβη ↑ με μέγιστη T',
  '      rain_event_min_mm: 1,                // Lione 2022: βροχερές ημέρες 1–10 mm ανεβάζουν τα προπάγουλα',
  '      wound_windows_days: { pruning: 28, hail: 28, storm: 28, frost: 60 },   // Russin & Shain 1984: πληγές 0–28 ημερών μολύνονται',
  '      season_weights: [[501, 731, 1.0], [301, 430, 0.6], [801, 1031, 0.6]]   // Guérin & Robin 2003: Μάιος–Ιούλιος μόλυνση, φθινόπωρο/χειμώνας καμία ορατή· Lione 2022: κορυφές άνοιξη + φθινόπωρο',
  '    },',
  '    advice_el: "Δεν υπάρχει χημική αντιμετώπιση. Κλαδεύετε σε ξηρό καιρό, απολυμαίνετε τα εργαλεία, αφαιρείτε τα έλκη με υγιές ξύλο· ρωτήστε για υποπαθογόνα στελέχη (υποϊός).",',
  '    notes: "ΠΗΓΕΣ: ΤΙΜΕΣ_ΒΙΒΛΙΟΓΡΑΦΙΑΣ_ΠΑΘΟΓΟΝΩΝ_2026-11-04 §3. Πληγές από τη φόρμα (wound_pruning_date, wound_hail_date, wound_frost_date → wound_history)."',
  '  },')
OLD_XC = J(
  '  phytophthora_xcambivora: {',
  '    crops: [',
  '      { cultivation_type_general: "nutCrops", cultivation_type: "chestnut" }',
  '    ],',
  '    name: "Μελάνωση Καστανιάς — Φυτόφθορα Καστανιάς (Phytophthora ×cambivora)",',
  '    type: "Infection_Triangle",',
  '    description: "Μελάνωση καστανιάς — ωοκόκκοι εδάφους, ευνοείται από κορεσμό εδάφους και δροσερές θερμοκρασίες.",',
  '    optimalTempRange: { min: 5, opt: 18, max: 25 },',
  '    optimalHumidity: { min: 95, max: 100 },',
  '    requiresLeafWetness: true,',
  '    rainInhibitsInfection: false,',
  '    requiredDurationHrs: 6,',
  '    notes: "Κλήρωση εδάφους = ευνοεί. Προσοχή: Phytophthora = ωοκόκκος, όχι μύκητας. SAG v4.1 LIT-tier."',
  '  },')
NEW_XC = J(
  '  phytophthora_xcambivora: {',
  '    crops: [',
  '      { cultivation_type_general: "nutCrops", cultivation_type: "chestnut" }',
  '    ],',
  '    name: "Μελάνωση Καστανιάς — Φυτόφθορα Καστανιάς (Phytophthora ×cambivora)",',
  '    type: "Soilborne_Disease_Model",',
  '    description: "Μελάνωση καστανιάς — ωομύκητες εδάφους (P. ×cambivora, P. cinnamomi): ζωοσπόρια μόνο σε κορεσμένο έδαφος, σποριάγγεια από 15 °C, βέλτιστο 24–27 °C. Η παλιά σημείωση «δροσερές θερμοκρασίες» δεν επιβεβαιώνεται. T-SOILWOUND-01 (v50.180, 4/11/2026): από Infection_Triangle (υγρό φύλλο 95 %/6 ω — λάθος μοντέλο) σε εδαφογενές.",',
  '    risk_model_params: {',
  '      soil_T_optimal_C: [15, 30],          // Nesbitt 1979: σποριάγγεια ≥ 15· Huang 2012: 8–32, βέλτ. 24· Brasier 1995: βέλτ. 27,5, μέγ. 33,5· Scagel 2023: cinnamomi 6,5/25,3/35',
  '      soil_moisture_optimal_pct: [85, 150], // AWC %: κορεσμός — MacDonald & Duniway 1978 (ζωοσπόρια 0 έως −5 mb)',
  '      saturation_memory_days: 14,          // Besoain 2005: κορεσμός 24 ω ανά δεκαπενθήμερο → 50 % σήψη ριζών',
  '      inoculum_decay_years: 10,',
  '      stress_amplifier: 1.2,',
  '      drainage_class_multipliers: { poor: 1.5, moderate: 1.0, good: 0.6 }   // Trenti 2025, Prospero 2023 (ποιοτικά)',
  '    },',
  '    advice_el: "Βελτιώστε τη στράγγιση, αποφύγετε κορεσμό και τραύματα στον λαιμό· δέντρα με εξίδρωση ή αραίωμα κόμης να τα δει γεωπόνος. Ένεση κορμού με φωσφονικό κάλιο (Brandano 2023) μόνο με γεωπόνο.",',
  '    notes: "ΠΗΓΕΣ: ΤΙΜΕΣ_ΒΙΒΛΙΟΓΡΑΦΙΑΣ_ΠΑΘΟΓΟΝΩΝ_2026-11-04 §1."',
  '  },')

WOUND_FN = J(
  '// T-SOILWOUND-01 (v50.180): ER έλκους καστανιάς — μοντέλο πληγών. er = f_T(αέρας) · f_season · f_entry, με',
  '// f_entry = 1 για δηλωμένη πρόσφατη πληγή (φόρμα: κλάδεμα/χαλάζι/καταιγίδα ≤ 28 ημ., παγετός ≤ 60), 0,5 για βροχή',
  '// ≥ rain_event_min_mm χωρίς δηλωμένη πληγή, 0 αλλιώς. Εκτός περιόδου μόλυνσης (season_weights) → 0, όχι null.',
  '// null ΜΟΝΟ χωρίς θερμοκρασία αέρα (καμία εκτίμηση).',
  'function _computeWoundCankerER(pathogen, measurements, parameters) {',
  '  const params = pathogen.risk_model_params || {};',
  '  const md = _sagMonthDayNow(measurements);',
  '  let f_season = 0;',
  '  for (const w of (params.season_weights || [])) if (md >= w[0] && md <= w[1]) f_season = Math.max(f_season, Number(w[2]) || 0);',
  '  if (f_season <= 0) return 0;',
  "  const tAir = Number(getVal(measurements, 'air_temperature', getVal(measurements, 'temperature', NaN)));",
  '  if (!Number.isFinite(tAir)) return null;',
  '  const T_range = params.T_optimal_C || [15, 28];',
  '  const T_min = T_range[0], T_max = T_range[1], T_opt = (T_min + T_max) / 2;',
  '  let f_T;',
  '  if (tAir < T_min || tAir > T_max) f_T = 0;',
  '  else if (tAir <= T_opt) f_T = (tAir - T_min) / (T_opt - T_min);',
  '  else                    f_T = (T_max - tAir) / (T_max - T_opt);',
  '  f_T = Math.max(0, Math.min(1, f_T));',
  '  const rainMin = Number(params.rain_event_min_mm) || 1;',
  "  let rain24 = Number(getVal(measurements, 'rain_height_daily', NaN));",
  "  if (!Number.isFinite(rain24)) rain24 = Number(getVal(measurements, 'current_rain_height_daily', NaN));",
  '  if (!Number.isFinite(rain24) || rain24 < 0) rain24 = 0;',
  '  const w = (parameters && parameters.wound_history) || {};',
  '  const _wwd = params.wound_windows_days || {};',
  '  const recent = (k, d, dflt) => w[k] !== undefined && Number(w[k]) <= (Number(_wwd[d]) || dflt);',
  "  const woundPresent = recent('days_since_pruning', 'pruning', 28) || recent('days_since_hail', 'hail', 28)",
  "    || recent('days_since_storm', 'storm', 28) || recent('days_since_frost', 'frost', 60);",
  '  const f_entry = woundPresent ? 1.0 : (rain24 >= rainMin ? 0.5 : 0);',
  '  return Math.max(0, Math.min(1, f_T * f_season * f_entry));',
  '}',
  '')

SUBS = [
  (OLD_CIT, NEW_CIT, "Γ3 προφίλ γομμώσεων"),
  (OLD_CRY, NEW_CRY, "Γ4 προφίλ έλκους"),
  (OLD_XC, NEW_XC, "Γ2 προφίλ μελάνωσης"),
  ("const _SAG_NONFOLIAR_SUSPENDED = ['phytophthora_xcambivora', 'cryphonectria_parasitica', 'phytophthora_citrophthora'," + N
   + "  'phytophthora_niederhauserii', 'phytophthora_pythium_root_rot_herbs', 'fusarium_spp_corm_rot', 'plasmopara_halstedii'];" + N,
   "const _SAG_NONFOLIAR_SUSPENDED = [   // T-SOILWOUND-01 (v50.180): μελάνωση, γομμώσεις και έλκος πήραν δικό τους μοντέλο· μένουν 4" + N
   + "  'phytophthora_niederhauserii', 'phytophthora_pythium_root_rot_herbs', 'fusarium_spp_corm_rot', 'plasmopara_halstedii'];" + N, "Σ λίστα αναστολής"),
  ("const _SAG_NO_CASE_TYPES = new Set(['GDD_Pest', 'Soilborne_Disease_Model', 'Soil_Phenology_DD']);",
   "const _SAG_NO_CASE_TYPES = new Set(['GDD_Pest', 'Soilborne_Disease_Model', 'Soil_Phenology_DD', 'Wound_Canker_Model']);   // T-SOILWOUND-01", "υποθέσεις"),
  ("  Bacterial_Disease_Model: {" + N + "    low: 'Χωρίς πληγές ή βροχή, δεν υπάρχει δίοδος μόλυνσης.',",
   "  Wound_Canker_Model: {   // T-SOILWOUND-01: έλκος καστανιάς" + N
   + "    low: 'Χωρίς πρόσφατες πληγές ή βροχή σε ήπιο καιρό, ή εκτός περιόδου μόλυνσης (κυρίως Μάιος–Ιούλιος): χωρίς δίοδο μόλυνσης.'," + N
   + "    why: 'Πρόσφατες πληγές (κλάδεμα, χαλάζι, παγετός) ή βροχή σε ήπιο καιρό μέσα στην περίοδο μόλυνσης'," + N
   + "    watch: 'Μην κλαδεύετε με υγρασία· ελέγξτε κορμό και κλάδους για έλκη.'," + N
   + "  }," + N
   + "  Bacterial_Disease_Model: {" + N + "    low: 'Χωρίς πληγές ή βροχή, δεν υπάρχει δίοδος μόλυνσης.',", "κείμενα μοντέλου"),
  ("  colletotrichum_gloeosporioides: { from: 315, to: 531, what: 'την ανθράκνωση', why: 'μολύνει τα άνθη και τη νεαρή βλάστηση της άνοιξης' }," + N,
   "  colletotrichum_gloeosporioides: { from: 315, to: 531, what: 'την ανθράκνωση', why: 'μολύνει τα άνθη και τη νεαρή βλάστηση της άνοιξης' }," + N
   + "  phytophthora_citrophthora: { ranges: [[301, 630], [901, 1130]], what: 'τις γομμώσεις', why: 'οι μολύνσεις του κορμού γίνονται άνοιξη και φθινόπωρο (Álvarez 2009, Βαλένθια)' },   // T-SOILWOUND-01" + N, "παράθυρο γομμώσεων"),
  ("  if (!w) return true;" + N + "  return w.from <= w.to ? (md >= w.from && md <= w.to) : (md >= w.from || md <= w.to);" + N,
   "  if (!w) return true;" + N
   + "  const _in = (a, b) => a <= b ? (md >= a && md <= b) : (md >= a || md <= b);" + N
   + "  if (Array.isArray(w.ranges)) return w.ranges.some((r) => _in(r[0], r[1]));   // T-SOILWOUND-01: πολλαπλά παράθυρα" + N
   + "  return _in(w.from, w.to);" + N, "πολλαπλά παράθυρα"),
  ("function _computeSoilborneER(pathogen, pathogenKey, measurements, parameters, ipsiNorm) {",
   "function _computeSoilborneER(pathogen, pathogenKey, measurements, parameters, ipsiNorm, satDays) {", "υπογραφή εδαφογενούς"),
  ("      f_M = Math.max(0.3, 1.0 - dist / 30);" + N + "    }" + N + "  }" + N,
   "      f_M = Math.max(0.3, 1.0 - dist / 30);" + N + "    }" + N + "  }" + N
   + "  // T-SOILWOUND-01: μνήμη κορεσμού (Phytophthora) — f_M = 1 για saturation_memory_days μετά το τελευταίο επεισόδιο, μετά φθίνει ως 0,3." + N
   + "  if (params.saturation_memory_days !== undefined && satDays !== null && satDays !== undefined && Number.isFinite(Number(satDays))) {" + N
   + "    const _mem = Number(params.saturation_memory_days) || 14;" + N
   + "    f_M = satDays <= _mem ? 1.0 : Math.max(0.3, 1.0 - (satDays - _mem) / _mem);" + N
   + "  }" + N, "μνήμη κορεσμού"),
  ("// ER βακτηριακών (καρκίνωση ελιάς) — v4.1 αυτούσιο:" + N, WOUND_FN + "// ER βακτηριακών (καρκίνωση ελιάς) — v4.1 αυτούσιο:" + N, "συνάρτηση πληγών"),
  ('      } else if (erCalculationType === "Soilborne_Disease_Model") {' + N
   + '        // T-SOILMODELS-01: κίνδυνος από συνθήκες ριζοστρώματος + ιστορικό αγρού.' + N
   + '        const _ipsiNorm = _ipsiOk ? Math.max(0, Math.min(1, Number(ipsiAvg) / 10)) : 0;' + N
   + '        er = _computeSoilborneER(pathogen, pathogenKey, measurements, parameters, _ipsiNorm);' + N
   + '        if (er === null) continue; // χωρίς αισθητήρα εδάφους: καμία κάρτα, όχι ψευδο-μηδέν' + N,
   '      } else if (erCalculationType === "Soilborne_Disease_Model") {' + N
   + '        // T-SOILMODELS-01: κίνδυνος από συνθήκες ριζοστρώματος + ιστορικό αγρού.' + N
   + '        const _ipsiNorm = _ipsiOk ? Math.max(0, Math.min(1, Number(ipsiAvg) / 10)) : 0;' + N
   + '        // T-SOILWOUND-01: εποχικό παράθυρο (γομμώσεις: άνοιξη + φθινόπωρο) — εκτός, κάρτα «Εκτός περιόδου» χωρίς fir_.' + N
   + '        if (!_sagInSeasonWindow(pathogenKey, _sagMonthDayNow(measurements))) {' + N
   + "          indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός κίνδυνος'," + N
   + "            metadata: { color: 'green', text: _sagSilentText(pathogenKey) } }];" + N
   + '          continue;' + N
   + '        }' + N
   + '        // T-SOILWOUND-01: μνήμη κορεσμού — τα ζωοσπόρια βγαίνουν μόνο σε κορεσμένο έδαφος (MacDonald & Duniway 1978) και ένα' + N
   + '        // επεισόδιο 24 ωρών αρκεί για εβδομάδες (Besoain 2005). Κρατάμε τον χρόνο (λεπτά) της τελευταίας ώρας κορεσμού.' + N
   + '        let _satDays = null;' + N
   + '        const _rmp = pathogen.risk_model_params || {};' + N
   + '        if (_rmp.saturation_memory_days !== undefined) {' + N
   + '          const _awcNow = _sagSoilMoistAwcPct(measurements, parameters);' + N
   + '          const _satMin = Number((_rmp.soil_moisture_optimal_pct || [])[0]) || 85;' + N
   + '          const _nowMin = _sagMomentNow(measurements).valueOf() / 60000;' + N
   + "          let _last = Number(getVal(measurements, 'soilsat_last_' + pathogenKey, NaN));" + N
   + '          if (_awcNow !== null && _awcNow >= _satMin) _last = Math.floor(_nowMin);' + N
   + '          if (Number.isFinite(_last)) {' + N
   + "            indicators = [...indicators, { variable: 'soilsat_last_' + pathogenKey, value: _last }];" + N
   + '            _satDays = Math.max(0, (_nowMin - _last) / 1440);' + N
   + '          }' + N
   + '        }' + N
   + '        er = _computeSoilborneER(pathogen, pathogenKey, measurements, parameters, _ipsiNorm, _satDays);' + N
   + '        if (er === null) {' + N
   + '          // χωρίς αισθητήρα εδάφους: καμία εκτίμηση, όχι ψευδο-μηδέν. Για όσες ήρθαν από τη μηχανή φύλλου (T-SOILWOUND-01)' + N
   + '          // η κάρτα λέει γιατί δεν υπολογίζεται και τι να κάνει ο παραγωγός· τα παλιά εδαφογενή μένουν σιωπηλά όπως πριν.' + N
   + '          const _nfT = _SAG_NONFOLIAR_TEXT[pathogenKey];' + N
   + "          if (_nfT) indicators = [...indicators, { variable: `fir_message_${pathogenKey}`, value: 'Μη διαθέσιμο'," + N
   + "            metadata: { color: 'grey', text: 'Ασθένεια ' + _nfT[0] + ': χωρίς αισθητήρα εδάφους (θερμοκρασία και υγρασία ριζοστρώματος) ο κίνδυνος δεν υπολογίζεται. ' + _nfT[1] } }];" + N
   + '          continue;' + N
   + '        }' + N, "κλάδος εδαφογενούς"),
  ('      } else if (erCalculationType === "Bacterial_Disease_Model") {' + N,
   '      } else if (erCalculationType === "Wound_Canker_Model") {' + N
   + '        // T-SOILWOUND-01: έλκος καστανιάς — πληγές ή βροχή σε ήπιο καιρό, μόνο στην περίοδο μόλυνσης.' + N
   + '        er = _computeWoundCankerER(pathogen, measurements, parameters);' + N
   + '        if (er === null) continue; // χωρίς θερμοκρασία αέρα: καμία εκτίμηση' + N
   + '      } else if (erCalculationType === "Bacterial_Disease_Model") {' + N, "κλάδος πληγών"),
]
for a, b, n in SUBS:
    c = s.count(a); assert c == 1, (n, c); s = s.replace(a, b); print("OK", n)
assert s.count("\n") == s.count("\r\n")
fd, tmp = tempfile.mkstemp(suffix=".js"); os.close(fd)
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, encoding="utf-8"); os.unlink(tmp)
assert r.returncode == 0, r.stderr[:400]
out = s.encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out))
