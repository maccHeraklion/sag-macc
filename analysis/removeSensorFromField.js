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
 * T-MOVE-01 (10/11/2026): step 3 now strips the devices from ALL widgets of the dashboard (not only the AgroGenius one),
 * except the valve tabs (valvesControl/valvesRules — Κώστας), which are only reported.
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

/* ---------- T-MOVE-01 (10/11/2026): ένα όργανο σε ΕΝΑΝ αγρό ----------
   Κύριο σημείο της ανάθεσης = η ετικέτα devices του αγρού. Όταν ένα όργανο δηλώνεται σε νέο αγρό, φεύγει από κάθε άλλον:
   ετικέτα devices, πηγές δεδομένων και device_map ΟΛΩΝ των widget του ταμπλό του. Η κατάσταση του πυρήνα για το όργανο στον
   παλιό αγρό σβήνει μόνη της (T-DEVSTATE-PRUNE-01). Η θέση του οργάνου είναι η θέση του αγρού του, άρα αλλάζει μαζί.
   ΕΞΑΙΡΕΣΕΙΣ: (α) δηλωμένο κοινόχρηστο όργανο — ετικέτα shared_instrument=yes στη συσκευή (π.χ. ο σταθμός του ξενοδοχείου
   σε όλες τις ζώνες)· (β) ελεγκτές βανών uc5xx και widget των καρτελών βανών (valvesControl/valvesRules) — ανήκουν στον Κώστα,
   δεν αγγίζονται, μόνο αναφέρονται. */
const SHARED_TAG = "shared_instrument";
const VALVE_WIDGET_RE = /valvesControl|valvesRules/;
const tagVal = (tags, key) => ((tags || []).find((t) => t && t.key === key) || {}).value;
const devTypeOf = (dev) => String(((dev?.tags || []).find((t) => String(t?.key).toLowerCase() === "type") || {}).value || "").toLowerCase();
const isController = (dev) => /^uc5\d\d/.test(devTypeOf(dev));
const isSharedInstrument = (dev) => (dev?.tags || []).some((t) => t && t.key === SHARED_TAG && /^(yes|ναι|true|1)$/i.test(String(t.value || "").trim()));

// Ο χάρτης name → id της ετικέτας devices· null όταν η ετικέτα υπάρχει αλλά δεν διαβάζεται (τότε ΔΕΝ ξαναγράφεται).
function devicesMapOf(tags) {
  const raw = tagVal(tags, "devices");
  if (!raw) return {};
  try { const m = JSON.parse(raw); return m && typeof m === "object" && !Array.isArray(m) ? m : null; } catch { return null; }
}

// Όλοι οι αγροί (συσκευές isField=yes), σε σελίδες.
async function listFieldDevices() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await account.devices.list({ page, amount: 200, fields: ["id", "name", "tags"], filter: { tags: [{ key: "isField", value: "yes" }] } });
    const arr = Array.isArray(r) ? r : [];
    out.push(...arr);
    if (arr.length < 200) break;
  }
  return out;
}

// Βγάζει τα ids από ΟΛΑ τα widget ενός ταμπλό, εκτός από τα widget βανών. Επιστρέφει { touched, valve }.
async function stripDevicesFromDashboard(dashboardId, ids) {
  const res = { touched: 0, valve: 0 };
  if (!dashboardId || !ids.size) return res;
  let info;
  try { info = await account.dashboards.info(dashboardId); } catch (e) { console.log(`T-MOVE-01: ταμπλό ${dashboardId} δεν διαβάστηκε: ${e && e.message}`); return res; }
  for (const slot of (info?.arrangement || [])) {
    const wid = slot?.widget_id;
    if (!wid) continue;
    let widget;
    try { widget = await account.dashboards.widgets.info(dashboardId, wid); } catch { continue; }
    const refs = JSON.stringify(widget || {});
    if (![...ids].some((id) => refs.includes(id))) continue;
    if (VALVE_WIDGET_RE.test(String(widget?.display?.url || ""))) { res.valve += 1; console.log(`T-MOVE-01: widget βανών ${wid} ΔΕΝ αγγίχτηκε (Κώστας)`); continue; }
    let changed = removeSensorsFromWidget(widget, ids);
    if (widget.display && (widget.display.parameters || []).some((p) => p?.key === "device_map")) {
      const map = readDeviceMapParam(widget.display);
      let pruned = false;
      for (const rid of ids) if (rid in map) { delete map[rid]; pruned = true; }
      if (pruned) { upsertDisplayParameter(widget.display, "device_map", JSON.stringify(map)); changed = true; }
    }
    if (!changed) continue;
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      res.touched += 1;
      console.log(`T-MOVE-01: widget ${wid} καθαρίστηκε`);
    } catch (e) {
      console.log(`T-MOVE-01: αποτυχία στο widget ${wid}: ${e && e.message}`);
    }
  }
  return res;
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

  // T-MOVE-01: από ΟΛΑ τα widget του ταμπλό (όχι μόνο το AgroGenius), εκτός των καρτελών βανών.
  const _st = await stripDevicesFromDashboard(dashboardId, removedIds);
  const widgetsTouched = _st.touched;
  const _valveNote = _st.valve ? ` ${_st.valve} widget βανών δεν αγγίχτηκαν (Κώστας).` : "";

  console.log(`Done. Detached ${foundDevices.length} device(s) from ${fieldInfo.name}; updated ${widgetsTouched} widget(s). Devices and their data were NOT deleted.`);

  // Final UI feedback.
  if (widgetsTouched === 0) {
    await sendValidation(
      "warning",
      `Οι συσκευές αφαιρέθηκαν από τον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget με αυτές για ενημέρωση.` + _valveNote
    );
  } else {
    await sendValidation(
      "success",
      `Αφαιρέθηκαν ${foundDevices.length} συσκευές (${label}) από τον αγρό «${fieldInfo.name}». Οι συσκευές και τα δεδομένα τους δεν διαγράφηκαν.` + _valveNote
    );
  }
}

module.exports = new Analysis(myAnalysis);
