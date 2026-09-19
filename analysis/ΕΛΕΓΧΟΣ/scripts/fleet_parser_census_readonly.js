/* T-FLEET-PARSER-01 — ΑΠΟΓΡΑΦΗ PARSER ΑΝΑ ΣΥΣΚΕΥΗ · ΜΟΝΟ ΑΝΑΓΝΩΣΗ
 *
 * ΣΚΟΠΟΣ, ΣΤΕΝΟΣ ΕΠΙΤΗΔΕΣ: το μόνο κομμάτι της ανομοιογένειας που ΔΕΝ μπόρεσα
 * να μετρήσω απ' έξω. Τα connectors, οι αγροί και οι τύποι μετρήθηκαν ήδη τοπικά
 * (ΑΝΟΜΟΙΟΓΕΝΕΙΑ_ΣΤΟΛΟΥ_2026-09-19.md) — δεν τα ξαναμετράω εδώ, γιατί κώδικας
 * που δεν χρειάζεται είναι κώδικας που μπορεί να σφάλλει.
 *
 * ΔΥΟ ΕΡΩΤΗΜΑΤΑ:
 *   B) πόσες ΔΙΑΦΟΡΕΤΙΚΕΣ παραλλαγές parser υπάρχουν ανά τύπο συσκευής;
 *   C) υπάρχει ΑΛΛΗ συσκευή διπλοκωδικοποιημένη σαν αυτή που έσπασα; (παγίδα #225)
 *
 * ΑΣΦΑΛΕΙΑ: ΚΑΜΙΑ εγγραφή — μόνο GET σε /device. Δεν διαβάζει /data, άρα δεν
 * χρεώνει Data Output. Δεν αγγίζει άρδευση, βάνες, μετρητές, ρυθμίσεις.
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

/* Τα tags έρχονται ως πίνακας και η TagoIO επιτρέπει ΔΙΠΛΑ κλειδιά. Δεν τα
   διπλώνω σε αντικείμενο — το δίπλωμα κρατά μόνο το τελευταίο και έτσι χάθηκε
   η αλήθεια στην Αγχίαλο. */
function tagOne(tags, key) {
  const t = (tags || []).filter((x) => x && x.key === key);
  return t.length ? String(t[0].value) : "";
}

async function startAnalysis() {
  const t0 = Date.now();
  console.log("=== ΑΠΟΓΡΑΦΗ PARSER · " + new Date().toISOString() + " · ΜΟΝΟ ΑΝΑΓΝΩΣΗ ===");

  const F = ["id", "name", "tags", "connector"].map((f) => "fields[]=" + f).join("&");
  let devices = [], page = 1;
  while (page <= 10) {
    const b = await api(`/device?${F}&amount=200&page=${page}`);
    if (!b || !b.length) break;
    devices = devices.concat(b);
    if (b.length < 200) break;
    page++;
  }
  const typed = devices.filter((d) => tagOne(d.tags, "type"));
  console.log(`συσκευές=${devices.length} | με tag type=${typed.length}`);

  const byType = {};
  const doubleEncoded = [];
  let noParser = 0, readErr = 0, withParser = 0;

  for (const d of typed) {
    const ty = tagOne(d.tags, "type");
    if (!byType[ty]) byType[ty] = { n: 0, variants: {} };
    byType[ty].n++;

    let key = "— χωρίς δικό του parser —";
    try {
      const full = await api(`/device/${d.id}?fields[]=payload_decoder`);
      if (full && full.payload_decoder) {
        withParser++;
        const txt = Buffer.from(String(full.payload_decoder), "base64").toString("utf8");
        /* Αν το αποκωδικοποιημένο μοιάζει ΠΑΛΙ με base64 → διπλοκωδικοποιημένο. */
        if (/^[A-Za-z0-9+/=\s]{80,}$/.test(txt.slice(0, 200))) {
          doubleEncoded.push(d.name + " (" + d.id + ")");
          key = "✗✗ ΔΙΠΛΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟΣ";
        } else {
          /* Κανονικοποίηση πριν το hash: κενά και τέλη γραμμής ΔΕΝ είναι
             ουσιαστική διαφορά. Θέλω διαφορές ΛΟΓΙΚΗΣ, όχι μορφής. */
          const norm = txt.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
          key = crypto.createHash("sha256").update(norm).digest("hex").slice(0, 8)
              + " (" + norm.length + "χ)";
        }
      } else noParser++;
    } catch (e) { key = "ΣΦΑΛΜΑ ΑΝΑΓΝΩΣΗΣ"; readErr++; }

    const v = byType[ty].variants;
    if (!v[key]) v[key] = [];
    if (v[key].length < 4) v[key].push(d.name);
    else v[key].push(null); // μετράω, δεν κρατάω όλα τα ονόματα
  }

  console.log("");
  console.log("=== B · ΠΑΡΑΛΛΑΓΕΣ PARSER ΑΝΑ ΤΥΠΟ ===");
  console.log("(>1 παραλλαγή = η ίδια συσκευή μιλά διαφορετικά σε διαφορετικούς αγρούς)");
  const order = Object.keys(byType).sort((a, b) => byType[b].n - byType[a].n);
  for (const ty of order) {
    const e = byType[ty];
    const nv = Object.keys(e.variants).length;
    console.log(`\nΤΥΠΟΣ ${ty} · συσκευές=${e.n} · παραλλαγές=${nv}`
      + (nv > 1 ? "   <<< ΔΙΑΦΟΡΕΤΙΚΕΣ" : ""));
    const ks = Object.keys(e.variants).sort((a, b) => e.variants[b].length - e.variants[a].length);
    for (const k of ks) {
      const names = e.variants[k].filter(Boolean);
      console.log(`   ${k} × ${e.variants[k].length}  π.χ. ${names.join(", ")}`);
    }
  }

  console.log("");
  console.log("=== C · ΔΙΠΛΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟΙ PARSERS (παγίδα #225) ===");
  console.log(doubleEncoded.length
    ? "✗✗ ΒΡΕΘΗΚΑΝ " + doubleEncoded.length + ": " + doubleEncoded.join(" | ")
    : "✓ ΚΑΝΕΝΑΣ — ο στόλος είναι καθαρός.");
  console.log(`με δικό τους parser=${withParser}|χωρίς=${noParser}|σφάλματα=${readErr}`);
  console.log(`\n=== ΤΕΛΟΣ · ms=${Date.now() - t0} ===`);
}

module.exports = { startAnalysis };
startAnalysis().catch((e) => console.log("ΣΦΑΛΜΑ|" + (e && e.message)));
