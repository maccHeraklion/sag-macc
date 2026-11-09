// Ελεγκτής v50.189 (9/11/2026): T-DOWNY-REPEAT-01 + T-LEAFHOUR-WIRE-01, με ΠΡΑΓΜΑΤΙΚΑ ωριαία δεδομένα θερμοκηπίου αγγουριού
// 15/10–9/11 (περονόσπορος που δεν προβλέφθηκε). Μεταλλάξεις: κάθε βλάβη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { replay } from "./downy_greenhouse_replay.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const rawC = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const HI = (o) => (o.lv["Υψηλός κίνδυνος"] || 0) + (o.lv["Σοβαρός κίνδυνος"] || 0);
function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let r;
  try { r = replay(src); } catch (e) { return ["επανάληψη: " + e.message]; }
  ok(r.version === "v50.193 · 2026-11-09", "Ε έκδοση (" + r.version + ")");
  const D = r.days; const wetDays = Object.keys(D).filter((d) => d >= "10-15" && d <= "11-03");
  // Α · η προειδοποίηση υπάρχει κάθε ημέρα της περιόδου μολύνσεων (ο κανόνας RH 95 έδινε 0)
  ok(wetDays.every((d) => HI(D[d]) > 0), "Α1 Υψηλός/Σοβαρός κάθε ημέρα 15/10–3/11 (λείπουν: " + wetDays.filter((d) => !HI(D[d])).join(",") + ")");
  // Β · κλιμάκωση: Σοβαρός μετά από 48 ώρες ανοιχτής ειδοποίησης, όχι νωρίτερα
  ok(!D["10-15"].lv["Σοβαρός κίνδυνος"] && !D["10-16"].lv["Σοβαρός κίνδυνος"], "Β1 όχι Σοβαρός τις 2 πρώτες ημέρες");
  ok(D["10-17"].lv["Σοβαρός κίνδυνος"] > 0 && D["10-25"].lv["Σοβαρός κίνδυνος"] === 24, "Β2 Σοβαρός από 17/10, όλη μέρα 25/10");
  ok(D["10-18"].lv["Μέτριος κίνδυνος"] > 0, "Β4 ο Μέτριος μέσα σε ανοιχτή ειδοποίηση δεν κλιμακώνεται");
  ok(/ψεκάστε προληπτικά/.test(D["10-25"].txt["Σοβαρός κίνδυνος"] || "") && /Αερίστε/.test(D["10-25"].txt["Σοβαρός κίνδυνος"] || ""), "Β3 κείμενο: προληπτικός ψεκασμός + αερισμός (θερμοκήπιο)");
  // Γ · όταν στέγνωσε (5–9/11): χωρίς Υψηλό/Σοβαρό
  ok(["11-05", "11-06", "11-07", "11-08"].every((d) => !HI(D[d])), "Γ1 5–8/11 χωρίς Υψηλό/Σοβαρό");
  // Δ · μεμονωμένο επεισόδιο (από 3/11): μένει Υψηλός — επιθεωρήστε
  const r2 = replay(src, { from: "11-03" });
  ok(HI(r2.days["11-03"]) > 0 && !Object.values(r2.days).some((o) => o.lv["Σοβαρός κίνδυνος"]), "Δ1 ένα επεισόδιο δεν κλιμακώνεται");
  // Δ2 · ξεχασμένη ανοιχτή υπόθεση (ανοιχτή 40 ημέρες, χωρίς h): η πρώτη νέα σειρά ΔΕΝ γίνεται αμέσως Σοβαρός
  const o40 = Math.floor(Date.parse("2026-09-10T00:00:00Z") / 6e4);
  const r4 = replay(src, { from: "10-20", initState: { case_pseudoperonospora_cubensis: [{ value: JSON.stringify({ s: "open", o: o40, p: 3 }) }] } });
  ok(!r4.days["10-20"].lv["Σοβαρός κίνδυνος"] && !r4.days["10-21"].lv["Σοβαρός κίνδυνος"] && r4.days["10-23"].lv["Σοβαρός κίνδυνος"] === 24, "Δ2 παλιά ανοιχτή υπόθεση: Σοβαρός μόνο μετά από 48 ω της νέας σειράς");
  // Ε · δηλωμένη προστασία: όχι Σοβαρός όσο ισχύει
  // Η δηλωμένη προστασία κρίνεται με το ρολόι του συστήματος (_sagDeclaredSprayInfo → Date.now()), όχι με την ώρα του παλμού·
  // γι' αυτό ο «ψεκασμός» της δοκιμής είναι 5 ημερών (φρέσκος ρίχνει ήδη το FIR σε Χαμηλό, που δεν ελέγχει τίποτα).
  const r3 = replay(src, { from: "10-20", to: "10-27", spray: { from: "10-20", iso: new Date(Date.now() - 5 * 864e5).toISOString(), days: 10 } });
  ok(!Object.values(r3.days).some((o) => o.lv["Σοβαρός κίνδυνος"]) && /Προστασία έως/.test(r3.days["10-24"].txt["Υψηλός κίνδυνος"] || ""), "Ε1 με προστασία: Υψηλός «Προστασία έως», όχι Σοβαρός");
  // Ζ · καλωδίωση μέγιστου ώρας φύλλου: μία κλήση, στον γενικό κλάδο, όχι στον κλάδο σονδών
  const calls = src.split("await _sagLeafHourRead(").length - 1;
  const gen = src.indexOf("if (hourTich && typeName === 'lms01_ls') await _sagLeafHourRead(device, deviceData, now, fieldName);");
  const soilA = src.indexOf('(typeName === "lse02" || typeName === "se0x")'), soilB = src.indexOf("// TYPE: lse01 → water_soil avg (24h)");
  const genericA = src.indexOf("// GENERIC: known type → last_item within last 24h");
  ok(calls === 1 && gen > genericA && genericA > soilB && soilB > soilA, "Ζ1 _sagLeafHourRead μία φορά, στον γενικό κλάδο (κλήσεις " + calls + ")");
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("downy_repeat_check: όλα ✔");
const MUT = [
  ["όριο RH 95 (πριν τον v50.176)", "const humidityOk = RHd >= _rhMin || (needsWet && (_lwsMeasuredWet || _lwsRainWet));", "const humidityOk = RH >= Number(_oh.min);"],
  ["χωρίς κλιμάκωση", "if (_run !== undefined && level === 3", "if (false && level === 3"],
  ["48 ω από το άνοιγμα, όχι από τη σειρά", "(_run === undefined || !Number.isFinite(_pH)", "(false && _run === undefined || !Number.isFinite(_pH)"],
  ["κλιμάκωση αμέσως", "const _SAG_DOWNY_REPEAT_MIN = 48 * 60;", "const _SAG_DOWNY_REPEAT_MIN = 0;"],
  ["κλιμάκωση παρά την προστασία", "&& !/^Προστασία έως/.test(String(msg.metadata.text || ''))) {   // T-DOWNY-REPEAT-01", ") {   // T-DOWNY-REPEAT-01"],
  ["κλιμάκωση και σε μέτριο", "level === 3 && !knownLow && msg", "level >= 2 && msg"],
  ["αερισμός και εκτός θερμοκηπίου/χωρίς", "_SAG_COVERED_ACTIVE ? ' Αερίστε ώστε να στεγνώνει το φύλλωμα τη νύχτα.' : ''", "_SAG_COVERED_ACTIVE ? '' : ''"],
  ["καλωδίωση πίσω στον κλάδο σονδών", "      if (hourTich && typeName === 'lms01_ls') await _sagLeafHourRead(device, deviceData, now, fieldName);\n", ""],
  ["παλιά έκδοση", "'v50.193 · 2026-11-09'", "'v50.189 · 2026-11-09'"],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = run(SRC.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 60) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
if (dead !== MUT.length) process.exit(1);
