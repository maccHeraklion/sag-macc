// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Καλλιεργητικά ημερολόγια όλων των αγρών.
// Ερώτηση Μιχάλη 14/10: «δες τα δεδομένα που έχουν καταγραφεί στα ημερολόγια αγρού — έχουν επαρκή πληροφορία για
// να βελτιώσουμε αγρονομικά τις ρουτίνες υπολογισμών;»
// Διαβάζει από κάθε συσκευή αγρού (isField=yes):
//   field_calendar        — ελεύθερες καταγραφές του αγρότη (πρόβλημα / ενέργεια / προϊόν / άλλο / σημειώσεις)
//   spray_declaration     — δηλώσεις ψεκασμού (στόχοι, σκεύασμα, ημέρες προστασίας, PHI)
//   inspection_declaration— επιθεωρήσεις «χωρίς προσβολή»
//   action_log            — εντολές άρδευσης από το widget
//   declaration_undo      — αναιρέσεις
// και τις καλλιέργειες από την ετικέτα configuration. ΤΙΠΟΤΑ δεν γράφεται.
// PART: "summary" = μόνο πλήθη ανά αγρό · "nonempty" = πλήρεις εγγραφές ΜΟΝΟ των αγρών με δεδομένα · αριθμός N = σελίδα N (8 αγροί).
// Απαιτεί την πολιτική ανάγνωσης 6ac171e0 (isField=yes) ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PART = "nonempty";
const PER_PAGE = 8;
const VARS = ["field_calendar", "spray_declaration", "inspection_declaration", "action_log", "declaration_undo"];
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const cut = (s, n) => { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const d10 = (t) => String(t || "").slice(0, 16).replace("T", " ");
function crops(dev) {
  try {
    const c = (dev.tags || []).find(t => t.key === "configuration");
    const j = c ? JSON.parse(c.value) : null;
    if (!j) return "χωρίς ρύθμιση";
    const a = Array.isArray(j.crops) && j.crops.length ? j.crops : [j];
    return a.map(x => (x.cultivation_type || "?") + (x.plantation_year ? "/" + x.plantation_year : "")).join("+") + (j.covered_cultivation ? " (καλυμμένη)" : "");
  } catch (e) { return "ρύθμιση μη αναγνώσιμη"; }
}
function fmt(v, x) {
  let m = x.metadata, val = x.value;
  if (typeof val === "string" && /^[\[{]/.test(val)) { try { val = JSON.parse(val); } catch (e) {} }
  if (v === "field_calendar") {
    m = m || {};
    const parts = [];
    if (m.issueText) parts.push("Π:" + cut(m.issueText, 90));
    if (m.actionText) parts.push("Ε:" + cut(m.actionText, 90));
    if (m.productText) parts.push("Σ:" + cut(m.productText, 60));
    if (m.otherText) parts.push("Α:" + cut(m.otherText, 90));
    if (m.notes) parts.push("Ν:" + cut(m.notes, 120));
    if (!parts.length) parts.push("τιμή:" + cut(x.value, 120));
    return d10(m.datetimeISO || x.time) + (m.datetimeISO && Math.abs(Date.parse(m.datetimeISO) - Date.parse(x.time)) > 864e5 ? " (καταχ. " + d10(x.time).slice(0, 10) + ")" : "") + " " + parts.join(" ");
  }
  if (val && typeof val === "object") {
    if (v === "spray_declaration") return d10(val.spray_date || val.date || x.time) + " στόχοι:" + cut((val.target_pathogens || val.targets || val.pathogens || []).join(","), 120) + " σκ:" + cut(val.product_name || val.product || val.pesticide_key || "—", 50) + " πρ:" + (val.protection_days ?? val.days ?? "—") + "ημ PHI:" + (val.phi_days ?? val.phi ?? "—");
    if (v === "inspection_declaration") return d10(x.time) + " στόχοι:" + cut((val.target_pathogens || val.targets || val.pathogens || []).join(","), 120);
    if (v === "action_log") return d10(x.time) + " " + cut(val.summary || val.x || JSON.stringify(val), 100);
    return d10(x.time) + " " + cut(JSON.stringify(val), 100);
  }
  return d10(x.time) + " " + cut(val, 100);
}
(async () => {
  console.log("ΗΜΡ=== ΗΜΕΡΟΛΟΓΙΑ ΑΓΡΩΝ · PART " + PART + " · " + new Date().toISOString() + " ===");
  const devs = (await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=300")) || [];
  devs.sort((a, b) => String(a.name).localeCompare(String(b.name), "el"));
  console.log("ΗΜΡ0|αγροί " + devs.length);
  const tot = Object.fromEntries(VARS.map(v => [v, 0]));
  const page = PART === "summary" ? null : PART === "nonempty" ? -1 : Number(PART);
  const list = page === null || page === -1 ? devs : devs.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const sumRows = [];
  for (const d of list) {
    const row = { n: cut(d.name, 40), c: crops(d), k: {} };
    const lines = [];
    for (const v of VARS) {
      let a = [];
      try { a = await get(`/device/${d.id}/data?variable=${v}&qty=500&ordination=descending`); } catch (e) { row.k[v] = "ERR"; continue; }
      a = (a || []).filter(x => !(typeof x.value === "string" && x.value === "init"));
      row.k[v] = a.length; tot[v] += a.length;
      if (page !== null && a.length) lines.push(v + "(" + a.length + "): " + a.slice().reverse().map(x => fmt(v, x)).join(" ¦ "));
    }
    if (page === null) sumRows.push(row.n + " [" + row.c + "] " + VARS.map(v => v.replace(/_declaration|field_|_log/g, "") + "=" + row.k[v]).join(" "));
    else if (lines.length) {
      console.log("ΗΜΡΑ|" + row.n + " [" + row.c + "]");
      for (const l of lines) for (let i = 0; i < l.length; i += 1800) console.log("ΗΜΡΕ|" + row.n.slice(0, 18) + "|" + l.slice(i, i + 1800));
    }
  }
  if (page === null) for (let i = 0; i < sumRows.length; i += 10) console.log("ΗΜΡΣ|" + sumRows.slice(i, i + 10).join(" ║ "));
  console.log("ΗΜΡΤ|σύνολα: " + VARS.map(v => v + "=" + tot[v]).join(" · ") + " · σελίδες=" + Math.ceil(devs.length / PER_PAGE));
  console.log("ΗΜΡ=== ΤΕΛΟΣ ===");
})();
