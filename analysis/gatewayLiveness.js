// ════════════════════════════════════════════════════════════════════════════
// SAG · gatewayLiveness — ΖΩΝΤΑΝΙΑ ΤΩΝ GATEWAYS ΑΠΟ ΤΟΥΣ ΙΔΙΟΥΣ ΤΟΥΣ ΑΙΣΘΗΤΗΡΕΣ
// T-GWLIVE-01 (19/9/2026) · εντολή Μιχάλη: «προχώρα με την ανάλυση για τα gateways»
// + T-GWMAP-02 (19/10/2026): ζωντανός κατάλογος `gateway_roster` (repo commit d9c3af1)
// + T-GWID-02 (19/10/2026): μνήμη θέσης ανά gateway · T-GWID-03: θέση από το `location` της εγγραφής lrrid
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
// + T-GWFIELDS-01 (7/11/2026): κάθε κάρτα πύλης λέει ΠΟΙΟΥΣ ΑΓΡΟΥΣ/αισθητήρες ακούει (`metadata.fields`) και γράφεται
//   ΜΙΑ εγγραφή `tech_tasks` (εργασίες τεχνικού: σίγηση αγρού, λάθος αγρός, σιωπηλά όργανα) — +24 εγγραφές/ημέρα, +1 ανάγνωση/ώρα.
// + T-GWMAP-04 (7/11/2026): μία γραμμή `map_field` ανά εγγραφή αγρού για τον ενιαίο χάρτη (sag-map.html): +65 εγγραφές/ώρα
//   = 1.560/ημέρα, 0 νέες αναγνώσεις δεδομένων, +1 POST ανά εκτέλεση.
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

/* T-GWMAP-02 (19/10) · ΖΩΝΤΑΝΟΣ ΚΑΤΑΛΟΓΟΣ ΤΟΥ ΣΤΟΛΟΥ.
   Ο χάρτης κρατούσε ΠΑΓΩΜΕΝΟ αντίγραφο της 19/9 (παράμετρος widget `fleet_roster`): 33 gateways ενώ υπάρχουν 35,
   χωρίς τις αλλαγές θέσης. Η θέση ζει στην ετικέτα `coordinates` («πλάτος, μήκος») και το όνομα τοποθεσίας στην
   `comment` κάθε συσκευής με `is_gateway=yes`. Η TagoIO δέχεται ΔΙΠΛΑ κλειδιά ετικετών (Αγχίαλος 19/9: δύο
   `coordinates`, η μία στο Ιόνιο) — γι' αυτό κρατάμε μόνο τιμές μέσα στην Ελλάδα και, αν μένουν δύο διαφορετικές,
   σημαδεύουμε ΑΣΥΜΦΩΝΙΑ αντί να διαλέξουμε σιωπηλά. Μία ανάγνωση ανά εκτέλεση. */
const GR_BOX = { latMin: 33.5, latMax: 42.5, lngMin: 19, lngMax: 30.5 };
function rosterEntry(d) {
  const tags = Array.isArray(d && d.tags) ? d.tags : [];
  const val = (k) => { const t = tags.find((x) => x && x.key === k); return t ? String(t.value || "").trim() : ""; };
  const seen = [];
  for (const t of tags) {
    if (!t || t.key !== "coordinates") continue;
    const m = String(t.value || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) continue;
    const lat = Number(m[1]), lng = Number(m[2]);
    if (!(lat >= GR_BOX.latMin && lat <= GR_BOX.latMax && lng >= GR_BOX.lngMin && lng <= GR_BOX.lngMax)) continue;
    if (!seen.some((p) => Math.abs(p.lat - lat) < 1e-5 && Math.abs(p.lng - lng) < 1e-5)) seen.push({ lat, lng });
  }
  const e = { id: d.id, name: val("comment") || d.name, dev: d.name };
  if (seen.length) { e.lat = Number(seen[0].lat.toFixed(6)); e.lng = Number(seen[0].lng.toFixed(6)); }
  if (seen.length > 1) e.conflict = 1;
  if (val("deployedGateway") !== "yes") e.storage = true;
  // T-GWMAP-10: δηλωμένη πύλη χωρίς πακέτο στο ThingPark. Μόνο πλήρης ημερομηνία, αλλιώς αγνοείται.
  const off = val("network_last_uplink"), lrr = val("network_lrrid");
  if (/^\d{4}-\d{2}-\d{2}$/.test(off)) e.off = off;
  if (lrr) e.lrr = lrr;
  return e;
}

/* T-GWID-03 (19/10): ΘΕΣΗ ΑΠΟ ΤΗΝ ΕΓΓΡΑΦΗ lrrid. Οι parsers SE02/SE0X/SE01 βάζουν τη θέση του gateway ως `location`
   ΠΑΝΩ στην εγγραφή lrrid (0 επιπλέον εγγραφές) αντί για χωριστές lrrlat/lrrlon. Η TagoIO τη γυρνά είτε {lat,lng}
   είτε GeoJSON Point· η σειρά του πίνακα κρίνεται από το κουτί της Ελλάδας (πλάτος 33,5–42,5 δεν τέμνει μήκος 19–30,5). */
function locOf(row) {
  const l = row && row.location;
  if (!l) return null;
  const inGR = (lat, lng) => lat >= GR_BOX.latMin && lat <= GR_BOX.latMax && lng >= GR_BOX.lngMin && lng <= GR_BOX.lngMax;
  if (l.lat != null && l.lng != null) {
    const la = Number(l.lat), lo = Number(l.lng);
    return inGR(la, lo) ? { lat: la, lng: lo } : null;
  }
  const c = Array.isArray(l.coordinates) ? l.coordinates.map(Number) : null;
  if (!c || c.length < 2) return null;
  if (inGR(c[1], c[0])) return { lat: c[1], lng: c[0] };
  if (inGR(c[0], c[1])) return { lat: c[0], lng: c[1] };
  return null;
}

// ═══ T-GWFIELDS-01 (7/11/2026) · ΑΓΡΟΙ ΑΝΑ ΠΥΛΗ + ΕΡΓΑΣΙΕΣ ΤΕΧΝΙΚΟΥ (ΑΡΧΗ) ═══════════════════════════════════
// ΤΟ ΚΕΝΟ: ο χάρτης έλεγε «8 αισθητήρες πέρασαν» από μια πύλη, αλλά ΟΧΙ ποιοι και ποιων αγρών. Ο τεχνικός
// που πάει στην πύλη δεν ξέρει ποιους πελάτες επηρεάζει· ο πίνακας στόλου κρίνει ΑΝΑ ΑΓΡΟ και δεν μπορεί να πει
// «ολόκληρο το χωριό σίγησε μαζί, φταίει η πύλη». Όλα τα παρακάτω βγαίνουν από δεδομένα που ΗΔΗ έχουμε στη μνήμη
// (κατάλογος συσκευών με last_input, ετικέτες αγρών, lrrid ανά αισθητήρα) — ΜΙΑ επιπλέον ανάγνωση (οι αγροί).
// Το μπλοκ είναι αυτοτελές (χωρίς API) ώστε να δοκιμάζεται εκτός TagoIO: scratchpad/gwfields/test_tasks.mjs.
const SILENT_H = 48;           // ώρες: πάνω από αυτό ένα όργανο «σιωπά» (ίδιο όριο με τον πίνακα στόλου)
const SITE_QUIET_H = 6;        // ώρες: όριο για να μετρήσει μια συσκευή σε «σίγηση αγρού»
const SITE_WINDOW_MIN = 20;    // λεπτά: συσκευές που σίγησαν μέσα σε αυτό το παράθυρο = κοινό αίτιο (πύλη/ρεύμα)
const WRONG_FIELD_KM = 15;     // km: πύλη πιο μακριά από αυτό από τον αγρό = λάθος ανάθεση ή λάθος συντεταγμένες
const TASK_MAX = 60;           // μέγιστο πλήθος εργασιών σε μία εγγραφή
const TASK_JSON_MAX = 6000;    // μέγιστο μήκος metadata (χαρακτήρες)
const VALVE_RE = /uc5|ws558/i; // βάνες/ελεγκτές: άλλος ιδιοκτήτης — μόνο σημείωση, όχι εργασία

function ageHours(iso, ref) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? ((ref || Date.now()) - t) / 36e5 : Infinity;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function truncName(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function daysTxt(h) { return Number.isFinite(h) ? Math.round(h / 24) + " ημ" : "ποτέ"; }

/* Από τις εγγραφές-αγρούς (isField=yes) στο «ποιος αγρός έχει ποια συσκευή». Η ετικέτα `devices` είναι JSON
   {όνομα: id} (createField) — αν κάποιος την έχει χαλάσει με το χέρι, μαζεύουμε όσα 24-hex ids βρούμε μέσα της. */
function buildFieldOf(fields) {
  const fieldOf = new Map();
  for (const f of fields || []) {
    const tags = Array.isArray(f && f.tags) ? f.tags : [];
    const tag = (k) => { const t = tags.find((x) => x && x.key === k); return t ? String(t.value || "").trim() : ""; };
    const fieldName = tag("name") || f.name || String(f.id);
    let coords = null;
    const cm = tag("coordinates").match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (cm) coords = { lat: Number(cm[1]), lon: Number(cm[2]) };
    let ids = [];
    const raw = tag("devices");
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") ids = Object.values(o).map(String);
    } catch (e) { ids = raw.match(/[0-9a-f]{24}/g) || []; }
    for (const id of ids) {
      if (!/^[0-9a-f]{24}$/.test(id)) continue;
      const arr = fieldOf.get(id) || [];
      if (!arr.some((x) => x.fieldId === f.id)) arr.push({ fieldName, fieldId: f.id, coords });
      fieldOf.set(id, arr);
    }
  }
  return fieldOf;
}

/* Οι ΕΡΓΑΣΙΕΣ ΤΕΧΝΙΚΟΥ. Διαγνώσεις σε επίπεδο τοποθεσίας που ο πίνακας ανά αγρό ΔΕΝ μπορεί να εκφράσει:
     site_silence   : ≥2 συσκευές του ίδιου αγρού σίγησαν μέσα σε 20′ → κοινό αίτιο, ύποπτη η πύλη/ρεύμα, ΟΧΙ οι αισθητήρες
     wrong_field    : ο αισθητήρας ακούγεται από πύλη >15 km από τις συντεταγμένες του αγρού του → λάθος ανάθεση ή θέση
     silent_in_field: όργανα που σιωπούν >48 ω, ΜΙΑ εργασία ανά αγρό· βάνες/ελεγκτές μόνο ως σημείωση
   Δεν διαβάζει τίποτα: δουλεύει με ό,τι έχει ήδη φορτωθεί. Επιστρέφει { tasks, counts }. */
function computeTechTasks({ live, fieldOf, gw, pos, now }) {
  now = now || Date.now();
  const tasks = [];
  const counts = { site_silence: 0, wrong_field: 0, silent_in_field: 0 };
  const byField = new Map();   // fieldName -> [{ name, id, h, last }]
  for (const d of live || []) {
    const fs = fieldOf.get(d.id) || [];
    const h = ageHours(d.last_input, now);
    for (const f of fs) {
      const arr = byField.get(f.fieldName) || [];
      arr.push({ name: String(d.name || d.id), id: d.id, h, last: d.last_input });
      byField.set(f.fieldName, arr);
    }
  }

  // 1 · ΟΛΟΚΛΗΡΟΣ ΑΓΡΟΣ ΣΙΓΗΣΕ ΜΑΖΙ. Παίρνουμε τη ΜΕΓΑΛΥΤΕΡΗ ομάδα συσκευών με last_input μέσα σε 20′.
  for (const [fieldName, devs] of byField.entries()) {
    const quiet = devs.filter((x) => x.h > SITE_QUIET_H && Number.isFinite(new Date(x.last).getTime()))
      .sort((a, b) => new Date(a.last) - new Date(b.last));
    if (quiet.length < 2) continue;
    let best = [];
    for (let i = 0; i < quiet.length; i++) {
      const t0 = new Date(quiet[i].last).getTime();
      const grp = quiet.filter((x) => { const t = new Date(x.last).getTime(); return t >= t0 && t - t0 <= SITE_WINDOW_MIN * 6e4; });
      if (grp.length > best.length) best = grp;
    }
    if (best.length < 2) continue;
    const span = Math.round((new Date(best[best.length - 1].last) - new Date(best[0].last)) / 6e4);
    tasks.push({ sev: 3, kind: "site_silence", field: fieldName, dev: best.map((x) => x.name).join(", "),
      title: "Ολόκληρος αγρός σίγησε μαζί",
      why: `${best.length} συσκευές σίγησαν μέσα σε ${span} λεπτά (από ${new Date(best[0].last).toISOString()})`
        + " — ύποπτη η πύλη/ρεύμα, όχι οι αισθητήρες",
      action: "Έλεγχος πύλης (ρεύμα, internet) πριν από τους αισθητήρες" });
    counts.site_silence++;
  }

  // 2 · ΑΙΣΘΗΤΗΡΑΣ ΣΕ ΛΑΘΟΣ ΑΓΡΟ. Η πύλη που τον ακούει είναι μακριά από τον αγρό στον οποίο είναι δηλωμένος.
  // T-GWFIELDS-01b (7/11 01:40 UTC, μετά την πρώτη ζωντανή εκτέλεση: 43 ψευδή «λάθος αγρός»): η θέση μιας πύλης
  // ΔΕΝ είναι πάντα αληθινή — κάποιοι parsers βάζουν στο lrrid τη θέση της ΣΥΣΚΕΥΗΣ/του αγρού, κι έτσι τρεις
  // διαφορετικές πύλες έδειχναν ακριβώς τις συντεταγμένες του ΚΕΚ. Δύο φρουροί: (α) θέση που μοιράζονται ≥2 πύλες
  // δεν μετρά· (β) η θέση πρέπει να ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ από τουλάχιστον έναν αγρό που ακούει η πύλη ΜΕΣΑ στα όρια —
  // αλλιώς δεν ξέρουμε πού είναι η πύλη και δεν κατηγορούμε κανέναν.
  const _posKey = (q) => Number(q.lat).toFixed(3) + "," + Number(q.lon).toFixed(3);
  const _posCount = new Map();
  for (const [code, g] of (gw || new Map()).entries()) {
    const q = (g.lat != null && g.lon != null) ? { lat: Number(g.lat), lon: Number(g.lon) } : (pos && pos[code]) || null;
    if (q && Number.isFinite(q.lat) && Number.isFinite(q.lon)) _posCount.set(_posKey(q), (_posCount.get(_posKey(q)) || 0) + 1);
  }
  for (const [code, g] of (gw || new Map()).entries()) {
    const p = (g.lat != null && g.lon != null) ? { lat: Number(g.lat), lon: Number(g.lon) } : (pos && pos[code]) || null;
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if ((_posCount.get(_posKey(p)) || 0) > 1) continue;                       // (α) κοινή «θέση» = άγνωστη θέση
    let _near = 0;
    for (const s of g.list || []) for (const f of fieldOf.get(s.id) || []) {
      if (f.coords && haversineKm(p.lat, p.lon, f.coords.lat, f.coords.lon) <= WRONG_FIELD_KM) _near++;
    }
    if (_near < 1) continue;                                                   // (β) καμία επιβεβαίωση της θέσης
    for (const s of g.list || []) {
      for (const f of fieldOf.get(s.id) || []) {
        if (!f.coords) continue;
        const km = haversineKm(p.lat, p.lon, f.coords.lat, f.coords.lon);
        if (!(km > WRONG_FIELD_KM)) continue;
        tasks.push({ sev: 2, kind: "wrong_field", field: f.fieldName, dev: s.n,
          title: "Αισθητήρας δηλωμένος σε λάθος αγρό",
          why: `ακούγεται από πύλη ${code} που βρίσκεται ${km.toFixed(1).replace(".", ",")} km από τις συντεταγμένες του αγρού`,
          action: "Διόρθωση ανάθεσης από το γραφείο (removeSensorFromField) ή έλεγχος συντεταγμένων αγρού" });
        counts.wrong_field++;
      }
    }
  }

  // 3 · ΣΙΩΠΗΛΑ ΟΡΓΑΝΑ ανά αγρό. Οι βάνες/ελεγκτές (uc5xx, ws558) ανήκουν σε άλλον — μόνο σημείωση.
  for (const [fieldName, devs] of byField.entries()) {
    const silent = devs.filter((x) => x.h > SILENT_H);
    const valves = silent.filter((x) => VALVE_RE.test(x.name));
    const sensors = silent.filter((x) => !VALVE_RE.test(x.name));
    if (!sensors.length) continue;
    const lst = (arr) => arr.map((x) => `${x.name} (σιωπά ${daysTxt(x.h)})`).join(", ");
    tasks.push({ sev: 3, kind: "silent_in_field", field: fieldName, dev: sensors.map((x) => x.name).join(", "),
      title: "Σιωπηλά όργανα",
      why: lst(sensors) + (valves.length ? ` (+ βάνα/ελεγκτής σιωπηλός: ${lst(valves)})` : ""),
      action: "Μπαταρία / κεραία / έλεγχος επιτόπου" });
    counts.silent_in_field++;
  }

  // Αποδιπλασιασμός, σειρά (σοβαρότητα ↓, αγρός α-ω), όριο πλήθους και μεγέθους.
  const seen = new Set();
  let out = tasks.filter((t) => { const k = t.kind + "|" + t.field + "|" + t.dev; if (seen.has(k)) return false; seen.add(k); return true; });
  out.sort((a, b) => (b.sev - a.sev) || String(a.field).localeCompare(String(b.field), "el"));
  if (out.length > TASK_MAX) out = out.slice(0, TASK_MAX);
  const size = () => JSON.stringify({ tasks: out }).length;
  for (let guard = 0; size() > TASK_JSON_MAX && guard < 200; guard++) {
    let i = -1;
    for (let j = 0; j < out.length; j++) if (out[j].why.length > 24 && (i < 0 || out[j].why.length > out[i].why.length)) i = j;
    if (i < 0) { out.pop(); continue; }                       // δεν μένει τι να κόψουμε — πετάμε την τελευταία
    out[i].why = out[i].why.slice(0, Math.max(20, Math.floor(out[i].why.length / 2))) + "…";
  }
  return { tasks: out, counts };
}
// ═══ T-GWFIELDS-01 (ΤΕΛΟΣ) ════════════════════════════════════════════════════════════════════════════════

// ═══ T-GWMAP-04 (7/11/2026) · ΕΝΙΑΙΟΣ ΧΑΡΤΗΣ: ΜΙΑ ΓΡΑΜΜΗ map_field ΑΝΑ ΕΓΓΡΑΦΗ ΑΓΡΟΥ (ΑΡΧΗ) ════════════════════
// Ο χάρτης πρέπει να δείχνει ΚΑΙ όσους αγρούς δεν υπολογίζονται, ενώ το fleet_field έχει μόνο τους υπολογισμένους.
// Εδώ όλα βγαίνουν από ό,τι έχει ήδη φορτωθεί: 0 αναγνώσεις δεδομένων. Μετρημένα 7/11: 65 εγγραφές, όλες με ετικέτα
// coordinates, 42 με θέση στη φόρμα, 64 με clientName, διπλά κλειδιά ετικετών υπάρχουν.
// ΠΟΤΕ δεν τυπώνονται τιμές ετικετών: οι ετικέτες αισθητήρων έχουν κλειδιά συσκευών.
const MAP_ROW_MAX = 1500;           // χαρακτήρες: κάθε metadata μένει ΚΑΤΩ από αυτό
const MAP_DIFF_KM = 1;              // km: φόρμα και ετικέτα πιο μακριά από αυτό = ασυμφωνία
const MAP_NAME_STEPS = [24, 14, 8, 0];   // πρώτα κόβονται τα ονόματα οργάνων, μόνο μετά φεύγουν όργανα

function mapTagAll(tags, key) {
  const k = String(key).toLowerCase(), out = [];
  for (const t of Array.isArray(tags) ? tags : []) {
    if (!t || String(t.key).toLowerCase() !== k) continue;
    const v = String(t.value == null ? "" : t.value).trim();
    if (v) out.push(v);
  }
  return out;
}
/* Number(null) === 0 και το 0 είναι πεπερασμένο: χωρίς αυτόν τον φράχτη άδειο πεδίο γίνεται σημείο στον ωκεανό. */
function mapNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}
function mapPoint(a, b) {
  const lat = mapNum(a), lng = mapNum(b);
  if (!(lat >= GR_BOX.latMin && lat <= GR_BOX.latMax && lng >= GR_BOX.lngMin && lng <= GR_BOX.lngMax)) return null;
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}
/* Θέση αγρού: φόρμα, μετά ετικέτα. ps = πηγή, pq = ποιότητα:
     ok · dup (διπλή ετικέτα, διαφορετικές τιμές) · diff (φόρμα και ετικέτα διαφέρουν > 1 km) · none (καμία θέση)
   Το shared (ίδιο σημείο με άλλον παραγωγό) το βάζει η buildMapFieldRows, που βλέπει όλες τις εγγραφές. */
function mapFieldPosition(tags) {
  const tagPts = [];
  for (const raw of mapTagAll(tags, "coordinates")) {
    const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    const p = m ? mapPoint(m[1], m[2]) : null;
    if (p && !tagPts.some((q) => haversineKm(p.lat, p.lng, q.lat, q.lng) < 0.01)) tagPts.push(p);
  }
  let form = null;
  try {
    const c = JSON.parse(mapTagAll(tags, "configuration")[0] || "{}");
    if (c && typeof c === "object") form = mapPoint(c.latitude, c.longitude);
  } catch (e) { form = null; }   // χαλασμένη φόρμα: μένει η ετικέτα. Το μήνυμα ΔΕΝ τυπώνεται, περιέχει την τιμή.
  const p = form || tagPts[0] || null;
  if (!p) return { y: null, x: null, ps: null, pq: "none" };
  let pq = "ok";
  if (tagPts.length > 1) pq = "dup";
  else if (form && tagPts.length && haversineKm(form.lat, form.lng, tagPts[0].lat, tagPts[0].lng) > MAP_DIFF_KM) pq = "diff";
  return { y: p.lat, x: p.lng, ps: form ? "form" : "tag", pq };
}
/* Ποια όργανα δηλώνει ο αγρός. Το `devices` είναι JSON {όνομα: id}· ίδια ανοχή με την buildFieldOf, και κρατάμε το
   όνομα γιατί συσκευή εκτός Actility δεν υπάρχει στον κατάλογο. Διπλή ετικέτα: ενώνονται και οι δύο. */
function mapFieldDevices(tags) {
  const out = [], seen = new Set();
  const add = (id, name) => {
    id = String(id);
    if (!/^[0-9a-f]{24}$/.test(id) || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: String(name || "") });
  };
  for (const raw of mapTagAll(tags, "devices")) {
    let o = null;
    try { o = JSON.parse(raw); } catch (e) { o = null; }
    if (Array.isArray(o)) o.forEach((id) => add(id, ""));
    else if (o && typeof o === "object") Object.keys(o).forEach((k) => add(o[k], k));
    else (raw.match(/[0-9a-f]{24}/g) || []).forEach((id) => add(id, ""));
  }
  return out;
}
/* Κρατά ΜΟΝΟ την ετικέτα `type` και σβήνει όλες τις ετικέτες από τον κατάλογο, ώστε κανένα κλειδί συσκευής να μη
   μείνει στη μνήμη της εκτέλεσης και να μη φτάσει ποτέ σε log. */
function mapDeviceTypes(devs) {
  const typeOf = new Map();
  for (const d of devs || []) {
    if (!d) continue;
    const t = mapTagAll(d.tags, "type")[0];
    if (t) typeOf.set(d.id, t.toLowerCase());
    delete d.tags;
  }
  return typeOf;
}
/* Από τα gateways αυτής της εκτέλεσης στο «ποια πύλη άκουσε ποια συσκευή». Όσοι δεν στέλνουν lrrid μένουν null:
   άγνωστη πύλη, όχι «καμία πύλη». */
function mapGatewayOf(gw) {
  const out = new Map();
  for (const [code, g] of (gw || new Map()).entries()) for (const s of (g && g.list) || []) out.set(s.id, code);
  return out;
}
/* Όριο μεγέθους. Σειρά: ονόματα οργάνων, μετά τα όργανα από το τέλος (η λίστα έχει τα χειρότερα πρώτα) με μέτρηση
   στο `dc`, ώστε η σελίδα να πει πόσα έφυγαν. Τέλος, για παθολογικά μεγάλο όνομα, το όνομα αγρού και παραγωγού. */
function mapFitRow(md) {
  const fits = () => JSON.stringify(md).length < MAP_ROW_MAX;
  if (fits()) return md;
  for (const n of MAP_NAME_STEPS) {
    for (const d of md.dv) d.n = n ? truncName(d.n, n) : "";
    if (fits()) return md;
  }
  for (const d of md.dv) delete d.gs;   // πρώτα φεύγουν οι παλιότερες πύλες, μετά τα ίδια τα όργανα
  if (fits()) return md;
  while (md.dv.length && !fits()) { md.dv.pop(); md.dc = (md.dc || 0) + 1; }
  if (!fits()) { md.n = truncName(md.n, 60); md.c = md.c == null ? null : truncName(md.c, 40); }
  return md;
}
/* ΚΑΘΑΡΗ: ό,τι χρειάζεται της δίνεται. fields = εγγραφές αγρών με tags, devs = κατάλογος χωρίς tags. */
function buildMapFieldRows({ fields, devs, typeOf, gwOf, heard, now }) {
  now = now || Date.now();
  const byId = new Map((devs || []).map((d) => [d.id, d]));
  const metas = [];
  for (const f of fields || []) {
    if (!f || !f.id) continue;
    const tags = Array.isArray(f.tags) ? f.tags : [];
    const dv = mapFieldDevices(tags).map((x) => {
      const d = byId.get(x.id) || {};
      const h = ageHours(d.last_input, now);
      let g = (gwOf && gwOf.get(x.id)) || null;
      const gs = heardList(heard, x.id, g, now);
      if (!g && gs.length) g = gs.shift()[0];   // δεν ρωτήθηκε σε αυτή την εκτέλεση: η πιο πρόσφατη γνωστή πύλη
      const row = { i: x.id.slice(-6), n: String(d.name || x.name || ""), t: (typeOf && typeOf.get(x.id)) || null,
        h: Number.isFinite(h) ? Math.round(Math.max(0, h) * 10) / 10 : null, g };
      if (gs.length) row.gs = gs;
      return row;
    });
    // Τα χειρότερα πρώτα: αν χρειαστεί να φύγει όργανο, φεύγει το πιο υγιές.
    dv.sort((a, b) => (b.h == null ? Infinity : b.h) - (a.h == null ? Infinity : a.h));
    const pos = mapFieldPosition(tags);
    metas.push({ i: String(f.id), n: mapTagAll(tags, "name")[0] || String(f.name || f.id),
      c: mapTagAll(tags, "clientName")[0] || null, y: pos.y, x: pos.x, ps: pos.ps, pq: pos.pq, dv });
  }
  // Ίδιο σημείο με ΑΛΛΟΝ παραγωγό = ύποπτη θέση. Ίδιος παραγωγός στο ίδιο σημείο είναι θεμιτό (π.χ. ξενοδοχείο).
  const owners = new Map();
  for (const m of metas) {
    if (m.y == null || !m.c) continue;
    const k = m.y.toFixed(5) + "," + m.x.toFixed(5);
    owners.set(k, (owners.get(k) || new Set()).add(m.c));
  }
  for (const m of metas) {
    if (m.y != null && (owners.get(m.y.toFixed(5) + "," + m.x.toFixed(5)) || new Set()).size > 1) m.pq = "shared";
  }
  const time = new Date(now).toISOString();   // ΙΔΙΑ ώρα σε όλη την παρτίδα: έτσι ο χάρτης ξεχωρίζει τον τελευταίο κύκλο
  return metas.map((m) => ({ variable: "map_field", value: m.dv.length, time, metadata: mapFitRow(m) }));
}
/* T-GWMAP-05 (7/11/2026) · ΟΛΕΣ ΟΙ ΠΥΛΕΣ ΑΝΑ ΟΡΓΑΝΟ. Το lrrid κάθε πακέτου λέει ΜΙΑ πύλη, την καλύτερη εκείνης της στιγμής. Όργανο
   που το ακούνε δύο πύλες εναλλάσσεται, και ο χάρτης έδειχνε μόνο την τελευταία. Κρατάμε μνήμη 7 ημερών όργανο → πύλη → ώρα τελευταίου
   πακέτου, από τις αναγνώσεις που γίνονται ήδη: 0 νέες ωριαίες. Μόνο η πρώτη εκτέλεση διαβάζει βαθιά, μία φορά, για να γεμίσει. */
const HEARD_TTL_H = 168;            // ώρες: πύλη που δεν παρέδωσε τόσο καιρό φεύγει από το όργανο
const HEARD_MAX_CHARS = 9000;       // όριο μεγέθους της εγγραφής μνήμης
const HEARD_SEED_QTY = 150;         // εγγραφές lrrid ανά όργανο, μόνο στην πρώτη εκτέλεση
const heardKey = (id) => String(id).slice(-10);
const hourOf = (t) => Math.floor(new Date(t).getTime() / 36e5);
function noteHeard(heard, id, code, time) {
  const h = hourOf(time);
  if (code === undefined || code === null || code === "" || !Number.isFinite(h)) return;
  const k = heardKey(id), c = String(code), e = heard[k] || (heard[k] = {});
  if (!(e[c] >= h)) e[c] = h;
}
/* T-GWMAP-06: όπου ο parser κρατά τη λίστα του δικτύου (metadata.lrrs), μετράνε ΟΛΕΣ οι πύλες του πακέτου, όχι μόνο η καλύτερη. */
function noteRow(heard, id, x) {
  if (!x) return;
  noteHeard(heard, id, x.value, x.time);
  const l = x.metadata && x.metadata.lrrs;
  if (Array.isArray(l)) for (const e of l) if (Array.isArray(e)) noteHeard(heard, id, e[0], x.time);
}
function pruneHeard(heard, now) {
  const cut = hourOf(now) - HEARD_TTL_H;
  for (const k of Object.keys(heard)) {
    for (const c of Object.keys(heard[k])) if (heard[k][c] < cut) delete heard[k][c];
    if (!Object.keys(heard[k]).length) delete heard[k];
  }
  // Αν ξεπεράσει το όριο φεύγουν πρώτα οι παλιότερες συνδέσεις, ποτέ η πιο πρόσφατη ενός οργάνου.
  while (JSON.stringify(heard).length > HEARD_MAX_CHARS) {
    let bk = null, bc = null, bh = Infinity;
    for (const k of Object.keys(heard)) {
      const cs = Object.keys(heard[k]);
      const newest = Math.max(...cs.map((c) => heard[k][c]));
      for (const c of cs) if (heard[k][c] < bh && heard[k][c] < newest) { bh = heard[k][c]; bk = k; bc = c; }
    }
    if (bk === null) break;
    delete heard[bk][bc];
  }
  return heard;
}
/* Οι ΑΛΛΕΣ πύλες ενός οργάνου: [[κωδικός, ώρες από το τελευταίο πακέτο]], νεότερη πρώτα, χωρίς την τρέχουσα. */
function heardList(heard, id, latest, now) {
  const e = (heard && heard[heardKey(id)]) || {}, nowH = hourOf(now);
  return Object.keys(e).filter((c) => c !== String(latest)).sort((a, b) => e[b] - e[a]).map((c) => [c, Math.max(0, nowH - e[c])]);
}
// ═══ T-GWMAP-04 (ΤΕΛΟΣ) ═══════════════════════════════════════════════════════════════════════════════════

/* Η ΜΝΗΜΗ: ποιες συσκευές ξέρουμε ότι στέλνουν lrrid, και πού σταμάτησε η ανακάλυψη.
   Ζει σε ΜΙΑ μεταβλητή της συσκευής εποπτείας. Αν λείπει ή είναι χαλασμένη, δεν ρίχνει
   την εκτέλεση — απλώς κάνουμε πλήρη σάρωση και την ξαναχτίζουμε. */
async function loadState() {
  try {
    const r = await api(`/device/${OVERSEER}/data?variables[]=gateway_scan_state&qty=1`);
    const p = (r || [])[0];
    const ids = String((p && p.metadata && p.metadata.ids) || "").split(",").filter(Boolean);
    const cursor = Number((p && p.metadata && p.metadata.cursor) || 0) || 0;
    /* T-GWID-02 (19/10): ΜΝΗΜΗ ΘΕΣΗΣ ανά gateway. Από τις 19/10 οι parsers SE02/SE0X/SE01 στέλνουν lrrid ΧΩΡΙΣ
       lrrlat/lrrlon. Αν σε μια εκτέλεση το gateway το κατονομάζουν μόνο τέτοιοι αισθητήρες, η θέση χανόταν και η
       πινέζα έφευγε (Πόμπια 16:23). Κρατάμε την τελευταία γνωστή θέση κάθε κωδικού LRR. */
    const pos = {};
    const raw = p && p.metadata && p.metadata.pos;
    if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw)) {
      if (v && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lon))) pos[k] = { lat: Number(v.lat), lon: Number(v.lon) };
    }
    // Πρώτη φορά (κενή μνήμη θέσης): σπορά από τις ήδη γραμμένες κάρτες gateway_row.
    if (!Object.keys(pos).length) {
      try {
        const rows = await api(`/device/${OVERSEER}/data?variables[]=gateway_row&qty=300`);
        for (const r of rows || []) {
          const l = r && r.metadata && r.metadata.location;
          if (r && r.value && !pos[r.value] && l && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng)))
            pos[String(r.value)] = { lat: Number(l.lat), lon: Number(l.lng) };
        }
      } catch (e) { /* χωρίς σπορά — θα γεμίσει σταδιακά */ }
    }
    return { ids, cursor, pos };
  } catch (e) { return { ids: [], cursor: 0, pos: {} }; }
}

(async () => {
  const t0 = Date.now();
  let reads = 0;
  console.log("══ gatewayLiveness T-GWLIVE-01 · " + new Date(t0).toISOString() + " ══");

  // 1 · Ο κατάλογος των συσκευών του δικτύου Actility (1 ανάγνωση ανά σελίδα).
  let devs = [];
  for (let page = 1; page <= 4; page++) {
    const c = await api(`/device?amount=200&page=${page}&fields[]=id&fields[]=name&fields[]=tags`
      + `&fields[]=last_input&filter[network]=${ACTILITY_NET}`);
    reads++;
    devs = devs.concat(c || []);
    if (!c || c.length < 200) break;
  }
  // T-GWMAP-04: μένει μόνο ο τύπος· οι ετικέτες σβήνονται εδώ, πριν από οτιδήποτε άλλο.
  let typeOf = new Map();
  try { typeOf = mapDeviceTypes(devs); } catch (e) { for (const d of devs) if (d) delete d.tags; console.log("ΧΑΡΤΗΣ|τύποι: σφάλμα"); }
  const live = devs.filter((d) => d.last_input);
  const byId = new Map(live.map((d) => [d.id, d]));

  // 1β · T-GWMAP-02: ο ζωντανός κατάλογος των gateways (1 ανάγνωση). Αποτυχία ΔΕΝ ρίχνει την εκτέλεση.
  let roster = [];
  try {
    const g = await api(`/device?amount=200&page=1&fields[]=id&fields[]=name&fields[]=tags`
      + `&filter[tags][0][key]=is_gateway&filter[tags][0][value]=yes`);
    reads++;
    // Διπλή ασφάλεια: κι αν το φίλτρο αγνοηθεί, κρατάμε ΜΟΝΟ όσα έχουν is_gateway=yes.
    roster = (g || []).filter((d) => (d.tags || []).some((t) => t && t.key === "is_gateway" && t.value === "yes"))
      .map(rosterEntry);
  } catch (e) { console.log("ΚΑΤΑΛΟΓΟΣ|σφάλμα " + ((e && e.message) || e)); }

  // 1γ · T-GWFIELDS-01: οι αγροί (isField=yes) ΜΙΑ φορά (1 ανάγνωση) → ποια συσκευή ανήκει σε ποιον αγρό και πού
  //      είναι ο αγρός. Αποτυχία ΔΕΝ ρίχνει την εκτέλεση: συνεχίζουμε με άδειο χάρτη (οι κάρτες πύλης βγαίνουν όπως πριν).
  let fieldOf = new Map();
  let fieldRecs = [];   // T-GWMAP-04: οι ίδιες εγγραφές τροφοδοτούν και το map_field
  try {
    const f = await api(`/device?amount=200&page=1&fields[]=id&fields[]=name&fields[]=tags`
      + `&filter[tags][0][key]=isField&filter[tags][0][value]=yes`);
    reads++;
    fieldRecs = (f || []).filter((d) => (d.tags || []).some((t) => t && t.key === "isField" && t.value === "yes"));
    fieldOf = buildFieldOf(fieldRecs);
    console.log(`ΑΓΡΟΙ|${(f || []).length} αγροί · ${fieldOf.size} συσκευές με αγρό`);
  } catch (e) { console.log("ΑΓΡΟΙ|σφάλμα " + ((e && e.message) || e)); }

  // 2 · Ποιες ρωτάμε: τις ΓΝΩΣΤΕΣ + ένα κυλιόμενο παράθυρο από τις υπόλοιπες.
  const st = await loadState(); reads++;
  // T-GWMAP-05: null = η ανάγνωση απέτυχε, άρα ΔΕΝ ξαναγράφουμε τη μνήμη (κενή μνήμη δεν είναι το ίδιο με άγνωστη).
  let heard = null;
  try {
    const hr = await api(`/device/${OVERSEER}/data?variables[]=gateway_heard_state&qty=1`); reads++;
    const hm = hr && hr[0] && hr[0].metadata && hr[0].metadata.h;
    heard = hm && typeof hm === "object" ? hm : {};
  } catch (e) { console.log("ΠΥΛΕΣ ΟΡΓΑΝΩΝ|σφάλμα ανάγνωσης μνήμης"); }
  const heardSeed = !!heard && !Object.keys(heard).length;
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
      if (heard) for (const x of rows || []) if (x && x.variable === "lrrid") noteRow(heard, id, x);
      const key = String(idRow.value);
      const g = gw.get(key) || { n: 0, last: null, lat: null, lon: null, rssi: null, snr: null, devs: [], list: [] };
      g.n++;
      if (!g.last || idRow.time > g.last) {
        g.last = idRow.time;
        const rs = pick("lrrrssi"); if (rs) g.rssi = rs.value;
        const sn = pick("lrrsnr"); if (sn) g.snr = sn.value;
      }
      const la = pick("lrrlat"), lo = pick("lrrlon");
      if (la && lo && la.value != null && lo.value != null) { g.lat = la.value; g.lon = lo.value; }
      else { const lp = locOf(idRow); if (lp) { g.lat = lp.lat; g.lon = lp.lng; } }
      if (g.devs.length < 5) g.devs.push(d.name);
      // T-GWFIELDS-01: ΠΛΗΡΗΣ λίστα (όχι μόνο 5) με αγρό και ηλικία σιωπής — τροφή για το «Ακούει:» και τις εργασίες.
      g.list.push({ id, n: truncName(d.name, 28), f: (fieldOf.get(id) || []).map((x) => x.fieldName), h: ageHours(d.last_input) });
      gw.set(key, g);
    }
  }));

  // 3α · T-GWMAP-05: μία φορά, όταν η μνήμη είναι κενή, διαβάζουμε το ιστορικό lrrid ώστε ο χάρτης να δείξει αμέσως όλες τις πύλες.
  if (heardSeed && stillKnown.length) {
    let si = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (si < stillKnown.length) {
        const id = stillKnown[si++];
        try {
          const hist = await api(`/device/${id}/data?variables[]=lrrid&qty=${HEARD_SEED_QTY}`); reads++;
          for (const x of hist || []) noteRow(heard, id, x);
        } catch (e) { /* το όργανο θα γεμίσει σταδιακά */ }
      }
    }));
    console.log(`ΠΥΛΕΣ ΟΡΓΑΝΩΝ|πρώτη σπορά|${stillKnown.length} όργανα`);
  }

  // 3β · T-GWID-02: θέση από τη μνήμη όταν αυτή η εκτέλεση δεν τη βρήκε· η μνήμη ενημερώνεται με κάθε νέα θέση.
  const pos = st.pos || {};
  for (const [id, g] of gw.entries()) {
    if (g.lat != null && g.lon != null) pos[id] = { lat: Number(g.lat), lon: Number(g.lon) };
    else if (pos[id]) { g.lat = pos[id].lat; g.lon = pos[id].lon; g.posMem = true; }
  }

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
    const text0 = `${state}. Το ξέρουμε επειδή ${g.n} αισθητήρ${g.n === 1 ? "ας πέρασε" : "ες πέρασαν"}`
      + ` από αυτό το gateway, τελευταία φορά ${ageTxt(ageH)}.`
      + (color === "red"
          ? ` ΠΡΟΣΟΧΗ: αυτό ΔΕΝ σημαίνει ότι το gateway είναι χαλασμένο.`
            + ` Σημαίνει ότι οι αισθητήρες που το κατονομάζουν σταμάτησαν να`
            + ` στέλνουν. Το ίδιο το gateway μπορεί να δουλεύει κανονικά.`
          : "")
      + (g.rssi != null ? ` Ισχύς λήψης ${Math.round(Number(g.rssi))} dBm.` : "")
      + (g.lat != null ? ` Θέση ${Number(g.lat).toFixed(5)}, ${Number(g.lon).toFixed(5)}.` : " Θέση άγνωστη.")
      + ` Αισθητήρες: ${g.devs.join(", ")}${g.n > g.devs.length ? " …" : ""}.`;
    /* T-GWFIELDS-01: ΠΟΙΟΥΣ ΑΓΡΟΥΣ ακούει η πύλη και ποια όργανά τους σιωπούν. Ο τεχνικός που πάει στην πύλη
       πρέπει να ξέρει ποιους πελάτες επηρεάζει· και αν τα σιωπηλά όργανα ΔΕΝ περνούν από εδώ, η πύλη δεν φταίει. */
    const perField = new Map();
    for (const s of g.list || []) {
      for (const fn of (s.f && s.f.length ? s.f : ["(εκτός αγρού)"])) {
        const e = perField.get(fn) || { f: fn, k: 0, s: [], silent: [] };
        e.k++; e.s.push(s.n);
        if (s.h > SILENT_H) e.silent.push(`${s.n} (${daysTxt(s.h)})`);
        perField.set(fn, e);
      }
    }
    const fields = Array.from(perField.values()).sort((a, b) => (b.k - a.k) || (a.f === "(εκτός αγρού)" ? 1 : -1));
    const text = text0
      + (fields.length ? ` Ακούει: ${fields.slice(0, 8).map((e) => `${e.f} (${e.k} αισθ.)`).join(", ")}${fields.length > 8 ? ", …" : ""}.` : "")
      + " Η ταυτότητα έρχεται από το δίκτυο Actility (πεδίο LRR), όχι από το ίδιο το gateway.";
    const md = { color, sensors: g.n, age_h: Number(ageH.toFixed(2)), state, text };
    if (g.rssi != null) md.rssi = Number(g.rssi);
    if (g.snr != null) md.snr = Number(g.snr);
    if (g.lat != null) md.location = { lat: Number(g.lat), lng: Number(g.lon) };
    if (fields.length) {
      // Όριο 1500 χαρακτήρες: πρώτα φεύγουν οι λίστες ονομάτων (τα ΣΙΩΠΗΛΑ μένουν), μετά ολόκληροι αγροί.
      let fl = fields.map((e) => ({ f: e.f, k: e.k, s: e.s, silent: e.silent }));
      let cut = false;
      if (JSON.stringify(fl).length > 1500) { cut = true; fl = fl.map((e) => ({ f: e.f, k: e.k, silent: e.silent })); }
      while (fl.length > 1 && JSON.stringify(fl).length > 1500) { cut = true; fl.pop(); }
      md.fields = fl;
      if (cut) md.fields_cut = true;
    }
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

  // 4β · T-GWMAP-02: ο κατάλογος — ΜΟΝΟ αν διαβάστηκε (ένας άδειος κατάλογος θα έσβηνε τον χάρτη).
  if (roster.length) {
    const withPos = roster.filter((r) => r.lat != null).length;
    const conflicts = roster.filter((r) => r.conflict).length;
    out.push({ variable: "gateway_roster", value: roster.length,
      metadata: { list: roster, with_position: withPos, conflicts,
        text: `Κατάλογος στόλου: ${roster.length} gateways, ${withPos} με θέση από την ετικέτα coordinates`
          + (conflicts ? `, ${conflicts} με ΑΣΥΜΦΩΝΙΑ θέσης (διπλή ετικέτα)` : "") + "." } });
  }

  // 5 · Η μνήμη για την επόμενη φορά.
  out.push({ variable: "gateway_scan_state", value: stillKnown.length,
    metadata: { ids: stillKnown.join(","), cursor, pos,
      text: "Μνήμη σάρωσης: ποιες συσκευές στέλνουν ταυτότητα gateway. Μειώνει τις"
        + " αναγνώσεις από ~220 σε ~" + (stillKnown.length + DISCOVER_PER_RUN) + " ανά εκτέλεση." } });

  // 4γ · T-GWFIELDS-01: οι ΕΡΓΑΣΙΕΣ ΤΕΧΝΙΚΟΥ — μία εγγραφή, από δεδομένα που ήδη έχουμε (0 νέες αναγνώσεις).
  //      Δικό της try/catch: αν σκάσει, οι κάρτες πύλης γράφονται κανονικά. Ο πίνακας στόλου (sag-fleet.html) τη δείχνει.
  let techCounts = { site_silence: 0, wrong_field: 0, silent_in_field: 0 }, techN = 0;
  try {
    const tt = computeTechTasks({ live, fieldOf, gw, pos, now });
    techCounts = tt.counts; techN = tt.tasks.length;
    out.push({ variable: "tech_tasks", value: techN,
      metadata: { t: new Date(now).toISOString(), tasks: tt.tasks, text: `${techN} εργασίες τεχνικού` } });
  } catch (e) { console.log("ΕΡΓΑΣΙΕΣ|σφάλμα " + ((e && e.message) || e)); }

  await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(out) });

  // 4δ · T-GWMAP-04: ο ενιαίος χάρτης. Τρέχει ΑΦΟΥ γραφτούν οι κάρτες πύλης, άρα δεν μπορεί να τις σταματήσει ούτε
  //      σφάλμα ούτε απόρριψη της εγγραφής. Χωρίς αγρούς δεν γράφει τίποτα: ο χάρτης θα δείξει ότι τα δεδομένα παλιώνουν.
  try {
    if (heard) pruneHeard(heard, now);
    const mapRows = fieldRecs.length ? buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), heard, now }) : [];
    if (mapRows.length) await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(mapRows) });
    console.log(`ΧΑΡΤΗΣ|${mapRows.length} γραμμές map_field`);
  } catch (e) { console.log("ΧΑΡΤΗΣ|σφάλμα " + ((e && e.name) || "άγνωστο")); }
  // Χωριστή εγγραφή: αν απορριφθεί η μνήμη, ο χάρτης έχει ήδη γραφτεί.
  try {
    if (heard) {
      await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify([{ variable: "gateway_heard_state",
        value: Object.keys(heard).length, metadata: { h: heard } }]) });
      const multi = Object.keys(heard).filter((k) => Object.keys(heard[k]).length > 1).length;
      console.log(`ΠΥΛΕΣ ΟΡΓΑΝΩΝ|όργανα=${Object.keys(heard).length}|με πάνω από μία πύλη=${multi}|χαρακτήρες=${JSON.stringify(heard).length}`);
    }
  } catch (e) { console.log("ΠΥΛΕΣ ΟΡΓΑΝΩΝ|σφάλμα εγγραφής " + ((e && e.name) || "άγνωστο")); }

  console.log(`ΕΡΓΑΣΙΕΣ|${techN}|site_silence=${techCounts.site_silence}|wrong_field=${techCounts.wrong_field}|silent=${techCounts.silent_in_field}`);
  for (const [id, g] of rows.slice(0, 12)) {
    const ageH = g.last ? (now - new Date(g.last).getTime()) / 36e5 : Infinity;
    console.log(`G|${id}|αισθητήρες=${g.n}|${ageTxt(ageH)}`
      + `|θέση=${g.lat != null ? g.lat + "," + g.lon : "—"}|rssi=${g.rssi}`);
  }
  /* T-GWHONEST-01: και η κονσόλα. Όποιος τη διαβάζει για να καταλάβει τι
     συμβαίνει διάβαζε την ίδια αναλήθεια που βγάλαμε από τον πίνακα.
     Μπαίνει ΚΑΙ η κάλυψη, ώστε το «gateways=N» να μην διαβάζεται ξεκομμένο. */
  console.log(`ΚΑΤΑΛΟΓΟΣ|gateways=${roster.length}|με θέση=${roster.filter((r) => r.lat != null).length}`
    + `|ασυμφωνίες=${roster.filter((r) => r.conflict).length}`);
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
