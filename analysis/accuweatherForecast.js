// SAG — Πρόγνωση 5 ημερών για τις συσκευές πόλεων (device_type=accuweather) · v2 · 28/11/2026 · T-OM-CITY-01 · SC-0018
// Απόφαση Μιχάλη 28/11: «αντικατέστησε τα δεδομένα με Openmeteo». Η πηγή AccuWeather (κλειδί ACCUWEATHER_API_KEY)
// ΚΑΤΑΡΓΕΙΤΑΙ· τα δεδομένα έρχονται από το Open-Meteo (ίδια πηγή με την ανάλυση `forecast` των αγρών).
// ΙΔΙΑ ονόματα μεταβλητών, ίδιες μονάδες, ίδιος τύπος τιμών με την AccuWeather ώστε τα ταμπλό να δουλεύουν χωρίς αλλαγή:
//   τρέχουσες: temperature, wind_speed, wind_direction (πυξίδα), pressure, visibility, humidity, feel_temperature,
//              precipitation, cloud (κείμενο καιρού)
//   ημέρες 1–5 (1 = σήμερα, ημερομηνία Ελλάδας): dateN, min_tempN, max_tempN, day_iconN (αριθμός εικονιδίου τύπου
//              AccuWeather 1–44), dayN / nightN (κείμενο), precipitation_dayN / precipitation_nightN (% πιθανότητα),
//              wind_speedN (km/h), wind_directionN (°), humidity_minN / humidity_maxN (%)
// «Ημέρα» = 07:00–19:00 ώρα Ελλάδας, «νύχτα» = 19:00–07:00 της επομένης (όπως η AccuWeather). Κάθε εγγραφή έχει στα metadata
// την πηγή, τη ζώνη ώρας και το παράθυρο σε UTC (window_start_utc / window_end_utc).
// Θέση: ετικέτες latitude / longitude της συσκευής (κέντρο οικισμού· ΔΕΝ γράφονται στον κώδικα).
// Κόστος: 0 αναγνώσεις δεδομένων· 69 εγγραφές ανά συσκευή ανά εκτέλεση (όσες και πριν).
const { Device, Analysis, Utils, Account } = require("@tago-io/sdk");
const axios = require("axios");

const VERSION = "om-city-v2 · 2026-11-28";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const TZ = "Europe/Athens";
const DAYS = 5;
const DAY_FROM = 7, DAY_TO = 19;   // ώρες Ελλάδας

// WMO weather_code → [αριθμός εικονιδίου τύπου AccuWeather (ημέρα), εικονίδιο νύχτας, κείμενο]
const WMO = {
  0: [1, 33, "Sunny"], 1: [2, 34, "Mostly sunny"], 2: [3, 35, "Partly sunny"], 3: [7, 7, "Cloudy"],
  45: [11, 11, "Fog"], 48: [11, 11, "Fog"],
  51: [12, 12, "Drizzle"], 53: [12, 12, "Drizzle"], 55: [12, 12, "Drizzle"], 56: [26, 26, "Freezing drizzle"], 57: [26, 26, "Freezing drizzle"],
  61: [18, 18, "Rain"], 63: [18, 18, "Rain"], 65: [18, 18, "Heavy rain"], 66: [26, 26, "Freezing rain"], 67: [26, 26, "Freezing rain"],
  71: [22, 22, "Snow"], 73: [22, 22, "Snow"], 75: [22, 22, "Heavy snow"], 77: [22, 22, "Snow"],
  80: [12, 12, "Showers"], 81: [12, 12, "Showers"], 82: [12, 12, "Heavy showers"], 85: [22, 22, "Snow showers"], 86: [22, 22, "Snow showers"],
  95: [15, 15, "Thunderstorms"], 96: [15, 15, "Thunderstorms with hail"], 99: [15, 15, "Thunderstorms with hail"],
};
const wmo = (c) => WMO[c] || [null, null, c == null ? null : "Unknown"];
// «Πιο σημαντικός» καιρός του παραθύρου: ο μεγαλύτερος κωδικός WMO (όπως το daily weather_code του Open-Meteo), αλλά μια ώρα
// με υετό (κωδικός ≥ 51) μετρά μόνο αν η πιθανότητα υετού της ώρας είναι ≥ PRECIP_MIN_PROB· αλλιώς λογίζεται «συννεφιά» (3).
const PRECIP_MIN_PROB = 30;
const worst = (codes, probs) => codes.map((c, k) => (c != null && c >= 51 && Number.isFinite(probs[k]) && probs[k] < PRECIP_MIN_PROB ? 3 : c))
  .filter((c) => c != null).reduce((a, c) => (a == null || c > a ? c : a), null);
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) => (deg == null ? null : COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]);
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const max = (a) => { const v = a.filter(Number.isFinite); return v.length ? Math.max(...v) : null; };
const min = (a) => { const v = a.filter(Number.isFinite); return v.length ? Math.min(...v) : null; };

async function fetchOpenMeteo(lat, lon) {
  const params = {
    latitude: lat, longitude: lon, timezone: "UTC", timeformat: "unixtime", forecast_days: DAYS + 2, wind_speed_unit: "kmh",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,visibility",
    hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m",
    daily: "wind_direction_10m_dominant",
  };
  const { data } = await axios.get(OPEN_METEO_URL, { params, timeout: 20000 });
  return data;
}

// Αρχή ημέρας Ελλάδας (ms UTC) για την ημέρα που περιέχει το ms, και ημερομηνία YYYY-MM-DD
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function localParts(ms) { const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }; }

function buildDays(om, nowMs) {
  const t = om.hourly.time.map((s) => s * 1000);
  const H = om.hourly;
  const byDate = new Map();   // ημερομηνία Ελλάδας → δείκτες ωρών
  t.forEach((ms, i) => { const { date, hour } = localParts(ms); if (!byDate.has(date)) byDate.set(date, []); byDate.get(date).push({ i, ms, hour }); });
  const dates = [...byDate.keys()].sort();
  const today = localParts(nowMs).date;
  const start = dates.indexOf(today);
  if (start < 0) throw new Error("η σημερινή ημέρα λείπει από την απάντηση Open-Meteo");
  const dirByDate = new Map((om.daily.time || []).map((s, k) => [localParts(s * 1000 + 12 * 3600e3).date, om.daily.wind_direction_10m_dominant[k]]));
  const out = [];
  for (let d = 0; d < DAYS; d++) {
    const date = dates[start + d], next = dates[start + d + 1];
    if (!date || !next) break;
    const hrs = byDate.get(date), nextHrs = byDate.get(next);
    const day = hrs.filter((h) => h.hour >= DAY_FROM && h.hour < DAY_TO);
    const night = [...hrs.filter((h) => h.hour >= DAY_TO), ...nextHrs.filter((h) => h.hour < DAY_FROM)];
    const pick = (arr, key) => arr.map((h) => H[key][h.i]);
    const span = (arr) => (arr.length ? [new Date(arr[0].ms).toISOString(), new Date(arr[arr.length - 1].ms + 3600e3).toISOString()] : [null, null]);
    const dayCode = worst(pick(day, "weather_code"), pick(day, "precipitation_probability"));
    const nightCode = worst(pick(night, "weather_code"), pick(night, "precipitation_probability"));
    out.push({
      date,
      min_temp: r1(min(pick(hrs, "temperature_2m"))), max_temp: r1(max(pick(hrs, "temperature_2m"))),
      day_icon: wmo(dayCode)[0], day: wmo(dayCode)[2], night: wmo(nightCode)[2],
      precipitation_day: max(pick(day, "precipitation_probability")), precipitation_night: max(pick(night, "precipitation_probability")),
      wind_speed: r1(max(pick(day, "wind_speed_10m"))), wind_direction: dirByDate.has(date) ? Math.round(dirByDate.get(date)) : null,
      humidity_min: min(pick(day, "relative_humidity_2m")), humidity_max: max(pick(day, "relative_humidity_2m")),
      dayWin: span(day), nightWin: span(night), fullWin: span(hrs), dayCode, nightCode,
    });
  }
  return out;
}

function buildRecords(om, cityId, nowMs) {
  const C = om.current || {};
  const curMs = (C.time || Math.floor(nowMs / 1000)) * 1000;
  const meta = (extra) => Object.assign({ city: cityId, source: "open-meteo", tz: TZ, version: VERSION }, extra);
  const curMeta = meta({ observed_utc: new Date(curMs).toISOString(), kind: "current_model" });
  const rec = [
    { variable: "temperature", value: r1(C.temperature_2m), unit: "°C", metadata: curMeta },
    { variable: "wind_speed", value: r1(C.wind_speed_10m), unit: "km/h", metadata: curMeta },
    { variable: "wind_direction", value: compass(C.wind_direction_10m), metadata: Object.assign({ degrees: C.wind_direction_10m }, curMeta) },
    { variable: "pressure", value: r1(C.pressure_msl), unit: "mb", metadata: curMeta },
    { variable: "visibility", value: C.visibility == null ? null : r1(C.visibility / 1000), unit: "km", metadata: curMeta },
    { variable: "humidity", value: C.relative_humidity_2m, unit: "%", metadata: curMeta },
    { variable: "feel_temperature", value: r1(C.apparent_temperature), unit: "°C", metadata: curMeta },
    { variable: "precipitation", value: r1(C.precipitation), unit: "mm", metadata: Object.assign({ period_el: "προηγούμενη ώρα" }, curMeta) },
    { variable: "cloud", value: wmo(C.weather_code)[2], metadata: Object.assign({ weather_code: C.weather_code }, curMeta) },
  ];
  buildDays(om, nowMs).forEach((d, k) => {
    const n = k + 1;
    const full = meta({ date_local: d.date, window_start_utc: d.fullWin[0], window_end_utc: d.fullWin[1] });
    const dayM = meta({ date_local: d.date, window_start_utc: d.dayWin[0], window_end_utc: d.dayWin[1] });
    const nightM = meta({ date_local: d.date, window_start_utc: d.nightWin[0], window_end_utc: d.nightWin[1] });
    rec.push(
      { variable: `date${n}`, value: d.date, metadata: full },
      { variable: `min_temp${n}`, value: d.min_temp, unit: "°C", metadata: full },
      { variable: `max_temp${n}`, value: d.max_temp, unit: "°C", metadata: full },
      { variable: `day_icon${n}`, value: d.day_icon, metadata: Object.assign({ weather_code: d.dayCode }, dayM) },
      { variable: `day${n}`, value: d.day, metadata: Object.assign({ weather_code: d.dayCode }, dayM) },
      { variable: `night${n}`, value: d.night, metadata: Object.assign({ weather_code: d.nightCode }, nightM) },
      { variable: `precipitation_day${n}`, value: d.precipitation_day, unit: "%", metadata: dayM },
      { variable: `precipitation_night${n}`, value: d.precipitation_night, unit: "%", metadata: nightM },
      { variable: `wind_speed${n}`, value: d.wind_speed, unit: "km/h", metadata: Object.assign({ stat_el: "μέγιστη ωριαία μέση ταχύτητα ημέρας (όχι ριπή)" }, dayM) },
      { variable: `wind_direction${n}`, value: d.wind_direction, unit: "°", metadata: Object.assign({ stat_el: "επικρατούσα διεύθυνση 24ώρου" }, full) },
      { variable: `humidity_min${n}`, value: d.humidity_min, unit: "%", metadata: dayM },
      { variable: `humidity_max${n}`, value: d.humidity_max, unit: "%", metadata: dayM },
    );
  });
  return rec.filter((x) => x.value !== null && x.value !== undefined);
}

async function myAnalysis(context) {
  const tokenEnv = (context.environment || []).find((e) => e.key === "ACCOUNT_TOKEN");
  if (!tokenEnv) return context.log("Λείπει το ACCOUNT_TOKEN.");
  const account = new Account({ token: tokenEnv.value });
  const devices = await account.devices.list({ page: 1, amount: 100, fields: ["id", "name", "tags"], filter: { tags: [{ key: "device_type", value: "accuweather" }] } });
  context.log(`Πρόγνωση ${VERSION} · Open-Meteo · ${devices.length} τοποθεσίες`);
  const nowMs = Date.now();
  for (const dev of devices) {
    const tag = (k) => (dev.tags.find((t) => t.key === k) || {}).value;
    const name = tag("macc_alias") || dev.name;
    const lat = Number(tag("latitude")), lon = Number(tag("longitude"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { context.log(`${name}: λείπουν οι ετικέτες latitude/longitude — παράλειψη`); continue; }
    try {
      const om = await fetchOpenMeteo(lat, lon);
      const records = buildRecords(om, tag("city_id") || null, nowMs);
      const device = new Device({ token: await Utils.getTokenByName(account, dev.id) });
      await device.sendData(records);
      context.log(`${name}: ${records.length} εγγραφές`);
    } catch (e) {
      context.log(`${name}: ΣΦΑΛΜΑ ${e.message || e}`);
    }
  }
}

module.exports = new Analysis(myAnalysis);
module.exports.__test = { buildRecords, buildDays, wmo, compass, localParts };
