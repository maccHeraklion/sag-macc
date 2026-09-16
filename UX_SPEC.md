# Multi-crop UX Spec (Dashboard Custom Widget)

## Goals
- Support multiple crops in a single installation (same field/device group).
- Keep the UI crop-centric: **selected crop drives most cards**, but allow **multi-crop views** for specific indicators (starting with Plant Stress).
- Be migration-safe: work with either `field_bundle` (preferred) or only `configuration` (fallback).

---

## Data contract (what the widget expects)

### Preferred runtime input
1. `field_bundle` (device data variable)
   - `metadata.crops[]`: list of crops in the field
     - `id`: stable crop id (e.g. `vineCrops:wine_grapes:1`)
     - `indicators`: object of per-crop indicators (e.g. `plant_stress`, stage messages, etc.)
   - `metadata.shared`: shared indicators (optional; e.g. station/weather/ET0 summary)
2. `configuration` (device data variable) OR `configuration` tag
   - Used mainly for fallback labeling when `field_bundle` is missing.

### Fallback rules
- If `field_bundle` exists:
  - Crop picker is enabled (if >1 crops).
  - Selected crop indicators are merged into `uiLatest` and drive the dashboard.
- If `field_bundle` is missing:
  - Use `configuration.crops[0]` (primary crop) for labels; otherwise legacy root fields.

---

## Primary interaction model

### Crop selection
- When there are multiple crops (`availableCrops.length > 1`), show a crop picker in the top bar.
- The selected crop becomes the “active crop” and drives:
  - Irrigation card/modal context
  - Forecast context (if crop-specific downstream)
  - Pathogen/risk messages (if crop-specific downstream)
  - Measurement thresholds (soil moisture limits) **for the selected crop**

### Multi-crop views (per metric)
Some metrics are meaningful to compare across crops.
- The UI supports **metric-level multi-crop rendering**, starting with:
  - **Plant Stress (plant_stress)**

#### Plant Stress
- Default behavior: show Plant Stress for the **selected crop** (single badge + description).
- Optional behavior: show Plant Stress for **multiple crops** as a list of mini-cards (label + badge + optional text).
- User can:
  - Enable “All crops” mode for Plant Stress.
  - Select which crops appear in the Plant Stress list.

---

## Display preferences

### UI
- Top bar includes a “Ρυθμίσεις” button.
- Settings modal contains:
  - Toggle: “Όλες οι καλλιέργειες” for Plant Stress.
  - When enabled: per-crop checkboxes controlling visibility in the list.

### Persistence
- Preferences are stored in `localStorage` under:
  - `sag_dashboard_prefs_v1`
- Structure:
```json
{
  "showAllStress": false,
  "cropMetric": {
    "vineCrops:wine_grapes:1": { "plant_stress": true },
    "vegetableCrops:onion:2": { "plant_stress": false }
  }
}
```

---

## Measurements Modal integration

### Soil moisture thresholds
- Measurement modal adds reference lines only for soil moisture variables.
- Thresholds come from `uiLatest`:
  - `soil_moisture_lower_limit`
  - `soil_moisture_upper_limit`
- Since `uiLatest` is built from the selected crop’s indicators, thresholds are naturally crop-aware.

---

## UX safeguards
- When `field_bundle` updates:
  - If previously selected crop id is no longer present, auto-select the first crop.
- When `field_bundle` is missing:
  - Use `configuration.crops[0]` or legacy fields for crop label, so the UI does not show “—”.

---

## Roadmap (next metrics)
The same multi-crop pattern can be applied to:
- Irrigation recommendation summary (per crop)
- WaterNeed (mm) per crop
- Disease pressure per crop
- Any “badge + text” indicator per crop

Implementation approach:
- Add a new preference flag (e.g. `showAllIrrigationSummary`)
- Render a list using `availableCrops[i].indicators[VAR_NAME]`
