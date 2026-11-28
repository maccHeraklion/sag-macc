/*
 * Aggregator Analysis — Hotel Irrigation
 * ---------------------------------------
 * Trigger: an Action with type "Variable" or "Resource" that fires whenever any of the
 *          irrigation devices (tagged project=hotel_volta) receives data.
 *          Configure the Action to run THIS analysis and pass the scope.
 *
 * What it does:
 *   1. Reads the device that just sent data (the "scope" device).
 *   2. Reads that device's `zone` tag (e.g. "zone-1"). If absent, the device is unwired → skip.
 *   3. Copies a lean set of irrigation/soil variables into the single AGGREGATOR device,
 *      stamping group = <zone tag value> so the custom widget can group by zone.
 *
 * Cost note: writing into one mutable device = Data Input only; the widget reads via the
 * realtime websocket (onStart/onRealtime), so there is no Data Output query cost.
 *
 * Required Environment Variables (Analysis → Environment Variables):
 *   AGGREGATOR_DEVICE_ID  = the device ID of the aggregator device
 *
 * Single-file analysis, no package.json. Uses the @tago-io/sdk global available in Analysis.
 */

const { Analysis, Resources, Device, Utils } = require("@tago-io/sdk");

// Variables we forward into the aggregator (kept lean on purpose).
const FORWARD_VARIABLES = [
  // valve 1 / controller
  "valve_1", "valve_1_command", "valve_1_command_feedback", "valve_1_status", "valve_1_state",
  "valve_1_feedback", "valve_1_reported", "valve_1_actual", "valve_1_position",
  "valve_1_time_command", "valve_1_schedule_command", "valve_1_pulse",
  "relay_1", "relay_1_status", "output_1",
  // valve 2 / controller (UC511 can drive two valves)
  "valve_2", "valve_2_command", "valve_2_command_feedback", "valve_2_status", "valve_2_state",
  "valve_2_feedback", "valve_2_reported", "valve_2_actual", "valve_2_position",
  "valve_2_time_command", "valve_2_schedule_command", "valve_2_pulse",
  "relay_2", "relay_2_status", "output_2",
  // soil sensor
  "soil_moisture", "soil_temperature", "temp_soil", "conduct_soil",
  // schedule rules (state, so the dashboard can display active schedules) — up to 8 slots per zone
  "rule1", "rule2", "rule3", "rule4", "rule5", "rule6", "rule7", "rule8",
  // optional battery / diagnostics
  "batterypct",
];

// Weather-station variables forwarded site-wide (group = "weather", not a valve zone).
const WEATHER_VARIABLES = [
  "air_temperature", "air_humidity", "barometric_pressure_hpa",
  "wind_speed_kmh", "wind_direction_sensor",
  "rain_height", "rain_gauge", "rain_height_acc",
  "current_rain_height_daily", "rain_height_daily",
  "current_rain_height_weekly", "rain_height_weekly",
  "current_rain_height_monthly", "rain_height_monthly",
  "uv_index", "light_intensity", "dew_point", "wind_chill", "thw_indexc",
];

// Field/computation variables forwarded site-wide (group = "field", not a valve zone).
// These arrive from a device tagged project=hotel_volta, role=field.
const FIELD_VARIABLES = [
  "forecast", "field_bundle", "configuration", "bpi_message", "plant_stress",
  "location", "coordinates",
];

// Reserved groups used for site-wide data (must match the dashboard's reserved groups).
const WEATHER_GROUP = "weather";
const FIELD_GROUP = "field";

async function startAnalysis(context, scope) {
  try {
    if (!Array.isArray(scope) || scope.length === 0) {
      context.log("No scope received — nothing to aggregate.");
      return;
    }

    // Resources needs an account token for device-management calls (info, tokenList).
    // Provide it via the analysis Environment Variable / Secret named ACCOUNT_TOKEN.
    const accountToken = context.environment.find((x) => x.key === "ACCOUNT_TOKEN")?.value;
    if (!accountToken) {
      context.log("ERROR: ACCOUNT_TOKEN environment variable/secret is not set.");
      return;
    }
    const resources = new Resources({ token: accountToken });

    // The scope device id — every record in scope shares the same origin device.
    const sourceDeviceId = scope[0].device || scope[0].origin;
    if (!sourceDeviceId) {
      context.log("Could not resolve the source device from scope.");
      return;
    }

    // Read the source device's tags to find its zone.
    const deviceInfo = await resources.devices.info(sourceDeviceId);
    const tags = deviceInfo.tags || [];
    const zone = tags.find((t) => t.key === "zone")?.value;
    const zoneLabel = tags.find((t) => t.key === "zone_label")?.value || zone;

    // Resolve WHICH aggregator device to write into, per project — so ONE analysis + one
    // tag-triggered action per hotel can serve many installations. Prefer a device tagged
    // role=aggregator with the same `project` as this source device; fall back to the
    // AGGREGATOR_DEVICE_ID env var only when the source has no project tag (legacy single-hotel).
    const project = tags.find((t) => t.key === "project")?.value || null;
    const aggregatorId = await resolveAggregatorId(resources, context, project);
    if (!aggregatorId) {
      context.log(`No aggregator device resolved (project="${project || "-"}"). Tag the aggregator device role=aggregator + aggregator_project=<slug>, or set the AGGREGATOR_DEVICE_ID env var.`);
      return;
    }
    // Self-write guard: never process the aggregator's OWN data as a source. Without this, if the
    // aggregator ever carries the Action's trigger tag, its writes would re-trigger this analysis in
    // an infinite loop. (The primary defence is that the aggregator is tagged aggregator_project, not
    // project — but keep this as a hard stop.)
    if (String(sourceDeviceId) === String(aggregatorId)) {
      context.log("Source is the aggregator device itself — skipping to avoid a feedback loop.");
      return;
    }

    // ── Weather / site-wide variables ────────────────────────────────────────
    // Any device may emit weather site variables (the weather station). Forward ALL such
    // variables found in this scope under group="weather" — no zone needed.
    const weatherStationId = context.environment.find((x) => x.key === "WEATHER_STATION_ID")?.value;
    const isWeatherStation = (weatherStationId && sourceDeviceId === weatherStationId)
      || tags.some((t) => t.key === "role" && /weather|meteo|καιρ/i.test(t.value || ""));
    const isFieldDevice = tags.some((t) => t.key === "role" && /^field$/i.test(t.value || ""));

    const aggDevToken = await getAggregatorToken(resources, aggregatorId);

    const weatherWrite = [];
    scope.forEach((item) => {
      if (!item.variable || !WEATHER_VARIABLES.includes(item.variable)) return;
      weatherWrite.push({
        variable: item.variable,
        value: item.value,
        unit: item.unit,
        group: WEATHER_GROUP,
        time: item.time || new Date().toISOString(),
        metadata: Object.assign({}, item.metadata || {}, {
          source_device: sourceDeviceId,
          source_name: deviceInfo.name,
        }),
      });
    });
    if (weatherWrite.length) {
      const aggDev = new Device({ token: aggDevToken });
      await aggDev.sendData(weatherWrite);
      context.log(`Forwarded ${weatherWrite.length} site/weather record(s) into aggregator (group="${WEATHER_GROUP}").`);
    }

    // ── Field / computation variables ────────────────────────────────────────
    // A device tagged role=field emits forecast / field_bundle / configuration / bpi_message /
    // plant_stress. Forward ALL such variables found in this scope under group="field" — no zone.
    const fieldWrite = [];
    scope.forEach((item) => {
      if (!item.variable || !FIELD_VARIABLES.includes(item.variable)) return;
      const rec = {
        variable: item.variable,
        value: item.value,
        unit: item.unit,
        group: FIELD_GROUP,
        time: item.time || new Date().toISOString(),
        metadata: Object.assign({}, item.metadata || {}, {
          source_device: sourceDeviceId,
          source_name: deviceInfo.name,
        }),
      };
      // The "location" variable carries a geo object: { lat, lng } / { type, coordinates }.
      // Preserve it so the dashboard receives the coordinates on the aggregator side too.
      if (item.location) rec.location = item.location;
      fieldWrite.push(rec);
    });
    if (fieldWrite.length) {
      const aggDev = new Device({ token: aggDevToken });
      await aggDev.sendData(fieldWrite);
      context.log(`Forwarded ${fieldWrite.length} field record(s) into aggregator (group="${FIELD_GROUP}").`);
    }

    // If this device is purely the weather station or field device (no zone), we're done.
    if ((isWeatherStation || isFieldDevice) && !zone) return;
    // ─────────────────────────────────────────────────────────────────────────

    if (!zone) {
      if (!weatherWrite.length && !fieldWrite.length) {
        context.log(`Device ${sourceDeviceId} (${deviceInfo.name}) has no "zone" tag and no site variables — skipping. Wire it from the dashboard first.`);
      }
      return;
    }

    // Build the records to write into the aggregator.
    // We only forward variables that are in FORWARD_VARIABLES and were present in this scope.
    const toWrite = [];
    scope.forEach((item) => {
      const variable = item.variable;
      if (!variable || !FORWARD_VARIABLES.includes(variable)) return;
      const meta = Object.assign({}, item.metadata || {}, {
        source_device: sourceDeviceId,
        source_name: deviceInfo.name,
        zone_label: zoneLabel,
      });
      toWrite.push({
        variable,
        value: item.value,
        unit: item.unit,
        group: zone,            // <-- the zone key the widget groups by
        time: item.time || new Date().toISOString(),
        metadata: meta,
      });
      // The UC511 reports valve state as plain `valve_N`. The widget subscribes to
      // `valve_N_status` in its Data From, so mirror the value there too (only the
      // status mirror needs to be in Data From for realtime feedback to update live).
      const m = variable.match(/^valve_(\d+)$/);
      if (m) {
        toWrite.push({
          variable: `valve_${m[1]}_status`,
          value: item.value,
          unit: item.unit,
          group: zone,
          time: item.time || new Date().toISOString(),
          metadata: meta,
        });
      }
    });

    if (!toWrite.length) {
      context.log(`Nothing to forward for device ${deviceInfo.name} (no matching variables in scope).`);
      return;
    }

    const aggregator = new Device({ token: await getAggregatorToken(resources, aggregatorId) });
    await aggregator.sendData(toWrite);
    context.log(`Forwarded ${toWrite.length} record(s) from ${deviceInfo.name} into aggregator under zone "${zone}".`);
  } catch (err) {
    context.log("Aggregator analysis error:", err && err.message ? err.message : String(err));
  }
}

// Resolve the aggregator device id for a given project. Looks up a device tagged
// role=aggregator + aggregator_project=<project>. IMPORTANT: the aggregator is matched by the
// dedicated `aggregator_project` tag, NOT `project` — the aggregator must never carry the `project`
// tag the Action triggers on, or the analysis's own writes into it would re-fire the Action in an
// infinite loop. If the source device has no project tag, falls back to the legacy
// AGGREGATOR_DEVICE_ID env var (single-hotel installs). Returns null if nothing matches (deliberately
// does NOT cross-write to the env aggregator when a project is present but unmatched).
async function resolveAggregatorId(resources, context, project) {
  if (project) {
    try {
      const list = await resources.devices.list({
        amount: 1,
        fields: ["id", "tags"],
        filter: { tags: [{ key: "role", value: "aggregator" }, { key: "aggregator_project", value: project }] },
      });
      if (Array.isArray(list) && list[0] && list[0].id) return list[0].id;
      context.log(`No role=aggregator device found for aggregator_project="${project}".`);
      return null;
    } catch (err) {
      context.log("Aggregator lookup failed:", err && err.message ? err.message : String(err));
      return null;
    }
  }
  // Legacy path: source device has no project tag → use the env var.
  return context.environment.find((x) => x.key === "AGGREGATOR_DEVICE_ID")?.value || null;
}

// Helper: get a device token for the aggregator so we can call sendData.
// Resources.devices.tokenList returns existing tokens; we reuse the first full-access one.
async function getAggregatorToken(resources, aggregatorId) {
  const tokens = await resources.devices.tokenList(aggregatorId, { amount: 10, fields: ["name", "token", "permission"] });
  const usable = tokens.find((t) => t.permission === "full" || t.permission === "write") || tokens[0];
  if (!usable) throw new Error("No token available on the aggregator device. Create one in the device's Tokens tab.");
  return usable.token;
}

module.exports = new Analysis(startAnalysis);