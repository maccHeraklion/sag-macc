# -*- coding: utf-8 -*-
# T-PHASE1-01 (7/11/2026, αποφάσεις «ως έμπειρος γεωπόνος Κρήτης» — ανάθεση Μιχάλη 6/11): πυρήνας v50.183 → v50.184.
#  1. Εποχικά παράθυρα εντόμων/ακάρεων + ασθενειών ελιάς (κάρτα «Εκτός περιόδου», όχι «Υψηλός» όλο τον χρόνο).
#  2. Θερινή παύση δάκου (μέγιστη ημέρας > 31 °C).
#  3. Ώρες διαβροχής ανά θερμοκρασία W(T) με κλάσεις σοβαρότητας (περονόσποροι, βοτρύτης, κυκλοκόνιο).
#  4. Ευπάθεια (HS) ουδέτερη για όλους τους μύκητες φύλλου.
#  5. Προστασία ψεκασμού: ποτέ «ψεκάστε ξανά» πριν το δηλωμένο μεσοδιάστημα, εκτός αν ξεπλύθηκε (≥25 mm).
#  6. Νέα: τζιτζικάκια (Asymmetrasca decedens, Empoasca decipiens), ανθράκνωση κολοκυνθοειδών (C. orbiculare), C. coccodes.
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
sub("const SAG_KERNEL_VERSION = 'v50.183 · 2026-11-07';   // T-PHASE0B-01",
    "const SAG_KERNEL_VERSION = 'v50.184 · 2026-11-07';   // T-PHASE1-01 (εποχικά παράθυρα εντόμων και ασθενειών ελιάς, θερινή παύση δάκου, ώρες διαβροχής ανά θερμοκρασία με κλάσεις, ευπάθεια ουδέτερη, προστασία ψεκασμού ως το μεσοδιάστημα, τζιτζικάκια + ανθράκνωση κολοκυνθοειδών + C. coccodes) · T-PHASE0B-01",
    'έκδοση')

# 2. Κλειδιά keymap (ΠΑΝΤΑ στο τέλος — η σειρά είναι παγωμένη· το widget παίρνει τα ίδια 4 με την ίδια σειρά).
sub("  'meloidogyne_incognita'," + N + "];",
    "  'meloidogyne_incognita'," + N +
    "  // T-PHASE1-01 (v50.184): νέα κλειδιά ΜΟΝΟ στο τέλος." + N +
    "  'asymmetrasca_decedens', 'empoasca_decipiens', 'colletotrichum_orbiculare', 'colletotrichum_coccodes'," + N + "];",
    'keymap')

# 3. Νέα προφίλ: τζιτζικάκια (έντομα) πριν την καρπόκαψα, ανθράκνωση κολοκυνθοειδών + C. coccodes (μύκητες) πριν τον ηλίανθο.
leafhoppers = J([
    "  // ── T-PHASE1-01 (v50.184) · ΤΖΙΤΖΙΚΑΚΙΑ (σχόλιο γεωπόνου 1, 6/11) ─────────────────────────────",
    "  // Asymmetrasca decedens: βάση 8,7 °C και ~195 βαθμοημέρες ανά γενιά (βιβλιογραφία Μεσογείου, βλ.",
    "  // βιβλιογραφία/lit_applied_2026-11-06.md). Empoasca decipiens: ΔΑΝΕΙΚΟ κατώφλι 10 °C / 200 βαθμοημέρες",
    "  // (δεν υπάρχει τοπική μελέτη — ΥΠΟ ΕΛΕΓΧΟ). Η απόφαση ψεκασμού ΔΕΝ βγαίνει από βαθμοημέρες: το δελτίο",
    "  // ΠΚΠΦΠ Ηρακλείου ορίζει όριο επέμβασης 50–100 νύμφες ανά 100 φύλλα με επιθεώρηση. Οι κάρτες λένε",
    "  // ΠΟΤΕ να επιθεωρήσετε (στάδιο γενιάς), όχι «ψεκάστε». Εποχικό παράθυρο Μάιος–Οκτώβριος (θερμοκήπιο: όλο τον χρόνο).",
    "  asymmetrasca_decedens: {",
    "    name: \"Τζιτζικάκι Αμπελιού (Asymmetrasca decedens)\",",
    "    crops: [",
    "      { cultivation_type_general: \"vineCrops\", cultivation_type: \"wine_grapes\" },",
    "      { cultivation_type_general: \"vineCrops\", cultivation_type: \"table_grapes\" },",
    "      { cultivation_type_general: \"vineCrops\", cultivation_type: \"raisin_grapes\" },",
    "      { cultivation_type_general: \"citrusFruits\", cultivation_type: \"orange\" },",
    "      { cultivation_type_general: \"citrusFruits\", cultivation_type: \"lemon\" },",
    "      { cultivation_type_general: \"citrusFruits\", cultivation_type: \"mandarin\" }",
    "    ],",
    "    type: \"GDD_Pest\",",
    "    pestBaseTemp: 8.7,",
    "    criticalGddValues: { firstGeneration: 195, secondGeneration: 390, thirdGeneration: 585 },",
    "    activityTempRange: { min: 15, max: 35 },",
    "    activityHumidityRange: { min: 30, max: 85 },",
    "    notes: \"T-PHASE1-01: επιθεώρηση 50–100 νύμφες/100 φύλλα (ΠΚΠΦΠ Ηρακλείου)· βαθμοημέρες μόνο για τον χρονισμό γενιών.\"",
    "  },",
    "  empoasca_decipiens: {",
    "    name: \"Τζιτζικάκι Λαχανικών (Empoasca decipiens)\",",
    "    crops: [",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"tomato\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"pepper\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"eggplant\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"potato\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"cucumber\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"zucchini\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"melon\" }",
    "    ],",
    "    type: \"GDD_Pest\",",
    "    pestBaseTemp: 10,",
    "    criticalGddValues: { firstGeneration: 200, secondGeneration: 400, thirdGeneration: 600 },",
    "    activityTempRange: { min: 15, max: 35 },",
    "    activityHumidityRange: { min: 30, max: 90 },",
    "    notes: \"T-PHASE1-01: δανεικό κατώφλι 10 °C/200 βαθμοημέρες (ΥΠΟ ΕΛΕΓΧΟ)· επιθεώρηση 50–100 νύμφες/100 φύλλα.\"",
    "  },",
    "  cydia_pomonella: {"])
sub("  cydia_pomonella: {", leafhoppers, 'προφίλ τζιτζικακιών')

colleto = J([
    "  // ── T-PHASE1-01 (v50.184) · ΑΝΘΡΑΚΝΩΣΕΙΣ (σχόλιο γεωπόνου 2, 6/11) ──────────────────────────────",
    "  // C. orbiculare (κολοκυνθοειδή): 10–30 °C, άριστο 24, Wmin 2 ώρες στο άριστο (Magarey 2005, D50 ομάδα) —",
    "  // εδώ συντηρητικά 8 ώρες σταθερές + βροχή/ράντισμα διασπείρει (δεν αναστέλλει). C. coccodes (σολανώδη,",
    "  // ανθράκνωση καρπών ντομάτας/μαύρη κηλίδωση πατάτας): 15–30 °C, άριστο 25, ≥12 ώρες διαβροχής.",
    "  colletotrichum_orbiculare: {",
    "    name: \"Ανθράκνωση Κολοκυνθοειδών (Colletotrichum orbiculare)\",",
    "    crops: [",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"cucumber\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"melon\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"watermelon\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"zucchini\" }",
    "    ],",
    "    type: \"Infection_Triangle\",",
    "    description: \"Ανθράκνωση κολοκυνθοειδών — κηλίδες φύλλων, βυθισμένα έλκη καρπών· διασπορά με σταγόνες.\",",
    "    optimalTempRange: { min: 10, opt: 24, max: 30 },",
    "    optimalHumidity: { min: 90, max: 100 },",
    "    requiredDurationHrs: 8,",
    "    requiresLeafWetness: true,",
    "    rainInhibitsInfection: false,",
    "    notes: \"T-PHASE1-01: Magarey 2005 Wmin 2 h στο άριστο· εδώ 8 h συντηρητικά (δικλίδα ψευδών ειδοποιήσεων).\"",
    "  },",
    "  colletotrichum_coccodes: {",
    "    name: \"Ανθράκνωση Σολανωδών (Colletotrichum coccodes)\",",
    "    crops: [",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"tomato\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"potato\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"pepper\" },",
    "      { cultivation_type_general: \"vegetableCrops\", cultivation_type: \"eggplant\" }",
    "    ],",
    "    type: \"Infection_Triangle\",",
    "    description: \"Ανθράκνωση καρπών ντομάτας / μαύρη κηλίδωση πατάτας — ώριμοι καρποί, ζεστό-υγρό.\",",
    "    optimalTempRange: { min: 15, opt: 25, max: 30 },",
    "    optimalHumidity: { min: 90, max: 100 },",
    "    requiredDurationHrs: 12,",
    "    requiresLeafWetness: true,",
    "    rainInhibitsInfection: false,",
    "    notes: \"T-PHASE1-01: ≥12 h διαβροχής στους 22–28 °C (βιβλιογραφία, βλ. lit_applied).\"",
    "  },",
    "  plasmopara_halstedii: {"])
sub("  plasmopara_halstedii: {", colleto, 'προφίλ ανθρακνώσεων')

# 4. Εποχικά παράθυρα: έντομα/ακάρεα, ασθένειες ελιάς, τζιτζικάκια· εξαίρεση θερμοκηπίου· θερινή παύση.
windows = J([
    "// ── T-PHASE1-01 (v50.184) · ΕΠΟΧΙΚΑ ΠΑΡΑΘΥΡΑ ΕΝΤΟΜΩΝ/ΑΚΑΡΕΩΝ + ΑΣΘΕΝΕΙΩΝ ΕΛΙΑΣ (απόφαση «ως γεωπόνος Κρήτης», 7/11) ──",
    "// ΤΟ ΕΥΡΗΜΑ (6/11): 93 από 110 κάρτες «Υψηλός» ήταν έντομα μετά το τελευταίο ορόσημο γενιάς, έως το τέλος του έτους.",
    "// Τα παράθυρα είναι ΣΥΝΤΗΡΗΤΙΚΑ (πλατιά) και ΑΠΟ ΒΙΒΛΙΟΓΡΑΦΙΑ/ΔΕΛΤΙΑ (lit_applied_2026-11-06): ευδεμίδα διάπαυση όταν η",
    "// μέρα πέφτει κάτω από 13 ώρες (Κρήτη ~25/8)· πυρηνοτρήτης ανθόβια→καρπόβια γενιά Μάρτιος–Οκτώβριος· δάκος από τη",
    "// σκλήρυνση πυρήνα ως τη συγκομιδή και θερινή παύση με μέγιστη >31 °C· ρυγχίτης ενήλικα Μάιος–Ιούλιος· λεκάνιο έρπουσες",
    "// Ιούλιος→συγκομιδή· κυκλοκόνιο μολύνσεις Οκτώβριος–Απρίλιος με 9–12 ώρες διαβροχής· ανθράκνωση ελιάς μόνο από το γυάλισμα",
    "// του καρπού ως τη συγκομιδή. Μέσα στο παράθυρο ΤΙΠΟΤΑ δεν αλλάζει. Θερμοκήπιο: τα είδη του θερμοκηπίου χωρίς παράθυρο.",
    "Object.assign(_SAG_SEASON_WINDOWS, {",
    "  lobesia_botrana:        { from: 401,  to: 825,  what: 'την ευδεμίδα',        why: 'οι γενιές της τελειώνουν με τη διάπαυση όταν η μέρα πέφτει κάτω από 13 ώρες (Κρήτη, τέλη Αυγούστου)' },",
    "  prays_oleae:            { from: 315,  to: 1031, what: 'τον πυρηνοτρήτη',     why: 'ανθόβια γενιά στην άνθηση και καρπόβια ως το φθινόπωρο· τον χειμώνα δεν δραστηριοποιείται' },",
    "  bactrocera_oleae:       { from: 615,  to: 1215, what: 'τον δάκο',            why: 'προσβάλλει από τη σκλήρυνση του πυρήνα ως τη συγκομιδή' },",
    "  rhynchites_cribripennis:{ from: 501,  to: 731,  what: 'τον ρυγχίτη',         why: 'τα ενήλικα τρέφονται στους νεαρούς καρπούς Μάιο–Ιούλιο' },",
    "  saissetia_oleae:        { from: 701,  to: 1130, what: 'το λεκάνιο',          why: 'οι έρπουσες προνύμφες βγαίνουν από τα μέσα Ιουλίου' },",
    "  parlatoria_oleae:       { from: 401,  to: 1031, what: 'την παρλατόρια',      why: 'οι γενιές της εξελίσσονται από την άνοιξη ως το φθινόπωρο' },",
    "  euphyllura_phillyreae:  { from: 301,  to: 630,  what: 'την ψύλλα της ελιάς', why: 'προσβάλλει τις ανθοταξίες την άνοιξη' },",
    "  palpita_unionalis:      { from: 501,  to: 1031, what: 'τη μαργαρόνια',       why: 'προσβάλλει τη νέα βλάστηση από τα τέλη άνοιξης' },",
    "  cydia_pomonella:        { from: 401,  to: 930,  what: 'την καρπόκαψα',       why: 'πτήσεις Απρίλιος–Σεπτέμβριος' },",
    "  phyllocnistis_citrella: { from: 501,  to: 1130, what: 'τον φυλλορύκτη',      why: 'προσβάλλει τη θερινή και φθινοπωρινή βλάστηση' },",
    "  leptinotarsa_decemlineata: { from: 401, to: 930, what: 'τον δορυφόρο',       why: 'ενήλικα και προνύμφες Απρίλιος–Σεπτέμβριος' },",
    "  phthorimaea_operculella:{ from: 501,  to: 1031, what: 'τη φθοριμαία',        why: 'προσβάλλει κονδύλους και φύλλωμα τους θερμούς μήνες' },",
    "  rhopalosiphum_padi:     { from: 201,  to: 531,  what: 'τις αφίδες σιτηρών',  why: 'αποικίες στα σιτηρά Φεβρουάριο–Μάιο' },",
    "  sitobion_avenae:        { from: 201,  to: 531,  what: 'τις αφίδες σιτηρών',  why: 'αποικίες στα σιτηρά Φεβρουάριο–Μάιο' },",
    "  myzus_persicae:         { ranges: [[201, 630], [901, 1130]], what: 'την αφίδα', why: 'αποικίες άνοιξη και φθινόπωρο· το καλοκαίρι σε θερινούς ξενιστές' },",
    "  thrips_tabaci:          { from: 301,  to: 1130, what: 'τον θρίπα',           why: 'δραστήριος από Μάρτιο ως Νοέμβριο' },",
    "  tuta_absoluta:          { from: 401,  to: 1130, what: 'την τούτα',           why: 'υπαίθρια δραστήρια Απρίλιο–Νοέμβριο· σε θερμοκήπιο όλο τον χρόνο' },",
    "  bemisia_tabaci:         { from: 501,  to: 1130, what: 'τον αλευρώδη',        why: 'υπαίθρια δραστήριος Μάιο–Νοέμβριο· σε θερμοκήπιο όλο τον χρόνο' },",
    "  tetranychus_urticae:    { from: 501,  to: 1031, what: 'τον τετράνυχο',       why: 'εξάρσεις στη ζέστη και ξηρασία Μάιο–Οκτώβριο· σε θερμοκήπιο όλο τον χρόνο' },",
    "  panonychus_ulmi:        { from: 401,  to: 1031, what: 'τον κόκκινο τετράνυχο', why: 'γενιές Απρίλιος–Οκτώβριος' },",
    "  panonychus_citri:       { from: 401,  to: 1130, what: 'τον τετράνυχο εσπεριδοειδών', why: 'γενιές Απρίλιος–Νοέμβριος' },",
    "  asymmetrasca_decedens:  { from: 501,  to: 1031, what: 'το τζιτζικάκι',       why: 'πληθυσμοί Μάιο–Οκτώβριο' },",
    "  empoasca_decipiens:     { from: 501,  to: 1031, what: 'το τζιτζικάκι',       why: 'υπαίθρια Μάιο–Οκτώβριο· σε θερμοκήπιο όλο τον χρόνο' },",
    "  spilocaea_oleagina:     { ranges: [[1001, 1231], [101, 430]], what: 'το κυκλοκόνιο', why: 'μολύνει με τις βροχές Οκτωβρίου–Απριλίου (9–12 ώρες διαβροχής στους 10–20 °C)' },",
    "  colletotrichum_oleae:   { ranges: [[1001, 1231], [101, 131]], what: 'την ανθράκνωση της ελιάς', why: 'προσβάλλει τον καρπό μόνο από το γυάλισμα ως τη συγκομιδή' },",
    "});",
    "// Σε θερμοκήπιο τα είδη του θερμοκηπίου δεν έχουν παράθυρο (όλο τον χρόνο).",
    "const _SAG_SEASON_COVERED_EXEMPT = ['tuta_absoluta', 'bemisia_tabaci', 'tetranychus_urticae', 'thrips_tabaci', 'myzus_persicae', 'empoasca_decipiens'];",
    "// Θερινή παύση: μέγιστη ημέρας πάνω από το όριο καταστέλλει τον πληθυσμό (δάκος: >31–32 °C, βιβλιογραφία).",
    "const _SAG_HEAT_ARREST_MAX_C = { bactrocera_oleae: 31 };",
    "function _sagInSeasonWindow(key, md) {",
    "  if (_SAG_COVERED_ACTIVE && _SAG_SEASON_COVERED_EXEMPT.indexOf(key) >= 0) return true;   // T-PHASE1-01",
    "  const w = _SAG_SEASON_WINDOWS[key];"])
sub("function _sagInSeasonWindow(key, md) {" + N + "  const w = _SAG_SEASON_WINDOWS[key];", windows, 'εποχικά παράθυρα')

# 5. Έντομα: παράθυρο + θερινή παύση ΠΡΙΝ τη φαινολογία.
pest = J([
    "        // T-PHASE1-01 (v50.184): εκτός εποχικού παραθύρου ή σε θερινή παύση → καμία φαινολογία, κάρτα «Εκτός περιόδου».",
    "        {",
    "          const _mdPest = _sagMonthDayNow(measurements);",
    "          const _heatMax = Number(_SAG_HEAT_ARREST_MAX_C[pathogenKey]);",
    "          const _tmaxDay = Number(getVal(measurements, 'air_temperature_max', NaN));",
    "          let _pestOff = null;",
    "          if (!_sagInSeasonWindow(pathogenKey, _mdPest)) _pestOff = _sagSilentText(pathogenKey);",
    "          else if (Number.isFinite(_heatMax) && Number.isFinite(_tmaxDay) && _tmaxDay > _heatMax)",
    "            _pestOff = 'Θερινή παύση: η μέγιστη της ημέρας (' + _tmaxDay.toFixed(0) + ' °C) ξεπερνά τους ' + _heatMax + ' °C — ο πληθυσμός καταστέλλεται από τη ζέστη. Επανέλεγχος μόλις δροσίσει.';",
    "          if (_pestOff) {",
    "            indicators = [...indicators, { variable: `fir_${pathogenKey}`, value: 0 },",
    "              { variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός κίνδυνος', metadata: { color: 'green', text: _pestOff } }];",
    "            continue;",
    "          }",
    "        }",
    "        const _ph = _pestPhenology(pathogen, accumulatedGDD, _rate, pathogen.name || pathogenKey, _phTemp, _phRh);"])
sub("        const _ph = _pestPhenology(pathogen, accumulatedGDD, _rate, pathogen.name || pathogenKey, _phTemp, _phRh);", pest, 'έντομα: παράθυρο + παύση')

# 6. Ώρες διαβροχής ανά θερμοκρασία με κλάσεις (Magarey 2005 W(T)=Wmin/f(T) · Metos για κυκλοκόνιο). Μόνο για τα 6 παθογόνα.
wt = J([
    "// ── T-PHASE1-01 (v50.184) · ΩΡΕΣ ΔΙΑΒΡΟΧΗΣ ΑΝΑ ΘΕΡΜΟΚΡΑΣΙΑ ΜΕ ΚΛΑΣΕΙΣ ──────────────────────────────",
    "// ΤΟ ΕΥΡΗΜΑ (σχόλιο γεωπόνου 3): ο περονόσπορος κολοκυνθοειδών ήθελε 6 σταθερές ώρες, ενώ στο άριστο (15–20 °C) αρκούν",
    "// 2–3. Ο αναδρομικός έλεγχος (6/11) έδειξε ότι το W(T) ΜΟΝΟ ΤΟΥ δίνει ειδοποίηση 8–14 νύχτες στις 15 — γι' αυτό μπαίνει",
    "// με ΚΛΑΣΕΙΣ αντί για ναι/όχι: ώρες ≥ W(T) → «Υψηλός — επιθεωρήστε» (ER 0,5), ώρες ≥ 1,5×W(T) → «Σοβαρός» (ER 0,75),",
    "// κάτω από W(T) αναλογικά (0,35×). Η θερμοκρασία αναφοράς είναι η ημερήσια μέση (air_temperature_avg), αλλιώς η τρέχουσα.",
    "// Πίνακες: Magarey 2005 (Table 2, W(T)=Wmin/f(T)), Metos για το κυκλοκόνιο (24/12/9/9/12 ώρες στους 5/10/15/20/25 °C).",
    "const _SAG_WET_HOURS_BY_T = {",
    "  pseudoperonospora_cubensis: [[8, 8], [12, 4], [15, 3], [20, 2], [25, 3], [30, 6]],",
    "  plasmopara_viticola:        [[10, 8], [13, 5], [16, 3], [20, 2], [25, 3], [28, 6]],",
    "  phytophthora_infestans:     [[8, 10], [12, 6], [15, 4], [20, 3], [24, 5], [27, 9]],",
    "  botrytis_cinerea:           [[5, 24], [10, 14], [15, 8], [20, 6], [25, 10], [30, 16]],",
    "  spilocaea_oleagina:         [[5, 24], [10, 12], [15, 9], [20, 9], [25, 12]],",
    "};",
    "function _sagWetHoursReq(key, T) {",
    "  const tab = _SAG_WET_HOURS_BY_T[key];",
    "  if (!tab || !Number.isFinite(Number(T))) return null;",
    "  const t = Number(T);",
    "  if (t <= tab[0][0]) return tab[0][1];",
    "  if (t >= tab[tab.length - 1][0]) return tab[tab.length - 1][1];",
    "  for (let i = 1; i < tab.length; i++) {",
    "    if (t <= tab[i][0]) { const [t0, h0] = tab[i - 1], [t1, h1] = tab[i]; return h0 + (h1 - h0) * (t - t0) / (t1 - t0); }",
    "  }",
    "  return tab[tab.length - 1][1];",
    "}",
    "",
    "function calculate_FIR(hourTich, dailyTich, measurements, ipsiLast, parameters) {"])
sub("function calculate_FIR(hourTich, dailyTich, measurements, ipsiLast, parameters) {", wt, 'πίνακες W(T)')

sub("        const _reqDur = Math.max(1, Number(pathogen.requiredDurationHrs) || 1);" + N +
    "        er = (infection_hours >= _reqDur) ? 1.0" + N +
    "          : (infection_hours > 0) ? (infection_hours / _reqDur) * 0.5" + N +
    "          : 0;",
    "        // T-PHASE1-01: W(T) με κλάσεις για τα παθογόνα του πίνακα· τα υπόλοιπα όπως πριν." + N +
    "        const _tRefWt = (() => { const a = Number(getVal(measurements, 'air_temperature_avg', NaN)); return Number.isFinite(a) ? a : Number(airTemp); })();" + N +
    "        const _wtReq = _sagWetHoursReq(pathogenKey, _tRefWt);" + N +
    "        const _reqDur = _wtReq !== null ? Math.max(1, _wtReq) : Math.max(1, Number(pathogen.requiredDurationHrs) || 1);" + N +
    "        if (_wtReq !== null) {" + N +
    "          const _ratio = infection_hours / _reqDur;" + N +
    "          er = _ratio >= 1.5 ? 0.75 : _ratio >= 1 ? 0.5 : 0.35 * _ratio;" + N +
    "        } else {" + N +
    "          er = (infection_hours >= _reqDur) ? 1.0" + N +
    "            : (infection_hours > 0) ? (infection_hours / _reqDur) * 0.5" + N +
    "            : 0;" + N +
    "        }",
    'ER με W(T)')

# 7. Ευπάθεια ουδέτερη για όλους (οι μύκητες φύλλου δεν «ενισχύονται» ×3,95 από την καταπόνηση — Desprez-Loustau είναι για δενδρώδη/ρίζες).
sub("      const _hsForModel = _SAG_MODEL_TEXTS[erCalculationType] ? 1 : hs;",
    "      // T-PHASE1-01 (v50.184): η ευπάθεια από καταπόνηση (HS 1,05–3,95) ΔΕΝ πολλαπλασιάζει πια τον κίνδυνο κανενός" + N +
    "      // μύκητα φύλλου — το ×3,95 έκανε «Σοβαρό» έναν περονόσπορο με λίγες ώρες σε αγρό με ξηρό έδαφος (Μπότζης, Μιχάλης Χ 6/11)." + N +
    "      // Η καταπόνηση μένει ΠΛΗΡΟΦΟΡΙΑ (κάρτα plant_stress), όχι πολλαπλασιαστής. FIR = ER × (1 − PEI)." + N +
    "      const _hsForModel = 1;   // ήταν: _SAG_MODEL_TEXTS[erCalculationType] ? 1 : hs",
    'HS ουδέτερο')

# 8. Προστασία ψεκασμού: ως το δηλωμένο μεσοδιάστημα, εκτός αν ξεπλύθηκε (≥ 25 mm σωρευτικής βροχής).
sub("      if (!pr || !pr.active || pr.daysLeft <= 0 || pr.pei < 0.3) return null;",
    "      if (!pr || !pr.active || pr.daysLeft <= 0) return null;" + N +
    "      // T-PHASE1-01 (v50.184, σχόλιο γεωπόνου 4): «ποτέ νέος ψεκασμός πριν το ελάχιστο μεσοδιάστημα της ετικέτας»." + N +
    "      // Πριν, στο 53 % της δηλωμένης προστασίας η κάρτα ζητούσε ψεκασμό (pei < 0,3) ενώ δίπλα έλεγε «μην ψεκάσετε ξανά»." + N +
    "      // Εξαίρεση ΜΟΝΟ το ξέπλυμα: ≥ 25 mm σωρευτικής βροχής μετά τον ψεκασμό (σκευάσματα επαφής, βιβλιογραφία)." + N +
    "      const _wash = Math.max(Number(pr.wash) || 0, Number(getVal(measurements, 'pesticide_washoff_mm', 0)) || 0);" + N +
    "      if (pr.pei < 0.3 && _wash >= 25) return null;",
    'προστασία ψεκασμού')

# 8β. Το ξέπλυμα ταξιδεύει μαζί με τη δήλωση ψεκασμού (rec.w) — όχι μόνο από την κατάσταση του αγρού.
sub("  return { pei: pei, active: true, daysLeft: daysLeft, endMs: endMs, residual: residual };",
    "  return { pei: pei, active: true, daysLeft: daysLeft, endMs: endMs, residual: residual, wash: Number.isFinite(washMm) ? washMm : 0 };   // T-PHASE1-01: και το ξέπλυμα",
    'ξέπλυμα στη δήλωση')

out = s.encode('utf-8')
assert out.count(b'\n') == out.count(b'\r\n'), 'γυμνά LF μετά το patch'
open(p, 'wb').write(out)
print('ΓΡΑΦΤΗΚΕ', len(out), 'bytes')
