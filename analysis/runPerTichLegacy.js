const { Analysis, Resources, Utils, Account, Device, Services } = require("@tago-io/sdk");
var import_sdk = require("@tago-io/sdk");
const moment = require('moment-timezone');
const axios = require('axios');
const zlib = require('zlib');

// Global variable name for packed field telemetry (used for both write + history reads)
const FIELD_BUNDLE_VAR = "field_bundle";

// --- field_bundle compression helpers ---
function compressFieldBundle(obj) {
  const json = JSON.stringify(obj);
  const compressed = zlib.deflateRawSync(Buffer.from(json, 'utf8'));
  return compressed.toString('base64');
}
function decompressFieldBundle(b64) {
  const buf = Buffer.from(b64, 'base64');
  const decompressed = zlib.inflateRawSync(buf);
  return JSON.parse(decompressed.toString('utf8'));
}

/**
 * AccuWeather helpers (5-day forecast)
 */
function tagoObj(objectItem, series, prefix = "") {
  return Object.entries(objectItem).map(([key, value]) => {
    if (typeof value === "object") {
      return {
        variable: (value.variable || `${prefix}${key}`).toLowerCase(),
        value: value.value,
        serie: value.serie || series,
        metadata: value.metadata,
        location: value.location,
        unit: value.unit,
      };
    } else {
      return {
        variable: `${prefix}${key}`.toLowerCase(),
        value: value,
        serie: series,
      };
    }
  });
}

function getAttribute(dataJson = {}, param) {
  return param.split('.').reduce((acc, key) => (acc && acc[key] != null) ? acc[key] : null, dataJson);
}

let account;
let allUsers;

var contexttoken;
var analysisTitle = 'runPerTich';

 process.on('uncaughtException', err => {
     console.log(`Uncaught Exception: ${err.message}`);
     const notificationService = new Services({ token: contexttoken }).Notification;
     notificationService.send({
       title: `${analysisTitle} - Error in Analysis`,
       message: `${analysisTitle} - Error: ${err.message}`
     }).then(console.log).catch(console.log);
  });

const DEVICE_TYPE_VARIABLES = {
  // examples
  s2120: [
    "wind_chill",
    "thw_indexc",
    "heat_index",
    "dew_point",
    "barometric_pressure_hpa",
    "rain_height",
    "wind_direction_sensor",
    "wind_speed_kmh",
    "uv_index",
    "light_intensity",
    "air_temperature",
    "air_humidity"
  ],
  se0x: ["conduct_soil1", "soil_moisture1", "soil_temperature1", "conduct_soil2", "soil_moisture2", "soil_temperature2"],
  lse02: ["conduct_soil1", "soil_moisture1", "soil_temperature1", "conduct_soil2", "soil_moisture2", "soil_temperature2"],
  lse01: ["conduct_soil", "soil_moisture", "temp_soil"],
  // Single-sensor soil probe pinned to one depth via its `type` tag (set by the create/update-field
  // form). The device keeps its default parser (emits bare soil_moisture/temp_soil/conduct_soil);
  // the read loop below remaps those to the _1 (shallow) / _2 (deep) slot and re-publishes them.
  lse01_shallow: ["conduct_soil1", "soil_moisture1", "soil_temperature1"],
  lse01_deep: ["conduct_soil2", "soil_moisture2", "soil_temperature2"],
  lms01_ls: ["leaf_temperature", "leaf_moisture"],
  em300_th: ["humidity", "dew_point", "temperature"],
  em320_th: ["humidity", "dew_point", "temperature"],
  field: [
    "gdd_daily_bactrocera_oleae",
    "gdd_accumulated_bactrocera_oleae",

    "gdd_daily_prays_oleae",
    "gdd_accumulated_prays_oleae",

    "gdd_daily_palpita_unionalis",
    "gdd_accumulated_palpita_unionalis",

    "gdd_daily_tuta_absoluta",
    "gdd_accumulated_tuta_absoluta",

    "gdd_daily_myzus_persicae",
    "gdd_accumulated_myzus_persicae",

    "gdd_daily_ceratitis_capitata",
    "gdd_accumulated_ceratitis_capitata",

    "gdd_daily_bemisia_tabaci",
    "gdd_accumulated_bemisia_tabaci",

    "gdd_daily_tetranychus_urticae",
    "gdd_accumulated_tetranychus_urticae",

    "infection_hours_counter_plasmopara_viticola",
    "infection_hours_counter_erysiphe_necator",
    "infection_hours_counter_phytophthora_infestans",
    "infection_hours_counter_botrytis_cinerea",
    "infection_hours_counter_venturia_inaequalis",
    "infection_hours_counter_taphrina_deformans",
    "infection_hours_counter_colletotrichum_oleae",
    "infection_hours_counter_spilocaea_oleagina",
    "infection_hours_counter_alternaria_solani",
    "gdd_crop_hourly",
    "gdd_crop_accumulated",
  ]
  // add more types here
};

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////          PROFILES            //////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

const CROP_PROFILE = {
  olive: {
    koroneiki: {
      light_use_efficiency_curve: {
        vegetative: 0.016,
        flowering: 0.019,
        fruit_dev: 0.021,
        ripening: 0.016
      },
      nutrient_demand_curves: {
        N: {
          max_rate_kg_ha_day: 0.4,
          stages: {
            vegetative: 0.8,
            flowering: 0.9,
            fruit_dev: 1.0,
            ripening: 0.6
          }
        },
        P: {
          max_rate_kg_ha_day: 0.08,
          stages: {
            vegetative: 1.0,
            flowering: 1.0,
            fruit_dev: 0.9,
            ripening: 0.5
          }
        },
        K: {
          max_rate_kg_ha_day: 0.6,
          stages: {
            vegetative: 0.7,
            flowering: 0.9,
            fruit_dev: 1.0,
            ripening: 0.8
          }
        }
      },
      optimal_temp_range: { min: 7, peak: 25, max: 35 },
      optimal_moisture_range: { lower_bound: 22, upper_bound: 42 },
      M_field_capacity: 42,
      wilting_point: 10,
      root_depth_curve: { initial: 300, vegetative: 800, full_canopy: 1500 },
      max_tolerance_ECe: 4.5,
      kc_curve: { vegetative: 0.55, flowering: 0.60, fruit_dev: 0.65, ripening: 0.60 },
      harvest_index: 0.18,
      stage_gdd_thresholds: { vegetative: 0, flowering: 50, fruit_dev: 480, ripening: 1865 }
    }
  },

  vineCrops: {
    wine_grapes: {
      light_use_efficiency_curve: { transplant: 0.018, vegetative: 0.028, flowering: 0.038, fruiting: 0.028 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.35, stages: { transplant: 0.8, vegetative: 1.0, flowering: 0.5, fruiting: 0.3 } },
        P: { max_rate_kg_ha_day: 0.07, stages: { transplant: 0.9, vegetative: 1.0, flowering: 0.6, fruiting: 0.4 } },
        K: { max_rate_kg_ha_day: 0.55, stages: { transplant: 0.4, vegetative: 0.6, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 25, max: 35 },
      optimal_moisture_range: { lower_bound: 25, upper_bound: 45 },
      M_field_capacity: 45,
      wilting_point: 12,
      root_depth_curve: { initial: 300, vegetative: 700, full_canopy: 1200 },
      max_tolerance_ECe: 1.2,
      kc_curve: { transplant: 0.30, vegetative: 0.60, flowering: 0.70, fruiting: 0.45 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 435, flowering: 1660, fruiting: 2165 }
    },
    table_grapes: {
      light_use_efficiency_curve: { transplant: 0.022, vegetative: 0.032, flowering: 0.035, fruiting: 0.030 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.6, stages: { transplant: 0.9, vegetative: 1.0, flowering: 0.7, fruiting: 0.5 } },
        P: { max_rate_kg_ha_day: 0.12, stages: { transplant: 0.9, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        K: { max_rate_kg_ha_day: 0.8, stages: { transplant: 0.5, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 26, max: 35 },
      optimal_moisture_range: { lower_bound: 40, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 18,
      root_depth_curve: { initial: 200, vegetative: 500, full_canopy: 800 },
      max_tolerance_ECe: 2.0,
      kc_curve: { transplant: 0.30, vegetative: 0.65, flowering: 0.75, fruiting: 0.55 },
      harvest_index: 0.65,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 200, flowering: 1200, fruiting: 1800 }
    },
    raisin_grapes: {
      light_use_efficiency_curve: { transplant: 0.020, vegetative: 0.030, flowering: 0.040, fruiting: 0.032 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.45, stages: { transplant: 0.8, vegetative: 1.0, flowering: 0.6, fruiting: 0.4 } },
        P: { max_rate_kg_ha_day: 0.09, stages: { transplant: 0.9, vegetative: 1.0, flowering: 0.7, fruiting: 0.5 } },
        K: { max_rate_kg_ha_day: 0.7, stages: { transplant: 0.4, vegetative: 0.6, flowering: 1.0, fruiting: 1.0 } }
      },
      optimal_temp_range: { min: 10, peak: 25, max: 35 },
      optimal_moisture_range: { lower_bound: 30, upper_bound: 50 },
      M_field_capacity: 50,
      wilting_point: 15,
      root_depth_curve: { initial: 250, vegetative: 550, full_canopy: 900 },
      max_tolerance_ECe: 1.8,
      kc_curve: { transplant: 0.30, vegetative: 0.60, flowering: 0.70, fruiting: 0.50 },
      harvest_index: 0.6,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 430, flowering: 1600, fruiting: 2100 }
    }
  },

  cerealCrops: {
    wheat: {
      light_use_efficiency_curve: { germination: 0.015, tillering: 0.035, stem_elongation: 0.042, anthesis: 0.045, grain_filling: 0.038 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 4.0, stages: { germination: 0.3, tillering: 0.8, stem_elongation: 1.0, anthesis: 0.7, grain_filling: 0.5 } },
        P: { max_rate_kg_ha_day: 0.8, stages: { germination: 0.7, tillering: 1.0, stem_elongation: 0.8, anthesis: 0.6, grain_filling: 0.4 } },
        K: { max_rate_kg_ha_day: 2.5, stages: { germination: 0.4, tillering: 0.7, stem_elongation: 1.0, anthesis: 0.8, grain_filling: 0.6 } }
      },
      optimal_temp_range: { min: 0, peak: 20, max: 35 },
      optimal_moisture_range: { lower_bound: 35, upper_bound: 55 },
      M_field_capacity: 55,
      wilting_point: 15,
      root_depth_curve: { initial: 100, vegetative: 600, full_canopy: 1200 },
      max_tolerance_ECe: 6.0,
      kc_curve: { germination: 0.30, tillering: 0.70, stem_elongation: 1.15, anthesis: 1.15, grain_filling: 0.40 },
      harvest_index: 0.45,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, tillering: 395, stem_elongation: 840, anthesis: 1280, grain_filling: 1645 }
    },
    barley: {
      light_use_efficiency_curve: { germination: 0.018, tillering: 0.038, stem_elongation: 0.044, anthesis: 0.046, grain_filling: 0.040 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.2, stages: { germination: 0.4, tillering: 0.9, stem_elongation: 1.0, anthesis: 0.6, grain_filling: 0.4 } },
        P: { max_rate_kg_ha_day: 0.7, stages: { germination: 0.8, tillering: 1.0, stem_elongation: 0.7, anthesis: 0.5, grain_filling: 0.3 } },
        K: { max_rate_kg_ha_day: 2.2, stages: { germination: 0.5, tillering: 0.8, stem_elongation: 1.0, anthesis: 0.7, grain_filling: 0.5 } }
      },
      optimal_temp_range: { min: 0, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 30, upper_bound: 50 },
      M_field_capacity: 50,
      wilting_point: 12,
      root_depth_curve: { initial: 100, vegetative: 550, full_canopy: 1100 },
      max_tolerance_ECe: 8.0,
      kc_curve: { germination: 0.30, tillering: 0.70, stem_elongation: 1.15, anthesis: 1.10, grain_filling: 0.35 },
      harvest_index: 0.5,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, tillering: 290, stem_elongation: 745, anthesis: 1090, grain_filling: 1450 }
    },
    maize: {
      light_use_efficiency_curve: { germination: 0.025, vegetative: 0.055, tasseling: 0.065, grain_filling: 0.055 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 6.0, stages: { germination: 0.3, vegetative: 1.0, tasseling: 0.9, grain_filling: 0.6 } },
        P: { max_rate_kg_ha_day: 1.2, stages: { germination: 0.6, vegetative: 1.0, tasseling: 0.8, grain_filling: 0.5 } },
        K: { max_rate_kg_ha_day: 4.5, stages: { germination: 0.4, vegetative: 0.8, tasseling: 1.0, grain_filling: 0.7 } }
      },
      optimal_temp_range: { min: 10, peak: 30, max: 32 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 20,
      root_depth_curve: { initial: 150, vegetative: 800, full_canopy: 1500 },
      max_tolerance_ECe: 1.7,
      kc_curve: { germination: 0.30, vegetative: 0.70, tasseling: 1.20, grain_filling: 0.60 },
      harvest_index: 0.48,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 200, tasseling: 580, grain_filling: 1080 }
    },
    oats: {
      light_use_efficiency_curve: { germination: 0.016, tillering: 0.034, stem_elongation: 0.040, anthesis: 0.042, grain_filling: 0.036 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.8, stages: { germination: 0.4, tillering: 0.9, stem_elongation: 1.0, anthesis: 0.6, grain_filling: 0.4 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { germination: 0.7, tillering: 1.0, stem_elongation: 0.7, anthesis: 0.5, grain_filling: 0.3 } },
        K: { max_rate_kg_ha_day: 2.0, stages: { germination: 0.5, tillering: 0.8, stem_elongation: 1.0, anthesis: 0.7, grain_filling: 0.5 } }
      },
      optimal_temp_range: { min: 0, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 40, upper_bound: 60 },
      M_field_capacity: 60,
      wilting_point: 18,
      root_depth_curve: { initial: 100, vegetative: 500, full_canopy: 1000 },
      max_tolerance_ECe: 4.0,
      kc_curve: { germination: 0.30, tillering: 0.70, stem_elongation: 1.10, anthesis: 1.10, grain_filling: 0.35 },
      harvest_index: 0.42,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, tillering: 330, stem_elongation: 700, anthesis: 1050, grain_filling: 1400 }
    }
  },

  citrusFruits: {
    orange: {
      light_use_efficiency_curve: { vegetative: 0.020, flowering: 0.025, fruit_set: 0.028, fruit_dev: 0.025 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.2, stages: { vegetative: 1.0, flowering: 0.9, fruit_set: 0.8, fruit_dev: 0.7 } },
        P: { max_rate_kg_ha_day: 0.2, stages: { vegetative: 0.8, flowering: 1.0, fruit_set: 1.0, fruit_dev: 0.8 } },
        K: { max_rate_kg_ha_day: 1.5, stages: { vegetative: 0.6, flowering: 0.7, fruit_set: 0.9, fruit_dev: 1.0 } }
      },
      optimal_temp_range: { min: 13, peak: 25, max: 30 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 25,
      root_depth_curve: { initial: 200, vegetative: 600, full_canopy: 1000 },
      max_tolerance_ECe: 1.7, // FAO-29 Table 4: Citrus sinensis threshold
      kc_curve: { vegetative: 0.65, flowering: 0.60, fruit_set: 0.65, fruit_dev: 0.65 },
      harvest_index: 0.4,  // D4: FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 35, fruit_set: 255, fruit_dev: 1835 }
    },
    lemon: {
      light_use_efficiency_curve: { vegetative: 0.022, flowering: 0.027, fruit_set: 0.030, fruit_dev: 0.027 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.4, stages: { vegetative: 1.0, flowering: 0.9, fruit_set: 0.8, fruit_dev: 0.7 } },
        P: { max_rate_kg_ha_day: 0.25, stages: { vegetative: 0.8, flowering: 1.0, fruit_set: 1.0, fruit_dev: 0.8 } },
        K: { max_rate_kg_ha_day: 1.8, stages: { vegetative: 0.6, flowering: 0.7, fruit_set: 0.9, fruit_dev: 1.0 } }
      },
      optimal_temp_range: { min: 13, peak: 24, max: 30 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 28,
      root_depth_curve: { initial: 200, vegetative: 550, full_canopy: 900 },
      max_tolerance_ECe: 1.7,  // FAO-29: Citrus limon threshold
      kc_curve: { vegetative: 0.65, flowering: 0.60, fruit_set: 0.65, fruit_dev: 0.65 },
      harvest_index: 0.35,  // D4: FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 30, fruit_set: 250, fruit_dev: 1800 }
    },
    mandarin: {
      light_use_efficiency_curve: { vegetative: 0.019, flowering: 0.024, fruit_set: 0.027, fruit_dev: 0.024 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.0, stages: { vegetative: 1.0, flowering: 0.9, fruit_set: 0.8, fruit_dev: 0.7 } },
        P: { max_rate_kg_ha_day: 0.18, stages: { vegetative: 0.8, flowering: 1.0, fruit_set: 1.0, fruit_dev: 0.8 } },
        K: { max_rate_kg_ha_day: 1.3, stages: { vegetative: 0.6, flowering: 0.7, fruit_set: 0.9, fruit_dev: 1.0 } }
      },
      optimal_temp_range: { min: 13, peak: 25, max: 30 },
      optimal_moisture_range: { lower_bound: 40, upper_bound: 60 },
      M_field_capacity: 60,
      wilting_point: 22,
      root_depth_curve: { initial: 200, vegetative: 580, full_canopy: 950 },
      max_tolerance_ECe: 1.7,
      kc_curve: { vegetative: 0.65, flowering: 0.60, fruit_set: 0.65, fruit_dev: 0.65 },
      harvest_index: 0.4,  // D4: FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 35, fruit_set: 260, fruit_dev: 1850 }
    }
  },

  stoneFruits: {
    peach: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.025, flowering: 0.030, fruit_dev: 0.035, harvest: 0.028 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.8, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.3, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 2.2, stages: { budbreak: 0.5, flowering: 0.7, fruit_dev: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 7, peak: 24, max: 35 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 25,
      root_depth_curve: { initial: 200, vegetative: 700, full_canopy: 1200 },
      max_tolerance_ECe: 1.7,
      kc_curve: { dormancy: 0.20, bloom: 0.45, vegetative: 0.80, fruit_dev: 0.90, harvest: 0.65 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 200, vegetative: 500, fruit_dev: 1500, harvest: 2200 }
    },
    nectarine: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.026, flowering: 0.031, fruit_dev: 0.036, harvest: 0.029 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.9, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.32, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 2.4, stages: { budbreak: 0.5, flowering: 0.7, fruit_dev: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 7, peak: 24, max: 35 },
      optimal_moisture_range: { lower_bound: 52, upper_bound: 72 },
      M_field_capacity: 72,
      wilting_point: 26,
      root_depth_curve: { initial: 200, vegetative: 700, full_canopy: 1200 },
      max_tolerance_ECe: 1.6,
      kc_curve: { dormancy: 0.20, bloom: 0.45, vegetative: 0.80, fruit_dev: 0.90, harvest: 0.65 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 200, vegetative: 500, fruit_dev: 1450, harvest: 2100 }
    },
    apricot: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.023, flowering: 0.028, fruit_dev: 0.032, harvest: 0.026 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.5, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.25, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 1.8, stages: { budbreak: 0.5, flowering: 0.7, fruit_dev: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 7, peak: 23, max: 25 },
      optimal_moisture_range: { lower_bound: 40, upper_bound: 60 },
      M_field_capacity: 60,
      wilting_point: 20,
      root_depth_curve: { initial: 200, vegetative: 650, full_canopy: 1100 },
      max_tolerance_ECe: 2.0,
      kc_curve: { dormancy: 0.20, bloom: 0.45, vegetative: 0.80, fruit_dev: 0.85, harvest: 0.60 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 180, vegetative: 450, fruit_dev: 1200, harvest: 1800 }
    },
    plum: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.024, flowering: 0.029, fruit_dev: 0.033, harvest: 0.027 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.6, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.28, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 2.0, stages: { budbreak: 0.5, flowering: 0.7, fruit_dev: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 25 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 22,
      root_depth_curve: { initial: 200, vegetative: 680, full_canopy: 1150 },
      max_tolerance_ECe: 1.9,
      kc_curve: { dormancy: 0.20, bloom: 0.45, vegetative: 0.80, fruit_dev: 0.90, harvest: 0.65 },
      harvest_index: 0.5,  // FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 220, vegetative: 550, fruit_dev: 1600, harvest: 2300 }
    },
    cherry: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.022, flowering: 0.027, fruit_dev: 0.031, harvest: 0.025 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.4, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.24, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 1.7, stages: { budbreak: 0.5, flowering: 0.7, fruit_dev: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 24,
      root_depth_curve: { initial: 200, vegetative: 600, full_canopy: 1000 },
      max_tolerance_ECe: 1.4,
      kc_curve: { dormancy: 0.20, bloom: 0.45, vegetative: 0.80, fruit_dev: 0.85, harvest: 0.60 },
      harvest_index: 0.4,  // FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 180, vegetative: 400, fruit_dev: 1100, harvest: 1600 }
    }
  },

  pomeFruits: {
    apple: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.020, flowering: 0.025, fruit_dev: 0.030, harvest: 0.024 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.3, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.7, harvest: 0.5 } },
        P: { max_rate_kg_ha_day: 0.22, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 1.6, stages: { budbreak: 0.4, flowering: 0.6, fruit_dev: 1.0, harvest: 0.8 } }
      },
      optimal_temp_range: { min: 4, peak: 21, max: 35 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 20,
      root_depth_curve: { initial: 200, vegetative: 800, full_canopy: 1400 },
      max_tolerance_ECe: 1.8,
      kc_curve: { dormancy: 0.20, bloom: 0.45, vegetative: 0.80, fruit_dev: 0.95, harvest: 0.70 },
      harvest_index: 0.55,  // FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 230, vegetative: 580, fruit_dev: 1800, harvest: 2500 }
    }
  },

  subTropicalFruits: {
    kiwi: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.028, flowering: 0.035, fruit_dev: 0.040, harvest: 0.032 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.5, stages: { budbreak: 1.0, flowering: 0.9, fruit_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.4, stages: { budbreak: 0.9, flowering: 1.0, fruit_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 3.0, stages: { budbreak: 0.5, flowering: 0.7, fruit_dev: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 6, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 60, upper_bound: 80 },
      M_field_capacity: 60, // C1 FIX: was 80
      wilting_point: 22, // C1 FIX: was 35. Rawls 1982
      root_depth_curve: { initial: 150, vegetative: 400, full_canopy: 700 },
      max_tolerance_ECe: 1.2,
      kc_curve: { vegetative: 0.40, flowering: 0.80, fruit_dev: 1.05, harvest: 0.70 },
      harvest_index: 0.5,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 500, fruit_dev: 1200, harvest: 2200 }
    },
    pomegranate: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.018, flowering: 0.022, fruit_dev: 0.025, harvest: 0.020 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.8, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.7, harvest: 0.5 } },
        P: { max_rate_kg_ha_day: 0.15, stages: { budbreak: 0.8, flowering: 1.0, fruit_dev: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 1.0, stages: { budbreak: 0.4, flowering: 0.6, fruit_dev: 1.0, harvest: 0.8 } }
      },
      optimal_temp_range: { min: 10, peak: 28, max: 35 },
      optimal_moisture_range: { lower_bound: 25, upper_bound: 45 },
      M_field_capacity: 45,
      wilting_point: 15,
      root_depth_curve: { initial: 200, vegetative: 600, full_canopy: 1200 },
      max_tolerance_ECe: 3.5,
      kc_curve: { vegetative: 0.45, flowering: 0.65, fruit_dev: 0.80, harvest: 0.60 },
      harvest_index: 0.45,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 400, fruit_dev: 1200, harvest: 2400 }
    },
    fig: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.016, fruit_dev1: 0.020, fruit_dev2: 0.022, harvest: 0.018 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.7, stages: { budbreak: 0.9, fruit_dev1: 1.0, fruit_dev2: 0.8, harvest: 0.5 } },
        P: { max_rate_kg_ha_day: 0.12, stages: { budbreak: 0.8, fruit_dev1: 1.0, fruit_dev2: 0.9, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 0.9, stages: { budbreak: 0.4, fruit_dev1: 0.8, fruit_dev2: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 7, peak: 27, max: 35 },
      optimal_moisture_range: { lower_bound: 30, upper_bound: 50 },
      M_field_capacity: 50,
      wilting_point: 18,
      root_depth_curve: { initial: 200, vegetative: 500, full_canopy: 1000 },
      max_tolerance_ECe: 2.8,
      kc_curve: { vegetative: 0.40, flowering: 0.60, fruit_dev: 0.75, harvest: 0.50 },
      harvest_index: 0.4,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 350, fruit_dev: 900, harvest: 1800 }
    }
  },

  nutCrops: {
    almond: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.017, flowering: 0.021, nut_dev: 0.024, harvest: 0.019 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.0, stages: { budbreak: 0.9, flowering: 1.0, nut_dev: 0.7, harvest: 0.5 } },
        P: { max_rate_kg_ha_day: 0.18, stages: { budbreak: 0.8, flowering: 1.0, nut_dev: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 1.2, stages: { budbreak: 0.4, flowering: 0.6, nut_dev: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 5, peak: 25, max: 35 },
      optimal_moisture_range: { lower_bound: 25, upper_bound: 45 },
      M_field_capacity: 45,
      wilting_point: 12,
      root_depth_curve: { initial: 250, vegetative: 800, full_canopy: 1500 },
      max_tolerance_ECe: 2.8,
      kc_curve: { dormancy: 0.20, bloom: 0.40, vegetative: 0.70, fruit_dev: 0.90, harvest: 0.65 },
      harvest_index: 0.25,  // D4: FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 250, vegetative: 550, fruit_dev: 2810, harvest: 3625 }
    },
    pistachio: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.015, flowering: 0.018, nut_dev: 0.021, harvest: 0.017 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.8, stages: { budbreak: 0.8, flowering: 1.0, nut_dev: 0.6, harvest: 0.4 } },
        P: { max_rate_kg_ha_day: 0.14, stages: { budbreak: 0.8, flowering: 1.0, nut_dev: 0.7, harvest: 0.5 } },
        K: { max_rate_kg_ha_day: 1.0, stages: { budbreak: 0.4, flowering: 0.6, nut_dev: 1.0, harvest: 0.6 } }
      },
      optimal_temp_range: { min: 9, peak: 28, max: 35 },
      optimal_moisture_range: { lower_bound: 20, upper_bound: 40 },
      M_field_capacity: 40,
      wilting_point: 8,
      root_depth_curve: { initial: 300, vegetative: 1000, full_canopy: 2000 },
      max_tolerance_ECe: 4.2,
      kc_curve: { dormancy: 0.20, bloom: 0.40, vegetative: 0.70, fruit_dev: 0.85, harvest: 0.55 },
      harvest_index: 0.25,  // D4: FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 280, vegetative: 600, fruit_dev: 2500, harvest: 3200 }
    },
    walnut: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.019, flowering: 0.023, nut_dev: 0.026, harvest: 0.021 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.5, stages: { budbreak: 1.0, flowering: 0.9, nut_dev: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.25, stages: { budbreak: 0.9, flowering: 1.0, nut_dev: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 1.8, stages: { budbreak: 0.5, flowering: 0.7, nut_dev: 1.0, harvest: 0.8 } }
      },
      optimal_temp_range: { min: 5, peak: 24, max: 30 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 28,
      root_depth_curve: { initial: 200, vegetative: 900, full_canopy: 1600 },
      max_tolerance_ECe: 1.5,
      kc_curve: { dormancy: 0.20, bloom: 0.40, vegetative: 0.75, fruit_dev: 0.90, harvest: 0.65 },
      harvest_index: 0.2,  // FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 250, vegetative: 550, fruit_dev: 2000, harvest: 2800 }
    },
    chestnut: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.018, flowering: 0.022, nut_dev: 0.025, harvest: 0.020 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.2, stages: { budbreak: 1.0, flowering: 0.8, nut_dev: 0.7, harvest: 0.5 } },
        P: { max_rate_kg_ha_day: 0.2, stages: { budbreak: 0.9, flowering: 1.0, nut_dev: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 1.4, stages: { budbreak: 0.5, flowering: 0.7, nut_dev: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 30,
      root_depth_curve: { initial: 200, vegetative: 800, full_canopy: 1500 },
      max_tolerance_ECe: 1.0,
      kc_curve: { dormancy: 0.20, bloom: 0.40, vegetative: 0.75, fruit_dev: 0.85, harvest: 0.60 },
      harvest_index: 0.25,  // FAO-66
      stage_gdd_thresholds: { dormancy: 0, bloom: 300, vegetative: 650, fruit_dev: 1800, harvest: 2500 }
    }
  },

  industrialCrops: {
    cotton: {
      light_use_efficiency_curve: { germination: 0.020, squaring: 0.045, flowering: 0.055, boll_dev: 0.050 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 4.5, stages: { germination: 0.4, squaring: 1.0, flowering: 0.8, boll_dev: 0.6 } },
        P: { max_rate_kg_ha_day: 0.9, stages: { germination: 0.6, squaring: 1.0, flowering: 0.9, boll_dev: 0.7 } },
        K: { max_rate_kg_ha_day: 3.5, stages: { germination: 0.4, squaring: 0.7, flowering: 1.0, boll_dev: 0.9 } }
      },
      optimal_temp_range: { min: 13, peak: 28, max: 35 },
      optimal_moisture_range: { lower_bound: 40, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 18,
      root_depth_curve: { initial: 150, vegetative: 600, full_canopy: 1200 },
      max_tolerance_ECe: 7.7,
      kc_curve: { vegetative: 0.35, flowering: 0.75, fruit_dev: 1.15, harvest: 0.70 },
      harvest_index: 0.35,  // D4: FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 600, fruit_dev: 1200, harvest: 1800 }
    },
    tobacco: {
      light_use_efficiency_curve: { transplant: 0.022, vegetative: 0.038, flowering: 0.035, harvest: 0.030 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.5, stages: { transplant: 0.6, vegetative: 1.0, flowering: 0.7, harvest: 0.4 } },
        P: { max_rate_kg_ha_day: 0.7, stages: { transplant: 0.7, vegetative: 1.0, flowering: 0.8, harvest: 0.5 } },
        K: { max_rate_kg_ha_day: 4.2, stages: { transplant: 0.4, vegetative: 0.8, flowering: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 10, peak: 27, max: 35 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 22,
      root_depth_curve: { initial: 100, vegetative: 400, full_canopy: 800 },
      max_tolerance_ECe: 2.0,
      kc_curve: { transplant: 0.35, vegetative: 0.75, flowering: 1.00, harvest: 0.80 },
      harvest_index: 0.35,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 350, flowering: 900, harvest: 1400 }
    },
    sunflower: {
      light_use_efficiency_curve: { germination: 0.018, vegetative: 0.042, flowering: 0.048, seed_fill: 0.045 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.8, stages: { germination: 0.3, vegetative: 1.0, flowering: 0.7, seed_fill: 0.5 } },
        P: { max_rate_kg_ha_day: 0.8, stages: { germination: 0.5, vegetative: 1.0, flowering: 0.8, seed_fill: 0.6 } },
        K: { max_rate_kg_ha_day: 2.8, stages: { germination: 0.4, vegetative: 0.8, flowering: 1.0, seed_fill: 0.7 } }
      },
      optimal_temp_range: { min: 8, peak: 26, max: 30 },
      optimal_moisture_range: { lower_bound: 35, upper_bound: 55 },
      M_field_capacity: 55,
      wilting_point: 16,
      root_depth_curve: { initial: 150, vegetative: 800, full_canopy: 1500 },
      max_tolerance_ECe: 4.0,
      kc_curve: { germination: 0.35, vegetative: 0.75, flowering: 1.10, harvest: 0.35 },
      harvest_index: 0.28,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 350, flowering: 900, harvest: 1500 }
    },
    sugar_beet: {
      light_use_efficiency_curve: { germination: 0.020, vegetative: 0.045, bulking: 0.050, maturity: 0.042 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 4.2, stages: { germination: 0.4, vegetative: 1.0, bulking: 0.8, maturity: 0.5 } },
        P: { max_rate_kg_ha_day: 0.9, stages: { germination: 0.6, vegetative: 1.0, bulking: 0.9, maturity: 0.6 } },
        K: { max_rate_kg_ha_day: 3.8, stages: { germination: 0.3, vegetative: 0.7, bulking: 1.0, maturity: 0.8 } }
      },
      optimal_temp_range: { min: 5, peak: 20, max: 30 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 25,
      root_depth_curve: { initial: 100, vegetative: 600, full_canopy: 1200 },
      max_tolerance_ECe: 7.0,
      kc_curve: { germination: 0.35, vegetative: 0.70, tuberization: 1.20, maturity: 0.70 },
      harvest_index: 0.28,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 400, tuberization: 1000, maturity: 2000 }
    }
  },

  vegetableCrops: {
    onion: {
      light_use_efficiency_curve: { germination: 0.018, vegetative: 0.032, bulbing: 0.038, maturity: 0.028 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.2, stages: { germination: 0.5, vegetative: 1.0, bulbing: 0.7, maturity: 0.4 } },
        P: { max_rate_kg_ha_day: 0.4, stages: { germination: 0.6, vegetative: 1.0, bulbing: 0.8, maturity: 0.5 } },
        K: { max_rate_kg_ha_day: 2.8, stages: { germination: 0.4, vegetative: 0.7, bulbing: 1.0, maturity: 0.6 } }
      },
      optimal_temp_range: { min: 5, peak: 20, max: 35 },
      optimal_moisture_range: { lower_bound: 40, upper_bound: 60 },
      M_field_capacity: 60,
      wilting_point: 18,
      root_depth_curve: { initial: 80, vegetative: 200, full_canopy: 400 },
      max_tolerance_ECe: 1.2,
      kc_curve: { germination: 0.50, vegetative: 0.80, bulbing: 1.05, maturity: 0.75 },
      harvest_index: 0.7,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 460, bulbing: 930, maturity: 1810 }
    },
    watermelon: {
      light_use_efficiency_curve: { germination: 0.026, vegetative: 0.048, flowering: 0.052, fruiting: 0.046 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.8, stages: { germination: 0.4, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { germination: 0.5, vegetative: 1.0, flowering: 0.9, fruiting: 0.8 } },
        K: { max_rate_kg_ha_day: 4.2, stages: { germination: 0.3, vegetative: 0.6, flowering: 0.9, fruiting: 1.0 } }
      },
      optimal_temp_range: { min: 10, peak: 28, max: 35 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 20,
      root_depth_curve: { initial: 100, vegetative: 400, full_canopy: 800 },
      max_tolerance_ECe: 2.2,
      kc_curve: { germination: 0.40, vegetative: 0.75, flowering: 1.00, fruiting: 0.75 },
      harvest_index: 0.6,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 300, flowering: 800, fruiting: 1500 }
    },
    potato: {
      light_use_efficiency_curve: { germination: 0.024, vegetative: 0.042, tuberization: 0.048, maturity: 0.038 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.5, stages: { germination: 0.4, vegetative: 1.0, tuberization: 0.8, maturity: 0.5 } },
        P: { max_rate_kg_ha_day: 0.7, stages: { germination: 0.6, vegetative: 1.0, tuberization: 0.9, maturity: 0.6 } },
        K: { max_rate_kg_ha_day: 4.5, stages: { germination: 0.3, vegetative: 0.6, tuberization: 1.0, maturity: 0.7 } }
      },
      optimal_temp_range: { min: 2, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 22,
      root_depth_curve: { initial: 100, vegetative: 400, full_canopy: 600 },
      max_tolerance_ECe: 1.7,
      kc_curve: { germination: 0.50, vegetative: 0.80, tuberization: 1.15, maturity: 0.75 },
      harvest_index: 0.75,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 260, tuberization: 750, maturity: 1275 }
    },
    dry_beans: {
      light_use_efficiency_curve: { germination: 0.022, vegetative: 0.038, flowering: 0.042, pod_fill: 0.040 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.5, stages: { germination: 0.8, vegetative: 0.6, flowering: 0.4, pod_fill: 0.3 } },
        P: { max_rate_kg_ha_day: 0.5, stages: { germination: 0.7, vegetative: 1.0, flowering: 0.9, pod_fill: 0.8 } },
        K: { max_rate_kg_ha_day: 2.2, stages: { germination: 0.4, vegetative: 0.7, flowering: 1.0, pod_fill: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 24, max: 32 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 20,
      root_depth_curve: { initial: 100, vegetative: 350, full_canopy: 600 },
      max_tolerance_ECe: 1.0,
      kc_curve: { transplant: 0.40, vegetative: 0.70, flowering: 1.10, fruiting: 0.35 },
      harvest_index: 0.75,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 250, flowering: 650, fruiting: 1050 }
    },
    green_beans: {
      light_use_efficiency_curve: { germination: 0.024, vegetative: 0.040, flowering: 0.044, pod_harvest: 0.042 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.0, stages: { germination: 0.8, vegetative: 0.7, flowering: 0.5, pod_harvest: 0.4 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { germination: 0.7, vegetative: 1.0, flowering: 0.9, pod_harvest: 0.8 } },
        K: { max_rate_kg_ha_day: 2.5, stages: { germination: 0.4, vegetative: 0.7, flowering: 1.0, pod_harvest: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 24, max: 32 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 22,
      root_depth_curve: { initial: 100, vegetative: 300, full_canopy: 500 },
      max_tolerance_ECe: 1.0,
      kc_curve: { transplant: 0.40, vegetative: 0.70, flowering: 1.05, fruiting: 0.90 },
      harvest_index: 0.5,  // FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 200, flowering: 550, fruiting: 900 }
    },
    cabbage: {
      light_use_efficiency_curve: { transplant: 0.026, vegetative: 0.044, heading: 0.048, maturity: 0.040 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 4.0, stages: { transplant: 0.5, vegetative: 1.0, heading: 0.8, maturity: 0.5 } },
        P: { max_rate_kg_ha_day: 0.8, stages: { transplant: 0.6, vegetative: 1.0, heading: 0.9, maturity: 0.6 } },
        K: { max_rate_kg_ha_day: 3.2, stages: { transplant: 0.4, vegetative: 0.7, heading: 1.0, maturity: 0.7 } }
      },
      optimal_temp_range: { min: 5, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 28,
      root_depth_curve: { initial: 100, vegetative: 300, full_canopy: 500 },
      max_tolerance_ECe: 1.8,
      kc_curve: { transplant: 0.45, vegetative: 0.75, flowering: 1.05, harvest: 0.90 },
      harvest_index: 0.6,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 350, flowering: 800, harvest: 1200 }
    },
    lettuce: {
      light_use_efficiency_curve: { transplant: 0.028, vegetative: 0.045, heading: 0.048, harvest: 0.042 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.2, stages: { transplant: 0.6, vegetative: 1.0, heading: 0.8, harvest: 0.5 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { transplant: 0.7, vegetative: 1.0, heading: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 2.8, stages: { transplant: 0.5, vegetative: 0.8, heading: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 4, peak: 16, max: 28 },
      optimal_moisture_range: { lower_bound: 60, upper_bound: 80 },
      M_field_capacity: 80,
      wilting_point: 30,
      root_depth_curve: { initial: 80, vegetative: 200, full_canopy: 350 },
      max_tolerance_ECe: 1.3,
      kc_curve: { transplant: 0.45, vegetative: 0.80, flowering: 1.00, harvest: 0.90 },
      harvest_index: 0.8,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 250, flowering: 600, harvest: 850 }
    },
    carrot: {
      light_use_efficiency_curve: { germination: 0.020, vegetative: 0.038, root_dev: 0.042, maturity: 0.035 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.5, stages: { germination: 0.5, vegetative: 1.0, root_dev: 0.7, maturity: 0.4 } },
        P: { max_rate_kg_ha_day: 0.5, stages: { germination: 0.6, vegetative: 1.0, root_dev: 0.9, maturity: 0.6 } },
        K: { max_rate_kg_ha_day: 2.8, stages: { germination: 0.3, vegetative: 0.6, root_dev: 1.0, maturity: 0.7 } }
      },
      optimal_temp_range: { min: 6, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 22,
      root_depth_curve: { initial: 100, vegetative: 400, full_canopy: 600 },
      max_tolerance_ECe: 1.0,
      kc_curve: { germination: 0.45, vegetative: 0.75, flowering: 1.05, maturity: 0.80 },
      harvest_index: 0.65,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 350, flowering: 900, maturity: 1400 }
    },

    /* ---- New additions below ---- */

    cucumber: {
      light_use_efficiency_curve: { germination: 0.024, vegetative: 0.046, flowering: 0.052, fruiting: 0.048 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.0, stages: { germination: 0.5, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { germination: 0.6, vegetative: 1.0, flowering: 0.9, fruiting: 0.7 } },
        K: { max_rate_kg_ha_day: 3.8, stages: { germination: 0.4, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 26, max: 32 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 28,
      root_depth_curve: { initial: 80, vegetative: 300, full_canopy: 600 },
      max_tolerance_ECe: 2.5,
      kc_curve: { transplant: 0.50, vegetative: 0.80, flowering: 1.00, fruiting: 0.75 },
      harvest_index: 0.65,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 200, flowering: 600, fruiting: 1000 }
    },

    tomato: {
      light_use_efficiency_curve: { transplant: 0.026, vegetative: 0.048, flowering: 0.052, fruiting: 0.046 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.5, stages: { transplant: 0.6, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.7, stages: { transplant: 0.7, vegetative: 1.0, flowering: 0.9, fruiting: 0.7 } },
        K: { max_rate_kg_ha_day: 4.0, stages: { transplant: 0.4, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 7, peak: 22, max: 28 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 28,
      root_depth_curve: { initial: 60, vegetative: 250, full_canopy: 500 },
      max_tolerance_ECe: 2.5,
      kc_curve: { transplant: 0.60, vegetative: 0.80, flowering: 1.15, fruiting: 0.80 },
      harvest_index: 0.65,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 280, flowering: 800, fruiting: 1680 }
    },

    eggplant: {
      light_use_efficiency_curve: { transplant: 0.024, vegetative: 0.044, flowering: 0.050, fruiting: 0.046 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.0, stages: { transplant: 0.6, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { transplant: 0.7, vegetative: 1.0, flowering: 0.9, fruiting: 0.7 } },
        K: { max_rate_kg_ha_day: 3.6, stages: { transplant: 0.4, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 27, max: 35 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 26,
      root_depth_curve: { initial: 80, vegetative: 300, full_canopy: 600 },
      max_tolerance_ECe: 1.5,
      kc_curve: { transplant: 0.60, vegetative: 0.80, flowering: 1.05, fruiting: 0.85 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 350, flowering: 950, fruiting: 1800 }
    },

    pepper: {
      light_use_efficiency_curve: { transplant: 0.024, vegetative: 0.042, flowering: 0.048, fruiting: 0.045 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.0, stages: { transplant: 0.6, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { transplant: 0.7, vegetative: 1.0, flowering: 0.9, fruiting: 0.7 } },
        K: { max_rate_kg_ha_day: 3.8, stages: { transplant: 0.4, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 25, max: 35 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 28,
      root_depth_curve: { initial: 60, vegetative: 250, full_canopy: 500 },
      max_tolerance_ECe: 1.5,
      kc_curve: { transplant: 0.60, vegetative: 0.80, flowering: 1.05, fruiting: 0.90 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 445, flowering: 1625, fruiting: 2370 }
    },

    strawberry: {
      light_use_efficiency_curve: { establishment: 0.020, vegetative: 0.034, flowering: 0.040, fruiting: 0.036 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.2, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.45, stages: { establishment: 0.8, vegetative: 1.0, flowering: 0.9, fruiting: 0.7 } },
        K: { max_rate_kg_ha_day: 2.8, stages: { establishment: 0.5, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 3, peak: 20, max: 30 },
      optimal_moisture_range: { lower_bound: 65, upper_bound: 85 },
      M_field_capacity: 65, // C1 FIX: was 85
      wilting_point: 15, // C1 FIX: was 35. Rawls 1982
      root_depth_curve: { initial: 50, vegetative: 150, full_canopy: 250 },
      max_tolerance_ECe: 1.0,
      kc_curve: { establishment: 0.40, vegetative: 0.70, flowering: 0.85, fruiting: 0.75 },
      harvest_index: 0.45,  // D4: FAO-66
      stage_gdd_thresholds: { establishment: 0, vegetative: 300, flowering: 700, fruiting: 1100 }
    },

    garlic: {
      light_use_efficiency_curve: { germination: 0.016, vegetative: 0.030, bulb_swelling: 0.036, maturity: 0.028 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.0, stages: { germination: 0.5, vegetative: 1.0, bulb_swelling: 0.7, maturity: 0.4 } },
        P: { max_rate_kg_ha_day: 0.4, stages: { germination: 0.6, vegetative: 1.0, bulb_swelling: 0.8, maturity: 0.6 } },
        K: { max_rate_kg_ha_day: 2.2, stages: { germination: 0.4, vegetative: 0.7, bulb_swelling: 1.0, maturity: 0.7 } }
      },
      optimal_temp_range: { min: 4, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 20,
      root_depth_curve: { initial: 60, vegetative: 200, full_canopy: 350 },
      max_tolerance_ECe: 1.2,
      kc_curve: { germination: 0.50, vegetative: 0.80, bulbing: 1.00, maturity: 0.70 },
      harvest_index: 0.6,  // D4: FAO-66
      stage_gdd_thresholds: { germination: 0, vegetative: 400, bulbing: 850, maturity: 1500 }
    },

    zucchini: {
      light_use_efficiency_curve: { germination: 0.022, vegetative: 0.044, flowering: 0.050, fruiting: 0.046 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.0, stages: { germination: 0.5, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { germination: 0.6, vegetative: 1.0, flowering: 0.9, fruiting: 0.7 } },
        K: { max_rate_kg_ha_day: 3.6, stages: { germination: 0.4, vegetative: 0.7, flowering: 1.0, fruiting: 0.9 } }
      },
      optimal_temp_range: { min: 10, peak: 25, max: 32 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 22,
      root_depth_curve: { initial: 100, vegetative: 350, full_canopy: 700 },
      max_tolerance_ECe: 2.0,
      kc_curve: { transplant: 0.50, vegetative: 0.80, flowering: 0.95, fruiting: 0.75 },
      harvest_index: 0.6,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 200, flowering: 550, fruiting: 950 }
    },

    melon: {
      light_use_efficiency_curve: { germination: 0.024, vegetative: 0.048, flowering: 0.053, fruiting: 0.047 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.0, stages: { germination: 0.5, vegetative: 1.0, flowering: 0.8, fruiting: 0.6 } },
        P: { max_rate_kg_ha_day: 0.6, stages: { germination: 0.6, vegetative: 1.0, flowering: 0.9, fruiting: 0.8 } },
        K: { max_rate_kg_ha_day: 4.0, stages: { germination: 0.3, vegetative: 0.6, flowering: 0.9, fruiting: 1.0 } }
      },
      optimal_temp_range: { min: 10, peak: 28, max: 38 },
      optimal_moisture_range: { lower_bound: 45, upper_bound: 65 },
      M_field_capacity: 65,
      wilting_point: 20,
      root_depth_curve: { initial: 120, vegetative: 500, full_canopy: 900 },
      max_tolerance_ECe: 2.2,
      kc_curve: { transplant: 0.50, vegetative: 0.75, flowering: 1.05, fruiting: 0.75 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 280, flowering: 750, fruiting: 1400 }
    },

    broccoli: {
      light_use_efficiency_curve: { transplant: 0.022, vegetative: 0.040, head_development: 0.046, maturity: 0.038 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 3.8, stages: { transplant: 0.6, vegetative: 1.0, head_development: 0.8, maturity: 0.5 } },
        P: { max_rate_kg_ha_day: 0.8, stages: { transplant: 0.6, vegetative: 1.0, head_development: 0.9, maturity: 0.6 } },
        K: { max_rate_kg_ha_day: 3.0, stages: { transplant: 0.4, vegetative: 0.7, head_development: 1.0, maturity: 0.7 } }
      },
      optimal_temp_range: { min: 5, peak: 17, max: 30 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 28,
      root_depth_curve: { initial: 80, vegetative: 250, full_canopy: 450 },
      max_tolerance_ECe: 2.8,
      kc_curve: { transplant: 0.45, vegetative: 0.75, flowering: 1.05, harvest: 0.90 },
      harvest_index: 0.55,  // D4: FAO-66
      stage_gdd_thresholds: { transplant: 0, vegetative: 300, flowering: 700, harvest: 1050 }
    }
  },

  specialtyMediterranean: {
    saffron: {
      light_use_efficiency_curve: { dormant: 0.0, sprouting: 0.012, flowering: 0.015, leaf_dev: 0.018 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.3, stages: { sprouting: 0.8, flowering: 1.0, leaf_dev: 0.6 } },
        P: { max_rate_kg_ha_day: 0.06, stages: { sprouting: 0.9, flowering: 1.0, leaf_dev: 0.7 } },
        K: { max_rate_kg_ha_day: 0.4, stages: { sprouting: 0.5, flowering: 1.0, leaf_dev: 0.8 } }
      },
      optimal_temp_range: { min: 10, peak: 18, max: 30 },
      optimal_moisture_range: { lower_bound: 25, upper_bound: 45 },
      M_field_capacity: 45,
      wilting_point: 15,
      root_depth_curve: { initial: 50, vegetative: 150, full_canopy: 250 },
      max_tolerance_ECe: 2.5,
      kc_curve: { dormancy: 0.20, vegetative: 0.65, flowering: 0.75, harvest: 0.55 },
      harvest_index: 0.05,  // FAO-66
      stage_gdd_thresholds: { dormancy: 0, vegetative: 200, flowering: 500, harvest: 700 }
    },
    mastic_tree: {
      light_use_efficiency_curve: { vegetative: 0.014, flowering: 0.016, resin_prod: 0.015 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.25, stages: { vegetative: 1.0, flowering: 0.7, resin_prod: 0.5 } },
        P: { max_rate_kg_ha_day: 0.04, stages: { vegetative: 0.9, flowering: 1.0, resin_prod: 0.6 } },
        K: { max_rate_kg_ha_day: 0.3, stages: { vegetative: 0.6, flowering: 0.8, resin_prod: 1.0 } }
      },
      optimal_temp_range: { min: 8, peak: 25, max: 38 },
      optimal_moisture_range: { lower_bound: 20, upper_bound: 35 },
      M_field_capacity: 35,
      wilting_point: 8,
      root_depth_curve: { initial: 200, vegetative: 500, full_canopy: 1000 },
      max_tolerance_ECe: 5.0,
      kc_curve: { vegetative: 0.45, flowering: 0.55, fruit_dev: 0.65, harvest: 0.50 },
      harvest_index: 0.15,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 400, fruit_dev: 1000, harvest: 1800 }
    },
    oregano: {
      light_use_efficiency_curve: { establishment: 0.016, vegetative: 0.022, flowering: 0.025, harvest: 0.020 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.8, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.6, harvest: 0.4 } },
        P: { max_rate_kg_ha_day: 0.12, stages: { establishment: 0.8, vegetative: 1.0, flowering: 0.7, harvest: 0.5 } },
        K: { max_rate_kg_ha_day: 1.0, stages: { establishment: 0.5, vegetative: 0.7, flowering: 1.0, harvest: 0.8 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 30, upper_bound: 50 },
      M_field_capacity: 50,
      wilting_point: 18,
      root_depth_curve: { initial: 100, vegetative: 300, full_canopy: 500 },
      max_tolerance_ECe: 3.2,
      kc_curve: { vegetative: 0.40, flowering: 0.70, harvest: 0.60 },
      harvest_index: 0.35,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 600, harvest: 1000 }
    },
    thyme: {
      light_use_efficiency_curve: { establishment: 0.014, vegetative: 0.020, flowering: 0.023, harvest: 0.018 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.6, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.5, harvest: 0.3 } },
        P: { max_rate_kg_ha_day: 0.1, stages: { establishment: 0.8, vegetative: 1.0, flowering: 0.6, harvest: 0.4 } },
        K: { max_rate_kg_ha_day: 0.8, stages: { establishment: 0.4, vegetative: 0.6, flowering: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 25, upper_bound: 45 },
      M_field_capacity: 45,
      wilting_point: 15,
      root_depth_curve: { initial: 100, vegetative: 250, full_canopy: 400 },
      max_tolerance_ECe: 3.8,
      kc_curve: { vegetative: 0.40, flowering: 0.65, harvest: 0.55 },
      harvest_index: 0.35,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 550, harvest: 950 }
    },
    rosemary: {
      light_use_efficiency_curve: { establishment: 0.013, vegetative: 0.018, flowering: 0.021, harvest: 0.017 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.5, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.4, harvest: 0.3 } },
        P: { max_rate_kg_ha_day: 0.08, stages: { establishment: 0.8, vegetative: 1.0, flowering: 0.5, harvest: 0.3 } },
        K: { max_rate_kg_ha_day: 0.6, stages: { establishment: 0.4, vegetative: 0.6, flowering: 1.0, harvest: 0.6 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 32 },
      optimal_moisture_range: { lower_bound: 20, upper_bound: 40 },
      M_field_capacity: 40,
      wilting_point: 12,
      root_depth_curve: { initial: 150, vegetative: 400, full_canopy: 700 },
      max_tolerance_ECe: 4.2,
      kc_curve: { vegetative: 0.40, flowering: 0.60, harvest: 0.50 },
      harvest_index: 0.3,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 500, harvest: 900 }
    },
    sage: {
      light_use_efficiency_curve: { establishment: 0.015, vegetative: 0.021, flowering: 0.024, harvest: 0.019 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.7, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.6, harvest: 0.4 } },
        P: { max_rate_kg_ha_day: 0.11, stages: { establishment: 0.8, vegetative: 1.0, flowering: 0.7, harvest: 0.5 } },
        K: { max_rate_kg_ha_day: 0.9, stages: { establishment: 0.4, vegetative: 0.7, flowering: 1.0, harvest: 0.8 } }
      },
      optimal_temp_range: { min: 5, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 28, upper_bound: 48 },
      M_field_capacity: 48,
      wilting_point: 16,
      root_depth_curve: { initial: 100, vegetative: 350, full_canopy: 600 },
      max_tolerance_ECe: 3.5,
      kc_curve: { vegetative: 0.40, flowering: 0.65, harvest: 0.55 },
      harvest_index: 0.35,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 550, harvest: 950 }
    },
    mint: {
      light_use_efficiency_curve: { establishment: 0.024, vegetative: 0.038, flowering: 0.035, harvest: 0.032 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.5, stages: { establishment: 0.6, vegetative: 1.0, flowering: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.4, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 2.0, stages: { establishment: 0.5, vegetative: 0.8, flowering: 1.0, harvest: 0.9 } }
      },
      optimal_temp_range: { min: 0, peak: 22, max: 35 },
      optimal_moisture_range: { lower_bound: 60, upper_bound: 80 },
      M_field_capacity: 45, // C1 FIX: was 80
      wilting_point: 12, // C1 FIX: was 35. Lavender=drought tolerant
      root_depth_curve: { initial: 80, vegetative: 200, full_canopy: 350 },
      max_tolerance_ECe: 2.0,
      kc_curve: { vegetative: 0.60, flowering: 0.85, harvest: 0.75 },
      harvest_index: 0.4,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 500, harvest: 850 }
    },
    bay_laurel: {
      light_use_efficiency_curve: { vegetative: 0.016, flowering: 0.019, harvest: 0.017 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.5, stages: { establishment: 0.7, vegetative: 1.0, flowering: 0.4, harvest: 0.3 } },
        P: { max_rate_kg_ha_day: 0.08, stages: { establishment: 0.8, vegetative: 1.0, flowering: 0.5, harvest: 0.3 } },
        K: { max_rate_kg_ha_day: 0.6, stages: { establishment: 0.4, vegetative: 0.6, flowering: 1.0, harvest: 0.6 } }
      },
      optimal_temp_range: { min: 6, peak: 22, max: 32 },
      optimal_moisture_range: { lower_bound: 20, upper_bound: 40 },
      M_field_capacity: 40,
      wilting_point: 12,
      root_depth_curve: { initial: 150, vegetative: 400, full_canopy: 700 },
      max_tolerance_ECe: 4.2,
      kc_curve: { vegetative: 0.45, flowering: 0.55, harvest: 0.50 },
      harvest_index: 0.25,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 450, harvest: 800 }
    },
    currants: {
      light_use_efficiency_curve: { dormant: 0.0, budbreak: 0.018, flowering: 0.022, fruiting: 0.025 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.2, stages: { budbreak: 0.9, flowering: 1.0, fruiting: 0.7 } },
        P: { max_rate_kg_ha_day: 0.2, stages: { budbreak: 0.8, flowering: 1.0, fruiting: 0.8 } },
        K: { max_rate_kg_ha_day: 1.5, stages: { budbreak: 0.5, flowering: 0.7, fruiting: 1.0 } }
      },
      optimal_temp_range: { min: 10, peak: 18, max: 25 },
      optimal_moisture_range: { lower_bound: 55, upper_bound: 75 },
      M_field_capacity: 75,
      wilting_point: 30,
      root_depth_curve: { initial: 150, vegetative: 400, full_canopy: 700 },
      max_tolerance_ECe: 1.0,
      kc_curve: { vegetative: 0.40, flowering: 0.70, fruiting: 0.65, harvest: 0.50 },
      harvest_index: 0.55,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 400, fruiting: 900, harvest: 1300 }
    },
    carob: {
      light_use_efficiency_curve: { vegetative: 0.014, flowering: 0.017, pod_dev: 0.019, harvest: 0.016 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 0.4, stages: { vegetative: 0.8, flowering: 1.0, pod_dev: 0.6, harvest: 0.4 } },
        P: { max_rate_kg_ha_day: 0.08, stages: { vegetative: 0.9, flowering: 1.0, pod_dev: 0.8, harvest: 0.6 } },
        K: { max_rate_kg_ha_day: 0.5, stages: { vegetative: 0.6, flowering: 0.8, pod_dev: 1.0, harvest: 0.7 } }
      },
      optimal_temp_range: { min: 8, peak: 25, max: 35 },
      optimal_moisture_range: { lower_bound: 15, upper_bound: 35 },
      M_field_capacity: 35,
      wilting_point: 8,
      root_depth_curve: { initial: 300, vegetative: 800, full_canopy: 1800 },
      max_tolerance_ECe: 4.8,
      kc_curve: { vegetative: 0.45, flowering: 0.55, fruit_dev: 0.65, harvest: 0.50 },
      harvest_index: 0.3,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 500, fruit_dev: 1200, harvest: 2200 }
    },
    artichoke: {
      light_use_efficiency_curve: { establishment: 0.022, vegetative: 0.035, flower_bud: 0.038, harvest: 0.032 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 2.8, stages: { establishment: 0.6, vegetative: 1.0, flower_bud: 0.8, harvest: 0.6 } },
        P: { max_rate_kg_ha_day: 0.5, stages: { establishment: 0.7, vegetative: 1.0, flower_bud: 0.9, harvest: 0.7 } },
        K: { max_rate_kg_ha_day: 3.2, stages: { establishment: 0.4, vegetative: 0.7, flower_bud: 1.0, harvest: 0.8 } }
      },
      optimal_temp_range: { min: 5, peak: 18, max: 32 },
      optimal_moisture_range: { lower_bound: 50, upper_bound: 70 },
      M_field_capacity: 70,
      wilting_point: 25,
      root_depth_curve: { initial: 150, vegetative: 500, full_canopy: 900 },
      max_tolerance_ECe: 2.5,
      kc_curve: { vegetative: 0.50, flowering: 0.95, harvest: 0.90 },
      harvest_index: 0.35,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 700, harvest: 1100 }
    }
  },

  // New group for ανθοκομικά (floriculture/ornamentals)
  ornamentalCrops: {
    floriculture_generic: {
      light_use_efficiency_curve: { propagation: 0.015, vegetative: 0.024, budding: 0.028, flowering: 0.026 },
      nutrient_demand_curves: {
        N: { max_rate_kg_ha_day: 1.8, stages: { propagation: 0.7, vegetative: 1.0, budding: 0.8, flowering: 0.6 } },
        P: { max_rate_kg_ha_day: 0.35, stages: { propagation: 0.8, vegetative: 1.0, budding: 0.9, flowering: 0.7 } },
        K: { max_rate_kg_ha_day: 2.0, stages: { propagation: 0.4, vegetative: 0.7, budding: 1.0, flowering: 0.9 } }
      },
      optimal_temp_range: { min: 8, peak: 22, max: 30 },
      optimal_moisture_range: { lower_bound: 60, upper_bound: 85 },
      M_field_capacity: 60, // C1 FIX: was 85
      wilting_point: 18, // C1 FIX: was 35
      root_depth_curve: { initial: 60, vegetative: 150, full_canopy: 300 },
      max_tolerance_ECe: 1.5,
      kc_curve: { vegetative: 0.60, flowering: 0.85, harvest: 0.75 },
      harvest_index: 0.3,  // FAO-66
      stage_gdd_thresholds: { vegetative: 0, flowering: 500, harvest: 800 }
    }
  }
};

const FERTILIZER_PROFILE = [
  {
    category: "Αζωτούχα Λιπάσματα",
    items: [
      {
        name: "Ουρία",
        npk: { N: 46, P: 0, K: 0 },
        notes: "Υψηλή περιεκτικότητα σε άζωτο, το πιο κοινό αζωτούχο λίπασμα. Μπορεί να προκαλέσει απώλειες λόγω πτητικοποίησης εάν δεν ενσωματωθεί."
      },
      {
        name: "Νιτρική Αμμωνία",
        npk: { N: 33.5, P: 0, K: 0 },
        notes: "Περιέχει ταχείας δράσης νιτρικό και βραδείας απελευθέρωσης αμμωνιακό άζωτο."
      },
      {
        name: "Θειική Αμμωνία",
        npk: { N: 21, P: 0, K: 0 },
        notes: "Έχει οξινιστική επίδραση, κατάλληλη για εδάφη με υψηλό pH. Παρέχει επίσης θείο (S)."
      },
      {
        name: "Νιτρικό Ασβέστιο",
        npk: { N: 15.5, P: 0, K: 0 },
        notes: "Παρέχει ταχείας δράσης νιτρικό άζωτο και διαλυτό ασβέστιο (Ca), χρήσιμο για την αποφυγή της ξηρής κορυφής στους καρπούς."
      }
    ]
  },
  {
    category: "Φωσφορικά Λιπάσματα",
    items: [
      {
        name: "Απλό Υπερφωσφορικό (SSP)",
        npk: { N: 0, P: 20, K: 0 },
        notes: "Παρέχει φώσφορο, ασβέστιο και θείο. Χαμηλή περιεκτικότητα σε P αλλά αποτελεσματικό."
      },
      {
        name: "Τριπλό Υπερφωσφορικό (TSP)",
        npk: { N: 0, P: 46, K: 0 },
        notes: "Υψηλή περιεκτικότητα σε φώσφορο, ευρέως χρησιμοποιούμενο για εφαρμογή πριν τη φύτευση."
      }
    ]
  },
  {
    category: "Καλιούχα Λιπάσματα",
    items: [
      {
        name: "Χλωριούχο Κάλιο / MOP",
        npk: { N: 0, P: 0, K: 60 },
        notes: "Η υψηλότερη περιεκτικότητα σε κάλιο και η πιο κοινή πηγή. Το χλώριο μπορεί να είναι πρόβλημα για ευαίσθητες καλλιέργειες."
      },
      {
        name: "Θειικό Κάλιο / SOP",
        npk: { N: 0, P: 0, K: 50 },
        notes: "Πηγή καλίου χωρίς χλώριο, ιδανική για ευαίσθητες καλλιέργειες όπως εσπεριδοειδή, αμπέλια και πατάτες. Παρέχει θείο."
      },
      {
        name: "Νιτρικό Κάλιο",
        npk: { N: 13, P: 0, K: 46 },
        notes: "Παρέχει τόσο άζωτο όσο και κάλιο σε εξαιρετικά διαλυτό τύπο, ιδανικό για υδρολίπανση."
      }
    ]
  },
  {
    category: "Σύνθετα Λιπάσματα",
    items: [
      {
        name: "Ισορροπημένο 20-20-20",
        npk: { N: 20, P: 20, K: 20 },
        notes: "Γενικής χρήσης λίπασμα που παρέχει ίσα μέρη Ν, P και K."
      },
      {
        name: "MAP (Μονοφωσφορική Αμμωνία)",
        npk: { N: 11, P: 52, K: 0 },
        notes: "Υψηλή περιεκτικότητα σε φώσφορο με λίγο άζωτο. Έχει οξινιστική επίδραση."
      },
      {
        name: "DAP (Διφωσφορική Αμμωνία)",
        npk: { N: 18, P: 46, K: 0 },
        notes: "Παρέχει τόσο άζωτο όσο και φώσφορο. Έχει αρχικά αλκαλική αντίδραση στο έδαφος."
      },
      {
        name: "Starter Υψηλού Αζώτου (20-10-10)",
        npk: { N: 20, P: 10, K: 10 },
        notes: "Χρησιμοποιείται για ενίσχυση της βλαστικής ανάπτυξης στην αρχή της καλλιεργητικής περιόδου."
      },
      {
        name: "Finisher Υψηλού Καλίου (15-5-30)",
        npk: { N: 15, P: 5, K: 30 },
        notes: "Χρησιμοποιείται στο στάδιο καρποφορίας ή ωρίμανσης για βελτίωση της ποιότητας."
      }
    ]
  },
  {
    category: "Υδατοδιαλυτά Λιπάσματα",
    items: [
      {
        name: "Νιτρικό Ασβέστιο (Διαλυτό)",
        npk: { N: 15.5, P: 0, K: 0 },
        notes: "Κλασική πηγή Ν και Ca για υδροπονία και υδρολίπανση."
      },
      {
        name: "Νιτρικό Κάλιο (Διαλυτό)",
        npk: { N: 13, P: 0, K: 46 },
        notes: "Κλασική πηγή Ν και Κ για υδρολίπανση."
      },
      {
        name: "MAP (Διαλυτό)",
        npk: { N: 12, P: 61, K: 0 },
        notes: "Εξαιρετικά διαλυτός φώσφορος για υδρολίπανση."
      },
      {
        name: "MKP (Μονοφωσφορικό Κάλιο)",
        npk: { N: 0, P: 52, K: 34 },
        notes: "Πηγή P και K χωρίς χλώριο, εξαιρετικά διαλυτή, ιδανική για το στάδιο καρποφορίας."
      }
    ]
  },
  {
    category: "Οργανικά Λιπάσματα",
    items: [
      {
        name: "Κοπριά",
        npk: { N: 2, P: 1.5, K: 2 },
        notes: "Μεταβλητή ανάλυση. Βελτιώνει τη δομή του εδάφους και παρέχει θρεπτικά συστατικά βραδείας αποδέσμευσης."
      },
      {
        name: "Ιχθυογαλάκτωμα",
        npk: { N: 5, P: 1, K: 1 },
        notes: "Παρέχει ταχείας δράσης άζωτο και ιχνοστοιχεία."
      },
      {
        name: "Οστεάλευρο",
        npk: { N: 3, P: 15, K: 0 },
        notes: "Πηγή φώσφορου και ασβεστίου βραδείας αποδέσμευσης."
      },
      {
        name: "Σβώλοι Μαλλιού Προβάτου",
        npk: { N: 15, P: 1, K: 3 }, // C2 FIX: was N:9. Ref: Zheljazkov 2009
        notes: "Πηγή αζώτου πολύ βραδείας αποδέσμευσης. Βελτιώνει επίσης τη συγκράτηση νερού στο έδαφος."
      }
    ]
  }
];

const IRRIGATION_SYSTEM_PROFILE =
{
  dripIrrigation: {
    name: "Άρδευση με Στάγδην",
    description: "Το νερό εφαρμόζεται αργά και απευθείας στη ριζική ζώνη μέσω δικτύου σωλήνων και σταλακτήρων. Η πιο αποδοτική μέθοδος, ελαχιστοποιεί την εξάτμιση και την απορροή.",
    efficiency_factor: 0.95,
    application_rate: 4, // mm/h — B1 FIX: τυπικός σταλάκτης 4 L/h (Phocaides 2007)
    notes: "Αντιπροσωπεύει απόδοση 95%. Υποθέτει καλά συντηρημένο σύστημα με αντιστάθμιση πίεσης. Ο ρυθμός πρέπει να μετατραπεί σε mm/ώρα για τον υπολογισμό της Διάρκειας Άρδευσης. Τύπος: mm/ώρα = (Παροχή σταλάκτη L/ώρα * 1000) / (Απόσταση σταλακτήρων σε m * Απόσταση γραμμών σε m). Ο χρήστης παρέχει τις αποστάσεις."
  },
  microSprayers: {
    name: "Μικροεκτοξευτήρες",
    description: "Μικρά μπεκ που ψεκάζουν νερό σε περιορισμένη περιοχή, συνήθως κάτω από την κόμη των δέντρων. Πιο αποδοτικά από τους μεγάλους εκτοξευτήρες αλλά ευαίσθητα στον άνεμο.",
    efficiency_factor: 0.85,
    application_rate: 6, // mm/h
    notes: "Αντιπροσωπεύει απόδοση 85%. Υποθέτει λειτουργία σε συνθήκες χαμηλού ανέμου. Η πραγματική παροχή εξαρτάται από το μπεκ και την πίεση."
  },
    centerPivot: {
    name: "Κεντρικός Άξονας / Γραμμικό Σύστημα",
    description: "Μεγάλο, κινητό σύστημα εκτοξευτήρων για μεγάλες, επίπεδες καλλιέργειες όπως καλαμπόκι και βαμβάκι.",
    efficiency_factor: 0.80,
    application_rate: 15, // mm/h
    notes: "Αντιπροσωπεύει απόδοση 80%. Μπορεί να είναι χαμηλότερη σε συνθήκες υψηλού ανέμου ή θερμοκρασίας λόγω εξάτμισης και διασποράς. Η παροχή εξαρτάται από την ταχύτητα κίνησης."
  },
  stationarySprinklers: {
    name: "Σταθεροί Εκτοξευτήρες",
    description: "Πλέγμα σταθερών εκτοξευτήρων που καλύπτουν ολόκληρο το χωράφι. Συνηθισμένοι για λαχανικά και σιτηρά.",
    efficiency_factor: 0.75,
    application_rate: 10, // mm/h
    notes: "Αντιπροσωπεύει απόδοση 75%. Απώλειες λόγω ανέμου, εξάτμισης και μη ομοιόμορφης διανομής."
  },
  floodIrrigation:{
    name: "Άρδευση με Αυλάκια / Κατάκλυση",
    description: "Το νερό ρέει στην επιφάνεια του εδάφους μέσω αυλακιών ή καλύπτει ολόκληρο το χωράφι. Παραδοσιακή, χαμηλού κόστους μέθοδος με πολύ χαμηλή απόδοση.",
    efficiency_factor: 0.50,
    application_rate: 25, // mm/h
    notes: "Αντιπροσωπεύει απόδοση 50%. Το μισό από το νερό χάνεται λόγω βαθιάς διήθησης, απορροής και εξάτμισης. Ο ρυθμός είναι κατά προσέγγιση, εξαρτάται από την παροχή και την ικανότητα διήθησης του εδάφους."
  }
};

const PATHOGEN_PROFILE =
{
  fungi_Oomycetes: {
    plasmopara_viticola: {
      crops: [
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "wine_grapes"
        },
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "table_grapes"
        },
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "raisin_grapes"
        }
      ],
      name: "Περονόσπορος (Plasmopara viticola)",
      type: "Infection_Triangle",
      description: "Η μόλυνση προκαλείται από συνδυασμό θερμοκρασίας, υγρασίας και διάρκειας υγρού φύλλου.",
      optimalTempRange: { min: 10, max: 27 }, // B4 FIX: ήταν {16,22}. Ref: Lafon 1988
      optimalHumidity: { min: 90, max: 100 },
      requiredDurationHrs: 8,
      notes: "Τα φύλλα πρέπει να παραμείνουν συνεχώς βρεγμένα για τουλάχιστον 8 ώρες εντός του βέλτιστου θερμοκρασιακού εύρους για να συμβεί σημαντική μόλυνση."
    },
    erysiphe_necator: {
      name: "Ωίδιο (Erysiphe necator, Podosphaera xanthii)",
      crops: [
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "wine_grapes"
        },
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "table_grapes"
        },
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "raisin_grapes"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "watermelon"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "cucumber"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "melon"
        }
      ],
      type: "Infection_Triangle",
      description: "Αναπτύσσεται σε υψηλή ατμοσφαιρική υγρασία αλλά δεν απαιτεί ελεύθερο νερό στα φύλλα.",
      optimalTempRange: { min: 15, max: 35 }, // B4 FIX: ήταν {20,25}. Ref: Gadoury 1990
      optimalHumidity: { min: 60, max: 85 },
      requiredDurationHrs: 6,
      requiresLeafWetness: false,     // B6 FIX: Ωίδιο ΔΕΝ χρειάζεται βρεγμένο φύλλο
      rainInhibitsInfection: true,    // Βροχή ξεπλένει κονίδια
      rainInhibitThresholdMm: 2.5,   // >2.5mm → reset counter. Ref: Gadoury 1990
      notes: "Αναστέλλεται από τη βροχή που απομακρύνει τα σπόρια. Χρειάζονται 6 συνεχόμενες ώρες εντός του βέλτιστου εύρους για υψηλό κίνδυνο μόλυνσης."
    },
    phytophthora_infestans: {
      crops: [
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "potato"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "tomato"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "eggplant"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "pepper"
        }
      ],
      name: "Περονόσπορος Πατάτας/Τομάτας (Phytophthora infestans)",
      type: "Infection_Triangle",
      description: "Καταστροφική ασθένεια που ευνοείται από δροσερές και υγρές συνθήκες.",
      optimalTempRange: { min: 8, max: 25 }, // B4 FIX: ήταν {12,20}. Ref: Fry 2008
      optimalHumidity: { min: 90, max: 100 },
      requiredDurationHrs: 10,
      notes: "Απαιτεί παρατεταμένη υγρασία φύλλου (10-12 ώρες) για μόλυνση."
    },
    botrytis_cinerea: {
      crops: [
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "wine_grapes"
        },
        {
          cultivation_type_general: "vineCrops",
          cultivation_type: "table_grapes"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "onion"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "dry_beans"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "green_beans"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "lettuce"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "tomato"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "pepper"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "strawberry"
        },
        {
          cultivation_type_general: "vegetableCrops",
          cultivation_type: "garlic"
        },
        {
          cultivation_type_general: "ornamentalCrops",
          cultivation_type: "floriculture_generic"
        }
      ],
      name: "Τεφρά Σήψη (Botrytis cinerea)",
      type: "Infection_Triangle",
      description: "Ασθένεια ψυχρού καιρού που συχνά μολύνει μέσω πληγών ή γηρασμένων ανθικών τμημάτων.",
      optimalTempRange: { min: 5, max: 30 }, // B4 FIX: ήταν {15,23}. Ref: Elad 2007
      optimalHumidity: { min: 92, max: 100 },
      requiredDurationHrs: 10,
      notes: "Απαιτεί πολύ υψηλή υγρασία και συχνά ελεύθερο νερό. Η κακή κυκλοφορία αέρα ευνοεί την ανάπτυξή της."
    },
    venturia_inaequalis: {
      crops: [
        {
          cultivation_type_general: "pomeFruits",
          cultivation_type: "apple"
        }
      ],
      name: "Φουζικλάδιο Μηλιάς (Venturia inaequalis)",
      type: "Infection_Triangle",
      description: "Η πρωτογενής μόλυνση γίνεται την άνοιξη, χρησιμοποιεί τη λογική του πίνακα Mills.",
      optimalTempRange: { min: 6, max: 26 }, // B4 FIX: ήταν {16,24}. Ref: MacHardy 1996
      optimalHumidity: { min: 95, max: 100 },
      requiredDurationHrs: 9,
      notes: "Σε βέλτιστες θερμοκρασίες απαιτούνται μόνο 9 ώρες υγρασίας φύλλου."
    },
    taphrina_deformans: {
      crops: [
        {
          cultivation_type_general: "stoneFruits",
          cultivation_type: "peach"
        },
        {
          cultivation_type_general: "stoneFruits",
          cultivation_type: "nectarine"
        },
        {
          cultivation_type_general: "nutCrops",
          cultivation_type: "almond"
        }
      ],
      name: "Εξώασκος (Taphrina deformans)",
      type: "Infection_Triangle",
      description: "Η μόλυνση συμβαίνει μία φορά το χρόνο, κατά το φούσκωμα των οφθαλμών τέλη χειμώνα/αρχές άνοιξης.",
      optimalTempRange: { min: 8, max: 20 }, // B4 FIX: ήταν {10,21}. Ref: Rossi 2007
      optimalHumidity: { min: 95, max: 100 },
      requiredDurationHrs: 12,
      notes: "Απαιτεί βροχόπτωση και τουλάχιστον 12,5 ώρες συνεχούς υγρασίας από βροχή."
    },
    // B8 FIX: 3 νέα παθογόνα Κρήτης
    colletotrichum_oleae: {
      name: "Ανθράκωση Ελιάς (Colletotrichum acutatum)",
      crops: [{ cultivation_type_general: "olive", cultivation_type: "koroneiki" }],
      type: "Infection_Triangle",
      description: "Η ανθράκωση ευνοείται από βροχή/υγρασία, προσβάλλει κυρίως τους καρπούς.",
      optimalTempRange: { min: 10, max: 25 },
      optimalHumidity: { min: 70, max: 100 },
      requiredDurationHrs: 6,
      notes: "Κύρια αιτία ποιοτικής υποβάθμισης ελαιοκάρπου Κρήτης. Ref: Moral et al. 2009."
    },
    spilocaea_oleagina: {
      name: "Κυκλοκόνιο Ελιάς (Spilocaea oleagina)",
      crops: [{ cultivation_type_general: "olive", cultivation_type: "koroneiki" }],
      type: "Infection_Triangle",
      description: "Πρώιμη φυλλόπτωση. Δροσερές+υγρές φθινοπωρινές/χειμωνιάτικες συνθήκες.",
      optimalTempRange: { min: 5, max: 20 },
      optimalHumidity: { min: 85, max: 100 },
      requiredDurationHrs: 18,
      notes: "Σοβαρή ασθένεια ελιάς παγκοσμίως. Ref: Graniti 1993, Viruega et al. 2007."
    },
    alternaria_solani: {
      name: "Εναλτερνάρια (Alternaria alternata / A. solani)",
      crops: [
        { cultivation_type_general: "vegetableCrops", cultivation_type: "tomato" },
        { cultivation_type_general: "vegetableCrops", cultivation_type: "potato" },
        { cultivation_type_general: "vegetableCrops", cultivation_type: "pepper" },
        { cultivation_type_general: "vegetableCrops", cultivation_type: "eggplant" }
      ],
      type: "Infection_Triangle",
      description: "#2 ασθένεια σολανωδών μετά Phytophthora. Θερμότερο βέλτιστο.",
      optimalTempRange: { min: 24, max: 30 },
      optimalHumidity: { min: 85, max: 100 },
      requiredDurationHrs: 8,
      notes: "Ref: Rotem 1994, Agrios 2005."
    }
  },
  // Έντομα
  insects: {
      bactrocera_oleae: {
        crops: [
          {
            cultivation_type_general: "olive",
            cultivation_type: "koroneiki"
          }
        ],
        name: "Δάκος (Bactrocera oleae)",
        type: "GDD_Pest",
        pestBaseTemp: 10.0,
        criticalGddValues: { firstFlightSpring: 220, peakActivitySummer: 500, autumnGeneration: 850 },
        activityTempRange: { min: 20, max: 30 },
        activityHumidityRange: { min: 60, max: 100 },
        notes: "Ο κύκλος ζωής εξαρτάται έντονα από τη θερμοκρασιακή συσσώρευση. Η δραστηριότητα μειώνεται σημαντικά πάνω από 33°C."
      },
      prays_oleae: {
        crops: [
          {
            cultivation_type_general: "olive",
            cultivation_type: "koroneiki"
          }
        ],
        name: "Πυρηνοτρήτης (Prays oleae)",
        type: "GDD_Pest",
        pestBaseTemp: 10.0,
        criticalGddValues: { flowerGenerationFlight: 180, fruitGenerationFlight: 550 },
        activityTempRange: { min: 15, max: 30 },
        activityHumidityRange: { min: 40, max: 60 },
        notes: "Διακριτές γενιές προσβάλλουν άνθη, καρπούς και φύλλα. Η ανοιξιάτικη γενιά είναι συχνά η πιο κρίσιμη."
      },
      palpita_unionalis: {
        crops: [
          {
            cultivation_type_general: "olive",
            cultivation_type: "koroneiki"
          }
        ],
        name: "Μαργαρώνια (Palpita unionalis)",
        type: "GDD_Pest",
        pestBaseTemp: 15.0,
        criticalGddValues: { firstGenerationSpring: 200, secondGenerationSummer: 480, peakDamageAutumn: 750 },
        activityTempRange: { min: 20, max: 26 },
        activityHumidityRange: { min: 50, max: 80 },
        notes: "Επιτίθεται σε τρυφερούς βλαστούς και φύλλα, ιδιαίτερα επιβλαβές για νεαρά δέντρα."
      },
      tuta_absoluta: {
        crops: [
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "potato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "tomato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "eggplant"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "pepper"
          }
        ],
        name: "Tuta absoluta",
        type: "GDD_Pest",
        pestBaseTemp: 10.0,
        criticalGddValues: { firstGeneration: 150, rapidGrowthThreshold: 280 },
        activityTempRange: { min: 14, max: 30 },
        activityHumidityRange: { min: 55, max: 75 },
        notes: "Πολύ γρήγορος κύκλος ζωής, έως 10-12 γενιές το χρόνο. Μετά το όριο ταχείας αύξησης απαιτείται συνεχής παρακολούθηση."
      },
      myzus_persicae: {
        crops: [
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "wine_grapes"
          },
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "table_grapes"
          },
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "raisin_grapes"
          },
          {
            cultivation_type_general: "cerealCrops",
            cultivation_type: "wheat"
          },
          {
            cultivation_type_general: "cerealCrops",
            cultivation_type: "barley"
          },
          {
            cultivation_type_general: "cerealCrops",
            cultivation_type: "maize"
          },
          {
            cultivation_type_general: "cerealCrops",
            cultivation_type: "oats"
          },
          {
            cultivation_type_general: "stoneFruits",
            cultivation_type: "peach"
          },
          {
            cultivation_type_general: "stoneFruits",
            cultivation_type: "cherry"
          },
          {
            cultivation_type_general: "pomeFruits",
            cultivation_type: "apple"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "watermelon"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "potato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "dry_beans"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "green_beans"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "cabbage"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "tomato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "eggplant"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "pepper"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "cucumber"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "melon"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "broccoli"
          }
        ],
        name: "Αφίδες (Γενικό προφίλ π.χ. Myzus persicae)",
        type: "GDD_Pest",
        pestBaseTemp: 4.0,
        criticalGddValues: { firstGeneration: 150, rapidGrowthThreshold: 300 },
        activityTempRange: { min: 20, max: 28 },
        activityHumidityRange: { min: 60, max: 80 },
        notes: "Ενεργές πολύ νωρίς την άνοιξη λόγω χαμηλού κατωφλιού θερμοκρασίας."
      },
      ceratitis_capitata: {
        crops: [
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "wine_grapes"
          },
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "table_grapes"
          },
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "raisin_grapes"
          },
          {
            cultivation_type_general: "citrusFruits",
            cultivation_type: "orange"
          },
          {
            cultivation_type_general: "citrusFruits",
            cultivation_type: "mandarin"
          },
          {
            cultivation_type_general: "citrusFruits",
            cultivation_type: "lemon"
          },
          {
            cultivation_type_general: "stoneFruits",
            cultivation_type: "peach"
          },
          {
            cultivation_type_general: "stoneFruits",
            cultivation_type: "apricot"
          },
          {
            cultivation_type_general: "pomeFruits",
            cultivation_type: "apple"
          },
          {
            cultivation_type_general: "subTropicalFruits",
            cultivation_type: "fig"
          }
        ],
        name: "Μύγα της Μεσογείου (Ceratitis capitata)",
        primaryHosts: ["Εσπεριδοειδή", "Ροδακινιά", "Βερικοκιά", "Συκιά", "Πιπεριά"],
        type: "GDD_Pest",
        pestBaseTemp: 13.0,
        criticalGddValues: { firstGeneration: 250, peakSummerActivity: 600 },
        activityTempRange: { min: 22, max: 32 },
        activityHumidityRange: { min: 65, max: 85 },
        notes: "Πολυφάγο έντομο με ευρύ φάσμα ξενιστών."
      },
      bemisia_tabaci: {
        crops: [
          {
            cultivation_type_general: "subTropicalFruits",
            cultivation_type: "kiwi"
          },
          {
            cultivation_type_general: "industrialCrops",
            cultivation_type: "cotton"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "watermelon"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "potato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "dry_beans"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "green_beans"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "cabbage"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "lettuce"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "carrot"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "tomato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "eggplant"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "pepper"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "melon"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "cucumber"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "broccoli"
          }
        ],
        name: "Αλευρώδεις (Bemisia tabaci)",
        type: "GDD_Pest",
        pestBaseTemp: 12.0,
        criticalGddValues: { firstGeneration: 300, populationExplosion: 550 },
        activityTempRange: { min: 20, max: 32 },
        activityHumidityRange: { min: 50, max: 70 },
        notes: "Προσβάλλει κυρίως θερμοκήπια και θερμές περιοχές· φορέας πολλών ιών."
      }
  },
  // Ακάρεα
  mites: {
      tetranychus_urticae: {
        crops: [
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "wine_grapes"
          },
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "table_grapes"
          },
          {
            cultivation_type_general: "vineCrops",
            cultivation_type: "raisin_grapes"
          },
          {
            cultivation_type_general: "citrusFruits",
            cultivation_type: "orange"
          },
          {
            cultivation_type_general: "citrusFruits",
            cultivation_type: "lemon"
          },
          {
            cultivation_type_general: "citrusFruits",
            cultivation_type: "mandarin"
          },
          {
            cultivation_type_general: "stoneFruits",
            cultivation_type: "peach"
          },
          {
            cultivation_type_general: "stoneFruits",
            cultivation_type: "apricot"
          },
          {
            cultivation_type_general: "pomeFruits",
            cultivation_type: "apple"
          },
          {
            cultivation_type_general: "subTropicalFruits",
            cultivation_type: "kiwi"
          },
          {
            cultivation_type_general: "subTropicalFruits",
            cultivation_type: "pomegranate"
          },
          {
            cultivation_type_general: "industrialCrops",
            cultivation_type: "cotton"
          },
          {
            cultivation_type_general: "industrialCrops",
            cultivation_type: "tobacco"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "watermelon"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "potato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "dry_beans"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "green_beans"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "tomato"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "eggplant"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "pepper"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "melon"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "cucumber"
          },
          {
            cultivation_type_general: "vegetableCrops",
            cultivation_type: "strawberry"
          }
        ],
        name: "Τετράνυχος (Tetranychus urticae)",
        type: "GDD_Pest",
        pestBaseTemp: 12.0,
        criticalGddValues: { firstGeneration: 150, rapidGrowthThreshold: 320 },
        activityTempRange: { min: 25, max: 35 },
        activityHumidityRange: { min: 30, max: 50 },
        notes: "Γενικευμένος εχθρός που ευνοείται από ζεστές και ξηρές συνθήκες. Αναστέλλεται από υψηλή υγρασία και βροχή."
      }
  }
};

const PESTICIDE_PROFILE =
  {
    fungicides : {
      copperHydroxide: {
        name: "Υδροξείδιο του Χαλκού",
        activeIngredientClass: "Ανόργανο (M1)",
        type: "Επαφής",
        residualDays: 10,
        washoffFactor: 0.06,
        uvDegradationFactor: 0.01,
        targetPathogens: ["Περονόσπορος", "Φουζικλάδιο Μηλιάς"]
      },
      azoxystrobin: {
        name: "Αζοξυστρομπίνη",
        activeIngredientClass: "Στρομπιλουρίνη (QoI - 11)",
        type: "Διασυστηματικό",
        residualDays: 14,
        washoffFactor: 0.02,
        uvDegradationFactor: 0.03,
        targetPathogens: ["Ωίδιο", "Περονόσπορος"]
      },
      tebuconazole: {
        name: "Τεβουκοναζόλη",
        activeIngredientClass: "DMI (Τριαζόλη - 3)",
        type: "Διασυστηματικό",
        residualDays: 12,
        washoffFactor: 0.03,
        uvDegradationFactor: 0.04,
        targetPathogens: ["Ωίδιο", "Τεφρά Σήψη"]
      },
      sulfur: {
        name: "Θείο",
        activeIngredientClass: "Ανόργανο (M2)",
        type: "Επαφής",
        residualDays: 7,
        washoffFactor: 0.07,
        uvDegradationFactor: 0.02,
        targetPathogens: ["Ωίδιο", "Ακάρεα"]
      },
      cyprodinil_fludioxoni: {
        name: "Κυπροδινίλ + Φλουντιοξονίλ",
        activeIngredientClass: "Ανιλινοπυριμιδίνη (9) + Φαινυλπυρρόλη (12)",
        type: "Διασυστηματικό & Επαφής",
        residualDays: 14,
        washoffFactor: 0.03,
        uvDegradationFactor: 0.03,
        targetPathogens: ["Τεφρά Σήψη"]
      },
      copper_oxychloride: {
        name: "Οξυχλωριούχος Χαλκός",
        activeIngredientClass: "Ανόργανο (M1)",
        type: "Επαφής",
        residualDays: 10,
        washoffFactor: 0.06,
        uvDegradationFactor: 0.01,
        targetPathogens: ["Περονόσπορος", "Φουζικλάδιο Μηλιάς", "Αλτερνάρια"]
      },
      folpet: {
        name: "Folpet (Φολπέτ)",
        activeIngredientClass: "Φθαλιμίδιο (M4)",
        type: "Επαφής",
        residualDays: 7,
        washoffFactor: 0.05,
        uvDegradationFactor: 0.05,
        targetPathogens: ["Περονόσπορος", "Φουζικλάδιο Μηλιάς"]
      },
  },
  insecticides: {
      deltamethrin: {
        name: "Deltamethrin",
        activeIngredientClass: "Πυρεθροειδές (3A)",
        type: "Επαφής & Στομάχου",
        residualDays: 7,
        washoffFactor: 0.05,
        uvDegradationFactor: 0.07,
        targetPathogens: ["Δάκος", "Μαργαρώνια"]
      },
      spinosad: {
        name: "Spinosad",
        activeIngredientClass: "Φυσικό (5)",
        type: "Βιολογικό",
        residualDays: 7,
        washoffFactor: 0.04,
        uvDegradationFactor: 0.08,
        targetPathogens: ["Tuta absoluta", "Πυρηνοτρήτης"]
      },
      acetamiprid: {
        name: "Acetamiprid (Ασεταμιπρίδ)",
        activeIngredientClass: "Νεονικοτινοειδές (4A)",
        type: "Διασυστηματικό",
        residualDays: 14,
        washoffFactor: 0.02,
        uvDegradationFactor: 0.04,
        note: "Εγκεκριμένο για outdoor χρήση στην EU. PHI check ανά καλλιέργεια.",
        targetPathogens: ["Αφίδες", "Αλευρώδεις"]
      },
      dimethoate_olive: {
        name: "Dimethoate (Διμεθοάτη)",
        activeIngredientClass: "Οργανοφωσφορικό (1B)",
        type: "Διασυστηματικό & Επαφής",
        residualDays: 14,
        washoffFactor: 0.03,
        uvDegradationFactor: 0.04,
        note: "Ελέγξτε εθνική εγκριτική λίστα ELGO-DIMITRA πριν τη χρήση.",
        targetPathogens: ["Δάκος", "Μύγα της Μεσογείου"]
      },
      bt: {
        name: "Bacillus thuringiensis (Bt)",
        activeIngredientClass: "Βιολογικό (Τοξίνη - 11A)",
        type: "Στομάχου",
        residualDays: 5,
        washoffFactor: 0.03,
        uvDegradationFactor: 0.10,
        targetPathogens: ["Tuta absoluta", "Μαργαρώνια (προνύμφες)"]
      },
      pirimicarb: {
        name: "Pirimicarb",
        activeIngredientClass: "Καραβαμιδικό (1A)",
        type: "Εκλεκτικό Διασυστηματικό",
        residualDays: 9,
        washoffFactor: 0.02,
        uvDegradationFactor: 0.04,
        targetPathogens: ["Αφίδες"]
      },
      cyantraniliprole: {
        name: "Cyantraniliprole",
        activeIngredientClass: "Διαμίδη (28)",
        type: "Διασυστηματικό",
        residualDays: 14,
        washoffFactor: 0.02,
        uvDegradationFactor: 0.03,
        targetPathogens: ["Tuta absoluta", "Αλευρώδεις", "Αφίδες"]
      }
    },

    acaricides: {
      abamectin: {
        name: "Abamectin",
        activeIngredientClass: "Αβερμεκτίνη (6)",
        type: "Διαφυλλικό",
        residualDays: 12,
        washoffFactor: 0.03,
        uvDegradationFactor: 0.06,
        targetPathogens: ["Τετράνυχος"]
      },
      spirodiclofen: {
        name: "Spirodiclofen",
        activeIngredientClass: "Τετρονικό Οξύ (23)",
        type: "Επαφής",
        residualDays: 15,
        washoffFactor: 0.02,
        uvDegradationFactor: 0.03,
        targetPathogens: ["Τετράνυχος"]
      },
      summer_oil: {
        name: "Θερινός Πολτός",
        activeIngredientClass: "Ορυκτέλαιο",
        type: "Επαφής (Ασφυκτικό)",
        residualDays: 7,
        washoffFactor: 0.07,
        uvDegradationFactor: 0.01,
        targetPathogens: ["Ακάρεα", "Αφίδες", "Κοκκοειδή"]
      }
    },

    combinationProducts: {
      boscalid_pyraclostrobin: {
        name: "Boscalid + Pyraclostrobin",
        activeIngredientClass: "Καροξαμίδη (7) + QoI (11)",
        type: "Διασυστηματικό & Διαφυλλικό",
        residualDays: 14,
        washoffFactor: 0.02,
        uvDegradationFactor: 0.03,
        targetPathogens: ["Ωίδιο", "Τεφρά Σήψη"]
      },
      lambda_cyhalothrin: {
        name: "Lambda-cyhalothrin (Λάμδα-σαϊχαλοθρίν)",
        activeIngredientClass: "Πυρεθροειδές (3A)",
        type: "Επαφής",
        residualDays: 7,
        washoffFactor: 0.04,
        uvDegradationFactor: 0.06,
        note: "Ελέγξτε εθνική εγκριτική λίστα ELGO-DIMITRA.",
        targetPathogens: ["Αφίδες", "Αλευρώδεις", "Δάκος"]
      }
    }

  };


const SOIL_PROFILE = {
  sandy: {
    name: "Αμμώδης Πηλός",
    description:
      "Ελαφρύ, καλά στραγγιζόμενο έδαφος με καλή αεροπερατότητα αλλά χαμηλή ικανότητα συγκράτησης νερού και θρεπτικών στοιχείων. Συνηθισμένο σε παράκτιες περιοχές.",
    texture_class: "sandy",
    drainage_class: "FAST",

    // ---- Nutrient behavior (keep your existing logic) ----
    leachingFactorN: 0.15,
    kFixationFactor: 0.05,
    fAvailP: { peak: 6.5, stdev: 0.5 },
    fAvailK: { peak: 6.8, stdev: 0.8 },
    fAvailFe: { peak: 6.2, stdev: 0.4 },

    // ---- NEW: Soil hydraulic properties ----
    hydraulics: {
      field_capacity: 12,   // % v/v (typical sandy: ~10–15)
      wilting_point: 5,     // % v/v (typical sandy: ~3–7)
      saturation: 35,       // % v/v (porosity proxy; sandy ~30–40)
      readily_available_fraction: 0.45 // RAW fraction of TAW (rule-of-thumb)
    },

    physical: {
      bulk_density: 1.55,
      infiltration_mm_h: 25,
      stone_fraction: 0.05
    },

    notes: [
      "Υψηλός κίνδυνος έκπλυσης αζώτου (χαμηλή CEC/άργιλος).",
      "Χαμηλός κίνδυνος δέσμευσης καλίου.",
      "Γρήγορες αρδεύσεις/συχνότερα ποτίσματα προτιμώνται (μικρό απόθεμα διαθέσιμου νερού)."
    ]
  },

  loamy: {
    name: "Πηλώδες",
    description:
      "Ιδανικό γεωργικό έδαφος με ισορροπημένη αναλογία άμμου, ιλύος και αργίλου. Καλή δομή, αερισμός και συγκράτηση νερού/θρεπτικών.",
    texture_class: "loamy",
    drainage_class: "MODERATE",

    leachingFactorN: 0.10,
    kFixationFactor: 0.15,
    fAvailP: { peak: 6.7, stdev: 0.6 },
    fAvailK: { peak: 7.0, stdev: 1.0 },
    fAvailFe: { peak: 6.4, stdev: 0.5 },

    hydraulics: {
      field_capacity: 25,   // % v/v (loam ~20–30)
      wilting_point: 12,    // % v/v (loam ~10–15)
      saturation: 45,       // % v/v (loam ~40–50)
      readily_available_fraction: 0.50
    },

    physical: {
      bulk_density: 1.35,
      infiltration_mm_h: 12,
      stone_fraction: 0.05
    },

    notes: [
      "Μέτριος κίνδυνος έκπλυσης αζώτου (καλή ισορροπία αποστράγγισης/συγκράτησης).",
      "Μέτριος κίνδυνος δέσμευσης καλίου.",
      "Καλή απόκριση σε προγράμματα άρδευσης με μεσαίες δόσεις."
    ]
  },

  clay_loamy: {
    name: "Αργιλώδες Πηλώδες",
    description:
      "Βαρύτερο έδαφος με σημαντικό ποσοστό αργίλου. Υψηλή συγκράτηση νερού/θρεπτικών αλλά επιρρεπές σε κακή αποστράγγιση και συμπίεση.",
    texture_class: "clay_loamy",
    drainage_class: "SLOW",

    leachingFactorN: 0.05,
    kFixationFactor: 0.25,
    fAvailP: { peak: 6.8, stdev: 0.6 },
    fAvailK: { peak: 7.0, stdev: 1.0 },
    fAvailFe: { peak: 6.5, stdev: 0.5 },

    hydraulics: {
      field_capacity: 40,   // % v/v (clay loam ~30–36)
      wilting_point: 22,    // % v/v (clay loam ~16–22)
      saturation: 50,       // % v/v (clay loam ~45–55)
      readily_available_fraction: 0.55
    },

    physical: {
      bulk_density: 1.30,
      infiltration_mm_h: 6,
      stone_fraction: 0.06
    },

    notes: [
      "Χαμηλός κίνδυνος έκπλυσης αζώτου (υψηλότερη συγκράτηση).",
      "Υψηλότερος κίνδυνος δέσμευσης καλίου λόγω άργιλου.",
      "Μεγαλύτερος κίνδυνος υδατοκορεσμού/ασφυξίας ρίζας μετά από έντονη βροχή ή υπεράρδευση."
    ]
  },

  calcareous_clay: {
    name: "Ασβεστούχο Αργιλώδες (Calcareous clay, υψηλού pH)",
    description:
      "Βαρύ αργιλώδες με ελεύθερο ανθρακικό ασβέστιο. Τείνει σε αλκαλικό pH (>7.5). Συχνό σε περιοχές της Ελλάδας/Μεσογείου.",
    texture_class: "calcareous_clay",
    drainage_class: "SLOW",

    leachingFactorN: 0.04,
    kFixationFactor: 0.30,
    fAvailP: { peak: 6.8, stdev: 0.6 },
    fAvailK: { peak: 7.0, stdev: 1.0 },
    fAvailFe: { peak: 6.5, stdev: 0.5 },

    hydraulics: {
      field_capacity: 36,   // % v/v (heavy clay ~34–40)
      wilting_point: 22,    // % v/v (heavy clay ~20–28)
      saturation: 52,       // % v/v (clay ~45–55)
      readily_available_fraction: 0.60
    },

    physical: {
      bulk_density: 1.25,
      infiltration_mm_h: 4,
      stone_fraction: 0.08
    },

    notes: [
      "Πολύ χαμηλός κίνδυνος έκπλυσης αζώτου.",
      "Πολύ υψηλός κίνδυνος δέσμευσης καλίου.",
      "Σε pH πεδίου ~7.8–8.2 η διαθεσιμότητα Fe συχνά περιορίζεται πολύ → χρήση χηλικών Fe όπου χρειάζεται.",
      "Πολύ αυξημένος κίνδυνος υδατοκορεσμού/κακής οξυγόνωσης ρίζας."
    ]
  }
};


const WATER_PROFILE = {
  excellent: {
    name: "Εξαιρετικής Ποιότητας (Χαμηλός Κίνδυνος Αλατότητας)",
    description: "Νερό με πολύ χαμηλή περιεκτικότητα σε άλατα, κατάλληλο για όλες τις καλλιέργειες και τύπους εδαφών χωρίς κίνδυνο συσσώρευσης αλάτων.",
    waterECw: 0.5, // dS/m
    notes: "Τυπική τιμή για αυτή την κατηγορία. Το μοντέλο θα υπολογίσει πολύ χαμηλή ή μηδενική απαίτηση έκπλυσης για τις περισσότερες καλλιέργειες."
  },
  good: {
    name: "Καλής Ποιότητας (Μέτριος Κίνδυνος Αλατότητας)",
    description: "Νερό με μέτρια περιεκτικότητα σε άλατα. Κατάλληλο για τις περισσότερες καλλιέργειες, αλλά μπορεί να απαιτείται κάποια έκπλυση για ευαίσθητες καλλιέργειες σε βαριά εδάφη.",
    waterECw: 1.2, // dS/m
    notes: "Συνηθισμένη τιμή για πολλά υπόγεια νερά στη Μεσόγειο. Το μοντέλο θα υπολογίσει μέτρια απαίτηση έκπλυσης για ευαίσθητες καλλιέργειες όπως φασόλια, καρότα ή εσπεριδοειδή."
  },
  marginal: {
    name: "Οριακής / Επιτρεπτής Χρήσης (Υψηλός Κίνδυνος Αλατότητας)",
    description: "Νερό με υψηλή περιεκτικότητα σε άλατα. Χρήση μόνο σε ανθεκτικές στο αλάτι καλλιέργειες με προσεκτική διαχείριση, συμπεριλαμβανομένης σημαντικής έκπλυσης για αποφυγή υποβάθμισης εδάφους.",
    waterECw: 2.2, // dS/m
    notes: "Δεν πρέπει να χρησιμοποιείται σε ευαίσθητες καλλιέργειες (π.χ. πυρηνόκαρπα, εσπεριδοειδή, φασόλια). Το μοντέλο θα υπολογίσει υψηλή απαίτηση έκπλυσης για ανθεκτικές καλλιέργειες όπως βαμβάκι ή κριθάρι."
  },
  poor: {
    name: "Κακής / Επικίνδυνης Ποιότητας (Πολύ Υψηλός Κίνδυνος Αλατότητας)",
    description: "Νερό με πολύ υψηλή περιεκτικότητα σε άλατα. Γενικά ακατάλληλο για άρδευση εκτός από τις πιο ανθεκτικές στο αλάτι καλλιέργειες σε εδάφη με άριστη αποστράγγιση. Η χρήση του έχει υψηλό κίνδυνο σοβαρής αλάτωσης.",
    waterECw: 3.5, // dS/m
    notes: "Η χρήση απαιτεί εξειδικευμένη διαχείριση. Το μοντέλο θα υπολογίσει πολύ υψηλή απαίτηση έκπλυσης και θα εμφανίσει έντονη προειδοποίηση για τους κινδύνους."
  }
};




////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////      USER MANAGEMENT         //////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


async function getAllUsers() {
  let all = [];
  let page = 1;
  let pageSize = 100; // Max per page allowed by TagoIO is typically 100
  let keepFetching = true;

  while (keepFetching) {
    const users = await account.run.listUsers({
      page,
      amount: pageSize,
      fields: ["id", "name", "email", "tags"],
    });

    if (users.length === 0) {
      keepFetching = false;
    } else {
      all = all.concat(users);
      page++;
    }
  }
  return all;
}

/* Send Push Notification */
async function sendPush(account, titleToSend, messageToSend, userID){
  console.log('Mocking sending message ', titleToSend, ': ', messageToSend, ', to user: ', userID, '\n');
  /*
  //context.log(`Dashboard URL: ${dashboard_url}`);
  await account.run.notificationCreate(userID, {
  title: titleToSend,
  message: messageToSend,
  /*buttons: [{
      "label": label,
      "url": dashboard_url,
      "color": "red"
  }],
  buttons_autodisable: false
  });     */
}

async function sendPushToAdmin(titleToSend, messageToSend) {
  await sendPush(titleToSend, messageToSend, '679c9eaf3370380008ee7398');
}

async function sendPushByUsers(account, titleToSend, messageToSend, users) {
  console.log('users: ', users)
  for (user of users) {
    await sendPush(account, titleToSend, messageToSend, user.id);
  }
}

async function sendPushByAccesses(account, titleToSend, messageToSend, accesses) {

  for (let idx = 0; idx < accesses.length; idx++) {
    const users = allUsers.filter(user =>
      user.tags?.some(tag => tag.key === "access" && tag.value === accesses[idx])
    );

    for (const user of users) {
      await sendPush(account, titleToSend, messageToSend, user.id);
    }
  }
}

async function getFieldAccesses(field) {

  let fieldId = field.tags.filter(item => item.key === 'fieldId')?.[0];
  let name = field.tags.filter(item => item.key === 'name')?.[0];
  if (fieldId === undefined) {
    return [];
  }
  fieldId = fieldId.value;
  console.log('Searching dashboard: ', name, 'by fieldId: ', fieldId);
  // Missing/renamed dashboard must NOT crash the field's processing (used only for notification
  // access tags). Fail soft — skip notifications, keep computing + writing the field_bundle.
  let dashboardInfo;
  try {
    dashboardInfo = await account.dashboards.info(fieldId);
  } catch (e) {
    console.log(`Dashboard '${fieldId}' not found for field '${name?.value}' — skipping access lookup. Update the field's fieldId tag. ${e && e.message ? e.message : e}`);
    return [];
  }

  const values = (dashboardInfo.tags || [])
    .filter(obj => ((obj.key === "access") && (obj.value !== "MACC_Manager")))
    .map(obj => obj.value);

  return values;
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function linearSlope(y) {
  const n = y.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumX2 += i * i;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumX2 - sumX * sumX;
  return denominator === 0 ? 0 : numerator / denominator;
}

function getCurrentSeason(date = new Date()) {
  const month = date.getUTCMonth(); // 0 = January, 11 = December

  if (month >= 2 && month <= 4) {
    return 'Spring';  // March - May
  } else if (month >= 5 && month <= 7) {
    return 'Summer';  // June - August
  } else if (month >= 8 && month <= 10) {
    return 'Autumn';  // September - November
  } else {
    return 'Winter';  // December - February
  }
}

function getPlantAge(plantationYearStr) {
  const currentYear = new Date().getFullYear();
  const plantationYear = parseInt(plantationYearStr, 10);

  if (isNaN(plantationYear) || plantationYear > currentYear) {
    console.log("Warning: Invalid plantation year. Setting 4 year old by default!");
    return 4;
  }

  return currentYear - plantationYear;
}

function isNowInPeriod(period) {
  if (!period) return false;

  // Legacy string format: "Start: <iso>, End: <iso>"
  if (typeof period === "string") {
    const match = period.match(/Start:\s*([\d\-T:.Z]+),\s*End:\s*([\d\-T:.Z]+)/);
    if (!match) {
      // Not a legacy period string; treat as invalid
      return false;
    }
    const start = new Date(match[1]);
    const end = new Date(match[2]);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now >= start && now <= end;
  }

  // v3 object format: { start: "<iso>", end: "<iso>" }
  if (typeof period === "object") {
    const startStr = period.start;
    const endStr = period.end;
    if (!startStr || !endStr) return false;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now >= start && now <= end;
  }

  return false;
}
function groupMeasurementsByVariable(measurements) {
  const result = {};

  for (const measurement of measurements) {
    const variable = measurement.variable;

    if (!result[variable]) {
      result[variable] = [];
    }

    result[variable].push(measurement);
  }

  return result;
}


/**
 * Resolve irrigation stage for a crop using v3 per-crop periods (preferred),
 * with legacy root-level period strings as fallback.
 */
function resolveStageForCrop(crop, legacyRoot = {}) {
  const gen = crop?.cultivation_type_general || legacyRoot?.cultivation_type_general || legacyRoot?.cultivation_type_general;
  const periods = crop?.periods || {};

  // Helper to pick a period from v3 object first, else legacy root string.
  const pick = (v3Key, legacyKey) => {
    const p = periods?.[v3Key];
    if (p && typeof p === "object") return p;
    const legacy = legacyRoot?.[legacyKey];
    if (legacy && typeof legacy === "string") return legacy;
    return null;
  };

  // Vegetables + vine crops
  if (gen === "vegetableCrops" || gen === "vineCrops" || gen === "vegetable") {
    if (isNowInPeriod(pick("transplantation", "transplantation_period"))) return "transplant";
    if (isNowInPeriod(pick("vegetative_growth", "vegetative_growth_period"))) return "vegetative";
    if (isNowInPeriod(pick("flowering", "flowering_period"))) return "flowering";
    if (isNowInPeriod(pick("harvest", "harvest_period"))) return "fruiting";
    return "vegetative";
  }

  // Olives (perennial)
  if (gen === "olive") {
    if (isNowInPeriod(pick("dormant", "dormant_period"))) return "vegetative"; // dormant treated as low-demand vegetative
    if (isNowInPeriod(pick("flowering", "flowering_period"))) return "flowering";
    if (isNowInPeriod(pick("fruit_set", "fruit_set_period"))) return "fruit_dev";
    if (isNowInPeriod(pick("ripening", "ripening_period"))) return "ripening";
    return "vegetative";
  }

  // Default fallback
  // B5 FIX: Νέα crop groups πριν default
  if (gen === "cerealCrops") {
    if (isNowInPeriod(pick("germination", "germination_period"))) return "germination";
    if (isNowInPeriod(pick("tillering", "tillering_period"))) return "tillering";
    if (isNowInPeriod(pick("stem_elongation", "stem_elongation_period"))) return "stem_elongation";
    if (isNowInPeriod(pick("anthesis", "anthesis_period"))) return "anthesis";
    if (isNowInPeriod(pick("grain_filling", "grain_filling_period"))) return "grain_filling";
    return "vegetative";
  }

  if (gen === "stoneFruits") {
    if (isNowInPeriod(pick("dormancy", "dormancy_period"))) return "dormancy";
    if (isNowInPeriod(pick("bloom", "bloom_period"))) return "bloom";
    if (isNowInPeriod(pick("fruit_dev", "fruit_dev_period"))) return "fruit_dev";
    if (isNowInPeriod(pick("harvest", "harvest_period"))) return "harvest";
    return "vegetative";
  }

  if (gen === "citrusFruits") {
    if (isNowInPeriod(pick("flowering", "flowering_period"))) return "flowering";
    if (isNowInPeriod(pick("fruit_set", "fruit_set_period"))) return "fruit_set";
    if (isNowInPeriod(pick("fruit_dev", "fruit_dev_period"))) return "fruit_dev";
    return "vegetative";
  }

  if (gen === "nutCrops") {
    if (isNowInPeriod(pick("dormancy", "dormancy_period"))) return "dormancy";
    if (isNowInPeriod(pick("bloom", "bloom_period"))) return "bloom";
    if (isNowInPeriod(pick("fruit_dev", "fruit_dev_period"))) return "fruit_dev";
    if (isNowInPeriod(pick("harvest", "harvest_period"))) return "harvest";
    return "vegetative";
  }

  if (["industrialCrops","subTropicalFruits","pomeFruits","specialtyMediterranean","ornamentalCrops"].includes(gen)) {
    if (isNowInPeriod(pick("flowering", "flowering_period"))) return "flowering";
    if (isNowInPeriod(pick("harvest", "harvest_period"))) return "harvest";
    if (isNowInPeriod(pick("fruit_dev", "fruit_dev_period"))) return "fruit_dev";
    return "vegetative";
  }

  // Original default fallback
  return legacyRoot?.stage || crop?.stage || "vegetative";
}

// ── E3: GDD-based Crop Phenology ────────────────────────────────────────
// Ref: Paredes et al. 2025 (FAO56rev Tables 5-6), McMaster & Wilhelm 1997
// Uses accumulated thermal time to determine crop growth stage.
// More accurate than calendar (±5 days vs ±15 days).

// Accumulates crop-specific GDD (separate from pest GDD)
function calculate_CropGDD(hourTick, measurements, parameters) {
  if (!hourTick) return [];
  const crop = CROP_PROFILE?.[parameters?.cultivation_type_general]?.[parameters?.cultivation_type];
  if (!crop?.stage_gdd_thresholds) return []; // No thresholds defined

  let airTemp;
  if (measurements?.data?.air_temperature) airTemp = Number(measurements.data.air_temperature[0]?.value);
  else if (measurements?.data?.temperature) airTemp = Number(measurements.data.temperature[0]?.value);
  if (!Number.isFinite(airTemp)) return [];

  // Use crop Tbase from optimal_temp_range.min (Paredes 2025)
  const T_base = Number(crop.optimal_temp_range?.min) || 0;
  const T_upper = Number(crop.optimal_temp_range?.max) || 35;
  const T_eff = Math.min(airTemp, T_upper);
  const gdd_hour = T_eff > T_base ? (T_eff - T_base) / 24 : 0;

  // Read previous accumulated value
  const prevAccum = getVal(measurements, "gdd_crop_accumulated", 0);
  const newAccum = prevAccum + gdd_hour;

  return [
    { variable: "gdd_crop_hourly", value: parseFloat(gdd_hour.toFixed(3)) },
    { variable: "gdd_crop_accumulated", value: parseFloat(newAccum.toFixed(1)) },
  ];
}

// Resolves crop growth stage from accumulated GDD
// Returns stage name or null if thresholds not available
function resolveStageByGDD(parameters, measurements) {
  const crop = CROP_PROFILE?.[parameters?.cultivation_type_general]?.[parameters?.cultivation_type];
  if (!crop?.stage_gdd_thresholds) return null;

  const accumulatedGDD = getVal(measurements, "gdd_crop_accumulated", 0);
  if (accumulatedGDD <= 0) return null;

  const thresholds = crop.stage_gdd_thresholds;
  // Sort stages by GDD threshold descending → find highest matching
  const stages = Object.entries(thresholds).sort((a, b) => b[1] - a[1]);

  for (const [stageName, gddThreshold] of stages) {
    if (accumulatedGDD >= gddThreshold) {
      return stageName;
    }
  }
  return stages[stages.length - 1]?.[0] || null; // lowest stage
}
// ── End E3 functions ────────────────────────────────────────────────────

function getFieldParameters(field) {
  const name = field.tags.filter(item => item.key === 'name')?.[0].value;
  let configuration = field.tags.filter(item => item.key === 'configuration')?.[0];

  if (configuration == undefined) {
    console.log('Field: ', name, ' is not set!');
    return undefined;
  }

  try {
    configuration = JSON.parse(configuration.value);
  } catch (e) {
    console.log(
      'Configuration is not in JSON format for field ',
      name,
      '! Configuration: ',
      configuration.value,
      '. Exception error: ',
      e
    );
    return undefined;
  }

  // Optional: irrigation notification flag from tags
  let irrigation_notification = field.tags.filter(item => item.key === 'irrigation_notification')?.[0];
  if (irrigation_notification) {
    irrigation_notification = irrigation_notification.value === 'true';
  } else {
    irrigation_notification = false;
  }
  configuration.irrigation_notification = irrigation_notification;
  configuration.name = name;

  // Initialize
  configuration.stage = undefined; // backward-compat "primary crop stage"
  configuration.plant_age = 0;

  // --- MULTI-CROP (v3) preferred ---
  const hasCrops = Array.isArray(configuration.crops) && configuration.crops.length > 0;
  if (hasCrops) {
    // Normalize ids + resolve per-crop stage from per-crop periods
    configuration.crops = configuration.crops
      .filter((c) => c && c.cultivation_type_general && c.cultivation_type)
      .map((c, idx) => {
        const id = c.id || `${c.cultivation_type_general}:${c.cultivation_type}:${idx + 1}`;
        const periods = c.periods || {};
        const stage = resolveStageForCrop({ ...c, periods }, configuration);
        return {
          ...c,
          id,
          periods,
          stage,
        };
      });

    // Primary crop convenience (backward compatibility)
    const primary = configuration.crops[0] || {};
    configuration.cultivation_type_general = configuration.cultivation_type_general ?? primary.cultivation_type_general;
    configuration.cultivation_type = configuration.cultivation_type ?? primary.cultivation_type;
    configuration.stage = primary.stage;

    // Plant age (if primary crop is olive)
    if (primary.cultivation_type_general === 'olive') {
      try {
        const plantationYear = primary.plantation_year ?? configuration.plantation_year;
        configuration.plant_age = getPlantAge(plantationYear);
      } catch (e) {
        console.log('Invalid plantation_year for field', name, primary.plantation_year ?? configuration.plantation_year, e);
        configuration.plant_age = 0;
      }
    }
  } else {
    // --- SINGLE-CROP legacy path (configuration without crops array) ---
    const general = configuration.cultivation_type_general;

    // Vegetables + vine crops (legacy root-level period strings)
    if (general === 'vegetableCrops' || general === 'vineCrops') {
      try {
        if (configuration.transplantation_period && isNowInPeriod(configuration.transplantation_period)) {
          configuration.stage = 'transplant';
        } else if (configuration.vegetative_growth_period && isNowInPeriod(configuration.vegetative_growth_period)) {
          configuration.stage = 'vegetative';
        } else if (configuration.flowering_period && isNowInPeriod(configuration.flowering_period)) {
          configuration.stage = 'flowering';
        } else if (configuration.harvest_period && isNowInPeriod(configuration.harvest_period)) {
          configuration.stage = 'fruiting';
        } else {
          configuration.stage = 'vegetative';
        }
      } catch (e) {
        console.log('Error resolving stage for vegetable/vine crop', name, e);
        configuration.stage = 'vegetative';
      }
    }

    // Olives (legacy root-level period strings)
    if (general === 'olive') {
      try {
        if (configuration.dormant_period && isNowInPeriod(configuration.dormant_period)) {
          configuration.stage = 'vegetative';
        } else if (configuration.flowering_period && isNowInPeriod(configuration.flowering_period)) {
          configuration.stage = 'flowering';
        } else if (configuration.fruit_set_period && isNowInPeriod(configuration.fruit_set_period)) {
          configuration.stage = 'fruit_dev';
        } else if (configuration.ripening_period && isNowInPeriod(configuration.ripening_period)) {
          configuration.stage = 'ripening';
        } else {
          configuration.stage = 'vegetative';
        }
      } catch (e) {
        console.log('Error resolving stage for olive', name, e);
        configuration.stage = 'vegetative';
      }

      try {
        configuration.plant_age = getPlantAge(configuration.plantation_year);
      } catch (e) {
        console.log('Invalid plantation_year for field', name, configuration.plantation_year, e);
        configuration.plant_age = 0;
      }
    }
  }

  configuration.season = getCurrentSeason();
  return configuration;
}

// Helper: safely read a value from measurements.data whether it's a Tago series array or a scalar
function getVal(measurements, key, defaultValue = 0) {
  const v = measurements?.data?.[key];
  if (v === undefined || v === null) return defaultValue;
  if (Array.isArray(v)) {
    const vv = v[0]?.value;
    return (vv === undefined || vv === null) ? defaultValue : vv;
  }
  if (typeof v === "object" && "value" in v) {
    const vv = v.value;
    return (vv === undefined || vv === null) ? defaultValue : vv;
  }
  return v;
}

// Helper: normalize Tago series/scalars to a number (prevents NaN when series is [{value:...}])
function readVal(series) {
  if (series == null) return NaN;
  if (typeof series === "number") return series;
  if (Array.isArray(series)) {
    const first = series[0];
    if (first?.value !== undefined) return Number(first.value);
    return Number(first);
  }
  if (typeof series === "object" && series.value !== undefined) {
    return Number(series.value);
  }
  return Number(series);
}

// B1/B2 helper: asymmetric trapezoidal temperature response (0..1)
function fTempAsymmetric(T, Tmin, Topt, Tmax) {
  if (!Number.isFinite(T) || !Number.isFinite(Tmin) || !Number.isFinite(Topt) || !Number.isFinite(Tmax)) {
    return 0.5; // safe default
  }
  if (T <= Tmin || T >= Tmax) return 0.01; // min floor (avoid divide-by-zero downstream)
  if (T <= Topt) return (T - Tmin) / (Topt - Tmin);
  return (Tmax - T) / (Tmax - Topt);
}

// B5 helper: ET0 (mm/day) using Hargreaves-Samani (requires only temperatures)
function calculate_ET0_Hargreaves(T_avg, T_max, T_min, dayOfYear, latitude_deg) {
  if (!Number.isFinite(T_avg) || !Number.isFinite(T_max) || !Number.isFinite(T_min)) return null;
  if (!Number.isFinite(dayOfYear) || !Number.isFinite(latitude_deg)) return null;

  const lat_rad = latitude_deg * Math.PI / 180;

  // Extraterrestrial radiation Ra (MJ/m²/day) — FAO-56 Eq. 21
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear / 365);
  const delta = 0.409 * Math.sin(2 * Math.PI * dayOfYear / 365 - 1.39);
  const ws = Math.acos(-Math.tan(lat_rad) * Math.tan(delta));
  const Ra = (24 * 60 / Math.PI) * 0.0820 * dr *
    (ws * Math.sin(lat_rad) * Math.sin(delta) +
     Math.cos(lat_rad) * Math.cos(delta) * Math.sin(ws));

  const TD = Math.max(0, T_max - T_min);
  const ET0 = 0.0023 * (T_avg + 17.8) * Math.sqrt(TD) * Ra;

  return Math.max(0, ET0); // mm/day
}

// ── D5: FAO-56 Penman-Monteith ET0 (Allen et al. 1998, Eq. 6) ──────────
// Primary ET0. Falls back to Hargreaves if wind/radiation missing.
// Inputs: T in °C, RH in %, u2 in m/s, Rs in MJ/m²/day, elev in m
function calculate_ET0_PM(T_avg, T_max, T_min, RH_mean, u2_ms, Rs_MJ, dayOfYear, latitude_deg, elevation_m) {
  if (!Number.isFinite(T_avg) || !Number.isFinite(T_max) || !Number.isFinite(T_min)) return null;
  if (!Number.isFinite(RH_mean) || !Number.isFinite(u2_ms)) return null;
  if (!Number.isFinite(dayOfYear) || !Number.isFinite(latitude_deg)) return null;
  const elev = Number.isFinite(elevation_m) ? elevation_m : 100;

  // Psychrometric constant γ (kPa/°C) — Eq. 8
  const P_atm = 101.3 * Math.pow((293 - 0.0065 * elev) / 293, 5.26);
  const gamma = 0.000665 * P_atm;

  // Slope of saturation vapour pressure Δ (kPa/°C) — Eq. 13
  const es_Tavg = 0.6108 * Math.exp(17.27 * T_avg / (T_avg + 237.3));
  const delta_slope = 4098 * es_Tavg / Math.pow(T_avg + 237.3, 2);

  // Saturation vapour pressure es (kPa) — Eq. 11
  const es_Tmax = 0.6108 * Math.exp(17.27 * T_max / (T_max + 237.3));
  const es_Tmin = 0.6108 * Math.exp(17.27 * T_min / (T_min + 237.3));
  const es = (es_Tmax + es_Tmin) / 2;

  // Actual vapour pressure ea (kPa) — Eq. 17
  const ea = (RH_mean / 100) * es;

  // Extraterrestrial radiation Ra (MJ/m²/day) — Eq. 21
  const lat_rad = latitude_deg * Math.PI / 180;
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear / 365);
  const delta_dec = 0.409 * Math.sin(2 * Math.PI * dayOfYear / 365 - 1.39);
  const ws = Math.acos(-Math.tan(lat_rad) * Math.tan(delta_dec));
  const Ra = (24 * 60 / Math.PI) * 0.0820 * dr *
    (ws * Math.sin(lat_rad) * Math.sin(delta_dec) +
     Math.cos(lat_rad) * Math.cos(delta_dec) * Math.sin(ws));

  // Solar radiation Rs — estimate if not measured
  let Rs = Rs_MJ;
  if (!Number.isFinite(Rs) || Rs <= 0) {
    const kRs = 0.16; // coastal Mediterranean
    Rs = kRs * Math.sqrt(Math.max(0, T_max - T_min)) * Ra;
  }

  // Clear-sky radiation Rso — Eq. 37
  const Rso = (0.75 + 2e-5 * elev) * Ra;

  // Net shortwave Rns — Eq. 38
  const Rns = (1 - 0.23) * Rs;

  // Net longwave Rnl — Eq. 39
  const sigma = 4.903e-9;
  const TmaxK4 = Math.pow(T_max + 273.16, 4);
  const TminK4 = Math.pow(T_min + 273.16, 4);
  const Rs_Rso = Rso > 0 ? Math.min(Rs / Rso, 1) : 0.5;
  const Rnl = sigma * ((TmaxK4 + TminK4) / 2) *
    (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * Rs_Rso - 0.35);

  // Net radiation Rn — Eq. 40
  const Rn = Rns - Rnl;

  // FAO-56 Equation 6
  const numer = 0.408 * delta_slope * (Rn - 0) +
    gamma * (900 / (T_avg + 273)) * u2_ms * (es - ea);
  const denom = delta_slope + gamma * (1 + 0.34 * u2_ms);
  if (denom === 0) return null;

  return Math.max(0, numer / denom); // mm/day
}
// ── End D5 function ─────────────────────────────────────────────────────


// Helper: compare if two timestamps fall on the same local day (Europe/Athens by default)
function isSameLocalDay(tsA, tsB, tz = "Europe/Athens") {
  if (!tsA || !tsB) return false;
  try {
    const a = moment(tsA).tz(tz).format("YYYY-MM-DD");
    const b = moment(tsB).tz(tz).format("YYYY-MM-DD");
    return a === b;
  } catch (_e) {
    return false;
  }
}

/**
 * Supports multiple crops per field.
 *
 * Backward compatible:
 * - if configuration.crops is absent, returns a single-item array derived from the base configuration.
 *
 * Expected multi-crop format (example):
 * configuration.crops = [
 *   { id: "olive1", cultivation_type_general: "olive", cultivation_type: "koroneiki", stage: "flowering" },
 *   { id: "veg1", cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", stage: "fruiting" }
 * ]
 */
function normalizeFieldCrops(configuration) {
  if (!configuration) return [];

  const crops = Array.isArray(configuration.crops) ? configuration.crops : null;

  // Legacy single-crop fallback (no crops array)
  if (!crops || crops.length === 0) {
    const baseCrop = {
      id: `${configuration.cultivation_type_general || "crop"}:${configuration.cultivation_type || "unknown"}:1`,
      cultivation_type_general: configuration.cultivation_type_general,
      cultivation_type: configuration.cultivation_type,
      periods: {}, // unknown in legacy base config unless provided elsewhere
      stage: configuration.stage || resolveStageForCrop(configuration, configuration),
      plantation_year: configuration.plantation_year ?? null,
    };
    return [baseCrop];
  }

  // Multi-crop v3: ensure id + periods + stage exist
  return crops
    .filter((c) => c && c.cultivation_type_general && c.cultivation_type)
    .map((c, idx) => {
      const id = c.id || `${c.cultivation_type_general}:${c.cultivation_type}:${idx + 1}`;
      const periods = c.periods || {};
      const stage = c.stage || resolveStageForCrop({ ...c, periods }, configuration);
      return {
        id,
        cultivation_type_general: c.cultivation_type_general,
        cultivation_type: c.cultivation_type,
        periods,
        stage,
        plantation_year: c.plantation_year ?? null,
      };
    });
}


function getManualIrrigationParameters(configuration){

  let automatic_irrigation = configuration.automatic_irrigation;
  if (automatic_irrigation != undefined) {
    automatic_irrigation = automatic_irrigation === true;
  }
  else return undefined;

  let manual_high_threshold;
  let manual_low_threshold;
  if (automatic_irrigation === false) {
    manual_high_threshold = parseFloat(configuration.manual_high_threshold);
    manual_low_threshold = parseFloat(configuration.manual_low_threshold);
  }

  return {
    isAuto: automatic_irrigation,
    manual_high_threshold: manual_high_threshold,
    manual_low_threshold: manual_low_threshold
  };
}
function extractDailySeries(measurements, variable, daysBack = 7) {
  const now = new Date();
  const dayBuckets = {};

  for (const m of measurements) {
    const date = new Date(m.time);
    const key = date.toISOString().split("T")[0];
    if (!dayBuckets[key]) {
      dayBuckets[key] = 0;
    }
    dayBuckets[key] += m.value;
  }

  const series = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    series.push(dayBuckets[key] || 0);
  }

  return {
    today: series[0],      // η σημερινή τιμή
    series: series.reverse() // σειρά [παλαιότερα → σήμερα]
  };
}

// [ίδιο JSDoc όπως πριν]

async function irrigationTreeDecision(measurements, devToSendMeas, manual, parameters, users) {
  let title = '';
  let notifText = '';

  const config = treeConfigs[parameters.cultivation_type];

  let soil_moisture_measurements;
  if (measurements.data.water_soil === undefined) {
    if (measurements.data.soil_moisture === undefined) {
      return;
    }
    else {
      soil_moisture_measurements = measurements.data.soil_moisture;
    }
  }
  else {
    soil_moisture_measurements = measurements.data.water_soil;
  }
  const currentMoisture = soil_moisture_measurements[0].value;

  if (!manual.isAuto) {
    if (currentMoisture > manual.manual_high_threshold) {
      if (!(parameters.hasOwnProperty('irrigating')) || parameters.irrigating === true) {
        title = 'ΣΥΝΙΣΤΑΤΑΙ ΔΙΑΚΟΠΗ ΑΡΔΕΥΣΗΣ';
        notifText = `Συνίσταται διακοπή άρδευσης στην εγκατάσταση: ${parameters.name} καθώς η υγρασία εδάφους: ${currentMoisture} είναι άνω του ορίου!`;
        await sendPushByUsers(account, title, notifText, users);
        parameters.irrigating = false;
      }
      return { irrigate: false, method: "manual", parameters };
    } else if (currentMoisture < manual.manual_low_threshold) {
      if (!(parameters.hasOwnProperty('irrigating')) || parameters.irrigating === false) {
        title = 'ΣΥΝΙΣΤΑΤΑΙ ΑΡΔΕΥΣΗ';
        notifText = `Συνίσταται άρδευση στην εγκατάσταση: ${parameters.name} καθώς η υγρασία εδάφους: ${currentMoisture} είναι κάτω του ορίου!`;
        await sendPushByUsers(account, title, notifText, users);
        parameters.irrigating = true;
      }
      return { irrigate: true, method: "manual", parameters };
    }
    title = 'ΥΓΡΑΣΙΑ ΕΝΤΟΣ ΟΡΙΩΝ';
    return {parameters};
  }

  const slope = linearSlope([
    measurements.data.water_soil[0].value,
    measurements.data.water_soil[1].value,
    measurements.data.water_soil[2].value
  ]);

  const depth = avg(parameters.sensor_depths_cm);
  const moistureDeficitPct = Math.max(0, config.idealMoisture - currentMoisture);
  const deficitMm = (moistureDeficitPct / 100) * depth * 10;
  const litersPerPlant = deficitMm;

  const lphPerPlant = parameters.supply_flow_rate / parameters.total_plants;
  const soilAbsorption = { sandy: 75, pilodes: 25, silty_clay: 10, argilodes: 10 };
  const maxLph = soilAbsorption[parameters.soil_type] || 25;
  const maxDuration = (maxLph / lphPerPlant) * 60;

  const projectedMoisture = currentMoisture + slope * 2;
  const projectedDeficitPct = Math.max(0, config.idealMoisture - projectedMoisture);
  const projectedDeficitMm = (projectedDeficitPct / 100) * depth * 10;

  const baseKc = config.stageKc[parameters.growthStage] || 0.7;
  const seasonF = config.seasonFactors[parameters.season] || 1.0;
  const ageF = config.ageFactor(parameters.tree_age);
  const Kc = baseKc * seasonF * ageF;

  let radiationLux, windSpeed, airTemp, airHumidity;

  if (measurements.data.light_intensity) {
    radiationLux = measurements.data.light_intensity[0].value;
  }
  if (measurements.data.wind_speed_kmh) {
    windSpeed = measurements.data.wind_speed_kmh[0].value;
  }
  if (measurements.data.air_temperature) {
    airTemp = measurements.data.air_temperature[0].value;
  }
  if (measurements.data.air_humidity) {
    airHumidity = measurements.data.air_humidity[0].value;
  }
  const useET0 = (radiationLux !== undefined) && (windSpeed !== undefined) && (airTemp !== undefined);

  if (useET0) {
    const daysBack = 5
    let rainfall;
    let rainSeries;
    if (measurements.data.rain_height) {
      const rainData = extractDailySeries(measurements.data.rain_height, "rain_height", daysBack);
      rainfall = rainData.today;
      rainSeries = rainData.series;
    }
    const Rs = radiationLux / 100000;
    const Tmean = airTemp;


    // Hargreaves-Samani: χρήση πραγματικού T_max - T_min
    const T_max_irr = getVal(measurements, 'air_temperature_max', getVal(measurements, 'air_temperature', Tmean + 5));
    const T_min_irr = getVal(measurements, 'air_temperature_min', getVal(measurements, 'air_temperature', Tmean - 5));
    const TD_irr = Math.max(0, T_max_irr - T_min_irr);
    let et0Today = 0.0023 * (Tmean + 17.8) * Math.sqrt(TD_irr) * Rs;
    et0Today = Math.max(et0Today - rainfall, 0);

    let netEt0 = et0Today;
    // if (et0Series.length >= daysBack && rainSeries.length >= daysBack) {
    //   netEt0 = 0;
    //   for (let i = 0; i < daysBack; i++) {
    //     const d = Math.max(0, et0Series.at(-1 - i) - rainSeries.at(-1 - i));
    //     netEt0 += d;
    //   }
    // }

    const Etc = Kc * netEt0;

    if (currentMoisture >= config.idealMoisture - 2 && Etc < 5) {
      if (!(parameters.hasOwnProperty('irrigating')) || (parameters.irrigating === true)) {
        title = 'ΣΥΝΙΣΤΑΤΑΙ ΔΙΑΚΟΠΗ ΑΡΔΕΥΣΗΣ';
        notifText = `Συνίσταται διακοπή άρδευσης στην εγκατάσταση: ${parameters.name} λόγω χαμηλού ETc και ικανοποιητικής υγρασίας.`;
        await sendPushByUsers(account, title, notifText, users);
        parameters.irrigating = false;
      }
      return { irrigate: false, method: "et0", parameters };
    }

    let durationMin = (Etc / lphPerPlant) * 60;

    let stressAdj = 1;
    if (airTemp > 32) stressAdj += 0.25 * config.evapSensitivity;
    if (airHumidity < 35) stressAdj += 0.25 * config.evapSensitivity;

    durationMin *= stressAdj;
    durationMin = Math.min(durationMin, maxDuration);

    if (durationMin < 10 || (Etc < 2 && projectedMoisture >= config.idealMoisture - 1)) {
      if (!(parameters.hasOwnProperty('irrigating')) || (parameters.irrigating === true)) {
        title = 'ΔΕΝ ΑΠΑΙΤΕΙΤΑΙ ΑΡΔΕΥΣΗ';
        await sendPushByUsers(account, title, notifText, users);
        parameters.irrigating = false;
      }
      return { irrigate: false, method: "et0", parameters };
    }

    if (!(parameters.hasOwnProperty('irrigating')) || parameters.irrigating === false) {
      title = 'ΣΥΝΙΣΤΑΤΑΙ ΑΡΔΕΥΣΗ';
      notifText = `Συνίσταται άρδευση στην εγκατάσταση: ${parameters.name} για ${Math.round(durationMin)} λεπτά.`;
      await sendPushByUsers(account, title, notifText, users);
      parameters.irrigating = true;
    }

    return {
      irrigate: true,
      method: "et0",
      duration: Math.round(durationMin),
      et0DeficitMm: netEt0.toFixed(2),
      kc: Kc.toFixed(2),
      etc: Etc.toFixed(2),
      slope: slope.toFixed(2),
      parameters
    };
  }

  // fallback σε υγρασία εδάφους
  let durationMin = (litersPerPlant / lphPerPlant) * 60;
  durationMin = Math.min(durationMin, maxDuration);

  let multiplier = Kc;
  if (slope < -0.7 && projectedMoisture < config.idealMoisture) {
    multiplier *= 1.15;
    durationMin += 10;
  }

  durationMin *= multiplier;

  if (durationMin < 10 || (projectedDeficitMm < 5 && slope >= -0.3)) {
    if (!(parameters.hasOwnProperty('irrigating')) || parameters.irrigating === true) {
        title = 'ΔΕΝ ΑΠΑΙΤΕΙΤΑΙ ΑΡΔΕΥΣΗ';
      notifText = `Δεν απαιτείται περαιτέρω άρδευση στην εγκατάσταση: ${parameters.name}.`;
      await sendPushByUsers(account, title, notifText, users);
      parameters.irrigating = false;
    }
    return { irrigate: false, method: "moisture", parameters };
  }

  if (durationMin > 180) {
    durationMin = 180;
  }

  if (!(parameters.hasOwnProperty('irrigating')) || parameters.irrigating === false) {
    title = 'ΣΥΝΙΣΤΑΤΑΙ ΑΡΔΕΥΣΗ';
    notifText = `Συνίσταται άρδευση στην εγκατάσταση: ${parameters.name} για ${Math.round(durationMin)} λεπτά.`;
    await sendPushByUsers(account, title, notifText, users);
    parameters.irrigating = true;
  }

  return {
    irrigate: true,
    method: "moisture",
    duration: Math.round(durationMin),
    moistureDeficitMm: Math.round(deficitMm),
    kc: Kc.toFixed(2),
    slope: slope.toFixed(2),
    parameters
  };
}

function lux_to_par(lux, factor=0.0185) {
    return lux * factor;//  # µmol·m⁻²·s⁻¹
}




////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////   INDICATORS CALCULATION/     /////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

/**
* Description: Υπολογίζει το VPD (σε kPa), μια μέτρηση της ικανότητας ξήρανσης του αέρα. Εκτελείται κάθε ώρα.
* Inputs:
* - hourTich: (boolean) Determines if this is an hour tich
* - measurements:
* - devToSendMeas:
* - parameters:
* - users:
*
*/
function calculate_IrrigationVolume(hourlyTich, measurements, ipsi, parameters) {
  if (!hourlyTich) {
    return;
  }

  let soilHumiditySeries;

  // Possible base keys
  const soilHumidityPrefixCandidates = ["soil_humidity", "water_soil", "soil_humidity1", "water_soil1", "soil_moisture", "soil_moisture1"];

  // First check exact matches
  for (const key of soilHumidityPrefixCandidates) {
    if (measurements.data[key]) {
      soilHumiditySeries = measurements.data[key];
      break;
    }
  }
  if (!soilHumiditySeries) {
    return;
  }

  // A9: Use soil moisture limits converted to %v/v (CROP_PROFILE bounds are %TAW)
const lim = computeSoilMoistureLimits(parameters);
if (!lim || !lim.ok) return;

const M_target = (lim.real_lower_limit + lim.real_upper_limit) / 2; // %v/v

  // A8: Stage-dependent root depth
const rdCurve = CROP_PROFILE?.[parameters.cultivation_type_general]
  ?.[parameters.cultivation_type]?.root_depth_curve || {};
const stageKey = parameters.stage || "initial";

const stageToRootDepth = {
  transplant: "initial",
  germination: "initial",
  vegetative: "vegetative",
  flowering: "full_canopy",
  fruit_dev: "full_canopy",
  fruiting: "full_canopy",
  ripening: "full_canopy",
  harvest: "full_canopy",
};

const rdKey = stageToRootDepth[stageKey] || "initial";
const rootDepthmm = rdCurve[rdKey] || rdCurve.full_canopy || rdCurve.initial || 200;

  const netVolumeLiters = rootDepthmm * parameters.area * (M_target - readVal(soilHumiditySeries)) / 100;

      if (netVolumeLiters <= 0) return;

// ── D1: Effective Rainfall + Irrigation Inhibit (FAO-56 §5) ─────────────
// Effective rain ≈ 0.8×P for P<75mm (USDA SCS method)
// If effective rain in last 24h ≥ 5mm → skip irrigation
let rainfall_24h_irr = 0;
if (measurements?.data?.rain_height_daily && Array.isArray(measurements.data.rain_height_daily)) {
  rainfall_24h_irr = Number(measurements.data.rain_height_daily?.[0]?.value) || 0;
}
if (!rainfall_24h_irr && Array.isArray(measurements?.data?.rain_height)) {
  try {
    rainfall_24h_irr = measurements.data.rain_height.reduce((s, r) => s + (Number(r?.value) || 0), 0);
  } catch (e) {}
}
const effectiveRainfall_mm = rainfall_24h_irr < 75
  ? rainfall_24h_irr * 0.8
  : rainfall_24h_irr * 0.6;

if (effectiveRainfall_mm >= 5) {
  return [
    { variable: 'grossIrrigationLiters', value: 0 },
    { variable: 'irrigationDurationHours', value: 0 },
    { variable: 'irrigation_inhibited_by_rain', value: true },
    { variable: 'effective_rainfall_mm', value: parseFloat(effectiveRainfall_mm.toFixed(1)) },
    { variable: 'irrigation_message', value: `Δεν απαιτείται πότισμα — βροχή ${rainfall_24h_irr.toFixed(1)}mm (ωφέλιμη: ${effectiveRainfall_mm.toFixed(1)}mm)` }
  ];
}
// ── End D1 ──────────────────────────────────────────────────────────────

// B5: ET0-based hourly demand (optional, if we have min/max/avg temperatures)
// 1 mm over 1 m² = 1 liter
const T_max = readVal(measurements?.data?.air_temperature_max);
const T_min = readVal(measurements?.data?.air_temperature_min);
const T_avg = readVal(measurements?.data?.air_temperature_avg);

const latitude_deg = Number(parameters?.latitude_deg ?? parameters?.latitude ?? 35.0); // default ~Crete
const now = new Date();
const start = new Date(now.getFullYear(), 0, 0);
const dayOfYear = Math.floor((now - start) / 86400000);

const ET0 = calculate_ET0_Hargreaves(T_avg, T_max, T_min, dayOfYear, latitude_deg); // mm/day

// D5: Try Penman-Monteith first (more accurate ±5%), fallback to Hargreaves (±25%)
const RH_irr = readVal(measurements?.data?.air_humidity ?? measurements?.data?.humidity);
const wind_kmh = readVal(measurements?.data?.wind_speed_kmh);
const u2_irr = Number.isFinite(wind_kmh) ? wind_kmh / 3.6 : NaN;
const lux_irr = readVal(measurements?.data?.light_intensity);
const Rs_irr = Number.isFinite(lux_irr) && lux_irr > 0 ? lux_irr * 0.0079 / 1000 : NaN;
const elev_irr = Number(parameters?.elevation ?? 100);

let ET0_final = calculate_ET0_PM(T_avg, T_max, T_min, RH_irr, u2_irr, Rs_irr, dayOfYear, latitude_deg, elev_irr);
let et0_method = "PM";
if (!Number.isFinite(ET0_final) || ET0_final <= 0) {
  ET0_final = ET0; // fallback to Hargreaves
  et0_method = "Hargreaves";
}

const kcCurve = CROP_PROFILE?.[parameters.cultivation_type_general]?.[parameters.cultivation_type]?.kc_curve || {};
const kc = Number.isFinite(Number(kcCurve?.[parameters.stage])) ? Number(kcCurve?.[parameters.stage]) : null;

const ETc = (ET0_final !== null && kc !== null) ? (ET0_final * kc) : null; // mm/day
const et0_hourly_liters = (ETc !== null && Number.isFinite(parameters?.area))
  ? (ETc * Number(parameters.area) / 24)
  : null;

// If ET0 demand is available, add it as a minimum hourly requirement on top of deficit-to-target
const irrigationTargetLiters = (et0_hourly_liters !== null)
  ? (netVolumeLiters + et0_hourly_liters)
  : netVolumeLiters;
  const ece_max = CROP_PROFILE[parameters.cultivation_type_general][parameters.cultivation_type].max_tolerance_ECe;
  const ecw = WATER_PROFILE[parameters.water_quality].waterECw;
  // A3 FIX: Guard division by zero when water too saline
  const lr_denom = 5 * ece_max - ecw;
  if (lr_denom <= 0) {
    console.log(`LR warning: ECw(${ecw}) >= 5*ECe(${ece_max}). Water unsuitable.`);
    return [
      { variable: 'grossIrrigationLiters', value: 0 },
      { variable: 'irrigationDurationHours', value: 0 },
      { variable: 'irrigation_warning', value: 'ΑΚΑΤΑΛΛΗΛΟ ΝΕΡΟ: η αλατότητα υπερβαίνει το όριο ανοχής της καλλιέργειας' }
    ];
  }
  const leachingRequirement = Math.min(ecw / lr_denom, 1.0);

  const efficiency_factor = IRRIGATION_SYSTEM_PROFILE[parameters.irrigation_system].efficiency_factor;
  const grossIrrigationLiters = parseInt(irrigationTargetLiters * ( 1 + leachingRequirement) / efficiency_factor);

  const applicationRate = IRRIGATION_SYSTEM_PROFILE[parameters.irrigation_system].application_rate;
  // A1 FIX: Duration = gross_mm / rate (ήταν rate × volume — λάθος)
  const area_m2 = Number(parameters.area) || 10000;
  const gross_mm = grossIrrigationLiters / area_m2;
  const irrigationDurationHours = applicationRate > 0
    ? parseFloat((gross_mm / applicationRate).toFixed(2))
    : 0;
  return [
    {variable: 'grossIrrigationLiters', value: grossIrrigationLiters},
    {variable: 'irrigationDurationHours', value: irrigationDurationHours},
    {variable: 'et0_mm_day', value: ET0_final !== null ? parseFloat(ET0_final.toFixed(2)) : null},
    {variable: 'et0_method', value: et0_method},
  ];

}


/**
* Description: Αξιολογεί τον κίνδυνο προσβολής (και διαχειρίζεται η αποτελεσματικότητα των παρεμβάσεων). -> ΣΗΜΕΙΩΣΗ Η ΠΑΡΕΜΒΑΣΗ ΔΕΝ ΕΧΕΙ ΕΙΣΑΧΘΕΙ
* Inputs:
* - hourTich: (boolean) Determines if this is an hour tich
* - measurements:
* - devToSendMeas:
* - parameters:
* - users:
*
*/
// ──────────────────────────────────────────────────────────────
// A5: Hourly Infection Hours Counter (needed by FIR Infection_Triangle)
// ──────────────────────────────────────────────────────────────
function calculate_InfectionHours(hourTick, measurements, parameters) {
  if (!hourTick) return [];

  const INFECTION_HOURS_COUNTER_PREFIX = "infection_hours_counter_";
  let indicators = [];

  const T_air = getVal(measurements, "air_temperature",
    getVal(measurements, "temperature", null));
  const RH = getVal(measurements, "air_humidity",
    getVal(measurements, "humidity", null));
  if (T_air === null || RH === null) return [];

  const leafMoisture = getVal(measurements, "leaf_moisture", null);
  const dewPoint = getVal(measurements, "dew_point", null);
  const leafIsWet =
    (leafMoisture !== null && leafMoisture > 50) ||
    (dewPoint !== null && T_air <= dewPoint + 1.0) ||
    (RH >= 95);

  const matchesFieldCrop = (entry) =>
    entry &&
    entry.cultivation_type_general === parameters.cultivation_type_general &&
    entry.cultivation_type === parameters.cultivation_type;

  for (const catKey of Object.keys(PATHOGEN_PROFILE || {})) {
    const category = PATHOGEN_PROFILE?.[catKey] || {};
    for (const [pathogenKey, pathogen] of Object.entries(category)) {
      if (pathogen?.type !== "Infection_Triangle") continue;
      if (!Array.isArray(pathogen.crops) || !pathogen.crops.some(matchesFieldCrop)) continue;

      const tempOk = T_air >= pathogen.optimalTempRange.min && T_air <= pathogen.optimalTempRange.max;
      const humidityOk = RH >= pathogen.optimalHumidity.min;

      // B6 FIX: Leaf wetness only if pathogen requires it (erysiphe: false)
      const needsWet = (pathogen.requiresLeafWetness !== false);
      const wetOk = needsWet ? leafIsWet : true;

      // B6 FIX: Rain inhibit for erysiphe (rain washes conidia)
      let rainInhibit = false;
      if (pathogen.rainInhibitsInfection === true) {
        let rainfall_1h = 0;
        if (Array.isArray(measurements?.data?.rain_height)) {
          rainfall_1h = Number(measurements.data.rain_height?.[0]?.value) || 0;
        }
        rainInhibit = (rainfall_1h > (pathogen.rainInhibitThresholdMm || 2.5));
      }

      const conditionsOk = tempOk && humidityOk && wetOk && !rainInhibit;

      const counterKey = `${INFECTION_HOURS_COUNTER_PREFIX}${pathogenKey}`;
      const prevCount = getVal(measurements, counterKey, 0);
      const newCount = rainInhibit ? 0 : (conditionsOk ? (prevCount + 1) : 0);

      indicators.push({ variable: counterKey, value: newCount });
    }
  }

  return indicators;
}

// ── D3: PEI — Pesticide Efficacy Index ───────────────────────────────────
// PEI models how pesticide protection decays after spraying.
// FIR = ER × HS × (1 - PEI). Fresh spray → PEI≈1 → FIR≈0.
// Requires field config: last_pesticide_key, last_pesticide_date
// Uses PESTICIDE_PROFILE: residualDays, washoffFactor, uvDegradationFactor
// Ref: Seem 1984, Madden et al. 2007
function calculate_PEI(parameters, measurements) {
  const lastKey = parameters?.last_pesticide_key;
  const lastDate = parameters?.last_pesticide_date;
  if (!lastKey || !lastDate) return 0;

  // Find pesticide in profile
  let pesticide = null;
  for (const [catName, catObj] of Object.entries(PESTICIDE_PROFILE || {})) {
    if (typeof catObj === "object" && !Array.isArray(catObj) && catObj[lastKey]) {
      pesticide = catObj[lastKey];
      break;
    }
  }
  if (!pesticide) return 0;

  // Days since spray
  const daysSince = Math.max(0, (Date.now() - new Date(lastDate).getTime()) / 86400000);
  if (daysSince > (pesticide.residualDays || 14) * 2.5) return 0;

  // Exponential decay: 10% efficacy remaining at residualDays
  const lambda = -Math.log(0.1) / (pesticide.residualDays || 14);
  let pei = Math.exp(-lambda * daysSince);

  // Rain washoff
  let rain24 = 0;
  if (measurements?.data?.rain_height_daily) {
    rain24 = Number(measurements.data.rain_height_daily?.[0]?.value) || 0;
  }
  pei = Math.max(0, pei - (pesticide.washoffFactor || 0.05) * rain24);

  // UV degradation
  pei = Math.max(0, pei - (pesticide.uvDegradationFactor || 0.03) * daysSince);

  return Math.min(1, Math.max(0, pei));
}
// ── End D3 function ─────────────────────────────────────────────────────

function calculate_FIR(dailyTich, measurements, ipsiLast, parameters) {
  const GDD_ACCUMULATED_PREFIX = "gdd_accumulated_";
  const INFECTION_HOURS_COUNTER_PREFIX = "infection_hours_counter_";
  let indicators = [];

  if (!dailyTich || ipsiLast === undefined) return;
  ipsiLast = ipsiLast[0].value;

  let airTempSeries, airHumiditySeries;
  if (measurements.data.air_temperature) airTempSeries = measurements.data.air_temperature;
  else if (measurements.data.temperature) airTempSeries = measurements.data.temperature;
  else return;
  const airTemp = airTempSeries[0].value;

  if (measurements.data.air_humidity) airHumiditySeries = measurements.data.air_humidity;
  else if (measurements.data.humidity) airHumiditySeries = measurements.data.humidity;
  else return;
  const airHumidity = airHumiditySeries[0].value;

  const ipsiAvg = getVal(measurements, "ipsi_avg", undefined);
  if (ipsiAvg === undefined) {
    return;
  }
  // IPSI avg → HS — B3 FIX: range [1,4] αντί [1,2]. Ref: Desprez-Loustau 2006
  const hs = 1 + (3 / (1 + Math.exp(-8 * ((ipsiAvg / 10) - 0.5))));

  const gddKeys = Object.keys(measurements?.data ?? {}).filter(k => k.startsWith(GDD_ACCUMULATED_PREFIX));
  const infectionHoursCounterKeys = Object.keys(measurements?.data ?? {}).filter(k => k.startsWith(INFECTION_HOURS_COUNTER_PREFIX));


  const matchesFieldCrop = (entry) =>
    entry &&
    entry.cultivation_type_general === parameters.cultivation_type_general &&
    entry.cultivation_type === parameters.cultivation_type;

  for (const [categoryKey, categoryEntry] of Object.entries(PATHOGEN_PROFILE)) {
    const category = PATHOGEN_PROFILE[categoryKey] ?? {};
    for (const [pathogenKey, pathogen] of Object.entries(category)) {
      // ✅ only pathogens that list this field’s cultivation
      if (!Array.isArray(pathogen.crops) || !pathogen.crops.some(matchesFieldCrop)) {
        continue;
      }

      const erCalculationType = pathogen.type;
      let er = 0;

      if (erCalculationType === "Infection_Triangle") {

        const counterKey = `${INFECTION_HOURS_COUNTER_PREFIX}${pathogenKey}`;
        const infection_hours = getVal(measurements, counterKey, 0);

        er = (infection_hours >= pathogen.requiredDurationHrs) ? 1.0
          : (infection_hours > 0) ? (infection_hours / pathogen.requiredDurationHrs) * 0.5
          : 0;

        // Keep counter as-is; reset happens only when conditions break (hourly module)
        indicators = [...indicators, { variable: counterKey, value: infection_hours }];

      } else if (erCalculationType === "GDD_Pest") {

        // Read accumulated GDD for this pathogen
        const accKey = `${GDD_ACCUMULATED_PREFIX}${pathogenKey}`;
        const accumulatedGDD = getVal(measurements, accKey, 0);

        // Use criticalGddValues as thresholds (triangular window around each one)
        const criticals = pathogen.criticalGddValues;
        if (criticals && typeof criticals === "object") {
          const thresholds = Object.values(criticals).sort((a, b) => a - b);

          let minDistance = Infinity;
          for (const threshold of thresholds) {
            const dist = Math.abs(accumulatedGDD - threshold);
            if (dist < minDistance) minDistance = dist;
          }

          const lowestThreshold = thresholds[0] || 100;
          const windowSize = Math.max(30, 0.15 * lowestThreshold); // ±15% (min 30)
          er = Math.max(0, Math.min(1, 1 - (minDistance / windowSize)));
        } else {
          er = 0;
        }

      } else {
        throw(`Unknown erCalculationType given for pathogen ${pathogenKey}`);
      }

      // D3: FIR = ER × HS × (1 - PEI) — pesticide protection reduces risk
      const pei = calculate_PEI(parameters, measurements);
      const fir = er * hs * (1 - pei);
      indicators = [...indicators, { variable: `fir_${pathogenKey}`, value: parseFloat(fir.toFixed(3)) }];
      if (pei > 0.05) {
        indicators = [...indicators, { variable: `pei_${pathogenKey}`, value: parseFloat(pei.toFixed(3)) }];
      }
    }
  }
  return indicators;
}

/**
 * lux: τιμή φωτεινότητας από το S2120 (σε lux)
 * prevSum: προηγούμενη τιμή DLI της ημέρας (mol/m²/day)
 */
function updateDailyPAR(lux, prevSum = 0) {
  const DELTA_DLI_PER_LUX_5MIN = 5.555e-6;

  const deltaDLI = lux * DELTA_DLI_PER_LUX_5MIN; // mol/m²
  const newSum = prevSum + deltaDLI;
  return newSum;
}

function resolveStageAndCurve(parameters, curveKey = "light_use_efficiency_curve") {
  const { cultivation_type_general, cultivation_type } = parameters;

  const cropGroup = CROP_PROFILE?.[cultivation_type_general];
  const cropProfile = cropGroup?.[cultivation_type];

  if (!cropProfile) {
    console.warn(
      "resolveStageAndCurve: Unknown crop profile for",
      cultivation_type_general,
      cultivation_type
    );
    return { stage: null, curve: null, value: null };
  }

  const curve = cropProfile[curveKey];
  if (!curve || typeof curve !== "object") {
    console.warn(
      `resolveStageAndCurve: Curve '${curveKey}' not found for`,
      cultivation_type_general,
      cultivation_type
    );
    return { stage: null, curve: null, value: null };
  }

  const stageKeys = Object.keys(curve);
  if (stageKeys.length === 0) {
    console.warn(
      `resolveStageAndCurve: Curve '${curveKey}' is empty for`,
      cultivation_type_general,
      cultivation_type
    );
    return { stage: null, curve, value: null };
  }

  let stage = parameters.stage;

  // If given stage is missing or invalid, choose a sensible default
  if (!stage || !Object.prototype.hasOwnProperty.call(curve, stage)) {
    const preferredOrder = [
      "vegetative",
      "flowering",
      "fruit_dev",
      "fruit_set",
      "fruiting",
      "heading",
      "root_dev",
      "tuberization",
      "bulbing",
      "budbreak",
      "establishment",
      "germination",
      "maturity",
      "harvest"
    ];

    let fallback = stageKeys[0];
    for (const candidate of preferredOrder) {
      if (Object.prototype.hasOwnProperty.call(curve, candidate)) {
        fallback = candidate;
        break;
      }
    }

    console.warn(
      `resolveStageAndCurve: Stage '${stage}' is invalid for ${cultivation_type_general}/${cultivation_type}. ` +
      `Falling back to '${fallback}'. Valid: ${stageKeys.join(", ")}`
    );
    stage = fallback;
  }

  const value = curve[stage];

  // Optionally, push the resolved stage back into parameters
  parameters.stage = stage;

  return { stage, curve, value };
}

/**
* Description: Υπολογίζει το VPD (σε kPa), μια μέτρηση της ικανότητας ξήρανσης του αέρα. Εκτελείται κάθε ώρα.
* Inputs:
* - hourTich: (boolean) Determines if this is an hour tich
* - measurements:
* - devToSendMeas:
* - parameters:
* - users:
*
*/
function calculate_BPI(dailyTich, measurements, ipsi, parameters, ipsiError = "") {
  // Contextual BPI (Daily Efficiency vs Accumulated Potential) – per BPI correction spec
  if (!dailyTich) {
    return { bpi: undefined, bpiError: undefined };
  }
  if (ipsi === undefined || ipsi[0] === undefined) {
    console.log("Cannot calculate BPI due to lack of IPSI: ", ipsi);
    return { bpi: undefined, bpiError: ipsiError || " υπολογισμός IPSI" };
  }
  // B4: Prefer 24h running IPSI average (if available), otherwise fallback to current IPSI
  const ipsi_daily_avg = getVal(measurements, "ipsi_daily_avg", null);
  const ipsi_avg = (ipsi_daily_avg !== null && Number.isFinite(Number(ipsi_daily_avg)))
    ? Number(ipsi_daily_avg)
    : Number(ipsi?.[0]?.value);

  if (!Number.isFinite(ipsi_avg)) {
    console.log("Cannot calculate BPI due to invalid IPSI: ", ipsi);
    return { bpi: undefined, bpiError: ipsiError || " υπολογισμός IPSI" };
  }

  let luxSeries;
  let soilTempAvgSeries;
  let airTempAvgSeries;

  // Light intensity (lux)
  if (measurements?.data?.light_intensity_sum) {
    luxSeries = measurements.data.light_intensity_sum;
  } else if (measurements?.data?.light_intensity) { // SenseCAP S2120
    luxSeries = measurements.data.light_intensity;
  } else {
    console.log("Cannot calculate BPI due to lack of LUX");
    return { bpi: undefined, bpiError: " έλλειψη αισθητήρα φωτός!" };
  }

  // Soil temperature avg (multiple candidates)
  const soilTempAvgPrefixCandidates = [
    "soil_temperature_avg",
    "temp_soil_avg",
    "soil_temperature1_avg",
    "temp_soil1_avg",
    "soil_temperature",
    "temp_soil",
    "soil_temperature1",
    "temp_soil1",
  ];
  for (const key of soilTempAvgPrefixCandidates) {
    if (measurements?.data?.[key]) {
      soilTempAvgSeries = measurements.data[key];
      break;
    }
  }
  if (!soilTempAvgSeries) {
    console.log("Cannot calculate BPI due to lack of soilTempAvgSeries");
    return { bpi: undefined, bpiError: " έλλειψη αισθητήρα θερμοκρασίας εδάφους!" };
  }
  const soilTemp_avg = Number(soilTempAvgSeries?.[0]?.value);
  if (!Number.isFinite(soilTemp_avg)) {
    console.log("Cannot calculate BPI due to invalid soilTemp_avg:", soilTemp_avg);
    return { bpi: undefined, bpiError: " έλλειψη αισθητήρα θερμοκρασίας εδάφους!" };
  }

  // Air temperature avg (daily)
  const airTempAvgPrefixCandidates = ["air_temperature_avg", "air_temperature", "temperature"];
  for (const key of airTempAvgPrefixCandidates) {
    if (measurements?.data?.[key]) {
      airTempAvgSeries = measurements.data[key];
      break;
    }
  }
  if (!airTempAvgSeries) {
    console.log("Cannot calculate BPI due to lack of airTempAvgSeries");
    return { bpi: undefined, bpiError: " έλλειψη αισθητήρα θερμοκρασίας αέρα!" };
  }
  const T_air = readVal(airTempAvgSeries);
  console.log('T_air: ', T_air)
  if (!Number.isFinite(T_air)) {
    console.log("Cannot calculate BPI due to invalid air temp:", T_air);
    return { bpi: undefined, bpiError: " έλλειψη αισθητήρα θερμοκρασίας αέρα!" };
  }

  // Total PAR from lux
  const totalPAR = lux_to_par(readVal(luxSeries));

  if (totalPAR <= 0 || !Number.isFinite(totalPAR)) {
    // Νύχτα ή αισθητήρας εκτός λειτουργίας
    // ΜΗΝ παράγεις diagnosis — δεν υπάρχει φωτοσύνθεση
    return {
      bpi: [{ variable: "bpi", value: 0 }],
      bpiIndicators: [
        { variable: "bpi_efficiency_pct", value: 0 },
        { variable: "bpi_daily_status", value: "Νύχτα",
          metadata: { code: "NIGHT", color: "#78909C",
            message: "Δεν υπάρχει φωτοσύνθεση — δεν αξιολογείται η ανάπτυξη." } },
      ],
      bpiContext: { efficiency_pct: 0, limiting_factor: "light",
        status: { code: "NIGHT", message: "Νύχτα", color: "#78909C" },
        performance_pct: 0 },
      bpiError: ""
    };
  }

  // ✅ Use unified stage + curve resolver
  const { stage, value: lue_current } = resolveStageAndCurve(
    parameters,
    "light_use_efficiency_curve"
  );

  if (lue_current == null) {
    console.log(
      "Cannot calculate BPI: no LUE value for",
      parameters?.cultivation_type_general,
      parameters?.cultivation_type,
      "stage:",
      parameters?.stage
    );
    return { bpi: undefined, bpiError: " έλλειψη LUE παραμέτρου!" };
  }

  const P_base = totalPAR * Number(lue_current);

  // -----------------------------
  // Daily Efficiency factors (0..1)
  // -----------------------------

  // Water factor (f_IPSI): IPSI ranges 0 (good) to 10 (bad). Invert to 1..0. Negative IPSI treated as 1.
  const f_IPSI = (ipsi_avg > 0) ? (1.0 - (ipsi_avg / 10.0)) : 1.0;

  // Air temperature factor (f_Temp): crop-specific asymmetric trapezoid (min → peak → max)
  const crop = CROP_PROFILE?.[parameters?.cultivation_type_general]?.[parameters?.cultivation_type] || {};
  const opt = crop?.optimal_temp_range || {};
  const peak = Number.isFinite(Number(opt.peak)) ? Number(opt.peak) : 25;
  const optMin = Number.isFinite(Number(opt.min)) ? Number(opt.min) : peak - 10;
  const optMax = Number.isFinite(Number(opt.max)) ? Number(opt.max) : peak + 10;
  const f_Temp = fTempAsymmetric(T_air, optMin, peak, optMax);

    // Soil temperature factor (f_Soil): crop-specific trapezoid based on soil_base_temp
  const soilBaseTemp = Number(crop?.soil_base_temp ?? 10);
  const f_Soil = fTempAsymmetric(
    soilTemp_avg,
    soilBaseTemp - 2,   // Tmin
    soilBaseTemp + 8,   // Topt
    50                  // Tmax (very hot soil)
  );

  // Product of factors
  const daily_efficiency = f_Temp * f_Soil * f_IPSI; // 0..1

  // Diagnosis (limiting factor)
  const min_factor = Math.min(f_Temp, f_Soil, f_IPSI);
  let diagnosis = { code: "NONE", message: "Ιδανικές Συνθήκες", color: "#2ecc71" }; // green
  let limiting_factor = "optimal";

  if (daily_efficiency < 0.8) {
    if (min_factor === f_IPSI) {
      diagnosis = { code: "WATER_STRESS", message: "Περιορισμός: Έλλειψη Υγρασίας", color: "#f39c12" };
      limiting_factor = "water";
    } else if (min_factor === f_Temp) {
      // Υπολογισμός μέσου σημείου μεταξύ Tmin και Topt
      const T_midpoint = (optMin + peak) / 2;

      if (T_air < optMin) {
        // Κάτω από ελάχιστο → σαφές ψύχος
        diagnosis = { code: "COLD_STRESS",
          message: "Περιορισμός: Χαμηλή Θερμοκρασία",
          color: "#1565C0" };  // μπλε, ΟΧΙ κόκκινο
        limiting_factor = "cold";
      } else if (T_air < T_midpoint) {
        // Μεταξύ Tmin και μέσου → δροσερό, μειωμένη ανάπτυξη
        diagnosis = { code: "COOL_GROWTH",
          message: "Μειωμένη ανάπτυξη λόγω δροσερών συνθηκών",
          color: "#78909C" };  // γκρι-μπλε, ενημερωτικό
        limiting_factor = "cool";
      } else if (T_air > optMax) {
        // Πάνω από μέγιστο → σαφής καύσωνας
        diagnosis = { code: "HEAT_STRESS",
          message: "Περιορισμός: Υψηλή Θερμοκρασία",
          color: "#c0392b" };  // κόκκινο (μόνο εδώ!)
        limiting_factor = "heat";
      } else {
        // Μεταξύ μέσου και Tmax → ζεστό αλλά εντός ορίων
        diagnosis = { code: "WARM_SUBOPTIMAL",
          message: "Ελαφρώς υψηλή θερμοκρασία",
          color: "#FF8F00" };  // πορτοκαλί
        limiting_factor = "warm";
      }
    } else if (min_factor === f_Soil) {
      diagnosis = { code: "ROOT_STRESS", message: "Περιορισμός: Κρύο Έδαφος (Ρίζα)", color: "#f1c40f" };
      limiting_factor = "root";
    } else {
      diagnosis = { code: "LIMITED", message: "Περιορισμός: Συνθήκες", color: "#95a5a6" };
      limiting_factor = "mixed";
    }
  }

  // -----------------------------
  // BPI Actual / Potential and accumulation
  // -----------------------------
  const daily_growth_actual = P_base * daily_efficiency; // legacy bpi = today's actual
  const daily_growth_potential = P_base; // perfect-world benchmark for today

  // Read running totals from injected prev indicators (if present)
  const prev_actual = Number(measurements?.data?.bpi_total_actual?.[0]?.value ?? 0);
  const prev_potential = Number(measurements?.data?.bpi_total_potential?.[0]?.value ?? 0);

  const new_total_actual = (Number.isFinite(prev_actual) ? prev_actual : 0) + daily_growth_actual;
  const new_total_potential = (Number.isFinite(prev_potential) ? prev_potential : 0) + daily_growth_potential;

  const performance_pct = (new_total_potential > 0)
    ? Math.round((new_total_actual / new_total_potential) * 100)
    : 0;

  const efficiency_pct = Math.round(daily_efficiency * 100);

  // Indicators payloads
  const bpi = [{ variable: "bpi", value: daily_growth_actual }];

  const bpi_context = {
    efficiency_pct,
    limiting_factor,
    status: diagnosis,
    total_actual: Number(new_total_actual.toFixed(2)),
    total_potential: Number(new_total_potential.toFixed(2)),
    performance_pct,
  };

  const bpiIndicators = [
    { variable: "bpi_efficiency_pct", value: efficiency_pct },
    { variable: "bpi_daily_status", value: diagnosis.message, metadata: diagnosis },
    { variable: "bpi_total_actual", value: Number(new_total_actual.toFixed(2)) },
    { variable: "bpi_total_potential", value: Number(new_total_potential.toFixed(2)) },
    { variable: "bpi_performance_pct", value: performance_pct },
  ];

  // ── D4: Harvest Index × Yield Forecast ──────────────────────────────────
  // yield = accumulated_biomass × harvest_index (FAO-66, Steduto 2009)
  const hi = Number(crop?.harvest_index);
  if (Number.isFinite(hi) && hi > 0 && new_total_actual > 0) {
    const yieldForecast = parseFloat((new_total_actual * hi).toFixed(1));
    bpiIndicators.push(
      { variable: "yield_forecast_relative", value: yieldForecast },
      { variable: "harvest_index", value: hi }
    );
  }
  // ── End D4 ──────────────────────────────────────────────────────────────

  // ── E1: Effective Night Temperature (ENT) ─────────────────────────────
  // Ref: Kliewer 1970 (grape anthocyanins), Sato 2006 (tomato fruit set),
  // Hatfield & Prueger 2015 (respiration losses)
  // T_min (24h minimum) ≈ night temperature. High T_night → quality loss.
  const T_min_bpi = readVal(measurements?.data?.air_temperature_min);
  if (Number.isFinite(T_min_bpi)) {
    bpiIndicators.push({ variable: "night_temperature", value: parseFloat(T_min_bpi.toFixed(1)) });

    // Crop-specific night temperature thresholds
    const nightThresholds = {
      wine_grapes:  { warn: 20, critical: 25, effect: "μειωμένος χρωματισμός σταφυλιού (ανθοκυανίνες)" },
      table_grapes: { warn: 22, critical: 27, effect: "μειωμένη γεύση και σταθερότητα" },
      raisin_grapes:{ warn: 22, critical: 27, effect: "μειωμένη ποιότητα σταφίδας" },
      tomato:       { warn: 21, critical: 26, effect: "μειωμένη καρπόδεση (poor fruit set)" },
      pepper:       { warn: 22, critical: 28, effect: "ανθόπτωση" },
      koroneiki:    { warn: 25, critical: 30, effect: "αυξημένη αναπνοή — μείωση ελαιοπεριεκτικότητας" },
      strawberry:   { warn: 18, critical: 24, effect: "μειωμένα σάκχαρα — χαμηλά Brix" },
      watermelon:   { warn: 24, critical: 28, effect: "μειωμένη γλυκύτητα" },
      melon:        { warn: 22, critical: 26, effect: "μειωμένο άρωμα" },
      wheat:        { warn: 18, critical: 22, effect: "αυξημένη νυχτερινή αναπνοή — μείωση grain filling" },
      maize:        { warn: 22, critical: 26, effect: "μείωση βάρους κόκκου" },
    };
    const ct = parameters?.cultivation_type;
    const nt = nightThresholds[ct];
    if (nt && T_min_bpi > nt.warn) {
      const severity = T_min_bpi > nt.critical ? "HIGH" : "MEDIUM";
      bpiIndicators.push({
        variable: "night_temp_warning",
        value: severity,
        metadata: {
          color: severity === "HIGH" ? "red" : "orange",
          text: `🌙 Νυχτερινή θερμοκρασία ${T_min_bpi.toFixed(1)}°C > ${nt.warn}°C — ${nt.effect}`,
          threshold_warn: nt.warn,
          threshold_critical: nt.critical,
        }
      });
    }
  }
  // ── End E1 ──────────────────────────────────────────────────────────────

  // ── E2: Photothermal Quotient (PTQ) ───────────────────────────────────
  // PTQ = Solar Radiation / (T_avg − T_base)  [MJ/m²/°C·day]
  // Ref: Fischer 1985, Ortiz-Monasterio 1994
  // High PTQ during grain filling → high yield (cereals)
  // High PTQ during véraison → better sugar accumulation (grapes)
  // Rs estimated from lux: 1 lux ≈ 0.0079 W/m² PAR → total Rs ≈ lux × 0.0079 / 0.48 / 1e6 × 3600 × daylength
  // Simplified: Rs_MJ ≈ totalPAR × 0.0864 (daily integral conversion)
  const Rs_bpi = totalPAR * 0.0864; // rough MJ/m²/day from daily PAR
  const T_base_ptq = Number(opt.min) || 0; // Tbase from crop profile
  const denom_ptq = T_air - T_base_ptq;
  if (denom_ptq > 1 && Rs_bpi > 0) {
    const ptq = parseFloat((Rs_bpi / denom_ptq).toFixed(3));
    bpiIndicators.push({ variable: "photothermal_quotient", value: ptq });

    // Quality assessment for key crops during critical stages
    const stage = parameters?.stage;
    const ptqCriticalStages = {
      wheat: ["anthesis", "grain_filling"],
      barley: ["anthesis", "grain_filling"],
      maize: ["tasseling", "grain_filling"],
      wine_grapes: ["fruiting"],
      table_grapes: ["fruiting"],
    };
    const critStages = ptqCriticalStages[parameters?.cultivation_type];
    if (critStages && critStages.includes(stage)) {
      let ptqMsg = "";
      if (ptq > 1.5) ptqMsg = "✅ Εξαιρετικές φωτοθερμικές συνθήκες — ευνοϊκές για ποιότητα καρπού/σπόρου";
      else if (ptq > 0.8) ptqMsg = "⚠ Μέτριες φωτοθερμικές συνθήκες — παρακολουθήστε θερμοκρασία";
      else ptqMsg = "🔥 Χαμηλός PTQ — υψηλή θερμοκρασία σε σχέση με φως, κίνδυνος μειωμένης ποιότητας";
      bpiIndicators.push({
        variable: "ptq_assessment",
        value: ptqMsg,
        metadata: { color: ptq > 1.5 ? "green" : ptq > 0.8 ? "orange" : "red", ptq_value: ptq, stage }
      });
    }
  }
  // ── End E2 ──────────────────────────────────────────────────────────────

  return { bpi, bpiIndicators, bpiContext: bpi_context, bpiError: "" };
}



/**
 * IPSI (UPDATED) — uses SOIL_PROFILE hydraulics for FC/WP/SAT
 * Keeps your CROP_PROFILE untouched.
 *
 * Backward compatibility:
 * - still returns array containing {variable:"ipsi", value:<0..10>}
 * - if soil profile missing, falls back to crop profile (old behavior)
 */


/**
 * Soil moisture limits (independent routine)
 * Produces lower/upper soil moisture limits (% v/v) based on:
 * - soil hydraulics (WP/FC/SAT) from SOIL_PROFILE when available
 * - crop optimal moisture band (% of TAW) from CROP_PROFILE
 *
 * If cropOverride is provided, it will be used instead of re-resolving from CROP_PROFILE.
 */
function computeSoilMoistureLimits(parameters, cropOverride) {
  const crop = cropOverride || CROP_PROFILE?.[parameters?.cultivation_type_general]?.[parameters?.cultivation_type];
  if (!crop) {
    return {
      ok: false,
      error: `δεν βρέθηκε τύπος καλλιέρειας: ${parameters?.cultivation_type_general}, ${parameters?.cultivation_type}`,
    };
  }

  const soil_key = parameters?.soil_type || parameters?.soil_profile || parameters?.soil;
  const soil = SOIL_PROFILE?.[soil_key];

  // Prefer SOIL_PROFILE hydraulics, fallback to crop profile (old behavior)
  const soil_FC  = Number(soil?.hydraulics?.field_capacity);
  const soil_WP  = Number(soil?.hydraulics?.wilting_point);
  const soil_SAT = Number(soil?.hydraulics?.saturation);

  let M_wilt = Number.isFinite(soil_WP) ? soil_WP : Number(crop?.wilting_point);
  let M_field_capacity = Number.isFinite(soil_FC) ? soil_FC : Number(crop?.M_field_capacity);
  if (!Number.isFinite(M_field_capacity)) {
    M_field_capacity = Number(crop?.optimal_moisture_range?.upper_bound);
  }

  if (!Number.isFinite(M_wilt) || !Number.isFinite(M_field_capacity) || (M_field_capacity <= M_wilt)) {
    return {
      ok: false,
      error: `μη έγκυρα υδραυλικά εδάφους (WP/FC). soil=${soil_key}`,
    };
  }

  let M_saturation = Number.isFinite(soil_SAT) ? soil_SAT : Math.min(60, M_field_capacity + 12);

  const M_lower_bound_pct = Number(crop?.optimal_moisture_range?.lower_bound);
  const M_upper_bound_pct = Number(crop?.optimal_moisture_range?.upper_bound);
  if (!Number.isFinite(M_lower_bound_pct) || !Number.isFinite(M_upper_bound_pct)) {
    return { ok: false, error: "λείπουν τα optimal_moisture_range lower/upper για την καλλιέργεια" };
  }

  const TAW = M_field_capacity - M_wilt;

  // Convert from % of TAW to actual soil moisture (% v/v) limits
  const real_lower_limit = M_wilt + (M_lower_bound_pct * TAW / 100);
  const real_upper_limit = M_wilt + (M_upper_bound_pct * TAW / 100);

  return {
    ok: true,
    crop,
    soil_key,
    source: soil ? "SOIL_PROFILE" : "CROP_PROFILE",
    M_wilt,
    M_field_capacity,
    M_saturation,
    M_lower_bound_pct,
    M_upper_bound_pct,
    real_lower_limit,
    real_upper_limit,
  };
}

function buildSoilMoistureLimitIndicators(limits) {
  if (!limits?.ok) {
    return [
      {
        variable: "soil_moisture_limits_status",
        value: "Μη διαθέσιμο",
        metadata: { color: "grey", text: limits?.error || "άγνωστο σφάλμα" },
      },
    ];
  }

  const metaBase = {
    color: "grey",
    unit: "% v/v",
    source: limits.source,
    soil: limits.soil_key,
    text: `Όρια εδαφικής υγρασίας από ${limits.source} + optimal band καλλιέργειας (TAW-based).`,
  };

  return [
    { variable: "soil_moisture_lower_limit", value: Number(limits.real_lower_limit.toFixed(2)), metadata: metaBase },
    { variable: "soil_moisture_upper_limit", value: Number(limits.real_upper_limit.toFixed(2)), metadata: metaBase },

    // Optional diagnostics
    // { variable: "soil_wp", value: Number(limits.M_wilt.toFixed(2)), metadata: metaBase },
    // { variable: "soil_fc", value: Number(limits.M_field_capacity.toFixed(2)), metadata: metaBase },
    // { variable: "soil_sat", value: Number(limits.M_saturation.toFixed(2)), metadata: metaBase },
    // { variable: "soil_opt_lb_pct", value: Number(limits.M_lower_bound_pct.toFixed(1)), metadata: metaBase },
    // { variable: "soil_opt_ub_pct", value: Number(limits.M_upper_bound_pct.toFixed(1)), metadata: metaBase },
  ];
}

function calculate_IPSI(hourlyTich, measurements, vpd, parameters, vpdError = "") {
  // v13.1 – Soil hydraulics from SOIL_PROFILE (FC/WP/SAT) + keeps crop thresholds as-is
  if (!hourlyTich) { return { ipsi: undefined, ipsiError: "έλλειψη ωριαίου tich" }; }
  if (!vpd || vpd[0] === undefined) { return { ipsi: undefined, ipsiError: vpdError || "έλλειψη VPD" }; }
  const VPD = Number(vpd[0].value);

  // -----------------------------
  // Temperatures (air, leaf, soil)
  // -----------------------------
  let airTempSeries;
  if (measurements?.data?.air_temperature) airTempSeries = measurements.data.air_temperature; // s2120
  else if (measurements?.data?.temperature) airTempSeries = measurements.data.temperature; // em300
  else { return { ipsi: undefined, ipsiError: "έλλειψη αισθητήρα θερμοκρασίας αέρα" }; }

  const airTempValue = Number(airTempSeries?.[0]?.value);
  if (!Number.isFinite(airTempValue)) { return { ipsi: undefined, ipsiError: "μη έγκυρη τιμή θερμοκρασίας αέρα" }; }

  let leafTempSeries = measurements?.data?.leaf_temperature ? measurements.data.leaf_temperature : airTempSeries;
  const leafTempValue = Number(leafTempSeries?.[0]?.value);
  if (!Number.isFinite(leafTempValue)) { return { ipsi: undefined, ipsiError: "μη έγκυρη τιμή θερμοκρασίας φύλλου" }; }

  // Soil temperature (try multiple variable names / statistics)
  const soilTempCandidates = [
    "soil_temperature", "temp_soil",
    "soil_temperature1", "temp_soil1",
    "soil_temperature_avg", "temp_soil_avg",
    "soil_temperature1_avg", "temp_soil1_avg"
  ];
  let T_soil = undefined;
  for (const key of soilTempCandidates) {
    if (measurements?.data?.[key] !== undefined) {
      const v = measurements.data[key];
      if (Array.isArray(v)) T_soil = Number(v?.[0]?.value);
      else T_soil = Number(v);
      if (Number.isFinite(T_soil)) break;
    }
  }
  if (!Number.isFinite(T_soil)) T_soil = airTempValue; // fallback

  // -----------------------------
  // Soil moisture (M_soil)
  // -----------------------------
  const soilHumidityCandidates = [
    "soil_humidity", "water_soil",
    "soil_humidity1", "water_soil1",
    "soil_moisture", "soil_moisture1",
    "soil_moisture_avg", "soil_moisture1_avg"
  ];

  let M_soil = undefined;
  for (const key of soilHumidityCandidates) {
    if (measurements?.data?.[key]) {
      const v = measurements.data[key];
      M_soil = Array.isArray(v) ? Number(v?.[0]?.value) : Number(v);
      if (Number.isFinite(M_soil)) break;
    }
  }
  if (!Number.isFinite(M_soil)) { return { ipsi: undefined, ipsiError: "μη έγκυρη/ελλιπής μέτρηση εδαφικής υγρασίας" }; }

  // -----------------------------
  // Rainfall (24h sum) if present
  // -----------------------------
  let rainfall_24h = 0;
  if (measurements?.data?.rain_height_daily && Array.isArray(measurements.data.rain_height_daily)) {
    const v = Number(measurements.data.rain_height_daily?.[0]?.value);
    if (Number.isFinite(v)) rainfall_24h = v;
  }
  if (!rainfall_24h && Array.isArray(measurements?.data?.rain_height)) {
    try {
      const rainData = extractDailySeries(measurements.data.rain_height, "rain_height", 1);
      if (Number.isFinite(rainData?.today)) rainfall_24h = Number(rainData.today);
    } catch (e) {}
  }
  const weather_condition = (rainfall_24h > 0.1) ? "RAIN" : "DRY";

  // -----------------------------
  // Crop thresholds
  // -----------------------------
  const crop = CROP_PROFILE?.[parameters?.cultivation_type_general]?.[parameters?.cultivation_type];
  if (!crop) {
    return { ipsi: undefined, ipsiError: `δεν βρέθηκε τύπος καλλιέρειας: ${parameters?.cultivation_type_general}, ${parameters?.cultivation_type}` };
  }

  // -----------------------------
  // Soil thresholds (upper/lower) from independent routine
  // -----------------------------
  const lim = computeSoilMoistureLimits(parameters, crop);
  if (!lim.ok) {
    return { ipsi: undefined, ipsiError: lim.error };
  }

  const real_lower_limit = lim.real_lower_limit;
  const real_upper_limit = lim.real_upper_limit;

  // Backward compatible variables used later in IPSI
  let M_wilt = lim.M_wilt;
  let M_field_capacity = lim.M_field_capacity;
  let M_saturation = lim.M_saturation;

  // Plant signal (leaf-air difference)
  const T_diff = leafTempValue - airTempValue;

  // Logistic scaling for canopy temperature signal
  const f_T_diff = 1 / (1 + Math.exp(-3 * (T_diff - 1.5)));

  // ================================================================
  // STEP 0: HEAT STRESS OVERRIDE (A4 FIX)
  // ================================================================
  // Ref: Crafts-Brandner & Salvucci 2002 — RuBisCO deactivation >38°C
  // When T_air exceeds crop critical max AND VPD high → stomata close
  const T_heat_crit = Number(crop?.optimal_temp_range?.max) || 36;
  if (airTempValue > T_heat_crit && VPD > 1.8) {
    const heat_excess = airTempValue - T_heat_crit;
    const ipsiHeat = Math.min(10, heat_excess * 0.35 + (VPD - 1.8) * 1.2);
    return { ipsi: [
      { variable: "ipsi", value: parseFloat(ipsiHeat.toFixed(2)) },
      { variable: "ipsi_stress_type", value: "HEAT_STRESS" },
      { variable: "ipsi_confidence", value: "HIGH" },
      { variable: "ipsi_primary_cause", value: "T_air_exceeds_crop_critical" },
      { variable: "ipsi_T_crit", value: T_heat_crit },
      { variable: "ipsi_heat_excess", value: parseFloat(heat_excess.toFixed(1)) },
      { variable: "ipsi_weather_condition", value: weather_condition },
      { variable: "ipsi_rainfall_24h", value: rainfall_24h },
    ], ipsiError: "" };
  }

  // ================================================================
  // STEP 1: WATERLOGGING (oversaturation)
  // ================================================================
  // Uses soil saturation (preferred) + FC as secondary check.
  // Trigger if soil moisture is near saturation OR > 110% FC AND plant shows warm-leaf stress.
  const near_saturation = (Number.isFinite(M_saturation) && M_soil > M_saturation * 0.95);
  const above_fc = (Number.isFinite(M_field_capacity) && M_soil > M_field_capacity * 1.1);

  if (near_saturation || above_fc) {
    const ref = near_saturation ? M_saturation : M_field_capacity;
    const ratio = (Number.isFinite(ref) && ref > 0) ? (M_soil / ref) : 1.2;

    // base waterlogging severity: grows after threshold
    const waterlogging_stress_base = Math.min(5.0, (ratio - 1.0) * 8);

    if (T_diff > 1.0) {
      const ipsiWL = Math.min(10, waterlogging_stress_base * 2.5 * f_T_diff);
      const ipsi = parseFloat(ipsiWL.toFixed(2));
      ;
      return { ipsi: [
        { variable: "ipsi", value: ipsi },
        { variable: "ipsi_stress_type", value: "WATERLOGGING" },
        { variable: "ipsi_confidence", value: "HIGH" },
        { variable: "ipsi_primary_cause", value: "soil_oversaturation" },
        { variable: "ipsi_weather_condition", value: weather_condition },
        { variable: "ipsi_rainfall_24h", value: rainfall_24h },
      ], ipsiError: "" };
    }
  }

  // ================================================================
  // STEP 2: COLD SOIL PHYSIOLOGICAL DROUGHT
  // ================================================================
  let cold_stress_multiplier = 1.0;

  // If soil is cold and still reasonably wet (above ~60% FC), uptake can be limited
  if (T_soil < 10 && Number.isFinite(M_field_capacity) && M_soil > M_field_capacity * 0.6) {
    cold_stress_multiplier = 1.0 + (10 - T_soil) / 10; // 5°C => 1.5, 0°C => 2.0

    if (T_diff > 0.5) {
      const ipsiCold = Math.min(10, 5 * cold_stress_multiplier * (1 + VPD / 2.5));
      return { ipsi: [
        { variable: "ipsi", value: parseFloat(ipsiCold.toFixed(2)) },
        { variable: "ipsi_stress_type", value: "COLD_PHYSIOLOGICAL_DROUGHT" },
        { variable: "ipsi_confidence", value: "HIGH" },
        { variable: "ipsi_primary_cause", value: "cold_soil_prevents_uptake" },
        { variable: "ipsi_weather_condition", value: weather_condition },
        { variable: "ipsi_rainfall_24h", value: rainfall_24h },
      ], ipsiError: "" };
    }
  }

  // ================================================================
  // STEP 3: STANDARD DROUGHT COMPONENTS
  // ================================================================
  // Base soil-moisture stress when below crop lower bound,
  // but normalized using soil wilting point (from SOIL_PROFILE).
  let f_M_base = 0.0;
  if (
    Number.isFinite(real_lower_limit) &&
    Number.isFinite(M_wilt) &&
    (real_lower_limit > M_wilt) &&
    (M_soil < real_lower_limit)
  ) {
    f_M_base = Math.pow((real_lower_limit - M_soil) / (real_lower_limit - M_wilt), 1.5);
  }

  const f_VPD = 1 + (VPD / 2.5);

  // canopy signal (already logistic)
  const base_IPSI = (f_M_base * 5) * f_VPD * f_T_diff;

  // ================================================================
  // STEP 4: APPLY CONTEXTUAL MULTIPLIERS
  // ================================================================
  const contextual_IPSI = Math.min(10, base_IPSI * cold_stress_multiplier);

  // ================================================================
  // STEP 5: SIMPLE DIAGNOSIS FLAGS
  // ================================================================
  let stress_type = "NORMAL";
  let primary_cause = "none";

  if (f_M_base > 0.5) {
    stress_type = "DROUGHT";
    primary_cause = "low_soil_moisture";
  } else if (cold_stress_multiplier > 1.2) {
    stress_type = "COLD";
    primary_cause = "cold_soil_limits_uptake";
  } else if (VPD > 2.5) {
    stress_type = "ATMOSPHERIC";
    primary_cause = "high_atmospheric_demand";
  }

  return { ipsi: [
    { variable: "ipsi", value: parseFloat(contextual_IPSI.toFixed(2)) },
    { variable: "ipsi_stress_type", value: stress_type },
    { variable: "ipsi_confidence", value: f_M_base > 0.6 ? "HIGH" : f_M_base > 0.3 ? "MEDIUM" : "LOW" }, // B7 FIX
    { variable: "ipsi_primary_cause", value: primary_cause },
    { variable: "ipsi_weather_condition", value: weather_condition },
    { variable: "ipsi_rainfall_24h", value: rainfall_24h },

    // Diagnostics
    { variable: "ipsi_f_M_base", value: parseFloat(f_M_base.toFixed(3)) },
    { variable: "ipsi_f_VPD", value: parseFloat(f_VPD.toFixed(3)) },
    { variable: "ipsi_f_T_diff", value: parseFloat(f_T_diff.toFixed(3)) },
    { variable: "ipsi_cold_multiplier", value: parseFloat(cold_stress_multiplier.toFixed(2)) },
    { variable: "ipsi_T_soil", value: parseFloat(Number(T_soil).toFixed(2)) },
    { variable: "ipsi_T_diff", value: parseFloat(Number(T_diff).toFixed(2)) },
  ], ipsiError: "" };
}


/**
* Description: Υπολογίζει τις συσσωρευμένες βαθμοημέρες ανάπτυξης (GDD) από μια ημερομηνία έναρξης (Biofix).
* Αυτή η μέθοδος υψηλής ακρίβειας εκτελείται κάθε ώρα και αθροίζει τα αποτελέσματα για ένα ημερήσιο σύνολο,
* παρέχοντας ένα πιο ακριβές βιολογικό μοντέλο από έναν απλό ημερήσιο μέσο όρο.
*
* Inputs:
* - hourTich: (boolean) Determines if this is an hour tich
* - dailyTich: (boolean) Determines if this is an daily tich
* - measurements:
* - devToSendMeas:
* - parameters:
* - users:
*
*/
function calculate_GDD(hourTich, dailyTich, measurements, parameters) {
  if (!hourTich && !dailyTich) return;

  const GDD_HOURLY_PREFIX = "gdd_hourly_";
  const GDD_DAILY_PREFIX = "gdd_daily_";
  const GDD_ACCUMULATED_PREFIX = "gdd_accumulated_";
  let gddIndicators = [];

  // Build a quick matcher for allowed crops
  const matchesFieldCrop = (entry) =>
    entry &&
    entry.cultivation_type_general === parameters.cultivation_type_general &&
    entry.cultivation_type === parameters.cultivation_type;

  if (hourTich) {
    let airTemp;
    if (measurements?.data?.air_temperature) airTemp = measurements.data.air_temperature[0].value;
    else if (measurements?.data?.temperature) airTemp = measurements.data.temperature[0].value;
    else return;

    const GDD_CATEGORIES = ["insects", "mites"];
    for (const categoryKey of GDD_CATEGORIES) {
      const category = PATHOGEN_PROFILE[categoryKey] ?? {};
      for (const [pathogenKey, pathogen] of Object.entries(category)) {
        // ✅ only pests that list this field’s cultivation
        if (!Array.isArray(pathogen.crops) || !pathogen.crops.some(matchesFieldCrop)) continue;

        if (pathogen.pestBaseTemp != null) {
          const hourlyKey = `${GDD_HOURLY_PREFIX}${pathogenKey}`;
          const hourlyKeySum = `${GDD_HOURLY_PREFIX}${pathogenKey}_sum`;
          const dailyKey = `${GDD_DAILY_PREFIX}${pathogenKey}`;
          const accumulatedKey = `${GDD_ACCUMULATED_PREFIX}${pathogenKey}`;
          const T_base = Number(pathogen.pestBaseTemp);
          const T_upper = Number(pathogen.activityTempRange?.max ?? 35);
          const T_effective = Math.min(Number(airTemp), T_upper);
          const diff = T_effective - T_base;
          const gdd_hour = diff > 0 ? diff / 24 : 0;


          // Accumulate running daily sum every hourly tick
          const prevSumRaw = getVal(measurements, hourlyKeySum, 0);
          const prevSum = isSameLocalDay(measurements?._prevBundleTime, measurements?.now, measurements?.timezone)
            ? prevSumRaw
            : 0;
          const runningSum = gdd_hour + prevSum;

          gddIndicators = [
            ...gddIndicators,
            { variable: hourlyKey, value: gdd_hour },
            { variable: hourlyKeySum, value: runningSum },
          ];

          if (dailyTich) {
            const accumulated = getVal(measurements, accumulatedKey, 0);
            const totalAccumulated = runningSum + accumulated;

            gddIndicators = [
              ...gddIndicators,
              { variable: dailyKey, value: runningSum },
              { variable: accumulatedKey, value: totalAccumulated },
            ];
          }
        }
      }
    }
    return gddIndicators;
  }
}

/**
* Description: Υπολογίζει το VPD (σε kPa), μια μέτρηση της ικανότητας ξήρανσης του αέρα. Εκτελείται κάθε ώρα.
* Inputs:
* - hourTich: (boolean) Determines if this is an hour tich
* - measurements:
* - devToSendMeas:
* - parameters:
* - users:
*
*/
function calculate_VPD(hourTich, measurements, parameters) {
  if (!hourTich) {
    return { vpdData: undefined, vpdError: "" };
  }

  let airTemp;
  let airRH;

  if (measurements.data.air_temperature) { // Type of Sensecap s2120 //
    airTemp = measurements.data.air_temperature[0].value;
  } else if (measurements.data.temperature) { // Type of em300 //
    airTemp = measurements.data.temperature[0].value;
  } else {
    console.log('Not calculating VPD due to lack of air temperature')
    return { vpdData: undefined, vpdError: "έλλειψη αισθητήρα θερμοκρασίας αέρα" };
  }

  if (measurements.data.air_humidity) { // Type of Sensecap s2120 //
    airRH = measurements.data.air_humidity[0].value;
  } else if (measurements.data.humidity) { // Type of em300 //
    airRH = measurements.data.humidity[0].value;
  } else {
    console.log('Cannot calculate VPD: no humidity sensor');
    return { vpdData: undefined, vpdError: 'έλλειψη αισθητήρα υγρασίας αέρα' };
  }

  const es = 0.6108 * Math.exp(17.27 * airTemp / (airTemp + 237.3));
  const ea = (airRH / 100) * es;
  const vpd = es - ea;
  return { vpdData: [{variable: "vpd", value: vpd}], vpdError: "" };
}

function getPathogenMessages(fir) {
  const FIR_PREFIX = 'fir_';
  if (fir === undefined) {
    return;
  }
  let messages = []
  for (const pathogenfir of fir) {

    const pathogenKey = pathogenfir.variable.slice(FIR_PREFIX.length);
    if (pathogenKey.startsWith(`ction_hours_counter_`)) {
      continue;
    }
    const firValue = pathogenfir.value;
    let pathogen = undefined;
    for (const [categoryKey, category] of Object.entries(PATHOGEN_PROFILE)) {
      if (pathogenKey in category) {
        pathogen = category[pathogenKey]; // ✅ found
        break;
      }
    }
    if (pathogen === undefined) {
      continue;
    }
    const pathogenName = pathogen.name;

    if (firValue < 0.2) {
      messages =  [...messages, {variable: `fir_message_${pathogenKey}`, value: 'Χαμηλός Κίνδυνος', metadata: { color: 'green', text: `Ο κίνδυνος ${pathogenName} είναι επί του παρόντος χαμηλός (FIR = ${firValue.toLocaleString('el-GR', { maximumFractionDigits: 2 })}). Η προστασία των καλλιεργειών είναι επαρκής.»`}}]
    } else if (firValue < 0.4) {
      messages =  [...messages, {variable: `fir_message_${pathogenKey}`, value: 'Μέτριος Κίνδυνος', metadata: { color: 'blue', text: `Ο κίνδυνος ${pathogenName} αυξάνεται (FIR = ${firValue.toLocaleString('el-GR', { maximumFractionDigits: 2 })}). Η προστασία με φυτοφάρμακα εξασθενεί. Παρακολουθήστε στενά τις συνθήκες.»`}}]
    } else if (firValue < 0.7) {
      messages =  [...messages, {variable: `fir_message_${pathogenKey}`, value: 'Υψηλός Κίνδυνος', metadata: { color: 'yellow', text: `Υψηλός κίνδυνος για ${pathogenName}. Οι περιβαλλοντικές συνθήκες είναι ευνοϊκές για τη μόλυνση και η προστασία των καλλιεργειών είναι χαμηλή (FIR = ${firValue.toLocaleString('el-GR', { maximumFractionDigits: 2 })}). Προετοιμαστείτε για την εφαρμογή κατάλληλου φυτοφαρμάκου.`}}]
    } else {
      messages =  [...messages, {variable: `fir_message_${pathogenKey}`, value: 'Σοβαρός Κίνδυνος', metadata: { color: 'red', text: `Απαιτείται άμεση δράση: Σοβαρός κίνδυνος ${pathogenName}. Η καλλιέργεια είναι ευάλωτη και οι συνθήκες είναι ιδανικές για μόλυνση (FIR = ${firValue.toLocaleString('el-GR', { maximumFractionDigits: 2 })}). Εφαρμόστε φυτοφάρμακο το συντομότερο δυνατόν.`}}]
    }
  }
  return messages;
}


// ============================================================
// BPI PRODUCTION MESSAGING TEMPLATES
// Primary: Daily (actionable). Secondary: Accumulated (context).
// ============================================================
function buildBPIMessages({ efficiency_pct, limiting_factor, performance_pct }) {
  const daily = {};
  const accumulated = {};

  // DAILY
  // Downgrade severity αν ο limiting factor είναι "cool" (δροσερό, ΟΧΙ ζημιογόνο)
  if (limiting_factor === "cool") {
    // "Cool growth" δεν είναι stress — ενημερωτικό μήνυμα, ΟΧΙ alarm
    if (efficiency_pct >= 30) {
      daily.severity = "advisory";  // μπλε αντί κόκκινο
    } else {
      daily.severity = "warning";   // πορτοκαλί, ΟΧΙ κόκκινο
    }
    daily.message = "Μειωμένη ανάπτυξη λόγω δροσερών συνθηκών";
    // Εποχιακό context
    const month = new Date().getMonth();
    const isCoolSeason = (month >= 10 || month <= 3); // Νοέ-Απρ
    if (isCoolSeason && efficiency_pct >= 20) {
      daily.message += ", Φυσιολογικό για την εποχή.";
      daily.severity = "info";  // πράσινο/γκρι
    }
  }
  else {
    if (efficiency_pct >= 90) {
      daily.message = "✅ Κανονική ανάπτυξη σήμερα — δεν απαιτείται παρέμβαση.";
      daily.severity = "info";
    } else if (efficiency_pct >= 75) {
      daily.severity = "advisory";
      if (limiting_factor === "water")
        daily.message = "⚠️ Ήπιος περιορισμός ανάπτυξης λόγω μειωμένης εδαφικής υγρασίας.";
      else if (limiting_factor === "cold" || limiting_factor === "cool")
        daily.message = "❄️ Ήπια μείωση ανάπτυξης λόγω δροσερού καιρού.";
      else if (limiting_factor === "heat" || limiting_factor === "warm")
        daily.message = "☀️ Ήπια μείωση ανάπτυξης λόγω ζέστης.";
      else if (limiting_factor === "temperature")
        daily.message = "⚠️ Ήπια θερμοκρασιακή μείωση ανάπτυξης.";
      else if (limiting_factor === "root")
        daily.message = "⚠️ Μέτρια δραστηριότητα ριζών.";
      else
        daily.message = "⚠️ Ήπιος περιορισμός ανάπτυξης.";
    } else if (efficiency_pct >= 55) {
      daily.severity = "warning";
      if (limiting_factor === "water")
        daily.message = "⚠️ Περιορισμός ανάπτυξης λόγω έλλειψης νερού. Συνιστάται έλεγχος άρδευσης.";
      else if (limiting_factor === "cold" || limiting_factor === "cool")
        daily.message = "❄️ Σημαντική μείωση ανάπτυξης λόγω ψύχους. Η καλλιέργεια αναπτύσσεται αργά.";
      else if (limiting_factor === "heat" || limiting_factor === "warm")
        daily.message = "☀️ Θερμική καταπόνηση μειώνει τη φωτοσύνθεση.";
      else if (limiting_factor === "temperature")
        daily.message = "⚠️ Θερμοκρασιακός περιορισμός στην ανάπτυξη.";
      else if (limiting_factor === "root")
        daily.message = "⚠️ Περιορισμένη απορρόφηση από ρίζες.";
      else
        daily.message = "⚠️ Μέτριος περιορισμός ανάπτυξης.";
    } else {
      daily.severity = "alert";
      if (limiting_factor === "water")
        daily.message = "🚨 Σημαντικός περιορισμός ανάπτυξης λόγω έλλειψης νερού — προτείνεται άμεση άρδευση.";
      else if (limiting_factor === "cold" || limiting_factor === "cool")
        daily.message = "❄️ Πολύ χαμηλή θερμοκρασία — η ανάπτυξη είναι σχεδόν σταματημένη.";
      else if (limiting_factor === "heat" || limiting_factor === "warm")
        daily.message = "🔥 Έντονη θερμική καταπόνηση λόγω υψηλής θερμοκρασίας!";
      else if (limiting_factor === "temperature")
        daily.message = "🚨 Ακραίος θερμοκρασιακός περιορισμός.";
      else if (limiting_factor === "root")
        daily.message = "🚨 Χαμηλή δραστηριότητα ριζών.";
      else
        daily.message = "🚨 Σοβαρός περιορισμός ανάπτυξης.";
    }
  }

  // ACCUMULATED
  if (performance_pct >= 90) {
    accumulated.message = "📊 Η καλλιέργεια αξιοποιεί καλά το δυναμικό ανάπτυξης μέχρι σήμερα.";
  } else if (performance_pct >= 75) {
    accumulated.message = "📊 Μικρή απόκλιση από το δυναμικό ανάπτυξης μέχρι σήμερα.";
  } else if (performance_pct >= 60) {
    accumulated.message = "📊 Υπάρχει συσσωρευμένη απώλεια ανάπτυξης — απαιτείται προσεκτική διαχείριση.";
  } else {
    accumulated.message = "📊 Σημαντική απόκλιση από το δυναμικό ανάπτυξης — εξετάστε συνολικά τη διαχείριση.";
  }

  return { daily, accumulated };
}

function getFertilizationGrowthMessages(bpi, bpiError, bpiContext) {
  // New contextual BPI UI messaging:
  // - Primary: daily efficiency + limiting factor
  // - Secondary: accumulated performance vs potential
  if (bpiContext && typeof bpiContext === "object" && Number.isFinite(Number(bpiContext.efficiency_pct))) {
    const { daily, accumulated } = buildBPIMessages({
      efficiency_pct: Number(bpiContext.efficiency_pct),
      limiting_factor: bpiContext.limiting_factor || "mixed",
      performance_pct: Number(bpiContext.performance_pct ?? 0),
    });

    let dailyColor = "grey";
    let dailyValue = "Μη διαθέσιμο";
      if (daily.severity === "info"){
        dailyColor ="green";
        dailyValue = "Κανονικό";
      }
      if (daily.severity === "advisory"){
        dailyColor ="blue";
        dailyValue = "Ήπιο";
      }
      if (daily.severity === "warning"){
        dailyColor ="orange";
        dailyValue = "Μειωμένο";
      }
      if (daily.severity === "alert"){
        dailyColor ="red";
        dailyValue = "Ελάχιστο";
      }

    const dailyMeta = {
      color: dailyColor,
      severity: daily.severity,
      // keep old style text field for UI tooltips
      text: daily.message,
      code: bpiContext?.status?.code || "NONE",
    };

    const seasonMeta = {
      color: (Number(bpiContext.performance_pct ?? 0) >= 90) ? "green" : (Number(bpiContext.performance_pct ?? 0) >= 75) ? "blue" : (Number(bpiContext.performance_pct ?? 0) >= 60) ? "orange" : "red",
      text: accumulated.message,
      performance_pct: bpiContext.performance_pct,
      total_actual: bpiContext.total_actual,
      total_potential: bpiContext.total_potential,
    };

    return [
      // Backward compatible main message variable
      { variable: "bpi_message", value: dailyValue, metadata: dailyMeta },
      // Secondary UI channel
      { variable: "bpi_season_message", value: accumulated.message, metadata: seasonMeta },
    ];
  }

  // Fallback to legacy behaviour if no context is available
  if (bpi === undefined || !Array.isArray(bpi) || Number.isNaN(bpi[0]?.value)) {
    if (bpiError !== undefined && bpiError !== "") {
      const isSensorError = !bpiError.includes("tich");
      const text = isSensorError
        ? bpiError.charAt(0).toUpperCase() + bpiError.slice(1)
        : `Το δυναμικό ανάπτυξης δεν μπορεί να υπολογιστεί λόγω: ${bpiError}`;
      return [
        {
          variable: "bpi_message",
          value: "Μη διαθέσιμο",
          metadata: { color: "grey", text },
        },
      ];
    }
    return;
  }

  bpi = bpi[0].value;
  let messages = [];
  if (bpi < 0.3) {
    messages = [
      ...messages,
      {
        variable: "bpi_message",
        value: "Πολύ χαμηλή ανάπτυξη",
        metadata: {
          color: "red",
          text: `Το δυναμικό ανάπτυξης είναι πολύ χαμηλό (BPI = ${bpi.toLocaleString("el-GR", {
            maximumFractionDigits: 2,
          })}). Ελέγξτε για υψηλό στρες νερού (IPSI) ή ακραίες θερμοκρασίες.`,
        },
      },
    ];
  } else if (bpi < 0.7) {
    messages = [
      ...messages,
      {
        variable: "bpi_message",
        value: "Μέτρια ανάπτυξη",
        metadata: {
          color: "blue",
          text: `Η ανάπτυξη των φυτών είναι μέτρια (BPI = ${bpi.toLocaleString("el-GR", {
            maximumFractionDigits: 2,
          })}). Η ζήτηση θρεπτικών ουσιών είναι στα αναμενόμενα επίπεδα για αυτό το στάδιο.`,
        },
      },
    ];
  } else {
    messages = [
      ...messages,
      {
        variable: "bpi_message",
        value: "Υψηλή ανάπτυξη",
        metadata: {
          color: "green",
          text: `Εξαιρετικές συνθήκες ανάπτυξης (BPI = ${bpi.toLocaleString("el-GR", {
            maximumFractionDigits: 2,
          })}). Το φυτό έχει υψηλή ζήτηση θρεπτικών ουσιών για να υποστηρίξει αυτή την ανάπτυξη.`,
        },
      },
    ];
  }
  return messages;
}


function getIrrigationAndPlantStressMessages(ipsi, irrigationVolumeParams, ipsiError="") {

  let messages = [];

  // If IPSI is missing/invalid, provide reason (same pattern as BPI) when available
  if (ipsi === undefined || !Array.isArray(ipsi) || ipsi[0] === undefined || Number.isNaN(Number(ipsi[0]?.value))) {
    if (ipsiError !== undefined && ipsiError !== "") {
      const isSensorError = !ipsiError.includes("tich");
      const text = isSensorError
        ? ipsiError.charAt(0).toUpperCase() + ipsiError.slice(1)
        : `Το IPSI δεν μπορεί να υπολογιστεί λόγω: ${ipsiError}`;
      return [
        {
          variable: "plant_stress",
          value: "Μη διαθέσιμο",
          metadata: { color: "grey", text },
        },
      ];
    }
    return messages;
  }

  ipsi = Number(ipsi[0].value);

  if (ipsi !== undefined) {
    if (ipsi < 0) {
      messages =  [...messages, {variable: 'plant_stress', value: 'Μην ποτίζεις', metadata: { color: 'blue', text: `Το φυτό έχει περίσσεια νερού και «ιδρώνει» έντονα. Δείκτης άριστης υγείας και μέγιστου φωτοσυνθετικού ρυθμού. (IPSI = ${ipsi.toLocaleString('el-GR', { maximumFractionDigits: 2 })})`}}]
    } else if (ipsi < 3) {
      messages =  [...messages, {variable: 'plant_stress', value: 'Ιδανικό', metadata: { color: 'green', text: ` Το ισοζύγιο είναι τέλειο. Το φυτό καταναλώνει όσο νερό χρειάζεται χωρίς σπατάλες. (IPSI = ${ipsi.toLocaleString('el-GR', { maximumFractionDigits: 2 })})`}}]
    } else if (ipsi < 6) {
      messages =  [...messages, {variable: 'plant_stress', value: 'Προγραμμάτισε πότισμα', metadata: { color: 'yellow', text: `Το φυτό αρχίζει να κλείνει μερικώς τα στόματα για άμυνα. Η ανάπτυξη επιβραδύνεται ελαφρώς. Το έδαφος πλησιάζει το κατώτατο όριο. (IPSI = ${ipsi.toLocaleString('el-GR', { maximumFractionDigits: 2 })})`}}]
    } else {
      let irrigationText = '';
      if (irrigationVolumeParams !== undefined) {
        const grossIrrigationLiters = irrigationVolumeParams.find(meas => meas.variable === 'grossIrrigationLiters').value;
        const irrigationDurationHours = irrigationVolumeParams.find(meas => meas.variable === 'irrigationDurationHours').value;
        irrigationText = `Σύσταση: Ποτίστε με ${grossIrrigationLiters.toLocaleString('el-GR', { maximumFractionDigits: 2 })} λίτρα`; // για ${irrigationDurationHours.toLocaleString('el-GR', { maximumFractionDigits: 2 })} ώρες`;
      }
      messages =  [...messages, {variable: 'plant_stress', value: 'Πότισε τώρα!', metadata: { color: 'red', text: `Πλήρες κλείσιμο στομάτων. Η φωτοσύνθεση σταματά. Θερμικό σοκ. Κίνδυνος φυλλόπτωσης ή συρρίκνωσης καρπού. (IPSI = ${ipsi.toLocaleString('el-GR', { maximumFractionDigits: 2 })})`}}]
    }
  }
  return messages;
}

function mapByVariable(arr = []) {
  const map = {};
  for (const row of arr) {
    if (row && row.variable) {
      map[row.variable] = row;
    }
  }
  return map;
}

/**
 * Packs many calculated indicators into a single Tago variable to save resources.
 *
 * Instead of writing one Tago variable per calculation (vpd, ipsi, bpi, gdd_* ...),
 * we write a single variable (default: field_calcs) whose metadata holds the
 * computed values. Messages are also included per crop in the same bundle.
 */
function packCalculatedIndicators({
  sharedIndicators = [],
  perCropIndicators = {},
  prevBundle = null,
  variable = FIELD_BUNDLE_VAR,
}) {
  /**
   * We pack each indicator/message as:
   *   key: { value: <any>, metadata: { ... } }
   * metadata is ALWAYS present (at least {}), so the custom widget can render
   * titles/text/colors exactly like before.
   *
   * Additionally, for indicators that are not recalculated on every run (e.g. dailyTich),
   * we can carry forward ("keep alive") previous values from the last FIELD_BUNDLE_VAR.
   */
  const normalize = (item) => {
    if (!item?.variable) return null;
    const meta = (item.metadata && typeof item.metadata === "object") ? item.metadata : {};
    // If this item is already in packed format, keep it
    if (item.value && typeof item.value === "object" && "value" in item.value && "metadata" in item.value) {
      const packedMeta = (item.value.metadata && typeof item.value.metadata === "object") ? item.value.metadata : {};
      return [String(item.variable), { value: item.value.value, metadata: packedMeta }];
    }
    return [String(item.variable), { value: item.value, metadata: meta }];
  };

  const sharedPacked = {};
  for (const it of (sharedIndicators || [])) {
    const kv = normalize(it);
    if (!kv) continue;
    const [k, v] = kv;
    sharedPacked[k] = v;
  }

  const cropsPackedArr = [];
  for (const [cropId, items] of Object.entries(perCropIndicators || {})) {
    const indicators = {};
    for (const it of (items || [])) {
      const kv = normalize(it);
      if (!kv) continue;
      const [k, v] = kv;
      indicators[k] = v;
    }
    cropsPackedArr.push({ id: cropId, indicators });
  }

  // ---- KEEP EXISTING INDICATORS (carry-forward) ----
  // If some indicators weren't recalculated in this run (e.g. daily-only metrics),
  // keep them from the previous bundle so the UI continues showing them.
  const prevShared = prevBundle?.shared && typeof prevBundle.shared === "object" ? prevBundle.shared : {};
  const prevCropsById = prevBundle?.cropsById && typeof prevBundle.cropsById === "object" ? prevBundle.cropsById : {};

  // shared: fill missing keys
  for (const [k, v] of Object.entries(prevShared)) {
    if (sharedPacked[k] == null) {
      // v might be primitive (legacy) or packed
      if (v && typeof v === "object" && "value" in v && "metadata" in v) sharedPacked[k] = v;
      else sharedPacked[k] = { value: v, metadata: {} };
    }
  }

  // crops: per crop fill missing keys
  for (const crop of cropsPackedArr) {
    const prevIndicators = prevCropsById[crop.id];
    if (!prevIndicators || typeof prevIndicators !== "object") continue;
    for (const [k, v] of Object.entries(prevIndicators)) {
      if (crop.indicators[k] == null) {
        if (v && typeof v === "object" && "value" in v && "metadata" in v) crop.indicators[k] = v;
        else crop.indicators[k] = { value: v, metadata: {} };
      }
    }
  }

  const compressedData = compressFieldBundle({ shared: sharedPacked, crops: cropsPackedArr });
  return [
    {
      variable,
      value: 1,
      metadata: {
        schema: { name: variable, version: 2, compression: 'deflate-raw-base64' },
        data: compressedData,
      },
    },
  ];
}
/*
 from the same device we write to.
 * Returns { time, shared, cropsById } where cropsById is a map cropId -> indicators object.
 */
async function fetchLastFieldBundle(devToSendMeas) {
  try {
    const lastArr = await devToSendMeas.getData({
      variables: [FIELD_BUNDLE_VAR],
      qty: 1,
    });
    const last = lastArr?.[0];
    const meta = last?.metadata || {};
    let shared = {};
    let cropsArr = [];
    if (meta.schema?.compression === 'deflate-raw-base64' && meta.data) {
      try {
        const payload = decompressFieldBundle(meta.data);
        shared = payload.shared || {};
        cropsArr = Array.isArray(payload.crops) ? payload.crops : [];
      } catch (e) {
        console.warn('Failed to decompress field_bundle:', e);
      }
    } else {
      shared = meta.shared || {};
      cropsArr = Array.isArray(meta.crops) ? meta.crops : [];
    }
    const cropsById = {};
    for (const c of cropsArr) {
      if (c?.id) cropsById[c.id] = c.indicators || {};
      // keep as-is (value+metadata objects) for UI; legacy calcs will unwrap values in injectPrevIndicators
    }
    return { time: last?.time, shared, cropsById };
  } catch (_e) {
    return { time: undefined, shared: {}, cropsById: {} };
  }
}

// Inject previous indicators into a measurements object as "series" so legacy code can read [0].value patterns.
function injectPrevIndicators(measurements, shared, cropIndicators) {
  if (!measurements || !measurements.data) return;
  const target = measurements.data;

  const unwrap = (v) => {
    // v can be a primitive (old), or {value, metadata}
    if (v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, "value")) {
      return v.value;
    }
    return v;
  };

  const inject = (obj) => {
    for (const [k, v] of Object.entries(obj || {})) {
      // Don't overwrite live sensor series already present
      if (target[k] !== undefined) continue;
      target[k] = [{ value: unwrap(v) }];
    }
  };

  inject(shared);
  inject(cropIndicators);
}

function prefixTagoVariables(items = [], prefix = "") {
  if (!prefix) return items;
  return (items || []).map((item) => {
    if (!item || !item.variable) return item;
    return {
      ...item,
      variable: `${prefix}${item.variable}`,
    };
  });
}

async function getMeasurements(hourTich, dailyTich, devices, fieldId, fieldName) {
  let data = {};
  const now = moment().toISOString();
  const defaultStart24h = moment().subtract(24, "hours").toISOString();


  for (const [key, value] of Object.entries(devices)) {
    // value = device name/label used in getTokenByName
    const deviceToken = await import_sdk.Utils.getTokenByName(account, value);
    const device = new import_sdk.Device({ token: deviceToken });

    const info = await device.info();
    const typeTag = info.tags?.find((t) => t.key === "type");
    console.log('To read type: ', typeTag) // UNCOMMENT_WHEN_TROUBLESHOOTING
    const typeName = typeTag?.value;

    // We'll accumulate everything for this device here and assign once.
    let deviceData = {};

    if (typeName === "em300_th" || typeName === "em320_th") {
      let avgArr;
      let maxArr;
      let minArr;
      let sumArr;
      try {
        [avgArr, maxArr, minArr, sumArr] = await Promise.all([
          device.getData({
            variables: ["temperature"],
            query: "avg",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["temperature"],
            query: "max",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["temperature"],
            query: "min",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["temperature"],
            query: "sum",
            start_date: defaultStart24h,
            end_date: now,
          }),
        ]);
      }
      catch (e) {
        console.log(`[${fieldName}] Reading temperature data from device: ${info?.name || value} failed with error: ${e}`);
      }

      const avgMap = mapByVariable(avgArr);
      const maxMap = mapByVariable(maxArr);
      const minMap = mapByVariable(minArr);
      const sumMap = mapByVariable(sumArr);

      if (
        (deviceData.air_temperature_avg === null ||
          deviceData.air_temperature_avg === undefined) &&
        avgMap.temperature
      ) {
        deviceData.air_temperature_avg = Number(avgMap.temperature.value);
      }

      if (
        (deviceData.air_temperature_max === null ||
          deviceData.air_temperature_max === undefined) &&
        maxMap.temperature
      ) {
        deviceData.air_temperature_max = Number(maxMap.temperature.value);
      }

      if (
        (deviceData.air_temperature_min === null ||
          deviceData.air_temperature_min === undefined) &&
        minMap.temperature
      ) {
        deviceData.air_temperature_min = Number(minMap.temperature.value);
      }

      if (
        (deviceData.air_temperature_sum === null ||
          deviceData.air_temperature_sum === undefined) &&
        sumMap.temperature
      ) {
        deviceData.air_temperature_sum = Number(sumMap.temperature.value);
      }
    }

    // ─────────────────────────────────────────────
    // TYPE: s2120 → stats + optional rain sum
    // ─────────────────────────────────────────────
    if (typeName === "s2120") {
      // 1) 24h stats for air_temperature & light_intensity (avg + max)
      let avgAirTempArr, avgLuxTempArr, maxTempArr, maxLuxArr, minTempArr, sumTempArr, sumLuxArr;
      try {
        [avgAirTempArr, avgLuxTempArr, maxTempArr, maxLuxArr, minTempArr, sumTempArr, sumLuxArr] = await Promise.all([
          device.getData({
            variables: ["air_temperature"],
            query: "avg",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["light_intensity"],
            query: "avg",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["air_temperature"],
            query: "max",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["light_intensity"],
            query: "max",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["air_temperature"],
            query: "min",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["air_temperature"],
            query: "sum",
            start_date: defaultStart24h,
            end_date: now,
          }),
          device.getData({
            variables: ["light_intensity"],
            query: "sum",
            start_date: defaultStart24h,
            end_date: now,
          }),
        ]);

        if (
          (deviceData.air_temperature_avg === null ||
            deviceData.air_temperature_avg === undefined) &&
          avgAirTempArr[0].value
        ) {
          deviceData.air_temperature_avg = Number(avgAirTempArr[0].value);
        }
        if (
          (deviceData.air_temperature_max === null ||
            deviceData.air_temperature_max === undefined) &&
          maxTempArr[0].value
        ) {
          deviceData.air_temperature_max = Number(maxTempArr[0].value);
        }
        if (
          (deviceData.air_temperature_min === null ||
            deviceData.air_temperature_min === undefined) &&
          minTempArr[0].value
        ) {
          deviceData.air_temperature_min = Number(minTempArr[0].value);
        }
        if (
          (deviceData.air_temperature_sum === null ||
            deviceData.air_temperature_sum === undefined) &&
          sumTempArr[0].value
        ) {
          deviceData.air_temperature_sum = Number(sumTempArr[0].value);
        }
        if (
          (deviceData.light_intensity_avg === null ||
            deviceData.light_intensity_avg === undefined) &&
          avgLuxTempArr[0].value
        ) {
          deviceData.light_intensity_avg = Number(avgLuxTempArr[0].value);
        }
        if (
          (deviceData.light_intensity_max === null ||
            deviceData.light_intensity_max === undefined) &&
          maxLuxArr[0].value
        ) {
          deviceData.light_intensity_max = Number(maxLuxArr[0].value);
        }
        if (
          (deviceData.light_intensity_sum === null ||
            deviceData.light_intensity_sum === undefined) &&
          sumLuxArr[0].value
        ) {
          deviceData.light_intensity_sum = Number(sumLuxArr[0].value);
        }
      }
      catch (e) {
        console.log(`[${fieldName}] Reading data from device: ${info?.name || value} failed with error: ${e}`);
      }

      // 2) Optional rain_height sum, only if hourTich OR dailyTich
      if (hourTich || dailyTich) {
        let start;
        let fieldName;

        if (hourTich) {
          start = moment().subtract(60, "minutes").toISOString();
          fieldName = "rain_height_hourly";
        } else {
          // dailyTich
          start = defaultStart24h;
          fieldName = "rain_height_daily";
        }

        let totalRain;
        try {
          totalRain = await device.getData({
            variable: "rain_height",
            query: "sum",
            start_date: start,
            end_date: now,
          });
        }
        catch (e) {
          console.log(`[${fieldName}] Reading data from device: ${info?.name || value} failed with error: ${e}`);
        }

        deviceData[fieldName] = totalRain;

        // Save and skip generic logic for this device
        data = {...data, ...deviceData};
      }

      // If NO ticks, we still keep the stats above,
      // and then fall through to generic TYPE_VARIABLES logic (if defined)
      // or fallback below.
    }

    // ─────────────────────────────────────────────
    // TYPE: se0x or lse02 → soil_moisture1 avg (24h)
    // ─────────────────────────────────────────────
    if (
      typeName &&
      (typeName === "lse02" || typeName === "se0x")
    ) {

      let soil_moisture1_avg;
      try {
        soil_moisture1_avg = await device.getData({
          variable: ['soil_moisture1'],
          start_date: defaultStart24h,
          query: 'avg'
        });
      }
      catch (e) {
        console.log(`[${fieldName}] Reading data from device: ${info?.name || value} failed with error: ${e}`);
      }

      deviceData.soil_moisture1_avg = soil_moisture1_avg;

      let soil_temperature1_avg;
      try {
        soil_temperature1_avg = await device.getData({
          variable: ['soil_temperature1'],
          start_date: defaultStart24h,
          query: 'avg'
        });
      }
      catch (e) {
        console.log(`[${fieldName}] Reading data from device: ${info?.name || value} failed with error: ${e}`);
      }

      deviceData.soil_temperature1_avg = soil_temperature1_avg;

      data = {...data, ...deviceData};
    }

    // ─────────────────────────────────────────────
    // TYPE: lse01 → water_soil avg (24h)
    // ─────────────────────────────────────────────
    if (typeName === "lse01") {
      let soil_moisture_avg;
      // console.log('Reading type lse01'); // UNCOMMENT_WHEN_TROUBLESHOOTING
      try {
        soil_moisture_avg = await device.getData({
          variable: ['soil_moisture'],
          start_date: defaultStart24h,
          query: 'avg'
        });
      } catch (e) {
        console.log(`[${fieldName}] Reading soil_moisture from device: ${info?.name || value} failed with error: ${e}`);
      }

      deviceData.soil_moisture_avg = soil_moisture_avg;

      let temp_soil_avg;

      try {
        temp_soil_avg = await device.getData({
          variable: ['temp_soil'],
          start_date: defaultStart24h,
          query: 'avg'
        });
      } catch (e) {}
      // Fail-safe: try alternate *temperature* variable name (do not use soil_moisture as temperature)
      if (!temp_soil_avg) {
        try {
          temp_soil_avg = await device.getData({
            variable: ['soil_temperature'],
            start_date: defaultStart24h,
            query: 'avg'
          });
        } catch (e) {
          console.log(`[${fieldName}] Reading soil_temperature from device: ${info?.name || value} failed with error: ${e}`);
        }
      }

      deviceData.temp_soil_avg = temp_soil_avg;

      data = {...data, ...deviceData};
    }

    // ─────────────────────────────────────────────
    // GENERIC: known type → last_item within last 24h
    // (also handles s2120 when no ticks IF you add s2120 to TYPE_VARIABLES)
    // ─────────────────────────────────────────────
    const varsForType = typeName ? DEVICE_TYPE_VARIABLES[typeName] : null;
    if (!!varsForType && (varsForType !== null) && varsForType.length > 0) {
      // [SOIL-DEPTH TAG] lse01_shallow/lse01_deep probes emit BARE lse01 names via the default parser.
      // Read those too and remap to the depth slot (_1/_2) — no parser change needed — then re-publish
      // the suffixed value so the dashboard's Ρηχό/Βαθύ cards populate.
      const _soilSuffix = typeName === "lse01_shallow" ? "1" : (typeName === "lse01_deep" ? "2" : null);
      const readVars = _soilSuffix
        ? Array.from(new Set([...varsForType, "soil_moisture", "temp_soil", "conduct_soil"]))
        : varsForType;
      let lastItems;
      try {
        lastItems = await device.getData({
          variables: readVars,
          query: "last_item",
          start_date: defaultStart24h
        });
      } catch (e) {
        console.log(`[${fieldName}] Reading last items from device: ${info?.name || value} failed with error: ${e}`);
      }

      const grouped = groupMeasurementsByVariable(lastItems || []);

      if (_soilSuffix) {
        const _remap = {
          soil_moisture: `soil_moisture${_soilSuffix}`,
          temp_soil: `soil_temperature${_soilSuffix}`,
          conduct_soil: `conduct_soil${_soilSuffix}`,
        };
        const _republish = [];
        for (const [bare, suff] of Object.entries(_remap)) {
          if (grouped[bare]) {
            grouped[suff] = grouped[bare].map((m) => ({ ...m, variable: suff }));
            delete grouped[bare];
            const v = grouped[suff][0];
            if (v && Number.isFinite(Number(v.value))) _republish.push({ variable: suff, value: Number(v.value), unit: v.unit });
          }
        }
        if (_republish.length) {
          try { await device.sendData(_republish); }
          catch (e) { console.log(`[${fieldName}] soil-depth republish failed: ${e && e.message}`); }
        }
      }

      // merge generic data with any stats we already added
      deviceData = {
        ...deviceData,
        ...grouped,
      };

      data = {...data, ...deviceData};
      continue;
    }
  }

  const fieldToken = await import_sdk.Utils.getTokenByName(account, fieldId);
  const fieldDevice = new import_sdk.Device({ token: fieldToken });

  const varsForFieldType = DEVICE_TYPE_VARIABLES['field'];
  if (varsForFieldType && varsForFieldType.length > 0) {
    const arraysNum = 1+ Math.round(varsForFieldType.length / 20);
    let lastItems = [];
    for (let i=0; i< arraysNum; i++) {
      const a = varsForFieldType.slice(20*i, 20*i + 20);
      let lastItemsChunk;
      try {
        lastItemsChunk = await fieldDevice.getData({
          variables: a,
          start_date: defaultStart24h,
          query: "last_item"
        });
      } catch (e) {
        console.log(`[${fieldName}] Reading last items from device: ${info?.name || value} failed with error: ${e}`);
      }
      lastItems = [
        ...lastItems,
        ...lastItemsChunk
      ];
    }

    const grouped = groupMeasurementsByVariable(lastItems || []);

    data = {...data, ...grouped};
  }

  let gdd_hourly_bactrocera_sum;
  try {
    gdd_hourly_bactrocera_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_bactrocera"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  }
  catch (e) {};
  if (gdd_hourly_bactrocera_sum && gdd_hourly_bactrocera_sum.length > 0) {
    data.gdd_hourly_bactrocera_sum = gdd_hourly_bactrocera_sum;
  }

  let gdd_hourly_prays_oleae_sum;
  try {
    gdd_hourly_prays_oleae_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_prays_oleae"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_prays_oleae_sum && gdd_hourly_prays_oleae_sum.length > 0) {
    data.gdd_hourly_prays_oleae_sum = gdd_hourly_prays_oleae_sum;
  }

  let gdd_hourly_palpita_unionalis_sum;
  try {
    gdd_hourly_palpita_unionalis_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_palpita_unionalis"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_palpita_unionalis_sum && gdd_hourly_palpita_unionalis_sum.length > 0) {
    data.gdd_hourly_palpita_unionalis_sum = gdd_hourly_palpita_unionalis_sum;
  }

  let gdd_hourly_tuta_absoluta_sum;
  try {
    gdd_hourly_tuta_absoluta_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_tuta_absoluta"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_tuta_absoluta_sum && gdd_hourly_tuta_absoluta_sum.length > 0) {
    data.gdd_hourly_tuta_absoluta_sum = gdd_hourly_tuta_absoluta_sum;
  }

  let gdd_hourly_myzus_persicae_sum;
  try {
    gdd_hourly_myzus_persicae_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_myzus_persicae"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_myzus_persicae_sum && gdd_hourly_myzus_persicae_sum.length > 0) {
    data.gdd_hourly_myzus_persicae_sum = gdd_hourly_myzus_persicae_sum;
  }

  let gdd_hourly_ceratitis_capitata_sum;
  try {
    gdd_hourly_ceratitis_capitata_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_ceratitis_capitata"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_ceratitis_capitata_sum && gdd_hourly_ceratitis_capitata_sum.length > 0) {
    data.gdd_hourly_ceratitis_capitata_sum = gdd_hourly_ceratitis_capitata_sum;
  }

  let gdd_hourly_bemisia_tabaci_sum;
  try {
    gdd_hourly_bemisia_tabaci_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_bemisia_tabaci"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_bemisia_tabaci_sum && gdd_hourly_bemisia_tabaci_sum.length > 0) {
    data.gdd_hourly_bemisia_tabaci_sum = gdd_hourly_bemisia_tabaci_sum;
  }

  let gdd_hourly_tetranychus_urticae_sum;
  try {
    gdd_hourly_tetranychus_urticae_sum = await fieldDevice.getData({
      variable: ["gdd_hourly_tetranychus_urticae"],
      start_date: defaultStart24h,
      query: 'sum',
    });
  } catch (e) {};
  if (gdd_hourly_tetranychus_urticae_sum && gdd_hourly_tetranychus_urticae_sum.length > 0) {
    data.gdd_hourly_tetranychus_urticae_sum = gdd_hourly_tetranychus_urticae_sum;
  }

  let ipsi_avg;
  try {
    ipsi_avg = await fieldDevice.getData({
      variable: ["ipsi"],
      start_date: defaultStart24h,
      query: 'avg',
    });
  } catch (e) {};
  if (ipsi_avg && ipsi_avg.length > 0) {
    data.ipsi_avg = ipsi_avg;
  }
  return { data };
}

function getUsersByAccesses(accesses) {
  let users = []
  for (let idx = 0; idx < accesses.length; idx++) {
    users = [...users, ... allUsers.filter(user =>
      user.tags?.some(tag => tag.key === "access" && tag.value === accesses[idx])
    )]
  }
  return users;
}

module.exports = new Analysis(async (context) => {
    contexttoken = context.token;
    var account_token;
    let fieldName;
    const my_account_token = context.environment.find(env_var => env_var.key === 'ACCOUNT_TOKEN');
    if (my_account_token) {
      account_token = my_account_token.value;
      // You can now use api_key in your script securely
    } else {
      return console.log('Account token not found!');
    }
    account = new Account({ token: account_token });

    // AccuWeather API key (used only when dailyTich is enabled and the field has accuweather_LocationKey)
    let weather_api_key;
    const my_weather_api_key = context.environment.find(env_var => env_var.key === 'ACCUWEATHER_API_KEY');
    if (my_weather_api_key) {
      weather_api_key = my_weather_api_key.value;
    } else {
      console.log('ACCUWEATHER_API_KEY not found in environment variables!');
      weather_api_key = null;
    }

    const analysisID = context.analysis_id;
    const info  = await account.analysis.info(analysisID);
    let tags  = info.tags || [];
    const lastHourTichTagsList = tags.filter(t => t.key === 'lastHourTich');
    const lastHDailytTichTagsList = tags.filter(t => t.key === 'lastHDailytTich');
    const hourTichCountTagsList = tags.filter(t => t.key === 'hourTichCount');
    const now = new Date();
    let hourTich = true;
    let dailyTich = false;

    const hourTichCount = (hourTichCountTagsList.length > 0) ? parseInt(hourTichCountTagsList[0].value, 10) : 0;
    if (lastHourTichTagsList.length > 0) {
      lastHourTich = Date.parse(lastHourTichTagsList[0].value);
      const hourlyTimeDiff = (now - lastHourTich) / (1000 * 60); // In minutes

      if (hourlyTimeDiff < 55) { // Default is true, as we want to be activated at first tich //
        hourTich = false;
      } else {
        lastHourTichTagsList[0].value = now.toString();
      }
      if (lastHDailytTichTagsList.length > 0) {
        lastDailyTich = Date.parse(lastHDailytTichTagsList[0].value);
        const dailyTimeDiff = (now - lastDailyTich) / (1000 * 60); // In minutes
        if (1435 < dailyTimeDiff) { // Each day has 1440 minutes //
          dailyTich = true;
          lastHDailytTichTagsList[0].value = now.toString();
        }
      } else if (hourTichCount > 23) {
        dailyTich = true;
        tags = [...tags, {key: 'lastHDailytTich', value: now.toString()}];
      }
    } else {
        tags = [...tags, {key: 'lastHourTich', value: now.toString()}];
    }
    if (hourTich) {
      if (hourTichCountTagsList.length > 0)
      {
        if (hourTichCount > 23) {
          hourTichCountTagsList[0].value = '1';
        } else {
          hourTichCountTagsList[0].value = (hourTichCount + 1).toString();
        }
      } else {
          tags = [...tags, {key: 'hourTichCount', value: '1'}];
      }
    }

    await account.analysis.edit(analysisID, { tags });

    allUsers = await getAllUsers();

    // Example of filtering devices by tag.
    // to use this filter, just remove the comment on the line 35
    const filter = {
      tags: [
        {
          key: "isField", // change by your key name
          value: "yes", // change by your key value
        },
      ],
      // You also can filter by: name, last_input, last_output, bucket, etc.
    };

    // Searching all devices with tag we want
    let currentFields = [];
    let fields = [];
    let pageNum = 1;
    do {
      currentFields = await Resources.devices.list({
        page: pageNum,
        fields: ["id", "tags"],
        filter
      });
      fields = [...fields, ...currentFields];
      pageNum += 1;
    } while (currentFields.length > 0);

    if (!fields.length) {
      return console.debug("fields not found");
    }
    const fieldsWithErrors = [];
    for (let i = 0; i < fields.length; i=i+1)
    {

      try {
        let devices;
        try {
          devices = JSON.parse(fields[i].tags.filter(item => item.key === 'devices')?.[0].value);
        } catch (e) {
          console.log('Could not get JSON from devices: ', fields[i], '. Error: ', e)
        }
        // console.log('measurements: ', measurements) // UNCOMMENT_WHEN_TROUBLESHOOTING


        try {
          fieldName = fields[i].tags.filter(item => item.key === 'name')?.[0].value;
        } catch (e) {
          console.log('Could not get JSON from fieldName: ', fields[i], '. Error: ', e)
        }

        let fieldConfig = getFieldParameters(fields[i]);
        if (fieldConfig === undefined) {
          // console.log(fields[i], ' : has no field config')
          continue;
        }
        const measurements = await getMeasurements(hourTich, dailyTich, devices, fields[i].id, fieldName);

        const manualIrrigation = getManualIrrigationParameters(fieldConfig);
        const fieldAccesses = await getFieldAccesses(fields[i]);
        const users = getUsersByAccesses(fieldAccesses);

        const dev_to_send_meas_token = await import_sdk.Utils.getTokenByName(account, fields[i].id);
        const dev_to_send_meas = new import_sdk.Device({ token: dev_to_send_meas_token });

        // Shared calculations (same for all crops in a field)
        const { vpdData: vpd, vpdError } = calculate_VPD(hourTich, measurements, fieldConfig);

        // Multi-crop support: run crop-dependent calculations per crop
        const crops = normalizeFieldCrops(fieldConfig);

        // Read last packed bundle once (needed for indicators that use past values like GDD/FIR counters)
        const prevBundle = await fetchLastFieldBundle(dev_to_send_meas);

        const perCropIndicators = {};

        for (const crop of crops) {
          const cropParams = {
            ...fieldConfig,
            cultivation_type_general: crop.cultivation_type_general,
            cultivation_type: crop.cultivation_type,
            stage: crop.stage,
          };


          // Clone measurements and inject previous packed indicators for this crop
          const measurementsForCrop = { ...measurements, data: { ...(measurements?.data || {}) } };
          measurementsForCrop.timezone = measurements?.timezone || "Europe/Athens";
          measurementsForCrop.now = now; // used by day-reset logic
          measurementsForCrop._prevBundleTime = prevBundle?.time;

          const prevCropIndicators = (prevBundle?.cropsById && crop?.id) ? (prevBundle.cropsById[crop.id] || {}) : {};
          injectPrevIndicators(measurementsForCrop, prevBundle?.shared, prevCropIndicators);

          // ── E3: Crop GDD accumulation + stage override ────────────────────
          const cropGDD = calculate_CropGDD(hourTich, measurementsForCrop, cropParams);
          // Inject accumulated GDD back into measurements for other functions
          for (const g of (cropGDD || [])) {
            measurementsForCrop.data[g.variable] = [{ value: g.value }];
          }
          // Override calendar stage with GDD-based stage when available
          const gddStage = resolveStageByGDD(cropParams, measurementsForCrop);
          if (gddStage) {
            cropParams.stage = gddStage;
            cropParams.stage_source = "GDD";
          } else {
            cropParams.stage_source = "calendar";
          }
          // ── End E3 integration ────────────────────────────────────────────

          let indicatorsForCrop = [...(cropGDD || [])];

          const { ipsi, ipsiError } = calculate_IPSI(hourTich, measurementsForCrop, vpd, cropParams, vpdError);


          // A6: Inject current IPSI into measurements so FIR can read ipsi_avg even with packed bundle architecture
          const currentIpsiVal = ipsi?.[0]?.value;
          if (Number.isFinite(Number(currentIpsiVal))) {
            measurementsForCrop.data.ipsi_avg = [{ value: Number(currentIpsiVal) }];
          }



          // B4: Maintain a running IPSI daily average for BPI (accumulates each hour tick; resets when dailyTich fires)
          const ipsiVal = Number(ipsi?.[0]?.value ?? 0);
          const prevIpsiAvg = getVal(measurementsForCrop, "ipsi_running_avg", null);
          const prevIpsiCount = getVal(measurementsForCrop, "ipsi_running_count", 0);

          if (Number.isFinite(ipsiVal)) {
            const baseCount = dailyTich ? 0 : Number(prevIpsiCount || 0);
            const baseAvg = dailyTich ? null : prevIpsiAvg;

            const newCount = baseCount + 1;
            const newAvg = (baseAvg !== null && Number.isFinite(Number(baseAvg)))
              ? (Number(baseAvg) * baseCount + ipsiVal) / newCount
              : ipsiVal;

            indicatorsForCrop.push(
              { variable: "ipsi_running_avg", value: Number(newAvg.toFixed(2)) },
              { variable: "ipsi_running_count", value: newCount }
            );

            // Inject for immediate use inside BPI on this tick
            measurementsForCrop.data.ipsi_daily_avg = [{ value: newAvg }];
          }
          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(ipsi ?? [])];

          // Soil moisture limits (upper/lower) as independent indicators
          const lim = computeSoilMoistureLimits(cropParams);
          const limIndicators = buildSoilMoistureLimitIndicators(lim);
          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(limIndicators ?? [])];

          const irrigationVolume = calculate_IrrigationVolume(hourTich, measurementsForCrop, ipsi, cropParams);
          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(irrigationVolume ?? [])];

          const { bpi, bpiIndicators, bpiContext, bpiError } = calculate_BPI(dailyTich, measurementsForCrop, ipsi, cropParams, ipsiError);
          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(bpi ?? []), ...(bpiIndicators ?? [])];

          const gdd = calculate_GDD(hourTich, dailyTich, measurementsForCrop, cropParams);
          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(gdd ?? [])];

          // A5: Hourly infection-hours counters (used by FIR Infection_Triangle)

          const infectionHours = calculate_InfectionHours(hourTich, measurementsForCrop, cropParams);

          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(infectionHours ?? [])];


          // Inject infection hours back to measurements for FIR consumption

          for (const ih of (infectionHours || [])) {
            measurementsForCrop.data[ih.variable] = [{ value: ih.value }];
          }


          const fir = calculate_FIR(dailyTich, measurementsForCrop, ipsi, cropParams);
          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(fir ?? [])];

          // Messages are packed inside the same crop bundle (as indicator-style variables).
          const fertilizationGrowthMessages = getFertilizationGrowthMessages(bpi, bpiError, bpiContext) ?? [];
          const pathogenMessages = getPathogenMessages(fir) ?? [];
          const irrigationAndPlantStressMessages = getIrrigationAndPlantStressMessages(ipsi, irrigationVolume, ipsiError) ?? [];

          indicatorsForCrop = [
            ...(indicatorsForCrop ?? []),
            ...fertilizationGrowthMessages,
            ...pathogenMessages,
            ...irrigationAndPlantStressMessages,
          ];

          perCropIndicators[crop.id] = indicatorsForCrop;
        }

        const packedIndicators = packCalculatedIndicators({
          sharedIndicators: vpd ?? [],
          perCropIndicators,
          prevBundle,
        });

        await dev_to_send_meas.sendData(packedIndicators);
// if (fieldConfig !== undefined) { // Fail Safe //
        //   fields[i].tags = fields[i].tags.filter(item => (item.key !== 'configuration'));
        //   fields[i].tags.push({
        //       key: 'configuration',
        //       value: String(fieldConfig)
        //   })
        //   await account.devices.edit(fields[i].id, {tags: fields[i].tags});
        // }
      } catch (e) {
        console.log(`Field [${fieldName}] raised error: `, e);
        fieldsWithErrors.push(fieldName);
      }
    }
  console.log('Parsed all fields')
  if (fieldsWithErrors.length > 0) {
    console.log(`Fields with errors (${fieldsWithErrors.length}): ${fieldsWithErrors.join(', ')}`);
    throw('Fields raised errors!');
  }
});

// ─── TEST MODE EXPORTS ────────────────────────────────────────────────────────
// Only activated when RPERTICH_TEST_MODE=true.
// The sdk-mock.js stub must be loaded BEFORE requiring this file so that the
// Analysis constructor above is a no-op (no TagoIO connection is made).
//
// Usage (from analysis/test/harness.js):
//   process.env.RPERTICH_TEST_MODE = 'true';
//   const fns = require('../runPerTich');
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.RPERTICH_TEST_MODE === 'true') {
  module.exports = {
    calculate_VPD,
    calculate_IPSI,
    calculate_BPI,
    calculate_GDD,
    calculate_InfectionHours,
    calculate_FIR,
    calculate_IrrigationVolume,
    packCalculatedIndicators,
    compressFieldBundle,
    decompressFieldBundle,
    CROP_PROFILE,
    PATHOGEN_PROFILE,
  };
}
