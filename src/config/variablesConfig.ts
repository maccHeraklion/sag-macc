// src/config/variablesConfig.ts

/** Context for conversions that depend on installation params */
export type ConversionContext = {
  PPL1?: number; // pulses per liter for meter 1
  PPL2?: number; // pulses per liter for meter 2
};

export type ConversionFn = (value: number, ctx?: ConversionContext) => number;

export type BaseVariableConfig = {
  defaultUnit: string;
  conversions: Record<string, ConversionFn>;
  showAverage: boolean;
  showSum: boolean;
  showMax: boolean;
  showMin: boolean;
  categorical?: Record<string, string[]>; // for things like windDir 16-point compass
};

export type VariableConfig = BaseVariableConfig & {
  label: string;
};

export type VariableConfigMap = Record<string, VariableConfig>;

/* ---------- Helpers for direction / compass ---------- */

const normDeg = (d: number): number => ((Number(d) % 360) + 360) % 360;

const COMPASS16 = [
  "Β",
  "ΒΒΑ",
  "ΒΑ",
  "ΑΒΑ",
  "Α",
  "ΑΝΑ",
  "ΝΑ",
  "ΝΝΑ",
  "Ν",
  "ΝΝΔ",
  "ΝΔ",
  "ΔΝΔ",
  "Δ",
  "ΔΒΔ",
  "ΒΔ",
  "ΒΒΔ",
];

// Irrigation variables we care about
const IRR_VARS = [
  "valve_1",
  "valve_2",
  "valve_1_command",
  "valve_2_command",
  "valve_1_time_command",
  "valve_2_time_command",
  "valve_1_pulse",
  "valve_2_pulse",
  "batterypct",
];
const IRR_VARS_SET = new Set(IRR_VARS);

/* ---------- Base templates (like CONFIG_BASE in the HTML) ---------- */

export const CONFIG_BASE: Record<string, BaseVariableConfig> = {
  temperature: {
    defaultUnit: "°C",
    conversions: {
      "°C": (v) => v,
      "°F": (v) => v * 9 / 5 + 32,
      K: (v) => v + 273.15,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  percent: {
    defaultUnit: "%",
    conversions: {
      "%": (v) => v,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  voltage: {
    defaultUnit: "V",
    conversions: {
      V: (v) => v,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  pressure: {
    defaultUnit: "hPa",
    conversions: {
      hPa: (v) => v,
      kPa: (v) => v / 10,
      bar: (v) => v / 1000,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  conductivity: {
    defaultUnit: "mS/cm",
    conversions: {
      "µS/cm": (v) => v,
      "mS/cm": (v) => v / 1000,
      "dS/m": (v) => v / 1000,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  ph: {
    defaultUnit: "pH",
    conversions: {
      pH: (v) => v,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  windSpeed: {
    defaultUnit: "Bft",
    conversions: {
      Bft: (v) => {
        const ms = v / 3.6;
        if (ms < 0.3) return 0;
        if (ms < 1.6) return 1;
        if (ms < 3.4) return 2;
        if (ms < 5.5) return 3;
        if (ms < 8.0) return 4;
        if (ms < 10.8) return 5;
        if (ms < 13.9) return 6;
        if (ms < 17.2) return 7;
        if (ms < 20.8) return 8;
        if (ms < 24.5) return 9;
        if (ms < 28.5) return 10;
        if (ms < 32.7) return 11;
        return 12;
      },
      "m/s": (v) => v / 3.6,
      "km/h": (v) => v,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  light_intensity: {
    defaultUnit: "lux",
    conversions: {
      lux: (v) => v,
    },
    showAverage: false,
    showSum: false,
    showMax: false,
    showMin: false,
  },

  uv: {
    defaultUnit: "uv",
    conversions: {
      uv: (v) => v,
    },
    showAverage: false,
    showSum: false,
    showMax: false,
    showMin: false,
  },

  windDir: {
    defaultUnit: "16-σημεία",
    conversions: {
      "°": (v) => normDeg(v),
      "16-σημεία": (v) =>
        Math.floor(((normDeg(v) + 11.25) % 360) / 22.5),
    },
    categorical: {
      "16-σημεία": COMPASS16,
    },
    showAverage: false,
    showSum: false,
    showMax: false,
    showMin: false,
  },

  pulses1: {
    defaultUnit: "pulse",
    conversions: {
      pulse: (v) => v,
      L: (v, ctx) => v / (ctx?.PPL1 || 1000),
      "m³": (v, ctx) => v / (ctx?.PPL1 || 1000) / 1000,
    },
    showAverage: false,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  pulses2: {
    defaultUnit: "m³",
    conversions: {
      "L": (v) => v,
      "m³": (v) => v / 1000,
    },
    showAverage: false,
    showSum: false,
    showMax: true,
    showMin: true,
  },

  rain_height: {
    defaultUnit: "mm",
    conversions: {
      mm: (v) => v,
    },
    showAverage: false,
    showSum: true,
    showMax: true,
    showMin: true,
  },
};

/* ---------- Per-variable configuration (like VARIABLES_CONFIG) ---------- */

export const VARIABLES_CONFIG: VariableConfigMap = {
  valve_1_pulse: {
    label: "🚰 Μετρητής νερού 1",
    ...CONFIG_BASE.pulses2,
  },

  valve_2_pulse: {
    label: "🚰 Μετρητής νερού 2",
    ...CONFIG_BASE.pulses2,
  },

  battery: {
    label: "🔋 Τάση μπαταρίας",
    ...CONFIG_BASE.voltage,
  },

  batterypct: {
    label: "🔋 Φόρτιση μπαταρίας",
    ...CONFIG_BASE.percent,
  },

  temp_soil: {
    label: "🌱 Θερμοκρασία εδάφους",
    ...CONFIG_BASE.temperature,
  },

  soil_temperature: {
    label: "🌱 Θερμοκρασία εδάφους",
    ...CONFIG_BASE.temperature,
  },

  soil_temperature1: {
    label: "🌱 Θερμοκρασία εδάφους Ρηχό",
    ...CONFIG_BASE.temperature,
  },

  soil_temperature2: {
    label: "🌱 Θερμοκρασία εδάφους Βαθύ",
    ...CONFIG_BASE.temperature,
  },

  dew_point : {
    label: "🌡 Σημείο δρόσου",
    ...CONFIG_BASE.temperature,
  },

  temperature: {
    label: "🌡 Θερμοκρασία αέρα",
    ...CONFIG_BASE.temperature,
  },

  air_temperature: {
    label: "🌡 Θερμοκρασία αέρα",
    ...CONFIG_BASE.temperature,
  },

  air_humidity: {
    label: "💧 Υγρασία αέρα",
    ...CONFIG_BASE.percent,
  },

  humidity: {
    label: "💧 Υγρασία αέρα",
    ...CONFIG_BASE.percent,
  },

  leaf_temperature: {
    label: "🌡 Θερμοκρασία φύλλου",
    ...CONFIG_BASE.temperature,
  },

  leaf_moisture: {
    label: "💧 Υγρασία φύλλου",
    ...CONFIG_BASE.percent,
  },

  light_intensity: {
    label: "☀️ Φωτεινότητα",
    ...CONFIG_BASE.light_intensity,
  },

  lux: {
    label: "☀️ Φωτεινότητα",
    ...CONFIG_BASE.light_intensity,
  },

  uv_index: {
    label: "☀️ Δείκτης UV",
    ...CONFIG_BASE.uv,
  },

  soil_moisture: {
    label: "🌱 Υγρασία εδάφους",
    ...CONFIG_BASE.percent,
  },

  soil_moisture1: {
    label: "🌱 Υγρασία εδάφους Ρηχό",
    ...CONFIG_BASE.percent,
  },

  soil_moisture2: {
    label: "🌱 Υγρασία εδάφους Βαθύ",
    ...CONFIG_BASE.percent,
  },

  pressure: {
    label: "🌬 Πίεση",
    ...CONFIG_BASE.pressure,
  },

  barometric_pressure_hpa: {
    label: "🌬 Πίεση",
    ...CONFIG_BASE.pressure,
  },

  conduct_soil: {
    label: "🌾 Αγωγιμότητα εδάφους",
    ...CONFIG_BASE.conductivity,
  },

  soil_ph: {
    label: "🧪 pH εδάφους",
    ...CONFIG_BASE.ph,
  },

  // Accept alternative pH variable names some decoders emit
  ph: {
    label: "🧪 pH εδάφους",
    ...CONFIG_BASE.ph,
  },

  conduct_soil1: {
    label: "🌾 Αγωγιμότητα εδάφους Ρηχό",
    ...CONFIG_BASE.conductivity,
  },

  conduct_soil2: {
    label: "🌾 Αγωγιμότητα εδάφους Βαθύ",
    ...CONFIG_BASE.conductivity,
  },

  conduct_soil3: {
    label: "🌾 Αγωγιμότητα εδάφους 3",
    ...CONFIG_BASE.conductivity,
  },

  conduct_soil4: {
    label: "🌾 Αγωγιμότητα εδάφους 4",
    ...CONFIG_BASE.conductivity,
  },

  fertility_index1: {
    label: "🌿 Γονιμότητα εδάφους Ρηχό",
    ...CONFIG_BASE.conductivity,
  },

  fertility_index2: {
    label: "🌿 Γονιμότητα εδάφους Βαθύ",
    ...CONFIG_BASE.conductivity,
  },

  fertility_index3: {
    label: "🌿 Γονιμότητα εδάφους 3",
    ...CONFIG_BASE.conductivity,
  },

  fertility_index4: {
    label: "🌿 Γονιμότητα εδάφους 4",
    ...CONFIG_BASE.conductivity,
  },

  wind_direction: {
    label: "🧭 Κατεύθυνση ανέμου",
    ...CONFIG_BASE.windDir,
  },

  wind_dir: {
    label: "🧭 Κατεύθυνση ανέμου",
    ...CONFIG_BASE.windDir,
  },

  windDirection: {
    label: "🧭 Κατεύθυνση ανέμου",
    ...CONFIG_BASE.windDir,
  },

  wind_direction_sensor: {
    label: "🧭 Κατεύθυνση ανέμου",
    ...CONFIG_BASE.windDir,
  },

  rain_height: {
    label: "🌧 Ύψος βροχής (5λεπτο)",
    ...CONFIG_BASE.rain_height,
  },

  rain_height_hourly: {
    label: "🌧 Ύψος βροχής (Ωριαίο)",
    ...CONFIG_BASE.rain_height,
  },

  rain_height_daily: {
    label: "🌧 Ύψος βροχής (Ημερήσιο)",
    ...CONFIG_BASE.rain_height,
  },

  rain_height_weekly: {
    label: "🌧 Ύψος βροχής (Εβδομαδιαίο)",
    ...CONFIG_BASE.rain_height,
  },

  rain_height_monthly: {
    label: "🌧 Ύψος βροχής (Μηνιαίο)",
    ...CONFIG_BASE.rain_height,
  },

  rain_height_yearly: {
    label: "🌧 Ύψος βροχής (Ετήσιο)",
    ...CONFIG_BASE.rain_height,
  },

  current_rain_height_daily: {
    label: "🌧 Ύψος βροχής (Σήμερα)",
    ...CONFIG_BASE.rain_height,
  },

  current_rain_height_weekly: {
    label: "🌧 Ύψος βροχής (Αυτή την εβδομάδα)",
    ...CONFIG_BASE.rain_height,
  },

  current_rain_height_monthly: {
    label: "🌧 Ύψος βροχής (Αυτό τον μήνα)",
    ...CONFIG_BASE.rain_height,
  },

  current_rain_height_yearly: {
    label: "🌧 Ύψος βροχής (Φέτος)",
    ...CONFIG_BASE.rain_height,
  },

  wind_speed_kmh: {
    label: "🌬 Ταχύτητα ανέμου",
    ...CONFIG_BASE.windSpeed,
  },

  wind_chill: {
    label: "🥶 Δείκτης Ψυχρότητας",
    ...CONFIG_BASE.temperature,
  },
};

/* ---------- Helpers ---------- */

/**
 * Returns a config for a given variable.
 * If the variable is unknown, returns a generic numeric config with the
 * variable name as label and no unit.
 */
export function getVarConfig(variable: string): VariableConfig {
  const base = VARIABLES_CONFIG[variable];
  if (base) return base;

  // Fallback generic config
  return {
    label: variable,
    defaultUnit: "",
    conversions: {
      "": (x) => x,
    },
    showAverage: true,
    showSum: false,
    showMax: true,
    showMin: true,
  };
}

/**
 * Returns available units and an initial unit for a variable.
 */
export function getUnitOptionsFor(
  variable: string,
  selectedUnit?: string | null,
) {
  const conf = getVarConfig(variable);
  const keys = Object.keys(conf.conversions || {});
  const defaultUnit = conf.defaultUnit || keys[0] || "";
  let initial = defaultUnit;

  if (selectedUnit && keys.includes(selectedUnit)) {
    initial = selectedUnit;
  }

  return {
    options: keys,
    initial,
  };
}

function isOn(val: any) {
  return String(val).toLowerCase() === "on";
}

