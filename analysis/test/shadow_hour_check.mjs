// Ελεγκτής πυρήνα v50.166 · T-SHADOW-HOUR-01 (31/10/2026): σκιώδης σύγκριση «τελευταία τιμή» ↔ «ωριαίος μέσος ανά πακέτο».
// Φορτώνει τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα και εκτελεί _sagShadowRead με ψεύτικη συσκευή που επιστρέφει τα ΠΡΑΓΜΑΤΙΚΑ πακέτα του
// Γρινιαράκη 30/10 20:42–22:02 UTC (probe audit_ec_griniarakis_2026-10-31). Ελέγχει: EC ΑΝΑ ΠΑΚΕΤΟ = _sagEcChain, μέσος των
// αποτελεσμάτων (όχι των εισόδων), νεκρό όργανο έξω, λήξη 8/11, καμία ανάγνωση εκτός ωριαίου κύκλου, εγγραφή ΜΟΝΟ στη συσκευή
// εποπτείας (ποτέ στο field_bundle), καμία αλλαγή σε συμβουλή. Μεταλλάξεις σκοτώνονται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const KPATH = path.join(here, "..", "runPerTich.js");
const CORE0 = fs.readFileSync(KPATH, "utf8").replace(/\r\n/g, "\n");
const req = createRequire(KPATH);
function load(core) {
  const shim = (m) => {
    if (m === "@tago-io/sdk") { class S { constructor() {} } return { Analysis: S, Resources: S, Account: S, Services: S, Device: S, Utils: { getTokenByName: async () => null, envToJson: () => ({}) } }; }
    return req(m);
  };
  const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const proc = { env: {}, exit() {}, on() {}, version: process.version, versions: process.versions };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename",
    core + "\n;return {_sagShadowRead, _sagShadowStats, _sagEcChain, _SAG_SHADOW, _SAG_SHADOW_UNTIL, SAG_KERNEL_VERSION};")(
    shim, { exports: {} }, {}, proc, quiet, path.dirname(KPATH), KPATH);
}
const PK = [["2026-10-30T20:42:54Z", 364, 27.24, 20.91], ["2026-10-30T21:02:54Z", 363, 27.19, 20.9], ["2026-10-30T21:22:54Z", 360, 27.18, 20.88],
  ["2026-10-30T21:42:54Z", 360, 27.17, 20.86], ["2026-10-30T22:02:53Z", 360, 27.16, 20.85]];
function dev(pk, calls) {
  return { getData: async (q) => { calls.push(q); const s = Date.parse(q.start_date), e = Date.parse(q.end_date); const out = [];
    for (const [t, c, m, T] of pk) { const ms = Date.parse(t); if (ms < s || ms > e) continue;
      out.push({ variable: "conduct_soil2", value: c, time: t }, { variable: "soil_moisture2", value: m, time: t }, { variable: "soil_temperature2", value: T, time: t },
        { variable: "soil_moisture1", value: 39.6, time: t }, { variable: "conduct_soil1", value: 12, time: t }); }
    return out.reverse(); } };
}
async function run(core) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const K = load(core);
    ok(K.SAG_KERNEL_VERSION === "v50.166 · 2026-10-31", "Ε έκδοση v50.166 (" + K.SAG_KERNEL_VERSION + ")");
    ok(K._SAG_SHADOW_UNTIL === Date.parse("2026-11-08T00:00:00Z"), "Λ1 λήξη 8/11/2026 00:00 UTC");
    // ── Σ: ο κύκλος 22:21 UTC βλέπει 21:22 · 21:42 · 22:02 (τα 21:21–22:21) ──
    const calls = []; K._SAG_SHADOW.length = 0;
    await K._sagShadowRead(dev(PK, calls), "ΓΡΙΝΙΑΡΑΚΗΣ", "dragino_se0x_5ea7", "2026-10-30T22:21:00Z");
    ok(calls.length === 1 && calls[0].qty === 60 && calls[0].start_date === "2026-10-30T21:21:00.000Z" && calls[0].end_date === "2026-10-30T22:21:00.000Z",
      "Σ1 ΜΙΑ ανάγνωση, παράθυρο 60΄ πριν από τον κύκλο (" + JSON.stringify(calls[0]) + ")");
    const R = K._SAG_SHADOW[0] || {};
    const pk = PK.slice(2).map(([, c, m, T]) => K._sagEcChain(c, m, T, NaN).pore);
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const mean = pk.reduce((a, x) => a + x, 0) / 3;
    ok(R.e2 && R.e2[0] === r3(pk[2]) && R.e2[1] === r3(mean) && R.e2[2] === 3, "Σ2 EC βαθύ: τελευταία = 22:02, μέσος ΤΩΝ ΑΠΟΤΕΛΕΣΜΑΤΩΝ, n=3 (" + JSON.stringify(R.e2) + ")");
    const avgIn = K._sagEcChain(360, (27.18 + 27.17 + 27.16) / 3, (20.88 + 20.86 + 20.85) / 3, NaN).pore;
    ok(Math.abs(R.e2[1] - r3(mean)) < 1e-9 && R.e2[1] !== undefined, "Σ3 ο μέσος ΔΕΝ υπολογίζεται από μέσους εισόδων (" + r3(avgIn) + " ως αναφορά)");
    ok(R.m2 && R.m2[0] === 27.16 && R.m2[1] === r3((27.18 + 27.17 + 27.16) / 3) && R.m2[2] === 3 && R.m2[3] === 27.16 && R.m2[4] === 27.18, "Σ4 υγρασία βαθύ [τελ, μέσος, n, min, max] (" + JSON.stringify(R.m2) + ")");
    ok(R.a === 18, "Σ5 ηλικία τελευταίου πακέτου στον κύκλο = 18΄ (" + R.a + ")");
    ok(R.m1 && !R.e1, "Σ6 νεκρό όργανο (12 µS/cm σε 39,6 %) ΕΞΩ από την EC, η υγρασία μένει (" + JSON.stringify([R.m1, R.e1]) + ")");
    ok(R.f === "ΓΡΙΝΙΑΡΑΚΗΣ" && R.d === "dragino_se0x_5ea7", "Σ7 αγρός και αισθητήρας");
    // ── Λ: λήξη, κενό, σφάλμα ──
    const c2 = []; K._SAG_SHADOW.length = 0;
    await K._sagShadowRead(dev(PK, c2), "Χ", "y", "2026-11-08T00:21:00Z");
    ok(c2.length === 0 && K._SAG_SHADOW.length === 0, "Λ2 μετά τις 8/11 καμία ανάγνωση");
    await K._sagShadowRead(dev([], c2), "Χ", "y", "2026-10-31T10:21:00Z");
    ok(K._SAG_SHADOW.length === 0, "Λ3 χωρίς πακέτα → τίποτα");
    await K._sagShadowRead({ getData: async () => { throw new Error("quota"); } }, "Χ", "y", "2026-10-31T10:21:00Z");
    ok(K._SAG_SHADOW.length === 0, "Λ4 σφάλμα ανάγνωσης → σιωπή, ο κύκλος συνεχίζει");
    ok(K._sagShadowStats([{ t: 2, v: 5 }, { t: 1, v: 1 }, { t: 3, v: NaN }])[0] === 5, "Λ5 «τελευταία» κατά ΧΡΟΝΟ, όχι σειρά άφιξης");
    // ── Ω: στατικά — πού καλείται, πού γράφει, τι ΔΕΝ αγγίζει ──
    const call = "      if (hourTich) await _sagShadowRead(device, fieldName, info?.name || value, now);\n";
    ok(core.split(call).length === 2, "Ω1 μία κλήση, μόνο στον ωριαίο κύκλο");
    const ci = core.indexOf(call), se = core.lastIndexOf('(typeName === "lse02" || typeName === "se0x")', ci);
    ok(ci > 0 && se > 0 && ci - se < 4000, "Ω2 η κλήση βρίσκεται στους αισθητήρες δύο βαθών (se0x/lse02)");
    ok(core.split("_SAG_SHADOW.length = 0;  // T-SHADOW-HOUR-01").length === 2, "Ω3 μηδενισμός ανά εκτέλεση");
    const wi = core.indexOf("variable: 'sag_shadow_hourly'"), fb = core.indexOf("await _fbDev.sendData(_rows);");
    ok(wi > 0 && fb > wi && fb - wi < 1500 && core.split("sag_shadow_hourly").length === 2, "Ω4 εγγραφή ΜΟΝΟ στη συσκευή εποπτείας, πριν από το sendData της");
    ok(core.includes("if (hourTich && _SAG_SHADOW.length) {"), "Ω5 εγγραφή μόνο στον ωριαίο κύκλο");
    ok(!/_SAG_SHADOW[^_]/.test(core.slice(core.indexOf("function _sagEcIndicators"), core.indexOf("// ── T-ECREF-01"))), "Ω6 οι δείκτες EC δεν διαβάζουν το σκιώδες");
    ok(core.split("_SAG_SHADOW").length - 1 === 8, "Ω7 το _SAG_SHADOW εμφανίζεται μόνο στα σημεία του T-SHADOW-HOUR-01 (" + (core.split("_SAG_SHADOW").length - 1) + ")");
  } catch (e) { f.push("εκτέλεση: " + (e && e.stack || e)); }
  return f;
}
const base = await run(CORE0);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν (Γρινιαράκης 30/10, λήξη, στατικά)");
const MUT = [
  ["μ1 μέσος εισόδων", "const k = _sagEcChain(c, m, p['soil_temperature' + n], NaN);", "const k = _sagEcChain(c, 27.17, 20.86, NaN);"],
  ["μ2 χωρίς λήξη", "end >= _SAG_SHADOW_UNTIL) return;", "end >= Infinity) return;"],
  ["μ3 παράθυρο 2 ωρών", "start_date: new Date(end - 3600000)", "start_date: new Date(end - 7200000)"],
  ["μ4 χωρίς πύλη νεκρού οργάνου", "&& !(m > _SAG_EC_MIN_VWC * 100 && c < _SAG_EC_DEAD_US)", ""],
  ["μ5 «τελευταία» κατά άφιξη", ".filter(x => x && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);", ".filter(x => x && Number.isFinite(x.v));"],
  ["μ6 και εκτός ωριαίου κύκλου", "      if (hourTich) await _sagShadowRead(", "      if (true) await _sagShadowRead("],
  ["μ7 χωρίς μηδενισμό", "  _SAG_SHADOW.length = 0;  // T-SHADOW-HOUR-01\n", "\n"],
  ["μ8 ηλικία σε δευτερόλεπτα", "(end - ts[ts.length - 1]) / 60000", "(end - ts[ts.length - 1]) / 1000"],
  ["μ9 λάθος έκδοση", "'v50.166 · 2026-10-31'", "'v50.165 · 2026-10-29'"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = CORE0.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = await run(CORE0.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0].slice(0, 130)); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
