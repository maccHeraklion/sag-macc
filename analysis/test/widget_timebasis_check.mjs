// Ελεγκτής widget · T-BPIDAYS-W-01 + T-SOILCAL-W-01 + T-ACCUMBASIS-W-01.
// Τρέχει τον πραγματικό κώδικα του _sagEv10 και διασταυρώνει τα σταθερά κείμενα με τις
// σταθερές του ΠΥΡΗΝΑ. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const CORE = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8").replace(/\r\n/g, "\n");
if (W.includes("\r\n")) throw new Error("το widget πρέπει να είναι LF");

const H = 36e5, MIN = 6e4, T0 = Date.UTC(2026, 8, 17);
function series() { const o = []; let v = 29; for (let t = T0; t < T0 + 3 * 24 * H; t += 20 * MIN) { v -= 0.01; o.push([t, Number(v.toFixed(3))]); } return o; }
const chk = (sv) => ({ mn: 28.2, mx: 29, last: sv[sv.length - 1][1], zl: 30.35, zu: 33.75, st: NaN, rz: 24.6, ovr: 0, flat: false, days: 3 });
const SC = JSON.stringify({ s: { w: 25.29, l: 25.14, k: 20719, e: 0, f: 28.5, n: 2 }, d: { w: 23.16, l: 24.19, k: 20719 }, u: "2026-09-24" });
const refs = (scal) => [{ label: "Κάτω όριο", value: 30.35 }, ...(scal ? [{ label: "_scal10", value: NaN, txt: scal }] : [])];

function buildEv(src) {
  const a = src.indexOf("_sagEv10=l.useMemo(()=>{"); const b = src.indexOf("},[V,p,s,_sagChk7])", a);
  if (a < 0 || b < 0) throw new Error("_sagEv10 δεν βρέθηκε");
  return new Function("V", "p", "s", "_sagChk7", src.slice(a + "_sagEv10=l.useMemo(()=>{".length, b));
}
function coreConst(name) { const m = CORE.match(new RegExp(name + "\\s*=\\s*([0-9.]+)")); return m ? Number(m[1]) : NaN; }

function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  // ── T-BPIDAYS-W-01 ──
  ok(src.includes("perfDays=(Number.isFinite(_pd)&&_pd>0)?Math.round(_pd):null"), "perfDays από bpi_total_days");
  ok(src.includes("perfPct:y,perfDays:perfDays,"), "perfDays στο Le");
  ok(src.includes('Le.perfDays!==null?" (σε "+Le.perfDays+(Le.perfDays===1?" ημέρα":" ημέρες")+" με πλήρη δεδομένα)":""'), "κείμενο «σε N ημέρες με πλήρη δεδομένα»");
  ok(CORE.includes('{ variable: "bpi_total_days", value: new_total_days }'), "ο πυρήνας εκπέμπει bpi_total_days (v50.151)");
  // ── T-SOILCAL-W-01 ──
  ok(src.includes('label:"_scal10"'), "soilcal_state περνά στο modal");
  ok(/\(st\.n \|\| 0\) >= 3/.test(CORE) && src.includes('"/3 δείγματα"'), "το «/3» του widget = το ≥3 του πυρήνα");
  let E; try { E = buildEv(src); } catch (e) { f.push("εξαγωγή: " + e.message); return f; }
  const S = series();
  const e1 = E(S, refs(SC), "soil_moisture1", chk(S));
  ok(e1 && e1.scHas === true && e1.scN === 2 && e1.scF === 28.5, "Α1 ρηχός: 2/3 δείγματα, f=28,5");
  const e2 = E(S, refs(SC), "soil_moisture2", chk(S));
  ok(e2 && e2.scHas === true && e2.scN === 0 && e2.scF === null, "Α2 βαθύς: 0/3, χωρίς f");
  const e3 = E(S, refs(null), "soil_moisture1", chk(S));
  ok(e3 && e3.scHas === false, "Α3 χωρίς soilcal_state: τίποτα");
  const e4 = E(S, refs("{όχι json"), "soil_moisture1", chk(S));
  ok(e4 && e4.scHas === false && e4.n === S.length, "Α4 χαλασμένο JSON: σιωπή, το υπόλοιπο memo ζει");
  ok(src.includes('_sagEv10.scN>=3?" — αρκετά για να προσαρμοστούν τα όρια.":" — μέχρι τότε ισχύουν τα όρια του πίνακα."'), "κείμενο k/3 με τις δύο εκβάσεις");
  // ── T-ACCUMBASIS-W-01 ──
  ok(src.includes('accumulator_basis:"Βάση συσσωρευτών (βαθμοημέρες, ώρες μόλυνσης)"'), "ετικέτα στην κάρτα «Πώς υπολογίστηκαν»");
  ok(src.includes('if(TB.gdd_crop_status||TB.infection_model_status)TR.push({k:"accumulator_basis"'), "η γραμμή μπαίνει μόνο όταν υπάρχουν συσσωρευτές");
  const gap = coreConst("_SAG_TICK_GAP_MAX_H"), tmin = coreConst("_SAG_TICK_H_MIN"), tmax = coreConst("_SAG_TICK_H_MAX");
  const air = (CORE.match(/name: 'αέρας',\s*limit: (\d+)/) || [])[1];
  ok(gap === 48 && src.includes("Κενό επικοινωνίας έως 48 ώρες") && src.includes("πάνω από 48 ώρες δεν συμπληρώνεται"), "το 48 ω του widget = _SAG_TICK_GAP_MAX_H του πυρήνα");
  ok(tmin === 0.5 && tmax === 2 && src.includes("(0,5–2 ώρες)"), "το 0,5–2 ω του widget = _SAG_TICK_H_MIN/MAX");
  ok(air === "90" && src.includes("παλαιότερη από 90΄ παγώνει"), "το 90΄ του widget = όριο ηλικίας αέρα του πυρήνα");
  return f;
}

const base = run(W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 πάντα ο ρηχός", "(idx===1?_sco.d:_sco.s)", "_sco.s"],
  ["m2 χωρίς /3", '"/3 δείγματα"', '" δείγματα"'],
  ["m3 ημέρες σεζόν κρυφές", 'Le.perfDays!==null?" (σε "', 'false?" (σε "'],
  ["m4 χωρίς γραμμή συσσωρευτών", 'if(TB.gdd_crop_status||TB.infection_model_status)TR.push({k:"accumulator_basis"', 'if(false)TR.push({k:"accumulator_basis"'],
  ["m5 λάθος όριο κενού", "Κενό επικοινωνίας έως 48 ώρες", "Κενό επικοινωνίας έως 24 ώρες"],
  ["m6 scN δεν διαβάζεται", "scN=Number.isFinite(Number(_scs.n))?Math.max(0,Math.floor(Number(_scs.n))):0;", "scN=0;"],
  ["m7 χαλασμένο JSON ρίχνει το memo", "catch{}", "catch(e){throw e}"],
  ["m8 perfDays με μηδέν", "perfDays=(Number.isFinite(_pd)&&_pd>0)?Math.round(_pd):null", "perfDays=Number.isFinite(_pd)?Math.round(_pd):null"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!W.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(W.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
