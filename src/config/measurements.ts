// src/config/measurements.ts

export type SidebarMeasurementConfig = {
  label: string;
  tab: number;
};

// what you already had in Dashboard.tsx
export const MEAS_TABLE_DEFAULT: Record<string, SidebarMeasurementConfig> = {
  temperature: { label: "Θερμοκρασία αέρα (°C)", tab: 2 },
  humidity: { label: "Σχετική υγρασία αέρα (%)", tab: 2 },
  air_temperature: { label: "Θερμοκρασία αέρα (°C)", tab: 2 },
  air_humidity: { label: "Σχετική υγρασία αέρα (%)", tab: 2 },
  soil_moisture1: { label: "Υγρασία εδάφους ρηχά (%)", tab: 2 },
  soil_temperature1: { label: "Θερμοκρασία εδάφους ρηχά (°C)", tab: 2 },
  conduct_soil1: { label: "Αγωγιμότητα εδάφους ρηχά (µS/cm)", tab: 2 }, // [CLEANFIX 2026-07-02] was mislabeled (°C)
  soil_moisture2: { label: "Υγρασία εδάφους βαθιά (%)", tab: 2 },
  soil_temperature2: { label: "Θερμοκρασία εδάφους βαθιά (°C)", tab: 2 },
  conduct_soil2: { label: "Αγωγιμότητα εδάφους βαθιά (µS/cm)", tab: 2 }, // [CLEANFIX 2026-07-02] was mislabeled (°C)
  valve_1: { label: "Προγραμματιστής ηλεκτροβανών", tab: 4 },
};

export const ENV_SOURCES_DEFAULT: Record<string, string[]> = {
  airT: ["temperature", "air_temperature"],
  airH: ["humidity", "air_humidity"],
  sm1: ["soil_moisture1", "soil_moisture_shallow", "soil_moisture"],
  st1: ["soil_temperature1", "soil_temp1", "soil_temperature"],
  sm2: ["soil_moisture2", "soil_moisture_deep"],
  st2: ["soil_temperature2", "soil_temp2"],
};
