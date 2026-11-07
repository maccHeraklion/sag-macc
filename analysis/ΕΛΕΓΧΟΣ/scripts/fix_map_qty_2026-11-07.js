// SAG — ΑΛΛΑΓΗ ΡΥΘΜΙΣΗΣ ΧΑΡΤΩΝ · 7/11/2026 · Εντολή Μιχάλη: «κράτα μόνο τις επικαιροποιημένες νέες θέσεις». Τρία widgets χάρτη: qty 500 → 1 στη μεταβλητή location, ώστε να μη ζωγραφίζονται οι παλιές τιμές ως κουκκίδες.
// Δεν διαγράφει δεδομένα. Αλλάζει ΜΟΝΟ το data[].qty. Αναίρεση: ίδιο script με QTY = 500. Γράφει μόνο το πεδίο data, και ελέγχει ότι μένουν ίδια τα origins.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "MQ|"; const QTY = 1;
const MAPS = [["684da2deba4998000a7bf6fe", "684da310cc1cd8000a5c9c55", 83], ["68769bc712627500090ed972", "68769bc712627500090ed975", 10], ["6877622f4090c0000ad94a01", "68779032126275000943aa08", 22]];
async function call(path, opts) { const r = await fetch(API + path, { ...(opts || {}), headers: { Authorization: TOKEN, "Content-Type": "application/json" } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(path.slice(-30) + " " + JSON.stringify(j.message || j).slice(0, 160)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  for (const [d, w, n] of MAPS) {
    try {
      const a = await call(`/dashboard/${d}/widget/${w}`); const data = a.data || [];
      if (a.type !== "map" || data.length !== n || !data.every((x) => JSON.stringify(x.variables) === '["location"]')) { console.log(P + "ΔΕΝ ΓΡΑΦΩ|" + w.slice(-6) + "|τύπος " + a.type + " εγγραφές " + data.length + " αναμενόμενες " + n); continue; }
      const before = data.map((x) => x.origin).join(); const qs = [...new Set(data.map((x) => x.qty))].join();
      await call(`/dashboard/${d}/widget/${w}`, { method: "PUT", body: JSON.stringify({ data: data.map((x) => ({ ...x, qty: QTY })) }) });
      const b = await call(`/dashboard/${d}/widget/${w}`);
      console.log(P + "ΧΑΡΤΗΣ|" + w.slice(-6) + "|πριν qty " + qs + "|μετά qty " + [...new Set((b.data || []).map((x) => x.qty))].join() + "|εγγραφές " + (b.data || []).length + "|origins ίδια " + ((b.data || []).map((x) => x.origin).join() === before) + "|πινέζες " + ((b.display && b.display.variables) || []).length);
    } catch (e) { console.log(P + "ΣΦΑΛΜΑ|" + w.slice(-6) + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
