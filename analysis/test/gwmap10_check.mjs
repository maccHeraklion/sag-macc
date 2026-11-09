/* T-GWMAP-10 (7/11/2026) — ΕΛΕΓΧΟΣ: κατάσταση πύλης «ΕΚΤΟΣ ΔΙΚΤΥΟΥ». Τρέχει το πραγματικό rosterEntry της ανάλυσης και ελέγχει τη σελίδα. Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const A0 = readFileSync(here("../gatewayLiveness.js"), "utf8").replace(/\r\n/g, "\n"), H0 = readFileSync(here("../../custom_html_files/sag-map.html"), "utf8").replace(/\r\n/g, "\n");
const fnOf = (src, name) => { const s = src.indexOf("function " + name + "("); let d = 0; for (let j = src.indexOf("{", s); j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) return src.slice(s, j + 1); } throw new Error("δεν έκλεισε"); };
const T = (o) => Object.entries(o).map(([key, value]) => ({ key, value }));
function check(A, H) {
  const bad = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(n + ": πήρα " + JSON.stringify(a)); }; const has = (n, t) => { if (!H.includes(t)) bad.push("λείπει: " + n); };
  const R = new Function("GR_BOX", "return (" + fnOf(A, "rosterEntry") + ");")({ latMin: 33.5, latMax: 42.5, lngMin: 19, lngMax: 30.5 });
  const e = R({ id: "1", name: "gw", tags: T({ deployedGateway: "yes", comment: "Θόλοι", network_last_uplink: "2026-10-06", network_lrrid: "10007637" }) });
  eq("εκτός δικτύου", [e.off, e.lrr, e.storage, e.name], ["2026-10-06", "10007637", undefined, "Θόλοι"]);
  eq("ζωντανή μένει ως έχει", Object.keys(R({ id: "2", name: "gw", tags: T({ deployedGateway: "yes" }) })).sort(), ["dev", "id", "name"]);
  eq("χαλασμένη ημερομηνία", R({ id: "3", name: "gw", tags: T({ deployedGateway: "yes", network_last_uplink: "6/10" }) }).off, undefined);
  eq("αποθήκη μένει αποθήκη", R({ id: "4", name: "gw", tags: T({ storage_gateway: "yes" }) }).storage, true);
  const sb = { console }; vm.createContext(sb); const a0 = H.indexOf('<script id="sag-logic">') + 23; vm.runInContext(H.slice(a0, H.indexOf("</script>", a0)) + "\nglobalThis.BG = buildGateways;", sb);
  const NOW = "2026-11-07T17:00:00.000Z", row = (code, lat) => ({ code, time: NOW, md: { age_h: 0.1, color: "green", sensors: 3, fields: [], location: { lat, lng: 25 } } });
  const out = sb.BG({ gw: { a: row("1001848B", 35.1), b: row("10007636", 35.3) }, names: {}, roster: { list: [{ id: "d1", name: "ΚΥΔΩΝ", dev: "x", lrr: "1001848B" }, { id: "d2", name: "Μπαλαούρας", dev: "y", lrr: "1001490C" }, { id: "d3", name: "Λατζιμάς", dev: "z", lrr: "10007636", off: "2026-11-06" }, { id: "d4", name: "Σπίτι", dev: "w", lrr: "10009A7F", off: "2025-09-23" }] } });
  const L = Array.isArray(out) ? out : (out.all || out.gws || []);
  eq("δεν μετρά δύο φορές", L.length, 4);
  const by = (c) => L.find((g) => g.code === c || g.lrr === c) || {};
  eq("παίρνει το όνομα", by("1001848B").name, "ΚΥΔΩΝ"); eq("μένει πύλη δικτύου", by("1001848B").net, true);
  eq("χωρίς κάρτα μένει στον κατάλογο με τον κωδικό της", [by("1001490C").net, by("1001490C").st && by("1001490C").st.k], [false, "g_unid"]);
  eq("πύλη δικτύου κρατά την ημερομηνία", by("10007636").off, "2026-11-06"); eq("εκτός δικτύου", by("10009A7F").st && by("10009A7F").st.k, "g_off");
  const o2 = sb.BG({ gw: { a: row("1000C238", 35.2), b: row("100151FF", 35.2) }, names: {}, roster: { list: [{ id: "d5", name: "Πέραμα", dev: "p", lrr: "1000C238", lat: 35.36, lng: 24.73 }] } });
  const L2 = Array.isArray(o2) ? o2 : (o2.all || o2.gws || []), pe = L2.find((g) => g.code === "1000C238") || {}, ot = L2.find((g) => g.code === "100151FF") || {};
  eq("η θέση του καταλόγου καλύπτει την κοινή", [pe.p && pe.p.lat, pe.posKind], [35.36, "ok"]); eq("η άλλη μένει άγνωστη", [ot.p, ot.posKind], [null, "shared"]);
  has("κατάσταση", "g_off: { k: 'g_off', w: 'ΕΚΤΟΣ ΔΙΚΤΥΟΥ', ic: '✕', c: 'check' }"); has("επιλογή κατάστασης", "(r.off ? GSTATE.g_off : GSTATE.g_unid)"); has("σειρά", "g_off: 1500"); has("σοβαρότητα", "g_off: 2.5"); has("πέρασμα σε πύλη δικτύου", "P.n.off = P.r.off;"); has("μετρητής", "gwOff: gws.filter(function (g) { return g.st.k === 'g_off'; })"); has("χωρίς ταυτοποίηση μόνο οι g_unid", "!g.net && g.st.k === 'g_unid'"); has("πίνακας", "Τελευταίο πακέτο στο ThingPark: "); has("φίλτρο", "'g_nowit', 'g_off', 'g_unid'"); has("υπόμνημα", "GSTATE.g_off, GSTATE.g_unid"); has("μπάνερ", "εκτός δικτύου: <b>' + c.gwOff");
  return bad;
}
const r = check(A0, H0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ εκτός δικτύου");
const MUT = [["A", "if (/^\\d{4}-\\d{2}-\\d{2}$/.test(off)) e.off = off;", "if (off) e.off = off;"], ["A", "if (lrr) e.lrr = lrr;", ""], ["A", 'val("network_last_uplink")', 'val("x")'], ["H", "(r.off ? GSTATE.g_off : GSTATE.g_unid)", "GSTATE.g_unid"], ["H", "P.n.off = P.r.off;", ""], ["H", "g_off: 1500", "g_off: -1500"], ["H", "!g.net && g.st.k === 'g_unid'", "!g.net && g.st.k !== 'g_storage'"], ["H", "var n = nets.filter(function (x) { return x.code === r.lrr && !x.linkedRoster; })[0];", "var n = null;"], ["H", "n.dev = r.dev; n.off = r.off; n.lrr = r.lrr;", "n.dev = r.dev; n.lrr = r.lrr;"], ["H", "if (!n.nameSure) { n.name = r.name; n.nameGuess = ''; }\n  });\n  var pairs", "});\n  var pairs"], ["H", "n.linkedRoster = true; r.merged = true;\n    n.storage = r.storage;", "n.linkedRoster = true;\n    n.storage = r.storage;"], ["H", "if (r.p && !r.conflict) { n.p = r.p; n.posKind = 'ok'; n.posWhy = 'δηλωμένη θέση'; n.sharedP = null; }", ""]];
let k = 0; for (const [w, a, b] of MUT) { const src = w === "A" ? A0 : H0; if (!src.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } let bad; try { bad = w === "A" ? check(A0.replace(a, b), H0) : check(A0, H0.replace(a, b)); } catch (e) { bad = ["εξαίρεση"]; } if (bad.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
