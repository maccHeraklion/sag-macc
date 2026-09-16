/**
 * Generates a realistic 7-day synthetic field dataset and writes it to
 * runpertich-tester/mock-data/sample-field.json
 *
 * Run: node scripts/generate-mock-data.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../mock-data");
const OUT_FILE = join(OUT_DIR, "sample-field.json");

const DAYS = 7;
const START_DATE = new Date("2024-04-01T00:00:00Z");

// ── helpers ──────────────────────────────────────────────────────────────────

function isoAt(hourIndex) {
  return new Date(START_DATE.getTime() + hourIndex * 3_600_000).toISOString();
}

function sinusoid(hourOfDay, min, max, peakHour = 14) {
  const angle = ((hourOfDay - peakHour) / 24) * 2 * Math.PI;
  const norm = (1 - Math.cos(angle)) / 2;
  return min + (max - min) * norm;
}

function jitter(value, range) {
  return value + (Math.random() - 0.5) * 2 * range;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(v, decimals = 2) {
  return parseFloat(v.toFixed(decimals));
}

// ── rain events ───────────────────────────────────────────────────────────────

const RAIN_EVENTS = [
  { start: 2 * 24 + 3, durationHrs: 4, mmPerHr: 2.5 },   // day 3 03:00
  { start: 5 * 24 + 18, durationHrs: 2, mmPerHr: 1.0 },   // day 6 18:00
];

function rainAt(h) {
  for (const e of RAIN_EVENTS) {
    if (h >= e.start && h < e.start + e.durationHrs) return e.mmPerHr;
  }
  return 0;
}

// ── series generators ─────────────────────────────────────────────────────────

function series(fn, unit) {
  const points = [];
  for (let h = 0; h < DAYS * 24; h++) {
    const v = fn(h, h % 24, Math.floor(h / 24));
    points.push({ time: isoAt(h), value: round(v), ...(unit ? { unit } : {}) });
  }
  return points;
}

function soilMoisture(init) {
  const points = [];
  let sm = init;
  for (let h = 0; h < DAYS * 24; h++) {
    const rain = rainAt(h);
    const evap = sinusoid(h % 24, 0.02, 0.12, 14);
    sm = clamp(sm + rain * 1.2 - evap, 15, 75);
    points.push({ time: isoAt(h), value: round(sm, 1), unit: "%" });
  }
  return points;
}

function leafMoisture() {
  return series((h, dayH) => {
    const rain = rainAt(h);
    const nightWet = (dayH < 6 || dayH > 22) ? 80 : 0;
    const rainWet = rain > 0 ? 100 : rainAt(h - 1) > 0 ? 70 : 0;
    const dayDry = sinusoid(dayH, 0, 60, 14);
    return clamp(jitter(Math.max(nightWet, rainWet, 40) - dayDry * 0.5, 5), 0, 100);
  }, "%");
}

// ── device builders ───────────────────────────────────────────────────────────

function buildS2120() {
  return {
    id: "device-s2120-001",
    name: "Μετεωρολογικός Σταθμός (s2120)",
    type: "s2120",
    data: {
      air_temperature: series(
        (h, dayH) => jitter(sinusoid(dayH, 8, 28, 14) + Math.sin(h / (24 * 3.5)) * 3, 0.5),
        "°C"
      ),
      air_humidity: series(
        (h, dayH) => clamp(jitter(85 - sinusoid(dayH, 8, 28, 14) * 1.5 + rainAt(h) * 5, 3), 30, 98),
        "%"
      ),
      light_intensity: series(
        (_h, dayH) => {
          if (dayH < 5 || dayH > 20) return 0;
          return clamp(jitter(sinusoid(dayH, 0, 95000, 13), 2000), 0, 110000);
        },
        "lx"
      ),
      uv_index: series(
        (_h, dayH) => {
          if (dayH < 6 || dayH > 19) return 0;
          return clamp(jitter(sinusoid(dayH, 0, 7, 13), 0.3), 0, 11);
        }
      ),
      wind_speed_kmh: series(() => clamp(jitter(8, 5), 0, 40), "km/h"),
      rain_height: series((h) => round(rainAt(h), 2), "mm"),
      barometric_pressure_hpa: series(() => jitter(1013, 2), "hPa"),
      dew_point: series(
        (_h, dayH) => jitter(sinusoid(dayH, 2, 12, 6), 0.5),
        "°C"
      ),
    },
  };
}

function buildSoilSensor() {
  return {
    id: "device-soil-001",
    name: "Αισθητήρας Εδάφους (se0x)",
    type: "se0x",
    data: {
      soil_moisture1: soilMoisture(38),
      soil_temperature1: series(
        (_h, dayH) => jitter(sinusoid(dayH, 10, 22, 16), 0.3),
        "°C"
      ),
      conduct_soil1: series(() => jitter(0.8, 0.1), "mS/cm"),
      soil_moisture2: soilMoisture(45),
      soil_temperature2: series(
        (_h, dayH) => jitter(sinusoid(dayH, 12, 20, 17), 0.2),
        "°C"
      ),
      conduct_soil2: series(() => jitter(0.7, 0.1), "mS/cm"),
    },
  };
}

function buildLeafSensor() {
  return {
    id: "device-leaf-001",
    name: "Αισθητήρας Φύλλου (lms01_ls)",
    type: "lms01_ls",
    data: {
      leaf_temperature: series(
        (_h, dayH) => jitter(sinusoid(dayH, 7, 30, 14), 0.4),
        "°C"
      ),
      leaf_moisture: leafMoisture(),
    },
  };
}

// ── assemble & write ──────────────────────────────────────────────────────────

const dataset = {
  fieldId: "field-sample-001",
  fieldName: "Αγρός Δοκιμής — Ελαιώνας",
  cropType: "olive",
  startTime: START_DATE.toISOString(),
  endTime: new Date(START_DATE.getTime() + DAYS * 24 * 3_600_000).toISOString(),
  devices: [buildS2120(), buildSoilSensor(), buildLeafSensor()],
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(dataset, null, 2), "utf8");

const totalPoints = dataset.devices.reduce(
  (sum, d) => sum + Object.values(d.data).reduce((s, arr) => s + arr.length, 0),
  0
);

console.log(`✅ Written: ${OUT_FILE}`);
console.log(`   Devices : ${dataset.devices.length}`);
console.log(`   Period  : ${dataset.startTime} → ${dataset.endTime}`);
console.log(`   Points  : ${totalPoints.toLocaleString()} total data points`);
dataset.devices.forEach((d) => {
  const vars = Object.keys(d.data);
  console.log(`   ${d.type.padEnd(12)} ${d.name} — ${vars.join(", ")}`);
});
