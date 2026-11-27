// Ελεγκτής T-EXPORT-DISEASE-01 (22/11/2026): «καταγραφή ασθενειών» στην εξαγωγή αγρού (fieldExportData.js).
// Τρέχει ολόκληρη την init με ψεύτικο SDK: ένας αγρός, ένας σταθμός, bundle κωδικοποιημένα όπως ο πυρήνας,
// δηλώσεις ψεκασμού/επιθεώρησης/αναίρεσης και ημερολόγιο. Ελέγχει το CSV που «στέλνεται».
// Χρειάζεται dayjs: NODE_PATH=<φάκελος με node_modules/dayjs> node analysis/test/export_disease_check.mjs
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "fieldExportData.js");
const core = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8");
const req = createRequire(file);

const DAYJS_SHIM = createRequire(import.meta.url)("./shims/dayjs-shim.cjs");
// T-EXPORT-UTC-01: τα δημόσια JSON της περιγραφής σερβίρονται από το repo· FETCH_FAIL προσομοιώνει μη διαθέσιμα αρχεία.
let FETCH_FAIL = false;
const PUB = { "sag-data-dictionary.json": path.join(here, "..", "..", "changelog", "data_dictionary.json"), "sag-changelog.json": path.join(here, "..", "..", "changelog", "system_changelog.json") };
globalThis.fetch = async (url) => {
  const name = Object.keys(PUB).find((k) => String(url).includes("/html_files/" + k));
  if (FETCH_FAIL || !name) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(PUB[name], "utf8")) };
};
const FIELD = "f".repeat(24), STATION = "a".repeat(24), FORM = "c".repeat(24);
const grab = (name) => { const i = core.indexOf("const " + name + " = ["); const j = core.indexOf("];", i); return new Function("return " + core.slice(i + name.length + 9, j + 1))(); };
const KP = grab("_SAG_KEYMAP_PATHOGENS"), KR = grab("_SAG_KEYMAP_PREFIXES");
const enc = (k) => { for (const p of KR.slice().sort((a, b) => b.length - a.length)) if (k.startsWith(p)) { const i = KP.indexOf(k.slice(p.length)); return i < 0 ? k : String.fromCharCode(97 + KR.indexOf(p)) + (i < 10 ? "0" : "") + i; } return k; };
const bundle = (time, crops) => {
  const c = crops.map((x) => ({ id: x.id, indicators: Object.fromEntries(Object.entries(x.ind).map(([k, v]) => [enc(k), v])) }));
  return { variable: "field_bundle", value: 1, time, id: "b" + time,
    metadata: { schema: { compression: "deflate-raw-base64" }, data: zlib.deflateRawSync(Buffer.from(JSON.stringify({ shared: {}, crops: c }))).toString("base64") } };
};
const card = (v, text) => ({ value: v, metadata: { color: "x", text } });

function makeData(variant) {
  const D = { [FIELD]: [], [STATION]: [] };
  D[STATION].push({ variable: "air_temperature", value: 18.2, time: "2026-11-20T10:00:00.000Z", id: "s1" });
  if (variant === "kbdi") D[STATION].push({ variable: "kbdi1", value: 12.5, time: "2026-11-20T21:59:50.000Z", id: "k1" });
  if (variant === "nomodel") return D;
  D[FIELD].push({ variable: "configuration", time: "2026-11-01T00:00:00Z", id: "cfg",
    value: JSON.stringify({ crops: [{ id: "vegetablecrops:tomato:1", cultivation_type: "tomato" }] }) });
  // 20/11 Athens: Υψηλός at 2 hours, Σοβαρός at 1 → max Σοβαρός, 3 high hours; Χαμηλός pathogen never exported.
  D[FIELD].push(bundle("2026-11-20T08:00:00.000Z", [{ id: "vegetablecrops:tomato:1", ind: { fir_message_phytophthora_infestans: card("Υψηλός κίνδυνος", "κείμενο Υ"), fir_message_botrytis_cinerea: card("Χαμηλός κίνδυνος", "χ") } }]));
  D[FIELD].push(bundle("2026-11-20T09:00:00.000Z", [{ id: "vegetablecrops:tomato:1", ind: { fir_message_phytophthora_infestans: card("Σοβαρός κίνδυνος", "κείμενο Σ, με κόμμα") } }]));
  D[FIELD].push(bundle("2026-11-20T10:00:00.000Z", [{ id: "vegetablecrops:tomato:1", ind: { fir_message_phytophthora_infestans: card("Υψηλός κίνδυνος", "κείμενο Υ2") } }]));
  // T-EXPORT-UTC-01: 20/11 23:00 UTC = 21/11 01:00 ώρα Ελλάδας → ανήκει στην ημέρα UTC 20/11.
  D[FIELD].push(bundle("2026-11-20T23:00:00.000Z", [{ id: "olive:koroneiki:2", ind: { fir_message_spilocaea_oleagina: card("Μέτριος κίνδυνος", "νυχτερινό") } }]));
  // 21/11: Μέτριος only, crop id not in config → parsed from id
  D[FIELD].push(bundle("2026-11-21T12:00:00.000Z", [{ id: "olive:koroneiki:2", ind: { fir_message_spilocaea_oleagina: card("Μέτριος κίνδυνος", "μέτριο") } }]));
  if (variant === "lowonly") { D[FIELD] = D[FIELD].filter((x) => x.variable !== "field_bundle"); D[FIELD].push(bundle("2026-11-20T08:00:00.000Z", [{ id: "x:tomato:1", ind: { fir_message_botrytis_cinerea: card("Χαμηλός κίνδυνος", "χ") } }])); }
  D[FIELD].push({ variable: "spray_declaration", value: "init", time: "2026-11-19T00:00:00Z", id: "i1" });
  D[FIELD].push({ variable: "spray_declaration", time: "2026-11-20T11:00:00Z", id: "d1",
    value: JSON.stringify({ spray_date: "2026-11-20", target_pathogens: ["phytophthora_infestans"], protection_days: 7, product_name: "Ridomil" }) });
  D[FIELD].push({ variable: "inspection_declaration", time: "2026-11-21T07:00:00Z", id: "d2", value: JSON.stringify({ result: "inspected_clean", target_pathogens: ["botrytis_cinerea"] }) });
  D[FIELD].push({ variable: "declaration_undo", time: "2026-11-21T08:00:00Z", id: "d3", value: JSON.stringify({ k: "s", t: Date.parse("2026-11-20T11:00:00Z") / 60000, g: ["phytophthora_infestans"] }) });
  D[FIELD].push({ variable: "field_calendar", time: "2026-11-21T09:00:00Z", id: "d4", value: "Περονόσπορος",
    metadata: { datetimeISO: "2026-11-21T08:30:00Z", issueText: "Κηλίδες περονόσπορου", actionText: "Αφαίρεση φύλλων", productText: "Χαλκός" } });
  return D;
}

function run(variant, includeDiseases, failBundles = false) {
  const D = makeData(variant);
  const mails = []; const valid = [];
  const reader = (id) => async (q) => {
    if (failBundles && q.variables && q.variables[0] === "field_bundle") throw new Error("boom");
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
    // dayjs: το πραγματικό αν υπάρχει (NODE_PATH), αλλιώς το υποκατάστατο πάνω στο moment-timezone (shims/dayjs-shim.cjs).
    if (m === "dayjs" || m.startsWith("dayjs/plugin/")) { try { return req(m); } catch (e) { return m === "dayjs" ? DAYJS_SHIM : () => {}; } }
    return req(m);
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", fs.readFileSync(file, "utf8"))(shim, mod, mod.exports);
  const scope = [
    { variable: "time_period", device: FORM, metadata: { start_date: "2026-11-19T22:00:00.000Z", end_date: "2026-11-22T21:59:00.000Z" } },
    { variable: "location", value: FIELD }, { variable: "email", value: "t@example.com" }, { variable: "hide_eui", value: "yes" },
    ...(includeDiseases ? [{ variable: "include_diseases", value: includeDiseases }] : []),
  ];
  return mod.exports.fn({ log() {}, environment: [], token: "t" }, scope).then(() => ({ mails, valid, mod }));
}

const f = []; const ok = (c, m) => { if (!c) f.push(m); };
const parse = (csv) => csv.replace(/^﻿/, "").trim().split("\n");

{ // Α · χωρίς include_diseases: ίδιο CSV με πριν (μόνο σταθμός)
  const { mails, valid } = await run("full", undefined);
  const L = parse(mails[0].attachment.archive);
  ok(mails.length === 1 && !L[0].includes("Ασθένειες"), "Α1 χωρίς τη σημαία δεν εμφανίζονται ασθένειες");
  ok(L.length === 3 && L[1].startsWith("Χρόνος UTC,Ώρα Ελλάδας (με ζώνη),Θερμοκρασία Αέρα"), "Α2 κεφαλίδες σταθμού: UTC + ώρα Ελλάδας (" + L[1] + ")");
  ok(L[2].startsWith("2026-11-20T10:00:00Z,2026-11-20 12:00 +02:00,18.2"), "Α2β γραμμή σε UTC + ώρα Ελλάδας με ζώνη (" + L[2] + ")");
  ok(valid.at(-1).metadata.type === "success", "Α3 πράσινο μήνυμα");
}
{ // Β · με τη σημαία
  const { mails, valid } = await run("full", "yes");
  const L = parse(mails[0].attachment.archive);
  ok(L[0].includes("Δοκιμή - Ασθένειες - Ημερήσιος κίνδυνος") && L[0].includes("Δοκιμή - Ασθένειες - Δηλώσεις"), "Β1 δύο νέα μπλοκ");
  ok(L[1].includes("Ημερομηνία (UTC),Καλλιέργεια,Ασθένεια / Εχθρός,Μέγιστος κίνδυνος,Ώρες σε υψηλό ή σοβαρό,Σχόλιο συστήματος"), "Β2 στήλες κινδύνου");
  const body = L.slice(2).join("\n");
  ok(body.includes('2026-11-20,Ντομάτα,Περονόσπορος Σολανωδών,Σοβαρός κίνδυνος,3,"κείμενο Σ, με κόμμα"'), "Β3 μέγιστο/ώρες/κείμενο κορυφής 20/11");
  ok(body.includes("2026-11-20,Κορωνέικη,Κυκλοκόνιο Ελιάς,Μέτριος κίνδυνος,0,νυχτερινό"), "Β4β ημέρα UTC (23:00 UTC = 01:00 Ελλάδας)");
  ok(body.includes("2026-11-21,Κορωνέικη,Κυκλοκόνιο Ελιάς,Μέτριος κίνδυνος,0,μέτριο"), "Β4 καλλιέργεια από το id, Μέτριος");
  ok(!body.includes("Τεφρά Σήψη,Χαλκός") && !/Τεφρά Σήψη,Χαμηλός/.test(body), "Β5 ο Χαμηλός δεν εξάγεται");
  ok(body.includes("2026-11-20T11:00:00Z,Ψεκασμός,Περονόσπορος Σολανωδών,Ridomil,7,2026-11-20"), "Β6 ψεκασμός");
  ok(body.includes("2026-11-21T07:00:00Z,Επιθεώρηση - χωρίς προσβολή,Τεφρά Σήψη"), "Β7 επιθεώρηση");
  ok(body.includes("2026-11-21T08:00:00Z,Αναίρεση ψεκασμού της 2026-11-20T11:00:00Z,Περονόσπορος Σολανωδών"), "Β8 αναίρεση");
  ok(body.includes("2026-11-21T08:30:00Z,Ημερολόγιο - Πρόβλημα: Κηλίδες περονόσπορου | Ενέργεια: Αφαίρεση φύλλων,,Χαλκός"), "Β9 ημερολόγιο");
  ok(!body.includes("init"), "Β10 οι σπόροι 'init' δεν εμφανίζονται");
  const widths = L.map((l) => l.split(",").length);
  ok(L[2].split(",").length >= 2 + 6 + 6, "Β11 πλάτος γραμμής");
  ok(valid.at(-1).metadata.type === "success", "Β12 πράσινο μήνυμα (" + valid.at(-1).value + ")");
  void widths;
}
{ // Γ · αγρός χωρίς παραμετροποίηση (CSS Boost σήμερα)
  const { mails } = await run("nomodel", "yes");
  const body = parse(mails[0].attachment.archive).join("\n");
  ok(body.includes("ο αγρός δεν έχει παραμετροποιηθεί"), "Γ1 εξήγηση όταν δεν υπάρχουν εκτιμήσεις");
  ok(body.includes("Καμία δήλωση ψεκασμού ή επιθεώρησης"), "Γ2 εξήγηση όταν δεν υπάρχουν δηλώσεις");
}
{ // Δ · μόνο χαμηλός κίνδυνος
  const { mails } = await run("lowonly", "true");
  ok(parse(mails[0].attachment.archive).join("\n").includes("Κανένας κίνδυνος πάνω από «Χαμηλός»"), "Δ1 εξήγηση χαμηλού");
}
{ // Ε · αποτυχία ανάγνωσης bundle → κίτρινο, όχι σιωπηλή επιτυχία
  const { mails, valid } = await run("full", "yes", true);
  ok(mails.length === 1 && valid.at(-1).metadata.type === "warning" && /καταγραφή ασθενειών/.test(valid.at(-1).value), "Ε1 ελλιπής εξαγωγή δηλώνεται");
}
{ // Ζ · T-EXPORT-UTC-01: περιγραφή, ονόματα αρχείων, θερινή ώρα
  const { mails, mod } = await run("kbdi", undefined);
  const m = mails[0];
  ok(/Χρόνος αναφοράς/.test(m.message) && /\[air_temperature\]/.test(m.message) && m.message.includes("sag-changelog.html"), "Ζ1 η περιγραφή συνοδεύει το email");
  ok(m.message.includes("⚠ Γνωστό ζήτημα: SC-0005"), "Ζ2 γνωστό ζήτημα KBDI στο email");
  ok(/Τελευταίες αλλαγές συστήματος \(SC-\d{4}\)/.test(m.message), "Ζ3 τελευταίες αλλαγές συστήματος");
  ok(m.attachment.filename.includes("_2026-11-19_2026-11-22_UTC_") && / UTC\)$/.test(m.subject), "Ζ4 όνομα αρχείου/θέμα σε UTC (" + m.attachment.filename + " | " + m.subject + ")");
  const T = mod.exports._test;
  ok(T.fmtLocal("2026-10-25T00:30:00Z") === "2026-10-25 03:30 +03:00" && T.fmtLocal("2026-10-25T01:30:00Z") === "2026-10-25 03:30 +02:00", "Ζ5 η διπλή ώρα της 25/10 ξεχωρίζει με τη ζώνη");
  ok(T.fmtUtc("2026-10-25T01:30:00+02:00") === "2026-10-24T23:30:00Z", "Ζ6 UTC από οποιαδήποτε ζώνη");
  FETCH_FAIL = true;
  const r2 = await run("full", undefined);
  FETCH_FAIL = false;
  ok(r2.mails.length === 1 && /δεν ήταν διαθέσιμη/.test(r2.mails[0].message), "Ζ7 χωρίς δημόσια αρχεία: η εξαγωγή φεύγει και λέει πού είναι η περιγραφή");
}
{ // ΣΤ · ο πίνακας κλειδιών ίδιος με του πυρήνα
  const src = fs.readFileSync(file, "utf8");
  const g2 = (n) => { const i = src.indexOf("const " + n + " = ["); return new Function("return " + src.slice(i + n.length + 9, src.indexOf("];", i) + 1))(); };
  ok(JSON.stringify(g2("BUNDLE_KEYMAP_PATHOGENS")) === JSON.stringify(KP) && JSON.stringify(g2("BUNDLE_KEYMAP_PREFIXES")) === JSON.stringify(KR), "ΣΤ1 keymap = πυρήνας");
}

if (f.length) { console.log("ΑΠΟΤΥΧΙΑ " + f.length + ":\n  " + f.join("\n  ")); process.exit(1); }
console.log("export_disease_check: όλα ΟΚ");
