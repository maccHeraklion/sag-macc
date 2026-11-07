// SAG — ΜΙΑ ΕΓΓΡΑΦΗ · 7/11/2026 · Εντολή Μιχάλη: διόρθωση πινέζας Καμπιτάκη. Γράφει ΜΙΑ τιμή location στην παλιά εγγραφή …a2fa5f (είχε μήκος 24,00000 από το fieldLocationUpdate της 6/9).
// Πριν γράψει ελέγχει ότι η τρέχουσα τιμή είναι η λάθος· αλλιώς δεν κάνει τίποτα, ώστε δεύτερη εκτέλεση να μη γράφει ξανά.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "PN|";
const ID = "6a84217b34440f000ba2fa5f"; const LAT = NaN, LNG = NaN; // στην εκτέλεση δόθηκε η θέση της φόρμας του ενεργού αγρού …112a95· δεν μπαίνει στο δημόσιο repo
async function call(path, opts) { const r = await fetch(API + path, { ...(opts || {}), headers: { Authorization: TOKEN, "Content-Type": "application/json" } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 160)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const read = async () => { const x = await call(`/device/${ID}/data?variables[]=location&qty=1`); return x[0] || null; };
  const a = await read(); const c = a && a.location && a.location.coordinates;
  console.log(P + "ΠΡΙΝ|" + (a && a.time) + "|" + JSON.stringify(c));
  if (!c || Number(c[0]) !== 24) { console.log(P + "ΔΕΝ ΓΡΑΦΩ|η τρέχουσα τιμή δεν είναι η λάθος"); console.log(P + "=== ΤΕΛΟΣ"); return; }
  await call(`/device/${ID}/data`, { method: "POST", body: JSON.stringify([{ variable: "location", value: "", location: { lat: LAT, lng: LNG } }]) });
  const b = await read(); console.log(P + "ΜΕΤΑ|" + (b && b.time) + "|" + JSON.stringify(b && b.location && b.location.coordinates));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
