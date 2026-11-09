/* T-GWMAP-11 (9/11/2026) — ΕΛΕΓΧΟΣ: κλικ ΠΑΝΩ στον χάρτη στόλου δεν ξαναεστιάζει (ζουμ/μετακίνηση) ούτε κυλά τη σελίδα·
   εμφανίζεται κουμπί «Λεπτομέρειες ↓». Επιλογή από τη λίστα εστιάζει όπως πριν. Τρέχει τις πραγματικές select_ και hint
   της σελίδας σε node:vm. Κάθε μετάλλαξη πρέπει να σκοτωθεί. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const H0 = readFileSync(fileURLToPath(new URL("../../custom_html_files/sag-map.html", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const fnOf = (src, name) => { const s = src.indexOf("function " + name + "("); if (s < 0) throw new Error("λείπει " + name); let d = 0; for (let j = src.indexOf("{", s); j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) return src.slice(s, j + 1); } throw new Error("δεν έκλεισε"); };
function check(H) {
  const bad = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(n + ": πήρα " + JSON.stringify(a)); };
  const has = (n, t, k = 1) => { if (H.split(t).length - 1 !== k) bad.push("λείπει/πλήθος: " + n); };
  const env = (w) => {
    const log = { frame: 0, scroll: 0 }; const btn = { hidden: true };
    const sb = { UI: { sel: null }, MODEL: { gws: [{ key: "a" }, { key: "b" }] }, window: { innerWidth: w },
      $: (id) => (id === "panelHint" ? btn : null), byKey: (arr, k) => arr.find((x) => x.key === k),
      frameGateway: () => { log.frame++; }, renderPanel: () => {}, drawMap: () => {}, visible: () => ({}),
      document: { querySelector: () => ({ scrollIntoView: () => { log.scroll++; } }) } };
    vm.createContext(sb); vm.runInContext(fnOf(H, "hint") + "\n" + fnOf(H, "select_"), sb);
    return { sb, log, btn };
  };
  try {
    const d = env(1400);
    d.sb.select_({ kind: "gw", key: "a" }, { fromMap: true });
    eq("χάρτης: πύλη χωρίς εστίαση", [d.log.frame, d.btn.hidden], [0, false]);
    d.sb.select_({ kind: "gw", key: "b" }, { fromMap: true });
    eq("χάρτης: δεύτερη πύλη χωρίς εστίαση", d.log.frame, 0);
    d.sb.select_({ kind: "field", key: "x" }, { fromMap: true });
    eq("χάρτης: αγρός χωρίς εστίαση", d.log.frame, 0);
    d.sb.select_({ kind: "gw", key: "a" });
    eq("λίστα: πύλη εστιάζει, κουμπί κρυφό", [d.log.frame, d.btn.hidden], [1, true]);
    const m = env(400);
    m.sb.select_({ kind: "gw", key: "a" }, { fromMap: true });
    eq("κινητό, χάρτης: καμία κύλιση", [m.log.scroll, m.log.frame], [0, 0]);
    m.sb.select_({ kind: "field", key: "y" });
    eq("κινητό, λίστα: κύλιση στον χάρτη", m.log.scroll, 1);
  } catch (e) { bad.push("εξαίρεση " + e.message); }
  has("πινέζα αγρού από τον χάρτη", "{ kind: 'group', key: grp.key }, { fromMap: true }); });");
  has("πινέζα πύλης από τον χάρτη", "select_({ kind: 'gw', key: g.key }, { fromMap: true }); });");
  has("καμία κύλιση στο πλαίσιο από πινέζα", "reveal('panel'); });", 0);
  has("κουμπί λεπτομερειών", '<button type="button" id="panelHint" class="maphint" hidden>Λεπτομέρειες ↓</button>');
  has("χειρισμός κουμπιού", "if (t.id === 'panelHint') { hint(false); reveal('panel'); return; }");
  has("κουμπί εστίασης", "data-frame>Εστίαση του χάρτη στην πύλη</button>");
  has("χειρισμός εστίασης", "if (t.hasAttribute('data-frame')) { if (UI.sel && UI.sel.kind === 'gw') frameGateway(byKey(MODEL.gws, UI.sel.key)); reveal('map'); return; }");
  has("επιλογέας", "closest('[data-sel],[data-close],[data-frame],#panelHint')");
  has("κρύψιμο στο κλείσιμο", "UI.sel = null; hint(false);");
  return bad;
}
const r = check(H0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ χάρτης χωρίς επανεστίαση");
const MUT = [
  ["if (s.kind === 'gw' && !same && !fromMap) frameGateway", "if (s.kind === 'gw' && !same) frameGateway"],
  ["  if (fromMap) return;\n", ""],
  ["  hint(fromMap);\n", ""],
  ["var fromMap = !!(o && o.fromMap);", "var fromMap = false;"],
  ["select_({ kind: 'gw', key: g.key }, { fromMap: true }); });", "select_({ kind: 'gw', key: g.key }); reveal('panel'); });"],
  ["{ kind: 'group', key: grp.key }, { fromMap: true }); });", "{ kind: 'group', key: grp.key }); reveal('panel'); });"],
  ["if (t.id === 'panelHint') { hint(false); reveal('panel'); return; }", ""],
  ["UI.sel = null; hint(false);", "UI.sel = null;"],
];
let k = 0; for (const [a, b] of MUT) { if (!H0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } if (check(H0.replace(a, b)).length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
