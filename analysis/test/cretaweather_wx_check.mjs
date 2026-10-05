// Ελεγκτής T-CRETAWX-WX-01 (Cretaweather · custom_html_files/weatherStation/weather-dashboard.js):
// πίεση σε στάθμη θάλασσας (χωρίς το +5,5 hPa του connector), δείκτης ψυχρότητας μόνο όπου ορίζεται,
// διανυσματικός μέσος όρος κατεύθυνσης ανέμου, «παλιά τιμή» μετά από 6 ώρες. Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα
// (μπλοκ «ΒΟΗΘΗΤΙΚΑ ΜΕΤΕΩΡΟΛΟΓΙΑΣ») και ελέγχει ότι η σελίδα τα χρησιμοποιεί. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "weatherStation", "weather-dashboard.js"), "utf8");
const A = "  // ═══ ΒΟΗΘΗΤΙΚΑ ΜΕΤΕΩΡΟΛΟΓΙΑΣ", B = "  // ═══ ΤΕΛΟΣ ΒΟΗΘΗΤΙΚΩΝ ΜΕΤΕΩΡΟΛΟΓΙΑΣ";
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function run(code) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  const a = code.indexOf(A), b = code.indexOf(B);
  if (a < 0 || b < 0) return ["X0 δεν βρέθηκε το μπλοκ"];
  let W; try { W = new Function(code.slice(a, b) + "\nreturn { STATION_ALTITUDE_M, PARSER_PRESSURE_OFFSET_HPA, STALE_HOURS, pressureToMsl, windChillApplies, circularMeanDeg, isStaleAt };")(); } catch (e) { return ["X0 φόρτωση: " + e.message]; }

  // X1 πίεση: ζωντανές τιμές 5/10 ~19:00 έναντι μοντέλου Open-Meteo (MSL 1020,4–1020,5 hPa)
  const galyfa = W.pressureToMsl(988.7, W.STATION_ALTITUDE_M["684c458bcd7675000a9ae991"]);
  const potamies = W.pressureToMsl(1006.6, W.STATION_ALTITUDE_M["684c39adfcf7b1000a8dd206"]);
  ok(near(galyfa, 1020.4, 3), "X1α Γαλύφα 988,7 → ~1020 hPa στη θάλασσα (" + galyfa?.toFixed(1) + ")");
  ok(near(potamies, 1020.5, 3), "X1β Ποταμιές 1006,6 → ~1020 hPa στη θάλασσα (" + potamies?.toFixed(1) + ")");
  ok(near(galyfa, potamies, 4), "X1γ δύο κοντινοί σταθμοί σε διαφορετικό υψόμετρο συμφωνούν στη θάλασσα (≤ 4 hPa: αβεβαιότητα υψομέτρου DEM ±15 m ≈ ±1,8 hPa)");
  ok(W.pressureToMsl(1010, 0) === 1004.5, "X1δ υψόμετρο 0: αφαιρείται μόνο το +5,5 του connector (" + W.pressureToMsl(1010, 0) + ")");
  ok(W.pressureToMsl(1010, undefined) === null, "X1ε άγνωστο υψόμετρο → null (η σελίδα δείχνει την πίεση του σταθμού)");
  ok(W.PARSER_PRESSURE_OFFSET_HPA === 5.5, "X1ζ αντιστάθμιση connector 5,5 hPa");
  ok(Object.keys(W.STATION_ALTITUDE_M).length === 4, "X1η υψόμετρο και για τους 4 σταθμούς");

  // X2 δείκτης ψυχρότητας: ΚΟΞΑΡΗ 18,9 °C με άπνοια → δεν ορίζεται· 5 °C με 20 km/h → ορίζεται
  ok(!W.windChillApplies(18.9, 0), "X2α 18,9 °C, άπνοια → δεν ορίζεται");
  ok(!W.windChillApplies(12, 30), "X2β 12 °C → δεν ορίζεται (> 10 °C)");
  ok(!W.windChillApplies(5, 3), "X2γ 5 °C, 3 km/h → δεν ορίζεται (άνεμος ≤ 4,8)");
  ok(W.windChillApplies(5, 20), "X2δ 5 °C, 20 km/h → ορίζεται");

  // X3 κατεύθυνση ανέμου
  ok(W.circularMeanDeg([350, 10]) === 0, "X3α 350° και 10° → 0° (" + W.circularMeanDeg([350, 10]) + ")");
  ok(W.circularMeanDeg([80, 100]) === 90, "X3β 80° και 100° → 90°");
  ok(W.circularMeanDeg([270, 300, 330]) === 300, "X3γ 270/300/330 → 300° (" + W.circularMeanDeg([270, 300, 330]) + ")");
  ok(W.circularMeanDeg([]) === null && W.circularMeanDeg([0, 180]) === null, "X3δ χωρίς τιμές / αντίθετες → null");
  ok(W.circularMeanDeg([355]) === 355, "X3ε μία τιμή → η ίδια");

  // X4 παλιά τιμή: > 6 ώρες
  const now = Date.parse("2026-10-05T16:00:00Z");
  ok(W.isStaleAt("2026-09-30T12:00:00Z", now, W.STALE_HOURS), "X4α ΚΟΞΑΡΗ πίεση 5 ημερών → παλιά");
  ok(!W.isStaleAt("2026-10-05T15:55:00Z", now, W.STALE_HOURS), "X4β 5 λεπτά → φρέσκια");
  ok(W.isStaleAt(undefined, now, W.STALE_HOURS), "X4γ χωρίς χρόνο → παλιά");

  // X5 η σελίδα χρησιμοποιεί τα βοηθητικά εκεί που πρέπει
  ok(!/AGG_AVG_VARS = \[[^\]]*wind_direction_sensor/.test(code), "X5α η κατεύθυνση δεν περνά από τον αριθμητικό μέσο όρο του server");
  ok(/acc\.circ \? circularMeanDeg\(acc\.angles\)/.test(code), "X5β τα διαγράμματα κατεύθυνσης με circularMeanDeg");
  ok(/value: Number\(displayValue\(rec\.variable, rec\.value\)\)/.test(code), "X5γ τα διαγράμματα πίεσης σε στάθμη θάλασσας");
  ok(/fmt\(displayValue\(rec\.variable, rec\.value\), digits\)/.test(code), "X5δ ο πίνακας ιστορικού σε στάθμη θάλασσας");
  ok(/key === "wind_chill" && !windChillApplies\(/.test(code), "X5ε «Όλες οι μεταβλητές»: δείκτης ψυχρότητας μόνο όπου ορίζεται");
  ok(/const stale = !def\.rain && rec && isStaleAt\(rec\.time, Date\.now\(\), STALE_HOURS\)/.test(code), "X5ζ οι κάρτες δείχνουν «—» για παλιές τιμές");
  return f;
}

const base = run(SRC);
const mutants = [
  ["χωρίς αντιστάθμιση connector", (s) => s.replace("const PARSER_PRESSURE_OFFSET_HPA = 5.5;", "const PARSER_PRESSURE_OFFSET_HPA = 0;")],
  ["χωρίς αναγωγή υψομέτρου", (s) => s.replace("return p * Math.pow(1 - 2.25577e-5 * altitudeM, -5.25588);", "return p;")],
  ["Γαλύφα ↔ Ποταμιές ανάποδα", (s) => s.replace('"684c458bcd7675000a9ae991": 298', '"684c458bcd7675000a9ae991": 176').replace('"684c39adfcf7b1000a8dd206": 176', '"684c39adfcf7b1000a8dd206": 298')],
  ["ψυχρότητα πάντα", (s) => s.replace("Number(tempC) <= 10 && Number(windKmh) > 4.8", "true")],
  ["αριθμητικός μέσος γωνιών", (s) => s.replace("const deg = Math.atan2(s, c) * 180 / Math.PI;", "const deg = degs.reduce((x, y) => x + Number(y), 0) / n;")],
  ["παλιά μετά από 6 ημέρες", (s) => s.replace("const STALE_HOURS = 6;", "const STALE_HOURS = 144;")],
  ["κατεύθυνση ξανά στον server", (s) => s.replace('"wind_speed_kmh", "uv_index", "light_intensity"];', '"wind_speed_kmh", "wind_direction_sensor", "uv_index", "light_intensity"];')],
  ["διαγράμματα χωρίς στάθμη θάλασσας", (s) => s.replace("value: Number(displayValue(rec.variable, rec.value)) });", "value: Number(rec.value) });")],
];
let killed = 0;
for (const [name, mut] of mutants) {
  const m = mut(SRC);
  if (m === SRC) { console.log("✗ μετάλλαξη δεν εφαρμόστηκε: " + name); continue; }
  if (run(m).length) killed++; else console.log("✗ ΕΠΙΖΕΙ μετάλλαξη: " + name);
}
base.forEach((x) => console.log("✗ " + x));
console.log(`cretaweather_wx_check: ${base.length ? "ΑΠΟΤΥΧΙΑ" : "OK"} · μεταλλάξεις ${killed}/${mutants.length} σκοτώθηκαν`);
process.exit(base.length || killed !== mutants.length ? 1 : 0);
