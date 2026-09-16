// src/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "@tago-io/custom-widget";
import "@tago-io/custom-widget/dist/custom-widget.css";
import "./Dashboard.css";

import { MeasurementModal, RefLine, TimePoint } from "./MeasurementModal";
import { PathoModal } from "./PathoModal";
import { PATHOGENS, VARS_PATHO } from "./config/pathogens";
import { MEAS_TABLE_DEFAULT, ENV_SOURCES_DEFAULT } from "./config/measurements";
import { IrrigationModal, IrrigationDeviceSummary, IrrigationCommand } from "./IrrigationModal";
import { DeviceMeasurementsModal } from "./DeviceMeasurementsModal.grid";
import { getVarConfig, VARIABLES_CONFIG } from "./config/variablesConfig";
import { EnvironmentConditionsModal } from "./EnvironmentConditionsModal";
import { AllMeasurementsModal } from "./AllMeasurementsModal.grid";
import { ForecastModal, wmoToHuman, toKmhFromUnit, formatWithConfig } from "./ForecastModal";
import { CultivationCalendarModal, FIELD_CALENDAR_VAR, CalendarPoint } from "./CultivationCalendarModal";
import { SprayModal, computeSprayRecommendation, STATUS_LABEL, SprayStatusIcon } from "./SprayModal";

declare global {
  interface Window {
    TagoIO: any;
  }
}

const BASE_ORIGIN = "https://smart-agrogenius.tago.run";

// Packed single-variable bundle
const FIELD_BUNDLE_VAR = "field_bundle";
// Overflow companion written by runPerTich when a field is too big for one 10kB bundle
// (holds the spilled pathogen/pest family). Absent on small/legacy fields — merge is a no-op.
const FIELD_BUNDLE_2_VAR = "field_bundle_2";

export type LatestEntry = {
  value: any;
  metadata: any;
  unit?: string;
  time: string | null;
};

type AppState = {
  latest: Record<string, LatestEntry>;
  /** Latest point per variable per device (avoids collisions across devices) */
  latestByDevice: Record<string, Record<string, LatestEntry>>;
  /** Latest point per forecast_* variable (dynamic suffix _YYYYMMDD) */
  forecastLatest: Record<string, LatestEntry>;
  config: any | null;
  irrigationDevices: Record<string, IrrigationDeviceSummary>;
  history: Record<string, Record<string, TimePoint[]>>; // deviceId -> variable -> series
  /** Non-numeric historical points for the cultivation calendar */
  calendarHistory: Record<string, CalendarPoint[]>; // deviceId -> points
};

type TabTargets = {
  bpi: number;
  stress: number;
  patho: number;
  irrig: number;
  config: number;
};

const DEFAULT_TAB_TARGETS: TabTargets = {
  bpi: 0,
  stress: 0,
  patho: 1,
  irrig: 4,
  config: 3,
};

const IRR_VARS_SET = new Set<string>([
  "batterypct",
  "valve_1",
  "valve_2",
  "valve_1_command",
  "valve_2_command",
  "valve_1_time_command",
  "valve_2_time_command",
  "valve_1_pulse",
  "valve_2_pulse",
  "hw_version",
  "rules_enabled_mask",
  "rule1",
  "rule2",
  "rule3",
  "rule4",
  "rule5",
  "rule6",
  "rule7",
  "rule8",
  "rule9",
  "rule10",
  "rule11",
  "rule12",
  "rule13",
  "rule14",
  "rule15",
  "rule16",
  "plan1",
  "plan2",
  "plan3",
  "plan4",
  "plan5",
  "plan6",
  "plan7",
  "plan8",
  "plan9",
  "plan10",
  "plan11",
  "plan12",
  "plan13",
  "plan14",
  "plan15",
  "plan16",
]);

// Controller COMMAND variables (valve on/off, timed open, rule enable/set). These are the ones the
// widget sends stamped with metadata.target_device. With autofill ON (required so the widget's
// analysis_run fires), TagoIO broadcasts a command into EVERY controller data source that declares
// it — so a command to one UC511 would otherwise light up valves/rules on the other controllers.
const CONTROLLER_CMD_RE = /^(valve_\d+_command|valve_\d+_time_command|rule\d+_(enable|set))$/i;
const isControllerCmdVar = (v: string) => CONTROLLER_CMD_RE.test(v);

/* ---------------- Labels for cultivation ---------------- */
const GR_LABELS: any = {
  cultivation_type_general: {
    olive: "Ελιά",
    vineCrops: "Αμπέλι",
    cerealCrops: "Σιτηρά",
    vegetableCrops: "Λαχανικά",
    citrusFruits: "Εσπεριδοειδή",
    stoneFruits: "Πυρηνόκαρπα",
    pomeFruits: "Μηλοειδή",
    subTropicalFruits: "Υποτροπικά",
    nutCrops: "Καρποφόρα με κέλυφος",
    industrialCrops: "Βιομηχανικές",
    specialtyMediterranean: "Μεσογειακά ειδικά",
    ornamentalCrops: "Ανθοκομικά/Καλλωπιστικά",
  },
  cultivation_type: {
    koroneiki: "Κορωνέικη",
    wine_grapes: "Οινοποιήσιμες",
    table_grapes: "Επιτραπέζιες",
    raisin_grapes: "Σταφίδες",
    wheat: "Σιτάρι",
    barley: "Κριθάρι",
    maize: "Καλαμπόκι",
    oats: "Βρώμη",
    onion: "Κρεμμύδι",
    watermelon: "Καρπούζι",
    potato: "Πατάτα",
    dry_beans: "Ξηρά Φασόλια",
    green_beans: "Φασολάκια",
    cabbage: "Λάχανο",
    lettuce: "Μαρούλι",
    carrot: "Καρότο",
    cucumber: "Αγγούρι",
    tomato: "Ντομάτα",
    eggplant: "Μελιτζάνα",
    pepper: "Πιπεριά",
    strawberry: "Φράουλα",
    garlic: "Σκόρδο",
    zucchini: "Κολοκύθι",
    melon: "Πεπόνι",
    broccoli: "Μπρόκολο",
    orange: "Πορτοκάλι",
    lemon: "Λεμόνι",
    mandarin: "Μανταρίνι",
    peach: "Ροδακινιά",
    nectarine: "Νεκταρινιά",
    apricot: "Βερικοκιά",
    plum: "Δαμασκηνιά",
    cherry: "Κερασιά",
    apple: "Μηλιά",
    kiwi: "Ακτινίδιο",
    pomegranate: "Ρόδι",
    fig: "Συκιά",
    almond: "Αμυγδαλιά",
    pistachio: "Φιστικιά",
    walnut: "Καρυδιά",
    chestnut: "Καστανιά",
    cotton: "Βαμβάκι",
    tobacco: "Καπνός",
    sunflower: "Ηλίανθος",
    sugar_beet: "Ζαχαρότευτλο",
    saffron: "Κρόκος",
    mastic_tree: "Μαστιχόδενδρο",
    oregano: "Ρίγανη",
    thyme: "Θυμάρι",
    rosemary: "Δενδρολίβανο",
    sage: "Φασκόμηλο",
    mint: "Μέντα",
    bay_laurel: "Δάφνη",
    currants: "Φραγκοστάφυλα",
    carob: "Χαρουπιά",
    artichoke: "Αγκινάρα",
    floriculture_generic: "Ανθοκομικά (γενικό)",
  },
};

function humanizeKey(k: string | null | undefined) {
  if (!k) return "—";
  return String(k)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
function greekLabel(group: string, key: string | null | undefined) {
  if (!key) return "—";
  const raw = String(key);
  // 1) exact match
  const direct = GR_LABELS?.[group]?.[raw as string];
  if (direct) return direct;

  // 2) case-insensitive match (handles vegetableCrops / vegetablecrops / Vegetablecrops etc.)
  const lower = raw.toLocaleLowerCase("en");
  const dict = GR_LABELS?.[group] || {};
  for (const k of Object.keys(dict)) {
    if (k.toLocaleLowerCase("en") === lower) return dict[k];
  }

  // 3) fallback: humanized key
  return humanizeKey(raw);
}

type PackedIndicator = { value: any; metadata?: any } | any;
function isPackedIndicator(x: any): x is PackedIndicator {
  return !!x && typeof x === "object" && Object.prototype.hasOwnProperty.call(x, "value");
}

function unpackIndicator(x: any): { value: any; metadata: any } {
  if (isPackedIndicator(x)) {
    return { value: x.value, metadata: x.metadata || {} };
  }
  return { value: x, metadata: {} };
}

function parseCropId(id: string | null | undefined): {
  general: string | null;
  type: string | null;
} {
  if (!id) return { general: null, type: null };
  const s = String(id);
  const parts = s.split(":");
  if (parts.length >= 2) return { general: parts[0] || null, type: parts[1] || null };
  return { general: s, type: null };
}

function cropLabelFromId(id: string | null | undefined): string {
  const { general, type } = parseCropId(id);
  if (!general) return "—";
  const g = greekLabel("cultivation_type_general", general);
  const t = type ? greekLabel("cultivation_type", type) : "";
  return t ? `${g} • ${t}` : g;
}

function getPrimaryCropFromConfig(cfg: any): { cultivation_type_general?: any; cultivation_type?: any } | null {
  if (!cfg) return null;
  if (Array.isArray((cfg as any).crops) && (cfg as any).crops.length) return (cfg as any).crops[0];
  if ((cfg as any).cultivation_type_general || (cfg as any).cultivation_type) {
    return {
      cultivation_type_general: (cfg as any).cultivation_type_general,
      cultivation_type: (cfg as any).cultivation_type,
    };
  }
  return null;
}

function badgeColorFallback(label: any, fallback: string) {
  const s = String(label || "").toLocaleLowerCase("el");
  // Keep it aligned with production semantics (green ideal, yellow moderate, red high risk)
  if (s.includes("ιδαν")) return "green";
  if (s.includes("υψηλ") || s.includes("κρίσι") || s.includes("κινδ")) return "red";
  if (s.includes("μέτρ") || s.includes("μέση") || s.includes("προσοχ")) return "yellow";
  return fallback;
}

/* Vars used by main cards  */
const VARS_BASE = [
  "configuration",
  FIELD_BUNDLE_VAR,
  FIELD_BUNDLE_2_VAR,
  FIELD_CALENDAR_VAR,
  "bpi_message",
  "plant_stress",
  "air_temperature",
  "air_humidity",
  "soil_moisture1",
  "soil_temperature1",
  "soil_moisture2",
  "soil_temperature2",
  "forecast",
  "subscription_until",
  "history_data", // on-demand range fetch response (points in metadata) — see MeasurementModal
];

const ENV_VARS_BASE = [
  "innodays2025_cold",
  "innodays2025_midheat_lowwind",
  "innodays2025_midheat_highwind",
  "innodays2025_highheat_lowwind",
  "innodays2025_highheat_highwind",
];

let VARS_SET = new Set<string>([...VARS_BASE, ...VARS_PATHO, ...ENV_VARS_BASE, ...IRR_VARS_SET]);

/* ---------------- Bundle helpers ---------------- */

function isPackedObject(x: any): x is { value: any; metadata?: any } {
  return x && typeof x === "object" && Object.prototype.hasOwnProperty.call(x, "value");
}

function unpackValue(x: PackedIndicator) {
  return isPackedObject(x) ? x.value : x;
}

function unpackMeta(x: PackedIndicator) {
  if (isPackedObject(x)) return x.metadata && typeof x.metadata === "object" ? x.metadata : {};
  return {};
}

function badgeClassFromEntry(entry: LatestEntry | undefined, fallback: string) {
  if (!entry) return fallback;
  const c = entry?.metadata?.color;
  if (c) return `badge b-${String(c)}`;

  // Fallback: infer from Greek label text (production-like behavior)
  const v = String(entry.value || "").toLowerCase();
  // [QW-1 legacy-handoff] Never paint an ambiguous "high" (στρες/κίνδυνος) GREEN — green reads as
  // "relax" to a farmer, and this fallback is the live path whenever the kernel omits metadata.color.
  if (v.includes("ιδαν")) return "badge b-green";                            // ideal → green
  if (v.includes("κρίσι") || v.includes("κινδ")) return "badge b-red";       // critical/danger → red
  if (v.includes("υψηλ")) return "badge b-orange";                           // "high" (stress/risk) → orange, not green
  if (v.includes("μέτ") || v.includes("μέσ")) return "badge b-yellow";
  if (v.includes("χαμη")) return "badge b-green";                            // "low" (stress/risk) → green (reassuring)
  return fallback;
}

// --- Forecast variables must be static for TagoIO widget data binding ---
// We declare a fixed window of N days ahead: forecast_*{dayIndex}
const FORECAST_DAYS = 5; // AccuWeather daily/5day endpoint
const FORECAST_BASE_VARS = [
  "forecast_date",
  "forecast_min_temp",
  "forecast_max_temp",
  "forecast_day_icon",
  "forecast_day",
  "forecast_night_icon",
  "forecast_night",
  "forecast_precipitation_day",
  "forecast_precipitation_night",
  "forecast_wind_speed",
  "forecast_wind_direction",
  "forecast_total_liquid_day",
  "forecast_rain_day",
  "forecast_snow_day",
  "forecast_ice_day",
  "forecast_total_liquid_night",
  "forecast_rain_night",
  "forecast_snow_night",
  "forecast_ice_night",
  "forecast_humidity_min_day",
  "forecast_humidity_max_day",
  "forecast_humidity_avg_day",
  "forecast_humidity_min_night",
  "forecast_humidity_max_night",
  "forecast_humidity_avg_night",
];
for (let i = 1; i <= FORECAST_DAYS; i++) {
  for (const b of FORECAST_BASE_VARS) VARS_SET.add(`${b}${i}`);
}

for (let i = 1; i <= 16; i++) {
  VARS_SET.add(`rule${i}`);
  VARS_SET.add(`rule${i}_enable`); // optional, see note below
}

/* Helpers */
function byTimeDesc(a: any, b: any) {
  const ta = new Date(a.time || a.created_at || 0).getTime();
  const tb = new Date(b.time || b.created_at || 0).getTime();
  return tb - ta;
}
function pickBadgeClass(label: any, fallbackBlue = false) {
  const s = String(label || "").toLowerCase();
  if (s.includes("πολύ χαμηλή")) return "b-red";
  if (s.includes("μέτρια")) return "b-blue";
  if (s.includes("υψηλή")) return "b-green";
  if (s.includes("υψηλό")) return "b-red";
  if (s.includes("μέτριο")) return "b-yellow";
  if (s.includes("χαμηλό")) return "b-green";

  if (s.includes("Μην ποτίζεις")) return "b-blue";
  if (s.includes("Ιδανικό")) return "b-green";
  if (s.includes("Προγραμμάτισε πότισμα")) return "b-yellow";
  if (s.includes("Πότισε τώρα!")) return "b-red";

  return fallbackBlue ? "b-blue" : "b-yellow";
}
function labelToLevel(label: any) {
  const s = String(label || "").toLowerCase();
  if (s.includes("χαμηλ")) return 1;
  if (s.includes("μέτρι") || s.includes("μετρι")) return 2;
  if (s.includes("υψηλ")) return 3;
  if (s.includes("σοβαρ")) return 4;
  return 0;
}
function fmtNum(x: any, dec = 1) {
  if (x === null || x === undefined || x === "") return "—";
  const n = Number.parseFloat(x);
  return Number.isFinite(n) ? n.toFixed(dec) : "—";
}

function makeURL(dashboardId: string, tab: number) {
  const u = new URL(`${BASE_ORIGIN}/dashboards/info/${dashboardId}`);
  u.searchParams.set("tab", String(tab));
  return u.toString();
}

/* Params helpers */
function getParam(widget: any, key: string) {
  const arr = widget?.display?.parameters || [];
  const p = arr.find((x: any) => String(x?.key || "") === key);
  return p?.value ?? null;
}
function getNumberParam(widget: any, key: string) {
  const val = getParam(widget, key);
  if (val === null || val === undefined || val === "") return null;
  const n = Number.parseInt(String(val).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/* Tab targets from params */
function computeTabTargets(widget: any): {
  dashboardId: string | null;
  tabTargets: TabTargets;
} {
  let tabTargets: TabTargets = { ...DEFAULT_TAB_TARGETS };
  const dashboardId = getParam(widget, "dashboard_id") || null;

  const configTabParam = getNumberParam(widget, "config_tab");
  if (configTabParam !== null) tabTargets.config = configTabParam;

  try {
    const rawMap = getParam(widget, "tabs_map");
    if (rawMap) {
      const obj = typeof rawMap === "string" ? JSON.parse(rawMap) : rawMap;
      if (obj && typeof obj === "object") {
        const next: any = { ...tabTargets };
        for (const k of Object.keys(obj)) {
          const coerced = Number.parseInt(String(obj[k]).trim(), 10);
          if (Number.isFinite(coerced)) next[k] = coerced;
        }
        tabTargets = next;
      }
    }
  } catch (e) {
    console.warn("tabs_map parse error:", e);
  }

  return { dashboardId, tabTargets };
}

/* vars_table param -> MEAS_TABLE (only for filtering/order, not labels) */
function buildMeasTable(widget: any): Map<string, { label: string; tab: number }> {
  try {
    const raw = getParam(widget, "vars_table");
    if (!raw) return new Map(Object.entries(MEAS_TABLE_DEFAULT));
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object") {
      return new Map(Object.entries(obj as any));
    }
  } catch (e) {
    console.warn("vars_table parse error:", e);
  }
  return new Map(Object.entries(MEAS_TABLE_DEFAULT));
}

/* env_sources param -> ENV_SOURCES_DEFAULT */
function buildEnvSources(widget: any): Record<string, string[]> {
  let env = { ...ENV_SOURCES_DEFAULT };
  try {
    const raw = getParam(widget, "env_sources");
    if (!raw) return env;
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object") {
      const next: any = { ...env };
      for (const k of Object.keys(obj)) {
        if (Array.isArray((obj as any)[k])) {
          next[k] = (obj as any)[k].map((x: any) => String(x));
        }
      }
      env = next;
    }
  } catch (e) {
    console.warn("env_sources parse error:", e);
  }
  return env;
}

/* expand VARS_SET with env sources */
function expandVARSWithEnvSources(envSources: Record<string, string[]>) {
  for (const arr of Object.values(envSources)) {
    for (const k of arr) VARS_SET.add(String(k));
  }
}

/* Latest-of helper */
function latestOf(latest: Record<string, LatestEntry>, varKeys: string[]): any {
  for (const k of varKeys) {
    const e = latest[k];
    if (e != null && e.value != null) return e.value;
  }
  return null;
}

/* --- field_bundle decompression (browser DecompressionStream, deflate-raw + base64) --- */
async function decompressFieldBundleMeta(meta: any): Promise<any> {
  if (meta?.schema?.compression !== 'deflate-raw-base64' || !meta?.data) return meta;
  try {
    const binary = atob(meta.data);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const ds = new (window as any).DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(bytes);
    writer.close();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((n: number, c: Uint8Array) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    const parsed = JSON.parse(new TextDecoder().decode(out));
    return { ...parsed, schema: meta.schema };
  } catch (e) {
    console.warn('[field_bundle] decompress failed:', e);
    return meta;
  }
}

const isBundleVar = (v: any) => v === FIELD_BUNDLE_VAR || v === FIELD_BUNDLE_2_VAR;

async function preprocessFieldBundles(buckets: any[]): Promise<any[]> {
  if (!Array.isArray(buckets)) return buckets;
  return Promise.all(
    buckets.map(async (b) => {
      if (Array.isArray(b?.result)) {
        const result = await Promise.all(
          b.result.map(async (it: any) => {
            if (!isBundleVar(it?.variable)) return it;
            const meta = await decompressFieldBundleMeta(it?.metadata);
            return meta === it?.metadata ? it : { ...it, metadata: meta };
          })
        );
        return { ...b, result };
      }
      // Direct data point (widget.data format)
      if (isBundleVar(b?.variable)) {
        const meta = await decompressFieldBundleMeta(b?.metadata);
        return meta === b?.metadata ? b : { ...b, metadata: meta };
      }
      return b;
    })
  );
}

/* Deep-merge the overflow bundle (field_bundle_2) into the primary: union shared + per-crop
   indicators by crop id. Placement of a key across the two parts is transparent here. */
function mergeBundles(a: any, b: any): any {
  if (!b || (!Array.isArray(b.crops) && !b.shared)) return a;
  const byId: Record<string, any> = {};
  for (const c of Array.isArray(a?.crops) ? a.crops : []) {
    if (c?.id == null) continue;
    byId[String(c.id)] = { ...c, indicators: { ...(c.indicators || {}) } };
  }
  for (const c of Array.isArray(b?.crops) ? b.crops : []) {
    if (c?.id == null) continue;
    const id = String(c.id);
    byId[id] = byId[id] || { id: c.id, indicators: {} };
    byId[id].indicators = { ...byId[id].indicators, ...(c.indicators || {}) };
  }
  return {
    ...a,
    shared: { ...(a?.shared || {}), ...(b?.shared || {}) },
    crops: Object.values(byId),
  };
}

/* Apply incoming buckets -> new AppState */
function applyBuckets(prev: AppState, buckets: any[]): AppState {
  if (!Array.isArray(buckets) || !buckets.length) return prev;

  const latest = { ...prev.latest };
  const latestByDevice: Record<string, Record<string, LatestEntry>> = {
    ...(prev.latestByDevice || {}),
  };
  const forecastLatest = { ...(prev.forecastLatest || {}) };
  let config = prev.config;
  const irrigationDevices: Record<string, IrrigationDeviceSummary> = {
    ...prev.irrigationDevices,
  };
  const history: Record<string, Record<string, TimePoint[]>> = {
    ...prev.history,
  };
  const calendarHistory: Record<string, CalendarPoint[]> = {
    ...(prev.calendarHistory || {}),
  };
  const MAX_POINTS = 10000;
  const MAX_CAL_POINTS = 250;

  for (const b of buckets) {
    const arr = b?.result || [];
    if (!Array.isArray(arr) || !arr.length) continue;

    // Device for every record in this bucket. In TagoIO widget data the device
    // is defined at the bucket level (b.origin / b.bucket), NOT on each record —
    // so multiple devices/controllers must be keyed from here. Without this they
    // all collapse to "unknown" and two-UC511 dashboards merge into one.
    const bucketDev =
      b?.origin || b?.bucket || b?.device || b?.device_id || b?.bucket_id || null;

    // ---------- history + latest ----------
    for (const it of arr) {
      const v = it?.variable;
      if (!v) continue;
      const devId =
        it.device || it.origin || it.bucket || it.device_id || it.bucket_id || bucketDev || "unknown";

      // Multi-controller safety: a command stamped with metadata.target_device is meant for ONE
      // controller, but autofill broadcasts it into every controller that declares the variable.
      // Ignore the broadcast copies landing on the non-target controllers.
      if (
        isControllerCmdVar(v) &&
        it?.metadata?.target_device &&
        String(it.metadata.target_device) !== String(devId)
      ) {
        continue;
      }

      // Capture cultivation calendar points (non-numeric history)
      if (v === FIELD_CALENDAR_VAR) {
        const meta = it.metadata && typeof it.metadata === "object" ? it.metadata : {};
        const rawISO = meta?.datetimeISO || it.time || it.created_at || it.inserted_at || null;
        const tMs = rawISO ? Date.parse(String(rawISO)) : NaN;
        if (Number.isFinite(tMs)) {
          const list = calendarHistory[devId] ? calendarHistory[devId].slice() : [];
          list.push({
            t: tMs,
            time: it.time || it.created_at || null,
            value: it.value,
            metadata: meta,
          });
          calendarHistory[devId] = list;
        }
      }

      // Capture forecast data.
      // - Legacy mode: many variables starting with "forecast_".
      // - Optimized mode: single variable "forecast" that contains everything in metadata/value.
      // Keep ONLY the most recent point per variable name.
      if (typeof v === "string" && (v === "forecast" || v.startsWith("forecast_"))) {
        const prevEntry = forecastLatest[v];
        const newTime = it.time || it.created_at || null;
        const prevTime = prevEntry?.time || null;
        const isNewer = !prevTime || (newTime && new Date(newTime).getTime() > new Date(prevTime).getTime());
        if (isNewer) {
          forecastLatest[v] = {
            value: it.value,
            metadata: it.metadata || {},
            unit: it.unit,
            time: newTime,
          };
        }
      }

      // record numeric history per device+var
      const tMs = Date.parse(it.time || it.created_at || it.inserted_at || "");
      const valNum = Number(it.value);
      if (Number.isFinite(tMs) && Number.isFinite(valNum)) {
        const devHist = history[devId] ? { ...history[devId] } : ({} as Record<string, TimePoint[]>);
        const varKey = v.trim();
        const series = devHist[varKey] ? [...devHist[varKey]] : [];
        series.push({ t: tMs, v: valNum });
        devHist[varKey] = series;
        history[devId] = devHist;
      }

      // latest for relevant vars
      if (VARS_SET.has(v)) {
        const prevEntry = latest[v];
        const newTime = it.time || it.created_at || null;
        const prevTime = prevEntry?.time || null;
        const isNewer = !prevTime || (newTime && new Date(newTime).getTime() > new Date(prevTime).getTime());
        if (isNewer) {
          latest[v] = {
            value: it.value,
            metadata: it.metadata || {},
            unit: it.unit,
            time: newTime,
          };

          // Also keep a device-scoped latest map so multiple devices can be controlled
          // in the same dashboard without variable-name collisions (e.g. hw_version).
          if (devId && devId !== "unknown") {
            const prevDevLatest = latestByDevice[devId] || {};
            latestByDevice[devId] = {
              ...prevDevLatest,
              [v]: {
                value: it.value,
                metadata: it.metadata || {},
                unit: it.unit,
                time: newTime,
              },
            };
          }

          if (v === "configuration") {
            try {
              const raw = it.value;
              const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
              config = cfg && typeof cfg === "object" ? cfg : null;
            } catch {
              config = null;
            }
          }
        }
      }
    }

    // ---------- irrigation per device ----------
    const irrigPoints = arr.filter((it: any) => IRR_VARS_SET.has(it.variable));
    if (irrigPoints.length) {
      irrigPoints.sort(byTimeDesc);
      const seen = new Set<string>();

      for (const dp of irrigPoints) {
        const v = dp.variable;
        const devId =
          dp.device || dp.origin || dp.bucket || dp.device_id || dp.bucket_id || bucketDev || "unknown";

        // Same multi-controller guard as above: drop broadcast command copies meant for another
        // controller so valve_X_command doesn't set cmdOpen on the wrong device.
        if (
          isControllerCmdVar(v) &&
          dp?.metadata?.target_device &&
          String(dp.metadata.target_device) !== String(devId)
        ) {
          continue;
        }

        const key = `${devId}::${v}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let dev: IrrigationDeviceSummary =
          irrigationDevices[devId] ||
          ({
            deviceId: devId,
            name: dp.device_name || dp.bucket_name || dp?.metadata?.device_name || devId,
          } as IrrigationDeviceSummary);

        const valStr = String(dp.value).toLowerCase();

        switch (v) {
          case "batterypct": {
            const p = Number(dp.value);
            dev.batteryPct = Number.isFinite(p) ? p : null;
            dev.batteryTime = dp.time || dp.created_at || null;
            break;
          }
          case "valve_1": {
            dev.valve1 = {
              ...(dev.valve1 || {}),
              reportedOpen: valStr === "on",
            };
            break;
          }
          case "valve_2": {
            dev.valve2 = {
              ...(dev.valve2 || {}),
              reportedOpen: valStr === "on",
            };
            break;
          }
          case "valve_1_command": {
            dev.valve1 = {
              ...(dev.valve1 || {}),
              cmdOpen: valStr === "on",
            };
            break;
          }
          case "valve_2_command": {
            dev.valve2 = {
              ...(dev.valve2 || {}),
              cmdOpen: valStr === "on",
            };
            break;
          }
          case "valve_1_time_command": {
            const n = parseInt(String(dp.value), 10);
            dev.valve1 = {
              ...(dev.valve1 || {}),
              minutesPreset: Number.isFinite(n) ? n : 30,
            };
            break;
          }
          case "valve_2_time_command": {
            const n = parseInt(String(dp.value), 10);
            dev.valve2 = {
              ...(dev.valve2 || {}),
              minutesPreset: Number.isFinite(n) ? n : 30,
            };
            break;
          }
          case "valve_1_pulse": {
            const pulses = Number(dp.value) || 0;
            const factor = dev.pulseToM3 ?? 1;
            dev.meter1M3 = pulses * factor;
            break;
          }
          case "valve_2_pulse": {
            const pulses = Number(dp.value) || 0;
            const factor = dev.pulseToM3 ?? 1;
            dev.meter2M3 = pulses * factor;
            break;
          }
        }

        irrigationDevices[devId] = dev;
      }
    }
  }

  // sort & trim history per device+var
  for (const devId of Object.keys(history)) {
    const devHist = history[devId];
    const newDevHist: Record<string, TimePoint[]> = {};
    for (const v of Object.keys(devHist)) {
      const arr = devHist[v].slice().sort((a, b) => a.t - b.t);

      // Deduplicate by timestamp (keep the LAST value for each timestamp)
      const dedup: TimePoint[] = [];
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i];
        const prev = dedup[dedup.length - 1];

        if (!prev || prev.t !== cur.t) {
          dedup.push(cur);
        } else {
          // same timestamp -> overwrite, keep the most recent occurrence
          dedup[dedup.length - 1] = cur;
        }
      }

      const trimmed = dedup.length > MAX_POINTS ? dedup.slice(dedup.length - MAX_POINTS) : dedup;

      newDevHist[v] = trimmed;
    }
    history[devId] = newDevHist;
  }

  // sort & trim cultivation calendar history per device
  for (const devId of Object.keys(calendarHistory)) {
    const arr = calendarHistory[devId].slice().sort((a, b) => (a.t || 0) - (b.t || 0));
    // Dedup by timestamp + summary string
    const dedup: CalendarPoint[] = [];
    const seen = new Set<string>();
    for (const p of arr) {
      const key = `${p.t || 0}::${String(p.value ?? "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(p);
    }
    const trimmed = dedup.length > MAX_CAL_POINTS ? dedup.slice(dedup.length - MAX_CAL_POINTS) : dedup;
    calendarHistory[devId] = trimmed;
  }

  return {
    latest,
    latestByDevice,
    forecastLatest,
    config,
    irrigationDevices,
    history,
    calendarHistory,
  };
}

function buildDashboardMeasurements(widget: any): string[] {
  // accept both spellings (your screenshot uses dashboardMeasurents)
  const raw = getParam(widget, "dashboardMeasurents") ?? getParam(widget, "dashboardMeasurements");

  if (raw == null || raw === "") return [];

  // If Tago already gave an array
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }

  // Most common: a string like '["air_temperature"]'
  if (typeof raw === "string") {
    const s = raw.trim();

    // Try JSON first
    try {
      const parsed = JSON.parse(s);

      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }

      // JSON string: "air_temperature"
      if (typeof parsed === "string") {
        return [parsed.trim()].filter(Boolean);
      }
    } catch {
      // Not JSON -> allow comma-separated: air_temperature,soil_moisture1
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    // Fallback: treat as single variable
    return [s].filter(Boolean);
  }

  // Anything else: coerce to string
  return [String(raw).trim()].filter(Boolean);
}

function formatLatestValue(variable: string, raw: any): string {
  if (raw === null || raw === undefined || raw === "") return "—";

  const cfg = getVarConfig(variable);
  const unit = cfg?.defaultUnit || "";

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    // non-numeric value
    return String(raw);
  }

  const conv = (cfg?.conversions && unit && cfg.conversions[unit]) || ((x: number) => x);

  const numeric = conv(n);

  // categorical (e.g. wind direction)
  const cat = cfg?.categorical?.[unit];
  if (cat) {
    const idx = Math.round(numeric);
    const label = cat[idx];
    return label ?? "—";
  }

  const val =
    Math.abs(numeric) >= 100
      ? numeric.toFixed(0)
      : Math.abs(numeric) >= 10
      ? numeric.toFixed(1)
      : Math.abs(numeric) >= 1
      ? numeric.toFixed(2)
      : numeric.toFixed(3);

  return unit ? `${val} ${unit}` : val;
}

function formatLatestTime(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString();
}

/* ===================== MAIN COMPONENT ===================== */

export const Dashboard: React.FC = () => {
  const [state, setState] = useState<AppState>({
    latest: {},
    latestByDevice: {},
    forecastLatest: {},
    config: null,
    irrigationDevices: {},
    history: {},
    calendarHistory: {},
  });

  const [pendingSelect, setPendingSelect] = useState<null | {
    deviceId: string;
    variable: string;
    label: string;
  }>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [modalSeries, setModalSeries] = useState<TimePoint[]>([]);
  // The device whose measurement the plot is currently showing — needed to target on-demand
  // history_request fetches at the right sensor (selectedDeviceId can drift after open).
  const [modalDeviceId, setModalDeviceId] = useState<string | null>(null);
  const [modalUnit, setModalUnit] = useState<string>("");
  const [modalRefLines, setModalRefLines] = useState<RefLine[]>([]);
  const [allModalOpen, setAllModalOpen] = useState(false);

  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const [tabTargets, setTabTargets] = useState<TabTargets>(DEFAULT_TAB_TARGETS);
  const [measTable, setMeasTable] = useState<Map<string, { label: string; tab: number }>>(
    () => new Map(Object.entries(MEAS_TABLE_DEFAULT))
  );
  const [envSources, setEnvSources] = useState<Record<string, string[]>>(() => ({ ...ENV_SOURCES_DEFAULT }));
  const [pathoModalOpen, setPathoModalOpen] = useState(false);
  const [irrigOpen, setIrrigOpen] = useState(false);

  // device_map from widget params
  const [deviceMap, setDeviceMap] = useState<Record<string, string>>({});

  // intermediate modal (device -> vars)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const [latestValues, setLatestValues] = useState<Record<string, any>>({});
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [sprayOpen, setSprayOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [dashboardMeasurements, setDashboardMeasurements] = useState<string[]>([]);

  // Home cards show ONLY the "today" rain figure. Every other rain variable (5min/hourly and the
  // weekly/monthly/yearly totals) is hidden here to keep the farmer's home screen simple — they
  // remain available inside the weather-station modal. Non-rain measurements are untouched.
  const homeMeasurements = useMemo(
    () =>
      dashboardMeasurements.filter(
        (v) => !/^(rain_height|current_rain_height)/.test(v) || v === "current_rain_height_daily"
      ),
    [dashboardMeasurements]
  );

  // Selected crop (when using packed field_bundle)
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);

  // Display preferences (multi-crop UI)
  type CropMetricPrefs = { plant_stress?: boolean };
  type DisplayPrefs = {
    showAllStress?: boolean; // if true, show plant stress for multiple crops
    cropMetric?: Record<string, CropMetricPrefs>; // per-crop visibility
  };

  const PREFS_KEY = "sag_dashboard_prefs_v1";
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPrefs>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? (JSON.parse(raw) as DisplayPrefs) : { showAllStress: false, cropMetric: {} };
    } catch {
      return { showAllStress: false, cropMetric: {} };
    }
  });
  const [displayPrefsOpen, setDisplayPrefsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(displayPrefs));
    } catch {}
  }, [displayPrefs]);

  const isCropMetricVisible = (cropId: string, metric: keyof CropMetricPrefs) => {
    const v = displayPrefs.cropMetric?.[cropId]?.[metric];
    return v === undefined ? true : !!v;
  };

  const setCropMetricVisible = (cropId: string, metric: keyof CropMetricPrefs, visible: boolean) => {
    setDisplayPrefs((prev) => ({
      ...prev,
      cropMetric: {
        ...(prev.cropMetric || {}),
        [cropId]: {
          ...((prev.cropMetric || {})[cropId] || {}),
          [metric]: visible,
        },
      },
    }));
  };

  const toggleAllStress = (val: boolean) => setDisplayPrefs((p) => ({ ...p, showAllStress: val }));

  const openPathoModal = () => setPathoModalOpen(true);
  const closePathoModal = () => setPathoModalOpen(false);

  // TagoIO bindings
  useEffect(() => {
    const TagoIO = window.TagoIO;
    if (!TagoIO || !TagoIO.ready) {
      console.warn("TagoIO SDK not found, using local preview mode.");
      const dummyWidget = {
        display: {
          parameters: [
            { key: "dashboard_id", value: "DASHBOARD_ID_HERE" },
            { key: "config_tab", value: "3" },
          ],
        },
      };
      const { dashboardId, tabTargets } = computeTabTargets(dummyWidget);
      setDashboardId(dashboardId);
      setTabTargets(tabTargets);
      setMeasTable(new Map(Object.entries(MEAS_TABLE_DEFAULT)));
      setEnvSources({ ...ENV_SOURCES_DEFAULT });
      expandVARSWithEnvSources(ENV_SOURCES_DEFAULT);
      setState((prev) => applyBuckets(prev, [{ result: [] }]));
      return;
    }

    TagoIO.onStart((widget: any) => {
      const { dashboardId, tabTargets } = computeTabTargets(widget);
      setDashboardId(dashboardId);
      setTabTargets(tabTargets);

      // device_map param
      try {
        const raw = getParam(widget, "device_map");
        if (raw) {
          const obj = typeof raw === "string" ? JSON.parse(raw) : (raw as any);
          if (Array.isArray(obj)) {
            const m: Record<string, string> = {};
            obj.forEach((e: any) => {
              const k = String(e?.id ?? e?.device ?? e?.key ?? "");
              const v = String(e?.name ?? e?.label ?? "");
              if (k && v) m[k] = v;
            });
            setDeviceMap(m);
          } else if (obj && typeof obj === "object") {
            const m: Record<string, string> = {};
            Object.entries(obj).forEach(([k, v]) => {
              if (k && v != null) m[String(k)] = String(v);
            });
            setDeviceMap(m);
          }
        }
      } catch (err) {
        console.warn("device_map parse failed:", err);
      }

      // dashboardMeasurents param
      const dm = buildDashboardMeasurements(widget);
      setDashboardMeasurements(dm);

      // IMPORTANT: ensure applyBuckets will track these variables in state.latest
      dm.forEach((k) => VARS_SET.add(k));

      const table = buildMeasTable(widget);
      setMeasTable(table);

      const env = buildEnvSources(widget);
      setEnvSources(env);
      expandVARSWithEnvSources(env);

      if (Array.isArray(widget?.data)) {
        preprocessFieldBundles(widget.data).then((processed) => {
          setState((prev) => applyBuckets(prev, processed));
        });
      }
    });

    TagoIO.onRealtime((buckets: any[]) => {
      preprocessFieldBundles(buckets).then((processed) => {
        setState((prev) => applyBuckets(prev, processed));
      });
    });

    TagoIO.ready();
  }, []);

  /* ---------- Derived for UI ---------- */

  // Parse packed bundle (field_bundle)
  const fieldBundle = useMemo(() => {
    const e = state.latest[FIELD_BUNDLE_VAR];
    if (!e) return null;
    const md = e.metadata || {};
    // The overflow companion (may be absent on small/legacy fields).
    const e2 = state.latest[FIELD_BUNDLE_2_VAR];
    const md2 = e2?.metadata;
    // Some setups may serialize the bundle in value as JSON.
    let bundle: any = md;
    if ((!md || Object.keys(md).length === 0) && typeof e.value === "string") {
      try {
        const obj = JSON.parse(e.value);
        if (obj && typeof obj === "object") bundle = obj;
      } catch {}
    }
    // Deep-merge the spilled pathogen/pest keys back in (no-op when field_bundle_2 is absent/empty).
    bundle = mergeBundles(bundle, md2);
    return { entry: e, bundle };
  }, [state.latest]);

  // The field (anchor) device — the one carrying field_bundle/configuration/forecast.
  // Declaration writes (spray/inspection) must target it explicitly (autofill is off).
  const fieldDeviceId = useMemo(() => {
    const lbd = state.latestByDevice || {};
    for (const [devId, vars] of Object.entries(lbd)) {
      if (vars && (vars["field_bundle"] || vars["configuration"] || vars["forecast"])) {
        return devId;
      }
    }
    return null;
  }, [state.latestByDevice]);

  // Parsed response to the latest on-demand history_request. The analysis packs the downsampled
  // series as [epochSeconds, value] pairs in metadata.points; convert to TimePoint[] (ms). Identity
  // changes per response (via `time`) so MeasurementModal can detect a fresh arrival.
  const historyResponse = useMemo(() => {
    const e = state.latest["history_data"];
    const md = e?.metadata as any;
    if (!e || !md || !Array.isArray(md.points)) return null;
    const points: TimePoint[] = md.points
      .map((p: any) => ({ t: Number(p?.[0]) * 1000, v: Number(p?.[1]) }))
      .filter((p: TimePoint) => Number.isFinite(p.t) && Number.isFinite(p.v));
    return {
      variable: String(md.source_variable || ""),
      deviceId: String(md.target_device || ""),
      startMs: md.start_iso ? new Date(md.start_iso).getTime() : NaN,
      endMs: md.end_iso ? new Date(md.end_iso).getTime() : NaN,
      truncated: !!md.truncated,
      time: e.time || null,
      points,
    };
  }, [state.latest]);

  const availableCrops = useMemo(() => {
    const configCrops = state.config?.crops;
    if (Array.isArray(configCrops) && configCrops.length)
      return configCrops.map((c: any, idx) => ({
        ...c,
        id: c.id || `${c.cultivation_type_general}:${c.cultivation_type}:${idx + 1}`,
      }));
    const bundleCrops = fieldBundle?.bundle?.crops;
    return Array.isArray(bundleCrops) ? bundleCrops : [];
  }, [state.config, fieldBundle]);

  // Keep selected crop valid when bundle or config updates
  useEffect(() => {
    if (!availableCrops.length) return;
    if (selectedCropId && availableCrops.some((c: any) => c?.id === selectedCropId)) return;
    const firstId = String(availableCrops[0]?.id || "");
    setSelectedCropId(firstId);
  }, [availableCrops, selectedCropId]);

  const selectedCrop = useMemo(() => {
    if (!availableCrops.length) return null;
    const id = selectedCropId || String(availableCrops[0]?.id || "");
    return availableCrops.find((c: any) => String(c?.id) === String(id)) || availableCrops[0];
  }, [availableCrops, selectedCropId]);

  // The bundle crop for the selected id — used to read indicators (config crops don't have them)
  const selectedBundleCrop = useMemo(() => {
    const id = selectedCrop?.id ? String(selectedCrop.id) : null;
    if (!id) return null;
    return fieldBundle?.bundle?.crops?.find((c: any) => String(c?.id) === id) ?? null;
  }, [fieldBundle, selectedCrop]);

  // The kernel keeps the daily display messages (fir_message_*, bpi_message, ...) TRANSIENT
  // so field_bundle stays under TagoIO's 10kB limit — they vanish from the bundle between
  // daily ticks. We persist the last-seen value per crop in localStorage (namespaced by
  // dashboard) so the pathogen modal / BPI card stay populated — even across page reloads —
  // without bloating the bundle.
  const stickyMsgRef = useRef<Record<string, Record<string, any>>>({});
  const stickyLoadedKeyRef = useRef<string | null>(null);

  // Build a "virtual" latest map from the selected crop indicators, preserving {value, metadata}
  const uiLatest = useMemo(() => {
    const base = { ...state.latest };
    const bundleEntry = fieldBundle?.entry;
    const shared = fieldBundle?.bundle?.shared;

    // Merge shared indicators (optional use in modals / future UI)
    if (shared && typeof shared === "object") {
      for (const [k, raw] of Object.entries(shared)) {
        const u = unpackIndicator(raw);
        base[k] = {
          value: u.value,
          metadata: u.metadata || {},
          unit: base[k]?.unit,
          time: bundleEntry?.time || base[k]?.time || null,
        };
      }
    }

    const STICKY_PREFIXES = [
      "fir_message_", "bpi_message", "bpi_season_message",
      "plant_stress", "irrigation_message", "irrigation_warning", "spray_confirmation",
    ];
    const isSticky = (k: string) => STICKY_PREFIXES.some((p) => k === p || k.startsWith(p));

    // Lazy-load persisted messages once we know which dashboard this is (survives reloads).
    const lsKey = `sag_msgs_${dashboardId || "_"}`;
    if (stickyLoadedKeyRef.current !== lsKey) {
      stickyLoadedKeyRef.current = lsKey;
      try {
        const saved = JSON.parse(localStorage.getItem(lsKey) || "{}");
        if (saved && typeof saved === "object") stickyMsgRef.current = saved;
      } catch {
        /* ignore corrupt storage */
      }
    }

    const cropId = String(selectedBundleCrop?.id || "_");
    const sticky = (stickyMsgRef.current[cropId] = stickyMsgRef.current[cropId] || {});
    let stickyChanged = false;

    // Persist EVERY crop's transient messages from this bundle — not just the selected
    // one — so switching crops shows their last-seen values even after they expire from
    // the bundle between daily ticks. (Fixes "only the selected crop shows pathogens".)
    const allBundleCrops = fieldBundle?.bundle?.crops;
    if (Array.isArray(allBundleCrops)) {
      for (const c of allBundleCrops) {
        const cinds = c?.indicators;
        if (!cinds || typeof cinds !== "object") continue;
        const cid = String(c?.id || "_");
        const cstore = (stickyMsgRef.current[cid] = stickyMsgRef.current[cid] || {});
        for (const [k, raw] of Object.entries(cinds)) {
          if (!isSticky(k)) continue;
          const u = unpackIndicator(raw);
          cstore[k] = {
            value: u.value,
            metadata: u.metadata || {},
            unit: cstore[k]?.unit,
            time: bundleEntry?.time || cstore[k]?.time || null,
          };
          stickyChanged = true;
        }
      }
    }

    // Merge selected crop indicators (this is what drives the cards)
    const inds = selectedBundleCrop?.indicators;
    if (inds && typeof inds === "object") {
      for (const [k, raw] of Object.entries(inds)) {
        const u = unpackIndicator(raw);
        base[k] = {
          value: u.value,
          metadata: u.metadata || {},
          unit: base[k]?.unit,
          time: bundleEntry?.time || base[k]?.time || null,
        };
        if (isSticky(k)) {
          sticky[k] = base[k]; // remember last-seen message
          stickyChanged = true;
        }
      }
    }

    // Persist newly-seen messages so they survive a page reload.
    if (stickyChanged) {
      try {
        localStorage.setItem(lsKey, JSON.stringify(stickyMsgRef.current));
      } catch {
        /* storage unavailable — ignore */
      }
    }

    // Fall back to the last-seen transient messages the current bundle omitted.
    for (const [k, v] of Object.entries(sticky)) {
      if (!base[k]) base[k] = v;
    }

    return base;
  }, [state.latest, fieldBundle, selectedBundleCrop, dashboardId]);

  // Config pill
  const { configPillText, configPillClass } = useMemo(() => {
    // Prefer packed bundle crop selection when available
    if (selectedCrop?.id) {
      return {
        configPillText: cropLabelFromId(String(selectedCrop.id)),
        configPillClass: "pill blue",
      };
    }

    const cfg = state.config;
    if (!cfg) {
      return {
        configPillText: "Δεν έχει γίνει παραμετροποίηση της εγκατάστασης!",
        configPillClass: "pill red",
      };
    }
    const primary = getPrimaryCropFromConfig(cfg);
    const g = greekLabel("cultivation_type_general", primary?.cultivation_type_general);
    const c = greekLabel("cultivation_type", primary?.cultivation_type);
    return {
      configPillText: `${g} • ${c}`,
      configPillClass: "pill blue",
    };
  }, [state.config, selectedCrop]);

  // [DECL-UI 2026-07-04 legacy-handoff] Protection-state summary chip. Reads the kernel-written
  // `spray_protection_end_<pathogen>` ISO datetime values from uiLatest and reports how many
  // pathogens are under active pesticide protection + the latest expiry. Read-only, no writes.
  const protectionSummary = useMemo(() => {
    const now = Date.now();
    let activeCount = 0;
    let latestEndMs = 0;
    let latestEndRaw = "";
    for (const [k, entry] of Object.entries(uiLatest)) {
      if (!k.startsWith("spray_protection_end_")) continue;
      const raw = (entry as LatestEntry)?.value;
      if (raw == null || raw === "") continue;
      const ms = new Date(String(raw)).getTime();
      if (!Number.isFinite(ms) || ms <= now) continue;
      activeCount += 1;
      if (ms > latestEndMs) { latestEndMs = ms; latestEndRaw = String(raw); }
    }
    if (activeCount === 0) return null;
    let untilText = "";
    try {
      untilText = new Date(latestEndRaw).toLocaleString("el-GR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { untilText = latestEndRaw.slice(0, 10); }
    return { activeCount, untilText };
  }, [uiLatest]);

  // BPI
  const { bpiBadgeText, bpiBadgeClass, bpiText, bpiTextMuted } = useMemo(() => {
    const e = uiLatest["bpi_message"];
    if (!e) {
      return {
        bpiBadgeText: "—",
        bpiBadgeClass: "badge b-blue",
        bpiText: "Καμία εκτίμηση ακόμα.",
        bpiTextMuted: true,
      };
    }
    const col = e?.metadata?.color ? String(e.metadata.color) : badgeColorFallback(e.value, "blue");
    const badgeClass = "badge b-" + col;
    const txt = e?.metadata?.text;
    return {
      bpiBadgeText: String(e.value || "—"),
      bpiBadgeClass: badgeClass,
      bpiText: txt || "Καμία εκτίμηση ακόμα.",
      bpiTextMuted: !txt,
    };
  }, [uiLatest]);

  // [CLEANFIX 2026-07-02] BPI diagnostics from batch-2 (PATCH_35/36): stomata state,
  // performance %, and the climate-vs-management loss split. All ready-Greek from the kernel.
  const bpiExtra = useMemo(() => {
    const ul = uiLatest as any;
    const stomata = ul?.bpi_f_vpd?.metadata?.stomata_state_el
      ? String(ul.bpi_f_vpd.metadata.stomata_state_el) : "";
    const perfRaw = Number(ul?.bpi_performance_pct?.value);
    const perfPct = Number.isFinite(perfRaw) ? Math.round(perfRaw) : null;
    const bucket = ul?.bpi_loss_bucket;
    const bucketVal = bucket?.value != null ? String(bucket.value) : "";
    const bucketLabel = bucket?.metadata?.label_el ? String(bucket.metadata.label_el) : "";
    const bucketClass = bucketVal === "management" ? "badge b-yellow"
      : bucketVal === "climate" ? "badge b-blue" : "";
    return { stomata, perfPct, bucketLabel, bucketClass };
  }, [uiLatest]);

  // Stress
  const { stressBadgeText, stressBadgeClass, stressText, stressTextMuted } = useMemo(() => {
    const e = uiLatest["plant_stress"];
    if (!e) {
      return {
        stressBadgeText: "—",
        stressBadgeClass: "badge b-yellow",
        stressText: "Καμία εκτίμηση ακόμα.",
        stressTextMuted: true,
      };
    }
    const col = e?.metadata?.color ? String(e.metadata.color) : badgeColorFallback(e.value, "yellow");
    const badgeClass = "badge b-" + col;
    const txt = e?.metadata?.text;
    return {
      stressBadgeText: String(e.value || "—"),
      stressBadgeClass: badgeClass,
      stressText: txt || "Καμία εκτίμηση ακόμα.",
      stressTextMuted: !txt,
    };
  }, [uiLatest]);

  // Plant stress per crop (from field_bundle), used when displayPrefs.showAllStress is enabled.
  const stressByCrop = useMemo(() => {
    if (!availableCrops.length) return [];
    return availableCrops
      .map((c: any) => {
        const cropId = String(c?.id || "");
        const raw = c?.indicators?.plant_stress;
        const u = unpackIndicator(raw);
        const valueStr = u?.value !== undefined && u?.value !== null ? String(u.value) : "—";
        const col = u?.metadata?.color ? String(u.metadata.color) : badgeColorFallback(valueStr, "yellow");
        const badgeClass = "badge b-" + col;
        const text = u?.metadata?.text ? String(u.metadata.text) : "";
        return { cropId, cropLabel: cropLabelFromId(cropId), valueStr, badgeClass, text };
      })
      .filter((x) => x.cropId);
  }, [availableCrops]);

  // Environment
  const envDisplay = useMemo(() => {
    const l = uiLatest;
    return {
      airT: fmtNum(latestOf(l, envSources.airT || []), 1),
      airH: fmtNum(latestOf(l, envSources.airH || []), 0),
      sm1: fmtNum(latestOf(l, envSources.sm1 || []), 0),
      st1: fmtNum(latestOf(l, envSources.st1 || []), 1),
      sm2: fmtNum(latestOf(l, envSources.sm2 || []), 0),
      st2: fmtNum(latestOf(l, envSources.st2 || []), 1),
    };
  }, [uiLatest, envSources]);

  // Pathogens list
  const pathoItems = useMemo(() => {
    const items: {
      level: number;
      name: string;
      text: string;
      badgeClass: string;
      value: string;
    }[] = [];

    for (const p of PATHOGENS) {
      const vname = `fir_message_${p.key}`;
      const e = uiLatest[vname];
      if (!e) continue;

      const level = labelToLevel(e.value);
      if (level < 3) continue;

      const badgeClass = level === 3 ? "b-orange" : "b-red";
      const value = String(e.value ?? "—");

      items.push({
        level,
        name: p.name,
        text: e?.metadata?.text || "",
        badgeClass,
        value,
      });
    }

    items.sort((a, b) => b.level - a.level);
    return items;
  }, [uiLatest]);

  // Known badge colours (fall back to blue for anything unexpected from the kernel).
  const safeBadgeColor = (c: any) =>
    ["green", "yellow", "orange", "red", "blue"].includes(String(c)) ? String(c) : "blue";

  // Weather alerts (runPerTich PATCH_30). Only render alerts that are actually present.
  const weatherAlerts = useMemo(() => {
    const out: { key: string; kind: "frost" | "heat"; severity: string; color: string; text: string }[] = [];
    for (const key of ["weather_alert_frost", "weather_alert_heat"]) {
      const e = uiLatest[key];
      if (!e || !e.value) continue;
      const sev = String(e.value);
      out.push({
        key,
        kind: key === "weather_alert_frost" ? "frost" : "heat",
        severity: sev,
        color: safeBadgeColor(e?.metadata?.color || (sev === "emergency" ? "red" : "orange")),
        text: String(e?.metadata?.text || ""),
      });
    }
    return out;
  }, [uiLatest]);

  // Insect generations «Γενιά N» (runPerTich PATCH_23). One row per insect that has a value.
  const pestGenerations = useMemo(() => {
    const out: { key: string; name: string; generation: number; phase: string; color: string; diapause: boolean; maxGen: number | null }[] = [];
    for (const p of PATHOGENS) {
      const e = uiLatest[`pest_generation_${p.key}`];
      if (!e) continue;
      const gen = Number(e.value);
      if (!Number.isFinite(gen)) continue;
      const maxGenNum = Number(e?.metadata?.max_generations);
      out.push({
        key: p.key,
        name: p.name,
        generation: gen,
        phase: String(e?.metadata?.phase_stage_el || ""),
        color: safeBadgeColor(e?.metadata?.color),
        diapause: !!e?.metadata?.diapause,
        maxGen: Number.isFinite(maxGenNum) ? maxGenNum : null,
      });
    }
    return out;
  }, [uiLatest]);

  // Irrigation soil-moisture sensor fault (runPerTich PATCH_20). Field-level.
  const irrigationSensorFault = uiLatest["irrigation_sensor_fault"]?.value
    ? uiLatest["irrigation_sensor_fault"]
    : null;

  // Devices list for sidebar:
  //   - all devices explicitly configured in device_map
  //   - plus history devices that have at least one plottable VARIABLES_CONFIG variable
  //   (excludes orphan devices that only sent non-plottable system variables)
  const sidebarDevices = useMemo(() => {
    const idsWithPlottableHistory = Object.keys(state.history).filter((deviceId) => {
      const devHist = state.history[deviceId] || {};
      return Object.keys(devHist).some((v) => Object.prototype.hasOwnProperty.call(VARIABLES_CONFIG, v.trim()));
    });

    const allIds = new Set([
      ...Object.keys(deviceMap),
      ...idsWithPlottableHistory,
    ]);

    const ids = Array.from(allIds);
    ids.sort((a, b) => {
      const na = deviceMap[a] || a;
      const nb = deviceMap[b] || b;
      return na.localeCompare(nb, "el");
    });

    return ids;
  }, [state.history, deviceMap]);

  const irrigationDevicesArray = useMemo(() => Object.values(state.irrigationDevices), [state.irrigationDevices]);

  /* ---------- Handlers ---------- */

  const handleAllMeasurementSelect = (deviceId: string, variable: string, label: string) => {
    setPendingSelect({ deviceId, variable, label });
    setSelectedDeviceId(deviceId);
    setAllModalOpen(false); // optional: close the grid right away
  };

  const openTab = (tab: number | null | undefined) => {
    if (tab === null || tab === undefined) return;
    if (!dashboardId) {
      alert("Λείπει το parameter 'dashboard_id' στο widget.");
      return;
    }
    window.open(makeURL(dashboardId, tab), "_parent", "noopener");
  };

  const linkHrefFor = (tab: number) => (dashboardId ? makeURL(dashboardId, tab) : "#");

  const handleConfigSave = async (payload: any[]) => {
    const TagoIO = window.TagoIO;

    if (!TagoIO || typeof TagoIO.sendData !== "function") {
      console.warn("TagoIO.sendData not available; config payload:", payload);
      alert("Δεν είναι διαθέσιμη η αποστολή παραμετροποίησης σε αυτό το περιβάλλον.");
      return;
    }

    try {
      // send config only to the device selected in widget (same pattern as old dashboard)
      TagoIO.autofill = false;
      await TagoIO.sendData(payload);
      alert("Η παραμετροποίηση στάλθηκε. Περιμένετε για επιβεβαίωση.");
      setConfigOpen(false);
    } catch (err) {
      console.error("Error sending configuration:", err);
      alert("Αποτυχία αποστολής παραμετροποίησης.");
    } finally {
      // restore default behaviour just in case
      TagoIO.autofill = true;
    }
  };

  const handleSendData = async (payload: any[] | any) => {
    const TagoIO = window.TagoIO;

    if (!TagoIO || typeof TagoIO.sendData !== "function") {
      console.warn("TagoIO.sendData not available; payload:", payload);
      alert("Δεν είναι διαθέσιμη η αποστολή δεδομένων σε αυτό το περιβάλλον.");
      return;
    }

    try {
      // generic helper used by Irrigation rules modal
      TagoIO.autofill = false;
      await TagoIO.sendData(payload);
    } catch (err) {
      console.error("Error sending data:", err);
      alert("Αποτυχία αποστολής δεδομένων.");
    } finally {
      TagoIO.autofill = true;
    }
  };

  // Farmer declarations from the pathogen modal (powers runPerTich PATCH_18/19).
  // spray  → spray_declaration  = { spray_date:"YYYY-MM-DD", target_pathogens:[key] }
  // clean  → inspection_declaration = { result:"inspected_clean", target_pathogens:[key] }
  // Sent to the field device explicitly (kernel reads value as a JSON string there).
  const handleDeclaration = async (
    kind: "spray" | "inspection",
    pathogenKey: string,
    opts?: { protectionDays?: number; productName?: string }
  ) => {
    const TagoIO = window.TagoIO;
    if (!TagoIO || typeof TagoIO.sendData !== "function") {
      alert("Δεν είναι διαθέσιμη η αποστολή δεδομένων σε αυτό το περιβάλλον.");
      throw new Error("sendData unavailable");
    }
    if (!fieldDeviceId) {
      alert("Δεν βρέθηκε η συσκευή του χωραφιού για την καταχώρηση της δήλωσης.");
      throw new Error("field device not found");
    }
    const today = new Date().toISOString().slice(0, 10);
    // [DECL-UI 2026-07-04 legacy-handoff] batch-2 (PATCH_19): protection days + product now come from
    // the in-widget PathoModal confirmation (opts), replacing the native window.prompt that mobile
    // TagoIO webviews suppress. Empty/invalid -> unset -> kernel applies the residualDays / 14-day
    // default. This handler only ever writes spray_declaration / inspection_declaration — never valve.
    const sprayObj: { spray_date: string; target_pathogens: string[]; protection_days?: number; product_name?: string } = {
      spray_date: today,
      target_pathogens: [pathogenKey],
    };
    if (kind === "spray") {
      const pd = opts?.protectionDays;
      if (typeof pd === "number" && Number.isFinite(pd) && pd > 0 && pd <= 60) {
        sprayObj.protection_days = Math.round(pd);
      }
      const pn = opts?.productName;
      if (typeof pn === "string" && pn.trim() !== "") {
        sprayObj.product_name = pn.trim();
      }
    }
    const payload =
      kind === "spray"
        ? {
            device: fieldDeviceId,
            variable: "spray_declaration",
            value: JSON.stringify(sprayObj),
          }
        : {
            device: fieldDeviceId,
            variable: "inspection_declaration",
            value: JSON.stringify({ result: "inspected_clean", target_pathogens: [pathogenKey] }),
          };
    const prevAutofill = TagoIO.autofill;
    try {
      TagoIO.autofill = false;
      await TagoIO.sendData(payload);
    } catch (err) {
      console.error("Declaration send failed:", err);
      alert("Αποτυχία αποστολής δήλωσης.");
      throw err;
    } finally {
      TagoIO.autofill = prevAutofill !== false ? true : prevAutofill;
    }
  };

  const handleIrrigationCommand = async (cmd: IrrigationCommand) => {
    const TagoIO = window.TagoIO;
    if (!TagoIO || typeof TagoIO.sendData !== "function") {
      console.warn("TagoIO.sendData not available; command:", cmd);
      alert("Δεν είναι διαθέσιμη η αποστολή εντολών σε αυτό το περιβάλλον.");
      return;
    }

    let variable: string;
    let value: string | number;
    if (cmd.type === "perm") {
      variable = cmd.valveIndex === 0 ? "valve_1_command" : "valve_2_command";
      value = cmd.targetOpen ? "on" : "off";
    } else {
      variable = cmd.valveIndex === 0 ? "valve_1_time_command" : "valve_2_time_command";
      value = cmd.minutes;
    }

    // MULTI-CONTROLLER TARGETING. Autofill (default ON) keeps the widget's analysis_run firing,
    // but it broadcasts the command to every controller that declares the variable, so the
    // UC511_downlink analysis can't tell them apart from `scope[0].device` alone (always the
    // first-listed device → the "always 3496" bug). The analysis already resolves the target as
    // `metadata.target_device || scope[0].device`, so we stamp the SELECTED controller here.
    // `device` is kept so the feedback overlay keys its flow to the right controller.
    await TagoIO.sendData({
      device: cmd.deviceId,
      variable,
      value,
      metadata: { target_device: cmd.deviceId },
    });
  };

  // On-demand history fetch: ask the UC511_downlink analysis (the widget's analysis_run) to query
  // a sensor for an arbitrary [start,end] range and write it back as `history_data`. Sent through
  // the field device (autofill ON keeps analysis_run firing); the sensor is stamped in metadata.
  const requestHistory = async (
    deviceId: string,
    variable: string,
    startMs: number,
    endMs: number,
  ) => {
    const TagoIO = window.TagoIO;
    if (!TagoIO || typeof TagoIO.sendData !== "function") {
      console.warn("TagoIO.sendData not available; history request:", { deviceId, variable });
      alert("Δεν είναι διαθέσιμη η φόρτωση δεδομένων σε αυτό το περιβάλλον.");
      return;
    }
    if (!fieldDeviceId) {
      alert("Δεν βρέθηκε συσκευή πεδίου για τη φόρτωση ιστορικού.");
      return;
    }
    await TagoIO.sendData({
      device: fieldDeviceId,
      variable: "history_request",
      value: `${deviceId}:${variable}`,
      metadata: {
        target_device: deviceId,
        source_variable: variable,
        start_iso: new Date(startMs).toISOString(),
        end_iso: new Date(endMs).toISOString(),
        max_points: 500,
      },
    });
  };

  const openDeviceModal = (devId: string) => {
    setSelectedDeviceId(devId);
    setDeviceModalOpen(true);
  };

  const closeMeasurementModal = () => {
    setModalOpen(false);
  };

  const friendlyDeviceName = (id: string | null) => (id ? deviceMap[id] || id : "");

  const handleDeviceMeasurementSelect = (variable: string, label: string) => {
    if (!selectedDeviceId) return;
    const devHist = state.history[selectedDeviceId] || {};
    const series = devHist[variable] || [];

    const devName = friendlyDeviceName(selectedDeviceId);

    const varCfg = getVarConfig(variable);

    setSelectedVar(variable);
    setSelectedLabel(`${varCfg.label} — ${devName}`);
    setModalDeviceId(selectedDeviceId);
    setModalSeries(series);
    setModalUnit(varCfg.defaultUnit || "");

    // Optional: add horizontal reference lines for soil moisture based on SELECTED crop
    const isSoilMoisture = /^soil_moisture\d*$/i.test(variable) || variable.toLowerCase().startsWith("soil_moisture");
    if (isSoilMoisture) {
      const lb = Number((uiLatest as any)?.soil_moisture_lower_limit?.value);
      const ub = Number((uiLatest as any)?.soil_moisture_upper_limit?.value);

      const lines: RefLine[] = [];
      if (Number.isFinite(lb)) lines.push({ value: lb, label: "Κάτω όριο", dashed: true });
      if (Number.isFinite(ub)) lines.push({ value: ub, label: "Άνω όριο", dashed: true });
      // [CLEANFIX 2026-07-02] batch-2 PATCH_32: show the 2-depth root-zone mean the engine actually uses.
      const rz = Number((uiLatest as any)?.soil_moisture_rootzone?.value);
      if (Number.isFinite(rz)) lines.push({ value: rz, label: "Ριζόστρωμα (μέσο)", dashed: false });

      // If swapped, fix order so it doesn't look inverted
      if (lines.length === 2 && lines[0].value > lines[1].value) {
        const tmp = lines[0];
        lines[0] = lines[1];
        lines[1] = tmp;
      }

      setModalRefLines(lines);
    } else {
      setModalRefLines([]);
    }

    setDeviceModalOpen(false);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!pendingSelect) return;
    if (pendingSelect.deviceId !== selectedDeviceId) return;
    // device has switched; now open the plot using your existing handler
    handleDeviceMeasurementSelect(pendingSelect.variable, pendingSelect.label);
    setPendingSelect(null);
  }, [selectedDeviceId, pendingSelect]);

  const forecastCardInfo = useMemo(() => {
    // Optimized mode: single variable "forecast" with all content in metadata
    // Supports both:
    //  - OLD (AccuWeather): metadata.days
    //  - NEW (Open-Meteo): metadata.hourly_epoch + metadata.hourly
    const f = (state.forecastLatest || {})["forecast"] as any;

    const lastUpdate = (() => {
      const t = Date.parse(f?.time || "");
      return Number.isFinite(t) ? new Date(t).toLocaleString() : "—";
    })();

    const md = f?.metadata || {};

    // NEW (Open-Meteo)
    if (Array.isArray(md.hourly_epoch) && md.hourly && typeof md.hourly === "object") {
      const hoursCount = md.hourly_epoch.length;

      // Find the next entry >= current time
      const now = Date.now();
      let nextIdx = (md.hourly_epoch as number[]).findIndex((ep) => ep * 1000 >= now);
      if (nextIdx < 0) nextIdx = 0;

      const ep = md.hourly_epoch[nextIdx];
      const nextDateISO = Number.isFinite(Number(ep)) ? new Date(Number(ep) * 1000).toLocaleDateString("el-GR") : null;
      const nextTime = Number.isFinite(Number(ep))
        ? new Date(Number(ep) * 1000).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "—";

      const h = md.hourly || {};
      const wmo = wmoToHuman(h.weather_code?.[nextIdx]);
      const temp = Number(h.temperature_2m?.[nextIdx]);
      const rh = Number(h.relative_humidity_2m?.[nextIdx]);
      const windRaw = h.wind_speed_10m?.[nextIdx];
      const windKmh = toKmhFromUnit(windRaw, md.hourly_units?.wind_speed_10m);
      const pop = Number(h.precipitation_probability?.[nextIdx]);
      const precip = Number(h.precipitation?.[nextIdx]);

      const temps: any[] = Array.isArray(h.temperature_2m) ? h.temperature_2m : [];
      const take = Math.min(24, temps.length);
      let tmin: number | null = null;
      let tmax: number | null = null;
      for (let i = 0; i < take; i++) {
        const n = Number(temps[i]);
        if (!Number.isFinite(n)) continue;
        tmin = tmin === null ? n : Math.min(tmin, n);
        tmax = tmax === null ? n : Math.max(tmax, n);
      }
      const nextMinMax = tmin === null || tmax === null ? "—" : `${tmin}° – ${tmax}°`;

      return {
        daysCount: 0,
        hoursCount,
        lastUpdate,
        nextDateISO,
        nextMinMax,
        nextEntry: {
          time: nextTime,
          emoji: wmo.emoji,
          label: wmo.label,
          temp: Number.isFinite(temp) ? `${temp.toFixed(1)}°C` : "—",
          rh: Number.isFinite(rh) ? `${Math.round(rh)}%` : "—",
          wind: windKmh != null ? formatWithConfig("wind_speed_kmh", windKmh) : "—",
          pop: Number.isFinite(pop) ? `${Math.round(pop)}%` : "—",
          precip: Number.isFinite(precip) ? `${precip.toFixed(1)} mm` : "—",
        },
      } as any;
    }

    // OLD (AccuWeather)
    let days: any[] = Array.isArray(md.days) ? md.days : [];
    if (!days.length && typeof f?.value === "string") {
      try {
        const obj = JSON.parse(f.value);
        if (obj && Array.isArray(obj.days)) days = obj.days;
      } catch {}
    }

    const daysCount = days.length;
    const next = daysCount ? days[0] : null;
    const nextDateISO = next?.date ? String(next.date) : null;
    const nextMinMax = next ? `${next.tmin ?? "—"}° – ${next.tmax ?? "—"}°` : "—";

    return { daysCount, hoursCount: 0, lastUpdate, nextDateISO, nextMinMax, nextEntry: null } as any;
  }, [state.forecastLatest]);

  const sprayRec = useMemo(
    () => computeSprayRecommendation(state.forecastLatest),
    [state.forecastLatest],
  );
  const sprayBadgeClass =
    sprayRec == null ? "badge b-blue"
    : sprayRec.status === "good" ? "badge b-green"
    : sprayRec.status === "caution" ? "badge b-yellow"
    : "badge b-red";

  const subscriptionAlert = useMemo(() => {
    const entry = state.latest["subscription_until"];
    if (!entry) return null;
    const dateMs = Date.parse(String(entry.value));
    if (!Number.isFinite(dateMs)) return null;
    const now = Date.now();
    const daysLeft = Math.ceil((dateMs - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { type: "expired" as const };
    if (daysLeft <= 30) return { type: "warning" as const, daysLeft };
    return null;
  }, [state.latest]);

  /* ---------- Render ---------- */

  return (
    <div className="wrap">
      {subscriptionAlert?.type === "expired" && (
        <div className="subscription-banner subscription-banner--expired">
          Η συνδρομή σας δεν είναι ενεργή! Παρακαλώ επικοινωνήστε με την ομάδα του MACC για να την ενεργοποιήσετε!
        </div>
      )}
      {subscriptionAlert?.type === "warning" && (
        <div className="subscription-banner subscription-banner--warning">
          Η συνδρομή σας λήγει σε {subscriptionAlert.daysLeft} {subscriptionAlert.daysLeft === 1 ? "ημέρα" : "ημέρες"}. Παρακαλώ επικοινωνήστε με την ομάδα του MACC για να την ανανεώσετε!
        </div>
      )}
      {subscriptionAlert?.type !== "expired" && <div className="layout">
        <div className="main">
          {/* Top bar */}
          <div className="topbar">
            <div className="title">Καλλιέργεια</div>
            {availableCrops.length >= 1 ? (
              <div className="crop-picker">
                <select value={selectedCropId || ""} onChange={(e) => setSelectedCropId(e.target.value)}>
                  {availableCrops.map((c: any) => {
                    const id = String(c?.id || "");
                    return (
                      <option key={id} value={id}>
                        {cropLabelFromId(id)}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="crop-muted">
                {state.config == null ? (
                  <span className="pill red">Δεν έχει γίνει παραμετροποίηση της εγκατάστασης!</span>
                ) : (
                  <span className="muted">..</span>
                )}
              </div>
            )}
          </div>

          {/* Pathogens card (opens modal) */}
          <div
            id="link-patho"
            className="linkwrap"
            style={{ marginTop: 14, display: "block", cursor: "pointer" }}
            role="button"
            tabIndex={0}
            onClick={openPathoModal}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPathoModal();
              }
            }}
          >
            <div className="card" id="pathoCard">
              <div className="row">
                <h3>Συναγερμοί Παθογόνων</h3>
                {protectionSummary && (
                  <span
                    className="badge b-green"
                    title={`Κατάσταση προστασίας ενεργή έως ${protectionSummary.untilText}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    🛡️ Προστασία ενεργή
                    {protectionSummary.activeCount > 1 ? ` ×${protectionSummary.activeCount}` : ""}
                    {" · έως "}
                    {protectionSummary.untilText}
                  </span>
                )}
              </div>
              <div id="pathoList" className="list">
                {pathoItems.length === 0 ? (
                  <div className="empty">
                    Δεν υπάρχει τρέχων κίνδυνος από κάποιο από τα παθογόνα που υποστηρίζει η εφαρμογή.
                  </div>
                ) : (
                  pathoItems.map((p, idx) => (
                    <div className="alert-item" key={idx}>
                      <div>
                        <div className="alert-label">{p.name}</div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {p.text}
                        </div>
                      </div>
                      <span className={`badge ${p.badgeClass}`}>{p.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Weather alerts (frost / heat) — PATCH_30. Hidden when none. */}
          {weatherAlerts.length > 0 && (
            <div className="grid" style={{ marginTop: 14 }}>
              <div className="card" id="weatherAlertCard">
                <div className="row">
                  <h3>Καιρικοί Συναγερμοί</h3>
                </div>
                <div className="list">
                  {weatherAlerts.map((a) => (
                    <div className="alert-item" key={a.key}>
                      <div>
                        <div className="alert-label">
                          {a.kind === "frost" ? "❄️ Παγετός" : "🔥 Καύσωνας"}
                        </div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {a.text}
                        </div>
                      </div>
                      <span className={`badge b-${a.color}`}>
                        {a.severity === "emergency" ? "Έκτακτο" : "Προειδοποίηση"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Insect generations «Γενιά N» — PATCH_23. Hidden when none. */}
          {pestGenerations.length > 0 && (
            <div className="grid" style={{ marginTop: 14 }}>
              <div className="card" id="pestGenCard">
                <div className="row">
                  <h3>Γενιές Εντόμων</h3>
                </div>
                <div className="list">
                  {pestGenerations.map((g) => (
                    <div className="alert-item" key={g.key}>
                      <div>
                        <div className="alert-label">{g.name}</div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {g.phase}
                          {g.diapause ? " · Διάπαυση" : ""}
                        </div>
                      </div>
                      <span className={`badge b-${g.color}`}>
                        Γενιά {g.generation}
                        {g.maxGen ? `/${g.maxGen}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Growth / Stress / Irrigation */}
          <div className="grid g-3">
            {/* BPI */}
            <div id="link-bpi" className="linkwrap" rel="noopener">
              <div className="card" id="bpiCard">
                <div className="row">
                  <h3>Δυναμικό Ανάπτυξης</h3>
                  <span className={bpiBadgeClass}>{bpiBadgeText}</span>
                </div>
                <p className={`desc ${bpiTextMuted ? "muted" : ""}`}>{bpiText}</p>
                {(bpiExtra.perfPct !== null || bpiExtra.stomata || bpiExtra.bucketLabel) && (
                  <div className="bpi-extra" style={{ marginTop: 6, fontSize: "0.85em" }}>
                    {bpiExtra.perfPct !== null && (
                      <div className="muted">Απόδοση δυναμικού: {bpiExtra.perfPct}%</div>
                    )}
                    {bpiExtra.stomata && (
                      <div className="muted">Στόματα φύλλων: {bpiExtra.stomata}</div>
                    )}
                    {bpiExtra.bucketLabel && (
                      <span className={bpiExtra.bucketClass} style={{ marginTop: 4, display: "inline-block" }}>
                        {bpiExtra.bucketLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stress */}
            <div id="link-stress" className="linkwrap" rel="noopener">
              <div className="card" id="stressCard">
                <div className="row">
                  <h3>Στρες Φυτού</h3>

                  {!displayPrefs.showAllStress && <span className={stressBadgeClass}>{stressBadgeText}</span>}

                  {displayPrefs.showAllStress && availableCrops.length > 1 && (
                    <button
                      className="mini-btn"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDisplayPrefsOpen(true);
                      }}
                      title="Ρυθμίσεις προβολής"
                    >
                      Προβολή
                    </button>
                  )}
                </div>

                {!displayPrefs.showAllStress && (
                  <p className={`desc ${stressTextMuted ? "muted" : ""}`}>{stressText}</p>
                )}

                {displayPrefs.showAllStress && (
                  <div className="crop-stress-list">
                    {(stressByCrop.length
                      ? stressByCrop
                      : [{ cropId: "—", cropLabel: "—", valueStr: "—", badgeClass: "badge b-yellow", text: "" }]
                    ).map((s: any) => {
                      if (s.cropId !== "—" && !isCropMetricVisible(String(s.cropId), "plant_stress")) return null;
                      return (
                        <div key={String(s.cropId)} className="crop-stress-item">
                          <div className="row">
                            <span className="muted small">{s.cropLabel}</span>
                            <span className={s.badgeClass}>{s.valueStr}</span>
                          </div>
                          {s.text ? <div className="muted small">{s.text}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Irrigation */}
            <div className="card" id="irrigCard" onClick={() => setIrrigOpen(true)} style={{ cursor: "pointer" }}>
              <div className="row">
                <h3>Άρδευση</h3>
              </div>
              <p className="desc muted">Προβολή μετρικών και εργαλείων άρδευσης.</p>
            </div>
          </div>

          {/* Forecast */}
          <div className="grid g-3" style={{ marginTop: 14 }}>
            <div className="card" id="forecastCard" onClick={() => setForecastOpen(true)} style={{ cursor: "pointer" }}>
              <div className="row">
                <h3>Πρόγνωση Καιρού</h3>
              </div>
              {forecastCardInfo.nextEntry ? (
                <>
                  <div className="card-icon-row">
                    <span style={{ fontSize: 38, lineHeight: 1 }}>{forecastCardInfo.nextEntry.emoji}</span>
                    <div>
                      <div className="card-icon-label">{forecastCardInfo.nextEntry.label}</div>
                      <div className="card-icon-sub muted">
                        {forecastCardInfo.nextDateISO} · {forecastCardInfo.nextEntry.time}
                      </div>
                    </div>
                  </div>
                  <div className="card-chips">
                    {[
                      { label: "Θερμ.", value: forecastCardInfo.nextEntry.temp },
                      { label: "Άνεμος", value: forecastCardInfo.nextEntry.wind },
                    ].map(({ label, value }) => (
                      <div key={label} className="card-chip">
                        <div className="card-chip-label">{label}</div>
                        <div className="card-chip-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="desc muted" style={{ marginBottom: 6 }}>
                    {forecastCardInfo.daysCount
                      ? `Διαθέσιμες ημέρες: ${forecastCardInfo.daysCount} · Επόμενη: ${forecastCardInfo.nextDateISO} (${forecastCardInfo.nextMinMax})`
                      : "Προβολή πρόγνωσης για τις επόμενες ημέρες."}
                  </p>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Τελευταία ενημέρωση: {forecastCardInfo.lastUpdate}
                  </div>
                </>
              )}
            </div>
            {sprayRec && (
              <div
                className="card"
                id="sprayCard"
                onClick={() => setSprayOpen(true)}
                style={{ cursor: "pointer" }}
              >
                <div className="row">
                  <h3>Ψεκασμός</h3>
                  <span className={sprayBadgeClass}>{STATUS_LABEL[sprayRec.status]}</span>
                </div>
                <div className="card-icon-row">
                  <SprayStatusIcon status={sprayRec.status} size={44} />
                  <div>
                    <div className="card-icon-label">{sprayRec.label}</div>
                    {sprayRec.window ? (
                      <div className="card-icon-sub muted">
                        Παράθυρο: {sprayRec.window.start} – {sprayRec.window.end}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          {homeMeasurements.length > 0 && (
            <div className="grid g-3" style={{ marginTop: 14 }}>
              {homeMeasurements.map((variable) => {
                const e = state.latest[variable];
                const cfg = getVarConfig(variable);
                const title = cfg?.label || humanizeKey(variable);

                const value = e ? formatLatestValue(variable, e.value) : "—";
                const time = e ? formatLatestTime(e.time) : "—";

                return (
                  <div key={variable} className="card">
                    <div className="row">
                      <h3>{title}</h3>
                    </div>
                    <p className="desc" style={{ marginBottom: 6 }}>
                      {value}
                    </p>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {time}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Right Sidebar */}
        <aside className="side">
          <div className="card" id="varsCard">
            <div className="row">
              <h3>Μετρήσεις</h3>
            </div>
            <ul id="varsList" className="bullets">
              {/* NEW: first bullet for All Measurements */}
              <li
                key="__all__"
                className="bullet-item"
                role="button"
                tabIndex={0}
                onClick={() => setAllModalOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setAllModalOpen(true);
                  }
                }}
              >
                Όλες οι μετρήσεις
              </li>

              {sidebarDevices.length === 0 ? (
                <li className="empty">Δεν έχουν ληφθεί δεδομένα ακόμα.</li>
              ) : (
                sidebarDevices.map((id) => {
                  const name = friendlyDeviceName(id);
                  return (
                    <li
                      key={id}
                      className="bullet-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => openDeviceModal(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDeviceModal(id);
                        }
                      }}
                    >
                      {name}
                    </li>
                  );
                })
              )}
            </ul>
          </div>



            <div
              className="card"
              id="calendarCard"
              onClick={() => {
                if (!selectedDeviceId && sidebarDevices.length) {
                  setSelectedDeviceId(sidebarDevices[0]);
                }
                setCalendarOpen(true);
                console.log("Selected device id: ", selectedDeviceId);
              }}
              style={{ cursor: "pointer" }}
            >
              <div className="row">
                <h3>Καλλιεργητικό Ημερολόγιο</h3>
              </div>
              <p className="desc muted" style={{ marginBottom: 3 }}>
                Καταγραφή ενεργειών και παρατηρήσεων για τον αγρό.
              </p>
            </div>

          <div id="configCard">
            <a
              id="cfgLink"
              className="cfg-link"
              tabIndex={0}
              aria-label="Μετάβαση στην Παραμετροποίηση"
              href={linkHrefFor(tabTargets.config)}
              target="_parent"
              rel="noopener"
              onClick={(e) => {
                if (!dashboardId) {
                  e.preventDefault();
                  alert("Λείπει το parameter 'dashboard_id' στο widget.");
                }
              }}
            >
              <span>Παραμετροποίηση</span>
              <span className="hint">Άνοιγμα καρτέλας →</span>
            </a>
          </div>
        </aside>
      </div>}

      {/* Modals */}
      <MeasurementModal
        open={modalOpen}
        variable={selectedVar}
        label={selectedLabel || "Λεπτομέρειες μέτρησης"}
        series={modalSeries}
        unit={modalUnit}
        refLines={modalRefLines}
        deviceId={modalDeviceId}
        onFetchRange={requestHistory}
        fetchedHistory={historyResponse}
        onClose={closeMeasurementModal}
      />

      <PathoModal
        open={pathoModalOpen}
        latest={uiLatest}
        pathogens={PATHOGENS}
        onDeclare={handleDeclaration}
        onClose={closePathoModal}
      />

      <EnvironmentConditionsModal
        open={envModalOpen}
        onClose={() => setEnvModalOpen(false)}
        latest={state.latest}
        onSendData={handleSendData}
      />

      <IrrigationModal
        open={irrigOpen}
        onClose={() => setIrrigOpen(false)}
        devices={irrigationDevicesArray}
        deviceMap={deviceMap}
        latestByDevice={state.latestByDevice}
        sensorFault={irrigationSensorFault}
        onSendCommand={handleIrrigationCommand}
        onSendData={handleSendData}
      />

      <DeviceMeasurementsModal
        open={deviceModalOpen}
        deviceId={selectedDeviceId}
        deviceName={friendlyDeviceName(selectedDeviceId)}
        history={state.history}
        measTable={measTable}
        onSelectMeasurement={handleDeviceMeasurementSelect}
        onClose={() => setDeviceModalOpen(false)}
      />

      <AllMeasurementsModal
        open={allModalOpen}
        deviceIds={sidebarDevices}
        deviceNameOf={friendlyDeviceName}
        history={state.history}
        measTable={measTable}
        onSelectMeasurement={handleAllMeasurementSelect}
        onClose={() => setAllModalOpen(false)}
      />

      <ForecastModal open={forecastOpen} onClose={() => setForecastOpen(false)} forecastLatest={state.forecastLatest} />

      <SprayModal open={sprayOpen} onClose={() => setSprayOpen(false)} forecastLatest={state.forecastLatest} />

      <CultivationCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        deviceName={friendlyDeviceName(selectedDeviceId)}
        points={Object.values(state.calendarHistory).flat()}
        onCreate={async (item) => {
          // field_calendar MUST be sent with autofill=TRUE so TagoIO routes it (no explicit device)
          // to the configured field device. The generic handleSendData forces autofill=false (correct
          // for irrigation rules, which target a specific device), which silently dropped calendar
          // saves — do a dedicated autofill send here instead.
          const TagoIO = (window as any).TagoIO;
          if (!TagoIO || typeof TagoIO.sendData !== "function") {
            alert("Δεν είναι διαθέσιμη η αποστολή δεδομένων σε αυτό το περιβάλλον.");
            throw new Error("TagoIO.sendData unavailable");
          }
          try {
            TagoIO.autofill = true;
            await TagoIO.sendData([item]);
          } catch (err) {
            console.error("Error saving calendar entry:", err);
            alert("Αποτυχία αποθήκευσης καταγραφής.");
            throw err;
          } finally {
            TagoIO.autofill = true;
          }
        }}
      />

      {/* Display Preferences Modal */}
      {displayPrefsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h2>Ρυθμίσεις προβολής</h2>
              <button className="btn" type="button" onClick={() => setDisplayPrefsOpen(false)}>
                Κλείσιμο
              </button>
            </div>

            <div className="modal-body">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <strong>Στρες φυτού</strong>
                  <div className="muted small">Εμφάνιση καρτέλας για επιλεγμένη ή για πολλές καλλιέργειες.</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!displayPrefs.showAllStress}
                    onChange={(e) => toggleAllStress(e.target.checked)}
                  />
                  <span>Όλες οι καλλιέργειες</span>
                </label>
              </div>

              {displayPrefs.showAllStress && availableCrops.length > 1 && (
                <div className="prefs-crops">
                  <div className="muted small" style={{ marginBottom: 8 }}>
                    Επέλεξε ποιες καλλιέργειες θα εμφανίζονται στη λίστα στρες:
                  </div>
                  {availableCrops.map((c: any) => {
                    const id = String(c?.id || "");
                    const checked = isCropMetricVisible(id, "plant_stress");
                    return (
                      <label key={id} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setCropMetricVisible(id, "plant_stress", e.target.checked)}
                        />
                        <span>{cropLabelFromId(id)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
