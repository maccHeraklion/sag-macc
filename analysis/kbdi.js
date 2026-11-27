/**
 * TagoIO Analysis — Keetch-Byram Drought Index · kbdi-v2 · T-KBDI-FIX-01 (28/11/2026)
 * Analysis 681bb24d8ee17b000a2ab2cd «Keetch-Byram Drought Index» · Action 681bc330… (cron 23:59 Europe/Athens).
 * Σταθμοί: συσκευές με ετικέτα topalidouType = weatherStation (σταθμοί Ινστιτούτου Δασικών Ερευνών).
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ (η v1 του 2025 ήταν άκυρη από την αρχή — ημερολόγιο SC-0005):
 *  1. «Μέγιστη» θερμοκρασία = min(0, τιμές) → στην πράξη 0 °C. Τώρα: μέγιστη θερμοκρασία της ημέρας.
 *  2. «Ελάχιστη» υγρασία = η μέγιστη. Τώρα: το VPD της ημέρας από ζεύγη θερμοκρασίας/υγρασίας της ίδιας ώρας.
 *  3. Στον παρονομαστή του τύπου έμπαινε η βροχή της ημέρας αντί για τη ΜΕΣΗ ΕΤΗΣΙΑ βροχή της θέσης.
 *  4. Η βροχή δεν αφαιρούνταν ποτέ από τον δείκτη.
 *  5. Βροχή μόνο από `rain_height` → μηδέν στους σταθμούς με μετρητή (Όρμα, Βρία 2).
 *  6. Παράθυρο «τελευταίες 24 ώρες» αντί για ημέρα.
 *
 * ΜΕΘΟΔΟΣ (μετρική μορφή Keetch & Byram 1968 · Crane 1982 · Alexander 1990):
 *   Q (mm, 0–203,2) = έλλειμμα υγρασίας. Κάθε ημέρα, με τη σειρά:
 *   α) Καθαρή βροχή: σε κάθε συνεχόμενο βροχερό διάστημα τα πρώτα 5,1 mm (0,2 in) δεν μετρούν (συγκράτηση από κόμη/φύλλωμα).
 *      Q ← max(0, Q − καθαρή βροχή).
 *   β) Συντελεστής ξήρανσης DF = (203,2 − Q)·(0,968·e^(0,0875·Tmax + 1,5552) − 8,30) / (1 + 10,88·e^(−0,001736·R)) · 10⁻³,
 *      Tmax = μέγιστη θερμοκρασία ημέρας (°C), R = μέση ετήσια βροχή της θέσης (mm). DF < 0 → 0. Q ← min(203,2, Q + DF).
 *   Ημέρα: η ίδια περίοδος με τον υπολογισμό βροχής (ημέρα UTC έως 4/10/2026, ημέρα Ελλάδας από 5/10/2026).
 *   Βροχή ημέρας: η εγγραφή `rain_height_daily` του ενιαίου υπολογισμού βροχής (μετρητής ή ένταση· v34 πριν από v33).
 *   Tmax και VPD: από ωριαία μέγιστα θερμοκρασίας και ελάχιστα υγρασίας (aggregate)· VPD ημέρας = μέγιστο ωριαίο
 *   es(Tmax_h)·(1 − RHmin_h/100) ≈ μέγιστο έλλειμμα της ημέρας (όπως ο αρχικός ορισμός «Tmax, RHmin»).
 *   R: ετικέτα συσκευής `kbdi_annual_rain_mm`, αλλιώς DEFAULT_ANNUAL_RAIN_MM (ΥΠΟ ΕΛΕΓΧΟ — να δοθεί κλιματική τιμή ανά θέση).
 *   Αρχή: Q = 0 στις 1/5/2026 (πρώτη ημέρα με διαθέσιμα ωμά δεδομένα· ΥΠΟ ΕΛΕΓΧΟ — υποθέτει κορεσμένο έδαφος μετά την άνοιξη).
 *
 * ΕΚΤΕΛΕΣΗ: κάθε τρέξιμο συνεχίζει από την τελευταία ημέρα kbdi-v2 και υπολογίζει ΟΛΕΣ τις κλειστές ημέρες μετά από αυτήν
 * (το πρώτο τρέξιμο = επανυπολογισμός από 1/5/2026). Ημέρα χωρίς εγγραφή βροχής ακόμη (π.χ. ο υπολογισμός βροχής δεν έτρεξε)
 * αναμένει, εκτός αν είναι παλαιότερη από 2 ημέρες (τότε βροχή = άγνωστη, σημειώνεται). Τίποτα δεν σβήνεται.
 * Εγγραφές: kbdi1, soil_moisture_condition1, vpd1, stress_level1 στις 23:59:50 της ημέρας, metadata.alg = "kbdi-v2".
 */
const { Analysis, Resources, Utils, Account, Device } = require("@tago-io/sdk");
const moment = require("moment-timezone");

const KBDI_ALG = "kbdi-v2";
const KBDI_VERSION = "kbdi-v2 · 2026-11-28";
const TZ = "Europe/Athens";
const CUTOVER_MS = Date.parse("2026-10-04T21:00:00.000Z");   // ίδιο με τον υπολογισμό βροχής (v34)
const START_DAY_MS = Date.parse("2026-05-01T00:00:00.000Z");
const Q_MAX = 203.2;
const RAIN_INTERCEPT_MM = 5.1;
const DEFAULT_ANNUAL_RAIN_MM = 700;
const RAIN_WAIT_DAYS = 2;
const MAX_DAYS_PER_RUN = 400;
const FULL_COV = 0.995;

// ---------- ημέρα, ίδια με τον υπολογισμό βροχής ----------
function dayContaining(ms) {
  const st = moment.tz(ms, TZ).startOf("day");
  const en = st.clone().add(1, "day");
  let s = st.valueOf(), e = en.valueOf();
  if (s < CUTOVER_MS) {
    s = moment.utc(st.format("YYYY-MM-DDTHH:mm:ss")).valueOf();
    if (e < CUTOVER_MS) e = moment.utc(en.format("YYYY-MM-DDTHH:mm:ss")).valueOf();
  }
  return { s, e, key: st.format("YYYY-MM-DD") };
}
function nextDay(d) { return dayContaining(d.e + 3600000); }

// ---------- επιστήμη ----------
function droughtFactor(Q, tmax, annualRain) {
  const num = (Q_MAX - Q) * (0.968 * Math.exp(0.0875 * tmax + 1.5552) - 8.30);
  const den = 1 + 10.88 * Math.exp(-0.001736 * annualRain);
  return Math.max(0, (num / den) * 1e-3);
}
/** Μία ημέρα: { q, cum } → { q, cum, net, df }. rain = null → άγνωστη (σαν 0, χωρίς να μηδενίσει το βροχερό διάστημα). */
function kbdiStep(state, rain, tmax, annualRain) {
  let { q, cum } = state;
  let net = 0;
  if (rain != null && rain > 0) {
    const before = cum;
    cum += rain;
    net = before >= RAIN_INTERCEPT_MM ? rain : Math.max(0, cum - RAIN_INTERCEPT_MM);
    q = Math.max(0, q - net);
  } else if (rain != null) {
    cum = 0;
  }
  const df = Number.isFinite(tmax) ? droughtFactor(q, tmax, annualRain) : 0;
  q = Math.min(Q_MAX, q + df);
  return { q, cum, net, df };
}
function es(t) { return 0.6108 * Math.exp((17.27 * t) / (t + 237.3)); }
function soilCondition(q) {
  if (q < 40) return "wet";
  if (q < 100) return "drying";
  if (q < 160) return "droughty";
  return "severe drought";
}
function stressLevel(vpd) {
  if (vpd < 0.5) return "No stress";
  if (vpd < 1.2) return "Mild";
  if (vpd < 2) return "Moderate";
  if (vpd < 2.5) return "High";
  return "Severe";
}
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------- δεδομένα ----------
async function hourlyAgg(device, variable, fn, fromMs, toMs) {
  const out = new Map();
  for (let a = fromMs; a < toMs; ) {
    const b = Math.min(toMs, moment.utc(a).add(1, "month").valueOf());
    const r = await device.getData({ variables: [variable], query: "aggregate", interval: "hour", function: fn,
      start_date: new Date(a).toISOString(), end_date: new Date(b - 1).toISOString() });
    for (const x of Array.isArray(r) ? r : []) {
      const t = Date.parse(x.time), v = Number(x.value);
      if (Number.isFinite(t) && Number.isFinite(v)) out.set(Math.floor(t / 3600000) * 3600000, v);
    }
    a = b;
  }
  return out;
}
/** Καλύτερη εγγραφή βροχής ανά αρχή περιόδου: v34 πάνω από v33, μετά μεγαλύτερη κάλυψη, μετά νεότερη (όπως ταμπλό/εξαγωγή). */
function bestDailyRain(records) {
  const best = new Map();
  for (const x of records || []) {
    const m = x.metadata || {};
    const s = Date.parse(m.period_start_utc);
    if (!Number.isFinite(s)) continue;
    const v = Number(x.value);
    if (!Number.isFinite(v)) continue;
    const cov = m.alg === "v34" ? (Number.isFinite(Number(m.coverage)) ? Number(m.coverage) : 1) : 1;
    const rank = (m.alg === "v34" ? 2 : 1) + cov;
    const prev = best.get(s);
    if (!prev || rank > prev.rank || (rank === prev.rank && Date.parse(x.time) > prev.t)) best.set(s, { mm: v, cov, rank, t: Date.parse(x.time), alg: m.alg || "v33" });
  }
  return best;
}

async function processStation(device, info, nowMs, log) {
  const tag = (k) => { const t = (info.tags || []).find((x) => x.key === k); return t ? t.value : undefined; };
  const annualRain = Number(tag("kbdi_annual_rain_mm")) > 0 ? Number(tag("kbdi_annual_rain_mm")) : DEFAULT_ANNUAL_RAIN_MM;
  // τελευταία ημέρα kbdi-v2
  const recent = await device.getData({ variables: ["kbdi1"], qty: 20, ordination: "descending" });
  const last = (recent || []).find((x) => x.metadata && x.metadata.alg === KBDI_ALG && x.metadata.period_start_utc);
  let state, day;
  if (last) {
    state = { q: Number(last.value), cum: Number(last.metadata.cum_rain_mm) || 0 };
    day = nextDay(dayContaining(Date.parse(last.metadata.period_start_utc) + 3600000));
  } else {
    state = { q: 0, cum: 0 };
    day = dayContaining(START_DAY_MS + 3600000);
  }
  const days = [];
  for (let d = day, i = 0; d.e <= nowMs && i < MAX_DAYS_PER_RUN; d = nextDay(d), i++) days.push(d);
  if (!days.length) { log(`${info.name}: τίποτα νέο (τελευταία ${last ? last.metadata.period_key : "—"})`); return 0; }
  const fromMs = days[0].s, toMs = days[days.length - 1].e;
  const tmaxH = await hourlyAgg(device, "air_temperature", "max", fromMs, toMs);
  const rhminH = await hourlyAgg(device, "air_humidity", "min", fromMs, toMs);
  const rainRecs = await device.getData({ variables: ["rain_height_daily"], start_date: new Date(fromMs).toISOString(),
    end_date: new Date(toMs + 3 * 86400000).toISOString(), qty: 5000, ordination: "ascending" });
  const rain = bestDailyRain(rainRecs);
  const out = [];
  for (const d of days) {
    const r = rain.get(d.s);
    if (!r && nowMs - d.e < RAIN_WAIT_DAYS * 86400000) break;          // ο υπολογισμός βροχής δεν έγραψε ακόμη την ημέρα
    let tmax = -Infinity, vpd = -Infinity, hours = 0;
    for (let h = d.s; h < d.e; h += 3600000) {
      const t = tmaxH.get(h), rh = rhminH.get(h);
      if (Number.isFinite(t)) { hours++; if (t > tmax) tmax = t; }
      if (Number.isFinite(t) && Number.isFinite(rh)) { const v = es(t) * (1 - Math.max(0, Math.min(100, rh)) / 100); if (v > vpd) vpd = v; }
    }
    const tKnown = Number.isFinite(tmax), vKnown = Number.isFinite(vpd);
    const qPrev = state.q;
    const step = kbdiStep(state, r ? r.mm : null, tKnown ? tmax : NaN, annualRain);
    state = { q: step.q, cum: step.cum };
    const time = new Date(d.e - 10000).toISOString();
    const meta = { alg: KBDI_ALG, version: KBDI_VERSION, period_key: d.key, period_start_utc: new Date(d.s).toISOString(),
      period_end_utc: new Date(d.e).toISOString(), q_prev: r3(qPrev), tmax: tKnown ? r3(tmax) : null, temp_hours: hours,
      rain_mm: r ? r3(r.mm) : null, rain_partial: r ? r.cov < FULL_COV : null, net_rain_mm: r3(step.net), cum_rain_mm: r3(step.cum),
      drought_factor: r3(step.df), annual_rain_mm: annualRain, calc_at: new Date(nowMs).toISOString() };
    out.push({ variable: "kbdi1", unit: "mm", value: r3(step.q), time, metadata: meta });
    out.push({ variable: "soil_moisture_condition1", value: soilCondition(step.q), time, metadata: { alg: KBDI_ALG, period_key: d.key } });
    if (vKnown) {
      out.push({ variable: "vpd1", unit: "kPa", value: r3(vpd), time, metadata: { alg: KBDI_ALG, period_key: d.key, definition: "max hourly es(Tmax_h)*(1-RHmin_h/100)", temp_hours: hours } });
      out.push({ variable: "stress_level1", value: stressLevel(vpd), time, metadata: { alg: KBDI_ALG, period_key: d.key } });
    }
  }
  for (let i = 0; i < out.length; i += 400) await device.sendData(out.slice(i, i + 400));
  const lastOut = out.filter((x) => x.variable === "kbdi1").pop();
  log(`${info.name}: +${out.filter((x) => x.variable === "kbdi1").length} ημέρες (${days[0].key} → ${lastOut ? lastOut.metadata.period_key : "—"}) · KBDI ${lastOut ? lastOut.value : "—"} mm · R=${annualRain}`);
  return out.length;
}

async function startAnalysis(context) {
  const env = (context.environment || []).find((e) => e.key === "ACCOUNT_TOKEN");
  if (!env) return context.log("KBDI: λείπει ACCOUNT_TOKEN");
  const account = new Account({ token: env.value });
  const devices = await Resources.devices.list({ page: 1, fields: ["id", "name", "tags"], amount: 100,
    filter: { tags: [{ key: "topalidouType", value: "weatherStation" }] } });
  if (!devices.length) return context.log("KBDI: κανένας σταθμός");
  const nowMs = Date.now();
  let total = 0;
  for (const info of devices) {
    try {
      const device = new Device({ token: await Utils.getTokenByName(account, info.id) });
      total += await processStation(device, info, nowMs, (m) => context.log(m));
    } catch (e) { context.log(`KBDI: ${info.name || info.id} σφάλμα ${e && e.message ? e.message : e}`); }
  }
  context.log(`KBDI ${KBDI_VERSION}: ${devices.length} σταθμοί · ${total} εγγραφές`);
}

if (typeof module !== "undefined" && module.exports) module.exports = { dayContaining, nextDay, droughtFactor, kbdiStep, es, soilCondition, stressLevel, bestDailyRain, processStation, KBDI_VERSION };
Analysis.use(startAnalysis);
