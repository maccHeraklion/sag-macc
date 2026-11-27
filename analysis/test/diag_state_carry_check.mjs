// Ελεγκτής T-DIAG-CARRY-01 (v50.196 · 27/11/2026) — η ημερήσια διαγνωστική ΜΕΝΕΙ ημερήσια.
// Ζωντανή μέτρηση 27/11 15:22 (T-READMETER-01): 35 αναγνώσεις «6 μεταβλητών» × ~420 εγγραφές = 14.683 από 16.887 του κύκλου,
// + 735 ερωτήματα «max». Αιτία: η _sagDiagLoad ξαναχτίζει την κατάσταση χωρίς τους δακτυλίους hx/lx (v50.190), και ο κανόνας
// «ανανέωση όταν λείπει το hx» ξαναδιάβαζε 400 δείγματα + 20 ημέρες «max» ΚΑΘΕ ώρα για κάθε S2120/EM300/EM320/LMS01.
// Ο ελεγκτής τρέχει τον ΠΡΑΓΜΑΤΙΚΟ βρόχο getMeasurements δύο φορές (δύο ωριαίοι κύκλοι, όχι ημερήσιος): ο πρώτος με κενή
// κατάσταση, ο δεύτερος με το bundle που έγραψε ο πρώτος. Στον δεύτερο: ΚΑΜΙΑ ανάγνωση 400 δειγμάτων, ΚΑΝΕΝΑ «max»,
// οι δακτύλιοι hx/lx ξαναγράφονται αυτούσιοι, η οροφή υγρασίας και ο κολλημένος αισθητήρας φύλλου βγαίνουν ΙΔΙΑ.
// Ημερήσιος κύκλος (dailyTich) ή κατάσταση > 26 ω → πλήρης ανάγνωση όπως πριν. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, "..", "runPerTich.js");
const rawC = fs.readFileSync(corePath, "utf8");
if (!rawC.includes("\r\n")) throw new Error("ο πυρήνας δεν είναι CRLF");
const SRC = rawC.replace(/\r\n/g, "\n");
const req = createRequire(corePath);
const NOW = Date.now();
function mkSdk(calls, bundleShared) {
  const T = (min) => new Date(NOW - min * 60000).toISOString();
  const DEV = {
    EM1: { info: { id: "EM1", name: "em320_test", tags: [{ key: "type", value: "em320_th" }], last_input: T(5) } },
    LMS1: { info: { id: "LMS1", name: "lms01_test", tags: [{ key: "type", value: "lms01_ls" }], last_input: T(5) } },
  };
  class Device {
    constructor(o) { this.id = String((o && o.token) || ""); }
    async info() { const d = DEV[this.id]; if (!d) throw new Error("no device " + this.id); return d.info; }
    async sendData() { return "ok"; }
    async getData(q) {
      calls.push([this.id, q && q.query, (q && q.variables || []).join(","), q && q.qty]);
      const vars = (q && q.variables) || [];
      if (this.id === "FIELD" || this.id.startsWith("F:")) return bundleShared && vars[0] === "field_bundle" ? [{ variable: "field_bundle", value: "x", time: T(60), metadata: { shared: bundleShared } }] : [];
      if (this.id === "EM1") {
        if (q.query === "max" && vars[0] === "humidity") return [{ variable: "humidity", value: 89.5 }];
        if (q.query && vars[0] === "temperature") return [{ variable: "temperature", value: 15 }];
        if (q.query && vars[0] === "humidity") return [{ variable: "humidity", value: 85 }];
        if (q.query === "last_item") return [{ variable: "temperature", value: 15, time: T(5) }, { variable: "humidity", value: 89, time: T(5) }];
        if (!q.query) { const out = []; for (let i = 0; i < 100; i++) { out.push({ variable: "temperature", value: 12 + (i % 7), time: T(i * 14) }); out.push({ variable: "humidity", value: 80 + (i % 10), time: T(i * 14) }); } return out; }
        return [];
      }
      if (this.id === "LMS1") {
        if (q.query === "max" && vars[0] === "leaf_moisture") return [{ variable: "leaf_moisture", value: 2.1 }];
        if (q.query === "last_item") return [{ variable: "leaf_moisture", value: 2, time: T(5) }, { variable: "leaf_temperature", value: 15.2, time: T(5) }];
        if (!q.query) { const out = []; for (let i = 0; i < 70; i++) out.push({ variable: "leaf_moisture", value: 2 + (i % 2) * 0.1, time: T(i * 20) }); return out; }
        return [];
      }
      return [];
    }
  }
  class S { constructor() {} }
  return { Analysis: S, Resources: S, Account: S, Services: S, Device, Utils: { getTokenByName: async (_a, n) => String(n), envToJson: () => ({}) } };
}
function load(src, calls, bundleShared) {
  const sdk = mkSdk(calls, bundleShared);
  const shimReq = (m) => (m === "@tago-io/sdk" ? sdk : req(m));
  const tail = "\nreturn { getMeasurements, SAG_KERNEL_VERSION };";
  const f = new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + tail);
  return f(shimReq, { exports: {} }, {}, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {}, info() {}, debug() {} }, path.dirname(corePath), corePath);
}
const DEVS = { air: "EM1", leaf: "LMS1" };
async function tick(src, shared, daily) {
  const calls = [];
  const K = load(src, calls, shared);
  const meas = await K.getMeasurements(true, !!daily, DEVS, "FIELD", "Δοκιμή");
  const data = (meas && (meas.data || meas)) || {};
  const st = {};
  for (const k of Object.keys(data)) if (/^(diag_stats__|light_ring__)/.test(k)) st[k] = { value: Array.isArray(data[k]) ? data[k][0].value : data[k] };
  return { calls, data, st, K };
}
const raw400 = (calls, id) => calls.filter((c) => c[0] === id && !c[1] && c[3] === 400).length;
const maxes = (calls) => calls.filter((c) => c[1] === "max" && /humidity|leaf_moisture/.test(c[2])).length;
const inv = (data, id) => (data._sagDevInv || []).find((d) => d.i === id);
const rec = (st, id) => { const k = Object.keys(st).find((x) => x.startsWith("diag_stats__") && x.endsWith(id)); try { return k ? JSON.parse(st[k].value) : null; } catch (_e) { return null; } };

async function run(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let A, B, C, D;
  try {
    A = await tick(src, null, false);                       // 1ος ωριαίος: κενή κατάσταση → πλήρης ανάγνωση (όπως πριν)
    B = await tick(src, A.st, false);                       // 2ος ωριαίος: κατάσταση από τον 1ο
    C = await tick(src, B.st, true);                        // ημερήσιος: πλήρης ανάγνωση
    const old = JSON.parse(JSON.stringify(B.st));           // κατάσταση 30 ωρών → πλήρης ανάγνωση
    for (const k of Object.keys(old)) if (k.startsWith("diag_stats__")) { const o = JSON.parse(old[k].value); o.t -= 30 * 60; old[k].value = JSON.stringify(o); }
    D = await tick(src, old, false);
  } catch (e) { return ["εκτέλεση: " + e.message]; }
  ok(A.K.SAG_KERNEL_VERSION.startsWith("v50.196 · 2026-11-27"), "Κ0 έκδοση v50.196");
  ok(raw400(A.calls, "EM1") === 1 && raw400(A.calls, "LMS1") === 1, "Κ1 πρώτος κύκλος: μία πλήρης ανάγνωση ανά όργανο (" + raw400(A.calls, "EM1") + "/" + raw400(A.calls, "LMS1") + ")");
  ok(maxes(A.calls) >= 21, "Κ1β πρώτος κύκλος: συμπλήρωση ιστορικού (" + maxes(A.calls) + " «max»)");
  ok(raw400(B.calls, "EM1") === 0 && raw400(B.calls, "LMS1") === 0, "Κ2 δεύτερος ωριαίος: ΚΑΜΙΑ ανάγνωση 400 δειγμάτων (" + raw400(B.calls, "EM1") + "/" + raw400(B.calls, "LMS1") + ")");
  ok(maxes(B.calls) === 0, "Κ3 δεύτερος ωριαίος: κανένα «max» (" + maxes(B.calls) + ")");
  const ra = rec(A.st, "EM1"), rb = rec(B.st, "EM1"), la = rec(A.st, "LMS1"), lb = rec(B.st, "LMS1");
  ok(ra && rb && JSON.stringify(ra.hx) === JSON.stringify(rb.hx) && Array.isArray(rb.hx) && rb.hx.length >= 20, "Κ4 ο δακτύλιος hx ξαναγράφεται αυτούσιος (" + (rb && rb.hx ? rb.hx.length : "—") + ")");
  ok(la && lb && JSON.stringify(la.lx) === JSON.stringify(lb.lx) && Array.isArray(lb.lx), "Κ5 ο δακτύλιος lx ξαναγράφεται αυτούσιος");
  ok(rb && JSON.stringify(rb.s) === JSON.stringify(ra.s), "Κ6 τα στατιστικά διάγνωσης ίδια");
  const ia = inv(A.data, "EM1"), ib = inv(B.data, "EM1"), ja = inv(A.data, "LMS1"), jb = inv(B.data, "LMS1");
  ok(ia && ib && JSON.stringify(ia.rhc) === JSON.stringify(ib.rhc) && ib.rhc && ib.rhc.top === 89.5, "Κ7 οροφή υγρασίας ίδια στον 2ο κύκλο (" + JSON.stringify(ib && ib.rhc) + ")");
  ok(ja && jb && JSON.stringify(ja.lst) === JSON.stringify(jb.lst) && jb.lst && jb.lst.stuck, "Κ8 κολλημένος αισθητήρας φύλλου ίδιος στον 2ο κύκλο (" + JSON.stringify(jb && jb.lst) + ")");
  ok(raw400(C.calls, "EM1") === 1 && raw400(C.calls, "LMS1") === 1, "Κ9 ημερήσιος κύκλος: πλήρης ανάγνωση όπως πριν");
  ok(raw400(D.calls, "EM1") === 1 && raw400(D.calls, "LMS1") === 1, "Κ10 κατάσταση > 26 ω: πλήρης ανάγνωση όπως πριν");
  return f;
}
const base = await run(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("diag_state_carry_check: όλα ✔");
const MUT = [
  ["χάνεται ο δακτύλιος αέρα", "    if (Array.isArray(o.hx)) _out.hx = o.hx;   // T-DIAG-CARRY-01", ""],
  ["χάνεται ο δακτύλιος φύλλου", "    if (Array.isArray(o.lx)) _out.lx = o.lx;   // T-DIAG-CARRY-01", ""],
  ["πάντα ανανέωση", "      const _dNeed = !!dailyTich || _dPrev === null", "      const _dNeed = true || _dPrev === null"],
  ["ποτέ ανανέωση στο ημερήσιο", "      const _dNeed = !!dailyTich || _dPrev === null", "      const _dNeed = false || _dPrev === null"],
  ["αγνοεί την ηλικία", "|| _dAgeH > _SAG_DIAG_MAX_AGE_H ||", "|| false ||"],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = await run(SRC.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 80) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
process.exit(dead === MUT.length ? 0 : 1);
