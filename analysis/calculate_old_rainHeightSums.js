/**
 * TagoIO Analysis — Rain Height Aggregation · v34 · ΕΝΙΑΙΟΣ ΥΠΟΛΟΓΙΣΜΟΣ ΒΡΟΧΗΣ (T-RAIN-UNIFIED-01, 4/10/2026)
 *
 * Τι άλλαξε από τη v33 (Patsianotakis, 2/4/2026) — απόφαση Μιχάλη 4/10 «ενιαίος υπολογισμός βροχής»:
 *  1. ΙΔΙΟΣ ΚΩΔΙΚΑΣ ΜΕ ΤΟΝ ΠΥΡΗΝΑ. Το τμήμα «ΑΝΤΙΓΡΑΦΟ ΠΥΡΗΝΑ» είναι αυτούσιο από το runPerTich.js
 *     (T-RAIN-ACC-01)· ο ελεγκτής analysis/test/rain_unified_check.mjs αποτυγχάνει αν διαφέρει κατά ένα byte.
 *     Μετρητής `rain_height_acc` με ελέγχους σιωπής, κενού, μηδενισμού (άθροισμα θετικών βημάτων) και 450 mm/ω.
 *  2. ΑΓΝΩΣΤΟ ≠ 0. Σιωπηλός σταθμός ή άκυρος μετρητής δεν γράφει «0 mm». Μερική κάλυψη γράφεται με
 *     metadata.partial = true και coverage (0–1)· το widget δείχνει «≥».
 *  3. ΕΚΤΙΜΗΣΗ. Οι σταθμοί χωρίς μετρητή (firmware 1.13) δίνουν άθροισμα ρυθμού (`rain_height`)·
 *     γράφεται με metadata.status = 'estimate' και το widget δείχνει «≈».
 *  4. ΩΡΑ ΕΛΛΑΔΑΣ. Ημέρα / εβδομάδα ISO / μήνας / έτος σε Europe/Athens από τη Δευτέρα 5/10/2026 00:00
 *     (CUTOVER). Η περίοδος που περιέχει την αλλαγή ξεκινά στο όριο UTC της v33, ώστε τα αθροίσματα να
 *     καλύπτουν τον χρόνο ακριβώς μία φορά (π.χ. «γέφυρα» 4/10 00:00Z–21:00Z).
 *  5. ΙΕΡΑΡΧΙΑ. Ώρα και ημέρα από τα ωμά δεδομένα· εβδομάδα και μήνας από τις ημερήσιες εγγραφές· έτος από
 *     τις μηνιαίες. Οι εγγραφές αναγνωρίζονται από metadata.period_start_utc (ίδιο πεδίο με τη v33).
 *  6. ΦΕΤΟΣ. Το `current_rain_height_yearly` ξαναγράφεται (ήταν σχολιασμένο)· αν λείπουν μήνες, partial.
 *  7. ΚΑΘΥΣΤΕΡΗΜΕΝΑ ΔΕΔΟΜΕΝΑ. Περίοδος με κάλυψη < 99,5 % ξαναϋπολογίζεται για 15 ημέρες (24 ω για τις ώρες)
 *     και γράφεται νέα εγγραφή μόνο αν η κάλυψη βελτιώθηκε· το widget κρατά την καλύτερη ανά περίοδο.
 *  8. ΧΡΟΝΟΣ ΕΓΓΡΑΦΗΣ. Οι κλειστές περίοδοι γράφονται στο ΜΕΣΟ της περιόδου (η ημέρα έχει τη σωστή ημερομηνία).
 *  9. Τα τρέχοντα σύνολα ξαναγράφονται όταν αλλάξουν ή κάθε 150΄ (παλμός ζωής): το widget δείχνει «—»
 *     όταν η τελευταία εγγραφή είναι παλαιότερη από 4 ω (σιωπηλός σταθμός).
 *
 * Το παλαιότερο ιστορικό (εγγραφές v33) ΔΕΝ σβήνεται ούτε ξαναγράφεται.
 * ΔΕΝ αγγίζει άρδευση, ηλεκτροβάνες, ελεγκτές. Γράφει μόνο τις μεταβλητές βροχής των σταθμών S2120.
 *
 * ΜΕΤΑΒΛΗΤΕΣ (ίδια ονόματα με τη v33): rain_height_hourly / _daily / _weekly / _monthly / _yearly ·
 * current_rain_height_daily / _weekly / _monthly / _yearly. ENV: ACCOUNT_TOKEN (υποχρεωτικό)· RAIN_TZ,
 * RAIN_CUTOVER (προαιρετικά).
 */

const { Analysis, Resources, Account, Device } = require("@tago-io/sdk");
const moment = require("moment-timezone");

const RAIN_ALG = "v34";
const RAIN_VERSION = "v34.1 · 2026-10-04";
const DEFAULT_TZ = "Europe/Athens";
const DEFAULT_CUTOVER = "2026-10-04T21:00:00.000Z";   // Δευτέρα 5/10/2026 00:00 ώρα Ελλάδας
const HOURS_BACK = 24;          // κλειστές ώρες προς έλεγχο
const DAYS_BACK = 15;           // κλειστές ημέρες προς έλεγχο (καθυστερημένα δεδομένα)
const WEEKS_BACK = 2, MONTHS_BACK = 2, YEARS_BACK = 1;
const FULL_COV = 0.995;         // ≥ αυτό = πλήρης κάλυψη
const MIN_COV = 0.02;           // < αυτό = άγνωστο (δεν γράφεται)
const HEARTBEAT_MIN = 150;      // τρέχοντα σύνολα: ξαναγράφονται τουλάχιστον τόσο συχνά
const PTD_EPS = 0.0005;

// ═══ ΑΝΤΙΓΡΑΦΟ ΠΥΡΗΝΑ (runPerTich.js · T-RAIN-ACC-01) — ΜΗΝ ΤΟ ΑΛΛΑΞΕΙΣ ΕΔΩ ═══
const _SAG_RAIN_MAX_MMH = 450;          // όριο οργάνου S2120 (datasheet 0–450 mm/h): έλεγχος ευλογοφάνειας
const _SAG_RAIN_ACC_FRESH_MIN = 180;    // τελευταία τιμή παλαιότερη → σιωπηλός σταθμός, όχι «μηδέν βροχή»
async function _sagAccPointAtOrBefore(device, iso) {
  const r = await device.getData({ variables: ['rain_height_acc'], end_date: iso, qty: 1, ordination: 'descending' });
  const e = Array.isArray(r) && r.length ? r[0] : null;
  if (!e) return null;
  const v = Number(e.value), t = Date.parse(e.time);
  return (Number.isFinite(v) && Number.isFinite(t)) ? { v, t } : null;
}
async function _sagRainFromCounter(device, startISO, endISO, endPt, maxLeadMin) {
  try {
    const endMs = Date.parse(endISO), startMs = Date.parse(startISO);
    const e = (endPt !== undefined) ? endPt : await _sagAccPointAtOrBefore(device, endISO);
    if (!e) return { ok: false, why: 'χωρίς μετρητή', end: null };
    if ((endMs - e.t) / 60000 > _SAG_RAIN_ACC_FRESH_MIN) return { ok: false, why: 'σιωπηλός σταθμός', end: e };
    const st = await _sagAccPointAtOrBefore(device, startISO);
    if (!st) return { ok: false, why: 'καμία τιμή πριν το παράθυρο', end: e };
    if ((startMs - st.t) / 60000 > maxLeadMin) return { ok: false, why: 'κενό πριν το παράθυρο', end: e };
    let mm = e.v - st.v, resets = 0, dropped = 0;
    if (mm < -0.001) {
      // Μηδενισμός μέσα στο παράθυρο: άθροισμα θετικών βημάτων· μετά τον μηδενισμό μετρά η νέα τιμή.
      const ser = await device.getData({ variables: ['rain_height_acc'], start_date: new Date(st.t).toISOString(),
        end_date: endISO, qty: 2000, ordination: 'ascending' });
      const P = (Array.isArray(ser) ? ser : []).map(x => ({ v: Number(x.value), t: Date.parse(x.time) }))
        .filter(x => Number.isFinite(x.v) && Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
      mm = 0;
      for (let i = 1; i < P.length; i++) {
        const dh = Math.max((P[i].t - P[i - 1].t) / 3600000, 1 / 60);
        let d = P[i].v - P[i - 1].v;
        if (d < -0.001) { resets++; d = P[i].v; }
        if (d > _SAG_RAIN_MAX_MMH * dh + 0.254) { dropped++; continue; }   // αδύνατο βήμα: απορρίπτεται
        if (d > 0) mm += d;
      }
      if (resets === 0) return { ok: false, why: 'αρνητική διαφορά χωρίς μηδενισμό', end: e };
    }
    const spanH = Math.max((e.t - st.t) / 3600000, 1 / 60);
    if (!(mm >= 0) || mm > _SAG_RAIN_MAX_MMH * spanH + 0.254) return { ok: false, why: 'αδύνατη τιμή μετρητή', end: e };
    return { ok: true, mm: Math.round(mm * 1000) / 1000, resets, dropped, end: e };
  } catch (x) { return { ok: false, why: 'ανάγνωση απέτυχε', end: null }; }
}
// ═══ ΤΕΛΟΣ ΑΝΤΙΓΡΑΦΟΥ ΠΥΡΗΝΑ ═══

// ---------- Βοηθητικά ----------
const iso = (ms) => new Date(ms).toISOString();
const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function getOptionalEnv(context, key, def) {
  const found = (context.environment || []).find((e) => e.key === key);
  if (!found || found.value === undefined || found.value === null || found.value === "") return def;
  return found.value;
}
async function firstPointIn(device, variable, startISO, endISO) {
  const r = await device.getData({ variables: [variable], start_date: startISO, end_date: endISO, qty: 1, ordination: 'ascending' });
  const e = Array.isArray(r) && r.length ? r[0] : null;
  if (!e) return null;
  const v = Number(e.value), t = Date.parse(e.time);
  return (Number.isFinite(v) && Number.isFinite(t)) ? { v, t } : null;
}
async function lastPointAtOrBefore(device, variable, endISO) {
  const r = await device.getData({ variables: [variable], end_date: endISO, qty: 1, ordination: 'descending' });
  const e = Array.isArray(r) && r.length ? r[0] : null;
  if (!e) return null;
  const v = Number(e.value), t = Date.parse(e.time);
  return (Number.isFinite(v) && Number.isFinite(t)) ? { v, t } : null;
}
function scalarOf(res) {   // το SDK τυλίγει αριθμητικό αποτέλεσμα σε [{value}]· δεχόμαστε και σκέτο αριθμό
  if (Array.isArray(res)) return res.length ? Number(res[0] && res[0].value) : NaN;
  if (res && typeof res === "object") return Number(res.value);
  return Number(res);
}

// ---------- Βροχή παραθύρου από τον ΜΕΤΡΗΤΗ (ίδιοι έλεγχοι με τον πυρήνα + μερική κάλυψη) ----------
// Επιστρέφει { known, mm, coverage, status:'measured', partial, why }.
async function rainCounterWindow(device, startISO, endISO, leadMin) {
  const S = Date.parse(startISO), E = Date.parse(endISO), span = Math.max(E - S, 1);
  const full = await _sagRainFromCounter(device, startISO, endISO, undefined, leadMin);
  if (full.ok) return { known: true, mm: full.mm, coverage: 1, status: 'measured', partial: false, resets: full.resets };
  const partialable = ['σιωπηλός σταθμός', 'καμία τιμή πριν το παράθυρο', 'κενό πριν το παράθυρο'];
  if (partialable.indexOf(full.why) < 0) return { known: false, why: full.why };
  const e = full.end;                                       // τελευταίο σημείο ≤ τέλος
  if (!e || e.t <= S) return { known: false, why: full.why + ' · κανένα σημείο στο παράθυρο' };
  let a = await _sagAccPointAtOrBefore(device, startISO);   // άγκυρα αρχής: σημείο ≤ αρχή μέσα στο κενό που επιτρέπεται…
  if (!a || (S - a.t) / 60000 > leadMin) a = await firstPointIn(device, 'rain_height_acc', startISO, endISO);   // …αλλιώς το πρώτο μέσα
  if (!a || a.t >= e.t) return { known: false, why: full.why + ' · ένα μόνο σημείο' };
  // +1 ms και ανοχή 1΄: το «≤ χρόνος» βρίσκει ακριβώς την άγκυρα είτε το end_date είναι κλειστό (REST) είτε ανοιχτό (SDK v11)
  const sub = await _sagRainFromCounter(device, iso(a.t + 1), iso(e.t + 1), e, 1);
  if (!sub.ok) return { known: false, why: full.why + ' · ' + sub.why };
  const coverage = clamp01((Math.min(e.t, E) - Math.max(a.t, S)) / span);
  if (coverage < MIN_COV) return { known: false, why: full.why + ' · ελάχιστη κάλυψη' };
  return { known: true, mm: sub.mm, coverage, status: 'measured', partial: coverage < FULL_COV, why: full.why };
}

// ---------- Βροχή παραθύρου από ΡΥΘΜΟ (firmware 1.13, χωρίς μετρητή) — ΕΚΤΙΜΗΣΗ ----------
async function rainRateWindow(device, startISO, endISO) {
  const S = Date.parse(startISO), E = Date.parse(endISO), span = Math.max(E - S, 1);
  const last = await lastPointAtOrBefore(device, 'rain_height', endISO);
  if (!last || last.t <= S) return { known: false, why: 'σιωπηλός σταθμός (ρυθμός)' };
  const first = await firstPointIn(device, 'rain_height', startISO, endISO);
  if (!first) return { known: false, why: 'κανένα σημείο ρυθμού στο παράθυρο' };
  const sum = scalarOf(await device.getData({ variables: ['rain_height'], query: 'sum', start_date: startISO, end_date: endISO }));
  if (!Number.isFinite(sum) || sum < 0) return { known: false, why: 'άκυρο άθροισμα ρυθμού' };
  const spanH = span / 3600000;
  if (sum > _SAG_RAIN_MAX_MMH * spanH + 0.254) return { known: false, why: 'αδύνατο άθροισμα ρυθμού' };
  // κάλυψη από τα άκρα (σιωπή στην αρχή/στο τέλος)· ένα δείγμα ρυθμού αντιστοιχεί σε ≤ 15΄ πριν από αυτό
  const lo = Math.max(S, first.t - 15 * 60000), hi = (E - last.t) / 60000 <= _SAG_RAIN_ACC_FRESH_MIN ? E : last.t;
  const coverage = clamp01((hi - lo) / span);
  if (coverage < MIN_COV) return { known: false, why: 'ελάχιστη κάλυψη (ρυθμός)' };
  return { known: true, mm: r3(sum), coverage, status: 'estimate', partial: coverage < FULL_COV };
}

// ---------- Περίοδοι (ώρα Ελλάδας, με γέφυρα προς τα όρια UTC της v33) ----------
const UNITS = { hour: 'hour', day: 'day', week: 'isoWeek', month: 'month', year: 'year' };
function periodContaining(unit, ms, TZ, cutMs) {
  const u = UNITS[unit];
  const z = (unit === 'hour') ? moment.utc(ms) : moment.tz(ms, TZ);
  const st = z.clone().startOf(u);
  const en = st.clone().add(1, unit === 'week' ? 'week' : u);
  const st0 = st.valueOf();
  let s = st0, e = en.valueOf();
  // Περίοδος που ξεκινά πριν την αλλαγή: αρχή = ίδια ημερολογιακή αρχή σε UTC (όπως η v33)· αν τελειώνει κι αυτή
  // πριν την αλλαγή, και το τέλος σε UTC (= περίοδος της v33). Η περίοδος που περιέχει την αλλαγή = «γέφυρα».
  if (unit !== 'hour' && st0 < cutMs) {
    s = moment.utc(st.format('YYYY-MM-DDTHH:mm:ss')).valueOf();
    if (e < cutMs) e = moment.utc(en.format('YYYY-MM-DDTHH:mm:ss')).valueOf();
  }
  const key = (unit === 'hour') ? moment.utc(st).format('YYYY-MM-DDTHH')
    : unit === 'week' ? st.format('GGGG-[W]WW') : unit === 'day' ? st.format('YYYY-MM-DD')
    : unit === 'month' ? st.format('YYYY-MM') : st.format('YYYY');
  return { unit, s, e, st0, key };
}
function previousPeriod(p, TZ, cutMs) { return periodContaining(p.unit, p.st0 - 1, TZ, cutMs); }

// ---------- Ερμηνεία υπάρχουσας εγγραφής (v34 ή παλιά v33) ----------
// Επιστρέφει { s, e, mm, cov, est, alg } ή null.
function readRecord(rec, ctx) {
  const m = rec && rec.metadata || {};
  const s = Date.parse(m.period_start_utc), eRaw = Date.parse(m.period_end_utc);
  if (!Number.isFinite(s) || !Number.isFinite(eRaw)) return null;
  const e = (eRaw % 1000 === 999) ? eRaw + 1 : eRaw;     // v33: τέλος …:59.999
  const v = Number(rec.value);
  if (m.alg === RAIN_ALG) {
    const cov = Number.isFinite(Number(m.coverage)) ? clamp01(Number(m.coverage)) : 1;
    return { s, e, mm: Number.isFinite(v) ? v : 0, cov, est: m.status === 'estimate', alg: RAIN_ALG };
  }
  // v33: η «0» ενός σταθμού που σιωπούσε στο τέλος της περιόδου δεν είναι μέτρηση (Β-2) — κάλυψη ως την τελευταία τιμή
  if (!Number.isFinite(v)) return { s, e, mm: 0, cov: 0, est: false, alg: 'v33' };
  const silentCov = (ctx.lastMs != null && ctx.lastMs < e - _SAG_RAIN_ACC_FRESH_MIN * 60000) ? clamp01((ctx.lastMs - s) / (e - s)) : 1;
  if (m.source_variable === 'rain_height_acc') return { s, e, mm: silentCov > 0 ? v : 0, cov: silentCov, est: false, alg: 'v33' };
  if (m.source_variable === 'rain_height') {
    // σταθμός χωρίς μετρητή: εκτίμηση από ρυθμό (με τον ίδιο έλεγχο σιωπής)
    if (ctx.accFirstMs == null) return { s, e, mm: silentCov > 0 ? v : 0, cov: silentCov, est: true, alg: 'v33' };
    // σταθμός με μετρητή: πριν τον μετρητή = εκτίμηση ρυθμού· μετά = η εφεδρεία της v33 (άθροισμα που δεν υπήρχε) → άγνωστο
    if (e <= ctx.accFirstMs + 86400000) return { s, e, mm: v, cov: 1, est: true, alg: 'v33' };
    return { s, e, mm: 0, cov: 0, est: false, alg: 'v33' };
  }
  return { s, e, mm: 0, cov: 0, est: false, alg: 'v33' };
}
// Καλύτερη εγγραφή ανά αρχή περιόδου (v34 > v33, μεγαλύτερη κάλυψη).
function indexRecords(recs, ctx) {
  const idx = new Map();
  for (const rec of (recs || [])) {
    const r = readRecord(rec, ctx);
    if (!r) continue;
    const prev = idx.get(r.s);
    const rank = (x) => (x.alg === RAIN_ALG ? 2 : 1) + x.cov;
    if (!prev || rank(r) > rank(prev)) idx.set(r.s, r);
  }
  return idx;
}
// Άθροισμα εγγραφών μέσα στο [a, b) (χωρίς επικαλύψεις).
function sumIndex(idx, a, b) {
  let mm = 0, covered = 0, est = false;
  const list = [...idx.values()].filter(r => r.s >= a && r.e <= b + 1000).sort((x, y) => x.s - y.s);
  let cursor = a;
  for (const r of list) {
    if (r.s < cursor - 1000) continue;                     // επικάλυψη: η πρώτη κερδίζει
    if (r.cov > 0) { mm += r.mm; covered += (r.e - r.s) * r.cov; if (r.est) est = true; }
    cursor = r.e;
  }
  return { mm: r3(mm), covered, est };
}

// ---------- Εγγραφή ----------
function payload(variable, p, res, extra) {
  const mid = Math.floor((p.s + p.e) / 2);
  return {
    variable, unit: "mm", value: r3(res.mm), time: iso(mid),
    metadata: Object.assign({
      aggregation: "sum", alg: RAIN_ALG, version: RAIN_VERSION, mode: "closed_period", period: p.unit, period_key: p.key,
      period_start_utc: iso(p.s), period_end_utc: iso(p.e),
      status: res.status, partial: !!res.partial, coverage: Math.round(res.coverage * 1000) / 1000,
      method: res.method, calc_at: new Date().toISOString(),
    }, extra || {}),
  };
}
async function fetchRecords(device, variable, fromMs, toMs) {
  const r = await device.getData({ variables: [variable], start_date: iso(fromMs), end_date: iso(toMs), qty: 2000, ordination: 'ascending' });
  return Array.isArray(r) ? r : [];
}

// ---------- Υπολογισμός ανά σταθμό ----------
async function computeForDevice(device, name, cfg) {
  const { TZ, cutMs } = cfg;
  const now = Date.now();
  const log = [];
  const accLast = await lastPointAtOrBefore(device, 'rain_height_acc', iso(now));
  const accFirst = accLast ? await firstPointIn(device, 'rain_height_acc', '2015-01-01T00:00:00.000Z', iso(now)) : null;
  const counter = !!accLast;
  const method = counter ? 'counter' : 'rate_sum';
  const rateLast = counter ? null : await lastPointAtOrBefore(device, 'rain_height', iso(now));
  const lastMs = counter ? accLast.t : (rateLast ? rateLast.t : null);
  const ctx = { lastMs, accFirstMs: accFirst ? accFirst.t : null };
  const windowRain = async (sMs, eMs, leadMin) => {
    if (lastMs == null || lastMs <= sMs) return { known: false, why: 'σιωπηλός σταθμός' };   // χωρίς ανάγνωση
    const res = counter ? await rainCounterWindow(device, iso(sMs), iso(eMs), leadMin) : await rainRateWindow(device, iso(sMs), iso(eMs));
    if (res.known) res.method = method;
    return res;
  };
  const out = [];

  // 1) ΩΡΕΣ (κλειστές) — από τα ωμά δεδομένα, κενό πριν την ώρα ≤ 30΄ (όπως ο πυρήνας)
  const hNow = periodContaining('hour', now, TZ, cutMs);
  const hRecs = indexRecords(await fetchRecords(device, 'rain_height_hourly', hNow.s - (HOURS_BACK + 2) * 3600000, now + 3600000), ctx);
  let hWritten = 0;
  for (let i = 1, p = previousPeriod(hNow, TZ, cutMs); i <= HOURS_BACK; i++, p = previousPeriod(p, TZ, cutMs)) {
    const have = hRecs.get(p.s);
    if (have && have.cov >= FULL_COV) continue;
    const res = await windowRain(p.s, p.e, 30);
    if (!res.known || (have && res.coverage <= have.cov + 0.01)) continue;
    out.push(payload('rain_height_hourly', p, res)); hRecs.set(p.s, { s: p.s, e: p.e, mm: res.mm, cov: res.coverage, est: res.status === 'estimate', alg: RAIN_ALG });
    hWritten++;
  }
  if (hWritten) log.push('ώρες +' + hWritten);

  // 2) ΗΜΕΡΕΣ (κλειστές, μετά την αλλαγή) — από τα ωμά δεδομένα, κενό πριν ≤ 180΄ (όπως ο πυρήνας)
  const dNow = periodContaining('day', now, TZ, cutMs), wNow = periodContaining('week', now, TZ, cutMs);
  const mNow = periodContaining('month', now, TZ, cutMs), yNow = periodContaining('year', now, TZ, cutMs);
  let dFrom = Math.min(mNow.s, wNow.s, dNow.s - (DAYS_BACK + 1) * 86400000);
  let pw = wNow, pm = mNow;
  for (let i = 0; i < WEEKS_BACK; i++) pw = previousPeriod(pw, TZ, cutMs);
  for (let i = 0; i < MONTHS_BACK; i++) pm = previousPeriod(pm, TZ, cutMs);
  if (pw.e >= cutMs) dFrom = Math.min(dFrom, pw.s);
  if (pm.e >= cutMs) dFrom = Math.min(dFrom, pm.s);
  const dRecs = indexRecords(await fetchRecords(device, 'rain_height_daily', dFrom - 2 * 86400000, now + 2 * 86400000), ctx);
  for (let i = 1, p = previousPeriod(dNow, TZ, cutMs); i <= DAYS_BACK; i++, p = previousPeriod(p, TZ, cutMs)) {
    if (p.e < cutMs) break;                                  // εποχή v33: δεν ξαναγράφεται (η γέφυρα γράφεται)
    const have = dRecs.get(p.s);
    if (have && have.cov >= FULL_COV) continue;
    const res = await windowRain(p.s, p.e, 180);
    if (!res.known || (have && res.coverage <= have.cov + 0.01)) continue;
    out.push(payload('rain_height_daily', p, res));
    dRecs.set(p.s, { s: p.s, e: p.e, mm: res.mm, cov: res.coverage, est: res.status === 'estimate', alg: RAIN_ALG });
    log.push('ημέρα ' + p.key + ' ' + r3(res.mm) + (res.partial ? ' (≥, ' + Math.round(res.coverage * 100) + '%)' : ''));
  }

  // 3) ΕΒΔΟΜΑΔΕΣ / ΜΗΝΕΣ (κλειστές) — από τις ημερήσιες εγγραφές
  const fromDays = (p) => {
    const sm = sumIndex(dRecs, p.s, p.e);
    const coverage = clamp01(sm.covered / (p.e - p.s));
    return { known: coverage >= MIN_COV, mm: sm.mm, coverage, partial: coverage < FULL_COV, status: sm.est ? 'estimate' : 'measured', method: 'sum_of_days' };
  };
  for (const [unit, variable, back, cur] of [['week', 'rain_height_weekly', WEEKS_BACK, wNow], ['month', 'rain_height_monthly', MONTHS_BACK, mNow]]) {
    let p = cur, have = null;
    const recs = indexRecords(await fetchRecords(device, variable, cur.s - (back + 1) * 32 * 86400000, now + 2 * 86400000), ctx);
    for (let i = 1; i <= back; i++) {
      p = previousPeriod(p, TZ, cutMs);
      if (p.e < cutMs) break;
      have = recs.get(p.s);
      if (have && have.cov >= FULL_COV) continue;
      const res = fromDays(p);
      if (!res.known || (have && res.coverage <= have.cov + 0.01)) continue;
      out.push(payload(variable, p, res));
      recs.set(p.s, { s: p.s, e: p.e, mm: res.mm, cov: res.coverage, est: res.status === 'estimate', alg: RAIN_ALG });
      log.push(unit + ' ' + p.key + ' ' + res.mm + (res.partial ? ' (≥)' : ''));
    }
    if (unit === 'month') cfg._mRecs = recs;
  }

  // 4) ΕΤΟΣ (κλειστό) — από τις μηνιαίες εγγραφές
  const mRecs = indexRecords(await fetchRecords(device, 'rain_height_monthly', yNow.s - 400 * 86400000, now + 2 * 86400000), ctx);
  for (const [k, v] of (cfg._mRecs || new Map())) if (!mRecs.has(k) || v.alg === RAIN_ALG) mRecs.set(k, v);
  const fromMonths = (p, extraMs, extra) => {
    const sm = sumIndex(mRecs, p.s, extraMs != null ? extraMs : p.e);
    let mm = sm.mm, covered = sm.covered, est = sm.est;
    if (extra && extra.known) { mm = r3(mm + extra.mm); covered += extra.covered; if (extra.status === 'estimate') est = true; }
    const spanMs = (extraMs != null && extra ? extra.endMs : p.e) - p.s;
    const coverage = clamp01(covered / spanMs);
    const firstKnown = [...mRecs.values()].filter(r => r.s >= p.s && r.cov > 0).sort((a, b) => a.s - b.s)[0];
    return { known: coverage >= MIN_COV, mm, coverage, partial: coverage < FULL_COV, status: est ? 'estimate' : 'measured', method: 'sum_of_months',
      since: firstKnown ? moment.tz(firstKnown.s + 86400000, TZ).format('YYYY-MM') : null };
  };
  for (let i = 1, p = previousPeriod(yNow, TZ, cutMs); i <= YEARS_BACK; i++, p = previousPeriod(p, TZ, cutMs)) {
    if (p.e < cutMs) break;
    const yr = indexRecords(await fetchRecords(device, 'rain_height_yearly', p.s - 2 * 86400000, p.e + 40 * 86400000), ctx).get(p.s);
    if (yr && yr.cov >= FULL_COV) continue;
    const res = fromMonths(p);
    if (!res.known || (yr && res.coverage <= yr.cov + 0.01)) continue;
    out.push(payload('rain_height_yearly', p, res, { since: res.since }));
  }

  // 5) ΤΡΕΧΟΝΤΑ ΣΥΝΟΛΑ (ημέρα, εβδομάδα, μήνας, έτος ως τώρα)
  const day = await windowRain(dNow.s, now, 180);
  const dayPart = day.known ? { known: true, mm: day.mm, covered: day.coverage * (now - dNow.s), status: day.status } : { known: false, covered: 0 };
  const ptdOf = (p) => {   // κλειστές ημέρες της περιόδου + σήμερα
    const sm = sumIndex(dRecs, p.s, dNow.s);
    let mm = sm.mm, covered = sm.covered, est = sm.est;
    if (dayPart.known) { mm = r3(mm + dayPart.mm); covered += dayPart.covered; if (dayPart.status === 'estimate') est = true; }
    const coverage = clamp01(covered / Math.max(now - p.s, 1));
    return { known: coverage >= MIN_COV, mm, coverage, partial: coverage < FULL_COV, status: est ? 'estimate' : 'measured', method: 'sum_of_days' };
  };
  const ptd = [];
  if (day.known) ptd.push(['current_rain_height_daily', dNow, Object.assign({}, day, { partial: day.coverage < FULL_COV })]);
  else log.push('σήμερα άγνωστο (' + day.why + ')');
  ptd.push(['current_rain_height_weekly', wNow, ptdOf(wNow)]);
  const mPtd = ptdOf(mNow);
  ptd.push(['current_rain_height_monthly', mNow, mPtd]);
  const yPtd = fromMonths(yNow, mNow.s, mPtd.known ? { known: true, mm: mPtd.mm, covered: mPtd.coverage * (now - mNow.s), status: mPtd.status, endMs: now } : { known: false, covered: 0, endMs: now });
  ptd.push(['current_rain_height_yearly', yNow, yPtd]);
  for (const [variable, p, res] of ptd) {
    if (!res.known) continue;
    const group = 'current_' + p.unit + '_' + p.key;
    const last = (await device.getData({ variables: [variable], qty: 1, ordination: 'descending' }) || [])[0];
    const lm = last && last.metadata || {};
    const same = last && String(last.group || '') === group && Math.abs(Number(last.value) - r3(res.mm)) <= PTD_EPS
      && lm.alg === RAIN_ALG && lm.status === res.status && !!lm.partial === !!res.partial
      && (now - Date.parse(last.time)) / 60000 < HEARTBEAT_MIN;
    if (same) continue;
    const pl = payload(variable, { unit: p.unit, s: p.s, e: now, key: p.key }, res, { mode: 'period_to_date', since: res.since || undefined });
    pl.time = iso(now); pl.group = group;
    out.push(pl);
  }

  if (out.length) await device.sendData(out);
  console.log(`[${name}] ${counter ? 'μετρητής' : 'ρυθμός (εκτίμηση)'} · εγγραφές ${out.length}` + (log.length ? ' · ' + log.join(' · ') : '')
    + ` · σήμερα ${day.known ? r3(day.mm) + ' mm' + (day.partial ? ' ≥' : '') : '—'} · φέτος ${yPtd.known ? yPtd.mm + ' mm' + (yPtd.partial ? ' ≥ από ' + yPtd.since : '') : '—'}`);
}

// ---------- Συσκευές / tokens (όπως η v33) ----------
async function getOrCreateDeviceTokenById(account, device_id) {
  let tokens = [];
  try {
    tokens = await account.devices.tokenList(device_id, { page: 1, fields: ["token", "expire_time", "permission", "name"], amount: 20 });
  } catch (_) {}
  const now = Date.now();
  const valid = Array.isArray(tokens) ? tokens.find((t) => t?.token && (!t.expire_time || new Date(t.expire_time).getTime() > now)) : null;
  if (valid?.token) return valid.token;
  const created = await account.devices.tokenCreate(device_id, { name: "rain-agg", permission: "full", expire_time: null });
  return created.token;
}
async function listDevicesToProcess() {
  const devices = await Resources.devices.list({ page: 1, fields: ["id", "name", "tags"], filter: { tags: [{ key: "type", value: "s2120" }] }, amount: 200 });
  return devices || [];
}

async function startAnalysis(context) {
  try {
    const tok = (context.environment || []).find((env_var) => env_var.key === "ACCOUNT_TOKEN");
    if (!tok?.value) return console.log("Account token not found!");
    const account = new Account({ token: tok.value });
    const TZ = getOptionalEnv(context, "RAIN_TZ", DEFAULT_TZ);
    const cutMs = Date.parse(getOptionalEnv(context, "RAIN_CUTOVER", DEFAULT_CUTOVER));
    if (!moment.tz.zone(TZ) || !Number.isFinite(cutMs)) return console.log("Άκυρο RAIN_TZ / RAIN_CUTOVER");
    const list = await listDevicesToProcess();
    console.log(`Βροχή ${RAIN_VERSION} · ${TZ} από ${iso(cutMs)} · σταθμοί ${list.length}`);
    for (const d of list) {
      try {
        const device = new Device({ token: await getOrCreateDeviceTokenById(account, d.id) });
        await computeForDevice(device, d.name || d.id, { TZ, cutMs });
      } catch (err) {
        console.log(`[${d.name || d.id}] σφάλμα: ${err?.message || err}`);
      }
    }
    console.log("Aggregation completed.");
  } catch (error) {
    console.log(`Fatal error: ${error?.message || error}`);
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { computeForDevice, periodContaining, previousPeriod, readRecord, indexRecords, sumIndex, rainCounterWindow, rainRateWindow, RAIN_VERSION };
Analysis.use(startAnalysis);
