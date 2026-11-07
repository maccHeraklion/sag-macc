/* T-GWMAP-04 (7/11/2026) — ΕΛΕΓΧΟΣ: ενιαίος χάρτης στόλου.
 *
 * Τρέχει ΠΡΑΓΜΑΤΙΚΟ κώδικα με συνθετικά δεδομένα, χωρίς δίκτυο και χωρίς TagoIO:
 *   · τον patcher πάνω σε προσωρινό αντίγραφο (το analysis/gatewayLiveness.js δεν αγγίζεται· αν έχει ήδη εφαρμοστεί, διαβάζεται αυτό),
 *   · τις καθαρές συναρτήσεις του map_field,
 *   · ΟΛΟΚΛΗΡΗ την ανάλυση σε ψεύτικο API (απομόνωση αποτυχίας, αναγνώσεις, διαρροή ετικετών),
 *   · τη λογική της σελίδας (<script id="sag-logic">) πάνω στο fixture.
 * Κάθε μετάλλαξη πρέπει να σκοτωθεί.
 */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const PATCHER = here("../../deploy/patchers/patch_gwmap04_mapfield.py");
const AN_PATH = here("../gatewayLiveness.js");
const HTML0 = readFileSync(here("../../custom_html_files/sag-map.html"), "utf8").replace(/\r\n/g, "\n");
const FIX = JSON.parse(readFileSync(here("./fixtures/sag_map_fixture.json"), "utf8"));
const ORIG = readFileSync(AN_PATH, "utf8");
const SECRET = "ΜΥΣΤΙΚΟ-ΚΛΕΙΔΙ-ΣΥΣΚΕΥΗΣ";

function patched() {
  if (ORIG.includes("T-GWMAP-04")) return ORIG;
  const dir = mkdtempSync(join(tmpdir(), "gwmap04-"));
  const out = join(dir, "patched.js");
  const r = spawnSync("python", [PATCHER, "--out", out], { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (r.status !== 0) { console.log("✗✗ Ο PATCHER ΑΠΕΤΥΧΕ:\n" + r.stdout + r.stderr); process.exit(1); }
  const s = readFileSync(out, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return s;
}
const AN0 = patched();
const after = readFileSync(AN_PATH, "utf8");
if (after !== ORIG) { console.log("✗✗ Ο ΕΛΕΓΧΟΣ ΑΛΛΑΞΕ ΤΟ ΑΡΧΕΙΟ ΤΗΣ ΑΝΑΛΥΣΗΣ"); process.exit(1); }

function fn(src, name) {
  const s = src.indexOf("function " + name + "(");
  if (s < 0) throw new Error("δεν βρέθηκε η " + name);
  let d = 0;
  for (let j = src.indexOf("{", s); j < src.length; j++) {
    if (src[j] === "{") d++;
    else if (src[j] === "}" && --d === 0) return src.slice(s, j + 1);
  }
  throw new Error("δεν έκλεισε η " + name);
}
function loadPure(AN) {
  const block = AN.slice(AN.indexOf("const MAP_ROW_MAX"), AN.indexOf("// ═══ T-GWMAP-04 (ΤΕΛΟΣ)"));
  const sb = { console: { log() { sb.logged++; } }, logged: 0 };
  vm.createContext(sb);
  vm.runInContext(AN.match(/const GR_BOX = [^\n]+/)[0] + "\n" + ["ageHours", "haversineKm", "truncName"].map((n) => fn(AN, n)).join("\n")
    + "\n" + block + "\nglobalThis.X = { buildMapFieldRows, mapFieldPosition, mapFieldDevices, mapDeviceTypes, mapGatewayOf, mapFitRow };", sb);
  return sb;
}

/* ── ψεύτικο API: ΟΛΟΚΛΗΡΗ η ανάλυση ─────────────────────────────────────── */
const ID = (n) => "abcdef" + String(n).padStart(18, "0");
const OVERSEER = "6a98855ca06e41000bfae024";
function fakeWorld() {
  const devices = [1, 2, 3].map((n) => ({ id: ID(n), name: "Δοκ όργανο " + n, last_input: new Date(Date.now() - n * 36e5).toISOString(),
    tags: [{ key: "type", value: n === 3 ? "S2120" : "se0x" }, { key: "device_key", value: SECRET }] }));
  const fields = [{ id: ID(50), name: "Field_Α", tags: [{ key: "isField", value: "yes" }, { key: "name", value: "Δοκ Α" }, { key: "clientName", value: "Π" },
    { key: "coordinates", value: "37.1, 22.1" }, { key: "device_key", value: SECRET },
    { key: "devices", value: JSON.stringify({ a: ID(1), b: ID(2), c: ID(3) }) }] }];
  return { devices, fields };
}
async function runAnalysis(AN, opt = {}) {
  const W = fakeWorld(), gets = [], posts = [], logs = [];
  let done;
  const finished = new Promise((r) => { done = r; });
  const ok = (result) => ({ json: async () => ({ status: true, result }) });
  const fetchFake = async (url, o = {}) => {
    const p = url.replace("https://api.us-e1.tago.io", "");
    if (o.method === "POST") {
      posts.push(JSON.parse(o.body));
      if (opt.failPost === posts.length) return { json: async () => ({ status: false, message: "απόρριψη" }) };
      return ok("ok");
    }
    gets.push(p);
    if (p.includes("filter[network]")) {
      const wantTags = p.includes("fields[]=tags");
      return ok(W.devices.map((d) => { const c = { ...d }; if (!wantTags) delete c.tags; return JSON.parse(JSON.stringify(c)); }));
    }
    if (p.includes("is_gateway")) return ok([]);
    if (p.includes("isField")) {
      if (opt.failFields) return { json: async () => ({ status: false, message: "x" }) };
      return ok(JSON.parse(JSON.stringify(W.fields)));
    }
    if (p.includes("gateway_scan_state")) return ok([{ metadata: { ids: ID(1) + "," + ID(2), cursor: 0, pos: { L1: { lat: 37.1, lon: 22.2 } } } }]);
    if (p.includes("variables[]=gateway_row")) return ok([]);
    const m = p.match(/^\/device\/([0-9a-f]{24})\/data/);
    if (m && p.includes("lrrid")) {
      if (m[1] === ID(3)) return ok([]);
      return ok([{ variable: "lrrid", value: "L1", time: new Date().toISOString() }]);
    }
    return ok([]);
  };
  const sb = { console: { log: (s) => { logs.push(String(s)); if (/══ gatewayLiveness · ΤΕΛΟΣ/.test(String(s))) done(); } },
    fetch: fetchFake, process: { env: { T_ANALYSIS_TOKEN: "t" } }, Date, Promise, setTimeout };
  vm.createContext(sb);
  vm.runInContext(AN, sb);
  await Promise.race([finished, new Promise((r) => setTimeout(r, 3000))]);
  await new Promise((r) => setTimeout(r, 5));
  return { gets, posts, logs };
}

/* ── σενάρια ανάλυσης ───────────────────────────────────────────────────── */
const T = (k, v) => ({ key: k, value: v });
const cfg = (la, lo, more = {}) => T("configuration", JSON.stringify({ latitude: la, longitude: lo, ...more }));

async function scenariosAnalysis(AN) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  const sb = loadPure(AN), X = sb.X;
  const P = (tags) => { const p = X.mapFieldPosition(tags); return [p.y, p.x, p.ps, p.pq]; };

  // Α · θέση
  want("Α1 η φόρμα προηγείται της ετικέτας", P([cfg(37.1, 22.1), T("coordinates", "37.1001, 22.1001")]), [37.1, 22.1, "form", "ok"]);
  want("Α2 χωρίς φόρμα: ετικέτα", P([T("coordinates", "37.2, 22.2")]), [37.2, 22.2, "tag", "ok"]);
  want("Α3 null στη φόρμα δεν είναι 0", P([cfg(null, null), T("coordinates", "37.2, 22.2")]), [37.2, 22.2, "tag", "ok"]);
  want("Α4 κενή φόρμα", P([cfg("", ""), T("coordinates", "37.2, 22.2")]), [37.2, 22.2, "tag", "ok"]);
  want("Α5 φόρμα 0,0 απορρίπτεται", P([cfg(0, 0), T("coordinates", "37.2, 22.2")]), [37.2, 22.2, "tag", "ok"]);
  want("Α6 χαλασμένο JSON φόρμας", P([T("configuration", "{όχι"), T("coordinates", "37.2, 22.2")]), [37.2, 22.2, "tag", "ok"]);
  want("Α7 φόρμα με αριθμητικές συμβολοσειρές", P([cfg("37.3", "22.3")]), [37.3, 22.3, "form", "ok"]);
  want("Α8 καμία θέση", P([T("coordinates", "37°18'N 22°06'E")]), [null, null, null, "none"]);
  want("Α9 διπλή ετικέτα με διαφορετικές τιμές", P([T("coordinates", "37.2, 22.2"), T("coordinates", "37.4, 22.4")])[3], "dup");
  want("Α10 ίδια τιμή δύο φορές δεν είναι διπλή", P([T("coordinates", "37.2, 22.2"), T("coordinates", "37.2,22.2")])[3], "ok");
  want("Α11 φόρμα και ετικέτα > 1 km", P([cfg(37.1, 22.1), T("coordinates", "37.2, 22.2")])[3], "diff");
  want("Α12 πέντε δεκαδικά", P([T("coordinates", "37.1234567, 22.7654321")]).slice(0, 2), [37.12346, 22.76543]);

  // Β · γραμμή
  const now = Date.parse("2026-11-07T12:00:00Z");
  const d1 = "a".repeat(24), d2 = "b".repeat(24), d3 = "c".repeat(24), d4 = "d".repeat(24);
  const devs = [{ id: d1, name: "Σταθμός", last_input: new Date(now - 7.26 * 36e5).toISOString() }, { id: d2, name: "Σόνδα", last_input: new Date(now - 36e5).toISOString() },
    { id: d3, name: "Ποτέ", last_input: null }];
  const typeOf = new Map([[d1, "s2120"], [d2, "se0x"]]);
  const gwOf = new Map([[d2, "L1"]]);
  const rec = { id: "e".repeat(24), name: "Field_Α", tags: [T("isField", "yes"), T("name", "Αγρός Α"), T("clientName", "Παραγωγός"), T("coordinates", "37.1, 22.1"),
    T("devices", JSON.stringify({ "Από ετικέτα": d4, Σταθμός: d1, Σόνδα: d2, Ποτέ: d3 })), T("device_key", SECRET), cfg(37.1, 22.1, { phone: SECRET })] };
  const rows = X.buildMapFieldRows({ fields: [rec], devs, typeOf, gwOf, now });
  const m = rows[0].metadata;
  want("Β1 μία γραμμή ανά εγγραφή", rows.length, 1);
  want("Β2 μεταβλητή", rows[0].variable, "map_field");
  want("Β3 κλειδιά metadata", Object.keys(m).sort(), ["c", "dv", "i", "n", "pq", "ps", "x", "y"]);
  want("Β4 ταυτότητα, όνομα από ετικέτα, παραγωγός", [m.i, m.n, m.c], ["e".repeat(24), "Αγρός Α", "Παραγωγός"]);
  want("Β5 κλειδιά οργάνου", Object.keys(m.dv[0]).sort(), ["g", "h", "i", "n", "t"]);
  const by = Object.fromEntries(m.dv.map((d) => [d.n, d]));
  want("Β6 τύπος από την ετικέτα", [by["Σταθμός"].t, by["Σόνδα"].t], ["s2120", "se0x"]);
  want("Β7 ώρες με ένα δεκαδικό", by["Σταθμός"].h, 7.3);
  want("Β8 ποτέ = null, όχι 0", by["Ποτέ"].h, null);
  want("Β9 γνωστή πύλη / άγνωστη = null", [by["Σόνδα"].g, by["Σταθμός"].g], ["L1", null]);
  want("Β10 όργανο εκτός καταλόγου κρατά το όνομα της ετικέτας", [by["Από ετικέτα"] && by["Από ετικέτα"].h, by["Από ετικέτα"] && by["Από ετικέτα"].t], [null, null]);
  want("Β11 τελευταία 6 της ταυτότητας", by["Σόνδα"].i, "bbbbbb");
  want("Β12 ίδια ώρα σε όλη την παρτίδα", rows[0].time, "2026-11-07T12:00:00.000Z");
  want("Β13 αξία = πλήθος οργάνων", rows[0].value, 4);
  want("Β14 τα χειρότερα πρώτα", m.dv.map((d) => d.n).slice(-2), ["Σταθμός", "Σόνδα"]);

  // Γ · όργανα αγρού
  want("Γ1 χαλασμένο devices: ids με regex", X.mapFieldDevices([T("devices", "κάτι " + d1 + " και " + d2)]).map((x) => x.id), [d1, d2]);
  want("Γ2 διπλή ετικέτα devices: ενώνονται", X.mapFieldDevices([T("devices", JSON.stringify({ a: d1 })), T("devices", JSON.stringify({ b: d2, a: d1 }))]).map((x) => x.id), [d1, d2]);
  want("Γ3 άκυρη ταυτότητα αγνοείται", X.mapFieldDevices([T("devices", JSON.stringify({ a: "όχι" }))]), []);
  want("Γ4 πίνακας ταυτοτήτων", X.mapFieldDevices([T("devices", JSON.stringify([d1]))]).map((x) => x.id), [d1]);
  want("Γ5 αγρός χωρίς όργανα", X.buildMapFieldRows({ fields: [{ id: d1, name: "x", tags: [] }], devs: [], now })[0].metadata.dv, []);
  want("Γ6 αντιστροφή πύλης", [...X.mapGatewayOf(new Map([["L1", { list: [{ id: d1 }] }], ["L2", { list: [] }]])).entries()], [[d1, "L1"]]);

  // Δ · όριο μεγέθους: πρώτα τα ονόματα
  const longName = "Όργανο με πολύ πολύ μακρύ όνομα που δεν χωράει εύκολα ";
  const mk = (n) => { const ids = Array.from({ length: n }, (_, k) => k.toString(16).padStart(24, "0"));
    const map = {}; ids.forEach((id, k) => { map[longName + k] = id; });
    return { ids, f: { id: d1, name: "x", tags: [T("devices", JSON.stringify(map))] },
      devs: ids.map((id, k) => ({ id, name: longName + k, last_input: new Date(now - (k + 1) * 36e5).toISOString() })) }; };
  let w = mk(14), r = X.buildMapFieldRows({ fields: [w.f], devs: w.devs, now })[0].metadata;
  want("Δ1 14 όργανα: κάτω από 1500", JSON.stringify(r).length < 1500, true);
  want("Δ2 14 όργανα: κανένα δεν έφυγε, κόπηκαν ονόματα", [r.dv.length, r.dc, r.dv[0].n.length < longName.length], [14, undefined, true]);
  w = mk(60); r = X.buildMapFieldRows({ fields: [w.f], devs: w.devs, now })[0].metadata;
  want("Δ3 60 όργανα: κάτω από 1500", JSON.stringify(r).length < 1500, true);
  want("Δ4 μετριέται τι έφυγε", r.dv.length + r.dc, 60);
  want("Δ5 φεύγουν τα πιο υγιή, μένει το πιο σιωπηλό", r.dv[0].h, 60);
  want("Δ6 μικρή γραμμή μένει ανέπαφη", X.buildMapFieldRows({ fields: [rec], devs, typeOf, gwOf, now })[0].metadata.dv.some((d) => d.n === "Σταθμός"), true);
  const huge = X.buildMapFieldRows({ fields: [{ id: d1, name: "x", tags: [T("name", "Ο".repeat(3000)), T("clientName", "Π".repeat(3000))] }], devs: [], now })[0].metadata;
  want("Δ7 παθολογικό όνομα", JSON.stringify(huge).length < 1500, true);

  // Ε · κοινό σημείο
  const at = (id, c, coords) => ({ id, name: "x", tags: [T("coordinates", coords), ...(c ? [T("clientName", c)] : [])] });
  const pq = (fs) => X.buildMapFieldRows({ fields: fs, devs: [], now }).map((x) => x.metadata.pq);
  want("Ε1 διαφορετικοί παραγωγοί: shared", pq([at(d1, "Α", "37.1, 22.1"), at(d2, "Β", "37.1, 22.1")]), ["shared", "shared"]);
  want("Ε2 ίδιος παραγωγός: όχι", pq([at(d1, "Α", "37.1, 22.1"), at(d2, "Α", "37.1, 22.1")]), ["ok", "ok"]);
  want("Ε3 χωρίς παραγωγό: δεν μετρά ως δεύτερος", pq([at(d1, "Α", "37.1, 22.1"), at(d2, null, "37.1, 22.1")]), ["ok", "ok"]);

  // ΣΤ · ετικέτες
  const js = JSON.stringify(rows);
  want("ΣΤ1 τίποτα από άλλες ετικέτες στη γραμμή", js.includes(SECRET), false);
  want("ΣΤ2 οι καθαρές συναρτήσεις δεν τυπώνουν", sb.logged, 0);
  const list = [{ id: d1, tags: [T("Type", "S2120"), T("device_key", SECRET)] }, { id: d2, tags: [] }, null];
  const ty = X.mapDeviceTypes(list);
  want("ΣΤ3 τύπος με πεζά, ανεξάρτητα από το κλειδί", ty.get(d1), "s2120");
  want("ΣΤ4 οι ετικέτες σβήνονται από τον κατάλογο", [list[0].tags, list[1].tags], [undefined, undefined]);

  // Ζ · ολόκληρη η ανάλυση
  const base = await runAnalysis(AN);
  const before = await runAnalysis(ORIG.includes("T-GWMAP-04") ? AN : ORIG);
  const allOut = JSON.stringify(base.posts) + base.logs.join("\n");
  want("Ζ1 τρεις εγγραφές: κάρτες, χάρτης, μνήμη πυλών", [base.posts.length, base.posts[2] && base.posts[2][0].variable], [3, "gateway_heard_state"]);
  want("Ζ2 πρώτη εγγραφή: κάρτα πύλης, κανένα map_field", [base.posts[0].some((r) => r.variable === "gateway_row"), base.posts[0].some((r) => r.variable === "map_field")], [true, false]);
  want("Ζ3 δεύτερη εγγραφή: μόνο map_field", (base.posts[1] || []).every((r) => r.variable === "map_field") && (base.posts[1] || []).length === 1, true);
  const row = (base.posts[1] || [{ metadata: { dv: [] } }])[0].metadata;
  want("Ζ4 πύλη και τύπος από την εκτέλεση", row.dv.map((d) => [d.t, d.g]).sort(), [["s2120", null], ["se0x", "L1"], ["se0x", "L1"]]);
  want("Ζ5 ίδιος αριθμός αναγνώσεων με πριν", base.gets.length, before.gets.length);
  want("Ζ6 καμία ανάγνωση location", base.gets.some((p) => p.includes("location")), false);
  want("Ζ7 καμία τιμή ετικέτας σε log ή εγγραφή", allOut.includes(SECRET), false);
  want("Ζ8 ο κατάλογος ζητά τις ετικέτες", base.gets[0].includes("fields[]=tags"), true);
  const rej = await runAnalysis(AN, { failPost: 2 });
  want("Ζ9 απόρριψη map_field: οι κάρτες γράφτηκαν", rej.posts[0].some((r) => r.variable === "gateway_row"), true);
  want("Ζ10 απόρριψη map_field: καθαρό τέλος", [rej.logs.some((l) => l.includes("ΧΑΡΤΗΣ|σφάλμα")), rej.logs.some((l) => l.includes("ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ")), rej.logs.some((l) => l.includes("ΣΥΝΟΨΗ|"))], [true, false, true]);
  const nof = await runAnalysis(AN, { failFields: true });
  want("Ζ11 χωρίς αγρούς: κάρτες και μνήμη, κανένα map_field", [nof.posts.length, nof.posts[0].some((r) => r.variable === "gateway_row"), nof.posts.flat().some((r) => r.variable === "map_field")], [2, true, false]);
  // ΕΓΧΥΣΗ ΣΦΑΛΜΑΤΟΣ: η καθαρή συνάρτηση πέφτει με μήνυμα που περιέχει τιμή ετικέτας
  const sig = "function buildMapFieldRows({ fields, devs, typeOf, gwOf, heard, now }) {\n";
  if (AN.split(sig).length !== 2) bad.push("Ζ12 δεν εφαρμόστηκε η έγχυση");
  const boom = await runAnalysis(AN.replace(sig, sig + `  throw new Error("${SECRET}");\n`));
  want("Ζ12 πτώση της συνάρτησης: οι κάρτες γράφτηκαν", (boom.posts[0] || []).some((r) => r.variable === "gateway_row"), true);
  want("Ζ13 πτώση της συνάρτησης: το μήνυμα δεν τυπώνεται", boom.logs.join("\n").includes(SECRET), false);
  want("Ζ14 πτώση της συνάρτησης: η ανάλυση τελείωσε", boom.logs.some((l) => l.includes("ΣΥΝΟΨΗ|")), true);
  return bad;
}

/* ── σενάρια σελίδας ────────────────────────────────────────────────────── */
function loadPage(HTML) {
  const m = HTML.match(/<script id="sag-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("λείπει το sag-logic");
  const sb = {};
  vm.createContext(sb);
  vm.runInContext(m[1], sb);
  return sb;
}
function scenariosPage(HTML) {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  const S = loadPage(HTML);
  const NOW = Date.parse(FIX.base);
  const raw = S.ingestRows(S.newRaw(), FIX.rows);
  raw.names = FIX.names;
  const M = S.buildModel(raw, NOW);
  const G = (c) => M.gws.find((g) => g.code === c);
  const R = (n) => M.gws.find((g) => g.name === n);
  const F = (n) => M.fields.find((f) => f.name === n);

  // Α · στατικά
  want("Α1 [hidden] ισχύει σε όλη τη σελίδα", /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(HTML), true);
  want("Α2 Leaflet 1.9.4 από unpkg", HTML.includes("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"), true);
  want("Α3 το SDK δεν φορτώνεται στατικά", /<script[^>]+admin\.tago\.io/.test(HTML), false);
  want("Α4 fixture μόνο χωρίς TagoIO και εκτός iframe", /FIXTURE = .*window\.top === window\.self && !window\.TagoIO/.test(HTML), true);
  want("Α5 καμία αποθήκευση στον browser", /localStorage|sessionStorage|indexedDB|document\.cookie/.test(HTML.replace(/\/\*[\s\S]*?\*\//g, "")), false);
  want("Α6 το fixture δεν γράφει τίποτα στο TagoIO", /sendData|sendDownlink/.test(HTML), false);

  // Β · φρουροί
  want("Β1 άγνωστη σοβαρότητα = ΕΛΕΓΧΟΣ", [S.sev(undefined), S.sev(null), S.sev(""), S.sev(9), S.sev("1")], [2, 2, 2, 2, 1]);
  want("Β2 ηλικία σε λέξεις", [S.ageWords(0.5), S.ageWords(1), S.ageWords(5), S.ageWords(72)], ["πριν 30 λεπτά", "πριν 1 ώρα", "πριν 5 ώρες", "πριν 3 ημέρες"]);
  want("Β3 κακή ηλικία δεν ρίχνει τη σελίδα", [S.ageWords("5"), S.ageWords(null), S.ageWords(-1), S.ageWords(NaN)], Array(4).fill("άγνωστη ηλικία"));
  want("Β4 null δεν είναι 0", [S.pointOf(null, 25), S.pointOf("", ""), S.pointOf(0, 0)], [null, null, null]);
  want("Β5 κατάσταση οργάνου: όρια", [3, 3.1, 48, 48.1].map((h) => S.instrState({ h }).k), ["ok", "gaps", "gaps", "silent"]);
  want("Β6 χωρίς ηλικία: άγνωστο, όχι σιωπηλό", S.instrState({ h: null }).k, "unknown");
  want("Β7 q από τον πυρήνα: σιωπηλό", S.instrState({ h: 1, q: true }).k, "silent");
  want("Β8 esc", S.esc(`<a b="'`), "&lt;a b=&quot;&#39;");
  const rawS = S.ingestRows(S.newRaw(), [{ variable: "fleet_field", time: FIX.base, metadata: { text: JSON.stringify({ f: "Α", i: "1" }) } }]);
  want("Β9 γραμμή χωρίς σοβαρότητα δεν γίνεται ΕΝΤΑΞΕΙ", rawS.fleet["Α|1"].rec.s, 2);

  // Γ · νεότερη εγγραφή
  want("Γ1 πύλη: κερδίζει η νεότερη κάρτα", [G("DEMO00A2").sensors, G("DEMO00A2").st.k], [32, "g_alive"]);
  want("Γ2 αγρός: παλιά γραμμή στόλου χάνει", F("Δοκ Ελαιώνας Βόρειος").s, 0);
  want("Γ3 αγρός: παλιά map_field χάνει", !!F("ΠΑΛΙΟ ΟΝΟΜΑ"), false);
  want("Γ4 άκυρη γραμμή μετριέται", M.cover.bad, 1);
  const keep = S.ingestRows(S.newRaw(), [{ variable: "gateway_row", value: "L", time: "2026-11-07T10:00:00Z", metadata: { location: { lat: 37, lng: 22 } } },
    { variable: "gateway_row", value: "L", time: "2026-11-07T11:00:00Z", metadata: { sensors: 3 } }]);
  want("Γ5 κάρτα χωρίς θέση κρατά την τελευταία γνωστή", [keep.gw.L.md.location, keep.gw.L.md.sensors], [{ lat: 37, lng: 22 }, 3]);

  // Δ · θέση πυλών
  want("Δ1 κοινή θέση 3 πυλών: άγνωστη", ["DEMO00A3", "DEMO00A4", "DEMO00A5"].map((c) => [G(c).p, G(c).posKind]), Array(3).fill([null, "shared"]));
  want("Δ2 δεν ταυτίζεται με κατάλογο", G("DEMO00A3").linkedRoster, false);
  want("Δ3 χωρίς θέση από το δίκτυο", G("DEMO00A6").posKind, "none");
  want("Δ4 κανένας αγρός κοντά: ύποπτη", G("DEMO00A9").posKind, "suspect");
  want("Δ5 συμπίπτει με αγρό: ύποπτη", G("DEMO00AA").posKind, "suspect");
  want("Δ6 διπλή ετικέτα στον κατάλογο: ύποπτη", R("Δοκιμαστική Πύλη Διπλής Ετικέτας").posKind, "suspect");
  want("Δ7 ταύτιση με κατάλογο: όνομα", G("DEMO00A1").name, "Δοκιμαστική Πύλη Βορράς");
  want("Δ8 αντίπαλος στα 200 m: το όνομα μένει πιθανό", [G("DEMO00A2").name, /Νότος/.test(G("DEMO00A2").nameGuess)], ["Πύλη DEMO00A2", true]);
  want("Δ9 συγχωνευμένη δεν μετρά δύο φορές", M.gws.filter((g) => g.name === "Δοκιμαστική Πύλη Βορράς").length, 1);
  want("Δ10 πιθανό όνομα από παράμετρο: όχι βέβαιο", [G("DEMO00A9").name, G("DEMO00A9").nameGuess], ["Πύλη DEMO00A9", FIX.names.DEMO00A9.n]);
  want("Δ11 μετρητές θέσης", [M.cover.gwAll, M.cover.gwPos + M.cover.gwSus + M.gws.filter((g) => !g.p).length], [M.gws.length, M.gws.length]);

  // Ε · κατάσταση πύλης
  want("Ε1 παλιά κάρτα δεν λέει ΛΕΙΤΟΥΡΓΕΙ", [G("DEMO00A8").st.k, G("DEMO00A8").absent], ["g_nowit", true]);
  want("Ε2 αραιός μάρτυρας", G("DEMO00A6").st.k, "g_sparse");
  want("Ε3 χωρίς ταυτοποίηση / αποθήκη", [R("Δοκιμαστική Πύλη Χωρίς Μάρτυρα").st.k, R("demo_gw_06").st.k], ["g_unid", "g_storage"]);

  // ΣΤ · καταστάσεις αγρού
  want("ΣΤ1 δεν υπάρχει όργανο", F("Δοκ Χωρίς Όργανα").keys.includes("noinst"), true);
  want("ΣΤ2 δεν υπάρχει όργανο: η πινέζα το λέει", S.primaryState(F("Δοκ Χωρίς Όργανα")).k, "noinst");
  want("ΣΤ3 σιωπηλό", F("Δοκ Κηπευτικά Κάμπου").keys.includes("silent"), true);
  want("ΣΤ4 με κενά (νύχτα)", F("Δοκ Νυχτερινή Σιωπή").keys.includes("gaps"), true);
  want("ΣΤ5 χωρίς ρύθμιση", [F("Δοκ Χωρίς Ρύθμιση").computed, /ρύθμιση/.test(F("Δοκ Χωρίς Ρύθμιση").reason)], [false, true]);
  want("ΣΤ6 σφάλμα κύκλου", [F("Δοκ Σφάλμα Κύκλου").computed, /απέτυχε/.test(F("Δοκ Σφάλμα Κύκλου").reason)], [false, true]);
  want("ΣΤ7 χωρίς κάρτα ok=0", F("Δοκ Χωρίς Κάρτα").computed, false);
  want("ΣΤ8 εκτός πίνακα στόλου", [F("Δοκ Μόνο Ετικέτα").computed, F("Δοκ Μόνο Ετικέτα").s], [false, null]);
  want("ΣΤ9 χωρίς υπολογισμό: γκρίζο, όχι ΕΝΤΑΞΕΙ", [S.primaryState(F("Δοκ Χωρίς Κάρτα")).k, F("Δοκ Χωρίς Κάρτα").keys.includes("v0")], ["nocalc", false]);
  const old = S.buildModel(S.ingestRows(S.newRaw(), [{ variable: "fleet_field", time: FIX.base, metadata: { text: JSON.stringify({ f: "Α", i: "1", s: 0 }) } }]), NOW);
  want("ΣΤ10 παλιός πυρήνας χωρίς ok: υπολογισμένος", old.fields[0].computed, true);
  want("ΣΤ11 μόνο στον πίνακα στόλου: παραμένει ορατός", [!!F("Δοκ Μόνο Στόλος"), F("Δοκ Μόνο Στόλος").noMapRow, !!F("Δοκ Μόνο Στόλος").p], [true, true, true]);
  want("ΣΤ12 το όργανο του στόλου παίρνει q/μπαταρία", F("Δοκ Κηπευτικά Κάμπου").devs.some((d) => d.l), true);
  want("ΣΤ13 όργανο εκτός δικτύου: τύπος από τον στόλο", F("Δοκ Με Βάνα").devs.some((d) => d.label === "Ελεγκτής βανών"), true);

  // Ζ · ομάδες
  const grp = (n) => M.groups.find((g) => g.key === F(n).groupKey);
  want("Ζ1 ξενοδοχείο: μία πινέζα με 6, όχι ύποπτη", [grp("Δοκ Ξενοδοχείο Κήπος").fields.length, grp("Δοκ Ξενοδοχείο Κήπος").suspect], [6, false]);
  want("Ζ2 πρόχειρη θέση: 4, ύποπτη", [grp("Δοκ Πρόχειρος Ένα").fields.length, grp("Δοκ Πρόχειρος Ένα").suspect], [4, true]);
  want("Ζ3 τριπλό σημείο δύο παραγωγών: ύποπτο", [grp("Δοκ Τριπλός Α").fields.length, F("Δοκ Τριπλός Γ").suspect], [3, true]);
  want("Ζ4 κανείς δεν λείπει από τις ομάδες", M.groups.reduce((a, g) => a + g.fields.length, 0), M.fields.filter((f) => f.p).length);

  // Η · επιβεβαιωμένο / κοντά
  const heard = (g) => g.heardList.map((h) => h.f.name);
  const g1 = G("DEMO00A1");
  want("Η1 επιβεβαιωμένοι μόνο από το δίκτυο", heard(g1).sort(), ["Δοκ Αμπέλι Λόφου", "Δοκ Ελαιώνας Βόρειος", "Δοκ Κηπευτικά Κάμπου", "Δοκ Μακρινός Αγρός", "Δοκ Μόνο Ετικέτα"].sort());
  const before = heard(g1).length;
  const near = S.nearby(g1, 12, M.fields);
  want("Η2 η απόσταση δεν γίνεται σύνδεση", heard(g1).length, before);
  want("Η3 κοντινοί: όχι όσοι ακούγονται", near.list.some((n) => g1.heard[n.f.key]), false);
  want("Η4 υπάρχουν κοντινοί χωρίς επιβεβαίωση", near.list.map((n) => n.f.name).includes("Δοκ Γειτονικός Ανατολικός"), true);
  want("Η5 ο ελαιώνας χωρίς lrrid δεν μπαίνει στους ακουσμένους", heard(g1).includes("Δοκ Εσπεριδοειδή"), false);
  want("Η6 ακτίνα 0: κανείς", S.nearby(g1, 0, M.fields).list.length, 0);
  want("Η7 ύποπτη θέση πύλης: κανένας κοντινός", S.nearby(G("DEMO00A9"), 100, M.fields).list.length, 0);
  want("Η8 άγνωστη θέση πύλης: κανένας κοντινός", S.nearby(G("DEMO00A3"), 100, M.fields).list.length, 0);
  const ph = S.nearby(R("Δοκιμαστική Αποθήκη"), 60, M.fields);
  want("Η9 αγρός με ύποπτη θέση δεν μετρά", [ph.list.some((n) => n.f.suspect), ph.skipped > 0], [false, true]);
  want("Η10 πύλη χωρίς ταυτοποίηση: μόνο κοντινοί", [R("Δοκιμαστική Πύλη Χωρίς Μάρτυρα").heardList.length, S.nearby(R("Δοκιμαστική Πύλη Χωρίς Μάρτυρα"), 12, M.fields).list.length > 0], [0, true]);
  want("Η11 στάση χωρίς lrrid: άγνωστη πύλη", F("Δοκ Ελαιώνας Βόρειος").devs.find((d) => /s2120/.test(d.t)).g, null);
  want("Η12 εκτός αγρού: όχι χαμένο", G("DEMO00A1").orphans.map((o) => o.f), ["(εκτός αγρού)"]);
  // δύο εγγραφές με το ίδιο όνομα: το όνομα δεν επιβεβαιώνει
  const dup = S.buildModel(S.ingestRows(S.newRaw(), [
    { variable: "map_field", time: FIX.base, metadata: { i: "a".repeat(24), n: "Ίδιο", dv: [], y: 37, x: 22, pq: "ok", ps: "tag" } },
    { variable: "map_field", time: FIX.base, metadata: { i: "b".repeat(24), n: "Ίδιο", dv: [], y: 37.5, x: 22.5, pq: "ok", ps: "tag" } },
    { variable: "gateway_row", value: "L", time: FIX.base, metadata: { color: "green", age_h: 1, fields: [{ f: "Ίδιο", k: 1 }, { f: "Μόνο", k: 2 }] } },
    { variable: "map_field", time: FIX.base, metadata: { i: "c".repeat(24), n: "Μόνο", dv: [], y: 36.5, x: 22.5, pq: "ok", ps: "tag" } }]), NOW);
  want("Η13 διπλό όνομα: καμία επιβεβαίωση από όνομα", dup.gws[0].heardList.map((h) => h.f.name), ["Μόνο"]);
  want("Η14 διπλό όνομα: δηλώνεται", dup.gws[0].orphans[0].amb, true);

  // Θ · φίλτρα: κάθε αριθμός λέει ό,τι θα δεις
  const F0 = { view: "all", producer: "", status: "", type: "", q: "", nocalc: true };
  const V = (o) => S.visible(M, { ...F0, ...o });
  const NS = M.gws.filter((g) => g.st.k !== "g_storage").length;
  want("Θ1 Όλα, χωρίς αποθήκη", [V({}).gws.length, V({}).fields.length], [NS, M.fields.length]);
  want("Θ2 Μόνο πύλες, χωρίς αποθήκη", [V({ view: "gw" }).fields.length, V({ view: "gw" }).gws.length], [0, NS]);
  want("Θ2β αποθήκη μόνο με φίλτρο", [V({ view: "gw", status: "g_storage" }).gws.length, M.gws.length - NS > 0], [M.gws.length - NS, true]);
  want("Θ2γ μετρητές πυλών", [M.cover.gwNet + M.cover.gwUnid + M.cover.gwStore >= M.gws.length - M.gws.filter((g) => g.net && g.st.k === "g_storage").length, M.cover.gwStore], [true, M.gws.length - NS]);
  want("Θ3 Μόνο αγροί", [V({ view: "fields" }).gws.length, V({ view: "fields" }).fields.length], [0, M.fields.length]);
  const c0 = S.optionCounts(M, F0);
  for (const [p, n] of Object.entries(c0.producer)) want("Θ4 αριθμός παραγωγού " + p, V({ producer: p }).fields.length, n);
  for (const [k, n] of Object.entries(c0.status)) {
    const v = V({ status: k });
    want("Θ5 αριθμός κατάστασης " + k, /^g_/.test(k) ? v.gws.length : v.fields.length, n);
  }
  for (const [t, n] of Object.entries(c0.type)) want("Θ6 αριθμός τύπου " + t, V({ type: t }).inst, n);
  const c1 = S.optionCounts(M, { ...F0, producer: "Παραγωγός Άλφα" });
  want("Θ7 οι αριθμοί ακολουθούν τα άλλα φίλτρα", c1.status.v0 < c0.status.v0, true);
  want("Θ8 παραγωγός: μόνο οι πύλες που τον ακούν", V({ producer: "Παραγωγός Άλφα" }).gws.map((g) => g.code), ["DEMO00A1"]);
  want("Θ9 τύπος: ο σταθμός δεν δείχνει πύλη χωρίς σύνδεση", V({ type: "Μετεωρολογικός σταθμός" }).gws.length, 0);
  want("Θ10 διακόπτης χωρίς υπολογισμό", V({ nocalc: false }).fields.some((f) => !f.computed), false);
  want("Θ11 με τον διακόπτη ανοιχτό παραμένουν", V({}).fields.filter((f) => !f.computed).length > 0, true);
  want("Θ12 αναζήτηση χωρίς τόνους", V({ q: "ελαιωνας" }).fields.map((f) => f.name), ["Δοκ Ελαιώνας Βόρειος"]);
  want("Θ13 αναζήτηση κωδικού πύλης", V({ q: "DEMO00A7", view: "gw" }).gws.map((g) => g.code), ["DEMO00A7"]);
  want("Θ14 αναζήτηση οργάνου", V({ q: "lse01 03a" }).fields.map((f) => f.name), ["Δοκ Κηπευτικά Κάμπου"]);
  want("Θ15 κατάσταση πύλης: αγροί κρυμμένοι", V({ status: "g_alive" }).fields.length, 0);

  // Ι · τίποτα δεν χάνεται
  const all = S.noPosition(V({}));
  want("Ι1 χωρίς θέση: πύλες", ["Πύλη DEMO00A3", "Πύλη DEMO00A6"].every((n) => all.some((x) => x.name === n)), true);
  want("Ι2 χωρίς θέση: αγροί", ["Δοκ Χωρίς Θέση", "Δοκ Μηδενική Φόρμα"].every((n) => all.some((x) => x.name === n)), true);
  want("Ι3 χωρίς θέση με λόγο", all.every((x) => x.why), true);
  want("Ι4 σύνολο = πινέζες + λίστα", all.length + M.fields.filter((f) => f.p).length + M.gws.filter((g) => g.p && g.st.k !== "g_storage").length, M.fields.length + NS);

  // Κ · διαφάνεια
  const fr = (h) => S.freshness(M, Date.parse(FIX.base) + h * 36e5).srcs.map((s) => s.stale);
  want("Κ1 φρέσκα", fr(0), [false, false, false]);
  want("Κ2 πάνω από 2 ώρες: κόκκινο ανά πηγή", fr(1.6), [false, true, false]);
  want("Κ3 όλα παλιά", fr(5), [true, true, true]);
  want("Κ4 χωρίς δεδομένα", S.freshness(S.buildModel(S.newRaw(), NOW), NOW).any, false);
  want("Κ5 κάλυψη", [M.cover.seen > 0, M.cover.known < M.cover.total, M.cover.st > 0, M.cover.stKnown], [true, true, true, 0]);
  want("Κ7 ο λόγος για τους σταθμούς ακολουθεί τα δεδομένα", [/κανένας από τους 29/.test(S.stationWhy({ st: 29, stKnown: 0 })), /μόνο 5 από 29/.test(S.stationWhy({ st: 29, stKnown: 5 })), /Όλοι/.test(S.stationWhy({ st: 29, stKnown: 29 })), /S2120/.test(S.stationWhy({ st: 0, stKnown: 0 }))], [true, true, true, false]);
  want("Κ6 χωρίς map_field", S.buildModel(S.ingestRows(S.newRaw(), [{ variable: "gateway_summary", time: FIX.base, metadata: {} }]), NOW).hasMap, false);
  return bad;
}

/* ── fixture ────────────────────────────────────────────────────────────── */
function scenariosFixture() {
  const bad = [];
  const want = (l, g, e) => { if (JSON.stringify(g) !== JSON.stringify(e)) bad.push(`${l} (πήρα ${JSON.stringify(g)}, ήθελα ${JSON.stringify(e)})`); };
  const maps = FIX.rows.filter((r) => r.variable === "map_field");
  const gws = FIX.rows.filter((r) => r.variable === "gateway_row");
  const roster = FIX.rows.find((r) => r.variable === "gateway_roster").metadata.list;
  want("Φ1 σχήμα map_field", maps.every((r) => ["i", "n", "c", "y", "x", "ps", "pq", "dv"].every((k) => k in r.metadata)), true);
  want("Φ2 κάτω από 1500", maps.every((r) => JSON.stringify(r.metadata).length < 1500), true);
  want("Φ3 συνθετικά ονόματα αγρών", maps.every((r) => r.metadata.n.startsWith("Δοκ ") || r.metadata.n === "ΠΑΛΙΟ ΟΝΟΜΑ"), true);
  want("Φ4 συνθετικοί παραγωγοί", maps.every((r) => r.metadata.c == null || /^(Παραγωγός |Ξενοδοχείο Δοκιμή)/.test(r.metadata.c)), true);
  want("Φ5 συνθετικές ταυτότητες", maps.every((r) => r.metadata.i.startsWith("f1e1d0")), true);
  want("Φ6 συνθετικοί κωδικοί πυλών", gws.every((r) => /^DEMO/.test(r.value)), true);
  want("Φ7 συνθετικές ταυτότητες πυλών", roster.every((r) => r.id.startsWith("9a7e")), true);
  const pts = maps.filter((r) => r.metadata.y != null).map((r) => [r.metadata.y, r.metadata.x])
    .concat(gws.filter((r) => r.metadata.location).map((r) => [r.metadata.location.lat, r.metadata.location.lng]))
    .concat(roster.filter((r) => r.lat != null).map((r) => [r.lat, r.lng]));
  want("Φ8 όλες οι θέσεις σε περιοχή χωρίς στόλο (Πελοπόννησος)", pts.every(([a, b]) => a > 36.5 && a < 38.1 && b > 21.3 && b < 23.2), true);
  const txt = JSON.stringify(FIX);
  want("Φ9 κανένα τηλέφωνο", /(\+30|\b69\d{8}\b|\b2\d{9}\b)/.test(txt), false);
  want("Φ10 κανένα DevEUI", /\b[0-9a-fA-F]{16}\b/.test(txt), false);
  return bad;
}

/* ── μεταλλάξεις ────────────────────────────────────────────────────────── */
const MUT_A = [
  ["ετικέτα πριν από τη φόρμα", "const p = form || tagPts[0] || null;", "const p = tagPts[0] || form || null;"],
  ["λάθος πηγή θέσης", 'ps: form ? "form" : "tag", pq }', 'ps: "tag", pq }'],
  ["χωρίς όριο Ελλάδας", "if (!(lat >= GR_BOX.latMin && lat <= GR_BOX.latMax && lng >= GR_BOX.lngMin && lng <= GR_BOX.lngMax)) return null;\n  return { lat: Math.round", "return { lat: Math.round"],
  ["χωρίς σημάδι διπλής ετικέτας", 'if (tagPts.length > 1) pq = "dup";\n  else if', "if"],
  ["χωρίς σημάδι ασυμφωνίας", 'pq = "diff";', 'pq = "ok";'],
  ["ίδιος παραγωγός = ύποπτος", '.size > 1) m.pq = "shared"', '.size > 0) m.pq = "shared"'],
  ["χωρίς παραγωγό μετρά ως δεύτερος", 'if (m.y == null || !m.c) continue;', 'if (m.y == null) continue;'],
  ["χάνεται η πύλη", "g: (gwOf && gwOf.get(x.id)) || null", "g: null"],
  ["χάνεται ο τύπος", "t: (typeOf && typeOf.get(x.id)) || null", "t: null"],
  ["ποτέ = 0 ώρες", "? Math.round(Math.max(0, h) * 10) / 10 : null", "? Math.round(Math.max(0, h) * 10) / 10 : 0"],
  ["όνομα από τη συσκευή αντί ετικέτας", 'n: mapTagAll(tags, "name")[0] || String(f.name || f.id)', "n: String(f.name || f.id)"],
  ["πέφτουν όργανα πριν κοπούν ονόματα", "const MAP_NAME_STEPS = [24, 14, 8, 0];", "const MAP_NAME_STEPS = [];"],
  ["χωρίς όριο μεγέθους", "const fits = () => JSON.stringify(md).length < MAP_ROW_MAX;", "const fits = () => true;"],
  ["δεν μετριέται τι έφυγε", "md.dv.pop(); md.dc = (md.dc || 0) + 1;", "md.dv.pop();"],
  ["φεύγουν τα χειρότερα", "dv.sort((a, b) => (b.h == null ? Infinity : b.h) - (a.h == null ? Infinity : a.h));", "dv.sort((a, b) => (a.h == null ? Infinity : a.h) - (b.h == null ? Infinity : b.h));"],
  ["οι ετικέτες μένουν στον κατάλογο", "    delete d.tags;\n  }\n  return typeOf;", "  }\n  return typeOf;"],
  ["διαφορετική ώρα ανά γραμμή", 'value: m.dv.length, time, metadata', 'value: m.dv.length, metadata'],
  ["μόνο η πρώτη ετικέτα devices", 'for (const raw of mapTagAll(tags, "devices")) {', 'for (const raw of mapTagAll(tags, "devices").slice(0, 1)) {'],
  ["χωρίς ανοχή σε χαλασμένο devices", 'else (raw.match(/[0-9a-f]{24}/g) || []).forEach((id) => add(id, ""));', ""],
  ["ο κατάλογος δεν ζητά ετικέτες", "&fields[]=id&fields[]=name&fields[]=tags`\n      + `&fields[]=last_input", "&fields[]=id&fields[]=name`\n      + `&fields[]=last_input"],
  ["δεν κρατιούνται οι αγροί", 'fieldRecs = (f || []).filter(', '(f || []).filter('],
  ["δεν γράφεται το map_field", 'if (mapRows.length) await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(mapRows) });', ""],
  ["το σφάλμα τυπώνει το μήνυμα", 'console.log("ΧΑΡΤΗΣ|σφάλμα " + ((e && e.name) || "άγνωστο"));', 'console.log("ΧΑΡΤΗΣ|σφάλμα " + ((e && e.message) || "άγνωστο"));'],
  ["ο χάρτης πριν από τις κάρτες, στην ίδια εγγραφή", "  await api(`/device/${OVERSEER}/data`, { method: \"POST\", body: JSON.stringify(out) });\n", "  out.push(...buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), now }));\n  await api(`/device/${OVERSEER}/data`, { method: \"POST\", body: JSON.stringify(out) });\n"],
  ["ανάγνωση location ανά αγρό", "    const mapRows = fieldRecs.length ?", "    for (const f of fieldRecs) await api(`/device/${f.id}/data?variables[]=location&qty=1`);\n    const mapRows = fieldRecs.length ?"],
];
const MUT_H = [
  ["το hidden ακυρώνεται", "[hidden] { display: none !important; }", "[hidden] { }"],
  ["το SDK φορτώνεται στατικά", "<script id=\"sag-logic\">", "<script src=\"https://admin.tago.io/dist/custom-widget.min.js\"></script><script id=\"sag-logic\">"],
  ["fixture και μέσα στο TagoIO", " && window.top === window.self && !window.TagoIO;", ";"],
  ["άγνωστη σοβαρότητα = εντάξει", "else return 2;\n  if (!Number.isFinite(n)) return 2;", "else return 0;\n  if (!Number.isFinite(n)) return 2;"],
  ["η γραμμή χωρίς σοβαρότητα γίνεται ΕΝΤΑΞΕΙ", "rec.s = sev(rec.s != null ? rec.s : m.severity);", "rec.s = sev(rec.s || m.severity || 0);"],
  ["η ηλικία δέχεται συμβολοσειρά", "if (typeof h !== 'number' || !Number.isFinite(h) || h < 0) return 'άγνωστη ηλικία';", "if (!isFinite(h) || h === null || h < 0) return 'άγνωστη ηλικία';"],
  ["null γίνεται 0 και χωρίς όριο", "if (!(lat >= GR.latMin && lat <= GR.latMax && lng >= GR.lngMin && lng <= GR.lngMax)) return null;\n  return { lat: lat, lng: lng };", "return { lat: Number(a), lng: Number(b) };"],
  ["άγνωστο όργανο = σιωπηλό", "if (typeof d.h !== 'number' || !Number.isFinite(d.h)) return ISTATE.unknown;", "if (typeof d.h !== 'number' || !Number.isFinite(d.h)) return ISTATE.silent;"],
  ["κρύβονται τα κενά", "if (d.h > GAP_H) return ISTATE.gaps;\n", ""],
  ["κερδίζει η τελευταία που ήρθε", "function keepNewest(cur, p) { return !cur || tnum(p.time) >= tnum(cur.time); }", "function keepNewest(cur, p) { return true; }"],
  ["κάρτα χωρίς θέση σβήνει την πινέζα", "if (!m.location && last) m = Object.assign({}, m, { location: last });", ""],
  ["κοινή θέση πυλών περνά", "if (g.p && cnt[posKey(g.p, 3)] > 1) {", "if (false) {"],
  ["παλιά κάρτα μένει ΛΕΙΤΟΥΡΓΕΙ", "md.age_h + lag : null", "md.age_h : null"],
  ["πιθανό όνομα γράφεται σαν βέβαιο", "if (rivals === 0) { P.n.name = P.r.name; P.n.nameGuess = ''; }\n      else P.n.nameGuess", "P.n.name = P.r.name; if (false) P.n.nameGuess"],
  ["η ύποπτη πύλη δίνει κοντινούς", "if (!g || !g.p || g.posKind !== 'ok' || !(km > 0)) return { list: [], skipped: 0 };", "if (!g || !g.p || !(km > 0)) return { list: [], skipped: 0 };"],
  ["η απόσταση γίνεται σύνδεση", "    if (f.suspect) { skipped++; return; }\n    list.push({ f: f, d: d });", "    if (f.suspect) { skipped++; return; }\n    g.heard[f.key] = { f: f, devs: [], k: 0 }; g.heardList = g.heardList.concat([g.heard[f.key]]);\n    list.push({ f: f, d: d });"],
  ["κοντινοί μαζί με τους επιβεβαιωμένους", "if (!f.p || g.heard[f.key]) return;", "if (!f.p) return;"],
  ["αγρός με ύποπτη θέση μετρά ως κοντινός", "    if (f.suspect) { skipped++; return; }\n", ""],
  ["το διπλό όνομα επιβεβαιώνει", "if (c.length !== 1) { g.orphans.push({ f: rf.f, k: rf.k, amb: c.length > 1 }); return; }", "if (c.length < 1) { g.orphans.push({ f: rf.f, k: rf.k, amb: false }); return; }"],
  ["ίδιος παραγωγός = ύποπτη θέση", "g.suspect = Object.keys(owners).length > 1 ||", "g.suspect = g.fields.length > 1 ||"],
  ["χωρίς υπολογισμό = εντάξει", "var computed = !!rec && !rec.e && !rec.nc && rec.ok !== 0;", "var computed = !!rec;"],
  ["αγρός εκτός στόλου χάνεται", "if (used.indexOf(raw.fleet[k]) < 0) out.push(makeField(null, raw.fleet[k], newest));", ""],
  ["ο διακόπτης δεν δουλεύει", "if (!flt.nocalc && !f.computed) return false;", ""],
  ["ο τύπος δείχνει πύλη χωρίς σύνδεση", "return skip === 'type' || !flt.type || g.heard[k].devs.some(function (d) { return d.label === flt.type; });", "return true;"],
  ["ο παραγωγός δεν φιλτράρει τις πύλες", "if (fieldSide && !hears) return false;", ""],
  ["οι αριθμοί αγνοούν τα άλλα φίλτρα", "select(model, flt, 'status');", "select(model, { view: 'all', producer: '', status: '', type: '', q: '', nocalc: true }, 'status');"],
  ["σταθερή πρόταση για τους σταθμούς", "if (c.stKnown > 0) return 'Γιατί κάποιοι σταθμοί", "if (false) return 'Γιατί κάποιοι σταθμοί"],
  ["το παλιό δεν κοκκινίζει", "stale: h != null && h > STALE_DATA_H", "stale: false"],
  ["κοκκινίζει μόνο αν παλιώσουν όλα", "var STALE_DATA_H = 2;", "var STALE_DATA_H = 4;"],
  ["χάνονται οι πύλες χωρίς θέση", "v.gws.forEach(function (g) { if (!g.p) out.push({ kind: 'gw', key: g.key, name: g.name, why: g.posWhy || 'άγνωστη θέση' }); });\n", ""],
  ["η ταύτιση αγνοεί τις κοινές θέσεις", "g.posKind = 'shared'; g.posWhy = 'ίδια θέση με άλλη πύλη, άρα θεωρείται άγνωστη'; g.sharedP = g.p; g.p = null;", "g.posKind = 'shared'; g.sharedP = g.p;"],
];

const a0 = await scenariosAnalysis(AN0);
const h0 = scenariosPage(HTML0);
const f0 = scenariosFixture();
console.log("=== T-GWMAP-04 ===");
for (const [n, b] of [["ανάλυση", a0], ["σελίδα", h0], ["fixture", f0]]) console.log(b.length ? `✗ ${n}:\n  ✗ ` + b.join("\n  ✗ ") : `${n}: ✓ ΠΕΡΝΑΕΙ`);

/* Μετάλλαξη «σκοτώνεται» μόνο αν ο καθαρός κώδικας περνά: με αποτυχημένη βάση όλες θα φαίνονταν σκοτωμένες. */
if (a0.length || h0.length || f0.length) { console.log("✗✗ Η ΒΑΣΗ ΑΠΕΤΥΧΕ, οι μεταλλάξεις δεν τρέχουν"); process.exit(1); }
let killed = 0, na = 0;
const total = MUT_A.length + MUT_H.length;
for (const [name, a, b] of MUT_A) {
  if (AN0.split(a).length !== 2) { console.log(`✗✗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ «${name}» (${AN0.split(a).length - 1})`); na++; continue; }
  let r; try { r = await scenariosAnalysis(AN0.replace(a, () => b)); } catch (e) { r = ["σκάει: " + e.message]; }
  if (r.length) { killed++; console.log(`✓ «${name}» σκοτώθηκε ← ${r[0].slice(0, 110)}`); } else console.log(`✗✗ «${name}» ΕΠΙΒΙΩΣΕ`);
}
for (const [name, a, b] of MUT_H) {
  if (HTML0.split(a).length !== 2) { console.log(`✗✗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ «${name}» (${HTML0.split(a).length - 1})`); na++; continue; }
  let r; try { r = scenariosPage(HTML0.replace(a, () => b)); } catch (e) { r = ["σκάει: " + e.message]; }
  if (r.length) { killed++; console.log(`✓ «${name}» σκοτώθηκε ← ${r[0].slice(0, 110)}`); } else console.log(`✗✗ «${name}» ΕΠΙΒΙΩΣΕ`);
}
console.log(`μεταλλάξεις: ${killed}/${total}, μη εφαρμόσιμες ${na}`);
const ok = !a0.length && !h0.length && !f0.length && killed === total;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
