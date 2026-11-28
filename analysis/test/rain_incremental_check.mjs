// Ελεγκτής T-RAIN-INC-01 · βροχή v34.4 (αυξητική) έναντι v34.3 (πλήρης κάθε ώρα).
// Τρέχει ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ κώδικα των δύο εκδόσεων ώρα προς ώρα (με τα μεσάνυχτα Ελλάδας ενδιάμεσα) σε πανομοιότυπους
// εικονικούς σταθμούς που γεμίζουν σταδιακά, και ελέγχει:
//  I1 ίδια τρέχοντα σύνολα (σήμερα/εβδομάδα/μήνας/φέτος: τιμή, μερικό, είδος) μετά από ΚΑΘΕ εκτέλεση· ίδιες κλειστές περίοδοι στο τέλος
//  I2 ο ελαφρύς κύκλος διαβάζει πολύ λιγότερες εγγραφές (μετρητής ανά getData)
//  I3 καθυστερημένα δεδομένα: η v34.4 τα παίρνει στον επόμενο πλήρη κύκλο και καταλήγει στο ίδιο αποτέλεσμα
//  I4 RAIN_INC=off (forceFull) = πάντα πλήρης
//  I5 η ανάλυση δεν έτρεξε 4 ώρες: η v34.4 κάνει πλήρη κύκλο και δεν χάνει ώρες
//  Όλα ξεκινούν από τρέχοντα σύνολα της v34.3 (χωρίς κατάσταση), όπως στο ζωντανό σύστημα.
// Η v34.3 διαβάζεται από το git (commit 7fe98fd, ίδιος κώδικας με τη ζωντανή πριν την αλλαγή + μετρητής).
// Κάθε μετάλλαξη της v34.4 πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const anPath = path.join(here, "..", "calculate_old_rainHeightSums.js");
const NEW = fs.readFileSync(anPath, "utf8").replace(/\r\n/g, "\n");
const OLD = execSync("git show 7fe98fde737004bf381ad53d92f712db067405e0:analysis/calculate_old_rainHeightSums.js", { cwd: here, maxBuffer: 1 << 24 }).toString("utf8").replace(/\r\n/g, "\n");
const req = createRequire(anPath);
const moment = req("moment-timezone");
const LOG = [];
function load(src) {
  const mock = { Analysis: { use() {} }, Resources: {}, Account: class {}, Device: class {} };
  const shim = (m) => (m === "@tago-io/sdk" ? mock : req(m));
  const mod = { exports: {} };
  new Function("require", "module", "exports", "console", src)(shim, mod, mod.exports, { log: (m) => LOG.push(String(m)) });
  return mod.exports;
}
function fakeDevice() {
  const S = {}; const sent = []; const meter = { recs: 0, calls: 0, agg: 0 };
  return {
    S, sent, meter,
    add(v, t, val, extra) { (S[v] = S[v] || []).push(Object.assign({ t, v: val }, extra || {})); },
    async getData(q) {
      meter.calls++;
      const vars = q.variables || [q.variable];
      let rows = [];
      for (const v of vars) rows = rows.concat((S[v] || []).map(x => ({ variable: v, value: x.v, time: new Date(x.t).toISOString(), metadata: x.metadata, group: x.group })));
      const s = q.start_date ? Date.parse(q.start_date) : -Infinity, e = q.end_date ? Date.parse(q.end_date) : Infinity;
      rows = rows.filter(r => { const t = Date.parse(r.time); return t >= s && t <= e; });
      if (q.query === "sum") { meter.agg++; return [{ value: rows.reduce((a, r) => a + Number(r.value), 0) }]; }
      rows.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
      if ((q.ordination || "descending") === "descending") rows.reverse();
      const out = rows.slice(0, q.qty || 15); meter.recs += out.length;
      return JSON.parse(JSON.stringify(out));   // όπως το δίκτυο: αντίγραφα, όχι αναφορές
    },
    async sendData(arr) {
      for (const x of [].concat(arr)) { const c = JSON.parse(JSON.stringify(x)); sent.push(c); (S[c.variable] = S[c.variable] || []).push({ t: Date.parse(c.time), v: c.value, metadata: c.metadata, group: c.group }); }
    },
  };
}
const Z = (s) => Date.parse(s);
const cut = Z("2026-10-04T21:00:00.000Z"), TZ = "Europe/Athens";
const PTD = ["current_rain_height_daily", "current_rain_height_weekly", "current_rain_height_monthly", "current_rain_height_yearly"];
const CLOSED = ["rain_height_hourly", "rain_height_daily", "rain_height_weekly", "rain_height_monthly", "rain_height_yearly"];
async function runAt(A, ms, dev, forceFull) {
  const real = Date.now; Date.now = () => ms; const r0 = dev.meter.recs;
  try { await A.computeForDevice(dev, "δοκιμή", { TZ, cutMs: cut, forceFull: !!forceFull }); } finally { Date.now = real; }
  return dev.meter.recs - r0;
}
const lastOf = (dev, v) => { const a = dev.S[v] || []; return a.length ? a[a.length - 1] : null; };
const ptdView = (dev) => PTD.map(v => { const x = lastOf(dev, v); return x ? [v.slice(19), Math.round(x.v * 1000) / 1000, !!(x.metadata && x.metadata.partial), x.metadata && x.metadata.status] : [v.slice(19), null]; });
const closedView = (dev) => {   // καλύτερη εγγραφή ανά περίοδο (όπως το widget): v34 με μεγαλύτερη κάλυψη
  const o = {};
  for (const v of CLOSED) for (const x of (dev.S[v] || [])) {
    const m = x.metadata || {}; if (m.alg !== "v34") continue;
    const k = v + "|" + m.period_start_utc, prev = o[k];
    if (!prev || Number(m.coverage) > prev[1]) o[k] = [Math.round(x.v * 1000) / 1000, Number(m.coverage), m.status];
  }
  return o;
};

// Σενάριο: μετρητής κάθε 5΄, βροχή σε τρία επεισόδια (ένα ακριβώς γύρω από τα μεσάνυχτα Ελλάδας), σιωπή 5 ωρών 25/11,
// μηνιαίες εγγραφές v33 Απρίλιος–Σεπτέμβριος για το «φέτος». Ρυθμός: σταθμός fw 1.13 κάθε 10΄.
const T0 = Z("2026-11-14T00:00:00Z");
const rainAt = (t) => (t > Z("2026-11-15T10:00:00Z") && t <= Z("2026-11-15T11:00:00Z")) ? 0.254
  : (t > Z("2026-11-24T05:00:00Z") && t <= Z("2026-11-24T07:00:00Z")) ? 0.254
  : (t > Z("2026-11-26T21:20:00Z") && t <= Z("2026-11-26T22:40:00Z")) ? 0.508
  : (t > Z("2026-11-27T03:00:00Z") && t <= Z("2026-11-27T03:30:00Z")) ? 0.254 : 0;
const silent = (t) => t > Z("2026-11-25T08:00:00Z") && t < Z("2026-11-25T13:00:00Z");
function seedMonthly(dev) {
  for (let m = 4; m <= 9; m++) {
    const s = moment.utc(`2026-${String(m).padStart(2, "0")}-01`), e = s.clone().endOf("month");
    dev.add("rain_height_monthly", e.valueOf() + 14000, 12 + m, { metadata: { period_start_utc: s.toISOString(), period_end_utc: e.toISOString(), source_variable: "rain_height_acc" } });
  }
}
function feed(dev, kind, from, to, st) {   // προσθέτει δεδομένα (from, to]
  for (let t = from - (from % 300000) + 300000; t <= to; t += 300000) {
    if (silent(t)) continue;
    if (kind === "acc") { st.acc = Math.round((st.acc + rainAt(t)) * 1000) / 1000; dev.add("rain_height_acc", t, st.acc); }
    else if (t % 600000 === 0) dev.add("rain_height", t, Math.round(rainAt(t) * 2 * 1000) / 1000);
  }
}

async function scenario(Anew, Aold, kind, opts) {
  const f = [];
  const dn = fakeDevice(), dold = fakeDevice(); seedMonthly(dn); seedMonthly(dold);
  const sn = { acc: 100 }, so = { acc: 100 };
  let tFed = T0;
  const start = Z("2026-11-26T17:06:00Z"), end = Z("2026-11-27T12:06:00Z");
  feed(dn, kind, tFed, start - 60000, sn); feed(dold, kind, tFed, start - 60000, so); tFed = start - 60000;
  const reads = { full: [], light: [] };
  // μετάβαση: πριν την πρώτη v34.4 υπάρχουν τρέχοντα σύνολα της v34.3 (χωρίς metadata.inc) — όπως στο ζωντανό
  await runAt(Aold, start - 3600000, dn, false); await runAt(Aold, start - 3600000, dold, false);
  const lateWin = (t) => opts && opts.late && t >= Z("2026-11-27T06:06:00Z");
  for (let t = start; t <= end; t += 3600000) {
    if (opts && opts.outage && t > Z("2026-11-27T04:30:00Z") && t < Z("2026-11-27T09:00:00Z")) continue;   // I5: η ανάλυση δεν έτρεξε 4 ώρες
    feed(dn, kind, tFed, t - 30000, sn); feed(dold, kind, tFed, t - 30000, so); tFed = t - 30000;
    if (opts && opts.late && t === Z("2026-11-27T06:06:00Z")) {   // I3: καθυστερημένα δεδομένα για τη σιωπή της 25/11 (ήρθαν τώρα)
      for (const d of [dn, dold]) for (let u = Z("2026-11-25T08:05:00Z"); u < Z("2026-11-25T13:00:00Z"); u += 300000) {
        const prev = (d.S.rain_height_acc || []).filter(x => x.t < u).pop();
        if (kind === "acc") d.add("rain_height_acc", u, prev ? prev.v : 100);
      }
      for (const d of [dn, dold]) d.S.rain_height_acc && d.S.rain_height_acc.sort((a, b) => a.t - b.t);
    }
    LOG.length = 0;
    const rn = await runAt(Anew, t, dn, opts && opts.forceFull);
    const wasFull = !LOG.some(x => x.includes("· ελαφρύς ·"));
    await runAt(Aold, t, dold, false);
    (wasFull ? reads.full : reads.light).push(rn);
    const a = JSON.stringify(ptdView(dn)), b = JSON.stringify(ptdView(dold));
    if (a !== b && !lateWin(t)) f.push("I1 " + kind + " " + new Date(t).toISOString().slice(5, 16) + " τρέχοντα: νέα " + a + " ≠ παλιά " + b);
    if (!lateWin(t)) {   // κλειστές περίοδοι ίδιες ΜΕΤΑ ΑΠΟ ΚΑΘΕ εκτέλεση (όχι μόνο στο τέλος)
      const cn = closedView(dn), co = closedView(dold);
      for (const k of new Set([...Object.keys(cn), ...Object.keys(co)])) if (JSON.stringify(cn[k]) !== JSON.stringify(co[k])) { f.push("I1 " + kind + " " + new Date(t).toISOString().slice(5, 16) + " κλειστή " + k + ": νέα " + JSON.stringify(cn[k]) + " ≠ παλιά " + JSON.stringify(co[k])); break; }
    }
  }
  // τέλος: ένας πλήρης κύκλος της νέας (όπως τα μεσάνυχτα) και σύγκριση κλειστών περιόδων
  await runAt(Anew, end + 3600000, dn, true); await runAt(Aold, end + 3600000, dold, false);
  const cn = closedView(dn), co = closedView(dold);
  const keys = new Set([...Object.keys(cn), ...Object.keys(co)]);
  let diff = 0; for (const k of keys) if (JSON.stringify(cn[k]) !== JSON.stringify(co[k])) { diff++; if (diff <= 3) f.push("I1 " + kind + " κλειστή " + k + ": νέα " + JSON.stringify(cn[k]) + " ≠ παλιά " + JSON.stringify(co[k])); }
  if (JSON.stringify(ptdView(dn)) !== JSON.stringify(ptdView(dold))) f.push("I1 " + kind + " τρέχοντα μετά τον πλήρη: " + JSON.stringify(ptdView(dn)) + " ≠ " + JSON.stringify(ptdView(dold)));
  return { f, reads, dn };
}

async function run(srcNew) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  let An, Ao; try { An = load(srcNew); Ao = load(OLD); } catch (e) { return ["φόρτωση: " + e.message]; }
  ok(An.RAIN_VERSION === "v34.5 · 2026-11-28" && Ao.RAIN_VERSION === "v34.3 · 2026-11-09", "I0 εκδόσεις v34.5 / v34.3");
  for (const kind of ["acc", "rate"]) {
    const r = await scenario(An, Ao, kind);
    f.push(...r.f);
    const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    ok(r.reads.light.length >= 15, "I2 " + kind + " οι περισσότερες εκτελέσεις είναι ελαφριές (" + r.reads.light.length + " ελαφριές, " + r.reads.full.length + " πλήρεις)");
    ok(r.reads.full.length >= 1 && r.reads.full.length <= 3, "I2 " + kind + " πλήρης κύκλος 1–3 φορές στο 20ωρο (μετάβαση + μεσάνυχτα) (" + r.reads.full.length + ")");
    ok(avg(r.reads.light) * 4 < avg(r.reads.full), "I2 " + kind + " ελαφρύς < ¼ του πλήρους σε εγγραφές (" + Math.round(avg(r.reads.light)) + " έναντι " + Math.round(avg(r.reads.full)) + ")");
  }
  const O = await scenario(An, Ao, "acc", { outage: true });
  f.push(...O.f.map(x => "I5 " + x));
  const L = await scenario(An, Ao, "acc", { late: true });
  f.push(...L.f.map(x => "I3 " + x));
  const F = await scenario(An, Ao, "acc", { forceFull: true });
  ok(F.reads.light.length === 0, "I4 RAIN_INC=off: καμία ελαφριά εκτέλεση (" + F.reads.light.length + ")");
  f.push(...F.f.map(x => "I4 " + x));
  return f;
}

const base = await run(NEW);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.slice(0, 12).join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["n1 κατάσταση χθεσινή", "x.v === INC_V && x.day === dNow.key && m.alg === RAIN_ALG", "x.v === INC_V && m.alg === RAIN_ALG"],
  ["n2 ελαφρύς χωρίς έλεγχο κενού", "!(newest >= hNow.s - (INC_HOURS + 1) * 3600000)) full = true;", "false) full = true;"],
  ["n3 δεν αποθηκεύεται κατάσταση", "      && JSON.stringify(lm.inc || null) === JSON.stringify(inc);", "      ;"],
  ["n4 ελαφρύς διαβάζει 24 ώρες", "  const HB = full ? HOURS_BACK : INC_HOURS;", "  const HB = HOURS_BACK;"],
  ["n5 εβδομάδα από τον μήνα", "  const closedOf = (p) => (p === wNow ? inc.w : inc.m);", "  const closedOf = (p) => inc.m;"],
  ["n6 έτος χωρίς κλειστούς μήνες", "    let mm = inc.y.mm, covered = inc.y.cov, est = inc.y.est;", "    let mm = 0, covered = 0, est = inc.y.est;"],
  ["n7 πάντα ελαφρύς (χωρίς πλήρη)", "  let full = !st, hRecs = null;", "  let full = false, hRecs = null; if (!st) st = { v: 1, day: dNow.key, w: { mm: 0, cov: 0, est: false }, m: { mm: 0, cov: 0, est: false }, y: { mm: 0, cov: 0, est: false, since: null } };"],
  ["n8 διακόπτης off αγνοείται", "  if (!cfg.forceFull) for (const v of PTD_VARS) {", "  if (true) for (const v of PTD_VARS) {"],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!NEW.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = await run(NEW.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 110)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
