/*
 ** Analysis: Build configuration TAG from the form's configuration data
 **
 ** v6 · 2026-08-21 — ΠΡΟΒΟΛΗ ΑΝΤΙ ΕΝΩΣΗΣ (μετά από 5 γύρους εχθρικού ελέγχου)
 ** ────────────────────────────────────────────────────────────────────────
 ** ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ: η μεταβλητή δεδομένων «configuration» (που γράφει
 ** η φόρμα) είναι η ΠΛΗΡΗΣ πηγή αλήθειας — απεριόριστη σε μέγεθος. Το TAG
 ** είναι ΠΡΟΒΟΛΗ: κρατά ΜΟΝΟ ό,τι διαβάζει πραγματικά ο πυρήνας. Έτσι το
 ** μέγεθος του tag δεν συσσωρεύεται. Μετρημένο (πλήρη payload, χειρότερη
 ** οικογένεια — σιτηρά, 5 περίοδοι/καλλιέργεια):
 **   νέος αγρός:    1≈954 · 2≈1379 · 3≈1804 · 4≈2229 ✗
 **   παλαιός αγρός (root *_period strings): +401 σε όλα → 3 καλλιέργειες ✗,
 **   εκτός αν όλες οι καλλιέργειες έχουν δικές τους periods, οπότε τα root
 **   strings κλαδεύονται αυτόματα και ισχύει η στήλη «νέος αγρός».
 ** Η υπέρβαση αρνείται ΘΟΡΥΒΩΔΩΣ (κόκκινο μήνυμα με οδηγία, καμία εγγραφή).
 **
 ** Το σύνολο ανάγνωσης του πυρήνα επαληθεύτηκε με grep στον runPerTich_v47:
 **  · ρίζα: latitude, longitude, elevation, area, soil_type,
 **    irrigation_system, water_quality, irrig_fw_fraction/drip_fw_fraction,
 **    irrig_application_rate_mm_h, plantation_year, cultivation_type_general,
 **    cultivation_type, last_pesticide_key/date, παλαιά *_period strings.
 **  · ανά καλλιέργεια (cropParams, γρ. ~9771): ΜΟΝΟ cultivation_type_general,
 **    cultivation_type, periods, stage(υπολογίζεται), plantation_year, id.
 **    Τα area_m2/plants/cultivation_variety/last_pesticide_* ΔΕΝ σηκώνονται
 **    ποτέ από την καλλιέργεια — μένουν στη μεταβλητή δεδομένων.
 ** ⚠ Αν ΑΛΛΟ analysis (forecast, rainfall_sum, aggregates…) διαβάζει το tag
 **   «configuration», πρέπει να ελεγχθεί πριν την εφαρμογή — οι πηγές τους
 **   δεν ήταν διαθέσιμες σε αυτόν τον έλεγχο.
 **
 ** Διορθώσεις που κουβαλά από v2/v3 (κωδικοί στον κώδικα):
 **  T-CFGSYNC-01 πλήρη crops στη ΜΕΤΑΒΛΗΤΗ — το tag παίρνει την προβολή
 **  T-CFGSYNC-02/03/12 έλεγχοι ημερομηνιών: προειδοποίηση με συνέπεια, «<=»,
 **    όλες οι οικογένειες, και μισοσυμπληρωμένες περίοδοι
 **  T-CFGSYNC-04/08 prevTag βάση + προστατευμένα κλειδιά μόνο
 **  T-CFGSYNC-05/13 περίβλημα try/catch, ένα token, μηνύματα στο value
 **  T-CFGSYNC-06/07 πηγή το scope· καμία «επιτυχία» χωρίς πραγματική εγγραφή
 **  T-CFGSYNC-09 φράγμα μεγέθους (πλέον backstop — η προβολή δεν το αγγίζει)
 **  T-CFGSYNC-15 ανύψωση last_pesticide_* στη ρίζα — από την καλλιέργεια
 **    με την ΠΙΟ ΠΡΟΣΦΑΤΗ έγκυρη ημερομηνία: η φόρμα τα γράφει ανά
 **    καλλιέργεια, ο πυρήνας (FIR/PEI, γρ. 4635, 9729) τα διαβάζει ΜΟΝΟ
 **    από τη ρίζα. Μισές/μελλοντικές δηλώσεις αποκλείονται με προειδοποίηση.
 **
 ** v10 · 8/9/2026 — T-WHITELIST-19: προστέθηκαν στη ΡΙΖΑ της προβολής τα 19
 ** κλειδιά που η φόρμα έγραφε, ο πυρήνας διάβαζε και η λίστα έκοβε (μητρώο,
 ** παγίδα #1). Το TAG_SAFE_LIMIT ΔΕΝ άλλαξε — μετρήθηκε ότι δεν χρειάζεται
 ** (μέγιστο μετά 1.525 από 1.900, σε όλους τους 64 αγρούς).
 ** ΔΕΝ ΠΕΡΙΛΑΜΒΑΝΕΤΑΙ σκόπιμα: η ΑΝΑ ΚΑΛΛΙΕΡΓΕΙΑ προβολή (T-CROPKEYS-01).
 ** Μετρήθηκε ότι κοστίζει +235 χαρ. ΑΝΑ καλλιέργεια και θα έβγαζε ΤΡΕΙΣ
 ** αγρούς εκτός ορίου (ΚΕΚ 2.378 · Μιχάλης Χ 2.098 · Β5 Στριλιγκα 1.995).
 ** Είναι χωριστή απόφαση — απαιτεί πρώτα πραγματική δοκιμή του ορίου tag.
 **
 ** Env Vars:  ACCOUNT_TOKEN = <your-account-token>
 */

const { Analysis, Utils, Account, Device } = require("@tago-io/sdk");

/* v7 · 2026-08-27: T-SYNC-KEYS-01 (βάθη+κάλυμμα περνούν), T-SYNC-LEAN-01/02
   (κενά κλειδιά και κενές περίοδοι δεν τρώνε το όριο). */
/* Backstop μόνο — η προβολή κρατά το tag πολύ πιο κάτω. Το πραγματικό όριο
   της TagoIO για τιμές tag ΔΕΝ έχει επιβεβαιωθεί εμπειρικά· το 1900 είναι
   συντηρητικό. Η υπέρβαση αρνείται ΘΟΡΥΒΩΔΩΣ αντί να κόψει σιωπηλά. */
const TAG_SAFE_LIMIT = 1900;

/* Το λεξιλόγιο εδάφους του πυρήνα (SOIL_PROFILE). */
const KERNEL_SOIL_TYPES = ["sandy", "loamy", "clay_loamy", "calcareous_clay"];

/* Ρίζα της προβολής: ό,τι διαβάζει ο πυρήνας + soil_texture_class/elevation_m
   (αποθηκεύονται για μελλοντική χρήση — μικρό κόστος). */
const ROOT_KEYS = [
  "version", "latitude", "longitude", "elevation", "elevation_m",
  "area", "soil_type", "soil_texture_class",
  "irrigation_system", "water_quality",
  "irrig_fw_fraction", "drip_fw_fraction", "irrig_application_rate_mm_h",
  "plantation_year", "cultivation_type_general", "cultivation_type",
  "last_pesticide_key", "last_pesticide_date",
  /* alias που διαβάζει ο πυρήνας και μπορεί να γράψει μελλοντική φόρμα
     (γρ. 4119: stone_fraction* «Δεκτή τιμή στη φόρμα», 5686: soil_profile/
     soil, 4190: latitude_deg). Αντιγράφονται ΜΟΝΟ αν υπάρχουν — μηδενικό
     κόστος σήμερα, καμία σιωπηλή διαγραφή αύριο. */
  "stone_fraction_pct", "stone_fraction", "soil_profile", "soil", "latitude_deg",
  /* v7 · T-SYNC-KEYS-01: η φόρμα κατέγραφε τα βάθη αισθητήρων από την
     πρώτη μέρα, ο πυρήνας (v50.41 · T-DEPTHNAME-01) τα διαβάζει — αλλά η
     προβολή εδώ ΤΑ ΕΚΟΒΕ, γιατί δεν ήταν στη λίστα. Ίδια μοίρα είχαν τα
     δύο πεδία καλύμματος (v5). Χωρίς αυτή τη γραμμή, ό,τι διορθώθηκε
     εκατέρωθεν είναι νεκρό: το κανάλι πετά τα δεδομένα στη μέση. */
  "sensorShallow_depth_cm", "sensor_deep_depth_cm",
  "cover_transmissivity", "cover_light_sensor_inside",
  /* Γύρος 5 — ΔΙΟΡΘΩΣΗ δικής μας εσφαλμένης αφαίρεσης: ο γύρος 3 έβγαλε τα
     7 root *_period με το σκεπτικό «η παλαιά διαδρομή δεν ενεργοποιείται με
     πίνακα crops». ΛΑΘΟΣ: το pick() του resolveStageForCrop (γρ. 3129-3135)
     πέφτει στο legacyRoot[key] ΑΝΑ ΠΕΡΙΟΔΟ, για κάθε περίοδο που λείπει από
     την καλλιέργεια — δηλαδή τα root strings είναι ζωντανή εφεδρεία σε
     παλιούς αγρούς με άδεια periods στη σειρά. Επιστρέφουν: αντιγράφονται
     μόνο αν υπάρχουν ήδη (μηδενικό κόστος σε νέους αγρούς). Η ανησυχία του
     γύρου 3 για «μπαγιάτικες συμβουλές με crops:[]» καλύπτεται αλλού: με
     ρητά κενό πίνακα διαγράφεται το root cultivation_type_general, οπότε η
     παλαιά διαδρομή μένει ανενεργή ούτως ή άλλως. */
  "transplantation_period", "vegetative_growth_period", "flowering_period",
  "harvest_period", "dormant_period", "fruit_set_period", "ripening_period",

  /* ══ v10 · 8/9/2026 · T-WHITELIST-19 (μητρώο, παγίδα #1) ═════════════════
     ΜΕΤΡΗΘΗΚΕ με μηχανική σάρωση (audit_orphans.js, κατηγορία Γ): ΔΕΚΑΕΝΝΙΑ
     κλειδιά που η ΦΟΡΜΑ γράφει και ο ΠΥΡΗΝΑΣ διαβάζει — και που ΑΥΤΗ Η ΛΙΣΤΑ
     τα έκοβε. Ο παραγωγός τα συμπλήρωνε και δεν έφταναν ΠΟΤΕ σε κανένα μοντέλο.

     ΤΟ ΤΙΜΗΜΑ, ΜΕΤΡΗΜΕΝΟ: στην Κουκιά (πελάτης Βασσάλος) εμφανίστηκαν
     νηματώδεις ενώ η κάρτα έγραφε «Νηματώδεις: καμία ένδειξη». Αιτία: τα τρία
     κλειδιά ιστορικού νηματωδών κόβονταν ΕΔΩ, ο μετρητής πληρότητας έβγαινε
     μηδέν, η εμπιστοσύνη έμενε «χαμηλή» και η πύλη εκπομπής (πυρήνας γρ. 3618:
     low => ["informational"]) έπνιγε ΚΑΘΕ αποτέλεσμα — ακόμη και κόκκινο 100.

     ΜΕΓΕΘΟΣ — ΜΕΤΡΗΜΕΝΟ ΣΕ ΟΛΟΥΣ ΤΟΥΣ 64 ΑΓΡΟΥΣ (8/9/2026), ΟΧΙ ΕΚΤΙΜΗΜΕΝΟ:
       · μεγαλύτερο σημερινό tag ........ 963 χαρ. (Field_Β5 - Στριλιγκα)
       · κόστος αυτών των 19 στη ΧΕΙΡΟΤΕΡΗ περίπτωση (ΟΛΑ γεμάτα) .. +562
       · μέγιστο ΜΕΤΑ ................... 1.525 χαρ.
       · όριο ........................... 1.900 χαρ.
       · περιθώριο ...................... 375 χαρ. (20 %)
       · αγροί που θα ξεπερνούσαν ....... 0 από 42
     ΓΙ' ΑΥΤΟ ΤΟ TAG_SAFE_LIMIT ΔΕΝ ΑΛΛΑΖΕΙ. Ήταν υποψήφιο να ανέβει σε 2600·
     η μέτρηση έδειξε ότι δεν χρειάζεται. Και το πραγματικό όριο της TagoIO για
     ΜΗΚΟΣ τιμής tag ΔΕΝ είναι τεκμηριωμένο (η τεκμηρίωση ορίζει μόνο «30 tags
     ανά asset»). Δεν ανεβάζουμε όριο που δεν χρειάζεται και δεν το ξέρουμε.

     ΤΑ ΚΕΝΑ ΔΕΝ ΚΟΣΤΙΖΟΥΝ: το T-SYNC-LEAN-01 παρακάτω σβήνει κάθε κενό κλειδί
     πριν τη σειριοποίηση, οπότε ο αγρός που δεν απαντά πληρώνει ΜΗΔΕΝ. */

  /* Ιστορικό εδαφογενών παθογόνων → field_history (πυρήνας γρ. 6140-6158) */
  "hist_verticillium", "hist_phytophthora", "hist_sclerotinia", "hist_rhizoctonia",
  "susceptible_years_5yr",
  /* Νηματώδεις → nematode_field_history (πυρήνας γρ. 6171-6180). ΠΡΟΣΟΧΗ:
     ο πυρήνας σήμερα γράφει ΜΟΝΟ το «Ναι» αυτών των δύο boolean (παγίδα #22)
     — αυτή η γραμμή ανοίγει την πόρτα, δεν λύνει μόνη της το #6. */
  "nem_found_3yr", "nem_solarization_12mo", "nem_resistant_cultivar",
  /* Πληγές & καρκινώματα ελιάς → wound_history (πυρήνας γρ. 6160-6169) */
  "wound_pruning_date", "wound_hail_date", "wound_frost_date", "knot_observations",
  /* Γεωμετρία στάγδην σε επίπεδο αγρού (πυρήνας γρ. 7276, 7277, 7301) και
     μετρημένη απόδοση άρδευσης (γρ. 7942) — αγγίζουν ΑΠΕΥΘΕΙΑΣ τα λίτρα. */
  "irrig_emitter_spacing_m", "irrig_row_spacing_m", "irrig_emitter_lph",
  "irrig_efficiency_measured",
  /* Αγωγιμότητα νερού άρδευσης σε dS/m (πυρήνας γρ. 7909) — αλατότητα */
  "water_ecw_dsm",
  /* Σύνολο φυτών αγρού (γρ. 18358) · κάλυμμα (γρ. 6123 — εφεδρεία του tag) */
  "total_plants", "covered_cultivation",
];

/* T-CFGSYNC-08: μόνο εδώ ισχύει «κενό δεν σβήνει γνωστή τιμή» — ίδια λίστα
   και σκεπτικό με τη φόρμα (T-CFG-NODOWNGRADE-01). */
const PROTECTED_KEYS = [
  "latitude", "longitude", "elevation",
  "area", "soil_type", "irrigation_system", "water_quality",
  /* Γύρος 5: μετρημένες ιδιότητες της εγκατάστασης — μόλις μετρηθούν,
     υπάρχουν πάντα· ένα κενό δεν είναι ποτέ πρόθεση διαγραφής, και η
     απώλειά τους αλλάζει σιωπηλά τη δόση (η διαβροχή πέφτει στο προφίλ). */
  "irrig_fw_fraction", "drip_fw_fraction", "irrig_application_rate_mm_h",
];

/* ══════════════════ ΒΟΗΘΗΤΙΚΑ ══════════════════ */

function isBlank(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "null" || s === "undefined" || s === "nan";
}

function safeJsonParse(str) {
  try {
    if (!str || typeof str !== "string") return null;
    const o = JSON.parse(str);
    /* πίνακας ΔΕΝ είναι έγκυρη ρύθμιση — χωρίς αυτό, ένα [1,2,3] περνούσε
       ως packed και έσβηνε καλλιέργειες με πορτοκαλί «αποθηκεύτηκε». */
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : null;
  } catch {
    return null;
  }
}

function isVegFamily(gen) {
  return gen === "vegetableCrops" || gen === "vineCrops" || gen === "vegetable";
}

function parseDateISO(d) {
  if (!d || typeof d !== "string") return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function parseLegacyPeriod(periodStr) {
  if (!periodStr || typeof periodStr !== "string") return null;
  const s = periodStr.match(/Start:\s*([^\s,]+)/);
  const e = periodStr.match(/End:\s*([^\s,]+)/);
  if (!s || !e) return null;
  if (!parseDateISO(s[1]) || !parseDateISO(e[1])) return null;
  return { start: s[1], end: e[1] };
}

const STAGE_LABEL = {
  transplantation: "μεταφύτευση", vegetative_growth: "βλαστική ανάπτυξη",
  flowering: "άνθιση", harvest: "συγκομιδή", dormant: "λήθαργος",
  fruit_set: "καρπόδεση", ripening: "ωρίμανση",
  /* Γύρος 5: τα υπόλοιπα κλειδιά της φόρμας — χωρίς αυτά ο παραγωγός
     διάβαζε «germination» στα ελληνικά μηνύματα. Ίδιες ετικέτες με τη
     φόρμα (getPeriodSchema). */
  germination: "φύτρωμα", tillering: "αδέλφωμα", stem_elongation: "καλάμωμα",
  anthesis: "άνθηση", grain_filling: "γέμισμα κόκκου",
  dormancy: "λήθαργος", bloom: "άνθηση", fruit_dev: "ανάπτυξη καρπού",
};

/* Γύρος 5 (Γ.D2): η χρονολογική αλυσίδα ισχύει για ΟΛΕΣ τις οικογένειες —
   με τη σειρά που ορίζει η ίδια η φόρμα (getPeriodSchema), όχι μόνο για
   λαχανικά/αμπέλι. Χωρίς αυτήν, «άνθηση» μετά το «γέμισμα κόκκου» περνούσε
   αμίλητη και το στάδιο (άρα και ο συντελεστής Kc) έβγαινε λάθος. */
const FAMILY_CHAIN = {
  vegetableCrops: ["transplantation", "vegetative_growth", "flowering", "harvest"],
  vineCrops:      ["transplantation", "vegetative_growth", "flowering", "harvest"],
  vegetable:      ["transplantation", "vegetative_growth", "flowering", "harvest"],
  olive:          ["dormant", "flowering", "fruit_set", "ripening"],
  cerealCrops:    ["germination", "tillering", "stem_elongation", "anthesis", "grain_filling"],
  stoneFruits:    ["dormancy", "bloom", "fruit_dev", "harvest"],
  nutCrops:       ["dormancy", "bloom", "fruit_dev", "harvest"],
  citrusFruits:   ["flowering", "fruit_set", "fruit_dev"],
  ornamentalCrops:["flowering", "harvest"],
  pomeFruits:     ["flowering", "fruit_dev", "harvest"],
  subTropicalFruits: ["flowering", "fruit_dev", "harvest"],
  industrialCrops:   ["flowering", "fruit_dev", "harvest"],
  specialtyMediterranean: ["flowering", "fruit_dev", "harvest"],
};

/** T-CFGSYNC-12: όλα τα προβλήματα ημερομηνιών μιας καλλιέργειας. */
function validatePeriodsForCrop(crop) {
  const gen = crop?.cultivation_type_general;
  const periods = crop?.periods || {};
  const problems = [];

  const get = (key) => {
    const start = parseDateISO(periods?.[key]?.start);
    const end = parseDateISO(periods?.[key]?.end);
    if (!start || !end) return null;
    return { start, end };
  };

  for (const key of Object.keys(periods)) {
    const p = periods[key] || {};
    const hasStart = !!parseDateISO(p.start);
    const hasEnd = !!parseDateISO(p.end);
    const label = STAGE_LABEL[key] || key;
    /* Μισοσυμπληρωμένη περίοδος: το πιο συχνό λάθος πληκτρολόγησης. Ο πυρήνας
       την αγνοεί σιωπηλά (isNowInPeriod -> false) — ο παραγωγός πρέπει να
       το μάθει. */
    if (hasStart !== hasEnd) {
      problems.push(`η περίοδος «${label}» έχει μόνο ${hasStart ? "έναρξη" : "λήξη"} — συμπληρώστε και τις δύο ημερομηνίες`);
      continue;
    }
    const both = get(key);
    if (both && !(both.start <= both.end)) {
      problems.push(`στην περίοδο «${label}» η λήξη είναι πριν την έναρξη`);
    }
  }

  const chain = FAMILY_CHAIN[gen];
  if (chain) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = get(chain[i]);
      /* το επόμενο ΔΗΛΩΜΕΝΟ στάδιο της αλυσίδας — τα ενδιάμεσα κενά
         επιτρέπονται (ο παραγωγός δεν χρειάζεται να τα δηλώσει όλα) */
      let b = null, bKey = null;
      for (let j = i + 1; j < chain.length && !b; j++) { b = get(chain[j]); if (b) bKey = chain[j]; }
      if (a && b && !(a.end <= b.start)) {
        problems.push(`η περίοδος «${STAGE_LABEL[chain[i]] || chain[i]}» πρέπει να ολοκληρώνεται πριν αρχίσει η περίοδος «${STAGE_LABEL[bKey] || bKey}»`);
      }
    }
  }

  return problems;
}

/** Προβολή μίας καλλιέργειας: μόνο ό,τι σηκώνει το cropParams του πυρήνα. */
function projectCrop(c, idx) {
  /* Γύρος 5: μη-αντικείμενο periods (string/πίνακας από χαλασμένη πηγή)
     δεν περνά ποτέ στο tag. */
  const _perRaw = (c.periods && typeof c.periods === "object" && !Array.isArray(c.periods)) ? c.periods : {};
  /* v7 · T-SYNC-LEAN-02: περίοδος με κενά start ΚΑΙ end είναι θόρυβος της
     φόρμας (~38 bytes η καθεμία, επί 7 περιόδους επί Ν καλλιέργειες). Ο
     πυρήνας συμπεριφέρεται ΤΑΥΤΟΣΗΜΑ με απούσα περίοδο (pick() -> εφεδρεία
     root). Κρατιούνται ΜΟΝΟ οι περίοδοι με τουλάχιστον μία ημερομηνία. */
  const _per = {};
  for (const _pk of Object.keys(_perRaw)) {
    const _pv = _perRaw[_pk] || {};
    if (!isBlank(_pv.start) || !isBlank(_pv.end)) _per[_pk] = _pv;
  }
  const out = {
    id: c.id || `${c.cultivation_type_general || "crop"}:${c.cultivation_type || "type"}:${idx + 1}`,
    cultivation_type_general: c.cultivation_type_general,
    cultivation_type: c.cultivation_type,
  };
  if (Object.keys(_per).length) out.periods = _per;
  if (c.plantation_year !== undefined && c.plantation_year !== null && c.plantation_year !== "") {
    out.plantation_year = c.plantation_year;
  }
  return out;
}

/* ══════════════════ ΚΥΡΙΩΣ ΡΟΗ ══════════════════ */

async function runSync(context, scope, shared) {
  const tokenVar = context.environment.find((e) => e && e.key === "ACCOUNT_TOKEN")
    || context.environment.find((e) => e && String(e.key).trim().toUpperCase() === "ACCOUNT_TOKEN");
  if (!tokenVar) {
    return { fatal: "Λείπει το ACCOUNT_TOKEN από τις μεταβλητές περιβάλλοντος του analysis." };
  }
  const account = new Account({ token: tokenVar.value });

  /* T-CFGSYNC-06: το συμβάν είναι η πηγή. */
  const scopeRows = Array.isArray(scope) ? scope : (scope ? [scope] : []);
  const cfgRow = scopeRows.find((r) => r && r.variable === "configuration");
  /* Γύρος 5 (F4): πλήρης εφεδρεία — κάποιες μορφές scope δίνουν origin αντί
     για device, και η χειροκίνητη εκτέλεση μόνο context.device. Χωρίς αυτήν,
     η αποτυχία είναι της σιωπηλής κατηγορίας (πριν αποκτηθεί κανάλι
     μηνυμάτων). */
  const _did = (v) => (typeof v === "string" && v) ? v : null;
  const device_id = _did(cfgRow?.device) || _did(scopeRows[0]?.device)
    || _did(cfgRow?.origin) || _did(scopeRows[0]?.origin) || _did(context.device);
  if (!device_id) {
    return { fatal: "Δεν βρέθηκε συσκευή στο συμβάν — το analysis πρέπει να καλείται από το Action της φόρμας." };
  }

  const devToken = await Utils.getTokenByName(account, device_id);
  const device = new Device({ token: devToken });
  shared.device = device;   // T-CFGSYNC-13

  let cfgStr = (typeof cfgRow?.value === "string" && cfgRow.value) ? cfgRow.value : null;
  let cfgSource = "scope";
  if (!cfgStr) {
    cfgSource = "getData";
    try {
      const rows = await device.getData({ variables: ["configuration"], qty: 1 });
      cfgStr = (typeof rows?.[0]?.value === "string") ? rows[0].value : null;
    } catch (e) {
      return { fatal: "Δεν ήταν δυνατή η ανάγνωση της ρύθμισης από τη συσκευή (" + String(e?.message || e) + "). Καμία αλλαγή δεν έγινε." };
    }
  }

  let packed = null;
  if (cfgStr) {
    packed = safeJsonParse(cfgStr);
    if (!packed) {
      context.log("Άκυρο JSON configuration (πηγή: " + cfgSource + ")");
      return { fatal: "Η ρύθμιση που στάλθηκε δεν ήταν αναγνώσιμη. Καμία αλλαγή δεν έγινε — δοκιμάστε ξανά και, αν επαναληφθεί, ενημερώστε την τεχνική υποστήριξη." };
    }
  }

  /* Παλαιά διαδρομή (συσκευές που δεν πέρασαν ποτέ από τη φόρμα): οι
     μεμονωμένες μεταβλητές διαβάζονται ΜΟΝΟ όταν δεν υπάρχει packed. */
  let legacy = null;
  if (!packed) {
    const legacyVars = [
      "soil_type", "cultivation_type_general", "cultivation_type",
      "transplantation_period", "vegetative_growth_period", "flowering_period",
      "harvest_period", "dormant_period", "fruit_set_period", "ripening_period",
      "plantation_year", "irrigation_system", "water_quality", "area",
    ];
    legacy = {};
    let legacyErrors = 0;
    for (const v of legacyVars) {
      try {
        const rows = await device.getData({ variables: [v], qty: 1 });
        legacy[v] = rows?.[0]?.value;
      } catch (e) {
        legacyErrors++;
      }
    }
    if (legacyErrors === legacyVars.length) {
      return { fatal: "Δεν βρέθηκε ρύθμιση και η ανάγνωση των παλαιών μεταβλητών απέτυχε. Καμία αλλαγή δεν έγινε." };
    }
  }

  /* Το υπάρχον tag διαβάζεται ΟΣΟ ΠΙΟ ΑΡΓΑ γίνεται (μικρότερο παράθυρο για
     τον αγώνα read-modify-write με άλλες διεργασίες — δεν εξαλείφεται, η
     TagoIO δεν προσφέρει compare-and-swap σε tags). */
  const deviceInfo = await account.devices.info(device_id);
  /* Γύρος 5 (Δ1 — ΚΡΙΣΙΜΟ): αν το info γυρίσει απρόσμενη μορφή, το παλιό
     «tags: []» θα έγραφε πίνακα ΜΟΝΟ με το configuration — σβήνοντας
     name/isField/coordinates, βγάζοντας τον αγρό ΚΑΙ από τον πυρήνα ΚΑΙ
     από το ίδιο το Action, με πράσινο μήνυμα. Ο αγρός φτάνει εδώ ΜΟΝΟ μέσω
     του φίλτρου isField=yes — αν το isField «λείπει», φταίει η ανάγνωση,
     όχι η συσκευή. */
  const existingTags = Array.isArray(deviceInfo?.tags) ? deviceInfo.tags : null;
  if (!existingTags || !existingTags.some((t) => t && t.key === "isField")) {
    context.log("ΑΠΡΟΣΜΕΝΗ ΜΟΡΦΗ devices.info για " + device_id + ": " + JSON.stringify(deviceInfo)?.slice(0, 400));
    return { fatal: "Η ανάγνωση των στοιχείων της συσκευής επέστρεψε απρόσμενη μορφή. Καμία αλλαγή δεν έγινε — δοκιμάστε ξανά." };
  }
  const prevTagRaw = existingTags.find((t) => t && t.key === "configuration");
  const prevTag = safeJsonParse(prevTagRaw?.value) || {};

  const warnings = [];
  /* R3: ενημερωτικές σημειώσεις — ΔΕΝ είναι προβλήματα, δεν βάφουν
     πορτοκαλί. Χωρίς τον διαχωρισμό, κάθε φυσιολογική πολυκαλλιεργητική
     αποθήκευση με ψεκασμό έβγαινε «με προειδοποιήσεις» και η κόπωση θα
     υπονόμευε τις πραγματικές προειδοποιήσεις. */
  const notes = [];

  /* ── Γύρος 5 (F1 — ΚΡΙΣΙΜΟ): φρουρός ΠΑΛΙΑΣ (cached) φόρμας ──
     Η παλιά φόρμα προ-έσπερνε «ελιά/Κορωνέικη» πριν φορτώσουν τα δεδομένα·
     σε αργό δίκτυο το payload της είναι ΑΚΡΙΒΩΣ μία γυμνή προεπιλεγμένη
     σειρά, ενώ ο αγρός έχει άλλες καλλιέργειες. Η νέα φόρμα στέλνει
     version >= 4 και δεν παθαίνει το ίδιο (κλείδωμα φόρτωσης). Όταν
     έρθει η υπογραφή της γυμνής προεπιλογής από φόρμα version < 4 και το
     tag έχει ήδη ΑΛΛΕΣ καλλιέργειες, η αποθήκευση ΑΠΟΡΡΙΠΤΕΤΑΙ. */
  const _isBareDefault = (arr) => Array.isArray(arr) && arr.length === 1
    && arr[0] && typeof arr[0] === "object"
    && arr[0].cultivation_type_general === "olive"
    && arr[0].cultivation_type === "koroneiki"
    && (!arr[0].periods || Object.keys(arr[0].periods).length === 0)
    && isBlank(arr[0].plantation_year)
    && isBlank(arr[0].cultivation_variety);
  const _prevMeaningful = Array.isArray(prevTag.crops) && prevTag.crops.length > 0
    && !_isBareDefault(prevTag.crops);
  if (packed && Number(packed.version ?? 3) < 4
      && _isBareDefault(packed.crops) && _prevMeaningful) {
    context.log("F1 GUARD: γυμνή προεπιλογή από παλιά φόρμα απορρίφθηκε· prevTag.crops=" + JSON.stringify(prevTag.crops).slice(0, 300));
    return {
      fatal: "Η αποθήκευση ΔΕΝ έγινε: τα στοιχεία που έστειλε η φόρμα δείχνουν ότι η σελίδα δεν είχε προλάβει να φορτώσει τις καλλιέργειες του αγρού (παλιά έκδοση φόρμας). Οι υπάρχουσες ρυθμίσεις προστατεύτηκαν. Ανανεώστε τη σελίδα με Ctrl+Shift+R (πλήρης ανανέωση). ΠΡΟΣΟΧΗ: αν μετά την ανανέωση η λίστα δείχνει ΜΟΝΟ μία «ελιά Κορωνέικη» ενώ ο αγρός έχει άλλες καλλιέργειες, ΜΗΝ αποθηκεύσετε ξανά — επικοινωνήστε με την τεχνική υποστήριξη.",
    };
  }

  /* ── Καλλιέργειες ── */
  let cropsSrc;
  if (packed && Array.isArray(packed.crops)) {
    /* Ο πίνακας της φόρμας είναι ο νόμος — και κενός σημαίνει «αφαιρέθηκαν
       όλες», όχι «άγνωστο». (Η φόρμα πλέον κλειδώνει την αποθήκευση μέχρι να
       φορτώσουν τα δεδομένα, οπότε κενός πίνακας είναι πάντα πρόθεση.) */
    cropsSrc = packed.crops;
  } else if (packed) {
    cropsSrc = Array.isArray(prevTag.crops) ? prevTag.crops : [];
    warnings.push("η αποθηκευμένη ρύθμιση δεν περιέχει πίνακα καλλιεργειών — διατηρήθηκαν οι καταχωρισμένες καλλιέργειες της συσκευής");
  } else {
    /* Μονοκαλλιεργητική συμβατότητα. Αν οι παλαιές μεταβλητές δεν δίνουν
       τίποτα, ΔΕΝ σβήνουμε ό,τι έχει ήδη το tag (εύρημα γύρου 2). */
    const gen = legacy.cultivation_type_general;
    const type = legacy.cultivation_type;
    if (isBlank(gen) || isBlank(type)) {
      if (Array.isArray(prevTag.crops) && prevTag.crops.length) {
        cropsSrc = prevTag.crops;
        warnings.push("οι παλαιές μεταβλητές της συσκευής είναι κενές — διατηρήθηκαν οι καταχωρισμένες καλλιέργειες της συσκευής");
      } else {
        return { fatal: "Δεν βρέθηκε καμία ρύθμιση καλλιέργειας για τον αγρό. Καμία αλλαγή δεν έγινε — συμπληρώστε τη φόρμα και αποθηκεύστε ξανά." };
      }
    } else {
      const legacyPeriods = {};
      if (isVegFamily(gen)) {
        const t = parseLegacyPeriod(legacy.transplantation_period);
        const v = parseLegacyPeriod(legacy.vegetative_growth_period);
        const f = parseLegacyPeriod(legacy.flowering_period);
        const h = parseLegacyPeriod(legacy.harvest_period);
        if (t) legacyPeriods.transplantation = t;
        if (v) legacyPeriods.vegetative_growth = v;
        if (f) legacyPeriods.flowering = f;
        if (h) legacyPeriods.harvest = h;
      } else if (gen === "olive") {
        const d  = parseLegacyPeriod(legacy.dormant_period);
        const fl = parseLegacyPeriod(legacy.flowering_period);
        const fs = parseLegacyPeriod(legacy.fruit_set_period);
        const r  = parseLegacyPeriod(legacy.ripening_period);
        if (d)  legacyPeriods.dormant = d;
        if (fl) legacyPeriods.flowering = fl;
        if (fs) legacyPeriods.fruit_set = fs;
        if (r)  legacyPeriods.ripening = r;
      }
      cropsSrc = [{
        id: `${gen}:${type}:1`,
        cultivation_type_general: gen,
        cultivation_type: type,
        periods: legacyPeriods,
        plantation_year: legacy.plantation_year ?? null,
      }];
    }
  }

  /* Έλεγχοι ημερομηνιών — πάνω στα ΠΛΗΡΗ αντικείμενα (πριν την προβολή),
     ώστε το μήνυμα να λέει την ποικιλία που βλέπει ο παραγωγός. */
  /* Γύρος 5 (Δ6): ένα null/string μέσα στον πίνακα crops έριχνε ΟΛΗ την
     αποθήκευση με TypeError. Φιλτράρεται με προειδοποίηση — οι υπόλοιπες
     καλλιέργειες σώζονται. */
  const _rawCount = cropsSrc.length;
  cropsSrc = cropsSrc.filter((c) => c && typeof c === "object" && !Array.isArray(c));
  if (cropsSrc.length !== _rawCount) {
    warnings.push(`${_rawCount - cropsSrc.length} μη αναγνώσιμη(ες) καταχώριση(εις) καλλιέργειας παραλείφθηκε(αν)`);
  }

  const seenIds = new Map();
  for (const crop of cropsSrc) {
    const probs = validatePeriodsForCrop(crop);
    if (probs.length) {
      const label = crop.cultivation_variety || crop.cultivation_type || crop.id || "καλλιέργεια";
      warnings.push(`«${label}»: ` + probs.join("· "));
    }
  }
  const crops = cropsSrc.map((c, idx) => {
    const p = projectCrop(c, idx);
    /* Γύρος 5 (Δ7): η α' εκδοχή δεν κατέγραφε το ΝΕΟ όνομα — με ids
       [x, x, x:2] παρήγαγε [x, x:2, x:2]: νέα σύγκρουση, και δύο
       καλλιέργειες μοιράζονταν το ίδιο carry-forward state (GDD/FIR). */
    let cand = p.id;
    let n = 2;
    while (seenIds.has(cand)) { cand = p.id + ":" + n; n++; }
    seenIds.set(cand, true);
    p.id = cand;
    return p;
  });

  /* ── Χτίσιμο της ΠΡΟΒΟΛΗΣ ──
     Βάση: το υπάρχον tag ΦΙΛΤΡΑΡΙΣΜΕΝΟ στη ρίζα της προβολής — παλιά
     κλειδιά-συσσώρευση (v1 έγραφε ΟΛΟ το payload της φόρμας) φεύγουν εδώ
     μία και καλή. Πάνω του το packed, επίσης φιλτραρισμένο, με τον κανόνα
     T-CFGSYNC-08 για τα προστατευμένα. */
  const tag = {};
  for (const k of ROOT_KEYS) {
    if (prevTag[k] !== undefined) tag[k] = prevTag[k];
  }
  if (packed) {
    for (const k of ROOT_KEYS) {
      if (!(k in packed)) continue;
      if (PROTECTED_KEYS.indexOf(k) >= 0 && isBlank(packed[k]) && !isBlank(tag[k])) continue;
      /* v7 · T-SYNC-LEAN-01: το tag έχει σκληρό όριο 1900 χαρακτήρων και η
         αντιγραφή κενών τιμών ως null κόστιζε ~26 bytes ΤΟ ΚΛΕΙΔΙ, σε κάθε
         αγρό (η φόρμα στέλνει πάντα όλα τα κλειδιά, και κενά). Σε αγρό με
         πολλές καλλιέργειες αυτά τα null ήταν η διαφορά μεταξύ «αποθηκεύτηκε»
         και «ΥΠΕΡΒΑΣΗ ΜΕΓΕΘΟΥΣ TAG». Κενό σε μη προστατευμένο κλειδί
         σημαίνει ΔΙΑΓΡΑΦΗ — ίδια σημασιολογία (ο πυρήνας δεν ξεχωρίζει
         null από απόν πουθενά), μηδενικό κόστος. */
      if (isBlank(packed[k]) && packed[k] !== false) { delete tag[k]; continue; }
      tag[k] = packed[k];
    }
  }
  if (legacy) {
    const legacyShared = {
      soil_type: legacy.soil_type ?? null,
      irrigation_system: legacy.irrigation_system ?? null,
      water_quality: legacy.water_quality ?? null,
      area: toNumOrNull(legacy.area),
      plantation_year: toIntOrNull(legacy.plantation_year),
    };
    /* Γύρος 5 (Δ9): αντίθετα από το soil_type (που υποβαθμίζεται ήπια),
       ένα water_quality/irrigation_system εκτός λεξιλογίου ΣΤΑΜΑΤΑ τον
       υπολογισμό άρδευσης στον πυρήνα (irrigation_config_error). Παλιές
       μεταβλητές με άγνωστες τιμές δεν αντιγράφονται. */
    const _WATER_OK = ["excellent", "good", "marginal", "poor"];
    const _IRR_OK = ["dripIrrigation", "microSprayers", "stationarySprinklers", "floodIrrigation"];
    if (!isBlank(legacyShared.water_quality) && _WATER_OK.indexOf(String(legacyShared.water_quality)) < 0) {
      warnings.push(`η παλαιά ποιότητα νερού «${legacyShared.water_quality}» δεν αναγνωρίζεται — δεν μεταφέρθηκε`);
      legacyShared.water_quality = null;
    }
    if (!isBlank(legacyShared.irrigation_system) && _IRR_OK.indexOf(String(legacyShared.irrigation_system)) < 0) {
      warnings.push(`η παλαιά μέθοδος ποτίσματος «${legacyShared.irrigation_system}» δεν αναγνωρίζεται — δεν μεταφέρθηκε`);
      legacyShared.irrigation_system = null;
    }
    for (const k of Object.keys(legacyShared)) {
      if (isBlank(legacyShared[k])) continue;          // παλαιά διαδρομή: ποτέ καθάρισμα
      if (!isBlank(tag[k])) continue;                  // ό,τι υπάρχει, μένει
      tag[k] = legacyShared[k];
    }
  }

  tag.version = (packed?.version ?? prevTag.version ?? 3);
  tag.crops = crops;

  /* Λεξιλόγιο εδάφους (S11). */
  if (!isBlank(tag.soil_type) && KERNEL_SOIL_TYPES.indexOf(String(tag.soil_type)) < 0) {
    const prevOk = !isBlank(prevTag.soil_type) && KERNEL_SOIL_TYPES.indexOf(String(prevTag.soil_type)) >= 0;
    if (prevOk) {
      warnings.push(`ο τύπος εδάφους «${tag.soil_type}» δεν αναγνωρίζεται από το σύστημα — διατηρήθηκε ο προηγούμενος`);
      tag.soil_type = prevTag.soil_type;
    } else {
      warnings.push(`ο τύπος εδάφους «${tag.soil_type}» δεν αναγνωρίζεται από το σύστημα — τα όρια υγρασίας θα υπολογιστούν από το προφίλ της καλλιέργειας`);
    }
  }

  /* T-CFGSYNC-14: root πεδία ευκολίας — ποτέ "". */
  const primary = cropsSrc[0] || {};
  if (!isBlank(primary.cultivation_type_general)) tag.cultivation_type_general = primary.cultivation_type_general;
  if (!isBlank(primary.cultivation_type)) tag.cultivation_type = primary.cultivation_type;
  if (isBlank(tag.cultivation_type_general)) delete tag.cultivation_type_general;
  if (isBlank(tag.cultivation_type)) delete tag.cultivation_type;
  /* Γύρος 3, εύρημα 6: όταν η φόρμα δηλώνει ΡΗΤΑ «καμία καλλιέργεια»
     (crops: []), τα μπαγιάτικα root πεδία πρέπει επίσης να φύγουν — αλλιώς
     ο πυρήνας πέφτει στην παλαιά διαδρομή και συνεχίζει να συμβουλεύει για
     καλλιέργεια που ο παραγωγός αφαίρεσε. */
  if (packed && Array.isArray(packed.crops) && packed.crops.length === 0) {
    delete tag.cultivation_type_general;
    delete tag.cultivation_type;
  }

  /* T-CFGSYNC-15 (αναθ. β — γύρος 3, εύρημα 1): ανύψωση δήλωσης ψεκασμού
     από την 1η καλλιέργεια στη ρίζα — εκεί τη διαβάζει ο FIR/PEI (γρ. 4635,
     9729), ενώ η φόρμα τη γράφει ΜΟΝΟ μέσα στην καλλιέργεια.
     Η α' εκδοχή ανύψωνε «μόνο όταν η ρίζα είναι κενή» — δηλαδή ΜΙΑ ΦΟΡΑ
     για πάντα: ο δεύτερος ψεκασμός δεν έφτανε ποτέ στη ρίζα και η
     διαγραφή δεν καθάριζε. Όταν η φόρμα είναι η πηγή (packed.crops), η
     καλλιέργεια είναι πλέον Ο ΝΟΜΟΣ και για τη ρίζα — και στη διαγραφή. */
  /* Γύρος 4: ο πυρήνας βλέπει τον ψεκασμό ΣΕ ΕΠΙΠΕΔΟ ΑΓΡΟΥ (γρ. 9725) ενώ
     η φόρμα τον συλλέγει ανά καλλιέργεια. Ανυψώνεται η δήλωση με την ΠΙΟ
     ΠΡΟΣΦΑΤΗ έγκυρη ημερομηνία — όχι τυφλά της πρώτης σειράς — ώστε
     ψεκασμός δηλωμένος σε οποιαδήποτε καλλιέργεια να μοντελοποιείται. */
  if (packed && Array.isArray(packed.crops)) {
    const _cropLabel = (c) => c.cultivation_variety || c.cultivation_type || c.id || "καλλιέργεια";
    const _grDate = (iso) => {
      const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
    };
    let _spray = null;
    for (const c of cropsSrc) {
      const hasKey = !isBlank(c.last_pesticide_key);
      const d = parseDateISO(c.last_pesticide_date);
      /* Γύρος 5 (Δ4): οι δύο μισές δηλώσεις είναι τα συχνότερα λάθη —
         και οι δύο κατέληγαν σιωπηλές. R4: με απόδοση σε καλλιέργεια. */
      if (!hasKey && d) {
        warnings.push(`«${_cropLabel(c)}»: δηλώθηκε ημερομηνία ψεκασμού χωρίς σκεύασμα — η δήλωση δεν θα ληφθεί υπόψη· επιλέξτε και το σκεύασμα`);
        continue;
      }
      if (hasKey && !d) {
        warnings.push(`«${_cropLabel(c)}»: δηλώθηκε σκεύασμα ψεκασμού χωρίς έγκυρη ημερομηνία — η δήλωση δεν θα ληφθεί υπόψη· συμπληρώστε την ημερομηνία`);
        continue;
      }
      if (!hasKey) continue;
      /* Μελλοντική ημερομηνία: ο πυρήνας θα έδινε ΠΛΗΡΗ προστασία από
         ψεκασμό που δεν έχει γίνει, σιγώντας τις προειδοποιήσεις ασθενειών. */
      if (d.getTime() > Date.now() + 86400000) {
        warnings.push(`«${_cropLabel(c)}»: η ημερομηνία ψεκασμού ${_grDate(c.last_pesticide_date)} είναι μελλοντική — η δήλωση δεν θα ληφθεί υπόψη· διορθώστε την`);
        continue;
      }
      if (!_spray || d > _spray.d) {
        _spray = { key: c.last_pesticide_key, date: c.last_pesticide_date, d };
      }
    }
    if (_spray) {
      tag.last_pesticide_key = _spray.key;
      tag.last_pesticide_date = _spray.date;
      /* Ο ψεκασμός ισχύει σε επίπεδο ΑΓΡΟΥ στον πυρήνα — με πολλές
         καλλιέργειες ο παραγωγός πρέπει να το ξέρει. R3: ΣΗΜΕΙΩΣΗ, όχι
         προειδοποίηση — δεν υπάρχει τίποτα προς διόρθωση. */
      if (cropsSrc.length > 1) {
        notes.push("η δήλωση ψεκασμού εφαρμόζεται σε ΟΛΟ τον αγρό (όλες τις καλλιέργειες)");
      }
    } else {
      delete tag.last_pesticide_key;
      delete tag.last_pesticide_date;
    }
  }
  /* (Η παλαιά διαδρομή δεν έχει ψεκασμούς: οι μεμονωμένες μεταβλητές δεν
     τους περιλάμβαναν ποτέ — καμία ανύψωση εκεί.) */

  /* R2 (γύρος 5): τα root *_period strings είναι εφεδρεία ΜΟΝΟ για
     καλλιέργειες χωρίς δικές τους periods (pick() -> legacyRoot). Όταν ΟΛΕΣ
     οι προβεβλημένες καλλιέργειες έχουν μη κενές periods, η εφεδρεία είναι
     νεκρό βάρος 401 χαρακτήρων που δεν αφαιρούνταν ΠΟΤΕ — κλαδεύεται. */
  const _allHavePeriods = crops.length > 0
    && crops.every((c) => c.periods && Object.keys(c.periods).length > 0);
  if (_allHavePeriods) {
    for (const _pk of ["transplantation_period", "vegetative_growth_period",
      "flowering_period", "harvest_period", "dormant_period",
      "fruit_set_period", "ripening_period"]) delete tag[_pk];
  }

  /* ── T-CFGSYNC-09: backstop μεγέθους ── */
  const serialized = JSON.stringify(tag);
  if (serialized.length > TAG_SAFE_LIMIT) {
    context.log(`ΥΠΕΡΒΑΣΗ ΜΕΓΕΘΟΥΣ TAG: ${serialized.length} > ${TAG_SAFE_LIMIT}`
      + ` (πλεόνασμα ${serialized.length - TAG_SAFE_LIMIT} χαρακτήρες). Δεν γράφτηκε τίποτα.`);
    try {
      for (const c of crops) {
        context.log(`  · ${c.id}: ${JSON.stringify(c).length} χαρακτήρες`);
      }
    } catch (e) {}
    /* ── Δ1 (v8) · ΤΟ ΜΗΝΥΜΑ ΜΕΤΡΑΕΙ ΑΝΤΙ ΝΑ ΓΕΝΙΚΟΛΟΓΕΙ ──────────────────
       Ο παραγωγός του ΚΕΚ (3/9) συμπλήρωσε τα m² πέντε καλλιεργειών και πήρε
       «αφαιρέστε κάποια καλλιέργεια». Δεν ήξερε ΠΟΙΑ, ούτε ΠΟΣΟ λείπει, ούτε
       ότι το φθηνότερο πράγμα να κόψει είναι οι ΗΜΕΡΟΜΗΝΙΕΣ ΣΤΑΔΙΩΝ — που
       είναι προαιρετικές, γιατί ο πυρήνας βγάζει το στάδιο από GDD.
       Μετρημένο: 407 χαρακτήρες η καλλιέργεια ΜΕ στάδια, 139 ΧΩΡΙΣ. */
    const _over = serialized.length - TAG_SAFE_LIMIT;
    let _perGain = 0, _withPeriods = 0;
    for (const c of crops) {
      const _n = c && c.periods ? Object.keys(c.periods).length : 0;
      if (_n > 0) {
        _withPeriods++;
        try { _perGain += JSON.stringify(c.periods).length + 12; } catch (e) {}
      }
    }
    const _heaviest = crops
      .map((c) => { let n = 0; try { n = JSON.stringify(c).length; } catch (e) {} return { id: c && c.id, n }; })
      .sort((a, b) => b.n - a.n).slice(0, 3)
      .map((x) => x.id + " (" + x.n + " χαρ.)").join(" · ");

    let _how;
    if (_withPeriods > 0 && _perGain >= _over) {
      _how = "Η ΠΙΟ ΕΥΚΟΛΗ ΛΥΣΗ: σβήστε τις ημερομηνίες σταδίων (Μεταφύτευση / "
        + "Βλαστική Ανάπτυξη / Άνθιση / Συγκομιδή). Είναι ΠΡΟΑΙΡΕΤΙΚΕΣ — το σύστημα "
        + "υπολογίζει μόνο του το στάδιο από τη θερμοκρασία. Έχετε " + _withPeriods
        + (_withPeriods === 1 ? " καλλιέργεια" : " καλλιέργειες") + " με ημερομηνίες· "
        + "σβήνοντάς τες κερδίζετε περίπου " + _perGain + " χαρακτήρες, "
        + "δηλαδή ΠΑΝΩ από όσο χρειάζεται. Καμία άλλη αλλαγή δεν απαιτείται.";
    } else if (_withPeriods > 0) {
      _how = "Σβήστε τις ημερομηνίες σταδίων (κερδίζετε ~" + _perGain
        + " χαρακτήρες) ΚΑΙ αφαιρέστε όποια καλλιέργεια δεν υπάρχει πια στον αγρό.";
    } else {
      _how = "Αφαιρέστε όποια καλλιέργεια δεν υπάρχει πια στον αγρό. "
        + "Με το σημερινό όριο χωράνε περίπου 11 καλλιέργειες χωρίς ημερομηνίες σταδίων.";
    }

    return {
      fatal: "Ξεπερνάτε το όριο αποθήκευσης κατά " + _over + " χαρακτήρες.",
      fatalDetail: "Τα στοιχεία του αγρού πιάνουν " + serialized.length
        + " χαρακτήρες, ενώ το όριο είναι " + TAG_SAFE_LIMIT + " — υπέρβαση "
        + _over + ". ΤΙΠΟΤΑ ΔΕΝ ΧΑΘΗΚΕ: οι προηγούμενες ρυθμίσεις παραμένουν "
        + "ακριβώς όπως ήταν, αλλά ΚΑΙ οι αλλαγές που μόλις κάνατε ΔΕΝ έχουν "
        + "καταχωρηθεί. " + _how
        + " Οι βαρύτερες καλλιέργειες: " + _heaviest
        + ". Αν το πρόβλημα επιμείνει, ενημερώστε την τεχνική υποστήριξη.",
    };
  }

  /* ── Εγγραφή — τα υπόλοιπα tags περνούν ανέπαφα, οι κενές εγγραφές φεύγουν ──
     Το παλιό περιεχόμενο καταγράφεται στο console του analysis ΠΡΙΝ
     αντικατασταθεί: η προβολή αφαιρεί κλειδιά που έγραφε η v1, και αυτό το
     ίχνος είναι ο μόνος δρόμος επαναφοράς αν φανεί ότι κάτι άλλο τα διάβαζε. */
  context.log("ΠΡΟΗΓΟΥΜΕΝΟ tag configuration [" + device_id + "]: " + (prevTagRaw?.value || "—"));
  const newTags = existingTags.filter((item) => item && item.key && item.key !== "configuration");
  newTags.push({ key: "configuration", value: serialized });
  await account.devices.edit(device_id, { tags: newTags });

  return { warnings: [...new Set(warnings)], notes: [...new Set(notes)], tagLength: serialized.length };
}

/* ══════════════════ ΠΕΡΙΒΛΗΜΑ ΑΣΦΑΛΕΙΑΣ ══════════════════
   Γνωστό όριο (τεκμηριωμένο, αποδεκτό): αν αποτύχει κάτι ΠΡΙΝ αποκτηθεί το
   token της συσκευής (λείπει ACCOUNT_TOKEN, συσκευή χωρίς token, πτώση
   δικτύου στο πρώτο βήμα), το μήνυμα πάει μόνο στο console του analysis —
   δεν υπάρχει κανάλι προς τον παραγωγό χωρίς token. Η φόρμα δεν θα ανοίξει
   ποτέ το παράθυρο επιβεβαίωσης σε αυτή την περίπτωση, που είναι το σωστό
   σήμα ότι κάτι πήγε στραβά. */

async function startAnalysis(context, scope) {
  const shared = { device: null };

  /* NEW-2 (γύρος 2): η φόρμα δείχνει στο παράθυρο ΜΟΝΟ το value — το
     metadata.text εμφανίζεται μόνο στη μικρή γραμμή κάτω από την ένδειξη.
     Γι' αυτό ΟΛΟΚΛΗΡΗ η αιτία μπαίνει στο value. */
  const say = async (value, color, text) => {
    if (!shared.device) { context.log("[validation μη παραδοτέο] " + value); return; }
    try {
      await shared.device.sendData({
        variable: "validation",
        value,
        metadata: { color, text: text || "" },
      });
    } catch (e) {
      context.log("Αποτυχία εγγραφής validation: " + e);
    }
  };

  try {
    const res = await runSync(context, scope, shared);

    if (res && res.fatal) {
      await say("Η καταχώριση ΔΕΝ ολοκληρώθηκε. " + res.fatal, "red",
        res.fatalDetail || res.fatal);
      return;
    }

    const _notesTail = (res && res.notes && res.notes.length)
      ? " Σημείωση: " + res.notes.join(" · ") + "."
      : "";

    if (res && res.warnings && res.warnings.length) {
      const w = "Οι ρυθμίσεις αποθηκεύτηκαν, με προειδοποιήσεις: "
        + res.warnings.join(" · ")
        + " — μέχρι να διορθωθούν, το στάδιο της καλλιέργειας μπορεί να υπολογίζεται λάθος και οι συστάσεις άρδευσης να μην είναι σωστές."
        + _notesTail;
      await say(w, "orange", w);
      return;
    }

    await say("Επιτυχής καταχώριση δεδομένων εγκατάστασης." + _notesTail, "green",
      "Οι ρυθμίσεις του αγρού ενημερώθηκαν κανονικά." + _notesTail);
  } catch (e) {
    context.log("ΣΦΑΛΜΑ συγχρονισμού configuration: " + (e?.stack || e));
    const msg = "Η καταχώριση ΔΕΝ ολοκληρώθηκε λόγω τεχνικού σφάλματος. "
      + "Οι προηγούμενες ρυθμίσεις δεν άλλαξαν. Ξαναπατήστε «Καταχώριση» — αν το πρόβλημα "
      + "επιμείνει, ενημερώστε την τεχνική υποστήριξη. Λεπτομέρεια: " + String(e?.message || e);
    await say(msg, "red", msg);
  }
}

Analysis.use(startAnalysis);
