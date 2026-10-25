// T-FCCOORD-01 — ΕΛΕΓΧΟΣ: η πρόγνωση (forecast v10) παίρνει θέση πρώτα από τη φόρμα (configuration), μετά από την
// ετικέτα coordinates, που δέχεται και μοίρες-λεπτά-δεύτερα. Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα με shim require. Μεταλλάξεις.
// Χρήση: node analysis/test/forecast_coords_check.mjs [αρχείο JSON με [{id,name,tags}] για σύγκριση στόλου, προαιρετικό]
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import vm from "node:vm";
const ROOT = new URL("../../", import.meta.url);
const P = "analysis/forecast.js";
const SRC = readFileSync(new URL(P, ROOT), "utf8");

function load(src) {
  const sdk = { Analysis: class { constructor() {} }, Resources: {}, Utils: {}, Account: class {}, Device: class {} };
  const ctx = { require: (m) => (m === "axios" ? {} : sdk), module: { exports: {} }, console };
  vm.runInNewContext(src, ctx);
  return ctx;
}
const T = (o) => Object.entries(o).map(([key, value]) => ({ key, value }));
const AMMOUD_CFG = JSON.stringify({ version: 4, latitude: 35.0092314, longitude: 25.644504, area: 2500 });
const near = (a, b) => Math.abs(a - b) < 1e-5;

function check(src) {
  const bad = [];
  let f;
  try { f = load(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  if (typeof f.resolveFieldCoords !== "function") return ["λείπει resolveFieldCoords"];
  const R = (tags) => f.resolveFieldCoords(tags);
  const exp = (name, tags, lat, lon, source) => {
    const r = R(tags);
    if (lat === null) { if (r) bad.push(`${name}: έπρεπε null, πήρε ${JSON.stringify(r)}`); return; }
    if (!r || !near(r.lat, lat) || !near(r.lon, lon) || r.source !== source)
      bad.push(`${name}: αναμενόταν ${lat}, ${lon} (${source}), πήρε ${JSON.stringify(r)}`);
  };
  // Α. Αμμουδάρες 25/10: φόρμα σωστή + ετικέτα σε μοίρες → φόρμα
  exp("Α Αμμουδάρες", T({ coordinates: `35°00'33.36"N, 25°38'39.23"E`, configuration: AMMOUD_CFG }), 35.0092314, 25.644504, "configuration");
  // Β. μόνο ετικέτα σε μοίρες-λεπτά-δεύτερα
  exp("Β μοίρες", T({ coordinates: `35°00'33.36"N, 25°38'39.23"E` }), 35 + 33.36 / 3600, 25 + 38 / 60 + 39.23 / 3600, "tag coordinates");
  // Γ. μόνο δεκαδική ετικέτα (22 αγροί σήμερα) — ίδιο με πριν
  exp("Γ δεκαδική", T({ coordinates: "35.331443,25.260246" }), 35.331443, 25.260246, "tag coordinates");
  // Δ. φόρμα με κενό latitude → ετικέτα
  exp("Δ κενή φόρμα", T({ coordinates: "35.1, 25.1", configuration: JSON.stringify({ latitude: "", longitude: 25.6 }) }), 35.1, 25.1, "tag coordinates");
  // Ε. χαλασμένο JSON φόρμας → ετικέτα
  exp("Ε χαλασμένη φόρμα", T({ coordinates: "35.1, 25.1", configuration: "{oops" }), 35.1, 25.1, "tag coordinates");
  // Ζ. φόρμα 0,0 → ετικέτα
  exp("Ζ φόρμα 0,0", T({ coordinates: "35.1, 25.1", configuration: JSON.stringify({ latitude: 0, longitude: 0 }) }), 35.1, 25.1, "tag coordinates");
  // Η. τίποτα έγκυρο → null (η πρόγνωση γράφει σφάλμα για τον αγρό όπως πριν)
  exp("Η τίποτα", T({ coordinates: "κάπου στην Κρήτη" }), null);
  exp("Η2 χωρίς ετικέτες", [], null);
  // Θ. νότιο/δυτικό ημισφαίριο σε μοίρες → αρνητικά
  exp("Θ S/W", T({ coordinates: `33°52'4"S, 151°12'26"W` }), -(33 + 52 / 60 + 4 / 3600), -(151 + 12 / 60 + 26 / 3600), "tag coordinates");
  // Ι. φόρμα με αριθμούς ως κείμενο (έτσι τους γράφουν παλιές φόρμες)
  exp("Ι φόρμα κείμενο", T({ configuration: JSON.stringify({ latitude: "40.347025", longitude: "23.258403" }) }), 40.347025, 23.258403, "configuration");
  // Κ. εκτός ορίων στη φόρμα → ετικέτα
  exp("Κ φόρμα εκτός ορίων", T({ coordinates: "35.1, 25.1", configuration: JSON.stringify({ latitude: 135, longitude: 25 }) }), 35.1, 25.1, "tag coordinates");
  if (!/coord_source:\s*coords\.source/.test(src)) bad.push("το metadata δεν γράφει coord_source");
  if (!/const coords = resolveFieldCoords\(field\.tags\)/.test(src)) bad.push("το main δεν καλεί resolveFieldCoords");
  return bad;
}

// Η ΜΟΝΗ διαφορά από το git HEAD (v9 = ζωντανό) πρέπει να είναι στη θέση: η ροή αποστολής δεν αλλάζει.
const OLD = execSync(`git show HEAD:${P}`, { cwd: ROOT, encoding: "utf8" });
for (const keep of ["fetchOpenMeteo(coords.lat, coords.lon)", "fetchOpenMeteoRadiation(coords.lat, coords.lon)", 'variable: "forecast"',
  "hourly_epoch,", "isField", "Utils.getTokenByName(account, field.id)", "module.exports = new Analysis(main);"])
  if (SRC.split(keep).length !== OLD.split(keep).length) console.log("✗ άλλαξε κάτι εκτός θέσης: " + keep);

const base = check(SRC);
console.log(base.length ? "✗ " + base.join("\n✗ ") : "ΒΑΣΗ ✓ (σενάρια Α–Κ)");

const MUT = [
  ["ετικέτα πριν από φόρμα", (s) => s.replace('const cfgRaw = tags?.find((t) => t.key === "configuration")?.value;', 'const cfgRaw = tags?.find((t) => t.key === "coordinates") ? null : tags?.find((t) => t.key === "configuration")?.value;')],
  ["χωρίς μοίρες", (s) => s.replace("if (!m) return NaN;", "return NaN;")],
  ["δέχεται 0,0", (s) => s.replace(" && !(lat === 0 && lon === 0)", "")],
  ["χάνει το πρόσημο S/W", (s) => s.replace('|| /[SW]/i.test(m[4] || "")', "")],
  ["αντιμετάθεση lat/lon φόρμας", (s) => s.replace("const lat = Number(cfg.latitude);", "const lat = Number(cfg.longitude);")],
  ["χωρίς όρια", (s) => s.replace("Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&", "")],
  ["δεν πέφτει στην ετικέτα", (s) => s.replace('return c ? { ...c, source: "tag coordinates" } : null;', "return null;")],
  ["χωρίς coord_source", (s) => s.replace("coord_source: coords.source,", "")],
];
let k = 0;
for (const [n, f] of MUT) {
  const m = f(SRC);
  if (m === SRC) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); continue; }
  if (check(m).length) { k++; console.log("✓ σκοτώθηκε: " + n); } else console.log("✗✗ ΕΠΕΖΗΣΕ: " + n);
}
console.log(`μεταλλάξεις ${k}/${MUT.length}`);

// Προαιρετικά: σύγκριση στόλου παλιού (v9) / νέου (v10) σε πραγματικές ετικέτες (το αρχείο ΔΕΝ μπαίνει στο git).
if (process.argv[2]) {
  const fields = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const o = load(OLD), n = load(SRC);
  const km = (a, b) => { const r = (x) => x * Math.PI / 180, d1 = r(b.lat - a.lat), d2 = r(b.lon - a.lon);
    return 12742 * Math.asin(Math.sqrt(Math.sin(d1 / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(d2 / 2) ** 2)); };
  let same = 0;
  for (const fd of fields) {
    const a = o.parseCoordinatesTag(fd.tags, "coordinates"), b = n.resolveFieldCoords(fd.tags);
    if (a && b && km(a, b) < 0.001) { same++; continue; }
    console.log(`ΣΤΟΛΟΣ ${fd.name}: v9=${a ? a.lat + ", " + a.lon : "ΣΦΑΛΜΑ"} → v10=${b ? b.lat + ", " + b.lon + " (" + b.source + ")" : "ΣΦΑΛΜΑ"}${a && b ? " · " + (km(a, b) * 1000).toFixed(0) + " m" : ""}`);
  }
  console.log(`ΣΤΟΛΟΣ: ${same}/${fields.length} ίδια θέση με πριν`);
}
process.exit(base.length === 0 && k === MUT.length ? 0 : 1);
