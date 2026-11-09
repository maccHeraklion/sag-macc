// Ελεγκτής T-WETHALF-01 (v50.194, 9/11/2026, απόφαση Μιχάλη 7/11): η υγρή ώρα κρίνεται από την πλειοψηφία των δειγμάτων.
// Τρέχει την ΠΡΑΓΜΑΤΙΚΗ _sagLeafHourRead του πυρήνα με ψεύτικη συσκευή και ελέγχει τον «άνω διάμεσο» (θέση ceil(n/2), φθίνουσα):
// είναι πάνω από το όριο υγρού (15 %) ΑΝ ΚΑΙ ΜΟΝΟ ΑΝ τουλάχιστον τα μισά δείγματα το ξεπερνούν. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const SRC = fs.readFileSync(corePath, "utf8").replace(/\r\n/g, "\n");
const req = createRequire(corePath);
function loadCore(src) {
  const shimReq = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const tail = "\nreturn { _sagLeafHourRead, SAG_KERNEL_VERSION };";
  const mod = { exports: {} };
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
}
const NOW = "2026-11-09T21:21:00.000Z";
async function read(K, vals) {
  const end = Date.parse(NOW);
  const rows = vals.map((v, i) => ({ value: v, time: new Date(end - (5 + i * 20) * 60000).toISOString() }));
  const dev = { getData: async () => rows };
  const dd = {}; await K._sagLeafHourRead(dev, dd, NOW, "T");
  const m = dd.leaf_moisture_hour_med && dd.leaf_moisture_hour_med[0];
  return { med: m ? m.value : null, n: m ? m.metadata.n : null, wet: m ? m.metadata.wet : null, max: dd.leaf_moisture_hour_max ? dd.leaf_moisture_hour_max[0].value : null };
}
async function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = loadCore(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  try {
    ok(K.SAG_KERNEL_VERSION === "v50.194 · 2026-11-09", "Ε έκδοση (" + K.SAG_KERNEL_VERSION + ")");
    const cases = [
      ["W1 1 υγρό από 3: στεγνή ώρα", [60, 8, 5], 8, 1],
      ["W2 2 υγρά από 3: υγρή ώρα", [60, 40, 5], 40, 2],
      ["W3 1 υγρό από 2 (τα μισά): υγρή", [5, 60], 60, 1],
      ["W4 1 δείγμα: αυτό", [5], 5, 0],
      ["W5 2 υγρά από 4: υγρή", [10, 50, 5, 60], 50, 2],
      ["W6 1 υγρό από 4: στεγνή", [10, 5, 60, 4], 10, 1],
      ["W7 εκτός ορίων αγνοείται", [120, 60, 5, 4], 5, 1],
    ];
    for (const [name, vals, med, wet] of cases) {
      const r = await read(K, vals);
      ok(r.med === med && r.wet === wet, name + " (" + JSON.stringify(r) + ")");
    }
    const r8 = await read(K, [60, 8, 5]);
    ok(r8.max === 60, "W8 το μέγιστο μένει για την κάρτα διαβροχής (" + r8.max + ")");
    const r9 = await read(K, []);
    ok(r9.med === null && r9.max === null, "W9 χωρίς δείγματα: καμία τιμή ώρας");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = await run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const M = [
  ["M1 θέση floor (κάτω διάμεσος)", "const med = vals[Math.ceil(n / 2) - 1];", "const med = vals[Math.floor(n / 2)];"],
  ["M2 μέγιστο", "const med = vals[Math.ceil(n / 2) - 1];", "const med = vals[0];"],
  ["M3 αύξουσα σειρά", "vals.sort((a, b) => b - a);", "vals.sort((a, b) => a - b);"],
  ["M4 χωρίς ταξινόμηση", "vals.sort((a, b) => b - a);", ""],
  ["M5 μέτρηση υγρών ≥", "const nWet = vals.filter((v) => v > _SAG_LWS_WET).length;", "const nWet = vals.filter((v) => v >= 0).length;"],
];
let bad = 0;
for (const [n, a, b] of M) {
  if (SRC.split(a).length !== 2) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ " + n); bad++; continue; }
  const r = await run(SRC.replace(a, b));
  console.log((r.length ? "ΣΚΟΤΩΘΗΚΕ " : "ΕΠΕΖΗΣΕ ") + n); if (!r.length) bad++;
}
console.log(bad ? "ΑΠΟΤΥΧΙΑ μεταλλάξεων: " + bad : "ΜΕΤΑΛΛΑΞΕΙΣ " + M.length + "/" + M.length);
process.exit(bad ? 1 : 0);
