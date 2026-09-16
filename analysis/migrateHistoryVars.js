const { Analysis, Account } = require("@tago-io/sdk");

/**
 * migrateHistoryVars — idempotent migration that subscribes existing field dashboards to the
 * `history_request` and `history_data` variables on the field device (same origin as field_bundle).
 *
 * These power the plot's on-demand range fetch ("Φόρτωση"): the widget sends `history_request`
 * (autofill routes it → analysis_run = UC511_downlink), the analysis queries the sensor for the
 * requested [start,end] range and writes `history_data` back. Both variables must exist in the
 * dashboard's data sources for the request to route and the response to reach the widget.
 *
 * Mirror of migrateFieldCalendar.js. Selection (most specific wins):
 *   TARGET_DASHBOARD_ID   one dashboard only (best for a first test run).
 *   TARGET_TAG_KEY (+ optional TARGET_TAG_VALUE)   only dashboards carrying that tag.
 *   (neither)             ALL dashboards.
 *
 * Options:
 *   DRY_RUN   "true" → report what WOULD change, write nothing.
 *
 * Requires ACCOUNT_TOKEN.
 */

const HISTORY_VARS = ["history_request", "history_data"];

// Keep this in sync with ensureFieldBundleSibling / ensureHistoryVarsOnWidget in createField.js.
function ensureSibling(widget, sibling) {
  if (!widget || typeof widget !== "object") return false;
  let changed = false;
  if (Array.isArray(widget.data)) {
    for (const d of widget.data) {
      const vars = Array.isArray(d?.variables) ? d.variables : null;
      if (vars && vars.includes("field_bundle") && !vars.includes(sibling)) {
        vars.push(sibling);
        changed = true;
      }
    }
  }
  const dv = widget.display && Array.isArray(widget.display.variables) ? widget.display.variables : null;
  if (dv) {
    for (const src of dv.filter((v) => v?.variable === "field_bundle")) {
      const originId = src?.origin?.id || src?.origin;
      const exists = dv.some(
        (v) => v?.variable === sibling && (v?.origin?.id || v?.origin) === originId
      );
      if (!exists) {
        dv.push({ ...src, variable: sibling });
        changed = true;
      }
    }
  }
  return changed;
}

function ensureHistoryVarsOnWidget(widget) {
  let changed = false;
  for (const sibling of HISTORY_VARS) {
    if (ensureSibling(widget, sibling)) changed = true;
  }
  return changed;
}

// Is this the AgroGenius custom widget (the one that reads field_bundle)?
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

// True if the dashboard carries tagKey (and tagValue, if a value was specified).
function dashboardHasTag(dash, tagKey, tagValue) {
  if (!tagKey) return true;
  const tags = Array.isArray(dash?.tags) ? dash.tags : [];
  return tags.some(
    (t) => t?.key === tagKey && (tagValue == null || tagValue === "" || String(t?.value) === String(tagValue))
  );
}

async function listDashboards(account, tagKey, tagValue) {
  // We fetch ALL dashboards and filter by tag CLIENT-SIDE (tags are in the requested fields). The
  // server-side tag filter has been unreliable on this account — a bad filter can silently return
  // an empty set — so we never depend on it for scoping.
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
  let foundWidget = false; // did any widget read field_bundle (i.e. the AgroGenius widget)?
  let alreadyPresent = false; // AgroGenius widget existed but both vars were already there
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
    if (!widgetReadsFieldBundle(widget)) continue; // only the AgroGenius custom widget
    foundWidget = true;

    const changed = ensureHistoryVarsOnWidget(widget);
    if (!changed) {
      alreadyPresent = true;
      continue;
    }

    stats.widgets += 1;
    if (opts.dryRun) {
      console.log(`  ~ WOULD add history_request/history_data to ${name} [${dashboardId}] widget ${wid}`);
      touchedAny = true;
      continue;
    }
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      console.log(`  + added history_request/history_data to ${name} [${dashboardId}] widget ${wid}`);
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
  } else if (alreadyPresent) {
    console.log(`  = skip ${name} [${dashboardId}]: history vars already present`);
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

  const scopeDesc = targetId
    ? `dashboard ${targetId}`
    : tagKey
    ? `dashboards tagged ${tagKey}${tagValue ? `=${tagValue}` : " (any value)"}`
    : "ALL dashboards";
  console.log(`migrateHistoryVars — ${opts.dryRun ? "DRY RUN" : "LIVE"} | scope: ${scopeDesc}`);

  const stats = { dashboards: 0, widgets: 0, skipped: 0, errors: 0 };
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
    `Done. ${opts.dryRun ? "Would update" : "Updated"} ${stats.dashboards} dashboard(s), ${stats.widgets} widget(s). Skipped: ${stats.skipped}. Errors: ${stats.errors}.`
  );
}

module.exports = new Analysis(myAnalysis);
