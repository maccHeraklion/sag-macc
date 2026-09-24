// Ελεγκτής v50.155 · T-CARD-COHERENCE-01 (πυρήνας) + T-CARD-W-01 (widget) — η κάρτα υγείας
// του Κουτσάκη χωρίς αντιφάσεις. Τρέχει ΠΡΑΓΜΑΤΙΚΟ κώδικα και των δύο. Κάθε μετάλλαξη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rawC = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const C = rawC.replace(/\r\n/g, "\n");
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
if (W.includes("\r\n")) throw new Error("το widget πρέπει να είναι LF");

function fnText(text, name) {
  const m = text.indexOf("function " + name + "(");
  if (m < 0) throw new Error("δεν βρέθηκε " + name);
  const open = text.indexOf("{", m); let d = 0;
  for (let k = open; k < text.length; k++) { if (text[k] === "{") d++; else if (text[k] === "}") { d--; if (d === 0) return text.slice(m, k + 1); } }
  throw new Error("άνοιγμα χωρίς κλείσιμο: " + name);
}
function buildCore(c) {
  const age = c.match(/const _SAG_FORECAST_MAX_AGE_H = (\d+)/); if (!age) throw new Error("όριο ηλικίας πρόγνωσης");
  const src = "const _SAG_FORECAST_MAX_AGE_H = " + age[1] + ";\n" + fnText(c, "_sagForecastStatusIndicators") + "\n" + fnText(c, "_sagMetSourceIndicators")
    + "\nreturn { fc: _sagForecastStatusIndicators, met: _sagMetSourceIndicators, MAX: _SAG_FORECAST_MAX_AGE_H };";
  return new Function(src)();
}
function buildEce(c) {
  const a = c.indexOf("            const _eceChain2 = "); const b = c.indexOf("\n", c.indexOf("how: _eceHow });", a));
  if (a < 0 || b < 0) throw new Error("μπλοκ _eceW δεν βρέθηκε");
  return new Function("e1", "e2", "_ecNum1", "_eceChain", "_sagEcChain", "_nE", "_ecSatE", "_eceEst", "_eceHow", c.slice(a, b) + "\nreturn _eceW;");
}
function buildWidget(w) {
  const a = w.indexOf("const OKK={"); const b = w.indexOf("const ROW=", a);
  if (a < 0 || b < 0) throw new Error("ορισμοί widget δεν βρέθηκαν");
  return new Function("RW", "AC", "CO", w.slice(a, b) + "\nreturn { OKK, OKR, RWX, FV, AG };");
}

function run(c, w) {
  const f = []; const ok = (x, m) => { if (!x) f.push(m); };
  ok(c.includes("const SAG_KERNEL_VERSION = 'v50.156 · 2026-09-24';"), "έκδοση v50.155");
  // ── T-ECWORST-01 ──
  ok(c.includes("eceMax: _eceMax, eceEst: _eceW.v, eceHow: _eceW.how,") && c.includes("const _eceNow = _eceW.v;"), "η ημερήσια κρίση και ο Ks παίρνουν το χειρότερο βάθος");
  ok(!c.includes("eceEst: (e1 !== null ? _eceEst(e1) : NaN)") && !c.includes("const _eceNow = _eceEst(e1);"), "η παλιά ρηχή-μόνο κλήση έφυγε");
  ok((c.match(/_eceNow\.toFixed\(1\) \+ _eceW\.how/g) || []).length === 2, "και τα δύο κείμενα λένε ποιο βάθος");
  let E; try { E = buildEce(c); } catch (e) { f.push("εξαγωγή ECe: " + e.message); return f; }
  const chain = (uS, m, t, sat) => ({ ece: uS === 463 ? 1.96 : uS === 288 ? 1.18 : null });
  const nE = (k) => (k === "soil_moisture2" ? 23.5 : k === "soil_temperature2" ? 26 : null);
  const est = (u) => u / 1000 * 2.5;
  const w1 = E(288, 463, true, 1.18, chain, nE, 49.6, est, " (×2,5)");
  ok(w1.v === 1.96 && w1.el === "βαθύ" && /βαθύ, από μετρημένη/.test(w1.how), "Α1 Κουτσάκης: ρηχό 1,18 / βαθύ 1,96 -> κρίνει το βαθύ 1,96");
  const w2 = E(463, 288, true, 1.96, chain, nE, 49.6, est, " (×2,5)");
  ok(w2.v === 1.96 && w2.el === "ρηχό", "Α2 ρηχό χειρότερο -> ρηχό");
  const w3 = E(288, null, true, 1.18, chain, nE, 49.6, est, " (×2,5)");
  ok(w3.v === 1.18 && w3.el === "ρηχό", "Α3 ένα βάθος -> αυτό");
  const w4 = E(288, 463, false, 1.18, chain, nE, 49.6, est, " (×2,5)");
  ok(w4.v === 1.18, "Α4 χωρίς αριθμημένα κανάλια (lse01) -> ΔΕΝ διαβάζει soil_moisture2");
  const w5 = E(400, null, true, null, chain, nE, 49.6, est, " (×2,5)");
  ok(w5.v === 1 && w5.how === " (×2,5)", "Α5 χωρίς αλυσίδα -> εφεδρεία ×2,5 όπως πριν");
  const w6 = E(999, 463, true, null, chain, nE, 49.6, est, " (×2,5)");
  ok(w6.v === 1.96 && w6.el === "βαθύ", "Α6 ρηχή αλυσίδα άκυρη, βαθιά έγκυρη -> βαθύ");
  // ── T-FCTEXT-02 / T-METCOVERED-01 ──
  let K; try { K = buildCore(c); } catch (e) { f.push("εξαγωγή πυρήνα: " + e.message); return f; }
  const st = K.fc({ ok: false, ageH: 23.2, why: "η πρόγνωση έχει 23 ώρες" })[0];
  ok(st.value === "Παλιά πρόγνωση" && /πριν 23 ώρες, όριο 12 ώρες/.test(st.metadata.text) && !/coordinates|analysis/.test(st.metadata.text), "Β1 παλιά πρόγνωση: ηλικία + όριο, ΧΩΡΙΣ οδηγίες ετικετών");
  ok(/00:03 και 12:03/.test(st.metadata.text) && /δεν χρειάζεται ενέργεια από τον αγρό/.test(st.metadata.text), "Β2 λέει ποιος ανανεώνει και πότε");
  const s2 = K.fc({ ok: false, why: "καμία πρόγνωση" })[0];
  ok(s2.value === "Μη διαθέσιμη" && /coordinates/.test(s2.metadata.text), "Β3 ΧΩΡΙΣ πρόγνωση: η οδηγία ετικέτας μένει (εκεί χρειάζεται)");
  const s3 = K.fc({ ok: false, ageH: 5, why: "η πρόγνωση έχει λήξει" })[0];
  ok(s3.value === "Μη διαθέσιμη", "Β4 ληγμένη αλλά φρέσκια -> παλιά διαδρομή");
  ok(K.fc({ ok: true, i0: 3, i1: 51, ageH: 4 })[0].value === "Ενεργή", "Β5 ενεργή αμετάβλητη");
  const m1 = K.met({ _sagMetSource: "canopy" }, true)[0];
  ok(m1.metadata.color === "green" && /Καλυμμένη καλλιέργεια/.test(m1.metadata.text) && m1.value === "Αισθητήρας κόμης", "Γ1 κόμη + καλυμμένη -> πράσινο, σωστό όργανο");
  const m2 = K.met({ _sagMetSource: "canopy" }, false)[0];
  ok(m2.metadata.color === "orange" && /υπερεκτιμάται/.test(m2.metadata.text), "Γ2 κόμη σε ανοιχτό αγρό -> πορτοκαλί όπως πριν");
  ok(K.met({ _sagMetSource: "station" }, true)[0].metadata.color === "green" && K.met({ _sagMetSource: "none" }, true).length === 0, "Γ3 σταθμός/τίποτα αμετάβλητα");
  ok(c.includes("..._sagMetSourceIndicators(measurements?.data, !!fieldConfig?.covered_cultivation),"), "Γ4 η κλήση περνά τη σημαία covered");
  // ── T-ACCUMNUM-01 ──
  ok(c.includes("Object.assign(_cgOk, { value: 'Ενεργές · ' + Math.round(newAccum) + ' °C·ημ'") && c.includes("return d ? ' από ' + d.getDate() + '/' + (d.getMonth() + 1) : '';"), "Δ1 βαθμοημέρες καλλιέργειας: αριθμός + από πότε");
  ok(c.includes("return 'Ενεργές · ' + n + (n === 1 ? ' εχθρός' : ' εχθροί');"), "Δ2 εχθροί: πλήθος");
  const iDecl = c.indexOf("const _ihOk = { variable: 'infection_model_status'"), iPush = c.indexOf("    : _ihOk);"), iLoop = c.indexOf("indicators.push({ variable: counterKey, value: newCount });"), iVal = c.indexOf("_ihOk.value = 'Ενεργές · ' + _c.length");
  ok(iDecl > 0 && iPush > iDecl && iLoop > iPush && iVal > iLoop, "Δ3 μύκητες: η τιμή γράφεται ΜΕΤΑ τον βρόχο των μετρητών (" + [iDecl, iPush, iLoop, iVal].join(",") + ")");
  ok(c.includes("+ ' · μέγ. ' + Math.round(_m) + ' ω'; }"), "Δ4 μύκητες: μέγιστος μετρητής ωρών");
  try {
    const a = c.indexOf("  // T-ACCUMNUM-01 (v50.155): πόσοι μύκητες"), b = c.indexOf("\n\n  return indicators;", a);
    const F = new Function("indicators", "_ihFrozen", "_ihOk", "INFECTION_HOURS_COUNTER_PREFIX", c.slice(a, b));
    const o1 = { value: "Ώρες μόλυνσης: ενεργές" };
    F([{ variable: "infection_hours_counter_a", value: 2 }, { variable: "infection_hours_counter_b", value: 7.4 }, { variable: "infection_hours_counter_c", value: 0 }, { variable: "leaf_wet_hours_today", value: 99 }], false, o1, "infection_hours_counter_");
    ok(o1.value === "Ενεργές · 3 μύκητες · μέγ. 7 ω", "Δ4β τρέχει: 3 μύκητες, μέγ. 7 ω (όχι το leaf_wet) — " + o1.value);
    const o2 = { value: "Σε παύση" }; F([{ variable: "infection_hours_counter_a", value: 2 }], true, o2, "infection_hours_counter_");
    ok(o2.value === "Σε παύση", "Δ4γ σε παύση δεν πειράζεται");
    const o3 = { value: "x" }; F([{ variable: "infection_hours_counter_a", value: 1 }], false, o3, "infection_hours_counter_");
    ok(o3.value === "Ενεργές · 1 μύκητας · μέγ. 1 ω", "Δ4δ ενικός");
  } catch (e) { f.push("εξαγωγή μυκήτων: " + e.message); }
  ok(!c.includes("value: 'Βαθμοημέρες εχθρών: ενεργές'"), "Δ5 το παλιό «ενεργές» χωρίς αριθμό έφυγε (εχθροί)");
  // ── T-BPI-SOILTXT-01 ──
  ok((c.match(/, text: _soilTxt \}/g) || []).length === 2 && c.includes("' °C, ' + (_soilHot ? 'πάνω' : 'κάτω') + ' από το βέλτιστο ' + _soilTrap.opt.toFixed(0) + ' °C"), "Ε1 ζεστό/κρύο έδαφος λέει μέτρηση και βέλτιστο");
  ok(c.includes("opt: peak - 3, max: optMax + 5, src: 'optimal_temp_range'"), "Ε2 το Topt = peak − 3 ΔΕΝ άλλαξε (απόφαση εκκρεμεί)");
  // ── widget ──
  ok(w.includes('soil_moisture_limits_status:"Όρια υγρασίας: τύπος εδάφους"') && w.includes('soil_temp_source:"Θερμοκρασία εδάφους τώρα"'), "Ζ1 ετικέτες");
  ok(w.includes('.filter(x=>!(x.k==="soil_moisture_limits_status"&&String(x.d.value)==="Εντάξει"))'), "Ζ2 το «Εντάξει» ορίων κρύβεται");
  ok(w.includes('children:FV(x)+AG(md)}') && w.includes('RWX.map(ROW),OKR.length?e.jsxs("details"') && w.includes('" έλεγχοι εντάξει"'), "Ζ3 γραμμές μέσω ROW, ομάδα «Όργανα και δεδομένα»");
  let G; try { G = buildWidget(w); } catch (e) { f.push("εξαγωγή widget: " + e.message); return f; }
  const AC = c9 => c9 === "red" || c9 === "orange" || c9 === "yellow", CO = x => String(((x.d || {}).metadata || {}).color || "");
  const RW = [{ k: "sensor_faults", d: { value: "Όργανα: 3", metadata: { color: "green" } } }, { k: "device_battery", d: { value: "ok", metadata: { color: "green" } } },
    { k: "measurement_age", d: { value: "παλιές", metadata: { color: "orange" } } }, { k: "soil_ece1", d: { value: 1.18, metadata: { color: "grey", unit: "dS/m" } } },
    { k: "measurement_sources", d: { value: "Ένα όργανο", metadata: { color: "grey" } } }];
  const g = G(RW, AC, CO);
  ok(g.OKR.length === 3 && g.OKR.every(x => ["sensor_faults", "device_battery", "measurement_sources"].includes(x.k)), "Η1 τα «εντάξει» οργάνων/δεδομένων ομαδοποιούνται (πράσινο ΚΑΙ γκρι)");
  ok(g.RWX.length === 2 && g.RWX.some(x => x.k === "measurement_age") && g.RWX.some(x => x.k === "soil_ece1"), "Η2 το πορτοκαλί ΜΕΝΕΙ έξω από την ομάδα, τα άλλα μεγέθη δεν αγγίζονται");
  ok(g.FV({ k: "soil_ece1", d: { value: 1.18, metadata: { unit: "dS/m" } } }) === "1,18 dS/m", "Η3 αριθμός σε el-GR με μονάδα");
  ok(g.FV({ k: "soil_depth_divergence", d: { value: 1.08, metadata: { unit: "% κ.ό.", text: "Διαφορά υγρασίας ρηχού-βαθέος: 1,1 μονάδες (24,6 % στα 10 cm έναντι 23,5 % στα 30 cm). Ομοιόμορφη διαβροχή." } } }) === "ρηχό 24,6 % · βαθύ 23,5 %", "Η4 ρηχό/βαθύ αντί για «1.08»");
  ok(g.FV({ k: "soil_depth_divergence", d: { value: 1.08, metadata: { unit: "% κ.ό." } } }) === "1,08 % κ.ό.", "Η5 χωρίς κείμενο (κομμένο από BUNDLE-FIT) -> αριθμός με μονάδα");
  ok(g.FV({ k: "x", d: { value: "Εντάξει", metadata: {} } }) === "Εντάξει", "Η6 κείμενο αυτούσιο");
  const tOld = Math.floor(Date.now() / 6e4) - 20 * 60;
  ok(g.AG({ _s: 1, _t: tOld }) === " · ⏱ πριν 20ω", "Θ1 ημερήσια κρίση χωρίς κείμενο -> ⏱ πριν 20ω");
  ok(g.AG({ _s: 1, _t: tOld, text: "έχει κείμενο" }) === "" && g.AG({ _t: tOld }) === "" && g.AG({ _s: 1 }) === "" && g.AG(null) === "", "Θ2 με κείμενο (το βάζει ο πυρήνας) / χωρίς σφραγίδα / χωρίς σημαία -> τίποτα");
  ok(g.AG({ _s: 1, _t: Math.floor(Date.now() / 6e4) - 3 * 24 * 60 }) === " · ⏱ πριν 3ημ", "Θ3 ημέρες πάνω από 48 ω");
  return f;
}

const base = run(C, W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["C1 παλιά έκδοση", "'v50.156 · 2026-09-24'", "'v50.154 · 2026-09-24'", "c"],
  ["C2 πάντα ρηχό", "const _eceW = (_eceChain2 !== null && (_eceChain === null || _eceChain2 > _eceChain))", "const _eceW = (false)", "c"],
  ["C3 διαβάζει βαθύ και σε lse01", "const _eceChain2 = (e2 === null || !_ecNum1) ? null", "const _eceChain2 = (e2 === null) ? null", "c"],
  ["C4 Ks από ρηχό", "const _eceNow = _eceW.v;", "const _eceNow = _eceEst(e1);", "c"],
  ["C5 παλιά πρόγνωση με οδηγίες ετικετών", "if (fcs && Number.isFinite(fcs.ageH) && fcs.ageH > _SAG_FORECAST_MAX_AGE_H) {", "if (false) {", "c"],
  ["C6 καλυμμένη σε πορτοκαλί", "metadata: { color: (s === 'station' || covered) ? 'green' : 'orange',", "metadata: { color: s === 'station' ? 'green' : 'orange',", "c"],
  ["C7 η σημαία covered δεν περνά", "..._sagMetSourceIndicators(measurements?.data, !!fieldConfig?.covered_cultivation),", "..._sagMetSourceIndicators(measurements?.data),", "c"],
  ["C8 μύκητες πριν τον βρόχο", "  if (!_ihFrozen) { const _c = indicators.filter(", "  if (false) { const _c = indicators.filter(", "c"],
  ["C9 Topt αλλαγμένο", "opt: peak - 3, max: optMax + 5, src: 'optimal_temp_range'", "opt: peak, max: optMax + 5, src: 'optimal_temp_range'", "c"],
  ["W1 «Εντάξει» ορίων ξαναφαίνεται", '.filter(x=>!(x.k==="soil_moisture_limits_status"&&String(x.d.value)==="Εντάξει"))', "", "w"],
  ["W2 πορτοκαλί μπαίνει στην ομάδα", "const OKR=RW.filter(x=>OKK[x.k]&&!AC(CO(x)));", "const OKR=RW.filter(x=>OKK[x.k]);", "w"],
  ["W3 αριθμοί με τελεία", 'return v.toLocaleString("el-GR",{maximumFractionDigits:2})+(md.unit?" "+md.unit:"")', 'return String(v)+(md.unit?" "+md.unit:"")', "w"],
  ["W4 ⏱ και πάνω σε κείμενο", "if(md&&md._s===1&&!md.text&&Number.isFinite(Number(md._t)))", "if(md&&md._s===1&&Number.isFinite(Number(md._t)))", "w"],
  ["W5 ρηχό/βαθύ χάνεται", 'if(m)return "ρηχό "+m[1]+" % · βαθύ "+m[3]+" %"', 'if(false)return ""', "w"],
];
let k = 0;
for (const [n, a, b, which] of MUT) {
  const src = which === "w" ? W : C;
  if (!src.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  const m = src.replace(a, b);
  let r; try { r = run(which === "c" ? m : C, which === "w" ? m : W); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
