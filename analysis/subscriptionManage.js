// ═════════════════════════════════════════════════
// SAG · subscriptionManage — DASHBOARD «Συνδρομές» (T-SUBS-01, 6/11/2026, αίτημα Κώστα)
// ═════════════════════════════════════════════════
//
// ΤΙ ΚΑΝΕΙ
//  1. Εικόνα: πελάτες + αγροί (λήξη, κόστος, κατάσταση, ποιοι χρήστες έχουν πρόσβαση). Τη γράφει στη
//     συσκευή «SAG Εποπτεία» ως subs_chunk / subs_summary. Τρέχει κάθε 30′ από action.
//  2. Ενέργειες: παύση / διακοπή / επαναφορά αγρού, ΜΟΝΟ με ρητή εντολή (γραμμή subs_command από το
//     widget «Συνδρομές», που το βλέπει μόνο η ομάδα MACC_Manager).
//
// ΚΑΝΟΝΕΣ ΑΣΦΑΛΕΙΑΣ
//  - ΚΑΜΙΑ ΑΥΤΟΜΑΤΗ ΠΑΥΣΗ. Απόφαση Κώστα 6/11: την παύση την αναλαμβάνει ο υπεύθυνος, ακόμη κι αν η
//    συνδρομή έχει λήξει. Χωρίς γραμμή subs_command το script μόνο διαβάζει και γράφει την εικόνα.
//  - ΔΕΝ αγγίζει βάνες, ελεγκτές, UC511_downlink, UC511_status_check, πρότυπο ή createField. Από τους
//    ελεγκτές μόνο ΔΙΑΒΑΖΕΙ valve_1/valve_2, για να προειδοποιήσει πριν την παύση.
//  - Δεν σβήνει δεδομένα.
//
// ΠΩΣ ΔΟΥΛΕΥΕΙ Η ΠΑΥΣΗ
//  Ο πελάτης βλέπει ένα dashboard όταν αυτό έχει ετικέτα access ίδια με του χρήστη του. Η παύση:
//   α. σώζει στον αγρό τις ετικέτες access του dashboard (όλες εκτός MACC_Manager, μαζί και το public)·
//   β. τις αφαιρεί από το dashboard, άρα ο πελάτης το χάνει ενώ η ομάδα MACC το βλέπει κανονικά·
//   γ. δίνει στον πελάτη το dashboard «Ανανέωση Συνδρομής» με το μήνυμα.
//  Η επαναφορά κάνει το αντίστροφο από το αντίγραφο του αγρού.
//  Η σειρά (πρώτα αντίγραφο, μετά αφαίρεση) είναι σκόπιμη: ό,τι κι αν αποτύχει, οι ετικέτες δεν χάνονται.
//
// ΕΤΙΚΕΤΕΣ ΣΤΟΝ ΑΓΡΟ: subscriptionState (paused | stopped, καμία = ενεργή), subscriptionSavedAccess (JSON),
// subscriptionStateAt. Η διακοπή βάζει και subscriptionActive=no. Η ετικέτα subscriptionEnd ΔΕΝ αλλάζει.
//
// ΦΑΣΗ 1Β (8/11, Μιχάλης): κάθε αγρός έχει και cat (περίπτωση), cn (πελάτης), sg (όργανα ανά τύπο με σήματα και
// κλίμακα χρέωσης). Το subs_summary έχει και pricing (τιμές συνδρομών TagoIO), signals, tiers. Μόνο ανάγνωση.
//
// ΑΠΑΙΤΕΙ την πολιτική «[Analysis] SAG subscriptionManage». Χωρίς αυτήν το script αποτυγχάνει με Authorization Denied.

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";

const OVERSEER = "6a98855ca06e41000bfae024";    // συσκευή «SAG Εποπτεία»
const RENEW_DASHBOARD = "6aed920ffbc322000cdb81a2"; // dashboard «Ανανέωση Συνδρομής»
const BOARD_DASHBOARD = "6aed920f0120f0000ca8e92e"; // dashboard «Συνδρομές»
const TEMPLATE_DASHBOARD = "68f92649f8b680000ab970ae"; // πρότυπο: δεν το αγγίζουμε ποτέ
const MANAGER = "MACC_Manager";
const PUBLIC = "public";
const MAX_CHUNK_BYTES = 7000;                   // όριο εγγραφής TagoIO ~10 KB
const HEARTBEAT_H = 6;

/* ═══ ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ (τις ελέγχει το analysis/test/subscription_manage_check.mjs) ═══ */

const tagOf = (o, k) => {
  for (const t of (o && o.tags) || []) if (t && t.key === k && String(t.value || "").trim()) return String(t.value).trim();
  return "";
};
const withoutKeys = (tags, keys) => (tags || []).filter((t) => !keys.includes(t.key));

/* Οι ετικέτες access που δίνουν πρόσβαση σε πελάτες: όλες εκτός της ομάδας MACC. */
const customerAccess = (tags) => (tags || []).filter((t) => t && t.key === "access" && t.value !== MANAGER);

/* Ημερομηνία λήξης σε ημέρα Ελλάδας. Οι ετικέτες έχουν ανομοιογενή μορφή: «2027-03-01T00:00:00+03:00»
   αλλά και «Start: 2027-04-15T21:00:00.000Z». Επιστρέφει { date, odd }: odd=true όταν η μορφή δεν είναι καθαρή. */
function parseEnd(raw) {
  const s = String(raw || "").trim();
  if (!s) return { date: "", odd: false };
  const m = s.match(/\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?/);
  if (!m) return { date: "", odd: true };
  const d = new Date(m[0]);
  if (isNaN(d.getTime())) return { date: "", odd: true };
  // Μόνο το Z θέλει μετατροπή. Το createField γράφει πάντα +03:00, και τον χειμώνα (+02:00) η μετατροπή
  // θα έδινε την προηγούμενη μέρα: «2027-03-01T00:00+03:00» σημαίνει 1 Μαρτίου, όπως γράφτηκε.
  const date = m[2] === "Z"
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
    : m[0].slice(0, 10);
  return { date, odd: m.index !== 0 };
}

/* Τα ids των ελεγκτών ενός αγρού, από την ετικέτα devices (JSON όνομα → id). */
function controllersOf(field) {
  let map;
  try { map = JSON.parse(tagOf(field, "devices") || "{}"); } catch (_) { return []; }
  return Object.entries(map || {})
    .filter(([n, id]) => /uc5\d\d/i.test(n) && typeof id === "string")
    .map(([n, id]) => ({ n, id }));
}

/* Αποφασίζει ΤΙ θα γίνει σε έναν αγρό, χωρίς να γράφει τίποτα. Επιστρέφει { error } ή το σχέδιο
   { state, active, saved, fieldTags, dashboardTags }. */
function planAction(action, field, dashboard) {
  const allowedField = tagOf(field, "isField") === "yes" || tagOf(field, "subscriptionSandbox") === "yes";
  if (!allowedField) return { error: "Η συσκευή δεν είναι αγρός." };
  if (!dashboard) return { error: "Ο αγρός δεν έχει dashboard (ετικέτα fieldId)." };
  if (dashboard.id === TEMPLATE_DASHBOARD) return { error: "Το πρότυπο δεν αλλάζει ποτέ." };
  if (dashboard.id === RENEW_DASHBOARD || dashboard.id === BOARD_DASHBOARD) return { error: "Λάθος dashboard." };
  if (!(dashboard.tags || []).some((t) => t.key === "access" && t.value === MANAGER)) {
    return { error: "Το dashboard δεν έχει την ετικέτα MACC_Manager: η ομάδα θα το έχανε." };
  }

  const state = tagOf(field, "subscriptionState") || "active";
  const clean = withoutKeys(field.tags, ["subscriptionState", "subscriptionSavedAccess", "subscriptionStateAt", "subscriptionActive"]);
  const stamp = { key: "subscriptionStateAt", value: new Date().toISOString() };

  if (action === "resume") {
    if (state === "active") return { error: "Ο αγρός είναι ήδη ενεργός." };
    let saved;
    try { saved = JSON.parse(tagOf(field, "subscriptionSavedAccess")); } catch (_) { saved = null; }
    if (!Array.isArray(saved)) return { error: "Λείπει το αντίγραφο των ετικετών. Δεν έγινε τίποτα: θέλει έλεγχο με το χέρι." };
    const have = new Set((dashboard.tags || []).filter((t) => t.key === "access").map((t) => t.value));
    return {
      state: "active", active: "yes", saved,
      fieldTags: [...clean, { key: "subscriptionActive", value: "yes" }],
      dashboardTags: [...dashboard.tags, ...saved.filter((t) => !have.has(t.value))],
    };
  }

  if (action !== "pause" && action !== "stop") return { error: "Άγνωστη ενέργεια." };
  const active = action === "stop" ? "no" : "yes";
  const next = action === "stop" ? "stopped" : "paused";
  if (state === next) return { error: next === "paused" ? "Ο αγρός είναι ήδη σε παύση." : "Ο αγρός είναι ήδη σε διακοπή." };
  if (state === "stopped") return { error: "Ο αγρός είναι σε διακοπή. Κάνε πρώτα επαναφορά." };

  // Από παύση σε διακοπή: οι ετικέτες είναι ήδη σωσμένες, αλλάζει μόνο η κατάσταση.
  if (state === "paused") {
    return {
      state: next, active, saved: null,
      fieldTags: [...clean,
        { key: "subscriptionActive", value: active },
        { key: "subscriptionState", value: next },
        { key: "subscriptionSavedAccess", value: tagOf(field, "subscriptionSavedAccess") },
        stamp],
      dashboardTags: null,
    };
  }

  const saved = customerAccess(dashboard.tags);
  if (!saved.length) return { error: "Κανένας πελάτης δεν έχει πρόσβαση σε αυτό το dashboard, άρα δεν υπάρχει κάτι να κρυφτεί." };
  return {
    state: next, active, saved,
    fieldTags: [...clean,
      { key: "subscriptionActive", value: active },
      { key: "subscriptionState", value: next },
      { key: "subscriptionSavedAccess", value: JSON.stringify(saved) },
      stamp],
    dashboardTags: (dashboard.tags || []).filter((t) => !(t.key === "access" && t.value !== MANAGER)),
  };
}

/* Οι ετικέτες του dashboard «Ανανέωση Συνδρομής»: όσες χρειάζονται οι αγροί που είναι τώρα σε παύση/διακοπή.
   Το public δεν μπαίνει ποτέ: το μήνυμα είναι για συνδεδεμένους πελάτες. */
function renewTags(currentTags, fields) {
  const need = new Set();
  for (const f of fields) {
    if (!tagOf(f, "subscriptionState")) continue;
    let saved = [];
    try { saved = JSON.parse(tagOf(f, "subscriptionSavedAccess")) || []; } catch (_) {}
    for (const t of saved) if (t && t.value && t.value !== PUBLIC && t.value !== MANAGER) need.add(String(t.value));
  }
  const keep = (currentTags || []).filter((t) => t.key !== "access" || t.value === MANAGER);
  return [...keep, ...[...need].sort().map((value) => ({ key: "access", value }))];
}

/* Χωρίζει σε εγγραφές με βάση το μέγεθος σε bytes (τα ελληνικά πιάνουν 2 bytes ο χαρακτήρας). */
function chunkBySize(items, limit) {
  const out = [];
  let cur = [], size = 2;
  for (const it of items) {
    const n = Buffer.byteLength(JSON.stringify(it), "utf8") + 1;
    if (cur.length && size + n > limit) { out.push(cur); cur = []; size = 2; }
    cur.push(it); size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/* ═══ ΧΡΕΩΣΗ ΣΥΝΔΕΣΗΣ LoRaWAN ανά αισθητήρα (απόφαση Μιχάλη 8/11) ═══
   Σήμα = ό,τι ΜΕΤΡΑ το όργανο. Δεν μετρούν όσα υπολογίζει το σύστημα (σημείο δρόσου, αθροίσματα βροχής,
   δείκτης γονιμότητας). Ελάχιστη χρέωση 3 σήματα, όσα κι αν έχει. Μετά η κλίμακα του τιμοκαταλόγου
   (TAGO-Actility 3 / 8 / 48). Ο ελεγκτής βανών μετρά 2 σήματα. */
const SIGNALS = {
  em320: 2, em320_th: 2, em300_th: 2,   // θερμοκρασία, υγρασία
  sph01: 2,                             // pH, θερμοκρασία εδάφους
  lms01_ls: 2,                          // θερμοκρασία, υγρασία φύλλου
  lse01: 3, lse01_shallow: 3, lse01_deep: 3, // υγρασία, θερμοκρασία, EC
  se0x: 6, lse02: 6,                    // υγρασία, θερμοκρασία, EC × 2 βάθη
  s2120: 8,                             // θερμ., υγρ., ταχύτητα & κατεύθυνση ανέμου, UV, φως, βροχή, πίεση
  uc511: 2,                             // ελεγκτής βανών
  aglwpp01: 1,                          // πίεση σωλήνα άρδευσης (makerfabs)
};
const TIERS = [3, 8, 48];
/* Η κλίμακα χρέωσης για n σήματα. 0 = πάνω από 48, θέλει χειρισμό με το χέρι. */
const tierOf = (n) => { const x = Math.max(3, Number(n) || 0); return TIERS.find((t) => x <= t) || 0; };

/* Περίπτωση εγκατάστασης (ΠΡΩΤΟΚΟΛΛΟ_ΤΕΣΣΑΡΩΝ_ΠΕΡΙΠΤΩΣΕΩΝ_2026-11-07): field | greenhouse | landscape | station | automation. */
const COVERED = ["true", "yes", "ναι", "θερμοκήπιο", "θερμοκηπιο", "greenhouse", "1"];
function siteClassOf(field) {
  if (/volta|ξενοδοχ/i.test(tagOf(field, "clientName")) || /volta|hotel/i.test(tagOf(field, "project"))) return "landscape";
  const p = tagOf(field, "field_purpose").toLowerCase();
  if (p === "greenhouse" || p === "landscape" || p === "automation") return p;
  if (p === "weather") return "station";
  let cfg = null;
  try { cfg = JSON.parse(tagOf(field, "configuration") || "null"); } catch (_) {}
  const raw = tagOf(field, "covered_cultivation") || (cfg && cfg.covered_cultivation != null ? String(cfg.covered_cultivation) : "");
  return COVERED.includes(raw.trim().toLowerCase()) ? "greenhouse" : "field";
}

/* Τα id οργάνων που δηλώνει ο αγρός (ετικέτα devices), χωρίς διπλά. */
function deviceIdsOf(field) {
  let map;
  try { map = JSON.parse(tagOf(field, "devices") || "{}") || {}; } catch (_) { map = {}; }
  return [...new Set(Object.values(map).filter((id) => typeof id === "string" && id))];
}

/* Ένα φυσικό όργανο χρεώνεται ΜΙΑ φορά, όσες εγγραφές κι αν το δηλώνουν (π.χ. ο σταθμός του ξενοδοχείου
   είναι σε κάθε ζώνη). Εγγραφή «καλυμμένη» = όλα της τα όργανα υπάρχουν σε άλλη εγγραφή του ΙΔΙΟΥ πελάτη (ή
   εγγραφή χωρίς πελάτη), ίδια ή μεγαλύτερη· σε ίδιες, καλυμμένη η νεότερη. Χρεώνεται η παλαιότερη μη καλυμμένη
   εγγραφή που το δηλώνει· αν είναι άλλου πελάτη, το widget το δείχνει ως «θέλει απόφαση».
   Με απόφαση στο BILLING_PAYS χρεώνεται η εγγραφή της απόφασης (decided), που τότε δεν λογίζεται καλυμμένη.
   Επιστρέφει { owner: {id οργάνου → id αγρού}, covered: Set(id αγρών), client: {id αγρού → πελάτης}, decided: Set(id οργάνων) }. */
const clientKeyOf = (f) => tagOf(f, "clientId_field") || tagOf(f, "clientName").trim();

/* ΑΠΟΦΑΣΕΙΣ ΧΡΕΩΣΗΣ (Μιχάλης, 8/11/2026) για όργανα δηλωμένα σε εγγραφές ΔΙΑΦΟΡΕΤΙΚΩΝ πελατών: εγγραφή αγρού → όργανα
   που πληρώνει. Υπερισχύει της «παλαιότερης εγγραφής» και ισχύει μόνο όσο η εγγραφή δηλώνει το όργανο. Η θέση κρίθηκε από
   την πύλη LoRaWAN που ακούει το όργανο (lrruuid/lrrid, 8/11), όχι από τις ετικέτες. Οι εγγραφές αγρών ΔΕΝ αλλάζουν εδώ. */
const BILLING_PAYS = {
  // αγόρασε τα όργανα που λειτουργούν σε σχολείο· τα δηλώνουν και οι δύο εγγραφές του σχολείου
  "6a7462748acfb8000cd40c6e": ["6a313a9bb99739000d4aafa9", "69f85c07f79d76000a2baf05", "69f85d886b36a6000ab90fa4", "69f85e0aef3625000f9a9587",
    "6a7446498acfb8000ccca926", "69f1c0c03766b6000ba2bdff", "6977952a05f6ae0009e7e211", "6a749040f99707000cb101f2"],
  // μετεωρολογικός σταθμός δήμου (το δηλώνει και ιδιωτική εγγραφή)
  "693814a57efb7e000b0d0d25": ["684c342a13af9d000a77bef3"],
  // ελεγκτής βανών: ακούγεται από τις ίδιες πύλες με τα όργανα αυτού του αγρού· έμεινε δηλωμένος στον πειραματικό αγρό
  "69b28228439c11000a7fb3aa": ["684c42522cbc3d000a4faae9"],
  // πειραματικός αγρός: όργανα που ακούει η πύλη του (τα δηλώνουν και εγγραφές πελατών/συνεργατών)
  "69277948c4e6a4000afcd3b4": ["684c2c4ddf4dd2000a10106a", "68d668ba47d533000a48f00e", "680e8a1c40a654000ac660de"],
};

function billingOwners(fields, pays = BILLING_PAYS) {
  const client = {};
  const sets = (fields || []).map((f) => { client[String(f.id)] = clientKeyOf(f); return { id: String(f.id), c: clientKeyOf(f), ids: deviceIdsOf(f) }; })
    .sort((a, b) => a.id.localeCompare(b.id));
  const covered = new Set();
  for (const a of sets) {
    if (!a.ids.length) continue;
    for (const o of sets) {
      if (o === a || (a.c && o.c && a.c !== o.c) || o.ids.length < a.ids.length || !a.ids.every((x) => o.ids.includes(x))) continue;
      if (o.ids.length > a.ids.length || o.id < a.id) { covered.add(a.id); break; }
    }
  }
  const owner = {};
  const decided = new Set();
  for (const a of sets) for (const x of (pays && pays[a.id]) || []) {
    if (!a.ids.includes(x) || decided.has(x)) continue;
    owner[x] = a.id; decided.add(x); covered.delete(a.id);
  }
  for (const pass of [false, true]) for (const a of sets) {
    if (covered.has(a.id) !== pass) continue;
    for (const x of a.ids) if (!owner[x]) owner[x] = a.id;
  }
  return { owner, covered, client, decided };
}

/* Τα όργανα που χρεώνονται σε ΑΥΤΟΝ τον αγρό, ανά τύπο: [[τύπος, πλήθος, σήματα, κλίμακα], ...].
   Άγνωστος τύπος → σήματα/κλίμακα null. Με owner, όσα χρεώνονται σε άλλη εγγραφή μένουν έξω. */
function signalsOf(field, typeById, owner) {
  const g = {};
  for (const id of deviceIdsOf(field)) {
    if (owner && owner[id] && owner[id] !== String(field.id)) continue;
    const t = String((typeById && typeById[id]) || "?").toLowerCase();
    g[t] = (g[t] || 0) + 1;
  }
  return Object.keys(g).sort().map((t) => (SIGNALS[t] ? [t, g[t], SIGNALS[t], tierOf(SIGNALS[t])] : [t, g[t], null, null]));
}

/* Τα κοινά όργανα του αγρού που χρεώνονται αλλού: [[τύπος, όνομα εγγραφής που χρεώνεται, x], ...] με x = 0 ίδιος
   πελάτης, 1 άλλος πελάτης χωρίς απόφαση (το widget ανοίγει αίτημα), 2 άλλος πελάτης με απόφαση στο BILLING_PAYS. */
function sharedOf(field, typeById, owner, nameOf, client, decided) {
  const out = [];
  const mine = client ? client[String(field.id)] : "";
  for (const id of deviceIdsOf(field)) {
    const o = owner && owner[id];
    if (!o || o === String(field.id)) continue;
    const other = client && mine && client[o] && client[o] !== mine ? (decided && decided.has(id) ? 2 : 1) : 0;
    out.push([String((typeById && typeById[id]) || "?").toLowerCase(), String((nameOf && nameOf[o]) || "—").slice(0, 80), other]);
  }
  return out.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
}

/* Οι τιμές συνδρομών όπως είναι στο TagoIO (συσκευές με ετικέτα subscriptionConfiguration=yes): μόνο αριθμητικές ετικέτες. */
function pricingOf(devices) {
  return (devices || []).slice(0, 3).map((d) => {
    const p = {};
    for (const t of d.tags || []) {
      const raw = String(t && t.value != null ? t.value : "").trim().replace(",", ".");
      if (!t || t.key === "subscriptionConfiguration" || raw === "" || !isFinite(Number(raw))) continue;
      p[t.key] = Number(raw);
    }
    return { n: String(d.name || "").slice(0, 60), p };
  });
}

function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/* Η εικόνα που διαβάζει το widget. Κάθε εγγραφή: k=c πελάτης, k=f αγρός. */
function buildItems(clients, fields, dashboards, users, typeById) {
  const dash = new Map(dashboards.map((d) => [d.id, d]));
  const fieldDashIds = new Set(fields.map((f) => tagOf(f, "fieldId")).filter(Boolean));
  const accessOf = (tags) => (tags || []).filter((t) => t.key === "access").map((t) => String(t.value));
  const customerUsers = users.filter((u) => !accessOf(u.tags).includes(MANAGER));
  const bill = typeById ? billingOwners(fields) : null;
  // Όνομα για αναφορά σε άλλη εγγραφή: το όνομα συσκευής (η ετικέτα name συμπίπτει μερικές φορές), και αν
  // κι αυτό συμπίπτει, με τα 4 τελευταία του id.
  const nameOf = {}, seen = {};
  const devName = (f) => String(f.name || "").replace(/^Field_/, "").trim() || tagOf(f, "name");
  for (const f of fields) seen[devName(f)] = (seen[devName(f)] || 0) + 1;
  for (const f of fields) nameOf[String(f.id)] = devName(f) + (seen[devName(f)] > 1 ? " #" + String(f.id).slice(-4) : "");

  const fItems = fields.map((f) => {
    const did = tagOf(f, "fieldId");
    const d = dash.get(did);
    const state = tagOf(f, "subscriptionState") || "active";
    let live = d ? customerAccess(d.tags) : [];
    if (state !== "active") { try { live = JSON.parse(tagOf(f, "subscriptionSavedAccess")) || []; } catch (_) { live = []; } }
    const values = live.map((t) => String(t.value));
    const end = parseEnd(tagOf(f, "subscriptionEnd"));
    const it = {
      k: "f", i: f.id,
      n: tagOf(f, "name") || String(f.name || "").replace(/^Field_/, ""),
      c: tagOf(f, "clientId_field"),
      s: state,
      e: end.date,
      cost: tagOf(f, "subscriptionCurrentCost"),
      list: tagOf(f, "subscriptionCost"),
      u: customerUsers.filter((u) => accessOf(u.tags).some((v) => values.includes(v))).map((u) => u.name || u.email),
    };
    if (end.odd) it.odd = 1;
    if (did) it.d = did;
    if (!d) it.nod = 1;
    if (values.includes(PUBLIC)) it.pub = 1;
    const ctrl = controllersOf(f).length;
    if (ctrl) it.ct = ctrl;
    const at = tagOf(f, "subscriptionStateAt");
    if (at) it.at = at;
    it.cat = siteClassOf(f);
    const cn = tagOf(f, "clientName");
    if (cn) it.cn = cn.slice(0, 80);
    if (bill) {
      it.sg = signalsOf(f, typeById, bill.owner);
      const sh = sharedOf(f, typeById, bill.owner, nameOf, bill.client, bill.decided);
      if (sh.length) it.sh = sh;
      if (bill.covered.has(String(f.id))) it.dup = 1;
    }
    return it;
  }).sort((a, b) => a.n.localeCompare(b.n, "el"));

  const cItems = clients.map((c) => {
    const values = new Set([tagOf(c, "access")].filter(Boolean));
    for (const f of fItems) {
      if (f.c !== c.id) continue;
      const d = dash.get(f.d);
      for (const t of d ? customerAccess(d.tags) : []) if (t.value !== PUBLIC) values.add(String(t.value));
    }
    // Άλλα dashboards του πελάτη, που η παύση αγρού ΔΕΝ κρύβει (π.χ. «Εξαγωγή δεδομένων»).
    const other = dashboards
      .filter((d) => !fieldDashIds.has(d.id) && d.id !== RENEW_DASHBOARD && customerAccess(d.tags).some((t) => values.has(String(t.value))))
      .map((d) => d.label);
    const it = {
      k: "c", i: c.id,
      n: String(tagOf(c, "name") || c.name || "").trim(),
      m: tagOf(c, "email"),
      p: tagOf(c, "phone"),
    };
    if (other.length) it.ox = other.slice(0, 12);
    return it;
  }).sort((a, b) => a.n.localeCompare(b.n, "el"));

  return [...cItems, ...fItems];
}

/* ═══ ΚΛΗΣΕΙΣ ΣΤΟ TAGOIO ═══ */

async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}

async function listAll(base, query) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api(`${base}?page=${page}&amount=200&${query}`);
    out.push(...(r || []));
    if (!r || r.length < 200) break;
  }
  return out;
}

const deviceFields = ["id", "name", "tags"].map((f) => `fields[]=${f}`).join("&");
const listDevicesByTag = (key, value) => listAll("/device",
  `filter[tags][0][key]=${encodeURIComponent(key)}&filter[tags][0][value]=${encodeURIComponent(value)}&${deviceFields}`);
const listDashboards = () => listAll("/dashboard", ["id", "label", "tags"].map((f) => `fields[]=${f}`).join("&"));
const listUsers = () => listAll("/run/users", ["id", "name", "email", "tags"].map((f) => `fields[]=${f}`).join("&"));

const writeOverseer = (rows) => api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify(rows) });

/* Ποιες βάνες του αγρού είναι ανοιχτές. Επιστρέφει { open: [...], unknown: [...] }. */
async function valveStatus(field) {
  const open = [], unknown = [];
  for (const c of controllersOf(field)) {
    for (const v of ["valve_1", "valve_2"]) {
      try {
        const rows = await api(`/device/${c.id}/data?variables[]=${v}&qty=1`);
        if (rows && rows[0] && String(rows[0].value).toLowerCase() === "on") open.push(`${c.n} ${v}`);
      } catch (e) {
        unknown.push(`${c.n} ${v}`);
      }
    }
  }
  return { open, unknown };
}

async function syncRenewDashboard() {
  const fields = [...await listDevicesByTag("isField", "yes"), ...await listDevicesByTag("subscriptionSandbox", "yes")];
  const cur = await api(`/dashboard/${RENEW_DASHBOARD}`);
  const tags = renewTags(cur.tags, fields);
  await api(`/dashboard/${RENEW_DASHBOARD}`, { method: "PUT", body: JSON.stringify({ tags }) });
  return tags.filter((t) => t.key === "access").length - 1;
}

/* Μία ενέργεια σε έναν αγρό. */
async function applyToField(action, fieldId, md) {
  const field = await api(`/device/${fieldId}`);
  const name = tagOf(field, "name") || field.name;
  const did = tagOf(field, "fieldId");
  const dashboard = did ? await api(`/dashboard/${did}`).catch(() => null) : null;

  const plan = planAction(action, field, dashboard);
  if (plan.error) return { id: fieldId, name, status: "fail", msg: plan.error };

  if (action !== "resume" && !md.confirm_open) {
    const v = await valveStatus(field);
    if (v.open.length || v.unknown.length) {
      const parts = [];
      if (v.open.length) parts.push(`Ανοιχτές βάνες: ${v.open.join(", ")}`);
      if (v.unknown.length) parts.push(`Άγνωστη κατάσταση: ${v.unknown.join(", ")}`);
      return { id: fieldId, name, status: "needs_confirm", msg: parts.join(". ") + ". Ο πελάτης δεν θα μπορεί να τις κλείσει." };
    }
  }

  if (md.dry_run) {
    console.log(`DRY_RUN|${action}|${name}|κατάσταση→${plan.state}|αφαιρούνται=${JSON.stringify((plan.saved || []).map((t) => t.value))}`);
    return { id: fieldId, name, status: "dry_run", msg: `Δοκιμή: καμία αλλαγή. Θα γινόταν ${plan.state}.` };
  }

  // Η σειρά είναι σκόπιμη. Στην παύση το αντίγραφο γράφεται ΠΡΙΝ αφαιρεθούν οι ετικέτες. Στην επαναφορά οι
  // ετικέτες επιστρέφουν ΠΡΙΝ σβηστεί το αντίγραφο. Μια αποτυχία στη μέση δεν χάνει ποτέ την πρόσβαση.
  if (action === "resume") {
    await api(`/dashboard/${did}`, { method: "PUT", body: JSON.stringify({ tags: plan.dashboardTags }) });
    await api(`/device/${fieldId}`, { method: "PUT", body: JSON.stringify({ tags: plan.fieldTags }) });
  } else {
    await api(`/device/${fieldId}`, { method: "PUT", body: JSON.stringify({ tags: plan.fieldTags }) });
    if (plan.dashboardTags) await api(`/dashboard/${did}`, { method: "PUT", body: JSON.stringify({ tags: plan.dashboardTags }) });
  }
  return { id: fieldId, name, status: "ok", msg: "", client: tagOf(field, "clientName"), state: plan.state };
}

async function writeSnapshot(force) {
  const t0 = Date.now();
  const [clients, fields, dashboards, users] = await Promise.all([
    listDevicesByTag("isClient", "yes"), listDevicesByTag("isField", "yes"), listDashboards(), listUsers(),
  ]);
  // Τύποι οργάνων και τιμές συνδρομών: μία λίστα συσκευών. Από τις ετικέτες κρατάμε ΜΟΝΟ τον τύπο και τις
  // αριθμητικές τιμές της συσκευής τιμών· τίποτα άλλο δεν γράφεται ούτε τυπώνεται. Αν αποτύχει, η εικόνα γράφεται χωρίς αυτά.
  let typeById = null, pricing = null;
  try {
    const all = await listAll("/device", ["id", "name", "tags"].map((f) => `fields[]=${f}`).join("&"));
    typeById = {};
    for (const d of all) { const t = tagOf(d, "type"); if (t) typeById[d.id] = t; }
    pricing = pricingOf(all.filter((d) => tagOf(d, "subscriptionConfiguration") === "yes"));
  } catch (e) { console.log("ΧΩΡΙΣ ΤΥΠΟΥΣ/ΤΙΜΕΣ|" + String((e && e.message) || e).slice(0, 120)); }
  const items = buildItems(clients, fields, dashboards, users, typeById);
  const hash = hashOf(JSON.stringify([items, pricing]));

  let prev = null;
  try { prev = ((await api(`/device/${OVERSEER}/data?variables[]=subs_summary&qty=1`)) || [])[0] || null; } catch (_) {}
  const prevHash = prev && prev.metadata && prev.metadata.hash;
  const ageH = prev ? (t0 - new Date(prev.time).getTime()) / 36e5 : Infinity;
  const fs = items.filter((x) => x.k === "f");
  const byCat = {};
  for (const x of fs) byCat[x.cat] = (byCat[x.cat] || 0) + 1;
  const unk = fs.reduce((a, x) => a + (x.sg || []).filter((g) => g[2] == null).reduce((b, g) => b + g[1], 0), 0);
  const counts = `πελάτες=${clients.length}|αγροί=${fs.length}|παύση=${fs.filter((x) => x.s === "paused").length}|διακοπή=${fs.filter((x) => x.s === "stopped").length}` +
    `|περιπτώσεις=${JSON.stringify(byCat)}|όργανα χωρίς κλίμακα=${unk}|τιμές=${pricing ? pricing.map((x) => Object.keys(x.p).length).join("+") : "-"}`;
  if (prevHash === hash && ageH < HEARTBEAT_H && !force) {
    console.log(`ΑΜΕΤΑΒΛΗΤΗ|${counts}|πριν ${ageH.toFixed(1)}ω`);
    return;
  }
  const group = String(t0);
  const chunks = chunkBySize(items, MAX_CHUNK_BYTES);
  const rows = chunks.map((list, idx) => ({ variable: "subs_chunk", value: idx, group, metadata: { items: list, part: idx, parts: chunks.length } }));
  rows.push({
    variable: "subs_summary", value: `${fs.length} αγροί`, group,
    metadata: { hash, parts: chunks.length, clients: clients.length, fields: fs.length, pricing, signals: SIGNALS, tiers: TIERS },
  });
  await writeOverseer(rows);
  console.log(`ΓΡΑΦΤΗΚΕ|${counts}|εγγραφές=${rows.length}|hash=${hash}`);
}

function readScope() {
  let sc = null;
  try { sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); } catch (_) {}
  return Array.isArray(sc) ? sc : sc ? [sc] : [];
}

async function main() {
  console.log("══ subscriptionManage T-SUBS-01 · " + new Date().toISOString() + " ══");
  const scope = readScope();

  // Μία φορά κατά την εγκατάσταση: ομαδοποίηση στο μενού (το MCP δεν ορίζει group_by).
  if (scope.some((s) => s && s.setup_group_by)) {
    await api(`/dashboard/${BOARD_DASHBOARD}`, { method: "PUT", body: JSON.stringify({ group_by: ["dashboardGroupGeneral", "dashboardGroup"] }) });
    console.log("ΟΜΑΔΟΠΟΙΗΣΗ|ok");
  }

  const cmd = scope.find((s) => s && s.variable === "subs_command");
  if (!cmd) {
    await writeSnapshot(scope.some((s) => s && s.force));
    console.log("══ ΤΕΛΟΣ ══");
    return;
  }

  const md = cmd.metadata || {};
  const action = String(md.action || "");
  if (action === "refresh") {
    await writeSnapshot(true);
    console.log("══ ΤΕΛΟΣ ══");
    return;
  }

  const ids = Array.isArray(md.field_ids) ? md.field_ids.map(String) : [];
  const results = [];
  for (const id of ids) {
    try {
      results.push(await applyToField(action, id, md));
    } catch (e) {
      results.push({ id, name: id, status: "fail", msg: String((e && e.message) || e).slice(0, 200) });
    }
  }
  for (const r of results) console.log(`ΑΠΟΤΕΛΕΣΜΑ|${action}|${r.name}|${r.status}|${r.msg}`);

  const done = results.filter((r) => r.status === "ok");
  const warnings = [];
  if (done.length) {
    try {
      const n = await syncRenewDashboard();
      console.log(`ΑΝΑΝΕΩΣΗ|ετικέτες πελατών=${n}`);
    } catch (e) {
      warnings.push("Δεν ενημερώθηκε το μήνυμα ανανέωσης: " + String((e && e.message) || e).slice(0, 120));
      console.log("ΣΦΑΛΜΑ ΑΝΑΝΕΩΣΗΣ|" + ((e && e.message) || e));
    }
  }

  const at = new Date().toISOString();
  const rows = done.map((r) => ({
    variable: "subs_log", value: `${action}: ${r.name}`,
    metadata: { at, by: String(md.by || "—").slice(0, 80), action, field_id: r.id, field: r.name, client: r.client || "", reason: String(md.reason || "").slice(0, 200) },
  }));
  rows.push({
    variable: "subs_result", value: results.every((r) => r.status === "ok" || r.status === "dry_run") ? "ok" : "attention",
    metadata: { req: String(md.req || ""), action, at, results: results.map((r) => ({ id: r.id, name: r.name, status: r.status, msg: r.msg })), warnings },
  });
  await writeOverseer(rows);
  await writeSnapshot(true);
  console.log("══ ΤΕΛΟΣ ══");
}

if (require.main === module || process.env.T_ANALYSIS_TOKEN) {
  main().catch((e) => {
    console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
    console.log("══ ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
  });
}
if (typeof module !== "undefined") {
  module.exports = { parseEnd, controllersOf, planAction, renewTags, chunkBySize, buildItems, customerAccess, tagOf,
    siteClassOf, signalsOf, sharedOf, billingOwners, deviceIdsOf, tierOf, pricingOf, SIGNALS, TIERS, BILLING_PAYS };
}
