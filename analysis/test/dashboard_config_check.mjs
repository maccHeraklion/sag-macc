// Ελεγκτής T-DASH-AUDIT-01: οι κανόνες ρυθμίσεων ταμπλό (`sagDashRules` της analysis/dashboard_config_audit.js) βρίσκουν
// ΟΛΑ τα λάθη που διορθώθηκαν στις 14/10 πάνω στα ΠΡΑΓΜΑΤΙΚΑ αντίγραφα (deploy/dashboards/backup_2026-10-14/*.json)
// και ΚΑΝΕΝΑ σοβαρό στις διορθωμένες ρυθμίσεις (*.two.json). Εκτελεί τον πραγματικό κώδικα. Κάθε μετάλλαξη σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "dashboard_config_audit.js"), "utf8").replace(/\r\n/g, "\n");
const DIR = path.join(here, "..", "..", "deploy", "dashboards", "backup_2026-10-14");
const DOWNLINK = "68deb0d47a8161000a558867";

function fnText(c, name) {
  const m = c.indexOf("function " + name + "("); if (m < 0) throw new Error("δεν βρέθηκε " + name);
  let d = 0; for (let k = c.indexOf("{", m); k < c.length; k++) { if (c[k] === "{") d++; else if (c[k] === "}") { d--; if (!d) return c.slice(m, k + 1); } }
  throw new Error("άνοιγμα χωρίς κλείσιμο");
}
const files = fs.readdirSync(DIR);
const orig = files.filter(n => /^[0-9a-f]{24}_[0-9a-f]{24}\.json$/.test(n)).map(n => JSON.parse(fs.readFileSync(path.join(DIR, n), "utf8")));
const fixed = files.filter(n => /\.two\.json$/.test(n) && !n.startsWith("69e0aa6654a00e000aa67136")).map(n => JSON.parse(fs.readFileSync(path.join(DIR, n), "utf8")));
// ο πιλότος (Γρινιαράκης) μένει με ΜΙΑ πηγή αγρού — η ζωντανή του ρύθμιση:
const pilot = { data: [
  { qty: 500, origin: "69e0aa6554a00e000aa67124", variables: ["configuration", "field_bundle", "forecast", "field_calendar", "subscription_until", "history_request", "history_data", "soil_ece1", "soil_ece2", "spray_declaration", "inspection_declaration", "declaration_undo", "action_log"] },
  { qty: 500, origin: "69779797803f37000a21342e", timezone: "Europe/Athens", variables: ["soil_moisture1", "soil_temperature1", "conduct_soil1", "soil_moisture2", "soil_temperature2", "conduct_soil2", "fertility_index2", "fertility_index1"] }] };

function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let R; try { R = new Function(fnText(src, "sagDashRules") + "\nreturn sagDashRules;")(); } catch (e) { return ["εξαγωγή: " + e.message]; }
  const W = (o, extra) => Object.assign({ data: o.data, analysis_run: DOWNLINK, display: {} }, extra || {});
  const sev = (fs_) => fs_.filter(x => x.level === "CRITICAL" || x.level === "HIGH");
  ok(orig.length === 42 && fixed.length === 41, "Δ0 αντίγραφα: " + orig.length + " αρχικά, " + fixed.length + " διορθωμένα");
  // Α. οι ΑΡΧΙΚΕΣ ρυθμίσεις: όλες είχαν τουλάχιστον ένα CRITICAL R1 (κανένα ταμπλό δεν είχε action_log/declaration_undo)
  let r1all = 0, dup9 = 0, miss = 0, a1 = 0;
  for (const o of orig) {
    const x = R(W(o));
    if (x.some(y => y.code === "R1" && y.level === "CRITICAL")) r1all++;
    if (x.some(y => y.code === "R1" && /field_calendar: σε 3 πηγές/.test(y.msg))) dup9++;
    if (x.some(y => y.code === "R1" && /field_calendar: λείπει/.test(y.msg))) miss++;
    if (x.some(y => y.code === "R6" && /68769148c134c9000ab65bd1/.test(y.msg))) a1++;
  }
  ok(r1all === 42, "Α1 και τα 42 αρχικά ταμπλό έχουν CRITICAL R1 (" + r1all + ")");
  ok(dup9 === 26, "Α2 26 ταμπλό με το ημερολόγιο σε 3 πηγές — το ×9 (" + dup9 + ")");
  ok(miss === 15, "Α3 15 ταμπλό χωρίς ημερολόγιο (" + miss + ")");
  ok(a1 === 4, "Α4 4 ταμπλό με bucket προς τον αγρό Α1 (" + a1 + ")");
  // Β. οι ΔΙΟΡΘΩΜΕΝΕΣ: κανένα CRITICAL/HIGH
  let bad = 0; const bads = [];
  for (const o of fixed) { const s = sev(R(W(o))); if (s.length) { bad++; bads.push((o.label || o.dashboard) + ": " + s.map(y => y.code).join(",")); } }
  ok(bad === 0, "Β1 οι 41 διορθωμένες χωρίς σοβαρό εύρημα (" + bads.slice(0, 3).join(" | ") + ")");
  ok(sev(R(W(pilot))).length === 0, "Β2 ο πιλότος (μία πηγή αγρού) καθαρός");
  // Γ. συνθετικές περιπτώσεις για τους κανόνες που δεν καλύπτουν τα αντίγραφα
  const ctl = fixed.find(o => o.data.some(e => (e.variables || []).includes("valve_1_command")));
  ok(ctl && R(W(ctl, { analysis_run: "" })).some(y => y.code === "R4" && y.level === "CRITICAL"), "Γ1 ελεγκτής χωρίς UC511_downlink → CRITICAL R4");
  ok(ctl && !R(W(ctl)).some(y => y.code === "R4"), "Γ2 ελεγκτής με UC511_downlink → όχι R4");
  const noCtl = fixed.find(o => !o.data.some(e => (e.variables || []).some(v => /valve_|rule\d+_set/.test(v))));
  ok(noCtl && !R(W(noCtl, { analysis_run: "" })).some(y => y.code === "R4"), "Γ3 χωρίς ελεγκτή, κενό analysis_run → όχι R4");
  ok(R(W(pilot, { display: { variables: [{ variable: "x", origin: { id: "a", bucket: "a" } }, { variable: "y", origin: "b" }] } })).some(y => y.code === "R5" && /^1 /.test(y.msg)), "Γ4 παλιά μορφή display → R5 (μετρά 1)");
  ok(R(W(pilot, { display: { parameters: [{ key: "device_map", value: JSON.stringify({ "69779797803f37000a21342e": "Έδαφος" }) }] } })).every(y => y.code !== "R7"), "Γ5 πλήρες device_map → όχι R7");
  ok(R(W(pilot)).some(y => y.code === "R7"), "Γ6 χωρίς device_map → R7");
  const dupSensor = { data: pilot.data.concat([{ qty: 500, origin: "69779797803f37000a21342e", variables: ["soil_moisture1"] }]) };
  ok(R(W(dupSensor)).some(y => y.code === "R2" && /soil_moisture1/.test(y.msg)), "Γ7 ίδια μεταβλητή αισθητήρα σε 2 πηγές → R2");
  ok(R(W({ data: [] })).some(y => y.code === "R3"), "Γ8 χωρίς field_bundle → R3");
  for (const v of ["field_calendar", "spray_declaration", "inspection_declaration", "declaration_undo", "action_log"]) {
    const one = { data: [Object.assign({}, pilot.data[0], { variables: pilot.data[0].variables.filter(x => x !== v) }), pilot.data[1]] };
    ok(R(W(one)).some(y => y.code === "R1" && y.level === "CRITICAL" && y.msg.startsWith(v + ": λείπει")), "Γ9 λείπει μόνο το " + v + " → CRITICAL R1");
  }
  // Δ. R8 — σειρά καρτελών (Αμμουδάρες 16/10: 5 καρτέλες → «Παραμετροποίηση» άνοιγε την Άρδευση)
  let T; try { T = new Function(fnText(src, "sagTabRules") + "\nreturn sagTabRules;")(); } catch (e) { f.push("εξαγωγή R8: " + e.message); return f; }
  const TABS = JSON.parse(fs.readFileSync(path.join(here, "..", "..", "deploy", "backup", "dashboard-widgets", "Ammoudares_and_template_2026-10-19.json"), "utf8"));
  ok(T(TABS.tabs_6_standard).length === 0, "Δ1 6 κανονικές καρτέλες → όχι R8");
  ok(T(TABS.ammoudares.tabs_BEFORE).some(y => y.code === "R8" && /θέσης 3/.test(y.msg)), "Δ2 οι 5 καρτέλες των Αμμουδάρων (πριν) → R8 στη θέση 3");
  ok(T(undefined).length === 3, "Δ3 χωρίς καρτέλες → R8 και στις 3 θέσεις");
  // οι θέσεις του κανόνα ΤΑΙΡΙΑΖΟΥΝ με τους δείκτες του ζωντανού widget — αν αλλάξει το widget, ο έλεγχος σπάει εδώ
  const WJS = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
  const m = WJS.match(/ys=\{bpi:0,stress:0,patho:(\d+),irrig:(\d+),config:(\d+)\}/);
  const wantPos = [...src.matchAll(/(\d): "(e7Z8F5mLs6bacwGDxPc-o|XpOV787fvpT8I0gKHfM3H|zpQzGb2h_PUwgEOzWb79Q)"/g)].map(x => x[2] + "@" + x[1]).sort().join(",");
  ok(m && wantPos === ["XpOV787fvpT8I0gKHfM3H@" + m[3], "e7Z8F5mLs6bacwGDxPc-o@" + m[1], "zpQzGb2h_PUwgEOzWb79Q@" + m[2]].sort().join(","), "Δ4 θέσεις R8 = δείκτες widget (" + (m && m.slice(1).join("/")) + " ↔ " + wantPos + ")");
  // Ε. R9 — καρτέλες βανών με ξένους ελεγκτές (Αμμουδάρες 16/10: uc511_0458/0817 από το πρότυπο)
  let V; try { V = new Function(fnText(src, "sagValveTabRules") + "\nreturn sagValveTabRules;")(); } catch (e) { f.push("εξαγωγή R9: " + e.message); return f; }
  const ammSag = { data: [{ origin: "6ad202ac174a0b000cf10008", variables: ["field_bundle"] }, { origin: "6891d4a12e379b000a0cdf6f", variables: ["soil_moisture1"] }] };
  const ammValve = [{ display: { url: "x/html_files/valvesControl.html" }, data: TABS.ammoudares.widget_irrigation_6ad202ac5a0327000c98a2b3_data_BEFORE }];
  const r9 = V(ammSag, ammValve);
  ok(r9.length === 1 && r9[0].code === "R9" && r9[0].level === "CRITICAL" && /^οι καρτέλες βανών δείχνουν 2 /.test(r9[0].msg), "Ε1 Αμμουδάρες (πριν): 2 ξένοι ελεγκτές → ΕΝΑ CRITICAL R9 (" + (r9[0] && r9[0].msg) + ")");
  ok(V(ammSag, [{ display: {}, data: TABS.ammoudares.widget_rules_6ad202ac5a0327000c98a2b1_data_BEFORE }]).some(y => y.code === "R9"), "Ε6 ξένος ελεγκτής ΜΟΝΟ στην καρτέλα κανόνων (rule1) → R9");
  ok(V(ammSag, [{ display: {}, data: [{ origin: "67fdf9f10c797f000a7b6d09", variables: ["air_temperature", "rain_gauge"] }] }]).length === 0, "Ε5 σταθμός/αισθητήρας σε καρτέλα βανών (Volta, ΙΔΕ) → όχι R9");
  ok(V(ammSag, [{ display: {}, data: [] }]).length === 0, "Ε2 Αμμουδάρες (μετά, κενές καρτέλες) → όχι R9");
  const ownSag = { data: [{ origin: "684c444dcc1cd8000a0f2b21", variables: ["valve_1", "valve_1_command"] }] };
  ok(V(ownSag, [{ display: {}, data: [{ origin: "684c444dcc1cd8000a0f2b21", variables: ["valve_1"] }] }]).length === 0, "Ε3 ο δικός του ελεγκτής → όχι R9");
  ok(V({ data: [{ origin: "684c376d508354000ae0bdf2", variables: ["rule1_set"] }] }, [{ display: {}, data: [{ origin: "684c376d508354000ae0bdf2", variables: ["rule1"] }] }]).length === 0, "Ε4 ελεγκτής μόνο με κανόνες → όχι R9");
  return f;
}
const base = run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 χωρίς έλεγχο «λείπει»", 'if (n === 0) add("CRITICAL", "R1"', 'if (false) add("CRITICAL", "R1"'],
  ["m2 χωρίς έλεγχο διπλών R1", 'else if (n > 1) add("CRITICAL", "R1"', 'else if (false) add("CRITICAL", "R1"'],
  ["m3 χωρίς R4", "if (hasCtl && widget.analysis_run !== DOWNLINK)", "if (false)"],
  ["m4 R4 χωρίς ελεγκτή", "if (hasCtl && widget.analysis_run !== DOWNLINK)", "if (widget.analysis_run !== DOWNLINK)"],
  ["m5 λάθος analysis", 'const DOWNLINK = "68deb0d47a8161000a558867";', 'const DOWNLINK = "000000000000000000000000";'],
  ["m6 χωρίς R6", "if (e.bucket && e.bucket !== e.origin)", "if (false)"],
  ["m7 χωρίς R2", "for (const [k, n] of Object.entries(seen)) if (n > 1) {", "for (const [k, n] of Object.entries(seen)) if (false) {"],
  ["m8 λίστα χωρίς action_log", '"declaration_undo", "action_log"];', '"declaration_undo"];'],
  ["m9 χωρίς R5", "if (legacy) add(", "if (false) add("],
  ["m10 χωρίς R3", 'if (fieldEntries.length !== 1) add("CRITICAL", "R3"', 'if (false) add("CRITICAL", "R3"'],
  ["m11 χωρίς R8", "for (const [i, k] of Object.entries(WANT)) if (keys[+i] !== k)", "for (const [i, k] of Object.entries(WANT)) if (false)"],
  ["m12 R8 λάθος θέση Παραμετροποίησης", '3: "XpOV787fvpT8I0gKHfM3H"', '2: "XpOV787fvpT8I0gKHfM3H"'],
  ["m13 χωρίς R9", "if (e.origin && isCtl(e) && !own.has(e.origin))", "if (false)"],
  ["m15 R9 μετρά και αισθητήρες", "if (e.origin && isCtl(e) && !own.has(e.origin))", "if (e.origin && !own.has(e.origin))"],
  ["m14 R9 αγνοεί τους κανόνες", "rule\\d+(_set|_enable)?)$/.test(v));\n  const own", "zzz)$/.test(v));\n  const own"],
];
let killed = 0;
for (const [n, a, b] of MUT) {
  const cnt = SRC.split(a).length - 1;
  if (cnt !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + n + " (" + cnt + ")"); continue; }
  const r = run(SRC.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + n + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
