/**
 * TagoIO Analysis — Rain Height Aggregation (server-side sums + retention-smart yearly + smart PTD writes)
 *
 * INPUT
 *   - Primary source variable : `rain_height_acc` (accumulated rain from last sensor reset, mm)
 *                               Rain in a period = diff between last value at end and last value before start.
 *                               Falls back to `rain_height` (5-minute interval reading) when acc data is
 *                               missing or a sensor reset is detected (negative diff).
 *   - Fallback source variable: `rain_height` (5-minute rain height, mm) — summed directly
 *   - Devices selected by tag : key=`type`, value=`s2120`
 *
 * OUTPUT (closed periods)
 *   - Hourly  sum → `rain_height_hourly`  (mm), timestamp ~ END of hour    (UTC) + SHIFT_SECONDS
 *   - Daily   sum → `rain_height_daily`   (mm), timestamp ~ END of day     (UTC) + SHIFT_SECONDS
 *   - Weekly  sum → `rain_height_weekly`  (mm), timestamp ~ END of ISO week (UTC, Mon–Sun) + SHIFT_SECONDS
 *   - Monthly sum → `rain_height_monthly` (mm), timestamp ~ END of month   (UTC) + SHIFT_SECONDS
 *
 * OUTPUT (current / period-to-date; computed every run, written only if changed)
 *   - current_rain_height_daily
 *   - current_rain_height_weekly
 *   - current_rain_height_monthly
 *   - current_rain_height_yearly   (retention-smart)
 *
 * RETENTION-SMART YEARLY
 *   - Monthly aggregate stores metadata:
 *       ytd_before_mm, ytd_end_mm
 *   - current yearly = carry (latest monthly ytd_end_mm) + current month partial raw
 *
 * REQUIRED ENV VARS
 *   - ACCOUNT_TOKEN
 *
 * OPTIONAL ENV VARS
 *   - HOURS_BACK            : closed hours to recompute (default: 24)
 *   - DAYS_BACK             : closed days to recompute (default: 15)
 *   - WEEKS_BACK            : closed weeks to recompute (default: 20)
 *   - MONTHS_BACK           : closed months to recompute (default: 6)
 *
 *   - SOURCE_VARIABLE       : primary source, default 'rain_height_acc'
 *   - FALLBACK_VARIABLE     : fallback source when acc diff is invalid, default 'rain_height'
 *
 *   - SHIFT_SECONDS         : default 10  (applied to closed-period timestamps)
 *   - CURRENT_SHIFT_SECONDS : default 10  (applied to current/PTD timestamps)
 *
 *   - TARGET_HOURLY_VAR     : default 'rain_height_hourly'
 *   - TARGET_DAILY_VAR      : default 'rain_height_daily'
 *   - TARGET_WEEKLY_VAR     : default 'rain_height_weekly'
 *   - TARGET_MONTHLY_VAR    : default 'rain_height_monthly'
 *
 *   - CURRENT_DAILY_VAR     : default 'current_rain_height_daily'
 *   - CURRENT_WEEKLY_VAR    : default 'current_rain_height_weekly'
 *   - CURRENT_MONTHLY_VAR   : default 'current_rain_height_monthly'
 *   - CURRENT_YEARLY_VAR    : default 'current_rain_height_yearly'
 *
 *   - PTD_EPSILON           : default 0.000001 (float compare tolerance)
 */

const { Analysis, Resources, Account, Device } = require("@tago-io/sdk");
const moment = require("moment-timezone");

// ---------- Helpers ----------
function toNumber(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function getOptionalEnv(context, key, def) {
  const found = context.environment.find((e) => e.key === key);
  if (!found || found.value === undefined || found.value === null || found.value === "") return def;
  return found.value;
}

function asUTCRange(anyMoment, unit) {
  const end = anyMoment.clone().endOf(unit);
  const start = anyMoment.clone().startOf(unit);
  return { start, end };
}

function asUTCISOWeekRange(anyMoment) {
  const end = anyMoment.clone().endOf("isoWeek");
  const start = anyMoment.clone().startOf("isoWeek");
  return { start, end };
}

function withShift(endMoment, baseShiftSeconds, uniqueSeconds = 0) {
  return endMoment.clone().add(baseShiftSeconds + uniqueSeconds, "seconds");
}

function nearlyEqual(a, b, eps) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= eps;
}

// ---------- Token handling with device ID ----------
async function getOrCreateDeviceTokenById(account, device_id) {
  let tokens = [];
  try {
    tokens = await account.devices.tokenList(device_id, {
      page: 1,
      fields: ["token", "expire_time", "permission", "name"],
      amount: 20,
    });
  } catch (_) {}

  const now = Date.now();
  const valid = Array.isArray(tokens)
    ? tokens.find((t) => t?.token && (!t.expire_time || new Date(t.expire_time).getTime() > now))
    : null;

  if (valid?.token) return valid.token;

  const created = await account.devices.tokenCreate(device_id, {
    name: "rain-agg",
    permission: "full",
    expire_time: null,
  });
  return created.token;
}

// ---------- Device discovery ----------
async function listDevicesToProcess() {
  const filter = { tags: [{ key: "type", value: "s2120" }] };
  const devices = await Resources.devices.list({
    page: 1,
    fields: ["id", "name", "tags"],
    filter,
    amount: 200,
  });
  return devices || [];
}

// ---------- Data helpers ----------
async function alreadyHasAggregate(device, targetVariable, targetTimeMoment) {
  const windowStart = targetTimeMoment.clone().subtract(2, "minutes").toISOString();
  const windowEnd = targetTimeMoment.clone().add(2, "minutes").toISOString();
  const existing = await device.getData({
    variable: targetVariable,
    start_date: windowStart,
    end_date: windowEnd,
    qty: 5,
    order: "desc",
  });
  return Array.isArray(existing) && existing.length > 0;
}

/**
 * Server-side SUM for [start, end]
 * Returns number (0 if no data)
 */
async function sumFromBaseInRange(device, variable, startISO, endISO) {
  const start = moment.utc(startISO);
  const end = moment.utc(endISO);

  // If invalid or empty range
  if (!start.isValid() || !end.isValid() || !end.isAfter(start)) return 0;

  // If within 1 month -> direct sum query
  const oneMonthLater = start.clone().add(1, "month");
  if (end.isSameOrBefore(oneMonthLater)) {
    const res = await device.getData({
      variable,
      query: "sum",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    });
    const item = Array.isArray(res) && res.length ? res[0] : null;
    const num = Number(item?.value);
    return Number.isFinite(num) ? num : 0;
  }

  // Otherwise chunk by month boundaries and sum chunk sums
  let total = 0;
  let cursor = start.clone();

  while (cursor.isBefore(end)) {
    const chunkStart = cursor.clone();
    const chunkEnd = moment.min(chunkStart.clone().add(1, "month"), end);

    const res = await device.getData({
      variable,
      query: "sum",
      start_date: chunkStart.toISOString(),
      end_date: chunkEnd.toISOString(),
    });

    const item = Array.isArray(res) && res.length ? res[0] : null;
    const num = Number(item?.value);
    if (Number.isFinite(num)) total += num;

    cursor = chunkEnd;
  }

  return total;
}

/**
 * Fetch the last data point for `variable` with timestamp <= isoTime.
 * Returns the raw item, or null if none found.
 */
async function getPointAtOrBefore(device, variable, isoTime) {
  const res = await device.getData({
    variable,
    end_date: isoTime,
    qty: 1,
    order: "desc",
  });
  return Array.isArray(res) && res.length ? res[0] : null;
}

/**
 * Compute rain in [startISO, endISO] from an accumulated variable.
 * Returns { value: number, valid: true } on success, or { valid: false, reason: string } when:
 *   - no data point found at/before endISO (no acc data in range)
 *   - no data point found at/before startISO (partial period — sensor started mid-period)
 *   - diff < 0 (sensor reset detected)
 */
async function diffFromAccInRange(device, variable, startISO, endISO) {
  const [endPoint, startPoint] = await Promise.all([
    getPointAtOrBefore(device, variable, endISO),
    getPointAtOrBefore(device, variable, startISO),
  ]);

  if (!endPoint) {
    return { valid: false, reason: "no acc data at/before period end" };
  }
  if (!startPoint) {
    return { valid: false, reason: "no acc data at/before period start (sensor may have started mid-period)" };
  }

  const endVal = Number(endPoint.value);
  const startVal = Number(startPoint.value);

  if (!Number.isFinite(endVal) || !Number.isFinite(startVal)) {
    return { valid: false, reason: "non-numeric acc value" };
  }

  const diff = endVal - startVal;
  if (diff < 0) {
    return { valid: false, reason: `negative diff (${diff.toFixed(3)} mm) — sensor reset detected` };
  }

  return { valid: true, value: diff };
}

/**
 * Get rain mm for [startISO, endISO]:
 *   1. Try acc diff on `accVar` — use if valid.
 *   2. If invalid (missing data or reset), fall back to sum on `fallbackVar`.
 * Returns a number (0 if both sources yield nothing).
 */
async function getRainInRange(device, accVar, fallbackVar, startISO, endISO) {
  if (accVar) {
    const result = await diffFromAccInRange(device, accVar, startISO, endISO);
    if (result.valid) return { value: result.value, source: accVar };
    console.log(
      `[RainAcc] Diff invalid for ${accVar} [${startISO} – ${endISO}]: ${result.reason}. Falling back to ${fallbackVar}.`
    );
  }
  if (fallbackVar) {
    const value = await sumFromBaseInRange(device, fallbackVar, startISO, endISO);
    return { value, source: fallbackVar };
  }
  return { value: 0, source: "none" };
}

async function storeAggregate(device, variable, value, writeTime, periodStart, periodEnd, sourceVariable, extraMeta = {}, group = undefined) {
  const payload = {
    variable,
    unit: "mm",
    value,
    time: writeTime.toISOString(),
    metadata: {
      aggregation: "sum",
      period_start_utc: periodStart.toISOString(),
      period_end_utc: periodEnd.toISOString(),
      source_variable: sourceVariable,
      ...extraMeta,
    },
  };
  if (group) payload.group = group;
  await device.sendData(payload);
}

async function getLastPoint(device, variable) {
  const res = await device.getData({
    variable,
    qty: 1,
    order: "desc",
  });
  return Array.isArray(res) && res.length ? res[0] : null;
}

/**
 * Fetch all stored points of `variable` with write-timestamps in [startISO, endISO],
 * adding a 2-minute buffer on the end to account for SHIFT_SECONDS on closed-period write times.
 * Returns { sum: number, count: number }.
 */
async function sumAggregateInRange(device, variable, startISO, endISO) {
  const bufferedEnd = moment.utc(endISO).add(2, "minutes").toISOString();
  const res = await device.getData({
    variable,
    start_date: startISO,
    end_date: bufferedEnd,
    qty: 200,
    order: "asc",
  });
  if (!Array.isArray(res) || !res.length) return { sum: 0, count: 0 };
  let total = 0;
  for (const item of res) {
    const v = Number(item.value);
    if (Number.isFinite(v)) total += v;
  }
  return { sum: total, count: res.length };
}

/**
 * Compute current day-to-date rain from:
 *   - sum of closed rain_height_hourly for today (dayStart → last closed hour end)
 *   - plus the still-open partial (last closed hour end → nowUTC) from raw data
 *
 * Fallback: if no hourly aggregates are found for today, the partial expands back to dayStart
 * so raw data covers the full day (same as the old behaviour).
 */
async function getCurrentDayFromHourly(device, nowUTC, targetHourlyVar, accVar, fallbackVar) {
  const dayStart = nowUTC.clone().startOf("day");
  const lastClosedHourEnd = nowUTC.clone().subtract(1, "hour").endOf("hour");

  let closedSum = 0;
  let partialStart = dayStart.clone(); // default: raw covers full day if no aggregates found

  if (lastClosedHourEnd.isAfter(dayStart)) {
    const { sum, count } = await sumAggregateInRange(
      device,
      targetHourlyVar,
      dayStart.toISOString(),
      lastClosedHourEnd.toISOString()
    );
    if (count > 0) {
      closedSum = sum;
      partialStart = lastClosedHourEnd.clone();
    }
    // count = 0: no hourly aggregates yet — partialStart stays at dayStart (raw fallback for full day)
  }

  const { value: partialVal, source } = await getRainInRange(
    device,
    accVar,
    fallbackVar,
    partialStart.toISOString(),
    nowUTC.toISOString()
  );

  const total = closedSum + partialVal;
  console.log(
    `[PTD-Daily] closedHourlySum=${closedSum}, partial(${partialStart.toISOString()}→now)=${partialVal}, total=${total}`
  );
  return { value: total, source };
}

/**
 * Compute current ISO-week-to-date rain from:
 *   - sum of closed rain_height_daily for the current ISO week (weekStart → yesterday end)
 *   - plus today's current daily value (already computed via getCurrentDayFromHourly)
 *
 * Fallback: if no daily aggregates are found for the closed days, uses raw from weekStart → dayStart.
 */
async function getCurrentWeekFromDaily(device, nowUTC, targetDailyVar, currentDailyValue, accVar, fallbackVar) {
  const weekStart = nowUTC.clone().startOf("isoWeek");
  const dayStart = nowUTC.clone().startOf("day");
  const lastClosedDayEnd = nowUTC.clone().subtract(1, "day").endOf("day");

  let closedSum = 0;

  if (lastClosedDayEnd.isAfter(weekStart)) {
    const { sum, count } = await sumAggregateInRange(
      device,
      targetDailyVar,
      weekStart.toISOString(),
      lastClosedDayEnd.toISOString()
    );
    if (count > 0) {
      closedSum = sum;
    } else if (dayStart.isAfter(weekStart)) {
      // Fallback: no closed daily aggregates — raw for the closed-days span of this week
      const { value: rawVal } = await getRainInRange(
        device,
        accVar,
        fallbackVar,
        weekStart.toISOString(),
        dayStart.toISOString()
      );
      closedSum = rawVal;
    }
  }

  const total = closedSum + currentDailyValue;
  console.log(`[PTD-Weekly] closedDailySum=${closedSum}, currentDay=${currentDailyValue}, total=${total}`);
  return { value: total };
}

/**
 * Compute current month-to-date rain from:
 *   - sum of closed rain_height_daily for the current month (monthStart → yesterday end)
 *   - plus today's current daily value (already computed via getCurrentDayFromHourly)
 *
 * Fallback: if no daily aggregates are found for the closed days, uses raw from monthStart → dayStart.
 */
async function getCurrentMonthFromDaily(device, nowUTC, targetDailyVar, currentDailyValue, accVar, fallbackVar) {
  const monthStart = nowUTC.clone().startOf("month");
  const dayStart = nowUTC.clone().startOf("day");
  const lastClosedDayEnd = nowUTC.clone().subtract(1, "day").endOf("day");

  let closedSum = 0;

  if (lastClosedDayEnd.isAfter(monthStart)) {
    const { sum, count } = await sumAggregateInRange(
      device,
      targetDailyVar,
      monthStart.toISOString(),
      lastClosedDayEnd.toISOString()
    );
    if (count > 0) {
      closedSum = sum;
    } else if (dayStart.isAfter(monthStart)) {
      // Fallback: no closed daily aggregates — raw for the closed-days span of this month
      const { value: rawVal } = await getRainInRange(
        device,
        accVar,
        fallbackVar,
        monthStart.toISOString(),
        dayStart.toISOString()
      );
      closedSum = rawVal;
    }
  }

  const total = closedSum + currentDailyValue;
  console.log(`[PTD-Monthly] closedDailySum=${closedSum}, currentDay=${currentDailyValue}, total=${total}`);
  return { value: total };
}

/**
 * Compute current year-to-date rain from:
 *   - sum of closed rain_height_monthly for the current year (yearStart → last closed month end)
 *   - plus current month-to-date value (already computed via getCurrentMonthFromDaily)
 *
 * Fallback: if no monthly aggregates are found, uses raw from yearStart → monthStart.
 */
async function getCurrentYearFromMonthly(device, nowUTC, targetMonthlyVar, currentMonthlyValue, accVar, fallbackVar) {
  const yearStart = nowUTC.clone().startOf("year");
  const monthStart = nowUTC.clone().startOf("month");
  const lastClosedMonthEnd = nowUTC.clone().subtract(1, "month").endOf("month");

  let closedSum = 0;

  if (lastClosedMonthEnd.isAfter(yearStart)) {
    const { sum, count } = await sumAggregateInRange(
      device,
      targetMonthlyVar,
      yearStart.toISOString(),
      lastClosedMonthEnd.toISOString()
    );
    if (count > 0) {
      closedSum = sum;
    } else if (monthStart.isAfter(yearStart)) {
      // Fallback: no closed monthly aggregates — raw for the closed-months span of this year
      const { value: rawVal } = await getRainInRange(
        device,
        accVar,
        fallbackVar,
        yearStart.toISOString(),
        monthStart.toISOString()
      );
      closedSum = rawVal;
    }
  }

  const total = closedSum + currentMonthlyValue;
  console.log(`[PTD-Yearly] closedMonthlySum=${closedSum}, currentMonth=${currentMonthlyValue}, total=${total}`);
  return { value: total };
}

/**
 * Write PTD only if:
 *   - no previous point, OR
 *   - value differs (with epsilon), OR
 *   - group differs (period rollover)
 */
async function storeIfChangedPTD(device, { variable, value, writeTime, periodStart, periodEnd, sourceVar, group, eps }) {
  const last = await getLastPoint(device, variable);

  const lastVal = last ? Number(last.value) : NaN;
  const lastGroup = last ? String(last.group || "") : "";

  const valueSame = Number.isFinite(lastVal) && nearlyEqual(lastVal, value, eps);
  const groupSame = lastGroup === String(group || "");

  if (last && valueSame && groupSame) {
    // console.log(`[PTD] No change → skipped ${variable} (value=${value}, group=${group})`);
    return false;
  }

  await storeAggregate(
    device,
    variable,
    value,
    writeTime,
    periodStart,
    periodEnd,
    sourceVar,
    { mode: "period_to_date" },
    group
  );

  console.log(
    `[PTD] Stored ${variable}=${value} at ${writeTime.toISOString()} (prev=${Number.isFinite(lastVal) ? lastVal : "none"}, prevGroup=${lastGroup || "none"}, group=${group})`
  );
  return true;
}

// ---------- Retention-smart yearly helpers ----------
async function getLatestClosedMonthlyForYear(device, monthlyVar, year) {
  const yearStart = moment.utc(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = moment.utc(`${year}-12-31T23:59:59.999Z`);

  const res = await device.getData({
    variable: monthlyVar,
    start_date: yearStart.toISOString(),
    end_date: yearEnd.toISOString(),
    qty: 1,
    order: "desc",
  });

  return Array.isArray(res) && res.length ? res[0] : null;
}

function extractYtdEndMm(monthItem) {
  if (!monthItem) return 0;
  const meta = monthItem.metadata || {};
  const ytdEnd = Number(meta.ytd_end_mm);
  if (Number.isFinite(ytdEnd)) return ytdEnd;

  const ytdBefore = Number(meta.ytd_before_mm);
  const val = Number(monthItem.value);
  if (Number.isFinite(ytdBefore) && Number.isFinite(val)) return ytdBefore + val;

  return 0;
}

// ---------- Core compute per device ----------
async function computeForDevice(device, opts) {
  const {
    accVar,
    fallbackVar,
    hoursBack,
    daysBack,
    weeksBack,
    monthsBack,

    shiftSeconds,
    currentShiftSeconds,

    targetHourlyVar,
    targetDailyVar,
    targetWeeklyVar,
    targetMonthlyVar,

    currentDailyVar,
    currentWeeklyVar,
    currentMonthlyVar,
    currentYearlyVar,

    ptdEpsilon,
  } = opts;

  const nowUTC = moment.utc();

  // ----------------------------
  // CLOSED PERIODS (idempotent)
  // ----------------------------

  // Hourly: past N CLOSED hours
  const lastClosedHourEnd = nowUTC.clone().subtract(1, "hour").endOf("hour");
  for (let i = 0; i < hoursBack; i++) {
    const intervalEnd = lastClosedHourEnd.clone().subtract(i, "hours");
    const { start, end } = asUTCRange(intervalEnd, "hour");
    const writeTime = withShift(end, shiftSeconds, 1 + (i % 10));

    try {
      if (!(await alreadyHasAggregate(device, targetHourlyVar, writeTime))) {
        const { value: sum, source } = await getRainInRange(
          device,
          accVar,
          fallbackVar,
          start.toISOString(),
          end.toISOString()
        );
        await storeAggregate(device, targetHourlyVar, sum, writeTime, start, end, source, {
          mode: "closed_period",
          period: "hour",
        });
        console.log(`[Hourly] Stored ${sum} mm (src: ${source}) at ${writeTime.toISOString()} ${targetHourlyVar}`);
      }
    } catch (err) {
      console.log(`Error processing hourly aggregate at ${writeTime.toISOString()}: ${err?.message || err}`);
      throw err;
    }
  }

  // Daily: past N CLOSED days
  const lastClosedDayEnd = nowUTC.clone().subtract(1, "day").endOf("day");
  for (let i = 0; i < daysBack; i++) {
    const intervalEnd = lastClosedDayEnd.clone().subtract(i, "days");
    const { start, end } = asUTCRange(intervalEnd, "day");
    const writeTime = withShift(end, shiftSeconds, 2 + (i % 10));

    try {
      if (!(await alreadyHasAggregate(device, targetDailyVar, writeTime))) {
        const { value: sum, source } = await getRainInRange(
          device,
          accVar,
          fallbackVar,
          start.toISOString(),
          end.toISOString()
        );
        await storeAggregate(device, targetDailyVar, sum, writeTime, start, end, source, {
          mode: "closed_period",
          period: "day",
        });
        console.log(`[Daily] Stored ${sum} mm (src: ${source}) at ${writeTime.toISOString()} ${targetDailyVar}`);
      }
    } catch (err) {
      console.log(`Error processing daily aggregate at ${writeTime.toISOString()}: ${err?.message || err}`);
      throw err;
    }
  }

  // Weekly (ISO week): past N CLOSED weeks
  const lastClosedISOWeekEnd = nowUTC.clone().subtract(1, "week").endOf("isoWeek");
  for (let i = 0; i < weeksBack; i++) {
    const intervalEnd = lastClosedISOWeekEnd.clone().subtract(i, "weeks");
    const { start, end } = asUTCISOWeekRange(intervalEnd);
    const writeTime = withShift(end, shiftSeconds, 3 + (i % 10));

    try {
      if (!(await alreadyHasAggregate(device, targetWeeklyVar, writeTime))) {
        const { value: sum, source } = await getRainInRange(
          device,
          accVar,
          fallbackVar,
          start.toISOString(),
          end.toISOString()
        );
        await storeAggregate(device, targetWeeklyVar, sum, writeTime, start, end, source, {
          mode: "closed_period",
          period: "isoWeek",
        });
        console.log(`[Weekly] Stored ${sum} mm (src: ${source}) at ${writeTime.toISOString()} ${targetWeeklyVar}`);
      }
    } catch (err) {
      console.log(`Error processing weekly aggregate at ${writeTime.toISOString()}: ${err?.message || err}`);
      throw err;
    }
  }

  // Monthly: past N CLOSED months
  // Writes YTD carry into metadata for retention-smart yearly.
  const lastClosedMonthEnd = nowUTC.clone().subtract(1, "month").endOf("month");
  for (let i = 0; i < monthsBack; i++) {
    const intervalEnd = lastClosedMonthEnd.clone().subtract(i, "months");
    const { start, end } = asUTCRange(intervalEnd, "month");
    const writeTime = withShift(end, shiftSeconds, 4 + (i % 10));

    try {
      if (!(await alreadyHasAggregate(device, targetMonthlyVar, writeTime))) {
        const { value: monthSum, source: monthSource } = await getRainInRange(
          device,
          accVar,
          fallbackVar,
          start.toISOString(),
          end.toISOString()
        );

        // retention-smart carry
        const year = start.year();
        let ytdBefore = 0;

        const latestMonthItem = await getLatestClosedMonthlyForYear(device, targetMonthlyVar, year);
        if (latestMonthItem) {
          const latestPeriodEnd = moment.utc(latestMonthItem.metadata?.period_end_utc || latestMonthItem.time);
          if (latestPeriodEnd.isBefore(start)) {
            ytdBefore = extractYtdEndMm(latestMonthItem);
          } else {
            // backfill scenario; best-effort
            const yearStart = moment.utc(`${year}-01-01T00:00:00.000Z`);
            ({ value: ytdBefore } = await getRainInRange(
              device,
              accVar,
              fallbackVar,
              yearStart.toISOString(),
              start.toISOString()
            ));
          }
        }

        const ytdEnd = ytdBefore + monthSum;

        await storeAggregate(device, targetMonthlyVar, monthSum, writeTime, start, end, monthSource, {
          mode: "closed_period",
          period: "month",
          ytd_before_mm: ytdBefore,
          ytd_end_mm: ytdEnd,
          ytd_year: year,
        });

        console.log(
          `[Monthly] Stored ${monthSum} mm (src: ${monthSource}) at ${writeTime.toISOString()} ${targetMonthlyVar} | ytd_end=${ytdEnd}`
        );
      }
    } catch (err) {
      console.log(`Error processing monthly aggregate at ${writeTime.toISOString()}: ${err?.message || err}`);
      throw err;
    }
  }

  // ----------------------------
  // CURRENT / PERIOD-TO-DATE (compute every run, store only if changed)
  // Each level is derived from lower-level aggregate sums + the still-open partial.
  // Raw data is only used for the one sub-period that has not yet been closed into a bucket.
  // ----------------------------
  const baseWriteTime = nowUTC.clone().add(currentShiftSeconds, "seconds");

  // Current Day-to-date: Σ closed rain_height_hourly for today + open partial hour (raw)
  let currentDailyValue = 0;
  let currentDailySource = fallbackVar;
  if (currentDailyVar) {
    const { value, source } = await getCurrentDayFromHourly(
      device,
      nowUTC,
      targetHourlyVar,
      accVar,
      fallbackVar
    );
    currentDailyValue = value;
    currentDailySource = source;

    const periodStart = nowUTC.clone().startOf("day");
    const writeTime = baseWriteTime.clone().add(2, "seconds");
    const group = `current_day_${periodStart.format("YYYY-MM-DD")}`;

    await storeIfChangedPTD(device, {
      variable: currentDailyVar,
      value: currentDailyValue,
      writeTime,
      periodStart,
      periodEnd: nowUTC,
      sourceVar: currentDailySource,
      group,
      eps: ptdEpsilon,
    });
  }

  // Current ISO Week-to-date: Σ closed rain_height_daily for this week + today's current daily
  if (currentWeeklyVar) {
    const { value: weeklyVal } = await getCurrentWeekFromDaily(
      device,
      nowUTC,
      targetDailyVar,
      currentDailyValue,
      accVar,
      fallbackVar
    );

    const periodStart = nowUTC.clone().startOf("isoWeek");
    const writeTime = baseWriteTime.clone().add(3, "seconds");
    const group = `current_isoweek_${periodStart.format("GGGG-[W]WW")}`;

    await storeIfChangedPTD(device, {
      variable: currentWeeklyVar,
      value: weeklyVal,
      writeTime,
      periodStart,
      periodEnd: nowUTC,
      sourceVar: currentDailySource,
      group,
      eps: ptdEpsilon,
    });
  }

  // Current Month-to-date: Σ closed rain_height_daily for this month + today's current daily
  let currentMonthlyValue = 0;
  if (currentMonthlyVar) {
    const { value: monthlyVal } = await getCurrentMonthFromDaily(
      device,
      nowUTC,
      targetDailyVar,
      currentDailyValue,
      accVar,
      fallbackVar
    );
    currentMonthlyValue = monthlyVal;

    const periodStart = nowUTC.clone().startOf("month");
    const writeTime = baseWriteTime.clone().add(4, "seconds");
    const group = `current_month_${periodStart.format("YYYY-MM")}`;

    await storeIfChangedPTD(device, {
      variable: currentMonthlyVar,
      value: currentMonthlyValue,
      writeTime,
      periodStart,
      periodEnd: nowUTC,
      sourceVar: currentDailySource,
      group,
      eps: ptdEpsilon,
    });
  }

  // Current Year-to-date: Σ closed rain_height_monthly for this year + current month-to-date
  if (currentYearlyVar) {
    const { value: yearlyVal } = await getCurrentYearFromMonthly(
      device,
      nowUTC,
      targetMonthlyVar,
      currentMonthlyValue,
      accVar,
      fallbackVar
    );

    const yearStart = nowUTC.clone().startOf("year");
    const writeTime = baseWriteTime.clone().add(5, "seconds");
    const group = `current_year_${nowUTC.year()}`;

    await storeIfChangedPTD(device, {
      variable: currentYearlyVar,
      value: yearlyVal,
      writeTime,
      periodStart: yearStart,
      periodEnd: nowUTC,
      sourceVar: currentDailySource,
      group,
      eps: ptdEpsilon,
    });
  }
}

// ---------- Analysis entry ----------
async function startAnalysis(context) {
  try {
    const my_account_token = context.environment.find((env_var) => env_var.key === "ACCOUNT_TOKEN");
    if (!my_account_token?.value) return console.log("Account token not found!");
    const account = new Account({ token: my_account_token.value });

    const HOURS_BACK = toNumber(getOptionalEnv(context, "HOURS_BACK", "24"), 24);
    const DAYS_BACK = toNumber(getOptionalEnv(context, "DAYS_BACK", "15"), 15);
    const WEEKS_BACK = toNumber(getOptionalEnv(context, "WEEKS_BACK", "20"), 20);
    const MONTHS_BACK = toNumber(getOptionalEnv(context, "MONTHS_BACK", "6"), 6);

    const SOURCE_VARIABLE = getOptionalEnv(context, "SOURCE_VARIABLE", "rain_height_acc");
    const FALLBACK_VARIABLE = getOptionalEnv(context, "FALLBACK_VARIABLE", "rain_height");

    const SHIFT_SECONDS = toNumber(getOptionalEnv(context, "SHIFT_SECONDS", "10"), 10);
    const CURRENT_SHIFT_SECONDS = toNumber(getOptionalEnv(context, "CURRENT_SHIFT_SECONDS", "10"), 10);

    const TARGET_HOURLY_VAR = getOptionalEnv(context, "TARGET_HOURLY_VAR", "rain_height_hourly");
    const TARGET_DAILY_VAR = getOptionalEnv(context, "TARGET_DAILY_VAR", "rain_height_daily");
    const TARGET_WEEKLY_VAR = getOptionalEnv(context, "TARGET_WEEKLY_VAR", "rain_height_weekly");
    const TARGET_MONTHLY_VAR = getOptionalEnv(context, "TARGET_MONTHLY_VAR", "rain_height_monthly");

    const CURRENT_DAILY_VAR = getOptionalEnv(context, "CURRENT_DAILY_VAR", "current_rain_height_daily");
    const CURRENT_WEEKLY_VAR = getOptionalEnv(context, "CURRENT_WEEKLY_VAR", "current_rain_height_weekly");
    const CURRENT_MONTHLY_VAR = getOptionalEnv(context, "CURRENT_MONTHLY_VAR", "current_rain_height_monthly");
    const CURRENT_YEARLY_VAR = getOptionalEnv(context, "CURRENT_YEARLY_VAR", "current_rain_height_yearly");

    const PTD_EPSILON = toNumber(getOptionalEnv(context, "PTD_EPSILON", "0.000001"), 0.000001);

    const deviceSummaries = await listDevicesToProcess();
    if (!deviceSummaries.length) {
      console.log("No devices found with tag type = s2120");
      return;
    }

    console.log(`Found ${deviceSummaries.length} device(s) to process.`);

    for (const d of deviceSummaries) {
      try {
        const deviceToken = await getOrCreateDeviceTokenById(account, d.id);
        const device = new Device({ token: deviceToken });

        console.log(`Processing device: ${d.name || d.id}`);
        await computeForDevice(device, {
          accVar: SOURCE_VARIABLE,
          fallbackVar: FALLBACK_VARIABLE,
          hoursBack: HOURS_BACK,
          daysBack: DAYS_BACK,
          weeksBack: WEEKS_BACK,
          monthsBack: MONTHS_BACK,

          shiftSeconds: SHIFT_SECONDS,
          currentShiftSeconds: CURRENT_SHIFT_SECONDS,

          targetHourlyVar: TARGET_HOURLY_VAR,
          targetDailyVar: TARGET_DAILY_VAR,
          targetWeeklyVar: TARGET_WEEKLY_VAR,
          targetMonthlyVar: TARGET_MONTHLY_VAR,

          currentDailyVar: CURRENT_DAILY_VAR,
          currentWeeklyVar: CURRENT_WEEKLY_VAR,
          currentMonthlyVar: CURRENT_MONTHLY_VAR,
          currentYearlyVar: CURRENT_YEARLY_VAR,

          ptdEpsilon: PTD_EPSILON,
        });
      } catch (err) {
        console.log(`Error processing device ${d.name || d.id}: ${err?.message || err}`);
      }
    }

    console.log("Aggregation completed.");
  } catch (error) {
    console.log(`Fatal error: ${error?.message || error}`);
  }
}

Analysis.use(startAnalysis);
