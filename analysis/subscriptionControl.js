const { Analysis, Resources, Account } = require("@tago-io/sdk");
var import_sdk = require("@tago-io/sdk");

const NOTIFY_DAYS = new Set([30, 20, 10, 5, 4, 3, 2, 1, 0]);

async function sendPush(account, userId, title, message) {
  await account.run.notificationCreate(userId, { title, message }).catch((err) => {
    console.log(`Failed to notify user ${userId}: ${err.message}`);
  });
}

/**
 * Compute the difference in whole days between a subscription end date and today,
 * comparing at day-level precision (UTC) so the result is stable across the day.
 * Returns a positive number for days remaining, 0 for expiry day, negative for expired.
 */
function daysUntil(dateStr) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMs = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const subMs = Date.parse(new Date(String(dateStr)).toISOString().slice(0, 10) + "T00:00:00Z");
  if (isNaN(todayMs) || isNaN(subMs)) return null;
  return Math.round((subMs - todayMs) / msPerDay);
}

async function fetchAllUsers(account) {
  let users = [];
  let page = 1;
  while (true) {
    const batch = await account.run.listUsers({ page, fields: ["id", "name", "email", "tags"] });
    if (!Array.isArray(batch) || !batch.length) break;
    users = users.concat(batch);
    page++;
  }
  return users;
}

async function fetchAllFieldDevices() {
  const devices = [];
  let page = 1;
  while (true) {
    const batch = await Resources.devices.list({
      page,
      amount: 100,
      fields: ["id", "name", "tags"],
      filter: { tags: [{ key: "isField", value: "yes" }] },
    });
    if (!Array.isArray(batch) || !batch.length) break;
    devices.push(...batch);
    page++;
  }
  return devices;
}

async function startAnalysis(context) {
  const tokenEnv = context.environment.find((e) => e.key === "ACCOUNT_TOKEN");
  if (!tokenEnv) return context.log("ACCOUNT_TOKEN not found");
  const account = new Account({ token: tokenEnv.value });

  const [fieldDevices, allUsers] = await Promise.all([
    fetchAllFieldDevices(),
    fetchAllUsers(account),
  ]);

  context.log(`Found ${fieldDevices.length} field device(s), ${allUsers.length} user(s)`);

  const adminUsers = allUsers.filter((u) =>
    u.tags?.some((t) => t.key === "access" && String(t.value).startsWith("MACC_Manager"))
  );

  for (const device of fieldDevices) {
    const fieldName =
      device.tags?.find((t) => t.key === "name")?.value || device.name;

    
    const dev_to_send_meas_token = await import_sdk.Utils.getTokenByName(account, device.id);
    const dev_to_get_val = new import_sdk.Device({ token: dev_to_send_meas_token });

    // Read the subscription_until variable
    let dataArr;
    try {
      dataArr = await dev_to_get_val.getData({
        variables: ["subscription_until"],
        qty: 1,
      });
    } catch (err) {
      context.log(`Could not read subscription_until for "${fieldName}" (${device.id}): ${err.message}`);
      continue;
    }

    const entry = Array.isArray(dataArr) ? dataArr[0] : null;
    const subscriptionEndTag = device.tags?.find((t) => t.key === "subscriptionEnd")?.value || null;
    let subscriptionUntilValue = entry?.value ? String(entry.value) : null;

    // Sync subscription_until variable from the device tag if missing or out of date
    if (subscriptionEndTag && subscriptionUntilValue !== subscriptionEndTag) {
      context.log(
        `"${fieldName}": subscription_until mismatch (variable="${subscriptionUntilValue}", tag="${subscriptionEndTag}") — updating variable`
      );
      try {
        await dev_to_get_val.sendData([{ variable: "subscription_until", value: subscriptionEndTag }]);
        subscriptionUntilValue = subscriptionEndTag;
      } catch (err) {
        context.log(`Failed to update subscription_until for "${fieldName}": ${err.message}`);
      }
    }

    if (!subscriptionUntilValue) {
      context.log(`No subscription date available for "${fieldName}" — skipping`);
      continue;
    }

    const days = daysUntil(subscriptionUntilValue);
    if (days === null) {
      context.log(`Invalid subscription date for "${fieldName}": ${subscriptionUntilValue}`);
      continue;
    }

    context.log(`"${fieldName}": subscription_until=${subscriptionUntilValue}, daysLeft=${days}`);

    if (!NOTIFY_DAYS.has(days)) continue;

    // Find users associated with this field via matching access tags
    const fieldAccessValues = new Set(
      (device.tags || []).filter((t) => t.key === "access").map((t) => String(t.value))
    );
    const fieldUsers = allUsers.filter((u) =>
      u.tags?.some((t) => t.key === "access" && fieldAccessValues.has(String(t.value)))
    );

    const daysLabel = days === 1 ? "1 μέρα" : `${days} μέρες`;

    const userTitle = "Λήξη Συνδρομής";
    const userMessage = `Προσοχή η συνδρομή σας για την εγκατάσταση ${fieldName} θα λήξει σε ${daysLabel}. ` +
      `Παρακαλούμε να επικοινωνήσετε μαζί μας.`;

    const adminTitle = "Λήξη Συνδρομής Εγκατάστασης";
    const adminMessage = `Εγκατάσταση ${fieldName}: Η συνδρομή λήγει σε ${daysLabel}.`;

    // await Promise.all([
    //   ...fieldUsers.map((u) => sendPush(account, u.id, userTitle, userMessage)),
    //   ...adminUsers.map((u) => sendPush(account, u.id, adminTitle, adminMessage)),
    // ]);

    context.log(
      `Notifications sent for "${fieldName}": ${fieldUsers.length} field user(s), ${adminUsers.length} admin(s)`
    );
  }
}

Analysis.use(startAnalysis);
