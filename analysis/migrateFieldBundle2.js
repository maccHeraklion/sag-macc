const { Analysis, Account } = require("@tago-io/sdk");

/**
 * migrateFieldBundle2 — idempotent migration for the field_bundle split, with optional
 * custom-widget URL refresh.
 *
 * runPerTich writes a second data point `field_bundle_2` (pathogen/pest overflow companion)
 * so many-crop fields no longer exceed the 10kB metadata cap. The custom widget reads BOTH
 * and deep-merges them — but only if each dashboard's widget is SUBSCRIBED to `field_bundle_2`.
 * This analysis adds that subscription wherever a widget already reads `field_bundle`.
 *
 * It can ALSO (optionally) repoint the custom widget's iframe URL to a given build — handy
 * when promoting a staging bundle to production across many dashboards at once.
 *
 * Selection (most specific wins):
 *   TARGET_DASHBOARD_ID   one dashboard only (best for a first test run).
 *   TARGET_TAG_KEY (+ optional TARGET_TAG_VALUE)   only dashboards carrying that tag.
 *                         Tag your dashboards (e.g. key="migrate_bundle2", value="yes") to
 *                         opt them in, then run this. Omit TARGET_TAG_VALUE to match any value.
 *   (neither)             ALL dashboards.
 *
 * Options:
 *   UPDATE_WIDGET_URL     "true" → set the custom widget's iframe URL to WIDGET_URL.
 *   WIDGET_URL            the URL to set (default = current production sagMain build).
 *   DRY_RUN               "true" → report what WOULD change, write nothing.
 *
 * Requires ACCOUNT_TOKEN.
 */

const DEFAULT_WIDGET_URL =
  "https://api.us-e1.tago.io/file/67934c48e8e573000ae5964b/storage/sagMain/index.html";

// Keep this in sync with ensureBundle2OnWidget in createField.js.
function ensureBundle2OnWidget(widget) {
  if (!widget || typeof widget !== "object") return false;
  let changed = false;
  if (Array.isArray(widget.data)) {
    for (const d of widget.data) {
      const vars = Array.isArray(d?.variables) ? d.variables : null;
      if (vars && vars.includes("field_bundle") && !vars.includes("field_bundle_2")) {
        vars.push("field_bundle_2");
        changed = true;
      }
    }
  }
  const dv = widget.display && Array.isArray(widget.display.variables) ? widget.display.variables : null;
  if (dv) {
    for (const src of dv.filter((v) => v?.variable === "field_bundle")) {
      const originId = src?.origin?.id || src?.origin;
      const exists = dv.some(
        (v) => v?.variable === "field_bundle_2" && (v?.origin?.id || v?.origin) === originId
      );
      if (!exists) {
        dv.push({ ...src, variable: "field_bundle_2" });
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

// Point the custom widget's iframe at `url`. Returns true if it changed anything.
function setWidgetUrl(widget, url) {
  if (!widget?.display) return false;
  let changed = false;
  // TagoIO custom (iframe) widgets store the page URL on display.url; some builds mirror it
  // on display.web_page. Update whichever field is already present, and always set display.url.
  if (widget.display.url !== url) {
    widget.display.url = url;
    changed = true;
  }
  if ("web_page" in widget.display && widget.display.web_page !== url) {
    widget.display.web_page = url;
    changed = true;
  }
  return changed;
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

    const reads = widgetReadsFieldBundle(widget);
    let changed = ensureBundle2OnWidget(widget);
    if (opts.updateUrl && reads) {
      if (setWidgetUrl(widget, opts.widgetUrl)) {
        changed = true;
        console.log(`  · URL → ${opts.widgetUrl} on ${dash.name} [${dashboardId}] widget ${wid}`);
      }
    }
    if (!changed) continue;

    touchedAny = true;
    stats.widgets += 1;
    if (opts.dryRun) {
      console.log(`  ~ WOULD update ${dash.name} [${dashboardId}] widget ${wid}`);
      continue;
    }
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      console.log(`  + updated ${dash.name} [${dashboardId}] widget ${wid}`);
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
  const opts = {
    dryRun: String(env("DRY_RUN") || "").toLowerCase() === "true",
    updateUrl: String(env("UPDATE_WIDGET_URL") || "").toLowerCase() === "true",
    widgetUrl: env("WIDGET_URL") || DEFAULT_WIDGET_URL,
  };

  const scopeDesc = targetId
    ? `dashboard ${targetId}`
    : tagKey
    ? `dashboards tagged ${tagKey}${tagValue ? `=${tagValue}` : " (any value)"}`
    : "ALL dashboards";
  console.log(
    `migrateFieldBundle2 — ${opts.dryRun ? "DRY RUN" : "LIVE"} | scope: ${scopeDesc} | url update: ${
      opts.updateUrl ? opts.widgetUrl : "off"
    }`
  );

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
