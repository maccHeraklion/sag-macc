# AgroGenius Dashboard — Project Specification

## Introduction

**AgroGenius Dashboard** is a smart-farming IoT dashboard widget built on the [TagoIO](https://tago.io) platform. It aggregates data from field sensor networks and presents agronomists and farmers with a unified real-time view of:

- Environmental conditions (temperature, humidity, soil moisture, wind, etc.)
- Crop health indicators (growth potential, stress levels)
- Disease and pest pressure (14 configurable pathogens)
- Irrigation control (remote valve operation, water metering)
- Weather forecast (Open-Meteo hourly)
- Cultivation history (calendar of farm operations)

The widget is a single-page React application that runs inside the TagoIO dashboard iframe. All data arrives through the TagoIO custom widget SDK (`window.TagoIO.onRealtime`). No direct API calls to external services are made from the widget — data is pre-processed by TagoIO Analysis scripts and delivered as variable entries.

---

## System Architecture

```
Field Sensors (IoT) ──→ TagoIO Platform ──→ Analysis Scripts ──→ Widget Variables
                                                                        │
                                                              window.TagoIO.onRealtime
                                                                        │
                                                              Dashboard.tsx (React)
                                                                        │
                                              ┌─────────────────────────┴────────────────────────┐
                                              │              Cards + Modals                       │
                                           Forecast     Irrigation    Pathogens   Calendar ...
```

### Data input model

Each variable entry follows this shape:

```json
{
  "variable": "variable_name",
  "unit": "%",
  "group": "device_id",
  "value": "Human label or scalar",
  "metadata": { "ISO_date": numeric_value, ... }
}
```

Special variables carry rich data in `metadata` (forecast, field_bundle, configuration).

---

## Features

### 1. Multi-Crop Support

The dashboard supports multiple crop configurations within the same field. A `configuration` variable defines which crops are active and maps each to its device set. The user can switch between crops via the top-bar selector. Display preferences (which crops to show in stress view) are persisted in `localStorage`.

**Key variable:** `configuration`

### 2. Crop Indicators

A `field_bundle` variable carries packed per-crop data:
- **BPI** (Biotic Potential Index) — plant growth potential badge
- **Stress** — plant stress level (affects irrigation decisions)
- **Pathogen risk** — aggregated from per-pathogen risk messages

The UI shows these as color-coded badges per crop.

### 3. Pathogen / Pest Risk Monitoring

14 disease and pest models, each sending a `fir_message_*` variable:

| Key | Name (Greek) | Organism |
|---|---|---|
| `fir_message_plasmo` | Περονόσπορος | Plasmopara viticola |
| `fir_message_erysiphe` | Ωίδιο | Erysiphe necator |
| `fir_message_phytoph` | Εarly Blight | Phytophthora infestans |
| `fir_message_botrytis` | Βοτρύτης | Botrytis cinerea |
| `fir_message_venturia` | Apple Scab | Venturia inaequalis |
| `fir_message_taphrina` | Τaphrina | Taphrina deformans |
| `fir_message_dacus` | Δάκος | Bactrocera oleae |
| `fir_message_prays` | Πυρηνοτρήτης | Prays oleae |
| `fir_message_palpita` | Palpita | Palpita unionalis |
| `fir_message_tuta` | Tuta absoluta | Tuta absoluta |
| `fir_message_aphid` | Αφίδες | Myzus persicae |
| `fir_message_ceratitis` | Μεσογειακή μύγα | Ceratitis capitata |
| `fir_message_bemisia` | Bemisia | Bemisia tabaci |
| `fir_message_tetra` | Τετράνυχος | Tetranychus urticae |

Risk levels: green → yellow → orange → red (4 levels).

**PathoModal** shows full details, timing, and recommendations.

### 4. Irrigation Control

Managed via `IrrigationModal` and `IrrigationRulesModal`.

**Capabilities:**
- View valve open/closed status per device
- Send timed or permanent open/close commands
- View water meter (pulse counter) readings
- Monitor device battery levels
- Configure automation rules (threshold-based irrigation triggers)

**Commands sent via:** `window.TagoIO.sendData([{variable: "irrig_command", ...}])`

**Key variables:** `irrig_status`, `irrig_meter`, `battery`, irrigation command variables.

### 5. Weather Forecast

**Source:** Open-Meteo (processed by Analysis and stored in TagoIO as the `forecast` variable).

**Data format (hourly):**
```
metadata.hourly_epoch[]          — Unix epoch seconds for each hour
metadata.hourly.temperature_2m[] — °C
metadata.hourly.relative_humidity_2m[]
metadata.hourly.wind_speed_10m[] — km/h or m/s (see hourly_units)
metadata.hourly.weather_code[]   — WMO codes
metadata.hourly.precipitation[]  — mm
metadata.hourly.precipitation_probability[] — %
```

**WMO weather codes** are converted to Greek labels + emoji via `wmoToHuman()`.

**Dashboard card** (`forecastCard`): Shows the **next upcoming hour** relative to current time (not the first data entry). Displays: large emoji, weather label, date/time, and metric chips (temp, humidity, wind Bft, rain probability, mm).

**ForecastModal**: Full scrollable table grouped by day, with 2h/3h step toggle.

**Legacy format (AccuWeather):** `metadata.days[]` array — still rendered in ForecastModal with a note to upgrade.

### 6. Environmental Conditions

`EnvironmentConditionsModal` shows a grid of current sensor readings grouped by source type (air, soil shallow, soil deep, leaf). Variables are configured in `src/config/variablesConfig.ts`.

### 7. Measurements & Charts

- **Sidebar:** Lists all available measurement variables per device.
- **MeasurementModal:** Opens an ECharts time-series chart for a selected variable. Supports reference lines, multiple series, zoom.
- **DeviceMeasurementsModal:** Shows all measurements for a specific device in a grid.
- **AllMeasurementsModal:** Cross-device measurement grid.

### 8. Cultivation Calendar

`CultivationCalendarModal` — a per-device event log stored in the `field_calendar` TagoIO variable. Supports:
- Adding entries (date, type, notes)
- Types: planting, treatment, observation, harvest, irrigation, other
- Filtering and sorting
- Export to XLSX

**Key variable:** `field_calendar` (stored with `CalendarPoint` + `CalendarEntryMetadata` shape)

### 9. Configuration

`ConfigurationModal` lets users set:
- Active crop types
- Device-to-crop mapping
- Soil moisture thresholds per crop
- Display preferences

---

## Sensor Variable Library

Defined in `src/config/variablesConfig.ts`. Each entry has:
```ts
{
  label: string,           // Greek display name
  defaultUnit: string,
  conversions: {           // unit → (raw_value) => display_value
    [unit]: (n: number) => number
  },
  categorical?: {          // for compass direction, Bft scale, etc.
    [unit]: string[]
  }
}
```

**Grouped sensor types:**

- **Air:** temperature (°C/°F/K), humidity (%), dew point, atmospheric pressure
- **Soil (shallow & deep):** moisture (%), temperature, electrical conductivity
- **Leaf:** temperature, wetness
- **Wind:** speed (Bft / m/s / km/h), direction (16-point compass)
- **Rainfall:** accumulated (mm), intensity
- **Light:** PAR, UV index
- **Irrigation meters:** pulse counters for water flow
- **Battery:** voltage / percentage

---

## Component Architecture

```
App.tsx
└── Dashboard.tsx (main state container)
    ├── Top bar (crop selector)
    ├── Cards grid
    │   ├── Cultivation card → ConfigurationModal
    │   ├── BPI / Stress cards (from field_bundle)
    │   ├── Pathogens section → PathoModal
    │   ├── irrigCard → IrrigationModal
    │   │                └── IrrigationRulesModal
    │   ├── forecastCard → ForecastModal
    │   └── calendarCard → CultivationCalendarModal
    └── Right sidebar
        ├── AllMeasurementsModal
        ├── DeviceMeasurementsModal (per device tab)
        └── MeasurementModal (per variable chart)
```

---

## Shared Utilities

### `ForecastModal.tsx` exports
- `wmoToHuman(code)` → `{ emoji: string; label: string }`
- `toKmhFromUnit(raw, unit?)` → `number | null`
- `formatWithConfig(variableKey, raw)` → formatted string using variablesConfig conversions

### `Helpers/`
- `parse-tago-data.ts` — converts TagoIO metadata timeseries to ECharts `{value: [date, n]}[]`
- `parse-params.ts` — parses `device_map` and `dashboard_id` from widget query params
- `parse-user.ts` — extracts user info from TagoIO context
- `type-guards.ts` — `isString`, `isNumber`, etc.

---

## Localization

- All UI text is in **Greek (el-GR)**.
- Date/time: `toLocaleString("el-GR", { hour12: false })`.
- Crop names: defined in `Dashboard.tsx` (`cropLabelFromId()`), 200+ varieties.
- Pathogen names: Greek common name + scientific name, in `src/config/pathogens.ts`.

---

## Build & Deployment

Three environments, each with its own TagoIO profile ID and storage path:

| Environment | npm script |
|---|---|
| Staging | `npm run deploy:staging` |
| Beta Testing | `npm run deploy:betaTesting` |
| Production | `npm run deploy:production` |

Build output goes to `_dist/`. Upload is handled by deployment scripts in `scripts/` using `TAGO_TOKEN` from `.env`.

---

## Branches

| Branch | Role |
|---|---|
| `innodays` | Main / production-stable base |
| `autoDeploy` | Active development branch |

---

## Analysis Scripts

`analysis/` contains standalone Node.js scripts (not part of the widget build) that run server-side on TagoIO:
- Fetch data from weather APIs and sensors
- Compute disease risk indices
- Pack data into the `field_bundle` / `forecast` / `fir_message_*` variables
- Push results back to TagoIO

`payload_parsers/` contains TagoIO payload parsers for specific IoT devices (e.g. `uc511_parser.js`).
