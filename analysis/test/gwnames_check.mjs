/**
 * T-GWNAMES-01 — ελεγκτής των ονομάτων gateway.
 *
 * ΤΟ ΔΙΑΚΥΒΕΥΜΑ: τα ονόματα ΔΕΝ βρέθηκαν με ταυτότητα, βρέθηκαν με ΘΕΣΗ. Πέντε
 * είναι βέβαια (απόσταση < 25 m και δεύτερος υποψήφιος χιλιόμετρα μακριά), τα
 * υπόλοιπα ΟΧΙ. Αν ένα πιθανό όνομα γραφτεί σκέτο, διαβάζεται ως γεγονός και
 * κάποιος οδηγεί σε λάθος χωριό. Ο ελεγκτής φρουρεί ΑΚΡΙΒΩΣ αυτό.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "..", "custom_html_files", "gateway-board.html");
const RAW = readFileSync(PAGE, "utf8");
const OVERSEER = "6a98855ca06e41000bfae024";

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log("  ✔ " + name); }
  else { fail++; console.log("  ✘ " + name + (detail ? " — " + detail : "")); }
}

function makeDom() {
  const els = {};
  const mk = (id) => ({
    id, textContent: "", innerHTML: "", children: [],
    setAttribute() {}, addEventListener() {}, appendChild(c) { this.children.push(c); },
  });
  for (const id of ["cTotal", "lTotal", "cGreen", "cYellow", "cRed", "cGrey",
    "cNoLoc", "cUndec", "cNet", "gwlist", "empty", "foot", "map"]) els[id] = mk(id);
  return { els, document: { getElementById: (i) => els[i] || null, createElement: () => mk("li") } };
}

function boot(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  const dom = makeDom();
  const ctx = {
    document: dom.document, window: {}, console: { log() {} }, setTimeout() {},
    Date, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  new vm.Script(m[1]).runInContext(ctx);
  ctx.__els = dom.els;
  return ctx;
}

const T = "2026-09-19T18:00:00.000Z";
const row = (code) => ({
  variable: "gateway_row", value: code, time: T, origin: OVERSEER,
  metadata: {
    color: "green", state: "ΛΕΙΤΟΥΡΓΕΙ",
    sensors: 3, age_h: 0.1, rssi: -70, text: "x", location: { lat: 35.1, lng: 25.1 },
  },
});

/* Ο χάρτης ονομάτων όπως ΑΚΡΙΒΩΣ δένεται στο widget. */
const NAMES = {
  "1000C238": { n: "Πέραμα" },
  "10009A7F": { n: "Σπίτι Παρισάκη", q: 1 },
};

function render(ctx, names, codes) {
  ctx.GW_NAMES = names;
  ctx.ingest(codes.map(row));
  ctx.render();
  const out = {};
  for (const li of ctx.__els.gwlist.children) {
    const txt = li.innerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const code = (txt.match(/\b(1000[0-9A-F]{4}|1001[0-9A-F]{4})\b/) || [])[1];
    out[code || txt.slice(0, 12)] = txt;
  }
  return out;
}

console.log("\n══ T-GWNAMES-01 · ΣΕΝΑΡΙΑ ══");
{
  const c = boot(RAW);
  const r = render(c, NAMES, ["1000C238", "10009A7F", "1000AAAA"]);

  const sure = r["1000C238"] || "";
  ok(/Πέραμα/.test(sure) && !/πιθανόν/.test(sure),
    "Α·1 το ΒΕΒΑΙΟ όνομα γράφεται σκέτο", sure.slice(0, 80));
  ok(/κωδικός 1000C238/.test(sure),
    "Α·2 ο κωδικός φαίνεται και όταν υπάρχει όνομα", sure.slice(0, 80));

  const unsure = r["10009A7F"] || "";
  ok(/πιθανόν/.test(unsure) && /ανεπιβεβαίωτο/.test(unsure),
    "Β·1 το ΠΙΘΑΝΟ δηλώνεται ρητά ως πιθανό", unsure.slice(0, 100));
  ok(/^Gateway 10009A7F/.test(unsure),
    "Β·2 το πιθανό ΔΕΝ γίνεται τίτλος — τίτλος μένει ο κωδικός", unsure.slice(0, 60));

  const none = r["1000AAAA"] || "";
  ok(/^Gateway 1000AAAA/.test(none) && !/πιθανόν/.test(none),
    "Γ·1 άγνωστος κωδικός → σκέτος κωδικός, καμία επινόηση", none.slice(0, 60));
}
{
  /* Δ · Χωρίς καθόλου παράμετρο η σελίδα ΔΕΝ σπάει. */
  const c = boot(RAW);
  const r = render(c, {}, ["1000C238"]);
  ok(/^Gateway 1000C238/.test(r["1000C238"] || ""),
    "Δ·1 χωρίς χάρτη ονομάτων δείχνει κωδικό", (r["1000C238"] || "").slice(0, 60));
}

console.log("\n══ ΜΕΤΑΛΛΑΞΕΙΣ ══");
const MUT = [
  ["το πιθανό όνομα παρουσιάζεται ως ΒΕΒΑΙΟ",
    "  if (e.q) return { name: 'Gateway ' + code, sure: false, guess: e.n };",
    "  if (false) return { name: 'Gateway ' + code, sure: false, guess: e.n };"],
  ["η σήμανση «ανεπιβεβαίωτο» χάνεται",
    "' (\\u03b1\\u03bd\\u03b5\\u03c0\\u03b9\\u03b2\\u03b5\\u03b2\\u03b1\\u03af\\u03c9\\u03c4\\u03bf)</span>'", "''"],
  ["ο κωδικός κρύβεται όταν υπάρχει όνομα",
    "      + (g.code\n", "      + (false\n"],
  ["ο χάρτης ονομάτων αγνοείται",
    "  var e = GW_NAMES[code];", "  var e = null;"],
];

let killed = 0;
for (const [name, from, to] of MUT) {
  const fromRaw = from.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  const toRaw = to.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  if (!RAW.includes(fromRaw)) {
    fail++;
    console.log("  ✘ Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + name);
    continue;
  }
  let survived = true;
  try {
    const c = boot(RAW.replace(fromRaw, toRaw));
    const r = render(c, NAMES, ["1000C238", "10009A7F", "1000AAAA"]);
    const sure = r["1000C238"] || "", unsure = r["10009A7F"] || "", none = r["1000AAAA"] || "";
    survived =
      /Πέραμα/.test(sure) && !/πιθανόν/.test(sure) &&
      /κωδικός 1000C238/.test(sure) &&
      /πιθανόν/.test(unsure) && /ανεπιβεβαίωτο/.test(unsure) &&
      /^Gateway 10009A7F/.test(unsure) &&
      /^Gateway 1000AAAA/.test(none);
  } catch (_e) { survived = false; }
  if (survived) { fail++; console.log("  ✘ ΕΠΕΖΗΣΕ: " + name); }
  else { killed++; pass++; console.log("  ✔ σκοτώθηκε: " + name); }
}

console.log("\n══ ΣΥΝΟΨΗ ══");
console.log("  " + pass + " πέρασαν, " + fail + " απέτυχαν · μεταλλάξεις " + killed + "/" + MUT.length);
process.exit(fail === 0 && killed === MUT.length ? 0 : 1);
