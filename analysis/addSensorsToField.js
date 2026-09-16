const { Analysis, Account, Resources, Device } = require("@tago-io/sdk");

/**
 * addSensorsToField — add new sensor devices to an EXISTING field + its dashboard.
 *
 * Companion to createField.js. Pairs with a form widget: a field selector (device field,
 * filter isField=yes) + devicesNum + deviceN (QR/EUI) + optional deviceN_name (alias) +
 * optional deviceN_soil (Ρηχό/Βαθύ for single-sensor lse01 probes).
 *
 * What it does:
 *   1. Resolves the field device and its dashboard (field device's `fieldId` tag = dashboard id).
 *   2. Finds the new sensor devices by EUI, applies soil-depth type tags (lse01_shallow/deep).
 *   3. Appends each device's variables to the AgroGenius custom widget(s) (data[] +
 *      display.variables), refreshes the device_map param, and ensures field_bundle_2.
 *   4. Merges the new devices into the field device's `devices` tag (name -> id).
 *
 * Subscription cost is NOT auto-recomputed here (kept minimal + non-destructive); adjust the
 * field's subscriptionCost tag separately if needed.
 *
 * Requires ACCOUNT_TOKEN.
 */

let account;

// UC511 automation variables for a given HW generation. v4 controllers drive irrigation via RULES
// (rule*), legacy (v3) via PLANS (plan*); the Εντολές κανόνων modal picks the family from the
// generation. rules_enabled_mask is generation-independent. Select at runtime via env
// UC511_HW_GENERATION ("v4" default | "legacy"). Keep in sync with createField.js and
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

// Detect a UC511 controller's HW generation: hw_version TAG → latest hw_version DATA → fallbackGen.
// `device` may be a full device object (with tags) or an id string.
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

// Keep in sync with createField.js / runPerTich.js.
const DEVICE_TYPE_VARIABLES = {
  em320: ["temperature", "humidity"],
  em320_th: ["temperature", "humidity"],
  em300_th: ["temperature", "humidity", "dew_point"],
  sph01: ["soil_ph", "temp_soil"],
  s2120: [
    "air_temperature", "air_humidity", "wind_speed_kmh", "uv_index", "light_intensity",
    "rain_height_hourly", "current_rain_height_daily", "current_rain_height_weekly",
    "current_rain_height_monthly", "current_rain_height_yearly", "barometric_pressure_hpa",
    "dew_point", "wind_direction_sensor",
  ],
  se0x: ["soil_moisture1", "soil_temperature1", "conduct_soil1", "soil_moisture2", "soil_temperature2", "conduct_soil2"],
  lse02: ["soil_moisture1", "soil_temperature1", "conduct_soil1", "soil_moisture2", "soil_temperature2", "conduct_soil2"],
  lse01: ["soil_moisture", "temp_soil", "conduct_soil"],
  lse01_shallow: ["soil_moisture1", "soil_temperature1", "conduct_soil1"],
  lse01_deep: ["soil_moisture2", "soil_temperature2", "conduct_soil2"],
  lms01_ls: ["leaf_temperature", "leaf_moisture"],
  // Default to v4 (rules); myAnalysis overrides this from env UC511_HW_GENERATION before wiring.
  uc511: uc511Vars("v4"),
};

/* ---------- helpers (mirrors of createField.js) ---------- */
function getVariablesByDeviceType(device) {
  const typeTag = device.tags?.find((t) => String(t.key).toLowerCase() === "type")?.value;
  if (!typeTag) return [];
  return DEVICE_TYPE_VARIABLES[typeTag.toLowerCase()] || [];
}

function euiValidation(eui) {
  if (!eui) return undefined;
  eui = eui.toString().toLowerCase().replace(/[-\s]/g, "");
  if (eui.startsWith("la")) {
    const parts = eui.split(";");
    if (parts[1]) eui = parts[1];
  }
  eui = eui.substring(0, 16);
  return /^[0-9a-f]{16}$/.test(eui) ? eui : undefined;
}

function getDevicesNumFromScope(scope) {
  const raw = scope.find((i) => i.variable?.toLowerCase() === "devicesnum")?.value;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 9;
}

function upsertDisplayParameter(display, key, value) {
  if (!display) return;
  display.parameters = Array.isArray(display.parameters) ? display.parameters : [];
  const existing = display.parameters.find((p) => p?.key === key);
  if (existing) existing.value = value;
  else display.parameters.push({ key, value });
}

// Read a widget's current device_map param (id → friendly name) as an object; {} if absent/invalid.
function readDeviceMapParam(display) {
  try {
    const p = (display?.parameters || []).find((x) => x?.key === "device_map");
    const obj = p?.value ? JSON.parse(p.value) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function normalizeSoilDepth(raw) {
  const s = (raw ?? "").toString().trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("deep") || s.startsWith("βαθ") || s === "2") return "deep";
  if (s.startsWith("shallow") || s.startsWith("ρηχ") || s === "1") return "shallow";
  return null;
}

// Ordered [{eui, name, soil}] from deviceN / deviceN_name / deviceN_soil.
function collectDeviceRowsFromScope(scope, maxDevices) {
  const deviceVars = scope
    .filter((i) => /^device\d+$/i.test(i.variable))
    .map((i) => ({ idx: parseInt(i.variable.replace(/^\D+/g, ""), 10), item: i }))
    .filter((x) => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .slice(0, maxDevices);

  const out = [];
  const seen = new Set();
  for (const { idx, item } of deviceVars) {
    const raw = String(item.value || "").trim().toLowerCase();
    const m = raw.split(/[^0-9a-f]+/i).filter(Boolean).join("").match(/[0-9a-f]{16}/);
    if (!m) continue;
    const eui = euiValidation(m[0]);
    if (!eui || seen.has(eui)) continue;
    seen.add(eui);
    const name = (scope.find((s) => s.variable?.toLowerCase() === `device${idx}_name`)?.value ?? "").toString().trim() || null;
    const soil = normalizeSoilDepth(scope.find((s) => s.variable?.toLowerCase() === `device${idx}_soil`)?.value);
    out.push({ eui, name, soil });
  }
  return out;
}

async function getDevicesFromEUI(euis) {
  const ordered = [];
  const seen = new Set();
  for (const eui of euis) {
    const result = await Resources.devices.list({
      amount: 100,
      fields: ["name", "id", "tags", "bucket_id", "bucket"],
      filter: { tags: [{ key: "eui", value: eui }] },
    });
    for (const raw of Array.isArray(result) ? result : []) {
      if (!raw || seen.has(raw.id)) continue;
      const bucket_id = raw.bucket_id ?? (typeof raw.bucket === "string" ? raw.bucket : raw?.bucket?.id);
      const _eui = raw.tags?.find((t) => String(t.key).toLowerCase() === "eui")?.value?.toLowerCase?.();
      seen.add(raw.id);
      ordered.push({ ...raw, bucket_id, _eui });
    }
  }
  return ordered;
}

async function applySoilDepthTags(devices, rows) {
  const soilByEui = new Map();
  for (const r of rows) if (r.eui && r.soil) soilByEui.set(r.eui.toLowerCase(), r.soil);
  for (const dev of devices) {
    const soil = dev._eui ? soilByEui.get(dev._eui.toLowerCase()) : null;
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
      dev.tags = tags;
      console.log(`Soil depth: ${dev.name || dev.id} → ${targetType} (assign dragino_lse01_${soil}_parser.js)`);
    } catch (e) {
      console.log(`Soil depth: failed to tag ${dev.id}: ${e && e.message}`);
    }
  }
}

function ensureBundle2OnWidget(widget) {
  if (!widget || typeof widget !== "object") return false;
  let changed = false;
  if (Array.isArray(widget.data)) {
    for (const d of widget.data) {
      const vars = Array.isArray(d?.variables) ? d.variables : null;
      if (vars && vars.includes("field_bundle") && !vars.includes("field_bundle_2")) {
        vars.push("field_bundle_2");
        changed = true;
      }
    }
  }
  const dv = widget.display && Array.isArray(widget.display.variables) ? widget.display.variables : null;
  if (dv) {
    for (const src of dv.filter((v) => v?.variable === "field_bundle")) {
      const originId = src?.origin?.id || src?.origin;
      if (!dv.some((v) => v?.variable === "field_bundle_2" && (v?.origin?.id || v?.origin) === originId)) {
        dv.push({ ...src, variable: "field_bundle_2" });
        changed = true;
      }
    }
  }
  return changed;
}

function widgetReadsFieldBundle(widget) {
  if (Array.isArray(widget?.data)) {
    for (const d of widget.data) if (Array.isArray(d?.variables) && d.variables.includes("field_bundle")) return true;
  }
  const dv = widget?.display?.variables;
  return Array.isArray(dv) && dv.some((v) => v?.variable === "field_bundle");
}

// Build sensor rows {origin, bucket, variable} for the new devices. UC511 controllers pick
// rules-vs-plans by auto-detecting the HW generation from hw_version (fallback DEFAULT_UC511_GEN).
async function buildSensorRows(devices) {
  const rows = [];
  for (const dev of devices) {
    const typeTag = (dev.tags?.find((t) => String(t.key).toLowerCase() === "type")?.value || "").toLowerCase();
    const vars =
      typeTag === "uc511"
        ? uc511Vars(await detectUc511Generation(account, dev, DEFAULT_UC511_GEN))
        : getVariablesByDeviceType(dev);
    for (const variable of vars) rows.push({ origin: dev.id, bucket: dev.bucket_id ?? dev.id, variable });
  }
  return rows;
}

// Append new sensor rows to a widget's data[] + display.variables (dedup); returns true if changed.
function appendSensorsToWidget(widget, sensorRows) {
  let changed = false;
  const existingData = Array.isArray(widget.data) ? widget.data : [];
  const dataKeys = new Set(
    existingData.flatMap((d) => (Array.isArray(d.variables) ? d.variables : []).map((v) => `${d.origin}::${v}`))
  );
  const newData = sensorRows
    .filter((r) => !dataKeys.has(`${r.origin}::${r.variable}`))
    .map((r) => ({ qty: 500, bucket: r.bucket, origin: r.origin, timezone: "Europe/Athens", variables: [r.variable] }));
  if (newData.length) {
    widget.data = [...existingData, ...newData];
    changed = true;
  }
  if (widget.display) {
    const dv = Array.isArray(widget.display.variables) ? widget.display.variables : [];
    const dvKeys = new Set(dv.map((v) => `${v?.origin?.id || v?.origin}::${v?.variable}`));
    const newDv = sensorRows
      .filter((r) => !dvKeys.has(`${r.origin}::${r.variable}`))
      .map((r) => ({ variable: r.variable, origin: { id: r.origin, bucket: r.bucket } }));
    if (newDv.length) {
      widget.display.variables = [...dv, ...newDv];
      changed = true;
    }
  }
  return changed;
}

/* ---------- main ---------- */
async function myAnalysis(context, scope) {
  const tokenVar = context.environment.find((e) => e.key === "ACCOUNT_TOKEN");
  if (!tokenVar) return console.log("ACCOUNT_TOKEN not found!");
  account = new Account({ token: tokenVar.value });

  // UC511 automation family (rules vs plans) is auto-detected per controller from hw_version in
  // buildSensorRows; env UC511_HW_GENERATION only sets the fallback for unknown devices.
  DEFAULT_UC511_GEN = readUc511Generation(context);
  console.log(`UC511 generation fallback: ${DEFAULT_UC511_GEN} (per-controller auto-detect from hw_version)`);

  // --- UI validation feedback (variable "validationAddSensor" on the form device) ---
  // Distinct variable name, so this can safely share the fieldCreation device with createField's
  // "validation". Override with the FORM_DEVICE_ID env if the add-sensors form uses another device.
  const FORM_DEVICE_ID =
    context.environment.find((e) => e.key === "FORM_DEVICE_ID")?.value ||
    "6829fa2e30e03a000abbdd41"; // fieldCreation device
  const sendValidation = async (type, message) => {
    // type = "success" | "danger" | "warning"
    try {
      await Resources.devices.sendDeviceData(FORM_DEVICE_ID, {
        variable: "validationAddSensor",
        value: message,
        metadata: { type },
      });
      console.log(`[validationAddSensor] ${type}: ${message}`);
    } catch (e) {
      console.log(`[validationAddSensor] failed to send (${type}): ${e && e.message ? e.message : e}`);
    }
  };

  const fieldDeviceId = scope.find((i) => i.variable === "field")?.value?.toString();
  if (!fieldDeviceId) {
    await sendValidation("danger", "Δεν επιλέχθηκε αγρός.");
    return console.log("No field selected (scope.field missing).");
  }

  const fieldInfo = await account.devices.info(fieldDeviceId);
  const dashboardId = (fieldInfo.tags || []).find((t) => t.key === "fieldId")?.value;
  if (!dashboardId) {
    await sendValidation("danger", `Ο αγρός «${fieldInfo.name}» δεν έχει συνδεδεμένο dashboard (ετικέτα fieldId).`);
    return console.log(`Field ${fieldInfo.name} has no fieldId tag (dashboard link). Aborting.`);
  }
  console.log(`Field: ${fieldInfo.name} | dashboard: ${dashboardId}`);

  const devicesNum = getDevicesNumFromScope(scope);
  const rows = collectDeviceRowsFromScope(scope, devicesNum);
  if (!rows.length) {
    await sendValidation("danger", "Δεν βρέθηκαν έγκυροι κωδικοί συσκευών (EUI) στη φόρμα.");
    return console.log("No valid device EUIs in the form.");
  }

  const foundDevices = await getDevicesFromEUI(rows.map((r) => r.eui));
  if (!foundDevices.length) {
    await sendValidation("danger", "Καμία από τις συσκευές (EUI) δεν αντιστοιχεί σε υπάρχουσα συσκευή.");
    return console.log("None of the EUIs matched an existing device.");
  }
  await applySoilDepthTags(foundDevices, rows);

  // Friendly display alias per NEW device (form alias → real device name fallback). This is a
  // DISPLAY concern and belongs ONLY in the widget `device_map` URL param — never in the
  // `devices` tag (putting friendly labels there is what broke KEK for legacy runPerTich).
  const nameByEui = new Map(rows.filter((r) => r.name).map((r) => [r.eui.toLowerCase(), r.name]));
  const idToFriendly = {};
  for (const dev of foundDevices) {
    idToFriendly[dev.id] = (dev._eui && nameByEui.get(dev._eui.toLowerCase())) || dev.name || dev.id;
  }

  // Merge new devices into the field's `devices` tag in the format legacy runPerTich expects:
  // { <real device name> : <device id> }. runPerTich resolves each field device from the VALUE
  // (device id) via getTokenByName; the key is a stable real name — NEVER a friendly alias.
  let devicesTag = {};
  try {
    const raw = (fieldInfo.tags || []).find((t) => t.key === "devices")?.value;
    if (raw) devicesTag = JSON.parse(raw);
  } catch { /* start fresh */ }
  for (const dev of foundDevices) devicesTag[String(dev.name || dev.id)] = dev.id;
  const newTags = (fieldInfo.tags || []).filter((t) => t.key !== "devices");
  newTags.push({ key: "devices", value: JSON.stringify(devicesTag) });
  await account.devices.edit(fieldDeviceId, { tags: newTags });

  const sensorRows = await buildSensorRows(foundDevices);
  console.log(`New sensor rows: ${sensorRows.length} across ${foundDevices.length} device(s).`);

  // Append to the AgroGenius custom widget(s) on the dashboard.
  const info = await account.dashboards.info(dashboardId);
  let widgetsTouched = 0;
  for (const slot of (info?.arrangement || [])) {
    const wid = slot?.widget_id;
    if (!wid) continue;
    let widget;
    try { widget = await account.dashboards.widgets.info(dashboardId, wid); } catch { continue; }
    if (!widgetReadsFieldBundle(widget)) continue; // only the AgroGenius custom widget
    let changed = appendSensorsToWidget(widget, sensorRows);
    if (widget.display) {
      // Merge the new friendly aliases into THIS widget's existing device_map (id → name),
      // preserving the display names of devices already wired in.
      const mergedMap = { ...readDeviceMapParam(widget.display), ...idToFriendly };
      upsertDisplayParameter(widget.display, "device_map", JSON.stringify(mergedMap));
      changed = true;
    }
    if (ensureBundle2OnWidget(widget)) changed = true;
    if (!changed) continue;
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      widgetsTouched += 1;
      console.log(`Updated widget ${wid} (+${sensorRows.length} vars, device_map refreshed).`);
    } catch (e) {
      console.log(`Failed to edit widget ${wid}: ${e && e.message}`);
    }
  }

  console.log(`Done. Added ${foundDevices.length} device(s) to ${fieldInfo.name}; updated ${widgetsTouched} widget(s).`);
  console.log("Reminder: for any lse01 tagged deep, assign dragino_lse01_deep_parser.js (shallow → _shallow_parser.js).");

  // Final UI feedback. Note any requested EUIs that were not matched.
  const notFound = rows.length - foundDevices.length;
  const deviceNames = foundDevices.map((d) => idToFriendly[d.id]).join(", ");
  if (widgetsTouched === 0) {
    await sendValidation(
      "warning",
      `Προστέθηκαν ${foundDevices.length} συσκευές στον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget AgroGenius για ενημέρωση.`
    );
  } else if (notFound > 0) {
    await sendValidation(
      "warning",
      `Προστέθηκαν ${foundDevices.length} συσκευές (${deviceNames}) στον αγρό «${fieldInfo.name}». ${notFound} EUI δεν αντιστοιχήθηκαν.`
    );
  } else {
    await sendValidation(
      "success",
      `Προστέθηκαν ${foundDevices.length} συσκευές (${deviceNames}) στον αγρό «${fieldInfo.name}».`
    );
  }
}

module.exports = new Analysis(myAnalysis);
