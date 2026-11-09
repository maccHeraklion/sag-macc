/* T-MOVE-01 (10/11/2026) — ΕΛΕΓΧΟΣ μεταφοράς οργάνου σε άλλο αγρό. Τρέχει ΟΛΟΚΛΗΡΕΣ τις addSensorsToField και
   removeSensorFromField με ψεύτικο SDK και ψεύτικο στόλο (3 αγροί, 3 ταμπλό, όργανο σε δύο παλιούς αγρούς, κοινόχρηστος
   σταθμός, ελεγκτής βανών, widget καρτέλας βανών, ετικέτες αποθήκης, αισθητήρας απόφασης στη φόρμα). Κάθε μετάλλαξη πρέπει
   να σκοτωθεί. */
import { readFileSync } from "node:fs";
const ADD0 = readFileSync(new URL("../addSensorsToField.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const REM0 = readFileSync(new URL("../removeSensorFromField.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const clone = (x) => JSON.parse(JSON.stringify(x));
const EUI = { S: "a84041000000000a", H: "2cf7f1000000000b", C: "24e124000000000c", X: "a84041000000000d" };
const AG = (ids, map) => ({ display: { url: "https://x/storage/sagMain/index.html", variables: ids.map((id) => ({ variable: "v", origin: { id, bucket: id } })).concat([{ variable: "field_bundle", origin: { id: "F" } }]), parameters: [{ key: "device_map", value: JSON.stringify(map) }] },
  data: [{ origin: "F", variables: ["field_bundle"] }].concat(ids.map((id) => ({ origin: id, variables: ["v"] }))) });
const CHART = (ids) => ({ display: { url: "" }, data: ids.map((id) => ({ origin: id, variables: ["soil_moisture1"] })) });
const VALVE = (ids) => ({ display: { url: "https://x/storage/valvesControl/index.html" }, data: ids.map((id) => ({ origin: id, variables: ["valve_1"] })) });
function world(over = {}) {
  const dev = (id, type, extra = []) => ({ id, name: `${type}_${id}`, tags: [{ key: "type", value: type }, { key: "eui", value: EUI[id] || "" }, ...extra] });
  const W = {
    devices: {
      FA: { id: "FA", name: "Αγρός Α", tags: [{ key: "isField", value: "yes" }, { key: "fieldId", value: "DA" }, { key: "clientName", value: "Π1" },
        { key: "devices", value: JSON.stringify({ lse02_S: "S", s2120_H: "H", uc511_C: "C", lse01_X: "X" }) }, { key: "configuration", value: JSON.stringify({ soil_ref_device: "S" }) }] },
      FB: { id: "FB", name: "Αγρός Β", tags: [{ key: "isField", value: "yes" }, { key: "fieldId", value: "DB" }, { key: "devices", value: JSON.stringify({ o: "O" }) }] },
      FC: { id: "FC", name: "Αγρός Γ", tags: [{ key: "isField", value: "yes" }, { key: "fieldId", value: "DC" }, { key: "devices", value: JSON.stringify({ lse02_S: "S" }) }] },
      S: dev("S", "lse02", [{ key: "storage", value: "yes" }, { key: "storage_dragino_lse02", value: "yes" }]),
      H: dev("H", "s2120", [{ key: "shared_instrument", value: "yes" }]),
      C: dev("C", "uc511", [{ key: "hw_version", value: "v4" }]),
      X: dev("X", "lse01"),
      O: dev("O", "se0x"),
    },
    dash: {
      DA: { w1: AG(["S", "H", "C", "X"], { S: "Σόνδα", H: "Σταθμός", C: "Βάνα", X: "Χ" }), w2: CHART(["S", "X"]), w3: VALVE(["S", "C"]) },
      DB: { wb: AG(["O"], { O: "Ο" }) },
      DC: { wc: CHART(["S"]) },
    },
    edits: [], sent: [],
  };
  Object.assign(W, over);
  return W;
}
async function run(src, W, scope) {
  class Account {
    constructor() {
      this.devices = {
        info: async (id) => { if (!W.devices[id]) throw new Error("no"); return clone(W.devices[id]); },
        edit: async (id, b) => { W.edits.push(id); W.devices[id].tags = clone(b.tags); },
        list: async ({ page, filter }) => page > 1 ? [] : Object.values(W.devices).filter((d) => d.tags.some((t) => t.key === filter.tags[0].key && t.value === filter.tags[0].value)).map(clone),
        tokenList: async () => [{ token: "t" }],
      };
      this.dashboards = {
        info: async (id) => ({ arrangement: Object.keys(W.dash[id] || {}).map((w) => ({ widget_id: w })) }),
        widgets: { info: async (d, w) => clone(W.dash[d][w]), edit: async (d, w, b) => { W.edits.push(d + "/" + w); W.dash[d][w] = clone(b); } },
      };
    }
  }
  const Resources = { devices: {
    list: async ({ filter }) => Object.values(W.devices).filter((d) => d.tags.some((t) => t.key === "eui" && t.value === filter.tags[0].value)).map(clone),
    sendDeviceData: async (id, d) => { W.sent.push(d); },
  } };
  let fn;
  class Analysis { constructor(f) { fn = f; } }
  class Device { async getData() { return []; } }
  const mod = { exports: {} };
  const logs = [];
  new Function("require", "module", "exports", "console", src)((m) => (m === "@tago-io/sdk" ? { Analysis, Account, Resources, Device } : {}), mod, mod.exports, { log: (m) => logs.push(String(m)) });
  await fn({ environment: [{ key: "ACCOUNT_TOKEN", value: "x" }], log() {} }, scope);
  return logs;
}
const ids = (W, f) => Object.values(JSON.parse(W.devices[f].tags.find((t) => t.key === "devices").value)).sort().join(",");
const origins = (w) => [...new Set((w.data || []).map((d) => d.origin))].sort().join(",");
const addScope = (field, list) => [{ variable: "field", value: field }, { variable: "devicesNum", value: String(list.length) }].concat(list.map((k, i) => ({ variable: `device${i + 1}`, value: EUI[k] })));
async function check(ADD, REM) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  try {
    // Α: μεταφορά S (σε Α και Γ), H (κοινόχρηστο), C (ελεγκτής) στον Β
    let W = world();
    await run(ADD, W, addScope("FB", ["S", "H", "C"]));
    want("Α1 ο Α κρατά H, C, X — όχι S", ids(W, "FA"), "C,H,X");
    want("Α2 ο Γ χάνει το S", ids(W, "FC"), "");
    want("Α3 ο Β έχει όλα", ids(W, "FB"), "C,H,O,S");
    want("Α4 AgroGenius του Α χωρίς S", origins(W.dash.DA.w1), "C,F,H,X");
    want("Α5 device_map του Α χωρίς S", Object.keys(JSON.parse(W.dash.DA.w1.display.parameters[0].value)).sort().join(","), "C,H,X");
    want("Α6 γράφημα του Α χωρίς S (όχι μόνο το AgroGenius)", origins(W.dash.DA.w2), "X");
    want("Α7 widget βανών του Α ΑΘΙΚΤΟ", origins(W.dash.DA.w3), "C,S");
    want("Α8 γράφημα του Γ χωρίς S", origins(W.dash.DC.wc), "");
    want("Α9 S εκτός αποθήκης", W.devices.S.tags.filter((t) => t.key.startsWith("storage")).length, 0);
    want("Α10 ο ελεγκτής δεν γράφτηκε", W.edits.includes("C"), false);
    const msg = W.sent[W.sent.length - 1] || {};
    want("Α11 προειδοποίηση", msg.metadata && msg.metadata.type, "warning");
    want("Α12 μήνυμα: μεταφορά + φόρμα + ελεγκτής + βάνες", ["Μεταφέρθηκαν", "Ελέγξτε τη φόρμα", "Ελεγκτές βανών", "widget βανών", "Κοινόχρηστα"].map((k) => String(msg.value).includes(k)), [true, true, true, true, true]);
    // Δ: προσθήκη στον ΙΔΙΟ αγρό που ήδη το έχει → δεν φεύγει από τον στόχο
    W = world();
    await run(ADD, W, addScope("FA", ["S"]));
    want("Δ1 ο στόχος κρατά το S", ids(W, "FA").includes("S"), true);
    want("Δ2 ο Γ το χάνει", ids(W, "FC"), "");
    // Ε: έλεγχος κοινών — δοκιμή χωρίς εγγραφές, μετά apply
    W = world();
    W.devices.FB.tags.find((t) => t.key === "devices").value = JSON.stringify({ o: "O", s: "H", c: "C" });
    let logs = await run(ADD, W, { shared_audit: true });
    want("Ε1 δοκιμή: καμία εγγραφή", W.edits.length, 0);
    want("Ε2 σύνοψη", (logs.find((l) => l.startsWith("ΚΟΙΝΑ ΟΡΓΑΝΑ")) || "").replace(/\|αγροί=\d+/, ""), "ΚΟΙΝΑ ΟΡΓΑΝΑ|σε ≥2 αγρούς=3|ελεγκτές=1|δηλωμένα=1|χωρίς δήλωση=1|σημάνθηκαν τώρα=0 (ΔΟΚΙΜΗ)");
    logs = await run(ADD, W, [{ shared_audit: true, apply: true }]);
    want("Ε3 apply: μόνο το S σημαίνεται", W.edits, ["S"]);
    want("Ε4 το S είναι πλέον κοινόχρηστο", W.devices.S.tags.some((t) => t.key === "shared_instrument" && t.value === "yes"), true);
    // Ζ: αφαίρεση — όλα τα widget εκτός βανών
    W = world();
    await run(REM, W, [{ variable: "field", value: "FA" }, { variable: "devicesNum", value: "1" }, { variable: "device1", value: EUI.S }]);
    want("Ζ1 ο Α χωρίς S", ids(W, "FA"), "C,H,X");
    want("Ζ2 γράφημα χωρίς S", origins(W.dash.DA.w2), "X");
    want("Ζ3 AgroGenius χωρίς S", origins(W.dash.DA.w1), "C,F,H,X");
    want("Ζ4 βάνες άθικτες", origins(W.dash.DA.w3), "C,S");
    want("Ζ5 ο Γ δεν αγγίχτηκε", ids(W, "FC"), "S");
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const base = await check(ADD0, REM0);
for (const b of base) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(base.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ μεταφορά οργάνου");
const MUT = [
  ["add", "χωρίς εξαίρεση κοινόχρηστου", "else if (isSharedInstrument(d)) rep.shared.push", "else if (false) rep.shared.push"],
  ["add", "χωρίς εξαίρεση ελεγκτή", "if (isController(d)) rep.controllers.push", "if (false) rep.controllers.push"],
  ["add", "αγγίζει widget βανών", "if (VALVE_WIDGET_RE.test(String(widget?.display?.url || \"\"))) {", "if (false) {"],
  ["add", "αφαιρεί και από τον στόχο", "if (!f || String(f.id) === String(targetFieldId)) continue;", "if (!f) continue;"],
  ["add", "μένει στην αποθήκη", "for (const d of _instr) await dropStorageTags(d);", ""],
  ["add", "apply χωρίς άδεια", "if (apply && kind === \"ΧΩΡΙΣ ΔΗΛΩΣΗ\")", "if (kind === \"ΧΩΡΙΣ ΔΗΛΩΣΗ\")"],
  ["add", "χωρίς ειδοποίηση φόρμας", "if (cfg.includes(id)) rep.refs.push", "if (false) rep.refs.push"],
  ["add", "χωρίς αφαίρεση από ταμπλό", "const st = await stripDevicesFromDashboard(tagVal(fi.tags, \"fieldId\"), move);", "const st = { touched: 0, valve: 0 };"],
  ["add", "device_map μένει", "for (const rid of ids) if (rid in map) { delete map[rid]; pruned = true; }", ""],
  ["rem", "αφαίρεση: αγγίζει βάνες", "if (VALVE_WIDGET_RE.test(String(widget?.display?.url || \"\"))) {", "if (false) {"],
  ["rem", "αφαίρεση: μόνο AgroGenius", "if (![...ids].some((id) => refs.includes(id))) continue;", "if (![...ids].some((id) => refs.includes(id)) || !refs.includes(\"field_bundle\")) continue;"],
];
let k = 0;
for (const [f, n, a, b] of MUT) {
  const src = f === "add" ? ADD0 : REM0;
  if (src.split(a).length !== 2) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exitCode = 1; continue; }
  const r = await check(f === "add" ? src.replace(a, b) : ADD0, f === "rem" ? src.replace(a, b) : REM0);
  if (r.length) { k++; console.log("✓ σκοτώθηκε «" + n + "» ← " + r[0].slice(0, 110)); } else { console.log("✗✗ ΕΠΕΖΗΣΕ «" + n + "»"); process.exitCode = 1; }
}
console.log(`μεταλλάξεις ${k}/${MUT.length}`);
if (base.length) process.exitCode = 1;
