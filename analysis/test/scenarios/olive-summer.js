/**
 * Scenario: Olive (Koroneiki) — hot dry Mediterranean summer day
 *
 * Represents a fruit development day in July:
 *   - High temperature, low humidity → high VPD
 *   - Soil moisture below the refill point on a heavy soil → real deficit
 *   - No rainfall, no leaf wetness → low fungal infection risk
 *   - Bactrocera oleae GDD partially accumulated (active season)
 *
 * Expected outcomes:
 *   - VPD > 2.0 kPa  (hot dry air)
 *   - IPSI in moderate-high stress range (≈6.4 on clay at 23% v/v)
 *   - No VPD/IPSI error (all required sensors present)
 *   - Positive irrigation recommendation
 *   - Low FIR for fungal pathogens (dry conditions)
 */

module.exports = {
  name: 'Olive (Koroneiki) — hot dry summer',
  description: 'July fruit development day. High VPD, low soil moisture, no leaf wetness.',

  // Which ticks fire for this scenario.
  // hourTich=true  → VPD, IPSI, GDD hourly, InfectionHours
  // dailyTich=true → BPI, GDD daily accumulation, FIR
  ticks: {
    hourTich: true,
    dailyTich: true,
  },

  // crop parameters — mirrors what getFieldParameters() returns in production
  cropParams: {
    cultivation_type_general: 'olive',
    cultivation_type: 'koroneiki',
    stage: 'fruit_dev',
    area: 10000,           // 1 hectare in m²
    // [CLEANFIX 2026-07-02] batch-2 (PATCH_31) uses real soil hydraulics from SOIL_PROFILE.
    // Declare soil_type so the deficit is meaningful (heavy soil: FC36/WP22, refill≈25 %v/v),
    // plus water_quality + irrigation_system so a real irrigation volume can be computed.
    soil_type: 'calcareous_clay',
    water_quality: 'good',
    irrigation_system: 'dripIrrigation',
    plantation_year: 2015,
    season: 'summer',
  },

  // measurements object — mirrors getMeasurements() output shape
  // Each sensor variable is an array of TagoIO data points: [{ value: number }]
  // Scalar keys (e.g. air_temperature_avg) are 24-hour aggregates injected directly.
  // See analysis/TEST_DATA_GUIDE.md for the full field reference.
  measurements: {
    timezone: 'Europe/Athens',
    now: new Date('2025-07-15T12:00:00Z'),        // midday UTC = 15:00 local
    _prevBundleTime: '2025-07-14T12:00:00Z',      // last bundle was 24 h ago

    data: {
      // ── Atmospheric sensors (s2120 / em300_th) ──────────────────────────
      air_temperature:  [{ value: 35.0 }],        // °C
      air_humidity:     [{ value: 28.0 }],        // % RH  (very dry)
      dew_point:        [{ value: 11.5 }],        // °C
      light_intensity:  [{ value: 58000 }],       // lux (bright midday sun)
      rain_height:      [{ value: 0.0 }],         // mm (no rain)

      // ── Soil sensors (se0x / lse02 depth 1) ─────────────────────────────
      soil_moisture1:   [{ value: 23.0 }],        // %v/v  (clay FC36/WP22, refill≈25 → real deficit → IPSI≈6.4)
      soil_temperature1:[{ value: 29.0 }],        // °C

      // ── Leaf sensor (lms01_ls) ───────────────────────────────────────────
      leaf_temperature: [{ value: 38.0 }],        // °C  (leaf warmer than air = stress)
      leaf_moisture:    [{ value: 0.0 }],         // % (dry leaves → low fungal risk)

      // ── 24-hour aggregates (injected by getMeasurements from device.getData) ──
      air_temperature_avg: 30.0,
      air_temperature_max: 38.0,
      air_temperature_min: 22.0,
      light_intensity_sum: 480000,                // lux·hours over 24 h

      // ── Previous indicators (injected from prevBundle by injectPrevIndicators) ─
      // These are accumulated totals carried forward from the previous bundle.
      gdd_accumulated_bactrocera_oleae: [{ value: 380 }],
      gdd_accumulated_prays_oleae:      [{ value: 510 }],
      gdd_accumulated_palpita_unionalis:[{ value: 220 }],

      infection_hours_counter_botrytis_cinerea:     [{ value: 0 }],
      infection_hours_counter_taphrina_deformans:   [{ value: 0 }],

      // Running IPSI avg (used by BPI instead of instantaneous IPSI when available)
      ipsi_running_avg:   [{ value: 6.5 }],
      ipsi_running_count: [{ value: 23 }],
    },
  },

  // ── Assertions ──────────────────────────────────────────────────────────────
  // Each assertion receives the full result object (see TESTING.md for shape).
  // Return true = pass, false/throw = fail.
  assertions: [
    {
      description: 'VPD is present and > 2.0 kPa (hot dry air)',
      check: (r) => {
        const val = r.vpd?.find(x => x.variable === 'vpd')?.value;
        return Number.isFinite(val) && val > 2.0;
      },
    },
    {
      description: 'No VPD sensor error (air_temperature and air_humidity present)',
      check: (r) => !r.vpdError,
    },
    {
      description: 'IPSI is in moderate-to-high stress range (3–9)',
      check: (r) => {
        const val = r.ipsi?.find(x => x.variable === 'ipsi')?.value;
        return Number.isFinite(val) && val >= 3 && val <= 9;
      },
    },
    {
      description: 'No IPSI sensor error',
      check: (r) => !r.ipsiError,
    },
    {
      description: 'Irrigation recommendation is positive (soil below field capacity)',
      check: (r) => {
        const val = r.irrigationVolume?.find(x => x.variable === 'grossIrrigationLiters')?.value;
        return Number.isFinite(val) && val > 0;
      },
    },
    {
      description: 'GDD daily increment for bactrocera_oleae is positive (active season temp)',
      check: (r) => {
        const val = r.gdd?.find(x => x.variable === 'gdd_daily_bactrocera_oleae')?.value;
        return Number.isFinite(val) && val > 0;
      },
    },
    {
      description: 'FIR for botrytis_cinerea is low (dry conditions, no leaf wetness)',
      check: (r) => {
        const val = r.fir?.find(x => x.variable === 'fir_botrytis_cinerea')?.value;
        // If FIR is not computed for this crop/pathogen combination it may be absent — that is also acceptable
        return val === undefined || val < 0.3;
      },
    },
  ],
};
