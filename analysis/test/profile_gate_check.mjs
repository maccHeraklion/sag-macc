/* T-PROFILE-01 (3/3) — ΕΛΕΓΧΟΣ: διαβάζει ο πυρήνας τον σκοπό, ΧΩΡΙΣ να αλλάξει
 * τίποτα για όποιον δεν τον δήλωσε;
 *
 * ΦΙΛΟΣΟΦΙΑ: δεν διαβάζω τον κώδικα για να κρίνω αν «μοιάζει σωστός». Βγάζω το
 * ΠΡΑΓΜΑΤΙΚΟ μπλοκ κενών από το ΖΩΝΤΑΝΟ αρχείο, το τρέχω σε node:vm με ψεύτικες
 * ρυθμίσεις, και μετράω ΤΙ ΚΕΝΑ ΒΓΗΚΑΝ.
 *
 * Η ΠΙΟ ΣΗΜΑΝΤΙΚΗ ΔΟΚΙΜΗ ΕΙΝΑΙ Η ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗ: τρέχω ΚΑΙ τον παλιό κώδικα
 * (από το git HEAD~) ΚΑΙ τον νέο πάνω στις ΙΔΙΕΣ ρυθμίσεις, και απαιτώ
 * ΤΑΥΤΟΣΗΜΗ έξοδο για «agronomy». 65 ζωντανοί αγροί δεν έχουν ετικέτα — αν
 * αλλάξει έστω ένα κενό τους, η αλλαγή είναι ΛΑΘΟΣ, όσο καλή κι αν ακούγεται.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { OLD_GAP_BLOCK } from "./fixtures/gapblock_before_profile01.mjs";

const NEW = readFileSync(new URL("../runPerTich.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
/* Ο παλιός κώδικας έρχεται από ΜΟΝΙΜΟ fixture, όχι από `git show`: το sandbox
   δεν ξεκινά υποδιεργασίες, και μια δοκιμή που εξαρτάται από εξωτερικό εργαλείο
   παύει να τρέχει ακριβώς όταν τη χρειάζεσαι. */
const OLD = OLD_GAP_BLOCK;

/* Βγάζει το μπλοκ από `const _gapF = [];` ως το κλείσιμο του τελευταίου
   μπλοκ που το γεμίζει — ταίριασμα αγκυλών, όχι regex πάνω σε 20.000 γραμμές. */
function gapBlock(src) {
  /* Το fixture ΕΙΝΑΙ ήδη το μπλοκ· ο πυρήνας είναι 20.000 γραμμές γύρω του. */
  if (src.trimStart().startsWith("const _gapF = [];") && src.length < 20000) return src;
  const start = src.indexOf("const _gapF = [];");
  if (start < 0) throw new Error("δεν βρέθηκε το _gapF");
  const open = src.indexOf("{", src.indexOf("\n", start));
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("δεν έκλεισε το μπλοκ");
}

function purposeFn(src) {
  const i = src.indexOf("function _sagFieldPurpose(");
  if (i < 0) return null;                       // ο παλιός κώδικας δεν την έχει
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error("δεν έκλεισε η _sagFieldPurpose");
}

function severityFn(src) {
  const i = src.indexOf("function _sagFleetSeverity(");
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error("δεν έκλεισε η _sagFleetSeverity");
}

/* Τρέχει το μπλοκ κενών με δεδομένη ρύθμιση και σκοπό. Επιστρέφει τα κενά. */
function gaps(src, { purpose, cfg, crops }) {
  const tags = purpose === null ? [] : [{ key: "field_purpose", value: purpose }];
  const code = [
    "const SAG_FIELD_PURPOSES = ['agronomy','weather','automation'];",
    purposeFn(src) || "function _sagFieldPurpose(){ return 'agronomy'; }",
    gapBlock(src),
    ";globalThis.__out = _gapF;",
  ].join("\n");
  const sb = {
    fields: [{ id: "abc123", tags }], i: 0,
    fieldConfig: cfg, crops: crops || [],
    Number, Array, String, console,
  };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return sb.__out;
}

function severity(src, row) {
  /* ΠΡΟΣΟΧΗ: ΜΗΝ βάλεις πεδίο `globalThis` στο sandbox. Το vm.createContext
     κάνει το ΙΔΙΟ το αντικείμενο καθολικό· ένα δικό σου `globalThis` το σκιάζει
     και οι αναθέσεις πάνε σε κενό αντικείμενο. Έχασα έτσι δύο σενάρια. */
  const sb = { Number, Array, String };
  vm.createContext(sb);
  vm.runInContext(severityFn(src) + ";globalThis.__s = _sagFleetSeverity(" + JSON.stringify(row) + ");", sb);
  return sb.__s;
}

/* ── οι ρυθμίσεις που δοκιμάζω ───────────────────────────────────────────── */
const EMPTY = {};                                   // τίποτα δηλωμένο
const DRIP = { irrigation_system: "dripIrrigation" };   // στάγδην χωρίς γεωμετρία
const FULL = {
  area: 1000, total_plants: 40, irrigation_system: "sprinkler",
  soil_type: "loam",
};
const CASES = [
  ["τίποτα δηλωμένο", EMPTY, []],
  ["στάγδην χωρίς γεωμετρία", DRIP, []],
  ["πλήρης", FULL, [{ id: "c1", plants: 40 }]],
  ["πλήρης χωρίς καλλιέργεια", FULL, []],
  ["μικρή έκταση", { ...FULL, area: 5 }, [{ id: "c1", plants: 4 }]],
];

function scenarios(src) {
  const bad = [];
  const want = (l, got, exp) => {
    const a = JSON.stringify(got), b = JSON.stringify(exp);
    if (a !== b) bad.push(`${l}\n      πήρα   ${a}\n      ήθελα  ${b}`);
  };

  /* 1. ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗ — Η ΠΙΟ ΣΗΜΑΝΤΙΚΗ.
        Χωρίς ετικέτα, και με ρητό «agronomy», η έξοδος πρέπει να είναι
        ΤΑΥΤΟΣΗΜΗ με τον παλιό κώδικα. 65 ζωντανοί αγροί εξαρτώνται από αυτό. */
  for (const [label, cfg, crops] of CASES) {
    const old = gaps(OLD, { purpose: null, cfg, crops });
    want(`ΧΩΡΙΣ ΕΤΙΚΕΤΑ «${label}» → ίδιο με τον παλιό`,
      gaps(src, { purpose: null, cfg, crops }), old);
    want(`«agronomy» «${label}» → ίδιο με τον παλιό`,
      gaps(src, { purpose: "agronomy", cfg, crops }), old);
    /* Άγνωστη τιμή ΔΕΝ σιωπαίνει τίποτα — αλλιώς ένα τυπογραφικό στη φόρμα
       θα έκρυβε αθόρυβα πραγματικές ελλείψεις. */
    want(`ΑΓΝΩΣΤΗ ΤΙΜΗ «${label}» → ίδιο με τον παλιό`,
      gaps(src, { purpose: "ΟΤΙΔΗΠΟΤΕ", cfg, crops }), old);
  }

  /* 2. ΜΕΤΕΩΡΟΛΟΓΙΚΟΣ — κανένα αγρονομικό κενό, ποτέ. */
  for (const [label, cfg, crops] of CASES) {
    want(`ΚΑΙΡΟΣ «${label}» → κανένα κενό`, gaps(src, { purpose: "weather", cfg, crops }), []);
  }

  /* 3. ΑΥΤΟΜΑΤΙΣΜΟΣ — κρατά τα αρδευτικά, χάνει έδαφος/καλλιέργεια. */
  let g = gaps(src, { purpose: "automation", cfg: EMPTY, crops: [] });
  want("ΑΥΤΟΜΑΤΙΣΜΟΣ χωρίς τίποτα → κρατά έκταση", g.includes("έκταση"), true);
  want("ΑΥΤΟΜΑΤΙΣΜΟΣ χωρίς τίποτα → κρατά σύστημα άρδευσης", g.includes("σύστημα άρδευσης"), true);
  want("ΑΥΤΟΜΑΤΙΣΜΟΣ → ΔΕΝ ζητά τύπο εδάφους", g.includes("τύπος εδάφους"), false);
  want("ΑΥΤΟΜΑΤΙΣΜΟΣ → ΔΕΝ ζητά καλλιέργεια", g.includes("καμία καλλιέργεια"), false);
  g = gaps(src, { purpose: "automation", cfg: DRIP, crops: [] });
  want("ΑΥΤΟΜΑΤΙΣΜΟΣ στάγδην → κρατά τη γεωμετρία", g.includes("γεωμετρία στάγδην"), true);
  /* Και ο αγρονομικός ΕΞΑΚΟΛΟΥΘΕΙ να τα ζητά — αλλιώς θα είχα σβήσει κενά. */
  g = gaps(src, { purpose: "agronomy", cfg: EMPTY, crops: [] });
  want("ΑΓΡΟΣ → εξακολουθεί να ζητά τύπο εδάφους", g.includes("τύπος εδάφους"), true);
  want("ΑΓΡΟΣ → εξακολουθεί να ζητά καλλιέργεια", g.includes("καμία καλλιέργεια"), true);

  /* 4. Η ΣΟΒΑΡΟΤΗΤΑ: κενά → ΓΡΑΦΕΙΟ (1), χωρίς κενά → ΕΝΤΑΞΕΙ (0).
        Αυτό είναι που βλέπει ο χρήστης ως «ελλιπής». */
  want("κενά → ΓΡΑΦΕΙΟ", severity(src, { g: ["έκταση"], d: [], k: [], z: [] }), 1);
  want("χωρίς κενά → ΕΝΤΑΞΕΙ", severity(src, { g: [], d: [], k: [], z: [] }), 0);

  return bad;
}

console.log("=== T-PROFILE-01 (3/3) · Η ΠΥΛΗ ΤΟΥ ΣΚΟΠΟΥ ΣΤΟΝ ΠΥΡΗΝΑ ===\n");
const base = scenarios(NEW);
console.log(`ΠΡΑΓΜΑΤΙΚΟΣ ΚΩΔΙΚΑΣ: ${base.length === 0 ? "✓ ΠΕΡΝΑΕΙ" : "✗ " + base.length + " ΑΠΟΤΥΧΙΕΣ"}`);
for (const b of base) console.log("   ✗ " + b);

/* ── ΜΕΤΑΛΛΑΞΕΙΣ · κάθε μία ΠΡΕΠΕΙ να σκοτωθεί ───────────────────────────
   ΠΡΟΣΟΧΗ (μάθημα από το T-MAPDRAG-01): οι άγκυρες δείχνουν σε ΕΚΤΕΛΕΣΙΜΟ
   κώδικα, ΠΟΤΕ σε σχόλιο — τα σχόλια εδώ περιέχουν τις ίδιες λέξεις. */
const MUT = [
  ["η πύλη δεν κλείνει ποτέ (όλοι κρίνονται ως αγροί)",
    /if \(_purposeF !== 'weather'\) \{/, "if (true) {"],
  ["η πύλη κλείνει για όλους", /if \(_purposeF !== 'weather'\) \{/, "if (false) {"],
  ["η προεπιλογή γίνεται «weather»",
    /return SAG_FIELD_PURPOSES\.indexOf\(v\) >= 0 \? v : 'agronomy';/,
    "return SAG_FIELD_PURPOSES.indexOf(v) >= 0 ? v : 'weather';"],
  ["χάνεται ο έλεγχος έγκυρης τιμής",
    /return SAG_FIELD_PURPOSES\.indexOf\(v\) >= 0 \? v : 'agronomy';/, "return v || 'agronomy';"],
  ["το εσωτερικό μπλοκ ανοίγει για όλους",
    /if \(_purposeF === 'agronomy'\) \{/, "if (true) {"],
  ["το εσωτερικό μπλοκ κλείνει για όλους",
    /if \(_purposeF === 'agronomy'\) \{/, "if (false) {"],
  ["ο σκοπός διαβάζεται από λάθος ετικέτα",
    /t\.key === 'field_purpose'/, "t.key === 'field_type'"],
];

console.log("\n--- ΜΕΤΑΛΛΑΞΕΙΣ ---");
let killed = 0, notApplied = 0;
for (const [name, re, rep] of MUT) {
  const mut = NEW.replace(re, rep);
  if (mut === NEW) { console.log(`✗✗ «${name}» ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ`); notApplied++; continue; }
  let bad;
  try { bad = scenarios(mut); } catch (e) { bad = ["σκάει: " + e.message]; }
  if (bad.length) { console.log(`✓ «${name}» σκοτώθηκε (${bad.length})`); killed++; }
  else console.log(`✗✗ «${name}» ΕΠΙΒΙΩΣΕ — Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ ΤΥΦΛΟΣ ΕΔΩ`);
}

console.log("\n=== ΣΥΝΟΨΗ ===");
console.log(`σενάρια: ${base.length === 0 ? "ΟΛΑ ΠΕΡΝΑΝΕ" : base.length + " αποτυχίες"}`);
console.log(`μεταλλάξεις: ${killed}/${MUT.length} σκοτωμένες, ${notApplied} δεν εφαρμόστηκαν`);
const ok = base.length === 0 && killed === MUT.length;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
