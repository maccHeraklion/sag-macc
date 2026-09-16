const { Device, Analysis, Utils, Account } = require('@tago-io/sdk');
/**
 * TagoIO Analysis (Node.js)
 * Sends an SMS using Infobip REST API.
 */
async function sendInfobipSMS(apiKey, { to, text }) {
  const HOST = "rp142p.api.infobip.com";
  const SENDER = "ELAUTPA";

  const url = `https://${HOST}/sms/2/text/advanced`;

  const body = {
    messages: [
      {
        destinations: to.map(phone => ({ to: phone })),
        from: SENDER,
        text: text,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `App ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error("Error occurred while trying to send SMS message.");
    err.status = res.status;
    err.headers = Object.fromEntries(res.headers.entries());
    err.body = data;
    throw err;
  }

  return data;
}

async function myAnalysis(context, scope) {
    var account_token;
    const my_account_token = context.environment.find(env_var => env_var.key === 'ACCOUNT_TOKEN');
    if (my_account_token) {
      account_token = my_account_token.value;
      // You can now use api_key in your script securely
    } else {
      return console.log('Account token not found!');
    }
    const account = new Account({ token: account_token });


    var infobib_api_key;
    const my_infobib_api_key = context.environment.find(env_var => env_var.key === 'INFOBIB_API_KEY');
    if (my_infobib_api_key) {
      infobib_api_key = my_infobib_api_key.value;
      // You can now use api_key in your script securely
    } else {
      return console.log('infobip API key not found!');
    }


  const analysisID = context.analysis_id;
  const info  = await account.analysis.info(analysisID);
  let tags  = info.tags || [];

  // process all incoming records safely
  for (const item of scope) {
    if (item.variable !== "water_leak_status") continue;

    const deviceId = item.device;
    const current = (Number(item.value) || 0).toString();

    // analysis-local tag key
    const tagKey = tags.filter(t => t.key === `last_water_leak_${deviceId}`);
    if (tagKey.length < 1) {
      continue;
    }
    const last = tagKey[0].value;
    tagKey[0].value = current;

    console.log(`Device ${deviceId} | last=${last} current=${current}`);

    // Rising edge detected
    if (last === '0' && current === '1') {
      const deviceName =
        deviceId === "6913605f2dc6ad0011d03abc" ? "ΔΥΤΙΚΗ" : "ΑΝΑΤΟΛΙΚΗ";

      const text = `ΠΡΟΣΟΧΗ! ΠΙΘΑΝΗ ΠΛΗΜΜΥΡΑ ΣΤΗΝ ${deviceName} ΜΕΡΙΑ ΤΟΥ ΚΕΚ! ΛΑΒΕΤΕ ΑΠΑΡΑΙΤΗΤΕΣ ΕΝΕΡΓΕΙΕΣ!`;

      console.log("🚨 Rising edge detected → SEND SMS");
      console.log(text);

      try {
        const apiResponse = await sendInfobipSMS(
          infobib_api_key,
          {
          to: [
            "00306945325959",
            "00306981442871",
            "00306972695248",
            "00306942866860",
            ],
          text: text,
        });

        const bulkId = apiResponse?.bulkId;
        const messageId = apiResponse?.messages?.[0]?.messageId;

        console.log("bulkId:", bulkId);
        console.log("messageId:", messageId);
        console.log("message:", apiResponse?.messages?.[0]);

        // If you want, you can return something for logs:
        return { bulkId, messageId, full: apiResponse };
      } catch (ex) {
        console.log("Error occurred while trying to send SMS message.");
        console.log("Error status:", ex.status);
        console.log("Error headers:", ex.headers);
        console.log("Error body:", ex.body);
        throw ex; // keep failing the analysis (optional)
      }
    }
  }
  await account.analysis.edit(analysisID, { tags });
}

// TagoIO entrypoint:
module.exports = new Analysis(myAnalysis);
