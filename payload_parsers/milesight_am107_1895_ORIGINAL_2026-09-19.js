/* ΑΝΤΙΓΡΑΦΟ ΑΣΦΑΛΕΙΑΣ — ο ΑΡΧΙΚΟΣ parser της συσκευής milesight_am107_1895
   (id 6797625e7188ba0009c5bfc5, «ΚΕΚ Γραφείο», δίκτυο Actility, connector
   6357cac8fe605600187df727). Τραβήχτηκε 2026-09-19 21:21 UTC, ΠΡΙΝ το πείραμα
   T-LRRTEST-01. Για επαναφορά: update_device με payload_decoder = base64 ΑΥΤΟΥ
   ΑΚΡΙΒΩΣ του κειμένου.

   ΤΙ ΚΑΝΕΙ: καρφώνει τη θέση του ΚΕΚ πάνω σε co2 / temperature / humidity.
   Αυτή η συμπεριφορά ΠΡΕΠΕΙ να διατηρηθεί αυτούσια σε κάθε παραλλαγή. */
/* This is a default example for payload parser.
** The ignore_vars variable in this code should be used to ignore variables
** from the device that you don't want.
**
** Testing:
** You can do manual tests to this parse by using the Device Emulator. Copy and Paste the following code:
** [{ "variable": "payload", "value": "0109611395" }]
**
*/
// Location of device
var lat = 35.33993817470316;
var lng = 25.162531468774297;

const co2 = payload.find(item => item.variable === 'co2');
const temperature = payload.find(item => item.variable === 'temperature');
const humidity = payload.find(item => item.variable === 'humidity');

if (co2)
  co2.location = {lat,lng};

if (temperature)
  temperature.location = {lat,lng};

if (humidity)
  humidity.location = {lat,lng};


//payload = payload.concat(data).map(x => ({ ...x}));

// You can edit any variable that's being added to your device.
// For example, if you need to convert a variable from Fahrenheit to Celsius, uncomment the following code:
// const temperature = payload.find(x => x.variable === "temperature");
// if (temperature) {
//   temperature.value = (5 / 9) * (temperature.value - 32);
//   temperature.unit = "C";
// }
