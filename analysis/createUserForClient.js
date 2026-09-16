const { Analysis, Account, Resources } = require("@tago-io/sdk");

/**
 * createUserForClient — add a TagoRUN end-user to an EXISTING client, optionally scoped to
 * SPECIFIC fields.
 *
 * Access model (tag-value based): a run user tagged `access={V}` sees dashboards tagged
 * `access={V}`, granted by an AM policy for value V. Two modes:
 *
 *   • No fields selected  → user gets the CLIENT's access value → sees ALL the client's fields
 *     (the client policy already exists; nothing else to do). Original behaviour.
 *   • Fields selected     → user gets a UNIQUE per-user value (their email); we clone an AM
 *     policy for that value and tag ONLY the selected fields' dashboards with `access={email}`.
 *     The user then sees exactly those fields. Granting another field later = just add the
 *     `access={email}` tag to that field's dashboard (no new policy needed).
 *
 * Form scope variables expected:
 *   client        (device field → client device id; filter isClient=yes)
 *   user_name     (text)
 *   user_email    (text/email)
 *   user_password (optional text; defaults to sag1234)
 *   fields        (OPTIONAL device-multiple field → field device ids; filter isField=yes)
 *
 * UI validation feedback: variable "validationUser" on FORM_DEVICE_ID (default clientCreation
 * device 68380d546b891a000ad2ea2e). Distinct from createClient's "validation" → safe to share.
 *
 * Requires ACCOUNT_TOKEN. Optional env: FORM_DEVICE_ID, TEMPLATE_AM_ID, TEMPLATE_EMAIL, TAGO_API.
 */

// AM policy clone config — same template createClient uses. Overridable via env.
function amConfig(context) {
  const get = (k, d) => context.environment.find((e) => e.key === k)?.value || d;
  return {
    TEMPLATE_AM_ID: get("TEMPLATE_AM_ID", "6a425a68ae7393000c3c0edc"),
    TEMPLATE_EMAIL: get("TEMPLATE_EMAIL", "chris-kamp@hotmail.com"),
    TAGO_API: get("TAGO_API", "https://api.us-e1.tago.io"),
  };
}

// Collect selected field device ids from the multi-select `fields` form field. Handles both
// "one item per selection" and "single comma/semicolon-joined value" shapes.
function collectFieldIds(scope) {
  const out = [];
  const seen = new Set();
  for (const item of scope) {
    if (!item || String(item.variable || "").toLowerCase() !== "fields") continue;
    for (const part of String(item.value ?? "").split(/[\s,;]+/)) {
      const id = part.trim();
      if (/^[0-9a-f]{24}$/i.test(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

// Clone the AM template policy for `value` (POST a brand-new policy). Returns { ok, err }.
async function cloneAccessPolicy(context, account_token, value) {
  const { TEMPLATE_AM_ID, TEMPLATE_EMAIL, TAGO_API } = amConfig(context);
  try {
    const tmplRes = await fetch(`${TAGO_API}/am/${TEMPLATE_AM_ID}`, {
      headers: { Authorization: account_token },
    });
    const tmplBody = await tmplRes.json();
    const template = tmplBody?.result ?? tmplBody;
    if (!template || typeof template !== "object" || (!template.permissions && !template.targets)) {
      throw new Error("Template policy not readable: " + JSON.stringify(tmplBody));
    }
    // Deep clone + replace the template email everywhere (policy name, target tag, permission tag).
    const cloned = JSON.parse(JSON.stringify(template).split(TEMPLATE_EMAIL).join(value));
    for (const f of ["id", "am_id", "created_at", "updated_at", "profile"]) delete cloned[f];
    cloned.name = value;
    cloned.active = true;
    const amRes = await fetch(`${TAGO_API}/am`, {
      method: "POST",
      headers: { Authorization: account_token, "Content-Type": "application/json" },
      body: JSON.stringify(cloned),
    });
    const amBody = await amRes.json();
    const ok = !!(amBody && (amBody.status === true || amBody?.result?.am_id));
    return { ok, err: ok ? "" : JSON.stringify(amBody) };
  } catch (e) {
    return { ok: false, err: e && e.message ? e.message : String(e) };
  }
}

// Tag each selected field's dashboard with access={value}. Validates client ownership via the
// field device's clientId_field tag. Returns { granted: [names], skipped: [reasons] }.
async function grantFieldDashboards(account, fieldIds, clientDeviceId, value) {
  const granted = [];
  const skipped = [];
  for (const fid of fieldIds) {
    let fieldInfo;
    try {
      fieldInfo = await account.devices.info(fid);
    } catch {
      skipped.push(`${fid} (δεν βρέθηκε)`);
      continue;
    }
    const label = fieldInfo.name || fid;
    const owner = (fieldInfo.tags || []).find((t) => t.key === "clientId_field")?.value;
    if (clientDeviceId && owner && String(owner) !== String(clientDeviceId)) {
      skipped.push(`${label} (άλλος πελάτης)`);
      continue;
    }
    const dashId = (fieldInfo.tags || []).find((t) => t.key === "fieldId")?.value;
    if (!dashId) {
      skipped.push(`${label} (χωρίς dashboard)`);
      continue;
    }
    try {
      const dash = await account.dashboards.info(dashId);
      const tags = Array.isArray(dash.tags) ? dash.tags : [];
      const already = tags.some((t) => t.key === "access" && String(t.value) === String(value));
      if (!already) {
        tags.push({ key: "access", value });
        await account.dashboards.edit(dashId, { tags });
      }
      granted.push(label);
    } catch (e) {
      skipped.push(`${label} (σφάλμα dashboard)`);
      console.log(`grantFieldDashboards: ${label} failed: ${e && e.message ? e.message : e}`);
    }
  }
  return { granted, skipped };
}

async function myAnalysis(context, scope) {
  const tokenVar = context.environment.find((e) => e.key === "ACCOUNT_TOKEN");
  if (!tokenVar) return console.log("ACCOUNT_TOKEN not found!");
  const account_token = tokenVar.value;
  const account = new Account({ token: account_token });

  // --- UI validation feedback (variable "validationUser" on the clientCreation device) ---
  const FORM_DEVICE_ID =
    context.environment.find((e) => e.key === "FORM_DEVICE_ID")?.value ||
    "68380d546b891a000ad2ea2e"; // clientCreation device (shared with createClient's "validation")
  const sendValidation = async (type, message) => {
    // type = "success" | "danger" | "warning"
    try {
      await Resources.devices.sendDeviceData(FORM_DEVICE_ID, {
        variable: "validationUser",
        value: message,
        metadata: { type },
      });
      console.log(`[validationUser] ${type}: ${message}`);
    } catch (e) {
      console.log(`[validationUser] failed to send (${type}): ${e && e.message ? e.message : e}`);
    }
  };

  const val = (v) => scope.find((i) => i.variable === v)?.value;
  const clientDeviceId = val("client")?.toString();
  const name = val("user_name")?.toString().trim();
  const email = val("user_email")?.toString().trim().toLowerCase();
  const password = (val("user_password")?.toString().trim()) || "sag1234";
  const selectedFieldIds = collectFieldIds(scope);

  if (!clientDeviceId) {
    await sendValidation("danger", "Δεν επιλέχθηκε πελάτης.");
    return console.log("No client selected (scope.client missing).");
  }
  if (!name || !email) {
    await sendValidation("danger", "Το όνομα και το email είναι υποχρεωτικά.");
    return console.log("user_name and user_email are required.");
  }

  // Resolve the client's access value (the tag its policy keys on).
  let clientInfo;
  try {
    clientInfo = await account.devices.info(clientDeviceId);
  } catch (e) {
    await sendValidation("danger", "Δεν βρέθηκε η συσκευή του πελάτη.");
    return console.log(`Cannot read client device ${clientDeviceId}: ${e && e.message}`);
  }
  const clientAccessValue = (clientInfo.tags || []).find((t) => t.key === "access")?.value?.toString().trim();
  if (!clientAccessValue) {
    await sendValidation(
      "danger",
      `Ο πελάτης «${clientInfo.name}» δεν έχει ετικέτα access — αδύνατη η παραχώρηση πρόσβασης.`
    );
    return console.log(`Client ${clientDeviceId} (${clientInfo.name}) has no "access" tag. Aborting.`);
  }

  // Per-field mode → unique per-user access value (email). Otherwise → client value (see all).
  const perField = selectedFieldIds.length > 0;
  const userAccessValue = perField ? email : clientAccessValue;
  console.log(
    `Client: ${clientInfo.name} | user: ${name} <${email}> | perField=${perField} | fields=${selectedFieldIds.length}`
  );

  // Create the run user.
  try {
    const runUser = await account.run.userCreate({
      name,
      email,
      password,
      timezone: "Europe/Athens",
      active: true,
      tags: [
        { key: "access", value: userAccessValue },
        { key: "isUser", value: "yes" },
      ],
    });
    console.log("Run user created:", runUser);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("Run user creation failed (email may already exist):", msg);
    await sendValidation("danger", `Αποτυχία δημιουργίας χρήστη (το email μπορεί να υπάρχει ήδη): ${msg}`);
    return;
  }

  // Client-wide mode: the client policy already grants access to every client dashboard.
  if (!perField) {
    await sendValidation(
      "success",
      `Ο χρήστης «${name}» δημιουργήθηκε και βλέπει όλα τα χωράφια του πελάτη «${clientInfo.name}». Προεπιλεγμένος κωδικός: ${password}`
    );
    return;
  }

  // Per-field mode: clone a policy for the user's value, then tag the selected dashboards.
  const policy = await cloneAccessPolicy(context, account_token, userAccessValue);
  if (!policy.ok) console.log(`[policy] clone failed: ${policy.err}`);
  const { granted, skipped } = await grantFieldDashboards(account, selectedFieldIds, clientDeviceId, userAccessValue);
  console.log(`Granted: [${granted.join(", ")}] | Skipped: [${skipped.join(", ")}] | policyOk=${policy.ok}`);

  if (!granted.length) {
    await sendValidation(
      "danger",
      `Ο χρήστης «${name}» δημιουργήθηκε αλλά δεν παραχωρήθηκε πρόσβαση σε κανένα χωράφι.${
        skipped.length ? " Παραλείφθηκαν: " + skipped.join(", ") + "." : ""
      }`
    );
    return;
  }

  let message = `Ο χρήστης «${name}» δημιουργήθηκε με πρόσβαση στα χωράφια: ${granted.join(", ")}. Προεπιλεγμένος κωδικός: ${password}.`;
  if (!policy.ok) message += " ⚠️ Ελέγξτε την πολιτική πρόσβασης (access policy).";
  if (skipped.length) message += ` Παραλείφθηκαν: ${skipped.join(", ")}.`;
  await sendValidation(policy.ok && !skipped.length ? "success" : "warning", message);
}

module.exports = new Analysis(myAnalysis);
