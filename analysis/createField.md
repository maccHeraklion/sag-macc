# createField.js — Field Creation Analysis

TagoIO Analysis (Node.js serverless, `@tago-io/sdk`) that provisions a new field end-to-end.

## What it does

1. Reads input from `scope` (form variables submitted by the user)
2. Discovers sensor devices by their EUI tags
3. Determines each device's variables from its **`type` tag** (no data fetch)
4. Creates a **Field device** (the anchor/metadata device for the field)
5. Clones a **template dashboard** and wires all devices + variables into it
6. Registers the field on the global map widget
7. Saves tags, location, and subscription metadata

## Input scope variables

| Variable | Description |
|---|---|
| `field_name` | Human-readable field name |
| `device1`, `device2`, … | EUI of each sensor device |
| `device1_name`, `device2_name`, … | Optional friendly name for each device |
| `devicesnum` | Max number of devices to include |
| `coordinates` | `"lat, lng"` string |
| `subscriptiondefault` | If true, use computed cost as current cost |
| `subscriptioncurrentcost` | Override current subscription cost |
| `subscriptionend` | ISO datetime for subscription expiry |
| `template_dashboard_id` | Optional override of the template dashboard to clone |
| `iscustomer` | Whether a customer context is provided |
| `customer` | Customer device id |
| `user` | TagoIO user id |

## Device type → variable mapping

Variables are assigned based on the device's **`type` tag**, not on whether data exists. This ensures newly-installed devices are wired in from day one.

The mapping is `DEVICE_TYPE_VARIABLES` at the top of `createField.js`. To add a new device type, add an entry there:

```js
const DEVICE_TYPE_VARIABLES = {
  em320:    ["temperature", "humidity"],
  em300_th: ["temperature", "humidity", "dew_point"],
  s2120:    ["air_temperature", "air_humidity", "wind_speed_kmh", ...],
  se0x:     ["soil_moisture1", "soil_temperature1", "conduct_soil1", ...],
  lse02:    ["soil_moisture1", "soil_temperature1", "conduct_soil1", ...],
  lse01:    ["soil_moisture", "temp_soil", "conduct_soil"],
  lms01_ls: ["leaf_temperature", "leaf_moisture"],
  uc511:    ["batterypct", "valve_1", "valve_2", "rule1", ...],
  // add new types here
};
```

If a device has no `type` tag, or its type is not in the map, it is skipped with a console warning.

## Tab assignment (`TAB_VARS`)

Variables are distributed across dashboard tabs using per-tab wildcard filters:

```js
const TAB_VARS = {
  0: ["soil_moisture*", "soil_temp*", "temperature", "humidity", "fir_message_*"],
  1: ["flow", "totalizer", "valve_*", "fir_message_*"],
  2: ["rain", "wind_*", "uv", "irradiance"],
  3: [], // empty → all variables from all devices
};
```

- Wildcards use `*` suffix (e.g. `soil_moisture*` matches `soil_moisture1`, `soil_moisture2`, etc.)
- Empty array = include everything (no filter)
- A variable can appear in multiple tabs

## Subscription cost

```
cost = SUBSCRIPTION_FACTOR × (count of unique variables selected across all tabs)
```

`SUBSCRIPTION_FACTOR` defaults to `5` (€5 per variable). Cost is computed from the type-derived variable count — no data fetch is needed.

## Template dashboard

`TEMPLATE_FIELD_DEVICE_ID` is a placeholder device id embedded in the template dashboard. At creation time all references to it in widget configs are replaced with the real Field device id via `reassignKeysByMap()`.

After replacement, each widget gets:
- `display.variables` — list of `{ variable, origin: { id, bucket } }` entries for all selected sensor variables + static field vars
- `display.parameters.dashboard_id` — the new dashboard id
- `display.parameters.device_map` — JSON map of `{ device_id: friendly_name }` for all wired devices

## Key functions

| Function | Purpose |
|---|---|
| `getVariablesByDeviceType(device)` | Reads `type` tag, returns variables from `DEVICE_TYPE_VARIABLES` |
| `buildDeviceVariableIndex(devices)` | Builds `bestByVariable` map (variable → best device) from type-derived vars |
| `buildRowsForTab_VarsOnly(filter, index)` | Produces widget row list for one tab using tab filter |
| `assignDevicesToTabs_VarsOnly(...)` | Iterates all widgets, merges static field vars + dynamic device vars, writes back |
| `createFieldDevice(...)` | Creates the Field device with all metadata tags |
| `createDashboard(...)` | Duplicates template dashboard, sets access/group tags |
| `addToGeneralMap(...)` | Pins the field on the main map widget |

## Do not

- Do not revert to fetching device data to discover variables — use `DEVICE_TYPE_VARIABLES`
- Do not add an `isAcceptableVar` filter — the type map is the sole source of truth for which variables are valid
- Do not add `ACCEPTABLE_VAR_PATTERNS` back — it has been removed intentionally
