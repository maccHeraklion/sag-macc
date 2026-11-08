// Ελεγκτής T-SUBS-01: οι καθαρές συναρτήσεις του subscriptionManage. Δεν καλεί το TagoIO.
// Εκτέλεση: node analysis/test/subscription_manage_check.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
delete process.env.T_ANALYSIS_TOKEN;
const M = require("../subscriptionManage.js");
const { parseEnd, controllersOf, planAction, renewTags, chunkBySize, buildItems } = M;

const tag = (key, value, metadata) => (metadata ? { key, value, metadata } : { key, value });
const field = (extra = []) => ({
  id: "f1", name: "Field_Α",
  tags: [tag("isField", "yes"), tag("name", "Α"), tag("fieldId", "d1"), tag("subscriptionActive", "yes"), tag("subscriptionEnd", "2027-03-01"), ...extra],
});
const dash = (extra = []) => ({
  id: "d1", label: "Α",
  tags: [tag("access", "MACC_Manager"), tag("access", "p@x.gr", { run: true }), tag("dashboardGroup", "MACC", { run: false }), ...extra],
});
const accessValues = (tags) => tags.filter((t) => t.key === "access").map((t) => t.value);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok  " + name); };

t("ημερομηνία: καθαρή με ζώνη", () => assert.deepEqual(parseEnd("2027-03-01T00:00:00.000+03:00"), { date: "2027-03-01", odd: false }));
t("ημερομηνία: Start: UTC γίνεται ημέρα Ελλάδας και σημαίνεται", () => assert.deepEqual(parseEnd("Start: 2027-04-15T21:00:00.000Z"), { date: "2027-04-16", odd: true }));
t("ημερομηνία: κενή", () => assert.deepEqual(parseEnd(""), { date: "", odd: false }));
t("ημερομηνία: σκουπίδια", () => assert.deepEqual(parseEnd("σύντομα"), { date: "", odd: true }));

t("ελεγκτές: μόνο uc5xx από το devices", () => {
  const f = { tags: [tag("devices", JSON.stringify({ milesight_uc511_8308: "c1", dragino_lse01_1: "s1" }))] };
  assert.deepEqual(controllersOf(f), [{ n: "milesight_uc511_8308", id: "c1" }]);
});
t("ελεγκτές: χαλασμένο JSON δεν ρίχνει το script", () => assert.deepEqual(controllersOf({ tags: [tag("devices", "{oops")] }), []));

t("παύση: αφαιρεί ΟΛΕΣ τις ετικέτες πελατών, κρατά MACC_Manager και τα άλλα", () => {
  const p = planAction("pause", field(), dash([tag("access", "public")]));
  assert.equal(p.state, "paused");
  assert.deepEqual(accessValues(p.dashboardTags), ["MACC_Manager"]);
  assert.ok(p.dashboardTags.some((x) => x.key === "dashboardGroup"));
  assert.deepEqual(p.saved.map((x) => x.value), ["p@x.gr", "public"]);
});
t("παύση: το αντίγραφο κρατά και το metadata", () => {
  const p = planAction("pause", field(), dash());
  const saved = JSON.parse(p.fieldTags.find((x) => x.key === "subscriptionSavedAccess").value);
  assert.deepEqual(saved, [tag("access", "p@x.gr", { run: true })]);
});
t("παύση: η subscriptionActive μένει yes, η subscriptionEnd δεν αλλάζει", () => {
  const p = planAction("pause", field(), dash());
  assert.equal(M.tagOf({ tags: p.fieldTags }, "subscriptionActive"), "yes");
  assert.equal(M.tagOf({ tags: p.fieldTags }, "subscriptionEnd"), "2027-03-01");
});
t("διακοπή: subscriptionActive=no", () => assert.equal(M.tagOf({ tags: planAction("stop", field(), dash()).fieldTags }, "subscriptionActive"), "no"));

t("άρνηση: συσκευή που δεν είναι αγρός", () => assert.ok(planAction("pause", { tags: [tag("fieldId", "d1")] }, dash()).error));
t("άρνηση: χωρίς dashboard", () => assert.ok(planAction("pause", field(), null).error));
t("άρνηση: πρότυπο", () => assert.ok(planAction("pause", field(), { ...dash(), id: "68f92649f8b680000ab970ae" }).error));
t("άρνηση: dashboard χωρίς MACC_Manager", () => assert.ok(planAction("pause", field(), { id: "d1", tags: [tag("access", "p@x.gr")] }).error));
t("άρνηση: χωρίς πελάτη δεν υπάρχει κάτι να κρυφτεί", () => assert.ok(planAction("pause", field(), { id: "d1", tags: [tag("access", "MACC_Manager")] }).error));
t("άρνηση: διπλή παύση", () => assert.ok(planAction("pause", field([tag("subscriptionState", "paused")]), dash()).error));
t("άρνηση: επαναφορά ενεργού", () => assert.ok(planAction("resume", field(), dash()).error));
t("άρνηση: άγνωστη ενέργεια", () => assert.ok(planAction("delete", field(), dash()).error));
t("άρνηση: επαναφορά χωρίς αντίγραφο", () => assert.ok(planAction("resume", field([tag("subscriptionState", "paused")]), dash()).error));

t("παύση → διακοπή: δεν ξαναγράφει το dashboard, κρατά το αντίγραφο", () => {
  const f = field([tag("subscriptionState", "paused"), tag("subscriptionSavedAccess", '[{"key":"access","value":"p@x.gr"}]')]);
  const p = planAction("stop", f, { id: "d1", tags: [tag("access", "MACC_Manager")] });
  assert.equal(p.dashboardTags, null);
  assert.equal(M.tagOf({ tags: p.fieldTags }, "subscriptionSavedAccess"), '[{"key":"access","value":"p@x.gr"}]');
});

t("κύκλος: παύση και επαναφορά δίνουν τις ίδιες ετικέτες", () => {
  const d0 = dash([tag("access", "public")]);
  const p = planAction("pause", field(), d0);
  const r = planAction("resume", { ...field(), tags: p.fieldTags }, { id: "d1", tags: p.dashboardTags });
  const norm = (a) => a.map((x) => JSON.stringify(x)).sort();
  assert.deepEqual(norm(r.dashboardTags), norm(d0.tags));
  assert.equal(M.tagOf({ tags: r.fieldTags }, "subscriptionState"), "");
  assert.equal(M.tagOf({ tags: r.fieldTags }, "subscriptionSavedAccess"), "");
  assert.equal(M.tagOf({ tags: r.fieldTags }, "subscriptionActive"), "yes");
});
t("επαναφορά: δεν διπλασιάζει ετικέτα που υπάρχει ήδη", () => {
  const f = field([tag("subscriptionState", "paused"), tag("subscriptionSavedAccess", '[{"key":"access","value":"p@x.gr"}]')]);
  assert.deepEqual(accessValues(planAction("resume", f, dash()).dashboardTags), ["MACC_Manager", "p@x.gr"]);
});

t("ανανέωση: ποτέ public, κρατά MACC_Manager, μένει όσο άλλος αγρός το χρειάζεται", () => {
  const saved = (a) => JSON.stringify(a.map((value) => ({ key: "access", value })));
  const fs = [
    { tags: [tag("subscriptionState", "paused"), tag("subscriptionSavedAccess", saved(["a@x", "public"]))] },
    { tags: [tag("subscriptionState", "stopped"), tag("subscriptionSavedAccess", saved(["b@x"]))] },
    { tags: [tag("subscriptionSavedAccess", saved(["όχι@x"]))] },
  ];
  const cur = [tag("access", "MACC_Manager"), tag("access", "παλιό@x"), tag("code", "T-SUBS-01")];
  const out = renewTags(cur, fs);
  assert.deepEqual(accessValues(out), ["MACC_Manager", "a@x", "b@x"]);
  assert.ok(out.some((x) => x.key === "code"));
});

t("κομμάτια: κανένα πάνω από το όριο, τίποτα δεν χάνεται", () => {
  const items = Array.from({ length: 200 }, (_, i) => ({ i, n: "Αγρός με ελληνικό όνομα " + i }));
  const ch = chunkBySize(items, 1000);
  assert.ok(ch.every((c) => Buffer.byteLength(JSON.stringify(c), "utf8") <= 1000));
  assert.equal(ch.flat().length, 200);
});

t("εικόνα: χρήστες χωρίς MACC, σε παύση από το αντίγραφο, άλλα dashboards πελάτη", () => {
  const client = { id: "c1", name: "Π", tags: [tag("isClient", "yes"), tag("name", "Π"), tag("access", "p@x.gr")] };
  const f = field([tag("clientId_field", "c1")]);
  const paused = { id: "f2", name: "Field_Β", tags: [tag("isField", "yes"), tag("name", "Β"), tag("fieldId", "d2"), tag("clientId_field", "c1"),
    tag("subscriptionState", "paused"), tag("subscriptionSavedAccess", '[{"key":"access","value":"p@x.gr"}]')] };
  const dashboards = [dash(), { id: "d2", label: "Β", tags: [tag("access", "MACC_Manager")] }, { id: "d3", label: "Εξαγωγή", tags: [tag("access", "p@x.gr")] }];
  const users = [{ name: "Πελάτης", tags: [tag("access", "p@x.gr")] }, { name: "Μάνατζερ", tags: [tag("access", "p@x.gr"), tag("access", "MACC_Manager")] }];
  const items = buildItems([client], [f, paused], dashboards, users);
  const a = items.find((x) => x.i === "f1"), b = items.find((x) => x.i === "f2"), c = items.find((x) => x.k === "c");
  assert.deepEqual(a.u, ["Πελάτης"]);
  assert.equal(a.s, "active");
  assert.equal(b.s, "paused");
  assert.deepEqual(b.u, ["Πελάτης"]);
  assert.deepEqual(c.ox, ["Εξαγωγή"]);
});

const { siteClassOf, signalsOf, tierOf, pricingOf } = M;
t("σήματα: ελάχιστο 3, μετά κλίμακα 3/8/48, πάνω από 48 = χειρισμός", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 8, 9, 48, 49].map(tierOf), [3, 3, 3, 3, 8, 8, 8, 48, 48, 0]);
});
t("σήματα: τρόπος Α (ό,τι μετρά το όργανο), ελεγκτής βανών 2", () => {
  const typeById = { a: "s2120", b: "lse01", c: "lse01", d: "SE0X", e: "uc511", f: "ws558" };
  const f = { tags: [tag("devices", JSON.stringify({ st: "a", s1: "b", s2: "c", s3: "d", v: "e", w: "f", z: "nope" }))] };
  assert.deepEqual(signalsOf(f, typeById), [["?", 1, null, null], ["lse01", 2, 3, 3], ["s2120", 1, 8, 8], ["se0x", 1, 6, 8], ["uc511", 1, 2, 3], ["ws558", 1, null, null]]);
});
t("σήματα: χαλασμένο devices δεν ρίχνει το script", () => assert.deepEqual(signalsOf({ tags: [tag("devices", "{oops")] }, {}), []));
t("περίπτωση: ξενοδοχείο, σταθμός, αυτοματισμός, θερμοκήπιο από ετικέτα ή φόρμα, αλλιώς αγρός", () => {
  assert.equal(siteClassOf({ tags: [tag("clientName", "VOLTA Resort"), tag("field_purpose", "agronomy")] }), "landscape");
  assert.equal(siteClassOf({ tags: [tag("clientName", "Ξενοδοχείο Χ")] }), "landscape");
  assert.equal(siteClassOf({ tags: [tag("field_purpose", "weather")] }), "station");
  assert.equal(siteClassOf({ tags: [tag("field_purpose", "automation")] }), "automation");
  assert.equal(siteClassOf({ tags: [tag("covered_cultivation", "Ναι")] }), "greenhouse");
  assert.equal(siteClassOf({ tags: [tag("configuration", JSON.stringify({ covered_cultivation: true }))] }), "greenhouse");
  assert.equal(siteClassOf({ tags: [tag("configuration", "{oops"), tag("field_purpose", "agronomy")] }), "field");
  assert.equal(siteClassOf({ tags: [tag("covered_cultivation", "όχι")] }), "field");
});
t("τιμές: μόνο αριθμητικές ετικέτες, όχι η σημαία", () => {
  const d = { name: "subscriptionPricingNumbers", tags: [tag("subscriptionConfiguration", "yes"), tag("sense", "59"), tag("soilone", "21,86"), tag("note", "κείμενο"), tag("empty", "")] };
  assert.deepEqual(pricingOf([d]), [{ n: "subscriptionPricingNumbers", p: { sense: 59, soilone: 21.86 } }]);
  assert.deepEqual(pricingOf([{ name: "x", tags: [tag("subscriptionConfiguration", "1")] }]), [{ n: "x", p: {} }]);
});
t("εικόνα: κάθε αγρός έχει cat, cn και sg όταν δοθούν τύποι", () => {
  const f = field([tag("clientName", "Π"), tag("devices", JSON.stringify({ x: "s1" }))]);
  const [it] = buildItems([], [f], [dash()], [], { s1: "s2120" });
  assert.equal(it.cat, "field"); assert.equal(it.cn, "Π"); assert.deepEqual(it.sg, [["s2120", 1, 8, 8]]);
  const [it2] = buildItems([], [f], [dash()], []);
  assert.equal(it2.sg, undefined);
});

const { billingOwners, sharedOf } = M;
t("σήματα: αισθητήρας πίεσης σωλήνα 1 σήμα → κλίμακα 3", () => {
  assert.deepEqual(signalsOf({ tags: [tag("devices", JSON.stringify({ p: "x" }))] }, { x: "aglwpp01" }), [["aglwpp01", 1, 1, 3]]);
});
t("περίπτωση: ετικέτα project του ξενοδοχείου χωρίς clientName", () => {
  assert.equal(siteClassOf({ tags: [tag("project", "hotel_volta")] }), "landscape");
});
t("χρέωση: κοινό όργανο σε πολλές εγγραφές χρεώνεται μία φορά, στην παλαιότερη", () => {
  const z = (id, devs, c) => ({ id, tags: [tag("devices", JSON.stringify(devs)), tag("clientId_field", c)] });
  const F = [z("a2", { st: "S", v: "V2" }, "h"), z("a1", { st: "S", v: "V1" }, "h"), z("a3", { st: "S", v: "V3" }, "h")];
  const { owner, covered } = billingOwners(F);
  assert.equal(owner.S, "a1"); assert.equal(owner.V2, "a2"); assert.equal(covered.size, 0);
  const types = { S: "s2120", V1: "uc511", V2: "uc511", V3: "uc511" };
  assert.deepEqual(signalsOf(F[1], types, owner), [["s2120", 1, 8, 8], ["uc511", 1, 2, 3]]);
  assert.deepEqual(signalsOf(F[0], types, owner), [["uc511", 1, 2, 3]]);
  assert.deepEqual(sharedOf(F[0], types, owner, { a1: "Ζώνη 1" }), [["s2120", "Ζώνη 1", 0]]);
});
t("χρέωση: ίδιο όργανο δύο φορές στην ίδια εγγραφή μετρά μία", () => {
  assert.deepEqual(signalsOf({ id: "f", tags: [tag("devices", JSON.stringify({ a: "x", b: "x" }))] }, { x: "lse01" }), [["lse01", 1, 3, 3]]);
});
t("χρέωση: εγγραφή υποσύνολο ίδιου πελάτη = καλυμμένη, και χρεώνεται η πλήρης ακόμη κι αν είναι νεότερη", () => {
  const z = (id, devs, c) => ({ id, tags: [tag("devices", JSON.stringify(devs)), tag("clientId_field", c)] });
  const { owner, covered } = billingOwners([z("a1", { v: "V" }, "h"), z("a2", { st: "S", v: "V" }, "h")]);
  assert.ok(covered.has("a1")); assert.equal(owner.V, "a2");
  const same = billingOwners([z("b1", { v: "V" }, "h"), z("b2", { v: "V" }, "h")]);
  assert.ok(same.covered.has("b2") && !same.covered.has("b1"));
  const orphan = billingOwners([z("c1", { v: "V" }, ""), z("c2", { st: "S", v: "V" }, "h")]);
  assert.ok(orphan.covered.has("c1"));
});
t("χρέωση: άλλου πελάτη δεν «καλύπτει» — χρεώνεται μία φορά και σημειώνεται για απόφαση", () => {
  const z = (id, devs, c) => ({ id, tags: [tag("devices", JSON.stringify(devs)), tag("clientId_field", c)] });
  const F = [z("a1", { st: "S", x: "X" }, "p"), z("a2", { st: "S" }, "q")];
  const b = billingOwners(F);
  assert.equal(b.covered.size, 0); assert.equal(b.owner.S, "a1");
  assert.deepEqual(sharedOf(F[1], { S: "s2120" }, b.owner, { a1: "Α" }, b.client), [["s2120", "Α", 1]]);
});
t("χρέωση: απόφαση (BILLING_PAYS) υπερισχύει της παλαιότερης και κλείνει το αίτημα", () => {
  const z = (id, devs, c) => ({ id, tags: [tag("devices", JSON.stringify(devs)), tag("clientId_field", c)] });
  const F = [z("a1", { v: "V", st: "S" }, "lab"), z("a2", { v: "V", x: "X" }, "q"), z("a3", { st: "S" }, "r")];
  const b = billingOwners(F, { a2: ["V"], a3: ["Q"] });
  assert.equal(b.owner.V, "a2"); assert.equal(b.owner.S, "a1"); assert.ok(b.decided.has("V") && !b.decided.has("Q"));
  const types = { V: "uc511", S: "s2120" };
  assert.deepEqual(sharedOf(F[0], types, b.owner, { a2: "Β" }, b.client, b.decided), [["uc511", "Β", 2]]);
  assert.deepEqual(sharedOf(F[2], types, b.owner, { a1: "Α" }, b.client, b.decided), [["s2120", "Α", 1]]);
  assert.deepEqual(signalsOf(F[0], types, b.owner), [["s2120", 1, 8, 8]]);
  // απόφαση για όργανο που η εγγραφή ΔΕΝ δηλώνει αγνοείται
  assert.equal(billingOwners(F, { a3: ["V"] }).owner.V, "a1");
  // εγγραφή που πληρώνει με απόφαση δεν λογίζεται καλυμμένη
  const c = billingOwners([z("c1", { v: "V", s: "S" }, "h"), z("c2", { v: "V" }, "h")], { c2: ["V"] });
  assert.ok(!c.covered.has("c2")); assert.equal(c.owner.V, "c2");
});
t("χρέωση: ο πίνακας αποφάσεων είναι καθαρός (id 24 hex, κάθε όργανο σε ένα μόνο πληρωτή)", () => {
  const hex = /^[0-9a-f]{24}$/, seen = new Set();
  for (const [f, ds] of Object.entries(M.BILLING_PAYS)) {
    assert.ok(hex.test(f), f);
    for (const d of ds) { assert.ok(hex.test(d), d); assert.ok(!seen.has(d), "διπλό " + d); seen.add(d); }
  }
  assert.ok(seen.size >= 5);
  for (const f of M.BILLING_TEST) { assert.ok(hex.test(f), f); assert.ok(!M.BILLING_PAYS[f], "δοκιμαστική πληρώνει " + f); }
  assert.ok(M.BILLING_TEST.size >= 4);
});
t("χρέωση: δοκιμαστική εγγραφή δεν πληρώνει, δεν καλύπτει, δεν ανοίγει αίτημα", () => {
  const z = (id, devs, c) => ({ id, tags: [tag("devices", JSON.stringify(devs)), tag("clientId_field", c)] });
  const F = [z("t1", { a: "A", b: "B", o: "O" }, "lab"), z("c1", { a: "A" }, "p"), z("c2", { b: "B" }, "q")];
  const b = billingOwners(F, {}, new Set(["t1"]));
  assert.equal(b.owner.A, "c1"); assert.equal(b.owner.B, "c2"); assert.equal(b.owner.O, undefined); assert.equal(b.covered.size, 0);
  // ίδιος πελάτης: η δοκιμαστική (μεγαλύτερη) δεν κάνει την πραγματική «καλυμμένη»
  const c = billingOwners([z("t1", { a: "A", b: "B" }, "h"), z("c1", { a: "A" }, "h")], {}, new Set(["t1"]));
  assert.ok(!c.covered.has("c1")); assert.equal(c.owner.A, "c1");
});
t("εικόνα: δοκιμαστική εγγραφή του πίνακα → tst, χωρίς χρέωση, κοινά χωρίς αίτημα", () => {
  const tid = [...M.BILLING_TEST][0];
  const f1 = { id: tid, name: "Field_Δοκιμή", tags: [tag("clientId_field", "lab"), tag("devices", JSON.stringify({ s: "S", o: "O" }))] };
  const f2 = { id: "ffffffffffffffffffffffff", name: "Field_Πελάτης", tags: [tag("clientId_field", "p"), tag("devices", JSON.stringify({ s: "S" }))] };
  const by = Object.fromEntries(buildItems([], [f1, f2], [], [], { S: "s2120", O: "lse01" }).map((x) => [x.i, x]));
  assert.equal(by[tid].tst, 1); assert.deepEqual(by[tid].sg, []); assert.deepEqual(by[tid].sh, [["s2120", "Πελάτης", 0]]);
  assert.deepEqual(by.ffffffffffffffffffffffff.sg, [["s2120", 1, 8, 8]]); assert.equal(by.ffffffffffffffffffffffff.sh, undefined);
});
t("εικόνα: η απόφαση του πίνακα φτάνει ως το sh (x=2) και στη χρέωση", () => {
  const [pf, pd] = Object.entries(M.BILLING_PAYS).find(([, ds]) => ds.length === 1).map((v, i) => (i ? v[0] : v));
  const older = "000000000000000000000001";
  const f1 = { id: older, name: "Field_Ιδιώτης", tags: [tag("clientId_field", "p"), tag("devices", JSON.stringify({ s: pd }))] };
  const f2 = { id: pf, name: "Field_Πληρωτής", tags: [tag("clientId_field", "q"), tag("devices", JSON.stringify({ s: pd }))] };
  const by = Object.fromEntries(buildItems([], [f1, f2], [], [], { [pd]: "s2120" }).map((x) => [x.i, x]));
  assert.deepEqual(by[older].sh, [["s2120", "Πληρωτής", 2]]); assert.deepEqual(by[older].sg, []);
  assert.deepEqual(by[pf].sg, [["s2120", 1, 8, 8]]);
});
t("εικόνα: sh, dup και μοναδικά ονόματα αναφοράς", () => {
  const f1 = { id: "a1", name: "Field_Ζώνη", tags: [tag("name", "Ζώνη"), tag("clientId_field", "h"), tag("devices", JSON.stringify({ s: "S", v: "V1" }))] };
  const f2 = { id: "a2", name: "Field_Ζώνη", tags: [tag("name", "Ζώνη"), tag("clientId_field", "h"), tag("devices", JSON.stringify({ s: "S" }))] };
  const f3 = { id: "a3", name: "Field_Άλλη", tags: [tag("name", "Άλλη"), tag("clientId_field", "h"), tag("devices", JSON.stringify({ s: "S", v: "V3" }))] };
  const items = buildItems([], [f1, f2, f3], [], [], { S: "s2120", V1: "uc511", V3: "uc511" });
  const by = Object.fromEntries(items.map((x) => [x.i, x]));
  assert.equal(by.a2.dup, 1); assert.deepEqual(by.a2.sg, []); assert.deepEqual(by.a2.sh, [["s2120", "Ζώνη #a1", 0]]);
  assert.deepEqual(by.a3.sh, [["s2120", "Ζώνη #a1", 0]]); assert.equal(by.a3.dup, undefined);
  assert.deepEqual(by.a1.sg, [["s2120", 1, 8, 8], ["uc511", 1, 2, 3]]); assert.equal(by.a1.sh, undefined);
});

console.log(`\n${n}/${n} OK`);
