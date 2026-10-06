// Analysis B: uc511_ack_checker — επανάληψη εντολών UC511 που δεν επιβεβαιώθηκαν (T-IRRIG-RETRY-01, 5/10/2026).
//
// Τρέχει κάθε λεπτό όσο υπάρχει η one-off cron action που δημιουργεί το UC511_downlink. Για κάθε ελεγκτή:
//  - Βαλβίδες: κρατά ΜΟΝΟ την τελευταία εντολή ανά βαλβίδα (valve_X_command / valve_X_time_command)· οι παλιότερες
//    έχουν αντικατασταθεί από τον χρήστη και δεν ξαναστέλνονται ποτέ.
//  - Επιβεβαίωση = uplink κατάστασης valve_X ΜΕΤΑ την εντολή με την ΖΗΤΟΥΜΕΝΗ κατάσταση (on/off). Το
//    valve_X_command_feedback (FE1D) είναι μόνο «παρέλαβα την εντολή», όχι κατάσταση βαλβίδας: ΔΕΝ αρκεί
//    (δοκιμή 6/10, 7352: ηχώ off χωρίς ποτέ valve_1=off). Ένα δεύτερο «κλείσε» σε κλειστή βαλβίδα δεν βλάπτει.
//  - Αν δεν επιβεβαιωθεί σε RETRY_EVERY_MIN (3΄), ξαναστέλνεται, και ξανά κάθε 3΄, έως RETRY_MAX_OPEN φορές για
//    άνοιγμα / RETRY_MAX_CLOSE για κλείσιμο (το κλείσιμο επιμένει περισσότερο: είναι η ασφαλής κατεύθυνση).
//  - Μετά το όριο γράφεται ΜΙΑ φορά uc511_ack_failed και η εντολή σταματά (δεν ξαναρχίζει από την αρχή).
//  - Η κατάσταση κάθε εντολής φυλάσσεται σε device param ack_state_<κλειδί> = {"ts","n","last","failed"}· το ts
//    ταυτοποιεί την εντολή, οπότε νέα εντολή ξεκινά αυτόματα από το μηδέν.
//  - Κανόνες (ruleN_set / ruleN_enable): ίδιος ρυθμός· επιβεβαίωση = νέο ruleN (FE53) μετά την εντολή. Το FF55
//    ξαναχτίζεται με τον ΙΔΙΟ encoder με το UC511_downlink (duration_sec, water_pulses, weekday_mask, μήνας HW v4+).

const { Analysis, Account, Device, Utils } = require("@tago-io/sdk");

module.exports = new Analysis(async (context, scope) => {
  const env = toEnv(context.environment);
  if (!env.account_token || env.account_token.length !== 36) {
    return context.log('Missing/invalid "account_token" for checker.');
  }
  const DEFAULT_PORT = Number(env.default_PORT || 85);
  const cfg = retryConfig(env);
  const account = new Account({ token: env.account_token });
  const now = Date.now();

  const devices = await listAllDevicesByTags(account, [
    { key: "manufacturer", value: "milesight" },
    { key: "type", value: "uc511" },
  ]);
  if (!devices.length) return context.log("No uc511 devices found.");

  const sinceISO = new Date(now - cfg.lookbackMs).toISOString();
  let anyPending = false;

  for (const dev of devices) {
    try {
      const token = await ensureDeviceToken(account, dev.id);
      const device = new Device({ token });

      // ΜΙΑ ανάγνωση όλου του παραθύρου (όπως ο παλιός checker) και διαχωρισμός εδώ. Το getData με λίστα
      // μεταβλητών επέστρεφε κενό σιωπηλά (6/10: οι εντολές δεν βρίσκονταν ποτέ) — γι' αυτό ΟΧΙ φίλτρο variables.
      let rows;
      try {
        rows = await device.getData({ start_date: sinceISO, qty: 5000 });
      } catch (e) {
        context.log(`[${dev.name}] getData απέτυχε: ${e?.message || e}`);
        continue;
      }
      const all = (Array.isArray(rows) ? rows : [])
        .map((r) => ({ variable: String(r.variable || ""), value: r.value, metadata: r.metadata || {}, ts: rowTs(r) }));
      const commands = all
        .filter((r) => COMMAND_SET.has(r.variable))
        // Multi-controller safety: autofill broadcasts the widget command into EVERY controller that declares the
        // variable; only the copy whose metadata.target_device is THIS controller is ours to resend.
        .filter((c) => !(c.metadata.target_device && String(c.metadata.target_device) !== String(dev.id)));
      if (!commands.length) continue;
      const acks = all.filter((r) => ACK_SET.has(r.variable));
      context.log(`[${dev.name}] εντολές στο παράθυρο: ${commands.length}, μηνύματα κατάστασης: ${acks.length}`);

      const params = await account.devices.paramList(dev.id);
      const hwMajor = parseHwMajor((dev.tags || []).find((t) => t.key === "hw_version")?.value);

      const jobs = [];
      for (const c of latestValveCommands(commands)) {
        const payload = c.kind === "time" ? buildValveTimePayload(c.valve, c.minutes) : buildValvePayload(c.valve, c.state);
        if (!payload) continue;
        jobs.push({ key: `valve_${c.valve}`, ts: c.ts, open: c.state === "on", acked: isValveAcked(c, acks),
          payloads: [payload], detail: { valve: c.valve, variable: c.variable, value: c.value } });
      }
      for (const r of pendingRuleSequences(commands, acks)) {
        const payloads = [];
        for (const e of r.events) {
          if (e.kind === "set") {
            const ff55 = buildFF55FromMetadata(r.ruleId, e.metadata, hwMajor);
            if (ff55) payloads.push(ff55, `FF53${byteHex(r.ruleId)}`);
          } else {
            payloads.push(`FF4B03${byteHex(r.ruleId)}${byteHex(normalizeBool(e.value) ? 1 : 0)}`, `FF53${byteHex(r.ruleId)}`);
          }
        }
        if (payloads.length) jobs.push({ key: `rule${r.ruleId}`, ts: r.ts, open: true, acked: false, payloads,
          detail: { rule: r.ruleId, events: r.events.map((e) => e.kind) } });
      }

      for (const job of jobs) {
        const paramKey = `ack_state_${job.key}`;
        const param = params.find((p) => p.key === paramKey);
        const d = retryDecision(parseState(param && param.value), job, now, cfg);
        if (d.pending) anyPending = true;
        if (d.action === "send") {
          context.log(`[${dev.name}] ${job.key}: χωρίς επιβεβαίωση ${Math.round((now - job.ts) / 60000)}΄ → επανάληψη ${d.state.n}/${d.max}`);
          for (const pl of job.payloads) {
            await Utils.sendDownlink(account, dev.id, { payload: pl, port: DEFAULT_PORT, confirmed: false })
              .catch((e) => context.log(`downlink ${pl} failed: ${e?.message || e}`));
          }
        } else if (d.action === "give_up") {
          context.log(`[${dev.name}] ${job.key}: ΑΠΟΤΥΧΙΑ μετά από ${d.state.n} επαναλήψεις — σταματά.`);
          await device.sendData([{ variable: "uc511_ack_failed", value: job.key, metadata: {
            device_id: dev.id, device_name: dev.name || "", detail: job.detail,
            last_cmd_time: new Date(job.ts).toISOString(), retries: d.state.n, max_retries: d.max,
          } }]).catch(() => {});
        } else if (d.action === "expired") {
          context.log(`[${dev.name}] ${job.key}: παλιά εντολή (${Math.round((now - job.ts) / 60000)}΄) χωρίς ιστορικό ελέγχου — δεν ξαναστέλνεται.`);
        } else if (d.action === "done" && d.state.n > 0) {
          context.log(`[${dev.name}] ${job.key}: επιβεβαιώθηκε μετά από ${d.state.n} επανάληψη(εις).`);
        }
        if (d.write) {
          const body = { id: param ? param.id : null, key: paramKey, value: JSON.stringify(d.state), sent: false };
          await account.devices.paramSet(dev.id, body).catch((e) => context.log(`param ${paramKey}: ${e?.message || e}`));
        }
      }
    } catch (e) {
      context.log(`Device ${dev.name || dev.id} error: ${e?.message || e}`);
    }
  }

  // --- Action lifecycle: η cron μένει όσο κάποια εντολή περιμένει επιβεβαίωση ή επανάληψη ---
  try {
    if (anyPending) {
      context.log("Εκκρεμούν εντολές· η action μένει.");
    } else {
      const firedID = scope?.action?.id;
      if (firedID) {
        await account.actions.delete(firedID);
        context.log(`Καμία εκκρεμότητα· διαγράφηκε η action ${firedID}.`);
      } else {
        const deleted = await deleteThrottleActionsByTags(account);
        context.log(`Καμία εκκρεμότητα· διαγράφηκαν ${deleted} action(s) με βάση τα tags.`);
      }
    }
  } catch (e) {
    context.log("Warn: action cleanup error:", e?.message || e);
  }
});

const COMMAND_VARS = [1, 2].flatMap((x) => [`valve_${x}_command`, `valve_${x}_time_command`])
  .concat(Array.from({ length: 16 }, (_, i) => [`rule${i + 1}_set`, `rule${i + 1}_enable`]).flat());
const ACK_VARS = [1, 2].flatMap((x) => [`valve_${x}`, `valve_${x}_command_feedback`])
  .concat(Array.from({ length: 16 }, (_, i) => `rule${i + 1}`));
const COMMAND_SET = new Set(COMMAND_VARS);
const ACK_SET = new Set(ACK_VARS);

// ═══ ΛΟΓΙΚΗ ΕΠΑΝΑΛΗΨΗΣ (καθαρές συναρτήσεις· ελέγχονται από test/uc511_retry_check.mjs)
function retryConfig(env) {
  const num = (v, d) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
  const everyMs = num(env.RETRY_EVERY_MIN, 3) * 60000;
  const maxOpen = num(env.RETRY_MAX_OPEN, 10);  // άνοιγμα / κανόνες: 10 × 3΄ = έως 30΄ μετά την εντολή
  const maxClose = num(env.RETRY_MAX_CLOSE, 40); // κλείσιμο: 40 × 3΄ = έως 2 ώρες
  return { everyMs, maxOpen, maxClose, lookbackMs: (Math.max(maxOpen, maxClose) + 2) * everyMs + 10 * 60000 };
}

function latestValveCommands(commands) {
  const byValve = new Map();
  for (const c of commands) {
    const m = c.variable.match(/^valve_(\d+)_(command|time_command)$/i);
    if (!m) continue;
    const valve = Number(m[1]);
    const prev = byValve.get(valve);
    if (!prev || c.ts > prev.ts) byValve.set(valve, { ...c, valve, kind: m[2] === "time_command" ? "time" : "onoff" });
  }
  const out = [];
  for (const c of byValve.values()) {
    if (c.kind === "time") {
      const minutes = Number(c.value) || 0;
      if (minutes <= 0) continue;
      out.push({ ...c, state: "on", minutes });
    } else {
      const state = String(c.value).toLowerCase();
      if (state === "on" || state === "off") out.push({ ...c, state });
    }
  }
  return out;
}

function isValveAcked(c, acks) {
  const status = `valve_${c.valve}`; // μόνο η κατάσταση· η ηχώ _command_feedback δεν είναι επιβεβαίωση εκτέλεσης
  for (const a of acks) {
    if (a.variable !== status || a.ts <= c.ts) continue;
    const v = String(a.value).toLowerCase();
    if (v === c.state) return true;
    // Χρονικό άνοιγμα που πρόλαβε να κλείσει μόνο του: «off» μετά τη λήξη της διάρκειας σημαίνει ότι άνοιξε.
    if (c.kind === "time" && v === "off" && a.ts >= c.ts + c.minutes * 60000 - 30000) return true;
  }
  return false;
}

function pendingRuleSequences(commands, acks) {
  const byRule = new Map();
  for (const c of commands) {
    const m = c.variable.match(/^rule(\d+)_(enable|set)$/i);
    if (!m) continue;
    const ruleId = Number(m[1]);
    if (!byRule.has(ruleId)) byRule.set(ruleId, []);
    byRule.get(ruleId).push({ kind: m[2].toLowerCase(), ts: c.ts, value: c.value, metadata: c.metadata || {} });
  }
  const out = [];
  for (const [ruleId, evts] of byRule) {
    const lastAck = Math.max(-Infinity, ...acks.filter((a) => a.variable === `rule${ruleId}`).map((a) => a.ts));
    const events = evts.filter((e) => e.ts >= lastAck).sort((a, b) => a.ts - b.ts);
    if (events.length) out.push({ ruleId, ts: events[0].ts, events });
  }
  return out;
}

function parseState(raw) {
  try {
    const s = JSON.parse(raw);
    if (s && typeof s === "object" && Number.isFinite(s.ts)) return s;
  } catch (_) { /* παλιά τιμή ή κενό */ }
  return null;
}

// Επιστρέφει { action: "wait"|"send"|"give_up"|"expired"|"done"|"idle", state, write, pending, max }
// Οι επαναλήψεις είναι στα ts + 3΄, ts + 6΄, … (από τη στιγμή της εντολής, χωρίς ολίσθηση).
function retryDecision(prev, job, now, cfg) {
  const max = job.open ? cfg.maxOpen : cfg.maxClose;
  const fresh = !prev || prev.ts !== job.ts;
  const state = fresh ? { ts: job.ts, n: 0, last: job.ts, failed: false } : { ...prev };
  if (job.acked) return { action: "done", state: { ...state, done: true }, write: !fresh && !prev.done, pending: false, max };
  if (state.failed || state.done) return { action: "idle", state, write: false, pending: false, max };
  // Εντολή που ο checker δεν είδε ποτέ στο πρώτο 6λεπτο (πριν το deploy ή όσο δεν έτρεχε): ΔΕΝ ανασταίνεται —
  // ένα «άνοιξε» ώρες μετά θα άνοιγε βαλβίδα απρόσμενα.
  if (fresh && now - job.ts > 2 * cfg.everyMs) return { action: "expired", state: { ...state, failed: true }, write: true, pending: false, max };
  if (now < state.ts + (state.n + 1) * cfg.everyMs) return { action: "wait", state, write: false, pending: true, max };
  if (state.n >= max) return { action: "give_up", state: { ...state, failed: true }, write: true, pending: false, max };
  return { action: "send", state: { ...state, n: state.n + 1, last: now }, write: true, pending: true, max };
}
// ═══ ΤΕΛΟΣ ΛΟΓΙΚΗΣ ΕΠΑΝΑΛΗΨΗΣ

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
function rowTs(r){ return new Date(r.time || r.date || r.created_at).getTime() || 0; }
function clampInt(n, min, max){ n=Math.floor(Number(n)||0); if(n<min)n=min; if(n>max)n=max; return n; }
function byteHex(n){ return clampInt(n,0,255).toString(16).padStart(2,"0").toUpperCase(); }
function toLE24Hex(n){ n=clampInt(n,0,0xFFFFFF); const b0=(n&0xFF).toString(16).padStart(2,"0"); const b1=((n>>8)&0xFF).toString(16).padStart(2,"0"); const b2=((n>>16)&0xFF).toString(16).padStart(2,"0"); return (b0+b1+b2).toUpperCase(); }
function toLE32Hex(n){ n=Number(n)>>>0; const b0=(n&0xFF).toString(16).padStart(2,"0"); const b1=((n>>>8)&0xFF).toString(16).padStart(2,"0"); const b2=((n>>>16)&0xFF).toString(16).padStart(2,"0"); const b3=((n>>>24)&0xFF).toString(16).padStart(2,"0"); return (b0+b1+b2+b3).toUpperCase(); }
function normalizeBool(v){ if(typeof v==="boolean")return v; if(typeof v==="number")return v!==0; const s=String(v).toLowerCase(); return s==="true"||s==="1"||s==="on"; }
function parseHwMajor(raw){ const m=String(raw||"").trim().match(/v?\s*(\d+)/i); if(!m)return null; const n=Number(m[1]); return Number.isFinite(n)?n:null; }

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
// FF55 — ΙΔΙΟΣ encoder με το UC511_downlink.js (RULE SET / UPDATE). Αν αλλάξει εκεί, αλλάζει κι εδώ.
function buildFF55FromMetadata(ruleId, md, hwMajor){
  const startISO = md.start_iso; if (!startISO) return null;
  const startTS = Math.floor(new Date(startISO).getTime() / 1000);
  const enableFlag = typeof md.enabled === "boolean" ? (md.enabled ? 1 : 0) : 1;
  const isLoop = md.repeat ? 1 : 0;
  let loopPeriod = 0x01, pA = 0x00, pB = 0x00;
  if (md.repeat) {
    const every = clampInt(md.interval, 1, 65535);
    const unit = String(md.unit || "day").toLowerCase();
    if (unit.startsWith("week")) {
      loopPeriod = 0x02;
      const wmask = Number(md.weekday_mask) & 0x7f;
      pA = wmask ? wmask : 0x7f;
      pB = clampInt(every, 1, 255);
    } else if (unit.startsWith("month")) {
      if ((hwMajor ?? 0) >= 4) { loopPeriod = 0x00; const months = clampInt(every, 1, 65535); pA = months & 0xff; pB = (months >> 8) & 0xff; }
      else { loopPeriod = 0x01; const days = clampInt(every * 30, 1, 65535); pA = days & 0xff; pB = (days >> 8) & 0xff; }
    } else {
      loopPeriod = 0x01; const days = clampInt(every, 1, 65535); pA = days & 0xff; pB = (days >> 8) & 0xff;
    }
  }
  const valve = clampInt(md.valve || 1, 1, 3);
  const durationSec = clampInt(md.duration_sec != null ? Number(md.duration_sec) : (Number(md.duration_min) || 0) * 60, 0, 0xffffffff);
  const pulses = clampInt(Number(md.water_pulses ?? md.pulses) || 0, 0, 0xffffffff);
  return ("FF55" + byteHex(ruleId) + byteHex(enableFlag) + byteHex(0x01) + toLE32Hex(startTS) + toLE32Hex(0) +
    byteHex(isLoop) + byteHex(loopPeriod) + byteHex(pA) + byteHex(pB) + byteHex(0x02) + byteHex(valve) + byteHex(0x01) +
    byteHex(durationSec > 0 ? 1 : 0) + toLE32Hex(durationSec) + byteHex(pulses > 0 ? 1 : 0) + toLE32Hex(pulses)).toUpperCase();
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
