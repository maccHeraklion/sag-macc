// Ελεγκτής T-EXPORT-RAIN-01 (27/11/2026): βροχή στην εξαγωγή αγρού (fieldExportData.js, μορφή UTC-2).
// Τρέχει ολόκληρη την init με ψεύτικο SDK (ίδιο σχήμα με export_disease_check.mjs) για:
//   Α · σταθμό ΜΕ μετρητή: στήλες rain_gauge, rain_height_acc και η αύξηση ανά μέτρηση (κενό, μηδενισμός, αδύνατο βήμα, μεγάλο κενό)·
//   Β · ωριαία βροχή: μία τιμή ανά ώρα (v34 > v33, μεγαλύτερη κάλυψη), αρχή/τέλος ώρας, κάλυψη, ποιότητα (μερική, v33, συμπλήρωση)·
//   Γ · σταθμό ΧΩΡΙΣ μετρητή: τίποτα από τα παραπάνω δεν εμφανίζεται άδειο· Δ · περιγραφή στο email· Ε · ζεύγη στηλών.
// Κάθε μετάλλαξη του κώδικα πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "fieldExportData.js");
const SRC = fs.readFileSync(file, "utf8");
const req = createRequire(file);
const DAYJS_SHIM = createRequire(import.meta.url)("./shims/dayjs-shim.cjs");
const PUB = { "sag-data-dictionary.json": path.join(here, "..", "..", "changelog", "data_dictionary.json"), "sag-changelog.json": path.join(here, "..", "..", "changelog", "system_changelog.json") };
globalThis.fetch = async (url) => {
  const name = Object.keys(PUB).find((k) => String(url).includes("/html_files/" + k));
  if (!name) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(PUB[name], "utf8")) };
};
const FIELD = "f".repeat(24), STATION = "a".repeat(24), FORM = "c".repeat(24);
const T = (hhmm) => "2026-11-20T" + hhmm + ":00.000Z";

function makeData(counter) {
  const S = [];
  let n = 0;
  const add = (variable, value, time, metadata) => S.push({ variable, value, time, id: "r" + n++, ...(metadata ? { metadata } : {}) });
  // κύριο μπλοκ: 10:00 … 10:15, κενό 40΄, 10:55, μηδενισμός 11:00, αδύνατο βήμα 11:05
  const acc = [["10:00", 10.0], ["10:05", 10.2], ["10:10", 10.2], ["10:15", 10.5], ["10:55", 11.0], ["11:00", 0.3], ["11:05", 400]];
  for (const [hh, v] of acc) {
    add("air_temperature", 15, T(hh));
    if (counter) { add("rain_height_acc", v, T(hh)); add("rain_gauge", 0.1, T(hh)); }
    else add("rain_height", 0.1, T(hh));
  }
  // ωριαία: ώρα 08 → v33 (τέλος+11΄΄, …:59.999) ΚΑΙ v34 (μέσο) · ώρα 09 → v34 μερική εκτίμηση + συμπλήρωση · ώρα 07 → δύο v34 (κάλυψη 0,5 και 0,9) · ώρα 06 → μόνο v33
  const per = (h) => ({ period_start_utc: `2026-11-20T${h}:00:00.000Z`, period_end_utc: `2026-11-20T${h}:59:59.999Z` });
  const per34 = (h, h2) => ({ period_start_utc: `2026-11-20T${h}:00:00.000Z`, period_end_utc: `2026-11-20T${h2}:00:00.000Z` });
  add("rain_height_hourly", 0, "2026-11-20T09:00:10.999Z", { ...per("08"), source_variable: counter ? "rain_height_acc" : "rain_height" });
  add("rain_height_hourly", 1.2, T("08:30"), { ...per34("08", "09"), alg: "v34", status: counter ? "measured" : "estimate", partial: false, coverage: 1 });
  add("rain_height_hourly", 0.4, T("09:30"), { ...per34("09", "10"), alg: "v34", status: "estimate", partial: true, coverage: 0.6, backfill: "T-RAIN-BACKFILL-01" });
  add("rain_height_hourly", 0.5, T("07:30"), { ...per34("07", "08"), alg: "v34", status: "measured", partial: true, coverage: 0.5 });
  add("rain_height_hourly", 0.9, T("07:30").replace(":00.000Z", ":01.000Z"), { ...per34("07", "08"), alg: "v34", status: "measured", partial: true, coverage: 0.9 });
  add("rain_height_hourly", 2.5, "2026-11-20T07:00:11.999Z", { ...per("06"), source_variable: counter ? "rain_height_acc" : "rain_height" });
  return { [FIELD]: [], [STATION]: S };
}

async function run(src, counter, pair) {
  const D = makeData(counter);
  const mails = []; const valid = [];
  const reader = (id) => async (q) => {
    let rows = D[id].filter((r) => !q.variables || q.variables.includes(r.variable));
    if (q.start_date) rows = rows.filter((r) => Date.parse(r.time) >= Date.parse(q.start_date) && Date.parse(r.time) <= Date.parse(q.end_date));
    rows.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    return rows.slice(0, q.qty || 15);
  };
  const sdk = {
    Analysis: class { constructor(fn) { this.fn = fn; } },
    Account: class { constructor() { this.devices = { info: async (id) => id === FIELD
      ? { id, name: "Field_Δοκιμή", tags: [{ key: "name", value: "Δοκιμή" }, { key: "devices", value: JSON.stringify({ s2120: STATION }) }] }
      : { id, name: "sensecap_s2120_x", tags: [{ key: "type", value: "s2120" }, { key: "eui", value: "E1" }] } }; } },
    Resources: class { constructor() { this.devices = { getDeviceData: (id, q) => reader(id)(q), sendDeviceData: async (_id, p) => valid.push(p) }; } },
    Utils: { envToJson: () => ({ ACCOUNT_TOKEN: "x".repeat(36) }) },
    Services: class { constructor() { this.email = { send: async (m) => mails.push(m) }; } },
    Device: class {},
  };
  const shim = (m) => {
    if (m === "@tago-io/sdk") return sdk;
    if (m === "dayjs" || m.startsWith("dayjs/plugin/")) { try { return req(m); } catch (e) { return m === "dayjs" ? DAYJS_SHIM : () => {}; } }
    return req(m);
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", src)(shim, mod, mod.exports);
  const scope = [
    { variable: "time_period", device: FORM, metadata: { start_date: "2026-11-20T00:00:00.000Z", end_date: "2026-11-20T23:59:00.000Z" } },
    { variable: "location", value: FIELD }, { variable: "email", value: "t@example.com" }, { variable: "hide_eui", value: "yes" },
    ...(pair ? [{ variable: "pair_columns", value: "true" }] : []),
  ];
  await mod.exports.fn({ log() {}, environment: [], token: "t" }, scope);
  return { mails, valid };
}

// CSV με εισαγωγικά
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// στήλες ενός μπλοκ (τίτλος μπλοκ στη γραμμή 0) → { header: [τιμές ανά γραμμή] }
function block(rows, title, exact) {
  const idx = rows[0].map((t, i) => [t, i]).filter(([t]) => (exact ? t === title : t.includes(title))).map(([, i]) => i);
  const out = { _headers: idx.map((i) => rows[1][i]) };
  for (const i of idx) out[rows[1][i]] = rows.slice(2).map((r) => r[i] ?? "").filter((v, k, a) => true);
  return out;
}

async function check(src) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let A, C, P;
  try { A = await run(src, true, false); C = await run(src, false, false); P = await run(src, true, true); } catch (e) { return ["εκτέλεση: " + (e && e.message)]; }
  // ---- Α · σταθμός με μετρητή, κύριο μπλοκ ----
  ok(A.mails.length === 1, "Α0 ένα email");
  const R = parseCsv(A.mails[0].attachment.archive);
  const M = block(R, "Δοκιμή - Μετεωρολογικός Σταθμός", true);
  const H = M._headers;
  ok(H.includes("Βροχόπτωση Μέτρησης από Ένταση (mm)") && H.includes("Μετρητής Βροχής - Αθροιστικός (mm)"), "Α1 στήλες έντασης και μετρητή (" + H.join(" | ") + ")");
  ok(H.indexOf("Βροχόπτωση Μέτρησης από Μετρητή (mm)") === H.indexOf("Μετρητής Βροχής - Αθροιστικός (mm)") + 1, "Α2 η αύξηση δίπλα στον μετρητή");
  ok(!H.includes("Βροχόπτωση Μέτρησης (mm)"), "Α3 χωρίς άδεια στήλη rain_height σε σταθμό με μετρητή");
  const ts = M["Χρόνος UTC"] || [], inc = M["Βροχόπτωση Μέτρησης από Μετρητή (mm)"] || [];
  const at = (hh) => inc[ts.indexOf("2026-11-20T" + hh + ":00Z")];
  ok(at("10:00") === "", "Α4 πρώτη μέτρηση: κενό (" + at("10:00") + ")");
  ok(at("10:05") === "0.2" && at("10:10") === "0" && at("10:15") === "0.3", "Α5 διαφορές 0.2 / 0 / 0.3 (" + [at("10:05"), at("10:10"), at("10:15")].join(",") + ")");
  ok(at("10:55") === "", "Α6 μετά από κενό 40΄: κενό (" + at("10:55") + ")");
  ok(at("11:00") === "0.3", "Α7 μηδενισμός μετρητή: μετρά η νέα τιμή (" + at("11:00") + ")");
  ok(at("11:05") === "", "Α8 αδύνατο βήμα (> 450 mm/h): κενό (" + at("11:05") + ")");
  // ---- Β · ωριαία βροχή ----
  const W = block(R, "(Ωριαία Βροχόπτωση)");
  ok(JSON.stringify(W._headers) === JSON.stringify(["Χρόνος UTC", "Ώρα Ελλάδας (με ζώνη)", "Βροχόπτωση Ώρας (mm)", "Αρχή Ώρας (UTC)", "Τέλος Ώρας (UTC)", "Κάλυψη Ώρας (%)", "Ποιότητα Τιμής"]), "Β1 στήλες ωριαίας (" + W._headers.join(" | ") + ")");
  const st = W["Αρχή Ώρας (UTC)"] || [], val = W["Βροχόπτωση Ώρας (mm)"] || [], en = W["Τέλος Ώρας (UTC)"] || [], cov = W["Κάλυψη Ώρας (%)"] || [], qa = W["Ποιότητα Τιμής"] || [];
  const nonEmpty = st.filter((x) => x !== "");
  ok(nonEmpty.length === 4 && new Set(nonEmpty).size === 4, "Β2 μία τιμή ανά ώρα (" + nonEmpty.join(",") + ")");
  const row = (h) => st.indexOf("2026-11-20T" + h + ":00:00Z");
  ok(val[row("08")] === "1.2" && qa[row("08")] === "μέτρηση μετρητή" && cov[row("08")] === "100", "Β3 ώρα 08: v34 κερδίζει τη v33 (" + [val[row("08")], qa[row("08")], cov[row("08")]].join(" · ") + ")");
  ok(en[row("08")] === "2026-11-20T09:00:00Z", "Β4 τέλος ώρας 09:00:00Z (" + en[row("08")] + ")");
  ok(val[row("07")] === "0.9" && cov[row("07")] === "90" && qa[row("07")] === "μέτρηση μετρητή · μερική ώρα", "Β5 ώρα 07: μεγαλύτερη κάλυψη (" + [val[row("07")], cov[row("07")], qa[row("07")]].join(" · ") + ")");
  ok(qa[row("09")] === "εκτίμηση από ένταση · μερική ώρα · συμπλήρωση T-RAIN-BACKFILL-01" && cov[row("09")] === "60", "Β6 ώρα 09: μερική εκτίμηση + συμπλήρωση (" + qa[row("09")] + ")");
  ok(val[row("06")] === "2.5" && cov[row("06")] === "" && qa[row("06")] === "μέτρηση μετρητή · πριν από 4/10/2026 (v33)" && en[row("06")] === "2026-11-20T07:00:00Z", "Β7 ώρα 06: v33 χωρίς κάλυψη, τέλος …:59.999 → 07:00:00Z (" + [val[row("06")], cov[row("06")], qa[row("06")], en[row("06")]].join(" · ") + ")");
  // ---- Γ · σταθμός χωρίς μετρητή ----
  const R2 = parseCsv(C.mails[0].attachment.archive);
  const M2 = block(R2, "Δοκιμή - Μετεωρολογικός Σταθμός", true)._headers;
  ok(M2.includes("Βροχόπτωση Μέτρησης (mm)") && !M2.some((h) => /Μετρητή|Μετρητής|Ένταση/.test(h)), "Γ1 χωρίς μετρητή: μόνο rain_height (" + M2.join(" | ") + ")");
  const W2 = block(R2, "(Ωριαία Βροχόπτωση)");
  const q2 = (W2["Ποιότητα Τιμής"] || []).filter(Boolean);
  ok(q2.includes("εκτίμηση από ένταση") && q2.includes("εκτίμηση από ένταση · πριν από 4/10/2026 (v33)"), "Γ2 ποιότητα «εκτίμηση» (" + q2.join(" / ") + ")");
  // ---- Δ · περιγραφή ----
  const msg = A.mails[0].message;
  ok(/μορφή UTC-2/.test(msg), "Δ1 έκδοση μορφής UTC-2");
  ok(msg.includes("[rain_height_acc_increment]") && msg.includes("[rain_hourly_quality]") && msg.includes("[rain_gauge]"), "Δ2 περιγραφή των νέων στηλών στο email");
  // ---- Ε · ζεύγη στηλών ----
  const RP = parseCsv(P.mails[0].attachment.archive);
  ok(RP[1].includes("Βροχόπτωση Μέτρησης από Μετρητή (mm)") && RP[1].includes("Ποιότητα Τιμής"), "Ε1 ζεύγη στηλών: νέες στήλες παρούσες");
  ok(A.valid.at(-1).metadata.type === "success", "Ζ1 πράσινο μήνυμα");
  return f;
}

const base = await check(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ " + base.length + ":\n  " + base.join("\n  ")); process.exit(1); }
console.log("export_rain_check: όλα ΟΚ");
const S = SRC.replace(/\r\n/g, "\n");
const MUT = [
  ["χωρίς μηδενισμό", "    if (d < -0.001) d = P[i].v;", "    if (false) d = P[i].v;"],
  ["χωρίς όριο κενού", "if (gapMin <= 0 || gapMin > RAIN_INC_MAX_GAP_MIN) continue;", "if (gapMin <= 0) continue;"],
  ["χωρίς έλεγχο αδύνατου", "    if (d > RAIN_MAX_MMH * Math.max(gapMin / 60, 1 / 60) + 0.254) continue;", ""],
  ["αύξηση εκτός μπλοκ", '.concat(variables.rain_height_acc_increment ? ["rain_height_acc_increment"] : [])', ".concat([])"],
  ["χωρίς μία-ανά-ώρα", "            const kept = bestHourlyPerPeriod(src);", "            const kept = src;"],
  ["v33 πάνω από v34", '  if (m.alg !== "v34") return 1;\n  const c = Number(m.coverage);', '  if (m.alg !== "v34") return 9;\n  const c = Number(m.coverage);'],
  ["χωρίς διόρθωση …:59.999", "  if (e % 1000 === 999) e += 1;", ""],
  ["χωρίς «μερική ώρα»", '  if (m.alg === "v34" && m.partial) s += en ? " · partial hour" : " · μερική ώρα";', ""],
  ["χωρίς στήλες διαστήματος", "        const groupVarList = group.withPeriod ? group.vars.concat(RAIN_HOURLY_META) : group.vars;", "        const groupVarList = group.vars;"],
  ["χωρίς rain_gauge", '    "rain_gauge",\n    "rain_height_acc",\n  ],', '    "rain_height_acc",\n  ],'],
  ["κάλυψη σε κλάσμα", "Math.round(Math.max(0, Math.min(1, c)) * 1000) / 10", "Math.round(Math.max(0, Math.min(1, c)) * 1000) / 1000"],
];
let dead = 0;
for (const [name, a, b] of MUT) {
  if (S.split(a).length !== 2) { console.log("  ✗ μετάλλαξη «" + name + "»: το κείμενο δεν βρέθηκε μία φορά"); continue; }
  const fails = await check(S.replace(a, b));
  if (fails.length) { dead++; console.log("  ✔ σκοτώθηκε «" + name + "» (" + fails[0].slice(0, 70) + ")"); } else console.log("  ✗ ΕΠΕΖΗΣΕ «" + name + "»");
}
console.log("μεταλλάξεις " + dead + "/" + MUT.length);
process.exit(dead === MUT.length ? 0 : 1);
