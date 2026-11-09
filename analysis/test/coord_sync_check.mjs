/* T-COORD-SYNC-01 (9/11/2026) — ΕΛΕΓΧΟΣ: η αποθήκευση της φόρμας ξαναγράφει την ετικέτα coordinates του αγρού (μία τιμή),
   δεν την αγγίζει χωρίς έγκυρη θέση, και δεν πειράζει καμία άλλη ετικέτα. Τρέχει την πραγματική runSync με ψεύτικο SDK. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const SRC0 = readFileSync(fileURLToPath(new URL("../setFieldParametersFromDeviceData.js", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
async function runCase(src, tags, cfg) {
  const edits = [];
  class Account { constructor() { this.devices = { info: async () => ({ id: "F1", tags: JSON.parse(JSON.stringify(tags)) }), edit: async (id, b) => { edits.push(b.tags); } }; } }
  class Device { async getData() { return []; } async sendData() {} }
  const sdk = { Account, Device, Utils: { getTokenByName: async () => "tok" }, Analysis: { use() {} } };
  const mod = { exports: {} };
  const fn = new Function("require", "module", "exports", "console", src + "\n;return { runSync };");
  const { runSync } = fn((m) => (m === "@tago-io/sdk" ? sdk : {}), mod, mod.exports, { log() {} });
  const ctx = { environment: [{ key: "ACCOUNT_TOKEN", value: "x" }], log() {}, device: "F1" };
  const res = await runSync(ctx, [{ variable: "configuration", device: "F1", value: JSON.stringify(cfg) }], { device: null });
  return { res, tags: edits[edits.length - 1] || null };
}
const CFG = (lat, lon) => ({ latitude: lat, longitude: lon, soil_type: "loam", crops: [{ cultivation_type_general: "olive", cultivation_type: "koroneiki" }] });
const BASE = [{ key: "isField", value: "yes" }, { key: "name", value: "Αγρός" }, { key: "coordinates", value: "35.0, 25.0" }, { key: "devices", value: "{}" }];
async function check(src) {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); };
  try {
    let r = await runCase(src, BASE, CFG(35.3412345, 25.1234567));
    const co = (r.tags || []).filter((t) => t.key === "coordinates");
    ok(co.length === 1 && co[0].value === "35.341234, 25.123457", "Α1 νέα θέση στην ετικέτα (" + JSON.stringify(co) + ")");
    ok((r.tags || []).some((t) => t.key === "devices") && (r.tags || []).some((t) => t.key === "name" && t.value === "Αγρός"), "Α2 οι άλλες ετικέτες μένουν");
    r = await runCase(src, BASE.concat([{ key: "coordinates", value: "40.1, 22.1" }]), CFG(35.2, 25.3));
    ok((r.tags || []).filter((t) => t.key === "coordinates").length === 1, "Α3 διπλή ετικέτα γίνεται μία");
    r = await runCase(src, BASE, CFG(null, null));
    const c2 = (r.tags || []).filter((t) => t.key === "coordinates");
    ok(c2.length === 1 && c2[0].value === "35.0, 25.0", "Α4 χωρίς θέση στη φόρμα: η ετικέτα μένει (" + JSON.stringify(c2) + ")");
    r = await runCase(src, BASE, CFG(51.5, -0.1));
    ok(((r.tags || []).find((t) => t.key === "coordinates") || {}).value === "35.0, 25.0", "Α5 θέση εκτός Ελλάδας αγνοείται");
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const r = await check(SRC0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ θέση αγρού από τη φόρμα");
const MUT = [
  ["if (!(_old.length === 1 && _old[0] === _val)) {", "if (false) {"],
  ["for (let _i = newTags.length - 1; _i >= 0; _i--) if (newTags[_i].key === \"coordinates\") newTags.splice(_i, 1);", ""],
  ["&& _lat >= 33.5 && _lat <= 42.5 && _lon >= 19 && _lon <= 30.5", ""],
  ["const _val = _lat.toFixed(6) + \", \" + _lon.toFixed(6);", "const _val = _lat + \", \" + _lon;"],
];
let k = 0; for (const [a, b] of MUT) { if (!SRC0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } const x = await check(SRC0.replace(a, b)); if (x.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
