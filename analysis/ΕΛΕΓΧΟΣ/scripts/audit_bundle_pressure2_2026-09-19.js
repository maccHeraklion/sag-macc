// SAG · ΕΛΕΓΧΟΣ ΠΙΕΣΗΣ BUNDLE — ΜΟΝΟ ΑΝΑΓΝΩΣΗ (19/9/2026)
//
// ΤΙ ΑΠΑΝΤΑ: «ποιοι αγροί χάνουν κείμενα καρτών επειδή το field_bundle δεν χωράει
// στα 10 kB, και ΠΟΙΑ κείμενα». Ο πυρήνας το λέει στο log (`SAG-BUNDLE-FIT-01`)
// αλλά ΧΩΡΙΣ όνομα αγρού και χωρίς λίστα — δηλαδή δεν μπορείς να δράσεις πάνω του.
// Εδώ αποσυμπιέζεται το ίδιο το bundle και μετριούνται οι δείκτες με `_trunc`.
//
// ΕΥΡΗΜΑ 19/9 14:05 UTC (μητρώο Κ18): 8 αγροί χάνουν κείμενα ΚΑΘΕ ΜΕΡΑ —
//   KEK - Αγρός 113/412 δείκτες (9.196 B, 4 καλλιέργειες) · Ρηγάκης 19 · ΚΥΔΩΝ 10 ·
//   Κουκιά 9 · Βενζινάδικο 8 · ΚΑΜΠΑΝΗΣ 7 · Μεγάλη Ντάμα 7 · Καμπιτάκης 6.
//   Στους 6 από τους 8 τα κομμένα είναι `soil_ec_status` / `salinity_stress` —
//   η ετυμηγορία αλατότητας της Φάσης Α, που είναι ΟΛΗ κείμενο.
//
// ΤΡΕΞΙΜΟ: ανεβαίνει στη θέση probe (analysis 6aa2d24f2f585a000b90b1a1, node-rt2025)
// με ενεργή ΜΟΝΟ την πολιτική ΑΝΑΓΝΩΣΗΣ 6aa2e0cf8592a5000bec9547. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}

// Ο πυρήνας συμπιέζει με deflate-raw + base64 (compressFieldBundle). Δοκιμάζουμε
// ΚΑΙ το απλό inflate για παλιότερες εγγραφές — ποτέ δεν υποθέτουμε μορφή.
function unpack(b64) {
  try { return JSON.parse(zlib.inflateRawSync(Buffer.from(b64, "base64")).toString("utf8")); }
  catch (e) {
    try { return JSON.parse(zlib.inflateSync(Buffer.from(b64, "base64")).toString("utf8")); }
    catch (e2) { return null; }
  }
}

(async () => {
  console.log("=== BUNDLE PRESSURE 2 (μετά v50.145) · " + new Date().toISOString() + " ===");
  // ΒΑΣΗ ΣΥΓΚΡΙΣΗΣ — το ίδιο probe, 19/9 14:05 UTC, πυρήνας v50.142 (πριν τη δίαιτα).
  const BASE = { "KEK - Αγρός": [9196, 113], "ΚΟΥΤΣΑΚΗΣ ΜΙΧΑΛΗΣ": [9092, 0],
    "Καμπιτάκης BIO Olive Oil": [9036, 6], "Κουκιά": [9016, 9],
    "Ρηγάκης Αντώνης": [8972, 19], "Βενζινάδικο": [8812, 8],
    "ΚΑΜΠΑΝΗΣ ΧΡΗΣΤΟΣ": [8772, 7], "ΚΥΔΩΝ": [8596, 10],
    "ΓΡΙΝΙΑΡΑΚΗΣ ΓΙΑΝΝΗΣ ΑΓΓΟΥΡΙ": [8504, 0], "Μεγάλη Ντάμα": [8344, 7],
    "Α2 - Σταυρακάκης": [8308, 0], "Β1 - Πριναρης": [8264, 0] };
  let devs = [];
  try {
    devs = await api("/device?amount=200&fields[]=id&fields[]=name&fields[]=tags"
      + "&filter[tags][0][key]=isField&filter[tags][0][value]=yes");
  } catch (e) { console.log("ERR|devices: " + e.message); return; }
  console.log("FIELDS|" + devs.length);

  const rows = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < devs.length) {
      const d = devs[i++];
      const nm = ((d.tags || []).find(t => t.key === "name") || {}).value || d.name;
      try {
        const r = await api(`/device/${d.id}/data?variables[]=field_bundle&qty=1`);
        const p = (r || [])[0];
        if (!p || !p.metadata || !p.metadata.data) { rows.push({ n: nm, b: null }); continue; }
        const b64 = p.metadata.data;
        const o = unpack(b64);
        if (!o) { rows.push({ n: nm, b: b64.length, bad: 1 }); continue; }
        let trunc = [], total = 0, meth = 0;
        const scan = (box, pre) => {
          for (const [k, v] of Object.entries(box || {})) {
            if (!v || typeof v !== "object") continue;
            total++;
            // `_trunc` το βάζει ο SAG-BUNDLE-FIT-01 όταν σβήνει το metadata.text:
            // η ΤΙΜΗ μένει, η ΕΞΗΓΗΣΗ φεύγει — ο παραγωγός βλέπει ετικέτα χωρίς λόγο.
            if (v.metadata && v.metadata._trunc) trunc.push(pre + k);
            // `_m` το βάζει το T-METHODCARD-01 (v50.146): το κείμενο μετακόμισε,
            // δεν χάθηκε. Δεν πρέπει να φαίνεται ακόμη — ο 16:20 έτρεξε με v50.145.
            if (v.metadata && v.metadata._m) meth++;
          }
        };
        scan(o.shared, "");
        for (const c of (o.crops || [])) scan(c.indicators, (c.cultivation_type || c.id || "?") + "/");
        const _rx = /soil_ec_status|salinity_stress/, _ru = /upgrade_opportunities/;
        rows.push({ n: nm, b: b64.length, t: trunc.length, tot: total, m: meth,
          sal: trunc.some((x) => _rx.test(x)) ? 1 : 0, upg: trunc.some((x) => _ru.test(x)) ? 1 : 0,
          names: trunc.slice(0, 8), at: p.time });
      } catch (e) { rows.push({ n: nm, b: null, e: e.message.slice(0, 60) }); }
    }
  }));

  rows.sort((a, b) => (b.b || 0) - (a.b || 0));
  const dlt = (v, b) => (b == null ? "—" : (v - b >= 0 ? "+" : "") + (v - b));
  for (const r of rows.slice(0, 14)) {
    const b = BASE[r.n];
    console.log(`B|${r.n}|bytes=${r.b} (${dlt(r.b, b && b[0])})|δείκτες=${r.tot}`
      + `|κομμένα=${r.t} (${dlt(r.t, b && b[1])})|_m=${r.m}|t=${r.at}`
      + (r.names && r.names.length ? "|" + r.names.join(",") : "")
      + (r.e ? "|ERR " + r.e : ""));
  }
  // 9.200 είναι το πλαφόν του φρουρού (_SAG_BUNDLE_MAX_B64)· στα 8.500 είσαι ήδη
  // στο χείλος και η επόμενη καλλιέργεια ή ο επόμενος δείκτης σε ρίχνει μέσα.
  const over = rows.filter(r => (r.b || 0) > 8500);
  const cut = rows.filter(r => (r.t || 0) > 0);
  const sumT = rows.reduce((a, r) => a + (r.t || 0), 0);
  const sumM = rows.reduce((a, r) => a + (r.m || 0), 0);
  const withB = rows.filter(r => r.b != null);
  console.log(`SUMMARY|αγροί=${rows.length}|με bundle=${withB.length}`
    + `|>8500B=${over.length} (${over.map(r => r.n).join(", ")})`
    + `|με κομμένα κείμενα=${cut.length} (${cut.map(r => r.n + ":" + r.t).join(", ")})`
    + `|ΣΥΝΟΛΟ κομμένων=${sumT} (βάση 14:05 = 185)|_m συνολικά=${sumM} (αναμενόμενο 0 πριν τον 17:20)`);
  // Η ετυμηγορία αλατότητας είναι ο λόγος του v50.144: ΔΕΝ επιτρέπεται να κόβεται πια.
  const sal = rows.filter(r => r.sal);
  console.log(`ΑΛΑΤΟΤΗΤΑ|αγροί που ΑΚΟΜΗ χάνουν την ετυμηγορία=${sal.length}`
    + (sal.length ? " (" + sal.map(r => r.n).join(", ") + ")" : " — ΚΑΝΕΝΑΣ ✔")
    + `|εμπορικό upgrade_opportunities ακόμη κομμένο σε=${rows.filter(r => r.upg).length} αγρούς`);
  console.log("=== ΤΕΛΟΣ ===");
})();
