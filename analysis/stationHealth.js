/**
 * TagoIO Analysis — SAG stationHealth · T-HEALTH-02 φάση 1 (28/11/2026) · σχέδιο docs/ΣΧΕΔΙΟ_ΕΛΕΓΧΩΝ_ΣΥΜΠΕΡΙΦΟΡΑΣ_ΟΡΓΑΝΩΝ_2026-11-28.md
 *
 * Μία φορά την ημέρα (09:30 ώρα Ελλάδας: σταθμοί με άδειες μπαταρίες ξυπνούν με τον ήλιο, ~07:30 τον Δεκέμβριο) ελέγχει ΚΑΘΕ μετεωρολογικό
 * σταθμό S2120 (ετικέτα type = s2120) για συμπεριφορές που ΔΕΝ φαίνονται από μία τιμή, και γράφει στη συσκευή του σταθμού
 * μία εγγραφή `station_health` (value: ok / warning / fault, metadata.checks = τα ευρήματα σε απλά ελληνικά).
 * ΣΚΙΩΔΗΣ ΛΕΙΤΟΥΡΓΙΑ (metadata.shadow = true): την πρώτη εβδομάδα τίποτα δεν εμφανίζεται στον χρήστη· μετά η κάρτα υγείας.
 * Μόνο ερωτήματα aggregate (1 εγγραφή/ώρα) → ~180 εγγραφές ανά σταθμό την ημέρα. Δεν αγγίζει τον πυρήνα ούτε βάνες.
 *
 * ΕΛΕΓΧΟΙ (τελευταίες 24 πλήρεις ώρες, εκτός αν γράφεται αλλιώς):
 *   H1  νυχτερινή σιωπή: ≥ 3 ώρες χωρίς μετρήσεις, ≥ 70 % από αυτές τη νύχτα (18:00–07:59 ώρα Ελλάδας) → άδειες μπαταρίες AA
 *   H1b διακοπές: ≥ 3 ώρες χωρίς μετρήσεις χωρίς νυχτερινό μοτίβο
 *   H2  σιωπηλός σταθμός: τελευταία μέτρηση πριν από > 3 ώρες
 *   H3  πίεση: ωριαίος μέσος εκτός 850–1085 hPa, ή μεταβολή > 6 hPa από ώρα σε ώρα (ο καιρός σπάνια ξεπερνά 3 hPa/ώρα)
 *   H4  χαμένη μεταβλητή: θερμοκρασία σε ≥ 6 ώρες αλλά καμία τιμή πίεσης / κατεύθυνσης ανέμου / βροχής
 *   H6  βροχή που δεν υπολογίζεται: θερμοκρασία σε ≥ 12 ώρες αλλά καμία ωριαία εγγραφή βροχής
 *   H7  παράγωγος δείκτης αδύνατος: KBDI εκτός 0–203,2 mm· ωριαία βροχή > 450 mm
 *   H10 βροχόμετρο που δεν μετρά: < 0,5 mm στις 3 τελευταίες κλειστές ημέρες ενώ σταθμός σε < 15 km μέτρησε ≥ 10 mm
 */
// Runtime node-rt2025: χωρίς βιβλιοθήκες — REST API του TagoIO με fetch και το διακριτικό της ανάλυσης (T_ANALYSIS_TOKEN)·
// δικαιώματα από πολιτική Access Management (ανάγνωση σταθμών/αγρών, εγγραφή station_health μόνο στους σταθμούς).
const HEALTH_VERSION = "stationHealth v1 · 2026-11-28";
const SHADOW = true;
const TZ = "Europe/Athens";
const H = 3600000;
const P_MIN = 850, P_MAX = 1085, P_STEP = 6;
const RAIN_MAX_MMH = 450, KBDI_MAX = 203.2;
const NEIGH_KM = 15, NEIGH_MM = 10, SILENT_MM = 0.5;
const RAIN_VARS = ["rain_height", "rain_height_acc", "rain_gauge"];

// ---------- βοηθητικά ----------
const r1 = (x) => Math.round(x * 10) / 10;
const ATH = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour12: false, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const athParts = (ms) => Object.fromEntries(ATH.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
const athensHour = (ms) => Number(athParts(ms).hour) % 24;
const fmt = (ms) => { const p = athParts(ms); return `${p.day}/${p.month} ${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}`; };
function parseCoords(tags) {
  const t = (k) => { const x = (tags || []).find((y) => y.key === k); return x ? String(x.value) : ""; };
  const raw = t("coordinates");
  const m = raw.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  let a = Number(m[1]), b = Number(m[2]);
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) [a, b] = [b, a];
  if (!(Math.abs(a) <= 90 && Math.abs(b) <= 180) || (a === 0 && b === 0)) return null;
  return { lat: a, lon: b };
}
function km(p, q) {
  const R = 6371, d = Math.PI / 180;
  const x = Math.sin(((q.lat - p.lat) * d) / 2) ** 2 + Math.cos(p.lat * d) * Math.cos(q.lat * d) * Math.sin(((q.lon - p.lon) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
/** ώρες (ms αρχής) → τιμή, από aggregate ωριαίου μέσου */
async function hourly(read, variable, fromMs, toMs, fn = "avg") {
  const r = await read({ variables: [variable], query: "aggregate", interval: "hour", function: fn,
    start_date: new Date(fromMs).toISOString(), end_date: new Date(toMs - 1).toISOString() });
  const m = new Map();
  for (const x of Array.isArray(r) ? r : []) { const t = Date.parse(x.time), v = Number(x.value); if (Number.isFinite(t) && Number.isFinite(v)) m.set(Math.floor(t / H) * H, v); }
  return m;
}
function bestDaily(records) {   // ίδια προτίμηση με ταμπλό/εξαγωγή/KBDI
  const best = new Map();
  for (const x of records || []) {
    const md = x.metadata || {}; const s = Date.parse(md.period_start_utc); const v = Number(x.value);
    if (!Number.isFinite(s) || !Number.isFinite(v)) continue;
    const cov = md.alg === "v34" ? (Number.isFinite(Number(md.coverage)) ? Number(md.coverage) : 1) : 1;
    const rank = (md.alg === "v34" ? 2 : 1) + cov;
    const prev = best.get(s);
    if (!prev || rank > prev.rank) best.set(s, { mm: v, rank, s, e: Date.parse(md.period_end_utc) });
  }
  return [...best.values()].sort((a, b) => a.s - b.s);
}

// ---------- έλεγχοι ενός σταθμού (χωρίς H10) ----------
async function inspect(read, dev, nowMs) {
  const end = Math.floor(nowMs / H) * H, start = end - 24 * H;
  const temp = await hourly(read, "air_temperature", start, end);
  const pres = await hourly(read, "barometric_pressure_hpa", start, end);
  const wdir = await hourly(read, "wind_direction_sensor", start, end);
  const rainHours = new Set();
  for (const v of RAIN_VARS) for (const h of (await hourly(read, v, start, end)).keys()) rainHours.add(h);
  const lastT = (await read({ variables: ["air_temperature"], qty: 1 }) || [])[0];
  const lastMs = lastT ? Date.parse(lastT.time) : null;
  const rh = await read({ variables: ["rain_height_hourly"], start_date: new Date(start).toISOString(), end_date: new Date(end + H).toISOString(), qty: 100 });
  const dailyRecs = await read({ variables: ["rain_height_daily"], start_date: new Date(end - 6 * 86400000).toISOString(), end_date: new Date(nowMs).toISOString(), qty: 30 });
  const kb = dev.weatherStation ? (await read({ variables: ["kbdi1"], qty: 5 }) || []).find((x) => x.metadata && x.metadata.alg === "kbdi-v2") : null;

  const C = [];
  const tH = temp.size;
  // H2 σιωπηλός
  if (lastMs == null || nowMs - lastMs > 3 * H) {
    C.push({ id: "H2", sev: "fault", aud: "user", text_el: lastMs ? `Ο σταθμός δεν στέλνει μετρήσεις από ${fmt(lastMs)} (ώρα Ελλάδας). Ελέγξτε την τροφοδοσία (μπαταρίες AA, φωτοβολταϊκό).` : "Ο σταθμός δεν έχει στείλει ποτέ μετρήσεις.", ev: { last: lastT ? lastT.time : null } });
  }
  // H1 νυχτερινή σιωπή / διακοπές
  const missing = [];
  for (let h = start; h < end; h += H) if (!temp.has(h)) missing.push(h);
  if (tH >= 4 && missing.length >= 3) {
    const night = missing.filter((h) => { const x = athensHour(h); return x >= 18 || x < 8; }).length;
    if (night / missing.length >= 0.7) C.push({ id: "H1", sev: "warning", aud: "user", text_el: `Ο σταθμός σβήνει τη νύχτα (μετρήσεις σε ${tH} από 24 ώρες). Συνήθως σημαίνει άδειες μπαταρίες AA: το φωτοβολταϊκό τον τροφοδοτεί μόνο όσο έχει ήλιο. Αλλάξτε τις μπαταρίες και καθαρίστε το φωτοβολταϊκό.`, ev: { hours: tH, missing: missing.length, night } });
    else C.push({ id: "H1b", sev: "warning", aud: "user", text_el: `Λείπουν μετρήσεις για ${missing.length} από τις 24 τελευταίες ώρες.`, ev: { hours: tH, missing: missing.length } });
  }
  // H3 πίεση
  const pv = [...pres.entries()].sort((a, b) => a[0] - b[0]);
  const bad = pv.filter(([, v]) => v < P_MIN || v > P_MAX);
  if (bad.length) C.push({ id: "H3", sev: "fault", aud: "user", text_el: `Ο αισθητήρας πίεσης δίνει αδύνατες τιμές (${r1(bad[0][1])} hPa). Οι τιμές πίεσης του σταθμού δεν είναι αξιόπιστες.`, ev: { n: bad.length, v: r1(bad[0][1]) } });
  else {
    let step = null;
    for (let i = 1; i < pv.length; i++) if (pv[i][0] - pv[i - 1][0] === H && Math.abs(pv[i][1] - pv[i - 1][1]) > P_STEP) { step = { at: pv[i][0], d: pv[i][1] - pv[i - 1][1] }; break; }
    if (step) C.push({ id: "H3s", sev: "warning", aud: "user", text_el: `Η πίεση άλλαξε απότομα κατά ${r1(step.d)} hPa μέσα σε μία ώρα (${fmt(step.at)}) — πιθανή βλάβη του αισθητήρα πίεσης.`, ev: { at: new Date(step.at).toISOString(), d: r1(step.d) } });
  }
  // H4 χαμένη μεταβλητή
  if (tH >= 6) {
    const lost = [];
    if (pres.size === 0) lost.push("πίεση");
    if (wdir.size === 0) lost.push("κατεύθυνση ανέμου");
    if (rainHours.size === 0) lost.push("βροχή");
    if (lost.length) C.push({ id: "H4", sev: "fault", aud: "user", text_el: `Ο σταθμός στέλνει θερμοκρασία αλλά όχι ${lost.join(", ")} το τελευταίο 24ωρο — αισθητήρας σε σφάλμα.`, ev: { lost } });
  }
  // H6 βροχή που δεν υπολογίζεται
  if (tH >= 12 && !(rh || []).length) C.push({ id: "H6", sev: "warning", aud: "operator", text_el: "Η βροχή του σταθμού δεν υπολογίζεται (καμία ωριαία τιμή το τελευταίο 24ωρο).", ev: { hours: tH } });
  // H7 αδύνατοι δείκτες
  const huge = (rh || []).find((x) => Number(x.value) > RAIN_MAX_MMH);
  if (huge) C.push({ id: "H7r", sev: "warning", aud: "operator", text_el: `Αδύνατη ωριαία βροχή ${r1(Number(huge.value))} mm.`, ev: { time: huge.time } });
  if (kb && !(Number(kb.value) >= 0 && Number(kb.value) <= KBDI_MAX)) C.push({ id: "H7k", sev: "warning", aud: "operator", text_el: `Ο δείκτης ξηρασίας KBDI έχει αδύνατη τιμή (${kb.value}).`, ev: { v: kb.value } });

  // βροχή των 3 τελευταίων κλειστών ημερών, για το H10
  const days = bestDaily(dailyRecs).filter((d) => Number.isFinite(d.e) && d.e <= nowMs + 1000).slice(-3);
  const rain3 = days.length === 3 ? days.reduce((a, d) => a + d.mm, 0) : null;
  return { checks: C, rain3, tHours: tH, lastMs };
}

function mergeSince(checks, prev, nowIso) {
  const prevMap = new Map(((prev && prev.metadata && prev.metadata.checks) || []).map((c) => [c.id, c.since]));
  for (const c of checks) c.since = prevMap.get(c.id) || nowIso;
  return checks;
}
function worst(checks) { return checks.some((c) => c.sev === "fault") ? "fault" : checks.some((c) => c.sev === "warning") ? "warning" : "ok"; }

async function run(R, nowMs, log) {
  const list = await R.devices.list({ page: 1, amount: 200, fields: ["id", "name", "tags"], filter: { tags: [{ key: "type", value: "s2120" }] } });
  // συντεταγμένες από τους αγρούς (ετικέτα devices → σταθμός)
  const fields = await R.devices.list({ page: 1, amount: 200, fields: ["id", "name", "tags"], filter: { tags: [{ key: "isField", value: "yes" }] } });
  const coordOf = new Map();
  for (const f of fields || []) {
    const c = parseCoords(f.tags); if (!c) continue;
    const dt = (f.tags || []).find((x) => x.key === "devices");
    let map = {}; try { map = JSON.parse(dt ? dt.value : "{}"); } catch (e) { map = {}; }
    for (const v of Object.values(map)) for (const id of [].concat(v)) if (typeof id === "string" && !coordOf.has(id)) coordOf.set(id, c);
  }
  const res = [];
  for (const d of list || []) {
    const dev = { id: d.id, name: d.name, weatherStation: (d.tags || []).some((t) => t.key === "topalidouType" && t.value === "weatherStation"), coords: coordOf.get(d.id) || null };
    const read = (q) => R.devices.getDeviceData(d.id, q);
    try { res.push({ dev, ...(await inspect(read, dev, nowMs)) }); }
    catch (e) { log(`stationHealth: ${d.name} σφάλμα ανάγνωσης ${e && e.message ? e.message : e}`); }
  }
  // H10 — σύγκριση με γείτονες
  for (const a of res) {
    if (a.rain3 == null || a.rain3 >= SILENT_MM || !a.dev.coords) continue;
    let best = null;
    for (const b of res) {
      if (b === a || b.rain3 == null || !b.dev.coords) continue;
      const dist = km(a.dev.coords, b.dev.coords);
      if (dist < NEIGH_KM && b.rain3 >= NEIGH_MM && (!best || b.rain3 > best.mm)) best = { name: b.dev.name, mm: b.rain3, km: dist };
    }
    if (best) a.checks.push({ id: "H10", sev: "warning", aud: "user", text_el: `Το βροχόμετρο δεν κατέγραψε βροχή τις 3 τελευταίες ημέρες, ενώ σταθμός σε ${r1(best.km)} km μέτρησε ${r1(best.mm)} mm. Πιθανώς φραγμένο — χρειάζεται καθαρισμός και έλεγχος με λίγο νερό.`, ev: { own: r1(a.rain3), neighbour: best.name, mm: r1(best.mm), km: r1(best.km) } });
  }
  // εγγραφή
  const nowIso = new Date(nowMs).toISOString();
  let nBad = 0;
  for (const a of res) {
    try {
      const prev = (await R.devices.getDeviceData(a.dev.id, { variables: ["station_health"], qty: 1 }) || [])[0];
      const checks = mergeSince(a.checks, prev, nowIso);
      const status = worst(checks);
      if (status !== "ok") { nBad++; log(`stationHealth|${a.dev.name}|${status}|` + checks.map((c) => c.id + (c.since !== nowIso ? "(από " + c.since.slice(0, 10) + ")" : "")).join(",")); }
      await R.devices.sendDeviceData(a.dev.id, [{ variable: "station_health", value: status, time: nowIso,
        metadata: { version: HEALTH_VERSION, shadow: SHADOW, checks, window_end: new Date(Math.floor(nowMs / H) * H).toISOString(), temp_hours: a.tHours, rain3_mm: a.rain3 == null ? null : r1(a.rain3), has_coords: !!a.dev.coords } }]);
    } catch (e) { log(`stationHealth: ${a.dev.name} σφάλμα εγγραφής ${e && e.message ? e.message : e}`); }
  }
  log(`stationHealth ${HEALTH_VERSION}${SHADOW ? " (σκιώδες)" : ""}: ${res.length}/${(list || []).length} σταθμοί · με ευρήματα ${nBad} · με συντεταγμένες ${res.filter((a) => a.dev.coords).length}`);
  return res;
}

// ---------- REST (node-rt2025) ----------
const API = "https://api.us-e1.tago.io";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function restClient(token) {
  async function call(method, path, body) {
    for (let k = 0; k < 4; k++) {
      await sleep(250);
      const r = await fetch(API + path, { method, headers: { Authorization: token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 429) { await sleep(1000 * (Number(r.headers.get("retry-after")) || 20)); continue; }
      const j = await r.json().catch(() => ({}));
      if (j.status) return j.result;
      if (k === 3) throw new Error(method + " " + path.split("?")[0] + " " + r.status + " " + JSON.stringify(j.message || j).slice(0, 120));
      await sleep(2000);
    }
  }
  const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
  return {
    devices: {
      list: (q) => { const t = q.filter.tags[0]; return call("GET", "/device?" + qs({ "filter[tags][0][key]": t.key, "filter[tags][0][value]": t.value, amount: q.amount, page: q.page })); },
      getDeviceData: (id, q) => call("GET", `/device/${id}/data?` + qs({ variable: q.variables[0], query: q.query, interval: q.interval, function: q.function,
        start_date: q.start_date, end_date: q.end_date, qty: q.qty, ordination: q.ordination })),
      sendDeviceData: (id, arr) => call("POST", `/device/${id}/data`, arr),
    },
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { run, inspect, parseCoords, km, bestDaily, mergeSince, worst, fmt, athensHour, HEALTH_VERSION };
if (typeof process !== "undefined" && process.env && process.env.T_ANALYSIS_TOKEN) {
  run(restClient(process.env.T_ANALYSIS_TOKEN), Date.now(), (m) => console.log(m))
    .catch((e) => console.log("stationHealth: σφάλμα " + (e && e.message ? e.message : e)));
}
