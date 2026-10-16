
var import_sdk = require("@tago-io/sdk");
const { Analysis, Account, Resources } = require("@tago-io/sdk");


const MILESIGHT_OUIS = ['24e124', '1cc316', 'c0ba1f'];

async function validateEUIFromManufacturer(manufacturer, eui, dashboard_device) {

  // Each vendor has its own initial bits baesed on their OUI. Reference: https://standards-oui.ieee.org/oui/oui.txt //

  switch(manufacturer) {
    case "dragino":
      if (eui.startsWith('la')) {
        const draginoEUIparts = eui.split(';');
        eui = draginoEUIparts[1];
      }
      if (!eui.startsWith('a84041')){
        const message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(" για συσκευή dragino! Το EUI των συσκευών dragino ξεκινάει με a84041!");
        console.log('Error in validateEUIFromManufacturer with message: ', message);
        await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
        return {
          verified: false,
          eui
        }
      }
      break;
    case "kerlink":
      eui = eui.substring(0, 16);
      if (!eui.startsWith('7276ff') && !eui.startsWith('7076ff')){
        const message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(" για συσκευή kerlink! Το EUI των συσκευών sensecap ξεκινάει με 7276ff ή 7076ff!");
        console.log('Error in validateEUIFromManufacturer with message: ', message);
        await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
        return {
          verified: false,
          eui
        };
      }
      break;
    case "milesight":
      // T-GW-OUI-01 (16/10/2026): Milesight owns three IEEE OUIs — 24:E1:24, 1C:C3:16 and C0:BA:1F (MA-L 2025,
      // newer SG50 gateways, e.g. C0BA1FFFFE054786). Accepting only 24e124 rejected real Milesight hardware.
      if (!MILESIGHT_OUIS.some((p) => eui.startsWith(p))){
        const message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(" για συσκευή milesight! Το EUI των συσκευών milesight ξεκινάει με ").concat(MILESIGHT_OUIS.join(" ή ")).concat("!");
        console.log('Error in validateEUIFromManufacturer with message: ', message);
        await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
        return {
          verified: false,
          eui
        }
      }
    break;
  }
  return {
    verified: true,
    eui
  }
}

async function myAnalysis(context, scope) {

  const Custom_HTTPS_Connector = "5f5a8f3351d4db99c40dece5";
  const HTTPS_Network = "5bbd0d144051a50034cd19fb";

   let message = "";
   const my_account_token = context.environment.find(env_var => env_var.key === 'ACCOUNT_TOKEN');
   if (my_account_token) {
    account_token = my_account_token.value;
    // You can now use api_key in your script securely
   } else {
     return console.log('Account token not found!');
   }
  account = new Account({ token: account_token });

  const dashboard_dev_token = await import_sdk.Utils.getTokenByName(account, scope[0].device);
  const dashboard_device = new import_sdk.Device({ token: dashboard_dev_token });

  const manufacturer = scope.find((item) => item.variable === "manufacturer")?.value;
  console.log('manufacturer: ', manufacturer, ' received!');

  const type = scope.find((item) => item.variable === "type")?.value;
  console.log('Type: ', type, ' received!');

  let eui = scope.find((item) => item.variable === "eui")?.value;
  console.log('EUI: ', eui, ' received!');

  const connector = Custom_HTTPS_Connector;
  const network = HTTPS_Network;

  eui = eui.toString().toLowerCase();

  if (eui.length < 16)
  {
    console.log('Received EUI less than 16 chars (64bits): ', eui)
    message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(". Έπρεπε να είναι 16 ψηφία! Περιέχει: ").concat(eui.length.toString());
    await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
    return;
  }

  const validatedFromManufacturer = await validateEUIFromManufacturer(manufacturer, eui, dashboard_device);

  if (validatedFromManufacturer.verified === false) {
    return;
  }
  eui = validatedFromManufacturer.eui;


  if (eui.length !== 16)
  {
    console.log('Received EUI less than 16 chars (64bits): ', eui)
    message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(". Έπρεπε να είναι 16 ψηφία! Περιέχει: ").concat(eui.length.toString());
    await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
    return;
  }

  const euilastsix = eui.substring(eui.length -6);

  const devicename = manufacturer.concat("_").concat(type).concat("_").concat(euilastsix);

  const chunkperiod = "month";
  const chunkretention = 6;
  const devicetype = "immutable";

  const tagsToAdd = [
    {
      'key': 'storage_gateway',
      'value': 'yes'
    },
    {
      'key': 'is_gateway',
      'value': 'yes'
    },
    {
      'key': 'eui',
      'value': eui
    },
    {
      'key': 'manufacturer',
      'value': manufacturer
    },
    {
      'key': 'type',
      'value': type
    }
  ]

  try {
    await account.devices.create({
      name: devicename,
      serie_number: eui,
      tags: tagsToAdd,
      connector,
      network,
      type: devicetype,
      chunk_period: chunkperiod,
      chunk_retention: chunkretention
    }).then(() => {
      console.log(`Device: ${devicename} successfully created.`);
    });
  } catch (error) {
    console.error(error);
    if (error == 'Serial number already in use') {
      message = "Ήδη καταχωρημένη συσκευή στο σύστημα με κωδικό EUI: ".concat(eui).concat("!");
      await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
    }
    return;
  }


  message = "Επιτυχή καταχώρηση gateway: ".concat(devicename).concat("!");
  await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "green" } });
}

module.exports = new Analysis(myAnalysis);
