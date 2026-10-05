(function () {
  "use strict";

  const state = {
    latest: {},
    latestByDevice: {},
    deviceNames: {},
    weatherDevices: {},
    selectedDevice: null,
    lastPayloadAt: null,
    history: [],
    range: "24h",
    apiToken: null,
    deviceToken: null,
    widgetMeta: null,
    historyLoaded: false,
    chartCache: [],
    activeChartIndex: null,
    // Μετρητής βροχής `rain_height_acc` του επιλεγμένου σταθμού: σημεία {t, v} ταξινομημένα κατά χρόνο.
    acc: [],
    accSteps: null,
    accLoaded: false,
    accLoading: false,
  };

  const labels = {
    air_temperature: "Θερμοκρασία Αέρα",
    temperature: "Θερμοκρασία Αέρα",
    air_humidity: "Υγρασία Αέρα",
    humidity: "Υγρασία Αέρα",
    barometric_pressure_hpa: "Βαρομετρική Πίεση",
    pressure: "Πίεση",
    uv_index: "UV",
    light_intensity: "Ένταση Ηλιοφάνειας",
    lux: "Φωτεινότητα",
    illuminance: "Φωτεινότητα",
    solar_radiation_lux: "Φωτεινή Ακτινοβολία",
    wind_speed_kmh: "Ταχύτητα Ανέμου",
    wind_direction_sensor: "Κατεύθυνση Ανέμου",
    wind_direction: "Κατεύθυνση Ανέμου",
    wind_dir: "Κατεύθυνση Ανέμου",
    dew_point: "Σημείο δρόσου",
    wind_chill: "Δείκτης Ψυχρότητας",
    rain_gauge: "Ένδειξη έντασης οργάνου (ωμή)",
    rain_height: "Βροχόπτωση",
    rain_height_acc: "Βροχόπτωση (Συσσωρευτική)",
    rain_height_daily: "Βροχόπτωση Ημέρας",
    current_rain_height_daily: "Βροχόπτωση Σήμερα",
    rain_height_weekly: "Βροχόπτωση Εβδομάδας",
    current_rain_height_weekly: "Βροχόπτωση Εβδομάδας",
    rain_height_monthly: "Βροχόπτωση Μήνα",
    current_rain_height_monthly: "Βροχόπτωση Μήνα",
    rain_height_yearly: "Βροχόπτωση Έτους",
    current_rain_height_yearly: "Βροχόπτωση Έτους",
    forecast: "Πρόγνωση",
  };

  const units = {
    air_temperature: "°C",
    temperature: "°C",
    air_humidity: "%",
    humidity: "%",
    barometric_pressure_hpa: "hPa",
    pressure: "hPa",
    uv_index: "",
    light_intensity: "lux",
    lux: "lux",
    illuminance: "lux",
    solar_radiation_lux: "lux",
    wind_speed_kmh: "km/h",
    wind_direction_sensor: "°",
    wind_direction: "°",
    wind_dir: "°",
    dew_point: "°C",
    wind_chill: "°C",
    rain_gauge: "",
    rain_height: "mm",
    rain_height_acc: "mm",
    rain_height_daily: "mm",
    current_rain_height_daily: "mm",
    rain_height_weekly: "mm",
    current_rain_height_weekly: "mm",
    rain_height_monthly: "mm",
    current_rain_height_monthly: "mm",
    rain_height_yearly: "mm",
    current_rain_height_yearly: "mm",
  };

  const metricDefinitions = [
    { key: "air_temperature", aliases: ["air_temperature", "temperature"], label: "Θερμοκρασία Αέρα", accent: "accent-temp", digits: 1, foot: "Αισθητήρας θερμοκρασίας" },
    { key: "air_humidity", aliases: ["air_humidity", "humidity"], label: "Υγρασία Αέρα", accent: "accent-hum", digits: 0, foot: "Σχετική υγρασία" },
    { key: "barometric_pressure_hpa", aliases: ["barometric_pressure_hpa", "pressure"], label: "Βαρομετρική Πίεση", accent: "accent-bar", digits: 1, foot: "Ατμοσφαιρική πίεση" },
    { key: "uv_index", aliases: ["uv_index"], label: "UV", accent: "accent-uv", digits: 0, foot: "Δείκτης υπεριώδους" },
    { key: "light_intensity", aliases: ["light_intensity", "lux", "illuminance", "solar_radiation_lux"], label: "Φωτεινή Ακτινοβολία", accent: "accent-lux", digits: 0, foot: "Φωτεινότητα σε lux" },
    { key: "wind_speed_kmh", aliases: ["wind_speed_kmh"], label: "Ταχύτητα Ανέμου", accent: "accent-wind", digits: 2, foot: "Μέση ταχύτητα" },
    { key: "wind_direction_sensor", aliases: ["wind_direction_sensor", "wind_direction", "wind_dir"], label: "Κατεύθυνση Ανέμου", accent: "accent-neutral", digits: 0, foot: "Γωνιακή διεύθυνση" },
    { key: "dew_point", aliases: ["dew_point"], label: "Σημείο δρόσου", accent: "accent-neutral", digits: 1, foot: "Έλεγχος διαθεσιμότητας" },
    // Βροχή: υπολογίζεται εδώ, ζωντανά, από τον μετρητή του σταθμού (rain_height_acc) — βλ. ΥΠΟΛΟΓΙΣΜΟΣ ΒΡΟΧΗΣ.
    { key: "rain_day", rain: "day", label: "Βροχόπτωση Ημέρας", accent: "accent-rain", digits: 2, unit: "mm" },
    { key: "rain_week", rain: "week", label: "Βροχόπτωση Εβδομάδας", accent: "accent-rainm", digits: 2, unit: "mm" },
    { key: "rain_month", rain: "month", label: "Βροχόπτωση Μήνα", accent: "accent-rainm", digits: 2, unit: "mm" },
    { key: "rain_rate", rain: "hour", label: "Ένταση Βροχής", accent: "accent-rain", digits: 1, unit: "mm/ώρα" },
  ];
  const defByKey = (key) => metricDefinitions.find((def) => def.key === key);

  const weatherKeys = new Set([
    "wind_chill", "thw_indexc", "heat_index", "dew_point", "barometric_pressure_hpa", "pressure",
    "rain_gauge", "rain_height", "rain_height_acc", "rain_height_daily", "rain_height_weekly", "rain_height_monthly", "rain_height_yearly",
    "current_rain_height_daily", "current_rain_height_weekly", "current_rain_height_monthly", "current_rain_height_yearly",
    "wind_direction_sensor", "wind_direction", "wind_dir", "wind_speed_kmh", "uv_index", "light_intensity", "lux", "illuminance", "solar_radiation_lux",
    "air_temperature", "temperature", "air_humidity", "humidity", "forecast",
  ]);

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
  const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const fmt = (value, digits = 1) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value === 0 ? "0" : "Δεν υπάρχει τιμή";
    return n.toLocaleString("el-GR", { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? 0 : 0 });
  };
  const rangeOptions = {
    "24h": { label: "24 ώρες", hours: 24, bucketMs: 5 * 60 * 1000, maxRows: 420 },
    "7d": { label: "7 ημέρες", hours: 7 * 24, bucketMs: 60 * 60 * 1000, maxRows: 260 },
    "30d": { label: "30 ημέρες", hours: 30 * 24, bucketMs: 6 * 60 * 60 * 1000, maxRows: 220 },
  };
  // Regional device-data endpoint + variables fetched for history/charts.
  const API_HOST = "https://api.us-e1.tago.io";
  // Charted/tabled signals only. dew_point is intentionally excluded — it has no
  // chart or history column, so its metric card is fed by live data alone.
  const AGG_AVG_VARS = ["air_temperature", "air_humidity", "barometric_pressure_hpa", "wind_speed_kmh", "wind_direction_sensor", "uv_index", "light_intensity"];
  // Η βροχή ΔΕΝ αθροίζεται από το rain_gauge: είναι ένταση, όχι ποσότητα, και το άθροισμά της βγαίνει
  // 2–3 φορές η πραγματική βροχή (έλεγχος 4/10/2026, §10.4–10.5). Η βροχή έρχεται από τον μετρητή.
  const AGG_SUM_VARS = [];
  const SUM_SET = new Set(AGG_SUM_VARS);
  const chartDefinitions = [
    { title: "Θερμοκρασία", names: ["air_temperature", "temperature"], color: "#c8b425", unit: "°C", type: "line", digits: 1 },
    { title: "Υγρασία", names: ["air_humidity", "humidity"], color: "#55a83c", unit: "%", type: "line", digits: 0 },
    { title: "Βροχόπτωση", names: [], rain: true, color: "#4f8fd8", unit: "mm", type: "bar", digits: 1 },
    { title: "Πίεση", names: ["barometric_pressure_hpa", "pressure"], color: "#6b7886", unit: "hPa", type: "line", digits: 1 },
    { title: "Ταχύτητα Ανέμου", names: ["wind_speed_kmh"], color: "#b58c15", unit: "km/h", type: "line", digits: 1 },
    { title: "Φωτεινή Ακτινοβολία", names: ["light_intensity", "lux", "illuminance", "solar_radiation_lux"], color: "#eead1a", unit: "lux", type: "line", digits: 0 },
    { title: "Δείκτης UV", names: ["uv_index"], color: "#9b8f16", unit: "", type: "line", digits: 0 },
    { title: "Κατεύθυνση Ανέμου", names: ["wind_direction_sensor", "wind_direction", "wind_dir"], color: "#3f7b63", unit: "°", type: "line", digits: 0 },
  ];
  const idOf = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value.id || value.device || value.device_id || value.bucket || value.bucket_id || null;
    return value;
  };

  // ═══ ΥΠΟΛΟΓΙΣΜΟΣ ΒΡΟΧΗΣ (T-CRETAWX-RAIN-01, 5/10/2026) ═══════════════════════════════════════════════
  // Αυτόνομο: καμία αναφορά στο state/DOM. Ο ελεγκτής analysis/test/cretaweather_rain_check.mjs το εκτελεί αυτούσιο.
  // Ίδιοι κανόνες με τον πυρήνα (runPerTich.js, T-RAIN-ACC-01) και την ανάλυση βροχής v34:
  //  · βροχή = άθροισμα θετικών βημάτων του μετρητή rain_height_acc (κάδος 0,254 mm)
  //  · μηδενισμός μετρητή (αρνητικό βήμα) → μετρά η νέα τιμή
  //  · βήμα > 450 mm/ώρα (όριο οργάνου S2120) → απορρίπτεται
  //  · τελευταία τιμή παλαιότερη από 180΄ → σιωπηλός σταθμός, «—» αντί για 0
  //  · χωρίς τιμή έως 180΄ (ώρα: 30΄) πριν την αρχή του διαστήματος → μερική τιμή, «≥»
  //  · ημέρα / εβδομάδα (Δευτέρα) / μήνας σε ώρα Ελλάδας
  const RAIN_TZ = "Europe/Athens";
  const RAIN_MAX_MMH = 450;
  const RAIN_FRESH_MIN = 180;
  const RAIN_LEAD_MIN = 180;
  const RAIN_LEAD_HOUR_MIN = 30;
  const rainTzFmt = new Intl.DateTimeFormat("en-US", { timeZone: RAIN_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  function rainTzOffsetMs(ms) {
    const parts = rainTzFmt.formatToParts(new Date(ms));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(ms / 1000) * 1000;
  }
  function rainLocalMidnight(y, m, d) {        // 00:00 ώρα Ελλάδας της (y, m, d) → ms UTC (σωστό και στις αλλαγές ώρας)
    const guess = Date.UTC(y, m, d);
    return guess - rainTzOffsetMs(guess - rainTzOffsetMs(guess));
  }
  function rainPeriodStart(unit, nowMs) {
    const local = new Date(nowMs + rainTzOffsetMs(nowMs));
    const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
    if (unit === "hour") return nowMs - 3600000;                  // κυλιόμενη τελευταία ώρα
    if (unit === "day") return rainLocalMidnight(y, m, d);
    if (unit === "week") return rainLocalMidnight(y, m, d - ((local.getUTCDay() + 6) % 7));
    if (unit === "month") return rainLocalMidnight(y, m, 1);
    throw new Error("unknown rain unit " + unit);
  }
  function rainDayStarts(nowMs, count) {       // αρχές των τελευταίων `count` ημερών (ώρα Ελλάδας), παλαιότερη πρώτη
    const local = new Date(nowMs + rainTzOffsetMs(nowMs));
    const out = [];
    for (let i = count - 1; i >= 0; i -= 1) out.push(rainLocalMidnight(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - i));
    return out;
  }
  // Βήματα ανά σημείο: steps[i] = βροχή από το P[i-1] στο P[i] (0 για i = 0 ή απορριφθέν βήμα)· cum = αθροιστικά.
  function rainSteps(P) {
    const steps = new Array(P.length).fill(0);
    const cum = new Array(P.length).fill(0);
    for (let i = 1; i < P.length; i += 1) {
      const dh = Math.max((P[i].t - P[i - 1].t) / 3600000, 1 / 60);
      let d = P[i].v - P[i - 1].v;
      if (d < -0.001) d = P[i].v;                                  // μηδενισμός μετρητή
      if (d > RAIN_MAX_MMH * dh + 0.254) d = 0;                    // αδύνατο βήμα
      steps[i] = d > 0 ? d : 0;
      cum[i] = cum[i - 1] + steps[i];
    }
    return { steps, cum };
  }
  const rainLastIdxAtOrBefore = (P, t) => { let lo = 0, hi = P.length - 1, ans = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (P[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; } return ans; };
  // Βροχή στο [S, E]. Επιστρέφει { known, mm, partial, lastT, why }.
  //   why: "nocounter" (καμία τιμή μετρητή) · "silent" (σιωπηλός σταθμός) · "nodata" (καμία τιμή στο διάστημα) · "impossible"
  function rainWindow(P, S, E, leadMin, nowMs) {
    if (!P.length) return { known: false, why: "nocounter" };
    const iEnd = rainLastIdxAtOrBefore(P, E);
    if (iEnd < 0) return { known: false, why: "nodata" };
    const lastT = P[iEnd].t;
    if (E >= nowMs - 60000 && (nowMs - lastT) / 60000 > RAIN_FRESH_MIN) return { known: false, why: "silent", lastT };
    let i0 = rainLastIdxAtOrBefore(P, S);
    let partial = false;
    if (i0 < 0 || (S - P[i0].t) / 60000 > leadMin) { i0 += 1; partial = true; }   // χωρίς άγκυρα: από το πρώτο σημείο μέσα
    if (i0 > iEnd || P[i0].t > E) return { known: false, why: "nodata", lastT };
    const { cum } = rainSteps.cached(P);
    const mm = cum[iEnd] - cum[i0];
    const spanH = Math.max((P[iEnd].t - P[i0].t) / 3600000, 1 / 60);
    if (!(mm >= 0) || mm > RAIN_MAX_MMH * spanH + 0.254) return { known: false, why: "impossible", lastT };
    return { known: true, mm: Math.round(mm * 1000) / 1000, partial, lastT };
  }
  // Μνήμη βημάτων ανά πίνακα σημείων (ξαναϋπολογίζεται όταν αλλάξει το μήκος ή το τελευταίο σημείο).
  rainSteps.cached = (P) => {
    const key = P.length + ":" + (P.length ? P[P.length - 1].t + ":" + P[P.length - 1].v : "");
    if (!P.__rainSteps || P.__rainSteps.key !== key) Object.defineProperty(P, "__rainSteps", { value: { key, ...rainSteps(P) }, configurable: true, writable: true });
    return P.__rainSteps;
  };
  // Βροχή σε διαδοχικά διαστήματα [starts[k], starts[k+1]) για το διάγραμμα· διάστημα χωρίς δεδομένα → value null.
  function rainBuckets(P, starts, endMs) {
    const out = [];
    if (!P.length) return out;
    const { cum } = rainSteps.cached(P);
    for (let k = 0; k < starts.length; k += 1) {
      const s = starts[k], e = k + 1 < starts.length ? starts[k + 1] : endMs;
      const a = rainLastIdxAtOrBefore(P, s), b = rainLastIdxAtOrBefore(P, e);
      const has = b >= 0 && P[b].t > s;                            // υπάρχει τιμή μέσα στο διάστημα
      out.push({ time: new Date(s).toISOString(), value: has ? Math.round((cum[b] - cum[Math.max(a, 0)]) * 1000) / 1000 : null });
    }
    return out;
  }
  // ═══ ΤΕΛΟΣ ΥΠΟΛΟΓΙΣΜΟΥ ΒΡΟΧΗΣ ═══════════════════════════════════════════════════════════════════════════

  function normalizeRecord(raw) {
    if (!raw || typeof raw !== "object") return null;
    const variable = raw.variable || raw.name || raw.key;
    if (!variable) return null;
    const device = idOf(raw.device) || idOf(raw.device_id) || idOf(raw.bucket) || idOf(raw.bucket_id) || idOf(raw.origin) || idOf(raw.group) || (raw.metadata && (idOf(raw.metadata.device) || idOf(raw.metadata.device_id)));
    return {
      variable: String(variable),
      value: raw.value,
      unit: raw.unit,
      time: raw.time || raw.created_at || raw.createdAt || raw.timestamp || null,
      metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
      device: device ? String(device) : null,
      serie: raw.serie || raw.series || null,
    };
  }

  function collectRecords(payload, out = []) {
    if (!payload) return out;
    if (Array.isArray(payload)) {
      payload.forEach((item) => collectRecords(item, out));
      return out;
    }
    if (typeof payload !== "object") return out;
    const rec = normalizeRecord(payload);
    if (rec) out.push(rec);
    ["data", "variables", "values", "result", "payload", "items"].forEach((key) => {
      if (payload[key] && payload[key] !== payload) collectRecords(payload[key], out);
    });
    return out;
  }

  // A payload can carry several points per variable (often newest-first). Guard
  // against an older duplicate clobbering the newer "latest" record — that regression
  // is what made a fresh reading suddenly display as "2 days ago" on the first update.
  function isNewer(record, existing) {
    if (!existing) return true;
    const t = new Date(record.time).getTime();
    const prev = new Date(existing.time).getTime();
    if (!Number.isFinite(t)) return !Number.isFinite(prev);
    if (!Number.isFinite(prev)) return true;
    return t >= prev;
  }

  function absorbPayload(payload) {
    const records = collectRecords(payload).filter((record) => weatherKeys.has(record.variable) || record.variable === "field_bundle");
    records.forEach((record) => {
      if (record.variable === "field_bundle") {
        absorbBundle(record);
        return;
      }
      if (record.variable === "rain_height_acc") addAccPoints([record]);
      if (isNewer(record, state.latest[record.variable])) state.latest[record.variable] = record;
      if (record.device) {
        state.latestByDevice[record.device] = state.latestByDevice[record.device] || {};
        if (isNewer(record, state.latestByDevice[record.device][record.variable])) state.latestByDevice[record.device][record.variable] = record;
        if (weatherKeys.has(record.variable)) state.weatherDevices[record.device] = { id: record.device, name: state.deviceNames[record.device] || record.device };
      }
    });
    absorbMeta(payload);
    if (records.length) {
      state.lastPayloadAt = new Date();
      pushHistory(records);
    }
    if (!state.selectedDevice) state.selectedDevice = Object.keys(state.weatherDevices)[0] || Object.keys(state.latestByDevice)[0] || "default";
    render();
    if (!state.historyLoaded && (state.deviceToken || state.apiToken) && state.selectedDevice && state.selectedDevice !== "default") maybeLoadHistory();
  }

  function absorbBundle(record) {
    const bundle = record.metadata || {};
    const shared = bundle.shared || {};
    Object.entries(shared).forEach(([variable, packed]) => {
      if (!weatherKeys.has(variable)) return;
      const item = unpack(variable, packed, record);
      state.latest[variable] = item;
      if (record.device) {
        state.latestByDevice[record.device] = state.latestByDevice[record.device] || {};
        state.latestByDevice[record.device][variable] = item;
      }
    });
  }

  function unpack(variable, packed, base) {
    if (packed && typeof packed === "object" && Object.prototype.hasOwnProperty.call(packed, "value")) {
      return { variable, value: packed.value, metadata: packed.metadata || {}, unit: base.unit, time: base.time, device: base.device };
    }
    return { variable, value: packed, metadata: {}, unit: base.unit, time: base.time, device: base.device };
  }

  function absorbMeta(payload) {
    if (payload?.dashboard && payload?.id && !state.widgetMeta) {
      state.widgetMeta = { dashboardId: String(payload.dashboard), widgetId: String(payload.id) };
    }
    if (payload?.display?.parameters) absorbWidgetParameters(payload.display.parameters);
    if (payload?.display?.variables) {
      asArray(payload.display.variables).forEach((v) => {
        const devId = v?.origin?.id || v?.origin?.bucket;
        if (!devId) return;
        const name = state.deviceNames[devId] || devId;
        state.deviceNames[devId] = name;
        state.weatherDevices[devId] = { id: devId, name };
      });
      if (!state.selectedDevice) {
        const first = asArray(payload.display.variables).find((v) => v?.origin?.id);
        if (first) state.selectedDevice = first.origin.id;
      }
    }
    const candidates = asArray(payload && (payload.devices || payload.deviceList || payload.weatherDevices));
    candidates.forEach((dev, idx) => {
      if (!dev || typeof dev !== "object") return;
      const id = String(dev.id || dev.device || dev.device_id || dev.bucket || idx + 1);
      state.deviceNames[id] = dev.name || dev.label || state.deviceNames[id] || `Σταθμός ${idx + 1}`;
      if (dev.weather || dev.type === "weather" || /weather|station|meteo|s2120|καιρ|μετεω/i.test(JSON.stringify(dev))) {
        state.weatherDevices[id] = { id, name: state.deviceNames[id] };
      }
    });
    const params = payload && (payload.parameters || payload.params || payload.widget || payload.environment);
    if (params && typeof params === "object") setTitle(params.station_name || params.site_name || params.field_name || params.name);
  }

  function absorbWidgetParameters(parameters) {
    const map = new Map(asArray(parameters).map((item) => [String(item?.key || ""), item?.value]));
    setTitle(map.get("station_name") || map.get("site_name") || map.get("field_name") || map.get("name"));
    const token = map.get("api_token");
    if (token && !state.apiToken) state.apiToken = String(token).trim();
    const deviceToken = map.get("device_api_token");
    if (deviceToken && !state.deviceToken) state.deviceToken = String(deviceToken).trim();
    const deviceMapRaw = map.get("device_map") || map.get("station_map");
    if (!deviceMapRaw) return;
    try {
      const parsed = typeof deviceMapRaw === "string" ? JSON.parse(deviceMapRaw) : deviceMapRaw;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          const id = String(item?.id ?? item?.device ?? item?.key ?? "");
          const name = String(item?.name ?? item?.label ?? "");
          if (id && name) state.deviceNames[id] = name;
        });
      } else if (parsed && typeof parsed === "object") {
        Object.entries(parsed).forEach(([id, name]) => {
          if (id && name != null) state.deviceNames[String(id)] = String(name);
        });
      }
    } catch (err) {
      console.warn("station_map/device_map parse failed:", err);
    }
  }

  function setTitle(title) {
    if (!title) return;
    $("stationName").textContent = String(title);
  }

  function currentDevice() {
    const devices = detectWeatherDevices();
    if (!state.selectedDevice || !devices.some((dev) => dev.id === state.selectedDevice)) state.selectedDevice = devices[0]?.id || "default";
    return devices.find((dev) => dev.id === state.selectedDevice) || devices[0] || { id: "default", name: "Μετεωρολογικός Σταθμός" };
  }

  function detectWeatherDevices() {
    const ids = new Set(Object.keys(state.weatherDevices));
    Object.entries(state.latestByDevice).forEach(([deviceId, latest]) => {
      if (Object.keys(latest).some((key) => weatherKeys.has(key))) ids.add(deviceId);
    });
    if (!ids.size) ids.add("default");
    return Array.from(ids).map((id, idx) => ({ id, name: state.deviceNames[id] || state.weatherDevices[id]?.name || `Σταθμός ${idx + 1}` }));
  }

  function getLatest(deviceId, names) {
    const deviceLatest = state.latestByDevice[deviceId] || {};
    for (const name of names) {
      if (deviceLatest[name]) return deviceLatest[name];
      if (state.latest[name]) return state.latest[name];
    }
    return null;
  }

  function pushHistory(records) {
    const row = {};
    records.forEach((record) => { row[record.variable] = record; });
    row.time = records.map((r) => r.time).find(Boolean) || new Date().toISOString();
    state.history.unshift(row);
    state.history = state.history.slice(0, rangeOptions[state.range]?.maxRows || 420);
  }

  function render() {
    const device = currentDevice();
    renderNav();
    renderSummary(device);
    renderMetrics(device);
    renderCharts(device);
    renderHistory();
    renderMeasurements();
    $("dashboardTitle").textContent = state.deviceNames[device.id] || device.name || "Μετεωρολογικός Σταθμός";
    $("lastUpdate").textContent = state.lastPayloadAt ? `Τελευταία ανανέωση ${state.lastPayloadAt.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}` : "Αναμονή live δεδομένων";
  }

  function renderNav() {
    const nav = $("stationNav");
    if (!nav) return; // sidebar removed from the UI
    const devices = detectWeatherDevices();
    nav.innerHTML = devices.map((dev) => `<button class="side-item ${dev.id === state.selectedDevice ? "active" : ""}" data-device="${esc(dev.id)}" type="button">${esc(dev.name)}</button>`).join("");
  }

  function renderSummary(device) {
    const temp = getDisplayMetric(device.id, defByKey("air_temperature"));
    const humidity = getDisplayMetric(device.id, defByKey("air_humidity"));
    const wind = getDisplayMetric(device.id, defByKey("wind_speed_kmh"));
    const dailyRain = getDisplayMetric(device.id, defByKey("rain_day"));
    const rainRate = getDisplayMetric(device.id, defByKey("rain_rate"));
    const monthlyRain = getDisplayMetric(device.id, defByKey("rain_month"));
    const staleCount = metricDefinitions.filter((def) => {
      const rec = getDisplayMetric(device.id, def);
      return !rec || isStale(rec.time, 6);
    }).length;
    const statusClass = staleCount > 3 ? "warn" : "ok";
    const weather = weatherLabel(temp?.value, humidity?.value, wind?.value, rainRate?.value);
    const rainText = (rec) => rec && rec.value != null ? `${rec.prefix || ""}${fmt(rec.value, 2)} mm` : "—";
    const raining = Number(rainRate?.value) > 0;
    const rainTag = rainRate?.value == null ? ["warn", "Άγνωστη"] : raining ? ["ok", "Ενεργή"] : ["warn", "Χωρίς βροχή"];
    const rainSummary = rainRate && rainRate.value == null && !dailyRain?.value
      ? esc(rainRate.foot)
      : `${raining ? `Βρέχει: ${fmt(rainRate.value, 1)} mm/ώρα. ` : ""}${rainText(dailyRain)} σήμερα, ${rainText(monthlyRain)} τον μήνα.`;
    $("summaryGrid").innerHTML = [
      `<div class="mini-card"><h3>Τρέχουσα Κατάσταση <span class="tag ${statusClass}">${staleCount > 3 ? "Έλεγχος" : "Ενεργός"}</span></h3><div class="weather-inline"><div class="icon">${weather.icon}</div><div><strong>${weather.text}</strong><span>${state.lastPayloadAt ? `Τελευταία ανανέωση: ${formatTime(state.lastPayloadAt)}` : "Αναμονή δεδομένων"}</span></div></div></div>`,
      `<div class="mini-card"><h3>Ποιότητα Δεδομένων <span class="tag ${statusClass}">${staleCount > 3 ? "Μερική" : "Ομαλή"}</span></h3><p>${staleCount ? `${staleCount} βασικές μετρήσεις χρειάζονται έλεγχο χρόνου ή mapping.` : "Οι βασικές μετρήσεις θερμοκρασίας, υγρασίας, πίεσης και ανέμου ενημερώνονται κανονικά."}</p></div>`,
      `<div class="mini-card"><h3>Βροχόπτωση <span class="tag ${rainTag[0]}">${rainTag[1]}</span></h3><p>${rainSummary}</p></div>`,
      `<div class="mini-card"><h3>Λειτουργία Σταθμού</h3><p>Συσκευή: ${esc(device.name)}. Άνεμος ${fmt(wind?.value, 2)} km/h, υγρασία ${fmt(humidity?.value, 0)}%.</p></div>`,
    ].join("");
  }

  function renderMetrics(device) {
    $("metricGrid").innerHTML = metricDefinitions.map((def) => {
      const rec = getDisplayMetric(device.id, def);
      const unit = def.unit || units[def.key] || rec?.unit || "";
      const hasValue = rec && (!def.rain || rec.value != null);
      const value = hasValue ? `${rec.prefix || ""}${fmt(rec.value, def.digits)}${unit ? ` ${unit}` : ""}` : (def.rain ? "—" : fmt(rec?.value, def.digits));
      const foot = def.rain ? (rec?.foot || "") : (rec ? def.foot : "Δεν υπάρχει διαθέσιμη τιμή");
      return `<article class="metric-card ${def.accent}">
        <div class="metric-top">${rec?.time ? esc(relativeTime(rec.time)) : "Έλεγχος δεδομένου"}</div>
        <div><div class="metric-value">${esc(value)}</div><div class="metric-label">${esc(def.label)}</div></div>
        <div class="metric-foot">${esc(foot)}</div>
      </article>`;
    }).join("");
  }

  function renderCharts(device) {
    const rangeLabel = rangeOptions[state.range]?.label || "24 ώρες";
    state.chartCache = chartDefinitions.map((def, index) => ({ def, points: def.rain ? rainSeries(state.range) : seriesFor(device.id, def.names), index }));
    $("chartsGrid").innerHTML = state.chartCache.map(({ def, points, index }) => {
      const title = `${def.title} · ${rangeLabel}`;
      return def.type === "bar"
        ? barChart(title, points, def.unit, def.color, def.digits, index)
        : lineChart(title, points, def.color, def.unit, def.digits, index);
    }).join("");
  }

  function renderHistory() {
    const sorted = [...state.history].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const rows = sorted.slice(0, 12).map((row) => {
      const val = (names, digits, unit) => {
        const rec = names.map((name) => row[name]).find(Boolean);
        return rec ? `${fmt(rec.value, digits)} ${unit}` : "—";
      };
      return `<tr><td>${esc(formatTime(row.time))}</td><td>${val(["air_temperature", "temperature"], 1, "°C")}</td><td>${val(["air_humidity", "humidity"], 0, "%")}</td><td>${val(["barometric_pressure_hpa", "pressure"], 1, "hPa")}</td><td>${val(["wind_speed_kmh"], 2, "km/h")}</td><td>${val(["wind_direction_sensor", "wind_direction", "wind_dir"], 0, "°")}</td><td>${val(["uv_index"], 0, "")}</td><td>${val(["light_intensity", "lux", "illuminance", "solar_radiation_lux"], 0, "lux")}</td><td>${rainForRow(row)}</td><td>Έγκυρο</td></tr>`;
    });
    $("historyRows").innerHTML = rows.length ? rows.join("") : `<tr><td colspan="10" class="empty">Δεν υπάρχουν ιστορικά δεδομένα ακόμα.</td></tr>`;
  }

  // Βροχή της γραμμής από τον μετρητή: γραμμές ιστορικού = το διάστημά τους· ζωντανές = τα 5΄ ως τη χρονική τους στιγμή.
  function rainForRow(row) {
    const t = new Date(row.time).getTime();
    if (!Number.isFinite(t) || !state.acc.length) return "—";
    const [s, e] = row.slotMs ? [t, t + row.slotMs] : [t - 5 * 60000, t];
    const bucket = rainBuckets(state.acc, [s], e)[0];
    return bucket && bucket.value != null ? `${fmt(bucket.value, 1)} mm` : "—";
  }

  function renderMeasurements() {
    const keys = Object.keys(state.latest).filter((key) => labels[key]).sort((a, b) => (labels[a] || a).localeCompare(labels[b] || b, "el"));
    $("measurementList").innerHTML = keys.length ? keys.map((key) => {
      const rec = state.latest[key];
      return `<div class="measurement-item"><span>${esc(labels[key] || key)}</span><strong>${esc(fmt(rec.value, 2))} ${esc(units[key] || rec.unit || "")}</strong></div>`;
    }).join("") : `<div class="empty">Δεν έχουν ληφθεί δεδομένα ακόμα.</div>`;
  }

  function getMetric(deviceId, def) { return getLatest(deviceId, def.aliases); }

  function getDisplayMetric(deviceId, def) {
    if (def.rain) return rainMetric(def.rain);
    return getMetric(deviceId, def);
  }

  // Προσθέτει τιμές του μετρητή βροχής (ιστορικό ή ζωντανές) στη σειρά του επιλεγμένου σταθμού.
  function addAccPoints(records) {
    let added = 0;
    records.forEach((rec) => {
      if (rec.device && state.selectedDevice && state.selectedDevice !== "default" && rec.device !== state.selectedDevice) return;
      const t = new Date(rec.time).getTime(), v = Number(rec.value);
      if (!Number.isFinite(t) || !Number.isFinite(v)) return;
      state.acc.push({ t, v });
      added += 1;
    });
    if (!added) return;
    state.acc.sort((a, b) => a.t - b.t);
    state.acc = state.acc.filter((p, i, arr) => i === 0 || p.t !== arr[i - 1].t);     // ίδιο uplink δύο φορές
  }

  // Κάρτα βροχής: { value, time, unit, prefix, foot }· value null → «—».
  function rainMetric(unit) {
    const now = Date.now();
    const def = metricDefinitions.find((d) => d.rain === unit);
    if (!state.accLoaded && !state.acc.length) return { value: null, time: null, unit: def.unit, foot: state.accLoading ? "Φόρτωση μετρητή βροχής…" : "Αναμονή δεδομένων μετρητή" };
    const S = rainPeriodStart(unit, now);
    const res = rainWindow(state.acc, S, now, unit === "hour" ? RAIN_LEAD_HOUR_MIN : RAIN_LEAD_MIN, now);
    const time = res.lastT ? new Date(res.lastT).toISOString() : null;
    if (!res.known) {
      const foot = res.why === "nocounter" ? "Ο σταθμός δεν στέλνει μετρητή βροχής (χρειάζεται αναβάθμιση)"
        : res.why === "silent" ? `Ο σταθμός δεν στέλνει από ${formatTime(time)}`
        : res.why === "impossible" ? "Μη αξιόπιστη τιμή μετρητή"
        : "Δεν υπάρχουν μετρήσεις στο διάστημα";
      return { value: null, time, unit: def.unit, foot };
    }
    const since = unit === "hour" ? "Μέση της τελευταίας ώρας"
      : unit === "day" ? "Από τις 00:00 σήμερα"
      : unit === "week" ? `Από τη Δευτέρα ${shortDate(S)}`
      : `Από ${shortDate(S)}`;
    return {
      value: res.mm, time, unit: def.unit, prefix: res.partial ? "≥ " : "",
      foot: res.partial ? `${since} · λείπουν μετρήσεις στην αρχή` : `${since} · μετρητής σταθμού`,
    };
  }

  function rainSeries(range) {
    const now = Date.now();
    if (range === "24h") {
      const hourNow = Math.floor(now / 3600000) * 3600000;
      const starts = Array.from({ length: 24 }, (_, i) => hourNow - (23 - i) * 3600000);
      return rainBuckets(state.acc, starts, now);
    }
    return rainBuckets(state.acc, rainDayStarts(now, range === "7d" ? 7 : 30), now);
  }

  function shortDate(ms) {
    return new Date(ms).toLocaleDateString("el-GR", { timeZone: RAIN_TZ, day: "numeric", month: "numeric" });
  }

  function seriesFor(deviceId, names) {
    return seriesForRange(deviceId, names, state.range);
  }

  function seriesForRange(deviceId, names, range) {
    const rows = [];
    historyRowsForRange(range).forEach((row) => {
      const rec = names.map((name) => row[name]).find(Boolean);
      if (rec && (!deviceId || deviceId === "default" || !rec.device || rec.device === deviceId) && Number.isFinite(Number(rec.value))) rows.push({ time: row.time, value: Number(rec.value) });
    });
    return rows.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  function historyRowsForRange(range) {
    const options = rangeOptions[range] || rangeOptions["24h"];
    const start = Date.now() - options.hours * 60 * 60 * 1000;
    return state.history.filter((row) => {
      const t = new Date(row.time).getTime();
      return Number.isFinite(t) && t >= start;
    });
  }

  function lineChart(title, points, color, unit, digits = 1, index = 0) {
    const vals = points.map((p) => p.value);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const span = max - min || 1;
    const poly = vals.map((v, idx) => {
      const x = vals.length > 1 ? (idx / (vals.length - 1)) * 320 : 160;
      const y = 130 - ((v - min) / span) * 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const last = vals.length ? `${fmt(vals[vals.length - 1], digits)} ${unit}` : "—";
    return `<button class="chart-box" data-chart="${esc(title)}" data-chart-index="${index}" type="button"><h3>${esc(title)} · ${esc(last)}</h3><div class="linebox"><svg class="svgline" viewBox="0 0 320 150" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="4" points="${poly || "0,130 320,130"}"/></svg></div><div class="chart-foot">${points.length ? `${points.length} σημεία` : "Δεν υπάρχουν ιστορικά σημεία για αυτό το διάστημα"}</div></button>`;
  }

  // Μπάρες βροχής: μία ανά ώρα (24 ώρες) ή ανά ημέρα (7 / 30 ημέρες)· διάστημα χωρίς μετρήσεις → γκρι, «—».
  function barChart(title, points, unit, color = "#4f8fd8", digits = 1, index = 0) {
    const known = points.filter((p) => p.value != null);
    const max = known.length ? Math.max(...known.map((p) => p.value), 1) : 1;
    const total = known.reduce((sum, p) => sum + p.value, 0);
    const bars = points.map((p, idx) => {
      const tip = `${shortTime(p.time)} · ${p.value == null ? "χωρίς μετρήσεις" : `${fmt(p.value, digits)} ${unit}`}`;
      const style = p.value == null ? "height:4%;background:#d9dee3" : `height:${Math.max(4, (p.value / max) * 100)}%;background:${color}`;
      return `<div class="bar" style="${style}" title="${esc(tip)}"><span>${idx + 1}</span></div>`;
    }).join("");
    const head = known.length ? `Σύνολο ${fmt(total, digits)} ${unit}${known.length < points.length ? " (με κενά)" : ""}` : "—";
    const foot = !points.length ? "Δεν υπάρχουν μετρήσεις μετρητή βροχής" : state.range === "24h" ? "Ανά ώρα · μετρητής σταθμού" : "Ανά ημέρα · μετρητής σταθμού";
    return `<button class="chart-box" data-chart="${esc(title)}" data-chart-index="${index}" type="button"><h3>${esc(title)} · ${esc(head)}</h3><div class="bars">${bars}</div><div class="chart-foot">${esc(foot)}</div></button>`;
  }

  function openChartModal(index) {
    const model = state.chartCache[Number(index)];
    if (!model) return;
    state.activeChartIndex = Number(index);
    $("chartModal").classList.add("open");
    renderChartModal(null);
  }

  function renderChartModal(selectedIndex) {
    const model = state.chartCache[state.activeChartIndex];
    if (!model) return;
    const { def } = model;
    const points = modalPoints(model);
    const rangeLabel = rangeOptions[state.range]?.label || "24 ώρες";
    $("chartModalTitle").textContent = `${def.title} · ${rangeLabel}`;
    $("chartModalMeta").textContent = `Μονάδα: ${def.unit || "χωρίς μονάδα"} · σημεία: ${points.length}`;
    $("chartModalBody").innerHTML = expandedChart(def, points, selectedIndex);
  }

  // Στη μεγέθυνση δεν σχεδιάζονται διαστήματα χωρίς μετρήσεις (θα έμοιαζαν με «0 mm»).
  function modalPoints(model) { return model.points.filter((p) => p.value != null); }

  function expandedChart(def, points, selectedIndex) {
    const width = 960;
    const height = 360;
    const plot = { left: 60, top: 24, right: 22, bottom: 48 };
    const plotW = width - plot.left - plot.right;
    const plotH = height - plot.top - plot.bottom;
    const vals = points.map((p) => p.value);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const span = max - min || 1;
    const coords = vals.map((v, idx) => {
      const x = plot.left + (vals.length > 1 ? (idx / (vals.length - 1)) * plotW : plotW / 2);
      const y = plot.top + plotH - ((v - min) / span) * plotH;
      return { x, y, value: v, point: points[idx], idx };
    });
    const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const yGrid = Array.from({ length: 5 }, (_, idx) => {
      const y = plot.top + (idx / 4) * plotH;
      const value = max - (idx / 4) * span;
      return `<line x1="${plot.left}" y1="${y}" x2="${width - plot.right}" y2="${y}" class="grid-line"/><text x="12" y="${y + 4}" class="axis-label">${esc(fmt(value, def.digits))}</text>`;
    }).join("");
    const xGrid = Array.from({ length: 7 }, (_, idx) => {
      const x = plot.left + (idx / 6) * plotW;
      const pointIdx = coords.length > 1 ? Math.round((idx / 6) * (coords.length - 1)) : 0;
      const label = coords[pointIdx]?.point?.time ? shortTime(coords[pointIdx].point.time) : "";
      return `<line x1="${x}" y1="${plot.top}" x2="${x}" y2="${height - plot.bottom}" class="grid-line"/><text x="${x}" y="${height - 18}" class="axis-label axis-x">${esc(label)}</text>`;
    }).join("");
    const selected = Number.isInteger(selectedIndex) ? coords[selectedIndex] : null;
    const readout = selected
      ? `${formatTime(selected.point.time)} · ${fmt(selected.value, def.digits)} ${def.unit || ""}`
      : "Πατήστε πάνω στο διάγραμμα για ένδειξη τιμής και χρόνου.";
    const pointer = selected
      ? `<line x1="${selected.x}" y1="${plot.top}" x2="${selected.x}" y2="${height - plot.bottom}" class="pointer-line"/><circle cx="${selected.x}" cy="${selected.y}" r="6" class="pointer-dot"/><text x="${Math.min(selected.x + 10, width - 240)}" y="${Math.max(selected.y - 10, 22)}" class="pointer-label">${esc(fmt(selected.value, def.digits))} ${esc(def.unit || "")}</text>`
      : "";
    return `<div class="chart-readout">${esc(readout)}</div><svg class="expanded-chart-svg" data-expanded-chart="1" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"/>
      ${yGrid}${xGrid}
      <line x1="${plot.left}" y1="${height - plot.bottom}" x2="${width - plot.right}" y2="${height - plot.bottom}" class="axis-line"/>
      <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${height - plot.bottom}" class="axis-line"/>
      <polyline fill="none" stroke="${def.color}" stroke-width="4" points="${line || `${plot.left},${height - plot.bottom} ${width - plot.right},${height - plot.bottom}`}"/>
      ${pointer}
    </svg>`;
  }

  function shortTime(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "";
    return state.range === "24h"
      ? d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
  }

  function selectExpandedPoint(event) {
    if (state.activeChartIndex == null) return;
    const model = state.chartCache[state.activeChartIndex];
    const points = model ? modalPoints(model) : [];
    if (!points.length) return;
    const svg = event.target.closest("[data-expanded-chart]");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (points.length - 1));
    renderChartModal(idx);
  }

  function weatherLabel(temp, humidity, wind, rain) {
    if (Number(rain) > 0) return { icon: "🌧", text: "Βροχή" };
    if (Number(wind) > 25) return { icon: "🌬", text: "Άνεμος" };
    if (Number(temp) > 28 && Number(humidity) < 60) return { icon: "☀️", text: "Καθαρός" };
    return { icon: "⛅", text: "Ήπιος καιρός" };
  }

  function isStale(time, hours) {
    if (!time) return true;
    const ts = new Date(time).getTime();
    return !Number.isFinite(ts) || Date.now() - ts > hours * 60 * 60 * 1000;
  }

  function relativeTime(time) {
    if (!time) return "Δεν υπάρχει χρόνος";
    const diff = Date.now() - new Date(time).getTime();
    if (!Number.isFinite(diff)) return String(time);
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "Λίγα δευτερόλεπτα πριν";
    if (minutes < 60) return `${minutes} λεπτά πριν`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} ώρες πριν`;
    return `${Math.round(hours / 24)} μέρες πριν`;
  }

  function formatTime(value) {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });
  }

  function bindUi() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-device]");
      if (nav && nav.classList.contains("side-item")) {
        state.selectedDevice = nav.dataset.device;
        render();
        return;
      }
      const range = event.target.closest("[data-range]");
      if (range) {
        document.querySelectorAll("[data-range]").forEach((el) => el.classList.remove("active"));
        range.classList.add("active");
        refetchHistoryForRange(range.dataset.range);
        return;
      }
      const chart = event.target.closest("[data-chart]");
      if (chart) {
        document.querySelectorAll("[data-chart]").forEach((el) => el.classList.remove("active"));
        chart.classList.add("active");
        openChartModal(chart.dataset.chartIndex);
        return;
      }
      const expandedChart = event.target.closest("[data-expanded-chart]");
      if (expandedChart) {
        selectExpandedPoint(event);
        return;
      }
      const scroll = event.target.closest("[data-scroll]");
      if (scroll) {
        document.querySelectorAll("[data-scroll]").forEach((el) => el.classList.remove("active"));
        scroll.classList.add("active");
        $(scroll.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    });
    $("refreshBtn").addEventListener("click", () => { state.historyLoaded = false; state.accLoaded = false; render(); maybeLoadHistory(); });
    $("openAllMeasurements").addEventListener("click", () => $("measurementsModal").classList.add("open"));
    document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", () => {
      $(btn.dataset.closeModal).classList.remove("open");
      if (btn.dataset.closeModal === "chartModal") state.activeChartIndex = null;
    }));
    document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) modal.classList.remove("open"); }));
  }

  // ── Historical data fetch ────────────────────────────────────────────────────

  function maybeLoadHistory() {
    const token = state.deviceToken || state.apiToken;
    if (state.historyLoaded || !token) return;
    const deviceId = state.selectedDevice || Object.keys(state.weatherDevices)[0];
    if (!deviceId || deviceId === "default") { console.warn("[SAG history] no device ID"); return; }
    state.historyLoaded = true;
    fetchHistory(state.range, deviceId).catch((err) => {
      console.warn("[SAG history] fetch failed:", err);
      state.historyLoaded = false;
    });
    if (!state.accLoaded && !state.accLoading) fetchCounter(deviceId);
  }

  // Ιστορικό του μετρητή βροχής: από την αρχή του μήνα / της εβδομάδας / των 30 ημερών (ό,τι είναι παλαιότερο),
  // μαζί με το περιθώριο πριν την αρχή. ~9.000 σημεία στα 5΄· αν κοπεί στις 10.000, η αρχή βγαίνει «≥» (μερική).
  async function fetchCounter(deviceId) {
    const token = state.deviceToken || state.apiToken;
    if (!token) return;
    const now = Date.now();
    const start = Math.min(rainPeriodStart("month", now), rainPeriodStart("week", now), rainDayStarts(now, 30)[0]) - RAIN_LEAD_MIN * 60000;
    const url = API_HOST + "/data?variable[]=rain_height_acc"
      + "&start_date=" + encodeURIComponent(new Date(start).toISOString())
      + "&end_date=" + encodeURIComponent(new Date(now).toISOString())
      + "&qty=10000";
    state.accLoading = true;
    render();
    try {
      const res = await fetch(url, { headers: { "Authorization": token } });
      if (!res.ok) { console.warn("[SAG rain] status", res.status, await res.text()); return; }
      const json = await res.json();
      const records = (json.result || []).map(normalizeRecord).filter(Boolean)
        .filter((rec) => !rec.device || rec.device === deviceId);
      addAccPoints(records);
      state.accLoaded = true;
      console.log("[SAG rain] counter points:", records.length, records.length >= 10000 ? "(κομμένο: η αρχή θα φαίνεται μερική)" : "");
    } catch (err) {
      console.warn("[SAG rain] fetch error", err);
    } finally {
      state.accLoading = false;
      render();
    }
  }

  function refetchHistoryForRange(range) {
    state.range = range;
    state.historyLoaded = false;
    maybeLoadHistory();
    renderCharts(currentDevice());
  }

  async function fetchHistory(range, deviceId) {
    const now = new Date();
    const options = rangeOptions[range] || rangeOptions["24h"];
    const startDate = new Date(now.getTime() - options.hours * 60 * 60 * 1000);

    const token = state.deviceToken || state.apiToken;
    if (!token) { console.warn("[SAG history] no device token"); return; }

    // 24h  → raw 5-min data (native cadence, nothing to gain from aggregating)
    // 7d   → server-side hourly aggregate (bucketMs 1h → 1 point per bucket)
    // 30d  → server-side hourly aggregate, bucketed down to 6h client-side (bucketMs 6h)
    const useAggregate = range !== "24h";
    console.log("[SAG history] device:", deviceId, "range:", range, "aggregate:", useAggregate);

    const buildUrl = (vars, fn) => {
      let url = API_HOST + "/data?" + vars.map((v) => "variable[]=" + encodeURIComponent(v)).join("&")
        + "&start_date=" + encodeURIComponent(startDate.toISOString())
        + "&end_date=" + encodeURIComponent(now.toISOString())
        + "&qty=10000";
      if (fn) url += "&query=aggregate&function=" + fn + "&interval=hour";
      return url;
    };

    // Aggregate: one request PER variable so Tago computes the series concurrently
    // (fired together via Promise.all) instead of crunching all of them in one call.
    // Raw 24h stays a single combined request — it's one fast query, nothing to gain.
    const requests = [];
    if (useAggregate) {
      AGG_AVG_VARS.forEach((v) => requests.push({ vars: [v], fn: "avg" }));
      AGG_SUM_VARS.forEach((v) => requests.push({ vars: [v], fn: "sum" }));
    } else {
      requests.push({ vars: [...AGG_AVG_VARS, ...AGG_SUM_VARS], fn: null });
    }

    const allRecords = [];
    await Promise.all(requests.map(async ({ vars, fn }) => {
      if (!vars.length) return;
      try {
        const res = await fetch(buildUrl(vars, fn), { headers: { "Authorization": token } });
        if (!res.ok) { console.warn("[SAG history]", fn || "raw", "status", res.status, await res.text()); return; }
        const json = await res.json();
        (json.result || []).forEach((raw) => {
          const rec = normalizeRecord(raw);
          if (rec) allRecords.push(rec);
        });
      } catch (err) { console.warn("[SAG history] fetch error", fn || "raw", err); }
    }));

    console.log("[SAG history] records fetched:", allRecords.length);
    const validRecords = allRecords.filter((r) => r.time && Number.isFinite(Number(r.value)));
    if (!validRecords.length) { console.warn("[SAG history] no valid records"); return; }

    // Group into the range's interval. Signals → mean of the bucket; rainfall → sum.
    const slots = new Map();
    validRecords.forEach((rec) => {
      const t = new Date(rec.time).getTime();
      if (!Number.isFinite(t)) return;
      const slot = Math.floor(t / options.bucketMs) * options.bucketMs;
      let entry = slots.get(slot);
      if (!entry) { entry = { time: new Date(slot).toISOString(), vals: {} }; slots.set(slot, entry); }
      const acc = entry.vals[rec.variable] || (entry.vals[rec.variable] = { sum: 0, count: 0, sumMode: SUM_SET.has(rec.variable), unit: rec.unit, device: rec.device });
      acc.sum += Number(rec.value);
      acc.count += 1;
      if (rec.unit != null) acc.unit = rec.unit;
      if (rec.device != null) acc.device = rec.device;
    });

    const fetchedRows = Array.from(slots.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, entry]) => {
        const row = { time: entry.time, slotMs: options.bucketMs };
        Object.entries(entry.vals).forEach(([variable, acc]) => {
          const value = acc.sumMode ? acc.sum : acc.sum / acc.count;
          row[variable] = { variable, value, unit: acc.unit, time: entry.time, device: acc.device };
        });
        return row;
      });

    // Preserve the handful of realtime points newer than the fetched window, then cap.
    const realtimeOnly = state.history.filter((row) => new Date(row.time).getTime() > now.getTime() - 300000);
    state.history = [...fetchedRows, ...realtimeOnly].slice(-options.maxRows);

    // Only refresh "latest" from raw data — never overwrite live values with averages.
    if (!useAggregate) {
      validRecords.forEach((rec) => {
        const existing = state.latest[rec.variable];
        if (!existing || new Date(rec.time).getTime() > new Date(existing.time || 0).getTime()) {
          state.latest[rec.variable] = rec;
          if (rec.device) {
            state.latestByDevice[rec.device] = state.latestByDevice[rec.device] || {};
            state.latestByDevice[rec.device][rec.variable] = rec;
          }
        }
      });
    }

    console.log("[SAG history] done — rows:", state.history.length);
    render();
  }

  function bootTago() {
    const tago = window.TagoIO;
    if (!tago) {
      $("connectionState").textContent = "Preview mode";
      seedPreview();
      return;
    }
    $("connectionState").textContent = "Σύνδεση Tago";
    try {
      if (typeof tago.onStart === "function") tago.onStart((payload) => {
        $("connectionState").textContent = "Live";
        absorbPayload(payload);
      });
      if (typeof tago.onRealtime === "function") tago.onRealtime((payload) => {
        $("connectionState").textContent = "Live";
        absorbPayload(payload);
      });
      if (typeof tago.ready === "function") tago.ready();
      setTimeout(() => {
        if (!state.lastPayloadAt) $("connectionState").textContent = "Αναμονή δεδομένων";
      }, 2500);
    } catch (err) {
      console.error("Tago boot failed", err);
      $("connectionState").textContent = "Σφάλμα Tago";
    }
  }

  function seedPreview() {
    const now = new Date();
    const sampleRows = [];
    for (let i = 0; i < 8; i += 1) {
      const t = new Date(now.getTime() - i * 10 * 60 * 1000).toISOString();
      sampleRows.push([
        { variable: "air_temperature", value: 20.8 - i * 0.2, unit: "°C", device: "weather-galyfa", time: t },
        { variable: "air_humidity", value: 52 + i, unit: "%", device: "weather-galyfa", time: t },
        { variable: "barometric_pressure_hpa", value: 1008.3 - i * 0.1, unit: "hPa", device: "weather-galyfa", time: t },
        { variable: "wind_speed_kmh", value: 5.76 - i * 0.2, unit: "km/h", device: "weather-galyfa", time: t },
        { variable: "wind_direction_sensor", value: 36 - i, unit: "°", device: "weather-galyfa", time: t },
        { variable: "uv_index", value: i < 4 ? 1 : 0, device: "weather-galyfa", time: t },
        { variable: "light_intensity", value: 10887 - i * 380, unit: "lux", device: "weather-galyfa", time: t },
        { variable: "rain_height_acc", value: 412.75 - (i < 3 ? 0 : 0.762), unit: "mm", device: "weather-galyfa", time: t },
      ]);
    }
    sampleRows.reverse().forEach(absorbPayload);
    state.deviceNames["weather-galyfa"] = "ΓΑΛΥΦΑ";
    state.weatherDevices["weather-galyfa"] = { id: "weather-galyfa", name: "ΓΑΛΥΦΑ" };
    state.selectedDevice = "weather-galyfa";
    render();
  }

  bindUi();
  render();
  // Ξανασχεδίαση ανά λεπτό: αλλαγή ημέρας στις 00:00 και «σιωπηλός σταθμός» χωρίς να χρειάζεται νέο uplink.
  setInterval(() => { if (!document.hidden) render(); }, 60000);
  if (document.readyState === "complete") bootTago();
  else window.addEventListener("load", bootTago);
})();