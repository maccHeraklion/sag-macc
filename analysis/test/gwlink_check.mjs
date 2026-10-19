/* T-GWMAP-03 (19/10/2026) — ΕΛΕΓΧΟΣ: ταύτιση gateway δικτύου (LRR) ↔ συσκευή καταλόγου με θέση.
 * Δεδομένα: οι ΠΡΑΓΜΑΤΙΚΕΣ θέσεις — LRR από την κονσόλα της gatewayLiveness 19/10 14:26 UTC, κατάλογος από τις
 * ετικέτες coordinates (fleet_roster). Τρέχει τις πραγματικές linkByPosition + sortedList. Μεταλλάξεις.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
const HTML0 = readFileSync(new URL("../../custom_html_files/gateway-board.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function extract(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("δεν βρέθηκε η " + name);
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("δεν έκλεισε η " + name);
}
const NET = [ // κωδικός, lat, lng, όνομα από GW_NAMES (βέβαιο) ή null
  ["1000C238", 35.367168, 24.731676, "Πέραμα"], ["10007638", 35.071251, 24.772312, "ΤΥΜΠΑΚΙ - ΟΙΚΙΑ ΓΡΙΝΙΑΡΑΚΗ"],
  ["1000ECBE", 39.775085, 22.825647, "Αγια 1 (Περιοχή Τοπαλίδου)"], ["10006847", 34.994354, 24.871716, null],
  ["1000F992", 35.28333, 25.115557, null], ["10011672", 35.339863, 25.162653, "KEK"],
  ["10007636", 35.340664, 25.16161, null], ["100151FF", 35.340664, 25.16161, null], ["10018979", 35.339695, 25.162313, null],
];
const ROS = [ // id, όνομα τοποθεσίας, lat, lng
  ["r_071069", "Πέραμα (συσκευή)", 35.367146, 24.731688], ["r_071eff", "Τυμπάκι", 35.0712, 24.772279],
  ["r_fbd243", "Αγια 1", 39.775085, 22.825647], ["r_060617", "Πόμπια", 34.994347, 24.871695],
  ["r_1b3475", "ΚΕΚ", 35.33985, 25.162884], ["r_b00ec4", "Καλαθάκης", 35.29802, 25.117641],
  ["r_fce39d", "Βασσάλος", 35.300778, 25.117742], ["r_fbd21f", "Γουμένισσα", 40.97718, 22.383425],
];
function scenarios(HTML) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  const code = HTML.match(/var LINK_M = \d+;/)[0] + "\n" + ["_distM", "linkByPosition", "sortedList"].map((n) => extract(HTML, n)).join("\n");
  const state = { gw: {} };
  for (const [c, lat, lng, nm] of NET) state.gw["lrr:" + c] = { id: "lrr:" + c, code: c, fromNetwork: true, lat, lng, vars: {}, name: nm || "Gateway " + c, nameSure: nm ? true : null, nameGuess: "" };
  for (const [id, nm, lat, lng] of ROS) state.gw[id] = { id, name: nm, lat, lng, vars: {}, roster: true };
  const sb = { state, console, isUndeclared: (g) => !!(g && g.roster), statusOf: () => ({ cls: "green" }) };
  vm.createContext(sb);
  try { vm.runInContext(code, sb); sb.linkByPosition(); } catch (e) { return ["εκτέλεση: " + e.message]; }
  const G = state.gw;
  want("Α1 Πόμπια: LRR 10006847 ↔ συσκευή (2 m) → όνομα «Πόμπια»", G["lrr:10006847"].name, "Πόμπια");
  want("Α2 η συσκευή Πόμπια κρύβεται (ένας σταθμός, μία φορά)", G.r_060617.mergedInto, "lrr:10006847");
  want("Α3 Πέραμα: το βέβαιο όνομα GW_NAMES μένει", G["lrr:1000C238"].name, "Πέραμα");
  want("Α4 Πέραμα: η συσκευή ενώθηκε", G.r_071069.mergedInto, "lrr:1000C238");
  want("Α5 Τυμπάκι ενώθηκε", G.r_071eff.mergedInto, "lrr:10007638");
  want("Α6 Αγια 1 ενώθηκε", G.r_fbd243.mergedInto, "lrr:1000ECBE");
  want("Β1 ΚΕΚ: μία συσκευή για ΠΟΛΛΑ LRR → πάει στο πλησιέστερο (10011672)", G.r_1b3475.mergedInto, "lrr:10011672");
  want("Β2 ΚΕΚ: η ταύτιση σημαδεύεται ΟΧΙ βέβαιη (υπάρχουν κι άλλα κοντά)", G["lrr:10011672"].linked.sure, false);
  want("Β3 τα άλλα LRR του ΚΕΚ μένουν χωρίς όνομα συσκευής", [G["lrr:10007636"].linked, G["lrr:10018979"].linked], [null, null]);
  want("Γ1 1000F992: Καλαθάκης 1,6 km / Βασσάλος 1,9 km → ΚΑΜΙΑ ταύτιση (εκτός 200 m)", G["lrr:1000F992"].linked, null);
  want("Γ2 Καλαθάκης/Βασσάλος μένουν ως συσκευές χωρίς ταυτοποίηση", [G.r_b00ec4.mergedInto, G.r_fce39d.mergedInto], [null, null]);
  const list = sb.sortedList().map((g) => g.id);
  want("Δ1 η λίστα δεν δείχνει τις ενωμένες συσκευές", ["r_060617", "r_071069", "r_071eff", "r_fbd243", "r_1b3475"].filter((x) => list.includes(x)), []);
  want("Δ2 η λίστα δείχνει όσες δεν ταυτίστηκαν", ["r_b00ec4", "r_fce39d", "r_fbd21f"].every((x) => list.includes(x)), true);
  // Ε. ξανατρέχει σε κάθε ενημέρωση χωρίς να «κολλάει» παλιά ένωση
  delete G["lrr:10006847"]; sb.linkByPosition();
  want("Ε1 αν φύγει το LRR, η συσκευή ξαναεμφανίζεται", G.r_060617.mergedInto, null);
  return bad;
}
const base = scenarios(HTML0);
console.log("=== T-GWMAP-03 ταύτιση ===");
console.log(base.length ? "✗ " + base.join("\n✗ ") : "ΠΡΑΓΜΑΤΙΚΟΣ ΚΩΔΙΚΑΣ: ✓ ΠΕΡΝΑΕΙ");
const MUT = [
  ["τεράστια ακτίνα", "var LINK_M = 200;", "var LINK_M = 5000;"],
  ["χωρίς έλεγχο αντιπάλων", "sure: rivals === 0 }", "sure: true }"],
  ["μια συσκευή σε πολλά LRR", "if (usedN[P.n.id] || usedR[P.r.id]) continue;", "if (usedN[P.n.id]) continue;"],
  ["η λίστα δείχνει και τις ενωμένες", "    if (state.gw[k].mergedInto) continue;\n", ""],
  ["δεν μηδενίζεται η παλιά ένωση", "    g.mergedInto = null;\n", ""],
  ["πατάει το βέβαιο όνομα", "if (P.n.nameSure !== true && P.r.name) {", "if (P.r.name) {"],
];
let k = 0, na = 0;
for (const [n, a, b] of MUT) {
  if (HTML0.split(a).length !== 2) { console.log("✗✗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ «" + n + "»"); na++; continue; }
  let r; try { r = scenarios(HTML0.replace(a, b)); } catch (e) { r = ["σκάει: " + e.message]; }
  if (r.length) { k++; console.log("✓ «" + n + "» σκοτώθηκε ← " + r[0]); } else console.log("✗✗ «" + n + "» ΕΠΙΒΙΩΣΕ");
}
console.log(`μεταλλάξεις: ${k}/${MUT.length}, μη εφαρμόσιμες ${na}`);
const ok = base.length === 0 && k === MUT.length;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
