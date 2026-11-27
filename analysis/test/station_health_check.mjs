// Ελεγκτής T-HEALTH-02 φάση 1 (28/11/2026) — analysis/stationHealth.js.
// Ψεύτικος στόλος 9 σταθμών, ένας για κάθε συμπεριφορά των ευρημάτων της 27–28/11:
//   ΥΓΙΗΣ · ΝΥΧΤΑ (Όρμα/Σκοτίνα Πάνω) · ΣΙΩΠΗ · ΠΙΕΣΗ (Μελίβοια 1) · ΒΗΜΑ (Βρία 1 24/11) · ΣΦΑΛΜΑ (ΕΛΙΑ/Μελίβοια 2)
//   ΧΩΡΙΣ ΩΡΙΑΙΑ (Σκοτίνα Πάνω Μάιο–Αύγουστο) · ΒΡΟΧΟΜΕΤΡΟ (Βρία 2 Σεπ–Νοε) · ΜΑΚΡΙΑ (ίδιο με ΒΡΟΧΟΜΕΤΡΟ αλλά χωρίς γείτονα) · KBDI αρνητικό.
// Ελέγχει ότι κάθε σταθμός παίρνει ΜΟΝΟ τον έλεγχο που του αναλογεί, ότι η «από» κρατιέται, και μεταλλάξεις.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "stationHealth.js");
const SRC = fs.readFileSync(file, "utf8");
const req = createRequire(file);
const H = 3600000;
const NOW = Date.parse("2026-11-28T07:30:00Z");          // 09:30 ώρα Ελλάδας
const END = Date.parse("2026-11-28T07:00:00Z"), START = END - 24 * H;
const localHour = (h) => (new Date(h).getUTCHours() + 2) % 24;

function load(src) {
  const mod = { exports: {} };
  new Function("require", "module", "exports", "process", src)(req, mod, mod.exports, { env: {} });   // χωρίς T_ANALYSIS_TOKEN: δεν τρέχει μόνο του
  return mod.exports;
}
// σταθμός: συνάρτηση hours → ποιες μεταβλητές υπάρχουν, τιμές πίεσης, βροχή ημερών, ωριαίες βροχής, τελευταία θερμοκρασία
function station(id, o) {
  return Object.assign({ id, name: id, coords: "39.1000,23.1000", has: () => true, pressure: () => 1000, rainVar: "rain_height",
    daily: [2, 3, 4], hourlyRain: true, last: NOW - 10 * 60000, kbdi: null, weatherStation: false }, o);
}
const day = (k) => { const s = Date.parse("2026-11-24T22:00:00Z") + k * 86400000; return { s, e: s + 86400000 }; };   // 3 κλειστές ημέρες Ελλάδας 25–27/11
function fleet() {
  return [
    station("ΥΓΙΗΣ", { daily: [6, 5, 4] }),
    station("ΝΥΧΤΑ", { has: (h) => { const x = localHour(h); return x >= 8 && x < 18; }, last: Date.parse("2026-11-28T06:40:00Z") }),
    station("ΣΙΩΠΗ", { has: (h) => h < START, last: START - H }),
    station("ΚΕΝΑ", { has: (h) => { const x = localHour(h); return !(x >= 11 && x < 15); } }),
    station("ΠΙΕΣΗ", { pressure: () => 510 }),
    station("ΒΗΜΑ", { pressure: (h) => (h >= END - 6 * H ? 953 : 976) }),
    station("ΣΦΑΛΜΑ", { has: (h, v) => v === "air_temperature" }),
    station("ΧΩΡΙΣ_ΩΡΙΑΙΑ", { hourlyRain: false }),
    station("ΒΡΟΧΟΜΕΤΡΟ", { coords: "39.1050, 23.1080", rainVar: "rain_height_acc", daily: [0, 0, 0] }),
    station("ΜΑΚΡΙΑ", { coords: "37.5000,24.5000", daily: [0, 0, 0] }),
    station("KBDI", { weatherStation: true, kbdi: -7.86 }),
  ];
}
function fakeR(F, prev) {
  const sent = [];
  const byId = Object.fromEntries(F.map((s) => [s.id, s]));
  return {
    sent,
    devices: {
      async list(q) {
        const t = q.filter.tags[0];
        if (t.key === "type") return F.map((s) => ({ id: s.id, name: s.name, tags: [{ key: "type", value: "s2120" }].concat(s.weatherStation ? [{ key: "topalidouType", value: "weatherStation" }] : []) }));
        if (t.key === "isField") return F.map((s) => ({ id: "F_" + s.id, name: "Field_" + s.id, tags: [{ key: "coordinates", value: s.coords }, { key: "devices", value: JSON.stringify({ s2120: s.id }) }] }));
        return [];
      },
      async getDeviceData(id, q) {
        const s = byId[id]; const v = q.variables[0];
        if (q.query === "aggregate") {
          const a = Date.parse(q.start_date), b = Date.parse(q.end_date), out = [];
          if (b - a > 25 * H) throw new Error("παράθυρο > 24 ω");
          for (let h = Math.ceil(a / H) * H; h <= b; h += H) {
            let ok;
            if (v === "air_temperature") ok = s.has(h, v);
            else if (["rain_height", "rain_height_acc", "rain_gauge"].includes(v)) ok = v === s.rainVar && s.has(h, v);
            else ok = s.has(h, v);
            if (ok) out.push({ time: new Date(h).toISOString(), value: v === "barometric_pressure_hpa" ? s.pressure(h) : 10 });
          }
          return out;
        }
        if (v === "air_temperature") return [{ time: new Date(s.last).toISOString(), value: 10 }];
        if (v === "rain_height_hourly") return s.hourlyRain ? Array.from({ length: 24 }, (_, i) => ({ value: 0, time: new Date(START + i * H + H / 2).toISOString() })) : [];
        if (v === "rain_height_daily") return s.daily.map((mm, k) => ({ value: mm, time: new Date(day(k).s + 43200000).toISOString(), metadata: { alg: "v34", coverage: 1, period_start_utc: new Date(day(k).s).toISOString(), period_end_utc: new Date(day(k).e).toISOString() } }));
        if (v === "kbdi1") return s.kbdi == null ? [] : [{ value: s.kbdi, time: "2026-11-27T21:59:50Z", metadata: { alg: "kbdi-v2" } }];
        if (v === "station_health") return prev && prev[id] ? [prev[id]] : [];
        throw new Error("απρόσμενο " + v);
      },
      async sendDeviceData(id, arr) { for (const x of arr) sent.push({ id, ...x }); },
    },
  };
}
const EXPECT = { "ΥΓΙΗΣ": [], "ΝΥΧΤΑ": ["H1"], "ΣΙΩΠΗ": ["H2"], "ΚΕΝΑ": ["H1b"], "ΠΙΕΣΗ": ["H3"], "ΒΗΜΑ": ["H3s"], "ΣΦΑΛΜΑ": ["H4"], "ΧΩΡΙΣ_ΩΡΙΑΙΑ": ["H6"], "ΒΡΟΧΟΜΕΤΡΟ": ["H10"], "ΜΑΚΡΙΑ": [], "KBDI": ["H7k"] };

async function check(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let K; try { K = load(src); } catch (e) { return ["φόρτωση: " + e.message]; }
  const prev = { "ΝΥΧΤΑ": { metadata: { checks: [{ id: "H1", since: "2026-11-20T07:30:00.000Z" }] } } };
  const R = fakeR(fleet(), prev);
  try { await K.run(R, NOW, () => {}); } catch (e) { return ["τρέξιμο: " + e.message]; }
  const got = Object.fromEntries(R.sent.map((x) => [x.id, x]));
  for (const [id, exp] of Object.entries(EXPECT)) {
    const r = got[id];
    const ids = r ? r.metadata.checks.map((c) => c.id).sort() : null;
    ok(r && JSON.stringify(ids) === JSON.stringify(exp.slice().sort()), `${id}: αναμενόταν [${exp}] βρέθηκε [${ids}]`);
  }
  ok(got["ΥΓΙΗΣ"] && got["ΥΓΙΗΣ"].value === "ok", "Σ1 υγιής = ok");
  ok(got["ΝΥΧΤΑ"] && got["ΝΥΧΤΑ"].value === "warning" && got["ΣΦΑΛΜΑ"].value === "fault" && got["ΣΙΩΠΗ"].value === "fault", "Σ2 βαρύτητα warning/fault");
  const h1 = got["ΝΥΧΤΑ"] && got["ΝΥΧΤΑ"].metadata.checks.find((c) => c.id === "H1");
  ok(h1 && h1.since === "2026-11-20T07:30:00.000Z", "Σ3 το «από» του προηγούμενου κρατιέται (" + (h1 && h1.since) + ")");
  ok(h1 && /μπαταρίες AA/.test(h1.text_el) && /10 από 24/.test(h1.text_el), "Σ4 κείμενο H1 με ώρες και ενέργεια (" + (h1 && h1.text_el) + ")");
  const h4 = got["ΣΦΑΛΜΑ"] && got["ΣΦΑΛΜΑ"].metadata.checks.find((c) => c.id === "H4");
  ok(h4 && /πίεση, κατεύθυνση ανέμου, βροχή/.test(h4.text_el), "Σ5 H4 ονομάζει τις τρεις μεταβλητές (" + (h4 && h4.text_el) + ")");
  const h10 = got["ΒΡΟΧΟΜΕΤΡΟ"] && got["ΒΡΟΧΟΜΕΤΡΟ"].metadata.checks.find((c) => c.id === "H10");
  ok(h10 && h10.ev.mm === 15 && h10.ev.km < 2, "Σ6 H10 με γείτονα < 2 km και 15 mm (" + JSON.stringify(h10 && h10.ev) + ")");
  ok(R.sent.every((x) => x.variable === "station_health" && x.metadata.shadow === true), "Σ7 μόνο station_health, σκιώδες");
  ok(R.sent.length === 11, "Σ8 μία εγγραφή ανά σταθμό (" + R.sent.length + ")");
  ok(K.parseCoords([{ key: "coordinates", value: "39.10001234567890, 23.10009876543210" }]).lon > 23.1, "Σ9 μορφή «πλάτος, μήκος» του αγρού (επινοημένες τιμές)");
  ok(K.parseCoords([{ key: "coordinates", value: "0,0" }]) === null && K.parseCoords([]) === null, "Σ10 άκυρες συντεταγμένες = καμία");
  ok(K.fmt(Date.parse("2026-10-25T00:30:00Z")) === "25/10 03:30" && K.fmt(Date.parse("2026-10-25T01:30:00Z")) === "25/10 03:30" && K.athensHour(Date.parse("2026-11-28T22:10:00Z")) === 0, "Σ11 ώρα Ελλάδας χωρίς βιβλιοθήκη (θερινή/χειμερινή, μεσάνυχτα)");
  return f;
}

const base = await check(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ " + base.length + ":\n  " + base.join("\n  ")); process.exit(1); }
console.log("station_health_check: όλα ΟΚ");
const MUT = [
  ["H1 χωρίς νυχτερινό κριτήριο", "if (night / missing.length >= 0.7)", "if (false)"],
  ["H2 όριο 30 ωρών", "nowMs - lastMs > 3 * H", "nowMs - lastMs > 30 * H"],
  ["H3 χωρίς όρια", "const bad = pv.filter(([, v]) => v < P_MIN || v > P_MAX);", "const bad = [];"],
  ["H3 χωρίς βήμα", "Math.abs(pv[i][1] - pv[i - 1][1]) > P_STEP", "false"],
  ["H4 χωρίς πίεση", '    if (pres.size === 0) lost.push("πίεση");', ""],
  ["H4 βροχή μόνο rain_height", 'const RAIN_VARS = ["rain_height", "rain_height_acc", "rain_gauge"];', 'const RAIN_VARS = ["rain_height"];'],
  ["H6 ποτέ", "if (tH >= 12 && !(rh || []).length)", "if (false)"],
  ["H10 χωρίς όριο απόστασης", "if (dist < NEIGH_KM && b.rain3 >= NEIGH_MM", "if (b.rain3 >= NEIGH_MM"],
  ["H7k ποτέ", "if (kb && !(Number(kb.value) >= 0 && Number(kb.value) <= KBDI_MAX))", "if (false)"],
  ["χωρίς «από»", "  for (const c of checks) c.since = prevMap.get(c.id) || nowIso;", "  for (const c of checks) c.since = nowIso;"],
  ["warning πάνω από fault", 'checks.some((c) => c.sev === "fault") ? "fault"', 'false ? "fault"'],
  ["H1b ποτέ", "    else C.push({ id: \"H1b\"", "    else if (false) C.push({ id: \"H1b\""],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (SRC.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = await check(SRC.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 70) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
process.exit(dead === MUT.length ? 0 : 1);
