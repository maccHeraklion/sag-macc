// Analysis B: uc511_ack_checker (single fetch, retry cap+notify, action removal based on anyResent)
// Preserves original transmit sequence for rule events (ruleX_set / ruleX_enable) using a per-rule timeline.

const { Analysis, Account, Device, Utils } = require("@tago-io/sdk");

module.exports = new Analysis(async (context, scope) => {
  const env = toEnv(context.environment);
  if (!env.account_token || env.account_token.length !== 36) {
    return context.log('Missing/invalid "account_token" for checker.');
  }
  const DEFAULT_PORT = Number(env.default_PORT || 85);
  const MAX_RETRIES = Number(env.MAX_RETRIES ?? 3); // set in Environment
  const MIN_WAIT_MS = Number(env.MIN_WAIT_MS ?? 60_000); // ms before first resend attempt (default 60s)
  const account = new Account({ token: env.account_token });

  const devices = await listAllDevicesByTags(account, [
    { key: "manufacturer", value: "milesight" },
    { key: "type", value: "uc511" },
  ]);
  if (!devices.length) return context.log("No uc511 devices found.");

  const WINDOW_MS = 10 * 60 * 1000;
  const sinceISO = new Date(Date.now() - WINDOW_MS).toISOString();

  let anyResent = false;
  let anyPending = false;

  for (const dev of devices) {
    try {
      const token = await ensureDeviceToken(account, dev.id);
      const device = new Device({ token });

      // -------- Single fetch of last 10 minutes (all variables)
      const data = await device.getData({ start_date: sinceISO, qty: 1000 });

      // Index by variable for fast lookups
      const byVar = new Map();
      for (const r of data) {
        const varName = String(r.variable || "");
        const ts = new Date(r.time || r.date || r.created_at).getTime() || 0;
        if (!byVar.has(varName)) byVar.set(varName, []);
        byVar.get(varName).push({ ...r, __ts: ts });
      }
      for (const arr of byVar.values()) arr.sort((a, b) => a.__ts - b.__ts);

      // Cache device params for retries (reduce paramList calls)
      const paramsCache = await account.devices.paramList(dev.id);

      // Helpers bound to this device
      const getRetries = (key) => getRetriesCached(paramsCache, key);
      const setRetries = async (key, value) => {
        const body = upsertRetryParam(paramsCache, key, String(value));
        await account.devices.paramSet(dev.id, body);
      };
      const resetRetry = async (key) => {
        const p = paramsCache.find(x => x.key === `ack_retry_${key}`);
        if (p && p.value !== "0") {
          await account.devices.paramSet(dev.id, { id: p.id, key: p.key, value: "0", sent: false });
          p.value = "0";
        }
      };

      const hasAckAfter = (ackVar, ts) => {
        const arr = byVar.get(ackVar);
        if (!arr || !arr.length) return false;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].__ts > ts) return true;
          if (arr[i].__ts <= ts) break;
        }
        return false;
      };

      // Collect commands in window
      const commandVarsRegex = /^(valve_\d+_command|valve_\d+_time_command|rule\d+_(enable|set))$/i;
      const commands = [];
      for (const [varName, arr] of byVar.entries()) {
        if (!commandVarsRegex.test(varName)) continue;
        for (const r of arr) {
          // Multi-controller safety: the widget stamps commands with metadata.target_device, and
          // autofill broadcasts them into EVERY controller that declares the variable. Skip the
          // broadcast copies whose target is a DIFFERENT controller — otherwise this checker would
          // resend the downlink to the wrong device and physically open its valve.
          const td = r.metadata && r.metadata.target_device;
          if (td && String(td) !== String(dev.id)) continue;
          commands.push({ variable: varName, value: r.value, metadata: r.metadata || {}, ts: r.__ts });
        }
      }

      // IMPORTANT: sort chronologically (oldest -> newest) to preserve original transmit sequence
      commands.sort((a, b) => a.ts - b.ts);

      // ---------- VALVE HANDLING (same behavior as before, replayed in chronological order) ----------
      for (const c of commands) {
        const variable = c.variable;
        const ts = c.ts;
        const retryKey = variable.replace(/\s+/g, "").toLowerCase();

        // ---- valve_X_command -> expect valve_X > ts
        const mValve = variable.match(/^valve_(\d+)_command$/i);
        if (mValve) {
          const x = Number(mValve[1]);
          const ackVar = `valve_${x}`;
          if (hasAckAfter(ackVar, ts)) {
            await resetRetry(retryKey);
          } else {
            const payload = buildValvePayload(x, String(c.value).toLowerCase());
            if (payload) {
              const { resent, stillPending } = await maybeResendWithCap({
                account, context, device, dev, DEFAULT_PORT,
                payloads: [payload],
                retryKey, MAX_RETRIES, ts, minWaitMs: MIN_WAIT_MS,
                type: "valve_command",
                detail: { valve: x, state: c.value },
                getRetries, setRetries,
              });
              if (resent) anyResent = true;
              if (stillPending) anyPending = true;
            }
          }
          continue;
        }

        // ---- valve_X_time_command (> 3 minutes) -> expect valve_X > ts
        const mValveT = variable.match(/^valve_(\d+)_time_command$/i);
        if (mValveT) {
          const x = Number(mValveT[1]);
          const minutes = Number(c.value) || 0;
          if (minutes > 3) {
            const ackVar = `valve_${x}`;
            if (hasAckAfter(ackVar, ts)) {
              await resetRetry(retryKey);
            } else {
              const payload = buildValveTimePayload(x, minutes);
              if (payload) {
                const { resent, stillPending } = await maybeResendWithCap({
                  account, context, device, dev, DEFAULT_PORT,
                  payloads: [payload],
                  retryKey, MAX_RETRIES, ts, minWaitMs: MIN_WAIT_MS,
                  type: "valve_time_command",
                  detail: { valve: x, minutes },
                  getRetries, setRetries,
                });
                if (resent) anyResent = true;
                if (stillPending) anyPending = true;
              }
            }
          } else {
            await resetRetry(retryKey); // explicitly OK (<=3m)
          }
          continue;
        }
      }

      // ---------- RULE SEQUENCE HANDLING (unified logic that preserves original order) ----------
      // Build per-rule timelines from the already-sorted commands
      const ruleEventRe = /^rule(\d+)_(enable|set)$/i;
      const rulesMap = new Map();

      // Normalize rule events into a list per ruleId with their ts and source row
      for (const c of commands) {
        const m = c.variable.match(ruleEventRe);
        if (!m) continue;
        const ruleId = clampInt(Number(m[1]), 1, 16);
        if (!rulesMap.has(ruleId)) rulesMap.set(ruleId, []);
        rulesMap.get(ruleId).push({
          kind: m[2],            // "set" | "enable"
          ts: c.ts,
          raw: c,
        });
      }

      // For each rule timeline: keep only unacked events, then resend in chronological order as one batch
      for (const [ruleId, evts] of rulesMap.entries()) {
        const ackVar = `rule${ruleId}`;

        // Filter only pending (no ack after their own ts)
        const pending = evts.filter(e => !hasAckAfter(ackVar, e.ts));
        if (!pending.length) {
          // Reset individual counters if they exist (optional hygiene)
          for (const e of evts) {
            const key = `rule${ruleId}_${e.kind}`.toLowerCase();
            await resetRetry(key).catch(() => {});
          }
          continue;
        }

        // Build payloads in the same sequence they were sent (pending is chronological due to global sort)
        const payloads = [];
        let earliestTS = pending[0].ts;
        const detailSeq = [];

        // Optional: squash superseded 'set' events by keeping only the last one before enable.
        // Current implementation: sends all pending in order exactly as they came.
        for (const e of pending) {
          if (e.ts < earliestTS) earliestTS = e.ts;

          if (e.kind === "set") {
            const ff55 = buildFF53FromMetadata(ruleId, e.raw.metadata || {});
            if (ff55) {
              payloads.push(ff55);
              // optional refresh after set
              payloads.push(`FF53${byteHex(ruleId)}`);
              detailSeq.push({ kind: "set", meta_ok: true, ts: new Date(e.ts).toISOString() });
            } else {
              // metadata missing => can't rebuild, reset its individual retry to avoid looping
              await resetRetry(`rule${ruleId}_set`.toLowerCase()).catch(() => {});
            }
          } else if (e.kind === "enable") {
            const desired = normalizeBool(e.raw.value) ? 1 : 0;
            const payload = `FF4B03${byteHex(ruleId)}${byteHex(desired)}`;
            payloads.push(payload);
            // optional refresh after enable
            payloads.push(`FF53${byteHex(ruleId)}`);
            detailSeq.push({ kind: "enable", desired, ts: new Date(e.ts).toISOString() });
          }
        }

        // If we have something to send, use a single retry key per rule sequence
        if (payloads.length) {
          const retryKey = `rule${ruleId}_seq`;
          const { resent, stillPending } = await maybeResendWithCap({
            account, context, device, dev, DEFAULT_PORT,
            payloads,
            retryKey,
            MAX_RETRIES,
            ts: earliestTS, // earliest pending event is the base ts
            minWaitMs: MIN_WAIT_MS,
            type: "rule_sequence",
            detail: { rule: ruleId, seq: detailSeq },
            getRetries, setRetries,
          });
          if (resent) anyResent = true;
          if (stillPending) anyPending = true;
        }
      }

    } catch (e) {
      context.log(`Device ${dev.name || dev.id} error: ${e?.message || e}`);
    }
  }

  // --- Action lifecycle (ONLY anyResent matters) ---
  try {
    if (anyResent || anyPending) {
      context.log(anyResent ? "Resends occurred; keeping action to run again." : "Commands still within min-wait window; keeping action.");
    } else {
      // try delete by scope.action.id first
      const firedID = scope?.action?.id;
      let deleted = 0;

      if (firedID) {
        await account.actions.delete(firedID);
        deleted = 1;
        context.log(`No resends; deleted action by scope id: ${firedID}`);
      } else {
        // fallback: delete ALL matching throttle actions by tags
        deleted = await deleteThrottleActionsByTags(account);
        context.log(`No resends; deleted ${deleted} pending throttle action(s) by tags.`);
      }
    }
  } catch (e) {
    context.log("Warn: action cleanup error:", e?.message || e);
  }
});

/* Helper */
async function deleteThrottleActionsByTags(account) {
  let page = 1, deleted = 0;
  while (true) {
    const list = await account.actions.list({
      amount: 50,
      page,
      fields: ["id","active","tags","name"],
    });
    if (!list?.length) break;

    for (const a of list) {
      const has = (k,v) => a.tags?.some(t => t.key === k && String(t.value).toLowerCase() === String(v).toLowerCase());
      const match =
        a.active !== false &&
        has("purpose","one-off") &&
        has("throttle_group","uc511_ack_check") &&
        has("chain","uc511->checker"); // (optional extra guard)

      if (match) {
        try { await account.actions.delete(a.id); deleted++; }
        catch (err) { /* log & continue */ }
      }
    }

    if (list.length < 50) break;
    page++;
  }
  return deleted;
}

/* ================= helpers ================= */
function toEnv(arr){ const o={}; for(const x of (arr||[])) o[x.key]=x.value; return o; }
function clampInt(n, min, max){ n=Math.floor(Number(n)||0); if(n<min)n=min; if(n>max)n=max; return n; }
function byteHex(n){ return clampInt(n,0,255).toString(16).padStart(2,"0").toUpperCase(); }
function toLE24Hex(n){ n=clampInt(n,0,0xFFFFFF); const b0=(n&0xFF).toString(16).padStart(2,"0"); const b1=((n>>8)&0xFF).toString(16).padStart(2,"0"); const b2=((n>>16)&0xFF).toString(16).padStart(2,"0"); return (b0+b1+b2).toUpperCase(); }
function toLE32Hex(n){ n=Number(n)>>>0; const b0=(n&0xFF).toString(16).padStart(2,"0"); const b1=((n>>>8)&0xFF).toString(16).padStart(2,"0"); const b2=((n>>>16)&0xFF).toString(16).padStart(2,"0"); const b3=((n>>>24)&0xFF).toString(16).padStart(2,"0"); return (b0+b1+b2+b3).toUpperCase(); }
function normalizeBool(v){ if(typeof v==="boolean")return v; if(typeof v==="number")return v!==0; const s=String(v).toLowerCase(); return s==="true"||s==="1"||s==="on"; }

function buildValvePayload(x, state){
  if (x === 1) { if (state === "on") return "FF1D2000"; if (state === "off") return "FF1D0000"; }
  if (x === 2) { if (state === "on") return "FF1D2100"; if (state === "off") return "FF1D0100"; }
  return null;
}
function buildValveTimePayload(x, minutes){
  const secsHex = toLE24Hex(Math.max(0, Math.floor(minutes * 60)));
  // Full 11-byte UC51x valve frame (per Milesight official encoder): FF 1D | ctrl | seq(00) |
  // duration(UInt24LE, sec) | valve_pulse(UInt32LE=00000000). ctrl 0xA0/0xA1 = time_rule_enable |
  // open | valve_index (0=valve1, 1=valve2). The 4-byte valve_pulse tail is REQUIRED or the
  // auto-close never applies. Must match UC511_downlink.js's valve_N_time_command encoding.
  if (x === 1) return ("FF1DA000" + secsHex + "00000000").toUpperCase();
  if (x === 2) return ("FF1DA100" + secsHex + "00000000").toUpperCase();
  return null;
}
function buildFF53FromMetadata(ruleId, md){
  const startISO = md.start_iso; if (!startISO) return null;
  const enableFlag = typeof md.enabled === "boolean" ? (md.enabled ? 1 : 0) : 1;
  const startTS = Math.floor(new Date(startISO).getTime() / 1000);
  const endTS = 0;
  const isLoop = md.repeat ? 1 : 0;
  let loopPeriod = 0x01, pA = 0x00, pB = 0x00;

  if (md.repeat) {
    const every = clampInt(md.interval, 1, 65535);
    const unit = String(md.unit || "day").toLowerCase();
    if (unit.startsWith("week")) { loopPeriod = 0x02; pA = 0x7F; pB = clampInt(every, 1, 255); }
    else if (unit.startsWith("month")) { loopPeriod = 0x01; const days = clampInt(every * 30, 1, 65535); pA = days & 0xFF; pB = (days >> 8) & 0xFF; }
    else { loopPeriod = 0x01; const days = clampInt(every, 1, 65535); pA = days & 0xFF; pB = (days >> 8) & 0xFF; }
  }

  const actType = 0x02; const valve = clampInt(md.valve || 1, 1, 3);
  const op = 0x01; const timed = Number(md.duration_min) > 0 ? 1 : 0;
  const durationSec = clampInt((Number(md.duration_min) || 0) * 60, 0, 0xFFFFFFFF);
  const flow = Number(md.pulses) > 0 ? 1 : 0; const pulses = clampInt(Number(md.pulses) || 0, 0xFFFFFFFF);

  const ff53 =
    "FF55" + byteHex(ruleId) + byteHex(enableFlag) + byteHex(0x01) +
    toLE32Hex(startTS) + toLE32Hex(endTS) + byteHex(isLoop) +
    byteHex(loopPeriod) + byteHex(pA) + byteHex(pB) +
    byteHex(actType) + byteHex(valve) + byteHex(op) +
    byteHex(timed) + toLE32Hex(durationSec) + byteHex(flow) + toLE32Hex(pulses);

  return ff53.toUpperCase();
}

// ===== retry bookkeeping with cached params =====
function getRetriesCached(paramsCache, key){
  const p = paramsCache.find(x => x.key === `ack_retry_${key}`);
  return p ? Number(p.value) || 0 : 0;
}
function upsertRetryParam(paramsCache, key, value){
  const existing = paramsCache.find(x => x.key === `ack_retry_${key}`);
  if (existing) {
    existing.value = value;
    return { id: existing.id, key: existing.key, value: existing.value, sent: false };
  }
  const keyFull = `ack_retry_${key}`;
  paramsCache.push({ id: null, key: keyFull, value, sent: false });
  return { id: null, key: keyFull, value, sent: false };
}

// Resend while under cap; notify when exceeded; returns { resent, stillPending }
async function maybeResendWithCap({
  account, context, device, dev, DEFAULT_PORT,
  payloads, retryKey, MAX_RETRIES, ts, minWaitMs, type, detail,
  getRetries, setRetries
}) {
  const waitElapsed = Date.now() - ts;
  if (waitElapsed < minWaitMs) {
    context.log(`[${retryKey}] Waiting ${Math.round(waitElapsed / 1000)}s / ${Math.round(minWaitMs / 1000)}s before first resend.`);
    return { resent: false, stillPending: true };
  }

  const count = getRetries(retryKey);
  const next = count + 1;

  if (next <= MAX_RETRIES) {
    await setRetries(retryKey, next);
    for (const pl of payloads) {
      if (!pl) continue;
      console.log(`Sending downlink to device ${dev.id}: ${pl}`);
      await Utils.sendDownlink(account, dev.id, { payload: pl, port: DEFAULT_PORT, confirmed: false }).catch(() => {});
    }
    return { resent: true, stillPending: false };
  }

  // === MAX RETRIES EXCEEDED: log event + notify MACC_Manager users ===
  const payloadMeta = {
    device_id: dev.id,
    device_name: dev.name || "",
    type,
    detail,
    last_cmd_time: new Date(ts).toISOString(),
    retries: count,
    max_retries: MAX_RETRIES,
  };

  // 1) datapoint for history / dashboards
  await device.sendData([{
    variable: "uc511_ack_failed",
    value: retryKey,
    metadata: payloadMeta,
  }]).catch(() => {});

  // 2) direct notifications (optional — currently logged)
  try {
    const title = "ΔΟΚΙΜΗ - Αποτυχια αποστολης UC511";
    const message =
      `Device: ${payloadMeta.device_name || payloadMeta.device_id}\n` +
      `Command: ${retryKey}\n` +
      `Retries: ${payloadMeta.retries} / ${payloadMeta.max_retries}\n` +
      `Last command time: ${payloadMeta.last_cmd_time}`;

    console.log('Title: ', title, ', message: ', message);
    // await notifyMACCManagers(account, context, { title, message, data: payloadMeta });
  } catch (e) {
    console.log("notify MACC_Manager failed:", e?.message || e);
  }

  // 3) RESET the corresponding ack counter so we don't keep it stuck at cap
  try {
    await setRetries(retryKey, 0);
  } catch (err) {
    // fall back to log; next run will see 0 or recreate the param
    console.log(`Failed to reset ack_retry_${retryKey}:`, err?.message || err);
  }

  return { resent: false, stillPending: false }; // no resend, gave up
}

async function listAllDevicesByTags(account, requiredTags){
  const out = []; let page = 1;
  while (true) {
    const list = await account.devices.list({ amount: 50, page, fields: ["id","name","tags"] });
    if (!list?.length) break;
    for (const d of list) {
      const ok = requiredTags.every(rt => d.tags?.some(t => t.key===rt.key && String(t.value).toLowerCase()===String(rt.value).toLowerCase()));
      if (ok) out.push(d);
    }
    if (list.length < 50) break;
    page += 1;
  }
  return out;
}
async function ensureDeviceToken(account, device_id){
  try { const tokens = await account.devices.tokenList(device_id); if (tokens?.[0]?.token) return tokens[0].token; } catch (_) {}
  const created = await account.devices.tokenCreate(device_id, { name: "uc511_checker_tmp" });
  return created?.token;
}

// List Run users by tag and send TagoRun notifications.
// Works with Account tokens that have permission to manage Run users/notifications.
async function notifyMACCManagers(account, context, { title, message, data }) {
  const managers = await getMACCManagers(account);
  for (let i = 0; i < managers.length; i++) {
    await sendPush(account, context, title, message, managers[i].id);
  }
}
async function sendPush(account, context, titleToSend, messageToSend, userID){
  await account.run.notificationCreate(userID, {
    title: titleToSend,
    message: messageToSend,
    // buttons_autodisable: false,
  }).then(context.log).catch(context.log);
}
// Tries multiple SDK shapes to list Run users and filter by tag.
async function getMACCManagers(account) {
  let users = [];
  let page = 1;
  while (true) {
    const page_users = await account.run.listUsers({ page, fields: ["id", "name", "tags"] });
    if (!page_users.length) break;
    users = users.concat(page_users);
    page++;
  }
  const maccAdmins  = users.filter(user =>
    user.tags?.some(tag => tag.key === "access" && tag.value === "MACC_Manager")
  );
  console.log('MACC administrators: ', maccAdmins);
  return maccAdmins;
}