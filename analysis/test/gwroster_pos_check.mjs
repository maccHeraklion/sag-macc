/* T-GWROSTER-POS-01 — ΕΛΕΓΧΟΣ: μπαίνουν στον χάρτη τα δηλωμένα gateways;
 *
 * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ: ο χάρτης έδειχνε 5 από 21. Η θέση ερχόταν ΜΟΝΟ από
 * το δίκτυο (lrrlat/lrrlon), άρα μόνο για gateways που κατονόμασε κάποιος
 * αισθητήρας — και μόνο 38 στους 220 αισθητήρες στέλνουν lrrid. Οι συσκευές
 * που κρατούν τη θέση τους σε ετικέτα «coordinates» δεν έμπαιναν ποτέ.
 *
 * ΦΙΛΟΣΟΦΙΑ: τρέχω τις ΠΡΑΓΜΑΤΙΚΕΣ applyRoster / drawMap σε ψεύτικο Leaflet και
 * μετράω ΠΟΣΕΣ ΠΙΝΕΖΕΣ ΒΓΗΚΑΝ. Όχι αν ο κώδικας «μοιάζει σωστός».
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = new URL("../../custom_html_files/gateway-board.html", import.meta.url);
const src = readFileSync(HTML, "utf8").replace(/\r\n/g, "\n");

function extract(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("δεν βρέθηκε η " + name);
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("δεν έκλεισε η " + name);
}

const CODE = [extract("applyRoster"), extract("_tooClose"), extract("drawMap")].join("\n\n");

/* ── ένα περιβάλλον: ψεύτικο Leaflet που απλώς μετράει ─────────────────── */
function run(code, { rosterList, preset }) {
  const pins = [];
  const L = {
    marker(latlng) {
      const m = { bindPopup() { return m; }, addTo() { pins.push(latlng); return m; } };
      return m;
    },
  };
  const state = {
    map: { fitBounds() {} },
    layer: { clearLayers() {} },
    gw: {},
    markers: {},
  };
  /* θέσεις που «ήρθαν από το δίκτυο» πριν τρέξει ο κατάλογος */
  for (const p of preset || []) state.gw[p.id] = { ...p, vars: {} };

  const sb = {
    state, L, console,
    statusOf: () => ({ cls: "green", label: "ΛΕΙΤΟΥΡΓΕΙ", h: 1 }),
    pinIcon: () => ({}),
    telHref: () => "",
    esc: (x) => String(x),
    humanAge: () => "1ω",
  };
  vm.createContext(sb);
  vm.runInContext(
    code + "\n;applyRoster(" + JSON.stringify(rosterList) + ");"
    + "\n;drawMap(Object.keys(state.gw).map(function(k){return state.gw[k];}));"
    + "\n;globalThis.__gw = state.gw;",
    sb
  );
  return { pins, gw: sb.__gw };
}

function scenarios(code) {
  const bad = [];
  const want = (l, got, exp) => { if (got !== exp) bad.push(`${l} (πήρα ${JSON.stringify(got)}, ήθελα ${JSON.stringify(exp)})`); };

  /* 1. ΤΟ ΣΦΑΛΜΑ ΤΗΣ ΑΝΑΦΟΡΑΣ: δηλωμένα gateway με θέση → μπαίνουν στον χάρτη */
  let r = run(code, { rosterList: [
    { id: "d1", name: "Πόμπια", lat: 34.994347, lng: 24.871695 },
    { id: "d2", name: "Γουμένισσα", lat: 40.97718, lng: 22.383425 },
    { id: "d3", name: "Όρμα", lat: 40.95476, lng: 21.919834 },
  ] });
  want("3 δηλωμένα με θέση → 3 πινέζες", r.pins.length, 3);

  /* 2. Χωρίς συντεταγμένες → καμία πινέζα (η παλιά συμπεριφορά διατηρείται) */
  r = run(code, { rosterList: [{ id: "d1", name: "χωρίς θέση" }] });
  want("χωρίς θέση → καμία πινέζα", r.pins.length, 0);
  want("χωρίς θέση → lat μένει null", r.gw.d1.lat, null);

  /* 3. Η ΘΕΣΗ ΤΟΥ ΔΙΚΤΥΟΥ ΥΠΕΡΙΣΧΥΕΙ — το μάθημα της Αγχιάλου */
  r = run(code, {
    preset: [{ id: "d9", name: "Αγχίαλος", lat: 39.280097, lng: 22.780609 }],
    rosterList: [{ id: "d9", name: "Αγχίαλος", lat: 39.280097, lng: 20.780609 }],
  });
  want("δίκτυο 22,78 vs ετικέτα 20,78 → κερδίζει το δίκτυο", r.gw.d9.lng, 22.780609);

  /* 4. ΟΧΙ ΔΙΠΛΕΣ ΠΙΝΕΖΕΣ: κατάλογος δίπλα σε υπάρχουσα του δικτύου */
  r = run(code, {
    preset: [{ id: "net1", name: "ΚΕΚ δίκτυο", lat: 35.33985, lng: 25.162884 }],
    rosterList: [{ id: "dev1", name: "ΚΕΚ συσκευή", lat: 35.33990, lng: 25.16290 }],
  });
  want("ίδιο σημείο → ΜΙΑ πινέζα, όχι δύο", r.pins.length, 1);

  /* 5. Μακριά → μπαίνει κανονικά */
  r = run(code, {
    preset: [{ id: "net1", name: "ΚΕΚ", lat: 35.33985, lng: 25.162884 }],
    rosterList: [{ id: "dev1", name: "Πόμπια", lat: 34.994347, lng: 24.871695 }],
  });
  want("διαφορετικό σημείο → δύο πινέζες", r.pins.length, 2);

  /* 6. Άκυρες τιμές ΔΕΝ γίνονται δεκτές */
  for (const [lbl, la, ln] of [
    ["εκτός ορίων", 999, 25], ["κείμενο", "abc", "def"], ["null", null, null],
  ]) {
    r = run(code, { rosterList: [{ id: "x", name: lbl, lat: la, lng: ln }] });
    want(`άκυρη θέση «${lbl}» → απορρίπτεται`, r.pins.length, 0);
  }

  /* 7. Ο ΠΡΑΓΜΑΤΙΚΟΣ ΣΤΟΛΟΣ: 21 δηλωμένα, 5 ήδη από το δίκτυο */
  const real = [
    ["Πόμπια", 34.994347, 24.871695], ["Πέραμα", 35.367146, 24.731688],
    ["ΤΥΜΠΑΚΙ", 35.071200, 24.772279], ["Θόλοι", 35.170021, 25.179213],
    ["Λατζιμάς", 35.34072, 24.65577], ["ΜΙΑΜΟΥ", 34.957640, 24.927063],
    ["Μεσοχωριό", 35.0146, 25.216116], ["Βασσάλος", 35.300777, 25.117742],
    ["ΚΕΚ", 35.33985, 25.162884], ["Πατσιανωτάκης", 35.010345, 24.871683],
    ["Αχεντριάς", 34.993122, 25.208076], ["Καλαθάκης", 35.29802, 25.117641],
    ["Γουμένισσα", 40.97718, 22.383425], ["Αγια 1", 39.775085, 22.825647],
    ["Αγια 2", 39.71667, 22.779398], ["Σκοτίνα", 40.021194, 22.574211],
    ["Ρητίνη", 40.284115, 22.289455], ["Όρμα", 40.95476, 21.919834],
    ["Αγχίαλος", 39.280097, 22.780609], ["Λεχώνια", 39.335836, 23.042356],
    ["Παρισάκης", 39.382361, 22.938166],
  ];
  r = run(code, {
    /* πέντε τα ξέρει ήδη το δίκτυο, στα ΙΔΙΑ σημεία */
    preset: real.slice(0, 5).map(([n, la, ln], i) => ({ id: "net" + i, name: n, lat: la, lng: ln })),
    rosterList: real.map(([n, la, ln], i) => ({ id: "dev" + i, name: n, lat: la, lng: ln })),
  });
  want("πραγματικός στόλος → 21 πινέζες, χωρίς διπλές", r.pins.length, 21);

  return bad;
}

console.log("=== T-GWROSTER-POS-01 ===\n");
const base = scenarios(CODE);
console.log(`ΠΡΑΓΜΑΤΙΚΟΣ ΚΩΔΙΚΑΣ: ${base.length === 0 ? "✓ ΠΕΡΝΑΕΙ" : "✗ " + base.length + " ΑΠΟΤΥΧΙΕΣ"}`);
for (const b of base) console.log("   ✗ " + b);

const MUT = [
  ["ο κατάλογος δεν δίνει ποτέ θέση",
    /lat: rHas \? rLat : null, lng: rHas \? rLng : null,/, "lat: null, lng: null,"],
  ["χάνεται ο έλεγχος ορίων",
    /rLat >= -90 && rLat <= 90 && rLng >= -180 && rLng <= 180/, "true"],
  ["ο κατάλογος πατάει τη θέση του δικτύου",
    /if \(rHas && state\.gw\[id\]\.lat == null\) \{/, "if (rHas) {"],
  ["χάνεται η αποφυγή διπλών",
    /if \(g\.fromRoster\) \{[\s\S]*?\n    \}\n/, ""],
  ["η ακτίνα διπλών γίνεται τεράστια", /< 150;/, "< 500000;"],
  ["δεν σημειώνεται η προέλευση", /fromRoster: rHas/, "fromRoster: false"],
  /* Number(null) === 0 — χωρίς τον φρουρό, ρητό lat:null γίνεται πινέζα στο (0,0). */
  ["δέχεται null ως μηδέν", /r\.lat != null && r\.lng != null\s+&& /, ""],
];

console.log("\n--- ΜΕΤΑΛΛΑΞΕΙΣ (κάθε μία ΠΡΕΠΕΙ να σκοτωθεί) ---");
let killed = 0, notApplied = 0;
for (const [name, re, rep] of MUT) {
  const mut = CODE.replace(re, rep);
  if (mut === CODE) { console.log(`✗✗ «${name}» ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ`); notApplied++; continue; }
  let bad;
  try { bad = scenarios(mut); } catch (e) { bad = ["σκάει: " + e.message]; }
  if (bad.length) { console.log(`✓ «${name}» σκοτώθηκε (${bad.length})`); killed++; }
  else console.log(`✗✗ «${name}» ΕΠΙΒΙΩΣΕ — Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ ΤΥΦΛΟΣ ΕΔΩ`);
}

console.log("\n=== ΣΥΝΟΨΗ ===");
console.log(`σενάρια: ${base.length === 0 ? "ΟΛΑ ΠΕΡΝΑΝΕ" : base.length + " αποτυχίες"}`);
console.log(`μεταλλάξεις: ${killed}/${MUT.length} σκοτωμένες, ${notApplied} δεν εφαρμόστηκαν`);
const ok = base.length === 0 && killed === MUT.length;
console.log(ok ? "✓✓ ΟΛΑ ΚΑΛΑ" : "✗✗ ΠΡΟΒΛΗΜΑ");
process.exit(ok ? 0 : 1);
