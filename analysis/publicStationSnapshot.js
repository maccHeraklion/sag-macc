// SAG — ΔΗΜΟΣΙΟ ΣΤΙΓΜΙΟΤΥΠΟ ΜΕΤΕΩΡΟΛΟΓΙΚΟΥ ΣΤΑΘΜΟΥ (T-PUBWX-01 · 17/11/2026 · Κώστα 4 #1, αίτημα Γιάννη)
//
// Γιατί: το Εσπερινό ΕΠΑΛ Πλατανιά θέλει τις μετρήσεις του σταθμού του στην ιστοσελίδα του (Blogger), χωρίς σύνδεση.
// Πώς: κάθε 15΄ αυτή η analysis διαβάζει τις ΤΕΛΕΥΤΑΙΕΣ τιμές του σταθμού και γράφει ένα μικρό JSON στα ΔΗΜΟΣΙΑ Files
// (`public/<slug>/latest.json`). Η σελίδα `public/<slug>/index.html` (custom_html_files/public/station.html) διαβάζει
// ΜΟΝΟ αυτό το JSON. Έτσι:
//   · κανένα token δεν βγαίνει σε δημόσια σελίδα·
//   · το Data Output είναι σταθερό (~20–40 εγγραφές ανά εκτέλεση) όσοι επισκέπτες κι αν έρθουν·
//   · ο σταθμός/λογαριασμός δεν εκτίθεται — το JSON έχει μόνο τις μετρήσεις που επιλέξαμε.
//
// Βροχή (ίδιοι κανόνες με τον πυρήνα v34 και το Cretaweather T-CRETAWX-RAIN-01):
//   βάση = τελευταία current_rain_height_{daily,monthly,yearly} της ανάλυσης βροχής (ενημέρωση ανά 3 ώρες),
//   + θετικά βήματα του μετρητή rain_height_acc ΜΕΤΑ το period_end_utc της βάσης (μηδενισμός → μετρά η νέα τιμή·
//   βήμα > 450 mm/ώρα απορρίπτεται). Αν η βάση ανήκει σε προηγούμενη περίοδο (π.χ. μόλις άλλαξε η μέρα), βάση = 0 από
//   τα μεσάνυχτα ώρας Ελλάδας. Σιωπηλός μετρητής > 180΄ → η βροχή «σήμερα» δηλώνεται άγνωστη.
//
// Runtime node-rt2025, χωρίς εξαρτήσεις. Δικαιώματα: πολιτική «[Analysis] Δημόσιος σταθμός ΕΠΑΛ» (device get_data στον
// σταθμό, file access/upload κάτω από public/).

const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";

const STATIONS = [
  { slug: "epal_platania", device: "6a313a9bb99739000d4aafa9", title: "Εσπερινό ΕΠΑΛ Πλατανιά",
    subtitle: "Μετεωρολογικός σταθμός · Πλατανιάς Χανίων" },
];

const RAW_VARS = ["air_temperature", "air_humidity", "dew_point", "barometric_pressure_hpa", "wind_speed_kmh",
  "peak_wind_gust_kmh", "wind_direction_sensor", "uv_index", "light_intensity", "rain_gauge", "rain_height_acc"];
const RAIN_VARS = ["current_rain_height_daily", "current_rain_height_monthly", "current_rain_height_yearly"];
const RAIN_MAX_MMH = 450, RAIN_FRESH_MIN = 180, ANCHOR_LEAD_MIN = 30;

async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.split("?")[0] + " -> " + JSON.stringify(j.message || j).slice(0, 300));
  return j.result;
}
const qsVars = (vs) => vs.map((v) => "variables[]=" + encodeURIComponent(v)).join("&");

// ── ώρα Ελλάδας (ίδιο με weather-dashboard.js) ──
const tzFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Athens", hourCycle: "h23", year: "numeric",
  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
function tzOffsetMs(ms) {
  const p = tzFmt.formatToParts(new Date(ms)); const g = (t) => Number(p.find((x) => x.type === t).value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
}
function localMidnight(y, m, d) { const guess = Date.UTC(y, m, d); return guess - tzOffsetMs(guess - tzOffsetMs(guess)); }
function periods(nowMs) {
  const L = new Date(nowMs + tzOffsetMs(nowMs)); const y = L.getUTCFullYear(), m = L.getUTCMonth(), d = L.getUTCDate();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    daily: { key: `${y}-${pad(m + 1)}-${pad(d)}`, start: localMidnight(y, m, d) },
    monthly: { key: `${y}-${pad(m + 1)}`, start: localMidnight(y, m, 1) },
    yearly: { key: `${y}`, start: localMidnight(y, 0, 1) },
  };
}

// Θετικά βήματα μετρητή σε (from, now]. P ταξινομημένο κατά χρόνο. Επιστρέφει { mm, anchored } ή null (καμία τιμή).
function counterSince(P, fromMs) {
  let i0 = -1; for (let i = 0; i < P.length; i++) if (P[i].t <= fromMs) i0 = i;
  let anchored = i0 >= 0 && (fromMs - P[i0].t) / 60000 <= ANCHOR_LEAD_MIN;
  if (i0 < 0) i0 = 0;
  let mm = 0;
  for (let i = i0 + 1; i < P.length; i++) {
    if (P[i].t <= fromMs) continue;
    const dh = Math.max((P[i].t - P[i - 1].t) / 3600000, 1 / 60);
    let d = P[i].v - P[i - 1].v;
    if (d < -0.001) d = P[i].v;
    if (d > RAIN_MAX_MMH * dh + 0.254) d = 0;
    if (d > 0) mm += d;
  }
  return { mm, anchored };
}

const r3 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 1000) / 1000);

async function snapshot(st, nowMs) {
  // 1 κλήση: τελευταία τιμή κάθε μεταβλητής (≈ 14 εγγραφές)
  const last = await api(`/device/${st.device}/data?${qsVars(RAW_VARS.concat(RAIN_VARS))}&query=last_value`);
  const by = {}; for (const r of last || []) if (!by[r.variable] || r.time > by[r.variable].time) by[r.variable] = r;
  const P = periods(nowMs);
  // βάσεις βροχής + από πότε μετράει ο μετρητής
  const rain = {}; let fromMin = nowMs;
  for (const k of ["daily", "monthly", "yearly"]) {
    const rec = by["current_rain_height_" + k]; const md = (rec && rec.metadata) || {};
    if (rec && md.period_key === P[k].key) {
      const from = Date.parse(md.period_end_utc || rec.time);
      rain[k] = { base: Number(rec.value) || 0, from, coverage: md.coverage, status: md.status, since: md.since || null };
    } else rain[k] = { base: 0, from: P[k].start, coverage: null, status: rec ? "new_period" : "missing", since: null };
    fromMin = Math.min(fromMin, rain[k].from);
  }
  // 2η κλήση: σημεία μετρητή από λίγο πριν το παλαιότερο «from» (συνήθως ≤ 3 ώρες → ≤ 40 εγγραφές)
  let pts = [];
  const winStart = new Date(Math.max(fromMin, nowMs - 26 * 3600000) - ANCHOR_LEAD_MIN * 60000).toISOString();
  const raw = await api(`/device/${st.device}/data?variables[]=rain_height_acc&start_date=${encodeURIComponent(winStart)}&qty=400&ordination=ascending`);
  pts = (raw || []).map((r) => ({ t: Date.parse(r.time), v: Number(r.value) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  const lastAccT = pts.length ? pts[pts.length - 1].t : (by.rain_height_acc ? Date.parse(by.rain_height_acc.time) : null);
  const silent = lastAccT == null || (nowMs - lastAccT) / 60000 > RAIN_FRESH_MIN;
  const out = {};
  for (const k of ["daily", "monthly", "yearly"]) {
    const R = rain[k]; const c = pts.length ? counterSince(pts, R.from) : { mm: 0, anchored: false };
    out[k] = {
      mm: silent && k === "daily" ? null : r3(R.base + c.mm),
      // «≥» όταν η τιμή μπορεί να είναι μικρότερη από την πραγματική (λείπουν μέρες/μήνες ή δεν υπάρχει άγκυρα)
      at_least: (R.coverage != null && R.coverage < 0.999) || R.status === "estimate" || (!c.anchored && c.mm > 0),
      estimate: R.status === "estimate", since: R.since,
    };
  }
  const v = (name) => (by[name] ? { value: r3(by[name].value), time: by[name].time } : null);
  const rg = by.rain_gauge;
  const data = {
    station: { title: st.title, subtitle: st.subtitle },
    generated_at: new Date(nowMs).toISOString(),
    last_uplink: by.air_temperature ? by.air_temperature.time : null,
    temperature_c: v("air_temperature"), humidity_pct: v("air_humidity"), dew_point_c: v("dew_point"),
    pressure_hpa: v("barometric_pressure_hpa"),
    wind_kmh: v("wind_speed_kmh"), gust_kmh: v("peak_wind_gust_kmh"), wind_dir_deg: v("wind_direction_sensor"),
    uv_index: v("uv_index"), light_lux: v("light_intensity"),
    rain_rate_mmh: rg ? { value: r3(Number(rg.value) * 12), time: rg.time } : null,   // κάδος 5΄ → mm/ώρα
    rain_today_mm: out.daily, rain_month_mm: out.monthly, rain_year_mm: out.yearly,
    reads: (last || []).length + pts.length,
  };
  return data;
}

async function uploadPublic(target, body, contentType) {
  const fd1 = new FormData();
  fd1.append("multipart_action", "start"); fd1.append("filename", target); fd1.append("public", "true"); fd1.append("contentType", contentType);
  const uploadID = await api("/files", { method: "POST", body: fd1 });
  const fd2 = new FormData();
  fd2.append("multipart_action", "upload"); fd2.append("filename", target); fd2.append("public", "true");
  fd2.append("upload_id", uploadID); fd2.append("part", "1"); fd2.append("file", new Blob([body], { type: contentType }), target);
  const part = await api("/files", { method: "POST", body: fd2 });
  await api("/files", { method: "POST", body: JSON.stringify({ multipart_action: "end", filename: target, public: true,
    upload_id: uploadID, parts: [{ ETag: part.ETag, PartNumber: 1 }] }) });
}

// Συγχρονισμός σελίδας ΜΟΝΟ με χειροκίνητη εκτέλεση: scope {"sync_page":{"commit":"<git sha>","sha256":"<sha256 LF>"}}.
// Τραβά custom_html_files/public/station.html από το δημόσιο GitHub σε ΚΑΡΦΩΜΕΝΟ commit, ελέγχει sha256, ανεβάζει σε
// public/<slug>/index.html (text/html) και ξαναδιαβάζει τη δημόσια διεύθυνση (bytes + content-type).
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";
const PUBLIC_FILE_BASE = "https://api.tago.io/file/67934c48e8e573000ae5964b/";
async function syncPage(st, req) {
  if (!/^[0-9a-f]{40}$/.test(String(req.commit || "")) || !/^[0-9a-f]{64}$/.test(String(req.sha256 || ""))) { console.log("PAGE|STOP|χρειάζεται commit (40 hex) και sha256 (64 hex)"); return; }
  const r = await fetch(`${REPO_RAW}/${req.commit}/custom_html_files/public/station.html`);
  if (!r.ok) { console.log("PAGE|STOP|GitHub " + r.status); return; }
  let s = Buffer.from(await r.arrayBuffer()).toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const body = Buffer.from(s, "utf8"); const h = crypto.createHash("sha256").update(body).digest("hex");
  if (h !== req.sha256) { console.log(`PAGE|STOP|sha256 ${h.slice(0, 12)}… ≠ αναμενόμενο ${req.sha256.slice(0, 12)}…`); return; }
  const target = `public/${st.slug}/index.html`;
  await uploadPublic(target, body, "text/html");
  for (let i = 1; i <= 3; i++) {
    const v = await fetch(PUBLIC_FILE_BASE + target + "?v=" + Date.now(), { redirect: "follow", cache: "no-store" });
    const got = Buffer.from(await v.arrayBuffer()); const ct = String(v.headers.get("content-type") || "");
    const ok = got.length === body.length && crypto.createHash("sha256").update(got).digest("hex") === h && ct.startsWith("text/html");
    if (ok || i === 3) { console.log(`PAGE|${ok ? "OK" : "FAIL"}|${target}|bytes=${got.length}/${body.length}|ct=${ct}|δοκιμή ${i}`); break; }
    await new Promise((res) => setTimeout(res, 15000));
  }
}

(async () => {
  const now = Date.now();
  let scope = {}; try { const d = JSON.parse(process.env.T_ANALYSIS_DATA || "[]"); scope = (Array.isArray(d) ? d[0] : d) || {}; } catch (_e) { scope = {}; }
  for (const st of STATIONS) {
    if (scope.sync_page) { try { await syncPage(st, scope.sync_page); } catch (e) { console.log(`PAGE|ERR|${e.message}`); } }
    try {
      const data = await snapshot(st, now);
      const body = Buffer.from(JSON.stringify(data), "utf8");
      await uploadPublic(`public/${st.slug}/latest.json`, body, "application/json");
      console.log(`OK|${st.slug}|reads=${data.reads}|temp=${data.temperature_c && data.temperature_c.value}|rain_day=${data.rain_today_mm.mm}|month=${data.rain_month_mm.mm}|year=${data.rain_year_mm.mm}|last=${data.last_uplink}|sha=${crypto.createHash("sha256").update(body).digest("hex").slice(0, 12)}`);
    } catch (e) { console.log(`ERR|${st.slug}|${e.message}`); }
  }
})();
