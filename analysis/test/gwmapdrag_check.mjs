/* T-MAPDRAG-01 — ΕΛΕΓΧΟΣ: κουνιέται ο χάρτης εκεί που πρέπει;
 *
 * ΦΙΛΟΣΟΦΙΑ (μάθημα από την v50.144): ΔΕΝ διαβάζω τον κώδικα για να κρίνω αν
 * «μοιάζει σωστός». Βγάζω την ΠΡΑΓΜΑΤΙΚΗ initMap από το ΖΩΝΤΑΝΟ αρχείο, την
 * τρέχω σε ψεύτικο DOM με node:vm, και κρίνω ΤΙ ΕΚΑΝΕ. Κάθε μετάλλαξη που
 * ΕΠΙΒΙΩΝΕΙ σημαίνει ότι ο έλεγχος είναι τυφλός — και μετράει ως αποτυχία.
 *
 * ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΑΝΑΦΟΡΑΣ: laptop Windows με οθόνη αφής ΚΑΙ ποντίκι.
 * maxTouchPoints=10, υπάρχει ontouchstart, αλλά ο χρήστης σέρνει με ποντίκι.
 * Εκεί ο χάρτης ΠΡΕΠΕΙ να κουνιέται. Πριν το T-MAPDRAG-01 πάγωνε.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = new URL("../../custom_html_files/gateway-board.html", import.meta.url);
const src = readFileSync(HTML, "utf8");

/* Ταίριασμα αγκυλών, όχι regex πάνω σε όλο το σώμα. */
function extract(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("δεν βρέθηκε η " + name);
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("δεν έκλεισε η " + name);
}
const REAL = extract("initMap");

/* ── ένα στήσιμο περιβάλλοντος, ένα για όλους ───────────────────────────── */
function run(code, o) {
  const veil = {
    id: "mapveil", hidden: true, _click: null,
    addEventListener(ev, fn) { if (ev === "click") this._click = fn; },
  };
  const cap = { opts: null, enabled: false };
  const L = {
    map(_el, opts) {
      cap.opts = opts;
      const m = {
        dragging: { enable() { cap.enabled = true; } },
        setView() { return m; },
        invalidateSize() {},
      };
      return m;
    },
    tileLayer() { return { addTo() {} }; },
    layerGroup() { return { addTo() { return {}; } }; },
  };
  const win = { L };
  if (o.touch) win.ontouchstart = null;
  if (!o.noMatchMedia) {
    win.matchMedia = (q) => {
      if (o.mmThrows) throw new Error("boom");
      return { matches: q.indexOf("coarse") >= 0 ? o.pointer === "coarse" : o.pointer === "fine" };
    };
  }
  const sb = {
    window: win, L, console,
    navigator: { maxTouchPoints: o.maxTouchPoints ?? 0 },
    state: { map: null, layer: null },
    $: (id) => (id === "map" ? { id } : id === "mapveil" ? veil : null),
    setTimeout: (fn) => { try { fn(); } catch (_e) {} },
  };
  vm.createContext(sb);
  vm.runInContext(code + "\ninitMap();", sb);
  return { cap, veil };
}

/* ── τα σενάρια. Επιστρέφει λίστα αποτυχιών. ────────────────────────────── */
function scenarios(code) {
  const bad = [];
  const want = (label, got, exp) => { if (got !== exp) bad.push(`${label} (πήρα ${got}, ήθελα ${exp})`); };

  let r = run(code, { pointer: "fine" });
  want("desktop χωρίς αφή → σέρνεται", r.cap.opts.dragging, true);
  want("desktop → χωρίς πέπλο", r.veil.hidden, true);
  want("ο τροχός δεν ζουμάρει μόνος", r.cap.opts.scrollWheelZoom, false);

  /* ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΑΝΑΦΟΡΑΣ */
  r = run(code, { pointer: "fine", touch: true, maxTouchPoints: 10 });
  want("laptop ΑΦΗΣ+ΠΟΝΤΙΚΙ → σέρνεται", r.cap.opts.dragging, true);
  want("laptop ΑΦΗΣ+ΠΟΝΤΙΚΙ → χωρίς πέπλο", r.veil.hidden, true);

  r = run(code, { pointer: "coarse", touch: true, maxTouchPoints: 5 });
  want("κινητό → κλειδωμένος αρχικά", r.cap.opts.dragging, false);
  want("κινητό → πέπλο ορατό", r.veil.hidden, false);
  if (r.veil._click) r.veil._click();
  want("κινητό → το πάτημα ξεκλειδώνει", r.cap.enabled, true);
  want("κινητό → το πέπλο φεύγει", r.veil.hidden, true);

  r = run(code, { noMatchMedia: true, touch: true, maxTouchPoints: 5 });
  want("χωρίς matchMedia + ontouchstart → κλειδωμένος (εφεδρεία)", r.cap.opts.dragging, false);

  /* Χωρίς matchMedia ΚΑΙ χωρίς ontouchstart, αλλά με ψηφιοποιητή αφής: η μόνη
     ένδειξη που μένει είναι το maxTouchPoints. Αν η εφεδρεία το αγνοήσει,
     ο χρήστης κινητού χάνει το κύλισμα της σελίδας. */
  r = run(code, { noMatchMedia: true, maxTouchPoints: 5 });
  want("χωρίς matchMedia, ΜΟΝΟ maxTouchPoints → κλειδωμένος", r.cap.opts.dragging, false);

  r = run(code, { noMatchMedia: true, maxTouchPoints: 0 });
  want("χωρίς matchMedia + χωρίς αφή → σέρνεται", r.cap.opts.dragging, true);

  r = run(code, { pointer: "coarse", mmThrows: true });
  want("matchMedia σκάει → ο χάρτης μένει χρήσιμος", r.cap.opts.dragging, true);

  return bad;
}

console.log("=== T-MAPDRAG-01 ===\n");
const baseBad = scenarios(REAL);
console.log(`ΠΡΑΓΜΑΤΙΚΟΣ ΚΩΔΙΚΑΣ: ${baseBad.length === 0 ? "✓ ΠΕΡΝΑΕΙ" : "✗ " + baseBad.length + " ΑΠΟΤΥΧΙΕΣ"}`);
for (const b of baseBad) console.log("   ✗ " + b);

/* ── ΜΕΤΑΛΛΑΞΕΙΣ ────────────────────────────────────────────────────────── */
/* ΠΡΟΣΟΧΗ — ΠΑΓΙΔΑ ΠΟΥ ΕΠΕΣΑ ΜΕΣΑ: η πρώτη μου εκδοχή της μετάλλαξης
   «coarse → fine» έγραφε /\(pointer: coarse\)/. Αυτό χτυπούσε το ΣΧΟΛΙΟ από
   πάνω, που περιέχει το ίδιο κείμενο και έρχεται ΠΡΩΤΟ — άρα ο κώδικας έμενε
   ανέπαφος και η μετάλλαξη «επιβίωνε» ψευδώς. Οι άγκυρες πρέπει να δείχνουν
   σε ΕΚΤΕΛΕΣΙΜΟ κώδικα, όχι σε πρόζα.

   ΔΕΝ υπάρχει μετάλλαξη για το `=== true`: το `matches` είναι πάντα boolean,
   οπότε η αφαίρεσή του ΔΕΝ αλλάζει συμπεριφορά σε κανένα σενάριο. Είναι
   αμυντικό, όχι λειτουργικό. Θα ήταν θέατρο να ισχυριστώ ότι το ελέγχω. */
const MUTATIONS = [
  ["επιστροφή στην παλιά ένδειξη αφής",
    /if \(window\.matchMedia\) \{[\s\S]*?\n    \}\n/,
    "_isTouch = ('ontouchstart' in window) || (navigator && navigator.maxTouchPoints > 0);\n"],
  ["αντιστροφή coarse → fine",
    /matchMedia\('\(pointer: coarse\)'\)/, "matchMedia('(pointer: fine)')"],
  ["πάντα κλειδωμένος", /dragging: !_isTouch/, "dragging: false"],
  ["πάντα ξεκλείδωτος", /dragging: !_isTouch/, "dragging: true"],
  ["το πέπλο δεν ξεκλειδώνει", /state\.map\.dragging\.enable\(\);/, ""],
  ["το πέπλο δεν κρύβεται", /_veil\.hidden = true;/, ""],
  ["ο τροχός ζουμάρει μόνος", /scrollWheelZoom: false/, "scrollWheelZoom: true"],
  ["η εφεδρεία αγνοεί την αφή", /\|\| \(navigator && navigator\.maxTouchPoints > 0\)/, "|| false"],
];

console.log("\n--- ΜΕΤΑΛΛΑΞΕΙΣ (κάθε μία ΠΡΕΠΕΙ να σκοτωθεί) ---");
let killed = 0, notApplied = 0;
for (const [name, re, rep] of MUTATIONS) {
  const mut = REAL.replace(re, rep);
  if (mut === REAL) { console.log(`✗✗ «${name}» ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ — η άγκυρα δεν ταιριάζει`); notApplied++; continue; }
  let bad;
  try { bad = scenarios(mut); } catch (e) { bad = ["σκάει: " + e.message]; }
  if (bad.length) { console.log(`✓ «${name}» σκοτώθηκε (${bad.length})`); killed++; }
  else { console.log(`✗✗ «${name}» ΕΠΙΒΙΩΣΕ — Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ ΤΥΦΛΟΣ ΕΔΩ`); }
}

console.log("\n=== ΣΥΝΟΨΗ ===");
console.log(`σενάρια: ${baseBad.length === 0 ? "ΟΛΑ ΠΕΡΝΑΝΕ" : baseBad.length + " αποτυχίες"}`);
console.log(`μεταλλάξεις: ${killed}/${MUTATIONS.length} σκοτωμένες, ${notApplied} δεν εφαρμόστηκαν`);
const ok = baseBad.length === 0 && killed === MUTATIONS.length;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
