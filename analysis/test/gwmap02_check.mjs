/* T-GWMAP-02 (19/10/2026) — ΕΛΕΓΧΟΣ: ο χάρτης gateways ξεκολλάει, δεν πηδάει, και παίρνει ΖΩΝΤΑΝΟ κατάλογο.
 *
 * Τρέχει τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις της σελίδας (applyRoster, drawMap, ingest) και της ανάλυσης (rosterEntry)
 * σε ψεύτικο περιβάλλον. Κάθε μετάλλαξη πρέπει να σκοτωθεί.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML0 = readFileSync(new URL("../../custom_html_files/gateway-board.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const AN0 = readFileSync(new URL("../gatewayLiveness.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function extract(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("δεν βρέθηκε η " + name);
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("δεν έκλεισε η " + name);
}

function scenarios(HTML, AN) {
  const bad = [];
  const want = (label, got, exp) => { if (JSON.stringify(got) !== JSON.stringify(exp)) bad.push(`${label} (πήρα ${JSON.stringify(got)}, ήθελα ${JSON.stringify(exp)})`); };

  // Α · το πέπλο κρύβεται: χωρίς αυτόν τον κανόνα το display:flex ακυρώνει το hidden
  want("Α1 CSS #mapveil[hidden]{display:none}", /#mapveil\[hidden\]\{display:none\}/.test(HTML), true);

  // Β · drawMap: fitBounds μία φορά, όχι σε κάθε ενημέρωση, ποτέ μετά από κίνηση χρήστη
  const code = ["applyRoster", "_tooClose", "drawMap", "originOf", "gwLabel", "ingest"].map((n) => extract(HTML, n)).join("\n\n");
  const mk = () => {
    const fits = [];
    const L = { marker() { const m = { bindPopup() { return m; }, addTo() { return m; } }; return m; } };
    const state = { map: { fitBounds() { fits.push(1); } }, layer: { clearLayers() {} }, gw: {}, markers: {} };
    const sb = { state, L, console, GW_NAMES: {}, ROW_CLS: {}, ACTILITY_SRC: "",
      statusOf: () => ({ cls: "green", label: "x", h: 1 }), pinIcon: () => ({}), telHref: () => "", esc: String, humanAge: () => "" };
    vm.createContext(sb);
    vm.runInContext(code, sb);
    return { sb, state, fits };
  };
  const all = (st) => Object.keys(st.gw).map((k) => st.gw[k]);
  let e = mk();
  e.sb.applyRoster([{ id: "a", name: "A", lat: 35.1, lng: 25.1 }, { id: "b", name: "B", lat: 35.2, lng: 25.2 }]);
  e.sb.drawMap(all(e.state)); e.sb.drawMap(all(e.state)); e.sb.drawMap(all(e.state));
  want("Β1 τρεις ενημερώσεις με τις ίδιες πινέζες → ΕΝΑ fitBounds", e.fits.length, 1);
  e.sb.applyRoster([{ id: "c", name: "C", lat: 35.3, lng: 25.3 }]);
  e.sb.drawMap(all(e.state));
  want("Β2 νέα πινέζα, χωρίς κίνηση χρήστη → ξανά fitBounds", e.fits.length, 2);
  e.state.userMoved = true;
  e.sb.applyRoster([{ id: "d", name: "D", lat: 35.4, lng: 25.4 }]);
  e.sb.drawMap(all(e.state));
  want("Β3 ο χρήστης έπιασε τον χάρτη → ΚΑΝΕΝΑ fitBounds", e.fits.length, 2);

  // Γ · ζωντανός κατάλογος (gateway_roster) υπερισχύει του παγωμένου (fleet_roster)
  e = mk();
  e.sb.applyRoster([{ id: "g1", name: "milesight_sg50_x", lat: 39.0, lng: 22.0 }]);
  e.sb.ingest([{ variable: "gateway_roster", origin: "OV", time: "2026-10-19T10:00:00Z",
    metadata: { list: [{ id: "g1", name: "Αγχίαλος", lat: 39.28, lng: 22.78, conflict: 1 }, { id: "g2", name: "Νέο", lat: 35.0, lng: 25.0 }] } }]);
  want("Γ1 όνομα από τον ζωντανό κατάλογο", e.state.gw.g1.name, "Αγχίαλος");
  want("Γ2 θέση από τον ζωντανό κατάλογο", [e.state.gw.g1.lat, e.state.gw.g1.lng], [39.28, 22.78]);
  want("Γ3 ασυμφωνία θέσης σημαδεύεται", e.state.gw.g1.posConflict, true);
  want("Γ4 νέο gateway (εκτός παγωμένου) εμφανίζεται", !!e.state.gw.g2, true);
  want("Γ5 το δοχείο (Εποπτεία) δεν γίνεται gateway", e.state.gw.OV && e.state.gw.OV.container, true);
  e.sb.ingest([{ variable: "gateway_roster", origin: "OV", time: "2026-10-19T09:00:00Z",
    metadata: { list: [{ id: "g1", name: "ΠΑΛΙΟ", lat: 1, lng: 1 }] } }]);
  want("Γ6 παλαιότερη εγγραφή καταλόγου αγνοείται", e.state.gw.g1.name, "Αγχίαλος");
  // η θέση του ΔΙΚΤΥΟΥ (όχι από κατάλογο) δεν πατιέται
  e = mk();
  e.state.gw.n1 = { id: "n1", lat: 35.5, lng: 25.5, vars: {}, fromRoster: false };
  e.sb.applyRoster([{ id: "n1", name: "N", lat: 30, lng: 20 }], true);
  want("Γ7 ζωντανός κατάλογος ΔΕΝ πατάει θέση που δεν ήρθε από κατάλογο", [e.state.gw.n1.lat, e.state.gw.n1.lng], [35.5, 25.5]);

  // Δ · rosterEntry της ανάλυσης
  let R;
  try {
    const sb = { console };
    vm.createContext(sb);
    vm.runInContext(AN.match(/const GR_BOX = [^\n]+/)[0] + "\n" + extract(AN, "rosterEntry") + "\nglobalThis.R = rosterEntry;", sb);
    R = sb.R;
  } catch (err) { bad.push("εξαγωγή rosterEntry: " + err.message); return bad; }
  const anch = R({ id: "x", name: "milesight_sg50_fce3b8", tags: [
    { key: "is_gateway", value: "yes" }, { key: "coordinates", value: "39.280097476768766, 22.780609295432967" },
    { key: "deployedGateway", value: "yes" }, { key: "comment", value: "Αγχίαλος - Σκοπευτήριο" },
    { key: "coordinates", value: "39.280097476768766, 20.780609295432967" } ] });
  /* Η λάθος τιμή της Αγχιάλου (20,78 = Ιόνιο) πέφτει ΜΕΣΑ στο ορθογώνιο της Ελλάδας — δεν μπορεί να απορριφθεί
     γεωγραφικά. Η τίμια συμπεριφορά: κράτα την πρώτη, ΣΗΜΑΔΕΨΕ ασυμφωνία. */
  want("Δ1 Αγχίαλος (διπλή ετικέτα 19/9): πρώτη τιμή + ΑΣΥΜΦΩΝΙΑ", [anch.lat, anch.lng, anch.conflict], [39.280097, 22.780609, 1]);
  const out = R({ id: "o", name: "dev", tags: [{ key: "coordinates", value: "0, 0" }, { key: "coordinates", value: "35.1, 25.1" }] });
  want("Δ1β τιμή εκτός Ελλάδας (0,0) απορρίπτεται, χωρίς ψευδή ασυμφωνία", [out.lat, out.lng, out.conflict], [35.1, 25.1, undefined]);
  want("Δ2 όνομα από comment", anch.name, "Αγχίαλος - Σκοπευτήριο");
  want("Δ3 εγκατεστημένο → όχι αποθήκη", anch.storage, undefined);
  const dup = R({ id: "y", name: "dev", tags: [{ key: "coordinates", value: "35.1, 25.1" }, { key: "coordinates", value: "35.3, 25.3" }] });
  want("Δ4 δύο διαφορετικές έγκυρες θέσεις → ΑΣΥΜΦΩΝΙΑ", dup.conflict, 1);
  const same = R({ id: "z", name: "dev", tags: [{ key: "coordinates", value: "35.1, 25.1" }, { key: "coordinates", value: "35.1,25.1" }] });
  want("Δ5 ίδια θέση δύο φορές → όχι ασυμφωνία", same.conflict, undefined);
  const none = R({ id: "w", name: "milesight_sg50_04a7c3", tags: [{ key: "is_gateway", value: "yes" }] });
  want("Δ6 νέο χωρίς θέση/εγκατάσταση → χωρίς lat, αποθήκη, όνομα συσκευής", [none.lat, none.storage, none.name], [undefined, true, "milesight_sg50_04a7c3"]);
  return bad;
}

const base = scenarios(HTML0, AN0);
console.log("=== T-GWMAP-02 ===");
console.log(base.length ? "✗ " + base.join("\n✗ ") : "ΠΡΑΓΜΑΤΙΚΟΣ ΚΩΔΙΚΑΣ: ✓ ΠΕΡΝΑΕΙ");
const MUT = [
  ["το πέπλο δεν κρύβεται (CSS)", "h", "#mapveil[hidden]{display:none}", "#mapveil[hidden]{}"],
  ["fitBounds σε κάθε ενημέρωση", "h", "!state.userMoved && pts.length !== state.fitN", "true"],
  ["αγνοεί την κίνηση του χρήστη", "h", "!state.userMoved && pts.length", "pts.length"],
  ["ο ζωντανός κατάλογος δεν αλλάζει όνομα", "h", "if (r.name && (live || !state.gw[id].name))", "if (r.name && !state.gw[id].name)"],
  ["ο ζωντανός κατάλογος δεν αλλάζει θέση", "h", "(live && state.gw[id].fromRoster)", "false"],
  ["ο ζωντανός κατάλογος πατάει και τη θέση δικτύου", "h", "(live && state.gw[id].fromRoster)", "live"],
  ["δέχεται παλιά εγγραφή καταλόγου", "h", "if (!state.rosterTime || Date.parse(r.time) >= Date.parse(state.rosterTime)) {\n        state.rosterTime", "if (true) {\n        state.rosterTime"],
  ["χωρίς σημάδι ασυμφωνίας", "a", "if (seen.length > 1) e.conflict = 1;", ""],
  ["χωρίς όριο Ελλάδας", "a", "if (!(lat >= GR_BOX.latMin && lat <= GR_BOX.latMax && lng >= GR_BOX.lngMin && lng <= GR_BOX.lngMax)) continue;", ""],
  ["όνομα συσκευής αντί τοποθεσίας", "a", 'name: val("comment") || d.name', "name: d.name"],
];
let k = 0, na = 0;
for (const [n, w, a, b] of MUT) {
  const src = w === "h" ? HTML0 : AN0;
  if (src.split(a).length !== 2) { console.log("✗✗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ «" + n + "» (" + (src.split(a).length - 1) + ")"); na++; continue; }
  const m = src.replace(a, b);
  let r; try { r = scenarios(w === "h" ? m : HTML0, w === "a" ? m : AN0); } catch (e) { r = ["σκάει: " + e.message]; }
  if (r.length) { k++; console.log("✓ «" + n + "» σκοτώθηκε ← " + r[0]); } else console.log("✗✗ «" + n + "» ΕΠΙΒΙΩΣΕ");
}
console.log(`μεταλλάξεις: ${k}/${MUT.length}, μη εφαρμόσιμες ${na}`);
const ok = base.length === 0 && k === MUT.length;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
