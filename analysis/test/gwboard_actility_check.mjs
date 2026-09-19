/**
 * T-GWBOARD-ACTILITY-01 — ελεγκτής του πίνακα gateways.
 *
 * ΦΙΛΟΣΟΦΙΑ (μάθημα από την v50.144): δεν ελέγχουμε ΤΙ ΓΡΑΨΑΜΕ, ελέγχουμε ΤΙ
 * ΒΓΑΙΝΕΙ. Ο ελεγκτής ΕΚΤΕΛΕΙ τον πραγματικό κώδικα της σελίδας μέσα σε ψεύτικο
 * DOM και κρίνει το ΑΠΟΤΕΛΕΣΜΑ: ποια κουτιά εμφανίζονται, με τι χρώμα, σε ποια
 * θέση. Κάθε μετάλλαξη ΠΡΕΠΕΙ να σκοτωθεί· μετάλλαξη που δεν εφαρμόστηκε
 * μετράει ΑΠΟΤΥΧΙΑ (αλλιώς ο ελεγκτής ξεκολλάει σιωπηλά και δείχνει πράσινος).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "..", "custom_html_files", "gateway-board.html");

const RAW = readFileSync(PAGE, "utf8");
const OVERSEER = "6a98855ca06e41000bfae024";

let pass = 0;
let fail = 0;
function ok(cond, name, detail) {
  if (cond) {
    pass++;
    console.log("  ✔ " + name);
  } else {
    fail++;
    console.log("  ✘ " + name + (detail ? " — " + detail : ""));
  }
}

/* ── Ψεύτικο DOM: όσο χρειάζεται για να τρέξει render() χωρίς φυλλομετρητή ── */
function makeDom() {
  const els = {};
  const mk = (id) => ({
    id,
    textContent: "",
    innerHTML: "",
    children: [],
    setAttribute() {},
    addEventListener() {},
    appendChild(c) {
      this.children.push(c);
    },
  });
  for (const id of [
    "cTotal", "lTotal", "cGreen", "cYellow", "cRed", "cGrey", "cNoLoc",
    "cUndec", "cNet", "gwlist", "empty", "foot", "map",
  ]) els[id] = mk(id);
  return {
    els,
    document: {
      getElementById: (id) => els[id] || null,
      createElement: () => mk("li"),
    },
  };
}

/* Εκτελεί τη σελίδα και επιστρέφει το ζωντανό περιβάλλον της. */
function boot(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("δεν βρέθηκε inline script");
  const dom = makeDom();
  const ctx = {
    document: dom.document,
    window: {},          // χωρίς TagoIO: η σελίδα δεν καλεί SDK
    console: { log() {} },
    setTimeout() {},
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    isFinite,
    parseInt,
    parseFloat,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  new vm.Script(m[1]).runInContext(ctx);
  ctx.__els = dom.els;
  return ctx;
}

/* ── Τα δεδομένα: ό,τι ΑΚΡΙΒΩΣ γράφει η gatewayLiveness ──────────────────── */
const T_NEW = "2026-09-19T17:34:54.000Z";
const T_OLD = "2026-09-19T16:34:54.000Z";

function row(code, color, state, ageH, sensors, lat, lng, time = T_NEW) {
  return {
    variable: "gateway_row",
    value: code,
    time,
    origin: OVERSEER,
    metadata: {
      color,
      state,
      sensors,
      age_h: ageH,
      rssi: -61,
      text: "κάτι",
      location: lat == null ? undefined : { lat, lng },
    },
  };
}

const ROWS = [
  row("10011672", "green", "ΛΕΙΤΟΥΡΓΕΙ", 0.16, 11, 35.339863, 25.162653),
  row("1000C238", "orange", "ΥΠΟΠΤΟ", 5.5, 6, 35.367172, 24.731691),
  row("10009A7F", "red", "ΔΕΝ ΑΠΑΝΤΑ", 8672.7, 1, 39.378334, 22.935),
  { variable: "gateway_summary", value: "8 λειτουργούν από 10", time: T_NEW, origin: OVERSEER, metadata: {} },
  { variable: "gateway_scan_state", value: 38, time: T_NEW, origin: OVERSEER, metadata: {} },
];

/* ── ΣΕΝΑΡΙΑ ─────────────────────────────────────────────────────────────── */
function scenarios(ctx) {
  const res = {};
  ctx.ingest(ROWS);
  ctx.render();
  const list = ctx.sortedList();
  res.ids = list.map((g) => g.id);
  res.byCode = {};
  for (const g of list) if (g.code) res.byCode[g.code] = ctx.statusOf(g);
  res.entries = {};
  for (const g of list) if (g.code) res.entries[g.code] = g;
  res.cNet = ctx.__els.cNet.textContent;
  res.cTotal = ctx.__els.cTotal.textContent;
  res.cGreen = ctx.__els.cGreen.textContent;
  res.cYellow = ctx.__els.cYellow.textContent;
  res.cRed = ctx.__els.cRed.textContent;
  res.foot = ctx.__els.foot.textContent;
  return res;
}

console.log("\n══ T-GWBOARD-ACTILITY-01 · ΣΕΝΑΡΙΑ ══");
const base = boot(RAW);
const R = scenarios(base);

ok(R.ids.length === 3, "Α·1 τρία gateways, όχι ένα κουτί", "βρέθηκαν " + R.ids.length + ": " + R.ids.join(","));
ok(!R.ids.includes(OVERSEER), "Α·2 η συσκευή-δοχείο ΔΕΝ εμφανίζεται", R.ids.join(","));
ok(R.byCode["10011672"] && R.byCode["10011672"].cls === "green", "Β·1 green → πράσινο");
ok(R.byCode["1000C238"] && R.byCode["1000C238"].cls === "yellow", "Β·2 orange → κίτρινο (όχι πράσινο)", JSON.stringify(R.byCode["1000C238"]));
ok(R.byCode["10009A7F"] && R.byCode["10009A7F"].cls === "red", "Β·3 red → κόκκινο");
ok(
  R.byCode["10011672"] && /Actility/.test(R.byCode["10011672"].src || ""),
  "Β·4 η πηγή λέγεται ρητά (Actility)",
);
ok(
  R.entries["10011672"] && Math.abs(R.entries["10011672"].lat - 35.339863) < 1e-9
    && Math.abs(R.entries["10011672"].lng - 25.162653) < 1e-9,
  "Γ·1 η θέση διαβάζεται από metadata.location",
);
ok(R.cNet === "3", "Γ·2 μετρητής «από το δίκτυο» = 3", R.cNet);
ok(R.cGreen === "1" && R.cYellow === "1" && R.cRed === "1",
  "Γ·3 οι μετρητές 1/1/1", R.cGreen + "/" + R.cYellow + "/" + R.cRed);
ok(/Actility/.test(R.foot), "Γ·4 το υποσέλιδο λέει την πραγματική πηγή", R.foot.slice(0, 60));

/* Δ · Η ΠΑΛΙΑ ΔΙΑΔΡΟΜΗ ΔΕΝ ΧΑΛΑΣΕ: συσκευή που στέλνει δική της μεταβλητή. */
{
  const c2 = boot(RAW);
  c2.ingest([
    { variable: "location", value: "coords", time: T_OLD, origin: "dev1", location: { lat: 35.1, lng: 25.1 } },
    { variable: "uptime", value: 5, time: new Date().toISOString(), origin: "dev1" },
  ]);
  const l = c2.sortedList();
  const s = l.length ? c2.statusOf(l[0]) : null;
  ok(l.length === 1 && s && s.cls === "green",
    "Δ·1 η παλιά διαδρομή (δική τους μεταβλητή) ζει",
    JSON.stringify(s));
  ok(l.length === 1 && Math.abs(l[0].lat - 35.1) < 1e-9,
    "Δ·2 και η θέση από location κρατήθηκε");
}

/* Ε · Παλιότερη γραμμή ΔΕΝ σβήνει νεότερη. */
{
  const c3 = boot(RAW);
  c3.ingest([row("AAA", "green", "Λ", 0.1, 9, 35, 25, T_NEW)]);
  c3.ingest([row("AAA", "red", "Ν", 99, 1, 36, 26, T_OLD)]);
  const g = c3.sortedList()[0];
  ok(g && c3.statusOf(g).cls === "green" && g.sensors === 9,
    "Ε·1 παλιότερη γραμμή ΔΕΝ αντικαθιστά νεότερη",
    g ? c3.statusOf(g).cls + "/" + g.sensors : "καμία");
}

/* Ζ · Ο κατάλογος του στόλου ΔΕΝ θάβει όσα λειτουργούν. */
function comboFirstIsNetwork(ctx) {
  ctx.applyRoster([
    { id: "d1", name: "σιωπηλό 1" },
    { id: "d2", name: "σιωπηλό 2" },
    { id: "d3", name: "σιωπηλό 3" },
  ]);
  ctx.ingest([row("ZZZ", "green", "Λ", 0.1, 4, 35, 25)]);
  const l = ctx.sortedList();
  return { first: l[0], last: l[l.length - 1], n: l.length };
}
{
  const cz = boot(RAW);
  const z = comboFirstIsNetwork(cz);
  ok(z.n === 4 && z.first && z.first.code === "ZZZ",
    "Ζ·1 το gateway που λειτουργεί είναι ΠΡΩΤΟ, όχι θαμμένο",
    z.first ? String(z.first.id) : "καμία");
  ok(z.last && cz.isUndeclared(z.last),
    "Ζ·2 το αδήλωτο είναι ΤΕΛΕΥΤΑΙΟ");
}

/* ── ΜΕΤΑΛΛΑΞΕΙΣ ─────────────────────────────────────────────────────────── */
console.log("\n══ ΜΕΤΑΛΛΑΞΕΙΣ (όλες πρέπει να σκοτωθούν) ══");

const MUT = [
  ["το orange βάφεται πράσινο",
    "orange: 'yellow'", "orange: 'green'"],
  ["η έτοιμη ετυμηγορία αγνοείται",
    "  if (entry && entry.verdict) return entry.verdict;", "  if (false) return entry.verdict;"],
  ["όλα τα gateways σε ένα κλειδί",
    "var gid = 'lrr:' + String(r.value);", "var gid = 'lrr:';"],
  ["η συσκευή-δοχείο ξαναμπαίνει στον κατάλογο",
    "    if (state.gw[k].container) continue;", "    if (false) continue;"],
  ["η παλιότερη γραμμή περνάει μπροστά",
    "if (prevRow && prevRow.rowTime && Date.parse(r.time) < Date.parse(prevRow.rowTime)) continue;",
    "if (false) continue;"],
  ["η θέση του gateway πετιέται",
    "      if (md.location && isFinite(Number(md.location.lat))", "      if (false && isFinite(Number(md.location.lat))"],
  ["το σήμα «από το δίκτυο» χάνεται",
    "      ent.fromNetwork = true;", "      ent.fromNetwork = false;"],
  ["το υποσέλιδο κρύβει την πηγή",
    "    var t = net > 0", "    var t = false"],
  ["τα αδήλωτα ξαναθάβουν όσα λειτουργούν",
    "var rankOf = function (g) { return isUndeclared(g) ? 4 : rank[statusOf(g).cls]; };",
    "var rankOf = function (g) { return rank[statusOf(g).cls]; };"],
];

let killed = 0;
for (const [name, from, to] of MUT) {
  if (!RAW.includes(from)) {
    fail++;
    console.log("  ✘ Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ (ο ελεγκτής ξεκόλλησε): " + name);
    continue;
  }
  const mutated = RAW.replace(from, to);
  let survived = true;
  try {
    const c = boot(mutated);
    const r = scenarios(c);
    survived =
      r.ids.length === 3 &&
      !r.ids.includes(OVERSEER) &&
      r.byCode["10011672"] && r.byCode["10011672"].cls === "green" &&
      r.byCode["1000C238"] && r.byCode["1000C238"].cls === "yellow" &&
      r.byCode["10009A7F"] && r.byCode["10009A7F"].cls === "red" &&
      r.entries["10011672"] && r.entries["10011672"].lat != null &&
      r.cNet === "3" &&
      /Actility/.test(r.foot);
    if (survived) {
      /* Οι μεταλλάξεις χρόνου δεν φαίνονται στο βασικό σενάριο — ξεχωριστή κρίση. */
      const c3 = boot(mutated);
      c3.ingest([row("AAA", "green", "Λ", 0.1, 9, 35, 25, T_NEW)]);
      c3.ingest([row("AAA", "red", "Ν", 99, 1, 36, 26, T_OLD)]);
      const g = c3.sortedList()[0];
      survived = !!(g && c3.statusOf(g).cls === "green" && g.sensors === 9);
    }
    if (survived) {
      /* Η ταξινόμηση δεν φαίνεται στα παραπάνω — ξεχωριστή κρίση. */
      const cz = boot(mutated);
      const z = comboFirstIsNetwork(cz);
      survived = !!(z.n === 4 && z.first && z.first.code === "ZZZ"
        && z.last && cz.isUndeclared(z.last));
    }
  } catch (e) {
    survived = false;
  }
  if (survived) {
    fail++;
    console.log("  ✘ ΕΠΕΖΗΣΕ: " + name);
  } else {
    killed++;
    pass++;
    console.log("  ✔ σκοτώθηκε: " + name);
  }
}

console.log("\n══ ΣΥΝΟΨΗ ══");
console.log("  σενάρια+μεταλλάξεις: " + pass + " πέρασαν, " + fail + " απέτυχαν");
console.log("  μεταλλάξεις σκοτωμένες: " + killed + "/" + MUT.length);
process.exit(fail === 0 && killed === MUT.length ? 0 : 1);
