/* T-PROFILE-01 (1/3) — ΕΛΕΓΧΟΣ: φτάνει ο ΣΚΟΠΟΣ από τη φόρμα στο tag,
 * και —πιο σημαντικό— ΔΕΝ αλλάζει τίποτα όταν η φόρμα δεν τον στέλνει.
 *
 * ΦΙΛΟΣΟΦΙΑ: βγάζω τον ΠΡΑΓΜΑΤΙΚΟ κώδικα από το createField.js και τον τρέχω
 * σε node:vm με ψεύτικο `account`. Κρίνω ΤΙ ΕΓΡΑΨΕ, όχι πώς διαβάζεται.
 *
 * ΤΟ ΚΡΙΣΙΜΟ ΣΕΝΑΡΙΟ: παλιά φόρμα, χωρίς πεδίο. Ο αγρός ΠΡΕΠΕΙ να βγει
 * ακριβώς όπως σήμερα — κανένα νέο tag, `field_type` άθικτο. Αν αυτό σπάσει,
 * κάθε νέος αγρός αλλάζει σιωπηλά.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC_PATH = new URL("../createField.js", import.meta.url);
const src = readFileSync(SRC_PATH, "utf8").replace(/\r\n/g, "\n");

function extract(name) {
  const start = src.indexOf("async function " + name + "(");
  if (start < 0) throw new Error("δεν βρέθηκε η " + name);
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("δεν έκλεισε η " + name);
}

/* Το μπλοκ ανάγνωσης της φόρμας: από τη δήλωση των FIELD_PURPOSES ως το τέλος
   του ελέγχου άγνωστης τιμής. Άγκυρα σε ΕΚΤΕΛΕΣΙΜΟ κώδικα, όχι σε σχόλιο —
   μάθημα από το T-MAPDRAG-01. */
function extractPurposeBlock(code) {
  const a = code.indexOf('const FIELD_PURPOSES = [');
  if (a < 0) throw new Error("δεν βρέθηκε το FIELD_PURPOSES");
  const marker = "\n  }\n";
  const b = code.indexOf(marker, code.indexOf("if (_purposeRaw && !field_purpose)", a));
  if (b < 0) throw new Error("δεν έκλεισε το μπλοκ");
  return code.slice(a, b + marker.length);
}

const CREATE_FN = extract("createFieldDevice");
const PURPOSE_BLOCK = extractPurposeBlock(src);

/* ── τρέχει το ΜΠΛΟΚ ΦΟΡΜΑΣ και επιστρέφει τι προέκυψε ──────────────────── */
function readPurpose(code, scope) {
  const logs = [];
  const sb = { scope, console: { log: (m) => logs.push(String(m)) } };
  vm.createContext(sb);
  vm.runInContext(code + "\n;globalThis.__out = field_purpose;", sb);
  return { purpose: sb.__out, logs };
}

/* ── τρέχει τη ΔΗΜΙΟΥΡΓΙΑ και επιστρέφει τα tags που γράφτηκαν ──────────── */
async function createTags(code, field_purpose) {
  let written = null;
  const account = {
    devices: {
      create: async () => ({ device_id: "dev1" }),
      info: async () => ({ id: "dev1", tags: [] }),
      edit: async (_id, body) => { written = body.tags; },
    },
  };
  const sb = { account, console: { log() {} } };
  vm.createContext(sb);
  vm.runInContext(code + "\n;globalThis.__fn = createFieldDevice;", sb);
  await sb.__fn("Χ", [], "Πελάτης", "cid", "agnostic", field_purpose,
    {}, "0", "0", "2030-01-01", "35,25");
  return written || [];
}

const tagVals = (tags, k) => tags.filter((t) => t.key === k).map((t) => t.value);

async function scenarios(purposeCode, createCode) {
  const bad = [];
  const want = (l, got, exp) => { if (got !== exp) bad.push(`${l} (πήρα ${JSON.stringify(got)}, ήθελα ${JSON.stringify(exp)})`); };

  /* ΤΟ ΚΡΙΣΙΜΟ: παλιά φόρμα, δεν στέλνει τίποτα */
  let r = readPurpose(purposeCode, []);
  want("παλιά φόρμα → κενός σκοπός", r.purpose, "");
  want("παλιά φόρμα → κανένα προειδοποιητικό log", r.logs.length, 0);
  let tags = await createTags(createCode, r.purpose);
  want("παλιά φόρμα → ΚΑΝΕΝΑ tag field_purpose", tagVals(tags, "field_purpose").length, 0);
  want("παλιά φόρμα → field_type άθικτο", tagVals(tags, "field_type")[0], "agnostic");

  /* Κανονικές τιμές */
  for (const v of ["agronomy", "weather", "automation"]) {
    r = readPurpose(purposeCode, [{ variable: "field_purpose", value: v }]);
    want(`«${v}» → γίνεται δεκτό`, r.purpose, v);
    tags = await createTags(createCode, r.purpose);
    want(`«${v}» → γράφεται tag`, tagVals(tags, "field_purpose")[0], v);
    want(`«${v}» → field_type ΠΑΡΑΜΕΝΕΙ agnostic`, tagVals(tags, "field_type")[0], "agnostic");
  }

  /* Κανονικοποίηση */
  want("«AGRONOMY» → πεζά", readPurpose(purposeCode, [{ variable: "field_purpose", value: "AGRONOMY" }]).purpose, "agronomy");
  want("« Weather » → κόβονται κενά", readPurpose(purposeCode, [{ variable: "field_purpose", value: " Weather " }]).purpose, "weather");

  /* Άγνωστη τιμή: ΟΧΙ tag, ΝΑΙ log */
  r = readPurpose(purposeCode, [{ variable: "field_purpose", value: "ξενοδοχείο" }]);
  want("άγνωστη τιμή → δεν γίνεται δεκτή", r.purpose, "");
  want("άγνωστη τιμή → ΕΙΔΟΠΟΙΕΙ", r.logs.length > 0, true);
  tags = await createTags(createCode, r.purpose);
  want("άγνωστη τιμή → ΚΑΝΕΝΑ tag", tagVals(tags, "field_purpose").length, 0);

  /* Κενή τιμή δεν είναι σφάλμα, είναι σιωπή */
  r = readPurpose(purposeCode, [{ variable: "field_purpose", value: "" }]);
  want("κενή τιμή → σιωπή, χωρίς log", r.logs.length, 0);

  return bad;
}

console.log("=== T-PROFILE-01 (1/3) · createField ===\n");
const base = await scenarios(PURPOSE_BLOCK, CREATE_FN);
console.log(`ΠΡΑΓΜΑΤΙΚΟΣ ΚΩΔΙΚΑΣ: ${base.length === 0 ? "✓ ΠΕΡΝΑΕΙ" : "✗ " + base.length + " ΑΠΟΤΥΧΙΕΣ"}`);
for (const b of base) console.log("   ✗ " + b);

const MUT = [
  ["χάνεται ο φρουρός → tag πάντα", "create",
    /if \(field_purpose\) \{\n      info\.tags\.push\(\{ key: "field_purpose", value: String\(field_purpose\) \}\);\n    \}/,
    'info.tags.push({ key: "field_purpose", value: String(field_purpose) });'],
  ["γράφει στο field_type αντί για δικό του κλειδί", "create",
    /key: "field_purpose"/, 'key: "field_type"'],
  ["δέχεται οποιαδήποτε τιμή", "purpose",
    /FIELD_PURPOSES\.indexOf\(_purposeRaw\) >= 0 \? _purposeRaw : ""/, "_purposeRaw"],
  ["χάνεται το toLowerCase", "purpose", /\.trim\(\)\.toLowerCase\(\)/, ".trim()"],
  ["χάνεται το trim", "purpose", /\.trim\(\)\.toLowerCase\(\)/, ".toLowerCase()"],
  ["σιωπά στην άγνωστη τιμή", "purpose", /if \(_purposeRaw && !field_purpose\) \{/, "if (false) {"],
];

console.log("\n--- ΜΕΤΑΛΛΑΞΕΙΣ (κάθε μία ΠΡΕΠΕΙ να σκοτωθεί) ---");
let killed = 0, notApplied = 0;
for (const [name, which, re, rep] of MUT) {
  const p = which === "purpose" ? PURPOSE_BLOCK.replace(re, rep) : PURPOSE_BLOCK;
  const c = which === "create" ? CREATE_FN.replace(re, rep) : CREATE_FN;
  if ((which === "purpose" ? p : c) === (which === "purpose" ? PURPOSE_BLOCK : CREATE_FN)) {
    console.log(`✗✗ «${name}» ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ — η άγκυρα δεν ταιριάζει`);
    notApplied++; continue;
  }
  let bad;
  try { bad = await scenarios(p, c); } catch (e) { bad = ["σκάει: " + e.message]; }
  if (bad.length) { console.log(`✓ «${name}» σκοτώθηκε (${bad.length})`); killed++; }
  else console.log(`✗✗ «${name}» ΕΠΙΒΙΩΣΕ — Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ ΤΥΦΛΟΣ ΕΔΩ`);
}

console.log("\n=== ΣΥΝΟΨΗ ===");
console.log(`σενάρια: ${base.length === 0 ? "ΟΛΑ ΠΕΡΝΑΝΕ" : base.length + " αποτυχίες"}`);
console.log(`μεταλλάξεις: ${killed}/${MUT.length} σκοτωμένες, ${notApplied} δεν εφαρμόστηκαν`);
const ok = base.length === 0 && killed === MUT.length;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
