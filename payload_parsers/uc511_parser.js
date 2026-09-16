/**
 * UC51x Downlink Analysis (HW legacy + v4+)
 * - Resolves hw_version from device tags, else from device data, then persists it as tag
 * - Builds downlink commands depending on hw_major (>=4 vs legacy) ONLY where needed
 *
 * You can extend `buildDownlink()` to support all commands from your irrigation modals.
 */

const { Analysis, Account, Device, Utils } = require("@tago-io/sdk");

// ---------------- CONFIG ----------------
const HW_TAG_KEY = "hw_version"; // device tag key to store hw version, e.g. "v4.1"
const DEFAULT_FPORT = 85;        // change if you use another port

// ---------------- ENTRY ----------------
async function start(context, scope) {
  if (!scope[0]) return context.log("This analysis must be triggered by a widget.");

  const env = Utils.envToJson(context.environment);
  if (!env.account_token || env.account_token.length !== 36) {
    return context.log('Missing/invalid "account_token".');
  }
  const DEFAULT_PORT = Number(env.default_PORT || 85);

  const account = new Account({ token: env.account_token });
  const v = scope[0];
  const device_id = v.device;
  if (!device_id) return context.log("No device id on scope.");

  // Resolve HW version (tag -> data -> save tag)
  const hw = await resolveHwVersion(account, device_id, context);
  context.log(`hw_version resolved: raw=${hw.raw || "—"}, major=${hw.major ?? "—"}`);

  // Decide what to do based on incoming command
  const cmd = (getVar(scope, "cmd") || "").toLowerCase();

  if (!cmd) {
    context.log("No cmd provided. Nothing to do.");
    return;
  }

  const downlink = buildDownlink(scope, hw, context);

  if (!downlink) {
    context.log(`No downlink built for cmd='${cmd}'.`);
    return;
  }

  // Send downlink
  await sendDownlink(account, device_id, downlink, context);
  context.log("Downlink sent OK.");
}

module.exports = new Analysis(start);

// ---------------- COMMAND BUILDER ----------------
function buildDownlink(scope, hw, context) {
  const cmd = (getVar(scope, "cmd") || "").toLowerCase();

  // You can standardize on hex payload_raw string (no spaces)
  // Return shape: { fport, payload_raw, confirmed? }
  // confirmed=true if you use "confirmed downlink" where supported

  if (cmd === "rule_set") {
    // Expected inputs (adapt to your widget):
    // rule_id: 1..16
    // enabled: 0/1
    // start_ts: unix seconds
    // end_ts: unix seconds (0 allowed)
    // loop: 0/1
    // unit: "day" | "week" | "month"
    // every: number (>=1)
    // weekdays_mask: 0..127 (when unit=week)
    // action_valve: 1|2|3
    // action_operation: 0=close,1=open
    // timed_close: 0/1
    // duration_sec: uint32
    // flow_ctrl: 0/1
    // pulses: uint32

    const rule_id = clampInt(Number(getVar(scope, "rule_id")), 1, 255);
    const enabled = Number(getVar(scope, "enabled")) ? 1 : 0;

    const start_ts = clampUInt32(Number(getVar(scope, "start_ts")) || 0);
    const end_ts = clampUInt32(Number(getVar(scope, "end_ts")) || 0);

    const loop = Number(getVar(scope, "loop")) ? 1 : 0;

    const unit = String(getVar(scope, "unit") || "day").toLowerCase();
    const every = clampInt(Number(getVar(scope, "every")) || 1, 1, 65535);
    const weekdays_mask = clampInt(Number(getVar(scope, "weekdays_mask")) || 0, 0, 127);

    const action_valve = clampInt(Number(getVar(scope, "action_valve")) || 1, 1, 3);
    const action_operation = Number(getVar(scope, "action_operation")) ? 1 : 0;
    const timed_close = Number(getVar(scope, "timed_close")) ? 1 : 0;
    const duration_sec = clampUInt32(Number(getVar(scope, "duration_sec")) || 0);
    const flow_ctrl = Number(getVar(scope, "flow_ctrl")) ? 1 : 0;
    const pulses = clampUInt32(Number(getVar(scope, "pulses")) || 0);

    // ---- Condition encoding (per FE53 layout you’re using) ----
    // condType = 0x01 time
    const condType = 0x01;

    // loopPeriod mapping:
    // 0x01 day, 0x02 week, 0x00 month (only HW >=4, otherwise approximate month as day)
    let loopPeriod = 0x01;
    let pA = 0x01, pB = 0x00; // default every 1 day

    if (unit.startsWith("week")) {
      loopPeriod = 0x02;
      pA = weekdays_mask & 0xFF;
      pB = every & 0xFF; // if your spec uses every-N-weeks, keep here; else set 0
    } else if (unit.startsWith("month")) {
      if ((hw.major ?? 0) >= 4) {
        // native month
        loopPeriod = 0x00;
        pA = every & 0xFF;
        pB = (every >> 8) & 0xFF;
      } else {
        // legacy: approximate month as 30-day interval
        loopPeriod = 0x01;
        const days = clampInt(every * 30, 1, 65535);
        pA = days & 0xFF;
        pB = (days >> 8) & 0xFF;
      }
    } else {
      // day
      loopPeriod = 0x01;
      pA = every & 0xFF;
      pB = (every >> 8) & 0xFF;
    }

    // ---- Action encoding ----
    // actType = 0x02 valve
    const actType = 0x02;

    // Build payload:
    // FE 53 is uplink TLV in your parser; for downlink you mentioned FF55 / "Rule Set".
    // I’ll keep your existing downlink format conceptually:
    // [FF][55] [ruleId][enable][condType][startTS(4)][endTS(4)][loop][loopPeriod][pA][pB]
    //          [actType][valveId][op][timed][duration(4)][flow][pulses(4)]
    //
    // If your actual downlink header differs, just swap bytes at the top.

    const bytes = [];
    bytes.push(0xFF, 0x55);
    bytes.push(rule_id & 0xFF);
    bytes.push(enabled & 0xFF);

    bytes.push(condType & 0xFF);
    pushUInt32LE(bytes, start_ts);
    pushUInt32LE(bytes, end_ts);

    bytes.push(loop & 0xFF);
    bytes.push(loopPeriod & 0xFF);
    bytes.push(pA & 0xFF);
    bytes.push(pB & 0xFF);

    bytes.push(actType & 0xFF);
    bytes.push(action_valve & 0xFF);
    bytes.push(action_operation & 0xFF);
    bytes.push(timed_close & 0xFF);
    pushUInt32LE(bytes, duration_sec);
    bytes.push(flow_ctrl & 0xFF);
    pushUInt32LE(bytes, pulses);

    return {
      fport: DEFAULT_FPORT,
      payload_raw: toHex(bytes),
      confirmed: false,
      metadata: {
        cmd: "rule_set",
        hw_major: hw.major ?? null,
        unit,
        every,
        loopPeriod,
      },
    };
  }

  if (cmd === "valve") {
    // Example: open/close valve — assumed same across generations (branch only if you confirm differences)
    const valve = clampInt(Number(getVar(scope, "valve")) || 1, 1, 3);
    const operation = Number(getVar(scope, "operation")) ? 1 : 0; // 1=open, 0=close

    const bytes = [];
    bytes.push(0xFF, 0x1D);
    bytes.push(valve & 0xFF);
    bytes.push(operation & 0xFF);

    return {
      fport: DEFAULT_FPORT,
      payload_raw: toHex(bytes),
      confirmed: false,
      metadata: { cmd: "valve", valve, operation },
    };
  }

  context.log(`Unknown cmd='${cmd}'`);
  return null;
}

// ---------------- DOWNLINK SENDER ----------------
async function sendDownlink(account, device_id, downlink, context) {
  // Tago downlink API expects fields: { payload, port, confirmed }
  // Some accounts/devices use "payload_raw" vs "payload" naming at different layers,
  // but for Tago's SDK downlink this is the standard format:
  const body = {
    payload: downlink.payload_raw,
    port: downlink.fport,
    confirmed: !!downlink.confirmed,
  };

  context.log(`Sending downlink: port=${body.port}, confirmed=${body.confirmed}, payload=${body.payload}`);
  await account.devices.sendDownlink(device_id, body);
}

// ---------------- HW Version Resolve (Tag -> Data -> Save Tag) ----------------
async function resolveHwVersion(account, device_id, context) {
  // 1) Device tags
  try {
    const info = await account.devices.info(device_id);
    const tags = Array.isArray(info?.tags) ? info.tags : [];
    const t = tags.find(x => x?.key === HW_TAG_KEY && x?.value != null && String(x.value).trim() !== "");
    if (t) {
      const raw = String(t.value).trim();
      return { raw, major: parseHwMajor(raw) };
    }
  } catch (e) {
    context?.log?.(`Warn: devices.info failed: ${e?.message || e}`);
  }

  // 2) Latest device data variable "hw_version"
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

  // 3) Persist as device tag
  try {
    await upsertDeviceTag(account, device_id, HW_TAG_KEY, rawFromData);
  } catch (e) {
    context?.log?.(`Warn: upsertDeviceTag failed: ${e?.message || e}`);
  }

  return { raw: rawFromData, major: parseHwMajor(rawFromData) };
}

function parseHwMajor(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/v?\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function upsertDeviceTag(account, device_id, key, value) {
  const info = await account.devices.info(device_id);
  const tags = Array.isArray(info?.tags) ? [...info.tags] : [];

  const idx = tags.findIndex(t => t?.key === key);
  if (idx >= 0) tags[idx] = { key, value: String(value) };
  else tags.push({ key, value: String(value) });

  await account.devices.edit(device_id, { tags });
}

// Ensure we have a device token to read device data
async function ensureDeviceToken(account, device_id) {
  // If your account already has token for the device, you can skip this.
  // Standard method: get device info including token; if not present, create one.
  const info = await account.devices.info(device_id);
  if (info?.token) return info.token;

  // Create token if missing (some accounts may not allow)
  // If your SDK/environment doesn’t support this, tell me and I’ll adapt.
  const tokenObj = await account.devices.tokenCreate(device_id);
  return tokenObj.token;
}

// ---------------- Scope helpers ----------------
function getVar(scope, name) {
  const v = scope.find(x => x.variable === name);
  return v ? v.value : null;
}

// ---------------- Byte helpers ----------------
function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}
function clampUInt32(n) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  if (x < 0) return 0;
  if (x > 0xFFFFFFFF) return 0xFFFFFFFF;
  return x >>> 0;
}
function pushUInt32LE(arr, v) {
  arr.push(v & 0xFF);
  arr.push((v >> 8) & 0xFF);
  arr.push((v >> 16) & 0xFF);
  arr.push((v >> 24) & 0xFF);
}
function toHex(bytes) {
  return bytes.map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");
}

/* ---- TEST MODE EXPORTS ------------------------------------------------- */
/* Loaded when UC511_PARSER_TEST_MODE=true so Jest can reach pure functions  */
if (process.env.UC511_PARSER_TEST_MODE === "true") {
  module.exports = { buildDownlink, parseHwMajor, toHex, clampInt, clampUInt32, pushUInt32LE };
}