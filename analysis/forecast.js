/**
 * TagoIO Analysis: Open-Meteo 3-day hourly forecast
 *
 * Writes ONE variable per field device:
 *   variable: "forecast"
 *   value: 1
 *   metadata: full forecast payload (hourly arrays + units), with time stored as epoch seconds
 *
 * Field selection: devices with tag isField=yes
 * Coordinates: device tag "coordinates" = "lat,lon"
 *
 * v9 · 2026-09-18 (SAG, T-BPI-LIGHTEST-01): a SECOND, separate Open-Meteo call fetches the
 * DAILY shortwave radiation sum with past_days=1 and stores it as metadata.radiation
 * { dates, shortwave_radiation_sum (MJ/m²), sunshine_duration (s), units, fetched_at }.
 * The hourly 3-day payload (hourly_epoch, hourly.*) is UNCHANGED so the dashboard, the
 * spray window and the kernel's frost/heat warnings keep reading exactly what they read.
 * runPerTich (v50.136+) uses radiation of the previous local day to estimate light for
 * the BPI card on fields WITHOUT a light sensor (flagged as an estimate).
 */

const axios = require("axios");
const { Analysis, Resources, Utils, Account, Device } = require("@tago-io/sdk");

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const TZ = "Europe/Athens";
const FORECAST_DAYS = 3;

const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "precipitation_probability",
  "rain",
  "showers",
  "wind_speed_10m",
  "wind_gusts_10m",
  "weather_code",
  "cape",
];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseCoordinatesTag(tags, key = "coordinates") {
  const raw = tags?.find((t) => t.key === key)?.value;
  if (!raw || typeof raw !== "string") return null;

  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, raw };
}

async function fetchOpenMeteo(lat, lon) {
  const params = {
    latitude: lat,
    longitude: lon,
    hourly: HOURLY_FIELDS.join(","),
    forecast_days: FORECAST_DAYS,
    timezone: TZ,

    // optional (nice to have in hourly_units)
    temperature_unit: "celsius",
    wind_speed_unit: "ms",
    precipitation_unit: "mm",
  };

  const { data } = await axios.get(OPEN_METEO_URL, { params, timeout: 20000 });

  if (!data?.hourly?.time || !Array.isArray(data.hourly.time)) {
    throw new Error("Open-Meteo returned no hourly.time array");
  }

  return data;
}

/* v9: daily radiation of yesterday + today (past_days=1). Separate call, separate try/catch:
   if it fails the hourly forecast is still saved and metadata.radiation is null. */
async function fetchOpenMeteoRadiation(lat, lon) {
  const params = {
    latitude: lat,
    longitude: lon,
    daily: "shortwave_radiation_sum,sunshine_duration",
    past_days: 1,
    forecast_days: 1,
    timezone: TZ,
  };
  const { data } = await axios.get(OPEN_METEO_URL, { params, timeout: 20000 });
  if (!data?.daily?.time || !Array.isArray(data.daily.time)) {
    throw new Error("Open-Meteo returned no daily.time array");
  }
  return {
    dates: data.daily.time,                                   // ["YYYY-MM-DD" (yesterday), "YYYY-MM-DD" (today)]
    shortwave_radiation_sum: data.daily.shortwave_radiation_sum, // MJ/m² per day
    sunshine_duration: data.daily.sunshine_duration,          // seconds per day
    units: data.daily_units,
    fetched_at: new Date().toISOString(),
  };
}

async function listFieldDevices() {
  const filter = { tags: [{ key: "isField", value: "yes" }] };

  let page = 1;
  let all = [];
  while (true) {
    const res = await Resources.devices.list({
      page,
      fields: ["id", "tags"],
      filter,
    });
    if (!res || res.length === 0) break;
    all = all.concat(res);
    page += 1;
  }
  return all;
}

async function safeSendOneForecastPoint(fieldDevice, payload) {
  // One point only, but keep chunking helper in case you later add more data.
  const batches = chunk(payload, 1);
  for (const b of batches) {
    await fieldDevice.sendData(b);
  }
}

async function main(context) {
  const env = Utils.envToJson(context.environment);

  const accountToken = env.ACCOUNT_TOKEN;
  if (!accountToken) throw new Error("Missing ACCOUNT_TOKEN in environment");

  const account = new Account({ token: accountToken });

  const fields = await listFieldDevices();
  if (!fields.length) {
    context.log("No field devices found (tag isField=yes).");
    return;
  }

  context.log(`Found ${fields.length} field devices. Fetching + saving forecast...`);

  let errors = 0;

  for (const field of fields) {
    try {
      const coords = parseCoordinatesTag(field.tags, "coordinates");
      if (!coords) {
        throw new Error(
          `Missing/invalid tag coordinates. Expected "lat,lon", got: ${
            field.tags?.find((t) => t.key === "coordinates")?.value ?? "(none)"
          }`
        );
      }

      // Same “token by name” style you already use in runPerTich
      const fieldToken = await Utils.getTokenByName(account, field.id);
      const fieldDevice = new Device({ token: fieldToken });

      context.log(
        `Field ${field.id}: fetching forecast for coordinates="${coords.raw}" (lat=${coords.lat}, lon=${coords.lon})`
      );

      const resp = await fetchOpenMeteo(coords.lat, coords.lon);

      const pointsCount = resp.hourly?.time?.length ?? 0;
      context.log(`Field ${field.id}: received ${pointsCount} points`);

      // v9: daily radiation (yesterday + today) — best effort, never blocks the forecast
      let radiation = null;
      try {
        radiation = await fetchOpenMeteoRadiation(coords.lat, coords.lon);
        context.log(`Field ${field.id}: radiation ${JSON.stringify(radiation.dates)} = ${JSON.stringify(radiation.shortwave_radiation_sum)} MJ/m²`);
      } catch (radErr) {
        context.log(`Field ${field.id}: radiation error (forecast still saved): ${radErr?.message || radErr}`);
      }

      // Convert ISO times to epoch seconds to avoid Tago "time window" validation issues
      //
      // FIX 2026-09-06 (SAG): with timezone=Europe/Athens, Open-Meteo returns
      // LOCAL ISO strings WITHOUT a zone suffix, e.g. "2026-09-06T00:00".
      // `new Date(iso)` interprets a zone-less date-time as LOCAL time, and the
      // analysis server runs in UTC -- so every timestamp was stored shifted by
      // utc_offset_seconds (+3 h in summer, +2 h in winter). Midnight in Athens
      // was written as 00:00 UTC instead of the correct 21:00 UTC of the day
      // before. Consumers that trust hourly_epoch (the dashboard spray window)
      // were reading the forecast three hours out of place.
      //
      // Appending "Z" makes the parse explicitly UTC and independent of the
      // server's own timezone; subtracting utc_offset_seconds then converts
      // that local wall-clock reading into the true instant.
      const utcOffsetSeconds = Number(resp.utc_offset_seconds) || 0;
      const isoToEpochSeconds = (iso) => {
        const s = String(iso);
        // Defensive: if Open-Meteo ever returns an explicit zone, trust it.
        const hasZone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(s);
        const ms = Date.parse(hasZone ? s : s + "Z");
        if (!Number.isFinite(ms)) return null;
        return Math.floor(ms / 1000) - (hasZone ? 0 : utcOffsetSeconds);
      };
      const hourly_epoch = resp.hourly.time.map(isoToEpochSeconds);

      // Remove ISO timestamps from hourly object in metadata (store epochs instead)
      const hourly_no_time = { ...resp.hourly };
      delete hourly_no_time.time;

      const runISO = new Date().toISOString();
      const baseDate = resp?.hourly?.time?.[0]?.slice(0, 10) || runISO.slice(0, 10);

      const metadata = {
        provider: "open-meteo",
        forecast_base_date: baseDate,
        timezone: TZ,
        forecast_days: FORECAST_DAYS,
        run_at: runISO,

        coordinates: coords.raw,
        lat: coords.lat,
        lon: coords.lon,

        // helpful extras from Open-Meteo
        elevation: resp.elevation,
        utc_offset_seconds: resp.utc_offset_seconds,

        // units
        hourly_units: resp.hourly_units,

        // time axis (safe numeric)
        hourly_epoch,

        // actual hourly arrays (no time strings)
        hourly: hourly_no_time,

        // v9: daily shortwave radiation (yesterday, today) for the BPI light estimate
        radiation,
      };

      // IMPORTANT:
      // - We omit "time" on purpose so Tago uses ingestion time (avoids any window problems)
      // - Single variable only
      await safeSendOneForecastPoint(fieldDevice, [
        {
          variable: "forecast",
          value: 1,
          metadata,
        },
      ]);

      context.log(`Field ${field.id}: forecast saved ✅`);
    } catch (err) {
      errors += 1;
      context.log(`Field ${field.id}: forecast error: ${err?.message || err}`);
    }
  }

  if (errors) {
    throw new Error(`Forecast analysis finished with ${errors} field error(s).`);
  }

  context.log("Forecast analysis completed ✅");
}

module.exports = new Analysis(main);
