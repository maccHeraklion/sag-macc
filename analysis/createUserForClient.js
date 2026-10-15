const { Analysis, Account, Resources } = require("@tago-io/sdk");

/**
 * createUserForClient — add a TagoRUN end-user to an EXISTING client.
 *
 * Pairs with a small form widget: a client dropdown (device field, filter isClient=yes) plus
 * name + email. The client already has an access policy (created by createClient) that grants
 * "run users tagged access={X} → dashboards tagged access={X}". So we simply create the run user
 * with the SAME access tag the client carries — no new policy needed; the user inherits the
 * client's dashboards immediately.
 *
 * Form scope variables expected:
 *   client      (device field → client device id; filter isClient=yes)
 *   user_name   (text)
 *   user_email  (text/email)
 *   user_password (optional text; defaults to sag1234)
 *
 * UI validation feedback:
 *   Writes to variable "validationUser" on the FORM_DEVICE_ID device (default: the
 *   clientCreation device 68380d546b891a000ad2ea2e). This is DISTINCT from createClient's
 *   "validation" variable, so both forms can safely share the clientCreation device — the
 *   validation field filters by variable name, so there is no collision.
 *
 * T-USER-DUP-01 (15/10/2026): before creating, look the email up. createClient already creates
 * the client's own run user, so "email already exists" for that user is not an error — say so
 * in plain words instead of "αποτυχία". An email that belongs to ANOTHER client is reported as such.
 *
 * Requires ACCOUNT_TOKEN. Optional env: FORM_DEVICE_ID (override validation target device).
 */
const TAGO_API = "https://api.us-e1.tago.io";

// Returns { id, name, email, tags } of the run user with exactly this email, null if none,
// or undefined if the lookup itself failed (caller then falls back to plain create).
async function findRunUserByEmail(token, email) {
  try {
    const res = await fetch(`${TAGO_API}/run/users?page=1&amount=20&filter[email]=${encodeURIComponent(email)}`, {
      headers: { Authorization: token },
    });
    const body = await res.json();
    if (!body || body.status !== true || !Array.isArray(body.result)) return undefined;
    const hit = body.result.find((u) => String(u.email || "").trim().toLowerCase() === email);
    if (!hit) return null;
    const one = await (await fetch(`${TAGO_API}/run/users/${hit.id}`, { headers: { Authorization: token } })).json();
    return (one && one.result) || hit;
  } catch (e) {
    console.log(`[lookup] run user lookup failed: ${e && e.message}`);
    return undefined;
  }
}

async function myAnalysis(context, scope) {
  const tokenVar = context.environment.find((e) => e.key === "ACCOUNT_TOKEN");
  if (!tokenVar) return console.log("ACCOUNT_TOKEN not found!");
  const account = new Account({ token: tokenVar.value });

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

  if (!clientDeviceId) {
    await sendValidation("danger", "Δεν επιλέχθηκε πελάτης.");
    return console.log("No client selected (scope.client missing).");
  }
  if (!name || !email) {
    await sendValidation("danger", "Το όνομα και το email είναι υποχρεωτικά.");
    return console.log("user_name and user_email are required.");
  }

  // Resolve the client's access value (the tag the access policy keys on).
  let clientInfo;
  try {
    clientInfo = await account.devices.info(clientDeviceId);
  } catch (e) {
    await sendValidation("danger", "Δεν βρέθηκε η συσκευή του πελάτη.");
    return console.log(`Cannot read client device ${clientDeviceId}: ${e && e.message}`);
  }
  const accessTag = (clientInfo.tags || []).find((t) => t.key === "access");
  const accessValue = accessTag?.value?.toString().trim();
  if (!accessValue) {
    await sendValidation(
      "danger",
      `Ο πελάτης «${clientInfo.name}» δεν έχει ετικέτα access — αδύνατη η παραχώρηση πρόσβασης.`
    );
    return console.log(
      `Client ${clientDeviceId} (${clientInfo.name}) has no "access" tag — cannot grant dashboard access. Aborting.`
    );
  }
  console.log(`Client: ${clientInfo.name} | access=${accessValue} | new user: ${name} <${email}>`);

  // The email may already have a run user (createClient creates the client's own user).
  const existing = await findRunUserByEmail(tokenVar.value, email);
  if (existing) {
    const existingAccess = (existing.tags || []).find((t) => t.key === "access")?.value?.toString().trim();
    console.log(`Run user already exists: ${existing.id} <${email}> access=${existingAccess || "—"}`);
    if (existingAccess === accessValue) {
      await sendValidation(
        "warning",
        `Ο χρήστης ${email} υπάρχει ήδη για τον πελάτη «${clientInfo.name}» (δημιουργείται αυτόματα με την Εισαγωγή Πελάτη) και μπορεί ήδη να συνδεθεί. Δεν έγινε καμία αλλαγή.`
      );
    } else {
      await sendValidation(
        "danger",
        `Το email ${email} χρησιμοποιείται ήδη από τον χρήστη «${existing.name || email}» άλλου πελάτη. Χρησιμοποίησε διαφορετικό email.`
      );
    }
    return;
  }

  // Create the run user with the client's access tag (+ isUser) so the existing policy applies.
  try {
    const runUser = await account.run.userCreate({
      name,
      email,
      password,
      timezone: "Europe/Athens",
      active: true,
      tags: [
        { key: "access", value: accessValue },
        { key: "isUser", value: "yes" },
      ],
    });
    console.log("Run user created:", runUser);
    console.log(`Done — ${email} can now sign in and will see dashboards tagged access=${accessValue}.`);
    await sendValidation(
      "success",
      `Ο χρήστης «${name}» δημιουργήθηκε για τον πελάτη «${clientInfo.name}». Προεπιλεγμένος κωδικός: ${password}`
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("Run user creation failed:", msg);
    await sendValidation("danger", `Αποτυχία δημιουργίας χρήστη: ${msg}`);
  }
}

module.exports = new Analysis(myAnalysis);
