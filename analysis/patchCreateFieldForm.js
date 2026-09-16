const { Analysis, Account } = require("@tago-io/sdk");

/**
 * patchCreateFieldForm — add the new per-device fields to the "create field" form widget.
 *
 * For each device slot (device1..deviceN) it inserts, right after the QR field:
 *   • deviceN_name  (text)     — friendly alias; blank → the Tago device name is used.
 *   • deviceN_soil  (dropdown) — soil depth for single-sensor lse01 probes: Ρηχό / Βαθύ.
 * and adds those variables to the form's data subscription. Idempotent — existing fields are
 * left untouched; safe to run repeatedly.
 *
 * Defaults target the current create-field form (dashboard 68f1fa2d46b86e0009bef545,
 * widget 68f1fa2d46b86e0009bef546). Override via env if it ever moves.
 *
 * Env:
 *   ACCOUNT_TOKEN   (required)
 *   FORM_DASHBOARD  (optional) default 68f1fa2d46b86e0009bef545
 *   FORM_WIDGET     (optional) default 68f1fa2d46b86e0009bef546
 *   MAX_DEVICES     (optional) default 9
 *   DRY_RUN         (optional) "true" → report only
 */
async function myAnalysis(context) {
  const env = (k) => context.environment.find((e) => e.key === k)?.value;
  const token = env("ACCOUNT_TOKEN");
  if (!token) return console.log("ACCOUNT_TOKEN not found!");
  const account = new Account({ token });

  const dashId = env("FORM_DASHBOARD") || "68f1fa2d46b86e0009bef545";
  const widgetId = env("FORM_WIDGET") || "68f1fa2d46b86e0009bef546";
  const maxDevices = parseInt(env("MAX_DEVICES") || "9", 10);
  const dryRun = String(env("DRY_RUN") || "").toLowerCase() === "true";

  const widget = await account.dashboards.widgets.info(dashId, widgetId);
  const sections = widget?.display?.sections;
  if (!Array.isArray(sections)) return console.log("Form has no display.sections — wrong widget?");

  let added = 0;

  for (let n = 1; n <= maxDevices; n++) {
    const deviceVar = `device${n}`;
    const nameVar = `${deviceVar}_name`;
    const soilVar = `${deviceVar}_soil`;

    // Locate the section + index of the deviceN field.
    let sec = null, idx = -1;
    for (const s of sections) {
      const fields = Array.isArray(s.fields) ? s.fields : [];
      const i = fields.findIndex((f) => f?.data?.variable === deviceVar);
      if (i !== -1) { sec = s; idx = i; break; }
    }
    if (!sec) continue; // this slot doesn't exist in the form
    const fields = sec.fields;
    const src = fields[idx];
    const origin = src?.data?.origin;
    const bucket = src?.data?.bucket;
    const visibility = Array.isArray(src?.visibility_conditions) ? src.visibility_conditions : [];

    const hasName = fields.some((f) => f?.data?.variable === nameVar);
    const hasSoil = fields.some((f) => f?.data?.variable === soilVar);

    const toInsert = [];
    if (!hasName) {
      toInsert.push({
        data: { origin, bucket, variable: nameVar },
        icon: "tag",
        id: `sag-${deviceVar}-name`,
        label: `Όνομα Συσκευής ${n} (προαιρετικό)`,
        show_new_line: true,
        type: "text",
        fixed_value: "",
        visibility_conditions: visibility,
      });
    }
    if (!hasSoil) {
      toInsert.push({
        data: { origin, bucket, variable: soilVar },
        icon: "layer-group",
        id: `sag-${deviceVar}-soil`,
        label: `Βάθος Εδάφους ${n} (μόνο lse01)`,
        show_new_line: true,
        type: "dropdown",
        options: [
          { label: "—", value: "" },
          { label: "Ρηχό (shallow)", value: "shallow" },
          { label: "Βαθύ (deep)", value: "deep" },
        ],
        fixed_value: "",
        visibility_conditions: visibility,
      });
    }
    if (!toInsert.length) continue;

    // Insert right after the QR field (keep name before soil).
    fields.splice(idx + 1, 0, ...toInsert);
    added += toInsert.length;

    // Subscribe the form to the new variables (same data entry that carries deviceN).
    if (Array.isArray(widget.data)) {
      const entry = widget.data.find((d) => Array.isArray(d?.variables) && d.variables.includes(deviceVar)) || widget.data[0];
      if (entry && Array.isArray(entry.variables)) {
        for (const v of [nameVar, soilVar]) if (!entry.variables.includes(v)) entry.variables.push(v);
      }
    }
    console.log(`  ${deviceVar}: +${toInsert.map((f) => f.data.variable).join(", ")}`);
  }

  if (!added) return console.log("Nothing to add — form already has all deviceN_name / deviceN_soil fields.");
  if (dryRun) return console.log(`DRY RUN — would add ${added} field(s).`);

  await account.dashboards.widgets.edit(dashId, widgetId, widget);
  console.log(`Done. Added ${added} field(s) to the create-field form.`);
}

module.exports = new Analysis(myAnalysis);
