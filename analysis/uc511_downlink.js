// Analysis A (uc511_downlink) — with trigger user info + jittered throttle scheduler
const { Analysis, Account, Device, Utils } = require("@tago-io/sdk");

module.exports = new Analysis(async (context, scope) => {
  if (!scope[0]) return context.log("This analysis must be triggered by a widget.");

  const env = Utils.envToJson(context.environment);
  if (!env.account_token || env.account_token.length !== 36) {
    return context.log('Missing/invalid "account_token".');
  }
  const DEFAULT_PORT = Number(env.default_PORT || 85);
  const demoMode = env.DEMO_MODE === "true" || env.DEMO_MODE === "1"; // default OFF; set env DEMO_MODE=true to simulate
  if (demoMode) context.log("DEMO_MODE: skipping downlinks, writing simulated device data.");

  const account = new Account({ token: env.account_token });
  const v = scope[0];
  const device_id = (v.metadata && v.metadata.target_device) || v.device;
  if (!device_id) return context.log("No device id on scope.");

  console.log(
    `Running for device: ${device_id}, ${v.variable}: ${v.value}, ${JSON.stringify(v.metadata)}`
  );

  // ========= HISTORY RANGE FETCH =========
  // The plot's "Φόρτωση" button sends `history_request` to pull an arbitrary date range that is
  // beyond the widget's pushed data window (the widget SDK has no data-query method of its own).
  // We query the sensor device for [start,end], downsample to a bounded number of points so the
  // response stays under TagoIO's ~10kB/record limit at any range width, and write it back as
  // `history_data` for the widget to render. This branch never produces downlinks.
  if (v.variable === "history_request") {
    try {
      const md = v.metadata || {};
      const sensorId = String(md.target_device || md.source_device || "").trim();
      const sourceVar = String(md.source_variable || md.variable || "").trim();
      const startISO = md.start_iso || md.start;
      const endISO = md.end_iso || md.end;
      const maxPoints = clampInt(Number(md.max_points) || 500, 50, 1000);

      if (!sensorId || !sourceVar || !startISO || !endISO) {
        context.log("history_request missing target_device/source_variable/start/end — ignoring.");
        return;
      }

      const sensorToken = await ensureDeviceToken(account, sensorId);
      const sensorDevice = new Device({ token: sensorToken });
      const raw = await sensorDevice
        .getData({
          variables: [sourceVar],
          start_date: new Date(startISO).toISOString(),
          end_date: new Date(endISO).toISOString(),
          qty: 10000,
        })
        .catch((e) => {
          context.log(`history getData failed: ${e?.message || e}`);
          return [];
        });

      // Ascending by time, compact [epochSeconds, value] pairs (seconds keep the payload small).
      const pairs = (Array.isArray(raw) ? raw : [])
        .map((d) => [Math.floor(new Date(d.time).getTime() / 1000), Number(d.value)])
        .filter(([t, val]) => Number.isFinite(t) && Number.isFinite(val))
        .sort((a, b) => a[0] - b[0]);

      // Downsample by striding to at most maxPoints, always keeping the last real point.
      let points = pairs;
      if (pairs.length > maxPoints) {
        const stride = Math.ceil(pairs.length / maxPoints);
        points = pairs.filter((_, i) => i % stride === 0);
        const last = pairs[pairs.length - 1];
        if (points[points.length - 1] !== last) points.push(last);
      }

      // Write the response to the FIELD device (v.device) that the widget subscribes for
      // history_data. NOT device_id — that resolves to metadata.target_device (the SENSOR) here.
      const fieldToken = await ensureDeviceToken(account, v.device);
      const fieldDevice = new Device({ token: fieldToken });
      await fieldDevice.sendData([
        {
          variable: "history_data",
          value: points.length,
          metadata: {
            source_variable: sourceVar,
            target_device: sensorId,
            start_iso: startISO,
            end_iso: endISO,
            count: points.length,
            truncated: pairs.length >= 10000, // hit the 10k query cap; older points may be missing
            points,
          },
        },
      ]);
      context.log(
        `history_data written: ${points.length} pts (raw ${pairs.length}) for ${sourceVar} on ${sensorId} [${startISO}..${endISO}].`
      );
    } catch (e) {
      context.log(`history_request failed: ${e?.message || e}`);
    }
    return; // history requests never fall through to downlink/rule logic
  }

  // ---- who triggered (user/dashboard/widget) ----
  const who = extractTriggerInfo(context, scope);

  // ---- Resolve HW version (Tag -> Data -> Save Tag) ----
  const hw = await resolveHwVersion(account, device_id, context);
  // hw = { raw: "v4.1", major: 4 } or { raw: null, major: null }
  context.log(`hw_version resolved: raw=${hw.raw || "—"}, major=${hw.major ?? "—"}`);

  // ---- constants ----
  const REFRESH_RULES_CMD = "FF53"; // request FF53 replies
  const SUBCMD_TOGGLE = "03"; // FF4B 03 <ruleId> <0|1>

  const downlinks = [];
  let demoHandled = false;
  const pushDL = (hex) =>
    downlinks.push({ payload: hex.toUpperCase(), port: DEFAULT_PORT, confirmed: false });

  // ========= QUICK VALVE COMMANDS =========
  if (v.variable === "valve_1_command") {
    if (v.value === "on") pushDL("FF1D2000");
    if (v.value === "off") pushDL("FF1D0000");
  }
  if (v.variable === "valve_1_time_command") {
    // Full 11-byte UC51x valve frame (per Milesight official encoder setValveTask):
    //   FF 1D | ctrl | seq | duration(UInt24LE, sec) | valve_pulse(UInt32LE)
    // ctrl 0xA0 = time_rule_enable(bit7) | open(bit5) | valve_index 0. The duration only takes
    // effect when the FULL frame is sent — the previous 7-byte form omitted the 4-byte valve_pulse
    // field, so the valve opened but never auto-closed. seq=00 (force execute), pulse=0 (time-only).
    pushDL("FF1DA000" + toLE24Hex(Number(v.value) * 60) + "00000000");
  }
  if (v.variable === "valve_2_command") {
    if (v.value === "on") pushDL("FF1D2100");
    if (v.value === "off") pushDL("FF1D0100");
  }
  if (v.variable === "valve_2_time_command") {
    // ctrl 0xA1 = time_rule_enable(bit7) | open(bit5) | valve_index 1 (valve 2). Full 11-byte frame
    // (see valve_1_time_command). FF1DA2… would target a non-existent valve 3; the 7-byte form
    // omitted valve_pulse so the auto-close never applied.
    pushDL("FF1DA100" + toLE24Hex(Number(v.value) * 60) + "00000000");
  }

  // ========= RULE ENABLE/DISABLE =========
  const mEnable = v.variable && String(v.variable).match(/^rule(\d+)_enable$/i);
  if (mEnable) {
    const ruleId = clampInt(Number(mEnable[1]), 1, 16);
    const desired = normalizeBool(v.value) ? 1 : 0;

    if (demoMode) {
      demoHandled = true;
    } else {
      // FF4B 03 <ruleId> <enable>
      pushDL(`FF4B${SUBCMD_TOGGLE}${byteHex(ruleId)}${byteHex(desired)}`);
      // ask device to send FF53 back so the parser updates rule#
      pushDL(`${REFRESH_RULES_CMD}${byteHex(ruleId)}`);
    }
  }

  // ========= RULE SET / UPDATE (FF55) =========
  const mSet = v.variable && String(v.variable).match(/^rule(\d+)_set$/i);
  if (mSet) {
    const ruleId = clampInt(Number(mSet[1]), 1, 16);
    const md = v.metadata || {};
    const startISO = md.start_iso;
    if (!startISO) return context.log("rule_set missing metadata.start_iso");

    const startTS = Math.floor(new Date(startISO).getTime() / 1000);
    const enableFlag = typeof md.enabled === "boolean" ? (md.enabled ? 1 : 0) : 1;

    // condition
    const condType = 0x01; // time
    const endTS = 0; // open-ended
    const isLoop = md.repeat ? 1 : 0;

    // loop period/params
    // Your current logic uses: 01=day, 02=week
    // HW v4+ supports month (00) in newer protocol; legacy: approximate months as 30 days.
    let loopPeriod = 0x01; // 01=day, 02=week, 00=month (v4+ only)
    let pA = 0x00,
      pB = 0x00;

    if (md.repeat) {
      const every = clampInt(md.interval, 1, 65535);
      const unit = String(md.unit || "day").toLowerCase();

      if (unit.startsWith("week")) {
        loopPeriod = 0x02; // weekly
        // Selected Δε-Κυ days as a bitmask (bit 0 = Monday); default to all days if unset/empty.
        const wmask = Number(md.weekday_mask) & 0x7f;
        pA = wmask ? wmask : 0x7f;
        pB = clampInt(every, 1, 255); // every N weeks
      } else if (unit.startsWith("month")) {
        if ((hw.major ?? 0) >= 4) {
          // Native month support on HW v4+
          loopPeriod = 0x00; // month
          const months = clampInt(every, 1, 65535);
          pA = months & 0xff;
          pB = (months >> 8) & 0xff;
        } else {
          // Legacy fallback: approximate as 30 days
          loopPeriod = 0x01;
          const days = clampInt(every * 30, 1, 65535);
          pA = days & 0xff;
          pB = (days >> 8) & 0xff;
        }
      } else {
        loopPeriod = 0x01; // daily
        const days = clampInt(every, 1, 65535);
        pA = days & 0xff;
        pB = (days >> 8) & 0xff;
      }
    }

    // action
    const actType = 0x02; // valve
    const valve = clampInt(md.valve || 1, 1, 3);
    const op = 0x01; // open
    // UI (rules modal) sends exact seconds as `duration_sec`; fall back to legacy minute granularity.
    const durationSec = clampInt(
      md.duration_sec != null ? Number(md.duration_sec) : (Number(md.duration_min) || 0) * 60,
      0,
      0xffffffff
    );
    const timed = durationSec > 0 ? 1 : 0;
    // UI (rules modal) sends the pulse count as `water_pulses`; keep `pulses` as a fallback.
    const flow = Number(md.water_pulses ?? md.pulses) > 0 ? 1 : 0;
    const pulses = clampInt(Number(md.water_pulses ?? md.pulses) || 0, 0, 0xffffffff);

    const ff55 =
      "FF55" +
      byteHex(ruleId) +
      byteHex(enableFlag) +
      byteHex(condType) +
      toLE32Hex(startTS) +
      toLE32Hex(endTS) +
      byteHex(isLoop) +
      byteHex(loopPeriod) +
      byteHex(pA) +
      byteHex(pB) +
      byteHex(actType) +
      byteHex(valve) +
      byteHex(op) +
      byteHex(timed) +
      toLE32Hex(durationSec) +
      byteHex(flow) +
      toLE32Hex(pulses);

    if (demoMode) {
      demoHandled = true;
    } else {
      pushDL(ff55);
      pushDL(`${REFRESH_RULES_CMD}${byteHex(ruleId)}`);
    }
  }

  // Optimistic rule state: write rule{N} so the dashboard reflects the rule IMMEDIATELY, without
  // waiting for the controller's FE53 echo (which only lands on the device's next uplink). Runs in
  // BOTH modes now — in demo mode it is the only effect; in live mode it rides ALONGSIDE the real
  // FF55/FF4B downlink and is later overwritten by the parser-decoded FE53 (confirmed state).
  if (mEnable || mSet) {
    const ruleNum = mEnable ? clampInt(Number(mEnable[1]), 1, 16) : clampInt(Number(mSet[1]), 1, 16);
    try {
      const token = await ensureDeviceToken(account, device_id);
      const device = new Device({ token });

      let demoValue, demoMeta;

      if (mEnable) {
        const desired = normalizeBool(v.value) ? 1 : 0;
        // Preserve existing metadata, only flip enabled
        const existing = await device.getData({ variables: [`rule${ruleNum}`], qty: 1 }).catch(() => []);
        const existingMeta = existing?.[0]?.metadata || {};
        demoValue = desired;
        demoMeta = { ...existingMeta, enabled: desired ? "Ναι" : "Όχι" };
      } else {
        // mSet — build full metadata in the same shape as the uplink parser produces
        const md = v.metadata || {};
        const startISO = md.start_iso || null;
        const startTS = startISO ? Math.floor(new Date(startISO).getTime() / 1000) : 0;
        const durationSec = md.duration_sec != null ? Number(md.duration_sec) : (Number(md.duration_min) || 0) * 60;
        const pulses = Number(md.water_pulses || md.pulses || 0);
        const valve = Number(md.valve || 1);
        const repeat = !!md.repeat;
        const unit = String(md.unit || "day").toLowerCase();
        const every = Number(md.interval || 1);
        const loopPeriodLabel = unit.startsWith("week") ? "Εβδομάδα" : unit.startsWith("month") ? "Μήνας" : "Ημέρα";
        // Match the parser echo format (Greek day names) so the card shows the same weekdays.
        const WEEKDAY_NAMES = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];
        const wmask = (Number(md.weekday_mask) & 0x7f) || 0x7f;
        const weekdaysText = WEEKDAY_NAMES.filter((_, i) => (wmask >> i) & 1).join(", ") || null;

        demoValue = 1;
        demoMeta = {
          rule_id: ruleNum,
          enabled: "Ναι",
          condition_type: `Συνθήκη #${ruleNum}`,
          start_ts: startTS,
          end_ts: 0,
          start_iso: startISO,
          end_iso: null,
          loop: repeat ? "Ναι" : "Όχι",
          loop_period: loopPeriodLabel,
          interval_days: unit.startsWith("day") ? every : null,
          weekday_mask: unit.startsWith("week") ? weekdaysText : null,
          action_type: "Ενέργεια βαλβίδας",
          valve: `Βαλβίδα ${valve}`,
          operation: "Άνοιγμα",
          timed_close: durationSec > 0 ? "Ναι" : "Όχι",
          duration_sec: durationSec,
          flow_control: pulses > 0 ? "Ναι" : "Όχι",
          water_pulses: pulses,
          has_time_gate: 0,
          has_flow_gate: false,
        };
      }

      await device.sendData([{ variable: `rule${ruleNum}`, value: demoValue, metadata: demoMeta }]);
      context.log(`Wrote optimistic rule${ruleNum} data (value=${demoValue}); FE53 echo will confirm.`);
    } catch (e) {
      context.log(`Optimistic rule write failed: ${e?.message || e}`);
    }
  }

  if (!downlinks.length && !demoHandled) {
    context.log("No matching command. Nothing to send.");
    return;
  }

  if (downlinks.length) {
    // Set 'downlink' param (traceability)
    await setDownlinkParam(account, device_id, downlinks[0].payload);

    // Send all in order
    for (const dl of downlinks) {
      context.log(`→ Downlink: ${dl.payload} (fport ${dl.port})`);
      const res = await Utils.sendDownlink(account, device_id, dl).catch((e) => e);
      if (res?.status && res.status !== true) context.log(`Downlink result: ${JSON.stringify(res)}`);
    }
  }

  try {
    await resetAckRetryForCommand(account, device_id, v.variable);
    context.log(`Retry counters reset for ${String(v.variable)}`);
  } catch (e) {
    context.log("Warn: retry counter reset failed:", e?.message || e);
  }

  // ---- audit datapoint (who triggered) ----
  try {
    const token = await ensureDeviceToken(account, device_id);
    const device = new Device({ token });
    await device.sendData([
      {
        variable: "uc511_trigger_audit",
        value: "command_sent",
        metadata: {
          user_id: who.user_id,
          user_name: who.user_name,
          user_email: who.user_email,
          dashboard_id: who.dashboard_id,
          widget_id: who.widget_id,
          variable: v.variable,
          value: v.value,
          created_at: new Date().toISOString(),
        },
      },
    ]);
    console.log("User: ", who.user_email);
  } catch (e) {
    context.log("audit datapoint/params failed:", e?.message || e);
  }

  // ================= Throttle handoff (create once, 1 minute, with jitter) =================
  if (demoMode) {
    context.log("Demo: skipping ack-check throttle scheduler.");
    return;
  }
  try {
    const TAGS_BASE = [
      { key: "chain", value: "uc511->checker" },
      { key: "purpose", value: "one-off" },
      { key: "throttle_group", value: "uc511_ack_check" },
    ];
    // include user/context tags:
    const USER_TAGS = [
      { key: "user_id", value: who.user_id || "-" },
      { key: "user_name", value: who.user_name || "-" },
      { key: "user_email", value: who.user_email || "-" },
      { key: "dashboard_id", value: who.dashboard_id || "-" },
      { key: "widget_id", value: who.widget_id || "-" },
    ];
    const NOW_TAG = { key: "created_at", value: String(Date.now()) };

    // 1) Pre-check: already pending?
    const existing = await account.actions.list({
      amount: 50,
      page: 1,
      fields: ["id", "active", "tags", "name"],
    });
    const pending = existing.find(
      (a) =>
        a.active !== false &&
        a.tags?.some((t) => t.key === "purpose" && t.value === "one-off") &&
        a.tags?.some((t) => t.key === "throttle_group" && t.value === "uc511_ack_check") &&
        a.tags?.some((t) => t.key === "chain" && t.value === "uc511->checker")
    );

    if (!pending) {
      // 2) Jittered cron second (±5s around now)
      const baseSec = new Date().getSeconds();
      const jitter = Math.floor(Math.random() * 11) - 5; // -5..+5
      const sec = (baseSec + jitter + 60) % 60;

      // 3) Create cron schedule every minute at :sec
      await account.actions.create({
        name: "uc511 ack check (cron, jittered)",
        active: true,
        type: "schedule",
        trigger: [
          {
            cron: `${sec} * * * * *`,
            timezone: "Europe/Athens",
          },
        ],
        action: { type: "script", script: ["68fba332f1f181000a1b4dce"] }, // Analysis B
        tags: [...TAGS_BASE, ...USER_TAGS, NOW_TAG, { key: "jitter_sec", value: String(sec) }],
      });
      context.log(`Created ack-check action (cron @ :${sec}s).`);
    } else {
      context.log(`Throttle: pending action ${pending.id} exists; skipping creation.`);
    }

    // 4) Race guard: keep oldest, delete duplicates
    const after = await account.actions.list({
      amount: 50,
      page: 1,
      fields: ["id", "active", "tags", "name"],
    });
    const candidates = after.filter(
      (a) =>
        a.active !== false &&
        a.tags?.some((t) => t.key === "purpose" && t.value === "one-off") &&
        a.tags?.some((t) => t.key === "throttle_group" && t.value === "uc511_ack_check") &&
        a.tags?.some((t) => t.key === "chain" && t.value === "uc511->checker")
    );

    if (candidates.length > 1) {
      const createdAt = (a) => Number(a.tags?.find((t) => t.key === "created_at")?.value || "0");
      candidates.sort((a, b) => createdAt(a) - createdAt(b) || String(a.id).localeCompare(String(b.id)));
      const keep = candidates[0];
      const toDelete = candidates.slice(1);
      for (const a of toDelete) {
        try {
          await account.actions.delete(a.id);
        } catch (e) {
          context.log(`Race-guard: failed to delete extra action ${a.id}: ${e?.message || e}`);
        }
      }
      context.log(`Race-guard: kept ${keep.id}, deleted ${toDelete.length} duplicate action(s).`);
    }
  } catch (e) {
    context.log("Error creating/compacting throttle action:", e?.message || e);
  }
});

/* ============== helpers ============== */
function extractTriggerInfo(context, scope) {
  const v = scope?.[0] || {};
  const u = context?.user || {};
  console.log("U: ", u);
  return {
    user_id: String(u.id || ""),
    user_name: String(u.name || ""),
    user_email: String(u.email || ""),
    dashboard_id: String(v?.origin?.dashboard || v?.metadata?.dashboard_id || ""),
    widget_id: String(v?.origin?.widget || v?.metadata?.widget_id || ""),
  };
}

function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "on";
}
function clampInt(n, min, max) {
  n = Math.floor(Number(n) || 0);
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}
function byteHex(n) {
  return clampInt(n, 0, 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}
function toLE24Hex(n) {
  n = clampInt(n, 0, 0xffffff);
  const b0 = (n & 0xff).toString(16).padStart(2, "0");
  const b1 = ((n >> 8) & 0xff).toString(16).padStart(2, "0");
  const b2 = ((n >> 16) & 0xff).toString(16).padStart(2, "0");
  return (b0 + b1 + b2).toUpperCase();
}
function toLE32Hex(n) {
  n = Number(n) >>> 0;
  const b0 = (n & 0xff).toString(16).padStart(2, "0");
  const b1 = ((n >>> 8) & 0xff).toString(16).padStart(2, "0");
  const b2 = ((n >>> 16) & 0xff).toString(16).padStart(2, "0");
  const b3 = ((n >>> 24) & 0xff).toString(16).padStart(2, "0");
  return (b0 + b1 + b2 + b3).toUpperCase();
}
async function setDownlinkParam(account, device_id, payloadHex) {
  const params = await account.devices.paramList(device_id);
  let dl = params.find((x) => x.key === "downlink");
  dl = { id: dl ? dl.id : null, key: "downlink", value: String(payloadHex), sent: false };
  await account.devices.paramSet(device_id, dl);
}
async function ensureDeviceToken(account, device_id) {
  try {
    const tokens = await account.devices.tokenList(device_id);
    if (tokens?.[0]?.token) return tokens[0].token;
  } catch (_) {
    /* ignore */
  }
  const created = await account.devices.tokenCreate(device_id, { name: "uc511_audit_tmp" });
  return created?.token;
}

// Turn the incoming variable into the retry param key we use in Analysis B
function retryKeyFromVariable(variable) {
  return String(variable || "")
    .replace(/\s+/g, "")
    .toLowerCase(); // e.g., "valve_1_command"
}

// Resets ALL matching ack_retry_* params for this command variable to "0"
async function resetAckRetryForCommand(account, device_id, variable) {
  const retryKey = retryKeyFromVariable(variable); // e.g., valve_1_command
  const fullKey = `ack_retry_${retryKey}`; // e.g., ack_retry_valve_1_command

  const params = await account.devices.paramList(device_id);
  const matches = params.filter((p) => p.key === fullKey);

  // If none exist, nothing to do; if duplicates exist, zero them all
  for (const p of matches) {
    await account.devices.paramSet(device_id, {
      id: p.id || null,
      key: p.key,
      value: "0",
      sent: false,
    });
  }
}

// ---------------- HW version resolve (Tag -> Data -> Save Tag) ----------------

async function resolveHwVersion(account, device_id, context) {
  const TAG_KEY = "hw_version";

  // 1) Read device tags
  try {
    const info = await account.devices.info(device_id);
    const tags = Array.isArray(info?.tags) ? info.tags : [];
    const t = tags.find((x) => x?.key === TAG_KEY && x?.value != null && String(x.value).trim() !== "");
    if (t) {
      const raw = String(t.value).trim();
      return { raw, major: parseHwMajor(raw) };
    }
  } catch (e) {
    context?.log?.(`Warn: devices.info failed for tags: ${e?.message || e}`);
  }

  // 2) Fallback: latest device data "hw_version"
  let rawFromData = null;
  try {
    const token = await ensureDeviceToken(account, device_id);
    const device = new Device({ token });

    const data = await device.getData({
      variables: "hw_version",
      qty: 1,
    });

    const dp = Array.isArray(data) ? data[0] : null;
    if (dp?.value != null && String(dp.value).trim() !== "") {
      rawFromData = String(dp.value).trim();
    }
  } catch (e) {
    context?.log?.(`Warn: getData(hw_version) failed: ${e?.message || e}`);
  }

  if (!rawFromData) return { raw: null, major: null };

  // 3) Save back as device tag
  try {
    await upsertDeviceTag(account, device_id, TAG_KEY, rawFromData);
  } catch (e) {
    context?.log?.(`Warn: upsertDeviceTag failed: ${e?.message || e}`);
  }

  return { raw: rawFromData, major: parseHwMajor(rawFromData) };
}

function parseHwMajor(raw) {
  // Accept "v4.1", "4.1", "V3", "3"
  const s = String(raw || "").trim();
  const m = s.match(/v?\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function upsertDeviceTag(account, device_id, key, value) {
  const info = await account.devices.info(device_id);
  const tags = Array.isArray(info?.tags) ? [...info.tags] : [];

  const idx = tags.findIndex((t) => t?.key === key);
  if (idx >= 0) tags[idx] = { key, value: String(value) };
  else tags.push({ key, value: String(value) });

  await account.devices.edit(device_id, { tags });
}
