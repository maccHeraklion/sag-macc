/**
 * Generates a realistic 7-day synthetic field dataset for an olive grove
 * in a Mediterranean climate (spring conditions).
 *
 * Values are plausible but not scientifically calibrated — they are meant
 * to exercise all calculation paths in runPerTich.js.
 */

import type { DataPoint, DeviceDataset, FieldDataset } from "./schema";

const DAYS = 7;
const START_DATE = new Date("2024-04-01T00:00:00Z");

// ── Low-level helpers ─────────────────────────────────────────────────────────

function isoAt(hourIndex: number): string {
  return new Date(START_DATE.getTime() + hourIndex * 3600_000).toISOString();
}

/** Smooth sinusoidal oscillation between min and max, peaking at peakHour (0-23). */
function sinusoid(
  hourOfDay: number,
  min: number,
  max: number,
  peakHour = 14
): number {
  const angle = ((hourOfDay - peakHour) / 24) * 2 * Math.PI;
  const norm = (1 - Math.cos(angle)) / 2; // 0..1, 1 at peakHour
  return min + (max - min) * norm;
}

/** Random ± noise. */
function jitter(value: number, range: number): number {
  return value + (Math.random() - 0.5) * 2 * range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Per-variable generators ───────────────────────────────────────────────────

function generateSeries(
  fn: (h: number, dayH: number, day: number) => number,
  unit?: string
): DataPoint[] {
  const points: DataPoint[] = [];
  const totalHours = DAYS * 24;
  for (let h = 0; h < totalHours; h++) {
    const dayH = h % 24;
    const day = Math.floor(h / 24);
    points.push({ time: isoAt(h), value: parseFloat(fn(h, dayH, day).toFixed(2)), unit });
  }
  return points;
}

// Rain events: two short events over the week
const RAIN_EVENTS: Array<{ start: number; durationHrs: number; mmPerHr: number }> = [
  { start: 2 * 24 + 3, durationHrs: 4, mmPerHr: 2.5 },  // day 3, 03:00
  { start: 5 * 24 + 18, durationHrs: 2, mmPerHr: 1.0 }, // day 6, 18:00
];

function rainAt(h: number): number {
  for (const e of RAIN_EVENTS) {
    if (h >= e.start && h < e.start + e.durationHrs) return e.mmPerHr;
  }
  return 0;
}

// Soil moisture: drains slowly, refills on rain events
function buildSoilMoisture(baseInit: number): DataPoint[] {
  const points: DataPoint[] = [];
  let sm = baseInit;
  const totalHours = DAYS * 24;
  for (let h = 0; h < totalHours; h++) {
    const rain = rainAt(h);
    const evap = sinusoid(h % 24, 0.02, 0.12, 14); // evapotranspiration peaks midday
    sm = clamp(sm + rain * 1.2 - evap, 15, 75);
    points.push({ time: isoAt(h), value: parseFloat(sm.toFixed(1)), unit: "%" });
  }
  return points;
}

// Leaf moisture: wet at night, wet after rain, dry midday
function buildLeafMoisture(): DataPoint[] {
  return generateSeries((h, dayH) => {
    const rain = rainAt(h);
    const nightWet = dayH < 6 || dayH > 22 ? 80 : 0;
    const rainWet = rain > 0 ? 100 : rainAt(h - 1) > 0 ? 70 : 0;
    const dayDry = sinusoid(dayH, 0, 60, 14);
    return clamp(jitter(Math.max(nightWet, rainWet, 40) - dayDry * 0.5, 5), 0, 100);
  }, "%");
}

// ── Device builders ───────────────────────────────────────────────────────────

function buildS2120(): DeviceDataset {
  return {
    id: "device-s2120-001",
    name: "Μετεωρολογικός Σταθμός (s2120)",
    type: "s2120",
    data: {
      air_temperature: generateSeries(
        (h, dayH) => jitter(sinusoid(dayH, 8, 28, 14) + Math.sin(h / (24 * 3.5)) * 3, 0.5),
        "°C"
      ),
      air_humidity: generateSeries(
        (h, dayH) => {
          const baseT = sinusoid(dayH, 8, 28, 14);
          // RH inversely correlated with temp
          return clamp(jitter(85 - baseT * 1.5 + rainAt(h) * 5, 3), 30, 98);
        },
        "%"
      ),
      light_intensity: generateSeries(
        (_h, dayH) => {
          if (dayH < 5 || dayH > 20) return 0;
          return clamp(jitter(sinusoid(dayH, 0, 95000, 13), 2000), 0, 110000);
        },
        "lx"
      ),
      uv_index: generateSeries(
        (_h, dayH) => {
          if (dayH < 6 || dayH > 19) return 0;
          return clamp(jitter(sinusoid(dayH, 0, 7, 13), 0.3), 0, 11);
        }
      ),
      wind_speed_kmh: generateSeries(
        () => clamp(jitter(8, 5), 0, 40),
        "km/h"
      ),
      rain_height: generateSeries(
        (h) => parseFloat(rainAt(h).toFixed(2)),
        "mm"
      ),
      barometric_pressure_hpa: generateSeries(
        () => jitter(1013, 2),
        "hPa"
      ),
      dew_point: generateSeries(
        (_h, dayH) => jitter(sinusoid(dayH, 2, 12, 6), 0.5),
        "°C"
      ),
    },
  };
}

function buildSoilSensor(): DeviceDataset {
  return {
    id: "device-soil-001",
    name: "Αισθητήρας Εδάφους (se0x)",
    type: "se0x",
    data: {
      soil_moisture1: buildSoilMoisture(38),
      soil_temperature1: generateSeries(
        (_h, dayH) => jitter(sinusoid(dayH, 10, 22, 16), 0.3),
        "°C"
      ),
      conduct_soil1: generateSeries(
        () => jitter(0.8, 0.1),
        "mS/cm"
      ),
      soil_moisture2: buildSoilMoisture(45),
      soil_temperature2: generateSeries(
        (_h, dayH) => jitter(sinusoid(dayH, 12, 20, 17), 0.2),
        "°C"
      ),
      conduct_soil2: generateSeries(
        () => jitter(0.7, 0.1),
        "mS/cm"
      ),
    },
  };
}

function buildLeafSensor(): DeviceDataset {
  return {
    id: "device-leaf-001",
    name: "Αισθητήρας Φύλλου (lms01_ls)",
    type: "lms01_ls",
    data: {
      leaf_temperature: generateSeries(
        (_h, dayH) => jitter(sinusoid(dayH, 7, 30, 14), 0.4),
        "°C"
      ),
      leaf_moisture: buildLeafMoisture(),
    },
  };
}

// ── Public export ─────────────────────────────────────────────────────────────

export function generateSampleDataset(): FieldDataset {
  return {
    fieldId: "field-sample-001",
    fieldName: "Αγρός Δοκιμής — Ελαιώνας",
    cropType: "olive",
    startTime: START_DATE.toISOString(),
    endTime: new Date(START_DATE.getTime() + DAYS * 24 * 3600_000).toISOString(),
    devices: [buildS2120(), buildSoilSensor(), buildLeafSensor()],
  };
}
