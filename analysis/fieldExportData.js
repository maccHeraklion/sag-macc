/*
** Field Export Data (MACC)
** ------------------------------------------------------------------
** Exports raw sensor data for ONE field (virtual "Field_*" device) to CSV and
** emails it. Triggered by a Form / Input widget submit button.
**
** TagoIO analysis 6a884b5ce36742000c656d04. Shared by every "Εξαγωγή δεδομένων"
** dashboard (ΙΔΕ, Μαρία Σκουλά, ΕΠΑΛ Πλατανιά, ΚΑΜΠΑΝΗΣ, CSS Boost P1 VC2).
**
** Derived from "Clients Export Data (Legacy).js" - keeps the same proven
** features (size-based multi-part splitting, optional EUI header row,
** timestamp|value column pairing) but resolves devices the MACC way:
**
**   Legacy  : device list filtered by a client tag, per-device `device_type` tag.
**   MACC    : one virtual Field device (tag clientId_field=<client>) whose
**             `devices` tag holds {"<sensor key>": "<device id>", ...}.
**             The sensor's own `type` tag decides which variables to pull.
**
** ---- Form / Input widget fields (scope) --------------------------------
**   time_period    (Time Period)  -> metadata.start_date / metadata.end_date
**   location       (Dropdown)     -> Field device ID, or the field's name.
**                                    Populate from devices tagged
**                                    clientId_field=<CLIENT_ID_FIELD>.
**   email          (Text)         -> recipient
**   hide_eui       (optional)     -> present = omit the EUI header row
**   pair_columns   (optional)     -> "true" = Timestamp|Value pairs per variable
**   include_diseases (optional)   -> "yes"/"true" = append the disease record
**                                    (T-EXPORT-DISEASE-01, see below)
**   (Capture user) (optional)     -> its metadata.session_id, when present, scopes
**                                    the progress messages to that one user
**
** ---- CSV layout --------------------------------------------------------
** One block of columns per sensor, each with its own Timestamp column. A
** sensor whose extra variables run on a different clock (rain aggregates,
** derived indices) gets an additional block per cadence - see
** EXTRA_BLOCK_GROUPS for why.
**
** ---- Time reference (T-EXPORT-UTC-01, 27/11/2026) -----------------------
** Every timestamp is UTC, ISO 8601 («2026-10-25T00:30:00Z»). The default layout
** adds a second column with the same instant in Greek time WITH its offset
** («2026-10-25 03:30 +03:00»). Pair mode carries UTC only. Daily disease risk is
** grouped by UTC day. File names / subjects use UTC dates. Before this change the
** export wrote Greek local time without an offset (changelog SC-0002).
** Every email carries a description: time reference, the variables in the file
** (from html_files/sag-data-dictionary.json), known issues and the latest system
** changes (html_files/sag-changelog.json), with a link to the full change log.
**
** ---- Disease record (T-EXPORT-DISEASE-01, 22/11/2026) -------------------
** Only when the form sends include_diseases. Two more column blocks, read
** from the Field device itself:
**   1. «Ασθένειες - Ημερήσιος κίνδυνος»: one row per day x crop x pathogen
**      whose risk reached «Μέτριος» or higher, decoded from the hourly
**      `field_bundle` records runPerTich writes (the same fir_message_<key>
**      card the farmer sees). Max level, hours at Υψηλός/Σοβαρός, and the
**      card text at the peak.
**   2. «Ασθένειες - Δηλώσεις»: the farmer's own entries from the pathogen
**      cards - spray_declaration, inspection_declaration, declaration_undo.
** A block with nothing to report carries one explanatory row instead of
** silently vanishing. Without include_diseases nothing here runs.
**
** ---- Progress feedback -------------------------------------------------
** Add a Validation field to the form bound to the variable `validationExport`
** on the form's data-source device (DEFAULT_FORM_DEVICE_ID). The analysis
** reports every stage there, so the button click is never silent:
**
**   info    "Εξαγωγή δεδομένων..."          immediately on trigger
**   info    "Ανάκτηση μετρήσεων για ..."    once the field is resolved
**   info    "Αποστολή N αρχείων με email"   once the CSV is built
**   success "... στάλθηκε με email (N)"     delivered
**   warning no measurements in the period
**   danger  bad input, or the export failed
**
** Exactly one terminal message (success / warning / danger) is always sent -
** the whole body is wrapped so an unexpected throw cannot leave the widget
** stuck on "Εξαγωγή δεδομένων...".
**
** ---- Environment variables ---------------------------------------------
**   ACCOUNT_TOKEN                    (required) profile token
**   CLIENT_ID_FIELD                  (optional) default client for name lookups
**   CSV_LANGUAGE                     (optional) "el" (default) | "en"
**   EMAIL_FROM                       (optional) default reports@cyric-iot.eu
**   FORM_DEVICE_ID                   (optional) override the validation target;
**                                    otherwise the device the form posted to,
**                                    else DEFAULT_FORM_DEVICE_ID
**   USAGE_STATISTICS_DEVICE_TOKEN    (optional) legacy usage-stats bucket
*/

const { Analysis, Account, Resources, Utils, Services, Device } = require("@tago-io/sdk");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const zlib = require("zlib");

dayjs.extend(utc);
dayjs.extend(timezone);

// === Constants ============================================================
const TZ = "Europe/Athens";
const MAX_ATTACHMENT_BYTES = Math.floor(4.5 * 1024 * 1024); // margin under the 5MB cap
const BOM = String.fromCharCode(0xfeff); // UTF-8 BOM so Excel opens Greek headers correctly
const DEFAULT_CLIENT_ID_FIELD = "68472e1a987b43000ac6a71c"; // Ινστιτούτο Δασικών Ερευνών
const PAGE_SIZE = 10000;

// Mutable device backing the Input Form's data source ("Topalidou Export").
// The form's Validation field should point at VALIDATION_VARIABLE on this device.
const DEFAULT_FORM_DEVICE_ID = "6a884c6b89410e000bf5e7fd";
const VALIDATION_VARIABLE = "validationExport";
// T-EXPORT-BUDGET-01 (28/11/2026): φρουρός αναγνώσεων. Το όριο αναγνώσεων του λογαριασμού είναι κοινό για όλους τους πελάτες·
// μία εξαγωγή όλου του ιστορικού ενός σταθμού κοστίζει ~0,55 εκατ. αναγνώσεις (25/11 το όριο εξαντλήθηκε).
const EXPORT_LOG_VARIABLE = "export_log";
const FIELD_DAILY_READS = 1500000;   // ανά αγρό, κυλιόμενο 24ωρο (≈ 2–3 εξαγωγές όλου του ιστορικού ενός σταθμού)
const DUPLICATE_WINDOW_MIN = 60;     // η ίδια εξαγωγή μέσα σε 60΄ δεν ξανατρέχει
const READ_METER = { n: 0 };
function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
// Παράθυρα ≤ 28 ημερών (το query=count δέχεται έως 1 μήνα ανά ερώτημα), καθαρή αριθμητική UTC.
function monthWindows(startIso, endIso) {
  const out = []; let a = Date.parse(startIso); const end = Date.parse(endIso); const STEP = 28 * 864e5;
  if (!Number.isFinite(a) || !Number.isFinite(end)) return out;
  while (a < end && out.length < 60) { const b = Math.min(a + STEP, end); out.push([new Date(a).toISOString(), new Date(b).toISOString()]); a = b; }
  return out;
}
// Αμιγής απόφαση: logs = προηγούμενες εγγραφές export_log ({time, metadata}), key = hash αιτήματος, estimate = εκτίμηση αναγνώσεων.
function exportBudgetDecision(logs, nowMs, key, fieldId, estimate) {
  let used = 0, dupMin = null;
  for (const r of Array.isArray(logs) ? logs : []) {
    const m = (r && r.metadata) || {}; const ts = Date.parse((r && r.time) || m.ts); if (!Number.isFinite(ts)) continue;
    const age = nowMs - ts; if (age < 0) continue;
    if (m.field_id === fieldId && age < 864e5) used += Number(m.reads) || 0;
    if (m.key === key && m.status === "ok" && age < DUPLICATE_WINDOW_MIN * 6e4) { const mins = Math.max(1, Math.round(age / 6e4)); if (dupMin === null || mins < dupMin) dupMin = mins; }
  }
  if (dupMin !== null) return { action: "duplicate", minutes: dupMin, used };
  if (Number.isFinite(estimate) && used + estimate > FIELD_DAILY_READS) return { action: "budget", used, estimate };
  return { action: "go", used, estimate };
}

// T-EXPORT-UTC-01: χρόνος αναφοράς UTC + περιγραφή που συνοδεύει κάθε εξαγωγή. Τα δύο JSON είναι δημόσια αρχεία ΧΩΡΙΣ
// στοιχεία πελατών (changelog/ στο git). Μορφή αρχείου «UTC-1» = από 27/11/2026.
const EXPORT_FORMAT_VERSION = "UTC-2";   // UTC-2 (T-EXPORT-RAIN-01): στήλες μετρητή/έντασης βροχής, διάστημα/κάλυψη/ποιότητα ωριαίας βροχής
const FILES_BASE = "https://api.tago.io/file/67934c48e8e573000ae5964b/html_files/";
const CHANGELOG_PAGE = FILES_BASE + "sag-changelog.html";
function fmtUtc(t) { return dayjs(t).utc().format("YYYY-MM-DDTHH:mm:ss[Z]"); }
function fmtLocal(t) { return dayjs(t).tz(TZ).format("YYYY-MM-DD HH:mm Z"); }
async function fetchPublicJson(name) {
  try {
    const r = await fetch(FILES_BASE + name + "?t=" + Date.now());
    return r && r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}
/** Το κείμενο που συνοδεύει τα δεδομένα: χρόνος αναφοράς, μεταβλητές του αρχείου, γνωστά ζητήματα, τελευταίες αλλαγές. */
function describeExport(lang, vars, dict, log) {
  const L = [];
  if (lang === "en") {
    L.push("ABOUT THIS FILE (format " + EXPORT_FORMAT_VERSION + ")");
    L.push("Time reference: every timestamp in the \"UTC time\" columns is UTC (ISO 8601). The \"Greek time\" column shows the same instant in Greek local time with its offset (+02:00 winter, +03:00 summer).");
    L.push("Variable descriptions and the system change log: " + CHANGELOG_PAGE);
    return L.join("\n");
  }
  L.push("ΣΧΕΤΙΚΑ ΜΕ ΤΟ ΑΡΧΕΙΟ (μορφή " + EXPORT_FORMAT_VERSION + ")");
  L.push("");
  L.push("Χρόνος αναφοράς: κάθε χρονοσήμανση στις στήλες «Χρόνος UTC» είναι σε UTC (ISO 8601, π.χ. 2026-10-25T00:30:00Z). Η στήλη «Ώρα Ελλάδας» δείχνει την ίδια στιγμή σε ώρα Ελλάδας ΜΕ τη ζώνη της (+02:00 χειμώνα, +03:00 καλοκαίρι). Οι ημερήσιες τιμές κινδύνου ασθενειών αφορούν ημέρα UTC.");
  L.push("Εξαγωγές πριν από 27/11/2026 έγραφαν ώρα Ελλάδας χωρίς ζώνη (ημερολόγιο αλλαγών SC-0002, SC-0004).");
  const d = dict && dict.dictionary && dict.dictionary.variables;
  if (d) {
    L.push("");
    L.push("Μεταβλητές σε αυτό το αρχείο:");
    for (const v of vars) {
      const x = d[v];
      if (!x) { L.push("- " + v + ": χωρίς περιγραφή (" + CHANGELOG_PAGE + ")"); continue; }
      let line = "- " + x.label_el + (x.unit ? " (" + x.unit + ")" : "") + " [" + v + "]: " + x.meaning_el + " Συχνότητα: " + x.sampling_el + ".";
      if (x.aggregation_el) line += " Περίοδος: " + x.aggregation_el + ".";
      if (x.known_issue) line += " ⚠ Γνωστό ζήτημα: " + x.known_issue + ".";
      L.push(line);
    }
  } else {
    L.push("");
    L.push("Η περιγραφή των μεταβλητών δεν ήταν διαθέσιμη τη στιγμή της εξαγωγής· βρίσκεται στο " + CHANGELOG_PAGE);
    if (log) log("describeExport: data dictionary unavailable");
  }
  const E = dict && dict.changelog && Array.isArray(dict.changelog.entries) ? dict.changelog.entries : null;
  if (E && E.length) {
    L.push("");
    L.push("Τελευταίες αλλαγές συστήματος (" + E[E.length - 1].id + "):");
    for (const e of E.slice(-5).reverse()) L.push("- " + e.id + " · " + String(e.date_utc).slice(0, 10) + " · " + e.title_el);
  }
  L.push("");
  L.push("Πλήρες ημερολόγιο αλλαγών και περιγραφή δεδομένων: " + CHANGELOG_PAGE);
  return L.join("\n");
}

function bytesUTF8(str) {
  return Buffer.byteLength(str, "utf8");
}

/** Quote a CSV cell when it contains a comma, quote or newline. */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

/**
 * Split CSV rows into parts that each stay under MAX_ATTACHMENT_BYTES.
 * headerBlocks is repeated at the top of every part.
 * returns: [{ filenameSuffix: "part-1ofN", csvString }, ...]
 */
function splitCSVBySize(headerBlocks, dataRows) {
  const headerJoined = headerBlocks.join("\n") + "\n";
  const headerBytes = bytesUTF8(BOM + headerJoined);

  const parts = [];
  let partRows = [];
  let partBytes = headerBytes;

  if (dataRows.length === 0) {
    return [{ filenameSuffix: "part-1of1", csvString: BOM + headerJoined }];
  }

  for (const row of dataRows) {
    const rowBytes = bytesUTF8(row + "\n");

    if (partRows.length > 0 && partBytes + rowBytes > MAX_ATTACHMENT_BYTES) {
      parts.push({
        filenameSuffix: `part-${parts.length + 1}`,
        csvString: BOM + headerJoined + partRows.join("\n") + "\n",
      });
      partRows = [];
      partBytes = headerBytes;
    }

    partRows.push(row);
    partBytes += rowBytes;
  }

  if (partRows.length > 0) {
    parts.push({
      filenameSuffix: `part-${parts.length + 1}`,
      csvString: BOM + headerJoined + partRows.join("\n") + "\n",
    });
  }

  const total = parts.length;
  for (const p of parts) {
    const idx = p.filenameSuffix.split("-")[1];
    p.filenameSuffix = `part-${idx}of${total}`;
  }
  return parts;
}

// === Sensor catalogue =====================================================
// Sensor `type` tag -> variables to export.
// Keep in sync with createField.js / addSensorsToField.js / runPerTich.js.
const DEVICE_TYPE_VARIABLES = {
  // Only what the s2120 sends in one payload, so every row of this block is a
  // real reading. Rain aggregates and derived indices arrive on their own
  // clocks and live in EXTRA_BLOCK_GROUPS below.
  s2120: [
    "air_temperature",
    "air_humidity",
    "dew_point",
    "barometric_pressure_hpa",
    "wind_speed_kmh",
    "wind_direction_sensor",
    "uv_index",
    "light_intensity",
    "rain_height",
    // T-EXPORT-RAIN-01: σταθμοί με μετρητή (firmware 2.0) δεν γράφουν rain_height από 30/3/2026· γράφουν την ένταση ως
    // rain_gauge και τον αθροιστικό μετρητή ως rain_height_acc. Η αύξηση ανά μέτρηση υπολογίζεται εδώ (rain_height_acc_increment).
    "rain_gauge",
    "rain_height_acc",
  ],
  lse01: ["soil_moisture", "temp_soil", "conduct_soil"],
  lse01_shallow: ["soil_moisture1", "soil_temperature1", "conduct_soil1"],
  lse01_deep: ["soil_moisture2", "soil_temperature2", "conduct_soil2"],
  lse02: [
    "soil_moisture1",
    "soil_temperature1",
    "conduct_soil1",
    "soil_moisture2",
    "soil_temperature2",
    "conduct_soil2",
  ],
  se0x: [
    "soil_moisture1",
    "soil_temperature1",
    "conduct_soil1",
    "soil_moisture2",
    "soil_temperature2",
    "conduct_soil2",
  ],
  sph01: ["soil_ph", "temp_soil"],
  em320: ["temperature", "humidity"],
  em320_th: ["temperature", "humidity"],
  em300_th: ["temperature", "humidity", "dew_point"],
  lms01_ls: ["leaf_temperature", "leaf_moisture"],
};

/**
 * Variables that do NOT share the sensor payload's clock. Each group becomes
 * its own CSV block with its own Timestamp column, placed right after the
 * device's main block.
 *
 * Why: a block's rows are the union of its variables' timestamps, so mixing
 * clocks forces a row for every distinct instant and blanks every column that
 * had nothing at it. A real export of Όρμα showed 1904 rows against only 1629
 * actual readings - 275 rows existed solely to carry an hourly or daily rain
 * figure, leaving the temperature/humidity/wind columns empty across them.
 *
 * Hourly rain is kept apart from the cumulative counters for the same reason:
 * merging them would leave the daily/weekly/monthly columns ~95% empty inside
 * the rain block. Grouping is by CADENCE, not by topic.
 */
const EXTRA_BLOCK_GROUPS = {
  s2120: [
    // On the hour.
    // T-EXPORT-RAIN-01: withPeriod = μία τιμή ανά ώρα (όπως το ταμπλό) + στήλες διαστήματος, κάλυψης και ποιότητας.
    { label: "rainHourly", vars: ["rain_height_hourly"], withPeriod: true },
    // Running totals, reset per period; written on their own irregular schedule.
    {
      label: "rainCumulative",
      vars: [
        "current_rain_height_daily",
        "current_rain_height_weekly",
        "current_rain_height_monthly",
        "current_rain_height_yearly",
      ],
    },
    // Written back onto the station once a day at 23:59:50 by the Keetch-Byram
    // Drought Index analysis - not sent by the sensor at all.
    // T-KBDI-FIX-01: only the corrected kbdi-v2 records (the v1 ones are invalid, changelog SC-0005).
    { label: "dailyIndices", vars: ["kbdi1", "soil_moisture_condition1", "vpd1", "stress_level1"], onlyAlg: "kbdi-v2" },
  ],
};

/**
 * T-EXPORT-RAIN-01 (27/11/2026): columns computed by the export itself, not stored on the device.
 *   rain_height_acc_increment            per-reading rain from the station's cumulative counter (main s2120 block)
 *   rain_hourly_period_start_utc / _end  the hour each hourly rain value covers (hourly rain block)
 *   rain_hourly_coverage                 share of that hour with data (v34 values; empty before 4/10/2026)
 *   rain_hourly_quality                  counter measurement / estimate from intensity, partial hour, v33, backfill
 * Kept in this table so analysis/test/changelog_check.mjs requires a description for each of them.
 */
const DERIVED_EXPORT_VARIABLES = {
  s2120: ["rain_height_acc_increment", "rain_hourly_period_start_utc", "rain_hourly_period_end_utc", "rain_hourly_coverage", "rain_hourly_quality"],
};
const RAIN_HOURLY_META = ["rain_hourly_period_start_utc", "rain_hourly_period_end_utc", "rain_hourly_coverage", "rain_hourly_quality"];
const RAIN_MAX_MMH = 450;          // S2120 range (datasheet 0-450 mm/h) - same plausibility rule as the kernel and the rain analysis
const RAIN_INC_MAX_GAP_MIN = 30;   // an increment is given only across gaps <= 30 min; after a longer gap the rain cannot be placed in time

/** Per-reading rain from the cumulative counter: difference to the previous reading, counter resets handled like the kernel. */
function accIncrementSeries(points) {
  const P = points
    .map((dp) => ({ dp, t: Date.parse(dp.time), v: Number(dp.value) }))
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v))
    .sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 1; i < P.length; i++) {
    const gapMin = (P[i].t - P[i - 1].t) / 60000;
    if (gapMin <= 0 || gapMin > RAIN_INC_MAX_GAP_MIN) continue;
    let d = P[i].v - P[i - 1].v;
    if (d < -0.001) d = P[i].v;                                                     // counter reset: the new value is the rain since the reset
    if (d > RAIN_MAX_MMH * Math.max(gapMin / 60, 1 / 60) + 0.254) continue;          // physically impossible step: left empty
    out.push({ time: P[i].dp.time, value: Math.round(Math.max(d, 0) * 1000) / 1000 });
  }
  return out;
}

/** The hour an hourly rain record covers (v33 wrote the end as ...:59.999). */
function rainPeriodOf(dp) {
  const m = (dp && dp.metadata) || {};
  const s = Date.parse(m.period_start_utc);
  let e = Date.parse(m.period_end_utc);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  if (e % 1000 === 999) e += 1;
  return { s, e };
}
function rainHourlyRank(dp) {
  const m = (dp && dp.metadata) || {};
  if (m.alg !== "v34") return 1;
  const c = Number(m.coverage);
  return 2 + (Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 1);
}
/** One record per hour, the same preference as the dashboard: v34 over v33, then higher coverage, then the newest. */
function bestHourlyPerPeriod(points) {
  const best = new Map();
  const loose = [];
  for (const dp of points) {
    const p = rainPeriodOf(dp);
    if (!p) { loose.push(dp); continue; }
    const prev = best.get(p.s);
    const r = rainHourlyRank(dp), rp = prev ? rainHourlyRank(prev) : -1;
    if (!prev || r > rp || (r === rp && Date.parse(dp.time) > Date.parse(prev.time))) best.set(p.s, dp);
  }
  return loose.concat([...best.values()]);
}
function rainQualityText(dp, lang) {
  const m = (dp && dp.metadata) || {};
  const en = lang === "en";
  let est;
  if (m.alg === "v34") est = m.status === "estimate";
  else if (m.source_variable === "rain_height_acc") est = false;
  else if (m.source_variable === "rain_height") est = true;
  else return "";
  let s = est ? (en ? "estimate from intensity" : "εκτίμηση από ένταση") : (en ? "counter measurement" : "μέτρηση μετρητή");
  if (m.alg === "v34" && m.partial) s += en ? " · partial hour" : " · μερική ώρα";
  if (m.alg !== "v34") s += en ? " · before 4/10/2026 (v33)" : " · πριν από 4/10/2026 (v33)";
  if (m.backfill) s += (en ? " · backfilled " : " · συμπλήρωση ") + m.backfill;
  return s;
}
function rainCoveragePct(dp) {
  const m = (dp && dp.metadata) || {};
  if (m.alg !== "v34") return "";
  const c = Number(m.coverage);
  return Number.isFinite(c) ? Math.round(Math.max(0, Math.min(1, c)) * 1000) / 10 : "";
}

/**
 * Union of every variable a family might use. Only consulted when the exact
 * type list returned no data at all - covers devices whose `type` tag is stale
 * (e.g. an lse01 that actually decodes into the shallow/deep suffixed vars).
 */
const SOIL_FAMILY_VARIABLES = [
  "soil_moisture",
  "temp_soil",
  "conduct_soil",
  "soil_moisture1",
  "soil_temperature1",
  "conduct_soil1",
  "soil_moisture2",
  "soil_temperature2",
  "conduct_soil2",
];

const TYPE_FAMILY_FALLBACK = {
  lse01: SOIL_FAMILY_VARIABLES,
  lse01_shallow: SOIL_FAMILY_VARIABLES,
  lse01_deep: SOIL_FAMILY_VARIABLES,
  lse02: SOIL_FAMILY_VARIABLES,
  se0x: SOIL_FAMILY_VARIABLES,
};

/** `devices` tag keys / loose spellings -> canonical type key above. */
const TYPE_ALIASES = {
  se01: "lse01",
  lse01: "lse01",
  se02: "lse02",
  s2120: "s2120",
  sensecap_s2120: "s2120",
  soil: "lse01",
  soilsensor: "lse01",
  weatherstation: "s2120",
};

/** Controllers / gateways carry no sensor measurements - never exported. */
const NON_SENSOR_TYPES = new Set(["uc511", "gateway", "ws558", "tvalve", "t_valve"]);

/** Block title per sensor type. */
const DEVICE_TYPE_TITLES = {
  el: {
    s2120: "Μετεωρολογικός Σταθμός",
    lse01: "Αισθητήρας Εδάφους",
    lse01_shallow: "Αισθητήρας Εδάφους (Ρηχό)",
    lse01_deep: "Αισθητήρας Εδάφους (Βαθύ)",
    lse02: "Αισθητήρας Εδάφους (Διπλός)",
    se0x: "Αισθητήρας Εδάφους (Διπλός)",
    sph01: "Αισθητήρας pH Εδάφους",
    em320: "Θερμοκρασία & Υγρασία",
    em320_th: "Θερμοκρασία & Υγρασία",
    em300_th: "Θερμοκρασία & Υγρασία",
    lms01_ls: "Αισθητήρας Φύλλου",
  },
  en: {
    s2120: "Weather Station",
    lse01: "Soil Sensor",
    lse01_shallow: "Soil Sensor (Shallow)",
    lse01_deep: "Soil Sensor (Deep)",
    lse02: "Soil Sensor (Dual)",
    se0x: "Soil Sensor (Dual)",
    sph01: "Soil pH Sensor",
    em320: "Temperature & Humidity",
    em320_th: "Temperature & Humidity",
    em300_th: "Temperature & Humidity",
    lms01_ls: "Leaf Sensor",
  },
};

/** Column headers. Falls back to the raw variable name when unmapped. */
const VARIABLE_LABELS = {
  el: {
    air_temperature: "Θερμοκρασία Αέρα (°C)",
    air_humidity: "Υγρασία Αέρα (%)",
    dew_point: "Σημείο Δρόσου (°C)",
    barometric_pressure_hpa: "Βαρομετρική Πίεση (hPa)",
    wind_speed_kmh: "Ταχύτητα Ανέμου (km/h)",
    wind_direction_sensor: "Κατεύθυνση Ανέμου (°)",
    uv_index: "Δείκτης UV",
    light_intensity: "Φωτεινότητα (lux)",
    rain_height: "Βροχόπτωση Μέτρησης (mm)",
    rain_gauge: "Βροχόπτωση Μέτρησης από Ένταση (mm)",
    rain_height_acc: "Μετρητής Βροχής - Αθροιστικός (mm)",
    rain_height_acc_increment: "Βροχόπτωση Μέτρησης από Μετρητή (mm)",
    rain_height_hourly: "Βροχόπτωση Ώρας (mm)",
    rain_hourly_period_start_utc: "Αρχή Ώρας (UTC)",
    rain_hourly_period_end_utc: "Τέλος Ώρας (UTC)",
    rain_hourly_coverage: "Κάλυψη Ώρας (%)",
    rain_hourly_quality: "Ποιότητα Τιμής",
    current_rain_height_daily: "Βροχόπτωση Ημέρας (mm)",
    current_rain_height_weekly: "Βροχόπτωση Εβδομάδας (mm)",
    current_rain_height_monthly: "Βροχόπτωση Μήνα (mm)",
    current_rain_height_yearly: "Βροχόπτωση Έτους (mm)",
    soil_moisture: "Υγρασία Εδάφους (%)",
    temp_soil: "Θερμοκρασία Εδάφους (°C)",
    conduct_soil: "Αγωγιμότητα Εδάφους (uS/cm)",
    soil_moisture1: "Υγρασία Εδάφους - Ρηχό (%)",
    soil_temperature1: "Θερμοκρασία Εδάφους - Ρηχό (°C)",
    conduct_soil1: "Αγωγιμότητα Εδάφους - Ρηχό (uS/cm)",
    soil_moisture2: "Υγρασία Εδάφους - Βαθύ (%)",
    soil_temperature2: "Θερμοκρασία Εδάφους - Βαθύ (°C)",
    conduct_soil2: "Αγωγιμότητα Εδάφους - Βαθύ (uS/cm)",
    soil_ph: "pH Εδάφους",
    leaf_temperature: "Θερμοκρασία Φύλλου (°C)",
    leaf_moisture: "Υγρασία Φύλλου (%)",
    temperature: "Θερμοκρασία (°C)",
    humidity: "Υγρασία (%)",
    // Daily indices (Keetch-Byram Drought Index analysis)
    kbdi1: "Δείκτης Ξηρασίας KBDI (mm)",
    soil_moisture_condition1: "Κατάσταση Υγρασίας Εδάφους",
    vpd1: "Έλλειμμα Πίεσης Υδρατμών VPD (kPa)",
    stress_level1: "Επίπεδο Υδατικής Καταπόνησης",
  },
  en: {
    air_temperature: "Air Temperature (°C)",
    air_humidity: "Air Humidity (%)",
    dew_point: "Dew Point (°C)",
    barometric_pressure_hpa: "Barometric Pressure (hPa)",
    wind_speed_kmh: "Wind Speed (km/h)",
    wind_direction_sensor: "Wind Direction (°)",
    uv_index: "UV Index",
    light_intensity: "Light Intensity (lux)",
    rain_height: "Rain per Reading (mm)",
    rain_gauge: "Rain per Reading from Intensity (mm)",
    rain_height_acc: "Rain Counter - Cumulative (mm)",
    rain_height_acc_increment: "Rain per Reading from Counter (mm)",
    rain_height_hourly: "Rain Hourly (mm)",
    rain_hourly_period_start_utc: "Hour Start (UTC)",
    rain_hourly_period_end_utc: "Hour End (UTC)",
    rain_hourly_coverage: "Hour Coverage (%)",
    rain_hourly_quality: "Value Quality",
    current_rain_height_daily: "Rain Daily (mm)",
    current_rain_height_weekly: "Rain Weekly (mm)",
    current_rain_height_monthly: "Rain Monthly (mm)",
    current_rain_height_yearly: "Rain Yearly (mm)",
    soil_moisture: "Soil Moisture (%)",
    temp_soil: "Soil Temperature (°C)",
    conduct_soil: "Soil Conductivity (uS/cm)",
    soil_moisture1: "Soil Moisture - Shallow (%)",
    soil_temperature1: "Soil Temperature - Shallow (°C)",
    conduct_soil1: "Soil Conductivity - Shallow (uS/cm)",
    soil_moisture2: "Soil Moisture - Deep (%)",
    soil_temperature2: "Soil Temperature - Deep (°C)",
    conduct_soil2: "Soil Conductivity - Deep (uS/cm)",
    soil_ph: "Soil pH",
    leaf_temperature: "Leaf Temperature (°C)",
    leaf_moisture: "Leaf Moisture (%)",
    temperature: "Temperature (°C)",
    humidity: "Humidity (%)",
    // Daily indices (Keetch-Byram Drought Index analysis)
    kbdi1: "Drought Index KBDI (mm)",
    soil_moisture_condition1: "Soil Moisture Condition",
    vpd1: "Vapour Pressure Deficit VPD (kPa)",
    stress_level1: "Water Stress Level",
  },
};

/** UI strings. */
const TEXT = {
  el: {
    timestamp: "Χρόνος UTC",
    timestampLocal: "Ώρα Ελλάδας (με ζώνη)",
    timestampFor: (label) => `Χρόνος UTC · ${label}`,
    dailyIndices: "Ημερήσιοι Δείκτες",
    rainHourly: "Ωριαία Βροχόπτωση",
    rainCumulative: "Αθροιστική Βροχόπτωση",
    subject: (field, part, from, to) => `${field} - Εξαγωγή Μετρήσεων ${part} (${from} - ${to} UTC)`,
    body: (part, about) =>
      `Καλησπέρα,\n\nΕπισυνάπτεται ${part} των μετρήσεων για το ζητούμενο χρονικό διάστημα.\n\n${about}\n\nΜε εκτίμηση,\nCyRIC IoT`,
    starting: "Εξαγωγή δεδομένων...",
    fetching: (f) => `Ανάκτηση μετρήσεων για τον αγρό «${f}»...`,
    sending: (n) => `Αποστολή ${n} ${n > 1 ? "αρχείων" : "αρχείου"} με email...`,
    noField: "Δεν επιλέχθηκε αγρός.",
    fieldNotFound: (v) => `Ο αγρός «${v}» δεν βρέθηκε.`,
    noEmail: "Δεν συμπληρώθηκε διεύθυνση email.",
    noSensors: (f) => `Ο αγρός «${f}» δεν έχει συνδεδεμένους αισθητήρες.`,
    duplicate: (f, m) => `Η ίδια εξαγωγή για τον αγρό «${f}» στάλθηκε πριν από ${m}΄. Ελέγξτε το email σας (και τα ανεπιθύμητα). Για να μην εξαντληθεί το κοινό όριο αναγνώσεων, η ίδια εξαγωγή ξανατρέχει μετά από ${DUPLICATE_WINDOW_MIN}΄.`,
    budget: (f, est, used) => `Η εξαγωγή για τον αγρό «${f}» θα διάβαζε ~${Math.round(est / 1000).toLocaleString("el-GR")} χιλ. εγγραφές· το όριο ανά αγρό είναι ${(FIELD_DAILY_READS / 1e6).toLocaleString("el-GR")} εκατ. το 24ωρο (ήδη ${Math.round(used / 1000).toLocaleString("el-GR")} χιλ.). Επιλέξτε μικρότερο διάστημα ή δοκιμάστε αργότερα.`,
    noData: (f) => `Δεν υπάρχουν μετρήσεις για τον αγρό «${f}» στο επιλεγμένο διάστημα.`,
    allFailed: (f, s) => `Αποτυχία ανάγνωσης των αισθητήρων του αγρού «${f}»: ${s}. Δοκιμάστε ξανά.`,
    ok: (f, n) => `Η εξαγωγή για τον αγρό «${f}» στάλθηκε με email (${n} αρχείο${n > 1 ? "α" : ""}).`,
    partial: (f, n, s) =>
      `Η εξαγωγή για τον αγρό «${f}» στάλθηκε (${n} αρχείο${n > 1 ? "α" : ""}), ΑΛΛΑ είναι ελλιπής - δεν διαβάστηκαν: ${s}.`,
    failed: (m) => `Η εξαγωγή απέτυχε: ${m}`,
    // T-EXPORT-DISEASE-01
    diseaseRisk: "Ασθένειες - Ημερήσιος κίνδυνος",
    diseaseDecl: "Ασθένειες - Δηλώσεις",
    diseaseRecord: "καταγραφή ασθενειών",
    riskCols: ["Ημερομηνία (UTC)", "Καλλιέργεια", "Ασθένεια / Εχθρός", "Μέγιστος κίνδυνος", "Ώρες σε υψηλό ή σοβαρό", "Σχόλιο συστήματος"],
    declCols: ["Χρόνος UTC", "Καταχώρηση", "Ασθένειες / Εχθροί", "Σκεύασμα", "Ημέρες προστασίας", "Ημερομηνία ψεκασμού (όπως δηλώθηκε)"],
    riskNone: "Κανένας κίνδυνος πάνω από «Χαμηλός» στο διάστημα.",
    riskNoModel: "Δεν υπάρχουν εκτιμήσεις κινδύνου στο διάστημα (ο αγρός δεν έχει παραμετροποιηθεί με καλλιέργεια).",
    declNone: "Καμία δήλωση ψεκασμού ή επιθεώρησης στο διάστημα.",
    declSpray: "Ψεκασμός",
    declInspect: "Επιθεώρηση - χωρίς προσβολή",
    declUndo: (what, when) => `Αναίρεση ${what === "s" ? "ψεκασμού" : "επιθεώρησης"}${when ? " της " + when : ""}`,
    calIssue: (x) => (x ? `Ημερολόγιο - Πρόβλημα: ${x}` : ""),
    calAction: (x) => (x ? `Ενέργεια: ${x}` : ""),
  },
  en: {
    timestamp: "UTC time",
    timestampLocal: "Greek time (with offset)",
    timestampFor: (label) => `UTC time · ${label}`,
    dailyIndices: "Daily Indices",
    rainHourly: "Hourly Rain",
    rainCumulative: "Cumulative Rain",
    subject: (field, part, from, to) => `${field} - Data Export ${part} (${from} - ${to} UTC)`,
    body: (part, about) =>
      `Hello,\n\nPlease find attached ${part} of the measurements for the requested time period.\n\n${about}\n\nKind Regards,\nCyRIC IoT`,
    starting: "Exporting...",
    fetching: (f) => `Fetching measurements for "${f}"...`,
    sending: (n) => `Sending ${n} file${n > 1 ? "s" : ""} by email...`,
    noField: "No field selected.",
    fieldNotFound: (v) => `Field "${v}" not found.`,
    noEmail: "No email address provided.",
    noSensors: (f) => `Field "${f}" has no sensors attached.`,
    duplicate: (f, m) => `The same export for "${f}" was sent ${m} min ago. Please check your email (and spam folder). To protect the shared read limit, the same export can run again after ${DUPLICATE_WINDOW_MIN} min.`,
    budget: (f, est, used) => `The export for "${f}" would read ~${Math.round(est / 1000)}k records; the limit per field is ${FIELD_DAILY_READS / 1e6}M per 24 h (already ${Math.round(used / 1000)}k). Please choose a shorter period or try later.`,
    noData: (f) => `No measurements for field "${f}" in the selected period.`,
    allFailed: (f, s) => `Could not read the sensors of field "${f}": ${s}. Please try again.`,
    ok: (f, n) => `Export for field "${f}" sent by email (${n} file${n > 1 ? "s" : ""}).`,
    partial: (f, n, s) =>
      `Export for field "${f}" sent (${n} file${n > 1 ? "s" : ""}), BUT it is incomplete - could not read: ${s}.`,
    failed: (m) => `Export failed: ${m}`,
    // T-EXPORT-DISEASE-01
    diseaseRisk: "Diseases - Daily risk",
    diseaseDecl: "Diseases - Declarations",
    diseaseRecord: "disease record",
    riskCols: ["Date (UTC)", "Crop", "Disease / Pest", "Max risk", "Hours at high or severe", "System note"],
    declCols: ["UTC time", "Entry", "Diseases / Pests", "Product", "Protection days", "Spray date"],
    riskNone: "No risk above \"Low\" in the period.",
    riskNoModel: "No risk estimates in the period (the field has no crop configured).",
    declNone: "No spray or inspection declarations in the period.",
    declSpray: "Spray",
    declInspect: "Inspection - no infection",
    declUndo: (what, when) => `Undo ${what === "s" ? "spray" : "inspection"}${when ? " of " + when : ""}`,
    calIssue: (x) => (x ? `Diary - Issue: ${x}` : ""),
    calAction: (x) => (x ? `Action: ${x}` : ""),
  },
};

// === Disease record (T-EXPORT-DISEASE-01) =================================
// Bundle key decoding - MUST match runPerTich.js T-BUNDLE-KEYMAP-01
// (_SAG_KEYMAP_PATHOGENS / _SAG_KEYMAP_PREFIXES). Both lists are frozen and
// append-only there; a key outside them passes through unchanged, so a
// pathogen added later without updating this copy still decodes (long name).
const BUNDLE_KEYMAP_PATHOGENS = ["plasmopara_viticola","erysiphe_necator","phytophthora_infestans","botrytis_cinerea","venturia_inaequalis","taphrina_deformans","colletotrichum_oleae","spilocaea_oleagina","alternaria_solani","podosphaera_xanthii","oidium_farinosum","phytophthora_niederhauserii","neopestalotiopsis_clavispora","phytophthora_pythium_root_rot_herbs","pseudocercospora_cladosporioides","monilinia_spp","leveillula_taurica","peronospora_destructor","pseudoperonospora_cubensis","cercospora_beticola","podosphaera_aphanis","alternaria_dauci","brassica_downy_mildew","brassica_alternaria","alternaria_alternata_citrus_abs","zymoseptoria_tritici","fusarium_graminearum","puccinia_striiformis","puccinia_menthae","blumeria_graminis","phytophthora_citrophthora","colletotrichum_gloeosporioides","plasmopara_halstedii","colletotrichum_acutatum","phomopsis_viticola","cerotelium_fici","botryosphaeria_panicle_shoot_blight","septoria_pistaciarum","cryphonectria_parasitica","phytophthora_xcambivora","fusarium_spp_corm_rot","podosphaera_mors_uvae","gloeosporidiella_ribis","pseudoidium_ceratoniae","pseudocercospora_ceratoniae","pestalotiopsis_uvicola","verticillium_dahliae","phytophthora_capsici","rhizoctonia_solani","sclerotinia_sclerotiorum","bactrocera_oleae","prays_oleae","palpita_unionalis","tuta_absoluta","myzus_persicae","ceratitis_capitata","bemisia_tabaci","rhynchites_cribripennis","rhopalosiphum_padi","sitobion_avenae","lobesia_botrana","cydia_pomonella","thrips_tabaci","phyllocnistis_citrella","euphyllura_phillyreae","saissetia_oleae","parlatoria_oleae","phthorimaea_operculella","leptinotarsa_decemlineata","tetranychus_urticae","panonychus_ulmi","panonychus_citri","xanthomonas_arboricola_pv_juglandis","pseudomonas_savastanoi","erwinia_amylovora","meloidogyne_incognita","asymmetrasca_decedens","empoasca_decipiens","colletotrichum_orbiculare","colletotrichum_coccodes"];
const BUNDLE_KEYMAP_PREFIXES = ["infection_hours_counter_max_","infection_hours_counter_","nematode_dd_accumulated_","nematode_generation_index_","dh_accumulated_","gdd_accumulated_","gdd_daily_","gdd_hourly_","fir_message_","fir_","pei_","case_","last_spray_","spray_protection_end_","inspection_clean_","soilhist_","gdd_seeded_"];

/** Pathogen key -> Greek name (runPerTich PATHOGEN_PROFILE[*][key].name). */
const PATHOGEN_NAMES_EL = {"plasmopara_viticola":"Περονόσπορος","erysiphe_necator":"Ωίδιο Αμπελιού","phytophthora_infestans":"Περονόσπορος Σολανωδών","botrytis_cinerea":"Τεφρά Σήψη","venturia_inaequalis":"Φουζικλάδιο Μηλιάς","taphrina_deformans":"Εξώασκος / Κράνωση","colletotrichum_oleae":"Γλοιοσπόριο / Ανθράκνωση Ελιάς","spilocaea_oleagina":"Κυκλοκόνιο Ελιάς","alternaria_solani":"Αλτερνάρια Σολανωδών","podosphaera_xanthii":"Ωίδιο Κολοκυνθοειδών","oidium_farinosum":"Ωίδιο Μηλιάς","phytophthora_niederhauserii":"Σήψη Ριζών Μαστιχόδεντρου","neopestalotiopsis_clavispora":"Φυλλόπτωση Μαστιχόδεντρου","phytophthora_pythium_root_rot_herbs":"Σήψη Ριζών Δενδρολίβανου","pseudocercospora_cladosporioides":"Κερκοσπορίαση Ελιάς","monilinia_spp":"Μονίλια Πυρηνοκάρπων — Καστανή Σήψη","leveillula_taurica":"Ωίδιο Σολανωδών","peronospora_destructor":"Περονόσπορος Κρεμμυδιών/Σκόρδου","pseudoperonospora_cubensis":"Περονόσπορος Κολοκυνθοειδών","cercospora_beticola":"Κερκοσπορίαση Ζαχαρότευτλων","podosphaera_aphanis":"Ωίδιο Φράουλας","alternaria_dauci":"Αλτερνάρια Καρότου","brassica_downy_mildew":"Περονόσπορος Σταυρανθών","brassica_alternaria":"Αλτερνάρια Σταυρανθών","alternaria_alternata_citrus_abs":"Αλτερνάρια Εσπεριδοειδών","zymoseptoria_tritici":"Σεπτορίαση Σιταριού","fusarium_graminearum":"Φουζαρίωση Στάχυος","puccinia_striiformis":"Κίτρινη Σκωρίαση","puccinia_menthae":"Σκωρίαση Μέντας","blumeria_graminis":"Ωίδιο Σιτηρών","phytophthora_citrophthora":"Γομμώσεις Εσπεριδοειδών","colletotrichum_gloeosporioides":"Ανθράκνωση Εσπεριδοειδών","colletotrichum_orbiculare":"Ανθράκνωση Κολοκυνθοειδών","colletotrichum_coccodes":"Ανθράκνωση Σολανωδών","plasmopara_halstedii":"Περονόσπορος Ηλίανθου","colletotrichum_acutatum":"Ανθράκνωση Φράουλας","phomopsis_viticola":"Φόμοψη Αμπέλου","cerotelium_fici":"Σκωρίαση Σύκου","botryosphaeria_panicle_shoot_blight":"Βοτρυοσφαιρίαση Φιστικιάς","septoria_pistaciarum":"Σεπτορίαση Φιστικιάς","cryphonectria_parasitica":"Έλκος Καστανιάς","phytophthora_xcambivora":"Μελάνωση Καστανιάς — Φυτόφθορα Καστανιάς","fusarium_spp_corm_rot":"Σήψη Κορμού Κρόκου","podosphaera_mors_uvae":"Ωίδιο Φραγκοσταφύλου","gloeosporidiella_ribis":"Κηλίδωση Φραγκοστάφυλου","pseudoidium_ceratoniae":"Ωίδιο Χαρουπιάς","pseudocercospora_ceratoniae":"Κηλίδωση Χαρουπιάς","pestalotiopsis_uvicola":"Κηλίδωση-Νέκρωση Δάφνης","verticillium_dahliae":"Βερτισιλλίωση","phytophthora_capsici":"Φυτόφθορα Λαχανικών","rhizoctonia_solani":"Ριζοκτονίαση Πατάτας/Τεύτλων","sclerotinia_sclerotiorum":"Σκληρωτινίαση","bactrocera_oleae":"Δάκος","prays_oleae":"Πυρηνοτρήτης","palpita_unionalis":"Μαργαρώνια","tuta_absoluta":"Φυλλορύκτης Tuta","myzus_persicae":"Πράσινη Αφίδα","ceratitis_capitata":"Μύγα της Μεσογείου","bemisia_tabaci":"Αλευρώδεις","rhynchites_cribripennis":"Ρυγχίτης Ελιάς","rhopalosiphum_padi":"Αφίδα Δημητριακών","sitobion_avenae":"Αφίδες Σιτηρών","lobesia_botrana":"Ευδεμίδα Αμπέλου","asymmetrasca_decedens":"Τζιτζικάκι Αμπελιού","empoasca_decipiens":"Τζιτζικάκι Λαχανικών","cydia_pomonella":"Καρπόκαψα","thrips_tabaci":"Θρίπας","phyllocnistis_citrella":"Φυλλοκνίστης Εσπεριδοειδών","euphyllura_phillyreae":"Βαμβακάδα / Ψύλλα Ελιάς","saissetia_oleae":"Λεκάνιο — Κοκκοειδή Ελιάς","parlatoria_oleae":"Παρλατόρια — Κοκκοειδή Ελιάς","phthorimaea_operculella":"Φθοριμαία","leptinotarsa_decemlineata":"Δορυφόρος","tetranychus_urticae":"Τετράνυχος","panonychus_ulmi":"Ευρωπαϊκό Κόκκινο Ακάρι","panonychus_citri":"Κόκκινο Ακάρι Εσπεριδοειδών","xanthomonas_arboricola_pv_juglandis":"Βακτηρίωση Καρυδιάς","pseudomonas_savastanoi":"Καρκίνωση Ελιάς","erwinia_amylovora":"Βακτηριακή Καύση — Πυρόσυρμα Μηλοειδών","meloidogyne_incognita":"Κομβονηματώδης Ριζών"};

/** cultivation_type -> Greek label (custom_html_files/configuration.html). */
const CROP_NAMES_EL = {"koroneiki":"Κορωνέικη","kalamon":"Καλαμών","chalkidikis":"Χαλκιδικής","amfissis_konservolia":"Αμφίσσης / Κονσερβολιά","tsounati_mastoidis":"Τσουνάτη / Μαστοειδής","megaritiki":"Μεγαρίτικη","wine_grapes":"Οινοποιήσιμες","table_grapes":"Επιτραπέζιες","raisin_grapes":"Σταφίδες","wheat":"Σιτάρι","barley":"Κριθάρι","maize":"Καλαμπόκι","oats":"Βρώμη","rice":"Ρύζι","onion":"Κρεμμύδι","watermelon":"Καρπούζι","potato":"Πατάτα","dry_beans":"Ξηρά Φασόλια","faba_bean":"Κουκιά","green_beans":"Φασολάκια","cabbage":"Λάχανο","lettuce":"Μαρούλι","carrot":"Καρότο","cucumber":"Αγγούρι","tomato":"Ντομάτα","eggplant":"Μελιτζάνα","pepper":"Πιπεριά","strawberry":"Φράουλα","garlic":"Σκόρδο","zucchini":"Κολοκύθι","melon":"Πεπόνι","broccoli":"Μπρόκολο","orange":"Πορτοκάλι","lemon":"Λεμόνι","mandarin":"Μανταρίνι","peach":"Ροδακινιά","nectarine":"Νεκταρινιά","apricot":"Βερικοκιά","plum":"Δαμασκηνιά","cherry":"Κερασιά","apple":"Μηλιά","pear":"Αχλαδιά","kiwi":"Ακτινίδιο","pomegranate":"Ρόδι","fig":"Συκιά","avocado":"Αβοκάντο","almond":"Αμυγδαλιά","pistachio":"Φιστικιά","walnut":"Καρυδιά","chestnut":"Καστανιά","cotton":"Βαμβάκι","tobacco":"Καπνός","sunflower":"Ηλίανθος","sugar_beet":"Ζαχαρότευτλο","safflower":"Κνήκος","saffron":"Κρόκος","mastic_tree":"Μαστιχόδενδρο","oregano":"Ρίγανη","thyme":"Θυμάρι","rosemary":"Δενδρολίβανο","sage":"Φασκόμηλο","mint":"Μέντα","bay_laurel":"Δάφνη","currants":"Φραγκοστάφυλα","carob":"Χαρουπιά","artichoke":"Αγκινάρα","lavender":"Λεβάντα","sideritis":"Τσάι βουνού (Σιδερίτης)","floriculture_generic":"Ανθοκομικά (γενικό)"};

/** Risk card value -> rank (runPerTich _SAG_CASE_LEVELS). */
const RISK_RANK = {
  "Χαμηλός κίνδυνος": 1,
  "Μέτριος κίνδυνος": 2,
  "Υψηλός κίνδυνος": 3,
  "Σοβαρός κίνδυνος": 4,
};
const RISK_MIN_EXPORTED = 2; // «Μέτριος» and up

function decodeBundleKey(code) {
  if (typeof code !== "string" || !/^[a-z][0-9][0-9]$/.test(code)) return code;
  const pre = BUNDLE_KEYMAP_PREFIXES[code.charCodeAt(0) - 97];
  const name = BUNDLE_KEYMAP_PATHOGENS[Number(code.slice(1))];
  return pre && name ? pre + name : code;
}

/** field_bundle record -> [{ cropId, indicators }] with long key names. */
function decodeBundleCrops(record) {
  const meta = (record && record.metadata) || {};
  let payload = null;
  if (meta.schema && meta.schema.compression === "deflate-raw-base64" && meta.data) {
    payload = JSON.parse(zlib.inflateRawSync(Buffer.from(String(meta.data), "base64")).toString("utf8"));
  } else if (Array.isArray(meta.crops)) {
    payload = meta;
  }
  if (!payload || !Array.isArray(payload.crops)) return [];
  return payload.crops.map((c) => {
    const ind = {};
    for (const k of Object.keys((c && c.indicators) || {})) ind[decodeBundleKey(k)] = c.indicators[k];
    return { cropId: String((c && c.id) || ""), indicators: ind };
  });
}

function unwrapValue(x) {
  return x && typeof x === "object" && "value" in x ? x.value : x;
}

function pathogenName(key, lang) {
  if (lang === "el" && PATHOGEN_NAMES_EL[key]) return PATHOGEN_NAMES_EL[key];
  return key;
}

/** Crop id ("vegetablecrops:tomato:1" or a custom id) -> readable label. */
function cropLabel(cropId, cropsCfg, lang) {
  const c = (cropsCfg || []).find((x) => x && String(x.id || "").toLowerCase() === cropId.toLowerCase());
  const type = (c && c.cultivation_type) || String(cropId).split(":")[1] || cropId;
  if (lang === "el" && CROP_NAMES_EL[type]) return CROP_NAMES_EL[type];
  return type;
}

/** Plain JSON object from a declaration value, or null ('init' seeds etc.). */
function parseDeclaration(value) {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch (_) {
      return null;
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

/**
 * Build the two disease blocks for one field.
 * returns { blocks: [tableBlock, tableBlock], hasData, failed: [labels] }
 */
async function buildDiseaseBlocks({ read, fieldName, startDate, endDate, lang, t, log }) {
  const failed = [];
  const readErrors = [];

  // --- Crop labels from the latest configuration (may be absent) ---------
  let cropsCfg = [];
  try {
    const cfgRows = await read({ variables: ["configuration"], qty: 1 });
    const cfg = parseDeclaration(cfgRows && cfgRows[0] && cfgRows[0].value);
    if (cfg && Array.isArray(cfg.crops)) cropsCfg = cfg.crops;
  } catch (err) {
    log(`  configuration read failed (${err && err.message ? err.message : err}) - crop ids used as labels.`);
  }

  // --- 1. Daily risk from the hourly field_bundle records ----------------
  const bundles = await fetchAllData(read, "field_bundle", startDate, endDate, log, readErrors);
  // day|crop|pathogen -> { day, crop, key, rank, label, text, highHours:Set }
  const agg = new Map();
  let undecodable = 0;
  let sawAnyCard = false;
  for (const b of bundles) {
    let crops;
    try {
      crops = decodeBundleCrops(b);
    } catch (_) {
      undecodable++;
      continue;
    }
    const u = dayjs(b.time).utc();   // T-EXPORT-UTC-01: ημέρα UTC
    const day = u.format("YYYY-MM-DD");
    const hour = u.format("HH");
    for (const { cropId, indicators } of crops) {
      for (const k of Object.keys(indicators)) {
        if (!k.startsWith("fir_message_")) continue;
        sawAnyCard = true;
        const ind = indicators[k];
        const label = String(unwrapValue(ind) || "");
        const rank = RISK_RANK[label] || 0;
        if (rank < RISK_MIN_EXPORTED) continue;
        const key = k.slice("fir_message_".length);
        const id = `${day}|${cropId}|${key}`;
        let a = agg.get(id);
        if (!a) {
          a = { day, cropId, key, rank: 0, label: "", text: "", highHours: new Set() };
          agg.set(id, a);
        }
        if (rank > a.rank) {
          a.rank = rank;
          a.label = label;
          a.text = String((ind && ind.metadata && ind.metadata.text) || "");
        }
        if (rank >= 3) a.highHours.add(hour);
      }
    }
  }
  if (undecodable > 0) log(`  ${undecodable} field_bundle record(s) could not be decoded - skipped.`);

  const riskRows = Array.from(agg.values())
    .sort((x, y) => (x.day === y.day ? y.rank - x.rank || x.key.localeCompare(y.key) : x.day.localeCompare(y.day)))
    .map((a) => [
      a.day,
      cropLabel(a.cropId, cropsCfg, lang),
      pathogenName(a.key, lang),
      a.label,
      a.highHours.size,
      a.text,
    ]);
  if (riskRows.length === 0) {
    riskRows.push(["", "", "", "", "", sawAnyCard ? t.riskNone : t.riskNoModel]);
  }

  // --- 2. Farmer declarations -------------------------------------------
  // field_calendar = the farmer's cultivation diary (problem seen / action /
  // product / other), the free-text side of the same record.
  const declVars = ["spray_declaration", "inspection_declaration", "declaration_undo", "field_calendar"];
  const declPoints = [];
  await Promise.all(
    declVars.map(async (v) => {
      const pts = await fetchAllData(read, v, startDate, endDate, log, readErrors);
      for (const p of pts) declPoints.push(p);
    })
  );
  declPoints.sort((a, b) => new Date(a.time) - new Date(b.time));

  const names = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((x) => typeof x === "string" && x)
      .map((x) => pathogenName(x, lang))
      .join("; ");

  const declRows = [];
  for (const p of declPoints) {
    if (p.variable === "field_calendar") {
      const m = (p.metadata && typeof p.metadata === "object" ? p.metadata : null) || parseDeclaration(p.value) || {};
      const s = (x) => String(x || "").trim();
      const issue = s(m.issueText);
      const action = s(m.actionText);
      const other = [s(m.otherText), s(m.notes)].filter(Boolean).join(" - ");
      const summary = issue || action || other || s(typeof p.value === "string" ? p.value : "");
      if (!summary || summary === "init") continue;
      const when = fmtUtc(m.datetimeISO || p.time);
      const entry = [t.calIssue(issue), t.calAction(action), other].filter(Boolean).join(" | ");
      declRows.push([when, entry || summary, "", s(m.productText), "", ""]);
      continue;
    }
    const pl = parseDeclaration(p.value);
    if (!pl) continue; // 'init' seed rows and junk
    const ts = fmtUtc(p.time);
    if (p.variable === "spray_declaration") {
      const sprayDate = pl.spray_date || pl.date || pl.sprayDate || "";
      declRows.push([
        ts,
        t.declSpray,
        names(pl.target_pathogens || pl.targets || pl.pathogens),
        pl.product_name || pl.product || pl.pesticide_key || "",
        pl.protection_days ?? pl.days ?? "",
        sprayDate ? String(sprayDate).slice(0, 10) : "",
      ]);
    } else if (p.variable === "inspection_declaration") {
      declRows.push([ts, t.declInspect, names(pl.target_pathogens || pl.targets || pl.pathogens), "", "", ""]);
    } else if (p.variable === "declaration_undo") {
      const tMin = Math.floor(Number(pl.t));
      const when = Number.isFinite(tMin) && tMin > 0 ? fmtUtc(tMin * 60000) : "";
      declRows.push([ts, t.declUndo(String(pl.k || ""), when), names(pl.g), "", "", ""]);
    }
  }
  const declHasData = declRows.length > 0;
  if (!declHasData) declRows.push(["", t.declNone, "", "", "", ""]);

  if (readErrors.length > 0) failed.push(`${t.diseaseRecord} (${readErrors.join(", ")})`);
  log(
    `Prepared disease record for ${fieldName} | bundles: ${bundles.length} | risk rows: ${agg.size} | declarations: ${
      declHasData ? declRows.length : 0
    }`
  );

  return {
    blocks: [
      { alias: `${fieldName} - ${t.diseaseRisk}`, eui: "", table: true, columns: t.riskCols, rows: riskRows },
      { alias: `${fieldName} - ${t.diseaseDecl}`, eui: "", table: true, columns: t.declCols, rows: declRows },
    ],
    hasData: agg.size > 0 || declHasData,
    failed,
  };
}

// === Helpers ==============================================================

function tagValue(tags, key) {
  const t = (tags || []).find((x) => String(x.key).toLowerCase() === key.toLowerCase());
  return t ? t.value : undefined;
}

function scopeValue(scope, variable) {
  const item = scope.find((x) => String(x.variable).toLowerCase() === variable.toLowerCase());
  return item ? item.value : undefined;
}

function isDeviceId(value) {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value.trim());
}

/** Resolve the `devices` tag into [{ key, id }] in a stable order. */
function parseDevicesTag(raw) {
  if (!raw) return [];
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (_) {
    return [];
  }
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .filter(([, id]) => isDeviceId(String(id)))
    .map(([key, id]) => ({ key: String(key), id: String(id) }));
}

/**
 * Canonical sensor type for a device: its own `type` tag wins, then the
 * `devices` tag key, then the device name. Returns undefined when unknown.
 *
 * The tag key alone is not enough - fields provisioned by createField.js key
 * the `devices` tag by sensor type ("se01"), while addSensorsToField.js keys it
 * by real device name ("dragino_lse01_80c9"). The device's own `type` tag is
 * the only value that is correct in both cases.
 */
function resolveSensorType(deviceInfo, devicesTagKey) {
  const candidates = [
    tagValue(deviceInfo && deviceInfo.tags, "type"),
    devicesTagKey,
    deviceInfo && deviceInfo.name,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const norm = String(raw).trim().toLowerCase();
    if (DEVICE_TYPE_VARIABLES[norm]) return norm;
    if (TYPE_ALIASES[norm]) return TYPE_ALIASES[norm];
    if (NON_SENSOR_TYPES.has(norm)) return norm;
    // device names like "dragino_lse01_80c9" / "sensecap_s2120_058B"
    for (const known of Object.keys(DEVICE_TYPE_VARIABLES)) {
      if (norm.includes(known)) return known;
    }
  }
  return undefined;
}

/**
 * Build a data reader for a device. Prefers the profile-token Resources API;
 * falls back to a device token when the profile lacks that permission.
 */
async function makeReader(resources, account, deviceId, log) {
  const viaResources = (query) => resources.devices.getDeviceData(deviceId, query);

  try {
    await viaResources({ qty: 1 });
    return viaResources;
  } catch (err) {
    // Common on profiles whose token has no device-data scope. Say which path
    // is in use - otherwise a silent fallback hides the real permission state.
    log(`  Resources read denied (${err && err.message ? err.message : err}); using a device token.`);
    const token = await Utils.getTokenByName(account, deviceId);
    const device = new Device({ token });
    return (query) => device.getData(query);
  }
}

/**
 * Fetch every datapoint of `variable` in [startDate, endDate].
 *
 * Pages backwards through time instead of using `skip`: immutable devices
 * (which every MACC sensor is) do not paginate reliably by offset. Each page
 * pulls newest-first, then the window's end is pulled back to the oldest point
 * seen. Duplicates at the boundary are removed by datapoint id.
 */
async function fetchAllData(read, variable, startDate, endDate, log, errors) {
  const results = [];
  const seen = new Set();
  const startMs = new Date(startDate).getTime();
  let windowEnd = endDate;

  for (let page = 0; page < 200; page++) {
    let data;
    try {
      data = await read({
        variables: [variable],
        start_date: startDate,
        end_date: windowEnd,
        qty: PAGE_SIZE,
      });
    } catch (err) {
      log(`  ! ${variable}: read failed (${err && err.message ? err.message : err})`);
      // Partial data for this variable - tell the caller so the run does not
      // report a truncated export as a clean success.
      if (errors) errors.push(variable);
      break;
    }

    if (!Array.isArray(data) || data.length === 0) break;
    READ_METER.n += data.length;   // T-EXPORT-BUDGET-01

    let added = 0;
    let oldest = null;
    for (const dp of data) {
      const key = dp.id || `${dp.time}|${dp.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(dp);
        added++;
      }
      const ms = new Date(dp.time).getTime();
      if (oldest === null || ms < oldest) oldest = ms;
    }

    // Short page, or a page that told us nothing new -> we reached the start.
    if (data.length < PAGE_SIZE || added === 0 || oldest === null) break;
    if (oldest <= startMs) break;

    windowEnd = new Date(oldest).toISOString();
  }

  return results;
}

/**
 * Turn fetched datapoints into one CSV column block.
 *
 * default mode    -> union of timestamps + a per-variable lookup map, so a
 *                    payload carrying every variable at one timestamp collapses
 *                    into a dense row.
 * pair mode       -> a dense, independent [timestamp, value] series per
 *                    variable. Timestamps are pre-formatted once here so the
 *                    row builder stays a pure array index lookup.
 */
function makeBlock(alias, eui, sensorType, varList, variables, pairColumnsMode) {
  if (!pairColumnsMode) {
    const tsSet = new Set();
    for (const v of varList) {
      for (const dp of variables[v]) tsSet.add(dayjs(dp.time).toISOString());
    }
    const timestamps = Array.from(tsSet).sort((a, b) => new Date(a) - new Date(b));

    const valueMaps = {};
    for (const v of varList) {
      const map = new Map();
      for (const dp of variables[v]) map.set(dayjs(dp.time).toISOString(), dp.value);
      valueMaps[v] = map;
    }
    return { alias, eui, sensorType, varList, timestamps, valueMaps };
  }

  const perVarSeries = {};
  for (const v of varList) {
    const arr = variables[v];
    const series = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      series[i] = { ts: fmtUtc(arr[i].time), value: arr[i].value };   // T-EXPORT-UTC-01
    }
    perVarSeries[v] = series;
  }
  return { alias, eui, sensorType, varList, perVarSeries };
}

/** Row count of a block, for logging, in whichever shape it was built. */
function blockRows(block) {
  if (block.table) return block.rows.length;
  if (block.timestamps) return block.timestamps.length;
  return block.varList.reduce((max, v) => Math.max(max, block.perVarSeries[v].length), 0);
}

// === Main =================================================================

async function init(context, scope) {
  context.log("Field Export Data (MACC) started");

  const env = Utils.envToJson(context.environment);
  const accountToken = env.ACCOUNT_TOKEN || env.account_token;
  if (!accountToken || accountToken.length !== 36) {
    return context.log('Missing or invalid "ACCOUNT_TOKEN" environment variable');
  }

  const lang = String(env.CSV_LANGUAGE || "el").toLowerCase() === "en" ? "en" : "el";
  const labels = VARIABLE_LABELS[lang];
  const titles = DEVICE_TYPE_TITLES[lang];
  const t = TEXT[lang];
  const emailFrom = env.EMAIL_FROM || "reports@cyric-iot.eu";
  const clientIdField = env.CLIENT_ID_FIELD || DEFAULT_CLIENT_ID_FIELD;

  const account = new Account({ token: accountToken });
  const resources = new Resources({ token: accountToken });

  // --- Validation feedback back to the form widget -----------------------
  // Precedence: explicit env override, then whichever device the form posted
  // to, then the dedicated form data-source device.
  const formDeviceId =
    env.FORM_DEVICE_ID ||
    (scope.find((x) => x.device) || {}).device ||
    (scope.find((x) => x.origin) || {}).origin ||
    DEFAULT_FORM_DEVICE_ID;

  // A "Capture user" field carries the viewer's session id in its metadata.
  // When present, show the progress messages only to the user who submitted,
  // instead of to everyone currently looking at the widget.
  const withSession = scope.find((x) => x && x.metadata && x.metadata.session_id);
  const sessionId = withSession ? withSession.metadata.session_id : undefined;

  // Writing device data through Resources needs a token with device-data write
  // scope; a profile token that can read may still be denied here. Fall back to
  // a device token, exactly as the sensor reads do, and remember which route
  // works so we probe at most once per run instead of on every stage.
  let useDeviceToken = false;
  let formDevice = null;

  const postValidation = async (payload) => {
    if (!useDeviceToken) {
      try {
        return await resources.devices.sendDeviceData(formDeviceId, payload);
      } catch (err) {
        context.log(
          `[${VALIDATION_VARIABLE}] Resources write denied (${err && err.message ? err.message : err}); using a device token.`
        );
        useDeviceToken = true;
      }
    }
    if (!formDevice) {
      const token = await Utils.getTokenByName(account, formDeviceId);
      formDevice = new Device({ token });
    }
    return formDevice.sendData(payload);
  };

  const sendValidation = async (type, message) => {
    context.log(`[${VALIDATION_VARIABLE}] ${type}: ${message}`);
    if (!formDeviceId) return;
    const metadata = { type };
    if (sessionId) metadata.session_id = sessionId;
    try {
      await postValidation({ variable: VALIDATION_VARIABLE, value: message, metadata });
    } catch (err) {
      // Feedback is best-effort: never let it break an otherwise good export.
      context.log(`[${VALIDATION_VARIABLE}] send failed: ${err && err.message ? err.message : err}`);
    }
  };

  // Acknowledge the click before any slow work starts.
  await sendValidation("info", t.starting);

  try {
    // --- Inputs ------------------------------------------------------------
    const pairColumnsMode = String(scopeValue(scope, "pair_columns") || "").toLowerCase() === "true";
    const hideEui = scope.some((x) => String(x.variable).toLowerCase() === "hide_eui");
    // T-EXPORT-DISEASE-01: opt-in per form, so the other dashboards sharing
    // this analysis keep exactly the CSV they had.
    const includeDiseases = ["yes", "true", "1", "on"].includes(
      String(scopeValue(scope, "include_diseases") || "").trim().toLowerCase()
    );
    context.log(
      `pairColumnsMode=${pairColumnsMode} | hideEui=${hideEui} | includeDiseases=${includeDiseases} | lang=${lang}`
    );

    let startDate = dayjs().subtract(1, "month").toISOString();
    let endDate = dayjs().toISOString();

    const timePeriod = scope.find((x) => x.variable === "time_period");
    if (timePeriod && timePeriod.metadata && timePeriod.metadata.start_date) {
      startDate = timePeriod.metadata.start_date;
      endDate = timePeriod.metadata.end_date || endDate;
    }

    // T-EXPORT-UTC-01: διάστημα σε UTC (θέμα) · ημερομηνίες UTC (όνομα αρχείου, χωρίς «:»).
    const startDateString = dayjs(startDate).utc().format("YYYY-MM-DD HH:mm");
    const endDateString = dayjs(endDate).utc().format("YYYY-MM-DD HH:mm");
    const startFileDate = dayjs(startDate).utc().format("YYYY-MM-DD");
    const endFileDate = dayjs(endDate).utc().format("YYYY-MM-DD");

    const emailValue = String(scopeValue(scope, "email") || "").trim();
    if (!emailValue) {
      await sendValidation("danger", t.noEmail);
      return;
    }

    const locationValue = String(scopeValue(scope, "location") || "").trim();
    if (!locationValue) {
      await sendValidation("danger", t.noField);
      return;
    }

    // --- Resolve the Field device -----------------------------------------
    // The dropdown may hand us the device id (device-type field) or the label.
    let fieldInfo;
    if (isDeviceId(locationValue)) {
      fieldInfo = await account.devices.info(locationValue).catch(() => undefined);
    }
    if (!fieldInfo) {
      const candidates = await account.devices.list({
        amount: 500,
        fields: ["id", "name", "tags"],
        filter: { tags: [{ key: "clientId_field", value: clientIdField }] },
      });
      const wanted = locationValue.toLowerCase();
      const match =
        candidates.find((d) => tagValue(d.tags, "name") === locationValue) ||
        candidates.find((d) => d.name === locationValue) ||
        candidates.find((d) => String(tagValue(d.tags, "name") || "").toLowerCase() === wanted) ||
        candidates.find((d) => String(d.name).toLowerCase() === wanted) ||
        candidates.find((d) => String(d.name).toLowerCase().includes(wanted));
      if (match) fieldInfo = await account.devices.info(match.id);
    }

    if (!fieldInfo) {
      await sendValidation("danger", t.fieldNotFound(locationValue));
      return;
    }

    // The `name` tag is the display name; the device name is "Field_<name>".
    // A stale tag (e.g. a field cloned from another and never renamed) makes the
    // export label and filename claim the wrong field while the DATA is still
    // correct - two fields then produce identically named CSVs. Warn loudly.
    const nameTag = tagValue(fieldInfo.tags, "name");
    const nameFromDevice = String(fieldInfo.name).replace(/^Field_/, "");
    const fieldName = nameTag || nameFromDevice;
    if (nameTag && nameTag !== nameFromDevice) {
      context.log(
        `WARNING: field ${fieldInfo.id} has name tag "${nameTag}" but device name "${fieldInfo.name}". ` +
          `Using "${fieldName}" for labels and the filename - fix the name tag if this is wrong.`
      );
    }
    context.log(`Field: ${fieldName} (${fieldInfo.id})`);

    const sensors = parseDevicesTag(tagValue(fieldInfo.tags, "devices"));
    if (sensors.length === 0) {
      await sendValidation("danger", t.noSensors(fieldName));
      return;
    }

    // --- T-EXPORT-BUDGET-01: ίδια εξαγωγή μέσα σε 60΄ · όριο αναγνώσεων ανά αγρό ---------------
    READ_METER.n = 0;
    const exportKey = fnv1a([fieldInfo.id, startDate, endDate, emailValue.toLowerCase(), pairColumnsMode, hideEui, includeDiseases, lang].join("|"));
    let readEstimate = null;
    try {
      let est = 0;
      for (const sensor of sensors) {
        const counts = await Promise.all(monthWindows(startDate, endDate).map(([a, b]) =>
          resources.devices.getDeviceData(sensor.id, { query: "count", start_date: a, end_date: b })));
        for (const n of counts) est += Number(n) || 0;
      }
      readEstimate = est;
    } catch (err) {
      context.log(`[T-EXPORT-BUDGET-01] εκτίμηση απέτυχε (${err && err.message ? err.message : err}) — συνεχίζω χωρίς όριο.`);
    }
    let exportLogs = [];
    try {
      exportLogs = await resources.devices.getDeviceData(formDeviceId, { variables: [EXPORT_LOG_VARIABLE], qty: 50 });
    } catch (err) {
      context.log(`[T-EXPORT-BUDGET-01] ανάγνωση ${EXPORT_LOG_VARIABLE} απέτυχε (${err && err.message ? err.message : err}).`);
    }
    const writeExportLog = async (status) => {
      try {
        await postValidation({ variable: EXPORT_LOG_VARIABLE, value: fieldName, metadata: { field_id: fieldInfo.id, key: exportKey, status,
          start: startDate, end: endDate, reads: READ_METER.n, estimate: readEstimate, ts: new Date().toISOString(), ver: "T-EXPORT-BUDGET-01" } });
      } catch (err) { context.log(`[T-EXPORT-BUDGET-01] εγγραφή ${EXPORT_LOG_VARIABLE} απέτυχε (${err && err.message ? err.message : err}).`); }
    };
    const budget = exportBudgetDecision(exportLogs, Date.now(), exportKey, fieldInfo.id, readEstimate);
    context.log(`[T-EXPORT-BUDGET-01] εκτίμηση ${readEstimate} · 24ωρο αγρού ${budget.used} · απόφαση ${budget.action}`);
    if (budget.action === "duplicate") { await sendValidation("warning", t.duplicate(fieldName, budget.minutes)); return; }
    if (budget.action === "budget") { await sendValidation("warning", t.budget(fieldName, readEstimate, budget.used)); await writeExportLog("budget"); return; }

    // Reading a long period across every sensor is the slow part - say so.
    await sendValidation("info", t.fetching(fieldName));

    // --- Collect one block per sensor device -------------------------------
    const perDeviceBlocks = [];
    // Sensors we could not fully read. These must be reported: a CSV that is
    // quietly missing a sensor's columns is indistinguishable from one where
    // that sensor simply had no readings.
    const failedSensors = [];

    for (const sensor of sensors) {
      let info;
      try {
        info = await account.devices.info(sensor.id);
      } catch (err) {
        context.log(`Sensor ${sensor.key} (${sensor.id}) lookup failed: ${err && err.message ? err.message : err}`);
        failedSensors.push(sensor.key);
        continue;
      }

      const sensorType = resolveSensorType(info, sensor.key);
      if (!sensorType || NON_SENSOR_TYPES.has(sensorType)) {
        context.log(`Skipping ${info.name}: type "${sensorType || sensor.key}" carries no sensor data.`);
        continue;
      }

      const varList = DEVICE_TYPE_VARIABLES[sensorType];
      if (!varList || varList.length === 0) {
        context.log(`Skipping ${info.name}: unmapped sensor type "${sensorType}".`);
        continue;
      }

      const eui = tagValue(info.tags, "eui") || "N/A";
      const alias = `${fieldName} - ${titles[sensorType] || sensorType}`;

      let read;
      try {
        read = await makeReader(resources, account, sensor.id, (m) => context.log(m));
      } catch (err) {
        context.log(`Sensor ${info.name}: no usable read path (${err && err.message ? err.message : err})`);
        failedSensors.push(info.name);
        continue;
      }

      const readErrors = [];
      const variables = {};
      await Promise.all(
        varList.map(async (v) => {
          variables[v] = await fetchAllData(read, v, startDate, endDate, (m) => context.log(m), readErrors);
        })
      );
      // T-EXPORT-RAIN-01: βροχή ανά μέτρηση από τον αθροιστικό μετρητή (σταθμοί firmware 2.0).
      if (variables.rain_height_acc && variables.rain_height_acc.length > 1) {
        variables.rain_height_acc_increment = accIncrementSeries(variables.rain_height_acc);
      }
      let varListWithData = varList
        .concat(variables.rain_height_acc_increment ? ["rain_height_acc_increment"] : [])
        .filter((v) => variables[v] && variables[v].length > 0);

      // Stale `type` tag safety net: retry with the whole family before giving up.
      if (varListWithData.length === 0 && TYPE_FAMILY_FALLBACK[sensorType]) {
        const extras = TYPE_FAMILY_FALLBACK[sensorType].filter((v) => !varList.includes(v));
        context.log(`${info.name}: no data for "${sensorType}" vars, retrying family fallback.`);
        await Promise.all(
          extras.map(async (v) => {
            variables[v] = await fetchAllData(read, v, startDate, endDate, (m) => context.log(m));
          })
        );
        varListWithData = TYPE_FAMILY_FALLBACK[sensorType].filter(
          (v) => variables[v] && variables[v].length > 0
        );
      }

      if (varListWithData.length > 0) {
        const block = makeBlock(alias, eui, sensorType, varListWithData, variables, pairColumnsMode);
        perDeviceBlocks.push(block);
        context.log(
          `Prepared ${alias} | eui=${eui} | vars: ${varListWithData.join(", ")} | rows: ${blockRows(block)}`
        );
      } else {
        context.log(`Skipping ${info.name}: no data in selected period.`);
      }

      // --- Off-cadence variables, one block per group -----------------------
      // Rain aggregates and derived indices run on their own clocks. Each gets
      // its own Timestamp column so it never blanks out the sensor rows.
      for (const group of EXTRA_BLOCK_GROUPS[sensorType] || []) {
        const groupValues = {};
        await Promise.all(
          group.vars.map(async (v) => {
            groupValues[v] = await fetchAllData(read, v, startDate, endDate, (m) => context.log(m), readErrors);
          })
        );
        // T-KBDI-FIX-01: μόνο εγγραφές του διορθωμένου υπολογισμού (οι παλιές είναι άκυρες και έχουν τον ίδιο χρόνο).
        if (group.onlyAlg) {
          for (const v of group.vars) {
            const all = groupValues[v] || [];
            groupValues[v] = all.filter((dp) => dp && dp.metadata && dp.metadata.alg === group.onlyAlg);
            if (groupValues[v].length !== all.length) context.log(`${info.name}: ${v} ${all.length} -> ${groupValues[v].length} (μόνο ${group.onlyAlg})`);
          }
        }
        // T-EXPORT-RAIN-01: μία τιμή ανά ώρα + διάστημα / κάλυψη / ποιότητα από τα metadata της εγγραφής.
        if (group.withPeriod) {
          const src = groupValues[group.vars[0]] || [];
          if (src.length > 0) {
            const kept = bestHourlyPerPeriod(src);
            if (kept.length !== src.length) context.log(`${info.name}: ${group.vars[0]} ${src.length} -> ${kept.length} (μία ανά ώρα)`);
            groupValues[group.vars[0]] = kept;
            const col = (name, fn) => {
              groupValues[name] = kept.map((dp) => ({ time: dp.time, value: fn(dp) })).filter((x) => x.value !== "" && x.value != null);
            };
            col("rain_hourly_period_start_utc", (dp) => { const p = rainPeriodOf(dp); return p ? fmtUtc(p.s) : ""; });
            col("rain_hourly_period_end_utc", (dp) => { const p = rainPeriodOf(dp); return p ? fmtUtc(p.e) : ""; });
            col("rain_hourly_coverage", rainCoveragePct);
            col("rain_hourly_quality", (dp) => rainQualityText(dp, lang));
          }
        }
        const groupVarList = group.withPeriod ? group.vars.concat(RAIN_HOURLY_META) : group.vars;
        const groupWithData = groupVarList.filter((v) => groupValues[v] && groupValues[v].length > 0);

        if (groupWithData.length === 0) {
          context.log(`${info.name}: no "${group.label}" data in selected period.`);
          continue;
        }

        const groupAlias = `${alias} (${t[group.label] || group.label})`;
        const groupBlock = makeBlock(groupAlias, eui, sensorType, groupWithData, groupValues, pairColumnsMode);
        perDeviceBlocks.push(groupBlock);
        context.log(
          `Prepared ${groupAlias} | eui=${eui} | vars: ${groupWithData.join(", ")} | rows: ${blockRows(groupBlock)}`
        );
      }

      // Reported only now, so failures from the daily reads above are counted
      // too - otherwise a truncated export could still claim clean success.
      if (readErrors.length > 0) failedSensors.push(`${info.name} (${readErrors.join(", ")})`);
    }

    // --- Disease record (T-EXPORT-DISEASE-01) -------------------------------
    let diseaseHasData = false;
    if (includeDiseases) {
      try {
        const fieldRead = await makeReader(resources, account, fieldInfo.id, (m) => context.log(m));
        const disease = await buildDiseaseBlocks({
          read: fieldRead,
          fieldName,
          startDate,
          endDate,
          lang,
          t,
          log: (m) => context.log(m),
        });
        for (const b of disease.blocks) perDeviceBlocks.push(b);
        diseaseHasData = disease.hasData;
        for (const f of disease.failed) failedSensors.push(f);
      } catch (err) {
        context.log(`Disease record failed: ${err && err.stack ? err.stack : err}`);
        failedSensors.push(t.diseaseRecord);
      }
    }

    const sensorBlockCount = perDeviceBlocks.filter((b) => !b.table).length;
    if (sensorBlockCount === 0 && !diseaseHasData) {
      // "No measurements" is only true if the sensors were actually readable;
      // otherwise say so, rather than blaming an empty period.
      if (failedSensors.length > 0) {
        await sendValidation("danger", t.allFailed(fieldName, failedSensors.join("; ")));
      } else {
        await sendValidation("warning", t.noData(fieldName));
      }
      return;
    }

    // --- Headers: title / EUI / column ------------------------------------
    const headerRow1 = [];
    const headerRowEui = [];
    const headerRow2 = [];

    for (const d of perDeviceBlocks) {
      const blockWidth = d.table
        ? d.columns.length
        : pairColumnsMode
        ? 2 * d.varList.length
        : 2 + d.varList.length;   // T-EXPORT-UTC-01: Χρόνος UTC + Ώρα Ελλάδας

      for (let i = 0; i < blockWidth; i++) headerRow1.push(d.alias);
      for (let i = 0; i < blockWidth; i++) headerRowEui.push(d.eui);

      if (d.table) {
        for (const c of d.columns) headerRow2.push(c);
      } else if (!pairColumnsMode) {
        headerRow2.push(t.timestamp);
        headerRow2.push(t.timestampLocal);
        for (const v of d.varList) headerRow2.push(labels[v] || v);
      } else {
        for (const v of d.varList) {
          const label = labels[v] || v;
          headerRow2.push(t.timestampFor(label));
          headerRow2.push(label);
        }
      }
    }

    const headerBlocks = [csvRow(headerRow1)];
    if (!hideEui) headerBlocks.push(csvRow(headerRowEui));
    headerBlocks.push(csvRow(headerRow2));

    // --- Data rows ---------------------------------------------------------
    // Table blocks (disease record) carry ready-made rows, aligned by index
    // like every other block; they are blank once their rows run out.
    const pushTableCells = (row, d, i) => {
      const r = d.rows[i];
      for (let c = 0; c < d.columns.length; c++) row.push(r ? r[c] ?? "" : "");
      return !!r;
    };

    const dataRows = [];

    if (!pairColumnsMode) {
      const globalMaxRows = perDeviceBlocks.reduce(
        (max, d) => Math.max(max, d.table ? d.rows.length : d.timestamps.length),
        0
      );

      for (let i = 0; i < globalMaxRows; i++) {
        const row = [];
        for (const d of perDeviceBlocks) {
          if (d.table) {
            pushTableCells(row, d, i);
            continue;
          }
          const iso = d.timestamps[i];
          row.push(iso ? fmtUtc(iso) : "");
          row.push(iso ? fmtLocal(iso) : "");
          for (const v of d.varList) {
            row.push(iso ? d.valueMaps[v].get(iso) ?? "" : "");
          }
        }
        dataRows.push(csvRow(row));
      }
    } else {
      // Each column pair is filled independently from its own pre-formatted
      // series, newest-first (TagoIO's default ordering).
      let globalMaxRows = 0;
      for (const d of perDeviceBlocks) {
        if (d.table) {
          if (d.rows.length > globalMaxRows) globalMaxRows = d.rows.length;
          continue;
        }
        for (const v of d.varList) {
          if (d.perVarSeries[v].length > globalMaxRows) globalMaxRows = d.perVarSeries[v].length;
        }
      }

      for (let i = 0; i < globalMaxRows; i++) {
        const row = [];
        let rowHasAny = false;

        for (const d of perDeviceBlocks) {
          if (d.table) {
            if (pushTableCells(row, d, i)) rowHasAny = true;
            continue;
          }
          for (const v of d.varList) {
            const point = d.perVarSeries[v][i];
            if (point) {
              row.push(point.ts);
              row.push(point.value ?? "");
              rowHasAny = true;
            } else {
              row.push("");
              row.push("");
            }
          }
        }

        if (!rowHasAny) continue;
        dataRows.push(csvRow(row));
      }
    }

    // --- Split and send ----------------------------------------------------
    const parts = splitCSVBySize(headerBlocks, dataRows);
    context.log(`CSV: ${dataRows.length} data rows -> ${parts.length} part(s)`);

    // T-EXPORT-UTC-01: η περιγραφή συνοδεύει ΠΑΝΤΑ τα δεδομένα.
    const exportedVars = [];
    for (const d of perDeviceBlocks) if (!d.table) for (const v of d.varList) if (!exportedVars.includes(v)) exportedVars.push(v);
    const [dictionary, changelog] = await Promise.all([fetchPublicJson("sag-data-dictionary.json"), fetchPublicJson("sag-changelog.json")]);
    const about = describeExport(lang, exportedVars, { dictionary, changelog }, (m) => context.log(m));

    const emailService = new Services({ token: context.token }).email;
    const safeFieldName = fieldName.replace(/[\\/:*?"<>|,]/g, "_");

    await sendValidation("info", t.sending(parts.length));

    try {
      for (const p of parts) {
        const filename = `${safeFieldName}_${startFileDate}_${endFileDate}_UTC_${p.filenameSuffix}.csv`;
        await emailService.send({
          to: emailValue,
          subject: t.subject(fieldName, p.filenameSuffix, startDateString, endDateString),
          message: t.body(p.filenameSuffix, about),
          from: emailFrom,
          attachment: { archive: p.csvString, filename },
        });
        context.log(`Sent ${filename} to ${emailValue}`);
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      await sendValidation("danger", t.failed(msg));
      await logUsage(context, env, `Error! Email was not sent! (${msg})`, "error");
      return;
    }

    await writeExportLog(failedSensors.length > 0 ? "partial" : "ok");   // T-EXPORT-BUDGET-01 (πριν το τελικό μήνυμα)
    context.log(`[T-EXPORT-BUDGET-01] αναγνώσεις ${READ_METER.n} (εκτίμηση ${readEstimate})`);
    if (failedSensors.length > 0) {
      await sendValidation("warning", t.partial(fieldName, parts.length, failedSensors.join("; ")));
    } else {
      await sendValidation("success", t.ok(fieldName, parts.length));
    }
    await logUsage(
      context,
      env,
      `Email(s) sent: ${parts.length} part${parts.length > 1 ? "s" : ""}` +
        (failedSensors.length > 0 ? ` | incomplete: ${failedSensors.join("; ")}` : ""),
      failedSensors.length > 0 ? "warning" : "success"
    );
  } catch (err) {
    // Never leave the widget stuck on "Exporting..." - surface the failure.
    const msg = err && err.message ? err.message : String(err);
    context.log(`Unexpected failure: ${err && err.stack ? err.stack : msg}`);
    await sendValidation("danger", t.failed(msg));
    await logUsage(context, env, `Error! Export failed (${msg})`, "error");
  }
}

/** Optional legacy usage-statistics bucket. Absent = skip, never fail the run. */
async function logUsage(context, env, value, type) {
  const token = env.USAGE_STATISTICS_DEVICE_TOKEN;
  if (!token) return;
  try {
    await new Device({ token }).sendData({
      variable: "field_export_validation",
      value,
      metadata: { type },
    });
  } catch (err) {
    context.log(`Usage statistics write failed: ${err && err.message ? err.message : err}`);
  }
}

// Exported for analysis/test/export_disease_check.mjs; TagoIO ignores it.
module.exports = new Analysis(init);
module.exports._test = { decodeBundleKey, decodeBundleCrops, buildDiseaseBlocks, cropLabel, parseDeclaration, describeExport, fmtUtc, fmtLocal,
  accIncrementSeries, bestHourlyPerPeriod, rainQualityText, rainCoveragePct, rainPeriodOf };
