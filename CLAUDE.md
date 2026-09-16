# CLAUDE.md — Developer Guide for Claude Code

## What this project is

**AgroGenius Dashboard** — a React/TypeScript custom widget for the [TagoIO](https://tago.io) IoT platform.
It is a smart-farming dashboard that displays real-time environmental data, irrigation control, crop disease risk, weather forecast, and a cultivation calendar for agricultural IoT deployments.

The widget is deployed as a static build uploaded to TagoIO cloud storage and rendered inside the TagoIO dashboard iframe.

---

## Tech stack

| Concern | Library |
|---|---|
| UI | React 18 + TypeScript 5 |
| Build | Vite 4 |
| Charts | ECharts 5 |
| Maps | Leaflet 1.9 |
| Date/time | Luxon 3 |
| XLSX export | SheetJS (xlsx 0.18) |
| TagoIO SDK | `@tago-io/custom-widget` v1.1 |
| Tests | Jest 29 + React Testing Library |

---

## Key commands

```sh
npm start            # dev server (localhost:1234)
npm run build        # production build → _dist/
npm run build:staging
npm run build:production
npm run build:betaTesting
npm run deploy:staging
npm run deploy:production
npm test
npm run check:types
npm run lint
```

---

## Project structure

```
src/
  Dashboard.tsx              # Main component — all state, data parsing, event handlers (~2000 lines)
  App.tsx                    # Root wrapper
  main.tsx                   # React DOM entry

  # Modals (each is a full-screen dialog opened from a dashboard card)
  MeasurementModal.tsx       # ECharts time-series for a single measurement
  PathoModal.tsx             # Pathogen/pest risk with color-coded severity
  IrrigationModal.tsx        # Valve control + water meter + battery status
  IrrigationRulesModal.tsx   # Configure irrigation automation rules
  ForecastModal.tsx          # Open-Meteo hourly weather forecast table
  EnvironmentConditionsModal.tsx
  DeviceMeasurementsModal.grid.tsx
  AllMeasurementsModal.grid.tsx
  CultivationCalendarModal.tsx
  ConfigurationModal.tsx     # Crop/device setup

  config/
    variablesConfig.ts       # 40+ sensor variable definitions (labels, units, conversions, categoricals)
    measurements.ts          # Measurement table config + environment source mapping
    pathogens.ts             # 14 pathogen/pest types (Greek names + scientific + risk levels)

  Helpers/
    parse-tago-data.ts       # TagoIO data → ECharts series format
    parse-params.ts          # Widget URL/query parameter parsing
    parse-user.ts            # User info extraction
    type-guards.ts           # TypeScript type guards

  Dashboard.css
  Modals.css
  Widget.css

analysis/
  runPerTich.js              # TagoIO Analysis — hourly/daily indicator engine (see below)
payload_parsers/             # TagoIO payload parser scripts
scripts/                     # Deployment scripts
```

---

## Dashboard cards (left to right, top to bottom)

| Card ID | Opens modal | Purpose |
|---|---|---|
| (top bar) | ConfigurationModal | Crop selector |
| Pathogens section | PathoModal | 14 disease/pest risk badges |
| `irrigCard` | IrrigationModal | Valve control + water meters |
| `forecastCard` | ForecastModal | Next-in-time weather entry + graphic |
| `calendarCard` | CultivationCalendarModal | Field event log |
| Right sidebar | MeasurementModal / DeviceMeasurementsModal | Sensor readings + time-series charts |

---

## Data flow

1. TagoIO calls `window.TagoIO.onRealtime(cb)` — delivers a flat array of variable entries.
2. `Dashboard.tsx` listens, parses entries into `state.*` (useReducer or useState, split by variable name).
3. Cards and modals read from `state.*` — no external API calls from the widget itself.
4. Sending commands: `window.TagoIO.sendData([{variable, value, metadata}])`.

### Key variables received

| Variable | Content |
|---|---|
| `forecast` | Open-Meteo hourly data in `metadata.hourly_epoch` + `metadata.hourly.*` arrays |
| `field_bundle` | Packed multi-crop indicator (BPI, stress, pathogens) |
| `configuration` | Crop selection and device mapping |
| `field_calendar` | Cultivation calendar entries (one per farm action/observation) |
| `fir_message_*` | Per-pathogen risk messages (14 variables) |
| sensor vars | Timeseries in `metadata` object (ISO date → value) |

### `field_calendar` data model

Each TagoIO data point for `field_calendar`:
- `value`: human-readable summary string (built by `buildSummary(meta)`)
- `metadata`: `CalendarEntryMetadata` — `{ datetimeISO, issueText?, actionText?, productText?, otherText?, notes? }`

Stored in `state.calendarHistory` as `Record<deviceId, CalendarPoint[]>`.

**Critical design decisions:**
- The calendar is a **farm-level** feature, not per-sensor-device. `field_calendar` is configured in TagoIO for the field device (e.g. `Field_KEK - Αγρός`), which is **different** from the sensor devices in `sidebarDevices`.
- `selectedDeviceId` tracks the selected **sensor** device and must never be used to filter or send calendar data.
- History is displayed by aggregating **all devices**: `Object.values(state.calendarHistory).flat()`.
- Sending uses **TagoIO autofill** (no explicit `device:` field) so TagoIO routes to the configured field device.
- `CultivationCalendarModal` maintains a local `pendingPoints` state for immediate optimistic display after save, cleared when the modal closes.

---

## analysis/runPerTich.js — Indicator Engine

This is a **TagoIO Analysis** (Node.js serverless function, `@tago-io/sdk`). It is the backend brain that runs per device data push and computes all agronomic indicators written to `field_bundle`.

### Trigger logic

Each invocation checks analysis tags to decide the computation scope:
- **`hourTich`** — true if ≥55 min since last hourly tick. Most indicator calculations run only on hourTich.
- **`dailyTich`** — true if ≥1435 min since last daily tick (≈24 h). Daily aggregations (BPI, GDD daily, FIR) run only on dailyTich.

### Indicator calculation chain (per field, per crop)

```
calculate_VPD     (hourTich) → vpd            [shared across crops]
calculate_IPSI    (hourTich) → ipsi            [needs vpd, soil moisture, air temp, leaf temp]
calculate_BPI     (dailyTich)→ bpi, bpiContext [needs ipsi, light, soil temp, air temp]
calculate_GDD     (hourTich + dailyTich)       [needs air temp, accumulated from prevBundle]
calculate_InfectionHours (hourTich)            [needs temp, humidity, leaf moisture]
calculate_FIR     (dailyTich)→ fir             [needs GDD, infection hours, IPSI, rainfall]
calculate_IrrigationVolume (hourTich)          [needs ipsi, soil limits]
```

All results are packed into a single `field_bundle` variable via `packCalculatedIndicators()`.

### Indicator definitions

| Indicator | Description |
|---|---|
| **VPD** | Vapor Pressure Deficit (kPa) — air drying power. From `air_temperature` + `air_humidity`. |
| **IPSI** | Irrigation/Plant Stress Index (0–10). Combines soil moisture, VPD, leaf-air temp diff, crop thresholds. |
| **BPI** | Biophysical Productivity Index — daily growth efficiency × potential. Needs light (LUX), soil temp, air temp, IPSI daily avg. |
| **GDD** | Growing Degree Days — thermal time per pest/pathogen above its base temperature. |
| **FIR** | Field Infection Risk (0–1) per pathogen — combines GDD, infection hours, IPSI. |
| **Infection Hours** | Hourly counter of disease-favorable conditions per fungal pathogen. |

### Error propagation design

Errors bubble from the root missing sensor up through the calculation chain. All three functions now accept an upstream error argument and propagate it so the user always sees the **actual missing sensor**, not an intermediate indicator name:

```
calculate_VPD()           → { vpdData, vpdError }
calculate_IPSI(..., vpdError) → { ipsi, ipsiError }   # uses vpdError if VPD was missing
calculate_BPI(..., ipsiError) → { bpi, ..., bpiError } # uses ipsiError if IPSI was missing
```

Error messages written to `field_bundle` (shown in dashboard):
- `bpi_message` with color "grey" when BPI unavailable
- `plant_stress` with color "grey" when IPSI unavailable

### Crop profiles (`CROP_PROFILE`)

Hardcoded in the analysis for 30+ crops across categories:
- `olive` (koroneiki)
- `vineCrops` (wine_grapes, table_grapes, raisin_grapes)
- `cerealCrops` (wheat, barley, maize, oats)
- `citrusFruits` (orange, lemon, mandarin)
- `stoneFruits` (peach, nectarine, apricot)
- `vegetablesCrops` (tomato, pepper, cucumber, etc.)

Each profile has: `light_use_efficiency_curve` (per stage), `nutrient_demand_curves` (N/P/K per stage), `optimal_temp_range`, `optimal_moisture_range`, `M_field_capacity`, `wilting_point`, `root_depth_curve`, `max_tolerance_ECe`.

### Pathogen profiles (`PATHOGEN_PROFILE`)

14 pathogens/pests. Categories: `insects`, `mites`, `fungi`. Each has crop-specific risk models:
- Insects/mites use **GDD** (`pestBaseTemp`, `activityTempRange`)
- Fungi use **infection hours** (`requiredDurationHrs`, `optimalTempRange`, `optimalRHRange`, `optimalLeafWetness`)

### field_bundle packing

All per-crop and shared indicators are packed into a single TagoIO variable `field_bundle` with nested metadata:
```js
metadata: {
  shared: { vpd: { value, metadata }, ... },
  crops: [{ id, cultivation_type_general, cultivation_type, indicators: { bpi: {...}, ipsi: {...}, ... } }]
}
```
The dashboard widget reads from `state.forecastLatest["field_bundle"].metadata`.

### Environment variables required

| Key | Purpose |
|---|---|
| `ACCOUNT_TOKEN` | TagoIO account token for device/data access |
| `ACCUWEATHER_API_KEY` | Optional — for legacy AccuWeather daily forecast |

### Device type → sensor variable mapping (`DEVICE_TYPE_VARIABLES`)

| Device type | Sensor variables |
|---|---|
| `s2120` | `air_temperature`, `air_humidity`, `wind_speed_kmh`, `uv_index`, `light_intensity`, `rain_height`, `barometric_pressure_hpa`, `dew_point`, `wind_direction_sensor` |
| `se0x` / `lse02` | `soil_moisture1`, `soil_temperature1`, `conduct_soil1` (×2 depths) |
| `lse01` | `soil_moisture`, `temp_soil`, `conduct_soil` |
| `lms01_ls` | `leaf_temperature`, `leaf_moisture` |
| `em300_th` | `temperature`, `humidity`, `dew_point` |
| `field` | GDD accumulated/daily per pest + infection_hours_counter per fungus |

---

### Forecast data format (Open-Meteo / NEW format)

```ts
metadata: {
  hourly_epoch: number[],          // Unix epoch seconds
  hourly: {
    temperature_2m: number[],
    relative_humidity_2m: number[],
    wind_speed_10m: number[],
    weather_code: number[],        // WMO codes
    precipitation: number[],
    precipitation_probability: number[],
  },
  hourly_units: { wind_speed_10m: "km/h" | "m/s" },
  forecast_base_date: string,
}
```

---

## Important patterns

### Shared forecast helpers (exported from ForecastModal.tsx)

```ts
import { wmoToHuman, toKmhFromUnit, formatWithConfig } from "./ForecastModal";
```

- `wmoToHuman(code)` → `{ emoji, label }` (Greek WMO weather description)
- `toKmhFromUnit(raw, unit?)` → km/h number or null
- `formatWithConfig("wind_speed_kmh", kmh)` → Bft string via variablesConfig conversions

### variablesConfig

```ts
import { getVarConfig } from "./config/variablesConfig";
const conf = getVarConfig("wind_speed_kmh");
// conf.label, conf.defaultUnit, conf.conversions, conf.categorical
```

### Localization

All UI text is in **Greek (el-GR)**. Keep all new UI text in Greek.
Use `toLocaleString("el-GR", { hour12: false })` for date/time formatting.

---

## analysis/createField.js — Field Creation Analysis

TagoIO Analysis (Node.js) that provisions a new field: creates a Field device + a cloned dashboard, wires sensor devices into it, and registers it on the global map.

See [analysis/createField.md](analysis/createField.md) for full details.

**Key design decisions:**
- Variables assigned to the dashboard are derived from each device's **`type` tag** (not from actual data). This means a freshly-installed device with no data yet still gets its variables wired in.
- The type → variables mapping is `DEVICE_TYPE_VARIABLES` at the top of the file. **To add a new device type, add it there.**
- Tab assignment still uses `TAB_VARS` per-tab filters (wildcards supported). Tab with empty array = include all variables from all devices.
- Subscription cost = `SUBSCRIPTION_FACTOR × (count of variables selected across all tabs)`.
- `TEMPLATE_FIELD_DEVICE_ID` is the placeholder device id inside the template dashboard that gets replaced with the real field device id at creation time.

---

## Branches & deployment

| Branch | Environment |
|---|---|
| `innodays` | main / production base |
| `autoDeploy` | current working branch |

Deploy scripts use `TAGO_TOKEN` from `.env`.

---

## Do not

- Do not add English UI text (all labels are Greek)
- Do not introduce new dependencies without discussion
- Do not break the `forecastCardInfo` useMemo shape — other parts of the card depend on it
- Do not change the TagoIO SDK integration pattern (`window.TagoIO.*`)
- Do not use `selectedDeviceId` for calendar data — it points to a sensor device, not the field device
- Do not filter `calendarHistory` by `selectedDeviceId` — always aggregate across all devices
- Do not set `autofill = false` when sending `field_calendar` — let TagoIO route to the field device automatically
- Do not assume `selectedDeviceId` is non-null when opening the calendar card — it is often null on first open
