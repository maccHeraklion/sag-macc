// Ελεγκτής · T-METER-FORM-01 (φόρμα v20) + T-METER-W-01 / T-METHODCARD-W-01 (widget) + T-METHODCARD-02 (πυρήνας v50.154).
// Καλωδίωση στα τρία αρχεία + λειτουργικός έλεγχος του αναγνώστη της κάρτας μεθόδου (πραγματικός κώδικας του widget).
// Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const F = fs.readFileSync(path.join(here, "..", "..", "custom_html_files", "configuration.html"), "utf8");
const C = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8").replace(/\r\n/g, "\n");
if (W.includes("\r\n") || F.includes("\r\n")) throw new Error("widget/φόρμα πρέπει να είναι LF");

function buildReader(src) {
  const a = src.indexOf('const _mc9=(TB.field_method_card'); const b = src.indexOf('if(TB.gdd_crop_status||TB.infection_model_status)TR.push', a);
  if (a < 0 || b < 0) throw new Error("αναγνώστης κάρτας δεν βρέθηκε");
  return new Function("TB", "TR", "TL", src.slice(a, b) + "\nreturn TR;");
}
function run(w, f, c) {
  const x = []; const ok = (cond, m) => { if (!cond) x.push(m); };
  // ── φόρμα ──
  ok(f.includes('<select id="has_water_meter">') && f.includes('<option value="false">Όχι — χωρίς υδρόμετρο</option>'), "φόρμα: πεδίο has_water_meter με προεπιλογή Όχι");
  ok(f.includes("has_water_meter: $('has_water_meter').value === 'true',"), "φόρμα: συλλογή");
  ok(f.includes("$('has_water_meter').value = String(conf.has_water_meter) === 'true' ? 'true' : 'false';"), "φόρμα: φόρτωση (κενό = Όχι)");
  ok(f.includes("'covered_cultivation','has_water_meter',"), "φόρμα: παρακολούθηση αλλαγών");
  // ── widget · μετρητής ──
  ok(w.includes("sagMeterBox={v:!1},sagMeterSet=z=>{sagMeterBox.v=!!z}"), "widget: σημαία υδρομέτρου, προεπιλογή ΟΧΙ");
  ok(w.includes('sagMeterSet(!!(p&&String(p.has_water_meter)==="true"))') && w.includes('sagMeterSet(!!(o&&String(o.has_water_meter)==="true"))'), "widget: η σημαία διαβάζεται από το configuration (2 σημεία)");
  ok(w.includes("x.meter1M3=sagMeterBox.v?M*C:null") && w.includes("x.meter2M3=sagMeterBox.v?M*C:null"), "widget: m³ μόνο με υδρόμετρο");
  ok(w.includes('children:sagMeterBox.v?"Μετρητής νερού 1":"Μετρητής 1 — χωρίς υδρόμετρο"'), "widget: τίτλος κάρτας δηλώνει «χωρίς υδρόμετρο»");
  ok(w.includes('label:s.label.replace("🚰 Μετρητής νερού","🔢 Παλμοί ελεγκτή (χωρίς υδρόμετρο)"),defaultUnit:"pulse"'), "widget: διάγραμμα παλμών σε παλμούς, όχι m³");
  ok(!/x\.meter1M3=M\*C;/.test(w), "widget: η παλιά άνευ όρων μετατροπή έφυγε");
  // ── widget · κάρτα μεθόδου ──
  let R; try { R = buildReader(w); } catch (e) { x.push("εξαγωγή: " + e.message); return x; }
  const TL = { soil_depth_basis: "Βάθη μέτρησης υγρασίας", et0_inputs_basis: "Είσοδοι ζήτησης νερού", met_reference_source: "Πηγή θερμοκρασιών αναφοράς", crop_stage: "Υδατικό στάδιο (FAO-56)" };
  const TB = { field_method_card: { value: 3, metadata: { text: "soil_depth_basis: Δύο βάθη 10+30 cm.\nmet_reference_source: Οι θερμοκρασίες από τον σταθμό.\ncucumber/crop_stage: ΥΔΑΤΙΚΟ στάδιο FAO-56 — όχι φαινολογία.\nχωρίς άνω-κάτω" } } };
  const TR = [{ k: "soil_depth_basis", d: { value: "Δύο βάθη", metadata: { _m: 1 } } }];
  const out = R(TB, TR, TL);
  ok(out[0].k === "soil_depth_basis" && out[0].d.metadata.text === "Δύο βάθη 10+30 cm." && out[0].d.metadata._m === 1, "Α1 το κείμενο μεθόδου κολλά στη γραμμή που ήδη υπάρχει");
  const met = out.find(r => r.k === "mc:met_reference_source");
  ok(met && met.d.value === "Πηγή θερμοκρασιών αναφοράς" && met.d.metadata.text === "Οι θερμοκρασίες από τον σταθμό." && met.mcLabel === "Μέθοδος (ημερήσια κάρτα)", "Α2 νέα γραμμή με ετικέτα από TL");
  const cs = out.find(r => r.k === "mc:cucumber/crop_stage");
  ok(cs && cs.d.value === "cucumber · Υδατικό στάδιο (FAO-56)" && /φαινολογία/.test(cs.d.metadata.text), "Α3 γραμμή ανά καλλιέργεια με πρόθεμα");
  ok(out.length === 3, "Α4 η γραμμή χωρίς «:» αγνοείται (" + out.length + ")");
  ok(R({}, [{ k: "a", d: { value: 1 } }], TL).length === 1, "Α5 χωρίς κάρτα: τίποτα δεν αλλάζει");
  ok(w.includes('children:TL[x.k]||x.mcLabel||x.k}'), "widget: η ετικέτα της γραμμής δέχεται τις νέες γραμμές");
  // ── πυρήνας ──
  ok(c.includes("const SAG_KERNEL_VERSION = 'v50.155 · 2026-09-24';"), "πυρήνας v50.154");
  ok(c.includes("_daily.push({ variable: 'field_bundle_2', value: _SAG_METHOD_CARD.n,") && c.includes("shared: { field_method_card: { value: _SAG_METHOD_CARD.n,"), "πυρήνας: field_bundle_2 → shared.field_method_card");
  ok(!/field_bundle_2'[\s\S]{0,300}compression/.test(c), "πυρήνας: το field_bundle_2 γράφεται ΧΩΡΙΣ συμπίεση (το widget το περνά αυτούσιο)");
  const i1 = c.indexOf("_daily.push({ variable: 'field_method_card'"), i2 = c.indexOf("_daily.push({ variable: 'field_bundle_2'");
  ok(i1 > 0 && i2 > i1 && i2 - i1 < 1200, "πυρήνας: γράφεται δίπλα στην ημερήσια κάρτα (ίδιο μπλοκ, μία φορά την ημέρα)");
  return x;
}
const base = run(W, F, C);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["W1 σημαία προεπιλογή ΝΑΙ", "sagMeterBox={v:!1}", "sagMeterBox={v:!0}", "w"],
  ["W2 m³ χωρίς όρο", "x.meter1M3=sagMeterBox.v?M*C:null", "x.meter1M3=M*C", "w"],
  ["W3 παλμοί ως m³", 'defaultUnit:"pulse",conversions:{pulse:v9=>v9}', 'defaultUnit:"m³",conversions:{pulse:v9=>v9}', "w"],
  ["W4 το κείμενο δεν κολλά στη γραμμή", "const _row=_pre?null:TR.find(x9=>x9.k===_k);", "const _row=null;", "w"],
  ["W5 το πρόθεμα καλλιέργειας χάνεται", '_pre=_sl>=0?_kf.slice(0,_sl)+" · ":""', '_pre=""', "w"],
  ["W6 ετικέτα γραμμής παλιά", "children:TL[x.k]||x.mcLabel||x.k}", "children:TL[x.k]}", "w"],
  ["F1 φόρμα δεν αποθηκεύει", "    has_water_meter: $('has_water_meter').value === 'true',   /* v20 · T-METER-FORM-01 */\n", "", "f"],
  ["F2 φόρμα προεπιλογή ΝΑΙ", "String(conf.has_water_meter) === 'true' ? 'true' : 'false';", "String(conf.has_water_meter) === 'false' ? 'false' : 'true';", "f"],
  ["C1 παλιά έκδοση", "'v50.155 · 2026-09-24'", "'v50.153 · 2026-09-24'", "c"],
  ["C2 bundle_2 δεν γράφεται", "              _daily.push({ variable: 'field_bundle_2', value: _SAG_METHOD_CARD.n, metadata:", "              if (false) _daily.push({ variable: 'field_bundle_2x', value: _SAG_METHOD_CARD.n, metadata:", "c"],
];
let k = 0;
for (const [n, a, b, which] of MUT) {
  const src = which === "w" ? W : which === "f" ? F : C;
  if (!src.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  const m = src.replace(a, b);
  let r; try { r = run(which === "w" ? m : W, which === "f" ? m : F, which === "c" ? m : C); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
