const { Analysis, Account, Resources } = require("@tago-io/sdk");

async function myAnalysis(context, scope) {
   const my_account_token = context.environment.find(env_var => env_var.key === 'ACCOUNT_TOKEN');
   if (my_account_token) {
    account_token = my_account_token.value;
    // You can now use api_key in your script securely
   } else {
     return console.log('Account token not found!');
   }
  account = new Account({ token: account_token });
  
  const name = scope.find((item) => item.variable === "name")?.value.toString();
  const vat = scope.find((item) => item.variable === "vat")?.value.toString();
  const tab = scope.find((item) => item.variable === "tab")?.value.toString();
  const emailRaw = scope.find((item) => item.variable === "email")?.value;
  const email = (emailRaw ?? "").toString().trim().toLowerCase();
  const phone = scope.find((item) => item.variable === "phone")?.value.toString();

  // ── UI feedback ──────────────────────────────────────────────────────────
  // Writes the `validation` variable back to the form's origin device so a "validation" field on
  // the client form shows success/error. To use it: add a field of type "validation" with variable
  // "validation" to the form, and add "validation" to the form's data[].variables.
  const FORM_DEVICE_ID =
    context.environment.find((e) => e.key === "FORM_DEVICE_ID")?.value || "68380d546b891a000ad2ea2e";
  const sendValidation = async (type, message) => {
    try {
      await Resources.devices.sendDeviceData(FORM_DEVICE_ID, {
        variable: "validation",
        value: message,
        metadata: { type }, // "success" | "danger" | "warning"
      });
      console.log(`[validation] sent (${type}) -> ${FORM_DEVICE_ID}: ${message}`);
    } catch (e) {
      console.log("[validation] feedback failed:", e && e.message);
    }
  };

  // The email becomes the run-user login AND the `access` tag on the device + access policy, so it
  // must be a valid address. Fail fast (before creating anything) so a bad value can't leave a
  // half-configured client with a broken access tag.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    await sendValidation("danger", `Μη έγκυρο email: "${emailRaw}". Διόρθωσε το πεδίο E-mail και δοκίμασε ξανά.`);
    return console.log(`createClient aborted — invalid email from form: "${emailRaw}".`);
  }
  if (!name) {
    await sendValidation("danger", "Η επωνυμία πελάτη είναι κενή.");
    return console.log("createClient aborted — the client name is empty.");
  }

  const Custom_HTTPS_Connector = "5f5a8f3351d4db99c40dece5";
  const HTTPS_Network = "5bbd0d144051a50034cd19fb";

  const clientDevice = await account.devices.create({
    name: name,
    connector: Custom_HTTPS_Connector,
    network: HTTPS_Network,
    type: "mutable"
  });
  console.log('clientDevice: ', clientDevice)
  const deviceInfo =  await account.devices.info(clientDevice.device_id);
    
    deviceInfo.tags.push({
        key: 'isClient',
        value: 'yes'
    });
    deviceInfo.tags.push({
        key: 'name',
        value: name
    });
    deviceInfo.tags.push({
        key: 'tab',
        value: tab
    });
    deviceInfo.tags.push({
        key: 'vat',
        value: vat
    });
    deviceInfo.tags.push({
        key: 'email',
        value: email
    });
    deviceInfo.tags.push({
        key: 'phone',
        value: phone
    });
    deviceInfo.tags.push({
        key: 'fields',
        value: '0'
    });
    deviceInfo.tags.push({
        key: 'access',
        value: email
    });
    await account.devices.edit(clientDevice.device_id, {tags: deviceInfo.tags});

    // ── Create the TagoRUN end-user for this client ──────────────────────
    // userCreate takes the user data as its SINGLE argument (the profile is
    // taken from the ACCOUNT_TOKEN's profile). Default password sag1234; tags
    // drive the access policy (access={email}).
    let userOk = false;
    let userErr = "";
    try {
      const runUser = await account.run.userCreate({
        name: name,
        email: email,
        password: "sag1234",
        timezone: "Europe/Athens",
        active: true,
        tags: [
          { key: "access", value: email },
          { key: "isUser", value: "yes" }, // existing users use "yes"; change to "true" if you prefer
        ],
      });
      console.log("Run user created:", runUser);
      userOk = true;
    } catch (err) {
      userErr = (err && err.message) ? err.message : String(err);
      console.error("Run user creation failed (email may already exist):", err);
    }

    // ── Create the per-client access policy by cloning a template policy ──
    // Clones AM policy TEMPLATE_AM_ID and swaps the template email for this
    // client's email everywhere (policy name, target tag, dashboard-permission
    // tag). Result: run users tagged access={email} can view dashboards tagged
    // access={email} + all devices — matching the template's structure exactly.
    let policyOk = false;
    let policyErr = "";
    const TEMPLATE_AM_ID = "6a425a68ae7393000c3c0edc";
    const TEMPLATE_EMAIL = "chris-kamp@hotmail.com";
    const TAGO_API = "https://api.us-e1.tago.io";
    try {
      const tmplRes = await fetch(`${TAGO_API}/am/${TEMPLATE_AM_ID}`, {
        headers: { Authorization: account_token },
      });
      const tmplBody = await tmplRes.json();
      const template = tmplBody?.result ?? tmplBody;
      if (!template || typeof template !== "object" || (!template.permissions && !template.targets)) {
        throw new Error("Template policy not readable: " + JSON.stringify(tmplBody));
      }
      // Deep clone + replace the template email with this client's email.
      const cloned = JSON.parse(JSON.stringify(template).split(TEMPLATE_EMAIL).join(email));
      // Drop server-managed fields so POST creates a brand-new policy.
      for (const f of ["id", "am_id", "created_at", "updated_at", "profile"]) delete cloned[f];
      cloned.name = email;
      cloned.active = true;
      const amRes = await fetch(`${TAGO_API}/am`, {
        method: "POST",
        headers: { Authorization: account_token, "Content-Type": "application/json" },
        body: JSON.stringify(cloned),
      });
      const amBody = await amRes.json();
      console.log("Access policy created:", amBody);
      policyOk = !!(amBody && (amBody.status === true || amBody?.result?.am_id));
    } catch (err) {
      policyErr = (err && err.message) ? err.message : String(err);
      console.error("Access policy creation failed:", err);
    }

    // Admin "Διαχειριστικό" dashboard. SKIPPED by default (the old template id was deleted).
    // To re-enable, set ADMIN_DASHBOARD_TEMPLATE_ID env to a valid template dashboard id.
    const ADMIN_DASHBOARD_TEMPLATE_ID =
      context.environment.find((e) => e.key === "ADMIN_DASHBOARD_TEMPLATE_ID")?.value || "";
    if (ADMIN_DASHBOARD_TEMPLATE_ID) {
    try {
    const result = await account.dashboards.duplicate(ADMIN_DASHBOARD_TEMPLATE_ID, {
          new_label: 'Διαχειριστικό'
        });
    const dashboardInfo = await account.dashboards.info(result.dashboard_id);
    dashboardInfo.tags = dashboardInfo.tags.filter(item => item['key'] !== 'dashboardGroup')
    
    dashboardInfo.tags.push({
        key: 'dashboardGroupGeneral',
        value: 'Commercial',
        metadata: {
        run : false
        }
    })
    dashboardInfo.tags.push({
        key: 'dashboardGroup',
        value: 'MACC',
        metadata: {
        run : false
        }
    })
    dashboardInfo.tags.push({
        key: 'dashboardSubGroup',
        value: tab,
        metadata: {
        run : true
        }
    })
    // Access tag so this admin dashboard is covered by the client's access policy
    // (run user access={email} → dashboards tagged access={email}).
    dashboardInfo.tags.push({
        key: 'access',
        value: email,
        metadata: {
        run : true
        }
    })

    dashboardInfo.group_by = [ 'dashboardGroupGeneral', 'dashboardGroup', 'dashboardSubGroup' ];
    await account.dashboards.edit(result.dashboard_id, dashboardInfo)
    
    for (let idx = 0; idx < dashboardInfo.arrangement.length; idx = idx + 1) {
        const widget_id =  dashboardInfo.arrangement[idx].widget_id
        const widget_info = await account.dashboards.widgets.info(result.dashboard_id, widget_id)
        console.log('widget_info filter: ', widget_info.display.device_filters);
        const clientIdField = widget_info.display.device_filters.find(item => item.tag_key === 'clientId_field');
        clientIdField.tag_value = clientDevice.device_id;
        console.log('widget_info filter: ', widget_info);
        const editWidgetRes = await account.dashboards.widgets.edit(result.dashboard_id, widget_id, widget_info)
    }
    } catch (dashErr) {
      console.error("Admin dashboard creation failed — check ADMIN_DASHBOARD_TEMPLATE_ID:", dashErr);
    }
    } else {
      console.log("Admin dashboard step skipped (set ADMIN_DASHBOARD_TEMPLATE_ID env to enable).");
    }

    // ── Final UI feedback ──────────────────────────────────────────────────
    if (userOk && policyOk) {
      await sendValidation("success", `✅ Ο πελάτης "${name}" δημιουργήθηκε. Χρήστης: ${email} (κωδικός: sag1234).`);
    } else {
      const problems = [];
      if (!userOk) problems.push(`χρήστης (${userErr || "απέτυχε"})`);
      if (!policyOk) problems.push(`πρόσβαση (${policyErr || "απέτυχε"})`);
      await sendValidation("danger", `⚠️ Ο πελάτης "${name}" δημιουργήθηκε μερικώς. Πρόβλημα: ${problems.join(", ")}.`);
    }
}
module.exports = new Analysis(myAnalysis);