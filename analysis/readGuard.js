// SAG readGuard (T-READGUARD-01, 28/11/2026, απόφαση Μιχάλη) — φρουρός των τριών μηνιαίων ορίων του TagoIO.
// Κάθε ώρα (:45 UTC) διαβάζει τη χρήση/όρια του λογαριασμού (δεν κοστίζει Data Output), κρατά ιστορικό 24 ωρών ΜΕΣΑ στη δική
// του εγγραφή (1 ανάγνωση/ώρα) και γράφει `read_guard` στη συσκευή «SAG Εποπτεία» με ok / warning / fault και κείμενο στα ελληνικά.
// Έλεγχοι: G1 αναγνώσεις τελευταίας ώρας · G2 αναγνώσεις 24ώρου · G3 πρόβλεψη αναγνώσεων ως το τέλος του μήνα · G4 πρόβλεψη
// εγγραφών εισόδου · G5 αποθήκευση. Αφορμή: 9–27/11 η «ημερήσια» διαγνωστική έτρεχε ωριαία (~6,9 εκατ. αναγνώσεις) και 25/11
// εξαντλήθηκαν οι αναγνώσεις (24 εκατ.) χωρίς καμία ειδοποίηση. node-rt2025, REST χωρίς SDK. Δεν στέλνει email· μόνο εγγραφή.
"use strict";
const API = "https://api.us-e1.tago.io";
const PROFILE = "67934c48e8e573000ae5964b";
const OVERSEER = "6a98855ca06e41000bfae024";   // «SAG Εποπτεία» (ίδια με gatewayLiveness)
const TH = { hourWarn: 60000, hourFault: 150000, dayWarn: 500000, dayFault: 1500000, projWarn: 0.9, projFault: 1.0, storWarn: 0.95, storFault: 0.98 };
const HIST_MAX = 26;

const fmtM = (x) => (x / 1e6).toFixed(2).replace(".", ",") + " εκατ.";
const fmtK = (x) => Math.round(x / 1e3).toLocaleString("el-GR") + " χιλ.";

// Αμιγής συνάρτηση: now = { ts, used:{output,input,data_records}, limit:{...} }, prevHist = [{ts, output, input}] (παλαιότερο πρώτο).
function evaluate(now, prevHist) {
  let hist = Array.isArray(prevHist) ? prevHist.filter((h) => h && Number.isFinite(h.ts)) : [];
  const last = hist[hist.length - 1];
  // Νέος μήνας (ο μετρητής μηδενίστηκε) ή άλλος μήνας UTC → νέο ιστορικό.
  const monthOf = (ts) => new Date(ts).toISOString().slice(0, 7);
  if (last && (now.used.output < last.output || monthOf(last.ts) !== monthOf(now.ts))) hist = [];
  const back = (hours) => { const t = now.ts - hours * 36e5; let best = null; for (const h of hist) if (h.ts <= t + 5 * 6e4) best = h; return best; };
  const h1 = back(1), h24 = back(24);
  const first = hist[0];
  const lastHour = h1 ? now.used.output - h1.output : null;
  const span24 = h24 ? (now.ts - h24.ts) / 864e5 : (first ? (now.ts - first.ts) / 864e5 : 0);
  const base24 = h24 || first;
  const day = base24 && span24 > 0.04 ? (now.used.output - base24.output) / span24 : null;     // αναγνώσεις/ημέρα
  const dayIn = base24 && span24 > 0.04 ? (now.used.input - base24.input) / span24 : null;
  const d = new Date(now.ts); const monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const daysLeft = (monthEnd - now.ts) / 864e5;
  const projOut = day != null ? now.used.output + day * daysLeft : null;
  const projIn = dayIn != null ? now.used.input + dayIn * daysLeft : null;
  const checks = [];
  const add = (id, sev, text_el) => checks.push({ id, sev, text_el });
  if (lastHour != null) {
    if (lastHour > TH.hourFault) add("G1", "fault", "Αναγνώσεις δεδομένων την τελευταία ώρα: " + fmtK(lastHour) + " — πολλαπλάσιες του κανονικού (~10 χιλ.). Βρείτε ποια ανάλυση ή εξαγωγή τρέχει τώρα.");
    else if (lastHour > TH.hourWarn) add("G1", "warning", "Αναγνώσεις δεδομένων την τελευταία ώρα: " + fmtK(lastHour) + " — περισσότερες από το κανονικό (~10 χιλ.).");
  }
  if (day != null) {
    if (day > TH.dayFault) add("G2", "fault", "Αναγνώσεις 24ώρου: " + fmtM(day) + " — πολύ πάνω από το κανονικό (~0,2–0,4 εκατ.).");
    else if (day > TH.dayWarn) add("G2", "warning", "Αναγνώσεις 24ώρου: " + fmtM(day) + " — πάνω από το κανονικό (~0,2–0,4 εκατ.).");
  }
  const pr = (id, what, proj, used, lim) => { if (proj == null || !lim) return; const r = proj / lim;
    if (r >= TH.projFault) add(id, "fault", what + ": με τον ρυθμό του τελευταίου 24ώρου το όριο (" + fmtM(lim) + ") εξαντλείται πριν το τέλος του μήνα (πρόβλεψη " + fmtM(proj) + "). Όταν εξαντληθεί, " + (id === "G3" ? "οι αναλύσεις και οι εξαγωγές δεν μπορούν να διαβάσουν δεδομένα." : "σταματά η λήψη μετρήσεων σε όλους.") );
    else if (r >= TH.projWarn) add(id, "warning", what + ": πρόβλεψη " + fmtM(proj) + " στο τέλος του μήνα (" + Math.round(100 * r) + " % του ορίου).");
  };
  pr("G3", "Αναγνώσεις", projOut, now.used.output, now.limit.output);
  pr("G4", "Εγγραφές εισόδου", projIn, now.used.input, now.limit.input);
  if (now.limit.data_records) { const r = now.used.data_records / now.limit.data_records;
    if (r >= TH.storFault) add("G5", "fault", "Αποθήκευση " + Math.round(100 * r) + " %: στο 100 % σταματά η αποθήκευση μετρήσεων σε όλους.");
    else if (r >= TH.storWarn) add("G5", "warning", "Αποθήκευση " + Math.round(100 * r) + " % του ορίου (" + fmtM(now.limit.data_records) + ")."); }
  const status = checks.some((c) => c.sev === "fault") ? "fault" : checks.length ? "warning" : "ok";
  hist = hist.concat([{ ts: now.ts, output: now.used.output, input: now.used.input }]).slice(-HIST_MAX);
  return { status, checks, last_hour: lastHour, per_day: day, per_day_input: dayIn, proj_output: projOut, proj_input: projIn, hist };
}

async function main() {
  const TOKEN = process.env.T_ANALYSIS_TOKEN;
  const api = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { Authorization: TOKEN, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(path + ": " + String(JSON.stringify(j.message || j)).slice(0, 160)); return j.result; };
  const sum = await api("GET", `/profile/${PROFILE}/summary`).catch((e) => ({ err: e.message }));
  const pick = (o, k) => { if (!o || typeof o !== "object") return null; for (const kk of [k, k === "data_records" ? "data" : k]) { const v = o[kk]; if (v != null && typeof v !== "object") return Number(v); } return null; };
  // /profile/:id/summary (μετρημένο 28/11): limit = όρια, limit_used = χρήση του μήνα (amount = πλήθος πόρων, όχι χρήση).
  const L = (sum && sum.limit) || {}; const U = (sum && sum.limit_used) || {};
  const now = { ts: Date.now(),
    used: { output: pick(U, "output"), input: pick(U, "input"), data_records: pick(U, "data_records") },
    limit: { output: pick(L, "output"), input: pick(L, "input"), data_records: pick(L, "data_records") } };
  if (![now.used.output, now.used.input, now.limit.output].every(Number.isFinite)) {
    console.log("[readGuard] Δεν βρέθηκαν μετρητές. summary=" + JSON.stringify(sum).slice(0, 600));
    return;
  }
  const prevRec = await api("GET", `/device/${OVERSEER}/data?variable=read_guard&qty=1`).catch(() => []);
  const prevHist = prevRec && prevRec[0] && prevRec[0].metadata && Array.isArray(prevRec[0].metadata.hist) ? prevRec[0].metadata.hist : [];
  const r = evaluate(now, prevHist);
  const meta = { checks: r.checks, used: now.used, limit: now.limit, last_hour: r.last_hour, per_day: r.per_day, per_day_input: r.per_day_input,
    proj_output: r.proj_output, proj_input: r.proj_input, hist: r.hist, thresholds: TH, ver: "T-READGUARD-01" };
  await api("POST", `/device/${OVERSEER}/data`, [{ variable: "read_guard", value: r.status, metadata: meta }]);
  console.log("[readGuard] " + r.status + " · ώρα " + (r.last_hour == null ? "—" : Math.round(r.last_hour)) + " · 24ω " + (r.per_day == null ? "—" : Math.round(r.per_day)) +
    " · πρόβλεψη αναγνώσεων " + (r.proj_output == null ? "—" : Math.round(r.proj_output)) + "/" + now.limit.output + " · εισόδου " + (r.proj_input == null ? "—" : Math.round(r.proj_input)) + "/" + now.limit.input +
    " · αποθήκευση " + now.used.data_records + "/" + now.limit.data_records + " · " + r.checks.map((c) => c.id + ":" + c.sev).join(" "));
}

if (typeof module !== "undefined" && module.exports) module.exports = { evaluate, TH };
if (typeof process !== "undefined" && process.env && process.env.T_ANALYSIS_TOKEN) main().catch((e) => console.log("[readGuard] ΣΦΑΛΜΑ " + (e && e.message ? e.message : e)));
