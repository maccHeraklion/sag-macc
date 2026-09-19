// ════════════════════════════════════════════════════════════════════════════
// SAG · gatewayLiveness — ΖΩΝΤΑΝΙΑ ΤΩΝ GATEWAYS ΑΠΟ ΤΟΥΣ ΙΔΙΟΥΣ ΤΟΥΣ ΑΙΣΘΗΤΗΡΕΣ
// T-GWLIVE-01 (19/9/2026) · εντολή Μιχάλη: «προχώρα με την ανάλυση για τα gateways»
// ════════════════════════════════════════════════════════════════════════════
//
// ΤΟ ΠΡΟΒΛΗΜΑ (μετρημένο 19/9): ο πίνακας «Στόλος Gateways» δείχνει 21 «με δεδομένα»,
// 0 «λειτουργούν», 21 «άγνωστα», όλα «(χωρίς όνομα)». Ο λόγος ΔΕΝ είναι σφάλμα του
// widget: οι 33 συσκευές-gateway της TagoIO **δεν έχουν στείλει ΠΟΤΕ δική τους μέτρηση**.
// Η μόνη τους μεταβλητή είναι `location`, σε 21 από αυτές, όλες με την ΙΔΙΑ σφραγίδα από
// μια μαζική εγγραφή της 6/9. Άρα «άγνωστο» είναι το μόνο δυνατό αποτέλεσμα, εξ ορισμού.
//
// Η ΛΥΣΗ: η πληροφορία ΥΠΑΡΧΕΙ ΗΔΗ, αλλού. Οι αισθητήρες είναι στο δίκτυο **LoRaWAN
// Actility** και το ThingPark στέλνει μαζί με κάθε uplink τον ΔΕΚΤΗ που τον παρέλαβε:
//   lrrid  = ΠΟΙΟ gateway · lrrlat/lrrlon = ΠΟΥ είναι · lrrrssi/lrrsnr = πόσο καλά ακούει
// Μετρημένο 19/9 17:11 σε ΟΛΕΣ τις 220 ενεργές συσκευές: **38 αισθητήρες τα στέλνουν**
// και αναγνωρίζονται **10 διαφορετικά gateways**, τα 8 ζωντανά την τελευταία ώρα.
//
// ΤΟ ΚΛΕΙΔΙ: η ζωντάνια ενός gateway ΔΕΝ χρειάζεται το ίδιο το gateway να μιλήσει.
// Αν ένας αισθητήρας πέρασε από αυτό πριν 10 λεπτά, το gateway ΖΕΙ. Αυτό μετράμε.
//
// ── ΚΟΣΤΟΣ ΑΝΑΓΝΩΣΕΩΝ · ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΜΝΗΜΗ ─────────────────────────────────
// Αφελής υλοποίηση: ρώτα και τις 220 συσκευές κάθε ώρα = 5.280 αναγνώσεις/ημέρα, δηλαδή
// +30 % πάνω στις ~17.000 του πυρήνα. ΔΕΝ το κάνουμε. Κρατάμε ΜΝΗΜΗ ποιες συσκευές
// όντως στέλνουν lrrid και ρωτάμε ΜΟΝΟ αυτές, συν ένα κυλιόμενο παράθυρο για να
// ανακαλύπτουμε καινούριες. ~38 + 25 = ~63 αναγνώσεις ανά εκτέλεση.
// Στην ΠΡΩΤΗ εκτέλεση (χωρίς μνήμη) γίνεται μία πλήρης σάρωση και μετά χτίζεται η μνήμη.
//
// ΓΡΑΦΕΙ: στη συσκευή εποπτείας, μία εγγραφή ανά gateway (`gateway_row`) και μία σύνοψη
// (`gateway_summary`). Με 10 gateways και ωριαία εκτέλεση: **264 εγγραφές/ημέρα.**
// ΔΕΝ γράφει ΤΙΠΟΤΑ σε συσκευές πελατών και ΔΕΝ αγγίζει τον πυρήνα.

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";

const ACTILITY_NET = "5ede22a7427104001c248b08";   // LoRaWAN Actility
const OVERSEER = "6a98855ca06e41000bfae024";       // συσκευή «SAG Εποπτεία»
const DISCOVER_PER_RUN = 25;   // πόσες «άγνωστες» συσκευές δοκιμάζουμε ανά εκτέλεση
const ALIVE_H = 2;             // ώρες: κάτω από αυτό το gateway θεωρείται ΖΩΝΤΑΝΟ
const STALE_H = 24;            // ώρες: κάτω από αυτό «ύποπτο», πάνω «νεκρό»

async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}

/* Η ώρα σε ανθρώπινη μορφή. Ίδια λογική με τον πυρήνα, ώστε οι κάρτες να διαβάζονται όμοια. */
function ageTxt(h) {
  if (!Number.isFinite(h)) return "ποτέ";
  if (h < 1) return "πριν " + Math.round(h * 60) + "′";
  if (h < 48) return "πριν " + Math.round(h) + "ω";
  return "πριν " + Math.round(h / 24) + "ημ";
}

/* Η ΜΝΗΜΗ: ποιες συσκευές ξέρουμε ότι στέλνουν lrrid, και πού σταμάτησε η ανακάλυψη.
   Ζει σε ΜΙΑ μεταβλητή της συσκευής εποπτείας. Αν λείπει ή είναι χαλασμένη, δεν ρίχνει
   την εκτέλεση — απλώς κάνουμε πλήρη σάρωση και την ξαναχτίζουμε. */
async function loadState() {
  try {
    const r = await api(`/device/${OVERSEER}/data?variables[]=gateway_scan_state&qty=1`);
    const p = (r || [])[0];
    const ids = String((p && p.metadata && p.metadata.ids) || "").split(",").filter(Boolean);
    const cursor = Number((p && p.metadata && p.metadata.cursor) || 0) || 0;
    return { ids, cursor };
  } catch (e) { return { ids: [], cursor: 0 }; }
}

(async () => {
  const t0 = Date.now();
  let reads = 0;
  console.log("══ gatewayLiveness T-GWLIVE-01 · " + new Date(t0).toISOString() + " ══");

  // 1 · Ο κατάλογος των συσκευών του δικτύου Actility (1 ανάγνωση ανά σελίδα).
  let devs = [];
  for (let page = 1; page <= 4; page++) {
    const c = await api(`/device?amount=200&page=${page}&fields[]=id&fields[]=name`
      + `&fields[]=last_input&filter[network]=${ACTILITY_NET}`);
    reads++;
    devs = devs.concat(c || []);
    if (!c || c.length < 200) break;
  }
  const live = devs.filter((d) => d.last_input);
  const byId = new Map(live.map((d) => [d.id, d]));

  // 2 · Ποιες ρωτάμε: τις ΓΝΩΣΤΕΣ + ένα κυλιόμενο παράθυρο από τις υπόλοιπες.
  const st = await loadState(); reads++;
  const known = st.ids.filter((id) => byId.has(id));
  const unknown = live.filter((d) => !known.includes(d.id)).map((d) => d.id);
  let cursor = unknown.length ? (st.cursor % unknown.length) : 0;
  const window = [];
  if (!known.length) {
    // ΠΡΩΤΗ ΦΟΡΑ: πλήρης σάρωση. Γίνεται ΜΙΑ φορά και μετά η μνήμη κάνει τη δουλειά.
    window.push(...unknown);
    console.log(`ΜΝΗΜΗ|κενή — γίνεται ΠΛΗΡΗΣ σάρωση ${unknown.length} συσκευών (μία φορά)`);
  } else {
    for (let i = 0; i < Math.min(DISCOVER_PER_RUN, unknown.length); i++) {
      window.push(unknown[(cursor + i) % unknown.length]);
    }
    cursor = unknown.length ? (cursor + window.length) % unknown.length : 0;
    console.log(`ΜΝΗΜΗ|γνωστές=${known.length} · ανακάλυψη=${window.length} από ${unknown.length}`);
  }
  const toAsk = known.concat(window);

  // 3 · Η ίδια η ανάγνωση. Παράλληλα, αλλά με φραγμό ώστε να μη χτυπάμε το API.
  const gw = new Map();
  const stillKnown = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < toAsk.length) {
      const id = toAsk[i++];
      const d = byId.get(id);
      if (!d) continue;
      let rows = [];
      try {
        rows = await api(`/device/${id}/data?variables[]=lrrid&variables[]=lrrlat`
          + `&variables[]=lrrlon&variables[]=lrrrssi&variables[]=lrrsnr&qty=5`);
        reads++;
      } catch (e) { continue; }
      const pick = (v) => (rows || []).find((x) => x.variable === v) || null;
      const idRow = pick("lrrid");
      if (!idRow || idRow.value === undefined || idRow.value === null) continue;
      stillKnown.push(id);
      const key = String(idRow.value);
      const g = gw.get(key) || { n: 0, last: null, lat: null, lon: null, rssi: null, snr: null, devs: [] };
      g.n++;
      if (!g.last || idRow.time > g.last) {
        g.last = idRow.time;
        const rs = pick("lrrrssi"); if (rs) g.rssi = rs.value;
        const sn = pick("lrrsnr"); if (sn) g.snr = sn.value;
      }
      const la = pick("lrrlat"), lo = pick("lrrlon");
      if (la && lo && la.value != null && lo.value != null) { g.lat = la.value; g.lon = lo.value; }
      if (g.devs.length < 5) g.devs.push(d.name);
      gw.set(key, g);
    }
  }));

  // 4 · Οι κάρτες. ΜΙΑ ανά gateway.
  const now = Date.now();
  const out = [];
  let alive = 0, suspect = 0, dead = 0;
  const rows = Array.from(gw.entries()).sort((a, b) => b[1].n - a[1].n);
  for (const [id, g] of rows) {
    const ageH = g.last ? (now - new Date(g.last).getTime()) / 36e5 : Infinity;
    /* T-GWHONEST-01: η λέξη πρέπει να λέει τι ξέρουμε, όχι περισσότερα.
       Έχουμε μαρτυρία μόνο από τους αισθητήρες που στέλνουν lrrid. Αν ο
       μοναδικός μάρτυρας ενός gateway σταματήσει, το gateway φαίνεται νεκρό
       ενώ μπορεί να δουλεύει μια χαρά. «ΔΕΝ ΑΠΑΝΤΑ» ήταν λάθος λέξη. */
    let color = "red", state = "ΧΩΡΙΣ ΠΡΟΣΦΑΤΟ ΜΑΡΤΥΡΑ";
    if (ageH < ALIVE_H) { color = "green"; state = "ΛΕΙΤΟΥΡΓΕΙ"; alive++; }
    else if (ageH < STALE_H) { color = "orange"; state = "ΑΡΑΙΟΣ ΜΑΡΤΥΡΑΣ"; suspect++; }
    else dead++;
    // Το κείμενο λέει ΤΙ ΞΕΡΟΥΜΕ και ΠΩΣ το ξέρουμε — ποτέ σκέτο νούμερο.
    const text = `${state}. Το ξέρουμε επειδή ${g.n} αισθητήρ${g.n === 1 ? "ας πέρασε" : "ες πέρασαν"}`
      + ` από αυτό το gateway, τελευταία φορά ${ageTxt(ageH)}.`
      + (color === "red"
          ? ` ΠΡΟΣΟΧΗ: αυτό ΔΕΝ σημαίνει ότι το gateway είναι χαλασμένο.`
            + ` Σημαίνει ότι οι αισθητήρες που το κατονομάζουν σταμάτησαν να`
            + ` στέλνουν. Το ίδιο το gateway μπορεί να δουλεύει κανονικά.`
          : "")
      + (g.rssi != null ? ` Ισχύς λήψης ${Math.round(Number(g.rssi))} dBm.` : "")
      + (g.lat != null ? ` Θέση ${Number(g.lat).toFixed(5)}, ${Number(g.lon).toFixed(5)}.` : " Θέση άγνωστη.")
      + ` Αισθητήρες: ${g.devs.join(", ")}${g.n > g.devs.length ? " …" : ""}.`
      + " Η ταυτότητα έρχεται από το δίκτυο Actility (πεδίο LRR), όχι από το ίδιο το gateway.";
    const md = { color, sensors: g.n, age_h: Number(ageH.toFixed(2)), state, text };
    if (g.rssi != null) md.rssi = Number(g.rssi);
    if (g.snr != null) md.snr = Number(g.snr);
    if (g.lat != null) md.location = { lat: Number(g.lat), lng: Number(g.lon) };
    out.push({ variable: "gateway_row", value: id, metadata: md });
  }

  const total = rows.length;
  /* T-GWHONEST-01: η σύνοψη μεταφέρει την ΚΑΛΥΨΗ. Χωρίς αυτήν, το «8»
     διαβάζεται ως «8 από όλα μας» αντί για «8 από όσα μπορούμε να δούμε». */
  const sensorsTotal = live.length;
  out.push({ variable: "gateway_summary",
    value: `${alive} με απόδειξη ζωής από ${total} ορατά`,
    metadata: { color: dead > 0 ? "orange" : "green", total, alive, suspect, dead,
      sensors_seen: stillKnown.length, sensors_total: sensorsTotal, reads, ms: Date.now() - t0,
      text: `${alive} gateways έχουν απόδειξη ζωής, ${suspect} με αραιό μάρτυρα,`
        + ` ${dead} χωρίς πρόσφατο μάρτυρα.`
        + ` Η εικόνα χτίζεται από ${stillKnown.length} αισθητήρες από ${sensorsTotal}:`
        + ` μόνο αυτοί αναφέρουν ποιο gateway τους παρέλαβε. Όσα gateways`
        + ` εξυπηρετούν τους υπόλοιπους ΕΙΝΑΙ ΑΟΡΑΤΑ εδώ — ΤΕΧΝΙΚΑ ΑΓΝΩΣΤΑ,`
        + ` ΟΧΙ χαλασμένα. Οι συσκευές-gateway της TagoIO ΔΕΝ στέλνουν δικά τους δεδομένα.` } });

  // 5 · Η μνήμη για την επόμενη φορά.
  out.push({ variable: "gateway_scan_state", value: stillKnown.length,
    metadata: { ids: stillKnown.join(","), cursor,
      text: "Μνήμη σάρωσης: ποιες συσκευές στέλνουν ταυτότητα gateway. Μειώνει τις"
        + " αναγνώσεις από ~220 σε ~" + (stillKnown.length + DISCOVER_PER_RUN) + " ανά εκτέλεση." } });

  await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(out) });

  for (const [id, g] of rows.slice(0, 12)) {
    const ageH = g.last ? (now - new Date(g.last).getTime()) / 36e5 : Infinity;
    console.log(`G|${id}|αισθητήρες=${g.n}|${ageTxt(ageH)}`
      + `|θέση=${g.lat != null ? g.lat + "," + g.lon : "—"}|rssi=${g.rssi}`);
  }
  /* T-GWHONEST-01: και η κονσόλα. Όποιος τη διαβάζει για να καταλάβει τι
     συμβαίνει διάβαζε την ίδια αναλήθεια που βγάλαμε από τον πίνακα.
     Μπαίνει ΚΑΙ η κάλυψη, ώστε το «gateways=N» να μην διαβάζεται ξεκομμένο. */
  console.log(`ΣΥΝΟΨΗ|gateways ορατά=${total}`
    + `|με απόδειξη ζωής=${alive}|αραιός μάρτυρας=${suspect}`
    + `|χωρίς πρόσφατο μάρτυρα=${dead}`
    + `|ΚΑΛΥΨΗ=${stillKnown.length}/${sensorsTotal} αισθητήρες με lrrid`
    + `|αναγνώσεις=${reads}|εγγραφές=${out.length}|ms=${Date.now() - t0}`);
  console.log(`ΣΗΜΑΣΙΑ|το «${total} ορατά» ΔΕΝ είναι ο στόλος. Είναι όσα gateways`
    + ` κατονομάζει έστω ένας αισθητήρας. Τα υπόλοιπα εξυπηρετούν`
    + ` ${sensorsTotal - stillKnown.length} αισθητήρες που ΔΕΝ λένε ποιο — ΑΟΡΑΤΑ, ΟΧΙ νεκρά.`);
  console.log("══ gatewayLiveness · ΤΕΛΟΣ ══");
})().catch((e) => {
  // Η αποτυχία ΔΕΝ πρέπει να είναι σιωπηλή: ο πίνακας θα έδειχνε παλιά δεδομένα χωρίς λόγο.
  console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
  console.log("══ gatewayLiveness · ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
});
