// SAG · ΠΟΥ ΕΙΝΑΙ Η ΠΛΗΡΟΦΟΡΙΑ GATEWAY ΑΠΟ ΤΟ ACTILITY — ΜΟΝΟ ΑΝΑΓΝΩΣΗ (19/9/2026)
//
// ΕΡΩΤΗΜΑ ΜΙΧΑΛΗ: «πρέπει να ψάξεις μέσα στο tago να βρεις πού υπάρχει πληροφορία για τους
// Gateways που έρχεται από τον Actility, και να την παίρνεις από εκεί.»
//
// ΤΙ ΞΕΡΟΥΜΕ ΗΔΗ (μετρημένο): οι αισθητήρες είναι στο δίκτυο «LoRaWAN Actility»
// 5ede22a7427104001c248b08 (middleware actility.middleware.tago.io). Το ThingPark στέλνει
// `DevEUI_uplink` που ΠΕΡΙΕΧΕΙ τον δέκτη: Lrrid (ταυτότητα gateway), LrrRSSI, LrrSNR, Lrrs.
// ΑΓΝΩΣΤΟ: αν το middleware/parser της TagoIO τα κρατά ή τα πετά.
//
// ΕΔΩ: για ΚΑΘΕ συσκευή του δικτύου Actility με πρόσφατα δεδομένα, μαζεύουμε ΟΛΑ τα ονόματα
// μεταβλητών, ΟΛΑ τα κλειδιά metadata, και ΟΛΑ τα κλειδιά μέσα σε value που είναι JSON.
// Δεν υποθέτουμε ονόματα — τα μετράμε. Και ξεχωριστά ψάχνουμε ό,τι ΜΟΙΑΖΕΙ με gateway.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ACTILITY_NET = "5ede22a7427104001c248b08";

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}

// Ό,τι ΜΟΙΑΖΕΙ με ίχνος gateway. Ευρύ δίχτυ επίτηδες: καλύτερα ψευδώς θετικό παρά να το χάσω.
const GW_RX = /lrr|gateway|gw_?id|gweui|rssi|snr|esp|spread|^sf$|datarate|dr$|channel|subband|freq|rx_?time|best_?gw|mac|station/i;

(async () => {
  console.log("=== ACTILITY GATEWAY HUNT · " + new Date().toISOString() + " ===");
  let devs = [];
  for (let page = 1; page <= 4; page++) {
    let chunk = [];
    try {
      chunk = await api(`/device?amount=200&page=${page}&fields[]=id&fields[]=name`
        + `&fields[]=last_input&fields[]=network&filter[network]=${ACTILITY_NET}`);
    } catch (e) { console.log("ERR|devices p" + page + ": " + e.message); break; }
    devs = devs.concat(chunk || []);
    if (!chunk || chunk.length < 200) break;
  }
  const live = devs.filter((d) => d.last_input)
    .sort((a, b) => new Date(b.last_input) - new Date(a.last_input));
  console.log(`ΣΥΣΚΕΥΕΣ ACTILITY|σύνολο=${devs.length}|με δεδομένα=${live.length}`);
  if (!live.length) { console.log("=== ΤΕΛΟΣ ==="); return; }
  console.log(`ΝΕΟΤΕΡΗ|${live[0].name}|${live[0].last_input}`);

  const varCount = new Map();      // όνομα μεταβλητής -> πλήθος
  const metaCount = new Map();     // κλειδί metadata -> πλήθος
  const valKeyCount = new Map();   // κλειδί μέσα σε value-JSON -> πλήθος
  const hits = [];                 // δείγματα που μοιάζουν με gateway
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

  const SAMPLE = live.slice(0, 40);
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < SAMPLE.length) {
      const d = SAMPLE[i++];
      let rows = [];
      try { rows = await api(`/device/${d.id}/data?qty=6`); } catch (e) { continue; }
      for (const p of rows || []) {
        bump(varCount, String(p.variable));
        if (GW_RX.test(String(p.variable)) && hits.length < 25) {
          hits.push(`ΜΕΤΑΒΛΗΤΗ|${d.name}|${p.variable}=${JSON.stringify(p.value).slice(0, 70)}`);
        }
        if (p.metadata && typeof p.metadata === "object") {
          for (const k of Object.keys(p.metadata)) {
            bump(metaCount, k);
            if (GW_RX.test(k) && hits.length < 25) {
              hits.push(`METADATA|${d.name}|${p.variable}.${k}=${JSON.stringify(p.metadata[k]).slice(0, 70)}`);
            }
          }
        }
        // Μερικά middleware βάζουν ΟΛΟ το uplink σε ένα string/αντικείμενο value.
        let v = p.value;
        if (typeof v === "string" && v.length > 2 && (v[0] === "{" || v[0] === "[")) {
          try { v = JSON.parse(v); } catch (e) { v = null; }
        }
        if (v && typeof v === "object") {
          for (const k of Object.keys(v)) {
            bump(valKeyCount, k);
            if (GW_RX.test(k) && hits.length < 25) {
              hits.push(`VALUE-JSON|${d.name}|${p.variable}.${k}=${JSON.stringify(v[k]).slice(0, 70)}`);
            }
          }
        }
      }
    }
  }));

  const top = (m, n) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, c]) => k + ":" + c).join(" · ");
  console.log(`ΜΕΤΑΒΛΗΤΕΣ (${varCount.size})|` + top(varCount, 45));
  console.log(`ΚΛΕΙΔΙΑ METADATA (${metaCount.size})|` + (metaCount.size ? top(metaCount, 45) : "ΚΑΝΕΝΑ"));
  console.log(`ΚΛΕΙΔΙΑ ΜΕΣΑ ΣΕ VALUE (${valKeyCount.size})|` + (valKeyCount.size ? top(valKeyCount, 45) : "ΚΑΝΕΝΑ"));
  if (hits.length) { for (const h of hits) console.log(h); }
  else console.log("ΙΧΝΗ GATEWAY|ΚΑΝΕΝΑ — τίποτα στα δεδομένα συσκευής δεν μοιάζει με δέκτη/gateway");
  console.log(`ΣΥΝΟΨΗ|συσκευές που δειγματολήφθηκαν=${SAMPLE.length}|ίχνη=${hits.length}`);
  console.log("=== ΤΕΛΟΣ ===");
})();
