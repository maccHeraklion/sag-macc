const { Analysis, Account, Device } = require("@tago-io/sdk");

/**
 * migrateControllerRuleVars — idempotent migration that subscribes the UC511 automation variables
 * (rules OR plans + mask, auto-detected per controller from hw_version) AND the valve
 * command_feedback echoes on EVERY controller already wired into existing field dashboards.
 *
 * Generation: each controller origin's HW generation is detected from its hw_version (tag → data);
 * v4 → rules, legacy/v3 → plans. Env UC511_HW_GENERATION only sets the fallback when hw_version is
 * unreadable.
 *
 * Background: controllers added via addSensorsToField.js used to get only valve variables, so a
 * 2nd+ controller could be COMMANDED (downlink routes by metadata.target_device) but its irrigation
 * rules never DISPLAYED — the Εντολές κανόνων modal reads rule/plan vars on the selected controller.
 * This migration adds the missing automation vars to each controller origin (identified by having a
 * valve_* variable) in the AgroGenius custom widget(s).
 *
 * Mirror of migrateHistoryVars.js. Selection (most specific wins):
 *   TARGET_DASHBOARD_ID   one dashboard only (best for a first test run).
 *   TARGET_TAG_KEY (+ optional TARGET_TAG_VALUE)   only dashboards carrying that tag.
 *   (neither)             ALL dashboards.
 *
 * Options:
 *   DRY_RUN   "true" → report what WOULD change, write nothing.
 *
 * Requires ACCOUNT_TOKEN.
 */

// UC511 automation family by HW generation (keep in sync with createField.js / addSensorsToField.js).
// v4 = rules (rule*), legacy = plans (plan*); rules_enabled_mask is generation-independent.
function uc511AutomationVars(generation) {
  const legacy = /^(legacy|v3|plan)/i.test(String(generation || ""));
  const family = legacy ? "plan" : "rule";
  const out = ["rules_enabled_mask"];
  for (let n = 1; n <= 16; n++) out.push(`${family}${n}`, `${family}${n}_enable`, `${family}${n}_set`);
  return out;
}

// FE1D downlink-received echo (drives the feedback overlay's step-1 ack). Generation-independent.
// Older controllers were wired without these, so step-1 only resolved on the later valve status.
const UC511_FEEDBACK_VARS = ["valve_1_command_feedback", "valve_2_command_feedback"];

// FALLBACK generation from env (default v4), used only when a controller's hw_version can't be read.
// Per-controller auto-detection takes precedence. Set in myAnalysis.
let DEFAULT_UC511_GEN = "v4";

// The vars this migration ensures on a controller of a given generation.
function ensureVarsFor(generation) {
  return [...uc511AutomationVars(generation), ...UC511_FEEDBACK_VARS];
}

// "v4.1"/"4"/"V3" → major → "v4" (>=4) | "legacy" (<4) | null.
function generationFromHw(raw) {
  const m = String(raw || "").trim().match(/v?\s*(\d+)/i);
  if (!m) return null;
  const major = Number(m[1]);
  return Number.isFinite(major) ? (major >= 4 ? "v4" : "legacy") : null;
}

async function ensureDeviceToken(acc, id) {
  try { const t = await acc.devices.tokenList(id); if (t?.[0]?.token) return t[0].token; } catch (_) { /* ignore */ }
  const c = await acc.devices.tokenCreate(id, { name: "gen_detect_tmp" });
  return c?.token;
}

// Detect a controller's HW generation by id: hw_version TAG → latest hw_version DATA → fallbackGen.
async function detectUc511Generation(acc, id, fallbackGen) {
  const tags = (await acc.devices.info(id).catch(() => ({})))?.tags || [];
  const tagHw = tags.find((t) => String(t.key).toLowerCase() === "hw_version")?.value;
  let gen = generationFromHw(tagHw);
  if (gen) { console.log(`  · UC511 ${id}: hw_version tag "${tagHw}" → ${gen}`); return gen; }
  try {
    const token = await ensureDeviceToken(acc, id);
    const dev = new Device({ token });
    const data = await dev.getData({ variables: "hw_version", qty: 1 });
    const raw = Array.isArray(data) && data[0] ? data[0].value : null;
    gen = generationFromHw(raw);
    if (gen) { console.log(`  · UC511 ${id}: hw_version data "${raw}" → ${gen}`); return gen; }
  } catch (_) { /* ignore */ }
  console.log(`  · UC511 ${id}: hw_version unknown → fallback ${fallbackGen}`);
  return fallbackGen;
}

// An origin is a UC511 controller if it carries any valve_* variable in the widget.
const isValveVar = (v) => /^valve_\d/.test(String(v || ""));

function widgetReadsFieldBundle(widget) {
  if (Array.isArray(widget?.data)) {
    for (const d of widget.data) {
      if (Array.isArray(d?.variables) && d.variables.includes("field_bundle")) return true;
    }
  }
  const dv = widget?.display?.variables;
  if (Array.isArray(dv) && dv.some((v) => v?.variable === "field_bundle")) return true;
  return false;
}

// origin id -> bucket, for every origin that has a valve_* variable subscribed.
function controllerOrigins(widget) {
  const map = new Map();
  if (Array.isArray(widget.data)) {
    for (const d of widget.data) {
      const vars = Array.isArray(d?.variables) ? d.variables : [];
      if (vars.some(isValveVar)) {
        const originId = d.origin || d.bucket;
        if (originId && !map.has(originId)) map.set(originId, d.bucket || originId);
      }
    }
  }
  return map;
}

// Add any missing vars for each controller origin. The automation family (rules vs plans) is
// auto-detected per controller from hw_version (fallback DEFAULT_UC511_GEN). Returns count added.
async function ensureControllerAutomationVars(account, widget) {
  const origins = controllerOrigins(widget);
  if (!origins.size) return 0;

  const data = Array.isArray(widget.data) ? widget.data : [];
  const dataKeys = new Set();
  for (const d of data) {
    for (const v of Array.isArray(d?.variables) ? d.variables : []) dataKeys.add(`${d.origin}::${v}`);
  }

  const dv = widget.display && Array.isArray(widget.display.variables) ? widget.display.variables : null;
  const dvKeys = new Set((dv || []).map((v) => `${v?.origin?.id || v?.origin}::${v?.variable}`));

  let added = 0;
  for (const [originId, bucket] of origins.entries()) {
    const gen = await detectUc511Generation(account, originId, DEFAULT_UC511_GEN);
    const ensureVars = ensureVarsFor(gen);
    const missing = ensureVars.filter((v) => !dataKeys.has(`${originId}::${v}`));
    if (missing.length) {
      // One combined data source keeps the source count low.
      data.push({ qty: 500, bucket, origin: originId, timezone: "Europe/Athens", variables: missing });
      for (const v of missing) dataKeys.add(`${originId}::${v}`);
      added += missing.length;
    }
    if (dv) {
      for (const v of ensureVars) {
        if (!dvKeys.has(`${originId}::${v}`)) {
          dv.push({ variable: v, origin: { id: originId, bucket } });
          dvKeys.add(`${originId}::${v}`);
        }
      }
    }
  }
  if (added) widget.data = data;
  return added;
}

// True if the dashboard carries tagKey (and tagValue, if a value was specified).
function dashboardHasTag(dash, tagKey, tagValue) {
  if (!tagKey) return true;
  const tags = Array.isArray(dash?.tags) ? dash.tags : [];
  return tags.some(
    (t) => t?.key === tagKey && (tagValue == null || tagValue === "" || String(t?.value) === String(tagValue))
  );
}

async function listDashboards(account, tagKey, tagValue) {
  // Fetch ALL dashboards and filter by tag CLIENT-SIDE (the server tag filter is unreliable here).
  const all = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await account.dashboards.list({
      page,
      amount: 100,
      fields: ["id", "name", "tags"],
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return tagKey ? all.filter((d) => dashboardHasTag(d, tagKey, tagValue)) : all;
}

async function migrateDashboard(account, dash, opts, stats) {
  const dashboardId = dash.id;
  let info;
  try {
    info = await account.dashboards.info(dashboardId);
  } catch (e) {
    console.log(`  ! skip ${dashboardId} (${dash.name}): cannot read info — ${e && e.message}`);
    stats.skipped += 1;
    return;
  }
  const name = info?.name || info?.label || dash.name || "(unnamed)";
  const arrangement = Array.isArray(info?.arrangement) ? info.arrangement : [];
  if (!arrangement.length) {
    console.log(`  - skip ${name} [${dashboardId}]: no widgets`);
    stats.skipped += 1;
    return;
  }

  let touchedAny = false;
  let foundWidget = false;
  let foundController = false;
  for (const slot of arrangement) {
    const wid = slot?.widget_id;
    if (!wid) continue;
    let widget;
    try {
      widget = await account.dashboards.widgets.info(dashboardId, wid);
    } catch (e) {
      console.log(`  ! ${dashboardId}/${wid}: cannot read widget — ${e && e.message}`);
      continue;
    }
    if (!widgetReadsFieldBundle(widget)) continue;
    foundWidget = true;
    if (controllerOrigins(widget).size) foundController = true;

    const added = await ensureControllerAutomationVars(account, widget);
    if (!added) continue;

    stats.widgets += 1;
    stats.vars += added;
    if (opts.dryRun) {
      console.log(`  ~ WOULD add ${added} automation var(s) to ${name} [${dashboardId}] widget ${wid}`);
      touchedAny = true;
      continue;
    }
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      console.log(`  + added ${added} automation var(s) to ${name} [${dashboardId}] widget ${wid}`);
      touchedAny = true;
    } catch (e) {
      console.log(`  ! ${dashboardId}/${wid}: edit failed — ${e && e.message}`);
      stats.errors += 1;
    }
  }

  if (touchedAny) {
    stats.dashboards += 1;
  } else if (!foundWidget) {
    console.log(`  - skip ${name} [${dashboardId}]: no AgroGenius (field_bundle) widget`);
    stats.skipped += 1;
  } else if (!foundController) {
    console.log(`  - skip ${name} [${dashboardId}]: no UC511 controller (no valve_* variable)`);
    stats.skipped += 1;
  } else {
    console.log(`  = skip ${name} [${dashboardId}]: automation vars already present`);
    stats.skipped += 1;
  }
}

async function myAnalysis(context) {
  const env = (k) => context.environment.find((e) => e.key === k)?.value;
  const tokenVar = env("ACCOUNT_TOKEN");
  if (!tokenVar) return console.log("ACCOUNT_TOKEN not found!");
  const account = new Account({ token: tokenVar });

  const targetId = env("TARGET_DASHBOARD_ID");
  const tagKey = env("TARGET_TAG_KEY");
  const tagValue = env("TARGET_TAG_VALUE");
  const opts = { dryRun: String(env("DRY_RUN") || "").toLowerCase() === "true" };

  // Automation family is auto-detected per controller from hw_version; env UC511_HW_GENERATION only
  // sets the fallback for controllers whose hw_version can't be read.
  DEFAULT_UC511_GEN = /^(legacy|v3|plan)/i.test(String(env("UC511_HW_GENERATION") || env("HW_GENERATION") || ""))
    ? "legacy"
    : "v4";
  console.log(`UC511 generation fallback: ${DEFAULT_UC511_GEN} (per-controller auto-detect from hw_version)`);

  const scopeDesc = targetId
    ? `dashboard ${targetId}`
    : tagKey
    ? `dashboards tagged ${tagKey}${tagValue ? `=${tagValue}` : " (any value)"}`
    : "ALL dashboards";
  console.log(`migrateControllerRuleVars — ${opts.dryRun ? "DRY RUN" : "LIVE"} | scope: ${scopeDesc}`);

  const stats = { dashboards: 0, widgets: 0, vars: 0, skipped: 0, errors: 0 };
  let dashboards;
  if (targetId) {
    dashboards = [{ id: targetId, name: "(target)" }];
  } else {
    dashboards = await listDashboards(account, tagKey, tagValue);
    console.log(`Found ${dashboards.length} dashboard(s) in scope.`);
  }

  for (const dash of dashboards) {
    await migrateDashboard(account, dash, opts, stats);
  }

  console.log(
    `Done. ${opts.dryRun ? "Would update" : "Updated"} ${stats.dashboards} dashboard(s), ${stats.widgets} widget(s), ${stats.vars} var(s). Skipped: ${stats.skipped}. Errors: ${stats.errors}.`
  );
}

module.exports = new Analysis(myAnalysis);
