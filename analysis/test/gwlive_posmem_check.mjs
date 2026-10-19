/* T-GWID-02 (19/10/2026) — ΕΛΕΓΧΟΣ: η gatewayLiveness θυμάται τη θέση κάθε gateway.
 * Τρέχει ΟΛΟΚΛΗΡΗ την analysis με ψεύτικο fetch. Σενάρια: (Α) πρώτη φορά, κενή μνήμη → σπορά από παλιά gateway_row·
 * (Β) αισθητήρας στέλνει lrrid ΧΩΡΙΣ lrrlat → η κάρτα κρατά θέση από μνήμη· (Γ) νέα θέση από το δίκτυο → ενημερώνει μνήμη.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
const SRC = readFileSync(new URL("../gatewayLiveness.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const OV = "6a98855ca06e41000bfae024";
async function runOnce(src, { scanState, oldRows, sensorRows }) {
  const posted = [];
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    const ok = (result) => ({ json: async () => ({ status: true, result }) });
    if (opts.method === "POST") { posted.push(...JSON.parse(opts.body)); return ok("ok"); }
    if (u.includes("filter[network]")) return ok([{ id: "s1", name: "sensor1", last_input: new Date().toISOString() }]);
    if (u.includes("filter[tags]")) return ok([]);
    if (u.includes(`/device/${OV}/data?variables[]=gateway_scan_state`)) return ok(scanState ? [scanState] : []);
    if (u.includes(`/device/${OV}/data?variables[]=gateway_row`)) return ok(oldRows || []);
    if (u.includes("/device/s1/data")) return ok(sensorRows);
    return ok([]);
  };
  const logs = [];
  const sb = { fetch, process: { env: { T_ANALYSIS_TOKEN: "x" } }, console: { log: (m) => logs.push(m) }, Date, Map, Promise, JSON, Number, String, Array, Object, Math, Infinity };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  for (let i = 0; i < 50 && !logs.some((l) => /ΤΕΛΟΣ/.test(l)); i++) await new Promise((r) => setTimeout(r, 10));
  return { posted, logs };
}
const now = new Date().toISOString();
const rowsNoPos = [{ variable: "lrrid", value: "10006847", time: now }];
const rowsPos = [{ variable: "lrrid", value: "10006847", time: now }, { variable: "lrrlat", value: 35.1, time: now }, { variable: "lrrlon", value: 25.2, time: now }];
async function scenarios(src) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  const card = (p) => (p.find((x) => x.variable === "gateway_row" && x.value === "10006847") || {}).metadata || {};
  const mem = (p) => ((p.find((x) => x.variable === "gateway_scan_state") || {}).metadata || {}).pos || {};
  // Α: κενή μνήμη, παλιά κάρτα με θέση, αισθητήρας χωρίς lrrlat
  let r = await runOnce(src, { scanState: { metadata: { ids: "s1", cursor: 0 } }, oldRows: [{ value: "10006847", metadata: { location: { lat: 34.994354, lng: 24.871716 } } }], sensorRows: rowsNoPos });
  want("Α1 σπορά από παλιά κάρτα → η θέση ΔΕΝ χάνεται", card(r.posted).location, { lat: 34.994354, lng: 24.871716 });
  want("Α2 η θέση αποθηκεύεται στη μνήμη", mem(r.posted)["10006847"], { lat: 34.994354, lon: 24.871716 });
  // Β: μνήμη υπάρχει, αισθητήρας χωρίς lrrlat
  r = await runOnce(src, { scanState: { metadata: { ids: "s1", cursor: 0, pos: { "10006847": { lat: 34.99, lon: 24.87 } } } }, sensorRows: rowsNoPos });
  want("Β1 θέση από μνήμη", card(r.posted).location, { lat: 34.99, lng: 24.87 });
  // Γ: νέα θέση από δίκτυο ενημερώνει μνήμη
  r = await runOnce(src, { scanState: { metadata: { ids: "s1", cursor: 0, pos: { "10006847": { lat: 1, lon: 1 } } } }, sensorRows: rowsPos });
  want("Γ1 η θέση του δικτύου υπερισχύει", card(r.posted).location, { lat: 35.1, lng: 25.2 });
  want("Γ2 η μνήμη ενημερώνεται", mem(r.posted)["10006847"], { lat: 35.1, lon: 25.2 });
  return bad;
}
const base = await scenarios(SRC);
console.log(base.length ? "✗ " + base.join("\n✗ ") : "ΒΑΣΗ ✓");
const MUT = [
  ["χωρίς χρήση μνήμης", "else if (pos[id]) { g.lat = pos[id].lat; g.lon = pos[id].lon; g.posMem = true; }", ""],
  ["η μνήμη δεν αποθηκεύεται", "cursor, pos,", "cursor,"],
  ["χωρίς σπορά", "if (!Object.keys(pos).length) {", "if (false) {"],
  ["η μνήμη δεν ενημερώνεται", "if (g.lat != null && g.lon != null) pos[id] = { lat: Number(g.lat), lon: Number(g.lon) };\n    else if", "if (false) {}\n    else if"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); continue; }
  const r = await scenarios(SRC.replace(a, b));
  if (r.length) { k++; console.log("✓ σκοτώθηκε «" + n + "» ← " + r[0]); } else console.log("✗✗ ΕΠΕΖΗΣΕ «" + n + "»");
}
console.log(`μεταλλάξεις ${k}/${MUT.length}`);
process.exit(base.length === 0 && k === MUT.length ? 0 : 1);
