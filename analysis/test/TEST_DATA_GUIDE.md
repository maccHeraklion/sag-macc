# Test Data Guide — runPerTich.js Scenarios

This document explains how to write mock sensor data for test scenarios.
Each scenario is a plain `.js` file in `analysis/test/scenarios/`.

---

## Scenario file structure

```js
module.exports = {
  name: 'Short human-readable name',
  description: 'Optional longer description',

  ticks: {
    hourTich:  true,   // fires VPD, IPSI, GDD hourly increment, InfectionHours
    dailyTich: false,  // fires BPI, GDD daily accumulation, FIR
  },

  cropParams: { /* see section below */ },
  measurements: { /* see section below */ },
  assertions: [ /* see section below */ ],
};
```

---

## `cropParams`

Mirrors the object returned by `getFieldParameters()` in production.

| Key | Type | Example | Notes |
|-----|------|---------|-------|
| `cultivation_type_general` | string | `"olive"` | Top-level crop category. Must match a key in `CROP_PROFILE`. |
| `cultivation_type` | string | `"koroneiki"` | Cultivar. Must match a sub-key in `CROP_PROFILE[cultivation_type_general]`. |
| `stage` | string | `"fruit_dev"` | Growth stage key used to look up LUE and nutrient demand. |
| `area` | number | `10000` | Field area in m² (1 ha = 10 000 m²). |
| `plantation_year` | number \| null | `2015` | Used to compute plant age. |
| `season` | string | `"summer"` | `"spring"`, `"summer"`, `"autumn"`, `"winter"` |

### Valid `cultivation_type_general` values

`olive`, `vineCrops`, `cerealCrops`, `citrusFruits`, `stoneFruits`,
`pomeFruits`, `vegetableCrops`, `leafyVegetables`, `rootVegetables`,
`legumes`, `herbsSpices`, `berries`, `tropicalSubtropical`

---

## `measurements`

Mirrors the object returned by `getMeasurements()` in production.

```js
measurements: {
  timezone: 'Europe/Athens',     // IANA timezone string
  now: new Date('2025-07-15T12:00:00Z'),         // current instant (UTC)
  _prevBundleTime: '2025-07-14T12:00:00Z',       // ISO string of last bundle

  data: {
    /* sensor variables */
    /* 24-hour aggregates */
    /* previous indicators (from prevBundle) */
  },
}
```

### Sensor variable format

Each sensor variable is an array of TagoIO data-point objects:

```js
air_temperature: [{ value: 25.0 }]
```

The `[0].value` is what the calculations read. Additional fields (`time`, `serie`, `unit`) are ignored by the calculation functions.

### Atmospheric sensors (`s2120`, `em300_th`, `em320_th`)

| Variable | Unit | Typical range | Used by |
|----------|------|---------------|---------|
| `air_temperature` | °C | -5 … 45 | VPD, IPSI, GDD |
| `air_humidity` | % RH | 10 … 100 | VPD, InfectionHours |
| `dew_point` | °C | -10 … 30 | InfectionHours (optional) |
| `light_intensity` | lux | 0 … 120 000 | BPI fallback |
| `rain_height` | mm | 0 … 50 | FIR |
| `barometric_pressure_hpa` | hPa | 950 … 1050 | (unused by calculations) |

> **Tip:** If both `air_temperature` and `temperature` are present,
> `air_temperature` takes priority in VPD and IPSI.

### Soil sensors (`se0x`, `lse02`)

| Variable | Unit | Typical range | Used by |
|----------|------|---------------|---------|
| `soil_moisture1` | %v/v | 5 … 60 | IPSI, IrrigationVolume |
| `soil_temperature1` | °C | 5 … 40 | BPI |
| `conduct_soil1` | mS/cm | 0 … 5 | (currently unused) |
| `soil_moisture2` | %v/v | 5 … 60 | IPSI fallback |
| `soil_temperature2` | °C | 5 … 40 | BPI fallback |

Wilting point and field capacity are taken from `CROP_PROFILE`, **not** from these sensors.

### Leaf sensors (`lms01_ls`)

| Variable | Unit | Typical range | Used by |
|----------|------|---------------|---------|
| `leaf_temperature` | °C | 5 … 50 | IPSI (leaf-air temp diff) |
| `leaf_moisture` | % | 0 … 100 | InfectionHours |

### 24-hour aggregates (scalars, not arrays)

These are injected directly as numbers (not `[{value}]` arrays) in production.
In test data, set them the same way — as a number or omit them.

| Key | Unit | How to compute for test data |
|-----|------|------------------------------|
| `air_temperature_avg` | °C | Average of the day's hourly temps |
| `air_temperature_max` | °C | Hottest hour of the day |
| `air_temperature_min` | °C | Coldest hour of the day |
| `light_intensity_sum` | lux·h | Rough daily sum (clear summer day ≈ 480 000) |

### Previous indicators from `prevBundle`

These are accumulated totals carried forward from the last `field_bundle`.
In production they are injected by `injectPrevIndicators()`. In tests, set them directly.

```js
// GDD accumulated since season start (one entry per relevant pest)
gdd_accumulated_bactrocera_oleae: [{ value: 380 }],
gdd_accumulated_prays_oleae:      [{ value: 510 }],

// Infection hours since last reset
infection_hours_counter_botrytis_cinerea: [{ value: 12 }],

// Running IPSI average (used by BPI to smooth stress signal)
ipsi_running_avg:   [{ value: 5.0 }],
ipsi_running_count: [{ value: 23 }],
```

Set accumulated GDD to `0` to simulate the start of the season.
Set accumulated GDD high to simulate late-season pest pressure.

---

## `ticks` — what runs when

| Indicator | Requires `hourTich` | Requires `dailyTich` |
|-----------|---------------------|----------------------|
| VPD | ✓ | |
| IPSI | ✓ | |
| GDD hourly increment | ✓ | |
| GDD daily accumulation | | ✓ |
| InfectionHours | ✓ | |
| BPI | | ✓ |
| FIR | | ✓ |
| IrrigationVolume | ✓ | |

Set `hourTich: false` to test that VPD/IPSI/GDD are skipped (returns nulls).
Set `dailyTich: true` to also run BPI and FIR in the same scenario.

---

## `assertions`

Each assertion is an object `{ description, check }`.
`check(result)` receives the full result object and must return `true` to pass.

```js
assertions: [
  {
    description: 'VPD is > 2.0 kPa',
    check: (r) => {
      const val = r.vpd?.find(x => x.variable === 'vpd')?.value;
      return Number.isFinite(val) && val > 2.0;
    },
  },
]
```

### Result object shape

```js
{
  vpd:             [{variable: 'vpd', value: number}],
  vpdError:        string,           // '' if no error

  ipsi:            [{variable: 'ipsi', value: number}],
  ipsiError:       string,

  bpi:             [{variable: 'bpi', value: number}],
  bpiIndicators:   array,
  bpiContext:      object,
  bpiError:        string,

  gdd:             [{variable: 'gdd_hourly_*' | 'gdd_daily_*' | 'gdd_accumulated_*', value: number}, ...],
  infectionHours:  [{variable: 'infection_hours_counter_*', value: number}, ...],
  fir:             [{variable: 'fir_*', value: number (0..1)}, ...],
  irrigationVolume:[{variable: 'grossIrrigationLiters', value: number},
                   {variable: 'irrigationDurationHours', value: number}],
}
```

---

## Representative sensor values by season

| Season | air_temp | air_humidity | soil_moisture1 | Notes |
|--------|----------|--------------|----------------|-------|
| Winter | 5–12 °C | 65–90 % | 35–55 %v/v | High rainfall, low VPD |
| Spring | 15–22 °C | 50–70 % | 28–45 %v/v | Growing season starts |
| Summer | 28–40 °C | 20–45 % | 12–25 %v/v | Max stress, irrigation needed |
| Autumn | 15–25 °C | 45–65 % | 20–40 %v/v | Harvest / ripening |

---

## Common scenarios to cover

| Scenario | Key settings |
|----------|-------------|
| Missing sensor | Omit `air_temperature` from `data` → expect `vpdError` to be non-empty |
| Saturated soil | `soil_moisture1: [{ value: 55 }]` → irrigation = 0 |
| Leaf wetness | `leaf_moisture: [{ value: 90 }]`, `air_humidity: [{ value: 92 }]` → high infection hours |
| Season start | All GDD accumulators = 0 |
| Multi-day accumulation | Set `_prevBundleTime` to yesterday and GDD accumulators to mid-season values |
| dailyTich only | `hourTich: false, dailyTich: true` → BPI/FIR computed, VPD skipped |
