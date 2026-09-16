const { Analysis, Account, Resources } = require("@tago-io/sdk");

/**
 * removeSensorFromField — DETACH sensor devices from an EXISTING field + its dashboard.
 *
 * The non-destructive inverse of addSensorsToField.js. Pairs with a form widget: a field
 * selector (device field, filter isField=yes) + devicesNum + deviceN (QR/EUI of the sensor(s)
 * to remove).
 *
 * What it does (DETACH ONLY — the device and its stored data are left intact):
 *   1. Resolves the field device and its dashboard (field device's `fieldId` tag = dashboard id).
 *   2. Finds the sensor devices by EUI.
 *   3. Strips each device's variables from the AgroGenius custom widget(s) (data[] +
 *      display.variables) and refreshes the device_map param from the remaining devices.
 *   4. Removes the devices from the field device's `devices` tag (name -> id map).
 *
 * It does NOT delete the device, wipe its data, or recompute subscriptionCost. Re-adding a
 * removed sensor with addSensorsToField.js fully restores it.
 *
 * UI validation feedback: writes to variable "validationRemoveSensor" on FORM_DEVICE_ID
 * (default: fieldCreation device). Distinct variable name → safe to share the device with
 * createField's "validation" and addSensorsToField's "validationAddSensor".
 *
 * Requires ACCOUNT_TOKEN. Optional env: FORM_DEVICE_ID.
 */

let account;

/* ---------- helpers (mirrors of addSensorsToField.js) ---------- */
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

// Ordered, deduped EUIs from deviceN fields.
function collectEuisFromScope(scope, maxDevices) {
  const deviceVars = scope
    .filter((i) => /^device\d+$/i.test(i.variable))
    .map((i) => ({ idx: parseInt(i.variable.replace(/^\D+/g, ""), 10), item: i }))
    .filter((x) => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .slice(0, maxDevices);

  const out = [];
  const seen = new Set();
  for (const { item } of deviceVars) {
    const raw = String(item.value || "").trim().toLowerCase();
    const m = raw.split(/[^0-9a-f]+/i).filter(Boolean).join("").match(/[0-9a-f]{16}/);
    if (!m) continue;
    const eui = euiValidation(m[0]);
    if (!eui || seen.has(eui)) continue;
    seen.add(eui);
    out.push(eui);
  }
  return out;
}

async function getDevicesFromEUI(euis) {
  const ordered = [];
  const seen = new Set();
  for (const eui of euis) {
    const result = await Resources.devices.list({
      amount: 100,
      fields: ["name", "id", "tags"],
      filter: { tags: [{ key: "eui", value: eui }] },
    });
    for (const raw of Array.isArray(result) ? result : []) {
      if (!raw || seen.has(raw.id)) continue;
      const _eui = raw.tags?.find((t) => String(t.key).toLowerCase() === "eui")?.value?.toLowerCase?.();
      seen.add(raw.id);
      ordered.push({ ...raw, _eui });
    }
  }
  return ordered;
}

function upsertDisplayParameter(display, key, value) {
  if (!display) return;
  display.parameters = Array.isArray(display.parameters) ? display.parameters : [];
  const existing = display.parameters.find((p) => p?.key === key);
  if (existing) existing.value = value;
  else display.parameters.push({ key, value });
}

function widgetReadsFieldBundle(widget) {
  if (Array.isArray(widget?.data)) {
    for (const d of widget.data) if (Array.isArray(d?.variables) && d.variables.includes("field_bundle")) return true;
  }
  const dv = widget?.display?.variables;
  return Array.isArray(dv) && dv.some((v) => v?.variable === "field_bundle");
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

// Strip every data[]/display.variables entry belonging to a removed origin id. Returns true if changed.
function removeSensorsFromWidget(widget, removedIds) {
  let changed = false;
  if (Array.isArray(widget.data)) {
    const before = widget.data.length;
    widget.data = widget.data.filter((d) => !removedIds.has(String(d.origin)));
    if (widget.data.length !== before) changed = true;
  }
  if (widget.display && Array.isArray(widget.display.variables)) {
    const dv = widget.display.variables;
    const before = dv.length;
    widget.display.variables = dv.filter((v) => !removedIds.has(String(v?.origin?.id || v?.origin)));
    if (widget.display.variables.length !== before) changed = true;
  }
  return changed;
}

/* ---------- main ---------- */
async function myAnalysis(context, scope) {
  const tokenVar = context.environment.find((e) => e.key === "ACCOUNT_TOKEN");
  if (!tokenVar) return console.log("ACCOUNT_TOKEN not found!");
  account = new Account({ token: tokenVar.value });

  // --- UI validation feedback (variable "validationRemoveSensor" on the form device) ---
  const FORM_DEVICE_ID =
    context.environment.find((e) => e.key === "FORM_DEVICE_ID")?.value ||
    "6829fa2e30e03a000abbdd41"; // fieldCreation device
  const sendValidation = async (type, message) => {
    // type = "success" | "danger" | "warning"
    try {
      await Resources.devices.sendDeviceData(FORM_DEVICE_ID, {
        variable: "validationRemoveSensor",
        value: message,
        metadata: { type },
      });
      console.log(`[validationRemoveSensor] ${type}: ${message}`);
    } catch (e) {
      console.log(`[validationRemoveSensor] failed to send (${type}): ${e && e.message ? e.message : e}`);
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
  const euis = collectEuisFromScope(scope, devicesNum);
  if (!euis.length) {
    await sendValidation("danger", "Δεν βρέθηκαν έγκυροι κωδικοί συσκευών (EUI) στη φόρμα.");
    return console.log("No valid device EUIs in the form.");
  }

  const foundDevices = await getDevicesFromEUI(euis);
  if (!foundDevices.length) {
    await sendValidation("danger", "Καμία από τις συσκευές (EUI) δεν αντιστοιχεί σε υπάρχουσα συσκευή.");
    return console.log("None of the EUIs matched an existing device.");
  }
  const removedIds = new Set(foundDevices.map((d) => String(d.id)));

  // Remove the devices from the field's `devices` tag (name -> id map).
  let devicesTag = {};
  try {
    const raw = (fieldInfo.tags || []).find((t) => t.key === "devices")?.value;
    if (raw) devicesTag = JSON.parse(raw);
  } catch { /* start fresh */ }
  const removedNames = [];
  for (const [name, id] of Object.entries(devicesTag)) {
    if (removedIds.has(String(id))) {
      removedNames.push(name);
      delete devicesTag[name];
    }
  }
  const newTags = (fieldInfo.tags || []).filter((t) => t.key !== "devices");
  newTags.push({ key: "devices", value: JSON.stringify(devicesTag) });
  await account.devices.edit(fieldDeviceId, { tags: newTags });

  const label = foundDevices.map((d) => d.name || d.id).join(", ");
  console.log(`Detaching ${foundDevices.length} device(s): ${label}`);

  // Strip from the AgroGenius custom widget(s) on the dashboard.
  const info = await account.dashboards.info(dashboardId);
  let widgetsTouched = 0;
  for (const slot of (info?.arrangement || [])) {
    const wid = slot?.widget_id;
    if (!wid) continue;
    let widget;
    try { widget = await account.dashboards.widgets.info(dashboardId, wid); } catch { continue; }
    if (!widgetReadsFieldBundle(widget)) continue; // only the AgroGenius custom widget
    let changed = removeSensorsFromWidget(widget, removedIds);
    if (widget.display) {
      // Prune the removed ids from THIS widget's existing device_map (id → name), keeping the
      // display names of the devices that remain.
      const map = readDeviceMapParam(widget.display);
      for (const rid of removedIds) delete map[rid];
      upsertDisplayParameter(widget.display, "device_map", JSON.stringify(map));
      changed = true;
    }
    if (!changed) continue;
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      widgetsTouched += 1;
      console.log(`Updated widget ${wid} (removed origins, device_map refreshed).`);
    } catch (e) {
      console.log(`Failed to edit widget ${wid}: ${e && e.message}`);
    }
  }

  console.log(`Done. Detached ${foundDevices.length} device(s) from ${fieldInfo.name}; updated ${widgetsTouched} widget(s). Devices and their data were NOT deleted.`);

  // Final UI feedback.
  if (widgetsTouched === 0) {
    await sendValidation(
      "warning",
      `Οι συσκευές αφαιρέθηκαν από τον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget AgroGenius για ενημέρωση.`
    );
  } else {
    await sendValidation(
      "success",
      `Αφαιρέθηκαν ${foundDevices.length} συσκευές (${label}) από τον αγρό «${fieldInfo.name}». Οι συσκευές και τα δεδομένα τους δεν διαγράφηκαν.`
    );
  }
}

module.exports = new Analysis(myAnalysis);
