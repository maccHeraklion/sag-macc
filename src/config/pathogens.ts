// src/config/pathogens.ts

export type PathogenConfig = {
  key: string;
  name: string;
};

export const PATHOGENS: PathogenConfig[] = [
  { key: "plasmopara_viticola",    name: "Περονόσπορος (Plasmopara viticola)" },
  { key: "erysiphe_necator",       name: "Ωίδιο (Erysiphe necator, Podosphaera xanthii)" },
  { key: "phytophthora_infestans", name: "Περονόσπορος Πατάτας/Τομάτας (Phytophthora infestans)" },
  { key: "botrytis_cinerea",       name: "Τεφρά Σήψη (Botrytis cinerea)" },
  { key: "venturia_inaequalis",    name: "Φουζικλάδιο Μηλιάς (Venturia inaequalis)" },
  { key: "taphrina_deformans",     name: "Εξώασκος (Taphrina deformans)" },

  // New foliar pathogens (runPerTich PATCH_26/27/28). Greek labels match the
  // kernel's PATHOGEN_PROFILE names; they only render when fir_message_<key> arrives.
  { key: "leveillula_taurica",               name: "Ωίδιο πιπεριάς/τομάτας (Leveillula taurica)" },
  { key: "podosphaera_xanthii",              name: "Ωίδιο κολοκυνθοειδών (Podosphaera xanthii)" },
  { key: "zymoseptoria_tritici",             name: "Σεπτορίαση σιταριού (Zymoseptoria tritici)" },
  { key: "passalora_fulva",                  name: "Μούχλα φύλλων τομάτας (Passalora fulva / Cladosporium fulvum)" },
  { key: "pseudocercospora_cladosporioides", name: "Μολυβδώδης κηλίδωση ελιάς (Pseudocercospora cladosporioides)" },
  { key: "puccinia_striiformis",             name: "Σκωρίαση σιτηρών (Puccinia striiformis)" },
  { key: "podosphaera_pannosa",              name: "Ωίδιο ροδακινιάς (Podosphaera pannosa)" },
  { key: "podosphaera_aphanis",              name: "Ωίδιο φράουλας (Podosphaera aphanis)" },

  { key: "bactrocera_oleae",       name: "Δάκος (Bactrocera oleae)" },
  { key: "prays_oleae",            name: "Πυρηνοτρήτης (Prays oleae)" },
  { key: "palpita_unionalis",      name: "Μαργαρώνια (Palpita unionalis)" },
  { key: "tuta_absoluta",          name: "Tuta absoluta" },
  { key: "myzus_persicae",         name: "Αφίδες (Γενικό προφίλ π.χ. Myzus persicae)" },
  { key: "ceratitis_capitata",     name: "Μύγα της Μεσογείου (Ceratitis capitata)" },
  { key: "bemisia_tabaci",         name: "Αλευρώδεις (Bemisia tabaci)" },

  { key: "tetranychus_urticae",    name: "Τετράνυχος (Tetranychus urticae)" },

  // --- Remaining PATHOGEN_PROFILE coverage (kernel computes risk for these too;
  //     each only renders when its fir_message_*/pest_generation_* arrives) ---
  // Insects / mites
  { key: "lobesia_botrana",            name: "Ευδεμίδα Αμπέλου (Lobesia botrana)" },
  { key: "cydia_pomonella",            name: "Καρπόκαψα Μηλιάς (Cydia pomonella)" },
  { key: "cydia_molesta",              name: "Ανατολική Καρπόκαψα (Cydia molesta / Grapholita molesta)" },
  { key: "anarsia_lineatella",         name: "Ανάρσια (Anarsia lineatella)" },
  { key: "dialeurodes_citri",          name: "Αλευρώδης Εσπεριδοειδών (Dialeurodes citri)" },
  { key: "phyllocnistis_citrella",     name: "Φυλλομύκητας Εσπεριδοειδών (Phyllocnistis citrella)" },
  { key: "saissetia_oleae",            name: "Λεκάνιο Ελιάς (Saissetia oleae)" },
  { key: "planococcus_ficus",          name: "Ψευδόκοκκος Αμπέλου (Planococcus ficus)" },
  { key: "panonychus_ulmi",            name: "Κόκκινο Ακάρι (Panonychus ulmi)" },
  { key: "eotetranychus_carpini",      name: "Κίτρινο Ακάρι Αμπέλου (Eotetranychus carpini)" },
  // Fungi
  { key: "colletotrichum_oleae",       name: "Ανθράκωση Ελιάς (Colletotrichum acutatum)" },
  { key: "spilocaea_oleagina",         name: "Κυκλοκόνιο Ελιάς (Spilocaea oleagina)" },
  { key: "alternaria_solani",          name: "Εναλτερνάρια (Alternaria alternata / A. solani)" },
  { key: "monilinia_laxa",             name: "Μονίλια ανθέων (Monilinia laxa)" },
  { key: "monilinia_fructicola",       name: "Μονίλια καρπών (Monilinia fructicola)" },
  { key: "wilsonomyces_carpophilus",   name: "Κορυνέτης (Wilsonomyces carpophilus / Stigmina carpophila)" },
  { key: "podosphaera_leucotricha",    name: "Ωίδιο μηλιάς (Podosphaera leucotricha)" },
  { key: "mycosphaerella_citri",       name: "Λιπαρή κηλίδωση εσπεριδοειδών (Mycosphaerella citri)" },
  { key: "phytophthora_capsici",       name: "Φυτόφθορα Πιπεριάς/Σολανωδών (Phytophthora capsici)" },
  { key: "pseudoperonospora_cubensis", name: "Περονόσπορος Κολοκυνθοειδών (Pseudoperonospora cubensis)" },
  { key: "peronospora_destructor",     name: "Περονόσπορος Κρεμμυδιού (Peronospora destructor)" },
  { key: "bremia_lactucae",            name: "Περονόσπορος Μαρουλιού (Bremia lactucae)" },
  { key: "cercospora_beticola",        name: "Κερκόσπορα Τεύτλου (Cercospora beticola)" },
  { key: "phomopsis_viticola",         name: "Φομόψη Αμπέλου (Phomopsis viticola)" },
  { key: "eutypa_lata",                name: "Ευτυπίαση Αμπέλου (Eutypa lata)" },
  { key: "verticillium_dahliae",       name: "Βερτιτσιλίωση (Verticillium dahliae)" },
  { key: "alternaria_alternata",       name: "Αλτερνάρια (Alternaria alternata)" },
  { key: "gymnosporangium_juniperinum", name: "Σκωρίαση Μηλιάς (Gymnosporangium juniperinum)" },
];

export const PATHO_VAR_PREFIX = "fir_message_";

export const VARS_PATHO: string[] = PATHOGENS.map(
  (p) => `${PATHO_VAR_PREFIX}${p.key}`,
);
