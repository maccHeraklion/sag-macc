/* T-PROFILE-01 (2/3) · ΑΝΤΙΣΤΡΟΦΟ — αφαιρεί ΜΟΝΟ ό,τι πρόσθεσα στη φόρμα.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: δεν αλλάζω παραγωγική φόρμα χωρίς να έχω γράψει ΠΡΩΤΑ τον
 * δρόμο της επιστροφής. Το «θα το ξαναφτιάξω αν χρειαστεί» δεν είναι σχέδιο.
 *
 * ΔΕΝ επαναφέρει ολόκληρο το widget από αντίγραφο — αυτό θα έσβηνε ό,τι άλλο
 * άλλαξε νόμιμα στο μεταξύ. Αφαιρεί ΣΤΟΧΕΥΜΕΝΑ το πεδίο `field_purpose` και τη
 * μεταβλητή του από τη συνδρομή, και τίποτε άλλο.
 *
 * Τρέξε το στο probe 6aa2d24f2f585a000b90b1a1. ΙΔΕΜΠΟΤΕΝΤΙΚΟ.
 */
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const DASH = "68f1fa2d46b86e0009bef545";
const WIDGET = "68f1fa2d46b86e0009bef546";
const VAR = "field_purpose";

async function api(path, opts = {}) {
  const r = await fetch("https://api.tago.io" + path, {
    ...opts,
    headers: { Authorization: TOKEN, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 250));
  return j.result;
}

async function startAnalysis() {
  console.log("=== ΑΝΤΙΣΤΡΟΦΟ · field_purpose · " + new Date().toISOString() + " ===");
  const w = await api(`/dashboard/${DASH}/widget/${WIDGET}`);
  const fields = w?.display?.sections?.[0]?.fields;
  if (!Array.isArray(fields)) { console.log("ΣΦΑΛΜΑ|δεν βρέθηκαν fields"); return; }

  const before = fields.length;
  const idx = fields.findIndex((f) => f?.data?.variable === VAR);
  if (idx < 0) { console.log("ΤΙΠΟΤΑ|το πεδίο δεν υπάρχει — η φόρμα είναι ήδη όπως πριν."); return; }
  fields.splice(idx, 1);

  const entry = (w.data || []).find((d) => Array.isArray(d?.variables));
  if (entry) {
    const k = entry.variables.indexOf(VAR);
    if (k >= 0) entry.variables.splice(k, 1);
  }

  await api(`/dashboard/${DASH}/widget/${WIDGET}`, { method: "PUT", body: JSON.stringify(w) });

  /* Επαλήθευση με ανάγνωση — ΠΟΤΕ δεν εμπιστεύομαι την επιτυχία της κλήσης. */
  const after = await api(`/dashboard/${DASH}/widget/${WIDGET}`);
  const f2 = after?.display?.sections?.[0]?.fields || [];
  const vars = after.data?.[0]?.variables || [];
  const gone = !f2.some((f) => f?.data?.variable === VAR) && !vars.includes(VAR);
  console.log(`ΜΕΤΑ|πεδία=${f2.length} (ήταν ${before})|μεταβλητές=${vars.length}`
    + `|το πεδίο έφυγε=${gone ? "ΝΑΙ" : "ΟΧΙ"}`);
  console.log(gone && f2.length === 28 && vars.length === 28
    ? "OK|η φόρμα επανήλθε στα 28 πεδία / 28 μεταβλητές."
    : "ΠΡΟΣΟΧΗ|οι αριθμοί δεν είναι 28/28 — κάποιος άλλαξε κι άλλα. Έλεγξε με το χέρι.");
}
module.exports = { startAnalysis };
startAnalysis().catch((e) => console.log("ΣΦΑΛΜΑ|" + (e && e.message)));
