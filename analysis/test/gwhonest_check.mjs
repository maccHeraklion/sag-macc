/**
 * T-GWHONEST-01 — ο πίνακας ΔΕΝ λέει περισσότερα απ' όσα ξέρει.
 *
 * ΤΟ ΔΙΑΚΥΒΕΥΜΑ: μετρημένο 19/9 18:10, 145 από τις 220 συσκευές Actility έστειλαν
 * μέσα σε 2 ώρες — ΟΛΕΣ μέσω κάποιου gateway. Μόνο 38 λένε ποιο. Άρα ο πίνακας
 * κρίνει ΜΟΝΟ όσα gateways έχουν μάρτυρα. Αν χαθεί αυτή η πρόταση, το «8» διαβάζεται
 * «8 από 43 δουλεύουν» και κάποιος στέλνει τεχνικό σε gateway που δεν έχει τίποτα.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "..", "custom_html_files", "gateway-board.html");
const ANALYSIS = join(HERE, "..", "gatewayLiveness.js");
const RAW = readFileSync(PAGE, "utf8");
const ANA = readFileSync(ANALYSIS, "utf8");
const OVERSEER = "6a98855ca06e41000bfae024";

let pass = 0, fail = 0;
const ok = (c, n, d) => {
  if (c) { pass++; console.log("  ✔ " + n); }
  else { fail++; console.log("  ✘ " + n + (d ? " — " + d : "")); }
};

function boot(html) {
  const els = {};
  const mk = (id) => ({ id, textContent: "", innerHTML: "", children: [],
    setAttribute() {}, addEventListener() {}, appendChild(c) { this.children.push(c); } });
  for (const id of ["cTotal", "lTotal", "cGreen", "cYellow", "cRed", "cGrey",
    "cNoLoc", "cUndec", "cNet", "gwlist", "empty", "foot", "map"]) els[id] = mk(id);
  const ctx = {
    document: { getElementById: (i) => els[i] || null, createElement: () => mk("li") },
    window: {}, console: { log() {} }, setTimeout() {},
    Date, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]).runInContext(ctx);
  ctx.__els = els;
  return ctx;
}

const T = "2026-09-19T18:20:00.000Z";
const row = (code, color, state, ageH) => ({
  variable: "gateway_row", value: code, time: T, origin: OVERSEER,
  metadata: { color, state, sensors: 3, age_h: ageH, rssi: -70, text: "x",
    location: { lat: 35.1, lng: 25.1 } },
});
const summary = (seen, total) => ({
  variable: "gateway_summary", value: "x", time: T, origin: OVERSEER,
  metadata: { sensors_seen: seen, sensors_total: total, total: 10, alive: 8 },
});

function run(html, rows) {
  const c = boot(html);
  c.ingest(rows);
  c.render();
  return { foot: c.__els.foot.textContent, ctx: c };
}

const ROWS = [
  summary(38, 220),
  row("10011672", "green", "ΛΕΙΤΟΥΡΓΕΙ", 0.1),
  row("10009A7F", "red", "ΧΩΡΙΣ ΠΡΟΣΦΑΤΟ ΜΑΡΤΥΡΑ", 8672),
];

console.log("\n══ T-GWHONEST-01 · ΣΕΝΑΡΙΑ ══");

/* Α · οι ετικέτες των πλακιδίων */
ok(/με απόδειξη ζωής/.test(RAW)
  && !/>λειτουργούν</.test(RAW),
  "Α·1 το πλακίδιο λέει «με απόδειξη ζωής», όχι «λειτουργούν»");
ok(/χωρίς πρόσφατο μάρτυρα/.test(RAW)
  && !/δεν αποκρίνονται/.test(RAW),
  "Α·2 το κόκκινο πλακίδιο ΔΕΝ λέει «δεν αποκρίνονται»");

/* Β · η κάλυψη φτάνει στο υποσέλιδο με ΠΡΑΓΜΑΤΙΚΟΥΣ αριθμούς */
{
  const r = run(RAW, ROWS);
  ok(/38/.test(r.foot) && /220/.test(r.foot) && /ΚΑΛΥΨΗ/.test(r.foot),
    "Β·1 το υποσέλιδο λέει «38 από 220»", r.foot.slice(0, 150));
  ok(/ΑΟΡΑΤΑ/.test(r.foot) && /ΟΧΙ χαλασμένα/.test(r.foot),
    "Β·2 λέει ρητά ·ΑΟΡΑΤΑ, ΟΧΙ χαλασμένα·");
  ok(/ΔΕΝ σημαίνει χαλασμένο gateway/.test(r.foot),
    "Β·3 εξηγεί τι σημαίνει το κόκκινο", r.foot.slice(-160));
}

/* Γ · χωρίς σύνοψη ΔΕΝ επινοεί νούμερα */
{
  const r = run(RAW, ROWS.slice(1));
  ok(!/ΚΑΛΥΨΗ/.test(r.foot),
    "Γ·1 χωρίς σύνοψη ΔΕΝ γράφει κάλυψη", r.foot.slice(0, 90));
  ok(!/undefined|NaN/.test(r.foot), "Γ·2 καμία σκουπίδα (undefined/NaN)", r.foot.slice(0, 90));
}

/* Δ · η ΑΝΑΛΥΣΗ δεν λέει πια «ΔΕΝ ΑΠΑΝΤΑ» */
/* Κρίνουμε τον ΕΚΠΕΜΠΟΜΕΝΟ όρο, όχι κάθε αναφορά: το σχόλιο που εξηγεί την
   αλλαγή αναφέρει νόμιμα την παλιά λέξη. */
ok(!/state = "ΔΕΝ ΑΠΑΝΤΑ"/.test(ANA)
  && /state = "ΧΩΡΙΣ ΠΡΟΣΦΑΤΟ ΜΑΡΤΥΡΑ"/.test(ANA),
  "Δ·1 η ανάλυση ΕΚΠΕΜΠΕΙ «ΧΩΡΙΣ ΠΡΟΣΦΑΤΟ ΜΑΡΤΥΡΑ», όχι «ΔΕΝ ΑΠΑΝΤΑ»");
ok(/sensors_total: sensorsTotal/.test(ANA),
  "Δ·2 η ανάλυση στέλνει sensors_total");
ok(/ΔΕΝ σημαίνει ότι το gateway είναι χαλασμένο/.test(ANA),
  "Δ·3 η κάρτα του κόκκινου το εξηγεί");

/* Ε · Η ΚΟΝΣΟΛΑ λέει τα ίδια με τον πίνακα. Αν αποκλίνει, όποιος διαβάζει το log
   βγάζει άλλο συμπέρασμα από όποιον βλέπει την οθόνη — και οι δύο μας εμπιστεύονται. */
ok(!/ΣΥΝΟΨΗ\|gateways=\$\{total\}\|λειτουργούν=/.test(ANA),
  "Ε·1 η κονσόλα ΔΕΝ λέει πια «λειτουργούν/νεκρά»");
ok(/ΚΑΛΥΨΗ=\$\{stillKnown\.length\}\/\$\{sensorsTotal\}/.test(ANA),
  "Ε·2 η κονσόλα τυπώνει την κάλυψη X/Y");
ok(/ΑΟΡΑΤΑ, ΟΧΙ νεκρά/.test(ANA),
  "Ε·3 η κονσόλα εξηγεί τι σημαίνει το «ορατά»");

console.log("\n══ ΜΕΤΑΛΛΑΞΕΙΣ ══");
const MUT = [
  ["η γραμμή κάλυψης σβήνεται",
    "    if (net > 0 && isFinite(state.seen) && isFinite(state.totalSensors)",
    "    if (false && isFinite(state.seen) && isFinite(state.totalSensors)"],
  ["η σύνοψη δεν αποθηκεύεται",
    "        state.seen = Number(sm.sensors_seen);",
    "        state.seen = undefined;"],
  ["χάνεται η εξήγηση του κόκκινου",
    "    if (c.red > 0) {", "    if (false) {"],
];

let killed = 0;
for (const [name, from, to] of MUT) {
  if (!RAW.includes(from)) {
    fail++;
    console.log("  ✘ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + name);
    continue;
  }
  let survived = true;
  try {
    const r = run(RAW.replace(from, to), ROWS);
    survived = /38/.test(r.foot) && /220/.test(r.foot) && /ΚΑΛΥΨΗ/.test(r.foot)
      && /ΔΕΝ σημαίνει χαλασμένο gateway/.test(r.foot);
  } catch (_e) { survived = false; }
  if (survived) { fail++; console.log("  ✘ ΕΠΕΖΗΣΕ: " + name); }
  else { killed++; pass++; console.log("  ✔ σκοτώθηκε: " + name); }
}

console.log("\n══ ΣΥΝΟΨΗ ══");
console.log("  " + pass + " πέρασαν, " + fail + " απέτυχαν · μεταλλάξεις " + killed + "/" + MUT.length);
process.exit(fail === 0 && killed === MUT.length ? 0 : 1);
