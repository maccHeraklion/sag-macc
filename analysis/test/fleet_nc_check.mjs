#!/usr/bin/env node
/* Ελεγκτής T-FLEET-NC-01 (v50.188): ο πίνακας στόλου βλέπει τα όργανα των εγγραφών χωρίς ρύθμιση φόρμας.
 *   node analysis/test/fleet_nc_check.mjs            → έλεγχοι
 *   node analysis/test/fleet_nc_check.mjs --mutate   → κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτώνεται
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CORE0 = readFileSync(join(ROOT, "analysis/runPerTich.js"), "utf8");
const PAGE0 = readFileSync(join(ROOT, "custom_html_files/sag-fleet.html"), "utf8");
const A = "/* ══ T-FLEET-NC-01", B = "// ── T-FLEET-HEALTH-01 (v50.143";
const ID1 = "aaaaaaaaaaaaaaaaaaaaaaa1", ID2 = "bbbbbbbbbbbbbbbbbbbbbbb2", ID3 = "ccccccccccccccccccccccc3";
const NOW = Date.parse("2026-11-07T21:00:00Z");
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function check(core, page) {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); }; const eq = (m, a, b) => ok(deepEq(a, b), m + ": " + JSON.stringify(a));
  const i = core.indexOf(A), j = core.indexOf(B);
  if (i < 0 || j < 0) return ["λείπει το μπλοκ"];
  let X; try { X = new Function(core.slice(i, j) + "\nreturn { _sagNcIds, _sagNcRows, _sagNcInventory, reset() { _SAG_NC_ALL = null; } };")(); } catch (e) { return ["δεν φορτώνει: " + e.message]; }
  eq("ταυτότητες αντικείμενο και πίνακας", X._sagNcIds({ a: ID1, b: [ID2, ID1], c: { d: ID3 } }), [ID1, ID2, ID3]);
  eq("όχι ταυτότητες", X._sagNcIds({ a: "όνομα", b: null, c: 5 }), []); eq("χωρίς devices", X._sagNcIds(undefined), []);
  const all = new Map([[ID1, { n: "lse", li: "2026-11-04T07:00:00Z", t: "lse01" }], [ID2, { n: "nev", li: null, t: null }]]);
  eq("σειρές", X._sagNcRows([ID1, ID2, ID3], all, NOW), [{ n: "lse", i: ID1.slice(-6), h: 86, q: 0, b: null, l: 0, t: "lse01" }, { n: "nev", i: ID2.slice(-6), h: null, q: 0, b: null, l: 0, t: null }]);
  let calls = 0; const acct = (fail) => ({ devices: { list: async (q) => { calls++; if (fail) throw new Error("x"); if (q.page > 1) return []; return [{ id: ID1, name: "lse", last_input: new Date("2026-11-07T20:00:00Z"), tags: [{ key: "type", value: "lse01" }, { key: "appkey", value: "SECRET" }] }]; } } });
  X.reset(); const r1 = await X._sagNcInventory(acct(false), { a: ID1 }, NOW); const r2 = await X._sagNcInventory(acct(false), { a: ID1 }, NOW);
  eq("ανάγνωση", r1.map((x) => [x.n, x.h, x.t]), [["lse", 1, "lse01"]]); ok(calls === 1, "μία λίστα ανά εκτέλεση: " + calls); ok(deepEq(r1, r2), "ίδιο αποτέλεσμα από τη μνήμη"); ok(!JSON.stringify(r1).includes("SECRET"), "δεν βγαίνουν άλλες ετικέτες");
  X.reset(); calls = 0; eq("χωρίς όργανα καμία κλήση", [await X._sagNcInventory(acct(false), {}, NOW), calls], [[], 0]);
  X.reset(); calls = 0; const lg = console.log; console.log = () => {}; const r3 = await X._sagNcInventory(acct(true), { a: ID1 }, NOW); const r4 = await X._sagNcInventory(acct(true), { a: ID1 }, NOW); console.log = lg; eq("αποτυχία = κενό", [r3, r4], [[], []]); ok(calls === 1, "η αποτυχία δεν ξαναδοκιμάζεται σε κάθε εγγραφή: " + calls);
  /* σοβαρότητα: εξάγεται αυτολεξεί */
  const sv = core.slice(core.indexOf("function _sagFleetSeverity("), core.indexOf("// ── T-LATLON-FROMLOCVAR-01")); const sev = new Function(sv + "\nreturn _sagFleetSeverity;")();
  eq("σιωπηλή εγγραφή χωρίς ρύθμιση = ΕΠΙΣΚΕΨΗ", sev({ nc: 1, d: [{ h: 85 }], g: [] }), 3); eq("ζωντανή = ΕΝΤΑΞΕΙ", sev({ nc: 1, d: [{ h: 1 }], g: [] }), 0); eq("αγρός χωρίς ρύθμιση = ΓΡΑΦΕΙΟ", sev({ nc: 1, d: [{ h: 1 }], g: ["x"] }), 1);
  /* σημεία ενσωμάτωσης */
  const n = core.indexOf("const _ncPurpose = _sagFieldPurpose(fields[i]);"), c = core.indexOf("continue;", n), br = core.slice(n, c);
  ok(/_sagNcInventory\(account, devices, Date\.now\(\)\)/.test(br), "ο κλάδος καλεί την απογραφή"); ok(/d: _ncInv,/.test(br), "ο κλάδος περνά τα όργανα"); ok(!/\bd: \[\],/.test(br), "έμεινε κενή λίστα");
  ok(/_SAG_FLEET\.length = 0;[^\n]*\r?\n\s*_SAG_NC_ALL = null;/.test(core), "μηδενισμός ανά εκτέλεση");
  ok(core.includes("const SAG_KERNEL_VERSION = 'v50.191 · 2026-11-09';"), "έκδοση");
  /* σελίδα */
  const w = page.slice(page.indexOf("function why(r) {"), page.indexOf("/* Έτοιμο κείμενο για τον παραγωγό")); const why = new Function("age", w + "\nreturn why;")((h) => h + "ω");
  ok(/lse σιωπά 85ω/.test(why({ nc: 1, p: "automation", d: [{ n: "lse", h: 85 }], z: [], g: [] })), "αυτοματισμός: φαίνεται η σιωπή");
  ok(/lse σιωπά 85ω/.test(why({ nc: 1, p: "agronomy", d: [{ n: "lse", h: 85 }], z: [], g: [] })), "αγρός: η σιωπή πριν από τη ρύθμιση");
  ok(/Δεν έχει ρύθμιση/.test(why({ nc: 1, d: [], z: [], g: ["x"] })), "αγρός χωρίς σκοπό: μένει το μήνυμα"); ok(/Δεν έχει ρύθμιση/.test(why({ nc: 1, p: "agronomy", d: [{ n: "a", h: 1 }], z: [], g: [] })), "ζωντανός αγρός χωρίς ρύθμιση");
  ok(why({ nc: 1, p: "weather", d: [{ n: "s", h: 1 }], z: [], g: [] }) === "Όλα τα όργανα λειτουργούν", "σταθμός χωρίς ρύθμιση δεν είναι έλλειψη");
  ok(why({ e: "x", nc: 1, d: [{ n: "a", h: 90 }] }).startsWith("Ο υπολογισμός απέτυχε"), "το σφάλμα προηγείται");
  ok(page.includes(`if (r.nc && (r.p || 'agronomy') === 'agronomy') h.push('<span class="bad">Χωρίς ρύθμιση στη φόρμα</span>');`), "γραμμή υγείας μόνο για αγρό");
  return bad;
}
const MUT = [
  ["κενή λίστα ξανά", "c", "d: _ncInv, k: [], v: [], a: [], z: [],", "d: [], k: [], v: [], a: [], z: [],"],
  ["χωρίς μηδενισμό", "c", "  _SAG_NC_ALL = null;      // T-FLEET-NC-01\r\n", ""],
  ["λίστα σε κάθε εγγραφή", "c", "    _SAG_NC_ALL = all;\r\n", "    _SAG_NC_ALL = null;\r\n"],
  ["ώρες λάθος μονάδα", "c", "Math.round((nowMs - t) / 360000) / 10", "Math.round((nowMs - t) / 60000) / 10"],
  ["άγνωστη ηλικία γίνεται 0", "c", "Number.isFinite(t) ? Math.round((nowMs - t) / 360000) / 10 : null", "Number.isFinite(t) ? Math.round((nowMs - t) / 360000) / 10 : 0"],
  ["διπλές ταυτότητες", "c", " && out.indexOf(s) < 0) out.push(s);", ") out.push(s);"],
  ["πίνακες αγνοούνται", "c", "if (Array.isArray(v)) { v.forEach(walk); return; }", "if (Array.isArray(v)) { return; }"],
  ["παλιά έκδοση", "c", "'v50.191 · 2026-11-09'", "'v50.187 · 2026-11-07'"],
  ["ρύθμιση κρύβει τη σιωπή", "p", "if (r.nc && !ncDead && (r.p || 'agronomy') === 'agronomy') return", "if (r.nc) return"],
  ["σταθμός ξανά έλλειψη", "p", "if (r.nc && !ncDead && (r.p || 'agronomy') === 'agronomy') return", "if (r.nc && !ncDead) return"],
  ["γραμμή υγείας παλιά", "p", "if (r.nc && (r.p || 'agronomy') === 'agronomy') h.push(", "if (r.nc) h.push("],
];
const bad = await check(CORE0, PAGE0);
if (bad.length) { console.log("ΑΠΟΤΥΧΙΕΣ\n" + bad.join("\n")); process.exit(1); }
console.log("fleet_nc_check: όλα εντάξει");
if (process.argv.includes("--mutate")) {
  let alive = 0;
  for (const [name, w, a, b] of MUT) { const src = w === "c" ? CORE0 : PAGE0; if (src.split(a).length !== 2) { console.log("ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + name); alive++; continue; } const m = src.replace(a, b); const f = await check(w === "c" ? m : CORE0, w === "p" ? m : PAGE0).catch((e) => ["έσκασε: " + e.message]); if (!f.length) { console.log("ΕΠΕΖΗΣΕ: " + name); alive++; } }
  console.log(`μεταλλάξεις: ${MUT.length - alive}/${MUT.length} σκοτώθηκαν`); process.exit(alive ? 1 : 0);
}
