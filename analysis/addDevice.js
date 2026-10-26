
var import_sdk = require("@tago-io/sdk");
const { Analysis, Account, Resources } = require("@tago-io/sdk");

function getNetworkAndConnector(manufacturer, type) {

  const NETWORK_LORAWAN_ACTILITY = '5ede22a7427104001c248b08';

  const UC51xV4_CYRIC_IOT_PARSER = '68e2531b23e14b000afdf5dd';
  const EM300_TH_CYRIC_IOT_PARSER = '655dd4ecda081c000e77e0fc';
  const EM320_TH_CYRIC_IOT_PARSER = '69a84538b7bbe8000917aefc';

  const DRAGINO_LLMS01_LS = '614afaa58c6ce300184c16fc';
  const DRAGINO_LSE01 = '614afa8383f4000019177d85';
  const DRAGINO_LSE02 = '67adaadd576be9000ab220a6';
  const DRAGINO_SE0x = '685bafd351843b000ad23a36';
  const DRAGINO_SPH01 = '69f1ad1236f05f000a1157e0';

  const S2120_CYRIC_IOT_PARSER = '67adaf5b36089a000a16aa5a';

  // T-DEV-MKF-01 (26/10/2026): Makerfabs AgroSense — the form offered makerfabs but there was no mapping, so the
  // analysis crashed («Cannot destructure property 'connector'») and nothing was created. Connector ids = the
  // existing "MACC Parser" connectors used by the 9 makerfabs devices created by hand in 12/2025–01/2026.
  const MAKERFABS_CONNECTORS = {
    aglwpp01: '695a41207ed5b0000a496b79',   // Pipe Pressure
    aglwcd01: '6958f8d9516a0f00095c4b44',   // CO2
    aglwlm01: '695a3b5fdbdd35000a1b82ef',   // Leaf Moisture
    aglwl01: '695a3607d5f1ac000a648ca5',    // Light Intensity
    aglwpw01: '69516a537efb7e000b695547',   // Positioning Water Leak
    aglwsaep01: '695a4c4999d3ce0009ecaccf', // Soil & Air EC-TH Pro
    aglwsm02: '6958e1e67efb7e000b19fb47',   // Soil Monitor
    aglwth01: '6958f33225b926000a49391c',   // Temperature & Humidity
    agvwflc01: '695a563097536d000a0db090',  // Valve Controller & Flow Meter
  };



  switch(manufacturer) {
    case "milesight":
      switch (type) {
        case "uc511":
          return {
            connector: UC51xV4_CYRIC_IOT_PARSER,
            network: NETWORK_LORAWAN_ACTILITY
          };
        case "em320_th":
          return {
            connector: EM320_TH_CYRIC_IOT_PARSER,
            network: NETWORK_LORAWAN_ACTILITY
          };
        case "em300_th":
          return {
            connector: EM300_TH_CYRIC_IOT_PARSER,
            network: NETWORK_LORAWAN_ACTILITY
          };
      }
    case "dragino":
      switch (type) {
        case "lse01":
          return {
            connector: DRAGINO_LSE01,
            network: NETWORK_LORAWAN_ACTILITY
          };
        case "lse02":
          return {
            connector: DRAGINO_LSE02,
            network: NETWORK_LORAWAN_ACTILITY
          };
        case "se0x":
          return {
            connector: DRAGINO_SE0x,
            network: NETWORK_LORAWAN_ACTILITY
          };
        case "sph01":
          return {
            connector: DRAGINO_SPH01,
            network: NETWORK_LORAWAN_ACTILITY
          };
        case "lms01_ls":
          return {
            connector: DRAGINO_LLMS01_LS,
            network: NETWORK_LORAWAN_ACTILITY
          };
      }
      break;
    case "sensecap":
      switch (type) {
        case "s2120":
          return {
            connector: S2120_CYRIC_IOT_PARSER,
            network: NETWORK_LORAWAN_ACTILITY
          };
      }
      break;
    case "makerfabs":
      if (MAKERFABS_CONNECTORS[type]) {
        return {
          connector: MAKERFABS_CONNECTORS[type],
          network: NETWORK_LORAWAN_ACTILITY
        };
      }
      break;
  }
}

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
    case "sensecap":
      eui = eui.substring(0, 16);
      if (!eui.startsWith('2cf7f1')){
        const message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(" για συσκευή sensecap! Το EUI των συσκευών sensecap ξεκινάει με 2cf7f1!");
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
    case "makerfabs":
      // T-DEV-MKF-01: all Makerfabs AgroSense devices in the account have EUI 48e663fffe…
      if (!eui.startsWith('48e663')){
        const message = "Δόθηκε λάθος κωδικός EUI: ".concat(eui).concat(" για συσκευή makerfabs! Το EUI των συσκευών makerfabs ξεκινάει με 48e663!");
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

  let appeui = scope.find((item) => item.variable === "appeui")?.value;
  console.log('appeui: ', appeui, ' received!');

  let appkey = scope.find((item) => item.variable === "appkey")?.value;
  console.log('appkey: ', appkey, ' received!');

  // T-DEV-MKF-01: unknown manufacturer/type used to crash the analysis with no message on the form.
  const networkAndConnector = getNetworkAndConnector(manufacturer, type);
  if (!networkAndConnector) {
    message = "Δεν υποστηρίζεται ακόμα αυτόματη καταχώρηση για ".concat(manufacturer).concat(" / ").concat(type).concat(". Η συσκευή ΔΕΝ δημιουργήθηκε.");
    await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
    return;
  }
  const {connector, network} = networkAndConnector;

  eui = eui.toString().trim().toLowerCase();

  // T-DEV-MKF-01: the QR code on Makerfabs AgroSense sensors is a link (https://www.makerfabs.com/), not the EUI.
  if (eui.includes('http') || eui.includes('www.') || eui.includes('/')) {
    message = "Ο κωδικός QR έδωσε σύνδεσμο (".concat(eui).concat(") και όχι EUI. Πληκτρολογήστε το DevEUI (16 ψηφία) από την ετικέτα της συσκευής.");
    await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
    return;
  }

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

  const euilastfour = eui.substring(eui.length -4);

  const devicename = manufacturer.concat("_").concat(type).concat("_").concat(euilastfour);

  const chunkperiod = "month";
  const chunkretention = 6;
  const devicetype = "immutable";

  const tagsToAdd = [
    {
      'key': 'storage',
      'value': 'yes'
    },
    {
      'key': 'storage'.concat('_').concat(manufacturer).concat('_').concat(type),
      'value': 'yes'
    },
    {
      'key': 'eui',
      'value': eui
    },
    {
      'key': 'appkey',
      'value': appkey
    },
    {
      'key': 'appeui',
      'value': appeui
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
    } else {
      // T-DEV-FAIL-01 (16/10/2026): any other failure used to fall through to the green "Επιτυχή καταχώρηση".
      message = "Αποτυχία καταχώρησης συσκευής ".concat(devicename).concat(": ").concat((error && error.message) || String(error)).concat(". Η συσκευή ΔΕΝ δημιουργήθηκε.");
    }
    await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "red" } });
    return;
  }


  message = "Επιτυχή καταχώρηση συσκευής: ".concat(devicename).concat("!");
  await dashboard_device.sendData({ variable: "validation", value: message, metadata: { color: "green" } });
}

module.exports = new Analysis(myAnalysis);
