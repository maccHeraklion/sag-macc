/* T-TPREAD-02 (9/11/2026) — ΕΛΕΓΧΟΣ σταδίου 2: η κατάσταση του ThingPark μπαίνει στον κατάλογο πυλών και φαίνεται στον χάρτη.
   Τρέχει τις πραγματικές tpApplyRoster / tpNetworkRecord της ανάλυσης και την πραγματική buildGateways της σελίδας.
   Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const A0 = readFileSync(here("../gatewayLiveness.js"), "utf8").replace(/\r\n/g, "\n"), H0 = readFileSync(here("../../custom_html_files/sag-map.html"), "utf8").replace(/\r\n/g, "\n");
const fnOf = (src, name) => { const s = src.indexOf("function " + name + "("); if (s < 0) throw new Error("λείπει " + name); let d = 0; for (let j = src.indexOf("{", s); j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) return src.slice(s, j + 1); } throw new Error("δεν έκλεισε"); };
const NOW = Date.parse("2026-11-09T16:00:00Z"), H = 36e5;
function check(A, Hp) {
  const bad = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(n + ": πήρα " + JSON.stringify(a)); };
  try {
    const F = new Function("return { tpApplyRoster: " + fnOf(A, "tpApplyRoster") + ", tpNetworkRecord: " + fnOf(A, "tpNetworkRecord") + " };")();
    const TPS = new Function("const TP_SILENT_H = 24; return " + fnOf(A, "tpNetworkRecord") + ";")();
    const bs = new Map([
      ["1001848B", { l: "1001848B", n: "a", c: "CNX", h: "ACTIVE", s: NOW - 5 * H, u: NOW - 0.1 * H, a: 1 }],
      ["10007637", { l: "10007637", n: "b", c: "DISC", h: "BACKHAUL_CNX_ERROR", s: Date.parse("2026-10-06T10:23:00Z"), u: Date.parse("2026-10-05T22:00:00Z"), a: 3 }],
      ["1000ED0A", { l: "1000ED0A", n: "c", c: "CNX", h: "ACTIVE", s: NOW - 50 * H, u: NOW - 211 * H, a: 2 }],
      ["99999999", { l: "99999999", n: "d", c: "CNX", h: "ACTIVE", s: NOW, u: NOW, a: 0 }]]);
    const roster = [{ id: "1", lrr: "1001848b", off: "2026-11-06" }, { id: "2", lrr: "10007637" }, { id: "3", lrr: "1000ED0A" }, { id: "4" }];
    const n = F.tpApplyRoster(roster, bs);
    eq("εφαρμογή σε 3", n, 3);
    eq("συνδεδεμένη: φεύγει το off (κεφαλαία/πεζά)", [roster[0].off, roster[0].tp && roster[0].tp.c], [undefined, "CNX"]);
    eq("αποσυνδεδεμένη: off = ημέρα τελευταίου πακέτου", [roster[1].off, roster[1].tp.a], ["2026-10-05", 3]);
    eq("χωρίς lrr: ανέγγιχτη", roster[3].tp, undefined);
    const rec = TPS(bs, [{ n: "x", u: NOW - 2 * H }, { n: "y", u: NOW - 30 * H }, { n: "z", u: null }], roster, NOW);
    eq("εγγραφή", [rec.variable, rec.value, rec.metadata.dev.silent_24h, rec.metadata.not_in_roster, rec.metadata.color], ["tp_network", "3/4 πύλες συνδεδεμένες", 2, ["99999999"], "orange"]);
    eq("κείμενο σιωπηλών πυλών", /1 αποσυνδεδεμένες, 1 συνδεδεμένες χωρίς πακέτο 24 ωρών/.test(rec.metadata.text), true);
    // σελίδα
    const sb = { console }; vm.createContext(sb); const a0 = Hp.indexOf('<script id="sag-logic">') + 23; vm.runInContext(Hp.slice(a0, Hp.indexOf("</script>", a0)) + "\nglobalThis.BG = buildGateways;", sb);
    const row = (code, lat) => ({ code, time: new Date(NOW).toISOString(), md: { age_h: 0.1, color: "green", sensors: 3, fields: [], location: { lat, lng: 25 } } });
    const out = sb.BG({ gw: { a: row("10007637", 35.1), b: row("1001848B", 35.3) }, names: {}, roster: { list: [
      { id: "d1", name: "Θόλοι", dev: "x", lrr: "10007637", off: "2026-10-05", tp: roster[1].tp },
      { id: "d2", name: "ΚΥΔΩΝ", dev: "y", lrr: "1001848B", tp: roster[0].tp },
      { id: "d3", name: "Μόνο κατάλογος", dev: "z", lrr: "1000ED0A", tp: roster[2].tp }] } });
    const L = Array.isArray(out) ? out : (out.all || out.gws || []);
    const by = (c) => L.find((g) => g.code === c || g.lrr === c) || {};
    eq("μάρτυρας ζωντανός αλλά ThingPark αποσυνδεδεμένη → ΕΚΤΟΣ ΔΙΚΤΥΟΥ", by("10007637").st && by("10007637").st.k, "g_off");
    eq("συνδεδεμένη μένει ζωντανή", by("1001848B").st && by("1001848B").st.k, "g_alive");
    eq("tp περνά στην πύλη δικτύου", by("1001848B").tp && by("1001848B").tp.c, "CNX");
    const sb2 = { console, Date, UI: { km: 0 }, esc: (x) => String(x), chip: () => "", plural: (n, a, b) => n + " " + (n === 1 ? a : b), fieldRowHtml: () => "", nearHtml: () => "" };
    vm.createContext(sb2);
    vm.runInContext(fnOf(Hp, "ageWords") + "\n" + fnOf(Hp, "panelGw") + "\nglobalThis.PG = panelGw;", sb2);
    const g3 = by("1000ED0A"); g3.heardList = g3.heardList || []; g3.st = g3.st || { k: "g_unid", w: "x", ic: "", c: "grey" };
    const html = sb2.PG(g3);
    eq("πλαίσιο: συνδεδεμένη χωρίς πακέτο", /ThingPark: συνδεδεμένη/.test(html) && /δεν ακούει κανένα όργανο/.test(html), true);
    const g1 = by("10007637"); g1.heardList = g1.heardList || [];
    eq("πλαίσιο: αποσυνδεδεμένη", /ThingPark: αποσυνδεδεμένη/.test(sb2.PG(g1)) && /έχασε τη σύνδεσή της/.test(sb2.PG(g1)), true);
  } catch (e) { bad.push("εξαίρεση " + (e && e.stack || e)); }
  return bad;
}
const r = check(A0, H0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ στάδιο 2 ThingPark");
const MUT = [
  ["A", "    else if (b.c === \"CNX\") delete r.off;\n", ""],
  ["A", "if (d) r.off = new Date(d).toISOString().slice(0, 10);", ""],
  ["A", "const b = r && r.lrr ? bs.get(String(r.lrr).toUpperCase()) : null;", "const b = r && r.lrr ? bs.get(String(r.lrr)) : null;"],
  ["A", "const quiet = list.filter((b) => b.c === \"CNX\" && (!b.u || now - b.u > TP_SILENT_H * 36e5)).length;", "const quiet = 0;"],
  ["H", "    if (g.tp && g.tp.c === 'DISC' && !g.storage) g.st = GSTATE.g_off;\n", ""],
  ["H", "    n.tp = r.tp;   // T-TPREAD-02\n", ""],
  ["H", "lrr: r.lrr || null, tp: r.tp || null,", "lrr: r.lrr || null,"],
  ["H", "if (g.tp.c === 'CNX' && (tpUpH == null || tpUpH > 24))", "if (false)"],
];
let k = 0; for (const [w, a, b] of MUT) { const src = w === "A" ? A0 : H0; if (!src.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } const x = w === "A" ? check(A0.replace(a, b), H0) : check(A0, H0.replace(a, b)); if (x.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
