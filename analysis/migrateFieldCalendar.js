const { Analysis, Account } = require("@tago-io/sdk");

/**
 * migrateFieldCalendar — idempotent migration that subscribes existing field dashboards to the
 * `field_calendar` variable on the field device.
 *
 * The cultivation-log ("Καλλιεργητικό Ημερολόγιο") saves via TagoIO autofill, which can only route
 * variables that already exist in the dashboard's data sources — and the widget only DISPLAYS
 * entries it is subscribed to. Dashboards created before field_calendar was wired have neither, so
 * saves are silently dropped and the history stays empty. This analysis adds the `field_calendar`
 * subscription (same field-device origin as `field_bundle`) wherever a widget reads `field_bundle`.
 *
 * Mirror of migrateFieldBundle2.js. Selection (most specific wins):
 *   TARGET_DASHBOARD_ID   one dashboard only (best for a first test run).
 *   TARGET_TAG_KEY (+ optional TARGET_TAG_VALUE)   only dashboards carrying that tag.
 *   (neither)             ALL dashboards.
 *
 * Options:
 *   DRY_RUN   "true" → report what WOULD change, write nothing.
 *
 * Requires ACCOUNT_TOKEN.
 */

// Keep this in sync with ensureFieldCalendarOnWidget / ensureFieldBundleSibling in createField.js.
function ensureFieldCalendarOnWidget(widget) {
  if (!widget || typeof widget !== "object") return false;
  const sibling = "field_calendar";
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

async function listDashboards(account, tagKey, tagValue) {
  const all = [];
  let page = 1;
  const filter = {};
  if (tagKey) filter.tags = [tagValue ? { key: tagKey, value: tagValue } : { key: tagKey }];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await account.dashboards.list({
      page,
      amount: 100,
      fields: ["id", "name", "tags"],
      ...(filter.tags ? { filter } : {}),
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return all;
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
  const arrangement = Array.isArray(info?.arrangement) ? info.arrangement : [];
  if (!arrangement.length) return;

  let touchedAny = false;
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

    const changed = ensureFieldCalendarOnWidget(widget);
    if (!changed) continue;

    touchedAny = true;
    stats.widgets += 1;
    if (opts.dryRun) {
      console.log(`  ~ WOULD add field_calendar to ${dash.name} [${dashboardId}] widget ${wid}`);
      continue;
    }
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      console.log(`  + added field_calendar to ${dash.name} [${dashboardId}] widget ${wid}`);
    } catch (e) {
      console.log(`  ! ${dashboardId}/${wid}: edit failed — ${e && e.message}`);
      stats.errors += 1;
    }
  }
  if (touchedAny) stats.dashboards += 1;
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
  console.log(`migrateFieldCalendar — ${opts.dryRun ? "DRY RUN" : "LIVE"} | scope: ${scopeDesc}`);

  const stats = { dashboards: 0, widgets: 0, errors: 0 };
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
    `Done. ${opts.dryRun ? "Would update" : "Updated"} ${stats.dashboards} dashboard(s), ${stats.widgets} widget(s). Errors: ${stats.errors}.`
  );
}

module.exports = new Analysis(myAnalysis);
