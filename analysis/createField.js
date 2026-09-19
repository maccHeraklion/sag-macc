/* eslint-disable no-console */
const { Analysis, Account, Resources, Device } = require("@tago-io/sdk");

let account;
var account_token;

/*** DEVICE TYPE → VARIABLES MAP
     Add new device types here. Variables are assigned to the dashboard regardless
     of whether data already exists on the device. ***/

// UC511 automation variables for a given HW generation. v4 controllers drive irrigation via RULES
// (rule*), legacy (v3) via PLANS (plan*); the Εντολές κανόνων modal picks the family from the
// generation. rules_enabled_mask is generation-independent. Select at runtime via env
// UC511_HW_GENERATION ("v4" default | "legacy"). Keep in sync with addSensorsToField.js and
// migrateControllerRuleVars.js. See [[tagoio-autofill-multi-device-send]].
function uc511AutomationVars(generation) {
  const legacy = /^(legacy|v3|plan)/i.test(String(generation || ""));
  const family = legacy ? "plan" : "rule";
  const out = ["rules_enabled_mask"];
  for (let n = 1; n <= 16; n++) out.push(`${family}${n}`, `${family}${n}_enable`, `${family}${n}_set`);
  return out;
}

// Full uc511 subscription for a generation: valves + FE1D downlink-received feedback echoes
// (generation-independent, drive the overlay's step-1 ack) + the automation family.
function uc511Vars(generation) {
  return [
    "batterypct", "hw_version",
    "valve_1", "valve_1_command", "valve_1_time_command", "valve_1_command_feedback",
    "valve_2", "valve_2_command", "valve_2_time_command", "valve_2_command_feedback",
    ...uc511AutomationVars(generation),
  ];
}

// FALLBACK HW generation from env (default "v4"), used only when a controller's hw_version can't be
// read. Per-controller auto-detection (below) takes precedence.
function readUc511Generation(context) {
  const raw = context.environment.find(
    (e) => e.key === "UC511_HW_GENERATION" || e.key === "HW_GENERATION"
  )?.value;
  return /^(legacy|v3|plan)/i.test(String(raw || "")) ? "legacy" : "v4";
}
let DEFAULT_UC511_GEN = "v4"; // set from env in myAnalysis; fallback when hw_version is unknown

// "v4.1"/"4"/"V3" → major number → "v4" (>=4) | "legacy" (<4) | null (unparseable).
function generationFromHw(raw) {
  const m = String(raw || "").trim().match(/v?\s*(\d+)/i);
  if (!m) return null;
  const major = Number(m[1]);
  return Number.isFinite(major) ? (major >= 4 ? "v4" : "legacy") : null;
}

async function ensureDeviceToken(acc, id) {
  try { const t = await acc.devices.tokenList(id); if (t?.[0]?.token) return t[0].token; } catch (_) { /* ignore */ }
  const c = await acc.devices.tokenCreate(id, { name: "gen_detect_tmp" });
  return c?.token;
}

// Detect a UC511 controller's HW generation: hw_version TAG (uc511_downlink maintains it) → latest
// hw_version DATA → fallbackGen. `device` may be a full device object (with tags) or an id string.
async function detectUc511Generation(acc, device, fallbackGen) {
  const id = (device && device.id) || device;
  let tags = device && Array.isArray(device.tags) ? device.tags : null;
  if (!tags && id) tags = (await acc.devices.info(id).catch(() => ({})))?.tags || [];
  const tagHw = (tags || []).find((t) => String(t.key).toLowerCase() === "hw_version")?.value;
  let gen = generationFromHw(tagHw);
  if (gen) { console.log(`UC511 ${id}: hw_version tag "${tagHw}" → ${gen}`); return gen; }
  try {
    const token = await ensureDeviceToken(acc, id);
    const dev = new Device({ token });
    const data = await dev.getData({ variables: "hw_version", qty: 1 });
    const raw = Array.isArray(data) && data[0] ? data[0].value : null;
    gen = generationFromHw(raw);
    if (gen) { console.log(`UC511 ${id}: hw_version data "${raw}" → ${gen}`); return gen; }
  } catch (_) { /* ignore */ }
  console.log(`UC511 ${id}: hw_version unknown → fallback ${fallbackGen}`);
  return fallbackGen;
}

const DEVICE_TYPE_VARIABLES = {
  em320:    ["temperature", "humidity"],
  em320_th: ["temperature", "humidity"],
  em300_th: ["temperature", "humidity", "dew_point"],
  sph01:    ["soil_ph", "temp_soil"],
  s2120: [
    "air_temperature",
    "air_humidity",
    "wind_speed_kmh",
    "uv_index",
    "light_intensity",
    "rain_height_hourly",
    "current_rain_height_daily",
    "current_rain_height_weekly",
    "current_rain_height_monthly",
    "current_rain_height_yearly",
    "barometric_pressure_hpa",
    "dew_point",
    "wind_direction_sensor"
  ],
  se0x: [
    "soil_moisture1", "soil_temperature1", "conduct_soil1", "fertility_index1",
    "soil_moisture2", "soil_temperature2", "conduct_soil2", "fertility_index2",
  ],
  lse02: [
    "soil_moisture1", "soil_temperature1", "conduct_soil1", "fertility_index1",
    "soil_moisture2", "soil_temperature2", "conduct_soil2", "fertility_index2",
  ],
  lse01:    ["soil_moisture", "temp_soil", "conduct_soil"],
  // Single-sensor soil probe assigned to ONE depth (two lse01 = shallow + deep field).
  // Depth is encoded in the variable-name suffix (_1 = Ρηχό/shallow, _2 = Βαθύ/deep), matching
  // the two-depth lse02/se0x slots. The device must EMIT these suffixed names — assign the
  // matching payload parser (dragino_lse01_shallow_parser.js / _deep_parser.js). The form sets
  // the device's `type` tag to one of these variants (see deviceN_soil handling).
  lse01_shallow: ["soil_moisture1", "soil_temperature1", "conduct_soil1"],
  lse01_deep:    ["soil_moisture2", "soil_temperature2", "conduct_soil2"],
  lms01_ls: ["leaf_temperature", "leaf_moisture"],
  // Default to v4 (rules); myAnalysis overrides this from env UC511_HW_GENERATION before wiring.
  uc511: uc511Vars("v4"),
};

/** Return variables for a device based on its "type" tag. Returns [] if type is unknown. */
function getVariablesByDeviceType(device) {
  const typeTag = device.tags?.find((t) => String(t.key).toLowerCase() === "type")?.value;
  if (!typeTag) {
    console.log(`Device ${device.id} (${device.name}) has no "type" tag — skipping variable assignment.`);
    return [];
  }
  const vars = DEVICE_TYPE_VARIABLES[typeTag.toLowerCase()];
  if (!vars) {
    console.log(`Device type "${typeTag}" for device ${device.id} not in DEVICE_TYPE_VARIABLES — skipping.`);
    return [];
  }
  return vars;
}

/** Template placeholder field device id used inside the template dashboard */
const TEMPLATE_FIELD_DEVICE_ID = "686c0f54172d7e000b7191f3";

/*** PER-TAB VARIABLE FILTERS (edit these; supports "*" suffix wildcards) ***/
const TAB_VARS = {
  0: ["soil_moisture*", "soil_temp*", "fertility_index*", "temperature", "humidity", "fir_message_*"],
  1: ["flow", "totalizer", "valve_*", "fir_message_*"],
  2: ["rain", "wind_*", "uv", "irradiance"],
  3: [], // empty → include all
};

/*** Subscription factor (edit me)
     subscriptionCost = SUBSCRIPTION_FACTOR × (# unique selected variables) ***/
const SUBSCRIPTION_FACTOR = 5; // e.g., €5 per variable

/* ------------------ UTILITIES ------------------ */

async function addToGeneralMap(deviceId, dashboardId, fieldName, fieldDeviceName) {
  const MAIN_DEVICES_MAP_DASHBOARD = "684da2deba4998000a7bf6fe";
  const MAIN_DEVICES_MAP_WIDGET = "684da310cc1cd8000a5c9c55";

  const widget_info = await account.dashboards.widgets.info(
    MAIN_DEVICES_MAP_DASHBOARD,
    MAIN_DEVICES_MAP_WIDGET
  );

  widget_info.data = widget_info.data || [];
  widget_info.data.push({
    qty: 500,
    bucket: deviceId,
    origin: deviceId,
    timezone: "Europe/Athens",
    variables: ["location"],
  });

  widget_info.display = widget_info.display || {};
  widget_info.display.variables = widget_info.display.variables || [];
  widget_info.display.variables.push({
    origin: deviceId,
    variable: "location",
    bucket: deviceId,
    pin_id: "y084gtdy6B0eYlgs_7FIb",
    data_params: {
      interval: null,
      query: null,
      function: null,
      value: null,
      period: { start_date: null, end_date: null },
    },
    infobox: {
      image: { static_image: "" },
      link: {
        url: "admin.tago.io/dashboards/info/".concat(dashboardId.toString()),
        label: "Επισκόπιση",
      },
    },
    pin_config: {
      icon_type: "fixed",
      icon: "https://svg.internal.tago.io/plant-leaf-with-white-details.svg",
    },
    alias: fieldName,
  });

  widget_info.data_names = widget_info.data_names || {};
  widget_info.data_names.origins = widget_info.data_names.origins || [];
  widget_info.data_names.origins.push({ id: deviceId, name: fieldDeviceName });

  await account.dashboards.widgets.edit(
    MAIN_DEVICES_MAP_DASHBOARD,
    MAIN_DEVICES_MAP_WIDGET,
    widget_info
  );
}

// Synchronous to avoid arrays of Promises
function euiValidation(eui) {
  if (!eui) return undefined;
  const charsToRemove = ["-", " ", "  "];
  eui = eui
    .toString()
    .toLowerCase()
    .split("")
    .filter((char) => !charsToRemove.includes(char.toLowerCase()))
    .join("");

  if (eui.startsWith("la")) {
    const parts = eui.split(";");
    if (parts[1]) eui = parts[1];
  }
  eui = eui.substring(0, 16);
  if (!/^[0-9a-f]{16}$/.test(eui)) return undefined;
  return eui;
}

function parseCoordinates(coordStr) {
  const [latStr, lngStr] = coordStr.split(",").map((s) => s.trim());
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid coordinate string");
  return { latitude: lat, longitude: lng };
}

async function sendLocation(deviceId, coordinates) {
  const { latitude, longitude } = parseCoordinates(coordinates);
  await Resources.devices.sendDeviceData(deviceId, {
    variable: "location",
    value: "",
    location: { lat: latitude, lng: longitude },
  });
}

function reassignKeysByMap(obj, map) {
  if (Array.isArray(obj)) {
    obj.forEach((element) => {
      if (typeof element === "object" && element !== null) {
        reassignKeysByMap(element, map);
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === "object" && value !== null) {
        reassignKeysByMap(value, map);
      } else if (Object.prototype.hasOwnProperty.call(map, value)) {
        obj[key] = map[value];
      }
      if (Array.isArray(value)) {
        value.forEach((element) => {
          if (typeof element === "object" && element !== null) {
            reassignKeysByMap(element, map);
          }
        });
      }
    }
  }
}

function getSubgroupFromCustomer(customerInfo) {
  return customerInfo.tags.find((item) => item.key === "tab")?.value;
}
function getNameFromCustomer(customerInfo) {
  return customerInfo.tags.find((item) => item.key === "name")?.value;
}
function getAccessFromCustomer(customerInfo) {
  return customerInfo.tags.find((item) => item.key === "access")?.value;
}
function getAccessFromUser(userInfo) {
  // console.log('userInfo: ', userInfo)
  return userInfo.tags.find((item) => item.key === "access")?.value;
}

/* ------------------ DEVICE DISCOVERY (agnostic by EUI) ------------------ */
/** Build device_id -> user_name map using found devices and (eui,name) pairs. */
function buildDeviceIdToNameMap(foundDevices, euiNamePairs) {
  const nameByEui = new Map();
  for (const { eui, name } of euiNamePairs) {
    const cleaned = (name ?? "").toString().trim();
    if (eui && cleaned) nameByEui.set(eui.toLowerCase(), cleaned);
  }

  const map = {};
  for (const dev of foundDevices) {
    if (!dev?.id) continue;

    // find the device's EUI (populated earlier in getDevicesFromEUI)
    const eui = dev?._eui?.toLowerCase();

    // 1) user-provided (if present)
    let label = eui ? nameByEui.get(eui) : undefined;

    // 2) fallback: device.name from Tago
    if (!label || !label.trim()) {
      label = (dev.name ?? "").toString().trim();
    }

    // 3) last resort: "name" tag (rarely needed)
    if (!label || !label.trim()) {
      const tagName = dev.tags?.find((t) => String(t.key).toLowerCase() === "name")?.value;
      label = (tagName ?? "").toString().trim();
    }

    // If we have any non-empty label, include it
    if (label && label.trim()) {
      map[dev.id] = label;
    }
  }

  return map;
}

function upsertDisplayParameter(display, key, value) {
  if (!display) return;
  display.parameters = Array.isArray(display.parameters) ? display.parameters : [];
  const existing = display.parameters.find((p) => p?.key === key);
  if (existing) existing.value = value;
  else display.parameters.push({ key, value });
}

async function getDevicesFromEUI(euis) {
  const orderedDevices = [];
  const seen = new Set();

  // Safety: max per page; tune if needed
  const PAGE_SIZE = 100;

  for (const tag of euis) {
    let page = 1;

    while (true) {
      const result = await Resources.devices.list({
        page,
        amount: PAGE_SIZE,
        fields: ["name", "id", "tags", "bucket_id", "bucket"],
        filter: { tags: [tag] },
      });

      if (!Array.isArray(result) || result.length === 0) break;

      for (const raw of result) {
        if (!raw) continue;

        // Normalize bucket id field for wiring (we don't use it to fetch data)
        const normalized = {
          ...raw,
          bucket_id:
            raw.bucket_id ??
            (typeof raw.bucket === "string" ? raw.bucket : raw?.bucket?.id) ??
            undefined,
        };

        // Capture EUI tag for later joining with user-provided names
        const euiTag = normalized.tags?.find((t) => String(t.key).toLowerCase() === "eui");
        normalized._eui = euiTag?.value?.toLowerCase?.();

        if (!seen.has(normalized.id)) {
          seen.add(normalized.id);
          orderedDevices.push(normalized);
        }
      }

      // advance to next page
      page += 1;

      // If fewer than PAGE_SIZE came back, we've reached the end.
      if (result.length < PAGE_SIZE) break;
    }
  }

  return orderedDevices;
}


/* -------- devicesNum from scope & EUI collection with cap -------- */

function getDevicesNumFromScope(scope) {
  const raw = scope.find((i) => i.variable === "devicesnum")?.value;
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return Infinity;
}

function collectEUIsFromScope(scope, maxDevices = Infinity) {
  const deviceVars = scope
    .filter((i) => /^device\d+$/i.test(i.variable))
    .map((i) => ({ idx: parseInt(i.variable.replace(/^\D+/g, ""), 10), item: i }))
    .filter((x) => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .slice(0, maxDevices)
    .map((x) => x.item);

  const euIs = [];
  for (const item of deviceVars) {
    if (!item?.value) continue;
    const raw = String(item.value).trim();
    const pieces = raw.toLowerCase().split(/[^0-9a-f]+/i).filter(Boolean);
    for (const chunk of pieces) {
      const m = chunk.match(/[0-9a-f]{16}/);
      if (m) euIs.push(m[0]);
    }
  }
  return Array.from(new Set(euIs));
}

/** Collect ordered pairs (EUI, name) from scope based on deviceX / deviceX_name. */
function collectEUINamePairsFromScope(scope, maxDevices = Infinity) {
  // get ordered deviceX variables (same logic as collectEUIsFromScope)
  const deviceVars = scope
    .filter((i) => /^device\d+$/i.test(i.variable))
    .map((i) => ({ idx: parseInt(i.variable.replace(/^\D+/g, ""), 10), item: i }))
    .filter((x) => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .slice(0, maxDevices);

  const result = [];
  const seenEUIs = new Set();

  for (const { idx, item } of deviceVars) {
    const raw = String(item.value || "").trim().toLowerCase();
    const pieces = raw.split(/[^0-9a-f]+/i).filter(Boolean);
    const m = pieces.join("").match(/[0-9a-f]{16}/);
    if (!m) continue;

    const eui = euiValidation(m[0]);
    if (!eui || seenEUIs.has(eui)) continue;

    // match optional deviceX_name next to same index
    const nameVar = scope.find((s) => s.variable?.toLowerCase() === `device${idx}_name`);
    const friendly = (nameVar?.value ?? "").toString().trim();
    seenEUIs.add(eui);
    result.push({ eui, name: friendly || null });
  }

  return result;
}


/** Normalize a form soil-depth choice to "shallow" | "deep" | null. Accepts EN + Greek. */
function normalizeSoilDepth(raw) {
  const s = (raw ?? "").toString().trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("deep") || s.startsWith("βαθ") || s === "2") return "deep";
  if (s.startsWith("shallow") || s.startsWith("ρηχ") || s === "1") return "shallow";
  return null;
}

/** Collect ordered pairs (EUI, soil) from scope based on deviceX / deviceX_soil. */
function collectEUISoilPairsFromScope(scope, maxDevices = Infinity) {
  const deviceVars = scope
    .filter((i) => /^device\d+$/i.test(i.variable))
    .map((i) => ({ idx: parseInt(i.variable.replace(/^\D+/g, ""), 10), item: i }))
    .filter((x) => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .slice(0, maxDevices);

  const result = [];
  for (const { idx, item } of deviceVars) {
    const raw = String(item.value || "").trim().toLowerCase();
    const m = raw.split(/[^0-9a-f]+/i).filter(Boolean).join("").match(/[0-9a-f]{16}/);
    if (!m) continue;
    const eui = euiValidation(m[0]);
    if (!eui) continue;
    const soilVar = scope.find((s) => s.variable?.toLowerCase() === `device${idx}_soil`);
    const soil = normalizeSoilDepth(soilVar?.value);
    if (soil) result.push({ eui, soil });
  }
  return result;
}

/** Pin single-sensor soil probes to a depth by setting their `type` tag to lse01_shallow/deep.
 *  Mutates each device's in-memory tags too, so the variable index picks up the new depth.
 *  Only lse01-family devices are specialized (others are skipped, with a log). */
async function applySoilDepthTags(foundDevices, euiSoilPairs) {
  const soilByEui = new Map();
  for (const { eui, soil } of euiSoilPairs) if (eui && soil) soilByEui.set(eui.toLowerCase(), soil);
  if (!soilByEui.size) return;
  for (const dev of foundDevices) {
    const eui = dev?._eui?.toLowerCase();
    const soil = eui ? soilByEui.get(eui) : null;
    if (!soil) continue;
    const curType = (dev.tags || []).find((t) => String(t.key).toLowerCase() === "type")?.value;
    if (curType && !/^lse01/i.test(String(curType))) {
      console.log(`Soil depth: skipping ${dev.name || dev.id} — type "${curType}" is not lse01.`);
      continue;
    }
    const targetType = soil === "deep" ? "lse01_deep" : "lse01_shallow";
    const tags = (dev.tags || []).filter((t) => String(t.key).toLowerCase() !== "type");
    tags.push({ key: "type", value: targetType });
    try {
      await account.devices.edit(dev.id, { tags });
      dev.tags = tags; // so buildDeviceVariableIndex/getVariablesByDeviceType uses the new depth
      console.log(`Soil depth: ${dev.name || dev.id} → type ${targetType} (assign dragino_lse01_${soil}_parser.js to this device)`);
    } catch (e) {
      console.log(`Soil depth: failed to tag ${dev.id}: ${e && e.message}`);
    }
  }
}

/* ---------- INDEX: derive variables from device type tag ---------- */
async function buildDeviceVariableIndex(devices) {
  const perDevice = {};       // device_id → [{ variable, bucket_id, alias }]
  const bestByVariable = {};  // variable → best device entry
  const deviceMeta = {};      // device_id → { id, name, tags, bucket_id }

  for (const dev of devices) {
    if (!dev) continue;

    const device_id = dev.id;
    const bucket_id =
      dev.bucket_id ??
      (typeof dev.bucket === "string" ? dev.bucket : dev?.bucket?.id) ??
      undefined;

    // store base metadata
    deviceMeta[device_id] = {
      id: dev.id,
      name: dev.name,
      tags: dev.tags,
      bucket_id,
    };

    // Variables from device type tag. UC511 controllers pick rules-vs-plans by auto-detecting the
    // HW generation from hw_version (fallback DEFAULT_UC511_GEN when unknown).
    const typeTag = (dev.tags?.find((t) => String(t.key).toLowerCase() === "type")?.value || "").toLowerCase();
    let variables;
    if (typeTag === "uc511") {
      const gen = await detectUc511Generation(account, dev, DEFAULT_UC511_GEN);
      variables = uc511Vars(gen);
    } else {
      variables = getVariablesByDeviceType(dev);
    }
    if (!variables || variables.length === 0) continue;

    // build per-device entry list
    perDevice[device_id] = variables.map((variable) => {
      const alias = `${dev.name || device_id} • ${variable}`;
      return { variable, bucket_id, alias, device_id };
    });

    // update bestByVariable: first wins (or apply your own priority)
    for (const variable of variables) {
      if (!bestByVariable[variable]) {
        bestByVariable[variable] = {
          device_id,
          bucket_id,
          alias: `${dev.name || device_id} • ${variable}`,
          variable,
        };
      }
    }
  }

  return { perDevice, bestByVariable, deviceMeta };
}

/* ---------------------- Per-tab variable filters (wildcards) --------------- */

function parseTabVarsEntryArray(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null; // null => all variables
  const exact = new Set();
  const prefixes = [];
  for (const raw of arr) {
    const token = String(raw).trim();
    if (!token) continue;
    if (token.endsWith("*")) prefixes.push(token.slice(0, -1));
    else exact.add(token);
  }
  return { exact, prefixes };
}

function getTabVarFiltersFromCode() {
  const m = new Map();
  for (const [k, arr] of Object.entries(TAB_VARS)) {
    const idx = Number(k);
    m.set(idx, parseTabVarsEntryArray(arr));
  }
  return m;
}

function variableMatchesFilter(variable, filter) {
  if (filter === null) return true; // all acceptable
  if (filter.exact.has(variable)) return true;
  for (const p of filter.prefixes) if (variable.startsWith(p)) return true;
  return false;
}

/*** Unique list of all selected variables across tabs (no duplicates).
     Applies wildcards to the type-derived available variables. ***/
function computeSelectedVariables(tabFilters, availableVariables) {
  // Any tab == null → all available
  for (const f of tabFilters.values()) {
    if (f === null) {
      return Array.from(availableVariables).sort();
    }
  }
  const u = new Set();
  for (const filter of tabFilters.values()) {
    if (!filter) continue;
    for (const v of availableVariables) {
      if (variableMatchesFilter(v, filter)) u.add(v);
    }
  }
  return Array.from(u).sort();
}

/* ---- All device rows across every discovered device (for tab 0) ----------- */
function buildAllDeviceRows(deviceIndex) {
  const { perDevice } = deviceIndex;
  console.log("buildAllDeviceRows: devices in index:", Object.keys(perDevice).length);
  const rows = [];
  const seen = new Set();

  for (const entries of Object.values(perDevice)) {
    for (const rec of entries) {
      const key = `${rec.device_id}::${rec.variable}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        origin: rec.device_id,
        variable: rec.variable,
        bucket: rec.bucket_id || rec.device_id,
        alias: rec.alias,
        data_params: {
          interval: null,
          query: null,
          function: null,
          value: null,
          period: { start_date: null, end_date: null },
        },
      });
    }
  }

  return rows;
}

/* ---- Ensure the custom widget subscribes to a field_bundle SIBLING variable (same field-device
   origin) wherever it reads field_bundle. Used for field_bundle_2 (pathogen/pest overflow, deep-
   merged) and field_calendar (cultivation log). Idempotent; mirrors both the data[] subscription
   and the display.variables entry. Returns true if it changed the widget. */
function ensureFieldBundleSibling(widget, sibling) {
  if (!widget || typeof widget !== "object") return false;
  let changed = false;
  if (Array.isArray(widget.data)) {
    for (const d of widget.data) {
      const vars = Array.isArray(d?.variables) ? d.variables : null;
      if (vars && vars.includes("field_bundle") && !vars.includes(sibling)) {
        vars.push(sibling);
        changed = true;
      }
    }
  }
  const dv = widget.display && Array.isArray(widget.display.variables) ? widget.display.variables : null;
  if (dv) {
    for (const src of dv.filter((v) => v?.variable === "field_bundle")) {
      const originId = src?.origin?.id || src?.origin;
      const exists = dv.some(
        (v) => v?.variable === sibling && (v?.origin?.id || v?.origin) === originId
      );
      if (!exists) {
        dv.push({ ...src, variable: sibling });
        changed = true;
      }
    }
  }
  return changed;
}

// field_bundle_2 = pathogen/pest overflow companion (deep-merged with field_bundle by the widget).
function ensureBundle2OnWidget(widget) {
  return ensureFieldBundleSibling(widget, "field_bundle_2");
}

// field_calendar = cultivation-log variable on the field device. Must be subscribed so the widget
// can (a) route the calendar SAVE via autofill and (b) receive/display saved entries in the card.
function ensureFieldCalendarOnWidget(widget) {
  return ensureFieldBundleSibling(widget, "field_calendar");
}

// history_request / history_data = on-demand range fetch on the field device. The plot's "Φόρτωση"
// button sends history_request (autofill routes it → analysis_run = UC511_downlink), and the
// analysis writes history_data back. Both must be subscribed so the request routes and the response
// is delivered to the widget.
function ensureHistoryVarsOnWidget(widget) {
  const a = ensureFieldBundleSibling(widget, "history_request");
  const b = ensureFieldBundleSibling(widget, "history_data");
  return a || b;
}

/* ---- Assign per tab: first tab gets all device vars appended, others untouched ---- */
async function assignDevicesToTabs_VarsOnly(
  dashboard_id,
  deviceIndex
) {
  const info = await account.dashboards.info(dashboard_id);
  if (!info?.arrangement?.length) return;

  const widgetsByTab = new Map();
  for (const slot of info.arrangement) {
    const tabIdx = slot?.tab ?? 0;
    if (!widgetsByTab.has(tabIdx)) widgetsByTab.set(tabIdx, []);
    widgetsByTab.get(tabIdx).push(slot.widget_id);
  }

  // const firstTab = Math.min(...widgetsByTab.keys());
  const firstTab = '8NMj9hO5Rvi1FPYVd3dgs';
  console.log("Tab indices found:", [...widgetsByTab.keys()], "— appending device rows to tab", firstTab);

  // Only the first tab gets sensor device rows added; other tabs are left as-is
  const sensorRows = buildAllDeviceRows(deviceIndex);
  console.log(`Sensor rows to append: ${JSON.stringify(sensorRows)}`);

  console.log('widgetsByTab.get(e7Z8F5mLs6bacwGDxPc-o) : ', widgetsByTab.get('e7Z8F5mLs6bacwGDxPc-o'))
  console.log('widgetsByTab.get(8NMj9hO5Rvi1FPYVd3dgs) : ', widgetsByTab.get('8NMj9hO5Rvi1FPYVd3dgs'))
  console.log('widgetsByTab.get(oou7iKKLVdNb3No6BlERp) : ', widgetsByTab.get('oou7iKKLVdNb3No6BlERp'))
  console.log('widgetsByTab.get(zpQzGb2h_PUwgEOzWb79Q) : ', widgetsByTab.get('zpQzGb2h_PUwgEOzWb79Q'))

  for (const widget_id of widgetsByTab.get(firstTab) || []) {
    const widget = await account.dashboards.widgets.info(dashboard_id, widget_id);
    console.log('widget: ', widget);
    console.log(`Processing widget ${widget_id} on tab ${firstTab} — current variables:`, widget?.display?.variables);
    if (!widget) continue;
    console.log('Found widget!')

    // 1) Append sensor rows to existing display.variables (preserve field device entries)
    if (widget.display) {
      const existingVars = Array.isArray(widget.display.variables) ? widget.display.variables : [];
      const existingKeys = new Set(
        existingVars.map((v) => {
          const oid = (v?.origin?.id || v?.origin) ?? "";
          return `${oid}::${v?.variable ?? ""}`;
        })
      );
      console.log("Existing display variables:", existingVars);

      const newVars = sensorRows
        .filter((r) => !existingKeys.has(`${r.origin}::${r.variable}`))
        .map((r) => ({ variable: r.variable, origin: { id: r.origin, bucket: r.bucket } }));
      
      console.log("New variables to add to display:", newVars);

      widget.display.variables = [...existingVars, ...newVars];

      upsertDisplayParameter(widget.display, "dashboard_id", dashboard_id);
      if (!widget.display.parameters?.some((p) => p.key === "device_map")) {
        upsertDisplayParameter(widget.display, "device_map", "{}");
      }
    }

    // 2) Append sensor rows to existing data[] (preserve field device entries)
    const existingData = Array.isArray(widget.data) ? widget.data : [];
    const existingDataKeys = new Set(
      existingData.flatMap((d) =>
        (Array.isArray(d.variables) ? d.variables : []).map((v) => `${d.origin}::${v}`)
      )
    );

    const newDataEntries = sensorRows
      .filter((r) => !existingDataKeys.has(`${r.origin}::${r.variable}`))
      .map((r) => ({
        qty: 500,
        bucket: r.bucket,
        origin: r.origin,
        timezone: "Europe/Athens",
        variables: [r.variable],
      }));

    widget.data = [...existingData, ...newDataEntries];

    await account.dashboards.widgets.edit(dashboard_id, widget_id, widget);
  }
}

/* ------------------ EXISTING create dashboard/device flow ------------------ */

async function removeDevicesFromStorage(devices) {
  const deviceIds = Object.values(devices);
  for (const deviceId of deviceIds) {
    const deviceInfo = await account.devices.info(deviceId);
    const filteredTags = deviceInfo.tags.filter(
      (tag) => !(tag.key === "storage" || tag.key.startsWith("storage"))
    );
    await account.devices.edit(deviceId, { tags: filteredTags });
  }
}

async function updateFieldDeviceWithDashboard(deviceId, deviceInfo, fieldId) {
  deviceInfo.tags.push({ key: "fieldId", value: fieldId });
  await account.devices.edit(deviceId, { tags: deviceInfo.tags });
}

async function createFieldDevice(
  name,
  accesses,
  clientName,
  clientId,
  field_type,
  field_purpose,
  devices,
  subscriptionCurrentCost,
  subscriptionCost,
  subscriptionEnd,
  coordinates
) {
  try {
    const created = await account.devices.create({
      name: `Field_${name}`,
      connector: "5f5a8f3351d4db99c40dece5",
      network: "5bbd0d144051a50034cd19fb",
      type: "immutable",
      chunk_period: "month",  // enum: "hour" | "day" | "month"
      chunk_retention: 12,    // number of periods
    });

    const info = await account.devices.info(created.device_id);

    for (const acc of accesses || []) {
      info.tags.push({ key: "access", value: String(acc) });
    }
    info.tags.push({ key: "devices", value: JSON.stringify(devices) });
    info.tags.push({ key: "isField", value: "yes" });
    info.tags.push({ key: "clientName", value: String(clientName ?? "-") });
    info.tags.push({ key: "clientId_field", value: String(clientId ?? "") });
    info.tags.push({ key: "name", value: String(name) });
    info.tags.push({ key: "subscriptionActive", value: "yes" });
    info.tags.push({ key: "field_type", value: String(field_type ?? "agnostic") });
    /* T-PROFILE-01: μόνο όταν ο χρήστης το δήλωσε. Χωρίς τιμή, κανένα tag:
       η μηχανή τότε συμπεριφέρεται όπως πάντα (πλήρης αγρονομικός). */
    if (field_purpose) {
      info.tags.push({ key: "field_purpose", value: String(field_purpose) });
    }
    info.tags.push({ key: "subscriptionCurrentCost", value: String(subscriptionCurrentCost ?? "") });
    info.tags.push({ key: "subscriptionCost", value: String(subscriptionCost ?? "") });
    info.tags.push({ key: "subscriptionEnd", value: String(subscriptionEnd ?? "") });
    info.tags.push({ key: "coordinates", value: String(coordinates ?? "") });

    await account.devices.edit(created.device_id, { tags: info.tags });

    return { id: created.device_id, info };
  } catch (err) {
    console.error("createFieldDevice failed:", err);
    throw err;
  }
}

/**
 * Ensure the configuration widget (Παραμετροποίηση) subscribes to the `configuration`
 * and `validation` variables on the field device.
 *
 * Why this is required:
 *  - configuration.html sends `configuration` (+ `location`) via TagoIO autofill, which
 *    routes a sent variable ONLY to a device the widget is already subscribed to. If the
 *    widget is not subscribed to `configuration`, autofill drops it → the data point is
 *    never stored → setFieldParametersFromDeviceData reads an empty configuration and
 *    writes an empty TAG (the user's crop selection is lost).
 *  - The success popup and the "needs configuration" banner clear only when the widget
 *    RECEIVES `validation` / `configuration` back via onRealtime. Without the
 *    subscription they never arrive.
 *
 * Idempotent: only adds what's missing. Detects the config widget by its iframe URL.
 */
function ensureConfigWidgetSubscriptions(widget_info, fieldId) {
  const url = (widget_info?.display?.url || "").toLowerCase();
  if (!url.includes("configuration.html")) return false;
  if (!fieldId) return false;

  const needed = ["configuration", "validation"];

  // display.variables: [{ variable, origin: { id, bucket } }]
  widget_info.display = widget_info.display || {};
  const dispVars = Array.isArray(widget_info.display.variables) ? widget_info.display.variables : [];
  for (const variable of needed) {
    const present = dispVars.some((e) => {
      const oid = e?.origin?.id || e?.origin;
      return e?.variable === variable && oid === fieldId;
    });
    if (!present) dispVars.push({ variable, origin: { id: fieldId, bucket: fieldId } });
  }
  widget_info.display.variables = dispVars;

  // data: [{ qty, bucket, origin, variables: [...] }] — append to the field-device entry
  const dataArr = Array.isArray(widget_info.data) ? widget_info.data : [];
  let entry = dataArr.find((d) => (d?.origin?.id || d?.origin) === fieldId);
  if (!entry) {
    entry = { qty: 500, bucket: fieldId, origin: fieldId, timezone: "Europe/Athens", variables: [] };
    dataArr.push(entry);
  }
  entry.variables = Array.isArray(entry.variables) ? entry.variables : [];
  for (const variable of needed) {
    if (!entry.variables.includes(variable)) entry.variables.push(variable);
  }
  widget_info.data = dataArr;

  return true;
}

async function createDashboard(name, templateDashboardId, map, accesses, subGroup) {
  let result;
  try {
    result = await account.dashboards.duplicate(templateDashboardId, { new_label: name });
  } catch (e) {
    throw `Error while duplicating dashboard: ${e}`;
  }

  const dashboardInfo = await account.dashboards.info(result.dashboard_id);

  dashboardInfo.tags = dashboardInfo.tags.filter((item) => item.key !== "dashboardGroup");
  for (let idx = 0; idx < (accesses?.length || 0); idx += 1) {
    dashboardInfo.tags.push({
      key: "access",
      value: accesses[idx],
      metadata: { run: true },
    });
  }
  dashboardInfo.tags.push({
    key: "dashboardGroupGeneral",
    value: "Commercial",
    metadata: { run: false },
  });
  dashboardInfo.tags.push({
    key: "dashboardGroup",
    value: "MACC",
    metadata: { run: false },
  });
  dashboardInfo.tags.push({
    key: "dashboardSubGroup",
    value: subGroup,
    metadata: { run: true },
  });

  dashboardInfo.group_by = ["dashboardGroupGeneral", "dashboardGroup", "dashboardSubGroup"];

  const info = await account.dashboards.info(result.dashboard_id);
  for (let idx = 0; idx < info.arrangement.length; idx += 1) {
    const widget_id = info.arrangement[idx].widget_id;
    const widget_info = await account.dashboards.widgets.info(result.dashboard_id, widget_id);

    // 1) Replace template ids to new field id (existing behavior)
    reassignKeysByMap(widget_info, map);

    // 1b) Configuration widget: make sure it is subscribed to `configuration` and
    //     `validation` on the field device, otherwise saves don't persist (autofill
    //     drops them) and the success message is never received. See helper above.
    ensureConfigWidgetSubscriptions(widget_info, map[TEMPLATE_FIELD_DEVICE_ID]);

    // 2) Ensure dashboard_id & device_map parameters exist
    if (widget_info.display) {
      upsertDisplayParameter(widget_info.display, "dashboard_id", result.dashboard_id);
      // device_map will be filled shortly by caller via a second pass (we set a placeholder here)
      upsertDisplayParameter(widget_info.display, "device_map", "{}");
    }

    await account.dashboards.widgets.edit(result.dashboard_id, widget_id, widget_info);
  }

  try {
    await account.dashboards.edit(result.dashboard_id, dashboardInfo);
  } catch (e) {
    throw `Error while updating new dashboard tags ${e}`;
  }
  return result.dashboard_id;
}

/* -------- Field creation path: device-agnostic & per-tab (vars only) -------- */

async function createFieldAgnostic(scope, template_dashboard_id, accesses, subGroup, clientName, clientId) {
  const field_name = scope.find((i) => i.variable === "field_name")?.value?.toString() || "Field";
  const subscriptionDefault = scope.find((i) => i.variable === "subscriptiondefault")?.value;
  let subscriptionCurrentCost =
    scope.find((i) => i.variable === "subscriptioncurrentcost")?.value?.toString() || "";
  let subscriptionEnd =
    scope.find((i) => i.variable === "subscriptionend")?.value?.toString() ||
    new Date().toISOString();
  const coordinates = scope.find((i) => i.variable === "coordinates")?.value || "35.0, 25.0";

  /* ── T-PROFILE-01 · Ο ΣΚΟΠΟΣ ΤΟΥ ΑΓΡΟΥ ────────────────────────────
     Μέχρι τώρα ο σκοπός ΔΕΝ ρωτιόταν πουθενά: παρακάτω περνούσε καρφωτά
     το "agnostic". Έτσι κάθε αγρός — ξενοδοχείο, μετεωρολογικός, καθαρή
     άρδευση — κρινόταν ως πλήρης αγρονομικός και έβγαζε ψεύτικες
     ελλείψεις για θρέψη και φυτοπροστασία που ποτέ δεν ζητήθηκαν.

     Το `field_type` ΔΕΝ το πειράζουμε: κρατά ήδη σημασία «σετ
     αισθητήρων» (s2120_soil_ide, soil_leaf_tree). Ο σκοπός παίρνει ΔΙΚΟ του
     κλειδί, αλλιώς οι δύο σημασίες θα συγκρούονταν.

     ΑΝ Η ΦΟΡΜΑ ΔΕΝ ΣΤΕΛΝΕΙ ΤΙΠΟΤΑ, ΔΕΝ ΓΡΑΦΕΤΑΙ tag και ο αγρός
     βγαίνει byte-for-byte όπως σήμερα. Καμία σιωπηλή αλλαγή. */
  const FIELD_PURPOSES = ["agronomy", "weather", "automation"];
  const _purposeRaw = String(
    scope.find((i) => i.variable === "field_purpose")?.value ?? ""
  ).trim().toLowerCase();
  const field_purpose = FIELD_PURPOSES.indexOf(_purposeRaw) >= 0 ? _purposeRaw : "";
  /* Άγνωστη τιμή ΔΕΝ μαντεύεται — καλύτερα κανένα tag παρά λάθος tag. */
  if (_purposeRaw && !field_purpose) {
    console.log(`[field_purpose] ΑΓΝΩΣΤΗ ΤΙΜΗ "${_purposeRaw}" — ΔΕΝ γράφτηκε tag.`
      + ` Δεκτές: ${FIELD_PURPOSES.join(", ")}`);
  }

  const match = subscriptionEnd.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  if (match) {
    const utcDate = new Date(match[0]);
    const localDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
    subscriptionEnd = localDate.toISOString().replace("Z", "+03:00");
  }

  // devicesNum cap
  const devicesNum = getDevicesNumFromScope(scope);
  console.log("devicesNum requested:", devicesNum);

  // Discover devices from EUIs (limited by devicesNum)
  const rawEUIs = collectEUIsFromScope(scope, devicesNum);
  const uniqueEUIs = Array.from(new Set(rawEUIs));
  const validatedEUIs = uniqueEUIs.map((e) => euiValidation(e)).filter(Boolean);
  const cappedEUIs = validatedEUIs.slice(0, devicesNum);
  if (cappedEUIs.length < validatedEUIs.length) {
    console.log(`Capped EUIs to first ${devicesNum} entries (ignored ${validatedEUIs.length - cappedEUIs.length}).`);
  }

  const euiTags = cappedEUIs.map((eui) => ({ key: "eui", value: eui }));
  const foundDevices = (await getDevicesFromEUI(euiTags)).filter(Boolean);
  // console.log('foundDevices: ',foundDevices)
  // [SOIL-DEPTH] Pin single-sensor soil probes to Ρηχό/Βαθύ from the form (deviceN_soil) BEFORE
  // building the variable index, so each device wires to the correct depth slot.
  await applySoilDepthTags(foundDevices, collectEUISoilPairsFromScope(scope, devicesNum));
  const euiNamePairs = collectEUINamePairsFromScope(scope, devicesNum);
  const deviceIdToName = buildDeviceIdToNameMap(foundDevices, euiNamePairs);
  const deviceMapParamJSON = JSON.stringify(deviceIdToName);

  // Build the "devices" tag saved on the field device in the format legacy runPerTich expects:
  // { <real device name> : <device id> }. runPerTich resolves each field device from the VALUE
  // (device id) via getTokenByName. Friendly aliases (deviceN_name) must NOT appear here — they
  // belong ONLY in the widget `device_map` param (deviceMapParamJSON = { id → friendly name }).
  // Putting friendly labels in this tag is exactly what broke KEK for legacy runPerTich.
  const devicesTagObj = Object.fromEntries(
    foundDevices.filter((d) => d?.id).map((d) => [String(d.name || d.id), d.id])
  );

  // Build device index from device data (last 60 points)
  const deviceIndex = await buildDeviceVariableIndex(foundDevices);
  const availableVariables = new Set(Object.keys(deviceIndex.bestByVariable));

  // Per-tab filters & unique selected variables across tabs
  const tabFilters = getTabVarFiltersFromCode();
  const selectedVars = computeSelectedVariables(tabFilters, availableVariables);

  // Cost = factor × variables with data (selected ∩ available)
  const selectedAvailable = selectedVars.filter((v) => availableVariables.has(v));
  const computedCost = SUBSCRIPTION_FACTOR * selectedAvailable.length;
  const subscriptionCost = String(computedCost);
  if (subscriptionDefault === true || !subscriptionCurrentCost) {
    subscriptionCurrentCost = subscriptionCost;
  }

  // Create Field device (anchor)
  const fieldDevice = await createFieldDevice(
    field_name,
    accesses,
    clientName,
    clientId,
    "agnostic",       // field_type: το «σετ αισθητήρων», αμετάβλητο
    field_purpose,    // T-PROFILE-01: ο ΣΚΟΠΟΣ, από τη φόρμα (κενό = όπως σήμερα)
    devicesTagObj,
    subscriptionCurrentCost,
    subscriptionCost,
    subscriptionEnd,
    coordinates
  );

  // Create dashboard (default id as requested)
  const deviceMap = { [TEMPLATE_FIELD_DEVICE_ID]: fieldDevice.id };
  const dashboardId = await createDashboard(
    field_name,
    (scope.find((i) => i.variable === "template_dashboard_id")?.value?.toString() ||
      "68f92649f8b680000ab970ae"),
    deviceMap,
    accesses,
    subGroup
  );

  // Assign per-tab variables (wildcards) and KEEP static field vars from template (remapped)
  console.log('deviceIndex: ', deviceIndex)
  await assignDevicesToTabs_VarsOnly(dashboardId, deviceIndex);
  // Inject device_map param into all widgets (final value)
  const dashInfo = await account.dashboards.info(dashboardId);
  if (Array.isArray(dashInfo.arrangement)) {
    for (const slot of dashInfo.arrangement) {
      const wid = slot.widget_id;
      const w = await account.dashboards.widgets.info(dashboardId, wid);
      if (w?.display) {
        upsertDisplayParameter(w.display, "device_map", deviceMapParamJSON);
        ensureBundle2OnWidget(w); // subscribe the new field's widget to field_bundle_2 too
        ensureFieldCalendarOnWidget(w); // ...and field_calendar (cultivation log save + display)
        ensureHistoryVarsOnWidget(w); // ...and history_request/history_data (on-demand range fetch)
        await account.dashboards.widgets.edit(dashboardId, wid, w);
      }
    }
  }

  // Save unique selected variable list on the Field device
  const fieldInfo = await account.devices.info(fieldDevice.id);
  const tags = fieldInfo.tags.filter((t) => t.key !== "selected_variables");
  tags.push({ key: "selected_variables", value: selectedVars.join(",") });
  await account.devices.edit(fieldDevice.id, { tags });

  // housekeeping
  await updateFieldDeviceWithDashboard(fieldDevice.id, fieldInfo, dashboardId);
  await removeDevicesFromStorage(devicesTagObj);
  await sendLocation(fieldDevice.id, coordinates);
  await addToGeneralMap(fieldDevice.id, dashboardId, field_name, fieldInfo.name);

  return dashboardId;
}

/* ------------------ USER/CUSTOMER validation ------------------- */

async function userValidation(customer, user) {
  const clientInfo = await account.devices.info(customer);
  const userInfo = await account.run.userInfo(user);
  return { clientInfo, userInfo };
}

/* ------------------ ENTRYPOINT -------------------------- */

async function myAnalysis(context, scope) {
  // Form feedback: write `validation` back to the form's origin device so a "validation" field on
  // the create-field form shows success/error. (The form already has one.) Defined outside the try
  // so the catch can use it too. Origin defaults to the fieldCreation form device; override via env.
  const FORM_DEVICE_ID =
    context.environment.find((e) => e.key === "FORM_DEVICE_ID")?.value || "6829fa2e30e03a000abbdd41";
  const sendValidation = async (type, message) => {
    try {
      await Resources.devices.sendDeviceData(FORM_DEVICE_ID, {
        variable: "validation",
        value: message,
        metadata: { type }, // "success" | "danger" | "warning"
      });
      console.log(`[validation] sent (${type}) -> ${FORM_DEVICE_ID}: ${message}`);
    } catch (e) {
      console.log("[validation] feedback failed:", e && e.message);
    }
  };
  try {
    const my_account_token = context.environment.find(
      (env_var) => env_var.key === "ACCOUNT_TOKEN"
    );
    if (!my_account_token) return console.log("Account token not found!");
    account_token = my_account_token.value;
    account = new Account({ token: account_token });

    // UC511 automation family (rules vs plans) is auto-detected per controller from hw_version in
    // buildDeviceVariableIndex; env UC511_HW_GENERATION only sets the fallback for unknown devices.
    DEFAULT_UC511_GEN = readUc511Generation(context);
    console.log(`UC511 generation fallback: ${DEFAULT_UC511_GEN} (per-controller auto-detect from hw_version)`);

    const field_name = scope.find((item) => item.variable === "field_name")?.value;
    console.log("Field name:", field_name, "received!");

    const iscustomer = scope.find((item) => item.variable === "iscustomer")?.value;
    const customer = scope.find((item) => item.variable === "customer")?.value;
    const user = scope.find((item) => item.variable === "user")?.value;

    let accesses = [];
    let subGroup = "MACC";
    let clientName = "-";
    let clientId = "";

    if (iscustomer) {
      const userValidationRes = await userValidation(customer, user);
      console.log('userValidationRes: ', userValidationRes)
      subGroup = getSubgroupFromCustomer(userValidationRes.clientInfo) || subGroup;
      clientName = getNameFromCustomer(userValidationRes.clientInfo) || clientName;
      accesses.push(getAccessFromCustomer(userValidationRes.clientInfo));
      if (userValidationRes.userInfo !== undefined) {
        accesses.push(getAccessFromUser(userValidationRes.userInfo));
      }
      clientId = customer;
    }

    // Drop any undefined/empty access values (e.g. a run user without an "access" tag),
    // otherwise they get written as dashboard tags with no value and TagoIO rejects the edit.
    accesses = Array.from(new Set(accesses.filter(Boolean)));

    await createFieldAgnostic(
      scope,
      "68f92649f8b680000ab970ae",
      accesses,
      subGroup,
      clientName,
      clientId
    );
    await sendValidation("success", `✅ Η εγκατάσταση "${field_name}" δημιουργήθηκε.`);
  } catch (err) {
    console.error("💥 Analysis crashed:", err);
    await sendValidation("danger", `⚠️ Σφάλμα δημιουργίας εγκατάστασης: ${err && err.message ? err.message : err}`);
    throw err;
  }
}

module.exports = new Analysis(myAnalysis);
