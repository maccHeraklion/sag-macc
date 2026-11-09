/* T-COORD-SYNC-02 (9/11/2026, απόφαση Michalis «η δηλωμένη θέση + σήμα διαφοράς») — ΕΛΕΓΧΟΣ θέσης πυλών:
   (Α) η δηλωμένη θέση (ετικέτα coordinates της πύλης) υπερισχύει της θέσης δικτύου και γράφεται στη μνήμη· (Β) μετακίνηση πύλης =
   αλλαγή ετικέτας → νέα θέση παντού, η παλιά μνήμη αντικαθίσταται· (Γ) διπλή ετικέτα δεν κρίνει· (Δ) διαφορά > 500 m από το ThingPark
   σημαίνεται. Τρέχει ΟΛΟΚΛΗΡΗ την analysis με ψεύτικο fetch και την tpApplyRoster. Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import vm from "node:vm";
const SRC0 = readFileSync(new URL("../gatewayLiveness.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const OV = "6a98855ca06e41000bfae024";
const now = new Date().toISOString();
const gwDev = (coords) => ({ id: "g1", name: "milesight_gw", tags: [{ key: "is_gateway", value: "yes" }, { key: "deployedGateway", value: "yes" }, { key: "network_lrrid", value: "10006847" }, { key: "comment", value: "Θέση Α" }, ...coords.map((c) => ({ key: "coordinates", value: c }))] });
async function runOnce(src, { scanState, sensorRows, gwCoords }) {
  const posted = [];
  const fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const ok = (result) => ({ json: async () => ({ status: true, result }), ok: true, status: 200, text: async () => "{}" });
    if (opts.method === "POST") { posted.push(...JSON.parse(opts.body)); return ok("ok"); }
    if (u.includes("filter[network]")) return ok([{ id: "s1", name: "sensor1", last_input: now }]);
    if (u.includes("is_gateway")) return ok([gwDev(gwCoords)]);
    if (u.includes("filter[tags]")) return ok([]);
    if (u.includes(`/device/${OV}/data?variables[]=gateway_scan_state`)) return ok(scanState ? [scanState] : []);
    if (u.includes("/device/s1/data")) return ok(sensorRows);
    if (u.includes("actility")) return { ok: false, status: 401, json: async () => ({}), text: async () => "" };
    return ok([]);
  };
  const logs = [];
  const sb = { fetch, URLSearchParams, process: { env: { T_ANALYSIS_TOKEN: "x" } }, console: { log: (m) => logs.push(m) }, Date, Map, Set, Promise, JSON, Number, String, Array, Object, Math, Infinity };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  for (let i = 0; i < 80 && !logs.some((l) => /ΤΕΛΟΣ/.test(l)); i++) await new Promise((r) => setTimeout(r, 10));
  return { posted, logs };
}
const rowsPos = [{ variable: "lrrid", value: "10006847", time: now }, { variable: "lrrlat", value: 35.1, time: now }, { variable: "lrrlon", value: 25.2, time: now }];
const rowsNoPos = [{ variable: "lrrid", value: "10006847", time: now }];
async function check(src) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  const card = (p) => (p.find((x) => x.variable === "gateway_row" && x.value === "10006847") || {}).metadata || {};
  const mem = (p) => ((p.find((x) => x.variable === "gateway_scan_state") || {}).metadata || {}).pos || {};
  try {
    let r = await runOnce(src, { scanState: { metadata: { ids: "s1", cursor: 0 } }, sensorRows: rowsPos, gwCoords: ["35.300000, 25.100000"] });
    want("Α1 η δηλωμένη θέση στην κάρτα, όχι του δικτύου", card(r.posted).location, { lat: 35.3, lng: 25.1 });
    want("Α2 η μνήμη κρατά τη δηλωμένη", mem(r.posted)["10006847"], { lat: 35.3, lon: 25.1, decl: 1 });
    r = await runOnce(src, { scanState: { metadata: { ids: "s1", cursor: 0, pos: { "10006847": { lat: 35.3, lon: 25.1, decl: 1 } } } }, sensorRows: rowsNoPos, gwCoords: ["35.050000, 24.900000"] });
    want("Β1 μετακίνηση: νέα δηλωμένη θέση στην κάρτα", card(r.posted).location, { lat: 35.05, lng: 24.9 });
    want("Β2 μετακίνηση: η μνήμη αντικαθίσταται", mem(r.posted)["10006847"], { lat: 35.05, lon: 24.9, decl: 1 });
    r = await runOnce(src, { scanState: { metadata: { ids: "s1", cursor: 0 } }, sensorRows: rowsPos, gwCoords: ["35.300000, 25.100000", "36.000000, 24.000000"] });
    want("Γ1 διπλή ετικέτα: κρατά τη θέση δικτύου", card(r.posted).location, { lat: 35.1, lng: 25.2 });
    // Δ: έλεγχος απόστασης από το ThingPark
    const F = new Function("haversineKm", "TP_POS_DIFF_M", "return " + src.slice(src.indexOf("function tpApplyRoster("), src.indexOf("function tpNetworkRecord(")) + ";");
    const hav = new Function("return " + src.slice(src.indexOf("function haversineKm("), src.indexOf("function truncName(")))();
    const apply = F(hav, 500);
    const ros = [{ lrr: "10006847", lat: 35.3, lng: 25.1 }, { lrr: "1001848B", lat: 35.3397, lng: 25.1623 }];
    const bs = new Map([["10006847", { c: "CNX", la: 35.3, lo: 25.15 }], ["1001848B", { c: "CNX", la: 35.3398, lo: 25.1624 }]]);
    apply(ros, bs);
    want("Δ1 διαφορά ~4,5 km σημαίνεται", ros[0].tp && ros[0].tp.dm > 4000 && ros[0].tp.dm < 5000, true);
    want("Δ2 μικρή διαφορά όχι", ros[1].tp && ros[1].tp.dm, undefined);
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const r = await check(SRC0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ θέση πυλών");
const MUT = [
  ["    pos[k] = { lat: r.lat, lon: r.lng, decl: 1 };\n", ""],
  ["if (!r || !r.lrr || r.lat == null || r.lng == null || r.conflict) continue;", "if (!r || !r.lrr || r.lat == null || r.lng == null) continue;"],
  ["if (g.lat != null && g.lon != null && !(pos[id] && pos[id].decl)) pos[id]", "if (g.lat != null && g.lon != null) pos[id]"],
  ["      if (_d > TP_POS_DIFF_M) r.tp.dm = _d;", "      r.tp.dm = _d;"],
];
let k = 0; for (const [a, b] of MUT) { if (!SRC0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } const x = await check(SRC0.replace(a, b)); if (x.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
