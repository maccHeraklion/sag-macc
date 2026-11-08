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

console.log(`\n${n}/${n} OK`);
