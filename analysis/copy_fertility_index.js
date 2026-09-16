/**
 * TagoIO Analysis — Copy test_fertility_index → fertility_index
 *
 * For every device with tag  key="type" value="se0x"  this script reads all data
 * points of  test_fertility_index_1  and  test_fertility_index_2  written on or
 * after START_DATE and writes them to  fertility_index_1  / fertility_index_2
 * with the original timestamp, value, unit, and metadata preserved.
 *
 * Idempotent: existing points in the destination (same variable + same ms timestamp)
 * are skipped so the script can be re-run safely.
 *
 * REQUIRED ENV VARS
 *   ACCOUNT_TOKEN   — TagoIO account token
 *
 * OPTIONAL ENV VARS
 *   START_DATE      — ISO date string, default "2026-04-30T12:30:00.000Z"
 *                     (= 2026-04-30 15:30 Greece EEST, UTC+3)
 *   DRY_RUN         — set to "true" to log without writing
 */

/* eslint-disable no-console */
const { Analysis, Resources, Account, Device } = require("@tago-io/sdk");

// Channels to process — extend this array to add more depths.
const CHANNELS = ["1", "2"];

function getEnv(context, key, def) {
  const found = context.environment.find((e) => e.key === key);
  return found?.value || def;
}

// ---------- Device discovery ----------
async function listSe0xDevices() {
  const all = [];
  let page = 1;
  while (true) {
    const batch = await Resources.devices.list({
      page,
      amount: 100,
      fields: ["id", "name", "tags"],
      filter: { tags: [{ key: "type", value: "se0x" }] },
    });
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    page++;
  }
  return all;
}

// ---------- Token helper ----------
async function getDeviceToken(account, deviceId) {
  let tokens = [];
  try {
    tokens = await account.devices.tokenList(deviceId, {
      page: 1,
      fields: ["token", "expire_time", "permission"],
      amount: 20,
    });
  } catch (_) {}

  const now = Date.now();
  const valid = Array.isArray(tokens)
    ? tokens.find((t) => t?.token && (!t.expire_time || new Date(t.expire_time).getTime() > now))
    : null;
  if (valid?.token) return valid.token;

  const created = await account.devices.tokenCreate(deviceId, {
    name: "fertility-copy",
    permission: "full",
    expire_time: null,
  });
  return created.token;
}

// ---------- Fetch all source points since startDate (paginated) ----------
async function fetchAllSince(device, variable, startDate) {
  const all = [];
  let lastTime = null;

  while (true) {
    const params = {
      variable,
      start_date: lastTime || startDate,
      qty: 500,
      order: "asc",
    };
    const batch = await device.getData(params);
    if (!Array.isArray(batch) || !batch.length) break;

    // Avoid infinite loop: if we got the same last timestamp again, stop.
    const batchLastTime = batch[batch.length - 1].time;
    if (batchLastTime === lastTime) break;

    all.push(...batch);
    lastTime = batchLastTime;

    if (batch.length < 500) break;
  }
  return all;
}

// ---------- Fetch existing destination timestamps (for idempotency) ----------
async function fetchExistingTimestamps(device, variable, startDate) {
  const existing = new Set();
  const points = await fetchAllSince(device, variable, startDate);
  for (const p of points) {
    if (p.time) existing.add(new Date(p.time).getTime());
  }
  return existing;
}

// ---------- Process one device ----------
async function processDevice(account, deviceSummary, startDate, dryRun) {
  const { id, name } = deviceSummary;
  console.log(`\n--- Device: ${name || id} ---`);

  const token = await getDeviceToken(account, id);
  const device = new Device({ token });
  // Use Resources (analysis-level full-access) for writes to bypass the connector payload parser.

  for (const ch of CHANNELS) {
    const srcVar = `test_fertility_index${ch}`;
    const dstVar = `fertility_index${ch}`;

    const [srcPoints, existingTs] = await Promise.all([
      fetchAllSince(device, srcVar, startDate),
      fetchExistingTimestamps(device, dstVar, startDate),
    ]);

    if (!srcPoints.length) {
      console.log(`  [${srcVar}] No data found since ${startDate} — skipping.`);
      continue;
    }

    const toWrite = srcPoints.filter((p) => !existingTs.has(new Date(p.time).getTime()));

    console.log(
      `  [${srcVar}→${dstVar}] Found ${srcPoints.length} source point(s), ` +
        `${srcPoints.length - toWrite.length} already exist, ` +
        `${toWrite.length} to write.`
    );

    if (!toWrite.length || dryRun) {
      if (dryRun && toWrite.length) console.log(`  DRY RUN — skipping writes.`);
      continue;
    }

    // Write in batches of 50 via account API to bypass the connector payload parser.
    const BATCH = 50;
    for (let i = 0; i < toWrite.length; i += BATCH) {
      const slice = toWrite.slice(i, i + BATCH).map((p) => ({
        variable: dstVar,
        value: p.value,
        unit: p.unit,
        time: p.time,
        ...(p.metadata != null ? { metadata: p.metadata } : {}),
        ...(p.group != null ? { group: p.group } : {}),
      }));
      await Resources.devices.sendDeviceData(id, slice);
    }

    console.log(`  [${dstVar}] Wrote ${toWrite.length} point(s).`);
  }
}

// ---------- Analysis entry ----------
async function startAnalysis(context) {
  try {
    const accountToken = getEnv(context, "ACCOUNT_TOKEN", null);
    if (!accountToken) return console.log("ACCOUNT_TOKEN not found!");
    const account = new Account({ token: accountToken });

    // Default: 2026-04-30 15:30 Greece EEST (UTC+3) = 12:30 UTC
    const startDate = getEnv(context, "START_DATE", "2026-04-30T12:30:00.000Z");
    const dryRun = getEnv(context, "DRY_RUN", "false") === "true";

    console.log(`Start date  : ${startDate}`);
    console.log(`Dry run     : ${dryRun}`);
    console.log(`Channels    : ${CHANNELS.map((c) => `_${c}`).join(", ")}`);

    const devices = await listSe0xDevices();
    if (!devices.length) {
      console.log("No devices found with tag type=se0x.");
      return;
    }
    console.log(`Found ${devices.length} se0x device(s).`);

    for (const d of devices) {
      try {
        await processDevice(account, d, startDate, dryRun);
      } catch (err) {
        console.log(`Error on device ${d.name || d.id}: ${err?.message || err}`);
      }
    }

    console.log("\nDone.");
  } catch (err) {
    console.log(`Fatal: ${err?.message || err}`);
  }
}

Analysis.use(startAnalysis);
