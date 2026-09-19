/* T-FLEET-CENSUS-01 — ΑΠΟΓΡΑΦΗ ΑΝΟΜΟΙΟΓΕΝΕΙΑΣ ΣΤΟΛΟΥ · ΜΟΝΟ ΑΝΑΓΝΩΣΗ
 *
 * ΓΙΑΤΙ: κάθε αγρός λειτουργεί διαφορετικά — άλλοι connectors, άλλοι parsers,
 * άλλοι αισθητήρες. Πριν ενοποιήσουμε ΟΤΙΔΗΠΟΤΕ πρέπει να ξέρουμε ΤΙ ακριβώς
 * διαφέρει και ΠΟΣΟ. Δεν μαντεύουμε· μετράμε.
 *
 * ΑΣΦΑΛΕΙΑ: ΚΑΜΙΑ εγγραφή. Μόνο GET σε /device (μεταδεδομένα). Δεν διαβάζει
 * /data, άρα δεν χρεώνει Data Output. Δεν αγγίζει άρδευση, βάνες, μετρητές.
 *
 * ΒΓΑΖΕΙ:
 *   A) ανά τύπο συσκευής: πόσοι ΔΙΑΦΟΡΕΤΙΚΟΙ connectors χρησιμοποιούνται
 *   B) ανά τύπο συσκευής: πόσες ΔΙΑΦΟΡΕΤΙΚΕΣ παραλλαγές parser υπάρχουν
 *   C) σάρωση ΟΛΟΥ του στόλου για διπλοκωδικοποιημένους parsers (παγίδα #225)
 *   D) ανά αγρό: ποιους τύπους αισθητήρων έχει και ποιους ΔΕΝ έχει
 */
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const crypto = require("crypto");

async function api(path) {
  const r = await fetch("https://api.tago.io" + path, {
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  });
  const j = await r.json();
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}

/* Τα tags έρχονται ως πίνακας. ΠΟΤΕ δεν τα διπλώνω σε αντικείμενο — η TagoIO
   επιτρέπει ΔΙΠΛΑ κλειδιά και το δίπλωμα κρατά μόνο το τελευταίο. Αυτό ακριβώς
   με ξεγέλασε στην Αγχίαλο. Επιστρέφω ΟΛΕΣ τις τιμές. */
function tagVals(tags, key) {
  return (tags || []).filter((t) => t && t.key === key).map((t) => String(t.value));
}
function tagOne(tags, key) {
  const v = tagVals(tags, key);
  return v.length ? v[0] : "";
}

function bump(map, k, sample) {
  if (!map[k]) map[k] = { n: 0, samples: [] };
  map[k].n++;
  if (map[k].samples.length < 3 && sample) map[k].samples.push(sample);
}

async function startAnalysis() {
  const t0 = Date.now();
  console.log("=== ΑΠΟΓΡΑΦΗ ΣΤΟΛΟΥ · " + new Date().toISOString() + " · ΜΟΝΟ ΑΝΑΓΝΩΣΗ ===");

  /* ---- 1. Κατέβασμα ΟΛΩΝ των συσκευών (μεταδεδομένα μόνο) ---- */
  const FIELDS = ["id", "name", "active", "tags", "network", "connector", "last_input", "type"]
    .map((f) => "fields[]=" + f).join("&");
  let devices = [], page = 1;
  while (page <= 10) {
    const batch = await api(`/device?${FIELDS}&amount=200&page=${page}`);
    if (!batch || !batch.length) break;
    devices = devices.concat(batch);
    if (batch.length < 200) break;
    page++;
  }
  console.log(`ΣΥΝΟΛΟ ΣΥΣΚΕΥΩΝ=${devices.length} (σελίδες=${page})`);

  /* ---- 2. Ξεχώρισμα αγρών από αισθητήρες ---- */
  const fields = devices.filter((d) => tagOne(d.tags, "isField") === "yes");
  const sensors = devices.filter((d) => tagOne(d.tags, "isField") !== "yes");
  console.log(`ΑΓΡΟΙ=${fields.length}|ΑΙΣΘΗΤΗΡΕΣ+ΛΟΙΠΑ=${sensors.length}`);

  /* ---- 3. Parser ανά συσκευή. Ένα GET τη συσκευή — ο parser ΔΕΝ έρχεται
          στη λίστα. Μόνο για όσες έχουν tag `type` (δηλ. πραγματικοί
          αισθητήρες πεδίου), για να μη σαρώσω 220 άσχετα. ---- */
  const typed = sensors.filter((d) => tagOne(d.tags, "type"));
  console.log(`ΜΕ ΤΥΠΟ (πραγματικοί αισθητήρες)=${typed.length} — διαβάζω parser για καθέναν…`);

  const byType = {};            // type -> { conn:{}, parser:{}, net:{} }
  const doubleEncoded = [];     // παγίδα #225, σάρωση ΟΛΟΥ του στόλου
  const noParser = [];
  let readErr = 0;

  for (const d of typed) {
    const ty = tagOne(d.tags, "type");
    if (!byType[ty]) byType[ty] = { conn: {}, parser: {}, net: {}, n: 0 };
    byType[ty].n++;
    bump(byType[ty].conn, String(d.connector || "—"), d.name);
    bump(byType[ty].net, String(d.network || "—"), d.name);

    let key = "ΧΩΡΙΣ PARSER";
    try {
      const full = await api(`/device/${d.id}?fields[]=payload_decoder`);
      if (full && full.payload_decoder) {
        const txt = Buffer.from(String(full.payload_decoder), "base64").toString("utf8");
        const looksB64 = /^[A-Za-z0-9+/=\s]{80,}$/.test(txt.slice(0, 200));
        if (looksB64) {
          doubleEncoded.push(d.name + " (" + d.id + ")");
          key = "✗ ΔΙΠΛΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟΣ";
        } else {
          /* Κανονικοποίηση πριν το hash: κενά και τέλη γραμμής ΔΕΝ είναι
             ουσιαστική διαφορά. Θέλω να δω διαφορές ΛΟΓΙΚΗΣ, όχι μορφής. */
          const norm = txt.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
          key = crypto.createHash("sha256").update(norm).digest("hex").slice(0, 8)
              + " (" + norm.length + "χ)";
        }
      } else {
        noParser.push(d.name);
      }
    } catch (e) { key = "ΣΦΑΛΜΑ ΑΝΑΓΝΩΣΗΣ"; readErr++; }
    bump(byType[ty].parser, key, d.name);
  }

  /* ---- A + B: η ανομοιογένεια ανά τύπο ---- */
  console.log("");
  console.log("=== A+B · ΑΝΑ ΤΥΠΟ ΣΥΣΚΕΥΗΣ: CONNECTORS ΚΑΙ ΠΑΡΑΛΛΑΓΕΣ PARSER ===");
  console.log("(ένας τύπος με >1 connector ή >1 parser = ΑΝΟΜΟΙΟΓΕΝΕΙΑ προς ενοποίηση)");
  const types = Object.keys(byType).sort((a, b) => byType[b].n - byType[a].n);
  for (const ty of types) {
    const e = byType[ty];
    const nc = Object.keys(e.conn).length, np = Object.keys(e.parser).length;
    const flag = (nc > 1 || np > 1) ? "  <<< ΔΙΑΦΟΡΕΤΙΚΕΣ" : "";
    console.log(`\nΤΥΠΟΣ ${ty} · συσκευές=${e.n} · connectors=${nc} · parsers=${np}${flag}`);
    for (const c of Object.keys(e.conn).sort((a, b) => e.conn[b].n - e.conn[a].n))
      console.log(`   connector ${c} × ${e.conn[c].n}  π.χ. ${e.conn[c].samples.join(", ")}`);
    for (const p of Object.keys(e.parser).sort((a, b) => e.parser[b].n - e.parser[a].n))
      console.log(`   parser    ${p} × ${e.parser[p].n}  π.χ. ${e.parser[p].samples.join(", ")}`);
  }

  /* ---- C: η παγίδα #225 σε ΟΛΟ τον στόλο ---- */
  console.log("");
  console.log("=== C · ΣΑΡΩΣΗ ΓΙΑ ΔΙΠΛΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟΥΣ PARSERS (παγίδα #225) ===");
  console.log(doubleEncoded.length
    ? "✗✗ ΒΡΕΘΗΚΑΝ " + doubleEncoded.length + ": " + doubleEncoded.join(" | ")
    : "✓ ΚΑΝΕΝΑΣ. Ο στόλος είναι καθαρός.");
  console.log(`χωρίς parser συσκευής=${noParser.length}|σφάλματα ανάγνωσης=${readErr}`);

  /* ---- D: τι έχει ΚΑΙ τι ΔΕΝ έχει ο κάθε αγρός ---- */
  console.log("");
  console.log("=== D · ΑΝΑ ΑΓΡΟ: ΠΟΙΟΥΣ ΤΥΠΟΥΣ ΕΧΕΙ ===");
  const byId = {};
  for (const d of devices) byId[d.id] = d;
  const rows = [];
  for (const f of fields) {
    let ids = [];
    try { ids = JSON.parse(tagOne(f.tags, "devices") || "[]"); } catch (e) { ids = []; }
    const tys = [];
    for (const id of ids) {
      const s = byId[id];
      if (s) { const t = tagOne(s.tags, "type"); if (t && tys.indexOf(t) < 0) tys.push(t); }
    }
    rows.push({
      name: tagOne(f.tags, "name") || f.name,
      client: tagOne(f.tags, "clientName"),
      sub: tagOne(f.tags, "subscriptionActive"),
      n: ids.length,
      tys: tys.sort(),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rows)
    console.log(`Α|${r.name}|πελάτης=${r.client}|συνδρομή=${r.sub}|συσκευές=${r.n}|τύποι=${r.tys.join(",") || "—"}`);

  /* Ποιοι τύποι είναι σπάνιοι = εκεί ακριβώς είναι η ανισότητα μεταξύ αγρών. */
  const typeFieldCount = {};
  for (const r of rows) for (const t of r.tys) typeFieldCount[t] = (typeFieldCount[t] || 0) + 1;
  console.log("");
  console.log("=== D2 · ΣΕ ΠΟΣΟΥΣ ΑΓΡΟΥΣ ΥΠΑΡΧΕΙ ΚΑΘΕ ΤΥΠΟΣ (από " + rows.length + " αγρούς) ===");
  for (const t of Object.keys(typeFieldCount).sort((a, b) => typeFieldCount[b] - typeFieldCount[a]))
    console.log(`Τ|${t}|σε ${typeFieldCount[t]}/${rows.length} αγρούς`);

  console.log("");
  console.log(`=== ΤΕΛΟΣ · ms=${Date.now() - t0} ===`);
}

module.exports = { startAnalysis };
startAnalysis().catch((e) => console.log("ΣΦΑΛΜΑ|" + (e && e.message)));
