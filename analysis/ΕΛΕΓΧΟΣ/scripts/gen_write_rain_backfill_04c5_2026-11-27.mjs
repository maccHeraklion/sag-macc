// T-RAIN-BACKFILL-01 · 27/11/2026 · Παράγει το script ΕΓΓΡΑΦΗΣ (probe analysis) από την έξοδο του build_rain_backfill_04c5.
// Οι εγγραφές μπαίνουν συμπιεσμένες (βάση 36, με hash FNV-1a) και ξαναχτίζονται στο TagoIO ΑΚΡΙΒΩΣ όπως η payload()
// της v34.4. Ο γεννήτορας ελέγχει τοπικά ότι η ανακατασκευή = έξοδος build (εκτός calc_at) πριν γράψει το script.
// Χρήση: node gen_write_rain_backfill_04c5_2026-11-27.mjs <backfill_04c5.json> <write_probe.js>
import fs from "node:fs";
const [, , inFile, outFile] = process.argv;
const R = JSON.parse(fs.readFileSync(inFile, "utf8"));
const FROM = Date.parse("2026-05-01T00:00:00Z");
// Κωδικοποίηση: «δείκτης[:mm×1000[:κάλυψη×1000]]» σε βάση 36· παραλείπεται mm=0 / κάλυψη=1000· μερική ⇔ κάλυψη < 995 (ελέγχεται).
const TH = [], TD = [];
for (const r of R) {
  const m = r.metadata, s = Date.parse(m.period_start_utc), c = Math.round(m.coverage * 1000), v = Math.round(r.value * 1000);
  if ((c < 995) !== !!m.partial) throw new Error("μερική ≠ κάλυψη<995 στο " + m.period_key);
  const h = r.variable === "rain_height_hourly";
  if (!h && r.variable !== "rain_height_daily") throw new Error("άγνωστη μεταβλητή");
  const i = (s - FROM) / (h ? 3600000 : 86400000);
  if (!Number.isInteger(i)) throw new Error("μη ακέραιος δείκτης");
  let t = i.toString(36); if (v || c !== 1000) t += ":" + v.toString(36); if (c !== 1000) t += ":" + c.toString(36);
  (h ? TH : TD).push(t);
}
const PACK = TH.join(" ") + "|" + TD.join(" ");
const fnv = (str) => { let x = 0x811c9dc5; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x; };
const HASH = fnv(PACK);
// ---- το σώμα που τρέχει ΚΑΙ τοπικά (έλεγχος) ΚΑΙ στο TagoIO ----
const BUILD = `
const FROM = ${FROM};
const VERSION = "v34.4 · 2026-11-27";
const iso = (ms) => new Date(ms).toISOString();
function unpack(P) {
  const [a, b] = P.split("|");
  const dec = (t) => { const [i, v, c] = t.split(":"); const cc = c === undefined ? 1000 : parseInt(c, 36); return [parseInt(i, 36), v === undefined ? 0 : parseInt(v, 36), cc, cc < 995 ? 1 : 0]; };
  return [a.split(" ").map(dec), b.split(" ").map(dec)];
}
function build(H, D, calcAt) {
  const out = [];
  const one = (variable, unit, row, span, keyOf) => {
    const s = FROM + row[0] * span, e = s + span;
    out.push({ variable, unit: "mm", value: row[1] / 1000, time: iso(Math.floor((s + e) / 2)), metadata: {
      aggregation: "sum", alg: "v34", version: VERSION, mode: "closed_period", period: unit, period_key: keyOf(s),
      period_start_utc: iso(s), period_end_utc: iso(e), status: "estimate", partial: !!row[3], coverage: row[2] / 1000,
      method: "rate_sum", calc_at: calcAt, backfill: "T-RAIN-BACKFILL-01" } });
  };
  for (const r of H) one("rain_height_hourly", "hour", r, 3600000, (s) => iso(s).slice(0, 13));
  for (const r of D) one("rain_height_daily", "day", r, 86400000, (s) => iso(s).slice(0, 10));
  return out;
}`;
// τοπικός έλεγχος
const [H, D] = new Function(BUILD + "\nreturn unpack;")()(PACK);
const local = new Function(BUILD + "\nreturn build;")()(H, D, "X");
const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.metadata.calc_at; return JSON.stringify(c); };
if (local.length !== R.length) throw new Error("πλήθος " + local.length + " ≠ " + R.length);
for (let i = 0; i < R.length; i++) if (strip(local[i]) !== strip(R[i])) throw new Error("διαφορά στην εγγραφή " + i + "\n" + strip(local[i]) + "\n" + strip(R[i]));
const SRC = `// SAG — ΕΓΓΡΑΦΗ ΒΡΟΧΗΣ (T-RAIN-BACKFILL-01) · 27/11/2026 · Σκοτίνα Πάνω (s2120 04c5) · ΜΟΝΟ ΠΡΟΣΘΗΚΗ, καμία διαγραφή.
// ${H.length} ωριαίες rain_height_hourly (1/5–17/8/2026 10:00 UTC) και ${D.length} ημερήσιες rain_height_daily (1/5–2/8/2026), που έλειπαν
// εντελώς ενώ τα ωμά rain_height υπάρχουν. Υπολογισμός με τις συναρτήσεις της v34.4 (build_rain_backfill_04c5_2026-11-27.mjs)·
// τα μηνιαία σύνολα ταυτίζονται με τις υπάρχουσες μηνιαίες v33 (44,478 · 172,786 · 95,998 mm). Παράχθηκε από
// gen_write_rain_backfill_04c5_2026-11-27.mjs. Φύλακας: αν υπάρχει ήδη ΟΠΟΙΑΔΗΠΟΤΕ ωριαία/ημερήσια εγγραφή στο διάστημα → ματαίωση.
// Πολιτικές: 6ac171e0 (ανάγνωση) + προσωρινή send_data μόνο στη συσκευή 67f3ec9f…, ενεργές μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ID = "67f3ec9f30b56a00090d20d6";
${BUILD}
const PACK = ${JSON.stringify(PACK)};
const HASH = ${HASH}, NH = ${H.length}, ND = ${D.length};
const fnv = ${fnv.toString()};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
async function call(method, p, body) {
  for (let k = 0; k < 3; k++) {
    await sleep(300 + k * 2500);
    const r = await fetch(API + p, { method, headers: { Authorization: TOKEN, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (j.status) return j.result;
    if (k === 2) throw new Error(method + " " + r.status + " " + JSON.stringify(j.message || j).slice(0, 160));
  }
}
(async () => {
  console.log("ΒΓ=== εγγραφή βροχής 04c5 · " + new Date().toISOString() + " ===");
  const hx = await call("GET", "/device/" + ID + "/data?" + q({ variable: "rain_height_hourly", start_date: "2026-05-01T00:00:00Z", end_date: "2026-08-17T09:59:59Z", qty: 1 }));
  const dx = await call("GET", "/device/" + ID + "/data?" + q({ variable: "rain_height_daily", start_date: "2026-05-01T00:00:00Z", end_date: "2026-08-02T23:59:59Z", qty: 1 }));
  if ((hx && hx.length) || (dx && dx.length)) { console.log("ΒΓ1|ΜΑΤΑΙΩΣΗ: υπάρχουν ήδη εγγραφές στο διάστημα (ωριαίες " + (hx || []).length + ", ημερήσιες " + (dx || []).length + ") " + JSON.stringify((hx || dx)[0]).slice(0, 300)); return; }
  if (fnv(PACK) !== HASH) { console.log("ΒΓ1|ΜΑΤΑΙΩΣΗ: αλλοιωμένα δεδομένα (hash)"); return; }
  const [H, D] = unpack(PACK);
  if (H.length !== NH || D.length !== ND) { console.log("ΒΓ1|ΜΑΤΑΙΩΣΗ: πλήθος"); return; }
  const recs = build(H, D, new Date().toISOString());
  let sent = 0;
  for (let i = 0; i < recs.length; i += 200) {
    const part = recs.slice(i, i + 200);
    const res = await call("POST", "/device/" + ID + "/data", part);
    sent += part.length;
    console.log("ΒΓ2|παρτίδα " + (i / 200 + 1) + " · " + part.length + " · " + JSON.stringify(res).slice(0, 80));
  }
  await sleep(4000);
  const ch = await call("GET", "/device/" + ID + "/data?" + q({ variable: "rain_height_hourly", start_date: "2026-05-01T00:00:00Z", end_date: "2026-08-17T09:59:59Z", qty: 3000 }));
  const cd = await call("GET", "/device/" + ID + "/data?" + q({ variable: "rain_height_daily", start_date: "2026-05-01T00:00:00Z", end_date: "2026-08-02T23:59:59Z", qty: 200 }));
  const sum = (a) => Math.round((a || []).reduce((s, x) => s + Number(x.value), 0) * 1000) / 1000;
  const bf = (a) => (a || []).filter((x) => x.metadata && x.metadata.backfill === "T-RAIN-BACKFILL-01").length;
  console.log("ΒΓ3|στάλθηκαν " + sent + " · ωριαίες στο σύστημα " + (ch || []).length + " (backfill " + bf(ch) + ", Σ " + sum(ch) + " mm) · ημερήσιες " + (cd || []).length + " (backfill " + bf(cd) + ", Σ " + sum(cd) + " mm)");
  console.log("ΒΓ=== τέλος ===");
})();
`;
fs.writeFileSync(outFile, SRC);
console.log(JSON.stringify({ hourly: H.length, daily: D.length, bytes: SRC.length, roundtrip: "ok" }));
